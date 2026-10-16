// ------------------------------------------------------------
// RENDER: zeichnet einen oder mehrere Namen zusammen auf eine Ebene.
//   - Stärke und Laufweite kommen schon aus den Konturen (stil.js)
//   - weiche Namen: verschwommen, die Unschärfe zerfällt in Körnung
//   - mittlere Namen: klar gefüllt
//   - harte Namen: Ankerpunkte werden zu Stacheln herausgezogen (stacheln.js)
// ------------------------------------------------------------

import { stachle } from './stacheln.js';
import { blurFuer, kornFuer } from './stil-alt.js';

// z: Zeichenkontext der Ebene (Auflösung 1:1 in Pixeln)
// eintraege: [{ konturen, u, strich, richtung, seed, haerte, helligkeit }]
// farbe: { r, g, b }
// macheLeinwand(breite, hoehe): liefert ein leeres Canvas-Element
// optionen.koernung: Stärke der Körnung (0 = keine, 1 = normal, 2 = viel)
export function rendere(z, eintraege, farbe, macheLeinwand, optionen = {}) {
  const koernung = optionen.koernung ?? 1;
  const b = z.canvas.width, h = z.canvas.height;
  z.save();
  z.setTransform(1, 0, 0, 1, 0, 0);
  z.clearRect(0, 0, b, h);
  z.restore();
  if (!eintraege.length) return;

  const fuellung = `rgb(${farbe.r}, ${farbe.g}, ${farbe.b})`;

  // jeder Name auf eigener Ebene, damit die Unschärfe nur ihn trifft
  for (const e of eintraege) {
    const radius = blurFuer(e.haerte, e.u);
    const korn = Math.min(1, kornFuer(e.haerte) * koernung);
    const weich = radius >= 1;
    const ziel = weich ? macheLeinwand(b, h).getContext('2d') : z;

    // hart: Ankerpunkte zu Stacheln herausziehen (bei weichen Namen unverändert)
    const konturen = stachle(z, e);

    // Füllung
    ziel.save();
    ziel.fillStyle = fuellung;
    ziel.beginPath();
    for (const k of konturen) {
      ziel.moveTo(k[0].x, k[0].y);
      for (let i = 1; i < k.length; i++) ziel.lineTo(k[i].x, k[i].y);
      ziel.closePath();
    }
    // nonzero: Überlappungen (enge Laufweite, variable Fonts) bleiben gefüllt
    ziel.fill('nonzero');
    ziel.restore();

    // weich: verwischen, körnen, auf die Ebene legen
    if (weich) {
      verwische(ziel, radius, korn, e.seed);
      z.drawImage(ziel.canvas, 0, 0);
    }
  }
}

// Weichzeichner: dreimal Kasten-Blur ≈ Gaußscher Blur. Danach Körnung:
// halbtransparente Pixel werden zufällig ganz an oder ganz aus – wie
// Sprühfarbe oder Tinte auf rauem Papier.
function verwische(z, radius, korn = 0, seed = 0) {
  const b = z.canvas.width, h = z.canvas.height;
  const bild = z.getImageData(0, 0, b, h);
  const d = bild.data;
  const n = b * h;
  const a = new Float32Array(n), hilfe = new Float32Array(n);
  let farbe = null;
  for (let i = 0; i < n; i++) {
    a[i] = d[i * 4 + 3];
    if (!farbe && a[i] > 200) farbe = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
  }
  if (!farbe) return;

  const r = Math.max(1, Math.round(radius / 1.7));
  for (let pass = 0; pass < 3; pass++) kastenBlur(a, hilfe, b, h, r);

  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < b; x++, i++) {
      const o = i * 4;
      d[o] = farbe[0]; d[o + 1] = farbe[1]; d[o + 2] = farbe[2];
      // Kern verstärken, damit der Name lesbar bleibt
      let wert = Math.min(1, (a[i] / 255) * (1.25 + 0.45 * korn));
      if (korn > 0 && wert > 0.002 && wert < 0.998) {
        const punkt = wert > kornWert(x, y, seed) ? 1 : 0;
        wert = wert * (1 - korn) + punkt * korn;
      }
      d[o + 3] = wert * 255;
    }
  }
  z.putImageData(bild, 0, 0);
}

function kastenBlur(quelle, ziel, b, h, r) {
  const fenster = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const zeile = y * b;
    let summe = 0;
    for (let x = -r; x <= r; x++) summe += quelle[zeile + Math.min(b - 1, Math.max(0, x))];
    for (let x = 0; x < b; x++) {
      ziel[zeile + x] = summe / fenster;
      summe += quelle[zeile + Math.min(b - 1, x + r + 1)] - quelle[zeile + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < b; x++) {
    let summe = 0;
    for (let y = -r; y <= r; y++) summe += ziel[Math.min(h - 1, Math.max(0, y)) * b + x];
    for (let y = 0; y < h; y++) {
      quelle[y * b + x] = summe / fenster;
      summe += ziel[Math.min(h - 1, y + r + 1) * b + x] - ziel[Math.max(0, y - r) * b + x];
    }
  }
}

// fester Zufallswert pro Pixel (gleiche Körnung bei jedem Bild)
function kornWert(x, y, s) {
  let k = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s & 0xffff, 1442695041);
  k = Math.imul(k ^ (k >>> 13), 1274126177);
  return ((k ^ (k >>> 16)) >>> 0) / 4294967296;
}
