import p5 from 'p5';
import { createGUI } from './lib/gui.js';
import { applyFont, defaultFont } from './lib/font/index.js';
import {
  startingText,
  backgroundColor,
  foregroundColor
} from './config.js';

const uiParams = {
  text: startingText,
  font: defaultFont,
  textSize: 330,
  letterSpacing: 0,      // Laufweite in Tausendstel Geviert
  wordSpacing: 0,        // zusätzlicher Wortabstand in Tausendstel Geviert
  lineHeight: 1.2,       // Zeilenabstand als Vielfaches der Schriftgröße
  align: 'center',       // left, center, right

  pixelSize: 2,          // Größe der Körnung/Rechenpixel (1 = fein, aber langsamer)
  blurX: 6,              // Weichzeichnung horizontal (px)
  blurY: 10,             // Weichzeichnung vertikal (px)
  smear: 150,            // Länge des Verschmierens nach unten (px, 0 = aus)
  bands: 3,              // Anzahl der Konturbänder
  phase: 0,              // Verschiebung der Bänder (0 bis 6.28)
  contrast: 1.2,         // Härte der Übergänge
  grain: 0.14,           // Körnung
  stripeAmount: 0.05,    // Stärke der horizontalen Streifen
  stripeFrequency: 0.22, // Dichte der horizontalen Streifen
  animate: true,         // Bänder wandern, Körnung flimmert
  invert: false,         // Schwarz und Weiß vertauschen

  foregroundColor,
  backgroundColor,
};

let currentFont = null;
let fontVersion = 0;
let fieldKey = '';
let lastRenderKey = '';
let field = null; // Feld aus Weichzeichnung + Verschmieren (Werte 0 bis 1)
let fieldW = 0;
let fieldH = 0;
let fxCanvas = null; // kleine Zeichenfläche in Rechenauflösung, wird hochskaliert
let fxData = null;
let fieldError = ''; // Hinweis, falls kein Text erkannt wird

async function changeFont(url) {
  currentFont = await applyFont(url);
  fontVersion++; // löst die Neuberechnung aus
}

// ---- FX-CORE START (reine Rechenfunktionen, unabhängig von p5) ----

// Weichzeichnung mit gleitender Summe, horizontal
function blurH(src, dst, w, h, r) {
  const div = 2 * r + 1;

  for (let y = 0; y < h; y++) {
    const o = y * w;
    let sum = src[o] * (r + 1);
    for (let i = 1; i <= r; i++) sum += src[o + Math.min(i, w - 1)];

    for (let x = 0; x < w; x++) {
      dst[o + x] = sum / div;
      sum += src[o + Math.min(x + 1 + r, w - 1)] - src[o + Math.max(x - r, 0)];
    }
  }
}

// Weichzeichnung mit gleitender Summe, vertikal
function blurV(src, dst, w, h, r) {
  const div = 2 * r + 1;

  for (let x = 0; x < w; x++) {
    let sum = src[x] * (r + 1);
    for (let i = 1; i <= r; i++) sum += src[Math.min(i, h - 1) * w + x];

    for (let y = 0; y < h; y++) {
      dst[y * w + x] = sum / div;
      sum += src[Math.min(y + 1 + r, h - 1) * w + x] - src[Math.max(y - r, 0) * w + x];
    }
  }
}

// Drei Durchgänge Box-Blur ergeben eine gute Näherung an einen Gauß-Blur
function gaussianBlur(input, w, h, sigmaX, sigmaY) {
  let a = input;
  let b = new Float32Array(input.length);

  const passes = (sigma, fn) => {
    if (sigma < 0.6) return;
    const r = Math.max(1, Math.round(sigma - 0.5));
    for (let n = 0; n < 3; n++) {
      fn(a, b, w, h, r);
      const t = a;
      a = b;
      b = t;
    }
  };

  passes(sigmaX, blurH);
  passes(sigmaY, blurV);

  return a;
}

// Zieht die Buchstabenform nach unten aus (wie ein Tropfen / Schmieren)
function smearDown(f, w, h, length) {
  if (length <= 1) return;
  const decay = 1 - 1 / length;

  for (let y = 1; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      const above = f[o - w + x] * decay;
      if (above > f[o + x]) f[o + x] = above;
    }
  }
}

// Maske (0 bis 1) -> weiches Feld
function buildField(mask, w, h, p) {
  const f = Float32Array.from(mask);
  smearDown(f, w, h, p.smear);
  return gaussianBlur(f, w, h, p.blurX, p.blurY);
}

// Feld -> Pixel: periodische Tonkurve erzeugt Konturbänder, Rauschen die Körnung
function renderPixels(f, w, h, pixels, o) {
  // Nachschlagetabelle für die Tonkurve (spart tausende cos()-Aufrufe pro Frame)
  const lutSize = 4096;
  const gMin = -0.8;
  const gMax = 1.8;
  const lutScale = lutSize / (gMax - gMin);
  const lut = new Uint8Array(lutSize + 1);

  for (let i = 0; i <= lutSize; i++) {
    const g = gMin + i / lutScale;
    let v = 0.5 + 0.5 * Math.cos(Math.PI * o.bands * g);
    v = Math.min(1, Math.max(0, (v - 0.5) * o.contrast + 0.5));
    if (o.invert) v = 1 - v;
    lut[i] = Math.round(v * 255);
  }

  let s = (o.seed | 0) || 1; // Zufallsgenerator (xorshift32)
  const { fg, bg } = o;

  // Verschiebung der Bänder: wirkt nur in den Übergangszonen (an den Kanten),
  // damit Hintergrund und Buchstabeninneres stabil bleiben und nicht flackern
  const shift = o.phase / (Math.PI * o.bands);

  for (let y = 0; y < h; y++) {
    // Zwei Sinuswellen mit unterschiedlicher Frequenz ergeben unregelmäßige Streifen
    const stripe =
      (Math.sin(y * o.stripeFrequency + o.stripeShift) +
        0.5 * Math.sin(y * o.stripeFrequency * 0.37 + 1.7 + o.stripeShift * 0.5)) *
      o.stripeAmount;

    const row = y * w;

    for (let x = 0; x < w; x++) {
      const v0 = f[row + x];
      const clamped = v0 < 0 ? 0 : v0 > 1 ? 1 : v0;

      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      const rnd = (s >>> 0) / 4294967296;

      // Übergangszone: 0 im leeren Hintergrund und im Inneren, 1 an den Kanten
      const zone = 4 * clamped * (1 - clamped);
      const g = v0 + (shift + stripe) * zone + (rnd - 0.5) * o.grain;

      let idx = ((g - gMin) * lutScale) | 0;
      if (idx < 0) idx = 0;
      else if (idx > lutSize) idx = lutSize;

      const v = lut[idx];
      const inv = 255 - v;
      const p = (row + x) * 4;

      pixels[p] = (fg.r * inv + bg.r * v) / 255;
      pixels[p + 1] = (fg.g * inv + bg.g * v) / 255;
      pixels[p + 2] = (fg.b * inv + bg.b * v) / 255;
      pixels[p + 3] = 255;
    }
  }
}

// ---- FX-CORE END ----

// ---------- Textlayout (Spacing, Zeilenabstand, Ausrichtung) ----------

function layoutKey() {
  return [
    uiParams.text,
    uiParams.textSize,
    uiParams.letterSpacing,
    uiParams.wordSpacing,
    uiParams.lineHeight,
    uiParams.align,
    fontVersion,
  ].join('|');
}

let layoutCache = null;
let layoutCacheKey = '';

// Berechnet die Position jedes Buchstabens (Ursprung = Mitte des Textblocks).
// Mehrere Zeilen sind möglich (Enter oder \n im Textfeld).
function getLayout() {
  const key = layoutKey();
  if (layoutCache && key === layoutCacheKey) return layoutCache;

  const size = uiParams.textSize;
  const tracking = (uiParams.letterSpacing / 1000) * size;
  const wordGap = (uiParams.wordSpacing / 1000) * size;
  const lineStep = size * uiParams.lineHeight;

  const rawLines = String(uiParams.text).split(/\\n|\n/);

  const lines = rawLines.map((str) => {
    const chars = [];
    let x = 0;
    let trailing = 0;

    for (const ch of str) {
      chars.push({ ch, x });
      trailing = tracking + (ch === ' ' ? wordGap : 0);
      x += textWidth(ch) + trailing;
    }

    return { chars, width: chars.length ? x - trailing : 0 };
  });

  const maxWidth = Math.max(0, ...lines.map((l) => l.width));

  lines.forEach((line, i) => {
    let offset = -line.width / 2; // center
    if (uiParams.align === 'left') offset = -maxWidth / 2;
    if (uiParams.align === 'right') offset = maxWidth / 2 - line.width;

    line.y = (i - (lines.length - 1) / 2) * lineStep;
    for (const c of line.chars) c.x += offset;
  });

  layoutCache = { lines, width: maxWidth, height: (lines.length - 1) * lineStep + size };
  layoutCacheKey = key;

  return layoutCache;
}

function drawLetters(col, layout) {
  fill(col.r, col.g, col.b);

  for (const line of layout.lines) {
    for (const c of line.chars) {
      text(c.ch, c.x, line.y);
    }
  }
}

// ---------- p5 ----------

// Zeichnet den Text weiß auf schwarz (verkleinert in die obere linke Ecke)
// und berechnet daraus das weiche Feld in Rechenauflösung.
function computeField() {
  const sz = Math.max(1, Math.round(uiParams.pixelSize));
  fieldW = Math.ceil(width / sz);
  fieldH = Math.ceil(height / sz);

  background(0);
  noStroke();

  push();
  scale(1 / sz);
  translate(width / 2, height / 2);
  drawLetters({ r: 255, g: 255, b: 255 }, getLayout());
  pop();

  // Pixel direkt aus der Leinwand lesen (unabhängig von pixelDensity und p5-Version)
  const d = pixelDensity();
  const readW = Math.min(Math.ceil(fieldW * d), Math.floor(width * d));
  const readH = Math.min(Math.ceil(fieldH * d), Math.floor(height * d));
  const data = drawingContext.getImageData(0, 0, readW, readH).data;

  const mask = new Float32Array(fieldW * fieldH);
  let maxValue = 0;

  for (let y = 0; y < fieldH; y++) {
    const sy = Math.min(readH - 1, Math.floor(y * d));
    for (let x = 0; x < fieldW; x++) {
      const sx = Math.min(readW - 1, Math.floor(x * d));
      const v = data[(sy * readW + sx) * 4] / 255;
      mask[y * fieldW + x] = v;
      if (v > maxValue) maxValue = v;
    }
  }

  // Kein Text gefunden: Hinweis anzeigen statt einer leeren Fläche
  if (maxValue === 0) {
    fieldError = 'Kein Text erkannt – bitte Text, Schrift und Schriftgröße prüfen.';
    field = null;
    return;
  }

  fieldError = '';

  field = buildField(mask, fieldW, fieldH, {
    blurX: uiParams.blurX / sz,
    blurY: uiParams.blurY / sz,
    smear: uiParams.smear / sz,
  });

  fxCanvas = document.createElement('canvas');
  fxCanvas.width = fieldW;
  fxCanvas.height = fieldH;
  fxData = fxCanvas.getContext('2d').createImageData(fieldW, fieldH);
}

window.setup = async function setup() {
  createCanvas(windowWidth, windowHeight);
  textAlign(LEFT, CENTER);

  await changeFont(uiParams.font);
};

window.draw = function draw() {
  const bg = uiParams.backgroundColor;
  const fg = uiParams.foregroundColor;

  textSize(uiParams.textSize);
  textAlign(LEFT, CENTER);

  // Feld neu berechnen, wenn sich Text, Typo, Blur, Verschmieren oder Fenstergröße ändern
  const newFieldKey = [
    layoutKey(),
    uiParams.pixelSize,
    uiParams.blurX,
    uiParams.blurY,
    uiParams.smear,
    width,
    height,
  ].join('|');

  if (newFieldKey !== fieldKey) {
    fieldKey = newFieldKey;
    computeField();
    lastRenderKey = ''; // erzwingt neues Rendern
  }

  if (!field || !fxCanvas) {
    if (fieldError) {
      background(bg.r, bg.g, bg.b);
      fill(fg.r, fg.g, fg.b);
      noStroke();
      textSize(18);
      textAlign(CENTER, CENTER);
      text(fieldError, width / 2, height / 2);
    }
    return;
  }

  const t = millis() / 1000;

  // Ohne Animation nur neu zeichnen, wenn sich etwas geändert hat
  const renderKey = [
    fieldKey,
    uiParams.bands,
    uiParams.phase,
    uiParams.contrast,
    uiParams.grain,
    uiParams.stripeAmount,
    uiParams.stripeFrequency,
    uiParams.invert,
    JSON.stringify(fg),
    JSON.stringify(bg),
  ].join('|');

  if (!uiParams.animate && renderKey === lastRenderKey) return;
  lastRenderKey = uiParams.animate ? '' : renderKey;

  const sz = Math.max(1, Math.round(uiParams.pixelSize));

  renderPixels(field, fieldW, fieldH, fxData.data, {
    bands: uiParams.bands,
    phase: uiParams.phase + (uiParams.animate ? t * 0.5 : 0),
    contrast: uiParams.contrast,
    grain: uiParams.grain,
    stripeAmount: uiParams.stripeAmount,
    stripeFrequency: uiParams.stripeFrequency * sz,
    stripeShift: uiParams.animate ? t * 2.5 : 0,
    seed: uiParams.animate ? frameCount * 7919 + 1 : 12345,
    invert: uiParams.invert,
    fg,
    bg,
  });

  fxCanvas.getContext('2d').putImageData(fxData, 0, 0);

  // Hochskalieren mit harten Pixelkanten, damit die Körnung körnig bleibt
  drawingContext.imageSmoothingEnabled = false;
  drawingContext.drawImage(fxCanvas, 0, 0, width, height);
};

window.windowResized = function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
};

function addControls(gui) {
  gui.add(uiParams, 'animate');
  gui.add(uiParams, 'invert');

  // Effekt
  gui.add(uiParams, 'pixelSize', 1, 6, 1);
  gui.add(uiParams, 'blurX', 0, 40, 1);
  gui.add(uiParams, 'blurY', 0, 40, 1);
  gui.add(uiParams, 'smear', 0, 400, 5);
  gui.add(uiParams, 'bands', 1, 15, 0.5);
  gui.add(uiParams, 'phase', 0, 6.28, 0.01);
  gui.add(uiParams, 'contrast', 0.5, 3, 0.05);
  gui.add(uiParams, 'grain', 0, 0.5, 0.01);
  gui.add(uiParams, 'stripeAmount', 0, 0.2, 0.005);
  gui.add(uiParams, 'stripeFrequency', 0.05, 0.6, 0.01);

  // Typografie
  gui.add(uiParams, 'letterSpacing', -100, 500, 1);
  gui.add(uiParams, 'wordSpacing', -500, 1000, 5);
  gui.add(uiParams, 'lineHeight', 0.5, 2.5, 0.01);
  gui.add(uiParams, 'align', ['left', 'center', 'right']);
}

createGUI({
  params: uiParams,
  onFontChange: changeFont,
  addControls
});

new p5();