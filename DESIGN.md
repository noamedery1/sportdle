---
name: SportDle
description: A daily guess-the-player game per Israeli club, set as the club's own supporter scarf on a light stone ground.
colors:
  stone-ground: "#ECEAE5"
  surface-white: "#FFFFFF"
  surface-row: "#F5F4F1"
  surface-hover: "#F1EFEA"
  segment-track: "#DEDBD4"
  ink: "#17181C"
  ink-secondary: "#454850"
  hairline: "#D4D0C8"
  row-divider: "#E6E3DD"
  control-edge: "#77736B"
  placeholder: "#5D6068"
  miss-slate: "#454750"
  dark-band-floor: "#26272D"
  dark-on-colour: "#121214"
  whatsapp-green: "#168A45"
  error-rust: "#9A3412"
  beitar-brand: "#FFC72C"
  beitar-near: "#8A6A1C"
  beitar-second: "#0C0C0E"
  hapoel-bs-brand: "#E4002B"
  hapoel-bs-near: "#8C2233"
  hapoel-bs-second: "#0C0C0E"
  maccabi-ta-brand: "#0033A0"
  maccabi-ta-near: "#6E8FD6"
  maccabi-ta-second: "#FFD100"
  maccabi-haifa-brand: "#00843D"
  maccabi-haifa-near: "#1E5B37"
  maccabi-haifa-second: "#FFFFFF"
  hapoel-ta-brand: "#C8102E"
  hapoel-ta-near: "#8C2233"
  hapoel-ta-second: "#FFFFFF"
typography:
  display:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "clamp(44px, 14vw, 72px)"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "clamp(22px, 7vw, 30px)"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  page-title:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "clamp(30px, 8.4vw, 44px)"
    fontWeight: 900
    lineHeight: 1.12
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 800
    lineHeight: 1.3
  tile-value:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "clamp(14px, 4.2vw, 19px)"
    fontWeight: 900
    lineHeight: 1.08
  body:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.75
  control:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
  label:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
rounded:
  scarf: "0px"
  swatch: "3px"
  tile: "8px"
  segment: "10px"
  control: "12px"
  segment-track: "14px"
  panel: "16px"
  pill: "22px"
  round: "50%"
spacing:
  board-gap: "10px"
  touch-min: "44px"
  primary-height: "50px"
  input-height: "56px"
components:
  button-primary:
    backgroundColor: "{colors.beitar-brand}"
    textColor: "{colors.dark-on-colour}"
    rounded: "{rounded.control}"
    typography: "{typography.control}"
    height: "50px"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    typography: "{typography.control}"
    padding: "10px 18px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.ink}"
  button-icon:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.round}"
    size: "44px"
  input-guess:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "14px 16px"
    height: "56px"
  segmented-tabs:
    backgroundColor: "{colors.segment-track}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.segment-track}"
    padding: "4px"
  chip:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "14px 18px 15px"
  clue-tile-exact:
    backgroundColor: "{colors.beitar-brand}"
    textColor: "{colors.dark-on-colour}"
    rounded: "{rounded.tile}"
    typography: "{typography.tile-value}"
  clue-tile-close:
    backgroundColor: "{colors.beitar-near}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.tile}"
    typography: "{typography.tile-value}"
  clue-tile-far:
    backgroundColor: "{colors.miss-slate}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.tile}"
    typography: "{typography.tile-value}"
---

# Design System: SportDle

## Overview

**Creative North Star: "The Supporter's Scarf on a Clean Counter"**

Each club's game is that club's knitted supporter scarf, laid out on a light stone ground. The scarf shows up in three places only: the header wordmark band with its fringe, the guess stripes, and the club picker, plus the small mini-scarf on the result card. Everything around it is plain and solid: white surfaces, ink text, controls with solid borders that look like controls. The knit carries the identity. The chrome doesn't compete with it.

The system is per-club. One set of rules is retinted at runtime from `config/clubs.json` through `applyTheme` (game) and `themeStyle` (content pages). Brand colour, second colour and "near" colour are all club data. Contrast-picked ink (dark-on-colour or white) is computed from luminance, never hand-assigned per club, so a club that changes its colours does not break anything.

The direction was first built as a dark navy knitted ground with sewn fabric labels and dashed stitch outlines. The owner rejected that twice and steered to the current light, smooth ground. None of the fabric-label language survives in the rendered result.

**Key Characteristics:**
- A light stone ground (never dark), with solid white surfaces and solid ink text.
- Club colour appears as knitted wool only in scarf bands. Everywhere else it is a flat fill.
- Controls are solid and bordered, at least 44px tall, and clearly controls.
- Clue tiles are flat, high-contrast swatches: exact, close, far.
- Guess reveal ("patches"): tiles drop onto the stripe like patches pressed onto a scarf.

## Colors

The palette is neutral warm stone with one club voice. Each club brings its binding brand colour, second colour and near colour, and the neutrals never change between clubs.

### Primary (per club, runtime `--brand`)
- **Club Brand** (beitar-brand, hapoel-bs-brand, maccabi-ta-brand, maccabi-haifa-brand, hapoel-ta-brand): the scarf body (wordmark band, guess-name band, result headline, picker scarf), primary buttons, the active tab, the selected suggestion, and the "exact" clue tile. Text on it is the contrast-picked dark-on-colour or white.

### Secondary (per club, runtime `--second` / `--second-band`)
- **Club Second** (…-second): the scarf's edge rows on the wordmark and picker, and the band behind the five clue tiles. A second colour darker than Dark Band Floor is raised to that floor so black wool still reads as wool. Clue labels on it use the contrast-picked colour.

### Tertiary (per club, runtime `--near-ui`)
- **Club Near** (…-near): the "close" clue tile, legend dot and mini-scarf cell. It is the club's own darker, deeper shade from config, with white text. It is never derived and never a white ring.

### Neutral
- **Stone Ground**: page, picker and status-bar colour (`theme-color`).
- **Surface White**: cards, inputs, secondary buttons, sheets, the suggestion list.
- **Surface Row**: rows inside cards (archive buttons, duel lists, question text, table headers).
- **Surface Hover**: the hover fill for secondary buttons, chips and the content-page top link.
- **Segment Track**: the tab-track background, inactive distribution bars and the duel progress bar.
- **Ink**: primary text, the focus ring, the hover border on controls, and the dark "reveal" button.
- **Ink Secondary**: secondary text, legend, footer, links in nav.
- **Hairline**: card borders and section dividers. **Row Divider** separates list rows inside a surface.
- **Control Edge**: the 1.5–2px border on every interactive control (4.3:1 on white).
- **Miss Slate**: the "far" clue tile, with white text.
- **WhatsApp Green**: the share button only. **Error Rust**: error text only.

### Named Rules
**The Three Signals Rule.** Exact is the club's full brand colour. Close is the club's own config near colour with white text. Far is Miss Slate gray. There is no fourth state, and no ring, outline or white variant of "close".

**The Club Colours Are Data Rule.** Club names and club colours come from `config/clubs.json` and are binding. Never hard-code a club colour in a component. Never pick on-colour ink per club: compute it from contrast.

**The Stone, Never Night Rule.** The ground is Stone Ground. A dark or navy page ground is rejected.

## Typography

**Display Font:** Heebo (with system-ui, sans-serif)
**Body Font:** Heebo (same family)

**Character:** A single Hebrew grotesque used across weights 400 to 900. The scarf voice is Heebo at 900, set tight and heavy like letters knitted into wool. The interface voice is Heebo 400–700 at comfortable sizes.

### Hierarchy
- **Display** (900, clamp(44px,14vw,72px), 76px at 640px and up, line-height 0.95): the "<club>dle" wordmark in the header scarf, on one line (Be'er Sheva drops to clamp(34px,11vw,64px)). The picker headline "SportDle" uses the same voice at clamp(34px,10vw,46px).
- **Headline** (900, clamp(22px,7vw,30px), 1.1): the guessed player's name on the brand band. The result headline uses clamp(30px,9vw,40px).
- **Page Title** (900, clamp(30px,8.4vw,44px), 1.12): content-page h1 in ink.
- **Title** (800, 23px, 1.3): content h2. Sheet titles are 900 at 26px.
- **Tile Value** (900, clamp(14px,4.2vw,19px), 1.08): clue values, which wrap and balance inside the tile instead of overflowing.
- **Body** (400, 17px with line-height 1.75; 18px at 640px and up, about 70ch in a 592px column): content pages. Game-surface prose is 14.5–15px.
- **Control** (700, 15px): secondary buttons, tabs, chips. Primary buttons are 800 at 17px.
- **Label** (600, 13px): clue labels above tiles, legend, small metadata.

### Named Rules
**The Solid Ink Wordmark Rule.** The club name in the header is set in solid ink (`--title-ink`: the club's second colour when that reaches 3:1 on brand, otherwise the contrast-picked ink). The knit texture is never clipped into the letters.

## Layout

The game is a single centred column. On mobile, scarf elements bleed past the column padding (guess rows use negative inline margins of −14px, and −30px at 640px and up) so stripes read as fabric running edge to edge. Header fringe hangs 28–36px outside the wordmark band. Guess rows stack with a 10px gap. Each row is a brand band over a second-colour band holding a five-column grid of clue tiles (`repeat(5,minmax(0,1fr))`), with labels sitting above the tiles inside the band. Below 360px, tiles tighten to a 5px gap and 13px values.

Content pages use a 700px wrapper (640px at 640px and up) with 16/24px side padding, a top bar holding a small scarf logo and one secondary link, and a generous vertical rhythm (48px before h2, 32px before h3, 18px after paragraphs).

The only breakpoint is 640px. Every interactive target is at least 44px tall.

## Elevation & Depth

The system is mostly flat and uses tonal layering: stone ground, then white surface, then a stone row inside it. Shadows are small and ambient, there to lift a control or a floating list off the ground, never decorative.

### Shadow Vocabulary
- **Control lift** (`box-shadow: 0 1px 2px rgba(23,24,28,.08)`): secondary buttons, icon buttons, content top link. It is removed on hover.
- **Primary press edge** (`box-shadow: inset 0 -3px 0 rgba(0,0,0,.18)`): a bottom inner shade on solid club-colour buttons.
- **Floating list** (`box-shadow: 0 12px 28px rgba(23,24,28,.18)`): the suggestion dropdown.
- **Scarf lift** (`box-shadow: 0 2px 6px rgba(23,24,28,.18)`): picker scarves.
- **Dialog** (`box-shadow: 0 18px 40px rgba(23,24,28,.25)`): duel confirmation modal.
- **Focus ring** (`outline: 2.5px solid #17181C; outline-offset: 3px`): every focusable element, visible on every club colour.

### Named Rules
**The Knit Is Diluted Rule.** Wherever the knit texture shows, a brand-colour wash at `--knit-mute` (0.68) sits over the multiplied knit, so the wool is felt rather than seen and text on it stays crisp.

## Shapes

There are two shape families. Scarf elements (header band, guess rows, result headline, picker scarves) are square-cornered (0) and bleed to the edge, with fringe images at the ends. Interface elements are softly rounded: 12px on controls and content cards, 8px on clue tiles, 16px on panels (duel card, dialog, app banner), 22px on pills (chips, streak, duel club pick), and fully round 44px icon buttons. Borders are always solid: 1px hairline on containers, and 1.5–2px Control Edge on anything you can press or type into.

## Components

### Buttons
Solid and unmistakable.
- **Shape:** gently rounded (12px).
- **Primary:** a flat club-brand fill with contrast-picked text, 800 at 17px, at least 50px tall, with the inner bottom press edge. Hover brightens by 5%.
- **Secondary:** white, 1.5px Control Edge border, ink text 700 at 15px, at least 44px tall, padding 10px 18px. Hover fills Surface Hover and turns the border to ink.
- **Icon:** 44px white circles with the same border (help, archive), using 18px SVG icons.
- **Dark:** an ink fill with white text (the yesterday "reveal" action).
- **Share:** WhatsApp Green with white text.

### Chips
- **Style:** white pill (22px), 1.5px Control Edge border, 700 at 15px, at least 44px tall. Hover behaves like the secondary button.
- **State:** a selected club pick in the duel becomes a brand fill with on-brand text.

### Cards / Containers
- **Corner Style:** 12px for content cards, 16px for duel cards and dialogs. The result card is square, because it sits under the scarf headline.
- **Background:** Surface White, with Surface Row for rows inside.
- **Shadow Strategy:** none, or the 1–3px ambient lift.
- **Border:** 1px Hairline. Club-linked content cards carry a 6px club-colour strip on the inline-start edge. Fact boxes and notes carry a 5px brand strip.
- **Internal Padding:** about 14–18px.

### Inputs / Fields
- **Style:** white, 2px Control Edge border, 12px radius, 56px tall for the guess field and 52px in the duel, value at 600 and 18px, Placeholder at full opacity.
- **Focus:** the border turns to ink, with a 3px `rgba(23,24,28,.14)` halo.
- **Suggestions:** a white list with a 1.5px border and the floating shadow. Rows are at least 46px tall, and the hovered or selected row fills with brand colour.

### Navigation
- **Tabs:** a segmented control. Segment Track background, 14px outer radius, 4px inset. Segments are 10px radius and at least 44px tall. The active segment is a brand fill with on-brand text and a slight lift. Inactive segments use Ink Secondary and wash white at 70% on hover.
- **Site nav / footer:** Ink Secondary links at 14px, turning to ink on hover, separated by a top hairline.

### Clue Tiles (signature)
Five flat swatches per guess, sitting on the second-colour band: exact = brand, close = club near with white text, far = Miss Slate with white text. They use 8px radius and a 1px inner edge (`outline: 1px solid rgba(0,0,0,.12)`) so tiles hold their shape on white second bands. Numeric clues carry drawn SVG arrows (up or down) in the digits' weight, so colour is never the only signal.

### Guess Reveal: "Patches" (signature motion)
The row drops in (`translateY(-22px)` to rest, 0.45s, `cubic-bezier(.2,.9,.25,1.15)`). Each tile falls in like a patch being pressed on: 0.9s, `cubic-bezier(.3,.7,.25,1)`, from −26px with −7° rotation and 1.15 scale, overshooting to +3px, 1.5° and 0.97 before settling. Exact tiles then get a 0.34s press (scale 1 to 0.92 to 1). Restored rows render instantly. `prefers-reduced-motion` turns all of it off.

### Header Scarf (signature)
The wordmark sits on a brand band of diluted knit, with 12px second-colour rows top and bottom and pre-rendered two-colour fringe at both ends (`src/static/scarf/fringe-<slug>.webp`, generated by `tools/scarf-fringe.mjs`). The content-page logo is the same object at small scale (6px edge rows, 22–26px fringe).

### Club Picker Scarves
Each club is a full scarf button: its brand colour over knit at 62% wash, 9px second-colour edge rows, its own fringe, and the club name in the second colour. The current club gets a stone gap and an ink ring (`0 0 0 3px ground, 0 0 0 6px ink`).

## Do's and Don'ts

### Do:
- **Do** keep the page ground at Stone Ground (#ECEAE5) on every surface, game and content alike.
- **Do** render "close" as the club's config near colour with white text, everywhere a close swatch appears, including the how-to-play demo and the legend.
- **Do** give every control a solid 1.5–2px border or a solid fill, at least 44px tall, and the 2.5px ink focus ring.
- **Do** set the header club name in solid `--title-ink`.
- **Do** restrict knit texture to scarf bands, always under the 0.68 brand wash.
- **Do** derive on-colour text from contrast (`applyTheme` / `themeStyle`), never per club by hand.
- **Do** pair every colour clue with text or an arrow.

### Don't:
- **Don't** use dashed borders or stitch outlines on anything.
- **Don't** put fabric or knit textures behind controls, labels, inputs or body text.
- **Don't** use a dark or navy page ground.
- **Don't** clip knit texture into the wordmark letters.
- **Don't** render "close" as a white tile with a brand ring. That was tried and it broke the habit of existing players.
- **Don't** rename clubs or substitute their colours.
