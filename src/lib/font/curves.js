// The font's own Bézier curves, as letters > contours > curves.
// A curve is { from, controls, to }: `from` and `to` are the anchors,
// `controls` the handles. Change any { x, y } before drawing. A curve's `to`
// is the same point as the next curve's `from`, so the outline stays closed.

import { groupByLetter } from './letters.js';

const HANDLE_DOT_SIZE = 6;

const anchorColor = { r: 255, g: 160, b: 0 };
const handleColor = { r: 0, g: 200, b: 255 };

// Reads the outlines of `str` as it would be drawn by text(str, x, y), using
// whatever textSize() and textAlign() are set right now.
export function textToCurves(font, str, x, y) {
  const contours = commandsToContours(font.textToPaths(str, x, y));
  return groupByLetter(font, str, contours);
}

function commandsToContours(commands) {
  const contours = [];
  let contour = [];
  let start = null;
  let pen = null;

  for (const [type, ...numbers] of commands) {
    if (type === 'M') {
      //a move means the previous outline is finished and a new one begins
      if (contour.length > 0) contours.push(contour);
      contour = [];
      start = { x: numbers[0], y: numbers[1] };
      pen = start;
    } else if (type === 'Z') {
      //close with a line back to the start, or join the last curve onto it
      const lastCurve = contour[contour.length - 1];
      if (dist(pen.x, pen.y, start.x, start.y) > 0) {
        contour.push({ from: pen, controls: [], to: start });
      } else if (lastCurve) {
        lastCurve.to = start;
      }
      contours.push(contour);
      contour = [];
      pen = start;
    } else {
      //the last two numbers are always where the pen ends up; any before
      //them are control points, in pairs
      const points = [];
      for (let index = 0; index < numbers.length; index += 2) {
        points.push({ x: numbers[index], y: numbers[index + 1] });
      }
      const to = points.pop();
      contour.push({ from: pen, controls: points, to });
      pen = to;
    }
  }

  if (contour.length > 0) contours.push(contour);
  return contours;
}

// Moves the anchor at the end of contour[curveIndex] by `offset` ({ x, y }),
// and its two handles with it, as in Illustrator, so the outline stays smooth.
export function moveAnchor(contour, curveIndex, offset) {
  const curve = contour[curveIndex];
  const nextCurve = contour[(curveIndex + 1) % contour.length];
  const handleBefore = curve.controls[curve.controls.length - 1];
  const handleAfter = nextCurve.controls[0];

  //a straight line has no handle on that side
  for (const movingPoint of [curve.to, handleBefore, handleAfter]) {
    if (!movingPoint) continue;
    movingPoint.x += offset.x;
    movingPoint.y += offset.y;
  }
}

// Draws the letters with the current fill() and stroke(), counters cut out.
// { showHandles: true } also draws the anchors and handles.
export function drawCurves(letters, { showHandles = false } = {}) {
  const contours = letters.flat();

  beginShape();
  for (const contour of contours) {
    if (contour.length === 0) continue;

    beginContour();
    vertex(contour[0].from.x, contour[0].from.y);
    for (const curve of contour) {
      addCurveVertices(curve);
    }
    endContour(CLOSE);
  }
  endShape();

  if (showHandles) {
    for (const contour of contours) {
      for (const curve of contour) {
        drawHandles(curve);
      }
    }
  }
}

export function drawCurve(curve, { showHandles = false } = {}) {
  beginShape();
  vertex(curve.from.x, curve.from.y);
  addCurveVertices(curve);
  endShape();

  if (showHandles) drawHandles(curve);
}

export function drawHandles(curve) {
  push();
  noFill();
  rectMode(CENTER);

  stroke(anchorColor.r, anchorColor.g, anchorColor.b);
  square(curve.from.x, curve.from.y, HANDLE_DOT_SIZE);

  if (curve.controls.length > 0) {
    stroke(handleColor.r, handleColor.g, handleColor.b);
    const firstControl = curve.controls[0];
    const lastControl = curve.controls[curve.controls.length - 1];
    line(curve.from.x, curve.from.y, firstControl.x, firstControl.y);
    line(curve.to.x, curve.to.y, lastControl.x, lastControl.y);

    for (const control of curve.controls) {
      circle(control.x, control.y, HANDLE_DOT_SIZE);
    }
  }
  pop();
}

function addCurveVertices(curve) {
  if (curve.controls.length === 0) {
    vertex(curve.to.x, curve.to.y);
    return;
  }

  bezierOrder(curve.controls.length + 1);
  for (const control of curve.controls) {
    bezierVertex(control.x, control.y);
  }
  bezierVertex(curve.to.x, curve.to.y);
}
