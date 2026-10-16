import '@fontsource/inter/800.css';

/* ============================================================
   Nadel-Schrift
   ------------------------------------------------------------
   1. Der Text wird in eine unsichtbare Maske gezeichnet.
   2. Entlang der Kontur werden viele "Sterne" verteilt.
   3. Jeder Stern besteht aus mehreren dünnen Nadeln, die in zufällige
      Richtungen (bevorzugt nach außen) und Längen abstehen.
   4. Die Nadeln bewegen sich leicht (Länge + Winkel) und wachsen,
      wenn die Maus in der Nähe ist.
   ============================================================ */

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);

/* ---------- Einstellungen zum Rumspielen ---------- */
const FONT_FAMILY = 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';
const FONT_WEIGHT = 800;
const LETTER_SPACING = -0.02;     // relativ zur Schriftgröße (negativ = enger)
const STAR_SPACING = 0.22;        // Anteil der Konturpixel, die einen Stern bekommen (bei Dichte 1)
const NEEDLE_MIN = 0.03;          // kürzeste Nadel (× Schriftgröße)
const NEEDLE_RANGE = 0.125;       // zusätzliche Länge bei den längsten Nadeln
const ANGLE_SPREAD = 1.7;         // Streuung der Nadelrichtung um die Außennormale (Radiant)

/* Zufällige Ausbrüche: an einzelnen Stellen wachsen die Nadeln und zusätzliche kommen heraus */
const BURST_MAX = 2;              // höchstens so viele Ausbrüche gleichzeitig
const BURST_RADIUS = [0.22, 0.42]; // Größe der Stelle (× Schriftgröße)
const BURST_SPOTS = 0.16;         // Anteil der Konturpunkte, die als Ausbruchsstelle in Frage kommen (die "äußersten")
const EXPOSURE_RADIUS = 0.11;     // Umkreis (× Schriftgröße), in dem gemessen wird, wie frei ein Punkt nach außen liegt
// Ein Ausbruch besteht aus 1–3 "Stichen" hintereinander: ruckartig raus – kurz halten – schnell zurück
const STAB_COUNT = [1, 3];        // Stiche pro Ausbruch
const STAB_OUT = [0.035, 0.06];   // Zeit bis die Nadeln voll draußen sind (kurz = zackig)
const STAB_HOLD = [0.12, 0.40];  // so lange bleiben sie draußen
const STAB_BACK = [0.05, 0.09];  // Zeit zurück
const STAB_GAP = [0.04, 0.14];    // Pause zwischen zwei Stichen
const IDLE_FPS = 12;              // Ruhezustand zuckt in so vielen Schritten pro Sekunde (der Rest läuft mit voller Bildrate)
const SPEAR = 0.8;                // wie stark sich Nadeln beim Stich nach außen ausrichten (0 = gar nicht, 1 = komplett)
const BURST_PAUSE = [0.6, 3.2];   // Pause bis zum nächsten Ausbruch (bei Häufigkeit 1)
const BURST_GROW = 3.0;           // um wie viel vorhandene Nadeln bei Stärke 1 länger werden (2.2 = ×3.2)
const BURST_EXTRA = 3.6;          // wie lang die zusätzlich auftauchenden Nadeln bei Stärke 1 werden (× normale Länge)
const EXTRA_NEEDLES = 3;          // zusätzliche Nadeln pro Stern, die nur im Ausbruch sichtbar sind

let W, H, DPR, fontSize, textX, textY, text = '';
let stars = [];
let t = 0, nextSpawn = 0.8;
let bursts = [], spots = [], burstId = 0;

const rand = (a, b) => a + Math.random() * (b - a);
const hash2 = (a, b) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const angDiff = (a, b) => { let d = (a - b) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smoothstep = (a, b, x) => { const v = clamp((x - a) / (b - a), 0, 1); return v * v * (3 - 2 * v); };

function build() {
  DPR = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  stars = []; bursts = []; spots = []; baseKey = '';

  text = $('name').value || ' ';
  // Schriftgröße so wählen, dass der Text gut ins Fenster passt
  const meas = document.createElement('canvas').getContext('2d');
  const setFont = (c, s) => { c.font = `${FONT_WEIGHT} ${s}px ${FONT_FAMILY}`; if ('letterSpacing' in c) c.letterSpacing = `${s * LETTER_SPACING}px`; };
  let size = H * 0.3;
  setFont(meas, size);
  const tw = meas.measureText(text).width;
  size = Math.min(size * (W * 0.86) / tw, H * 0.45);
  fontSize = size;
  textX = W / 2; textY = H * 0.46;

  // Maske (1 Pixel = 1 CSS-Pixel)
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const o = off.getContext('2d');
  setFont(o, size);
  o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#000';
  o.fillText(text, textX, textY);
  const a = o.getImageData(0, 0, W, H).data;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H && a[(y * W + x) * 4 + 3] > 127;

  // Konturpixel finden, daran Sterne verteilen
  const p = Math.min(1, STAR_SPACING * +$('density').value);
  const nBase = +$('needles').value;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!inside(x, y)) continue;
    if (inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) continue;   // kein Randpixel
    if (Math.random() > p) continue;
    // Außennormale: Richtung, in der in der Nachbarschaft "leer" ist
    let nx = 0, ny = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (!inside(x + dx, y + dy)) { nx += dx; ny += dy; }
    const base = Math.atan2(ny, nx);
    const count = Math.max(2, Math.round(nBase * rand(0.6, 1.4)));
    const needles = [];
    for (let i = 0; i < count; i++) {
      const ang = base + (Math.random() + Math.random() - 1) * ANGLE_SPREAD;
      needles.push({ ang, len: NEEDLE_MIN + NEEDLE_RANGE * Math.pow(Math.random(), 1.7), ph: rand(0, 6.28), sp: rand(0.6, 1.6), seed: (Math.random() * 1e6) | 0 });
    }
    for (let i = 0; i < EXTRA_NEEDLES; i++) {          // erscheinen nur während eines Ausbruchs
      const ang = base + (Math.random() + Math.random() - 1) * ANGLE_SPREAD * 1.15;
      needles.push({ ang, len: NEEDLE_MIN + NEEDLE_RANGE * Math.pow(Math.random(), 1.2), ph: rand(0, 6.28), sp: rand(0.6, 1.6), seed: (Math.random() * 1e6) | 0, extra: true });
    }
    stars.push({ x: x + 0.5 - Math.cos(base) * rand(0, 1.5), y: y + 0.5 - Math.sin(base) * rand(0, 1.5), needles, ex: 0, base });
  }
  findSpots(inside);
}

// Ausbruchsstellen = Konturpunkte, die weit nach AUSSEN frei liegen (Ecken, Spitzen, Ober-/Unterkanten).
// Innenräume (Löcher in o, e, a ...) zählen nicht: nur Fläche, die mit dem Rand des Fensters verbunden ist.
function findSpots(inside) {
  const ext = new Uint8Array(W * H), stack = new Int32Array(W * H);
  let sp = 0;
  stack[sp++] = 0; ext[0] = 1;
  while (sp) {
    const i = stack[--sp], x = i % W, y = (i / W) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (j < 0 || ext[j]) continue;
      const jx = j % W, jy = (j / W) | 0;
      if (inside(jx, jy)) continue;
      ext[j] = 1; stack[sp++] = j;
    }
  }
  const R = Math.max(6, Math.round(fontSize * EXPOSURE_RADIUS));
  for (const st of stars) {
    let out = 0, all = 0;
    for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) {
      if (dx * dx + dy * dy > R * R) continue;
      const x = Math.round(st.x) + dx, y = Math.round(st.y) + dy;
      all++;
      if (x < 0 || y < 0 || x >= W || y >= H || ext[y * W + x]) out++;
    }
    st.ex = out / all;
  }
  const sorted = stars.slice().sort((a, b) => b.ex - a.ex);
  spots = sorted.slice(0, Math.max(12, Math.round(stars.length * BURST_SPOTS)));
}

// Die Grundebene (Schrift + alle ruhigen Nadeln) ändert sich nur IDLE_FPS-mal pro Sekunde und wird zwischengespeichert.
// Nur die Nadeln an den Ausbruchsstellen werden jeden Frame neu berechnet -> flüssig bei voller Bildrate.
const baseCanvas = document.createElement('canvas');
const bctx = baseCanvas.getContext('2d');
let baseKey = '';

function addNeedle(path, s, n, tq, lenK, motion, g, best, pull) {
  const step = Math.floor(tq * n.sp * 7);
  const pulse = 1 + 0.5 * motion * (hash2(n.seed, step) - 0.5);
  let ang = n.ang + 0.4 * motion * (hash2(n.seed + 77, step) - 0.5);
  if (best) ang += angDiff(best.dir + angDiff(n.ang, s.base) * 0.3, ang) * pull;      // Speer: Nadeln richten sich nach außen aus
  const len = n.len * lenK * pulse * (n.extra ? BURST_EXTRA * g : 1 + BURST_GROW * g);
  const bw = Math.max(0.55, len * 0.045);
  const c = Math.cos(ang), sn = Math.sin(ang);
  path.moveTo(s.x - sn * bw, s.y + c * bw);
  path.lineTo(s.x + c * len, s.y + sn * len);
  path.lineTo(s.x + sn * bw, s.y - c * bw);
  path.closePath();
}

function drawText(c, fg) {
  c.font = `${FONT_WEIGHT} ${fontSize}px ${FONT_FAMILY}`;
  if ('letterSpacing' in c) c.letterSpacing = `${fontSize * LETTER_SPACING}px`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = fg;
  c.fillText(text, textX, textY);
}

// Nadeln einer Ausbruchsstelle für einen bestimmten Zeitpunkt (k = Stärke des Stichs)
function burstPath(b, k, tq, lenK, motion) {
  const path = new Path2D();
  const R = b.R;
  for (const s of b.stars) {
    const dx = s.x - b.x, dy = s.y - b.y, d = Math.sqrt(dx * dx + dy * dy);
    const f = Math.max(0, 1 - d / R), kk = k * f * f * (3 - 2 * f);
    const g = Math.min(kk, 2.5), pull = Math.min(1, kk * 1.6) * SPEAR;
    for (const n of s.needles) {
      if (n.extra && g < 0.02) continue;
      addNeedle(path, s, n, tq, lenK, motion, g, g > 0 ? b : null, pull);
    }
  }
  return path;
}

function render(force) {
  const dark = $('invert').checked;
  const fg = dark ? '#fff' : '#000', bg = dark ? '#000' : '#fff';
  const lenK = +$('length').value * fontSize;
  const motion = +$('motion').value;
  const power = +$('burstPower').value;
  const tq = Math.floor(t * IDLE_FPS) / IDLE_FPS;

  // --- Grundebene neu zeichnen, wenn sich etwas Relevantes geändert hat
  const key = [Math.floor(t * IDLE_FPS), bursts.map(b => b.id).join(','), dark, lenK, motion, W, H, stars.length].join('|');
  if (force || key !== baseKey) {
    baseKey = key;
    document.body.classList.toggle('dark', dark);
    if (baseCanvas.width !== canvas.width || baseCanvas.height !== canvas.height) { baseCanvas.width = canvas.width; baseCanvas.height = canvas.height; }
    bctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    bctx.fillStyle = bg; bctx.fillRect(0, 0, W, H);
    drawText(bctx, fg);
    const path = new Path2D();
    for (const s of stars) {
      if (s.held) continue;                                   // Sterne an Ausbruchsstellen zeichnet die obere Ebene
      for (const n of s.needles) if (!n.extra) addNeedle(path, s, n, tq, lenK, motion, 0, null, 0);
    }
    bctx.fillStyle = fg; bctx.fill(path);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(baseCanvas, 0, 0);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // --- Ausbruchsebene: jeden Frame
  ctx.fillStyle = fg;
  for (const b of bursts) {
    const e = stabEnvelope(b, t - b.t0), eOld = stabEnvelope(b, t - b.t0 - 0.03);
    const jit = e > 0.5 ? 1 + 0.14 * (hash2(b.seed, Math.floor(t * 28)) - 0.5) : 1;     // im ausgefahrenen Zustand ruckelt die Länge
    if (eOld > e + 0.02) {                                                               // beim Zurückschnappen: Schlieren-Nachbild
      ctx.globalAlpha = 0.28; ctx.fill(burstPath(b, eOld * b.peak * power, tq, lenK, motion)); ctx.globalAlpha = 1;
    }
    ctx.fill(burstPath(b, e * b.peak * power * jit, tq, lenK, motion));
  }
}

function spawnBurst(x, y, dir = 0) {
  // Stiche planen: jeder raus -> halten -> zurück, mit kleinen Pausen dazwischen
  const stabs = []; let at = 0;
  const n = Math.round(rand(STAB_COUNT[0], STAB_COUNT[1]));
  for (let i = 0; i < n; i++) {
    const st = { start: at, out: rand(...STAB_OUT), hold: rand(...STAB_HOLD) * (i === n - 1 ? 1 : 0.5), back: rand(...STAB_BACK), amp: i === 0 ? 1 : rand(0.7, 1) };
    stabs.push(st);
    at += st.out + st.hold + st.back + rand(...STAB_GAP);
  }
  const R = fontSize * rand(BURST_RADIUS[0], BURST_RADIUS[1]);
  const members = stars.filter(s => (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y) < R * R);
  members.forEach(s => { s.held = true; });
  bursts.push({ id: ++burstId, x, y, dir, R, t0: t, dur: at, stabs, stars: members, seed: (Math.random() * 1e6) | 0, peak: rand(0.8, 1) });
}

// Verlauf eines Ausbruchs: harter Stoß nach außen (schnell abbremsend), Halten, Zurückschnappen (beschleunigend)
function stabEnvelope(b, tt) {
  let e = 0;
  for (const st of b.stabs) {
    const x = tt - st.start;
    if (x < 0) continue;
    let v = 0;
    if (x < st.out) { const u = x / st.out; v = 1 - Math.pow(1 - u, 4); }                               // Stoß: sehr schnell am Anfang
    else if (x < st.out + st.hold) v = 1;                                                       // gehalten
    else if (x < st.out + st.hold + st.back) { const u = (x - st.out - st.hold) / st.back; v = 1 - u * u * u; }   // zurück
    e = Math.max(e, v * st.amp);
  }
  return e;
}

function update(dt) {
  t += dt;
  const alive = bursts.filter(b => t < b.t0 + b.dur + 0.05);
  if (alive.length !== bursts.length) {
    for (const b of bursts) if (!alive.includes(b)) b.stars.forEach(s => { s.held = false; });
    bursts = alive;
  }
  if (bursts.length < BURST_MAX && t >= nextSpawn && spots.length) {
    // neue Stelle: zufällige äußere Ecke/Spitze, nicht direkt neben einem laufenden Ausbruch
    for (let tries = 0; tries < 20; tries++) {
      const s = spots[Math.floor(Math.random() * spots.length)];
      if (bursts.every(b => Math.hypot(s.x - b.x, s.y - b.y) > (b.R + fontSize * 0.5))) { spawnBurst(s.x, s.y, s.base); break; }
    }
    nextSpawn = t + rand(BURST_PAUSE[0], BURST_PAUSE[1]) / +$('burstFreq').value;
  }
}

let last = performance.now(), paused = false;
function frame(now) {
  if (!paused) update(Math.min(0.05, (now - last) / 1000));
  last = now;
  render();
  requestAnimationFrame(frame);
}

let timer;
const rebuild = () => { clearTimeout(timer); timer = setTimeout(build, 150); };
['name', 'density', 'needles'].forEach(id => $(id).addEventListener('input', rebuild));
window.addEventListener('resize', rebuild);

const ui = document.querySelector('.ui');
$('ui-hide').addEventListener('click', () => ui.style.display = 'none');
window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'h' && document.activeElement !== $('name')) ui.style.display = ui.style.display === 'none' ? '' : 'none';
});

window.__wire = { pause(v) { paused = v; }, render: () => render(true), update, get spots() { return spots; }, spawn: spawnBurst, get bursts() { return bursts; }, get stars() { return stars; }, setT(v) { t = v; } };

document.fonts.load(`${FONT_WEIGHT} 100px Inter`).finally(() => { build(); requestAnimationFrame(frame); });
