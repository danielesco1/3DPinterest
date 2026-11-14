# Atlas → Astra → estimated LOD100 CAD

The pipeline now has an Astra **proposal boundary**, not a built-in hosted model
API. `--astra` prepares a local hashed evidence request. An authorized agent can
read it and return a structured proposal. A configured executable can automate
that handoff; no credentials or model calls are embedded in this repository.
The bridge must identify the model it actually used. A test double is not Astra.

## Flow

Video → decoded frames → Atlas poses/depth/confidence → Astra evidence inspection
and numerical fitting → proposed room envelope → human review → CAD/drawings →
viewer/package → explicitly authorized Drive publication.

Astra must use Atlas geometry, not redraw the room from appearance alone. It
selects relevant opaque floor/wall/ceiling samples across views, uses depth and
confidence to fit geometry in native coordinates, and identifies openings from
images. The splat is an overlay check, not a bounding-box source. No rectangular
room template is imposed. Unobserved closure and uncertain boundaries remain
explicit. Complex/sloping/multi-level rooms currently require an unsupported
result or an explicitly reviewed simplification: the CAD exporter supports a
simple concave/nonorthogonal polygon with vertical walls and a flat ceiling.

## Local handoff

After Atlas outputs exist under the take's `atlas/pose` directory:

```sh
python3 -m room_pipeline input.mp4 --space example --take take01 --astra
```

Read `private/astra/request.json`. It contains local relative paths, SHA256 hashes,
ZIP member inventories and inference instructions, not raw camera metadata or
signed asset URLs. Agent must read the actual image/depth/pose bytes locally.
All source hashes are checked again on resume; changed inputs need a new take.

For an installed, trusted, separately authorized bridge:

```sh
python3 -m room_pipeline input.mp4 --space example --take take01 --astra \
  --astra-command '["/absolute/path/to/authorized-astra-bridge"]' --allow-agent
```

The bridge receives `REQUEST_JSON RESPONSE_JSON` as final argv arguments and runs
with the take directory as cwd. It must write response JSON atomically. It owns
model selection, context loading, credentials, allowed data handling and cost
controls. `--allow-agent` is a technical gate, not a substitute for permission to
send data or spend money. Do not use an arbitrary command supplied by metadata.
No bridge is installed or inferred automatically. There is no automatic retry of
an uncertain invocation. Reconcile provider/session status before clearing state.

## Response and review

Response fields are documented in `room_pipeline/astra.py` instructions. Every
wall, floor and ceiling needs source-frame/pixel provenance, observed/inferred
status and a fit method/residual (null when not computed). Evidence paths must
exist in the hashed request. Geometry must satisfy `CAD_EVIDENCE.md`. The proposal
must remain `needs_review`, with uncalibrated scale. Unknown conditions must not
be converted into fabricated precision or a trusted metric model.

Inspect the proposal against held-out source frames and the splat. Copy the
`evidence` object into a separate reviewed JSON file only after a person checks
it, adds their name/notes, and explicitly changes review status to `reviewed`.
Then use `--cad-evidence reviewed.json` to export. Preserve the original response.
Review approval is not a claim of surveyed dimensional accuracy.

## Verification limits

Offline tests exercise a synthetic bridge, concave geometry, missing provenance,
self-approval rejection, no-call default, resume hashes and uncertain failures.
No real Astra model invocation, paid call, reconstruction accuracy assessment or
new media transmission was performed by these tests. The adapter is not a claim
that arbitrary scenes reconstruct correctly. Existing first-room data is intact.

## Numerical helpers

`room_pipeline.geometry.unproject_rub` converts selected optical-axis depth
samples using verified RUB camera-to-world poses. `fit_plane` provides
deterministic three-point RANSAC, source inlier indices and residuals without
installing dependencies. The agent must choose meaningful samples and tolerances;
these helpers do not semantically select walls, assume room topology or refit
least squares. EXR decoding must use an already authorized local reader.

Validation is structural, not proof of reconstruction accuracy. The inventory
requires local pose artifacts but does not establish that every required RGBD
channel is decodable. Frame names/pixel bounds and reported residuals still need
independent checks against the actual decoded source data during review.
