"""Export allowlisted viewer assets without a runtime Python server."""
import argparse
import json
import shutil
import tempfile
from pathlib import Path
import serve

REQUIRED = (serve.SOURCE_FILES | {'scene.json', 'viewer-data.json', 'reconstruction.spz',
    'core-envelope.json', 'partial-sample-points.json', 'provisional-outlines.json',
    'core-plan.svg', 'core-volume.svg'} | {f'vendor/{n}' for n in serve.VENDOR_FILES})
OPTIONAL = {'partial-plan.png', 'response.json'}


def export_scenes(scene_ids, output, base=None):
    """Validate every scene first; stage output before replacing an older export."""
    base = Path(base or serve.BASE)
    prepared = {}
    errors = []
    for scene_id in scene_ids:
        files = {}
        for name in sorted(REQUIRED | OPTIONAL):
            try:
                value = (serve.scene_config(scene_id, static=True, scene_ids=scene_ids)
                         if name == 'scene.json' else serve.generated_asset(scene_id, name, base))
                if value is not None:
                    files[name] = json.dumps(value, indent=2).encode()
                else:
                    source = serve.asset_path(scene_id, name, base)
                    if source.is_file():
                        if source.suffix == '.json':
                            serve.read_json(source)  # Fail before publishing malformed data.
                        files[name] = source
                    elif name in REQUIRED:
                        errors.append(f'{scene_id}: missing {source}')
            except (OSError, ValueError, KeyError, StopIteration) as exc:
                errors.append(f'{scene_id}/{name}: {exc}')
        prepared[scene_id] = files
    if errors:
        raise ValueError('Restore required scene assets before exporting:\n' + '\n'.join(errors))
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    for scene_id, files in prepared.items():
        with tempfile.TemporaryDirectory(prefix='.export-', dir=output) as temporary:
            stage = Path(temporary) / scene_id
            stage.mkdir()
            for name, source in files.items():
                destination = stage / name
                destination.parent.mkdir(parents=True, exist_ok=True)
                if isinstance(source, bytes):
                    destination.write_bytes(source)
                else:
                    shutil.copy2(source, destination)
            target = output / scene_id
            # Only generated output is replaced, never source assets.
            if target.exists():
                shutil.rmtree(target)
            stage.rename(target)
            print(f'{scene_id}: {len(files)} assets exported to {target}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scene', choices=['all', *serve.SCENES], default='all')
    parser.add_argument('--output', type=Path, default=serve.HERE / 'dist')
    args = parser.parse_args()
    try:
        export_scenes(list(serve.SCENES) if args.scene == 'all' else [args.scene], args.output)
    except ValueError as exc:
        parser.exit(1, str(exc) + '\n')


if __name__ == '__main__':
    main()
