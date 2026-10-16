# AGENTS.md

A p5.js template for graphic design students in a generative typography
module. The users are designers, not developers: keep code readable and
simple, and explain *why* in short plain-language comments.

## Setup

`npm install`, then `npm run dev` (Vite, port 8080). Plain JavaScript, p5 v2,
lil-gui. Do not add TypeScript, linters, test frameworks or new dependencies.

## Rules

- **p5 version 2.** No `preload()`; `loadFont()` returns a Promise, awaited in
  `async setup()`. Most p5 code online is 1.x. Check https://p5js.org/reference/.
- **Global mode.** No instance mode, no `p.` prefix. Do not name variables
  after p5 functions (`background`, `text`, `fill`…).
- **Use p5's own functions** (`lerp`, `map`, `constrain`, `dist`, `noise`,
  `saveCanvas`…) instead of writing your own.
- **Colors are RGB objects** `{ r, g, b }`, 0–255. Never hex.
- **Full names**, no abbreviations: `backgroundColor`, not `bg`.
- **No magic numbers** in expressions; a value on a named key
  (`textSize: 250`) is already named.
- **No divider/banner comments, no emoji.**
- Canvas stays responsive (`windowWidth`/`windowHeight`), no fixed size.

## Layout

    src/sketch.js     start here; knobs go in `params`
    src/config.js     screenshotName, starting colors
    src/lib/          helpers (gui, export, easings, math, font)
    fonts/            drop .otf/.ttf/.woff2 here; must stay at the root
    static/           served at /

## Font library (`src/lib/font`)

| Task | Use |
| --- | --- |
| Bézier curves to draw or deform | `textToCurves()`, `drawCurves()`, `moveAnchor()` |
| Points along outlines, per letter | `textToLetterContours(font, str, x, y, { sampleFactor })` |
| Center of a letter | `getCenter(positions)` |
| Spots spaced along an outline | `placeAlongOutline(outline, spacing, offset)` |
| All points, flat | p5's `font.textToPoints()` |

Words: a **letter** holds **contours** (the hole in "A" is a **counter**).
A curve is `{ from, controls, to }`: **anchors** and **handles**, as in
Illustrator. Not "segments". Keep p5 option names (`sampleFactor`).
