// ------------------------------------------------------------
// FELD: die Animation für HELLE Namen.
// Der Name treibt über die Fläche und zieht eine Spur hinter sich her.
// Die Spur wird weichgezeichnet und über eine periodische Tonkurve in
// Konturbänder übersetzt (wie Höhenlinien), dazu Körnung und feine
// horizontale Streifen. Die Bänder wandern ständig nach außen.
//
// Je heller der Name, desto längere Spur und mehr Bänder.
// Je härter, desto schneller und kontrastreicher.
// Die Zahlen sind eure Stellschrauben.
// ------------------------------------------------------------

// Größe der Rechenpixel (1 = fein, aber langsamer; 2 = gröber, schneller)
export const PIXEL = 2;

let macheLeinwand = (b, h) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(b));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};
// erlaubt das Testen außerhalb des Browsers
export function setzeFeldLeinwand(f) { macheLeinwand = f; }

// ---------- Vorbereitung (einmal, wenn sich das Bild ändert) ----------

// quelle: Canvas mit dem fertigen Bild aus Schritt 1
export function bereiteFeldVor(quelle) {
  const fw = Math.ceil(quelle.width / PIXEL), fh = Math.ceil(quelle.height / PIXEL);

  // Maske: der Name weiß auf transparent, in Rechenauflösung
  const maske = macheLeinwand(fw, fh);
  const mc = maske.getContext('2d');
  mc.drawImage(quelle, 0, 0, fw, fh);
  mc.globalCompositeOperation = 'source-in';
  mc.fillStyle = '#fff';
  mc.fillRect(0, 0, fw, fh);

  const beweg = macheLeinwand(fw, fh);
  const ausgabe = macheLeinwand(fw, fh);
  const n = fw * fh;
  return {
    fw, fh, maske, beweg,
    bewegCtx: beweg.getContext('2d', { willReadFrequently: true }),
    ausgabe,
    ausgabeDaten: ausgabe.getContext('2d').createImageData(fw, fh),
    spur: new Float32Array(n),
    aktuell: new Float32Array(n),
    a: new Float32Array(n),
    b: new Float32Array(n),
    zeit: 0,
    seed: 12345,
  };
}

// ---------- Ein Bild ----------

// ctx: Haupt-Canvas, f: Ergebnis von bereiteFeldVor
// dt: Zeitschritt in Sekunden, u: Schriftgröße in Pixeln (Bildschirm)
// staerke: wie hell (0..1+), haerte: 0..1, fg/bg: Farben {r,g,b}
// rauschen2: p5-noise (für das Treiben), breite/hoehe: Größe der Fläche
export function zeichneFeld(ctx, f, dt, u, staerke, haerte, fg, bg, rauschen2, breite, hoehe) {
  const tempo = 0.6 + 1.2 * haerte;
  f.zeit += dt * tempo;
  const t = f.zeit;

  // 1. Bewegung: ruhiges Treiben (Wander), dazu leichtes Drehen und Pulsieren
  const reichweite = (u * 0.5 + breite * 0.08) * Math.min(1.5, staerke);
  const x = (rauschen2(t * 0.25, 11.3) - rauschen2(0, 11.3)) * 2 * reichweite * 1.3;
  const y = (rauschen2(t * 0.25, 77.7) - rauschen2(0, 77.7)) * 2 * reichweite * 0.8;
  const dreh = (8 * Math.PI / 180) * Math.sin(t * 0.7);
  const groesse = 1 + 0.15 * Math.sin(t * 0.9);

  // 2. Maske an der aktuellen Position zeichnen und auslesen
  const { fw, fh, bewegCtx } = f;
  bewegCtx.setTransform(1, 0, 0, 1, 0, 0);
  bewegCtx.fillStyle = '#000';
  bewegCtx.fillRect(0, 0, fw, fh);
  bewegCtx.translate(fw / 2 + x / PIXEL, fh / 2 + y / PIXEL);
  bewegCtx.rotate(dreh);
  bewegCtx.scale(groesse, groesse);
  bewegCtx.drawImage(f.maske, -fw / 2, -fh / 2);
  const daten = bewegCtx.getImageData(0, 0, fw, fh).data;
  for (let i = 0; i < f.aktuell.length; i++) f.aktuell[i] = daten[i * 4] / 255;

  // 3. Spur: jeder Punkt behält den höchsten Wert, wird aber pro Bild schwächer
  const laenge = 20 + 60 * Math.min(1, staerke);              // in Bildern
  const abklingen = Math.pow(1 - 1 / laenge, Math.max(dt, 1 / 60) * 60);
  for (let i = 0; i < f.spur.length; i++) {
    const verblasst = f.spur[i] * abklingen;
    f.spur[i] = f.aktuell[i] > verblasst ? f.aktuell[i] : verblasst;
  }

  // 4. weichzeichnen
  const sigma = Math.max(1, (u * 0.025) / PIXEL);
  const feld = weichzeichnen(f.spur, fw, fh, sigma, sigma, f.a, f.b);

  // 5. Feld -> Pixel: Konturbänder, Körnung, Streifen
  f.seed = (f.seed * 1664525 + 1013904223) >>> 0 || 1;
  pixel(feld, fw, fh, f.ausgabeDaten.data, {
    baender: 2 + 2.5 * Math.min(1, staerke),
    phase: t * 1.5,
    kontrast: 1.1 + 0.8 * haerte,
    korn: 0.14,
    streifen: 0.05,
    streifenDichte: 0.22 * PIXEL,
    streifenVersatz: t * 2.5,
    seed: f.seed,
    fg, bg,
  });
  f.ausgabe.getContext('2d').putImageData(f.ausgabeDaten, 0, 0);

  // hochskalieren mit harten Pixelkanten, damit die Körnung körnig bleibt
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(f.ausgabe, 0, 0, fw * PIXEL, fh * PIXEL);
  ctx.restore();
}

// ---------- Rechenfunktionen ----------

function blurH(src, dst, w, h, r) {
  const div = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let sum = src[o] * (r + 1);
    for (let i = 1; i <= r; i++) sum += src[o + Math.min(i, w - 1)];
    for (let x = 0; x < w; x++) {
      dst[o + x] = sum / div;
      sum += src[o + Math.min(x + 1 + r, w - 1)] - src[o + Math.max(x - r, 0)];
    }
  }
}

function blurV(src, dst, w, h, r) {
  const div = 2 * r + 1;
  for (let x = 0; x < w; x++) {
    let sum = src[x] * (r + 1);
    for (let i = 1; i <= r; i++) sum += src[Math.min(i, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = sum / div;
      sum += src[Math.min(y + 1 + r, h - 1) * w + x] - src[Math.max(y - r, 0) * w + x];
    }
  }
}

// drei Durchgänge Kasten-Blur ≈ Gauß; schreibt nie in src
function weichzeichnen(src, w, h, sx, sy, bufA, bufB) {
  let von = src, nach = bufA;
  const durchgaenge = (sigma, fn) => {
    if (sigma < 0.6) return;
    const r = Math.max(1, Math.round(sigma - 0.5));
    for (let n = 0; n < 3; n++) {
      fn(von, nach, w, h, r);
      von = nach;
      nach = von === bufA ? bufB : bufA;
    }
  };
  durchgaenge(sx, blurH);
  durchgaenge(sy, blurV);
  return von;
}

// periodische Tonkurve erzeugt Konturbänder, Rauschen die Körnung
function pixel(f, w, h, px, o) {
  const groesse = 4096, gMin = -0.8, gMax = 1.8;
  const skala = groesse / (gMax - gMin);
  const tabelle = new Uint8Array(groesse + 1);
  for (let i = 0; i <= groesse; i++) {
    const g = gMin + i / skala;
    let v = 0.5 + 0.5 * Math.cos(Math.PI * o.baender * g);
    v = Math.min(1, Math.max(0, (v - 0.5) * o.kontrast + 0.5));
    tabelle[i] = Math.round(v * 255);
  }

  let s = (o.seed | 0) || 1;
  const { fg, bg } = o;
  // Verschiebung der Bänder nur in den Übergangszonen (Hintergrund bleibt ruhig)
  const verschiebung = o.phase / (Math.PI * o.baender);

  for (let y = 0; y < h; y++) {
    const streifen =
      (Math.sin(y * o.streifenDichte + o.streifenVersatz) +
        0.5 * Math.sin(y * o.streifenDichte * 0.37 + 1.7 + o.streifenVersatz * 0.5)) * o.streifen;
    const zeile = y * w;
    for (let x = 0; x < w; x++) {
      const v0 = f[zeile + x];
      const k = v0 < 0 ? 0 : v0 > 1 ? 1 : v0;
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      const zufall = (s >>> 0) / 4294967296;
      const zone = 4 * k * (1 - k);
      const g = v0 + (verschiebung + streifen) * zone + (zufall - 0.5) * o.korn;
      let idx = ((g - gMin) * skala) | 0;
      if (idx < 0) idx = 0; else if (idx > groesse) idx = groesse;
      const v = tabelle[idx], inv = 255 - v;
      const p = (zeile + x) * 4;
      px[p] = (fg.r * inv + bg.r * v) / 255;
      px[p + 1] = (fg.g * inv + bg.g * v) / 255;
      px[p + 2] = (fg.b * inv + bg.b * v) / 255;
      px[p + 3] = 255;
    }
  }
}
