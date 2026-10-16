// Which outline belongs to which letter. p5 returns all outlines in one list,
// in reading order, so they are handed out one letter at a time.

// p5's textToContours(), with the outlines sorted into letters: an array of
// letters, each an array of outlines, each an array of { x, y } points.
// `options` is passed on to p5, for example { sampleFactor: 0.1 }.
export function textToLetterContours(font, str, x, y, options) {
  return groupByLetter(font, str, font.textToContours(str, x, y, options));
}

// Sorts contours into letters: each letter takes as many as it has on its
// own (2 for "A", 1 for "L"). Spaces are left out.
export function groupByLetter(font, str, contours) {
  const letters = [];
  let nextContour = 0;
  for (const character of str) {
    const count = countContours(font, character);
    letters.push(contours.slice(nextContour, nextContour + count));
    nextContour += count;
  }

  //a ligature (like "fi") breaks the counts; then treat the text as one letter
  if (nextContour !== contours.length) return [contours];

  return letters.filter((letter) => letter.length > 0);
}

// The center of the box around some { x, y } positions, as a p5.Vector.
export function getCenter(positions) {
  const allX = positions.map((position) => position.x);
  const allY = positions.map((position) => position.y);
  return createVector((min(allX) + max(allX)) / 2, (min(allY) + max(allY)) / 2);
}

function countContours(font, character) {
  const commands = font.textToPaths(character, 0, 0);
  return commands.filter(([type]) => type === 'M').length;
}
