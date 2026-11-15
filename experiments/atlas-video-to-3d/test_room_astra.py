import json
import tempfile
import unittest
import sys
from pathlib import Path
from room_pipeline.astra import prepare_request, propose, validate_proposal
from room_pipeline.core import write


def proposal():
    ref='atlas/pose/depth.npy'
    evidence=dict(schema_version=1,source_take_id='take',review={'status':'needs_review'},evidence=[ref],
        frame=dict(origin=[0,0,0],u=[1,0,0],v=[0,1,0],up=[0,0,1]),
        floor_polygon=[[0,0],[4,0],[4,2],[2,2],[2,4],[0,4]],height=3,
        scale={'status':'uncalibrated'},openings=[])
    surfaces=[dict(id=f'wall-{i}',kind='wall',wall_index=i,certainty='observed',samples=[dict(artifact=ref,frame='frame-1',pixel=[5,5])],fit={'method':'plane fit','residual_scene_units':None}) for i in range(6)]
    surfaces += [dict(id=k,kind=k,certainty='inferred',samples=[dict(artifact=ref,frame='frame-1',pixel=[5,5])],fit={'method':'not computed','residual_scene_units':None}) for k in ('floor','ceiling')]
    for surface in surfaces:
        surface.update(uncertainty='Synthetic fixture, not measured', evidence=[ref])
        if surface['certainty']=='inferred':
            surface.update(inference_basis='Synthetic adjacent-wall closure', samples=[])
    evidence.update(surface_provenance=surfaces, opening_review='Synthetic fixture only; no opening claims')
    return dict(opening_review='Synthetic fixture only; no opening claims', status='proposal',model='test-double',limitations=['Test only, no inference'],evidence=evidence,surfaces=surfaces)

class AstraTests(unittest.TestCase):
    def setUp(self):
        self.t=tempfile.TemporaryDirectory(); self.root=Path(self.t.name)
        p=self.root/'atlas/pose/depth.npy'; p.parent.mkdir(parents=True); p.write_bytes(b'synthetic')
    def tearDown(self): self.t.cleanup()
    def test_prepare_no_invocation(self):
        self.assertEqual(propose(self.root,'take')['status'],'agent_required')
    def test_camera_metadata_inventory(self):
        write(self.root/'atlas/pose-operation.json',{'response':{'frames':[]}})
        write(self.root/'atlas/frame-map.json',{'frames':[]})
        paths={a['path'] for a in prepare_request(self.root,'take')['artifacts']}
        self.assertIn('atlas/pose-operation.json',paths)
        self.assertIn('atlas/frame-map.json',paths)
    def test_missing_atlas(self):
        with self.assertRaises(ValueError): prepare_request(self.root/'empty','take')
    def test_concave_proposal(self): validate_proposal(proposal(),prepare_request(self.root,'take'))
    def test_no_self_approval(self):
        p=proposal(); p['evidence']['review']['status']='reviewed'
        with self.assertRaises(ValueError):validate_proposal(p,prepare_request(self.root,'take'))
    def test_unknown_reference(self):
        p=proposal(); p['surfaces'][0]['samples'][0]['artifact']='outside'
        with self.assertRaises(ValueError):validate_proposal(p,prepare_request(self.root,'take'))
    def test_no_automatic_invocation(self):
        with self.assertRaises(PermissionError):propose(self.root,'take',[sys.executable,'-c','raise Exception()'])
    def test_bridge_and_resume(self):
        bridge=self.root/'bridge.py'; payload=json.dumps(proposal())
        bridge.write_text('import sys\nfrom pathlib import Path\nPath(sys.argv[2]).write_text('+repr(payload)+')\n')
        self.assertEqual(propose(self.root,'take',[sys.executable,str(bridge)],True)['status'],'needs_review')
        self.assertEqual(propose(self.root,'take')['status'],'needs_review')
        (self.root/'atlas/pose/depth.npy').write_bytes(b'changed')
        with self.assertRaises(ValueError):propose(self.root,'take')
    def test_failure_not_retried(self):
        with self.assertRaises(RuntimeError):propose(self.root,'take',[sys.executable,'-c','raise SystemExit(1)'],True)
        with self.assertRaises(RuntimeError):propose(self.root,'take',[sys.executable,'-c','pass'],True)
    def test_missing_wall(self):
        p=proposal(); p['surfaces'].pop(0)
        with self.assertRaises(ValueError):validate_proposal(p,prepare_request(self.root,'take'))
    def test_inferred_volume_without_fake_pixels(self):
        p=proposal()
        validate_proposal(p,prepare_request(self.root,'take'))
        self.assertEqual(p['surfaces'][-1]['samples'], [])
    def test_inference_requires_basis(self):
        p=proposal(); p['surfaces'][-1].pop('inference_basis')
        with self.assertRaises(ValueError): validate_proposal(p,prepare_request(self.root,'take'))
    def test_observed_requires_pixels(self):
        p=proposal(); p['surfaces'][0]['samples']=[]
        with self.assertRaises(ValueError): validate_proposal(p,prepare_request(self.root,'take'))
    def test_requires_uncertainty_and_opening_review(self):
        for field in ('uncertainty',):
            p=proposal(); p['surfaces'][0].pop(field)
            with self.assertRaises(ValueError): validate_proposal(p,prepare_request(self.root,'take'))
        p=proposal(); p.pop('opening_review')
        with self.assertRaises(ValueError): validate_proposal(p,prepare_request(self.root,'take'))
    def test_unsupported(self):validate_proposal(dict(status='unsupported',model='test',limitations=['Wholly insufficient imagery and depth to estimate an envelope']),prepare_request(self.root,'take'))


class GeometryTests(unittest.TestCase):
    def test_rub(self):
        from room_pipeline.geometry import unproject_rub
        self.assertEqual(unproject_rub([50,50],2,[100,100,50,50],[1,2,3],[0,0,0,1]),[1,2,1])
    def test_plane_outlier(self):
        from room_pipeline.geometry import fit_plane
        result=fit_plane([[0,0,2],[1,0,2],[0,1,2],[1,1,2],[2,2,2],[0,0,9]],.01)
        self.assertEqual(result['inlier_indices'],[0,1,2,3,4])
        self.assertEqual(result['residual_scene_units'],0)
    def test_collinear(self):
        from room_pipeline.geometry import fit_plane
        with self.assertRaises(ValueError):fit_plane([[0,0,0],[1,0,0],[2,0,0]],.01)

if __name__=='__main__':unittest.main()
