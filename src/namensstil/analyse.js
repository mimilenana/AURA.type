// ------------------------------------------------------------
// ANALYSE: Wie klingt ein Name?
// Hier legt ihr fest, welche Buchstaben wie wirken.
// Grundlage: Bouba-Kiki-Effekt (Lautsymbolik).
// ------------------------------------------------------------

import { NAMEN } from './namen.js';

export const LAUTE = {
  // Konsonanten -> Achse "Härte"
  hart:   ['k', 't', 'p', 'z', 'x', 'r', 'c', 'q', 's', 'f', 'ß'],
  weich:  ['m', 'n', 'l', 'w', 'b', 'j', 'h', 'v', 'd', 'g'],
  // Vokale -> Achse "Helligkeit"
  hell:   ['i', 'e', 'ä', 'y'],
  dunkel: ['o', 'u', 'ö', 'ü'],
  // offener, tiefer Vokal: zählt halb als dunkel
  leichtDunkel: ['a'],
};
const GEWICHT_LEICHT_DUNKEL = 0.5;
// Der erste Konsonant und der erste Vokal prägen den Klang am stärksten
// und zählen deshalb mehr als die übrigen Laute.
export const GEWICHT_ANLAUT = 2;


// ---------- 1. Rohwerte: einfach Laute zählen ----------

function zaehle(name) {
  const buchstaben = [...name.toLowerCase()].filter(c => /[a-zäöüß]/.test(c));
  let hart = 0, weich = 0, hell = 0, dunkel = 0;
  let ersterKonsonant = true, ersterVokal = true;
  const details = [];

  for (const c of buchstaben) {
    let typ = 'neutral';
    const istKonsonant = LAUTE.hart.includes(c) || LAUTE.weich.includes(c);
    const istVokal = LAUTE.hell.includes(c) || LAUTE.dunkel.includes(c) || LAUTE.leichtDunkel.includes(c);
    const g = (istKonsonant && ersterKonsonant) || (istVokal && ersterVokal) ? GEWICHT_ANLAUT : 1;
    if (istKonsonant) ersterKonsonant = false;
    if (istVokal) ersterVokal = false;

    if (LAUTE.hart.includes(c))   { hart += g;   typ = 'hart'; }
    if (LAUTE.weich.includes(c))  { weich += g;  typ = 'weich'; }
    if (LAUTE.hell.includes(c))   { hell += g;   typ = 'hell'; }
    if (LAUTE.dunkel.includes(c)) { dunkel += g; typ = 'dunkel'; }
    if (LAUTE.leichtDunkel.includes(c)) { dunkel += g * GEWICHT_LEICHT_DUNKEL; typ = 'leichtDunkel'; }
    details.push({ zeichen: c, typ });
  }

  return {
    haerte:     (hart + weich)  ? hart / (hart + weich)  : 0.5,
    helligkeit: (hell + dunkel) ? hell / (hell + dunkel) : 0.5,
    details,
    laenge: buchstaben.length,
  };
}


// ---------- 2. Eichung an der Namensliste ----------

// Median: der mittlere Wert, wenn man alle Namen der Liste sortiert
function median(werte) {
  const s = [...werte].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Zuerst wird die Härte-Grenze bestimmt. Die Helligkeit wird dann
// getrennt für harte und weiche Namen geeicht, weil die beiden Achsen
// bei deutschen Namen zusammenhängen: helle Namen sind meistens auch
// weich (Emma, Mia, Lina). Ohne getrennte Eichung bliebe die Ecke
// "hell + hart" fast leer.
const roh = NAMEN.map(zaehle);
const grenzeHaerte = median(roh.map(r => r.haerte));
const istHart = r => r.haerte > grenzeHaerte ||
  (r.haerte === grenzeHaerte && anlaut(r.details, ['hart', 'weich']) === 'hart');
export const GRENZEN = {
  haerte: grenzeHaerte,
  helligkeitHart:  median(roh.filter(istHart).map(r => r.helligkeit)),
  helligkeitWeich: median(roh.filter(r => !istHart(r)).map(r => r.helligkeit)),
};

// Verschiebt einen Wert so, dass die Grenze (Median) bei 0.5 liegt.
// 0 und 1 bleiben, wo sie sind; dazwischen wird gestreckt bzw. gestaucht.
function eiche(wert, grenze) {
  if (grenze <= 0 || grenze >= 1) return wert;
  return wert < grenze
    ? 0.5 * (wert / grenze)
    : 0.5 + 0.5 * ((wert - grenze) / (1 - grenze));
}


// ---------- 3. Gleichstand: der Anlaut entscheidet ----------

// Liegt ein Name genau auf der Grenze, gibt der erste Laut den
// Ausschlag, weil er den Klang eines Namens am stärksten prägt.
const SCHUBS = 0.02;
function anlaut(details, gruppen) {
  return details.find(d => gruppen.includes(d.typ))?.typ;
}


// ---------- Ergebnis ----------

export function analysiereName(name) {
  const r = zaehle(name);
  let haerte = eiche(r.haerte, GRENZEN.haerte);
  let helligkeit = eiche(r.helligkeit, istHart(r) ? GRENZEN.helligkeitHart : GRENZEN.helligkeitWeich);

  if (Math.abs(haerte - 0.5) < 1e-9) {
    haerte += anlaut(r.details, ['hart', 'weich']) === 'hart' ? SCHUBS : -SCHUBS;
  }
  if (Math.abs(helligkeit - 0.5) < 1e-9) {
    helligkeit += anlaut(r.details, ['hell', 'dunkel', 'leichtDunkel']) === 'hell' ? SCHUBS : -SCHUBS;
  }

  // Wie eindeutig ist der Name? 0 = auf der Grenze, 1 = extrem
  const staerke = Math.min(1, Math.hypot(haerte - 0.5, helligkeit - 0.5) / 0.5);

  return {
    haerte,              // 0..1, geeicht: 0.5 = so hart wie ein durchschnittlicher Name
    helligkeit,          // 0..1, geeicht: 0.5 = so hell wie ein durchschnittlicher Name
    rohHaerte: r.haerte,
    rohHelligkeit: r.helligkeit,
    staerke,
    details: r.details,
    laenge: r.laenge,
  };
}
