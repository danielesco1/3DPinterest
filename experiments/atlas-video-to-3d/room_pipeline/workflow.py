"""Reproducible per-take stage commands. Planning is local and side-effect free."""
import argparse
import json
import math
import re
import subprocess
import sys
from pathlib import Path

STAGES = ('prepare', 'pose', 'splat', 'astra', 'export', 'publish')
FIELDS = {'schema_version', 'video', 'space', 'take', 'output_root', 'interval',
          'max_frames', 'grid', 'cad_evidence', 'drive_root'}
SLUG = re.compile(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}\Z')
GRIDS = {(1280, 720), (720, 1280), (960, 720), (528, 704)}


def load_config(path):
    """Paths are relative to the config, never the caller's current directory."""
    path = Path(path).resolve()
    data = json.loads(path.read_text())
    if not isinstance(data, dict) or set(data) - FIELDS:
        raise ValueError('Unknown configuration fields; do not store credentials or permissions')
    if type(data.get('schema_version')) is not int or data['schema_version'] != 1:
        raise ValueError('schema_version must be 1')
    for key in ('space', 'take'):
        if not isinstance(data.get(key), str) or not SLUG.fullmatch(data[key]):
            raise ValueError(f'{key} must be a safe slug')
    for key in ('video', 'output_root', 'cad_evidence'):
        value = data.get(key, 'runs' if key == 'output_root' else None)
        if value is not None:
            if not isinstance(value, str) or not value or '\x00' in value or '://' in value:
                raise ValueError(f'{key} must be a local path')
            data[key] = str((path.parent / value).resolve())
    if not data.get('video'):
        raise ValueError('video is required')
    interval = data.get('interval', 1)
    if isinstance(interval, bool) or not isinstance(interval, (int, float)) or not math.isfinite(interval) or interval <= 0:
        raise ValueError('interval must be finite and positive')
    frames = data.get('max_frames', 60)
    if isinstance(frames, bool) or not isinstance(frames, int) or frames < 1:
        raise ValueError('max_frames must be a positive integer')
    grid = data.get('grid', [720, 1280])
    if not isinstance(grid, list) or any(type(v) is not int for v in grid) or tuple(grid) not in GRIDS:
        raise ValueError('grid must be a supported Atlas image size')
    drive = data.get('drive_root')
    if drive is not None and (not isinstance(drive, str) or not re.fullmatch(r'[A-Za-z0-9_-]+', drive)):
        raise ValueError('drive_root must be a folder ID, not a URL')
    data.update(interval=interval, max_frames=frames, grid=grid)
    return data


def build_command(config, stage, *, allow_upload=False, allow_paid=False,
                  max_credits=0, pose_reviewed=False, allow_drive_upload=False):
    if stage not in STAGES:
        raise ValueError('Unknown stage')
    if isinstance(max_credits, bool) or not isinstance(max_credits, int) or max_credits < 0:
        raise ValueError('max_credits must be a nonnegative integer')
    if stage == 'splat' and not pose_reviewed:
        raise ValueError('Inspect the poses first; splat stage requires --pose-reviewed')
    if stage in ('export', 'publish') and not config.get('cad_evidence'):
        raise ValueError('Reviewed cad_evidence is required; an unsupported proposal is not an export')
    if stage == 'publish' and not config.get('drive_root'):
        raise ValueError('An authorized drive_root is required')
    command = [sys.executable, '-m', 'room_pipeline', config['video'],
               '--space', config['space'], '--take', config['take'],
               '--output-root', config['output_root'], '--interval', str(config['interval']),
               '--max-frames', str(config['max_frames'])]
    if stage in ('pose', 'splat'):
        command += ['--atlas', '--grid', *map(str, config['grid']), '--max-credits', str(max_credits)]
        if allow_upload: command += ['--allow-upload']
        if allow_paid: command += ['--allow-paid']
        if stage == 'splat': command += ['--pose-reviewed']
    if stage == 'astra':
        # Prepare evidence only; never infer/invoke an arbitrary executable from config.
        command += ['--astra']
    if stage in ('export', 'publish'):
        command += ['--cad-evidence', config['cad_evidence'], '--package']
    if stage == 'publish':
        command += ['--drive-root', config['drive_root']]
        if allow_drive_upload: command += ['--allow-drive-upload']
    return command


def main(argv=None):
    parser = argparse.ArgumentParser(description='Plan a repeatable space/take stage; no execution without --run.')
    parser.add_argument('config', type=Path)
    parser.add_argument('--stage', choices=STAGES, default='prepare')
    parser.add_argument('--run', action='store_true')
    parser.add_argument('--allow-upload', action='store_true')
    parser.add_argument('--allow-paid', action='store_true')
    parser.add_argument('--max-credits', type=int, default=0)
    parser.add_argument('--pose-reviewed', action='store_true')
    parser.add_argument('--allow-drive-upload', action='store_true')
    args = parser.parse_args(argv)
    try:
        config = load_config(args.config)
        command = build_command(config, args.stage, allow_upload=args.allow_upload,
                                allow_paid=args.allow_paid, max_credits=args.max_credits,
                                pose_reviewed=args.pose_reviewed, allow_drive_upload=args.allow_drive_upload)
        print(json.dumps({'stage': args.stage, 'executing': args.run, 'argv': command,
                          'take_directory': str(Path(config['output_root']) / config['space'] / config['take']),
                          'note': 'Stage completion is not geometry accuracy. Review evidence before export.'}, indent=2))
        if args.run:
            if not Path(config['video']).is_file():
                raise ValueError('Input video is unavailable')
            result = subprocess.run(command, cwd=Path(__file__).resolve().parents[1], check=False)
            return result.returncode
        return 0
    except (ValueError, OSError, TypeError):
        # Do not echo arbitrary config/provider content, URLs or credentials.
        parser.exit(1, 'Workflow stopped: check configuration and required review gates.\n')


if __name__ == '__main__':
    sys.exit(main())
