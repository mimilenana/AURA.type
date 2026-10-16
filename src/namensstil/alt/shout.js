// ------------------------------------------------------------
// SHOUT (dunkel · hart): Der Name springt im Takt zwischen extremen
// Formen hin und her: hoch und schmal, flach und breit, riesig und
// angeschnitten. Jeder Sprung zieht eine Spur aus Echos hinter sich her
// (die Streifen beim Wechsel), die Schrift leuchtet leicht, und ab und
// zu kippt alles ins Negativ: Hintergrund und Schrift tauschen die Farbe.
//
// Dazu kommt der Glitch: in kurzen Stößen (vor allem direkt nach einem
// Sprung) wird das Bild in waagerechte Streifen zerschnitten, die
// gegeneinander verrutschen, und einzelne Pixelzeilen werden zu langen
// Balken gestreckt.
//
// Die Zahlen in SHOUT sind eure Stellschrauben.
// ------------------------------------------------------------

import { alsPfad, umriss, rgb, leinwand } from '../modi.js';
import { gitter } from '../verzerrung.js';
import { Easings } from '../../lib/easings.js';

const SHOUT = {
  takt: 0.6,            // Sekunden pro Form
  uebergang: 0.3,       // Anteil des Takts, in dem der Name in die neue Form springt
  echos: 7,             // wie viele Echos die Spur hat
  echoAbstand: 0.025,   // zeitlicher Abstand der Echos (Anteil des Takts)
  echoDeckkraft: 0.6,   // wie stark das erste Echo ist
  dehnen: 0.08,         // wie stark der Name zwischen zwei Sprüngen weiterwächst
  leuchten: 0.04,       // Glow um die Schrift (Anteil der Schriftgröße)
  negativ: 0.45,        // wie oft Hintergrund und Schrift tauschen (0 = nie, 1 = immer)

  buchstabenVersatz: 0.12, // im versetzten Layout springt jeder Buchstabe um so viele Sekunden später als der vorige
  glitchBilder: 15,     // wie oft pro Sekunde sich der Glitch ändert
  glitchNachSprung: 0.35, // so lange (Anteil des Takts) glitcht es nach jedem Sprung sicher
  glitchZwischendurch: 0.25, // Chance, dass es auch sonst kurz glitcht
  streifenDuenn: 0.01,  // dünnste Glitch-Streifen (Anteil der Schriftgröße)
  streifenDick: 0.12,   // dickste
  versatz: 0.5,         // wie weit Streifen verrutschen (Anteil der Schriftgröße)
  balken: 3,            // wie viele gestreckte Pixelzeilen-Balken höchstens
  balkenHoehe: 0.15,    // wie hoch ein Balken höchstens wird (Anteil der Schriftgröße)
};

// Die Formen, zwischen denen der Name springt: Streckung in x und y
const FORMEN = [
  { breite: 1, hoehe: 1 },        // normal
  { breite: 0.45, hoehe: 2.6 },   // hoch und schmal
  { breite: 2.6, hoehe: 0.12 },   // flach und breit
  { breite: 2.2, hoehe: 2.2 },    // riesig, angeschnitten
  { breite: 1.3, hoehe: 0.05 },   // nur noch ein Strich
  { breite: 0.25, hoehe: 1.5 },   // ganz schmal
];

export function bereite(eintrag, bereich) {
  return {
    u: eintrag.u,
    bereich,
    seed: eintrag.seed & 0xffff,
    pfad: alsPfad(eintrag.konturen, bereich),
    form: umriss(eintrag, bereich),
    // im versetzten Layout (ein Buchstabe pro Zeile) springt jeder Buchstabe für sich um seine eigene Mitte.
    // Würde das ganze Wort gestreckt, flöge fast alles aus dem Bild.
    buchstaben: eintrag.versetzt ? eintrag.buchstaben.filter(b => b.konturen.length).map(b => {
      const p = b.konturen.flat();
      const x = p.map(q => q.x - bereich.x), y = p.map(q => q.y - bereich.y);
      return {
        pfad: alsPfad(b.konturen, bereich),
        mitteX: (Math.min(...x) + Math.max(...x)) / 2, mitteY: (Math.min(...y) + Math.max(...y)) / 2,
      };
    }) : null,
    // Zwischenebene: hier wird der Name erst gezeichnet, dann zerschnitten
    ebene: leinwand(bereich.b, bereich.h),
  };
}

export function zeichne(ctx, d, zeit, farben, staerke) {
  const { bereich, form } = d;
  const schritt = Math.floor(zeit / SHOUT.takt);
  const anteil = zeit / SHOUT.takt - schritt;

  const negativ = gitter(schritt, 7, d.seed) < SHOUT.negativ;
  const schrift = negativ ? farben.hinten : farben.vorne;
  const grund = negativ ? farben.vorne : farben.hinten;

  // 1. den Name mit Echos auf die Zwischenebene zeichnen
  const e = d.ebene.getContext('2d');
  e.save();
  e.fillStyle = rgb(grund);
  e.fillRect(0, 0, bereich.b, bereich.h);

  // versetztes Layout: jeder Buchstabe einzeln, jeder etwas später; sonst das ganze Wort auf einmal
  const teile = d.buchstaben ?? [{ pfad: d.pfad, mitteX: form.mitteX, mitteY: form.mitteY, ganz: true }];
  teile.forEach((teil, nr) => {
    const eigeneZeit = zeit - nr * SHOUT.buchstabenVersatz;
    const eigenerSchritt = Math.floor(eigeneZeit / SHOUT.takt);
    const eigenerAnteil = eigeneZeit / SHOUT.takt - eigenerSchritt;
    const eigenerSeed = (d.seed + nr * 977) & 0xffff;

    // erst die Echos (nur während des Sprungs), dann die Schrift selbst
    for (let k = SHOUT.echos; k >= 0; k--) {
      const zeitpunkt = eigenerAnteil - k * SHOUT.echoAbstand;
      if (k > 0 && (zeitpunkt < 0 || zeitpunkt > SHOUT.uebergang)) continue;
      const s = streckung(eigenerSeed, eigenerSchritt, zeitpunkt, staerke);
      const deckkraft = k === 0 ? 1 : SHOUT.echoDeckkraft * (1 - k / (SHOUT.echos + 1));

      e.save();
      e.fillStyle = rgb(schrift, deckkraft);
      // nur die Schrift selbst leuchtet, die Echos nicht (das wäre zu langsam)
      if (k === 0) {
        e.shadowColor = rgb(schrift);
        e.shadowBlur = d.u * SHOUT.leuchten;
      }
      // ganzes Wort: um die Mitte des Bereichs strecken, der Name sitzt dabei in der Mitte.
      // Einzelner Buchstabe: um seine eigene Mitte, er bleibt an seinem Platz.
      const zielX = teil.ganz ? bereich.b / 2 : teil.mitteX, zielY = teil.ganz ? bereich.h / 2 : teil.mitteY;
      e.translate(zielX, zielY);
      e.scale(s.breite, s.hoehe);
      e.translate(-teil.mitteX, -teil.mitteY);
      e.fill(teil.pfad, 'nonzero');
      e.restore();
    }
  });
  e.restore();

  // 2. auf das Bild legen, dabei glitchen
  const glitchBild = Math.floor(zeit * SHOUT.glitchBilder);
  const glitcht = anteil < SHOUT.glitchNachSprung
    || gitter(glitchBild, 11, d.seed) < SHOUT.glitchZwischendurch;
  if (glitcht && staerke > 0) zeichneGlitch(ctx, d, glitchBild, grund, staerke);
  else ctx.drawImage(d.ebene, bereich.x, bereich.y);
}

// Zerschneidet die Zwischenebene in waagerechte Streifen unterschiedlicher
// Höhe; manche verrutschen zur Seite. Dazu ein paar Pixelzeilen, die zu
// hohen Balken gestreckt werden.
function zeichneGlitch(ctx, d, bild, grund, staerke) {
  const { bereich, u } = d;
  const quelle = d.ebene;
  const zufall = (a, b) => gitter(a, bild * 7 + b, d.seed);

  // nichts darf aus dem eigenen Bereich herausrutschen
  ctx.save();
  ctx.beginPath();
  ctx.rect(bereich.x, bereich.y, bereich.b, bereich.h);
  ctx.clip();

  // Grund zuerst, damit verrutschte Streifen keine Lücken hinterlassen
  ctx.fillStyle = rgb(grund);
  ctx.fillRect(bereich.x, bereich.y, bereich.b, bereich.h);

  let y = 0, nr = 0;
  while (y < bereich.h) {
    const hoehe = Math.max(1, Math.round(u * lerp(SHOUT.streifenDuenn, SHOUT.streifenDick, Math.pow(zufall(nr, 1), 2))));
    const sh = Math.min(hoehe, bereich.h - y);
    // nur ein Teil der Streifen verrutscht, die anderen bleiben stehen
    const dx = zufall(nr, 2) < 0.4 ? (zufall(nr, 3) * 2 - 1) * u * SHOUT.versatz * staerke : 0;
    ctx.drawImage(quelle, 0, y, bereich.b, sh, bereich.x + dx, bereich.y + y, bereich.b, sh);
    y += sh;
    nr++;
  }

  // gestreckte Pixelzeilen: eine Zeile wird zu einem hohen Balken
  const anzahl = Math.floor(zufall(99, 4) * (SHOUT.balken + 1));
  for (let i = 0; i < anzahl; i++) {
    const zeile = Math.floor(zufall(200 + i, 5) * bereich.h);
    const hoehe = u * SHOUT.balkenHoehe * zufall(200 + i, 6) * staerke;
    ctx.drawImage(quelle, 0, zeile, bereich.b, 1, bereich.x, bereich.y + zeile, bereich.b, hoehe);
  }
  ctx.restore();
}

// Welche Form in Takt "schritt" dran ist (nie zweimal dieselbe hintereinander)
function formIn(schritt, seed) {
  const nr = Math.floor(gitter(schritt, 1, seed) * FORMEN.length);
  const vorher = Math.floor(gitter(schritt - 1, 1, seed) * FORMEN.length);
  return FORMEN[nr === vorher ? (nr + 1) % FORMEN.length : nr];
}

// Streckung zu einem Zeitpunkt im Takt: schnell von der alten in die
// neue Form springen, dann langsam weiter dehnen
function streckung(seed, schritt, anteil, staerke) {
  const alt = formIn(schritt - 1, seed);
  const neu = formIn(schritt, seed);
  const sprung = Easings.expoOut(constrain(anteil / SHOUT.uebergang, 0, 1));
  const dehnen = 1 + SHOUT.dehnen * anteil;
  // in Potenzen mischen: von 0.1 auf 2 fühlt sich dann gleichmäßig an
  const mische = (a, b) => Math.pow(Math.exp(lerp(Math.log(a), Math.log(b), sprung)), staerke);
  return {
    breite: mische(alt.breite, neu.breite) * dehnen,
    hoehe: mische(alt.hoehe, neu.hoehe) * dehnen,
  };
}
