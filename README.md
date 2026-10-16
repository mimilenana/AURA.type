# Generative Typography

A starting point for making type with code, using [p5.js](https://p5js.org).
You type words into a panel, pick one of your own fonts, and write code that
decides how those words get drawn.

No previous coding experience needed. Follow the steps below in order.

---

## 1. Install Node

Code in this project runs through a program called **Node**.

1. Go to [nodejs.org](https://nodejs.org) and download the version marked
   **LTS**.
2. Run the installer and click through it.
3. **If Visual Studio Code is open, quit it and open it again.** It only
   notices Node on startup.

You only ever do this once, not once per project.

## 2. Open the project

Open Visual Studio Code, then **File → Open Folder…** and choose this project's
folder.

Make sure you open the folder _itself_ — the one containing `package.json` —
not the folder above it.

## 3. Open a terminal

The terminal is where you type commands to the computer.

In VS Code: **Terminal → New Terminal** from the menu bar. The shortcut is
shown next to it in the menu (on a US keyboard <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>`</kbd>).

A panel opens at the bottom of the window. That's it.

## 4. Install and run

Type this into the terminal and press Enter:

```
npm install
```

This downloads the things the project needs. It takes a minute or two the
first time and prints a lot of text. That's normal. You only do this once.

Then:

```
npm run dev
```

Your browser opens at `localhost:8080` and you should see the sketch, with a
control panel in the corner.

**Leave the terminal running.** As long as it is, every time you save a file
the browser updates by itself. To stop it, click the terminal and press
<kbd>Ctrl</kbd> + <kbd>C</kbd>.

---

## Using it

### The controls

| Control        | What it does                                             |
| -------------- | -------------------------------------------------------- |
| **text**       | The words on screen. Click the field and type.           |
| **font**       | Pick from the fonts in your `fonts/` folder.             |
| **size**       | How big the type is.                                     |
| **type color** | The color of the letters. Click the swatch for a picker. |
| **background** | The color behind them.                                   |
| **Export PNG** | Saves the canvas as an image.                            |

Not every template has all of these, and each one adds its own controls below
them.

| Key          | What it does                   |
| ------------ | ------------------------------ |
| <kbd>s</kbd> | Save the canvas as a PNG       |
| <kbd>g</kbd> | Hide or show the control panel |

Press <kbd>g</kbd> before taking a screenshot to get the canvas on its own.

### Adding your own fonts

Drop font files into the **`fonts/`** folder. They appear in the dropdown
straight away — there's no list to update.

Use **`.otf` or `.ttf`** — those are the formats p5 loads properly. A `.woff2`
shows up in the dropdown but may not render.

The dropdown shows the filename without the extension, so `Grotesk-Bold.otf`
becomes **Grotesk-Bold**.

If a font you just added doesn't show up: stop the dev server
(<kbd>Ctrl</kbd> + <kbd>C</kbd>) and run `npm run dev` again.

### Your project settings

Open **`src/config.js`**. It holds what the sketch starts with:

- `screenshotName` is the name your exported images get.
- `startingFont` is the font it opens with, so you are not picking it from the
  dropdown every time you reload. Write it exactly as it appears in the
  dropdown, which is the filename without `.otf` or `.ttf`.
- `startingText` is the words it opens with.
- `backgroundColor` and `foregroundColor` are the starting colors.

Some templates add their own settings here, like `gridSize` in the grid
template.

Exported images are named after `screenshotName`, plus the date and time, so
`my-poster` becomes `my-poster-260921-1408.png`. Two exports never overwrite
each other.

Colors are written as **r, g, b** — red, green and blue, each from 0 to 255.
So `{ r: 255, g: 0, b: 0 }` is red, and `{ r: 255, g: 255, b: 255 }` is white.
The color pickers in the panel change them while the sketch runs; these are
just the starting values.

### Saving stills

Press <kbd>s</kbd> or click **Export PNG**. The file lands in your **Downloads**
folder.

### Recording motion

There is no record button, on purpose — screen recording is simpler and gives
you better results than anything built into the sketch.

- **macOS** — press <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>5</kbd>, choose
  _Record Selected Portion_, drag a box around the canvas, click **Record**.
  Press <kbd>g</kbd> first to hide the panel.
- **Windows** — press <kbd>Win</kbd> + <kbd>G</kbd> for the Game Bar, or install
  [OBS](https://obsproject.com).
- **Either** — [OBS](https://obsproject.com) is free and gives you the most
  control if you want higher quality.

---

## p5 version 2

This project uses p5.js **version 2**. Many tutorials online are for version 1.
Almost everything works the same. If you see `preload()`, that is version 1
and won't work here. When you ask an AI for help, tell it you use p5.js 2.0.
When in doubt, check the [p5.js reference](https://p5js.org/reference/).

You don't need any loading code for fonts: drop them into `fonts/` and pick
them in the panel.

## Writing your own code

Everything you write goes in **`src/sketch.js`**. It's the only file you need
to open, and it's commented throughout.

Two functions do the work:

- `setup()` runs **once**, at the start.
- `draw()` runs about **60 times a second**, forever. Animation lives here.

Every p5 function, with examples, is in the
[p5.js reference](https://p5js.org/reference/).

To add your own control to the panel, add a value to `uiParams` in
`src/sketch.js`, then add one line in `addControls()` at the bottom of that
file. There are examples in the comments at the top of `src/lib/gui.js`.
The panel is made with [lil-gui](https://lil-gui.georgealways.com); its
documentation shows every kind of control you can add.

The sketch runs in p5's **global mode**, which means you write `background()`
and `width` exactly as you would in Processing or any p5 tutorial, with no
prefix. One catch: don't name a variable after a p5 function. A local called
`background` hides `background()` and the next call to it will fail.

`src/lib/` is the rest of the tool: the control panel, font loading, image
export and easing. You do not need it on day one, but it is yours to change,
and building the tool means changing it.

### Easing

`src/lib/easings.js` gives you about thirty ways to move between two values —
slow starts, sharp stops, overshoots, bounces. Movement that uses one almost
always looks better than movement that doesn't.

```js
import { Easings } from './lib/easings.js';

const t = (frameCount % 120) / 120; // 0 -> 1, over 2 seconds
const eased = Easings.cubicInOut(t);
textSize(lerp(20, 200, eased));
```

The file's comments explain it properly, and [easings.net](https://easings.net)
draws every curve so you can see what you're picking.

---

## Something's broken

**`npm: command not found`** — Node isn't installed, or VS Code was open while
you installed it. Quit VS Code, reopen it, try again.

**The browser shows a blank page** — look at the terminal. Errors there usually
name the file and line. Also open the browser's console
(Mac: <kbd>Cmd</kbd> + <kbd>Option</kbd> + <kbd>J</kbd>, Windows:
<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>J</kbd>).

**A font doesn't load** — check the file really is `.otf` or `.ttf`, and
restart `npm run dev`. If it appears in the dropdown but the type still looks
like plain Helvetica, open the browser console: the font failed to load and the
sketch fell back to the system font.

**Nothing updates when I save** — the dev server probably stopped. Check the
terminal and run `npm run dev` again.

## Project structure

```
fonts/              <- your font files go here
src/
  sketch.js         <- your code
  config.js         <- screenshot name and starting colors
  lib/              <- the tool itself: panel, fonts, export, easing
static/             <- images and other files used as-is
```

Credits and licences for the libraries used are in [LICENSES.md](LICENSES.md).
