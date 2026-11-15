import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import export_static
import serve

class StaticTests(unittest.TestCase):
    def test_missing_assets_do_not_replace_export(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); target = root/'dist'/'hotel'; target.mkdir(parents=True)
            (target/'keep').write_text('old')
            with self.assertRaisesRegex(ValueError, 'Restore required scene assets'):
                export_static.export_scenes(['hotel'], root/'dist', root)
            self.assertEqual((target/'keep').read_text(), 'old')

    def test_relative_picker_has_no_local_path(self):
        config = serve.scene_config('hotel', True)
        self.assertNotIn('assets', config)
        self.assertEqual([s['url'] for s in config['scenes']], ['../bookstore/index.html', '../first-room/index.html', '../hotel/index.html'])

    def test_export_reuses_adapter_and_allowlist(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); assets=root/'work'/'pose-viewer'; assets.mkdir(parents=True)
            for name in export_static.REQUIRED - {'scene.json','core-envelope.json','partial-sample-points.json','provisional-outlines.json'}:
                if name in serve.SOURCE_FILES: continue
                p=serve.asset_path('first-room', name, root); p.parent.mkdir(parents=True,exist_ok=True)
                p.write_text('{}' if name.endswith('.json') else 'fixture')
            (assets/'.env').write_text('SECRET')
            with patch.object(serve, 'first_room_envelope', return_value={'vertices': [[1,2,3]], 'calibrated': False}) as adapter:
                export_static.export_scenes(['first-room'], root/'dist', root)
                adapter.assert_called_once_with(assets)
            dest=root/'dist'/'first-room'
            self.assertEqual(json.loads((dest/'core-envelope.json').read_text())['vertices'],[[1,2,3]])
            self.assertEqual(set(p.relative_to(dest).as_posix() for p in dest.rglob('*') if p.is_file()),export_static.REQUIRED)

if __name__ == '__main__': unittest.main()
