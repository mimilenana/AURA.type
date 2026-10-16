// ------------------------------------------------------------
// WORT: setzt Namen auf die Fläche und bewegt sie auf Wunsch.
// ------------------------------------------------------------

import { verzerre, aussenRichtung, hashText, flaeche, gitter } from './verzerrung.js';

// Ungefähre Strichstärke der Schrift: Fläche geteilt durch halben Umfang
function strichDicke(konturen, aussen) {
  let f = 0, umfang = 0;
  for (const k of konturen) {
    f += flaeche(k) * aussen;
    for (let i = 0; i < k.length; i++) {
      const a = k[i], b = k[(i + 1) % k.length];
      umfang += Math.hypot(b.x - a.x, b.y - a.y);
    }
  }
  return umfang ? Math.max(1, (2 * Math.abs(f)) / umfang) : 1;
}

// konturenVon(text) liefert für einen Text ein Array von Konturen
// (je ein Array aus {x, y}) in Buchstabenreihenfolge.
// optionen: anteilBreite / anteilHoehe (wie viel der Fläche der Name höchstens
// einnimmt) und mitteX / mitteY (wohin er gesetzt wird)
export function baueWort(text, konturenVon, breite, hoehe, maxGroesse, optionen = {}) {
  const { anteilBreite = 0.7, anteilHoehe = 0.5, mitteX = breite / 2, mitteY = hoehe / 2 } = optionen;
  const zeichen = [...text];
  const anzahl = zeichen.map(c => (c.trim() ? konturenVon(c).length : 0));
  const alle = konturenVon(text);
  const punkte = alle.flat();
  if (!punkte.length) return null;

  // Geviert (u) aus der Höhe des "H" schätzen
  const h = konturenVon('H').flat();
  const emRoh = (Math.max(...h.map(p => p.y)) - Math.min(...h.map(p => p.y))) / 0.714;

  const minX = Math.min(...punkte.map(p => p.x)), maxX = Math.max(...punkte.map(p => p.x));
  const minY = Math.min(...punkte.map(p => p.y)), maxY = Math.max(...punkte.map(p => p.y));

  // so groß wie erlaubt, mit Rand für die aufgeblähte Kontur und den Blur
  const skala = Math.min(maxGroesse / emRoh, (breite * anteilBreite) / (maxX - minX), (hoehe * anteilHoehe) / (maxY - minY));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const setze = p => ({ ...p, x: (p.x - cx) * skala + mitteX, y: (p.y - cy) * skala + mitteY });

  const buchstaben = [];
  let i = 0;
  for (let z = 0; z < zeichen.length; z++) {
    buchstaben.push({ zeichen: zeichen[z], konturen: alle.slice(i, i + anzahl[z]).map(k => k.map(setze)) });
    i += anzahl[z];
  }

  const gesetzt = buchstaben.flatMap(b => b.konturen);
  const groesste = gesetzt.reduce((a, k) => (Math.abs(flaeche(k)) > Math.abs(flaeche(a)) ? k : a));
  const aussen = Math.sign(flaeche(groesste)) || 1;   // Umlaufsinn einer Außenform
  return {
    buchstaben,
    u: emRoh * skala,
    strich: strichDicke(gesetzt, aussen),
    richtung: aussenRichtung(gesetzt),
    aussen,
  };
}

// Feste Form: einmal pro Name berechnen
export function formeWort(wort, text) {
  const seed = hashText(text);
  // Umriss jedes Buchstabens (für die Animation einzelner Buchstaben)
  const boxen = wort.buchstaben.filter(b => b.konturen.length).map(b => {
    const p = b.konturen.flat();
    return {
      x0: Math.min(...p.map(q => q.x)), x1: Math.max(...p.map(q => q.x)),
      y0: Math.min(...p.map(q => q.y)), y1: Math.max(...p.map(q => q.y)),
    };
  });
  return {
    boxen,
    // die einzelnen Buchstaben mit ihren Konturen (Modi, die jeden Buchstaben für sich bewegen)
    buchstaben: wort.buchstaben,
    konturen: wort.buchstaben.flatMap(b => b.konturen),
    u: wort.u,
    strich: wort.strich,
    richtung: wort.richtung,
    seed,
  };
}

// Bewegung (optional): jedes Bild neu. haerte 0 = schwimmt, 1 = ruppig
export function bewegeWort(form, t, tempo, haerte) {
  return verzerre(form.konturen, haerte, form.u, t, form.seed, tempo);
}


// Setzt mehrere Namen als Zeilen übereinander, die sich überlappen.
// texte: ['Milena', 'Bruno', ...]; ueberlappung 0 = berühren sich, 0.5 = halb übereinander
// rand: freier Rand oben und unten (Anteil der Höhe)
// konturenVon(t, name): Konturen für den Text t, wobei name der ganze Name der
// Zeile ist (so kann jeder Name seine eigene Stärke und Laufweite bekommen).
// Liefert pro Zeile die feste Form (wie formeWort) plus den Text.
export function setzeZeilen(texte, konturenVon, breite, hoehe, optionen = {}) {
  const { ueberlappung = 0.3, rand = 0.06, anteilBreite = 0.88, maxGroesse = 1e9 } = optionen;
  const n = texte.length;
  const nutzbar = hoehe * (1 - 2 * rand);
  // Zeilenhöhe so, dass alle Zeilen mit Überlappung genau hineinpassen
  const zeile = nutzbar / (1 + (n - 1) * (1 - ueberlappung));
  const zeilen = [];
  texte.forEach((text, i) => {
    const mitteY = hoehe * rand + zeile / 2 + i * zeile * (1 - ueberlappung);
    const wort = baueWort(text, t => konturenVon(t, text), breite, zeile, maxGroesse,
      { anteilBreite, anteilHoehe: 0.95, mitteY });
    if (wort) zeilen.push({ text, ...formeWort(wort, text) });
  });
  return zeilen;
}


// Setzt die Buchstaben eines Namens abwechselnd versetzt untereinander (für das Hochformat,
// z. B. eine Instagram-Story): der erste Buchstabe in der linken Spalte, der zweite direkt
// darunter in der rechten, der dritte wieder links und so weiter. Beide Seiten liegen nah an
// der Mitte, die Buchstaben weichen aber ein Stück von der geraden Linie ab und wirken so über die Fläche verteilt.
//
// Abgemessen wird nur, was wirklich gezeichnet wird: die obersten und untersten Punkte der
// Buchstabenumrisse, nicht die Zeilenhöhe der Schrift. Die Mitten der Buchstaben liegen in gleichen
// senkrechten Abständen, der erste Buchstabe oben, der letzte unten. So sind die Buchstaben gleichmäßig
// über die Höhe verteilt, egal ob hohe (M, l, b) oder niedrige Buchstaben (a, e, n) aufeinanderfolgen.
//
// Die Buchstaben werden so groß wie möglich. Ein Buchstabe darf dabei nie einen anderen in
// derselben Spalte berühren, und Buchstaben aus verschiedenen Spalten nie seitlich, wenn sie
// in der Höhe nebeneinander stehen.
// Alle haben dieselbe Größe. Leerzeichen werden übersprungen.
// Liefert eine einzige Form (wie formeWort) für den ganzen Namen, damit alle Buchstaben
// im selben Modus laufen.
// optionen.rand: freier Rand rundherum (Anteil der kleineren Seite)
// optionen.groesse: Faktor auf die größte passende Größe (1 = so groß wie möglich, 2 = doppelt so groß:
// dann überschneiden sich die Buchstaben und ragen über den Rand, das ist gewollt)
const SPALTE_LINKS = 0.3;           // Mitte der linken Seite (Anteil der Breite)
const SPALTE_RECHTS = 0.7;          // Mitte der rechten Seite
const LETZTER_MINDESTENS = 0.5;       // der letzte Buchstabe liegt mit seiner Mitte mindestens hier (Anteil der Breite), nie weiter links
const SEITEN_STREUUNG = 0.11;       // wie weit jeder Buchstabe zufällig von der Mitte seiner Seite abweicht (Anteil der Breite)
const SEITEN_WELLE = 0.07;          // dazu wandert die Reihe wellenförmig hin und her (Anteil der Breite)
const BREITE_MAX_ANTEIL = 0.55;     // so breit darf der breiteste Buchstabe höchstens werden (Anteil der Breite)
const LUFT_GLEICHE_SEITE = 0.08;    // so viel Luft (Anteil der Schriftgröße) bleibt mindestens zwischen zwei Buchstaben in derselben Spalte
const LUFT_SEITLICH = 0.2;          // und so viel zwischen linker und rechter Seite, wenn sie sich in der Höhe überlappen

// Lange Namen (ab LANG_AB Buchstaben) brauchen mehr Platz pro Buchstabe, damit die Schrift nicht zu klein wird:
// die Seiten liegen weiter außen, die Buchstaben weichen weniger ab, und es darf etwas enger werden.
const LANG_AB = 5;
const LANG_SPALTE_LINKS = 0.24;
const LANG_SPALTE_RECHTS = 0.76;
const LANG_STREUUNG = 1.0;          // so viel der normalen Abweichung bleibt bei langen Namen
const LANG_LUFT_GLEICHE_SEITE = 0.05;
const LANG_LUFT_SEITLICH = 0.08;
export function setzeVersetzt(text, konturenVon, breite, hoehe, optionen = {}) {
  const { rand = 0.06, groesse = 1 } = optionen;
  const zeichen = [...text].filter(c => c.trim());
  const anzahl = zeichen.length;
  if (!anzahl) return [];

  // Geviert (u) wie in baueWort aus der Höhe des "H" schätzen
  const hoeheH = konturenVon('H').flat();
  const emRoh = (Math.max(...hoeheH.map(p => p.y)) - Math.min(...hoeheH.map(p => p.y))) / 0.714;

  const roh = zeichen.map(z => konturenVon(z));
  const grenzen = roh.map(konturen => {
    const p = konturen.flat();
    if (!p.length) return { links: 0, breite: 0 };
    const links = Math.min(...p.map(q => q.x));
    return { links, breite: Math.max(...p.map(q => q.x)) - links };
  });
  // Maße jedes Buchstabens, wie er gezeichnet wird: Breite, Höhe und oberster Punkt
  const masse = roh.map((konturen, i) => {
    const p = konturen.flat();
    const oben = p.length ? Math.min(...p.map(q => q.y)) : 0;
    const unten = p.length ? Math.max(...p.map(q => q.y)) : 0;
    return { breite: grenzen[i].breite / emRoh, hoehe: (unten - oben) / emRoh, oben };
  });
  const abstandRand = Math.min(breite, hoehe) * rand;
  const verfuegbareHoehe = hoehe - 2 * abstandRand;
  const summeHoehe = masse.reduce((summe, m) => summe + m.hoehe, 0);
  // Jeder Buchstabe sitzt auf seiner Seite (abwechselnd links und rechts), aber nicht genau untereinander:
  // eine Wellenlinie und eine kleine Zufallsabweichung (aus dem Namen gewürfelt, also immer gleich) verteilen
  // sie über die Fläche. Die Höhen bleiben gleichmäßig.
  const zufallSeed = hashText(text) & 0xffff;
  // Der letzte Buchstabe steht nie links: mindestens in der Mitte der Fläche, bei gerader Anzahl ohnehin rechts.
  const lang = anzahl >= LANG_AB;
  const mitteLinks = lang ? LANG_SPALTE_LINKS : SPALTE_LINKS;
  const mitteRechts = lang ? LANG_SPALTE_RECHTS : SPALTE_RECHTS;
  const streuung = lang ? LANG_STREUUNG : 1;
  const luftGleicheSeite = lang ? LANG_LUFT_GLEICHE_SEITE : LUFT_GLEICHE_SEITE;
  const luftSeitlich = lang ? LANG_LUFT_SEITLICH : LUFT_SEITLICH;
  const mitten = zeichen.map((_, i) => {
    if (anzahl === 1) return breite / 2;
    const letzter = i === anzahl - 1;
    const links = i % 2 === 0;
    const seite = links ? (letzter ? 0.5 : mitteLinks) : mitteRechts;
    let abweichung = ((gitter(i, 3, zufallSeed) * 2 - 1) * SEITEN_STREUUNG + Math.sin(i * 1.7) * SEITEN_WELLE) * streuung;
    if (letzter) abweichung = Math.abs(abweichung) * (links ? 0.5 : 1);      // nur nach rechts abweichen
    return breite * Math.max(seite + abweichung, letzter ? LETZTER_MINDESTENS : 0);
  });
  const mitteX = (i) => mitten[i];
  const spalteLinks = zeichen.map((_, i) => i).filter(i => i % 2 === 0);
  const spalteRechts = zeichen.map((_, i) => i).filter(i => i % 2 === 1);

  // Legt alle Buchstaben bei Größe u (Pixel pro Geviert) senkrecht aus: die Mitten der Buchstaben (nach dem, was
  // wirklich gezeichnet wird) liegen in gleichen Abständen von oben nach unten. Der erste Buchstabe berührt den
  // oberen Rand, der letzte den unteren. So verteilen sich die Buchstaben gleichmäßig über die ganze Höhe, auch
  // bei wenigen Buchstaben ohne Lücke in der Mitte. Liefert die Oberkante jedes Buchstabens, ihre Höhen und den
  // kleinsten Abstand zwischen zwei Buchstaben auf derselben Seite (i und i + 2).
  const lege = (u) => {
    const h = masse.map(m => m.hoehe * u);
    const von = abstandRand, bis = abstandRand + verfuegbareHoehe;
    const oben = h.map((hoehe_, i) => {
      if (anzahl === 1) return (hoehe - h[0]) / 2;
      const ersteMitte = von + h[0] / 2, letzteMitte = bis - h[anzahl - 1] / 2;
      return ersteMitte + (letzteMitte - ersteMitte) * i / (anzahl - 1) - hoehe_ / 2;
    });
    let luft = Infinity;
    for (let i = 0; i + 2 < anzahl; i++) luft = Math.min(luft, oben[i + 2] - (oben[i] + h[i]));
    return { oben, h, luft };
  };

  // Linke Kante eines Buchstabens bei Größe u: mittig auf seiner Seite, aber im Bild gehalten
  // (bei Textgröße über 100 % wird nicht mehr zurechtgerückt, siehe unten)
  const linkerRand = (i, u, ueberRand = false) => {
    const mitte = mitteX(i) - masse[i].breite * u / 2;
    return ueberRand ? mitte : Math.min(breite - abstandRand - masse[i].breite * u, Math.max(abstandRand, mitte));
  };

  const pruefe = (u) => {
    const lage = lege(u);
    const { oben, h, luft } = lage;
    if (luft < luftGleicheSeite * u) return null;
    // alles muss ins Bild passen (die kürzere Spalte endet früher, die längere genau am Rand)
    for (let i = 0; i < anzahl; i++) if (oben[i] < abstandRand - 0.5 || oben[i] + h[i] > abstandRand + verfuegbareHoehe + 0.5) return null;
    for (let i = 0; i < anzahl; i++) {
      for (let j = i + 1; j < anzahl; j++) {
        if ((i - j) % 2 === 0) continue;                                          // gleiche Spalte: schon über die Luft geprüft
        if (oben[i] >= oben[j] + h[j] || oben[j] >= oben[i] + h[i]) continue;      // in der Höhe nicht nebeneinander
        // gemessen wird der tatsächliche Platz der Buchstaben (nach dem Zurechtrücken in den Rand), nicht die Mitte der Seite
        const linksI = linkerRand(i, u), linksJ = linkerRand(j, u);
        const luecke = Math.max(linksJ - (linksI + masse[i].breite * u), linksI - (linksJ + masse[j].breite * u));
        if (luecke < luftSeitlich * u) return null;
      }
    }
    return lage;
  };

  // Passt alles bei Größe u? Nichts darf zu breit sein, alles muss ins Bild, auf derselben Seite muss genug Luft
  // bleiben, und zwei Buchstaben von verschiedenen Seiten dürfen sich nicht berühren, wenn sie in der Höhe nebeneinander stehen.
  const passt = (u) => {
    if (masse.some(m => m.breite * u > BREITE_MAX_ANTEIL * breite)) return null;
    return pruefe(u);
  };

  // die größte passende Größe finden (Halbieren: jedes Mal die Hälfte der Möglichkeiten)
  let klein = 0;
  let gross = Math.min(
    BREITE_MAX_ANTEIL * breite / Math.max(...masse.map(m => m.breite), 0.01),
    verfuegbareHoehe / Math.max(...masse.map(m => m.hoehe), 0.1),
  );
  if (passt(gross)) klein = gross;
  else for (let schritt = 0; schritt < 30; schritt++) {
    const mitte = (klein + gross) / 2;
    if (passt(mitte)) klein = mitte; else gross = mitte;
  }
  // groesse: 1 = so groß wie möglich, kleiner = die Buchstaben schrumpfen, die Abstände wachsen dabei mit
  const u = klein * groesse;
  const skala = u / emRoh;
  const lage = lege(u);

  const buchstaben = zeichen.map((z, i) => {
    // bis 100 % bleibt jeder Buchstabe im Bild; bei größeren Werten sitzt er mittig in seiner Spalte und ragt über den Rand
    const links = linkerRand(i, u, groesse > 1);
    const setze = p => ({ ...p, x: (p.x - grenzen[i].links) * skala + links, y: (p.y - masse[i].oben) * skala + lage.oben[i] });
    return { zeichen: z, konturen: roh[i].map(k => k.map(setze)) };
  });

  const gesetzt = buchstaben.flatMap(b => b.konturen);
  if (!gesetzt.length) return [];
  const groesste = gesetzt.reduce((a, k) => (Math.abs(flaeche(k)) > Math.abs(flaeche(a)) ? k : a));
  const aussen = Math.sign(flaeche(groesste)) || 1;
  const wort = { buchstaben, u, strich: strichDicke(gesetzt, aussen), richtung: aussenRichtung(gesetzt), aussen };
  // versetzt + buchstaben: Modi, die jeden Buchstaben einzeln bewegen, finden hier die einzelnen Buchstaben
  return [{ text, versetzt: true, buchstaben, ...formeWort(wort, text) }];
}
