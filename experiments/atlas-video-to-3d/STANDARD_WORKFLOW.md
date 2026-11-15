# One workflow per space and take

Use the same pipeline and viewer for every video. This is a reusable, **review-gated** workflow, not guaranteed automatic reconstruction of any room.

## Start a take

Copy `workflow.example.json`, set the input video, space and unique take ID. Paths are relative to the configuration file. Keep private configurations under ignored `work/`. Match `grid` to the video orientation. Never put credentials, executable commands or spending permissions in the configuration.

Run from this experiment directory:

```sh
python3 -m room_pipeline.workflow workflow.example.json --stage prepare
python3 -m room_pipeline.workflow workflow.example.json --stage prepare --run
```

The first command only prints the plan. `--run` executes it. A changed source video requires a new take ID. Existing jobs and artifacts are resumed, not blindly regenerated.

## Stages

| Stage | Produces | Required checkpoint |
|---|---|---|
| `prepare` | Source inventory, sampled frames and audio | Check blur, overlap, coverage and consent to upload |
| `pose` | Atlas camera poses, depth and confidence | Inspect trajectory, registration and depth; reject bad reconstruction |
| `splat` (optional) | Atlas Gaussian splat | Explicit `--pose-reviewed`; paid generation requires a budget |
| `astra` | Evidence bundle and request for CAD estimation | Execute a separately authorized agent bridge or supervised analysis; this stage alone does not generate CAD |
| `export` | Reviewed CAD, plan/volume drawings and package manifest | Add `cad_evidence` to config; exporter validates source hashes and review metadata |
| `publish` | Per-space/take Drive package | Add authorized `drive_root`; upload gate must be explicit |

Plan any stage with `--stage NAME`. Pose-only work can proceed to Astra without purchasing a splat. Preparing an Astra request does not mean the proposal is complete or accepted.

### Cost and upload gates

`pose` and `splat` pass `--allow-upload`, `--allow-paid` and `--max-credits N` only when supplied on that invocation. No new paid request is permitted by default. Verify current provider pricing and obtain approval for the total budget before adding these flags. Resume known operations without `--allow-paid`; never resubmit an operation because a poll/download failed.

`publish` requires `--allow-drive-upload` on that invocation. Permission to write locally is not permission to share footage. Flags are technical gates, not substitutes for owner approval.

Optional transcription and a configured Astra bridge use the underlying CLI documented in [Modular pipeline](MODULAR_PIPELINE.md) and [Astra stage](ASTRA_STAGE.md). Do not claim audio transcription or voice-to-geometry alignment exists simply because audio was extracted.

## Geometry review: use one source of truth

- Derive the plan, volume, opening outlines and viewer geometry from the same reviewed CAD evidence. Keep coordinate system, origin and units consistent; check the plan is not mirrored.
- Attempt a coherent full volume by default. Infer incomplete closure with explicit inference basis and uncertainty; reserve unsupported for wholly insufficient data or unrepresentable topology.
- Check floor/ceiling, footprint and wall continuity against several frames, camera poses and depth. Do not force every space into a rectangle.
- Tag doors/windows/openings and retain evidence, confidence and unknowns. Floor-reaching doorway estimates are explicitly inferred; do not move window sills to the floor or invent hidden openings.
- Display actual wall cutouts where supported, not just lines drawn over a solid wall. Check door swings into the room as an illustrative estimate, not a measured fact.
- Show architectural dimensions in feet/inches. Unit conversion does not establish metric scale: calibrate against a known length or label dimensions and area as estimates.
- Crop splat display around the reviewed room volume without deleting the original reconstruction. Inspect section cuts, floor plan and 3D overlay in the same viewer.

The current generic CAD exporter supports polygonal room footprints, vertical walls and flat ceilings. Curved walls, sloping ceilings, multi-level spaces, occlusion and uncertain topology require review or an explicit unsupported result, not fabricated geometry.

## Viewer and Drive handoff

Use `python3 shared-viewer/serve.py --port 8774`; see [shared viewer](shared-viewer/README.md). First room and Hotel use one application. New takes currently require a scene registration and, when necessary, a schema adapter in `shared-viewer/serve.py`; pipeline export does not automatically register them.

Retain each take's source video, frames, audio, available transcript/alignment, Atlas outputs, reviewed reloadable CAD, drawings and package manifest under its space folder. Do not present absent stages as complete. Keep original and derived assets distinct. Preserve source IDs/hashes, review decisions and scale caveats so the gallery can distinguish verified artifacts from partial results.

## What remains manual

Frame quality/coverage review, pose acceptance, Astra bridge setup or supervised CAD estimation, geometry/scale validation and new viewer scene registration remain explicit checkpoints. Hotel refinements are not proof that every future space will reconstruct correctly. Offline tests validate orchestration and guards, not live provider quality or a complete paid end-to-end run.
