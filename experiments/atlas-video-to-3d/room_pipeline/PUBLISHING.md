# Package and publish

`build_package(run_dir, space_id, take_id, video=source)` inventories `media/`,
`atlas/`, `cad/`, and optional `viewer/`. It copies all files under those stage
folders, plus the original video. JSON transport URLs and credential fields are
removed. Private operation state, `.env`, hidden files and receipts are excluded.
The resulting `package/manifest.json` contains relative paths, MIME types,
byte counts and SHA-256 hashes. `index.html` is an artifact browser, not a new
3D viewer. Supply a self-contained `viewer/` build to include interactive views.

`publish_package(package_dir, root_folder_id, allow_upload=True)` creates
`Spaces/<space_id>/<take_id>` under the explicitly supplied authorized Drive
root (for this project, HACKATHON2026). No sharing changes are made.

The CLI requires a separately authorized OAuth access token in
`GOOGLE_DRIVE_ACCESS_TOKEN`. Existing ChatGPT Drive connector access does not
provide this token. Do not paste tokens into code, manifests, logs or command
arguments. Do not create new credentials merely to run a dry-run.

Uploads use Drive v3 resumable sessions with 8 MiB chunks. Checkpoints are
per verified file, not per byte: an interrupted file restarts; completed files
are reverified and skipped. Session URLs never persist. `drive-receipts.json`
stays outside the package. Existing unknown or remotely edited files are not
overwritten. Remote SHA-256 and size must match before checkpointing. The
bound manifest uploads last. Files removed locally are not deleted remotely.

Private Drive previews are **not** raw asset URLs and Drive does not host the
HTML app. A gallery must use authorized server-side Drive downloads or a local
copy served over HTTP. Never expose OAuth tokens in client HTML. Download the
complete package using its file IDs, verify hashes, then serve locally; do not
open `index.html` through `file://` because it fetches the manifest.

Verification: `python3 -m unittest test_gallery_publish -v` runs mocked tests
only. No real Drive request or upload was performed by these tests.

API reference: https://developers.google.com/workspace/drive/api/guides/manage-uploads

## Generic 3D viewer

`build_viewer(run_dir, vendor_dir)` creates `viewer/` before packaging. Supply a
local vendor directory containing Spark 2.4.0, Three 0.180.0, OrbitControls and
Pass (the existing first-take vendor directory contains these). No downloads
are performed. Requires one selected `.spz` under `atlas/` and reviewed
`cad/room-source.json`. Multiple SPZ candidates stop for explicit selection.

It shows the SPZ, native-coordinate arbitrary-polygon room **outlines**, and
opening outlines, with independent visibility toggles and orbit/fit controls.
No shape-fitting or coordinate correction is applied. It is a diagnostic
wireframe, not a solid CAD renderer; no triangulation is needed for outlines.
The new minimal viewer does not yet include camera frustums, clipping controls,
or dimension labels from the first-take specialized viewer. That viewer is
preserved separately. Browser/WebGL rendering remains to be visually verified;
Python packaging tests and JavaScript syntax checks pass.
