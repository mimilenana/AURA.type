// ------------------------------------------------------------
// THERMO (dunkel · weich): Der Name ist eine Wärmebild-Heatmap. Die
// Buchstaben selbst glühen in einem Farbverlauf von kalt nach heiß (je nach
// Farbmodus, siehe farben.js), mit feiner Körnung. Wandernde Zonen verschmieren Teile des
// Namens in Bewegungsrichtung, dort kühlt er ab und zerläuft. Woanders
// bleibt er heiß und lesbar.
//
// Gerechnet wird als Shader auf der Grafikkarte (gpu.js), damit es
// flüssig läuft.
//
// Die Zahlen in THERMO sind eure Stellschrauben.
// ------------------------------------------------------------

import { zeichneShader, baueMaske, alsVec3 } from './gpu.js';

const THERMO = {
  aufloesung: 0.5,       // Größe der Maske (0.5 = halb so groß, reicht für weiche Effekte)
  unschaerfeNah: 0.035,  // Glutrand direkt an der Schrift (Anteil der Schriftgröße)
  unschaerfeFern: 0.18,  // weiter Hitzeschleier
  verzug: 0.06,          // wie stark die Schrift wabert
  schmieren: 0.9,        // wie lang die Bewegungsunschärfe höchstens ist (in Schriftgrößen)
  schmierAnteil: 0.4,    // wie viel vom Namen gerade verschmiert ist
  tempo: 0.25,           // wie schnell die Zonen wandern
  kuehl: 0.45,           // wie stark manche Zonen abkühlen
  korn: 0.12,            // Körnung
};

// Im Shader: GLSL, die Sprache der Grafikkarte. Für jeden Pixel wird
// main() einmal ausgeführt.
const FRAGMENT = `
varying vec2 vTexCoord;
uniform sampler2D maske;
uniform vec2 groesse;
uniform float u;
uniform float zeit;
uniform float staerke;
uniform vec3 hintergrund;
uniform vec3 farbe0;
uniform vec3 farbe1;
uniform vec3 farbe2;
uniform vec3 farbe3;
uniform vec3 farbe4;
uniform float verzug;
uniform float schmieren;
uniform float schmierAnteil;
uniform float kuehl;
uniform float korn;
uniform float bild;           // Nummer des Bildes, für flimmernde Körnung

const int PROBEN = 14;

// Wärmefarben von kalt nach heiß: fünf Farben, die von außen kommen (farben.js)
vec3 waermefarbe(float w) {
  vec3 c = mix(farbe0, farbe1, smoothstep(0.15, 0.4, w));
  c = mix(c, farbe2, smoothstep(0.4, 0.6, w));
  c = mix(c, farbe3, smoothstep(0.6, 0.8, w));
  c = mix(c, farbe4, smoothstep(0.8, 0.98, w));
  return c;
}

void main() {
  vec2 px = vTexCoord * groesse;
  vec3 ort = vec3(px / u, zeit);

  // die Schrift wabert leicht
  vec2 welle = vec2(rauschen(ort * 1.2), rauschen(ort * 1.2 + 31.0)) - 0.5;
  px += welle * 2.0 * u * verzug * staerke;

  // Zonen, in denen die Schrift verschmiert: Richtung und Länge wandern
  float zone = smoothstep(1.0 - schmierAnteil - 0.1, 1.0 - schmierAnteil + 0.15, wolken(ort * 0.6 + 50.0));
  float winkel = wolken(ort * 0.3 + 90.0) * 12.566;
  vec2 richtung = vec2(cos(winkel), sin(winkel));
  float laenge = zone * u * schmieren * staerke;

  // Bewegungsunschärfe: viele Proben entlang der Richtung mitteln
  float summe = 0.0;
  for (int i = 0; i < PROBEN; i++) {
    float s = float(i) / float(PROBEN - 1);
    summe += texture2D(maske, (px + richtung * laenge * s) / groesse).g;
  }
  float nah = summe / float(PROBEN);
  float fern = texture2D(maske, px / groesse).b;

  // verschmierte Zonen kühlen ab, der Rest bleibt heiß
  float waerme = nah * 1.15 + fern * 0.5;
  waerme *= 1.0 - kuehl * zone * 0.6 - kuehl * 0.4 * rauschen(ort * 0.8 + 140.0);

  // Körnung, bei jedem Bild neu
  waerme += (zufall(vec3(gl_FragCoord.xy, bild)) - 0.5) * korn;
  waerme = clamp(waerme, 0.0, 1.0);

  float deckkraft = smoothstep(0.03, 0.2, waerme);
  gl_FragColor = vec4(mix(hintergrund, waermefarbe(waerme), deckkraft), 1.0);
}
`;

export function bereite(eintrag, bereich) {
  return {
    u: eintrag.u,
    bereich,
    maske: baueMaske(eintrag, bereich, THERMO.aufloesung, THERMO.unschaerfeNah, THERMO.unschaerfeFern),
  };
}

// Der bekannte Wärmebild-Verlauf, wenn die Farben keinen eigenen mitbringen
const WAERMEBILD = [
  { r: 77, g: 10, b: 128 },
  { r: 219, g: 31, b: 26 },
  { r: 255, g: 128, b: 0 },
  { r: 250, g: 235, b: 64 },
  { r: 242, g: 255, b: 217 },
];

export function zeichne(ctx, d, zeit, farben, staerke) {
  const verlauf = farben.verlauf ?? WAERMEBILD;
  zeichneShader(ctx, 'thermo', FRAGMENT, d.bereich, {
    maske: d.maske,
    groesse: [d.bereich.b, d.bereich.h],
    u: d.u,
    zeit: zeit * THERMO.tempo,
    staerke,
    hintergrund: alsVec3(farben.hinten),
    farbe0: alsVec3(verlauf[0]),
    farbe1: alsVec3(verlauf[1]),
    farbe2: alsVec3(verlauf[2]),
    farbe3: alsVec3(verlauf[3]),
    farbe4: alsVec3(verlauf[4]),
    verzug: THERMO.verzug,
    schmieren: THERMO.schmieren,
    schmierAnteil: THERMO.schmierAnteil,
    kuehl: THERMO.kuehl,
    korn: THERMO.korn,
    bild: Math.floor(zeit * 24) % 1000,
  });
}
