// ------------------------------------------------------------
// PARTIKEL (hell · weich): Die Schrift besteht aus dicht gepackten,
// runden, deckenden Punkten, wie ein gepunktetes Plakat. Nichts steht
// still, und von Zeit zu Zeit verhält sich der Name wie ein Schwarm.
// Es laufen immer zwei Ereignisse versetzt nebeneinander:
//
//   TAUSCH    zwei Gruppen von Punkten lösen sich aus dem Buchstaben,
//             strömen als dünne Kette (wie ein Faden) zum Ort der anderen
//             Gruppe und tauschen dort den Platz. Die Punkte folgen
//             einander, einer nach dem anderen. Danach wandern sie zurück.
//   ZERFALL   eine Gruppe fällt auseinander, treibt als Schwarm in eine
//             Richtung und sammelt sich wieder.
//
// Die Bewegung hängt nur von der Zeit ab (nichts wird gemerkt), deshalb
// sieht das Plakat- und Archivbild bei jeder Zeit gleich aus.
//
// Die Zahlen in PARTIKEL sind eure Stellschrauben.
// ------------------------------------------------------------

import { leinwand, alsPfad, rgb } from '../modi.js';
import { gitter } from '../verzerrung.js';

const PARTIKEL = {
  abstand: 0.0125,       // Abstand der Punkte im Buchstaben (Anteil der Schriftgröße); kleiner = mehr Punkte
  groesse: 0.62,         // Punktgröße (Anteil des Abstands): über 0.5 berühren sich die Punkte
  groesseSchwankung: 0.2, // wie unterschiedlich groß die Punkte sind
  streuner: 0.07,        // Anteil einzelner Punkte, die neben den Buchstaben schwirren
  streunerWeite: 0.05,   // wie weit sie neben dem Buchstaben sitzen (Anteil der Schriftgröße)

  takt: 7,               // Sekunden pro Ereignis
  tauschAnteil: 0.6,     // wie oft es ein Tausch ist (sonst Zerfall)
  gruppe: 0.5,           // Größe der Gruppen (Anteil der Schriftgröße, Radius)
  fadenAbstand: 0.9,     // so weit (in Schriftgrößen) liegen die zwei Gruppen mindestens auseinander
  verzoegerung: 0.25,    // wie weit die Punkte einer Gruppe zeitlich auseinandergezogen sind: das ist die Kette
  fadenDuenn: 0.94,      // wie eng der Faden wird (1 = ein Punkt breit)
  bogen: 0.5,            // wie stark der Faden schwingt (in Schriftgrößen)
  zerfallWeite: 0.9,     // wie weit der Schwarm beim Zerfall treibt (in Schriftgrößen)
  wirbel: 0.8,           // wie stark der Schwarm beim Zerfall verwirbelt
  schwirren: 0.0035,     // Schwirren der Punkte an ihrem Platz (Anteil der Schriftgröße)
  schwirrTempo: 2.2,     // wie schnell sie schwirren
};

export function bereite(eintrag, bereich) {
  const u = eintrag.u;
  const seed = eintrag.seed & 0xffff;
  const abstand = Math.max(2, u * PARTIKEL.abstand);

  // Schrift als Maske zeichnen, damit wir wissen, wo Punkte hingehören
  const maske = leinwand(bereich.b, bereich.h);
  const mc = maske.getContext('2d');
  mc.fillStyle = '#fff';
  mc.fill(alsPfad(eintrag.konturen, bereich), 'nonzero');
  const alpha = mc.getImageData(0, 0, maske.width, maske.height).data;
  const innen = (x, y) => {
    const px = Math.floor(x), py = Math.floor(y);
    if (px < 0 || py < 0 || px >= maske.width || py >= maske.height) return false;
    return alpha[(py * maske.width + px) * 4 + 3] > 127;
  };

  // Punkte auf einem leicht verwackelten Raster: dicht, aber nicht wie ein Gitter
  const xs = [], ys = [], radien = [], zufaelle = [], streunerEntfernung = [];
  let nr = 0;
  for (let y = 0; y < maske.height; y += abstand) {
    for (let x = 0; x < maske.width; x += abstand) {
      nr++;
      const zufall = (m) => gitter(nr, m, seed);
      let px = x + (zufall(1) - 0.5) * abstand * 0.8;
      let py = y + (zufall(2) - 0.5) * abstand * 0.8;
      if (!innen(px, py)) continue;
      // Streuner: sitzt etwas neben dem Buchstaben
      if (zufall(3) < PARTIKEL.streuner) {
        const w = zufall(4) * TWO_PI, r = Math.sqrt(zufall(5)) * u * PARTIKEL.streunerWeite;
        px += Math.cos(w) * r;
        py += Math.sin(w) * r;
      }
      xs.push(px); ys.push(py);
      radien.push(abstand * PARTIKEL.groesse * (1 + (zufall(6) * 2 - 1) * PARTIKEL.groesseSchwankung));
      zufaelle.push(zufall(7), zufall(8));
    }
  }

  const n = xs.length;
  return {
    u, bereich, seed, n,
    x: Float32Array.from(xs), y: Float32Array.from(ys), radius: Float32Array.from(radien),
    // pro Punkt zwei feste Zufallswerte: Verzögerung in der Kette, Phase beim Schwirren
    zufall: Float32Array.from(zufaelle),
    ereignisse: new Map(),
  };
}

export function zeichne(ctx, d, zeit, farben, staerke) {
  const { u, n } = d;
  const pfad = new Path2D();
  const schwirren = u * PARTIKEL.schwirren;

  // die zwei Ereignisse, die gerade laufen (um einen halben Takt versetzt)
  const laufend = [0, 1].map((spur) => {
    const t = zeit / PARTIKEL.takt + spur * 0.5;
    const nummer = Math.floor(t);
    return { ereignis: holeEreignis(d, spur, nummer), anteil: t - nummer };
  });

  for (let i = 0; i < n; i++) {
    const hx = d.x[i], hy = d.y[i];
    const verzoegerung = d.zufall[i * 2] * PARTIKEL.verzoegerung;

    let x = hx, y = hy;
    for (const { ereignis, anteil } of laufend) {
      const rolle = ereignis.rolle[i];
      if (rolle === 0) continue;
      const versatz = ereignis.art === 'tausch'
        ? versatzTausch(d, ereignis, rolle, hx, hy, anteil, verzoegerung, staerke)
        : versatzZerfall(d, ereignis, i, hx, hy, anteil, verzoegerung, staerke);
      x += versatz.x;
      y += versatz.y;
    }

    // schwirren: jeder Punkt kreist ein winziges Stück um seinen Platz
    const winkel = d.zufall[i * 2 + 1] * TWO_PI + zeit * PARTIKEL.schwirrTempo * (0.6 + d.zufall[i * 2]);
    x += Math.cos(winkel) * schwirren;
    y += Math.sin(winkel) * schwirren;

    const r = d.radius[i];
    pfad.moveTo(x + r, y);
    pfad.arc(x, y, r, 0, TWO_PI);
  }

  ctx.save();
  ctx.translate(d.bereich.x, d.bereich.y);
  ctx.fillStyle = rgb(farben.vorne);
  ctx.fill(pfad);
  ctx.restore();
}

// Ein Ereignis (Tausch oder Zerfall) wird einmal ausgewürfelt und gemerkt.
// Dieselbe Nummer ergibt immer dasselbe Ereignis.
function holeEreignis(d, spur, nummer) {
  const schluessel = nummer * 2 + spur;
  if (d.ereignisse.has(schluessel)) return d.ereignisse.get(schluessel);
  // alte Ereignisse vergessen
  for (const k of d.ereignisse.keys()) if (k < schluessel - 8) d.ereignisse.delete(k);

  const u = d.u;
  const zufall = (m) => gitter(nummer * 7 + spur * 131 + m, 5, d.seed);
  const art = zufall(1) < PARTIKEL.tauschAnteil ? 'tausch' : 'zerfall';

  // Mittelpunkt der ersten Gruppe: der Ort eines zufälligen Punktes
  const a = punktNr(d, Math.floor(zufall(2) * d.n));
  let b = a;
  if (art === 'tausch') {
    // zweite Gruppe: ein Punkt, der weit genug weg ist (nach ein paar Versuchen reicht der beste)
    let bester = -1;
    for (let versuch = 0; versuch < 12; versuch++) {
      const k = punktNr(d, Math.floor(zufall(10 + versuch) * d.n));
      const weite = Math.hypot(k.x - a.x, k.y - a.y);
      if (weite > bester) { bester = weite; b = k; }
      if (weite > u * PARTIKEL.fadenAbstand) break;
    }
  }
  const radius = u * PARTIKEL.gruppe * (art === 'tausch' ? 0.6 + 0.4 * zufall(3) : 0.8 + 0.4 * zufall(3));

  // wer gehört zu welcher Gruppe? 1 = Gruppe A, 2 = Gruppe B, 0 = keine
  const rolle = new Uint8Array(d.n);
  for (let i = 0; i < d.n; i++) {
    const weich = 0.85 + 0.3 * d.zufall[i * 2 + 1];   // unscharfe Kante der Gruppe
    if (Math.hypot(d.x[i] - a.x, d.y[i] - a.y) < radius * weich) rolle[i] = 1;
    else if (art === 'tausch' && Math.hypot(d.x[i] - b.x, d.y[i] - b.y) < radius * weich) rolle[i] = 2;
  }

  const ereignis = {
    art, a, b, rolle, radius,
    versatz: { x: b.x - a.x, y: b.y - a.y },
    bogen1: (zufall(4) * 2 - 1) * u * PARTIKEL.bogen,
    bogen2: (zufall(5) * 2 - 1) * u * PARTIKEL.bogen * 0.5,
    richtung: zufall(6) * TWO_PI,
    nummer,
  };
  d.ereignisse.set(schluessel, ereignis);
  return ereignis;
}

function punktNr(d, i) {
  return { x: d.x[i], y: d.y[i] };
}

// Wie weit ein Punkt auf seinem Weg ist: 0 = zuhause, 1 = am Ziel.
// Erst hin, ein Moment Pause, dann zurück. Jeder Punkt startet etwas
// später als der vorige (verzoegerung): so entsteht die Kette.
function fortschritt(anteil, verzoegerung) {
  const hin = glatt((anteil - 0.04 - verzoegerung) / 0.28);
  const zurueck = glatt((anteil - 0.55 - verzoegerung) / 0.2);
  return hin - zurueck;
}

function glatt(t) {
  const k = constrain(t, 0, 1);
  return k * k * (3 - 2 * k);
}

// Tausch: Gruppe A fliegt nach B, Gruppe B nach A. Auf dem Weg werden
// die Punkte einer Gruppe zu einem dünnen, geschwungenen Faden zusammengezogen.
function versatzTausch(d, e, rolle, hx, hy, anteil, verzoegerung, staerke) {
  const e1 = fortschritt(anteil, verzoegerung) * Math.min(1, staerke);
  if (e1 <= 0) return { x: 0, y: 0 };

  const von = rolle === 1 ? e.a : e.b;
  const dx = rolle === 1 ? e.versatz.x : -e.versatz.x;
  const dy = rolle === 1 ? e.versatz.y : -e.versatz.y;
  // die beiden Fäden schwingen in entgegengesetzte Richtung, sie kreuzen sich nicht
  const seite = rolle === 1 ? 1 : -1;

  // Mittellinie des Fadens: gerade Linie plus Schwung quer dazu
  const laenge = Math.hypot(dx, dy) || 1;
  const querX = -dy / laenge, querY = dx / laenge;
  const schwung = (e.bogen1 * Math.sin(Math.PI * e1) + e.bogen2 * Math.sin(2 * Math.PI * e1)) * seite;
  const mitteX = von.x + dx * e1 + querX * schwung;
  const mitteY = von.y + dy * e1 + querY * schwung;

  // Abstand des Punktes zur Mitte seiner Gruppe: in der Fadenmitte fast null
  const eng = 1 - PARTIKEL.fadenDuenn * Math.pow(Math.sin(Math.PI * e1), 1.5);
  const zielX = mitteX + (hx - von.x) * eng;
  const zielY = mitteY + (hy - von.y) * eng;
  return { x: zielX - hx, y: zielY - hy };
}

// Zerfall: die Gruppe löst sich auf und treibt als Schwarm davon. Nachbarn
// werden vom selben Wirbel mitgenommen, deshalb bleiben sie ein Schwarm.
function versatzZerfall(d, e, i, hx, hy, anteil, verzoegerung, staerke) {
  const e1 = fortschritt(anteil, verzoegerung) * Math.min(1, staerke);
  if (e1 <= 0) return { x: 0, y: 0 };

  const u = d.u;
  const feld = 1 / (u * 0.5);
  const t = anteil * 3 + e.nummer * 11;
  // Wirbel: ein weiches Rauschfeld, das sich langsam dreht
  const wirbelX = noise(hx * feld, hy * feld, t) - 0.5;
  const wirbelY = noise(hx * feld + 90, hy * feld, t) - 0.5;
  // dazu die allgemeine Richtung des Schwarms und ein Stück nach außen
  const weg = u * PARTIKEL.zerfallWeite * (0.5 + d.zufall[i * 2]);
  const aussenX = (hx - e.a.x) / e.radius, aussenY = (hy - e.a.y) / e.radius;
  const vx = Math.cos(e.richtung) * 0.6 + aussenX * 0.5 + wirbelX * 2 * PARTIKEL.wirbel;
  const vy = Math.sin(e.richtung) * 0.6 + aussenY * 0.5 + wirbelY * 2 * PARTIKEL.wirbel;
  return { x: vx * weg * e1, y: vy * weg * e1 };
}
