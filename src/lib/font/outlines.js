// Placing shapes along an outline: one closed loop of { x, y } points, e.g.
// one contour from textToLetterContours().
//
//   for (const spot of placeAlongOutline(outline, 40, offset)) {
//     circle(spot.x, spot.y, 10);
//   }
//
// Raise `offset` over time and the shapes travel round. `spot.angle` is the
// direction of the outline there, for rotate().

export function placeAlongOutline(outline, spacing, offset = 0) {
  const distances = measureOutline(outline);
  const outlineLength = distances[distances.length - 1];

  //stretch the gap a little so the spots meet evenly round the loop
  const count = floor(outlineLength / spacing);
  if (count === 0) return [];
  const gap = outlineLength / count;

  const spots = [];
  for (let index = 0; index < count; index++) {
    spots.push(spotAt(outline, distances, index * gap + offset));
  }
  return spots;
}

export function placeAtDistance(outline, distance) {
  return spotAt(outline, measureOutline(outline), distance);
}

export function getOutlineLength(outline) {
  const distances = measureOutline(outline);
  return distances[distances.length - 1];
}

// How far along the outline each point is. The last number is the full length.
function measureOutline(outline) {
  const distances = [0];
  for (let index = 1; index <= outline.length; index++) {
    const previous = outline[index - 1];
    const current = outline[index % outline.length];
    distances.push(distances[index - 1] + dist(previous.x, previous.y, current.x, current.y));
  }
  return distances;
}

// The spot `distance` pixels along: lerp() between the two points around it.
function spotAt(outline, distances, distance) {
  //keeps going round: negative distances count backwards
  const outlineLength = distances[distances.length - 1];
  const distanceOnLoop = ((distance % outlineLength) + outlineLength) % outlineLength;

  let index = 0;
  while (distances[index + 1] < distanceOnLoop) index++;

  const current = outline[index];
  const next = outline[(index + 1) % outline.length];
  const stepLength = distances[index + 1] - distances[index];
  const between = stepLength > 0 ? (distanceOnLoop - distances[index]) / stepLength : 0;

  return {
    x: lerp(current.x, next.x, between),
    y: lerp(current.y, next.y, between),
    angle: atan2(next.y - current.y, next.x - current.x),
  };
}
