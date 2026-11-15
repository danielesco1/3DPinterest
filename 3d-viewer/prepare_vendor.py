"""Prepare pinned viewer dependencies; never downloads private space assets."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

from serve import BASE, SCENES

URLS = {
    'spark.module.js': 'https://sparkjs.dev/releases/spark/2.4.0/spark.module.js',
    'three.module.js': 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js',
    'three.core.js': 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.core.js',
    'OrbitControls.js': 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js',
    'Pass.js': 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/postprocessing/Pass.js',
}


def prepare(scene):
    destination = BASE / SCENES[scene]['assets'] / 'vendor'
    destination.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, url in URLS.items():
        target = destination / name
        downloaded = not target.exists()
        if downloaded:
            with urlopen(url, timeout=60) as response:
                content = response.read()
            if not content or len(content) > 20_000_000:
                raise ValueError(f'Unexpected dependency size: {name}')
            temporary = target.with_suffix('.download')
            temporary.write_bytes(content)
            temporary.replace(target)
        manifest[name] = {'url': url, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                          'downloaded_this_run': downloaded}
    (destination / 'dependency-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
    print(f'{scene}: dependencies ready; existing files preserved')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--scene', choices=[*SCENES, 'all'], default='all')
    args = parser.parse_args()
    for scene in SCENES if args.scene == 'all' else [args.scene]:
        prepare(scene)
