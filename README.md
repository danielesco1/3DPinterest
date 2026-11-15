# 3DPinterest

Video captures of real spaces, reconstructed as navigable 3D scenes.

## Layout

- `roomboard/`: static gallery and room pages.
- `3d-viewer/`: shared Spark viewer and static scene exporter.
- `experiments/atlas-video-to-3d/`: Atlas reconstruction, Astra geometry, drawings and per-space publishing pipeline. See its [standard workflow](experiments/atlas-video-to-3d/STANDARD_WORKFLOW.md).

## Tests

```sh
cd experiments/atlas-video-to-3d
python3 -m unittest discover -p "test_*.py"
```

## Private assets

Keep API keys in ignored `.env` files and scene assets in ignored `work/` folders. Assets are published separately to Drive or the configured storage bucket, never to Git. Geometry and dimensions are uncalibrated estimates requiring review.
