import importlib.util
import unittest
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
