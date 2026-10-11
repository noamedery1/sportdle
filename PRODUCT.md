# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(One static build in Hebrew, served as the website and wrapped unchanged by Capacitor for the Google Play and App Store apps. Mobile web, not a native design language.)

## Users

A fan of one of five Israeli football clubs — Beitar Jerusalem, Hapoel Be'er Sheva, Maccabi Tel Aviv, Maccabi Haifa, Hapoel Tel Aviv — playing on a phone once a day for a minute or two, as a daily ritual. The result gets shared to WhatsApp groups. The friends duel is an occasional, social side mode played live with friends.

## Product Purpose

A daily "guess the player" puzzle per club: one mystery player from the club's history, up to 8 guesses, each guess revealing five factual clues (position, nationality, first season, titles, birth year) as exact / close / far, with arrows on the numeric ones. Success is the daily return and the shared result.

## Positioning

The only daily player puzzle built around Israeli club loyalty: each club is its own board ("ביתרdle", "מכביdle"…) with its own player history, compiled from public sources and fan-corrected. It is a fan project, not official.

## Operating Context

- Morning / commute play on a phone, often one-handed; Hebrew, right-to-left.
- Results shared as text to WhatsApp; invite links to duel rooms shared the same way.
- The app works offline (player database bundled); the daily puzzle is computed from the date.
- Optional daily local reminder notification in the app.

## Capabilities and Constraints

- Screens in scope of design work: club picker, daily puzzle (board, guess search with suggestions, win/lose result with stats and share), friends duel (home, lobby, round, reveal, end).
- Same HTML/CSS/JS for website and apps (`src/template.html`, `src/engine.js`, `src/versus.js`); no bundler; fonts must be local (`tools/fonts.mjs`, build fails on Google Fonts links).
- The club colour is applied at runtime through the `--brand` custom property; every club must work.
- Duel safety UI (terms consent, report/block, filtered nicknames) must remain present and visible — App Store Guideline 1.2.
- Content pages (how-to-play, archive, players, about, legal) are out of scope for now.
- AdSense on the website is planned; layout must leave room for it later.

## Brand Commitments

- Names are binding: "SportDle", and per club "<club>dle" (e.g. ביתרdle).
- Each club's colours are binding (Beitar yellow/black, Be'er Sheva red, Maccabi TA yellow/blue, Maccabi Haifa green, Hapoel TA red).
- Fan project, not affiliated with any club; no club crests or logos.
- Everything else — the yellow/black tape stripes, the Suez One wordmark, cards, typography, layout — is open to replacement.

## Evidence on Hand

- Real player data for all five clubs (`data/`), the live daily puzzle and archive.
- Current screens: `store/ios/*.png`, `store/play/*.png` (incumbent look, evidence only).
- App icon: `assets/` (yellow ball on rays). No testimonials, user counts or press to quote.

## Product Principles

1. The daily minute is sacred: the board must be readable at a glance, one-handed, in Hebrew.
2. Club loyalty is the hook — every screen should feel like *your* club's board.
3. Facts, not hype: clues are factual; no invented claims or stats.
4. Shareable by default: the result is designed to be posted to a group chat.
5. Fair and safe for everyone: duel moderation stays visible.

## Accessibility & Inclusion

Clues must never rely on colour alone (arrows/text accompany colour). Keyboard operation of the guess suggestions. Hebrew `lang`/`dir`. Accessibility statement at `/accessibility/` claims only what is true.
