// ------------------------------------------------------------
// SCHRIFTDATEI: liest eine .ttf/.otf-Datei und liefert die exakten
// Umrisse der Buchstaben – auf Wunsch in einer bestimmten
// Schriftstärke (bei variablen Fonts) und mit Laufweite.
//
// Einmalig im Terminal installieren:   npm install opentype.js
// (Version 2 oder neuer, sonst funktioniert die Schriftstärke nicht)
// ------------------------------------------------------------

import opentype from 'opentype.js';

// Lädt eine Schriftdatei (Pfad relativ zur Webseite)
export async function ladeSchrift(pfad) {
  const antwort = await fetch(pfad);
  if (!antwort.ok) throw new Error(`${pfad} nicht gefunden (${antwort.status})`);
  return opentype.parse(await antwort.arrayBuffer());
}

// Hat die Schrift eine Gewichtsachse (variabler Font)?
export function istVariabel(schrift) {
  return !!(schrift.variation && schrift.tables.fvar?.axes?.some(a => a.tag === 'wght'));
}

// Wie fein Kurven in Punkte zerlegt werden (mehr = glatter, aber langsamer)
const KURVEN_SCHRITTE = 12;

// Liefert die Konturen eines Textes: Array von Konturen, jede ein Array {x, y}.
// Die echten Ankerpunkte der Schrift (wie in Illustrator) tragen anker: true,
// die Punkte dazwischen sind nur Zwischenschritte auf den Kurven.
// stil: { wght: 100..900, laufweite: zusätzlicher Abstand in Geviert (z. B. 0.2) }
export function konturenVon(schrift, text, stil = {}) {
  const groesse = 200;
  const faktor = groesse / schrift.unitsPerEm;
  const variabel = istVariabel(schrift);
  const variation = variabel && stil.wght ? { wght: stil.wght } : undefined;
  const laufweite = (stil.laufweite ?? 0) * groesse;

  const befehle = [];
  let x = 0;
  let vorher = null;
  for (const zeichen of text) {
    let glyphe = schrift.charToGlyph(zeichen);
    // bei variablen Fonts die Glyphe in der gewünschten Stärke holen
    if (variation) glyphe = schrift.variation.getTransform(glyphe, variation) ?? glyphe;
    if (vorher) x += schrift.getKerningValue(vorher, glyphe) * faktor + laufweite;
    befehle.push(...glyphe.getPath(x, 0, groesse).commands);
    x += glyphe.advanceWidth * faktor;
    vorher = glyphe;
  }

  const konturen = [];
  let k = null, px = 0, py = 0;
  for (const b of befehle) {
    if (b.type === 'M') {
      k = [{ x: b.x, y: b.y, anker: true }];
      konturen.push(k);
    } else if (b.type === 'L') {
      k.push({ x: b.x, y: b.y, anker: true });
    } else if (b.type === 'Q') {
      for (let s = 1; s <= KURVEN_SCHRITTE; s++) {
        const t = s / KURVEN_SCHRITTE, u = 1 - t;
        k.push({ x: u * u * px + 2 * u * t * b.x1 + t * t * b.x, y: u * u * py + 2 * u * t * b.y1 + t * t * b.y, anker: s === KURVEN_SCHRITTE });
      }
    } else if (b.type === 'C') {
      for (let s = 1; s <= KURVEN_SCHRITTE; s++) {
        const t = s / KURVEN_SCHRITTE, u = 1 - t;
        k.push({
          x: u * u * u * px + 3 * u * u * t * b.x1 + 3 * u * t * t * b.x2 + t * t * t * b.x,
          y: u * u * u * py + 3 * u * u * t * b.y1 + 3 * u * t * t * b.y2 + t * t * t * b.y,
          anker: s === KURVEN_SCHRITTE,
        });
      }
    }
    if (b.x !== undefined) { px = b.x; py = b.y; }
  }
  return konturen.filter(k => k.length > 2);
}
