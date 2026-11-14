# 3DPinterest

Experiments for turning video captures of real spaces into navigable 3D scenes.

## Where the work is

The first video-to-3D experiment (World Labs Atlas: frame prep, capture pipeline, packaging) lives on the `experiment/atlas-video-to-3d` branch for now:

```sh
git fetch
git checkout experiment/atlas-video-to-3d
```

Setup steps are in `experiments/atlas-video-to-3d/README.md` on that branch.

## Quick check

On the experiment branch, with Python 3:

```sh
cd experiments/atlas-video-to-3d
python3 -m unittest discover -p "test_*.py"
```

## Notes

- Keep API keys in `.env`. Never commit them.

Write access test: Rebecca
