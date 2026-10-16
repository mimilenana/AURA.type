// ------------------------------------------------------------
// QUADRATE (hell · hart): Der Name wird in ein Raster aus Quadraten
// zerlegt, wie ein grob gepixelter Buchstabe. Zwei Ebenen:
//   hinten  Quadrate in Schriftfarbe (und ein paar kleine Schachbrett-Pixel),
//           etwas nach rechts unten versetzt: sie wirken wie die
//           Schattenseite des Buchstabens
//   vorne   Quadrate in Hintergrundfarbe mit Kontur in Schriftfarbe, die die Vorderseite des
//           Buchstabens bilden. Sie lösen sich und springen durcheinander;
//           benachbarte bewegen sich ähnlich (wie eine verrutschte Ebene),
//           jedes zappelt dazu noch einzeln.
// Die Farben kommen vom Farbmodus (farben.js): vorne ist die Farbe der Schrift
// und der Kontur, hinten der Hintergrund (Kontur-Quadrate sind damit gefüllt).
// Die Bewegung ruckelt bewusst in wenigen Bildern pro Sekunde und rastet
// auf einem feinen Raster ein, damit es pixelig und hart wirkt.
//
// Die Zahlen in QUADRATE sind eure Stellschrauben.
// ------------------------------------------------------------

import { leinwand, alsPfad, rgb } from './modi.js';
import { gitter } from './verzerrung.js';

const QUADRATE = {
  raster: 0.032,         // Größe eines Quadrats (Anteil der Schriftgröße)
  fuellung: 0.5,         // Mindestanteil Schrift in einer Zelle, damit dort ein Quadrat entsteht
  anteilKlein: 0.12,     // so viele Zellen sind kleine Schachbrett-Pixel statt gefüllt
  anteilLeer: 0.06,      // so viele Zellen bleiben ganz leer (Löcher im Buchstaben)
  anteilKontur: 0.9,     // für so viele Zellen gibt es vorne ein Kontur-Quadrat
  schattenX: 1,          // wie weit der Schatten nach rechts versetzt ist (in Quadraten)
  schattenY: 1,          // wie weit nach unten
  konturGroesser: 1.15,  // Kontur-Quadrate sind etwas größer als die Zelle
  linie: 0.006,          // Stärke der Kontur (Anteil der Schriftgröße)
  weite: 0.7,            // wie weit sich Kontur-Quadrate lösen (in Schriftgrößen)
  vollWeite: 0.2,        // gefüllte Quadrate lösen sich weniger weit (Anteil von "weite")
  immer: 0.05,           // so viel sind Kontur-Quadrate immer verrutscht, auch in ruhigen Zonen
  zappeln: 0.3,          // wie viel jedes Quadrat einzeln zappelt (Anteil von "weite")
  loesenAnteil: 0.45,    // wie viel vom Namen gerade zerfällt
  zonenGroesse: 1.2,     // wie groß die zerfallenden Zonen sind (in Schriftgrößen)
  tempo: 0.3,            // wie schnell die Zonen wandern
  bilderProSekunde: 10,  // die Bewegung ruckelt in so vielen Bildern pro Sekunde
  einrasten: 0.5,        // Quadrate rasten auf diesem Bruchteil des Rasters ein
};


export function bereite(eintrag, bereich) {
  const u = eintrag.u;
  const seed = eintrag.seed & 0xffff;
  const raster = Math.max(4, Math.round(u * QUADRATE.raster));

  // Schrift als Maske zeichnen und für jede Rasterzelle zählen, wie viel davon Schrift ist
  const maske = leinwand(bereich.b, bereich.h);
  const mc = maske.getContext('2d');
  mc.fillStyle = '#fff';
  mc.fill(alsPfad(eintrag.konturen, bereich), 'nonzero');
  const alpha = mc.getImageData(0, 0, maske.width, maske.height).data;
  const stichproben = 4;

  const quadrate = [];
  let nr = 0;
  for (let y = 0; y < maske.height; y += raster) {
    for (let x = 0; x < maske.width; x += raster) {
      // ein paar Stichproben in der Zelle
      let treffer = 0;
      for (let sy = 0; sy < stichproben; sy++) {
        for (let sx = 0; sx < stichproben; sx++) {
          const px = Math.min(maske.width - 1, Math.floor(x + (sx + 0.5) * raster / stichproben));
          const py = Math.min(maske.height - 1, Math.floor(y + (sy + 0.5) * raster / stichproben));
          if (alpha[(py * maske.width + px) * 4 + 3] > 127) treffer++;
        }
      }
      if (treffer / (stichproben * stichproben) < QUADRATE.fuellung) continue;

      nr++;
      const zufall = (m) => gitter(nr, m, seed);
      // hinten: schwarz, klein oder leer
      const wahl = zufall(1);
      if (wahl >= QUADRATE.anteilLeer) {
        const sorte = wahl < QUADRATE.anteilLeer + QUADRATE.anteilKlein ? 'klein' : 'voll';
        quadrate.push({ x, y, sorte, bahn: zufall(2) * 1000 });
      }
      // vorne: ein Kontur-Quadrat, das sich löst
      if (zufall(3) < QUADRATE.anteilKontur) quadrate.push({ x, y, sorte: 'kontur', bahn: zufall(4) * 1000 });
    }
  }

  // Reihenfolge beim Zeichnen: schwarze hinten, Kontur-Quadrate vorne
  const reihenfolge = { voll: 0, klein: 1, kontur: 2 };
  quadrate.sort((a, b) => reihenfolge[a.sorte] - reihenfolge[b.sorte]);

  return { u, bereich, raster, quadrate };
}

export function zeichne(ctx, d, zeit, farben, staerke) {
  const { u, raster } = d;
  // die Zeit springt in groben Schritten -> ruckelige, harte Bewegung
  const t = Math.floor(zeit * QUADRATE.bilderProSekunde) / QUADRATE.bilderProSekunde;
  const zone = 1 / (u * QUADRATE.zonenGroesse);
  const weite = u * QUADRATE.weite * staerke;
  const schritt = Math.max(1, raster * QUADRATE.einrasten);
  const schwelle = 1 - QUADRATE.loesenAnteil;
  const halbeKante = 0.1;

  ctx.save();
  ctx.fillStyle = rgb(farben.hinten);
  ctx.fillRect(d.bereich.x, d.bereich.y, d.bereich.b, d.bereich.h);
  ctx.translate(d.bereich.x, d.bereich.y);
  ctx.lineWidth = Math.max(1, u * QUADRATE.linie);
  ctx.strokeStyle = rgb(farben.vorne);
  const schattenX = raster * QUADRATE.schattenX, schattenY = raster * QUADRATE.schattenY;

  for (const q of d.quadrate) {
    // wie sehr hat sich dieses Quadrat gerade gelöst? (0 = an seinem Platz)
    const n = noise(q.x * zone, q.y * zone, t * QUADRATE.tempo);
    const loesen = constrain(map(n, schwelle - halbeKante, schwelle + halbeKante, 0, 1), 0, 1);

    const kontur = q.sorte === 'kontur';
    const wie = kontur ? QUADRATE.immer + (1 - QUADRATE.immer) * loesen : QUADRATE.vollWeite * loesen;
    // die schwarzen sitzen versetzt hinter der Vorderseite: Schatten
    let x = kontur ? q.x : q.x + schattenX;
    let y = kontur ? q.y : q.y + schattenY;
    if (wie > 0) {
      // gemeinsame Bewegung der Nachbarschaft (wie eine verrutschte Ebene) ...
      const gx = noise(q.x * zone * 0.8 + 300, q.y * zone * 0.8, t * QUADRATE.tempo) - 0.5;
      const gy = noise(q.x * zone * 0.8, q.y * zone * 0.8 + 300, t * QUADRATE.tempo) - 0.5;
      // ... plus eigenes Zappeln auf einer eigenen Bahn
      const ex = noise(q.bahn, t) - 0.5;
      const ey = noise(q.bahn + 70, t) - 0.5;
      const dx = (gx + ex * QUADRATE.zappeln) * 2 * weite * wie;
      const dy = (gy + ey * QUADRATE.zappeln) * 2 * weite * wie;
      // auf dem feinen Raster einrasten -> bleibt pixelig
      x += Math.round(dx / schritt) * schritt;
      y += Math.round(dy / schritt) * schritt;
    }

    if (q.sorte === 'voll') {
      ctx.fillStyle = rgb(farben.vorne);
      ctx.fillRect(x, y, raster, raster);
    } else if (q.sorte === 'klein') {
      const k = raster / 2;
      ctx.fillStyle = rgb(farben.vorne);
      ctx.fillRect(x, y, k, k);
      ctx.fillRect(x + k, y + k, k, k);
    } else {
      const s = raster * QUADRATE.konturGroesser;
      const versatz = (s - raster) / 2;
      ctx.fillStyle = rgb(farben.hinten);
      ctx.fillRect(x - versatz, y - versatz, s, s);
      ctx.strokeRect(x - versatz, y - versatz, s, s);
    }
  }
  ctx.restore();
}
