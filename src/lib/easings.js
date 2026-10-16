// Easing curves: give one a number from 0 to 1, get a number from 0 to 1 back,
// moved along a different path. See src/sketch.js for one in use, and
// https://easings.net to see every curve drawn out.
//
// From the `eases` package by Matt DesLauriers (MIT), see LICENSES.md.

const linear = (t) => t;

const sineIn = (t) => {
  const v = Math.cos(t * Math.PI * 0.5);
  if (Math.abs(v) < 1e-14) return 1;
  return 1 - v;
};

const sineOut = (t) => Math.sin((t * Math.PI) / 2);

const sineInOut = (t) => -0.5 * (Math.cos(Math.PI * t) - 1);

const quadIn = (t) => t * t;

const quadOut = (t) => -t * (t - 2.0);

const quadInOut = (t) => {
  t /= 0.5;
  if (t < 1) return 0.5 * t * t;
  t--;
  return -0.5 * (t * (t - 2) - 1);
};

const cubicIn = (t) => t * t * t;

const cubicOut = (t) => {
  const f = t - 1.0;
  return f * f * f + 1.0;
};

const cubicInOut = (t) => (t < 0.5 ? 4.0 * t * t * t : 0.5 * Math.pow(2.0 * t - 2.0, 3.0) + 1.0);

const quartIn = (t) => Math.pow(t, 4.0);

const quartOut = (t) => Math.pow(t - 1.0, 3.0) * (1.0 - t) + 1.0;

const quartInOut = (t) => (t < 0.5 ? +8.0 * Math.pow(t, 4.0) : -8.0 * Math.pow(t - 1.0, 4.0) + 1.0);

const quintIn = (t) => t * t * t * t * t;

const quintOut = (t) => --t * t * t * t * t + 1;

const quintInOut = (t) => {
  if ((t *= 2) < 1) return 0.5 * t * t * t * t * t;
  return 0.5 * ((t -= 2) * t * t * t * t + 2);
};

const expoIn = (t) => (t === 0.0 ? t : Math.pow(2.0, 10.0 * (t - 1.0)));

const expoOut = (t) => (t === 1.0 ? t : 1.0 - Math.pow(2.0, -10.0 * t));

const expoInOut = (t) =>
  t === 0.0 || t === 1.0
    ? t
    : t < 0.5
      ? +0.5 * Math.pow(2.0, 20.0 * t - 10.0)
      : -0.5 * Math.pow(2.0, 10.0 - t * 20.0) + 1.0;

const circIn = (t) => 1.0 - Math.sqrt(1.0 - t * t);

const circOut = (t) => Math.sqrt(1 - --t * t);

const circInOut = (t) => {
  if ((t *= 2) < 1) return -0.5 * (Math.sqrt(1 - t * t) - 1);
  return 0.5 * (Math.sqrt(1 - (t -= 2) * t) + 1);
};

const backIn = (t) => {
  const s = 1.70158;
  return t * t * ((s + 1) * t - s);
};

const backOut = (t) => {
  const s = 1.70158;
  return --t * t * ((s + 1) * t + s) + 1;
};

const backInOut = (t) => {
  const s = 1.70158 * 1.525;
  if ((t *= 2) < 1) return 0.5 * (t * t * ((s + 1) * t - s));
  return 0.5 * ((t -= 2) * t * ((s + 1) * t + s) + 2);
};

const elasticIn = (t) => Math.sin((13.0 * t * Math.PI) / 2) * Math.pow(2.0, 10.0 * (t - 1.0));

const elasticOut = (t) => Math.sin((-13.0 * (t + 1.0) * Math.PI) / 2) * Math.pow(2.0, -10.0 * t) + 1.0;

const elasticInOut = (t) =>
  t < 0.5
    ? 0.5 * Math.sin(((+13.0 * Math.PI) / 2) * 2.0 * t) * Math.pow(2.0, 10.0 * (2.0 * t - 1.0))
    : 0.5 * Math.sin(((-13.0 * Math.PI) / 2) * (2.0 * t - 1.0 + 1.0)) * Math.pow(2.0, -10.0 * (2.0 * t - 1.0)) + 1.0;

const bounceOut = (t) => {
  const a = 4.0 / 11.0;
  const b = 8.0 / 11.0;
  const c = 9.0 / 10.0;

  const ca = 4356.0 / 361.0;
  const cb = 35442.0 / 1805.0;
  const cc = 16061.0 / 1805.0;

  const t2 = t * t;

  return t < a
    ? 7.5625 * t2
    : t < b
      ? 9.075 * t2 - 9.9 * t + 3.4
      : t < c
        ? ca * t2 - cb * t + cc
        : 10.8 * t * t - 20.52 * t + 10.72;
};

const bounceIn = (t) => 1.0 - bounceOut(1.0 - t);

const bounceInOut = (t) => (t < 0.5 ? 0.5 * (1.0 - bounceOut(1.0 - t * 2.0)) : 0.5 * bounceOut(t * 2.0 - 1.0) + 0.5);

export const Easings = {
  linear,
  sineIn,
  sineOut,
  sineInOut,
  quadIn,
  quadOut,
  quadInOut,
  cubicIn,
  cubicOut,
  cubicInOut,
  quartIn,
  quartOut,
  quartInOut,
  quintIn,
  quintOut,
  quintInOut,
  expoIn,
  expoOut,
  expoInOut,
  circIn,
  circOut,
  circInOut,
  backIn,
  backOut,
  backInOut,
  elasticIn,
  elasticOut,
  elasticInOut,
  bounceIn,
  bounceOut,
  bounceInOut,
};

//the names, handy for building a dropdown: pane.addBinding(params, 'easing', { options: ... })
export const easingNames = Object.keys(Easings);
