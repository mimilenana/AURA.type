// ------------------------------------------------------------
// ANIMATION (Schritt 2): Das fertige Bild aus Schritt 1 wird bewegt –
// je nach Klang des Namens.
//
//   DUNKEL -> GLITCH im "Choppy Type"-Stil: Buchstaben werden in dünne
//             Streifen geschnitten, die treppenartig gegeneinander rutschen.
//             Drei Arten, die sich pro Buchstabe abwechseln:
//               waagerecht  Streifen rutschen nach links/rechts
//               senkrecht   Spalten rutschen nach oben/unten (Treppen-Diagonalen)
//               Schmieren   Streifen werden zur Seite lang gezogen
//             Ein Teil der Buchstaben bleibt dabei ganz sauber – der Kontrast
//             von sauber und zerhackt macht den Stil aus.
//   HELL   -> FELD (feld.js): Spur, Konturbänder, Körnung.
//   HÄRTE  -> hart = dünne Streifen, ruckelige Bilder, schnelle Wechsel;
//             weich = breitere Streifen, fließende Welle.
//
// Die Zahlen in GLITCH sind eure Stellschrauben.
// ------------------------------------------------------------

import { gitter } from '../verzerrung.js';

const begrenze = (x, a, b) => Math.max(a, Math.min(b, x));
const glatt = (a, b, x) => { const t = begrenze((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const GLITCH = {
  dauerHart: 0.5,          // Sekunden, bis ein Buchstabe eine neue Art bekommt (hart)
  dauerWeich: 1.6,         // dasselbe für weiche Namen
  bilderProSekundeHart: 8, // hart: die Bewegung ruckelt in wenigen Einzelbildern
  bilderProSekundeWeich: 30,
  streifenDuennHart: 0.012,  // Streifendicke als Anteil der Schriftgröße (hart = dünn)
  streifenDickWeich: 0.04,   // weich = dicker
  ausschlag: 0.35,         // wie weit Streifen rutschen, als Anteil der Schriftgröße
  wellen: 1.5,             // wie viele Wellen über einen Buchstaben laufen
  wellenTempo: 0.6,        // wie schnell die Welle durch den Buchstaben läuft
  stufen: 5,               // in wie viele Stufen der Ausschlag springt (Treppe)
  schmierLaenge: 1.8,      // wie lang Schmier-Streifen gezogen werden
  sauberAnteil: 0.35,      // so viele Buchstaben bleiben sauber (bei Stärke 1)
};

const ARTEN = ['waagerecht', 'senkrecht', 'schmieren'];

// (nicht mehr benutzt) Anteile hell/dunkel
export function anteile(helligkeit) {
  return {
    rupture: glatt(0.6, 0.05, helligkeit),    // dunkel
    dissolve: glatt(0.4, 0.95, helligkeit),   // hell
  };
}

function leinwand(b, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(b));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}
// erlaubt das Testen außerhalb des Browsers
let macheLeinwand = leinwand;
export function setzeLeinwand(f) { macheLeinwand = f; }


// ---------- Vorbereitung (einmal, wenn sich das Bild ändert) ----------

// quelle: Canvas mit dem fertigen Bild aus Schritt 1
// boxen: Umrisse der Buchstaben [{x0, y0, x1, y1}] in Pixeln
// u: Schriftgröße (Geviert), seed: Fingerabdruck, farbe: Schriftfarbe
export function bereiteVor(quelle, boxen, u, seed, farbe) {
  const b = quelle.width, h = quelle.height;

  // Die ganze Fläche wird in senkrechte Spalten geteilt, eine pro Buchstabe,
  // getrennt in der Mitte zwischen zwei Buchstaben. Volle Höhe und bis zum
  // Rand, damit lange Stacheln nicht abgeschnitten werden.
  const sortiert = [...boxen].sort((a, c) => (a.x0 + a.x1) - (c.x0 + c.x1));
  const buchstaben = sortiert.map((bx, i) => {
    const x0 = i > 0 ? Math.floor((sortiert[i - 1].x1 + bx.x0) / 2) : 0;
    const x1 = i < sortiert.length - 1 ? Math.floor((bx.x1 + sortiert[i + 1].x0) / 2) : b;
    const w = x1 - x0;
    if (w < 2) return null;

    // Ausschnitt der Spalte, aus dem später die Streifen geschnitten werden
    const normal = macheLeinwand(w, h);
    normal.getContext('2d').drawImage(quelle, x0, 0, w, h, 0, 0, w, h);
    // kern: wo der Buchstabe selbst steht -> dort spielt sich die Welle ab
    return { x0, y0: 0, w, h, normal, kern: { x0: bx.x0 - x0, y0: bx.y0, w: bx.x1 - bx.x0, h: bx.y1 - bx.y0 } };
  }).filter(Boolean);

  return { buchstaben, u, seed };
}


// ---------- Zeichnen (jedes Bild) ----------

export function zeichneAnimiert(ctx, quelle, z, t, haerte, staerke) {
  if (!z) { ctx.drawImage(quelle, 0, 0); return; }
  zeichneGlitch(ctx, quelle, z, t, haerte, staerke);
}


// ---------- Choppy Glitch: Streifen pro Buchstabe ----------

function zeichneGlitch(ctx, quelle, z, t, haerte, staerke) {
  if (staerke < 0.02 || !z.buchstaben.length) { ctx.drawImage(quelle, 0, 0); return; }
  const u = z.u;
  const seed = z.seed & 0xffff;

  // hart: die Zeit springt in groben Einzelbildern -> "choppy" Bewegung
  const bilderProSekunde = GLITCH.bilderProSekundeWeich
    + (GLITCH.bilderProSekundeHart - GLITCH.bilderProSekundeWeich) * haerte;
  const zeit = Math.floor(t * bilderProSekunde) / bilderProSekunde;

  const dauer = GLITCH.dauerWeich + (GLITCH.dauerHart - GLITCH.dauerWeich) * haerte;
  const streifen = Math.max(2, Math.round(u * (GLITCH.streifenDickWeich
    + (GLITCH.streifenDuennHart - GLITCH.streifenDickWeich) * haerte)));
  const ausschlag = u * GLITCH.ausschlag * Math.min(2, staerke);
  const sauber = GLITCH.sauberAnteil / Math.max(0.5, staerke);

  z.buchstaben.forEach((bs, i) => {
    // jeder Buchstabe wechselt zu seiner eigenen Zeit (versetzt), damit
    // nicht alle gleichzeitig umspringen
    const versatz = gitter(i, 1, seed);
    const runde = Math.floor(t / dauer + versatz);
    const zufall = (n) => gitter(i + n * 31, runde, seed);

    if (zufall(1) < sauber) { ctx.drawImage(bs.normal, bs.x0, bs.y0); return; }

    const welle = {
      art: ARTEN[Math.floor(zufall(2) * ARTEN.length)],
      richtung: zufall(3) < 0.5 ? -1 : 1,
      phase: zufall(4),
      // die Mitte des zerhackten Bereichs: der Rest des Buchstabens bleibt ruhig
      mitte: zufall(5),
      breite: 0.35 + 0.5 * zufall(6),
      zeit,
    };

    if (welle.art === 'senkrecht') zeichneSpalten(ctx, bs, welle, streifen, ausschlag);
    else zeichneStreifen(ctx, bs, welle, streifen, ausschlag, welle.art === 'schmieren');
  });
}

// Wie weit ein Streifen an der Stelle k (0 = Anfang, 1 = Ende des Buchstabens)
// verschoben wird: eine laufende Welle, nur in einem Bereich, in Stufen.
function verschiebung(k, welle) {
  const huelle = 1 - glatt(0, welle.breite, Math.abs(k - welle.mitte));
  const wert = Math.sin(Math.PI * 2 * (k * GLITCH.wellen + welle.phase + welle.zeit * GLITCH.wellenTempo));
  // auf Stufen runden -> Treppe statt glatter Kurve
  const gestuft = Math.round(wert * huelle * GLITCH.stufen) / GLITCH.stufen;
  return gestuft * welle.richtung;
}

// Waagerechte Streifen, die nach links/rechts rutschen.
// schmieren: zusätzlich zur Seite lang gezogen, wie eine Spur
function zeichneStreifen(ctx, bs, welle, streifen, ausschlag, schmieren) {
  for (let y = 0; y < bs.h; y += streifen) {
    const sh = Math.min(streifen, bs.h - y);
    const v = verschiebung((y + sh / 2 - bs.kern.y0) / bs.kern.h, welle);
    if (!schmieren) {
      ctx.drawImage(bs.normal, 0, y, bs.w, sh, bs.x0 + v * ausschlag, bs.y0 + y, bs.w, sh);
      continue;
    }
    // gestreckt, mit dem Anker an einer Seite: der Streifen zieht sich zur anderen Seite
    const streckung = 1 + Math.abs(v) * GLITCH.schmierLaenge;
    const breite = bs.w * streckung;
    const x = welle.richtung > 0 ? bs.x0 : bs.x0 + bs.w - breite;
    ctx.drawImage(bs.normal, 0, y, bs.w, sh, x, bs.y0 + y, breite, sh);
  }
}

// Senkrechte Spalten, die nach oben/unten rutschen -> Treppen-Diagonalen
function zeichneSpalten(ctx, bs, welle, streifen, ausschlag) {
  const hoch = ausschlag * 0.5;   // nach oben/unten weniger weit, sonst zerfällt die Zeile
  for (let x = 0; x < bs.w; x += streifen) {
    const sw = Math.min(streifen, bs.w - x);
    const v = verschiebung((x + sw / 2 - bs.kern.x0) / bs.kern.w, welle);
    ctx.drawImage(bs.normal, x, 0, sw, bs.h, bs.x0 + x, bs.y0 + v * hoch, sw, bs.h);
  }
}
