import unittest
from match_tags_to_cad import raycast, frame_index, pixel_ray, place

CUBE = {'vertices': [[0,0,0],[4,0,0],[4,0,4],[0,0,4],[0,3,0],[4,3,0],[4,3,4],[0,3,4]],
        'faces': [[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]}
CAM = {'extrinsics': {'position': [2, 1.5, 3], 'quaternion': [0, 0, 0, 1]},
       'intrinsics': {'fx': 500, 'fy': 500, 'cx': 360, 'cy': 640, 'width': 720, 'height': 1280}}


class MatchTagsTest(unittest.TestCase):
    def test_frame_index_handles_both_names(self):
        self.assertEqual(frame_index('frame-0026'), 25)
        self.assertEqual(frame_index('atlas/pose/frames_25_image.jpg'), 25)

    def test_centre_ray_hits_far_wall(self):
        from match_tags_to_cad import mesh_triangles
        hit = raycast(*pixel_ray(CAM), mesh_triangles(CUBE))
        self.assertAlmostEqual(hit[2], 0.0, places=6)  # looking down -z from z=3 reaches the z=0 wall

    def test_unmatched_anchor_uses_camera_ray(self):
        tags = {'anchors': [{'anchor_id': 'a', 'tags': ['x'], 'position': [None]*3, 'camera': [None]*3,
                             'speech': [{'text': 'x', 'start': 1.0, 'end': 1.5}]}]}
        vd = {'frames': [{'source_time_seconds': 1.0, 'camera': CAM}]}
        out, report = place(tags, CUBE, vd, {})
        self.assertEqual(report[0][1], 'camera_ray')
        self.assertEqual(out['anchors'][0]['camera'], [2, 1.5, 3])


if __name__ == '__main__':
    unittest.main()
