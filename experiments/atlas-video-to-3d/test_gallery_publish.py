import json
import tempfile
import unittest
from pathlib import Path
from room_pipeline.gallery import build_package, sha256
from room_pipeline.drive import publish_package


class FakeDrive:
    def __init__(self):
        self.files = {}
        self.uploads = 0
    def folder(self, name, parent):
        return parent + '/' + name
    def find(self, name, parent):
        return next(({'id': k} for k, v in self.files.items() if v['name'] == name and v['parent'] == parent), None)
    def metadata(self, key):
        return self.files[key]
    def upload(self, path, parent, file_id=None):
        self.uploads += 1
        key = file_id or str(len(self.files))
        self.files[key] = {'name': path.name, 'parent': parent, 'sha256Checksum': sha256(path),
                           'size': str(path.stat().st_size)}
        return key


class GalleryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root/'cad').mkdir()
        (self.root/'cad'/'room.json').write_text('{"vertices":[[0,0,0]],"uploadUrl":"https://secret","token":"private"}')
        self.package = build_package(self.root, 'space-1', 'take-1')
    def tearDown(self):
        self.tmp.cleanup()
    def test_sanitized_portable(self):
        self.assertEqual(json.loads((self.package/'cad'/'room.json').read_text()), {'vertices': [[0,0,0]]})
        manifest = json.loads((self.package/'manifest.json').read_text())
        self.assertEqual(manifest['assets'][0]['path'], 'cad/room.json')
    def test_gate(self):
        with self.assertRaises(PermissionError):
            publish_package(self.package, 'root')
    def test_verified_resume(self):
        client = FakeDrive()
        result = publish_package(self.package, 'root', True, client=client)
        self.assertEqual(result['verified_files'], 3)
        uploads = client.uploads
        publish_package(self.package, 'root', True, client=client)
        self.assertEqual(uploads, client.uploads)
    def test_remote_edit_preserved(self):
        client = FakeDrive()
        publish_package(self.package, 'root', True, client=client)
        next(iter(client.files.values()))['sha256Checksum'] = 'remote-edit'
        with self.assertRaises(ValueError):
            publish_package(self.package, 'root', True, client=client)
    def test_local_tamper_rejected(self):
        (self.package/'cad'/'room.json').write_text('changed')
        with self.assertRaises(ValueError):
            publish_package(self.package, 'root', True, client=FakeDrive())
    def test_invalid_identifier(self):
        with self.assertRaises(ValueError):
            build_package(self.root, '../bad', 'take')

if __name__ == '__main__':
    unittest.main()
