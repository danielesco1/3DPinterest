import json
from pathlib import Path
import tempfile
import unittest
from package_take import package, digest, bind_drive, clean_json, slug

class Package(unittest.TestCase):
    def test_build_and_bind(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d); video=p/'clip.mov';video.write_bytes(b'fixture')
            capture=p/'capture';capture.mkdir();(capture/'one.jpg').write_bytes(b'image')
            (capture/'manifest.json').write_text(json.dumps({'sha256':digest(video),'duration_seconds':3,'frames':[{'id':'f1','path':'one.jpg','requested_timestamp_seconds':1}],'audio':None}))
            output=package(video,capture,p/'export','room','take-01')
            manifest=json.loads((output/'manifest.json').read_text())
            self.assertEqual(manifest['status']['reconstruction'],'pending')
            self.assertEqual(manifest['poster_asset_id'],'frames/one.jpg')
            receipts={a['path']:{'file_id':'drive-'+str(i),'sha256':a['sha256']} for i,a in enumerate(manifest['assets'])}
            self.assertTrue(all(a['drive']['file_id'] for a in bind_drive(manifest,receipts)['assets']))
            with self.assertRaises(FileExistsError): package(video,capture,p/'export','room','take-01')
    def test_bad_slug(self):
        with self.assertRaises(ValueError):slug('../room')
    def test_scrub_signed_urls(self):
        self.assertEqual(clean_json({'assetId':'a','url':'secret','nested':[{'readUrl':'secret'}]}),{'assetId':'a','nested':[{}]})
    def test_missing_receipt(self):
        with self.assertRaises(ValueError):bind_drive({'assets':[{'path':'x'}]}, {})
    def test_mismatch_receipt(self):
        with self.assertRaises(ValueError):bind_drive({'assets':[{'path':'x','sha256':'a'}]}, {'x':{'file_id':'id','sha256':'b'}})
if __name__=='__main__':unittest.main()
