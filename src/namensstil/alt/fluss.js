// ------------------------------------------------------------
// FLUSS (hell · weich): Nach "Moving Type Generative" von The Wizard Bear
// (openprocessing.org/sketch/831224, CC BY-SA), so nah am Original wie
// möglich.
//
// Auf der Umrisslinie des Namens sitzen viele Punkte. In jedem Schritt
// rückt jeder Punkt ein kleines Stück weiter. Wohin, sagt ein festes
// Rauschfeld: x und y bekommen je einen eigenen Rauschwert, der zwischen
// -Tempo und +Tempo abgebildet wird. Jeder Schritt zeichnet eine zarte,
// halbdurchsichtige Linie. Nichts verblasst, die Linien sammeln sich zu
// immer dichterem Haar.
//
// Anders als im Original laufen die Linien immer von der Kontur nach
// außen (nie in die Buchstaben hinein) und liegen vor dem Namen, werden
// also nicht von ihm abgeschnitten. Der Name steht als feste Form in der
// Schriftfarbe darunter, damit er lesbar bleibt. Dazu zeigt der Rauschwert jedes
// Punktes nach außen: zeigt das Feld am Start nach innen, wird er für
// diesen Punkt umgedreht. Die Bahnen folgen weiter dem Rauschfeld.
//
// Damit es eine Animation bleibt: das Haar wächst etwa 12 Sekunden lang,
// blendet dann kurz aus, und ein neuer Durchgang beginnt mit einem
// anderen Rauschfeld.
//
// Dieser Modus merkt sich sein Bild (eine Zeichenfläche, auf der sich die
// Linien sammeln). Am Anfang jedes Durchgangs ist deshalb schon ein Stück
// vorgerechnet, damit der Name nicht kahl beginnt.
//
// Die Zahlen in FLUSS sind eure Stellschrauben. Die Werte des Originals
// stehen daneben (es nutzt 160 px Schriftgröße, hier ist alles relativ
// zur Schriftgröße).
// ------------------------------------------------------------

import { alsPfad, rgb } from '../modi.js';
import { neuAbtasten, normalen } from '../verzerrung.js';

const FLUSS = {
  abstand: 0.0104,           // Abstand der Startpunkte auf der Kontur (Anteil der Schriftgröße). Original: sampleFactor 0.6, etwa 1.7 px bei 160 px
  geschwindigkeit: 0.003125, // größte Strecke pro Schritt (Anteil der Schriftgröße). Original: lineSpeed 0.5 px
  rauschZoom: 1,             // Größe der Rauschwellen in Schriftgrößen. Original: noiseZoom 0.006, also etwa 1 Schriftgröße
  linieAlpha: 60 / 255,      // Deckkraft einer Linie. Original: strokeAlpha 60
  linie: 0.00625,            // Linienstärke (Anteil der Schriftgröße). Original: 1 px bei 160 px
  nachAussen: 0.35,          // zusätzlicher Schub senkrecht von der Kontur weg (0 = nur das Rauschfeld, wie im Original). Verhindert, dass Punkte stehen bleiben, wo das Feld fast null ist
  gruppen: 8,                // so viele Striche pro Schritt (Punkte abwechselnd verteilt): so überlagern sich benachbarte Linien wie im Original

  schritteProSekunde: 90,    // so viele Schritte läuft die Animation pro Sekunde (das Original: 60)
  vorlauf: 300,              // so viele Schritte sind am Anfang jedes Durchgangs schon gelaufen
  zyklus: 16,                // Sekunden pro Durchgang (nach etwa 12 Sekunden ist das Haar ausgewachsen)
  ausblenden: 2.5,           // die letzten Sekunden eines Durchgangs blendet das Haar aus
  hoechstensProBild: 14,     // mehr als so viele Schritte rechnet ein Bild nie nach
};

export function bereite(eintrag, bereich) {
  const u = eintrag.u;

  // Startpunkte: gleichmäßig auf der Umrisslinie jedes Buchstabens
  // dazu die Richtung "nach außen" (senkrecht von der Kontur weg)
  const sx = [], sy = [], nx = [], ny = [];
  for (const kontur of eintrag.konturen) {
    const punkte = neuAbtasten(kontur, u * FLUSS.abstand);
    const aussen = normalen(punkte, eintrag.richtung);
    punkte.forEach((p, i) => {
      sx.push(p.x - bereich.x);
      sy.push(p.y - bereich.y);
      nx.push(aussen[i].x);
      ny.push(aussen[i].y);
    });
  }

  // die Zeichenfläche, auf der sich die Linien sammeln (ohne Hintergrund)
  const flaeche = document.createElement('canvas');
  flaeche.width = Math.max(1, Math.round(bereich.b));
  flaeche.height = Math.max(1, Math.round(bereich.h));

  // das Rauschfeld wird auf einem groben Raster vorgerechnet und dazwischen weich gemischt
  const zelle = Math.max(2, u * 0.02);
  const spalten = Math.ceil(bereich.b / zelle) + 2, zeilen = Math.ceil(bereich.h / zelle) + 2;

  return {
    u, bereich, n: sx.length, flaeche, zelle, spalten, zeilen,
    startX: Float32Array.from(sx), startY: Float32Array.from(sy),
    normaleX: Float32Array.from(nx), normaleY: Float32Array.from(ny),
    pfad: alsPfad(eintrag.konturen, bereich),
    vorzeichen: new Float32Array(sx.length),
    x: new Float32Array(sx.length), y: new Float32Array(sx.length),
    feldX: new Float32Array(spalten * zeilen), feldY: new Float32Array(spalten * zeilen),
    zyklus: null, gemacht: 0, farbe: null,
  };
}

// Neuer Durchgang: leere Fläche, Punkte an der Kontur, neues Rauschfeld
function beginneDurchgang(d, nummer) {
  d.zyklus = nummer;
  d.gemacht = 0;
  d.x.set(d.startX);
  d.y.set(d.startY);
  d.flaeche.getContext('2d').clearRect(0, 0, d.flaeche.width, d.flaeche.height);

  // Rauschfeld, wie im Original: x und y je ein eigener Rauschwert, auf -1..1 abgebildet.
  // Die zweite Ebene liegt um 214 weiter (Original), jeder Durchgang liegt woanders im Rauschen.
  const zoom = 1 / (d.u * FLUSS.rauschZoom);
  const z = nummer * 17.3;
  for (let j = 0; j < d.zeilen; j++) {
    for (let i = 0; i < d.spalten; i++) {
      const nx = i * d.zelle * zoom, ny = j * d.zelle * zoom;
      d.feldX[j * d.spalten + i] = map(noise(nx, ny, z), 0, 1, -1, 1);
      d.feldY[j * d.spalten + i] = map(noise(nx, ny, z + 214), 0, 1, -1, 1);
    }
  }

  // zeigt das Feld am Startpunkt nach innen, wird es für diesen Punkt umgedreht
  for (let i = 0; i < d.n; i++) {
    const wert = feld(d, d.startX[i], d.startY[i]);
    d.vorzeichen[i] = wert.x * d.normaleX[i] + wert.y * d.normaleY[i] >= 0 ? 1 : -1;
  }
}

export function zeichne(ctx, d, zeit, farben, staerke) {
  const schluessel = `${farben.vorne.r},${farben.vorne.g},${farben.vorne.b}`;
  const nummer = Math.floor(zeit / FLUSS.zyklus);
  const phase = zeit - nummer * FLUSS.zyklus;

  // neuer Durchgang oder neue Farbe: von vorn
  if (d.zyklus !== nummer || d.farbe !== schluessel) {
    beginneDurchgang(d, nummer);
    d.farbe = schluessel;
  }

  // wie viele Schritte müssten es jetzt sein?
  const ziel = Math.floor(phase * FLUSS.schritteProSekunde) + FLUSS.vorlauf;
  // hängt das Programm hinterher (langsamer Rechner), springen wir ein Stück voraus
  if (d.gemacht > 0 && ziel - d.gemacht > FLUSS.hoechstensProBild) d.gemacht = ziel - FLUSS.hoechstensProBild;

  const fc = d.flaeche.getContext('2d');
  fc.lineWidth = Math.max(1, d.u * FLUSS.linie);
  fc.strokeStyle = rgb(farben.vorne, FLUSS.linieAlpha);
  while (d.gemacht < ziel) schritt(d, fc, staerke);

  // erst der Name als feste Form, dann das Haar davor
  ctx.save();
  ctx.translate(d.bereich.x, d.bereich.y);
  ctx.fillStyle = rgb(farben.vorne);
  ctx.fill(d.pfad, 'nonzero');
  ctx.restore();

  // am Ende des Durchgangs blendet das Haar aus (der Name bleibt)
  const aus = FLUSS.zyklus - phase;
  const sichtbar = aus < FLUSS.ausblenden ? aus / FLUSS.ausblenden : 1;
  ctx.save();
  ctx.globalAlpha = sichtbar * sichtbar * (3 - 2 * sichtbar);
  ctx.drawImage(d.flaeche, d.bereich.x, d.bereich.y);
  ctx.restore();
}

// Ein Schritt: jeder Punkt rückt ein Stück weiter und zeichnet seine Linie
function schritt(d, fc, staerke) {
  const lauf = d.u * FLUSS.geschwindigkeit * staerke;
  const b = d.flaeche.width, h = d.flaeche.height;

  // die Punkte sind auf mehrere Striche verteilt: Linien aus verschiedenen
  // Gruppen überlagern sich, Linien derselben Gruppe liegen weit auseinander
  for (let gruppe = 0; gruppe < FLUSS.gruppen; gruppe++) {
    fc.beginPath();
    for (let i = gruppe; i < d.n; i += FLUSS.gruppen) {
      const x = d.x[i], y = d.y[i];
      if (x < -5 || y < -5 || x > b + 5 || y > h + 5) continue;   // aus dem Bild gelaufen
      const wert = feld(d, x, y);
      const v = d.vorzeichen[i];
      const nx = x + (wert.x * v + d.normaleX[i] * FLUSS.nachAussen) * lauf;
      const ny = y + (wert.y * v + d.normaleY[i] * FLUSS.nachAussen) * lauf;
      fc.moveTo(x, y);
      fc.lineTo(nx, ny);
      d.x[i] = nx;
      d.y[i] = ny;
    }
    fc.stroke();
  }
  d.gemacht++;
}

// Rauschfeld an einer Stelle: die vier umliegenden Rasterpunkte weich gemischt
const ergebnis = { x: 0, y: 0 };
function feld(d, x, y) {
  const gx = Math.max(0, x / d.zelle), gy = Math.max(0, y / d.zelle);
  const i = Math.min(d.spalten - 2, Math.floor(gx)), j = Math.min(d.zeilen - 2, Math.floor(gy));
  const fx = gx - i, fy = gy - j;
  const k = j * d.spalten + i;
  const a = (1 - fx) * (1 - fy), c = fx * (1 - fy), e = (1 - fx) * fy, f = fx * fy;
  ergebnis.x = d.feldX[k] * a + d.feldX[k + 1] * c + d.feldX[k + d.spalten] * e + d.feldX[k + d.spalten + 1] * f;
  ergebnis.y = d.feldY[k] * a + d.feldY[k + 1] * c + d.feldY[k + d.spalten] * e + d.feldY[k + d.spalten + 1] * f;
  return ergebnis;
}
