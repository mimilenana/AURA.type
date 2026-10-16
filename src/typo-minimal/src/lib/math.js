// Shaping functions. https://iquilezles.org/articles/functions/

// Moves `current` towards `target`, smoothly and at the same speed at any
// frame rate. Bigger `speed` gets there faster. Use every frame:
//   size = damp(size, targetSize, 5, deltaTime / 1000);
export function damp(current, target, speed, deltaSeconds) {
  return lerp(current, target, 1 - exp(-speed * deltaSeconds));
}

// An arch from 0 up to 1 and back to 0, as x goes from 0 to 1.
// Bigger `sharpness` makes the arch narrower.
export function parabola(x, sharpness) {
  return pow(4 * x * (1 - x), sharpness);
}

// A smooth bump: 1 at `center`, falling to 0 at `pulseWidth` either side.
export function cubicPulse(center, pulseWidth, x) {
  const distance = abs(x - center);
  if (distance > pulseWidth) return 0;
  const t = distance / pulseWidth;
  return 1 - t * t * (3 - 2 * t);
}

// cubicPulse on a loop from 0 to 1: a bump near 1 carries on at 0, so a
// pulse can travel round and round without a jump.
export function cubicPulseWrap(center, pulseWidth, x) {
  const distance = abs(x - center);
  return cubicPulse(0, pulseWidth, min(distance, 1 - distance));
}
