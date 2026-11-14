# First Atlas video-to-3D test

Status: scaffold only. No project video uploaded and no reconstruction run.

Atlas uses selected stills, not a raw-video reconstruction endpoint. The result is a navigable Gaussian splat, not guaranteed measured CAD.

## Setup
Requires Node 22+, Python 3, FFmpeg, and an Atlas account.
```sh
npm install -g @worldlabsai/cli
worldlabs skills install --client codex
worldlabs auth login
worldlabs auth status
```
Enter your key privately in your terminal. Never commit it. API requests use project credits.

## 1. Prepare locally
Run from this folder. Choose a short continuous walkthrough of a mostly static space. Start with 8–16 sharp views with roughly 50% shared content.
```sh
mkdir -p work/candidates work/selected
ffmpeg -i /path/to/video.mov -vf fps=1 -q:v 2 work/candidates/frame-%04d.jpg
```
Review candidates and copy the best overlapping frames into work/selected in capture order. This sampling is only a starting point, not automatic quality selection. Avoid moving people and blur.

## 2. Upload approved frames and build the request
Only upload footage you have permission to share with World Labs.
```sh
worldlabs assets upload work/selected/frame-0001.jpg --json
```
Repeat for selected images. Save returned asset IDs, in order, as a JSON array in work/assets.json:
```json
["first-image-asset-id", "second-image-asset-id"]
```
```sh
python3 prepare.py pose work/assets.json work/pose.json --grid 1280 720
worldlabs tasks run images2PosedRGBD --request work/pose.json --json > work/pose-submission.json
worldlabs operations wait <pose-operation-id> --json > work/pose-operation.json
worldlabs operations download <pose-operation-id> --out work/pose-preview
```
Use 720 1280 for portrait or 960 720 for 4:3. Requested grids may crop other ratios. Keep cameras and depth together; never resize one independently.

## 3. Inspect, then reconstruct
Check neighboring views align, walls are stable, and floor/obscured surfaces have coverage. Stop if poses are wrong.
```sh
python3 prepare.py splats work/pose-operation.json work/splats.json
```
Review Atlas pricing and your project limit before submitting. Current documentation quotes 5,000 credits ($5) for default refined splats.
```sh
worldlabs tasks run posedImages2Splats --request work/splats.json --json > work/splat-submission.json
worldlabs operations wait <splat-operation-id> --timeout 3600 --json > work/splat-operation.json
worldlabs operations download <splat-operation-id> --out work/splat-output
```
Keep operation IDs. If waiting times out, wait again on the same ID; don't resubmit and incur another charge. On interrupted submission use the CLI's printed idempotency key. Inspect operation error before downloading.

View SPZ with Spark or Blender. Record coverage gaps, duplicated objects, and scale uncertainty before integrating with the catalog. Missing regions may be invented.

## Local tests
```sh
python3 -m unittest -v test_prepare.py
```
These validate request construction only, not API integration or visual quality.

## Official references
- https://docs.atlas.worldlabs.ai/quickstart
- https://docs.atlas.worldlabs.ai/using-video-footage
- https://docs.atlas.worldlabs.ai/cli
- https://docs.atlas.worldlabs.ai/scene-to-splats
- https://docs.atlas.worldlabs.ai/api-reference/images2-posed-rgbd
- https://docs.atlas.worldlabs.ai/api-reference/posed-images2-splats
