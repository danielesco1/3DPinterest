"""Portable per-take artifact package. No network, credentials, or sharing changes."""
import hashlib
import json
import mimetypes
import re
import shutil
from pathlib import Path


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def atomic_json(path, data):
    path = Path(path)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(data, indent=2) + '\n')
    temp.replace(path)


def safe_id(value):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}', value):
        raise ValueError('Invalid space/take identifier')
    return value


def sanitize(value):
    """Remove transport credentials/URLs, not geometry or camera attributes."""
    if isinstance(value, dict):
        return {k: sanitize(v) for k, v in value.items()
                if not any(x in k.lower() for x in ('token', 'secret', 'authorization', 'api_key'))
                and not k.lower().endswith(('url', 'uri'))}
    if isinstance(value, list):
        return [sanitize(v) for v in value]
    if isinstance(value, str) and value.startswith(('http://', 'https://')):
        return '[remote URL omitted]'
    return value


def build_package(run_dir, space_id, take_id, video=None):
    """Rebuild changed artifacts atomically; preserve original files and upload receipts."""
    safe_id(space_id)
    safe_id(take_id)
    run_dir = Path(run_dir).resolve()
    dest = run_dir / 'package'
    dest.mkdir(parents=True, exist_ok=True)
    assets = []
    sources = []
    for stage in ('media', 'transcription', 'atlas', 'cad', 'viewer'):
        root = run_dir / stage
        if root.exists():
            for source in sorted(root.rglob('*')):
                if source.is_file():
                    if source.is_symlink() or not source.resolve().is_relative_to(root.resolve()):
                        raise ValueError('Artifact symlinks are not permitted')
                    if source.name == 'checkpoint.json' or any(p.startswith('.') for p in source.relative_to(root).parts):
                        continue
                    if any(x in source.name.lower() for x in ('credential', 'secret', 'token', '.env', '.tmp')):
                        continue
                    sources.append((source, source.relative_to(run_dir).as_posix()))
    if video:
        sources.append((Path(video), 'original/video' + Path(video).suffix.lower()))
    for source, relative in sources:
        target = dest / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp = target.with_name(target.name + '.tmp')
        if source.suffix.lower() == '.json':
            tmp.write_text(json.dumps(sanitize(json.loads(source.read_text())), indent=2) + '\n')
        else:
            shutil.copyfile(source, tmp)
        tmp.replace(target)
        assets.append({'path': relative, 'role': relative.split('/')[0],
                       'sha256': sha256(target), 'size_bytes': target.stat().st_size,
                       'mime_type': mimetypes.guess_type(relative)[0] or 'application/octet-stream'})
    manifest = {'schema_version': '2.0', 'space_id': safe_id(space_id), 'take_id': safe_id(take_id),
                'assets': assets, 'coordinates': 'source-native; no implicit axis conversion',
                'limitations': ['Room geometry is an estimate, not a survey.',
                                'Scale is uncalibrated unless a measured reference is supplied.',
                                'Private Drive preview links are not raw viewer asset URLs.']}
    atomic_json(dest / 'manifest.json', manifest)
    (dest / 'index.html').write_text('''<!doctype html><meta charset="utf-8"><title>Space artifacts</title>
<style>body{font:16px system-ui;max-width:900px;margin:40px auto;background:#eee}li{margin:12px}</style>
<h1 id="title">Space artifacts</h1><p>Estimated geometry. Review scale and openings before use.</p><ul id="files"></ul>
<script>fetch('manifest.json').then(r=>r.json()).then(m=>{document.getElementById('title').textContent=m.space_id+' / '+m.take_id;for(const a of m.assets){const li=document.createElement('li'),link=document.createElement('a');link.textContent=a.path;link.href=a.path.split('/').map(encodeURIComponent).join('/');li.append(link);document.getElementById('files').append(li)}})</script>''')
    return dest
