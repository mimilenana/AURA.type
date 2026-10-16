// ------------------------------------------------------------
// BÄNDER (hell · weich): Aus dem Projekt "typo-minimal" übernommen.
//
// Das Wort wird weichgezeichnet. Aus dem weichen Verlauf macht eine
// wellenförmige Tonkurve Konturbänder, wie Höhenlinien auf einer Karte
// oder ein Wärmebild in Schwarz-Weiß. Dazu kommen feine Körnung und
// waagerechte Streifen. Die Bänder atmen leicht, die Körnung flimmert.
//
// Jeder Buchstabe fährt unabhängig von den anderen auf einer eigenen,
// kleinen Bahn um seinen Platz, nur so weit, dass das Wort lesbar bleibt.
// Die Buchstaben dürfen sich dabei überlagern. Jeder zieht einen Schweif
// hinter sich her: entgegen seiner Fahrtrichtung wird er verschmiert, und
// zwar umso länger, je schneller er gerade ist. An den Wendepunkten, wo er
// langsam wird, schrumpft der Schweif fast auf null.
//
// Gerechnet wird in einer verkleinerten Ebene (ein "Rechenpixel" ist
// mehrere Bildschirmpixel groß). Das macht es schnell und die Körnung
// grob. Die Ebene wird mit harten Kanten auf die richtige Größe gezogen.
//
// Alle Größen sind relativ zur Schriftgröße. Die Werte, die typo-minimal
// bei 330 px Schriftgröße benutzt, stehen jeweils daneben.
//
// Die Zahlen in BAENDER sind eure Stellschrauben.
// ------------------------------------------------------------

import { leinwand, alsPfad } from './modi.js';
import { gitter } from './verzerrung.js';

const BAENDER = {
  rechenPixel: 0.006,     // Größe eines Rechenpixels (Anteil der Schriftgröße). typo-minimal: pixelSize 2
  kleinsterRechenPixel: 2, // nie feiner als so viele Pixel, damit die Körnung grob bleibt (1 = fein, aber langsamer)
  unschaerfeX: 0.018,     // Weichzeichnung waagerecht. typo-minimal: blurX 6
  unschaerfeY: 0.03,      // Weichzeichnung senkrecht. typo-minimal: blurY 10
  baender: 3,             // Anzahl der Konturbänder (ungerade Zahlen: Wort ist innen gefüllt). typo-minimal: bands 3
  verschiebung: 0,        // Grundverschiebung der Bänder (0 bis 6.28). typo-minimal: phase 0
  bandHub: 1.2,           // wie weit die Bänder hin und her atmen (Bogenmaß). 0 = stehen still. typo-minimal ließ sie
                          // immer weiter nach außen wandern, dann liegt irgendwann ein breiter grauer Hof um die Schrift
  kontrast: 1.2,          // Härte der Übergänge. typo-minimal: contrast 1.2
  koernung: 0.14,         // Körnung. typo-minimal: grain 0.14
  streifenStaerke: 0.05,  // Stärke der waagerechten Streifen. typo-minimal: stripeAmount 0.05
  streifenDichte: 0.22 * 330, // Dichte der Streifen (Bogenmaß pro Schriftgröße; typo-minimal: stripeFrequency 0.22 pro px bei 330 px)
  bandTempo: 0.5,         // wie schnell die Bänder atmen (typo-minimal: t * 0.5)
  streifenTempo: 2.5,     // wie schnell die Streifen laufen. typo-minimal: t * 2.5
  koernungBilder: 60,     // so oft pro Sekunde flimmert die Körnung neu
  kernWeich: 1.2,         // wie weich der Rand des geschützten Buchstabeninneren ist (in Rechenpixeln). Innerhalb der Buchstaben
                          // wandern die Bänder nicht, so bleiben sie dick und gefüllt (typo-minimal hat das nicht)

  randAbstand: 0.05,      // so viel Abstand zum Bildrand bleibt mindestens (Anteil der Schriftgröße), damit nichts abgeschnitten wird
  schweif: 0.2,           // größte Länge des Schweifs (Anteil der Schriftgröße). typo-minimal hatte 0.45, nach unten
  schweifSchnell: 0.25,   // ab dieser Geschwindigkeit (Schriftgrößen pro Sekunde) ist der Schweif am längsten
  schweifKurz: 0.15,      // so lang ist er mindestens, wenn der Buchstabe fast steht (Anteil der größten Länge)
  schweifZeit: 0.3,       // so viele Sekunden zurück wird die Fahrtrichtung bestimmt
  bahnWeite: 0.13,        // wie weit sich jeder Buchstabe höchstens von seinem Platz entfernt (Anteil der Schriftgröße).
                          // Klein halten, sonst ist das Wort nicht mehr lesbar. Mit dem Regler "Stärke" insgesamt änderbar.
  bahnTempoX: [0.7, 1.4], // wie schnell ein Buchstabe waagerecht hin und her fährt (Bogenmaß pro Sekunde, kleinster und größter Wert);
  bahnTempoY: [0.9, 1.7], // jeder Buchstabe würfelt sich sein eigenes Tempo aus
};

// Nachschlagetabelle für die Tonkurve (spart tausende cos()-Aufrufe pro Bild)
const TABELLE = { groesse: 4096, von: -0.8, bis: 1.8 };

export function bereite(eintrag, bereich) {
  const u = eintrag.u;
  const seed = eintrag.seed & 0xffff;
  const rechenPixel = Math.max(BAENDER.kleinsterRechenPixel, Math.round(u * BAENDER.rechenPixel));
  const b = Math.ceil(bereich.b / rechenPixel), h = Math.ceil(bereich.h / rechenPixel);

  const flaeche = leinwand(b, h);
  const fc = flaeche.getContext('2d');

  // Jeder Buchstabe bekommt sein eigenes weiches Feld und seine eigene Bahn.
  // Gibt es keine einzelnen Buchstaben, bewegt sich das ganze Wort als einer.
  const teile = (eintrag.buchstaben ?? [{ konturen: eintrag.konturen }]).filter(teil => teil.konturen.length);
  const buchstaben = teile.map((teil, nr) => {
    // den Buchstaben weiß auf schwarz in Rechenauflösung zeichnen: das ist die Maske
    fc.clearRect(0, 0, b, h);
    fc.fillStyle = '#fff';
    fc.fill(alsPfad(teil.konturen, bereich, 1 / rechenPixel), 'nonzero');
    const daten = fc.getImageData(0, 0, b, h).data;
    const maske = new Float32Array(b * h);
    for (let i = 0; i < maske.length; i++) maske[i] = daten[i * 4 + 3] / 255;

    const zufall = (m) => gitter(nr, m, seed);
    const zwischen = ([klein, gross], m) => klein + (gross - klein) * zufall(m);

    // Wie weit der Buchstabe in jede Richtung fahren darf, ohne dass er samt Weichzeichnung über den Rand
    // des Bereichs ragt. Dort würde er hart abgeschnitten, das sähe wie ein Fehler aus.
    const punkte = teil.konturen.flat();
    const rand = u * BAENDER.randAbstand;
    const raum = {
      links: Math.min(...punkte.map(p => p.x - bereich.x)) - rand,
      rechts: bereich.b - Math.max(...punkte.map(p => p.x - bereich.x)) - rand,
      oben: Math.min(...punkte.map(p => p.y - bereich.y)) - rand,
      unten: bereich.h - Math.max(...punkte.map(p => p.y - bereich.y)) - rand,
    };
    return {
      raum, rand,
      // weiches Wort; der Schweif wird erst später gezogen, weil er von der Fahrtrichtung abhängt
      basis: weichzeichnen(maske, b, h, u * BAENDER.unschaerfeX / rechenPixel, u * BAENDER.unschaerfeY / rechenPixel),
      // die Buchstabenform selbst (nur leicht weichgezeichnet): hier bleiben die Bänder stehen
      kern: weichzeichnen(maske, b, h, BAENDER.kernWeich, BAENDER.kernWeich),
      // die eigene Bahn: zwei Wellen mit verschiedenem Tempo und Weite
      tempoX: zwischen(BAENDER.bahnTempoX, 1), tempoY: zwischen(BAENDER.bahnTempoY, 2),
      phaseX: zufall(3) * Math.PI * 2, phaseY: zufall(4) * Math.PI * 2,
      weiteX: u * BAENDER.bahnWeite * (0.7 + 0.6 * zufall(5)), weiteY: u * BAENDER.bahnWeite * (0.7 + 0.6 * zufall(6)),
    };
  });

  return {
    u, bereich, rechenPixel, b, h, flaeche, buchstaben,
    feld: new Float32Array(b * h),          // alle Buchstaben zusammen: der hellere Wert gewinnt
    innenFeld: new Float32Array(b * h),     // alle geschützten Buchstabenformen zusammen
    zwischen: new Float32Array(b * h),      // Arbeitsfläche für den Schweif eines einzelnen Buchstabens
    bild: fc.createImageData(b, h),
    tabelle: baueTabelle(),
    seed,
  };
}

export function zeichne(ctx, d, zeit, farben, staerke) {
  const { b, h } = d;

  // Jeder Buchstabe fährt für sich: Position jetzt und ein Stück früher ergeben Richtung und Tempo.
  // Sie dürfen sich überlagern, dort gewinnt der hellere Wert.
  d.feld.fill(0);
  d.innenFeld.fill(0);
  for (const buchstabe of d.buchstaben) {
    const jetzt = bahn(buchstabe, zeit, staerke);
    const frueher = bahn(buchstabe, zeit - BAENDER.schweifZeit, staerke);
    const fahrtX = jetzt.x - frueher.x, fahrtY = jetzt.y - frueher.y;
    const weg = Math.hypot(fahrtX, fahrtY);
    const tempo = weg / BAENDER.schweifZeit / d.u;      // in Schriftgrößen pro Sekunde
    const schnell = Math.min(1, tempo / BAENDER.schweifSchnell);
    const laenge = d.u * BAENDER.schweif * (BAENDER.schweifKurz + (1 - BAENDER.schweifKurz) * schnell) * staerke;

    // der Buchstabe ist verschoben und hat den Schweif entgegen der Fahrtrichtung
    const versatzX = Math.round(jetzt.x / d.rechenPixel), versatzY = Math.round(jetzt.y / d.rechenPixel);
    schmiereHinterher(buchstabe.basis, d.zwischen, b, h, versatzX, versatzY, weg > 0 ? fahrtX / weg : 0, weg > 0 ? fahrtY / weg : 0, laenge / d.rechenPixel);
    vereine(d.feld, d.zwischen);
    vereineVerschoben(d.innenFeld, buchstabe.kern, b, h, versatzX, versatzY);
  }

  const pixel = d.bild.data;
  const { r, g, b: blau } = farben.vorne;

  // die Bänder atmen hin und her, statt immer weiter zu wandern: so bleibt die Schrift schmal und scharf umrissen
  const verschiebung = (BAENDER.verschiebung + BAENDER.bandHub * Math.sin(zeit * BAENDER.bandTempo)) / (Math.PI * BAENDER.baender);
  const streifenFrequenz = BAENDER.streifenDichte / d.u * d.rechenPixel;
  const streifenVersatz = zeit * BAENDER.streifenTempo;
  const streifenStaerke = BAENDER.streifenStaerke * staerke;

  // Zufallszahlen (xorshift32): jedes Bild beginnt anders, damit die Körnung flimmert
  let zufall = ((Math.floor(zeit * BAENDER.koernungBilder) * 7919 + d.seed) | 0) || 1;
  const { groesse, von, bis } = TABELLE;
  const tabellenMass = groesse / (bis - von);

  for (let y = 0; y < h; y++) {
    // zwei Sinuswellen mit verschiedener Frequenz ergeben unregelmäßige Streifen
    const streifen = (Math.sin(y * streifenFrequenz + streifenVersatz)
      + 0.5 * Math.sin(y * streifenFrequenz * 0.37 + 1.7 + streifenVersatz * 0.5)) * streifenStaerke;
    const zeile = y * b;

    for (let x = 0; x < b; x++) {
      const wert = d.feld[zeile + x];
      const begrenzt = wert < 0 ? 0 : wert > 1 ? 1 : wert;

      zufall ^= zufall << 13;
      zufall ^= zufall >>> 17;
      zufall ^= zufall << 5;
      const rauschen = (zufall >>> 0) / 4294967296;

      // Übergangszone: 0 im leeren Hintergrund und im Inneren, 1 an den Kanten.
      // Nur dort wandern die Bänder, Hintergrund und Inneres bleiben ruhig.
      // Bei dünnen Strichen erreicht das weiche Feld im Inneren nie ganz den Wert 1. Damit die
      // Bänder nicht mit der Zeit durch den Strich laufen und ihn aushöhlen, bleibt alles
      // innerhalb der Buchstabenform unverändert. Die Form fährt mit dem Buchstaben mit.
      const innen = glatteStufe(0.4, 0.9, d.innenFeld[zeile + x]);
      const uebergang = 4 * begrenzt * (1 - begrenzt) * (1 - innen);
      const ton = wert + (verschiebung + streifen) * uebergang + (rauschen - 0.5) * BAENDER.koernung;

      let nr = ((ton - von) * tabellenMass) | 0;
      if (nr < 0) nr = 0;
      else if (nr > groesse) nr = groesse;

      // Tabellenwert 0 = Schriftfarbe, 255 = Hintergrund; als Deckkraft der Schriftfarbe
      const o = (zeile + x) * 4;
      pixel[o] = r;
      pixel[o + 1] = g;
      pixel[o + 2] = blau;
      pixel[o + 3] = 255 - d.tabelle[nr];
    }
  }

  d.flaeche.getContext('2d').putImageData(d.bild, 0, 0);
  ctx.save();
  // mit harten Kanten hochskalieren, damit die Körnung körnig bleibt
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(d.flaeche, d.bereich.x, d.bereich.y, b * d.rechenPixel, h * d.rechenPixel);
  ctx.restore();
}

// Die Bahn eines Buchstabens: eine weiche, kleine Fahrt um seinen Platz. Zwei Wellen mit
// verschiedenem Tempo ergeben eine Kurve, die sich nie genau wiederholt.
// Die Fahrt wird auf jeder Seite auf den freien Platz begrenzt (raum): ist links kein Platz mehr,
// fährt der Buchstabe nur nach rechts und umgekehrt. Die Kurve bleibt dabei weich, es gibt kein Anhalten.
function bahn(buchstabe, zeit, staerke) {
  const { raum } = buchstabe;
  const welle = (wert, weite, minus, plus) => wert * Math.min(weite, Math.max(0, wert < 0 ? minus : plus));
  return {
    x: welle(Math.sin(zeit * buchstabe.tempoX + buchstabe.phaseX), buchstabe.weiteX * staerke, raum.links, raum.rechts),
    y: welle(Math.sin(zeit * buchstabe.tempoY + buchstabe.phaseY), buchstabe.weiteY * staerke, raum.oben, raum.unten),
  };
}

// Überlagerung: an jeder Stelle gewinnt der hellere Wert
function vereine(ziel, quelle) {
  for (let i = 0; i < ziel.length; i++) if (quelle[i] > ziel[i]) ziel[i] = quelle[i];
}

// dasselbe, nur die Quelle ist um (versatzX, versatzY) verschoben
function vereineVerschoben(ziel, quelle, b, h, versatzX, versatzY) {
  for (let y = 0; y < h; y++) {
    const qy = y - versatzY;
    if (qy < 0 || qy >= h) continue;
    for (let x = 0; x < b; x++) {
      const qx = x - versatzX;
      if (qx < 0 || qx >= b) continue;
      const wert = quelle[qy * b + qx];
      if (wert > ziel[y * b + x]) ziel[y * b + x] = wert;
    }
  }
}

// 0 unterhalb von von, 1 oberhalb von bis, dazwischen weich
function glatteStufe(von, bis, wert) {
  const t = wert <= von ? 0 : wert >= bis ? 1 : (wert - von) / (bis - von);
  return t * t * (3 - 2 * t);
}

// Tonkurve: eine Kosinuswelle macht aus dem weichen Verlauf Bänder
function baueTabelle() {
  const { groesse, von, bis } = TABELLE;
  const tabelle = new Uint8Array(groesse + 1);
  for (let i = 0; i <= groesse; i++) {
    const ton = von + i * (bis - von) / groesse;
    let wert = 0.5 + 0.5 * Math.cos(Math.PI * BAENDER.baender * ton);
    wert = Math.min(1, Math.max(0, (wert - 0.5) * BAENDER.kontrast + 0.5));
    tabelle[i] = Math.round(wert * 255);
  }
  return tabelle;
}

// Verschiebt das Wort um (versatzX, versatzY) und zieht es entgegen der
// Fahrtrichtung (richtungX, richtungY) in die Länge: jeder Punkt übernimmt den
// Wert seines Nachbarn "vor ihm" (in Fahrtrichtung), etwas abgeschwächt. So
// entsteht ein Schweif, der nach hinten ausläuft.
// Die Punkte werden in einer Reihenfolge abgearbeitet, bei der der Nachbar
// vor ihm schon fertig ist: entlang der Achse, in die die Fahrt vor allem geht.
function schmiereHinterher(basis, ziel, b, h, versatzX, versatzY, richtungX, richtungY, laenge) {
  const abnahme = laenge > 1 ? 1 - 1 / laenge : 0;
  const betragX = Math.abs(richtungX), betragY = Math.abs(richtungY);
  const nachHinten = (x, y) => {
    const bx = x - versatzX, by = y - versatzY;
    return bx < 0 || by < 0 || bx >= b || by >= h ? 0 : basis[by * b + bx];
  };

  if (betragX === 0 && betragY === 0) {
    // keine Fahrt: nur das verschobene Wort, ohne Schweif
    for (let y = 0; y < h; y++) for (let x = 0; x < b; x++) ziel[y * b + x] = nachHinten(x, y);
    return;
  }

  if (betragY >= betragX) {
    // die Fahrt geht vor allem senkrecht: Zeile für Zeile, von vorn nach hinten
    const schritt = richtungY > 0 ? 1 : -1;                 // so liegt der Nachbar vor uns
    const seitlich = richtungX / betragY;                   // Versatz des Nachbarn zur Seite
    const start = schritt > 0 ? h - 1 : 0, ende = schritt > 0 ? -1 : h;
    for (let y = start; y !== ende; y -= schritt) {
      const vorne = y + schritt;
      for (let x = 0; x < b; x++) {
        let wert = nachHinten(x, y);
        if (vorne >= 0 && vorne < h) {
          const sx = x + seitlich, x0 = Math.floor(sx), anteil = sx - x0;
          const links = x0 >= 0 && x0 < b ? ziel[vorne * b + x0] : 0;
          const rechts = x0 + 1 >= 0 && x0 + 1 < b ? ziel[vorne * b + x0 + 1] : 0;
          const geerbt = (links * (1 - anteil) + rechts * anteil) * abnahme;
          if (geerbt > wert) wert = geerbt;
        }
        ziel[y * b + x] = wert;
      }
    }
  } else {
    // die Fahrt geht vor allem waagerecht: Spalte für Spalte
    const schritt = richtungX > 0 ? 1 : -1;
    const seitlich = richtungY / betragX;
    const start = schritt > 0 ? b - 1 : 0, ende = schritt > 0 ? -1 : b;
    for (let x = start; x !== ende; x -= schritt) {
      const vorne = x + schritt;
      for (let y = 0; y < h; y++) {
        let wert = nachHinten(x, y);
        if (vorne >= 0 && vorne < b) {
          const sy = y + seitlich, y0 = Math.floor(sy), anteil = sy - y0;
          const oben = y0 >= 0 && y0 < h ? ziel[y0 * b + vorne] : 0;
          const unten = y0 + 1 >= 0 && y0 + 1 < h ? ziel[(y0 + 1) * b + vorne] : 0;
          const geerbt = (oben * (1 - anteil) + unten * anteil) * abnahme;
          if (geerbt > wert) wert = geerbt;
        }
        ziel[y * b + x] = wert;
      }
    }
  }
}

// Weichzeichner: drei Durchgänge Kasten-Unschärfe ergeben fast eine Gauß-Unschärfe,
// waagerecht und senkrecht getrennt einstellbar
function weichzeichnen(eingabe, b, h, sigmaX, sigmaY) {
  let a = Float32Array.from(eingabe);
  let hilfe = new Float32Array(eingabe.length);

  const durchgaenge = (sigma, verfahren) => {
    if (sigma < 0.6) return;
    const radius = Math.max(1, Math.round(sigma - 0.5));
    for (let n = 0; n < 3; n++) {
      verfahren(a, hilfe, b, h, radius);
      const tausch = a;
      a = hilfe;
      hilfe = tausch;
    }
  };

  durchgaenge(sigmaX, kastenWaagerecht);
  durchgaenge(sigmaY, kastenSenkrecht);
  return a;
}

function kastenWaagerecht(quelle, ziel, b, h, radius) {
  const fenster = 2 * radius + 1;
  for (let y = 0; y < h; y++) {
    const zeile = y * b;
    let summe = quelle[zeile] * (radius + 1);
    for (let i = 1; i <= radius; i++) summe += quelle[zeile + Math.min(i, b - 1)];
    for (let x = 0; x < b; x++) {
      ziel[zeile + x] = summe / fenster;
      summe += quelle[zeile + Math.min(x + 1 + radius, b - 1)] - quelle[zeile + Math.max(x - radius, 0)];
    }
  }
}

function kastenSenkrecht(quelle, ziel, b, h, radius) {
  const fenster = 2 * radius + 1;
  for (let x = 0; x < b; x++) {
    let summe = quelle[x] * (radius + 1);
    for (let i = 1; i <= radius; i++) summe += quelle[Math.min(i, h - 1) * b + x];
    for (let y = 0; y < h; y++) {
      ziel[y * b + x] = summe / fenster;
      summe += quelle[Math.min(y + 1 + radius, h - 1) * b + x] - quelle[Math.max(y - radius, 0) * b + x];
    }
  }
}
