// FINDING YOUR FONTS
//
// Vite scans the fonts/ folder and hands back a { path: url } map, which
// becomes the dropdown. That is why fonts/ sits at the top level and not
// inside static/ — files in static/ are copied as-is and are invisible here.
//
// Use .otf or .ttf. Those are the formats p5's loadFont() reads.
//
// To pick which font the sketch opens with, set `startingFont` in
// src/config.js. You should not need to change anything here.

import { startingFont } from '../../config.js';

const files = import.meta.glob('/fonts/*.{otf,ttf,OTF,TTF}', {
  eager: true,
  query: '?url',
  import: 'default',
});

// { 'Inter-Black': '/fonts/Inter-Black.ttf', ... }  the dropdown's labels and values
export const fontOptions = Object.fromEntries(
  Object.entries(files)
    .map(([path, url]) => [path.split('/').pop().replace(/\.[^.]+$/, ''), url])
    .sort(([firstLabel], [secondLabel]) => firstLabel.localeCompare(secondLabel)),
);

// The font the sketch opens with, from src/config.js. If that name is not in
// the fonts folder we fall back to the first one, so a typo does not leave you
// with a blank screen.
const firstFont = Object.values(fontOptions)[0];

if (startingFont && !fontOptions[startingFont]) {
  console.warn(
    `No font called "${startingFont}" in the fonts folder. Check startingFont in src/config.js. Using the first font instead.`,
  );
}

export const defaultFont = fontOptions[startingFont] ?? firstFont;

// Switches the sketch to a font. Reading the file takes a moment, which is why
// this is async and why setup() says `await applyFont(...)`.
export async function applyFont(url) {
  const font = await loadFont(url);
  textFont(font);
  return font;
}
