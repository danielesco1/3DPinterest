"""Offline gallery package + Drive connector upload plan. Never uploads or changes sharing."""
import argparse
import hashlib
import json
import mimetypes
from pathlib import Path
import re
import shutil


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()


def slug(value):
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}', value):
        raise ValueError('Use a short alphanumeric space/take ID with hyphens or underscores')
    return value


def clean_json(value):
    # Atlas asset URLs can expire or contain access tokens. Persist stable asset IDs.
    if isinstance(value, dict):
        return {k: clean_json(v) for k, v in value.items() if k not in ('url', 'readUrl', 'uploadUrl')}
    if isinstance(value, list): return [clean_json(v) for v in value]
    return value


def write(path, value):
    with path.open('x') as out:
        json.dump(value, out, indent=2); out.write('\n')


def package(video, capture, root, space_id, take_id, transcript=None, observations=None, views=None, model=None, source_url=None):
    manifest = json.loads((capture/'manifest.json').read_text())
    if digest(video) != manifest['sha256']:
        raise ValueError('Capture belongs to a different video')
    destination = root / slug(space_id) / slug(take_id)
    destination.mkdir(parents=True, exist_ok=False)
    assets = []
    def add(source, relative, role, content=None):
        target = destination/relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if content is None: shutil.copyfile(source, target)
        else: write(target, clean_json(content))
        item = {'id': relative, 'role': role, 'path': relative, 'size_bytes': target.stat().st_size,
                'sha256': digest(target), 'mime_type': mimetypes.guess_type(relative)[0] or 'application/octet-stream',
                'drive': None}
        assets.append(item)
        return item['id']
    suffix = video.suffix if video.suffix.lower() in ('.mov','.mp4','.webm','.mkv') else '.mov'
    video_id = add(video, 'original/video'+suffix, 'source_video')
    frame_records = []
    for frame in manifest['frames']:
        source = (capture/frame['path']).resolve()
        if not source.is_relative_to(capture.resolve()): raise ValueError('Unsafe frame path')
        relative = 'frames/'+Path(frame['path']).name
        asset = add(source, relative, 'frame')
        frame_records.append({'id':frame['id'], 'asset_id':asset, 'timestamp_seconds':frame['requested_timestamp_seconds'],
                              'timing_accuracy':'requested_seek_not_exact_pts'})
    if manifest.get('audio'):
        audio = (capture/manifest['audio']).resolve()
        if not audio.is_relative_to(capture.resolve()): raise ValueError('Unsafe audio path')
        add(audio, 'audio/audio.wav', 'audio')
    for source, relative, role in [(transcript,'transcript/transcript.json','transcript'),
                                  (observations,'annotations/observations.json','observations'),
                                  (views,'reconstruction/view-links.json','posed_views')]:
        if source:
            data = json.loads(source.read_text())
            hashes = [x.get('source_video_sha256') for x in data.get('observations', [])]
            if data.get('video_sha256'): hashes.append(data['video_sha256'])
            if any(h and h != manifest['sha256'] for h in hashes): raise ValueError('Annotation source mismatch')
            add(source, relative, role, data)
    if model: add(model, 'reconstruction/model'+model.suffix.lower(), 'model')
    result = {'schema_version':'1.0', 'space_id':space_id,'take_id':take_id,
              'source':{'video_asset_id':video_id,'sha256':manifest['sha256'],'url':source_url},
              'duration_seconds':manifest['duration_seconds'],
              'poster_asset_id':frame_records[0]['asset_id'] if frame_records else None,
              'frames':frame_records,'assets':assets,
              'status':{'transcription':'available_unreviewed' if transcript else 'pending',
                        'observations':'available_unreviewed' if observations else 'pending',
                        'reconstruction':'available_unreviewed' if model else 'pending',
                        'spatial_grounding':'unlocalized'},
              'limitations':['Timestamp associates speech with a view, not an object.',
                              '3D scale and geometry are estimated; review before measurement.']}
    write(destination/'manifest.json',result)
    plan = {'root_relative_path':space_id+'/'+take_id,'manifest_upload_last':True,
            'files':[{'path':a['path'],'local_path':str((destination/a['path']).resolve()),
                      'mime_type':a['mime_type'],'sha256':a['sha256']} for a in assets],
            'instructions':'Create missing folders under the authorized Drive parent. Upload files, verify metadata/checksums, then bind receipts and upload manifest last. Do not change sharing.'}
    write(destination/'upload-plan.json', plan)
    return destination


def bind_drive(manifest, receipts):
    expected = {a['path'] for a in manifest['assets']}
    if set(receipts) != expected: raise ValueError('Receipts must cover each asset exactly once')
    for asset in manifest['assets']:
        r = receipts[asset['path']]
        if not r.get('file_id') or r.get('sha256') != asset['sha256']:
            raise ValueError('Missing Drive ID or mismatched verified hash')
        asset['drive'] = {'file_id':r['file_id'],'web_view_link':r.get('web_view_link')}
    return manifest


def main():
    p=argparse.ArgumentParser(description=__doc__)
    sub=p.add_subparsers(dest='command',required=True)
    a=sub.add_parser('build')
    for name in ['video','capture','out']: a.add_argument(name,type=Path)
    a.add_argument('--space',required=True);a.add_argument('--take',required=True)
    for name in ['transcript','observations','views','model']:a.add_argument('--'+name,type=Path)
    a.add_argument('--source-url')
    a=sub.add_parser('bind-drive');a.add_argument('manifest',type=Path);a.add_argument('receipts',type=Path);a.add_argument('out',type=Path)
    args=p.parse_args()
    if args.command=='build':
        print(package(args.video,args.capture,args.out,args.space,args.take,args.transcript,args.observations,args.views,args.model,args.source_url))
    else:write(args.out,bind_drive(json.loads(args.manifest.read_text()),json.loads(args.receipts.read_text())))

if __name__=='__main__':main()
