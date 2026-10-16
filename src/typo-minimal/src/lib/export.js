// SAVING IMAGES
//
// Pressing 's' or clicking Export PNG lands here.
//
// The file is named after `screenshotName` in src/config.js, followed by the
// date and time, so two exports never overwrite each other. Change the line
// in savePNG() if you want a different name or a different format.

import { screenshotName } from '../config.js';

// Builds the date-and-time part of the filename.
// '260921-1408' means 21 September 2026, at 14:08.
export const timestamp = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  //getMonth() counts from zero, so January is 0
  const year = String(now.getFullYear()).slice(-2);
  const date = `${year}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;

  return `${date}-${time}`;
};

// Saves whatever is on the canvas right now into your Downloads folder.
// 'jpg' and 'webp' work here too.
export function savePNG() {
  saveCanvas(`${screenshotName}-${timestamp()}`, 'png');
}
