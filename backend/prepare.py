"""Offline Atlas request builders. Never uploads files or submits paid jobs."""
import argparse
import json
from pathlib import Path

GRIDS = {(1280, 720), (720, 1280), (960, 720), (528, 704)}

def pose_request(ids, grid):
    if tuple(grid) not in GRIDS:
        raise ValueError("Unsupported camera grid")
    if len(ids) < 2 or any(not isinstance(i, str) or not i.strip() for i in ids):
        raise ValueError("Provide at least two uploaded image asset IDs")
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate asset IDs")
    return {"frames": [{"imageAsset": {"assetId": i}} for i in ids],
            "targetResolution": list(grid)}

def splat_request(operation):
    if operation.get("done") is not True or operation.get("error") is not None:
        raise ValueError("Pose operation must have succeeded")
    frames = operation.get("response", {}).get("frames", [])
    if not 2 <= len(frames) <= 512:
        raise ValueError("Need 2–512 posed frames")
    grids = set()
    result = []
    for f in frames:
        image, depth, camera = f["imageAsset"], f["depth"], f["camera"]
        for asset in (image, depth["depthAsset"]):
            if not asset.get("assetId"):
                raise ValueError("Use original operation with asset IDs, not downloaded local paths")
        intr = camera["intrinsics"]
        grids.add((intr["width"], intr["height"]))
        result.append({"imageAsset": {"assetId": image["assetId"]},
                       "depth": {"depthAsset": {"assetId": depth["depthAsset"]["assetId"]}},
                       "camera": camera})
    if len(grids) != 1 or not grids.issubset(GRIDS):
        raise ValueError("All camera grids must match a supported resolution")
    return {"posedFrames": result}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", choices=["pose", "splats"])
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--grid", nargs=2, type=int, default=[1280, 720])
    args = parser.parse_args()
    data = json.loads(args.input.read_text())
    try:
        request = pose_request(data, args.grid) if args.stage == "pose" else splat_request(data)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        # Never overwrite a request tied to a running operation.
        with args.output.open("x") as out:
            json.dump(request, out, indent=2)
            out.write("\n")
    except (ValueError, KeyError, TypeError, FileExistsError) as error:
        parser.error(str(error))
    print(f"Prepared {args.output}; no API request sent.")

if __name__ == "__main__":
    main()
