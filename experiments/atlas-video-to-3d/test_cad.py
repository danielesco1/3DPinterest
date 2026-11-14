import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from room_pipeline.cad import build_cad, validate_evidence

def evidence():
    return dict(schema_version=1,source_take_id='synthetic',review=dict(status='reviewed',reviewer='fixture',notes='Synthetic, not a captured room'),evidence=['synthetic'],frame=dict(origin=[5,2,1],u=[1,0,0],v=[0,0,-1],up=[0,1,0]),floor_polygon=[[0,0],[4,0],[4,2],[2,2],[2,4],[0,4]],height=3,scale=dict(status='uncalibrated'),openings=[dict(id='D1',wall_index=0,kind='door',certainty='inferred',evidence=['frame1'],start=1,end=2,bottom=0,top=2)])

class CadTests(unittest.TestCase):
    def test_concave_exports(self):
        with tempfile.TemporaryDirectory() as td:
            source=Path(td)/'evidence.json';source.write_text(json.dumps(evidence()))
            paths=build_cad(source,Path(td)/'cad');result=json.loads(Path(paths['room-source.json']).read_text())
            self.assertEqual(len(result['shell']['vertices']),12)
            self.assertEqual(len(result['shell']['faces']),8)
            self.assertEqual(result['measurements']['area_scene_units_squared'],12)
            self.assertEqual(result['shell']['vertices'][0],[5,2,1])
            self.assertEqual(result['shell']['vertices'][6],[5,5,1])
            self.assertNotIn('area_m2',result['measurements'])
            for name in ['room-plan.svg','room-volume.svg']:ET.parse(paths[name])
            self.assertIn('UNCALIBRATED',Path(paths['room-plan.svg']).read_text())
            with self.assertRaises(FileExistsError):build_cad(source,Path(td)/'cad')
    def test_architectural_plan_symbols(self):
        with tempfile.TemporaryDirectory() as td:
            data=evidence();data['openings'][0]['hinge']='start'
            source=Path(td)/'evidence.json';source.write_text(json.dumps(data))
            paths=build_cad(source,Path(td)/'cad')
            svg=ET.parse(paths['room-plan.svg']).getroot()
            ns={'s':'http://www.w3.org/2000/svg'}
            self.assertEqual(len(svg.findall('.//s:g[@class="endpoint-dimension"]',ns)),6)
            self.assertGreater(len(svg.findall('.//s:path[@class="swing-estimated"]',ns)),1)
            dxf=Path(paths['room-plan.dxf']).read_text()
            self.assertIn('SWING_ESTIMATED',dxf)
            # First host wall has two segments, leaving the 1-to-2 door gap.
            self.assertIn('10\n0.0\n20\n0.0\n30\n0\n11\n1.0',dxf)
            self.assertIn('10\n2.0\n20\n0.0\n30\n0\n11\n4.0',dxf)
    def test_review_required(self):
        data=evidence();data['review']['status']='proposed'
        with self.assertRaisesRegex(ValueError,'reviewed'):validate_evidence(data)
    def test_bad_geometry(self):
        for mutate in [lambda d:d.update(height=-1),lambda d:d.update(floor_polygon=[[0,0],[4,4],[0,4],[4,0]]),lambda d:d['frame'].update(v=[0,0,1]),lambda d:d['openings'][0].update(end=9),lambda d:d.update(height=float('nan'))]:
            data=evidence();mutate(data)
            with self.assertRaises(ValueError):validate_evidence(data)
    def test_overlapping_openings(self):
        data=evidence();data["openings"].append(dict(data["openings"][0],id="duplicate-region"))
        with self.assertRaisesRegex(ValueError,"Overlapping"):validate_evidence(data)
    def test_calibration(self):
        data=evidence();data['scale']=dict(status='calibrated',meters_per_unit=1)
        with self.assertRaises(ValueError):validate_evidence(data)
        data['scale']['reference_measurement']='Measured A-B = 4m';validate_evidence(data)
    def test_nonorthogonal(self):
        data=evidence();data['floor_polygon']=[[0,0],[5,0],[4,3],[0,4]]
        self.assertEqual(validate_evidence(data)[1],15.5)
if __name__=='__main__':unittest.main()
