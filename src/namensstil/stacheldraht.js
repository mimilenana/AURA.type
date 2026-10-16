// ------------------------------------------------------------
// STACHELDRAHT (dunkel · hart): Aus dem Projekt "stacheldraht-schrift"
// (Nadel-Schrift) übernommen.
//
// Der Name steht massiv da. Entlang der Kontur sitzen viele "Sterne", und
// aus jedem Stern stehen mehrere dünne Nadeln ab, in zufällige Richtungen
// (meist nach außen) und Längen.
//
//   RUHE      die Nadeln zucken ruckartig in Schritten, wie Stop-Motion
//   AUSBRUCH  an bis zu zwei äußeren Ecken, Spitzen und Kanten (nicht in
//             den Innenräumen von o, e, a) wachsen die Nadeln und viele
//             neue kommen heraus: ein Ausbruch besteht aus 1 bis 3 Stichen,
//             jeweils ruckartig raus, kurz halten, schnell zurück. Die
//             Nadeln richten sich dabei wie Speere nach außen aus. Beim
//             Zurückschnappen bleibt kurz ein Nachbild als Schliere.
//   SPRUNG    jeder Buchstabe springt dazu für sich in zufällige Richtungen, meist
//             ein kleines Stück, manchmal weiter, wie bei Stop-Motion. Nicht im Original.
//
// Anders als im Original werden die Zufallswerte aus der Schrift abgeleitet
// (nicht gewürfelt), und die Ausbrüche stehen von vornherein für jede
// Zeit fest. So sehen Vorschau, Plakat und Archiv bei derselben Zeit
// gleich aus. Alle Größen sind relativ zur Schriftgröße.
//
// Die Zahlen in STACHELDRAHT sind eure Stellschrauben. Die Namen aus der
// main.js des Originals stehen daneben.
// ------------------------------------------------------------

import { alsPfad, rgb, leinwand } from './modi.js';
import { neuAbtasten, gitter } from './verzerrung.js';

const STACHELDRAHT = {
  sternAbstand: 0.018,      // mittlerer Abstand der Sterne auf der Kontur. STAR_SPACING 0.22 pro Pixel, etwa 1 Stern alle 4.5 px
  feinSchritt: 0.0045,      // so fein wird die Kontur zuerst abgetastet; daraus werden zufällig Sterne ausgewählt
  nadelnProStern: 6,        // Anzahl Nadeln pro Stern (im Original "Nadeln pro Stern"); schwankt zwischen 60 % und 140 %
  nadelnSchwankung: [0.6, 1.4],
  nadelKurz: 0.03,          // kürzeste Nadel (Anteil der Schriftgröße). NEEDLE_MIN
  nadelLaenge: 0.125,       // zusätzliche Länge der längsten Nadel. NEEDLE_RANGE
  winkelStreuung: 1.7,      // wie breit die Nadeln um die Außenrichtung streuen (Bogenmaß). ANGLE_SPREAD
  nadelDickeMin: 0.0022,    // dünnste Breite am Fuß einer Nadel (Anteil der Schriftgröße)
  nadelDicke: 0.045,        // Breite am Fuß einer Nadel im Verhältnis zu ihrer Länge
  zusatzNadeln: 3,          // zusätzliche Nadeln pro Stern, die nur im Ausbruch erscheinen. EXTRA_NEEDLES
  laengeFaktor: 1,          // alle Nadeln länger oder kürzer (im Original der Regler "Länge")
  bewegung: 0.6,            // wie stark die Nadeln in der Ruhe zucken (im Original der Regler "Bewegung")

  sprungBilder: 5,          // so oft pro Sekunde springt jeder Buchstabe an eine neue Stelle (nicht im Original)
  sprungWeite: 0.018,       // wie weit er höchstens springt, in zufällige Richtung (Anteil der Schriftgröße)
  sprungMindestens: 0.3,    // so weit springt er mindestens (Anteil der größten Weite)
  sprungGross: 0.1,         // so oft ist ein Sprung ein großer
  sprungGrossFaktor: 1.8,   // und so viel weiter als ein normaler
  sprungRuhe: 0.25,         // so oft bleibt ein Buchstabe kurz an seinem Platz
  ruheBilder: 10,           // so oft pro Sekunde zucken sie. IDLE_FPS (im Original 12)

  gleichzeitig: 2,          // so viele Ausbrüche laufen höchstens gleichzeitig. BURST_MAX
  radius: [0.22, 0.42],     // Größe der Ausbruchsstelle (Anteil der Schriftgröße). BURST_RADIUS
  stellenAnteil: 0.16,      // Anteil der Konturpunkte, die als Ausbruchsstelle in Frage kommen (die äußersten). BURST_SPOTS
  messRadius: 0.11,         // Umkreis, in dem gemessen wird, wie frei ein Punkt nach außen liegt. EXPOSURE_RADIUS
  stiche: [1, 3],           // Stiche pro Ausbruch. STAB_COUNT
  stichRaus: [0.035, 0.06], // Sekunden, bis die Nadeln voll draußen sind (kurz = zackig). STAB_OUT
  stichHalten: [0.12, 0.40], // so lange bleiben sie draußen. STAB_HOLD
  stichZurueck: [0.05, 0.09], // Sekunden zurück. STAB_BACK
  stichPause: [0.04, 0.14], // Pause zwischen zwei Stichen. STAB_GAP
  speer: 0.8,               // wie stark sich Nadeln beim Stich nach außen ausrichten (0 = gar nicht, 1 = ganz). SPEAR
  pause: [0.6, 3.2],        // Pause bis zum nächsten Ausbruch einer Spur in Sekunden. BURST_PAUSE
  wachsen: 3.0,             // um wie viel vorhandene Nadeln im Ausbruch länger werden (3 = vierfach). BURST_GROW
  zusatzLaenge: 3.6,        // wie lang die zusätzlichen Nadeln werden (Vielfaches der normalen Länge). BURST_EXTRA
  nachbild: 0.28,           // Deckkraft des Nachbilds beim Zurückschnappen
  nachbildZeit: 0.03,       // so viele Sekunden zurück liegt das Nachbild
  zittern: 0.1,             // wie stark die Länge im ausgefahrenen Zustand ruckelt
  zitterBilder: 28,         // so oft pro Sekunde
  erstesMal: 0.8,           // so viele Sekunden dauert es bis zum ersten Ausbruch
  aufloesung: 0.4,          // Größe der Maske, mit der die äußeren Stellen gesucht werden
};

const KREIS = Math.PI * 2;
const klemme = (wert, klein, gross) => Math.min(gross, Math.max(klein, wert));
const winkelDifferenz = (a, b) => {
  let d = (a - b) % KREIS;
  if (d > Math.PI) d -= KREIS;
  if (d < -Math.PI) d += KREIS;
  return d;
};

export function bereite(eintrag, bereich) {
  const u = eintrag.u;
  const seed = eintrag.seed & 0xffff;

  // Jeder Buchstabe springt für sich, deshalb gehören Sterne und Pfad zu einem Buchstaben.
  // Gibt es keine einzelnen Buchstaben, ist das ganze Wort ein Teil.
  const buchstaben = eintrag.buchstaben ? eintrag.buchstaben.filter(b => b.konturen.length) : [{ konturen: eintrag.konturen }];
  const sterne = baueSterne(buchstaben, eintrag, bereich, seed);
  const stellen = findeStellen(eintrag, bereich, sterne);
  const teile = buchstaben.map((buchstabe, nr) => ({
    nr,
    pfad: alsPfad(buchstabe.konturen, bereich),
    sterne: [],
    phase: gitter(nr, 1, seed) * 10,       // damit nicht alle Buchstaben im selben Takt springen
  }));
  sterne.forEach((stern, nr) => teile[stern.teil].sterne.push(nr));

  return {
    u, seed, bereich, sterne, stellen, teile,
    spuren: Array.from({ length: STACHELDRAHT.gleichzeitig }, (_, nr) => ({
      liste: [], naechsterStart: STACHELDRAHT.erstesMal + nr * 0.9, zaehler: 0, nr,
    })),
  };
}

// Sterne: zufällig ausgewählte Punkte auf der Kontur, jeder mit seinen Nadeln
function baueSterne(buchstaben, eintrag, bereich, seed) {
  const u = eintrag.u;
  const fein = u * STACHELDRAHT.feinSchritt;
  const behalten = STACHELDRAHT.feinSchritt / STACHELDRAHT.sternAbstand;
  const glaettung = Math.max(2, Math.round(0.014 * u / fein));     // Normale aus Punkten ein Stück vorher und nachher
  const sterne = [];
  let nr = 0;

  buchstaben.forEach((buchstabe, teil) => { for (const kontur of buchstabe.konturen) {
    const punkte = neuAbtasten(kontur, fein);
    const anzahl = punkte.length;
    for (let i = 0; i < anzahl; i++) {
      nr++;
      let zaehler = 0;
      const zufall = () => gitter(nr, ++zaehler, seed);
      const zwischen = ([klein, gross]) => klein + (gross - klein) * zufall();
      if (zufall() > behalten) continue;

      // Außenrichtung: senkrecht zur Kontur, von der Farbe weg
      const davor = punkte[(i - glaettung + anzahl) % anzahl], danach = punkte[(i + glaettung) % anzahl];
      const tx = danach.x - davor.x, ty = danach.y - davor.y, laenge = Math.hypot(tx, ty) || 1;
      const nx = ty / laenge * eintrag.richtung, ny = -tx / laenge * eintrag.richtung;
      const grund = Math.atan2(ny, nx);

      const nadeln = [];
      const menge = Math.max(2, Math.round(STACHELDRAHT.nadelnProStern * zwischen(STACHELDRAHT.nadelnSchwankung)));
      const nadel = (streuung, potenz, zusatz) => ({
        winkel: grund + (zufall() + zufall() - 1) * streuung,
        laenge: STACHELDRAHT.nadelKurz + STACHELDRAHT.nadelLaenge * Math.pow(zufall(), potenz),
        tempo: 0.6 + zufall(),
        seed: Math.floor(zufall() * 1e6),
        zusatz,
      });
      for (let k = 0; k < menge; k++) nadeln.push(nadel(STACHELDRAHT.winkelStreuung, 1.7, false));
      // erscheinen nur während eines Ausbruchs
      for (let k = 0; k < STACHELDRAHT.zusatzNadeln; k++) nadeln.push(nadel(STACHELDRAHT.winkelStreuung * 1.15, 1.2, true));

      // der Stern sitzt minimal in der Schrift, damit die Nadeln nicht abgelöst aussehen
      const innen = u * 0.006 * zufall();
      sterne.push({
        x: punkte[i].x - bereich.x - nx * innen, y: punkte[i].y - bereich.y - ny * innen,
        grund, nadeln, aussen: 0, teil,
      });
    }
  } });
  return sterne;
}

// Ausbruchsstellen: die Sterne, die weit nach AUSSEN frei liegen (Ecken, Spitzen, Ober- und Unterkanten).
// Innenräume (die Löcher in o, e, a) zählen nicht: nur Fläche, die mit dem Rand verbunden ist.
function findeStellen(eintrag, bereich, sterne) {
  const aufl = STACHELDRAHT.aufloesung;
  const b = Math.max(2, Math.round(bereich.b * aufl)), h = Math.max(2, Math.round(bereich.h * aufl));
  const flaeche = leinwand(b, h);
  const fc = flaeche.getContext('2d');
  fc.fillStyle = '#fff';
  fc.fill(alsPfad(eintrag.konturen, bereich, aufl), 'nonzero');
  const daten = fc.getImageData(0, 0, b, h).data;
  const innen = (x, y) => daten[(y * b + x) * 4 + 3] > 127;

  // vom Rand aus alles Leere markieren, das mit dem Rand zusammenhängt
  const draussen = new Uint8Array(b * h);
  const stapel = new Int32Array(b * h);
  let obenAufStapel = 0;
  const anlegen = (x, y) => {
    const nr = y * b + x;
    if (draussen[nr] || innen(x, y)) return;
    draussen[nr] = 1;
    stapel[obenAufStapel++] = nr;
  };
  for (let x = 0; x < b; x++) { anlegen(x, 0); anlegen(x, h - 1); }
  for (let y = 0; y < h; y++) { anlegen(0, y); anlegen(b - 1, y); }
  while (obenAufStapel) {
    const nr = stapel[--obenAufStapel], x = nr % b, y = (nr / b) | 0;
    if (x > 0) anlegen(x - 1, y);
    if (x < b - 1) anlegen(x + 1, y);
    if (y > 0) anlegen(x, y - 1);
    if (y < h - 1) anlegen(x, y + 1);
  }

  // wie viel vom Umkreis jedes Sterns liegt "draußen"?
  const radius = Math.max(3, Math.round(eintrag.u * STACHELDRAHT.messRadius * aufl));
  for (const stern of sterne) {
    let aussen = 0, alle = 0;
    for (let dy = -radius; dy <= radius; dy += 2) {
      for (let dx = -radius; dx <= radius; dx += 2) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const x = Math.round(stern.x * aufl) + dx, y = Math.round(stern.y * aufl) + dy;
        alle++;
        if (x < 0 || y < 0 || x >= b || y >= h || draussen[y * b + x]) aussen++;
      }
    }
    stern.aussen = alle ? aussen / alle : 0;
  }
  return sterne.slice().sort((a, c) => c.aussen - a.aussen)
    .slice(0, Math.max(12, Math.round(sterne.length * STACHELDRAHT.stellenAnteil)));
}

export function zeichne(ctx, d, zeit, farben, staerke) {
  const farbe = rgb(farben.vorne);
  const laengeSkala = d.u * STACHELDRAHT.laengeFaktor;
  const ruheZeit = Math.floor(zeit * STACHELDRAHT.ruheBilder) / STACHELDRAHT.ruheBilder;
  const aktive = staerke > 0.02 ? aktiveAusbrueche(d, zeit) : [];

  // Sterne an einer Ausbruchsstelle zeichnet die Ausbruchsebene, nicht die ruhige
  const festgehalten = new Set();
  for (const ausbruch of aktive) for (const nr of mitglieder(d, ausbruch)) festgehalten.add(nr);

  ctx.save();
  ctx.fillStyle = farbe;
  for (const teil of d.teile) {
    // jeder Buchstabe springt für sich: Schrift, Nadeln und Ausbrüche wandern gemeinsam mit
    const versatz = sprung(d, teil, zeit, staerke);
    ctx.save();
    ctx.translate(d.bereich.x + versatz.x, d.bereich.y + versatz.y);

    ctx.fill(teil.pfad, 'nonzero');
    const pfad = new Path2D();
    for (const nr of teil.sterne) {
      if (festgehalten.has(nr)) continue;
      const stern = d.sterne[nr];
      for (const nadel of stern.nadeln) if (!nadel.zusatz) fuegeNadelHinzu(pfad, d, stern, nadel, ruheZeit, laengeSkala, 0, null, 0);
    }
    ctx.fill(pfad);

    for (const ausbruch of aktive) if (ausbruch.teil === teil.nr) zeichneAusbruch(ctx, d, ausbruch, zeit, staerke, ruheZeit, laengeSkala);
    ctx.restore();
  }
  ctx.restore();
}

// Wohin ein Buchstabe gerade gesprungen ist: alle sprungBilder pro Sekunde eine neue Stelle in einer
// zufälligen Richtung, meist ein kleines Stück, manchmal weiter, manchmal bleibt er stehen.
// Der Wert hängt nur von der Zeit ab, deshalb sieht jedes Bild bei derselben Zeit gleich aus.
function sprung(d, teil, zeit, staerke) {
  const schritt = Math.floor(zeit * STACHELDRAHT.sprungBilder + teil.phase);
  const zufall = (m) => gitter(teil.nr * 53 + m, schritt, d.seed);
  if (zufall(1) < STACHELDRAHT.sprungRuhe) return { x: 0, y: 0 };
  const richtung = zufall(2) * KREIS;
  let weite = d.u * STACHELDRAHT.sprungWeite * (STACHELDRAHT.sprungMindestens + (1 - STACHELDRAHT.sprungMindestens) * zufall(3));
  if (zufall(4) < STACHELDRAHT.sprungGross) weite *= STACHELDRAHT.sprungGrossFaktor;
  weite *= staerke;
  return { x: Math.cos(richtung) * weite, y: Math.sin(richtung) * weite };
}

// Ein Ausbruch: die Nadeln an der Stelle, mit Nachbild beim Zurückschnappen
function zeichneAusbruch(ctx, d, ausbruch, zeit, staerke, ruheZeit, laengeSkala) {
  const jetzt = huelle(ausbruch, zeit - ausbruch.start);
  const frueher = huelle(ausbruch, zeit - ausbruch.start - STACHELDRAHT.nachbildZeit);
  // im ausgefahrenen Zustand ruckelt die Länge
  const zitter = jetzt > 0.5 ? 1 + STACHELDRAHT.zittern * (gitter(ausbruch.seed, Math.floor(zeit * STACHELDRAHT.zitterBilder), 3) - 0.5) : 1;
  // beim Zurückschnappen: Schlieren-Nachbild
  if (frueher > jetzt + 0.02) {
    ctx.globalAlpha = STACHELDRAHT.nachbild;
    ctx.fill(ausbruchPfad(d, ausbruch, frueher * ausbruch.spitze * staerke, ruheZeit, laengeSkala));
    ctx.globalAlpha = 1;
  }
  ctx.fill(ausbruchPfad(d, ausbruch, jetzt * ausbruch.spitze * staerke * zitter, ruheZeit, laengeSkala));
}

// Eine Nadel als dünnes Dreieck vom Stern nach außen. g: wie stark der Ausbruch hier wirkt (0 = ruhig).
// ausbruch: die Stelle, nach der sich die Nadeln beim Stich ausrichten; zug: wie stark.
function fuegeNadelHinzu(pfad, d, stern, nadel, ruheZeit, laengeSkala, g, ausbruch, zug) {
  const schritt = Math.floor(ruheZeit * nadel.tempo * 7);
  const puls = 1 + 0.5 * STACHELDRAHT.bewegung * (gitter(nadel.seed, schritt, 5) - 0.5);
  let winkel = nadel.winkel + 0.4 * STACHELDRAHT.bewegung * (gitter(nadel.seed + 77, schritt, 5) - 0.5);
  // Speer: Nadeln richten sich nach außen aus
  if (ausbruch) winkel += winkelDifferenz(ausbruch.richtung + winkelDifferenz(nadel.winkel, stern.grund) * 0.3, winkel) * zug;
  const laenge = nadel.laenge * laengeSkala * puls * (nadel.zusatz ? STACHELDRAHT.zusatzLaenge * g : 1 + STACHELDRAHT.wachsen * g);
  const breite = Math.max(d.u * STACHELDRAHT.nadelDickeMin, laenge * STACHELDRAHT.nadelDicke);
  const c = Math.cos(winkel), s = Math.sin(winkel);
  pfad.moveTo(stern.x - s * breite, stern.y + c * breite);
  pfad.lineTo(stern.x + c * laenge, stern.y + s * laenge);
  pfad.lineTo(stern.x + s * breite, stern.y - c * breite);
  pfad.closePath();
}

// Nadeln einer Ausbruchsstelle zu einem Zeitpunkt (k = Stärke des Stichs)
function ausbruchPfad(d, ausbruch, k, ruheZeit, laengeSkala) {
  const pfad = new Path2D();
  for (const nr of mitglieder(d, ausbruch)) {
    const stern = d.sterne[nr];
    // in der Mitte der Stelle am stärksten, zum Rand hin weich auslaufend
    const abstand = Math.hypot(stern.x - ausbruch.x, stern.y - ausbruch.y);
    const nah = Math.max(0, 1 - abstand / ausbruch.radius);
    const wirkung = k * nah * nah * (3 - 2 * nah);
    const g = Math.min(wirkung, 2.5), zug = Math.min(1, wirkung * 1.6) * STACHELDRAHT.speer;
    for (const nadel of stern.nadeln) {
      if (nadel.zusatz && g < 0.02) continue;
      fuegeNadelHinzu(pfad, d, stern, nadel, ruheZeit, laengeSkala, g, g > 0 ? ausbruch : null, zug);
    }
  }
  return pfad;
}

// Die Sterne, die zu einem Ausbruch gehören (alle in seinem Radius), einmal bestimmt und gemerkt
function mitglieder(d, ausbruch) {
  if (!ausbruch.mitglieder) {
    ausbruch.mitglieder = [];
    const rr = ausbruch.radius * ausbruch.radius;
    d.sterne.forEach((stern, nr) => {
      const dx = stern.x - ausbruch.x, dy = stern.y - ausbruch.y;
      if (stern.teil === ausbruch.teil && dx * dx + dy * dy < rr) ausbruch.mitglieder.push(nr);
    });
  }
  return ausbruch.mitglieder;
}

// Verlauf eines Ausbruchs: harter Stoß nach außen (schnell abbremsend), Halten, Zurückschnappen (beschleunigend)
function huelle(ausbruch, zeitImAusbruch) {
  let wert = 0;
  for (const stich of ausbruch.stiche) {
    const x = zeitImAusbruch - stich.start;
    if (x < 0) continue;
    let v = 0;
    if (x < stich.raus) v = 1 - Math.pow(1 - x / stich.raus, 4);                                   // Stoß: am Anfang sehr schnell
    else if (x < stich.raus + stich.halten) v = 1;                                                // gehalten
    else if (x < stich.raus + stich.halten + stich.zurueck) {
      const anteil = (x - stich.raus - stich.halten) / stich.zurueck;
      v = 1 - anteil * anteil * anteil;                                                          // zurück: wird schneller
    }
    wert = Math.max(wert, v * stich.kraft);
  }
  return wert;
}

// Die Ausbrüche, die zu dieser Zeit laufen. Jede Spur würfelt ihre Ausbrüche nacheinander
// (Pause, Ausbruch, Pause ...) aus dem Seed der Schrift, so sind sie für jede Zeit festgelegt.
function aktiveAusbrueche(d, zeit) {
  const aktive = [];
  if (!d.stellen.length) return aktive;     // kein Wort, keine Stellen
  for (const spur of d.spuren) {
    while (spur.naechsterStart <= zeit) erzeugeAusbruch(d, spur);
    for (let i = spur.liste.length - 1; i >= 0; i--) {
      const ausbruch = spur.liste[i];
      if (ausbruch.start > zeit) continue;
      if (zeit < ausbruch.start + ausbruch.dauer + 0.05) aktive.push(ausbruch);
      break;
    }
  }
  return aktive;
}

function erzeugeAusbruch(d, spur) {
  const nr = spur.liste.length;
  const zufall = (m) => gitter(nr * 31 + spur.nr * 1009 + m, 11, d.seed);
  const zwischen = ([klein, gross], m) => klein + (gross - klein) * zufall(m);

  // Stiche planen: jeder raus, halten, zurück, mit kleinen Pausen dazwischen
  const stiche = [];
  let zeitpunkt = 0;
  const anzahl = Math.round(zwischen(STACHELDRAHT.stiche, 1));
  for (let i = 0; i < anzahl; i++) {
    const stich = {
      start: zeitpunkt,
      raus: zwischen(STACHELDRAHT.stichRaus, 10 + i * 5),
      halten: zwischen(STACHELDRAHT.stichHalten, 11 + i * 5) * (i === anzahl - 1 ? 1 : 0.5),
      zurueck: zwischen(STACHELDRAHT.stichZurueck, 12 + i * 5),
      kraft: i === 0 ? 1 : 0.7 + 0.3 * zufall(13 + i * 5),
    };
    stiche.push(stich);
    zeitpunkt += stich.raus + stich.halten + stich.zurueck + zwischen(STACHELDRAHT.stichPause, 14 + i * 5);
  }

  const stelle = d.stellen[Math.floor(zufall(2) * d.stellen.length)];
  const ausbruch = {
    id: `${spur.nr}-${nr}`, start: spur.naechsterStart, dauer: zeitpunkt, stiche,
    x: stelle.x, y: stelle.y, richtung: stelle.grund, teil: stelle.teil,
    radius: d.u * zwischen(STACHELDRAHT.radius, 3),
    seed: Math.floor(zufall(4) * 1e6), spitze: 0.8 + 0.2 * zufall(5),
    mitglieder: null,
  };
  spur.liste.push(ausbruch);
  spur.naechsterStart = ausbruch.start + ausbruch.dauer + zwischen(STACHELDRAHT.pause, 6);
}
