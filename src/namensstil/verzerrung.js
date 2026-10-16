// ------------------------------------------------------------
// VERZERRUNG: die BEWEGUNG (weich -> hart) und gemeinsame Helfer.
//
//   weich  = die Schrift schwimmt, langsame, sanfte Wellen
//   hart   = ruppiges, ruckartiges Verzerren mit Brüchen und harten Kanten
//
// Das Aussehen (Stärke, Laufweite, Blur, Körnung, Stacheln) steht in stil.js und stacheln.js.
// Alle Zahlen mit "u *" sind relativ zur Schriftgröße (u = 1 Geviert).
// Dieses Modul benutzt kein p5, nur Mathe.
// ------------------------------------------------------------


// ---------- Zufall und Rauschen ----------

export function hashText(text) {
  let h = 2166136261;
  for (const c of text) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function zufall(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Gitterwert 0..1 für ganze Zahlen (immer gleich für gleiche Eingaben)
export function gitter(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const weich = t => t * t * (3 - 2 * t);

// Weiches 3D-Rauschen (-1..1): fließende Werte zwischen den Gitterpunkten
export function rauschen(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = weich(x - xi), fy = weich(y - yi), fz = weich(z - zi);
  const l = (a, b, f) => a + (b - a) * f;
  const ebene = zz => l(
    l(gitter(xi, yi, zz), gitter(xi + 1, yi, zz), fx),
    l(gitter(xi, yi + 1, zz), gitter(xi + 1, yi + 1, zz), fx), fy);
  return l(ebene(zi), ebene(zi + 1), fz) * 2 - 1;
}


// ---------- Geometrie-Helfer ----------

const abstand = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

export function flaeche(k) {
  let s = 0;
  for (let i = 0; i < k.length; i++) {
    const a = k[i], b = k[(i + 1) % k.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function neuAbtasten(k, schritt) {
  if (k.length < 3) return k;
  const neu = [{ ...k[0] }];
  let rest = schritt;
  for (let i = 0; i < k.length; i++) {
    let a = k[i];
    const b = k[(i + 1) % k.length];
    let d = abstand(a, b);
    while (d >= rest) {
      const f = rest / d;
      a = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      neu.push(a);
      d -= rest;
      rest = schritt;
    }
    rest -= d;
  }
  if (neu.length > 3 && abstand(neu[0], neu[neu.length - 1]) < schritt * 0.5) neu.pop();
  return neu.length >= 3 ? neu : k;
}

// Normalen, die von der Farbfläche weg zeigen
export function normalen(k, richtung) {
  return k.map((p, i) => {
    const a = k[(i - 1 + k.length) % k.length];
    const b = k[(i + 1) % k.length];
    const tx = b.x - a.x, ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    return { x: (ty / l) * richtung, y: (-tx / l) * richtung };
  });
}

// In welche Richtung zeigt "außen"? (hängt von der Schriftdatei ab)
export function aussenRichtung(alleKonturen) {
  let groesste = null, max = 0;
  for (const k of alleKonturen) {
    const f = Math.abs(flaeche(k));
    if (f > max) { max = f; groesste = k; }
  }
  if (!groesste) return 1;
  const mx = groesste.reduce((s, p) => s + p.x, 0) / groesste.length;
  const my = groesste.reduce((s, p) => s + p.y, 0) / groesste.length;
  const n = normalen(groesste, 1);
  let summe = 0;
  groesste.forEach((p, i) => { summe += n[i].x * (p.x - mx) + n[i].y * (p.y - my); });
  return summe >= 0 ? 1 : -1;
}

// ---------- WEICH -> HART: die Bewegung (läuft jedes Bild neu) ----------

// haerte: 0 = schwimmt sanft, 1 = ruppig mit harten Brüchen
// t: Zeit in Sekunden, seed: Fingerabdruck des Namens
export function verzerre(konturen, haerte, u, t, seed, tempo = 1) {
  const h = haerte;
  const s = (seed % 1000) * 0.137;
  t *= tempo;

  // Weich: große, langsame Wellen
  const weichAmp = u * 0.06 * (1 - h);
  const weichFreq = 1.6 / u;
  const weichZeit = t * 0.35;

  // Hart: kleine, schnelle Störungen, die Zeit springt in Stufen (Ruckeln)
  const ruckRate = 4 + h * 10;                         // Sprünge pro Sekunde
  const tStufe = Math.floor(t * ruckRate);
  const hartAmp = u * 0.022 * h;
  const hartFreq = 3.5 / u;

  // Hart: waagerechte Streifen verrutschen (Brüche mit harten Kanten)
  const streifenHoehe = u * (0.07 + (1 - h) * 0.1);
  const streifenAmp = u * 0.07 * h * h;

  return konturen.map(k => k.map(p => {
    let dx = 0, dy = 0;

    if (weichAmp > 0.01) {
      dx += rauschen(p.x * weichFreq + s, p.y * weichFreq, weichZeit) * weichAmp;
      dy += rauschen(p.x * weichFreq, p.y * weichFreq + s + 40, weichZeit) * weichAmp;
    }

    if (hartAmp > 0.01) {
      // zackig: Rauschen auf Stufen gerundet, dadurch entstehen Kanten statt Wellen
      const stufen = 4;
      const rx = Math.round(rauschen(p.x * hartFreq + s, p.y * hartFreq, tStufe * 0.7) * stufen) / stufen;
      const ry = Math.round(rauschen(p.x * hartFreq, p.y * hartFreq + s + 90, tStufe * 0.7) * stufen) / stufen;
      dx += rx * hartAmp;
      dy += ry * hartAmp;
    }

    if (streifenAmp > 0.01) {
      // jeder Streifen bekommt zufällig (mal mehr, mal gar keinen) Versatz
      const band = Math.floor(p.y / streifenHoehe);
      const wert = gitter(band, tStufe, seed & 0xffff);
      if (wert > 0.72) dx += (gitter(band + 7, tStufe, 3) * 2 - 1) * streifenAmp;
    }

    return { ...p, x: p.x + dx, y: p.y + dy };
  }));
}
