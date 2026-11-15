# Shared space viewer

One renderer for both captures, not one copied HTML per room. Standalone viewer. Run from the repository root:

```sh
# First restore the private scene assets from the shared Drive export.
python3 3d-viewer/prepare_vendor.py --scene all
python3 3d-viewer/serve.py --port 8774
```

Open `http://127.0.0.1:8774/` and select **Hotel** or **First room**. Existing servers on 8766/8772 are untouched.

## Source versus private assets

- Tracked here: renderer, camera/section geometry helpers, local server and adapters.
- `serve.py:SCENES` is the per-space manifest: title, relative asset directory, adapter, caveats, label size.
- First room uses `3d-viewer/work/pose-viewer`; Hotel uses `3d-viewer/work/hotel-advanced-viewer`. Private captures, SPZ, derived geometry and exports remain in ignored `work/`, not Git. Back them up/upload separately per space.
- Runtime dependencies are the existing local Three.js 0.180.0 / Spark 2.4.0 vendor bundles. The optional setup script downloads these pinned public dependencies and records hashes; it preserves existing copies. Viewer runtime makes no external upload, new API generation or paid request.
- A fresh clone needs its private space folders restored and vendor dependencies prepared before it can display either scene. Do not serve the repository root or `.env`.

## Asset contract

Each scene needs `viewer-data.json` (frames with Atlas camera intrinsics, native RUB camera-to-world positions/quaternions and thumbnail data URLs), `reconstruction.spz`, and `vendor/` bundles. `core-envelope` uses `core-envelope.json`, `partial-sample-points.json`, `provisional-outlines.json`, plan/volume SVGs and diagnostic evidence. The `astra-shell` adapter reads `shells.json` and `openings.json`, chooses the Astra shell, preserves its exact coordinates and supplies the same envelope schema. Plan/volume links point to existing exports, not regenerated drawings.

Envelope schema: `vertices`, polygon `faces`, edge index pairs (`supported_direction_edges`, `inferred_edges`), `opening_outlines` with vertices/tag/label/uncertain_edges, and `dimensions` with endpoints/display_label. Save envelope returns the same data rendered by the viewer. Add new scenes to the manifest; adapt data, not the renderer.

## Shared controls

Spark splat, CAD faces/edges, opening tags, assumed feet/inches dimensions, camera path/frustums, capture projection, timeline, light-gray background, reversible room-margin crop, section plane with normal-axis gumball, and plan/volume/envelope downloads.

## Limits

Current crop assumes a convex six-face envelope with three faces meeting at each vertex. Arbitrary concave rooms need decomposed convex crop volumes before registration. No geometry normalization, scale transform, or reconstruction is performed. Feet/inches labels assume one native unit is one metre; **not calibrated measurements**. Openings are outlines, not cut holes. First-room window sills retain their source values; Hotel floor extensions preserve original observed vertices. The older first-room plane-fit comparison/calibration interface remains in the experimental branch legacy viewer, not included in this standalone folder. Pipeline/gallery automatic linking is not yet changed.

Optional `surface_mesh: {vertices, triangles}` replaces filled envelope faces with triangulated surfaces containing actual opening cuts. The original core faces remain the crop boundary. `surface_mesh_notes` describes assumptions in the UI. Do not use a flat fan triangulation for polygons with holes; triangulate them upstream.

Validation: Python adapter tests, JavaScript syntax checks, both space routes and drawing downloads, 404 tests for private paths. Chrome smoke-tested both 2M-splat scenes and scene switching; first-room section/gumball visibility and crop-boundary toggles verified. Geometry accuracy is not validated by these UI tests.

## Colleague setup

Requires Python 3.10+ and a WebGL2-capable Chrome browser. No npm install or API keys needed for viewing. Clone the repository and checkout `main`. Restore the private assets into the two paths in the manifest, then run the commands above. Git contains code only: the reconstruction SPZ, preview frames, camera data, geometry and SVGs must be obtained separately from the authorized Drive share. Downloading a single SPZ is insufficient for CAD/camera comparisons. A missing asset produces a 404, not a new reconstruction request.

Run `python3 3d-viewer/test_shared.py` for adapter tests. The existing-asset test skips if private assets have not been restored.

## Static Roomboard deployment

Work from the integration branch, then merge the reviewed code into `main` for GitHub Pages. No bundler or npm is used. `export_static.py` shares the server's adapter and path aliases; it exports only allowlisted files, never `.env` or the whole `work/` tree.

Restore these private files from each space's Drive export (retain original coordinates):

| Local destination | Required contents |
| --- | --- |
| `3d-viewer/work/pose-viewer/` | `viewer-data.json`, `reconstruction.spz`, `shells.json`, `openings.json`, `room-vector-exports/room-plan.svg`, `room-vector-exports/room-volume.svg` |
| `3d-viewer/work/hotel-advanced-viewer/` | `viewer-data.json`, `reconstruction.spz`, `core-envelope.json`, `core-plan.svg`, `core-volume.svg`, `partial-sample-points.json`, `provisional-outlines.json` |
| Both folders' `vendor/` | `OrbitControls.js`, `Pass.js`, `spark.module.js`, `three.core.js`, `three.module.js` (or prepare pinned bundles with `prepare_vendor.py`) |

Camera thumbnails must be embedded data URLs in `viewer-data.json`, as in the existing captures. Hotel diagnostic `partial-plan.png` and `response.json` are optional. First-room envelope and empty diagnostic placeholders are generated using the existing adapter. Missing required files fail before any prior export is replaced.

```sh
python3 3d-viewer/export_static.py --scene all
python3 3d-viewer/test_static.py
node 3d-viewer/tests/test_messages.cjs
# Preview the exported scenes without serve.py:
python3 -m http.server 8000 --directory 3d-viewer/dist
```

Upload only the validated generated scene folders. These commands publish the scene assets to the existing public bucket; they do not alter bucket IAM or CORS. Run with an authorized signed-in gcloud account:

```sh
for scene in first-room hotel; do
  for ext in html js cjs json svg spz png; do
    case "$ext" in
      html) mime=text/html;;
      js|cjs) mime=application/javascript;;
      json) mime=application/json;;
      svg) mime=image/svg+xml;;
      spz) mime=application/octet-stream;;
      png) mime=image/png;;
    esac
    find "3d-viewer/dist/$scene" -type f -name "*.$ext" -print0 |
      while IFS= read -r -d '' file; do
        relative="${file#3d-viewer/dist/$scene/}"
        gcloud storage cp "$file" "gs://roomboard-demo-rooms/scenes/$scene/$relative" \
          --cache-control=no-cache --content-type="$mime"
      done
  done
 done
```

In the existing `rooms/hiroto-space/space.json`, preserve every other field and add:

```json
"viewer": "https://storage.googleapis.com/roomboard-demo-rooms/scenes/first-room/index.html"
```

Upload the edited metadata with `gcloud storage cp space.json gs://roomboard-demo-rooms/rooms/hiroto-space/space.json --cache-control=no-cache --content-type=application/json`. Rooms without `viewer` retain the old renderer. Highlight messages target the iframe's actual origin. The advanced viewer accepts finite native-coordinate `fly` messages only from its parent at its own origin or `https://danielesco1.github.io`. A localhost Roomboard parent cannot control a GCS-hosted iframe; use a same-origin local static viewer for local testing.

Verify after deployment: open Hiroto on GitHub Pages, click `window-view`, confirm smooth camera motion, inspect browser errors, switch to Hotel and back, exercise timeline, capture, crop and section controls. Export success and unit tests alone do not establish live deployment success. Dimensions remain **uncalibrated estimates**.
