// ------------------------------------------------------------
// STIL: Schriftstärke und Laufweite. Sie sind für alle Namen gleich,
// der Klang entscheidet nur über den Modus (siehe modi.js).
//
// Das sind eure gestalterischen Stellschrauben.
// ------------------------------------------------------------

const SCHRIFT_STIL = {
  wght: 600,          // 100 = Thin, 400 = Regular, 900 = Black
  laufweite: 0.02,    // in Geviert: negativ = enger, positiv = weiter
};

export function typoFuer() {
  return SCHRIFT_STIL;
}
