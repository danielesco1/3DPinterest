# Reviewed CAD stage

`room_pipeline.cad.build_cad(evidence_path, output_dir)` exports world-coordinate
JSON, OBJ polygon faces, plan/volume SVG and DXF. Supports simple concave and
nonorthogonal floor polygons, vertical walls and a flat ceiling.

This is not automatic Astra inference. First-room prototypes use manual patches
and plane selection, and are never silently applied to another video. Astra or
plane proposals must provide reviewed evidence; until then CAD is needs_review.

## Schema version 1

```json
{
  "schema_version": 1,
  "source_take_id": "example-take",
  "label": "Example room",
  "review": {"status":"reviewed", "reviewer":"Name", "notes":"Checked source frames; hidden bounds estimated"},
  "evidence": ["frames/frame-001.png", "pose/cameras.json"],
  "frame": {"origin":[0,0,0], "u":[1,0,0], "v":[0,0,-1], "up":[0,1,0]},
  "floor_polygon": [[0,0],[4,0],[4,3],[0,3]],
  "height": 2.7,
  "scale": {"status":"uncalibrated"},
  "openings": [{"id":"D1", "kind":"door", "wall_index":0, "start":1, "end":2, "bottom":0, "top":2.1, "certainty":"inferred", "evidence":["frames/frame-001.png"]}]
}
```

Example geometry is illustrative, never a default inference. The polygon is
counterclockwise in local `(u,v)`; `u × v = up`. The frame maps to reconstruction
coordinates. Openings use distances along indexed walls. Record unknown bounds
and inferred closure in notes, and check held-out frames where possible.

Scale defaults to scene units. `assumed` requires `meters_per_unit` and stays
provisional. `calibrated` additionally requires `reference_measurement` describing
an actual measurement. Conversion never changes geometry. Area/volume are envelope
estimates, not surveyed values.

Openings are separate outlines, not Boolean holes. Wall thickness and hinge are
unknown. OBJ floors can be concave n-gons; triangulate for rendering if needed.
DXF uses unitless right-handed local plan; SVG reverses screen Y only, preventing
mirroring. Existing outputs are never overwritten; use a new version directory.

## Architectural presentation

Plans split wall linework at projected opening spans, draw jambs/glazing, and
use offset endpoint dimensions with extension lines and ticks. Volume drawings
include height dimensions. Optional door `hinge: "start"` or `"end"` refers to
the opening span along the CCW wall. When supplied, a dashed estimated swing
always opens inward; no hinge is invented when omitted. DXF exports the same
plan gaps and estimated swing as editable line segments. These are schematic
plan symbols, not measured wall thickness or Boolean geometry.
