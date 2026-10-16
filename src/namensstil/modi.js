// ------------------------------------------------------------
// MODI: Jeder Name landet in genau einem von vier Modi. Es gibt keine
// Zwischenstufen: die Analyse sagt nur, auf welcher Seite der Mitte
// ein Name liegt.
//
//                 weich                  hart
//   hell      Bänder (baender.js)     Quadrate (quadrate.js)
//   dunkel    Thermo (thermo.js)      Stacheldraht (stacheldraht.js)
//
// Jeder Modus hat zwei Funktionen:
//   bereite(eintrag, bereich)  einmal, wenn sich der Name ändert
//   zeichne(ctx, vorbereitet, zeit, farben, staerke)  jedes Bild
// zeichne() hängt nur von der Zeit ab. Deshalb kann dasselbe Bild auch
// für Plakat und Archiv noch einmal in groß gerechnet werden.
// ------------------------------------------------------------

import * as baender from './baender.js';
import * as quadrate from './quadrate.js';
import * as thermo from './thermo.js';
import * as stacheldraht from './stacheldraht.js';

export const MODI = ['hell · weich', 'hell · hart', 'dunkel · weich', 'dunkel · hart'];

const ARTEN = {
  'hell · weich': baender,
  'hell · hart': quadrate,
  'dunkel · weich': thermo,
  'dunkel · hart': stacheldraht,
};

// die Mitte (0.5) trennt die Seiten
const GRENZE = 0.5;

export function modusFuer(haerte, helligkeit) {
  const hell = helligkeit >= GRENZE ? 'hell' : 'dunkel';
  const hart = haerte >= GRENZE ? 'hart' : 'weich';
  return `${hell} · ${hart}`;
}

// eintrag: ein gesetzter Name { konturen, boxen, u, seed, ... }
// bereich: das Rechteck, in dem der Name animiert wird { x, y, b, h }
export function bereiteModus(modus, eintrag, bereich) {
  return { modus, daten: ARTEN[modus].bereite(eintrag, bereich) };
}

// farben: { vorne, hinten } als { r, g, b }
export function zeichneModus(ctx, vorbereitet, zeit, farben, staerke) {
  ARTEN[vorbereitet.modus].zeichne(ctx, vorbereitet.daten, zeit, farben, staerke);
}

// Bereiche für mehrere Zeilen: jede Zeile bekommt einen waagerechten
// Streifen, getrennt in der Mitte zwischen zwei Zeilen
export function bereicheFuer(eintraege, breite, hoehe) {
  const mitten = eintraege.map(e => {
    const y0 = Math.min(...e.boxen.map(bx => bx.y0));
    const y1 = Math.max(...e.boxen.map(bx => bx.y1));
    return (y0 + y1) / 2;
  });
  return eintraege.map((e, i) => {
    const oben = i === 0 ? 0 : Math.round((mitten[i - 1] + mitten[i]) / 2);
    const unten = i === eintraege.length - 1 ? hoehe : Math.round((mitten[i] + mitten[i + 1]) / 2);
    return { x: 0, y: oben, b: breite, h: unten - oben };
  });
}

// Gemeinsame Helfer für die Modi

export function leinwand(b, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(b));
  c.height = Math.max(1, Math.round(h));
  c.getContext('2d', { willReadFrequently: true });
  return c;
}

// Die Buchstaben als Pfad, verschoben in den Bereich (links oben = 0, 0)
// und auf Wunsch verkleinert
export function alsPfad(konturen, bereich, skala = 1) {
  const pfad = new Path2D();
  for (const k of konturen) {
    pfad.moveTo((k[0].x - bereich.x) * skala, (k[0].y - bereich.y) * skala);
    for (let i = 1; i < k.length; i++) pfad.lineTo((k[i].x - bereich.x) * skala, (k[i].y - bereich.y) * skala);
    pfad.closePath();
  }
  return pfad;
}

// Mitte und Größe des Namens innerhalb des Bereichs
export function umriss(eintrag, bereich) {
  const x0 = Math.min(...eintrag.boxen.map(bx => bx.x0)) - bereich.x;
  const x1 = Math.max(...eintrag.boxen.map(bx => bx.x1)) - bereich.x;
  const y0 = Math.min(...eintrag.boxen.map(bx => bx.y0)) - bereich.y;
  const y1 = Math.max(...eintrag.boxen.map(bx => bx.y1)) - bereich.y;
  return { x0, x1, y0, y1, mitteX: (x0 + x1) / 2, mitteY: (y0 + y1) / 2, b: x1 - x0, h: y1 - y0 };
}

export const rgb = (farbe, alpha = 1) => `rgba(${farbe.r}, ${farbe.g}, ${farbe.b}, ${alpha})`;
