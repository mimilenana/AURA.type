// ------------------------------------------------------------
// STACHELN: die harte Version. Die Stacheln wachsen aus den
// Ankerpunkten der Schrift: ein Ankerpunkt wird nach außen gezogen,
// wie wenn man ihn in Illustrator mit der Maus herauszieht. Die Kontur
// links und rechts davon zieht mit, dadurch entsteht eine Spitze mit
// geschwungenen Seiten, die aus dem Buchstaben selbst herauswächst.
//
//   - die meisten Stacheln sind kurz, einige wenige sehr lang
//   - Ankerpunkte an Ecken, die nach außen stehen, wachsen eher und länger
//   - lange Stacheln zeigen vom Namen weg, wie eine Explosion
//   - in den Innenräumen (z. B. im "o") bleiben die Stacheln kurz
//
//   je härter -> mehr und längere Stacheln
//   schon ab der Mitte gibt es ein paar kleine Stacheln, damit die
//   Schrift nie ganz normal aussieht
//
// Alle Längen sind relativ zur Schriftgröße (u = 1 Geviert).
// Das sind eure gestalterischen Stellschrauben.
// ------------------------------------------------------------

import { flaeche, gitter } from '../verzerrung.js';

const begrenze = (x, a, b) => Math.max(a, Math.min(b, x));
const glatt = (a, b, x) => { const t = begrenze((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const STACHELN = {
  abHaerte: 0.5,          // ab dieser Härte wachsen Stacheln
  mindestStaerke: 0.3,    // so stark sind sie schon direkt ab "abHaerte"
  chance: 0.35,           // Grundchance, dass ein Ankerpunkt zum Stachel wird
  eckenBonus: 0.5,        // zusätzliche Chance an Ecken, die nach außen stehen
  laengeKurz: 0.08,       // kürzester Stachel
  laengeLang: 1.3,        // längster Stachel
  langSelten: 3,          // je größer, desto seltener die ganz langen
  laengeInnen: 0.1,       // höchstens so lang in Innenräumen
  fuss: 0.05,             // wie weit die Kontur links und rechts mitgezogen wird
  fussLang: 0.07,         // ... zusätzlich bei langen Stacheln
  schwung: 3,             // Form der Seiten: 1 = gerade, größer = stärker nach innen geschwungen
  bogen: 0.25,            // wie stark sich ein Stachel zur Seite biegt
  vomNamenWeg: 0.5,       // 0 = senkrecht zur Kontur, 1 = vom Namen weg
  feinheit: 0.008,        // Punktabstand auf der Kontur (kleiner = glatter)
};

// Wie stark die Stacheln bei dieser Härte sind (0 = keine, 1 = voll)
export function stachelStaerke(haerte) {
  if (haerte < STACHELN.abHaerte) return 0;
  return STACHELN.mindestStaerke
    + (1 - STACHELN.mindestStaerke) * glatt(STACHELN.abHaerte, 1, haerte);
}

// Liefert die Konturen eines Namens mit herausgezogenen Ankerpunkten.
// z: ein Zeichenkontext (nur zum Prüfen, ob ein Stachel in einen Buchstaben läuft)
// e: { konturen, u, richtung, seed, haerte }
export function stachle(z, e) {
  const staerke = stachelStaerke(e.haerte);
  if (staerke <= 0 || !e.konturen.length) return e.konturen;
  const u = e.u;

  // Mitte des Namens: lange Stacheln zeigen von hier weg
  const allePunkte = e.konturen.flat();
  const mitte = {
    x: allePunkte.reduce((s, p) => s + p.x, 0) / allePunkte.length,
    y: allePunkte.reduce((s, p) => s + p.y, 0) / allePunkte.length,
  };
  // Umlaufsinn der größten Kontur = Außenform; andersherum = Innenraum
  const groesste = e.konturen.reduce((a, k) => (Math.abs(flaeche(k)) > Math.abs(flaeche(a)) ? k : a));
  const aussenSinn = Math.sign(flaeche(groesste));
  const form = alsPfad(e.konturen);

  return e.konturen.map((kontur, nr) => {
    const innen = Math.sign(flaeche(kontur)) !== aussenSinn;
    const k = verfeinere(kontur, u * STACHELN.feinheit);
    if (k.length < 3) return kontur;
    const n = normalen(k, e.richtung);
    const umfang = k[k.length - 1].weg + abstand(k[k.length - 1], k[0]);
    const verschiebung = k.map(() => ({ x: 0, y: 0 }));

    let ankerNr = 0;
    k.forEach((p, i) => {
      if (!p.anker) return;
      ankerNr++;
      const zufall = (m) => gitter(nr * 131 + ankerNr, m, e.seed & 0xffff);

      // nur Ankerpunkte, die nach außen stehen (oder gerade sind), nie Innenecken
      const ecke = eckigkeit(k, n, i, u);
      if (ecke < 0) return;
      if (zufall(1) > (STACHELN.chance + STACHELN.eckenBonus * ecke) * staerke) return;

      // Länge: meistens kurz, selten sehr lang; an Ecken länger
      const seltenLang = Math.pow(zufall(2), STACHELN.langSelten);
      let laenge = u * staerke * (0.5 + ecke)
        * (STACHELN.laengeKurz + (STACHELN.laengeLang - STACHELN.laengeKurz) * seltenLang);
      if (innen) laenge = Math.min(laenge, u * STACHELN.laengeInnen);

      // Richtung: senkrecht zur Kontur, lange Stacheln eher vom Namen weg
      const weg = einheit({ x: p.x - mitte.x, y: p.y - mitte.y });
      const mischung = innen ? 0 : STACHELN.vomNamenWeg * Math.sqrt(seltenLang) * 2;
      const richtung = einheit({ x: n[i].x + weg.x * mischung, y: n[i].y + weg.y * mischung });
      const quer = { x: -richtung.y, y: richtung.x };
      const bogen = (zufall(3) * 2 - 1) * STACHELN.bogen;

      // läuft der Stachel in einen Buchstaben hinein, wird er gekürzt
      laenge *= freieLaenge(z, form, p, richtung, quer, laenge, bogen);
      if (laenge < u * STACHELN.laengeKurz * 0.3) return;

      // wie weit die Kontur links und rechts vom Ankerpunkt mitgezogen wird
      const fuss = Math.min(umfang * 0.2, u * (STACHELN.fuss + STACHELN.fussLang * Math.sqrt(laenge / u)));

      // Punkte in der Nähe des Ankers mitziehen: der Anker ganz,
      // je weiter weg, desto weniger -> Spitze mit geschwungenen Seiten
      k.forEach((q, j) => {
        let d = Math.abs(q.weg - p.weg);
        d = Math.min(d, umfang - d);
        if (d >= fuss) return;
        const zug = Math.pow(1 - d / fuss, STACHELN.schwung);
        verschiebung[j].x += richtung.x * laenge * zug + quer.x * bogen * laenge * zug * zug;
        verschiebung[j].y += richtung.y * laenge * zug + quer.y * bogen * laenge * zug * zug;
      });
    });

    return k.map((q, j) => ({ ...q, x: q.x + verschiebung[j].x, y: q.y + verschiebung[j].y }));
  });
}

// Fügt auf langen geraden Stücken Zwischenpunkte ein, damit sich die
// Kontur dort biegen kann. Ankerpunkte bleiben erhalten; jeder Punkt
// bekommt "weg" = Abstand vom Anfang der Kontur.
function verfeinere(kontur, schritt) {
  const neu = [];
  kontur.forEach((p, i) => {
    const letzter = neu[neu.length - 1];
    // doppelte Punkte (z. B. Anfang = Ende) zusammenfassen
    if (letzter && abstand(letzter, p) < schritt * 0.1) { letzter.anker = letzter.anker || p.anker; return; }
    neu.push({ ...p });
    const naechster = kontur[(i + 1) % kontur.length];
    const teile = Math.floor(abstand(p, naechster) / schritt);
    for (let t = 1; t < teile; t++) {
      const f = t / teile;
      neu.push({ x: p.x + (naechster.x - p.x) * f, y: p.y + (naechster.y - p.y) * f });
    }
  });
  // Ende = Anfang? Dann den letzten Punkt weglassen, der Anker steckt im ersten
  if (neu.length > 2 && abstand(neu[0], neu[neu.length - 1]) < schritt * 0.1) {
    neu[0].anker = neu[0].anker || neu[neu.length - 1].anker;
    neu.pop();
  }
  neu.forEach((p, i) => { p.weg = i === 0 ? 0 : neu[i - 1].weg + abstand(neu[i - 1], p); });
  return neu;
}

// Normalen, die von der Farbfläche weg zeigen. Über ein paar Punkte
// gemittelt, damit sie an Ecken genau zwischen beiden Seiten liegen.
function normalen(k, richtung) {
  const weite = 3;
  return k.map((p, i) => {
    const a = k[(i - weite + k.length) % k.length];
    const b = k[(i + weite) % k.length];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: ((b.y - a.y) / l) * richtung, y: (-(b.x - a.x) / l) * richtung };
  });
}

// Wie stark die Kontur an Punkt i nach außen heraussteht (-1..1).
// Positiv: die Nachbarn liegen hinter dem Punkt (Ecke nach außen),
// negativ: Innenecke.
function eckigkeit(k, n, i, u) {
  const weite = 5;
  const a = k[(i - weite + k.length) % k.length];
  const b = k[(i + weite) % k.length];
  const vor = (k[i].x - (a.x + b.x) / 2) * n[i].x + (k[i].y - (a.y + b.y) / 2) * n[i].y;
  return begrenze(vor / (u * STACHELN.feinheit * weite * 0.5), -1, 1);
}

// Welcher Anteil des Stachels frei bleibt (1 = ganz), bevor er auf
// einen Buchstaben trifft. Geprüft wird an einigen Punkten der Mittellinie.
function freieLaenge(z, form, p, richtung, quer, laenge, bogen) {
  const proben = 8;
  z.save();
  z.setTransform(1, 0, 0, 1, 0, 0);
  let frei = 1;
  // erst ab einem kleinen Stück, der Anker sitzt ja auf dem Buchstaben
  for (let i = 2; i <= proben; i++) {
    const s = i / proben;
    const x = p.x + richtung.x * laenge * s + quer.x * bogen * laenge * s * s;
    const y = p.y + richtung.y * laenge * s + quer.y * bogen * laenge * s * s;
    if (z.isPointInPath(form, x, y, 'nonzero')) { frei = (i - 1) / proben * 0.8; break; }
  }
  z.restore();
  return frei;
}

function alsPfad(konturen) {
  const pfad = new Path2D();
  for (const k of konturen) {
    pfad.moveTo(k[0].x, k[0].y);
    for (let i = 1; i < k.length; i++) pfad.lineTo(k[i].x, k[i].y);
    pfad.closePath();
  }
  return pfad;
}

function abstand(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function einheit(v) {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}
