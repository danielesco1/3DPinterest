"""Explicit staged intake. No Atlas requests; media stays local except Slack download."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.parse
import urllib.request


def write_json(path, value):
    with Path(path).open('x') as out:
        json.dump(value, out, indent=2)
        out.write('\n')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('Redirect blocked: download manually rather than forwarding credentials')


def slack_url(url):
    p = urllib.parse.urlsplit(url)
    if p.scheme != 'https' or p.hostname != 'files.slack.com' or p.username or p.password or p.port:
        raise ValueError('Expected private files.slack.com HTTPS download URL')
    return url


def intake(file_id, out):
    if not re.fullmatch(r'F[A-Z0-9]+', file_id):
        raise ValueError('Expected Slack file ID, not message URL')
    token = os.environ.get('SLACK_TOKEN')
    if not token:
        raise ValueError('Set SLACK_TOKEN securely; files:read and channel access required')
    out.mkdir(parents=True, exist_ok=False)
    opener = urllib.request.build_opener(NoRedirect())
    headers = {'Authorization': 'Bearer ' + token}
    req = urllib.request.Request('https://slack.com/api/files.info?file=' + file_id, headers=headers)
    with opener.open(req, timeout=30) as response:
        info = json.load(response)
    if not info.get('ok'):
        raise ValueError('Slack files.info failed: ' + info.get('error', 'unknown'))
    f = info['file']
    if f.get('is_external') or not f.get('mimetype', '').startswith('video/'):
        raise ValueError('Only Slack-hosted videos supported; download other sources manually')
    url = slack_url(f.get('url_private_download') or f['url_private'])
    # Fixed filename prevents traversal through a remote-provided name.
    video = out / 'source.video'
    req = urllib.request.Request(url, headers=headers)
    with opener.open(req, timeout=120) as response, video.open('xb') as target:
        while chunk := response.read(1024 * 1024):
            target.write(chunk)
    write_json(out / 'source.json', {'slack_file_id': file_id, 'original_name': f.get('name'),
               'permalink': f.get('permalink'), 'local_video': str(video.resolve())})
    return video


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def media(video, out, interval):
    if not math.isfinite(interval) or interval <= 0:
        raise ValueError('Interval must be positive')
    video = video.resolve(strict=True)
    out.mkdir(parents=True, exist_ok=False)
    probe = json.loads(run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(video)]))
    duration = float(probe['format']['duration'])
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError('Video duration unavailable')
    frames = []
    for i in range(math.ceil(duration / interval)):
        t = round(i * interval, 6)
        name = f'frame-{i:04d}.jpg'
        run(['ffmpeg', '-v', 'error', '-nostdin', '-ss', str(t), '-i', str(video), '-frames:v', '1', '-q:v', '2', str(out/name)])
        frames.append({'id': f'frame-{i:04d}', 'requested_timestamp_seconds': t, 'path': name})
    has_audio = any(s.get('codec_type') == 'audio' for s in probe['streams'])
    if has_audio:
        run(['ffmpeg', '-v', 'error', '-nostdin', '-i', str(video), '-vn', '-ac', '1', '-ar', '16000', str(out/'audio.wav')])
    digest = hashlib.sha256()
    with video.open('rb') as source:
        for chunk in iter(lambda: source.read(1024*1024), b''):
            digest.update(chunk)
    manifest = {'schema_version': 1, 'video': str(video), 'sha256': digest.hexdigest(),
                'duration_seconds': duration, 'frames': frames, 'audio': 'audio.wav' if has_audio else None}
    write_json(out/'manifest.json', manifest)
    return manifest


def observations(manifest, transcript):
    results = []
    for i, s in enumerate(transcript.get('segments', [])):
        start, end = float(s['start']), float(s['end'])
        if not (math.isfinite(start) and math.isfinite(end) and 0 <= start <= end <= manifest['duration_seconds'] + 1):
            raise ValueError('Transcript timestamp outside source video')
        nearby = sorted(manifest['frames'], key=lambda f: abs(f['requested_timestamp_seconds'] - (start+end)/2))[:1]
        results.append({'id': f'observation-{i:04d}', 'start_seconds': start, 'end_seconds': end,
                        'text': s['text'], 'words': s.get('words', []), 'review_status': 'unreviewed',
                        'source_video_sha256': manifest['sha256'],
                        'candidate_frame_id': nearby[0]['id'] if nearby else None,
                        'spatial_anchor': None, 'spatial_status': 'unlocalized',
                        'reason': 'Timing suggests a view, not the object being discussed.'})
    return {'schema_version': 1, 'observations': results}


def link_views(manifest, selected_ids, operation):
    if not operation.get('done') or operation.get('error'):
        raise ValueError('Need successful pose operation')
    known = {f['id']: f for f in manifest['frames']}
    posed = operation.get('response', {}).get('frames', [])
    if len(selected_ids) != len(posed) or len(set(selected_ids)) != len(selected_ids):
        raise ValueError('One unique source frame ID required per posed result, in submission order')
    return {'schema_version': 1, 'video_sha256': manifest['sha256'], 'pose_operation_id': operation.get('id'),
            'views': [{'source_frame': known[fid], 'posed_view': frame} for fid, frame in zip(selected_ids, posed)],
            'spatial_status': 'camera_views_only_not_object_anchors'}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='command', required=True)
    a = sub.add_parser('slack'); a.add_argument('file_id'); a.add_argument('out', type=Path)
    a = sub.add_parser('media'); a.add_argument('video', type=Path); a.add_argument('out', type=Path); a.add_argument('--interval', type=float, default=5)
    a = sub.add_parser('transcribe'); a.add_argument('audio', type=Path); a.add_argument('out', type=Path); a.add_argument('--model', default='base')
    a = sub.add_parser('observations'); a.add_argument('manifest', type=Path); a.add_argument('transcript', type=Path); a.add_argument('out', type=Path)
    a = sub.add_parser('link-views'); a.add_argument('manifest', type=Path); a.add_argument('selected_ids', type=Path); a.add_argument('operation', type=Path); a.add_argument('out', type=Path)
    args = p.parse_args()
    read = lambda path: json.loads(path.read_text())
    try:
        if args.command == 'slack': intake(args.file_id, args.out)
        elif args.command == 'media': media(args.video, args.out, args.interval)
        elif args.command == 'transcribe':
            args.out.mkdir(parents=True, exist_ok=False)
            subprocess.run([sys.executable, '-m', 'whisper', str(args.audio.resolve(strict=True)), '--model', args.model,
                '--output_dir', str(args.out), '--output_format', 'json', '--word_timestamps', 'True'], check=True)
        elif args.command == 'observations': write_json(args.out, observations(read(args.manifest), read(args.transcript)))
        else: write_json(args.out, link_views(read(args.manifest), read(args.selected_ids), read(args.operation)))
    except Exception as error:
        # Avoid logging URLs, credentials or subprocess output on failures.
        p.exit(1, f'{type(error).__name__}: stage failed; inspect local inputs and dependencies. No automatic retry.\n')

if __name__ == '__main__': main()
