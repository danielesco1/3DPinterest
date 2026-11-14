# Roomboard: notes for Claude Code

A hackathon web app (AEC Tech, NYC). Mobile-first. Read README.md for what the app does and the space record.

## Ground rules

- Vanilla HTML, CSS and JS. No framework, no bundler, no npm dependencies. Keep it that way unless the team decides otherwise.
- The only external code is three.js 0.128.0 and its OrbitControls, loaded lazily from jsDelivr when a project vault opens (`js/vault.js`). Keep the feed free of 3D.
- Scripts are classic scripts sharing globals, loaded in order: `core.js`, `vault.js`, `app.js`. A function in a later file may be called from an earlier one only at runtime, never at load.
- Records store metres. Display goes through `len()`, `lenBare()`, `area()`, `dims()` in `core.js`, which follow the ft/m switch. Never format a dimension by hand.
- Screens are routed in-page with `go('feed' | 'p:<project>' | 's:<space>' | 'vault' | 'v:<project>' | 'capture' | 'back')`. Links use `data-go`.
- Views live in `VIEWS` in `app.js`. Cards come from `pin`, `row`, `sheet` (one per view mode) through `card()`.
- Persistent state goes through the `ls` helper in `vault.js` (localStorage, wrapped in try/catch).

## Design

The look is "Studio": Sora throughout, cool greys, near-black ink as the accent, one category colour per project. Every colour is a token in `css/styles.css` with light and dark values; style components through tokens, never literal colours. Rooms, corridors and thresholds have fixed colours in the Vault (`TAGCOL`).

Writing in the UI: plain and specific, real units, no em dashes, and no single word stranded on its own line (`text-wrap: pretty` / `balance` are already set on headings and paragraphs).

## Checking work

- Open `index.html` at phone width (390 px) and desktop width. The page must never scroll sideways.
- Walk every screen: Inspiration (all three views, filter by type and size, switch units), a space page (More like this both tabs), Vault, a project vault (switch arrangements, drag, lift, new layout, rename, delete), Capture.
- Check the browser console for errors after each.
- Check both light and dark mode.
