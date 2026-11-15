# Shared Drive package

Each capture is immutable: `SPACE_ID/TAKE_ID/`. Use a new take ID on rerun. No sharing permissions are changed.

```
original/video.mov
frames/frame-0000.jpg ...
audio/audio.wav                  # when audio exists
transcript/transcript.json       # when available
annotations/observations.json    # speech intervals, candidate frames
reconstruction/view-links.json   # timestamps + camera/depth asset IDs
reconstruction/model.spz         # only after reconstruction succeeds
manifest.json                   # gallery entry point
upload-plan.json                # operator-only local upload instructions
```

## Build locally

```sh
python3 package_take.py build /path/IMG_5308.MOV work/capture-001 work/packages \
  --space hiroto-space --take take-001 \
  --transcript work/transcript-001/audio.json \
  --observations work/observations.json
```

Omit unavailable optional arguments. Add `--views work/view-links.json` and `--model /path/model.spz` when ready. The video hash must match capture metadata. Nothing uploads or generates a paid job. Atlas signed URLs are removed from copied JSON; stable asset IDs remain. Downloaded depth/confidence assets are not automatically included: explicitly archive these if offline 3D grounding is required.

## Export with connected Drive tools

1. Confirm the authorized shared destination. Create the space/take folders and subfolders there, preserving inherited permissions.
2. Read upload-plan.json locally. For each file, call Drive upload_file with its absolute local path, MIME type and destination subfolder ID. Do not upload the operator-only plan (it contains local paths).
3. Read back uploaded metadata, confirm file ID, name, parent and byte size. Verify content hash by downloading/readback where available. Do not label an unverified hash as verified.
4. Save receipts keyed by package-relative path, with returned `file_id`, optional `web_view_link`, and verified `sha256`.
5. Run `python3 package_take.py bind-drive manifest.json receipts.json manifest.drive.json`, then upload this as manifest.json **last** in the take folder. The local original manifest stays intact. Uploading is explicit; this tool never contacts Drive.

On partial failure retain verified receipts and resume only missing files. Do not blindly recreate folders or duplicate uploads. A gallery must not display a take as complete until its final manifest is present. Review existing folder names/IDs before resuming.

## Gallery contract (schema_version 1.0)

- `space_id`, `take_id`: stable folder-safe IDs.
- `source`: video asset ID, source SHA-256, optional source permalink.
- `duration_seconds`, `poster_asset_id`: timeline and thumbnail entry point.
- `assets[]`: unique ID/path, role, MIME type, bytes, SHA-256, nullable Drive file ID/view link.
- `frames[]`: frame ID, asset ID, requested seek timestamp, timing accuracy marker.
- `status`: transcription, observations, reconstruction availability; spatial grounding remains unlocalized.

Resolve each gallery asset by its Drive file ID using authenticated Drive access. A web_view_link is a review link, not a stable image/video byte URL; do not assume public access or use expiring API URLs as permanent assets. A gallery backend/proxy can stream authorized bytes. No public sharing or deployed gallery is created here.

The observations JSON preserves speech intervals. The view-links JSON preserves recovered camera/depth relationships. Neither proves the location of a mentioned object. Exact surface anchors require selected pixels, matching depth, coordinate conventions, confidence checks and human review.
