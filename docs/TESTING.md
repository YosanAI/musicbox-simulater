# Testing

Use Node.js 22.12 or newer and install dependencies with `npm install`.

| Command | Purpose |
| --- | --- |
| `npm test` | Pure cylinder interpretation/export, audio, transport and model regression checks |
| `npm run check` | Source syntax and import-boundary checks |
| `npm run build` | Production Vite bundle |
| `npm run test:browser` | Browser interactions, canvas rendering, file handling and resource lifecycle |
| `npm run samples` | Regenerate the researched repertoire's JSON/GLB examples |

The development and preview servers use port **3000**. The browser suite starts
its own Vite server at `http://127.0.0.1:3000` unless one is already running.
Install Playwright's Chromium browser with `npx playwright install chromium` when
required. To use a local Chromium installation instead:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:browser
```

The browser checks use a lower drawing-buffer pixel ratio to keep software WebGL
responsive while testing full-size CSS layouts. Review visual detail separately
at the browser's normal display resolution. Toggle regression checks compare scene
and footer positions, sizes and page scroll offsets at desktop, tablet and mobile
widths, using both mouse clicks and keyboard focus/Space activation.

The original one-turn GLB files remain compatibility fixtures. The current library
contains six generated three-turn cylinders and the supplied Three classics JSON,
with Für Elise first. Multi-turn round trips
must preserve the turn index, tune labels and every pin's position; geometry edits
must change the recovered notes rather than merely reading a hidden score.

For manual review, check all three cameras, close zoom, panning, fullscreen, case
and lid toggles, and plucking the middle of a tooth. With playback running, seek
near 36 seconds and 72 seconds to observe the cylinder highlight and animated
indexing indicator, and hear the two-part click. Show resonance in the playback
bar should start disabled and draw decaying trails when enabled. The coiled
spring should be created only in exploded view and removed when that view closes.
