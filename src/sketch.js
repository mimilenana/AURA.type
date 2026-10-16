// START HERE.
//
// Namensstil: Ein Name wird nach seinem Klang analysiert.
// Er landet in genau einem von vier Modi, und jeder Modus ist
// eine eigene Animation:
//
//                 weich                         hart
//   hell      Bänder: weiche Konturlinien,  Quadrate: der Name zerfällt in
//             Schweif, körnig              Pixel-Quadrate, die durcheinanderspringen
//   dunkel    Thermo: der Name glüht wie    Stacheldraht: Nadeln zucken an der
//             im Wärmebild                  Kontur und brechen als Speere aus
//
// Schriftstärke und Laufweite sind für alle Namen gleich (stil.js).
//
// Oberfläche: index.html (Aufbau), src/oberflaeche.css (Aussehen), hier die Verdrahtung.
//             Oben die Eingabe, darunter drei Fenster: links die Einstellungen, in der Mitte
//             die Animation im Story-Format (9:16), rechts die Analyse des Namens.
// Export:     Video der Story (1080 x 1920, Länge einstellbar) oder ein PNG vom aktuellen Moment.
//             Die Buchstaben stehen dafür abwechselnd links und rechts versetzt untereinander.
//
// Wo was liegt:
//   src/namensstil/analyse.js      -> welche Buchstaben wie klingen
//   src/namensstil/namen.js        -> Eichliste: legt fest, wo die Grenzen liegen
//   src/namensstil/modi.js         -> welcher Klang welcher Modus ist
//   src/namensstil/farben.js       -> die vier Farbmodi für helle und dunkle Namen
//   src/namensstil/baender.js      -> hell · weich
//   src/namensstil/quadrate.js     -> hell · hart
//   src/namensstil/thermo.js       -> dunkel · weich
//   src/namensstil/stacheldraht.js -> dunkel · hart
//   src/namensstil/gpu.js          -> Shader auf der Grafikkarte (für Thermo) und Weichzeichner
//   src/namensstil/stil.js         -> Schriftstärke und Laufweite
//   src/namensstil/wort.js         -> setzt die Buchstaben
//   src/namensstil/schriftdatei.js -> liest die Umrisse aus der Schriftdatei
//   src/namensstil/alt/            -> frühere Versuche, nicht mehr benutzt
//
// Einmalig im Terminal ausführen:  npm install opentype.js
//
// Note: this is p5 version 2. If you find a tutorial that uses `preload()`,
// it is written for p5 version 1 and will not work here. See the README.

import p5 from 'p5';
import './oberflaeche.css';
import { startingText } from './config.js';
import { fontOptions } from './lib/font/fonts.js';

import { analysiereName } from './namensstil/analyse.js';
import { setzeVersetzt, setzeZeilen } from './namensstil/wort.js';
import { ladeSchrift, konturenVon, istVariabel } from './namensstil/schriftdatei.js';
import { typoFuer } from './namensstil/stil.js';
import { MODI, modusFuer, bereiteModus, zeichneModus, bereicheFuer } from './namensstil/modi.js';
import { FARBMODI, farbenFuer } from './namensstil/farben.js';

// Die Schriftdatei im Ordner fonts/ (Dateiname ohne Endung). Über die Schriftliste von Vite wird sie
// beim Bauen mit ins Ergebnis kopiert; ein einfacher Pfad wie 'fonts/...' fände sie dort nicht mehr.
const SCHRIFT_NAME = 'NotoSans-VariableFont_wdth,wght';
const SCHRIFT = fontOptions[SCHRIFT_NAME];

// Auf dem Handy: so breit ist die Animation im Verhältnis zum Namensfenster darüber (1 = gleich breit)
const ANIMATION_ANTEIL = 0.78;

// Format der Instagram-Story: 9:16
const STORY_BREITE = 1080, STORY_HOEHE = 1920;

// Video: Bilder pro Sekunde und Qualität. Die Typen sind nach Wunsch geordnet:
// MP4 mit H.264 nimmt Instagram direkt an, WebM müsste erst in MP4 umgewandelt werden.
const VIDEO_BILDER = 30;
const VIDEO_BITRATE = 12_000_000;
const VIDEO_TYPEN = [
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];
// unter so vielen Bildern pro Sekunde ruckelt das Video merklich
const VIDEO_BILDER_MINDESTENS = 24;

// Die Schrift der Oberfläche (dieselbe wie in oberflaeche.css), auch für Text im Bild
const OBERFLAECHENSCHRIFT = '"Space Mono", ui-monospace, Menlo, monospace';

// Körnung des Hintergrunds: ein Bild aus zufällig verteilten schwarzen Punkten, das sich wiederholt.
// Es ist nach einem festen Startwert gewürfelt, sieht also bei jedem Laden gleich aus.
const KOERNUNG_GROESSE = 256;      // Kantenlänge des wiederholten Bildes in Pixeln
const KOERNUNG_DICHTE = 0.08;      // Anteil der schwarzen Pixel
const KOERNUNG_START = 1990;       // Startwert des Zufalls

// Die Werte, die die Oberfläche verändert.
const uiParams = {
  text: startingText,
  automatik: true,        // an: Klang des Namens wählt den Modus, aus: Modus von Hand
  modus: MODI[0],         // der Modus, wenn "Name steuert" aus ist
  farbmodus: FARBMODI[0], // eine von vier Farbwelten, jeweils für helle und für dunkle Namen (farben.js)
  geschwindigkeit: 1,     // wie schnell die Animation läuft (Einstellungen im Control Tool)
  intensitaet: 1,         // wie heftig sie ist
  nebeneinander: false,   // an: die Buchstaben stehen als Wort in einer Zeile, aus: verteilt über die Fläche
  textgroesse: 1,         // Größe der Buchstaben: 1 = so groß wie möglich, kleiner = schrumpfen, bis 2 = doppelt so groß (überschneiden sich)
  videoSekunden: 10,      // so lang wird das Video
};

let schrift = null;
let fehler = '';
let zeit = 0;                   // Zeit der Animation in Sekunden

// Die vorbereitete Animation
let storyModi = [];
let storyStand = '';

// Läuft gerade eine Videoaufnahme? Sonst null.
let aufnahme = null;


// ---------- p5 ----------

window.setup = async function setup() {
  const masse = leinwandMasse();
  createCanvas(masse.b, masse.h);
  // die Zeichenfläche gehört in das mittlere Fenster
  document.getElementById('leinwand').appendChild(drawingContext.canvas);

  // loading a font takes a moment, so we wait for it before drawing
  try {
    schrift = await ladeSchrift(SCHRIFT);
    if (!istVariabel(schrift)) {
      console.warn('Die Schrift ist kein variabler Font: die Schriftstärke aus stil.js wird nicht angewendet.');
    }
  } catch (e) {
    fehler = `Schrift nicht gefunden: ${SCHRIFT_NAME}\nDateinamen in sketch.js (SCHRIFT_NAME) prüfen.`;
    console.warn(fehler, e);
  }
};

window.draw = function draw() {
  const bg = farben().hinten;
  background(bg.r, bg.g, bg.b);

  if (fehler) return zeigeText(fehler, color(200, 0, 0));
  if (!schrift) return;

  // Die Animation läuft immer weiter. Bei der Aufnahme zählt die echte Zeit, sonst würde das Video
  // in Zeitlupe laufen, wenn der Rechner nicht mitkommt; sonst gilt eine Obergrenze gegen Sprünge.
  const dt = aufnahme ? deltaTime : Math.min(deltaTime, 100);
  zeit += (dt / 1000) * uiParams.geschwindigkeit;

  // bei "Name steuert" zeigt die Auswahl den Modus des Namens
  if (uiParams.automatik) uiParams.modus = modusVon(name());

  aktualisiereAufnahme();
  zeichneStory();
  aktualisiereOberflaeche();
};

window.windowResized = function windowResized() {
  const masse = leinwandMasse();
  resizeCanvas(masse.b, masse.h);
  storyStand = '';
};

// So groß wie möglich im mittleren Fenster, im Story-Format (9:16): die Höhe ist die freie Höhe
// unter dem Namensfenster, die Breite folgt daraus. Auf schmalen Bildschirmen bestimmt die Breite.
function leinwandMasse() {
  const fenster = document.getElementById('fenster-animation');
  const titel = fenster.querySelector('.titel').offsetHeight;
  const oben = fenster.getBoundingClientRect().top + window.scrollY;     // Oberkante des Animationsfensters
  const reserve = 44 + 4;                                                // Abstand unten mit Schatten, Rahmen
  let h = window.innerHeight - oben - titel - reserve;
  if (window.innerWidth > 1300) {
    // die beiden anderen Spalten (Einstellungen 280, rechts 330 mit Versatz) und die Abstände brauchen Platz, den Rest bekommt die Animation
    const breiteFrei = window.innerWidth - (280 + 330 + 2 * 36 + 2 * 36) - 30;
    h = Math.min(h, breiteFrei * STORY_HOEHE / STORY_BREITE);
  }
  if (window.innerWidth <= 1300) {
    let breite;
    if (window.innerWidth > 700) {
      // mittlere Breite: rechts neben der Animation stehen die Fenster (360 Pixel), den Rest bekommt die Animation
      breite = Math.min(600, window.innerWidth - 2 * 20 - 28 - 360 - 4 - 6);
    } else {
      // Handy: etwas schmaler als das Namensfenster darüber (ANIMATION_ANTEIL), alles steht untereinander
      breite = (document.getElementById('fenster-name').getBoundingClientRect().width - 4) * ANIMATION_ANTEIL;
    }
    // Auf die Fensterhöhe wird nicht geachtet, die Seite lässt sich scrollen.
    return { b: Math.round(breite), h: Math.round(breite * STORY_HOEHE / STORY_BREITE) };
  }
  h = Math.max(320, Math.round(h));
  return { b: Math.round(h * STORY_BREITE / STORY_HOEHE), h };
}


// ---------- Gemeinsame Helfer ----------

function macheLeinwand(b, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(b));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function name() {
  return String(uiParams.text).trim() || 'Name';
}

// Die Farben des Namens: Farbwelt (Farbmodus) und Modus bestimmen zusammen Schrift, Hintergrund und Verlauf
function farben() {
  return farbenFuer(modusVon(name()), uiParams.farbmodus);
}

// In welchem Modus der Name ist: aus dem Klang oder von Hand gewählt
function modusVon(text) {
  if (!uiParams.automatik) return uiParams.modus;
  const a = analysiereName(text);
  return modusFuer(a.haerte, a.helligkeit);
}

// Teil des "Stands": ändert sich etwas davon, wird neu vorbereitet
function modusStand() {
  return `${uiParams.automatik}|${uiParams.modus}`;
}

// Konturen für einen Text, immer in derselben Stärke und Laufweite
function konturenFuer(t) {
  return konturenVon(schrift, t, typoFuer());
}

// Setzt den Namen und bereitet seinen Modus vor
function bereiteZeilen(zeilenTexte, b, h, optionen) {
  // nebeneinander: der Name als normale Zeile, in der Mitte; sonst die Buchstaben verteilt über die Fläche
  const zeilen = optionen.nebeneinander
    ? setzeZeilen(zeilenTexte, konturenFuer, b, h, optionen)
    : setzeVersetzt(zeilenTexte[0], konturenFuer, b, h, optionen);
  const bereiche = bereicheFuer(zeilen, b, h);
  return zeilen.map((z, i) => bereiteModus(modusVon(z.text), z, bereiche[i]));
}

// Ein Bild der Animation: Hintergrund, dann der Name in seinem Modus
function zeichneBild(ctx, vorbereitet, b, h, zeitpunkt) {
  const f = farben();
  const bg = f.hinten;
  ctx.save();
  ctx.fillStyle = `rgb(${bg.r}, ${bg.g}, ${bg.b})`;
  ctx.fillRect(0, 0, b, h);
  for (const v of vorbereitet) zeichneModus(ctx, v, zeitpunkt, f, uiParams.intensitaet);
  ctx.restore();
}

// Rechnet ein einzelnes Bild auf ein neues Canvas (für den PNG-Export)
function standbild(zeilenTexte, b, h, optionen, zeitpunkt) {
  const bild = macheLeinwand(b, h);
  zeichneBild(bild.getContext('2d'), bereiteZeilen(zeilenTexte, b, h, optionen), b, h, zeitpunkt);
  return bild;
}

// Speichert eine Datei im Download-Ordner des Browsers
function speichereDatei(blob, dateiname) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = dateiname;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function dateiname(zusatz, endung = 'png') {
  const text = name().toLowerCase().replace(/[^a-z0-9äöüß-]/g, '');
  return `namensstil-${text}${zusatz ? '-' + zusatz : ''}.${endung}`;
}

// Kurzer Hinweis in der Statuszeile des Einstellungsfensters
let statusTimer = null;
function sage(text, sekunden = 4) {
  const zeile = document.getElementById('status');
  zeile.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { zeile.textContent = ''; }, sekunden * 1000);
}


// ---------- Die Animation ----------

function storyOptionen() {
  if (uiParams.nebeneinander) {
    // eine Zeile über die Breite; Textgröße wirkt wie sonst als Faktor (bei mehr als 100 % ragt das Wort über den Rand)
    return { nebeneinander: true, ueberlappung: 0, rand: 0.2, anteilBreite: 0.92 * uiParams.textgroesse, maxGroesse: 1e9 };
  }
  return { versetzt: true, rand: 0.06, groesse: uiParams.textgroesse };
}

function zeichneStory() {
  if (aufnahme) {
    // Während der Aufnahme sieht man genau das Bild, das ins Video geht (klein gezeichnet)
    drawingContext.drawImage(aufnahme.flaeche, 0, 0, width, height);
    zeigeAufnahmeAnzeige();
    return;
  }

  // Namen neu setzen und vorbereiten, wenn sich Text, Größe oder Modus geändert haben
  const stand = `${name()}|${width}x${height}|${modusStand()}|${uiParams.textgroesse}|${uiParams.nebeneinander}`;
  if (stand !== storyStand) {
    storyModi = bereiteZeilen([name()], width, height, storyOptionen());
    storyStand = stand;
  }
  zeichneBild(drawingContext, storyModi, width, height, zeit);
}


// ---------- Video aufnehmen ----------

// Das Video wird in Story-Größe (1080 x 1920) auf einer eigenen Fläche gezeichnet. Der Browser nimmt
// diese Fläche mit 30 Bildern pro Sekunde auf (MediaRecorder). Gerechnet wird in Echtzeit: schafft der
// Rechner die Bilder nicht schnell genug, ruckelt das Video, läuft aber nicht in Zeitlupe.

function starteAufnahme() {
  if (!schrift) return;
  if (typeof MediaRecorder === 'undefined') {
    return sage('Dieser Browser kann kein Video aufnehmen. Bitte Chrome oder Safari benutzen.', 6);
  }
  const typ = VIDEO_TYPEN.find(t => MediaRecorder.isTypeSupported(t));
  if (!typ) return sage('Dieser Browser kann kein Video in einem passenden Format aufnehmen.', 6);

  const flaeche = macheLeinwand(STORY_BREITE, STORY_HOEHE);
  const modi = bereiteZeilen([name()], STORY_BREITE, STORY_HOEHE, storyOptionen());
  zeit = 0;                                    // jede Aufnahme beginnt von vorn
  zeichneBild(flaeche.getContext('2d'), modi, STORY_BREITE, STORY_HOEHE, zeit);   // erstes Bild, damit der Strom nicht leer startet

  const aufnehmer = new MediaRecorder(flaeche.captureStream(VIDEO_BILDER), { mimeType: typ, videoBitsPerSecond: VIDEO_BITRATE });
  const stuecke = [];
  aufnehmer.ondataavailable = e => { if (e.data.size) stuecke.push(e.data); };
  aufnehmer.onstop = () => speichereVideo(stuecke, typ);

  aufnahme = { aufnehmer, flaeche, modi, typ, laeuft: true, bilder: 0, sekunden: uiParams.videoSekunden };
  aufnehmer.start();
  sage(`Aufnahme läuft (${uiParams.videoSekunden} s) ...`, uiParams.videoSekunden + 1);
}

// jedes Bild während der Aufnahme: neu zeichnen und prüfen, ob die Zeit um ist
function aktualisiereAufnahme() {
  if (!aufnahme || !aufnahme.laeuft) return;
  zeichneBild(aufnahme.flaeche.getContext('2d'), aufnahme.modi, STORY_BREITE, STORY_HOEHE, zeit);
  aufnahme.bilder++;
  if (zeit >= aufnahme.sekunden) beendeAufnahme();
}

function beendeAufnahme() {
  if (!aufnahme || !aufnahme.laeuft) return;
  aufnahme.laeuft = false;
  aufnahme.dauer = Math.max(zeit, 0.001);
  aufnahme.aufnehmer.stop();                   // danach ruft der Browser speichereVideo auf
}

function speichereVideo(stuecke, typ) {
  const endung = typ.startsWith('video/mp4') ? 'mp4' : 'webm';
  speichereDatei(new Blob(stuecke, { type: typ.split(';')[0] }), dateiname('story', endung));

  const bilderProSekunde = Math.min(VIDEO_BILDER, Math.round(aufnahme.bilder / aufnahme.dauer));
  let text = `Video gespeichert (${endung}, ${bilderProSekunde} Bilder pro Sekunde)`;
  if (endung === 'webm') text += ' - für Instagram in MP4 umwandeln';
  else if (bilderProSekunde < VIDEO_BILDER_MINDESTENS) text += ' - Rechner zu langsam, das Video ruckelt';
  aufnahme = null;
  sage(text, 7);
}

// roter Punkt und Zeit oben links, nur in der Vorschau (nicht im Video)
function zeigeAufnahmeAnzeige() {
  const anzeige = `REC  ${Math.min(zeit, aufnahme.sekunden).toFixed(1)} / ${aufnahme.sekunden} s`;
  push();
  textFont(OBERFLAECHENSCHRIFT);
  textSize(14);
  noStroke();
  fill(0, 190);
  rect(16, 16, textWidth(anzeige) + 52, 34, 17);
  fill(aufnahme.laeuft && frameCount % 40 < 28 ? color(235, 40, 40) : color(120, 20, 20));
  circle(34, 33, 12);
  fill(255);
  textAlign(LEFT, CENTER);
  text(anzeige, 48, 34);
  pop();
}



// ---------- Export ----------

function speicherePng() {
  // der aktuelle Moment der Animation in voller Story-Größe
  standbild([name()], STORY_BREITE, STORY_HOEHE, storyOptionen(), zeit)
    .toBlob(blob => speichereDatei(blob, dateiname('story')), 'image/png');
  sage('PNG gespeichert (1080 x 1920)');
}


// ---------- Anzeigen ----------

function zeigeText(t, farbeText) {
  push();
  fill(farbeText);
  noStroke();
  textFont(OBERFLAECHENSCHRIFT);
  textAlign(CENTER, CENTER);
  textSize(16);
  text(t, width / 2, height / 2);
  pop();
}


// ---------- Oberfläche (index.html) ----------

const dom = (id) => document.getElementById(id);

// Die Typen der Buchstaben in der Analyse: Name in der CSS-Klasse (oberflaeche.css)
const BUCHSTABEN_KLASSE = { hart: 'hart', weich: 'weich', hell: 'hell', dunkel: 'dunkel', leichtDunkel: 'halbdunkel', neutral: 'neutral' };
const rgbText = (f) => `rgb(${f.r}, ${f.g}, ${f.b})`;

// Verbindet Eingabefeld, Einstellungen und Knöpfe mit den Werten oben
function baueOberflaeche() {
  const eingabe = dom('name');
  eingabe.value = uiParams.text;
  eingabe.addEventListener('input', () => { uiParams.text = eingabe.value; });

  const automatik = dom('automatik');
  automatik.checked = uiParams.automatik;
  automatik.addEventListener('change', () => { uiParams.automatik = automatik.checked; });

  // den Modus von Hand zu wählen schaltet "Name steuert" aus
  const modus = dom('modus');
  MODI.forEach(m => modus.add(new Option(m, m)));
  modus.addEventListener('change', () => { uiParams.modus = modus.value; uiParams.automatik = false; });

  FARBMODI.forEach((farbmodus, nr) => {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.title = farbmodus;
    knopf.innerHTML = `<b>${nr + 1}</b><i></i>`;
    knopf.addEventListener('click', () => { uiParams.farbmodus = farbmodus; });
    dom('farbmodi').append(knopf);
  });

  const laenge = dom('laenge');
  laenge.value = uiParams.videoSekunden;
  dom('laenge-wert').textContent = `${laenge.value} s`;
  laenge.addEventListener('input', () => {
    uiParams.videoSekunden = Number(laenge.value);
    dom('laenge-wert').textContent = `${laenge.value} s`;
  });

  dom('video-knopf').addEventListener('click', () => (aufnahme ? beendeAufnahme() : starteAufnahme()));
  dom('bild-knopf').addEventListener('click', speicherePng);

  // Einstellungen im Control Tool: Geschwindigkeit, Intensität und Textgröße
  const regler = (id, name, formatiere) => {
    const element = dom(id);
    element.value = uiParams[name];
    const zeigeWert = () => { dom(`${id}-wert`).textContent = formatiere(Number(element.value)); };
    zeigeWert();
    element.addEventListener('input', () => { uiParams[name] = Number(element.value); zeigeWert(); });
  };
  const faktor = (wert) => `${wert.toFixed(2).replace('.', ',')}×`;
  const prozent = (wert) => `${Math.round(wert * 100)} %`;
  const nebeneinander = dom('nebeneinander');
  nebeneinander.checked = uiParams.nebeneinander;
  nebeneinander.addEventListener('change', () => { uiParams.nebeneinander = nebeneinander.checked; });
  regler('geschwindigkeit', 'geschwindigkeit', faktor);
  regler('intensitaet', 'intensitaet', faktor);
  regler('textgroesse', 'textgroesse', prozent);

  // während der Aufnahme lässt sich das meiste nicht verstellen (der Knopf zum Beenden bleibt bedienbar)
  document.querySelectorAll('#fenster-steuerung .gruppe, #laenge, #bild-knopf')
    .forEach(element => element.classList.add('sperre'));
}

// jedes Bild: Anzeige und Auswahl an den aktuellen Zustand angleichen. Was Arbeit macht (Farbmuster,
// Analyse), passiert nur, wenn sich etwas geändert hat.
let oberflaecheStand = '';
function aktualisiereOberflaeche() {
  document.body.classList.toggle('nimmt-auf', !!aufnahme);
  const videoKnopf = dom('video-knopf');
  const knopfText = aufnahme ? 'Aufnahme beenden' : 'Video aufnehmen';
  if (videoKnopf.textContent !== knopfText) videoKnopf.textContent = knopfText;

  const text = name();
  const modus = modusVon(text);
  const stand = [text, modus, uiParams.farbmodus, uiParams.automatik].join('|');
  if (stand === oberflaecheStand) return;
  oberflaecheStand = stand;

  dom('automatik').checked = uiParams.automatik;
  dom('modus').value = modus;
  dom('modus').disabled = uiParams.automatik;

  // die vier Farbmodi in den Farben, die für diesen Modus gelten
  [...dom('farbmodi').children].forEach((knopf, nr) => {
    const farbwelt = farbenFuer(modus, FARBMODI[nr]);
    knopf.style.background = rgbText(farbwelt.hinten);
    knopf.firstElementChild.style.color = '#fff';
    knopf.lastElementChild.style.background = rgbText(farbwelt.vorne);
    knopf.classList.toggle('gewaehlt', FARBMODI[nr] === uiParams.farbmodus);
  });
  dom('farbname').textContent = farbenFuer(modus, uiParams.farbmodus).name;

  aktualisiereAnalyse(text, modus);
}

function aktualisiereAnalyse(text, modus) {
  const a = analysiereName(text);
  const f = farbenFuer(modus, uiParams.farbmodus);
  dom('a-name').textContent = text;
  dom('a-modus').textContent = modus;
  dom('a-farbmuster').style.background = rgbText(f.hinten);
  dom('a-farbmuster').style.setProperty('--punkt', rgbText(f.vorne));

  dom('a-haerte-wert').textContent = a.haerte.toFixed(2);
  dom('a-haerte-balken').style.width = `${a.haerte * 100}%`;
  dom('a-helligkeit-wert').textContent = a.helligkeit.toFixed(2);
  dom('a-helligkeit-balken').style.width = `${a.helligkeit * 100}%`;

  dom('a-buchstaben').replaceChildren(...a.details.slice(0, 20).map(d => {
    const feld = document.createElement('span');
    feld.className = `b ${BUCHSTABEN_KLASSE[d.typ] ?? 'neutral'}`;
    feld.textContent = d.zeichen;
    return feld;
  }));
}

// Der gekörnte Hintergrund: ein kleines Bild aus zufällig gesetzten schwarzen Punkten auf hellem Grund
function baueKoernung() {
  const flaeche = macheLeinwand(KOERNUNG_GROESSE, KOERNUNG_GROESSE);
  const c = flaeche.getContext('2d');
  const bild = c.createImageData(KOERNUNG_GROESSE, KOERNUNG_GROESSE);
  let zufall = KOERNUNG_START;
  for (let i = 0; i < KOERNUNG_GROESSE * KOERNUNG_GROESSE; i++) {
    // einfacher Zufallsgenerator (mulberry32), damit die Körnung immer gleich ist
    zufall = (zufall + 0x6D2B79F5) | 0;
    let z = Math.imul(zufall ^ (zufall >>> 15), 1 | zufall);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    const wert = ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    // schwarz mit voller Deckkraft oder durchsichtig
    bild.data[i * 4 + 3] = wert < KOERNUNG_DICHTE ? 255 : 0;
  }
  c.putImageData(bild, 0, 0);
  document.body.style.backgroundImage = `url(${flaeche.toDataURL()})`;
  document.body.style.backgroundSize = `${KOERNUNG_GROESSE}px ${KOERNUNG_GROESSE}px`;
  document.body.style.imageRendering = 'pixelated';
}

baueKoernung();
baueOberflaeche();
new p5();
