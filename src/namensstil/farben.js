// ------------------------------------------------------------
// FARBMODI: Es gibt vier Farbwelten für helle und vier für dunkle Namen.
// Welche Reihe gilt, hängt vom Modus des Namens ab (hell oder dunkel),
// welche der vier Farbwelten, wählt man im Control-Panel.
//
//   vorne   die Schriftfarbe
//   hinten  der Hintergrund
//   verlauf nur für dunkel · weich (Thermo): fünf Farben von kalt nach
//           heiß. Weil nur Schrift und Hintergrund vorgegeben sind, wurden
//           die Farben dazwischen ergänzt: vom Hintergrund aus über eine
//           kräftigere Zwischenfarbe zur Schriftfarbe und weiter zu einer
//           hellen Spitze. Bei der vierten Welt bleibt der bekannte
//           Wärmebild-Verlauf (violett, rot, orange, gelb, hell).
//           Die ergänzten Farben sind ein Vorschlag und gern änderbar.
// ------------------------------------------------------------

const hex = (text) => ({
  r: parseInt(text.slice(0, 2), 16),
  g: parseInt(text.slice(2, 4), 16),
  b: parseInt(text.slice(4, 6), 16),
});

const HELL = [
  { name: 'Weinrot auf Rosa', vorne: hex('670626'), hinten: hex('ffbdc5') },
  { name: 'Blau auf Limette', vorne: hex('0824fd'), hinten: hex('c1f96c') },
  { name: 'Rot auf Orange', vorne: hex('f91010'), hinten: hex('ffb53d') },
  { name: 'Schwarz auf Weiß', vorne: hex('000000'), hinten: hex('ffffff') },
];

const DUNKEL = [
  {
    name: 'Lavendel auf Dunkelrot', vorne: hex('9c66ff'), hinten: hex('330000'),
    verlauf: ['8a1030', 'e0402a', 'ff9a6a', '9c66ff', 'e4d6ff'].map(hex),
  },
  {
    name: 'Limette auf Violett', vorne: hex('8eff01'), hinten: hex('3e016f'),
    verlauf: ['7b14a8', 'e0287a', 'ffb020', '8eff01', 'ecffb0'].map(hex),
  },
  {
    name: 'Oliv auf Dunkelgrün', vorne: hex('b8c322'), hinten: hex('052900'),
    verlauf: ['0f6b1a', '3fae2a', '8fd32a', 'b8c322', 'f6ffb0'].map(hex),
  },
  { name: 'Weiß auf Schwarz', vorne: hex('ffffff'), hinten: hex('000000'), verlauf: null },
];

export const FARBMODI = ['Farbmodus 1', 'Farbmodus 2', 'Farbmodus 3', 'Farbmodus 4'];

// Die Farben für einen Modus (zum Beispiel 'dunkel · weich') und einen Farbmodus
export function farbenFuer(modus, farbmodus) {
  const nummer = Math.max(0, FARBMODI.indexOf(farbmodus));
  const reihe = modus.startsWith('hell') ? HELL : DUNKEL;
  return reihe[nummer];
}
