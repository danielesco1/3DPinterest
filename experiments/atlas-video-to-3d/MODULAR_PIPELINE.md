# Video-to-room pipeline

Run from this directory. Existing scripts and first-room artifacts remain unchanged.

## 1. Prepare and review locally

```sh
python3 -m room_pipeline /path/to/video.mov --space library --take take-001
```

Outputs: `work/runs/library/take-001/media/`. Frames include decoded source-frame indices and timestamps, plus mono audio when present. Sampling is not automatic quality selection: inspect blur, overlap and coverage before paying for reconstruction. Default: at most 60 frames. `--interval` and `--max-frames` control sampling.

## 2. Reconstruct with explicit permissions

First verify current Atlas pricing. The budget check currently estimates 2 credits per posed frame plus 5,000 for refined splats; it is not a provider-enforced spending cap. CLI/key setup remains in `LOCAL_SETUP.md`.

```sh
python3 -m room_pipeline /path/to/video.mov --space library --take take-001 \
  --atlas --allow-upload --allow-paid --max-credits 5120 --grid 720 1280
```

This uploads frames, submits poses, downloads results, then stops for pose review. After inspecting alignment, run the same command with `--pose-reviewed` to create the splat. No extra pose submission is made. Choose a matching supported grid (`1280 720`, `720 1280`, `960 720`, `528 704`); other aspect ratios can crop.

Job IDs, reservations and idempotency keys persist in `private/`. A timed-out wait resumes the same operation. An interrupted submission with no operation ID stops for reconciliation, never automatically pays again. A partial download is preserved and must be moved aside before retrying. A crash can leave `.run.lock`; confirm no process is running before removing that lock. Do not share `private/`.

## 3. Reviewed CAD and portable outputs

```sh
python3 -m room_pipeline /path/to/video.mov --space library --take take-001 \
  --cad-evidence /path/to/reviewed-evidence.json --package
```

See `CAD_EVIDENCE.md`. CAD currently consumes reviewed semantic geometry, not an automatic Astra inference request. Evidence must match the take ID. Measurements remain estimates until externally calibrated. Optional local transcription and timestamped frame alignment run with `--transcribe --whisper-python work/transcription-venv/bin/python --whisper-model base`. The selected Python must already have Whisper, and model weights must already exist in `~/.cache/whisper` (override with `--whisper-model-dir`). No dependency installation or model download occurs automatically. Add `--language ja` for Japanese, or omit to detect language. A missing dependency/model or failed transcription stops the run before Atlas; retry without `--transcribe` to continue independent stages. Silent videos return `no_audio`. Transcripts and observations are unreviewed; a frame timestamp is not a verified 3D object location.

The package contains media, available Atlas/CAD/viewer artifacts and a hash manifest. Packaging a local-only run is allowed and does not imply reconstruction completion. The gallery is an artifact index. Add `--viewer-vendor work/pose-viewer/vendor` before packaging to build the local Spark splat/CAD overlay viewer from the existing vendor libraries, one Atlas SPZ and CAD room-source.json. No CDN or library download occurs.

## 4. Publish to Drive

Set `GOOGLE_DRIVE_ACCESS_TOKEN` privately, then append:

```sh
--drive-root AUTHORIZED_ROOT_FOLDER_ID --allow-drive-upload
```

This publishes under `Spaces/<space>/<take>` using the uploader's verified receipts. No upload occurs without the explicit flag. Source video is included; only share authorized footage. No credentials, private Atlas state or signed download URLs belong in the package.

## Verification

```sh
python3 -m unittest discover -p 'test_*.py'
```

Core and publisher tests are offline/mocked. A synthetic-video extraction/resume/package smoke test passed. Live paid Atlas, automatic Astra, live Whisper inference, Drive token upload and end-to-end reconstruction quality have not been tested through this new runner.
