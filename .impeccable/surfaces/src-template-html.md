---
version: 1
slug: "src-template-html"
primary_target: "src/template.html"
related_targets: []
---

## Scope
Game surfaces in src/template.html (+ applyTheme in src/engine.js): club picker, daily puzzle board, result card, help/sheets, friends duel. Mode: Operate. Content pages out of scope.

## Direction contract
THESIS: The board is your club's scarf: every guess knits a new stripe. Refuses the category default of identical dark rounded cards and Wordle tiles.
OWN-WORLD: Knitted jacquard supporter scarf. Club brand colour + club "second" colour as wool bands (texture tinted by multiply), dark knitted ground, sewn beige fabric labels with stitched borders for tags and inputs, wool fringe at scarf ends. Heebo 900 knitted-in wordmark. Flat high-contrast clue swatches; no glow, no gradients, no card chrome.
STORY: The fan opens their club's scarf, types a name on the sewn label, and each guess knits a stripe: name on the brand band, five clue swatches on the second band. Result is the finished scarf to share.
FIRST VIEWPORT: Full-width knitted header band with fringe at both ends and "<club>dle" knit into it; tilted fabric tag "חידה #N · X ניסיונות"; stitched club switch; tabs; fabric search label; then guess stripes, each brand band (name) over second band (labels above five swatches).
FORM: Fan scarf, position 4 of my ordered list (1 scoreboard, 2 Toto form, 3 sticker album, 4 scarf, 5 season ticket, 6 sports supplement, 7 tactics board); seed key 509afb77.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Notes
Comp-led with the user's explicit go-ahead; the measured spec/plate/hero gates were not run because the surface is dynamic and per-club (textures are crops of the approved comp, desaturated and tinted at runtime). Approved comp: .impeccable/mocks/scarf-comp.png.
