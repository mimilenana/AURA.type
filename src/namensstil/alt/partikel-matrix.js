// ------------------------------------------------------------
// PARTIKEL (hell · weich): Das Wort besteht aus einem sauberen Raster
// aus gleich großen Punkten, wie eine Punktmatrix-Anzeige. Immer wieder
// gerät das Raster an einer Stelle durcheinander: die Punkte einer
// Gruppe schwirren umher, und danach finden alle wieder ihren Platz.
// Es gibt drei Arten:
//
//   WELLE     die Zeilen (oder Spalten) der Gruppe wellen sich
//   STREUEN   die Gruppe platzt auf, die Punkte schwirren wie eine Wolke
//             um die Mitte
//   STRUDEL   die Gruppe verdreht sich um ihre Mitte
//
// Mehrere Ereignisse laufen immer versetzt nebeneinander. Die Bewegung hängt
// nur von der Zeit ab (nichts wird gemerkt), deshalb sieht das Plakat-
// und Archivbild bei jeder Zeit gleich aus.
//
// Die Zahlen in PARTIKEL sind eure Stellschrauben.
// ------------------------------------------------------------

import { leinwand, alsPfad, rgb, umriss } from '../modi.js';
import { gitter } from '../verzerrung.js';

const PARTIKEL = {
  abstand: 0.0175,        // Abstand der Punkte im Raster (Anteil der Schriftgröße); kleiner = feiner
  radius: 0.44,           // Punktradius (Anteil des Abstands): unter 0.5 bleibt zwischen den Punkten eine Lücke

  takt: 4.5,              // Sekunden pro Ereignis
  ereignisse: 4,          // wie viele Ereignisse gleichzeitig laufen
  radiusGruppe: [0.4, 0.75], // Größe der gestörten Stelle (in Schriftgrößen, kleinster und größter Wert)
  anteilWelle: 0.4,       // wie oft es eine Welle ist
  anteilStreuen: 0.3,     // wie oft es ein Streuen ist (der Rest sind Strudel)

  welleHoehe: [0.04, 0.1],    // wie weit sich die Zeilen auslenken (in Schriftgrößen)
  welleLaenge: [0.07, 0.16],  // Abstand zwischen zwei Wellenbergen (in Schriftgrößen)
  welleTempo: [2, 4],         // wie schnell die Wellen laufen (Bogenmaß pro Sekunde)

  streuWeite: [0.14, 0.3],     // wie weit die Punkte beim Streuen fliegen (in Schriftgrößen)
  streuTempo: [3, 6],         // wie schnell sie schwirren

  strudelWinkel: [1.5, 3.2],  // wie stark sich der Strudel dreht (Bogenmaß in der Mitte)
  strudelTempo: 0.5,          // wie schnell er weiterdreht, solange er läuft
};

export function bereite(eintrag, bereich) {
  const u = eintrag.u;
  const seed = eintrag.seed & 0xffff;

  // Wort als Maske zeichnen und an jedem Rasterpunkt nachsehen, ob dort Wort ist
  const maske = leinwand(bereich.b, bereich.h);
  const mc = maske.getContext('2d');
  mc.fillStyle = '#fff';
  mc.fill(alsPfad(eintrag.konturen, bereich), 'nonzero');
  const alpha = mc.getImageData(0, 0, maske.width, maske.height).data;

  const abstand = Math.max(3, u * PARTIKEL.abstand);
  const form = umriss(eintrag, bereich);
  const xs = [], ys = [];
  for (let y = abstand / 2 + Math.floor(Math.max(0, form.y0) / abstand) * abstand; y < Math.min(bereich.h, form.y1 + abstand); y += abstand) {
    for (let x = abstand / 2 + Math.floor(Math.max(0, form.x0) / abstand) * abstand; x < Math.min(bereich.b, form.x1 + abstand); x += abstand) {
      const px = Math.min(maske.width - 1, Math.floor(x)), py = Math.min(maske.height - 1, Math.floor(y));
      if (alpha[(py * maske.width + px) * 4 + 3] > 127) { xs.push(x); ys.push(y); }
    }
  }

  // pro Punkt feste Zufallswerte: für die Richtung beim Streuen, die Phase beim Schwirren, die Reichweite
  const n = xs.length;
  const zufall = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    zufall[i * 3] = gitter(i, 1, seed);
    zufall[i * 3 + 1] = gitter(i, 2, seed);
    zufall[i * 3 + 2] = gitter(i, 3, seed);
  }

  return {
    u, bereich, form, seed, n, abstand, zufall,
    x: Float32Array.from(xs), y: Float32Array.from(ys),
    ereignisse: new Map(),
  };
}

export function zeichne(ctx, d, zeit, farben, staerke) {
  const { n } = d;
  const r = d.abstand * PARTIKEL.radius;

  // die gerade laufenden Ereignisse, gleichmäßig über den Takt verteilt
  const laufend = [];
  for (let spur = 0; spur < PARTIKEL.ereignisse; spur++) {
    const t = zeit / PARTIKEL.takt + spur / PARTIKEL.ereignisse;
    const nummer = Math.floor(t);
    const anteil = t - nummer;
    // erst baut sich die Störung auf, dann schwirrt es, dann finden die Punkte zurück
    const huelle = glatt((anteil - 0.05) / 0.2) * (1 - glatt((anteil - 0.62) / 0.33));
    if (huelle > 0.001) laufend.push({ ereignis: holeEreignis(d, spur, nummer), huelle: huelle * staerke, zeit });
  }

  const pfad = new Path2D();
  const v = { x: 0, y: 0 };
  for (let i = 0; i < n; i++) {
    let x = d.x[i], y = d.y[i];
    for (const l of laufend) {
      verschiebung(d, l, i, v);
      x += v.x;
      y += v.y;
    }
    pfad.moveTo(x + r, y);
    pfad.arc(x, y, r, 0, TWO_PI);
  }

  ctx.save();
  ctx.translate(d.bereich.x, d.bereich.y);
  ctx.fillStyle = rgb(farben.vorne);
  ctx.fill(pfad);
  ctx.restore();
}

// Ein Ereignis wird einmal ausgewürfelt und gemerkt. Dieselbe Nummer
// ergibt immer dasselbe Ereignis.
function holeEreignis(d, spur, nummer) {
  const schluessel = nummer * PARTIKEL.ereignisse + spur;
  if (d.ereignisse.has(schluessel)) return d.ereignisse.get(schluessel);
  for (const k of d.ereignisse.keys()) if (k < schluessel - 12) d.ereignisse.delete(k);

  const u = d.u, f = d.form;
  const zufall = (m) => gitter(nummer * 11 + spur * 131 + m, 5, d.seed);
  const zwischen = ([klein, gross], m) => (klein + (gross - klein) * zufall(m)) * u;

  const wahl = zufall(1);
  const art = wahl < PARTIKEL.anteilWelle ? 'welle' : wahl < PARTIKEL.anteilWelle + PARTIKEL.anteilStreuen ? 'streuen' : 'strudel';
  const ereignis = {
    art,
    mitteX: f.x0 + zufall(2) * (f.x1 - f.x0),
    mitteY: f.y0 + zufall(3) * (f.y1 - f.y0),
    radius: zwischen(PARTIKEL.radiusGruppe, 4),
    phase: zufall(5) * TWO_PI,
  };
  if (art === 'welle') {
    Object.assign(ereignis, {
      hoehe: zwischen(PARTIKEL.welleHoehe, 6),
      welle: TWO_PI / zwischen(PARTIKEL.welleLaenge, 7),
      tempo: PARTIKEL.welleTempo[0] + (PARTIKEL.welleTempo[1] - PARTIKEL.welleTempo[0]) * zufall(8),
      senkrecht: zufall(9) < 0.5,   // Zeilen wellen sich (waagerecht) oder Spalten (senkrecht)
    });
  } else if (art === 'streuen') {
    Object.assign(ereignis, {
      weite: zwischen(PARTIKEL.streuWeite, 6),
      tempo: PARTIKEL.streuTempo[0] + (PARTIKEL.streuTempo[1] - PARTIKEL.streuTempo[0]) * zufall(7),
    });
  } else {
    const [klein, gross] = PARTIKEL.strudelWinkel;
    ereignis.winkel = (zufall(6) < 0.5 ? -1 : 1) * (klein + (gross - klein) * zufall(7));
  }
  d.ereignisse.set(schluessel, ereignis);
  return ereignis;
}

// Wie ein Ereignis den Punkt i verschiebt. Nur Punkte nahe der Mitte der
// Gruppe werden erfasst, am Rand weich auslaufend.
function verschiebung(d, l, i, aus) {
  const e = l.ereignis;
  const rx = d.x[i] - e.mitteX, ry = d.y[i] - e.mitteY;
  const abstandQuadrat = (rx * rx + ry * ry) / (e.radius * e.radius);
  if (abstandQuadrat > 1) { aus.x = aus.y = 0; return; }
  // 1 in der Mitte, 0 am Rand der Gruppe
  const gewicht = glatt(1 - Math.sqrt(abstandQuadrat)) * l.huelle;
  const t = l.zeit;

  if (e.art === 'welle') {
    // die Zeilen laufen als Welle hin und her; die Phase hängt von der Lage ab
    const lage = e.senkrecht ? d.x[i] : d.y[i];
    const ausschlag = Math.sin(lage * e.welle + t * e.tempo + e.phase) * e.hoehe * gewicht;
    aus.x = e.senkrecht ? 0 : ausschlag;
    aus.y = e.senkrecht ? ausschlag : 0;
  } else if (e.art === 'streuen') {
    // jeder Punkt fliegt in seine eigene Richtung und schwirrt dort umher
    const zufallRichtung = d.zufall[i * 3] * TWO_PI;
    const zufallWeite = Math.sqrt(d.zufall[i * 3 + 1]);
    const zufallPhase = d.zufall[i * 3 + 2] * TWO_PI;
    const winkel = zufallRichtung + Math.sin(t * e.tempo * 0.4 + zufallPhase) * 1.2;
    const weite = e.weite * gewicht * zufallWeite * (0.65 + 0.35 * Math.sin(t * e.tempo + zufallPhase));
    aus.x = Math.cos(winkel) * weite;
    aus.y = Math.sin(winkel) * weite;
  } else {
    // der Strudel dreht die Gruppe um ihre Mitte, in der Mitte am stärksten
    const winkel = (e.winkel + Math.sin(e.phase + t * PARTIKEL.strudelTempo)) * gewicht;
    const c = Math.cos(winkel), s = Math.sin(winkel);
    aus.x = rx * c - ry * s - rx;
    aus.y = rx * s + ry * c - ry;
  }
}

function glatt(t) {
  const k = constrain(t, 0, 1);
  return k * k * (3 - 2 * k);
}
