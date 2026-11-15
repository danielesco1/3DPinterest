import json
import tempfile
import unittest
from pathlib import Path
from room_pipeline.viewer import edges, build_viewer, VENDOR_FILES
from room_pipeline.gallery import build_package

class ViewerTests(unittest.TestCase):
    def test_arbitrary_polygon_edges(self):
        n=6
        vertices=[[0,0,0],[2,0,0],[2,1,0],[1,1,0],[1,2,0],[0,2,0]]
        vertices += [[x,y,3] for x,y,z in vertices]
        faces=[list(range(n)),list(range(n,2*n))]+[[i,(i+1)%n,(i+1)%n+n,i+n] for i in range(n)]
        self.assertEqual(len(edges({'vertices':vertices,'faces':faces})),18)
    def test_portable_build(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'cad').mkdir();(root/'atlas').mkdir();(root/'vendor').mkdir()
            for f in VENDOR_FILES:(root/'vendor'/f).write_text('// test stub')
            (root/'atlas'/'model.spz').write_bytes(b'test')
            (root/'cad'/'room-source.json').write_text(json.dumps({'source_take_id':'test','shell':{'vertices':[[0,0,0],[1,0,0],[0,1,0]],'faces':[[0,1,2]]},'frame':{'up':[0,0,1]},'scale':{'status':'uncalibrated'}}))
            out=build_viewer(root,root/'vendor')
            self.assertEqual(json.loads((out/'scene.json').read_text())['spz'],'../atlas/model.spz')
            package=build_package(root,'space','test')
            self.assertTrue((package/'viewer'/'index.html').exists())
            self.assertTrue((package/'viewer'/'vendor'/'spark.module.js').exists())
    def test_ambiguous_spz_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'atlas').mkdir()
            for name in ('one.spz','two.spz'):(root/'atlas'/name).write_bytes(b'test')
            with self.assertRaises(ValueError):build_viewer(root,root)

if __name__=='__main__':unittest.main()
