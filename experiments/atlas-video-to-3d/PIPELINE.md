# Capture → video notes → 3D views

This staged prototype adds intake, thumbnails, audio, and provenance. It does not automatically identify or locate spoken-about objects.

## Run
From this folder; Python 3.10+, FFmpeg/ffprobe required. Outputs use a new directory and refuse overwrites.

1. Download a selected Slack video, or use one downloaded manually:

```sh
# SLACK_TOKEN must already be supplied securely, with files:read and channel access.
python3 pipeline.py slack F_REPLACE_WITH_FILE_ID work/intake-001
python3 pipeline.py media work/intake-001/source.video work/capture-001 --interval 5
```

Use an actual Slack file ID (starts F), not the channel URL. Intake does not crawl channels. It downloads only that file and saves source metadata. Credentials are never saved. Redirects and external download hosts are blocked; use manual download if needed.

2. Optional local transcription:

```sh
# Install openai-whisper separately if desired; not installed by this project.
python3 pipeline.py transcribe work/capture-001/audio.wav work/transcript-001 --model base
python3 pipeline.py observations work/capture-001/manifest.json work/transcript-001/audio.json work/observations.json
```

Whisper runs locally, but may download model weights on first use. No audio is uploaded to a transcription service. Silent videos have no audio.wav: skip transcription. Review transcript text and timing before treating it as evidence. Compatible timestamped JSON can also be supplied from another approved transcription workflow.

3. Review thumbnails; use the existing README/prepare.py Atlas steps. Keep a JSON array of selected frame IDs in exact submission order, e.g. `["frame-0000","frame-0001"]`. These IDs must correspond to the uploaded images, not independently cropped replacements.

```sh
python3 pipeline.py link-views work/capture-001/manifest.json work/selected-ids.json work/pose-operation.json work/view-links.json
python3 -m unittest -v
```

The view links preserve source timestamps plus returned cameras, depth and confidence. Observations link to the nearest sampled view and retain transcript intervals. They remain **unlocalized**, not automatically attached to surfaces.

## Spatial grounding next
To anchor “this wall,” select the relevant pixel/object in a calibrated reconstructed view, inspect its depth confidence, then unproject through the matching camera intrinsics/extrinsics. Preserve coordinate convention, grid and depth units. A timestamp alone cannot establish what the speaker meant. Store reviewed anchors separately with source observation IDs; retain unresolved notes. Reconstructed scale requires calibration before dimensional claims.

Frame times are requested FFmpeg seek times, not original frame PTS. Variable-frame-rate footage and speech timing introduce uncertainty. This prototype creates provenance links, not precise motion tracking. Review camera alignment before trusting 3D associations.

## Verification boundaries
Local unit tests and synthetic video extraction can be run without network. Slack auth, real Whisper inference, Atlas requests, and visual reconstruction are separate integration checks. No paid jobs or uploads occur in pipeline.py. Partial failures leave their new output directory for inspection; retry into a new directory.

Sources: [Slack files.info](https://docs.slack.dev/reference/methods/files.info/), [Whisper](https://github.com/openai/whisper), [Atlas cameras](https://docs.atlas.worldlabs.ai/cameras-and-posed-images), [video workflow](https://docs.atlas.worldlabs.ai/using-video-footage).
