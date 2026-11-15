# 3DPinterest

Video captures of real spaces, reconstructed as navigable 3D scenes.

**Live demo:** https://danielesco1.github.io/3DPinterest/roomboard/

Roomboard is a Pinterest for rooms: browse real places by photo, keyword and size, open a scanned room in 3D, and click a highlight from the narration (for example "chandelier" or "window-view") to fly to what the narrator was looking at.

## Built with

- [World Labs Atlas](https://www.worldlabs.ai) for phone video to camera poses and Gaussian splats
- [Spark](https://sparkjs.dev) (World Labs) and [three.js](https://threejs.org) for rendering splats in the browser
- [ElevenLabs Scribe](https://elevenlabs.io/speech-to-text) for narration transcripts, including non-English walkthroughs
- Google Cloud Storage for public room data; GitHub Pages for the site
- Plain HTML, CSS and JavaScript: no build step, no npm

## Layout

- `roomboard/`: static gallery and room pages.
- `3d-viewer/`: shared Spark viewer and static scene exporter.
- `experiments/atlas-video-to-3d/`: Atlas reconstruction, Astra geometry, drawings and per-space publishing pipeline. See its [standard workflow](experiments/atlas-video-to-3d/STANDARD_WORKFLOW.md).

## Tests

```sh
cd experiments/atlas-video-to-3d
python3 -m unittest discover -p "test_*.py"
```

## Private assets

Keep API keys in ignored `.env` files and scene assets in ignored `work/` folders. Assets are published separately to Drive or the configured storage bucket, never to Git. Geometry and dimensions are uncalibrated estimates requiring review.

## Use it with your own rooms

1. **Capture and reconstruct.** Follow the [standard workflow](experiments/atlas-video-to-3d/STANDARD_WORKFLOW.md) to turn a narrated phone video into a splat, camera poses and a room shell.
2. **Export a viewer scene.** `python3 3d-viewer/export_static.py` writes a static folder per scene (see [3d-viewer/README.md](3d-viewer/README.md)). Host it anywhere that serves static files over HTTPS.
3. **Describe the room** in a folder next to an `index.json`:
   - `index.json`: `{"format_version": 1, "rooms": [{"id", "name", "place", "folder", "calibrated"}]}`
   - `<folder>/space.json`: name, place, `w`/`d`/`h`, `doors` (`wall` N/E/S/W, `pos` 0 to 1, `w`), `keywords`, optional `thumb` (photo URL) and `viewer` (your exported scene's `index.html`). `backend/export_rooms.py` builds this from a scan's size and tags.
   - `<folder>/tags.json`: anchors with `tags`, the narration `speech` that produced them, and a 3D `position` (plus optional `camera`) in the splat's coordinates.
4. **Point Roomboard at it.** Fork the repo, set `window.ROOMBOARD_DATA_URL` in `roomboard/index.html` to your folder's HTTPS address, and enable GitHub Pages. Your host must allow cross-origin GET requests from your site.

Sizes from scans are uncalibrated and shown as "est." until a real site measurement is added.

## License

[MIT](LICENSE)
