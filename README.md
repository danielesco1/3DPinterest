# 3DPinterest

Experiments for turning video captures of real spaces into navigable 3D scenes.

## Layout

- `experiments/atlas-video-to-3d/` — first video-to-3D test using World Labs Atlas (frame prep, capture pipeline, packaging). See its [README](experiments/atlas-video-to-3d/README.md) for setup.

## Quick check

Requires Python 3.

```sh
cd experiments/atlas-video-to-3d
python3 -m unittest discover -p "test_*.py"
```

## Notes

- Keep API keys in `.env` (git-ignored). Never commit them.
- Working files under `experiments/atlas-video-to-3d/work/` are git-ignored.
