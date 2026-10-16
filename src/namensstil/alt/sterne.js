// ------------------------------------------------------------
// STERNE (hell · hart): Die Kontur des Namens ist mit Sternen besetzt.
// Sie fliegen an der Kontur entlang und drehen sich dabei um sich
// selbst. Alle Sterne sind gleich groß und sitzen so dicht, dass sie
// sich überlappen: so entsteht eine scharfe, zackige Kante. Jede Kontur
// läuft in ihre eigene Richtung, so kreisen Außenform und Innenräume
// gegeneinander.
//
// Die Zahlen in STERNE sind eure Stellschrauben.
// ------------------------------------------------------------

import { alsPfad, rgb } from '../modi.js';
import { neuAbtasten, gitter } from '../verzerrung.js';

const STERNE = {
  groesse: 0.05,        // Radius der Sterne (Anteil der Schriftgröße)
  abstand: 0.035,       // Abstand der Sterne auf der Kontur; kleiner als die Größe = sie überlappen
  zacken: 5,            // wie viele Zacken ein Stern hat
  innen: 0.42,          // Tiefe der Zacken: klein = spitze, dünne Zacken
  tempo: 0.18,          // wie schnell sie fliegen (Schriftgrößen pro Sekunde)
  drehung: 1.5,         // wie schnell sie sich drehen (Umdrehungen pro Sekunde, höchstens)
  kontur: 0,            // Deckkraft der dünnen Konturlinie darunter (0 = keine)
  linie: 0.004,         // Stärke der Konturlinie
};

export function bereite(eintrag, bereich) {
  const u = eintrag.u;
  const seed = eintrag.seed & 0xffff;
  const schritt = u * 0.01;

  const konturen = eintrag.konturen.map((kontur, nr) => {
    const punkte = neuAbtasten(kontur, schritt).map(p => ({ x: p.x - bereich.x, y: p.y - bereich.y }));
    const umfang = punkte.length * schritt;
    const anzahl = Math.max(1, Math.round(umfang / (u * STERNE.abstand)));
    const richtung = gitter(nr, 0, seed) < 0.5 ? -1 : 1;

    const sterne = Array.from({ length: anzahl }, (_, i) => {
      const zufall = (m) => gitter(nr * 977 + i, m, seed);
      return {
        // gleichmäßig verteilt, damit die Kante überall gleich dicht ist
        start: i / anzahl * umfang,
        drehung: (zufall(4) * 2 - 1) * STERNE.drehung * TWO_PI,
        winkel: zufall(5) * TWO_PI,
      };
    });
    return { punkte, schritt, umfang, richtung, sterne };
  });

  return { u, bereich, konturen, groesse: u * STERNE.groesse, pfad: alsPfad(eintrag.konturen, bereich) };
}

export function zeichne(ctx, d, zeit, farben, staerke) {
  const { u, bereich } = d;
  ctx.save();
  ctx.translate(bereich.x, bereich.y);

  // dünne Konturlinie, damit der Name lesbar bleibt
  if (STERNE.kontur > 0) {
    ctx.strokeStyle = rgb(farben.vorne, STERNE.kontur);
    ctx.lineWidth = Math.max(1, u * STERNE.linie);
    ctx.stroke(d.pfad);
  }

  const sternPfad = new Path2D();
  const weg = u * STERNE.tempo * staerke * zeit;
  for (const k of d.konturen) {
    for (const s of k.sterne) {
      // wo auf der Kontur der Stern gerade ist
      let ort = (s.start + weg * k.richtung) % k.umfang;
      if (ort < 0) ort += k.umfang;
      const p = punktAuf(k, ort);
      stern(sternPfad, p.x, p.y, d.groesse, s.winkel + s.drehung * staerke * zeit);
    }
  }
  ctx.fillStyle = rgb(farben.vorne);
  ctx.fill(sternPfad, 'nonzero');
  ctx.restore();
}

// Punkt an der Stelle "ort" (Abstand vom Anfang der Kontur), zwischen
// zwei Nachbarpunkten weich eingeblendet
function punktAuf(k, ort) {
  const genau = ort / k.schritt;
  const i = Math.floor(genau) % k.punkte.length;
  const a = k.punkte[i];
  const b = k.punkte[(i + 1) % k.punkte.length];
  const f = genau - Math.floor(genau);
  return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) };
}

// ein Stern: abwechselnd Spitze (außen) und Tal (innen)
function stern(pfad, x, y, radius, winkel) {
  const ecken = STERNE.zacken * 2;
  for (let i = 0; i < ecken; i++) {
    const r = i % 2 === 0 ? radius : radius * STERNE.innen;
    const w = winkel + (i / ecken) * TWO_PI;
    const px = x + Math.cos(w) * r, py = y + Math.sin(w) * r;
    if (i === 0) pfad.moveTo(px, py);
    else pfad.lineTo(px, py);
  }
  pfad.closePath();
}
