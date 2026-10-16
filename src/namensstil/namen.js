// ------------------------------------------------------------
// NAMEN: Eichliste für die Analyse.
//
// Aus diesen Namen wird berechnet, wo die Grenze zwischen
// hart/weich und hell/dunkel liegt: genau beim mittleren Wert
// (Median). So landen ungefähr gleich viele Namen in jeder Schrift.
//
// Ergänzt die Liste ruhig um die Namen eures Publikums (z. B. alle
// Namen eures Jahrgangs). Je passender die Liste, desto besser die
// Verteilung. Die Grenzen werden beim Start automatisch neu berechnet.
// ------------------------------------------------------------

export const NAMEN = `
Anna Emma Mia Sophia Hannah Emilia Lina Marie Lea Mila Clara Ella Leni Lena
Johanna Charlotte Luisa Amelie Laura Lara Sarah Julia Lisa Nele Paula Ida
Frieda Greta Mathilda Lotta Maja Sophie Ronja Pia Jana Katharina Anja Sabine
Petra Andrea Claudia Susanne Monika Ursula Renate Karin Birgit Heike Gabriele
Kerstin Nicole Stefanie Christina Melanie Sandra Martina Ute Silke Tanja
Daniela Nadine Jessica Jennifer Vanessa Michelle Svenja Franziska Kristin
Helga Ingrid Gisela Elke Inge Gerda Hildegard Erika Marta Milena Paulina Elif
Zeynep Noah Leon Paul Ben Finn Elias Felix Louis Henry Luca Emil Jonas Theo
Anton Maximilian Moritz Jakob Oskar David Liam Matteo Leo Karl Max Tim Lukas
Niklas Jan Tom Philipp Simon Julian Alexander Fabian Florian Tobias Sebastian
Daniel Christian Michael Thomas Andreas Stefan Markus Frank Peter Klaus
Wolfgang Jürgen Uwe Dieter Werner Günter Hans Kurt Horst Manfred Helmut Bernd
Rainer Ralf Dirk Jens Sven Torsten Holger Matthias Martin Patrick Dennis
Marcel Kevin Marco Robert Erik Fritz Otto Bruno Rudolf Heinz Walter Gerhard
Ludwig Konrad Mustafa Mehmet Ali Ahmed Yusuf Can Emre Lou Ruth Gudrun Kim Ole
Mats Hugo Vincent Valentin Benedikt Johannes Lorenz
`.trim().split(/\s+/);
