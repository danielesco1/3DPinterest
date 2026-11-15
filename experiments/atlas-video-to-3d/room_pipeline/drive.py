"""Private Drive publisher. Explicit upload gate; retry at verified file boundaries.

Uses Drive v3 resumable uploads. Session URLs remain in memory only. A failed
file restarts on the next run; verified files are skipped after remote readback.
No permission changes, credential creation, or token persistence.
"""
import json
import os
from pathlib import Path
from urllib import request, parse, error
from .gallery import sha256, atomic_json, safe_id

BASE = 'https://www.googleapis.com/drive/v3/files'
FIELDS = 'id,name,size,sha256Checksum,webViewLink,parents,trashed'


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Drive:
    def __init__(self, token):
        self.token = token

    def call(self, method, url, body=None, headers=None):
        parsed = parse.urlparse(url)
        if parsed.scheme != 'https' or parsed.hostname != 'www.googleapis.com':
            raise ValueError('Unexpected Drive upload host')
        hdr = {'Authorization': 'Bearer ' + self.token, **(headers or {})}
        req = request.Request(url, data=body, headers=hdr, method=method)
        try:
            with request.build_opener(NoRedirect()).open(req, timeout=120) as r:
                return r.status, dict(r.headers), r.read()
        except error.HTTPError as exc:
            if exc.code == 308:
                return 308, dict(exc.headers), b''
            # Do not expose signed upload URLs or response bodies in logs.
            raise RuntimeError(f'Drive request failed (HTTP {exc.code}); refresh authorization or retry') from None

    def json(self, method, url, body=None):
        _, _, raw = self.call(method, url, None if body is None else json.dumps(body).encode(),
                              {'Content-Type': 'application/json'})
        return json.loads(raw)

    def find(self, name, parent):
        quote = lambda s: s.replace('\\', '\\\\').replace("'", "\\'")
        q = f"name = '{quote(name)}' and '{quote(parent)}' in parents and trashed = false"
        found, token = [], None
        while True:
            params = {'q': q, 'fields': 'nextPageToken,files(id,name,mimeType)', 'pageSize': 1000,
                      'supportsAllDrives': 'true', 'includeItemsFromAllDrives': 'true'}
            if token:
                params['pageToken'] = token
            result = self.json('GET', BASE + '?' + parse.urlencode(params))
            found.extend(result.get('files', []))
            token = result.get('nextPageToken')
            if not token:
                break
        if len(found) > 1:
            raise ValueError('Ambiguous duplicate Drive destination: ' + name)
        return found[0] if found else None

    def folder(self, name, parent):
        existing = self.find(name, parent)
        if existing:
            if existing['mimeType'] != 'application/vnd.google-apps.folder':
                raise ValueError('Destination is not a folder')
            return existing['id']
        return self.json('POST', BASE + '?supportsAllDrives=true',
                         {'name': name, 'parents': [parent], 'mimeType': 'application/vnd.google-apps.folder'})['id']

    def metadata(self, file_id):
        return self.json('GET', BASE + '/' + parse.quote(file_id, safe='') + '?' +
                         parse.urlencode({'fields': FIELDS, 'supportsAllDrives': 'true'}))

    def upload(self, path, parent, file_id=None):
        size = path.stat().st_size
        endpoint = 'https://www.googleapis.com/upload/drive/v3/files'
        if file_id:
            endpoint += '/' + parse.quote(file_id, safe='')
        endpoint += '?uploadType=resumable&supportsAllDrives=true'
        metadata = {'name': path.name}
        if not file_id:
            metadata['parents'] = [parent]
        _, headers, _ = self.call('PATCH' if file_id else 'POST', endpoint,
                                  json.dumps(metadata).encode(),
                                  {'Content-Type': 'application/json', 'X-Upload-Content-Length': str(size)})
        session = next(v for k, v in headers.items() if k.lower() == 'location')
        with path.open('rb') as f:
            offset = 0
            while True:
                chunk = f.read(8 * 1024 * 1024)
                content_range = f'bytes {offset}-{offset+len(chunk)-1}/{size}' if size else 'bytes */0'
                status, _, raw = self.call('PUT', session, chunk, {'Content-Range': content_range})
                if status != 308:
                    return json.loads(raw)['id']
                offset += len(chunk)
                if offset >= size:
                    raise RuntimeError('Upload did not complete; retry will verify remote state')


def publish_package(package_dir, root_folder_id, allow_upload=False,
                    token_env='GOOGLE_DRIVE_ACCESS_TOKEN', client=None):
    if not allow_upload:
        raise PermissionError('Drive publishing requires explicit allow_upload=True')
    if not root_folder_id:
        raise ValueError('Authorized destination root folder is required')
    if client is None:
        token = os.environ.get(token_env)
        if not token:
            raise ValueError(f'Missing {token_env}; connector credentials are not reusable as CLI credentials')
        client = Drive(token)
    package_dir = Path(package_dir).resolve()
    manifest = json.loads((package_dir / 'manifest.json').read_text())
    seen = set()
    for asset in manifest['assets']:
        relative = asset['path']
        path = (package_dir / relative).resolve()
        if relative in seen or not path.is_relative_to(package_dir) or not path.is_file():
            raise ValueError('Invalid or duplicate package asset')
        if sha256(path) != asset['sha256']:
            raise ValueError('Package hash changed: ' + relative)
        seen.add(relative)
    folder = client.folder('Spaces', root_folder_id)
    folder = client.folder(safe_id(manifest['space_id']), folder)
    folder = client.folder(safe_id(manifest['take_id']), folder)
    state_path = package_dir.parent / 'drive-receipts.json'
    state = json.loads(state_path.read_text()) if state_path.exists() else {'root': root_folder_id, 'files': {}}
    if state['root'] != root_folder_id:
        raise ValueError('Receipt destination mismatch')
    folders = {'': folder}
    def put(relative, expected=None):
        path = (package_dir / relative).resolve()
        if not path.is_relative_to(package_dir) or not path.is_file():
            raise ValueError('Invalid package asset path')
        digest = sha256(path)
        if expected and digest != expected:
            raise ValueError('Package hash changed: ' + relative)
        parts = Path(relative).parts[:-1]
        parent = folder
        for i, part in enumerate(parts):
            key = '/'.join(parts[:i+1])
            if key not in folders:
                folders[key] = client.folder(part, parent)
            parent = folders[key]
        receipt = state['files'].get(relative)
        existing = client.find(path.name, parent)
        if existing:
            meta = client.metadata(existing['id'])
            if meta.get('sha256Checksum') == digest and int(meta.get('size', -1)) == path.stat().st_size:
                file_id = existing['id']
            else:
                if not receipt or receipt['file_id'] != existing['id'] or meta.get('sha256Checksum') != receipt['sha256']:
                    raise ValueError('Unrecognized or remotely edited file; preserve and review: ' + relative)
                file_id = client.upload(path, parent, existing['id'])
        else:
            file_id = client.upload(path, parent)
        meta = client.metadata(file_id)
        if meta.get('sha256Checksum') != digest or int(meta.get('size', -1)) != path.stat().st_size:
            raise ValueError('Remote checksum/size verification failed: ' + relative)
        state['files'][relative] = {'file_id': file_id, 'sha256': digest,
                                    'web_view_link': meta.get('webViewLink')}
        atomic_json(state_path, state)
        return state['files'][relative]
    for asset in manifest['assets']:
        asset['drive'] = put(asset['path'], asset['sha256'])
    put('index.html')
    # Publish bound manifest last, only after every asset has verified remote bytes.
    atomic_json(package_dir / 'manifest.json', manifest)
    put('manifest.json')
    return {'folder_id': folder, 'verified_files': len(state['files']),
            'folder_url': 'https://drive.google.com/drive/folders/' + folder}
