import importlib.util
import unittest
import tempfile
import json
import threading
from urllib.request import urlopen
from urllib.error import HTTPError
from pathlib import Path

spec = importlib.util.spec_from_file_location('viewer_server', Path(__file__).with_name('serve.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class SharedViewerTests(unittest.TestCase):
    def test_conversion_carries_twelve_inches(self):
        self.assertEqual(module.feet_label(0.3048), '1′ 0″*')

    def test_scene_manifests_stay_in_work(self):
        for config in module.SCENES.values():
            self.assertTrue(config['assets'].startswith('work/'))

    def test_adapter_with_portable_fixture(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            vertices = [[0,0,0],[1,0,0],[1,0,1],[0,0,1],
                        [0,1,0],[1,1,0],[1,1,1],[0,1,1]]
            faces = [[0,1,2,3],[4,5,6,7],[0,1,5,4],
                     [1,2,6,5],[2,3,7,6],[3,0,4,7]]
            (root/'shells.json').write_text(json.dumps([
                {'key':'astra','vertices':vertices,'faces':faces}]))
            (root/'openings.json').write_text(json.dumps({'openings':[]}))
            result = module.first_room_envelope(root)
            self.assertEqual(result['vertices'], vertices)
            self.assertEqual(len(result['inferred_edges']), 12)
            self.assertEqual(len(result['dimensions']), 3)

    def test_http_source_routes_and_private_paths(self):
        server = module.ThreadingHTTPServer(('127.0.0.1',0), module.Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_port}'
        try:
            for scene in module.SCENES:
                for name in ['', 'app.js', 'geometry.cjs', 'section.cjs', 'scene.json']:
                    with urlopen(f'{base}/scene/{scene}/{name}') as response:
                        self.assertTrue(response.read())
            for path in ['/scene/hotel/.env','/scene/hotel/../serve.py','/README.md']:
                with self.assertRaises(HTTPError) as result:
                    urlopen(base+path)
                self.assertEqual(result.exception.code,404)
                result.exception.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_existing_first_room_preserves_vertices(self):
        root = module.BASE / module.SCENES['first-room']['assets']
        if not (root / 'shells.json').exists():
            self.skipTest('private source assets not restored')
        source = next(s for s in module.read_json(root/'shells.json') if s['key']=='astra')
        result = module.first_room_envelope(root)
        self.assertEqual(result['vertices'], source['vertices'])
        self.assertEqual(len(result['inferred_edges']), 12)
        self.assertEqual(len(result['dimensions']), 3)
        self.assertTrue(all(not d['calibrated'] for d in result['dimensions']))
        for opening in result['opening_outlines']:
            self.assertEqual(opening['vertices'], opening['observed_vertices'])

if __name__ == '__main__':
    unittest.main()
