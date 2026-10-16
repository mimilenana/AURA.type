// ------------------------------------------------------------
// GPU: Effekte, die jeden Pixel einzeln rechnen (Thermo, Staub), laufen
// als Shader auf der Grafikkarte. In JavaScript wären sie zu langsam
// und würden ruckeln.
//
// Alle Shader teilen sich eine einzige WebGL-Ebene. Browser erlauben
// nur wenige WebGL-Ebenen gleichzeitig, und es gibt viele Zeilen
// (z. B. auf dem Plakat).
//
// Außerdem wird hier die "Maske" eines Namens gebaut: ein Bild, in dem
//   rot  = die scharfe Schrift
//   grün = leicht verwischt
//   blau = stark verwischt
// Die Shader lesen daraus, wo und wie viel Schrift an einer Stelle ist.
// ------------------------------------------------------------

import { leinwand, alsPfad } from './modi.js';

let ebene = null;               // die gemeinsame WebGL-Ebene (p5.Graphics)
const shaderListe = new Map();  // fertige Shader, nach Name

// Masken, die schon auf der Grafikkarte liegen. Ältere werden
// freigegeben, damit beim Tippen neuer Namen kein Speicher vollläuft.
const benutzteMasken = [];
const MASKEN_HOECHSTENS = 24;

// Standard-Vertex-Shader von p5: legt nur die Fläche hin und gibt die
// Position im Bild (vTexCoord, 0..1) an den Fragment-Shader weiter
const VERTEX = `
precision highp float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}`;

// Hilfsfunktionen, die jeder Fragment-Shader bekommt:
//   zufall(p)    ein fester Zufallswert für jede Stelle (für Körnung)
//   rauschen(p)  weiches Rauschen 0..1 (wie noise() in p5)
export const GLSL_HELFER = `
precision highp float;
float zufall(vec3 p) {
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}
float rauschen(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(zufall(i), zufall(i + vec3(1, 0, 0)), f.x),
                mix(zufall(i + vec3(0, 1, 0)), zufall(i + vec3(1, 1, 0)), f.x), f.y);
  float b = mix(mix(zufall(i + vec3(0, 0, 1)), zufall(i + vec3(1, 0, 1)), f.x),
                mix(zufall(i + vec3(0, 1, 1)), zufall(i + vec3(1, 1, 1)), f.x), f.y);
  return mix(a, b, f.z);
}
// mehrere Lagen Rauschen übereinander: wirkt organischer
float wolken(vec3 p) {
  return rauschen(p) * 0.55 + rauschen(p * 2.03 + 7.1) * 0.3 + rauschen(p * 4.01 + 3.7) * 0.15;
}
`;

// Zeichnet den Shader "name" in der Größe des Bereichs und legt das
// Ergebnis auf ctx. uniforms: Werte, die der Shader bekommt.
export function zeichneShader(ctx, name, fragment, bereich, uniforms) {
  const b = Math.max(1, Math.round(bereich.b)), h = Math.max(1, Math.round(bereich.h));
  const gl = holeEbene(b, h);
  if (!shaderListe.has(name)) shaderListe.set(name, gl.createShader(VERTEX, GLSL_HELFER + fragment));
  const sh = shaderListe.get(name);

  gl.clear();
  gl.push();
  gl.noStroke();
  gl.shader(sh);
  for (const [schluessel, wert] of Object.entries(uniforms)) sh.setUniform(schluessel, wert);
  // die Fläche oben links in die Ebene legen (WebGL zählt von der Mitte aus)
  gl.translate(-gl.width / 2 + b / 2, -gl.height / 2 + h / 2);
  gl.plane(b, h);
  gl.pop();

  ctx.drawImage(gl.elt, 0, 0, b, h, bereich.x, bereich.y, b, h);
}

// Die Maske eines Namens (siehe oben), verkleinert um "skala"
export function baueMaske(eintrag, bereich, skala, unschaerfeNah, unschaerfeFern) {
  const c = leinwand(bereich.b * skala, bereich.h * skala);
  const cc = c.getContext('2d');
  cc.fillStyle = '#fff';
  cc.fill(alsPfad(eintrag.konturen, bereich, skala), 'nonzero');
  const b = c.width, h = c.height;
  const bild = cc.getImageData(0, 0, b, h);
  const scharf = new Float32Array(b * h);
  for (let i = 0; i < scharf.length; i++) scharf[i] = bild.data[i * 4 + 3] / 255;

  const nah = verwischt(scharf, b, h, eintrag.u * skala * unschaerfeNah);
  const fern = verwischt(scharf, b, h, eintrag.u * skala * unschaerfeFern);
  for (let i = 0; i < scharf.length; i++) {
    bild.data[i * 4] = scharf[i] * 255;
    bild.data[i * 4 + 1] = Math.min(255, nah[i] * 255);
    bild.data[i * 4 + 2] = Math.min(255, fern[i] * 255);
    bild.data[i * 4 + 3] = 255;
  }
  merkeMaske(bild);
  return bild;
}

// Eine Farbe { r, g, b } (0..255) als Shader-Wert (0..1)
export function alsVec3(farbe) {
  return [farbe.r / 255, farbe.g / 255, farbe.b / 255];
}

function holeEbene(b, h) {
  if (!ebene) {
    ebene = createGraphics(b, h, WEBGL);
    // eine Auflösung reicht: die Effekte sind weich und körnig
    ebene.pixelDensity(1);
  } else if (ebene.width < b || ebene.height < h) {
    ebene.resizeCanvas(Math.max(ebene.width, b), Math.max(ebene.height, h));
  }
  return ebene;
}

function merkeMaske(bild) {
  benutzteMasken.push(bild);
  if (benutzteMasken.length <= MASKEN_HOECHSTENS || !ebene) return;
  const alt = benutzteMasken.shift();
  // p5 merkt sich jede Textur; die alte von der Grafikkarte löschen
  const texturen = ebene._renderer?.textures;
  const textur = texturen?.get(alt);
  if (textur) {
    textur.remove();
    texturen.delete(alt);
  }
}

// Weichzeichner: dreimal Kasten-Unschärfe ergibt fast eine Gauß-Unschärfe
export function verwischt(quelle, b, h, radius) {
  const werte = Float32Array.from(quelle);
  const hilfe = new Float32Array(b * h);
  const r = Math.max(1, Math.round(radius / 1.7));
  for (let durchgang = 0; durchgang < 3; durchgang++) kastenUnschaerfe(werte, hilfe, b, h, r);
  return werte;
}

function kastenUnschaerfe(werte, hilfe, b, h, r) {
  const fenster = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const zeile = y * b;
    let summe = 0;
    for (let x = -r; x <= r; x++) summe += werte[zeile + constrain(x, 0, b - 1)];
    for (let x = 0; x < b; x++) {
      hilfe[zeile + x] = summe / fenster;
      summe += werte[zeile + Math.min(b - 1, x + r + 1)] - werte[zeile + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < b; x++) {
    let summe = 0;
    for (let y = -r; y <= r; y++) summe += hilfe[constrain(y, 0, h - 1) * b + x];
    for (let y = 0; y < h; y++) {
      werte[y * b + x] = summe / fenster;
      summe += hilfe[Math.min(h - 1, y + r + 1) * b + x] - hilfe[Math.max(0, y - r) * b + x];
    }
  }
}
