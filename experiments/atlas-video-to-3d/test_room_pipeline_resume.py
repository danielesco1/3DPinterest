import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from room_pipeline.core import write,run_cad_stage

class ResumeTests(unittest.TestCase):
    def test_failed_media_does_not_poison_retry(self):
        from room_pipeline.media import extract
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp)/'media'
            with patch('room_pipeline.media._extract',side_effect=RuntimeError()):
                with self.assertRaises(RuntimeError):extract(Path('unused'),out)
            self.assertFalse(out.exists())
            def successful(video,stage,interval,maximum):
                stage.mkdir();write(stage/'manifest.json',{'ok':True});return {'ok':True}
            with patch('room_pipeline.media._extract',side_effect=successful):
                self.assertEqual(extract(Path('unused'),out),{'ok':True})
            self.assertTrue((out/'manifest.json').exists())

    def test_verified_cad_resume_and_conflicts(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);e=root/'evidence.json';write(e,{'source_take_id':'take'})
            def build(e,d):
                d.mkdir();p=d/'room.obj';p.write_text('geometry');return {'room.obj':str(p)}
            with patch('room_pipeline.cad.build_cad',side_effect=build) as build_mock:
                one=run_cad_stage(e,root,'take');two=run_cad_stage(e,root,'take')
                self.assertEqual(one,two);self.assertEqual(build_mock.call_count,1)
                # Recover atomic output if interrupted before private checkpoint save.
                (root/'private/cad-state.json').unlink()
                self.assertEqual(run_cad_stage(e,root,'take'),one)
                self.assertEqual(build_mock.call_count,1)
                Path(one['room.obj']).write_text('user edit')
                with self.assertRaises(ValueError):run_cad_stage(e,root,'take')
                self.assertEqual(Path(one['room.obj']).read_text(),'user edit')
    def test_changed_evidence_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);e=root/'evidence.json';write(e,{'source_take_id':'take'})
            def build(e,d):
                d.mkdir();p=d/'room.obj';p.write_text('geometry');return {'room.obj':str(p)}
            with patch('room_pipeline.cad.build_cad',side_effect=build):run_cad_stage(e,root,'take')
            write(e,{'source_take_id':'take','changed':True})
            with self.assertRaises(ValueError):run_cad_stage(e,root,'take')

if __name__=='__main__':unittest.main()
