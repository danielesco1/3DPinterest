# Roomboard

Collect rooms at their real size. Organize them into projects. Arrange them as true-scale volumes in 3D.

Pinterest saves how a space looks. Roomboard saves how it works: its size, its height, its doors, and what it felt like to stand in it.

Built for the AEC Tech hackathon, NYC, November 2026.

## Run it

No build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```sh
npx serve .
# or
python3 -m http.server 8000
```

Test on a phone by opening the served address from the same Wi-Fi network.

## What's in it

| Screen | What it does |
| --- | --- |
| Projects bar | Pills for the projects you choose to show (tick them in the Projects pulldown), plus Create. Tap a pill to make it the active project: the bookmark on any card saves into it. Double-tap a pill to open the project. Vault has its own button in the header. |
| Find a room | Endless feed of spaces. Search by text, or Browse keywords by category (Light, Materials, Mood, Features, Places) and stack them as tokens. Capture a room from here. Filter by type (room, corridor, threshold) and by size (long side, short side, height, within a tolerance), in feet or metres. Three views: Images (masonry), Index (list), Plans (drawing sheets). |
| Project | The spaces saved to one project, with the same filter and views. |
| Space | Photo, measurements, plan, spinning volume, Highlights (keywords from the scan narration), the projects it belongs to, and More like this (similar size or similar feel). |
| Vault | One card per project with a top-down plan of its current layout. |
| Project vault | The project's spaces as true-scale 3D volumes. Built-in arrangements (By size, Overlay, By type) plus saved layouts. Transparent or Opaque look. Drag to move, Ctrl-drag (or Shift) to lift and stack, drag a corner to rotate (snaps to 90°); tap for the space card; double-tap to open the space. |
| Capture | Stub form. Type the dimensions the Measure app gives you and the plan draws live. |

## Files

```
index.html        markup shell, font and script tags
css/styles.css    design tokens (light + dark) and layout
js/core.js        sample data, units, filter, animated feed, plan + volume drawing, router
js/vault.js       projects, Save-to popover, layouts, 3D vault (three.js loads only here)
js/app.js         cards for the three views, More like this, screens, boot
```

Scripts are plain classic scripts loaded in that order and share globals. `core.js` and `vault.js` also inject a few CSS rules of their own.

## The space record

Everything hangs off one small record per scanned space. Dimensions are stored in metres; the app converts for display.

```json
{
  "id": "s2",
  "name": "Long bar room",
  "place": "Lisbon",
  "tag": "room",
  "w": 9.5, "d": 4.2, "h": 3.6,
  "doors": [{ "wall": "W", "pos": 0.5, "w": 1.2 }],
  "keywords": ["long bar", "dim and warm", "dark timber"],
  "hue": 22
}
```

- `tag`: `room`, `corridor` or `threshold`
- `doors[].wall`: `N`, `E`, `S` or `W`; `pos` is 0 to 1 along that wall; `w` is the opening width in metres
- `keywords`: words from the scan narration, shown as Highlights and used by Similar feel
- `hue`: stands in for the scan photo until real photos are wired in

Sample spaces live at the top of `js/core.js` (`SPACES` for the team's own, `COMMUNITY` for the generated inspiration pool).

## What is stored where

Projects, saved spaces, layouts, view mode and units are kept in the viewer's browser (`localStorage`, keys starting `rb-` and `sp-`). Nothing is sent anywhere. Clear site data to reset.

## Deploy

Any static host works. For GitHub Pages: Settings, Pages, deploy from the `main` branch root. For Netlify: drag the folder in, or connect the repo with no build command and publish directory `.`.

## Next

- Wire real scans in: RoomPlan or Measure app values into the record, the scan photo into `hue`'s place, and the narration transcript into `keywords`.
- Stitching: snap volumes in the Vault and generate corridors and thresholds between doors.
