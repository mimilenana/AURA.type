// Früher in stil.js: Unschärfe und Körnung der weichen Seite (nicht mehr benutzt)

const begrenze = (x, a, b) => Math.max(a, Math.min(b, x));

// so viel Unschärfe bleibt mindestens, solange der Name weich ist
const MINDEST_WEICH = 0.3;

// Unschärfe-Radius in Pixeln (nur auf der weichen Seite, ab 0.5 wachsen Stacheln)
export function blurFuer(haerte, u) {
  if (haerte >= 0.5) return 0;
  const weich = Math.max(MINDEST_WEICH, begrenze((0.5 - haerte) / 0.5, 0, 1));
  return u * 0.08 * Math.pow(weich, 1.1);
}

// Körnung (0..1) auf der weichen Seite: je weicher, desto körniger
export function kornFuer(haerte) {
  const weich = begrenze((0.55 - haerte) / 0.55, 0, 1);
  return Math.pow(weich, 0.9);
}
