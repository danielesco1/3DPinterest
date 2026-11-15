"""One viewer, local per-space assets. Never serves the repository or credentials."""
import argparse
import json
import math
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
BASE = HERE
SCENES = {
    'first-room': {'title': 'First room', 'assets': 'work/pose-viewer', 'adapter': 'astra-shell', 'labelScale': 0.35,
                   'notes': 'Astra estimated shell. All corners and openings are inferred, not surveyed. Cyan outlines are not cut holes. Original observed window sills retained. Feet/inches assume 1 native unit = 1 metre, UNVERIFIED. Source geometry unchanged.'},
    'hotel': {'title': 'Hotel', 'assets': 'work/hotel-advanced-viewer', 'adapter': 'core-envelope',
              'notes': 'Provisional core; inferred closure. Blue: supported wall directions. Orange dashed: inferred connections. Cyan openings are not cut holes. All lower opening outlines extend to fitted floor by request; observed vertices retained separately. Feet/inches assume 1 native unit = 1 metre, UNVERIFIED.'},
}
SOURCE_FILES = {'index.html', 'app.js', 'geometry.cjs', 'section.cjs'}
VENDOR_FILES = {'OrbitControls.js', 'Pass.js', 'spark.module.js', 'three.core.js', 'three.module.js'}
ASSET_FILES = {'viewer-data.json', 'reconstruction.spz', 'core-envelope.json', 'core-plan.svg',
               'core-volume.svg', 'partial-sample-points.json', 'provisional-outlines.json',
               'partial-plan.png', 'response.json'}


def read_json(path):
    return json.loads(path.read_text())


def feet_label(length):
    # Display conversion only; the source scale remains uncalibrated.
    quarters = round(length / 0.0254 * 4)
    feet, quarters = divmod(quarters, 48)
    return f'{feet}′ {quarters / 4:g}″*'


def first_room_envelope(root):
    """Adapt existing Astra vertices without transforms or floor extension."""
    shell = next(s for s in read_json(root / 'shells.json') if s['key'] == 'astra')
    openings = read_json(root / 'openings.json')['openings']
    edges = sorted({tuple(sorted((a, b))) for face in shell['faces']
                    for a, b in zip(face, face[1:] + face[:1])})
    dimensions = []
    for label, a, b in [('width', 0, 1), ('depth', 1, 2), ('height', 0, 4)]:
        endpoints = [shell['vertices'][a], shell['vertices'][b]]
        length = math.dist(*endpoints)
        dimensions.append({'id': label, 'endpoints': endpoints, 'native_length': length,
                           'display_label': feet_label(length), 'calibrated': False,
                           'display_scale_assumption': '1 native unit = 1 metre; UNVERIFIED'})
    return {'vertices': shell['vertices'], 'faces': shell['faces'], 'dimensions': dimensions,
            'supported_direction_edges': [], 'inferred_edges': edges,
            'scale': 'uncalibrated native scene units',
            'opening_outlines': [dict(o, vertices=o['corners'], observed_vertices=o['corners'],
                                     tag=o['id'], uncertain_edges=[0, 1, 2, 3]) for o in openings]}


class Handler(SimpleHTTPRequestHandler):
    def send_json(self, value):
        payload = json.dumps(value).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        parts = urlsplit(self.path).path.strip('/').split('/')
        if parts == ['']:
            self.send_response(302)
            self.send_header('Location', '/scene/hotel/')
            self.end_headers()
            return
        if len(parts) < 2 or parts[0] != 'scene' or parts[1] not in SCENES:
            self.send_error(404)
            return
        scene_id = parts[1]
        cfg = SCENES[scene_id]
        asset_root = (BASE / cfg['assets']).resolve()
        name = '/'.join(parts[2:]) or 'index.html'
        try:
            if name == 'scene.json':
                self.send_json(dict(cfg, id=scene_id, scenes=[
                    {'id': key, 'title': c['title'], 'url': f'/scene/{key}/'}
                    for key, c in SCENES.items()]))
                return
            if cfg['adapter'] == 'astra-shell':
                if name == 'core-envelope.json':
                    self.send_json(first_room_envelope(asset_root))
                    return
                if name == 'partial-sample-points.json':
                    self.send_json({'groups': {}})
                    return
                if name == 'provisional-outlines.json':
                    self.send_json({'items': []})
                    return
            if name in SOURCE_FILES:
                target = HERE / name
            elif name.startswith('vendor/') and name[7:] in VENDOR_FILES:
                target = asset_root / name
            elif name in ASSET_FILES:
                aliases = {'core-plan.svg': 'room-vector-exports/room-plan.svg',
                           'core-volume.svg': 'room-vector-exports/room-volume.svg'}
                target = asset_root / (aliases.get(name, name) if scene_id == 'first-room' else name)
            else:
                self.send_error(404)
                return
            if not target.is_file():
                self.send_error(404, 'Asset unavailable; prepare this space first')
                return
            # send_head still handles content length, type and streaming; no directory listing.
            self._target = target
            super().do_GET()
        except (OSError, ValueError, StopIteration) as exc:
            self.send_error(500, f'Invalid scene asset: {type(exc).__name__}')

    def translate_path(self, path):
        return str(self._target)

    def do_HEAD(self):
        self.send_error(405)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8774)
    args = parser.parse_args()
    print(f'Shared viewer: http://127.0.0.1:{args.port}/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
