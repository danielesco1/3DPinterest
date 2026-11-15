import copy
import unittest
from prepare import pose_request, splat_request

class Requests(unittest.TestCase):
    def fixture(self):
        frame = {"imageAsset": {"assetId": "image"},
                 "depth": {"depthAsset": {"assetId": "depth"}},
                 "camera": {"intrinsics": {"width": 1280, "height": 720},
                            "extrinsics": {"position": [0,0,0]}}}
        return {"done": True, "response": {"frames": [frame, copy.deepcopy(frame)]}}

    def test_pose(self):
        self.assertEqual(len(pose_request(["one", "two"], [1280,720])["frames"]), 2)

    def test_duplicates(self):
        with self.assertRaises(ValueError):
            pose_request(["one", "one"], [1280,720])

    def test_grid(self):
        with self.assertRaises(ValueError):
            pose_request(["one", "two"], [100,100])

    def test_splats_preserve_camera(self):
        op = self.fixture()
        self.assertEqual(splat_request(op)["posedFrames"][0]["camera"],
                         op["response"]["frames"][0]["camera"])

    def test_pending(self):
        op = self.fixture()
        op["done"] = False
        with self.assertRaises(ValueError):
            splat_request(op)

    def test_failed(self):
        op = self.fixture()
        op["error"] = {"message": "failed"}
        with self.assertRaises(ValueError):
            splat_request(op)

    def test_mixed_grids(self):
        op = self.fixture()
        op["response"]["frames"][1]["camera"]["intrinsics"]["width"] = 960
        with self.assertRaises(ValueError):
            splat_request(op)

    def test_missing_asset(self):
        op = self.fixture()
        op["response"]["frames"][0]["imageAsset"] = {"path": "local.jpg"}
        with self.assertRaises(ValueError):
            splat_request(op)

if __name__ == "__main__":
    unittest.main()
