// ------------------------------------------------------------
// KRITZEL: die harte Version. Der Name wird nur als dünne, zittrige
// Konturlinie gezeichnet, grob abgetastet, jeder Punkt etwas versetzt
// und doppelt nachgezogen, wie eine schnelle Skizze.
//
//   je härter -> mehr Zittern, gröbere Ecken, die Füllung verschwindet
//
// Alle Zahlen mit "u *" sind relativ zur Schriftgröße (u = 1 Geviert).
// Das sind eure gestalterischen Stellschrauben.
// ------------------------------------------------------------

import { neuAbtasten, gitter } from '../verzerrung.js';

const begrenze = (x, a, b) => Math.max(a, Math.min(b, x));
const glatt = (a, b, x) => { const t = begrenze((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Wie stark die Kritzel-Version bei dieser Härte ist (0 = keine, 1 = voll)
export function kritzelStaerke(haerte) {
  return glatt(0.55, 0.9, haerte);
}

// Wie oft pro Sekunde die Linie neu gezittert wird ("kochen")
export const KOCH_RATE = 8;

// Zittrige Version einer Kontur. bild = Nummer des Koch-Schritts,
// durchgang = 0 oder 1 (zweiter, leicht versetzter Strich)
function zittere(k, st, u, seed, bild, durchgang, nr) {
  // grob abtasten: je härter, desto gröbere Ecken
  const p = neuAbtasten(k, u * (0.018 + 0.02 * st));
  const amp = u * (0.008 + 0.022 * st);
  return p.map((q, i) => {
    const a = gitter(i + nr * 9973, bild * 31 + durchgang * 7, seed & 0xffff) * 2 - 1;
    const b = gitter(i + nr * 9973, bild * 31 + durchgang * 7 + 3, (seed >> 4) & 0xffff) * 2 - 1;
    return { x: q.x + a * amp, y: q.y + b * amp };
  });
}

// Zeichnet die Kritzel-Kontur. t = Zeit in Sekunden (für das Kochen)
export function zeichneKritzel(z, e, farbe, t = 0) {
  const st = kritzelStaerke(e.haerte);
  if (st < 0.02) return;
  const bild = Math.floor(t * KOCH_RATE);
  // Linienstärke: folgt etwas der Schriftstärke, bleibt aber dünn
  const linie = Math.max(1, u(e) * 0.006 + e.strich * 0.05);

  z.save();
  z.strokeStyle = `rgb(${farbe.r}, ${farbe.g}, ${farbe.b})`;
  z.lineJoin = 'round';
  z.lineCap = 'round';
  // zwei Durchgänge: kräftiger Strich + zarter zweiter Strich daneben
  [[0, 1, 1], [1, 0.45, 0.7]].forEach(([durchgang, alpha, breite]) => {
    z.globalAlpha = alpha * st;
    z.lineWidth = linie * breite;
    z.beginPath();
    e.konturen.forEach((k, nr) => {
      const p = zittere(k, st, u(e), e.seed, bild, durchgang, nr);
      z.moveTo(p[0].x, p[0].y);
      for (let i = 1; i < p.length; i++) z.lineTo(p[i].x, p[i].y);
      z.closePath();
    });
    z.stroke();
  });
  z.restore();
}

const u = e => e.u;
