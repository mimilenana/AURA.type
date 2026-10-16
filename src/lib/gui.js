// THE CONTROL PANEL
// https://lil-gui.georgealways.com/
//
// The shared part of the panel: text, font, size, colors, export and hotkeys.
// Your own controls go in addControls() in src/sketch.js:
//   1. add the value to `uiParams`
//   2. add one line in addControls()
//
// lil-gui picks the kind of control from the value you give it:
//
//   gui.add(uiParams, 'speed', 0, 10, 0.1);     a number  -> slider from 0 to 10, stepping 0.1
//   gui.add(uiParams, 'showGrid');              true/false -> checkbox
//   gui.add(uiParams, 'words');                 text      -> text field
//   gui.add(uiParams, 'easing', easingNames);   a list    -> dropdown
//   gui.addColor(uiParams, 'accent', 255);                -> color picker
//
// Add .name('Label') when the property name is not what you want to read.

import GUI from 'lil-gui';
import { fontOptions } from './font/fonts.js';
import { savePNG } from './export.js';

// `onFontChange` runs when someone picks a font from the dropdown. A shared
// control only appears when `params` has its value, so a template without
// text simply leaves `text`, `font` and `textSize` out.
export function createGUI({ params, onFontChange = () => {}, addControls = () => {} }) {
  const gui = new GUI({ title: 'Controls' });

  if ('text' in params) gui.add(params, 'text');

  if ('font' in params) gui.add(params, 'font', fontOptions).onChange(onFontChange);

  if ('textSize' in params) gui.add(params, 'textSize', 100, 500, 1).name('size');

  //the 255 says our r, g and b channels run to 255, not to 1
  if ('foregroundColor' in params) gui.addColor(params, 'foregroundColor', 255).name('type color');

  if ('backgroundColor' in params) gui.addColor(params, 'backgroundColor', 255).name('background');

  addControls(gui);

  //a function on an object is how lil-gui makes a button
  gui.add({ exportPNG: () => savePNG() }, 'exportPNG').name('Export PNG');

  //hiding the panel leaves a clean canvas to screenshot or record
  let visible = true;
  const toggle = () => {
    visible = !visible;
    gui.show(visible);
  };

  window.addEventListener('keydown', (event) => {
    //without this, typing an s into the text field would save a screenshot
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (event.key === 'g') toggle();
    if (event.key === 's') savePNG();
  });

  return gui;
}
