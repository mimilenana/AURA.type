# Nadel-Schrift

## Starten
1. Ordner in VS Code öffnen
2. Terminal öffnen (Terminal → Neues Terminal)
3. Einmalig: `npm install`
4. Dann: `npm run dev` → öffnet automatisch http://localhost:5173

Text unten im Feld eintippen. Mit **H** blendest du die Bedienleiste aus.

## So funktioniert es
- Der Text (Inter ExtraBold) wird in eine unsichtbare Maske gezeichnet.
- Entlang der Kontur werden viele Sterne verteilt; jeder Stern besteht aus mehreren
  dünnen Nadeln mit zufälliger Richtung (bevorzugt nach außen) und Länge.
- Im Ruhezustand zucken die Nadeln ruckartig in Schritten (wie Stop-Motion), nicht weich.
- Zufällig brechen an bis zu **2 Stellen gleichzeitig** die Stacheln aus – wie ein Aufspießen: In einem Ruck
  (ca. 0,1 s) schießen die Nadeln nach außen und richten sich dabei wie Speere aus, bleiben kurz draußen
  und schnappen schnell zurück. Ein Ausbruch besteht aus 1–3 Stichen hintereinander.
- Die Stellen sind nur **äußere Ecken, Spitzen sowie Ober- und Unterkanten** der Buchstaben
  (nicht die Innenräume von o, e, a …). Gemessen wird, wie frei ein Konturpunkt nach außen liegt.

## Feintuning (ganz oben in main.js)
- `STAR_SPACING` – wie viele Sterne an der Kontur sitzen
- `NEEDLE_MIN` / `NEEDLE_RANGE` – kürzeste Nadel und zusätzliche Länge der längsten
- `ANGLE_SPREAD` – wie breit die Nadeln um die Außenrichtung streuen
- `BURST_MAX` – wie viele Ausbrüche gleichzeitig (2)
- `BURST_SPOTS` – wie viele Konturpunkte als Ausbruchsstelle in Frage kommen (0.16 = die äußersten 16 %)
- `EXPOSURE_RADIUS` – Umkreis, in dem gemessen wird, wie "äußerlich" ein Punkt ist
- `STAB_COUNT`, `STAB_OUT`, `STAB_HOLD`, `STAB_BACK`, `STAB_GAP` – Anzahl und Timing der Stiche (kleinere Zeiten = zackiger)
- `SPEAR` – wie stark sich die Nadeln beim Stich nach außen ausrichten
- `BURST_RADIUS`, `BURST_PAUSE` – Größe der Stelle und Pausen zwischen Ausbrüchen
- `BURST_GROW` / `BURST_EXTRA` – wie stark vorhandene Nadeln wachsen / wie lang die neuen werden
- `EXTRA_NEEDLES` – wie viele zusätzliche Nadeln pro Stern herauskommen können

Regler im Browser: Dichte, Länge, Nadeln pro Stern, **Ausbruch-Stärke** (0 = aus), **Häufigkeit**, Bewegung, Invertieren.

## v10 – flüssiger & zackiger
- Ruhezustand wird gecacht (`IDLE_FPS`, Standard 12), nur die Ausbrüche werden jeden Frame gezeichnet → durchgehend flüssig.
- Stiche noch schneller: `STAB_OUT` 0.035–0.06 s raus, `STAB_BACK` 0.05–0.09 s zurück (kleinere Werte = schneller).
- Beim Zurückziehen bleibt kurz ein schwacher Nachbild-Schatten (Smear) für mehr Tempo-Gefühl.
