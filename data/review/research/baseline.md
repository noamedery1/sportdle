# Baseline — player data state and upcoming-puzzle risk

Generated 2026-10-11 (read-only). Puzzle #1 = 2026-8-24; today is puzzle **#49** (index 48). Answer for puzzle n = POOL[(n-1) % POOL.length], POOL = schedule filtered to playable players (src/engine.js `answerFor`, `bootClub`).

Machine-readable: `data/review/research/baseline.json`. Fresh tool outputs (gaps/hidden/trust/audit re-run today, then tracked files restored): `data/review/research/fresh/`.

## 0. Read this first — the committed review files are stale

The committed `data/review/trust.csv`, `unconfirmed.json`, `audit.csv`, `hidden.md` predate the current `data/clubs/*.json` (e.g. committed trust.md says Beitar 410 players; DB has 494). Re-running the four tools changed all of them. Consequences:

- `build.mjs` reads the **committed** `unconfirmed.json` (12/82/57/43/54). A fresh `trust.mjs` yields 34/94/78/51/77 — **87 more players would be hidden** from the guess list if trust were re-run before the release build. None of them is in any schedule, so the build would not fail and no puzzle answer moves.
- All risk assessment below uses the **fresh** trust/audit outputs.

## 1. Numbers per club

| club | in DB | shown in game (now) | shown if trust re-run | hidden now | no pos | no born | pool (=schedule) | trust all: confirmed / single / contradicting | pool trust | published so far | cycle date | days left |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| beitar (ביתרdle) | 494 | 482 | 460 | 12 | 0 | 17 | 214 | 460 / 34 / 0 | 214 confirmed | 49 | 2027-03-26 | **166** |
| hapoel-bs (באר־שבעdle) | 453 | 305 | 293 | 148 | 147 | 147 | 146 | 359 / 94 / 0 | 146 confirmed | 49 | 2027-01-17 | **98** |
| hapoel-ta (הפועלdle) | 550 | 452 | 431 | 98 | 98 | 97 | 183 | 472 / 78 / 0 | 183 confirmed | 49 | 2027-02-23 | **135** |
| maccabi-haifa (חיפהdle) | 456 | 378 | 369 | 78 | 77 | 77 | 215 | 405 / 51 / 0 | 215 confirmed | 49 | 2027-03-27 | **167** |
| maccabi-ta (מכביdle) | 473 | 395 | 372 | 78 | 77 | 77 | 205 | 396 / 76 / 1 | 205 confirmed | 49 | 2027-03-17 | **157** |

- "hidden now" = no position, or in committed unconfirmed.json. "no pos"/"no born" counted on the whole DB.
- Cycle date = date of puzzle #(pool+1), when the answer list starts over. **Hapoel Be'er Sheva is the first, on 2027-01-17 (98 days)**; it is the only club that wraps within the 120-day window.
- Maccabi Haifa has a configured reset of puzzle #7 (`site.json` reset).
- Every pool member is "confirmed" (≥2 sources). Single-source and contradicting players are only in the guess list, not answers. The one contradicting player (אלי פוקס, Maccabi TA, en-wiki career lists only Maccabi Haifa) is not in the pool, and he is shown in the game until trust is re-run.
- Config `published-beitar.json` (119 names) is still an exact prefix of the Beitar schedule: true.

## 2. Top 20 risky upcoming puzzles (next 120 days, ranked by score)

The score is a heuristic: it adds weights for the trust level, audit contradictions, IFA cross-checks (born, nationality, roster seasons, off-by-one season shift), positions that differ across clubs, Latin aliases that don't match the Hebrew name (bridged to someone else's data), and single-season forced answers. Full flag lists are in baseline.json.

| # | club | puzzle | date | player | trust/src | score | why |
|---|---|---|---|---|---|---|---|
| 1 | hapoel-ta | #94 | 2026-11-25 | ניר רחמין | confirmed/4 | 22 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: GK · worldfootball: FW; pos FW here vs GK at hapoel-bs; raw nat NG overridden by nat-extra to IL — check the rest of the record; Latin alias "Henry Nwosu" does not transliterate-match "ניר רחמין" (score 0.6) (mis-bridge?) |
| 2 | hapoel-bs | #58 | 2026-10-20 | בן ביטון | confirmed/5 | 20 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; DB seasons (2003+) not in IFA roster: 20/21; pos MF here vs DF at beitar; pos MF here vs DF at hapoel-ta; pos MF here vs DF at maccabi-ta; Latin alias "Feras Awad" does not transliterate-match "בן ביטון" (score 0.4) (mis-bridge?) |
| 3 | maccabi-ta | #166 | 2027-02-05 | הנרי אדו | confirmed/5 | 14 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; IFA roster marks local but nat=GH; IFA roster seasons missing from DB: 23/24; DB seasons (2003+) not in IFA roster: 25/26; possible off-by-one season: DB 24/25,25/26 vs IFA 23/24,24/25 |
| 4 | hapoel-ta | #50 | 2026-10-12 | בן ביטון | confirmed/5 | 13 | IFA roster seasons missing from DB: 20/21; DB seasons (2003+) not in IFA roster: 10/11, 11/12, 12/13; pos DF here vs MF at hapoel-bs; Latin alias "Sintayehu Sallalich" does not transliterate-match "בן ביטון" (score 0.33) (mis-bridge?) |
| 5 | maccabi-haifa | #51 | 2026-10-13 | סינטאיהו סלליך | confirmed/5 | 13 | DB seasons (2003+) not in IFA roster: 11/12, 12/13, 13/14; pos MF here vs FW at beitar; pos MF here vs FW at hapoel-bs; Latin alias "Seydouba Soumah" does not transliterate-match "סינטאיהו סלליך" (score 0.4) (mis-bridge?) |
| 6 | maccabi-haifa | #152 | 2027-01-22 | ירדן שועה | confirmed/5 | 13 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster seasons missing from DB: 18/19; Latin alias "Ikouwem Utin" does not transliterate-match "ירדן שועה" (score 0.4) (mis-bridge?) |
| 7 | maccabi-haifa | #167 | 2027-02-06 | גוני נאור | confirmed/5 | 13 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; IFA roster seasons missing from DB: 22/23; DB seasons (2003+) not in IFA roster: 24/25, 25/26; possible off-by-one season: DB 23/24,24/25,25/26 vs IFA 22/23,23/24 |
| 8 | maccabi-haifa | #57 | 2026-10-19 | יניב קטן | confirmed/5 | 11 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 05/06; Latin alias "John Culma" does not transliterate-match "יניב קטן" (score 0.4) (mis-bridge?) |
| 9 | maccabi-haifa | #126 | 2026-12-27 | גיז'רמו ישראלביץ' | confirmed/5 | 11 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); nat AR vs IFA IL; IFA roster marks local but nat=AR; IFA roster seasons missing from DB: 03/04 |
| 10 | beitar | #135 | 2027-01-05 | אוראל חורב | confirmed/2 | 11 | only 2 sources, one is legacy production DB (התאחדות · הגרסה שבייצור); IFA roster seasons missing from DB: 13/14; DB seasons (2003+) not in IFA roster: 12/13, 16/17; possible off-by-one season: DB 12/13,16/17 vs IFA 13/14 |
| 11 | maccabi-ta | #140 | 2027-01-10 | ג'ורג'ה יובאנוביץ' | confirmed/4 | 11 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster marks local but nat=RS; IFA roster seasons missing from DB: 21/22; nat RS here vs IL at maccabi-haifa |
| 12 | maccabi-ta | #147 | 2027-01-17 | ג'ונתן אסוס | confirmed/5 | 11 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); nat FR vs IFA IL; IFA roster marks local but nat=FR; IFA roster seasons missing from DB: 07/08 |
| 13 | hapoel-ta | #156 | 2027-01-26 | לי און מזרחי | confirmed/5 | 11 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); pos MF here vs DF at beitar |
| 14 | hapoel-bs | #70 | 2026-11-01 | מאור בוזגלו | confirmed/4 | 10 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; Latin alias "Mihály Korhut" does not transliterate-match "מאור בוזגלו" (score 0.6) (mis-bridge?) |
| 15 | beitar | #78 | 2026-11-09 | תמיר עדי | confirmed/4 | 10 | audit עונות/סתירה: ויקיפדיה מוסיפה 23/24 · המאגר מוסיף 22/23; audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF; played 22/23 but name not found in IFA rosters (transliteration?) |
| 16 | maccabi-haifa | #82 | 2026-11-13 | אדין צוצאליץ' | confirmed/5 | 10 | IFA roster marks local but nat=BA; IFA roster seasons missing from DB: 11/12; DB seasons (2003+) not in IFA roster: 14/15; possible off-by-one season: DB 12/13,13/14,14/15 vs IFA 11/12,12/13,13/14 |
| 17 | hapoel-ta | #144 | 2027-01-14 | עוביידה חטאב | confirmed/5 | 10 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); Latin alias "Avraham Chekol" does not transliterate-match "עוביידה חטאב" (score 0.33) (mis-bridge?) |
| 18 | beitar | #145 | 2027-01-15 | בני חדד | confirmed/4 | 10 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF; pos MF here vs DF at hapoel-ta; pos MF here vs DF at maccabi-haifa |
| 19 | hapoel-bs | #111 | 2026-12-12 | חנן ממן | confirmed/5 | 9 | IFA roster seasons missing from DB: 17/18; DB seasons (2003+) not in IFA roster: 19/20; possible off-by-one season: DB 18/19,19/20 vs IFA 17/18,18/19 |
| 20 | beitar | #125 | 2026-12-26 | חן עזרא | confirmed/6 | 9 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 16/17 — ייתכן שאלה עונות השאלה; audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF; pos FW here vs MF at hapoel-ta |

## 3. Systemic findings

### 3a. Latin aliases that belong to someone else (29 players, all in answer pools)

The bridge attached a different player's Latin name to these Hebrew records. That is how the known errors got in: ניר רחמין got Henry Nwosu's record (Nigerian forward), יניב אלול got Blessing Kaku's, בן לוז got Denis Onishenko's, and מאור בוזגלו got Mihály Korhut's. `nat-extra.json` patches the nationality, but **position, birth year and seasons may still come from the other player**. (Possible false positives: אבי יחיאל ↔ Avi Yehiel is a transliteration match. A few real mismatches score above the 0.6 cutoff, e.g. שרן ייני ↔ Rúben Micael, so the list is not exhaustive.)

| club | puzzle | player | alias | pos | born | nat (raw) |
|---|---|---|---|---|---|---|
| maccabi-ta | #2 | דור תורג'מן | Rareş Ilie | FW | 2003 | IL |
| hapoel-bs | #5 | אוהד לויטה | Yaniv Ifergan | GK | 1986 | IL |
| hapoel-ta | #16 | רוי קורין | Ido Sharon | GK | 2002 | IL |
| hapoel-ta | #24 | אדי גוטליב | Amir Agayev | DF | 1992 | IL |
| maccabi-haifa | #28 | דין דוד | Matías Nahuel | FW | 1996 | IL |
| hapoel-bs | #30 | יניב אלול | Blessing Kaku | MF | 1978 | NG |
| hapoel-ta | #30 | עומרי אלטמן | Raz Stain | FW | 1994 | IL |
| hapoel-ta | #31 | בן לוז | Denis Onishenko | MF | 1978 | UA |
| maccabi-haifa | #36 | אייל משומר | Islam Cana'an | DF | 1983 | IL |
| hapoel-ta | #47 | אוראל דגני | Tal Benesh | DF | 1989 | IL |
| hapoel-bs | #48 | חאתם אלחמיד | Davide Petrucci | DF | 1991 | IL |
| maccabi-ta | #48 | דדי בן דיין | Bruno Reis | DF | 1978 | IL |
| hapoel-ta | #50 | בן ביטון | Sintayehu Sallalich | DF | 1991 | IL |
| hapoel-ta | #51 | סלים טועמה | Tomer Ben Yousef | MF | 1979 | IL |
| maccabi-haifa | #51 | סינטאיהו סלליך | Seydouba Soumah | MF | 1991 | IL |
| maccabi-haifa | #57 | יניב קטן | John Culma | FW | 1981 | IL |
| hapoel-bs | #58 | בן ביטון | Feras Awad | MF | 1991 | IL |
| hapoel-bs | #70 | מאור בוזגלו | Mihály Korhut | FW | 1988 | IL |
| maccabi-ta | #88 | אבי יחיאל | Avi Yehiel | DF | 1979 | IL |
| maccabi-haifa | #89 | דקל קינן | Thembinkosi Fanteni | DF | 1984 | IL |
| maccabi-haifa | #92 | עופרי ארד | Mohammad Abu Fani | DF | 1998 | IL |
| hapoel-ta | #94 | ניר רחמין | Henry Nwosu | FW | 1980 | NG |
| maccabi-haifa | #94 | אמיר אדרי | Eran Levy | GK | 1985 | IL |
| maccabi-ta | #101 | אבי סטרול | Elad Bounfeld | DF | 1980 | IL |
| maccabi-haifa | #103 | אסמאעיל ריאן | Iyad Abu Abaid | DF | 1994 | IL |
| maccabi-haifa | #104 | סאן מנחם | Kerim Frei | DF | 1993 | IL |
| hapoel-bs | #119 | אבי יחיאל | Avi Yehiel | DF | 1979 | IL |
| hapoel-ta | #144 | עוביידה חטאב | Avraham Chekol | DF | 1992 | IL |
| maccabi-haifa | #152 | ירדן שועה | Ikouwem Utin | FW | 1999 | IL |

Most urgent: **ניר רחמין, Hapoel TA #94 (2026-11-25)**. He is shown as a forward, while Wikipedia and his Be'er Sheva record say goalkeeper. VERIFY.md §3b says this was fixed by `enrich --ifaborn`, but the current data still has FW, raw nat NG and the alias Henry Nwosu, so that fix does not appear to be applied.

### 3b. Answers with only one season (40 in schedules; 36 published or in the next 120 days)

These players were scheduled when they had at least 2 seasons. A later data correction cut them to 1, and `enrich` keeps them as forced answers because the schedule is append-only (`data/review/<slug>.json` → forcedTargets: hapoel-bs 6, hapoel-ta 18, maccabi-haifa 11, maccabi-ta 5). A 1-season player is an obscure answer, and the correction that cut the seasons suggests the original attribution may have been wrong.

hapoel-bs #88 לאנדרו סימיוני · hapoel-bs #95 גאטאן וארן · hapoel-bs #96 אנדרה מרטינש · hapoel-bs #97 דניאל ליפשיץ · hapoel-bs #100 זיו קבדה · hapoel-bs #102 גיאורגי קיפיאני · hapoel-ta #39 אלי אוזן · hapoel-ta #55 יעקב בריהון · hapoel-ta #80 סרגיי פוגודין · hapoel-ta #82 סתיו למקין · hapoel-ta #104 יעקב כהן · hapoel-ta #114 אמיליוס זובאס · hapoel-ta #122 דוד קופרמן · hapoel-ta #123 יעקב שוורץ · hapoel-ta #135 מאור בוזגלו · hapoel-ta #136 אלין טופוזאקוב · hapoel-ta #138 סמואל יבואה · hapoel-ta #143 רועי דיין · hapoel-ta #144 עוביידה חטאב · hapoel-ta #148 שמעון הרוש · hapoel-ta #149 שחר פיבן · hapoel-ta #151 פייסל מוליץ' · hapoel-ta #156 לי און מזרחי · hapoel-ta #161 אור אוסטוינד · maccabi-haifa #32 איתן עזריה · maccabi-haifa #118 גדי קינדה · maccabi-haifa #126 גיז'רמו ישראלביץ' · maccabi-haifa #129 עומר דמארי · maccabi-haifa #134 אטיין ריינן · maccabi-haifa #152 ירדן שועה · maccabi-haifa #157 עמוס סאסי · maccabi-haifa #159 יהושע גל · maccabi-ta #94 גבי לסרי · maccabi-ta #131 יוסי בניון · maccabi-ta #140 ג'ורג'ה יובאנוביץ' · maccabi-ta #147 ג'ונתן אסוס

### 3c. Possible off-by-one seasons vs IFA rosters

Overall, IFA rosters line up with the DB with no shift (see the per-year check in this run). Even so, 16 published or upcoming answers have DB seasons that match IFA better when shifted one year (e.g. גוני נאור DB 23/24–25/26 vs IFA 22/23–23/24; הנרי אדו DB 24/25–25/26 vs IFA 23/24–24/25). VERIFY.md calls this out as the Transfermarkt `saison_id` trap. An error here moves the "first season" clue by one year.

### 3d. Legacy production DB counted as an independent source (Beitar)

"הגרסה שבייצור" is the old Beitardle data. For these Beitar answers it is one of only two sources, so the "confirmed" level is weaker than it looks: #17 אבי כהן, #62 ג'ורג' פאולינו, #72 יוסי אברהמי, #134 אדם מורינו, #135 אוראל חורב, #143 דניאל שמשיאלשווילי, #146 יעקב מזרחי, #151 אבירם זיאת, #167 אופק עברי. Four of them (אדם מורינו, דניאל שמשיאלשווילי, יעקב מזרחי, אופק עברי) have an audit row saying no Wikipedia, IFA or worldfootball record — their second source is a transliteration bridge or Transfermarkt.

### 3e. Open identity questions from VERIFY/MISSING that touch live puzzles

- עמנואל בואטנג — Hapoel TA **#57, 2026-10-19**. IFA has two ids (204923, 319808). The DB record is the 18/19–20/21 one; the 25/26 IFA season belongs to the other person and is correctly not merged. Still listed as an open question in MISSING.md.
- מוחמד גדיר — Maccabi Haifa #21 (already published). IFA has two ids (4034, 118820); the DB record is 08/09–14/15, born 1991.
- גרשון קופי — Hapoel BS #34 (already published). Confirmed by worldfootball, en-wiki career and Transfermarkt, but VERIFY says the Hebrew Wikipedia entry has no Hapoel BS and IFA knows only "גיימס ביסו" (2011). Still unresolved.

## 4. Internal consistency (all players)

| check | findings |
|---|---|
| duplicate Hebrew names within a club | 0 |
| alias colliding with another player's name in the same club | 0 |
| seasons field ≠ sum of spells | 0 |
| titles ≠ recomputed from data/raw/titles.json | 0 |
| invalid/overlapping/future spells | 0 |
| born outside 1900–2010 | 1 |
| debut age <15 or >40 | 5 |
| same name across clubs, born differs by 1–3 years | 1 |
| same person (same name, same/unknown born) with different pos across clubs | 44 pairs |
| same person on two of our clubs in the same season | 54 |
| Latin alias not matching Hebrew name (score ≤0.6) | 29 |

**Born / debut age** (none of these is an answer, but all are shown in the guess list):

- maccabi-ta · סטיב גורי · born 2015
- beitar · יצחק ג'אנו · born 1954 · first season 68/69 (age 14)
- hapoel-ta · משה פוליאקוב · born 1910 · first season 24/25 (age 14)
- hapoel-ta · אדמונד שמילוביץ' · born 1973 · first season 46/47 (age -27)
- maccabi-haifa · אברהם מנצ'ל · born 1950 · first season 52/53 (age 2)
- maccabi-ta · סטיב גורי · born 2015 · first season 12/13 (age -3)

Clear errors in that list: סטיב גורי (born 2015, played 12/13), אדמונד שמילוביץ' (born 1973, played 46/47–51/52), אברהם מנצ'ל (born 1950, played 52/53–64/65). משה פוליאקוב (14, 1924/25) and יצחק ג'אנו (14, 1968/69) are plausible but worth a look.

**Cross-club born difference:** אלי כהן: hapoel-ta 1960 MF vs maccabi-haifa 1961 DF — probably two different people.

**Position differs across clubs** (same game, same person, different first clue). Goalkeeper conflicts are the serious ones (ניר רחמין GK/FW). Outfield differences (MF/DF/FW) are often a real change over a career, but the game shows them as fixed facts:

- יוסי זאנה: beitar 1957 FW · hapoel-ta 1957 DF
- יעקב בוזגלו: beitar 1957 FW · hapoel-ta 1957 MF
- בני חדד: beitar 1977 MF · hapoel-ta 1977 DF
- בני חדד: beitar 1977 MF · maccabi-haifa 1977 DF
- עידן ורד: beitar 1989 MF · hapoel-ta 1989 FW
- עידן ורד: hapoel-ta 1989 FW · maccabi-haifa 1989 MF
- משה מישאלוף: beitar 1983 MF · maccabi-ta 1983 DF
- ערן לוי: beitar 1985 FW · hapoel-bs 1985 MF
- ערן לוי: beitar 1985 FW · maccabi-haifa 1985 MF
- ערן לוי: beitar 1985 FW · maccabi-ta 1985 MF
- אבישי כהן: beitar 1995 DF · maccabi-ta 1995 FW
- סינטאיהו סלליך: beitar 1991 FW · maccabi-haifa 1991 MF
- סינטאיהו סלליך: hapoel-bs 1991 FW · maccabi-haifa 1991 MF
- דוד קלטינס: beitar 1995 DF · hapoel-bs 1995 MF
- דוד קלטינס: beitar 1995 DF · hapoel-ta 1995 MF
- אלעד גבאי: beitar 1985 DF · maccabi-haifa 1985 MF
- חן עזרא: beitar 1989 FW · hapoel-ta 1989 MF
- חן עזרא: hapoel-bs 1989 FW · hapoel-ta 1989 MF
- חן עזרא: hapoel-ta 1989 MF · maccabi-haifa 1989 FW
- עוז ראלי: beitar 1987 MF · maccabi-ta 1987 DF
- שון גולדברג: beitar 1995 MF · hapoel-bs 1995 DF
- שון גולדברג: beitar 1995 MF · hapoel-ta 1995 DF
- שון גולדברג: beitar 1995 MF · maccabi-haifa 1995 DF
- שון גולדברג: beitar 1995 MF · maccabi-ta 1995 DF
- אלירן עטר: beitar 1987 FW · maccabi-ta 1987 MF
- אלירן עטר: maccabi-haifa 1987 FW · maccabi-ta 1987 MF
- לי און מזרחי: beitar 2002 DF · hapoel-ta 2002 MF
- לירן רוטמן: beitar 1996 MF · hapoel-ta 1996 FW
- מיכאל אוחנה: beitar 1995 MF · hapoel-bs 1995 FW
- מיכאל אוחנה: beitar 1995 MF · maccabi-haifa 1995 FW
- בן ביטון: beitar 1991 DF · hapoel-bs 1991 MF
- בן ביטון: hapoel-bs 1991 MF · hapoel-ta 1991 DF
- בן ביטון: hapoel-bs 1991 MF · maccabi-ta 1991 DF
- טימוטי מוזי: beitar 2001 MF · maccabi-haifa 2001 FW
- ניר רחמין: hapoel-bs 1980 GK · hapoel-ta 1980 FW
- ברק בדש: hapoel-bs 1982 FW · hapoel-ta 1982 MF
- ברק בדש: hapoel-ta 1982 MF · maccabi-ta 1982 FW
- אילון אלמוג: hapoel-bs 1999 MF · maccabi-ta 1999 FW
- גיא בדש: hapoel-bs 1994 MF · hapoel-ta 1994 FW
- עומר פרץ: hapoel-ta 1986 DF · maccabi-ta 1986 FW
- עומרי אלטמן: hapoel-ta 1994 FW · maccabi-ta 1994 MF
- עמירן שקלים: hapoel-ta 1988 DF · maccabi-ta 1988 MF
- דני גרופר: hapoel-ta 1999 MF · maccabi-ta 1999 DF
- אלן מסודי: maccabi-haifa 1978 MF · maccabi-ta 1978 FW

**Same season at two of our clubs** (mid-season transfers are possible, so treat this as a pointer, not an error). Two-season overlaps are the ones to check first: אריק בנדו (beitar+maccabi-haifa 94/95, 95/96); אורי דהן (beitar+maccabi-haifa 22/23, 23/24); ירין לוי (beitar+maccabi-haifa 24/25, 25/26).

- אורי מלמיליאן (1957) beitar + maccabi-ta: 89/90
- אהוד כחילה (1968) beitar + hapoel-bs: 97/98
- יעקב הלל (1966) beitar + hapoel-ta: 97/98
- אריק בנדו (1973) beitar + maccabi-haifa: 94/95, 95/96
- אלון חרזי (1971) beitar + maccabi-haifa: 97/98
- גולן דרעי (1975) beitar + maccabi-haifa: 99/00
- גולן דרעי (1975) hapoel-bs + maccabi-haifa: 01/02
- אלירן דנין (1984) beitar + maccabi-haifa: 07/08
- שלומי ארבייטמן (1985) hapoel-ta + maccabi-haifa: 07/08
- חן עזריאל (1988) beitar + maccabi-haifa: 12/13
- קובי מויאל (1987) beitar + maccabi-haifa: 15/16
- אנדריי פילאבסקי (1988) beitar + maccabi-haifa: 11/12
- חיים מגרלשוילי (1982) beitar + maccabi-haifa: 11/12
- ערן לוי (1985) maccabi-haifa + maccabi-ta: 04/05
- משה לוגסי (1991) beitar + maccabi-ta: 13/14
- סינטאיהו סלליך (1991) beitar + maccabi-haifa: 13/14
- שלומי אזולאי (1989) (1989) beitar + hapoel-ta: 14/15
- שלומי אזולאי (1989) (1989) beitar + maccabi-haifa: 13/14
- חנן ממן (1989) beitar + hapoel-bs: 19/20
- תומר סויסה (1988) beitar + hapoel-bs: 14/15
- איתי שכטר (1987) beitar + maccabi-haifa: 15/16
- שמעון אבו חצירא (1986) beitar + maccabi-haifa: 15/16
- חן עזרא (1989) beitar + hapoel-ta: 16/17
- יוסי בניון (1980) beitar + maccabi-ta: 16/17
- ישראל זגורי (1990) beitar + hapoel-ta: 16/17
- שון גולדברג (1995) beitar + maccabi-ta: 17/18
- שון גולדברג (1995) hapoel-ta + maccabi-ta: 14/15
- אלירן עטר (1987) beitar + maccabi-ta: 19/20
- אוראל דגני (1989) hapoel-ta + maccabi-haifa: 13/14
- אדוארדו גררו (2000) beitar + maccabi-ta: 22/23
- אורי דהן (1999) beitar + maccabi-haifa: 22/23, 23/24
- איליי מדמון (2003) beitar + hapoel-bs: 22/23
- איתמר ישראלי (1992) beitar + maccabi-haifa: 22/23
- בר כהן (2001) beitar + maccabi-ta: 22/23
- סתיו נחמני (2002) beitar + maccabi-haifa: 22/23
- בן ביטון (1991) hapoel-bs + maccabi-ta: 20/21
- ירין לוי (2005) beitar + maccabi-haifa: 24/25, 25/26
- גליל בן שאנן (1982) hapoel-bs + hapoel-ta: 12/13
- דיא סבע (1992) hapoel-bs + maccabi-ta: 12/13
- רועי קהת (1992) hapoel-bs + maccabi-ta: 12/13
- מתן אוחיון (1986) hapoel-ta + maccabi-haifa: 14/15
- עמית ביטון (1996) hapoel-bs + hapoel-ta: 16/17
- עדן בן בסט (1986) hapoel-ta + maccabi-haifa: 08/09
- רותם חטואל (1998) hapoel-bs + hapoel-ta: 24/25
- אור בלוריאן (2000) hapoel-bs + hapoel-ta: 23/24
- תומר חמד (1987) hapoel-bs + maccabi-haifa: 23/24
- אלון תורג'מן (1991) hapoel-ta + maccabi-haifa: 15/16
- בן רייכרט (1994) hapoel-ta + maccabi-ta: 14/15
- שובל גוזלן (1994) hapoel-ta + maccabi-haifa: 14/15
- אייל משומר (1983) hapoel-ta + maccabi-haifa: 16/17
- שחר הירש (1993) hapoel-ta + maccabi-haifa: 16/17
- קאיו אלבס (1986) hapoel-ta + maccabi-haifa: 18/19
- גוני נאור (1999) hapoel-ta + maccabi-haifa: 24/25
- ליאור רוזנטל (1965) maccabi-haifa + maccabi-ta: 89/90

## 5. Already-published puzzles (#1–#48)

All published answers are "confirmed". Those with score ≥5:

| club | puzzle | player | score | flags |
|---|---|---|---|---|
| beitar | #7 | יעקב בריהון | 7 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 15/16 — ייתכן שאלה עונות השאלה; audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF; DB seasons (2003+) not in IFA roster: 15/16 |
| beitar | #10 | שי חדד | 7 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 04/05-06/07 — ייתכן שאלה עונות השאלה; audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF; DB seasons (2003+) not in IFA roster: 04/05, 05/06, 08/09, 09/10 |
| beitar | #13 | מיכאל אוחנה | 6 | pos MF here vs FW at hapoel-bs; pos MF here vs FW at maccabi-haifa |
| beitar | #30 | ניר רייכמן | 6 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 02/03, 05/06 — ייתכן שאלה עונות השאלה; IFA roster seasons missing from DB: 03/04; DB seasons (2003+) not in IFA roster: 05/06 |
| beitar | #36 | ברק משה | 5 | audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball; played 12/13 but name not found in IFA rosters (transliteration?) |
| beitar | #45 | קלאודמיר | 5 | audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball; played 17/18 but name not found in IFA rosters (transliteration?) |
| beitar | #46 | דוד קלטינס | 8 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 14/15 — ייתכן שאלה עונות השאלה; pos DF here vs MF at hapoel-bs; pos DF here vs MF at hapoel-ta |
| beitar | #48 | רענן דרעי | 7 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 04/05-05/06 — ייתכן שאלה עונות השאלה; audit עמדה/סתירה: מאגר: DF · ויקיפדיה: MF; DB seasons (2003+) not in IFA roster: 04/05, 05/06 |
| hapoel-bs | #5 | אוהד לויטה | 6 | Latin alias "Yaniv Ifergan" does not transliterate-match "אוהד לויטה" (score 0.2) (mis-bridge?) |
| hapoel-bs | #11 | שגיב יחזקאל | 7 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: DF · worldfootball: FW; IFA roster seasons missing from DB: 20/21 |
| hapoel-bs | #12 | רמזי ספורי | 5 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 20/21 |
| hapoel-bs | #17 | ויליאם סוארס | 6 | audit עונות/סתירה: ויקיפדיה מוסיפה 17/18 · המאגר מוסיף 09/10, 16/17; audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| hapoel-bs | #18 | אורן סגרון | 7 | audit שנת לידה/סתירה: מאגר: 1972 · ויקיפדיה: 1972 · worldfootball: 1973; IFA roster seasons missing from DB: 05/06 |
| hapoel-bs | #19 | דוד קלטינס | 7 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; pos MF here vs DF at beitar |
| hapoel-bs | #21 | תומר יוספי | 9 | IFA roster seasons missing from DB: 18/19; DB seasons (2003+) not in IFA roster: 22/23, 23/24; possible off-by-one season: DB 19/20,20/21,21/22,22/23,23/24 vs IFA 18/19,19/20,20/21,21/22 |
| hapoel-bs | #27 | אור דדיה | 9 | IFA roster seasons missing from DB: 16/17; DB seasons (2003+) not in IFA roster: 17/18, 18/19, 24/25, 25/26; possible off-by-one season: DB 17/18,18/19,19/20,20/21,21/22,22/23,23/24,24/25,25/26 vs IFA 16/17,19/20,20/21,21/22,22/23,23/24 |
| hapoel-bs | #28 | מיכאל אוחנה | 7 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; pos FW here vs MF at beitar |
| hapoel-bs | #30 | יניב אלול | 15 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; DB seasons (2003+) not in IFA roster: 05/06, 06/07; raw nat NG overridden by nat-extra to IL — check the rest of the record; Latin alias "Blessing Kaku" does not transliterate-match "יניב אלול" (score 0.6) (mis-bridge?) |
| hapoel-bs | #34 | גרשון קופי | 5 | audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball; played 10/11 but name not found in IFA rosters (transliteration?) |
| hapoel-bs | #39 | שוקי נגר | 6 | audit עונות/סתירה: ויקיפדיה מוסיפה 04/05 · המאגר מוסיף 03/04; played 03/04 but name not found in IFA rosters (transliteration?) |
| hapoel-bs | #48 | חאתם אלחמיד | 10 | IFA roster seasons missing from DB: 20/21; DB seasons (2003+) not in IFA roster: 22/23; Latin alias "Davide Petrucci" does not transliterate-match "חאתם אלחמיד" (score 0.57) (mis-bridge?) |
| hapoel-ta | #5 | רמי דואני | 5 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; DB seasons (2003+) not in IFA roster: 08/09, 09/10, 11/12 |
| hapoel-ta | #16 | רוי קורין | 10 | audit עמדה/סתירה: מאגר: GK · ויקיפדיה: FW · worldfootball: GK; Latin alias "Ido Sharon" does not transliterate-match "רוי קורין" (score 0.5) (mis-bridge?) |
| hapoel-ta | #19 | ג'וזף גנדה | 7 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; IFA roster seasons missing from DB: 16/17 |
| hapoel-ta | #23 | אושר דוידה | 5 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 19/20 |
| hapoel-ta | #24 | אדי גוטליב | 6 | Latin alias "Amir Agayev" does not transliterate-match "אדי גוטליב" (score 0.5) (mis-bridge?) |
| hapoel-ta | #30 | עומרי אלטמן | 14 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 24/25; pos FW here vs MF at maccabi-ta; Latin alias "Raz Stain" does not transliterate-match "עומרי אלטמן" (score 0.6) (mis-bridge?) |
| hapoel-ta | #31 | בן לוז | 10 | raw nat UA overridden by nat-extra to IL — check the rest of the record; Latin alias "Denis Onishenko" does not transliterate-match "בן לוז" (score 0.4) (mis-bridge?) |
| hapoel-ta | #47 | אוראל דגני | 6 | Latin alias "Tal Benesh" does not transliterate-match "אוראל דגני" (score 0.4) (mis-bridge?) |
| maccabi-haifa | #3 | אביחי ידין | 5 | audit עמדה/סתירה: מאגר: DF · ויקיפדיה: MF · worldfootball: DF; DB seasons (2003+) not in IFA roster: 15/16 |
| maccabi-haifa | #10 | ענאן ח'לאילי | 5 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: DF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 22/23 |
| maccabi-haifa | #21 | מוחמד גדיר | 5 | IFA has 2 ids for this name at club (4034,118820); IFA roster seasons missing from DB: 20/21; DB seasons (2003+) not in IFA roster: 08/09, 09/10, 12/13, 13/14, 14/15 |
| maccabi-haifa | #24 | נהוראי יפרח | 6 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF; played 25/26 but name not found in IFA rosters (transliteration?) |
| maccabi-haifa | #27 | מאור לוי | 9 | IFA roster seasons missing from DB: 19/20; DB seasons (2003+) not in IFA roster: 22/23, 23/24, 24/25, 25/26; possible off-by-one season: DB 20/21,21/22,22/23,23/24,24/25,25/26 vs IFA 19/20,20/21,21/22 |
| maccabi-haifa | #28 | דין דוד | 6 | Latin alias "Matías Nahuel" does not transliterate-match "דין דוד" (score 0.2) (mis-bridge?) |
| maccabi-haifa | #32 | איתן עזריה | 7 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster seasons missing from DB: 02/03 |
| maccabi-haifa | #34 | סוף פודגוראנו | 9 | audit עונות/סתירה: ויקיפדיה מוסיפה 20/21, 24/25 · המאגר מוסיף 19/20; audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 19/20 |
| maccabi-haifa | #36 | אייל משומר | 7 | DB seasons (2003+) not in IFA roster: 16/17; Latin alias "Islam Cana'an" does not transliterate-match "אייל משומר" (score 0.5) (mis-bridge?) |
| maccabi-haifa | #41 | תומר חמד | 5 | audit עונות/סתירה: ויקיפדיה מוסיפה 05/06, 07/08-09/10, 24/25 · המאגר מוסיף 23/24; DB seasons (2003+) not in IFA roster: 10/11 |
| maccabi-haifa | #44 | עילאי חג'ג' | 8 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; IFA roster seasons missing from DB: 20/21; DB seasons (2003+) not in IFA roster: 21/22, 22/23 |
| maccabi-ta | #2 | דור תורג'מן | 7 | DB seasons (2003+) not in IFA roster: 20/21, 21/22; Latin alias "Rareş Ilie" does not transliterate-match "דור תורג'מן" (score 0.5) (mis-bridge?) |
| maccabi-ta | #19 | אלירן עטר | 11 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: FW · worldfootball: MF; DB seasons (2003+) not in IFA roster: 19/20; pos MF here vs FW at beitar; pos MF here vs FW at maccabi-haifa |
| maccabi-ta | #37 | ברק לוי | 9 | IFA roster seasons missing from DB: 16/17; DB seasons (2003+) not in IFA roster: 11/12, 15/16; possible off-by-one season: DB 11/12,12/13,13/14,14/15,15/16 vs IFA 12/13,13/14,14/15,16/17 |
| maccabi-ta | #38 | יונתן כהן | 5 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 15/16, 16/17, 17/18 |
| maccabi-ta | #39 | שרן ייני | 8 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; IFA roster seasons missing from DB: 16/17; DB seasons (2003+) not in IFA roster: 04/05 |
| maccabi-ta | #46 | משה לוגסי | 5 | audit עמדה/סתירה: מאגר: DF · ויקיפדיה: MF · worldfootball: DF; DB seasons (2003+) not in IFA roster: 13/14, 14/15, 15/16, 16/17, 17/18 |
| maccabi-ta | #48 | דדי בן דיין | 9 | IFA roster seasons missing from DB: 02/03; Latin alias "Bruno Reis" does not transliterate-match "דדי בן דיין" (score 0.4) (mis-bridge?) |

## 6. Full upcoming schedule (next 120 puzzles per club)

Columns: puzzle · date · player · pos · born · nat · spells · trust/sources · score · flags. Flag weights are in the analysis script; "audit" means a row in the fresh audit.csv.

### beitar (ביתרdle) — pool 214, cycles 2027-03-26

| # | date | player | pos | born | nat | spells | trust/src | score | flags |
|---|---|---|---|---|---|---|---|---|---|
| 49 | 2026-10-11 | שמואל לוי | DF | 1972 | IL | 87/88-00/01 | confirmed/4 | 5 | unusual debut age 15 (born 1972, first 87/88); IFA roster seasons missing from DB: 02/03, 03/04 |
| 50 | 2026-10-12 | יעקב שוורץ | MF | 1964 | IL | 82/83-93/94 | confirmed/4 | 0 |  |
| 51 | 2026-10-13 | אבירם ברוכיאן | MF | 1985 | IL | 02/03-11/12, 13/14 | confirmed/6 | 1 | DB seasons (2003+) not in IFA roster: 02/03, 03/04, 11/12 |
| 52 | 2026-10-14 | עדי יונה | MF | 2004 | IL | 21/22-25/26 | confirmed/6 | 3 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 21/22 — ייתכן שאלה עונות השאלה; DB seasons (2003+) not in IFA roster: 21/22, 22/23 |
| 53 | 2026-10-15 | איתי שכטר | FW | 1987 | IL | 15/16-17/18 | confirmed/6 | 2 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 15/16 — ייתכן שאלה עונות השאלה |
| 54 | 2026-10-16 | דריו פרננדס | MF | 1978 | AR | 08/09-12/13 | confirmed/5 | 6 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 11/12 — ייתכן שאלה עונות השאלה; audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי; played 12/13 but name not found in IFA rosters (transliteration?) |
| 55 | 2026-10-17 | אור ואקנין | MF | 1995 | IL | 14/15, 17/18-18/19 | confirmed/4 | 0 |  |
| 56 | 2026-10-18 | גל אלברמן | MF | 1983 | IL | 05/06-07/08 | confirmed/6 | 0 |  |
| 57 | 2026-10-19 | אריאל הרוש | GK | 1988 | IL | 07/08-13/14 | confirmed/6 | 2 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 07/08 — ייתכן שאלה עונות השאלה |
| 58 | 2026-10-20 | אסי דומב | DF | 1974 | IL | 96/97, 98/99-99/00 | confirmed/5 | 0 |  |
| 59 | 2026-10-21 | עמית שמש | GK | 1987 | IL | 04/05-06/07 | confirmed/3 | 1 | DB seasons (2003+) not in IFA roster: 04/05, 05/06 |
| 60 | 2026-10-22 | עידן טל | MF | 1975 | IL | 07/08-10/11 | confirmed/6 | 0 |  |
| 61 | 2026-10-23 | אהוד כחילה | DF | 1968 | IL | 91/92-97/98, 99/00, 02/03 | confirmed/6 | 0 |  |
| 62 | 2026-10-24 | ג'ורג' פאולינו | MF | 1991 | BR | 16/17-18/19 | confirmed/2 | 7 | only 2 sources, one is legacy production DB (התאחדות · הגרסה שבייצור); nat BR vs IFA IT; IFA roster marks local but nat=BR; DB seasons (2003+) not in IFA roster: 16/17 |
| 63 | 2026-10-25 | ליאל דרעי | DF | 2003 | IL | 21/22-22/23, 24/25 | confirmed/4 | 1 | DB seasons (2003+) not in IFA roster: 21/22 |
| 64 | 2026-10-26 | אריק בנדו | DF | 1973 | IL | 94/95-95/96, 06/07-09/10 | confirmed/5 | 4 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי; played 09/10 but name not found in IFA rosters (transliteration?) |
| 65 | 2026-10-27 | גאטאן וארן | FW | 1990 | IL | 16/17-19/20 | confirmed/4 | 4 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 16/17 — ייתכן שאלה עונות השאלה; played 19/20 but name not found in IFA rosters (transliteration?) |
| 66 | 2026-10-28 | עומר אצילי | MF | 1993 | IL | 13/14-15/16, 24/25-25/26 | confirmed/6 | 2 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 24/25 — ייתכן שאלה עונות השאלה |
| 67 | 2026-10-29 | יואב זיו | DF | 1981 | IL | 05/06-08/09 | confirmed/6 | 1 | DB seasons (2003+) not in IFA roster: 08/09 |
| 68 | 2026-10-30 | נהוראי דבוש | FW | 2004 | IL | 21/22-24/25 | confirmed/6 | 3 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 21/22-22/23 — ייתכן שאלה עונות השאלה; DB seasons (2003+) not in IFA roster: 21/22, 22/23 |
| 69 | 2026-10-31 | אבי ריקן | MF | 1988 | IL | 07/08-12/13 | confirmed/5 | 2 | played 12/13 but name not found in IFA rosters (transliteration?) |
| 70 | 2026-11-01 | אנטואן קונט | DF | 1994 | GN/FR | 16/17-20/21 | confirmed/5 | 6 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 16/17 — ייתכן שאלה עונות השאלה; audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי; played 20/21 but name not found in IFA rosters (transliteration?) |
| 71 | 2026-11-02 | עדן נחמני | FW | 1990 | IL | 09/10-11/12 | confirmed/4 | 0 |  |
| 72 | 2026-11-03 | יוסי אברהמי | FW | 1957 | IL | 74/75-83/84 | confirmed/2 | 2 | only 2 sources, one is legacy production DB (קטגוריה · קריירה-עברית · הגרסה שבייצור) |
| 73 | 2026-11-04 | יוסי אבוקסיס | MF | 1970 | IL | 95/96-00/01 | confirmed/5 | 0 |  |
| 74 | 2026-11-05 | מתן בראשי | DF | 1988 | IL | 07/08-14/15 | confirmed/6 | 3 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 07/08 — ייתכן שאלה עונות השאלה; DB seasons (2003+) not in IFA roster: 09/10, 13/14, 14/15 |
| 75 | 2026-11-06 | מיכאל זנדברג | MF | 1980 | IL | 06/07-08/09 | confirmed/6 | 0 |  |
| 76 | 2026-11-07 | אלירן דנין | DF | 1984 | IL | 03/04-09/10 | confirmed/6 | 1 | DB seasons (2003+) not in IFA roster: 06/07, 07/08 |
| 77 | 2026-11-08 | איציק קורנפיין | GK | 1971 | IL | 95/96-06/07 | confirmed/4 | 4 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי; played 06/07 but name not found in IFA rosters (transliteration?) |
| 78 | 2026-11-09 | תמיר עדי | MF | 1993 | IL | 19/20-22/23 | confirmed/4 | 10 | audit עונות/סתירה: ויקיפדיה מוסיפה 23/24 · המאגר מוסיף 22/23; audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF; played 22/23 but name not found in IFA rosters (transliteration?) |
| 79 | 2026-11-10 | מיגל סילבה | GK | 1995 | PT | 22/23-25/26 | confirmed/4 | 4 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 22/23 — ייתכן שאלה עונות השאלה; played 25/26 but name not found in IFA rosters (transliteration?) |
| 80 | 2026-11-11 | רוי דוגה | FW | 2002 | IL | 19/20-21/22 | confirmed/4 | 1 | DB seasons (2003+) not in IFA roster: 19/20, 20/21 |
| 81 | 2026-11-12 | טל אלמשעלי | FW | 1989 | IL | 08/09, 10/11-11/12 | confirmed/4 | 0 |  |
| 82 | 2026-11-13 | רוי ששון | GK | 2001 | IL | 19/20-23/24 | confirmed/3 | 1 | DB seasons (2003+) not in IFA roster: 19/20 |
| 83 | 2026-11-14 | חן עזריאל | FW | 1988 | IL | 05/06-10/11, 12/13 | confirmed/6 | 3 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 05/06-06/07 — ייתכן שאלה עונות השאלה; DB seasons (2003+) not in IFA roster: 05/06, 06/07, 08/09 |
| 84 | 2026-11-15 | מיכאל סירושטיין | DF | 1989 | IL | 16/17-18/19 | confirmed/6 | 3 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 16/17 — ייתכן שאלה עונות השאלה; DB seasons (2003+) not in IFA roster: 16/17 |
| 85 | 2026-11-16 | אלי אוחנה | FW | 1964 | IL | 80/81-86/87, 91/92-98/99 | confirmed/5 | 0 |  |
| 86 | 2026-11-17 | בוריס קליימן | GK | 1990 | IL | 14/15-17/18 | confirmed/6 | 0 |  |
| 87 | 2026-11-18 | חלאופילו פלייטר | FW | 1999 | SR | 20/21-22/23 | confirmed/5 | 2 | played 22/23 but name not found in IFA rosters (transliteration?) |
| 88 | 2026-11-19 | מירון טל | MF | 2002 | IL | 20/21-23/24, 25/26 | confirmed/4 | 1 | DB seasons (2003+) not in IFA roster: 20/21, 23/24, 25/26 |
| 89 | 2026-11-20 | איתן טיבי | DF | 1987 | IL | 05/06-09/10 | confirmed/6 | 3 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 05/06 — ייתכן שאלה עונות השאלה; DB seasons (2003+) not in IFA roster: 05/06, 07/08, 08/09 |
| 90 | 2026-11-21 | דן איינבינדר | MF | 1989 | IL | 08/09-11/12, 15/16-16/17, 18/19-19/20 | confirmed/6 | 0 |  |
| 91 | 2026-11-22 | אביתר ברוכיאן | MF | 1989 | IL | 09/10-12/13 | confirmed/4 | 3 | IFA roster seasons missing from DB: 08/09 |
| 92 | 2026-11-23 | צחי אליחן | MF | 1991 | IL | 10/11-13/14 | confirmed/5 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: FW |
| 93 | 2026-11-24 | סתיו שושן | GK | 1995 | IL | 15/16-17/18 | confirmed/4 | 3 | IFA roster seasons missing from DB: 14/15 |
| 94 | 2026-11-25 | אורי מלמיליאן | MF | 1957 | IL | 73/74-89/90 | confirmed/5 | 2 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 89/90 — ייתכן שאלה עונות השאלה |
| 95 | 2026-11-26 | אישטוון האמר | MF | 1970 | HU | 97/98-00/01 | confirmed/5 | 0 |  |
| 96 | 2026-11-27 | ניר סביליה | FW | 1975 | IL | 96/97-00/01 | confirmed/5 | 3 | audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball |
| 97 | 2026-11-28 | טימוטי מוזי | MF | 2001 | IL | 23/24-25/26 | confirmed/6 | 7 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: FW; pos MF here vs FW at maccabi-haifa |
| 98 | 2026-11-29 | אבישי כהן | DF | 1995 | IL | 13/14-17/18, 22/23 | confirmed/3 | 6 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 13/14 — ייתכן שאלה עונות השאלה; DB seasons (2003+) not in IFA roster: 13/14, 17/18; pos DF here vs FW at maccabi-ta |
| 99 | 2026-11-30 | עומר נחמני | FW | 1993 | IL | 14/15-16/17 | confirmed/3 | 4 | IFA roster seasons missing from DB: 12/13; DB seasons (2003+) not in IFA roster: 16/17 |
| 100 | 2026-12-01 | טל בן חיים | DF | 1982 | IL | 18/19-20/21 | confirmed/5 | 0 |  |
| 101 | 2026-12-02 | תומר אזולאי | DF | 1974 | IL | 92/93-01/02 | confirmed/3 | 0 |  |
| 102 | 2026-12-03 | לי און מזרחי | DF | 2002 | IL | 19/20, 22/23-24/25 | confirmed/6 | 5 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 19/20 — ייתכן שאלה עונות השאלה; pos DF here vs MF at hapoel-ta |
| 103 | 2026-12-04 | גריגורי מורוזוב | DF | 1994 | RU/IL | 22/23-25/26 | confirmed/6 | 2 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 22/23 — ייתכן שאלה עונות השאלה |
| 104 | 2026-12-05 | תומר ירוחם | DF | 1993 | IL | 11/12, 13/14-15/16 | confirmed/4 | 1 | DB seasons (2003+) not in IFA roster: 11/12, 13/14, 15/16 |
| 105 | 2026-12-06 | עידן מליחי | MF | 1979 | IL | 03/04-05/06 | confirmed/6 | 0 |  |
| 106 | 2026-12-07 | משה ביטון | FW | 1982 | IL | 02/03-04/05 | confirmed/5 | 2 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 04/05 — ייתכן שאלה עונות השאלה |
| 107 | 2026-12-08 | דוד דגו | MF | 2001 | IL | 19/20-21/22 | confirmed/3 | 5 | audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball; played 21/22 but name not found in IFA rosters (transliteration?) |
| 108 | 2026-12-09 | פליקס חלפון | DF | 1972 | IL | 00/01, 04/05-05/06 | confirmed/5 | 4 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 04/05-05/06 — ייתכן שאלה עונות השאלה; played 05/06 but name not found in IFA rosters (transliteration?) |
| 109 | 2026-12-10 | ישראל כהן | DF | 1971 | IL | 00/01, 04/05-05/06 | confirmed/4 | 4 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 04/05-05/06 — ייתכן שאלה עונות השאלה; played 05/06 but name not found in IFA rosters (transliteration?) |
| 110 | 2026-12-11 | קובי מויאל | MF | 1987 | IL | 05/06-12/13, 15/16-16/17 | confirmed/6 | 3 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 15/16 — ייתכן שאלה עונות השאלה; DB seasons (2003+) not in IFA roster: 05/06, 07/08, 08/09, 15/16 |
| 111 | 2026-12-12 | דור מיכה | MF | 1992 | IL | 23/24-25/26 | confirmed/6 | 0 |  |
| 112 | 2026-12-13 | דושאן מאטוביץ' | DF | 1983 | RS | 13/14-15/16 | confirmed/5 | 6 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 13/14 — ייתכן שאלה עונות השאלה; audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי; played 15/16 but name not found in IFA rosters (transliteration?) |
| 113 | 2026-12-14 | אורי מגבו | DF | 1987 | IL | 15/16-16/17, 19/20-20/21 | confirmed/6 | 1 | DB seasons (2003+) not in IFA roster: 16/17 |
| 114 | 2026-12-15 | דן עזריה | MF | 1995 | IL | 21/22-23/24 | confirmed/4 | 2 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 21/22 — ייתכן שאלה עונות השאלה |
| 115 | 2026-12-16 | אור זהבי | DF | 1996 | IL | 18/19-20/21, 22/23 | confirmed/6 | 3 | IFA roster seasons missing from DB: 15/16 |
| 116 | 2026-12-17 | אופיר קריאף | MF | 1991 | IL | 10/11-14/15, 17/18-23/24 | confirmed/6 | 6 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 10/11, 17/18 — ייתכן שאלה עונות השאלה; audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF |
| 117 | 2026-12-18 | ז'אן טלסניקוב | MF | 1972 | IL | 96/97-98/99, 00/01-02/03 | confirmed/6 | 0 |  |
| 118 | 2026-12-19 | שמואל קוז'וקין | DF | 1987 | IL | 04/05-12/13 | confirmed/6 | 3 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 04/05-05/06 — ייתכן שאלה עונות השאלה; DB seasons (2003+) not in IFA roster: 04/05, 05/06, 12/13 |
| 119 | 2026-12-20 | עוזיאל פרדו | FW | 1999 | IL | 18/19, 20/21-21/22, 23/24 | confirmed/4 | 1 | DB seasons (2003+) not in IFA roster: 23/24 |
| 120 | 2026-12-21 | אילן אלהרר | DF | 1970 | IL | 87/88-89/90, 92/93-95/96 | confirmed/4 | 0 |  |
| 121 | 2026-12-22 | מאיר קדוש | MF | 1965 | IL | 84/85-94/95 | confirmed/5 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF |
| 122 | 2026-12-23 | עמית קורנפיין | GK | 2005 | IL | 24/25-25/26 | confirmed/3 | 5 | audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball; played 25/26 but name not found in IFA rosters (transliteration?) |
| 123 | 2026-12-24 | קים זיבת | GK | 2003 | IL | 20/21, 23/24 | confirmed/3 | 4 | IFA roster seasons missing from DB: 22/23; DB seasons (2003+) not in IFA roster: 20/21 |
| 124 | 2026-12-25 | חן דילמוני | DF | 1989 | IL | 16/17-17/18 | confirmed/6 | 2 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 16/17 — ייתכן שאלה עונות השאלה |
| 125 | 2026-12-26 | חן עזרא | FW | 1989 | IL | 16/17-17/18 | confirmed/6 | 9 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 16/17 — ייתכן שאלה עונות השאלה; audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF; pos FW here vs MF at hapoel-ta |
| 126 | 2026-12-27 | שלומי אזולאי (1989) | FW | 1989 | IL | 13/14-14/15, 19/20 | confirmed/4 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 127 | 2026-12-28 | מור אפרים | MF | 1985 | IL | 04/05-05/06 | confirmed/3 | 5 | audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball; played 05/06 but name not found in IFA rosters (transliteration?) |
| 128 | 2026-12-29 | אנדרה קלדיירה | MF | 1980 | BR | 03/04-04/05 | confirmed/3 | 5 | audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball; played 04/05 but name not found in IFA rosters (transliteration?) |
| 129 | 2026-12-30 | חסוס רואדה | DF | 1987 | ES | 15/16-16/17 | confirmed/4 | 0 |  |
| 130 | 2026-12-31 | אורן ביטון | DF | 1994 | IL | 20/21-21/22 | confirmed/6 | 0 |  |
| 131 | 2027-01-01 | דיוגו ורדשקה | DF | 1996 | PT | 19/20-20/21 | confirmed/5 | 4 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 20/21 — ייתכן שאלה עונות השאלה; played 20/21 but name not found in IFA rosters (transliteration?) |
| 132 | 2027-01-02 | אופיר עזו | MF | 1982 | IL | 04/05-05/06 | confirmed/6 | 3 | IFA roster seasons missing from DB: 03/04 |
| 133 | 2027-01-03 | רועי זכרי | FW | 1992 | IL | 13/14-16/17 | confirmed/4 | 1 | DB seasons (2003+) not in IFA roster: 14/15, 16/17 |
| 134 | 2027-01-04 | אדם מורינו | GK | 1981 | IL | 04/05-05/06 | confirmed/2 | 7 | only 2 sources, one is legacy production DB (worldfootball (גשר תעתיק) · הגרסה שבייצור); audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball; played 05/06 but name not found in IFA rosters (transliteration?) |
| 135 | 2027-01-05 | אוראל חורב | DF | 1994 | IL | 12/13, 16/17 | confirmed/2 | 11 | only 2 sources, one is legacy production DB (התאחדות · הגרסה שבייצור); IFA roster seasons missing from DB: 13/14; DB seasons (2003+) not in IFA roster: 12/13, 16/17; possible off-by-one season: DB 12/13,16/17 vs IFA 13/14 |
| 136 | 2027-01-06 | איסמאילה סורו | MF | 1998 | CI | 23/24-24/25 | confirmed/6 | 1 | IFA roster marks local but nat=CI |
| 137 | 2027-01-07 | גיל כהן | DF | 2000 | IL | 24/25-25/26 | confirmed/4 | 0 |  |
| 138 | 2027-01-08 | ויקטור פאסו | FW | 1974 | AL | 00/01-01/02 | confirmed/3 | 3 | audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball |
| 139 | 2027-01-09 | ליאור אסולין | FW | 1980 | IL | 04/05-05/06 | confirmed/6 | 0 |  |
| 140 | 2027-01-10 | ניסים נאור | DF | 1987 | IL | 04/05-05/06 | confirmed/3 | 5 | audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball; played 05/06 but name not found in IFA rosters (transliteration?) |
| 141 | 2027-01-11 | לירן רוטמן | MF | 1996 | IL | 19/20-21/22 | confirmed/6 | 4 | DB seasons (2003+) not in IFA roster: 20/21; pos MF here vs FW at hapoel-ta |
| 142 | 2027-01-12 | אנז' פרדי פלומה | FW | 1995 | GP | 18/19-19/20 | confirmed/5 | 7 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 18/19 — ייתכן שאלה עונות השאלה; played 19/20 but name not found in IFA rosters (transliteration?); nat GP here vs FR at hapoel-ta |
| 143 | 2027-01-13 | דניאל שמשיאלשווילי | DF | 1986 | IL | 04/05-05/06 | confirmed/2 | 7 | only 2 sources, one is legacy production DB (worldfootball (גשר תעתיק) · הגרסה שבייצור); audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball; played 05/06 but name not found in IFA rosters (transliteration?) |
| 144 | 2027-01-14 | חוסואה מחיאס | DF | 1997 | VE | 21/22-22/23 | confirmed/5 | 2 | played 22/23 but name not found in IFA rosters (transliteration?) |
| 145 | 2027-01-15 | בני חדד | MF | 1977 | IL | 99/00-00/01 | confirmed/4 | 10 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF; pos MF here vs DF at hapoel-ta; pos MF here vs DF at maccabi-haifa |
| 146 | 2027-01-16 | יעקב מזרחי | DF | 1998 | IL | 17/18, 23/24 | confirmed/2 | 7 | only 2 sources, one is legacy production DB (הגרסה שבייצור · Transfermarkt); audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball; played 23/24 but name not found in IFA rosters (transliteration?) |
| 147 | 2027-01-17 | חיים לוין | GK | 1937 | IL | 69/70-70/71 | confirmed/4 | 0 |  |
| 148 | 2027-01-18 | עלי מוחמד | MF | 1995 | NE | 19/20-20/21 | confirmed/5 | 0 |  |
| 149 | 2027-01-19 | שי קונסטנטין | DF | 1996 | IL | 19/20-20/21 | confirmed/5 | 2 | played 20/21 but name not found in IFA rosters (transliteration?) |
| 150 | 2027-01-20 | נאור סבג | MF | 1993 | IL | 13/14-17/18 | confirmed/6 | 9 | IFA roster seasons missing from DB: 12/13; DB seasons (2003+) not in IFA roster: 13/14, 14/15, 15/16, 16/17, 17/18; possible off-by-one season: DB 13/14,14/15,15/16,16/17,17/18 vs IFA 12/13 |
| 151 | 2027-01-21 | אבירם זיאת | GK | 1992 | IL | 11/12-12/13 | confirmed/2 | 2 | only 2 sources, one is legacy production DB (התאחדות · הגרסה שבייצור) |
| 152 | 2027-01-22 | הראל פולק | FW | 1992 | IL | 11/12-12/13 | confirmed/4 | 0 |  |
| 153 | 2027-01-23 | רונן שוויג | FW | 1969 | IL | 86/87-99/00 | confirmed/4 | 4 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF |
| 154 | 2027-01-24 | כריסטיאן אלווארז | DF | 1980 | CL | 07/08-08/09 | confirmed/4 | 1 | IFA roster marks local but nat=CL |
| 155 | 2027-01-25 | ג'וניור ויסה | MF | 1985 | PE | 07/08-09/10 | confirmed/5 | 4 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 07/08 — ייתכן שאלה עונות השאלה; played 09/10 but name not found in IFA rosters (transliteration?) |
| 156 | 2027-01-26 | אלון בן עמי | DF | 2004 | IL | 23/24-24/25 | confirmed/4 | 1 | DB seasons (2003+) not in IFA roster: 23/24 |
| 157 | 2027-01-27 | גיא סולומון | GK | 1977 | IL | 04/05-05/06 | confirmed/4 | 0 |  |
| 158 | 2027-01-28 | ולדימיר גרצ'נב | MF | 1964 | RU | 92/93-93/94 | confirmed/3 | 3 | audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball |
| 159 | 2027-01-29 | רועי לויאן | DF | 1986 | IL | 04/05-05/06 | confirmed/4 | 1 | DB seasons (2003+) not in IFA roster: 04/05 |
| 160 | 2027-01-30 | אלון אופיר | MF | 1973 | IL | 00/01-01/02 | confirmed/4 | 2 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 00/01 — ייתכן שאלה עונות השאלה |
| 161 | 2027-01-31 | יובל שלו | DF | 2005 | IL | 24/25-25/26 | confirmed/4 | 0 |  |
| 162 | 2027-02-01 | אלירן עטר | FW | 1987 | IL | 19/20-20/21 | confirmed/6 | 5 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 19/20 — ייתכן שאלה עונות השאלה; pos FW here vs MF at maccabi-ta |
| 163 | 2027-02-02 | אריק סאבו | MF | 1991 | SK | 16/17-17/18 | confirmed/5 | 2 | played 17/18 but name not found in IFA rosters (transliteration?) |
| 164 | 2027-02-03 | קובי גנון | DF | 1976 | IL | 99/00-00/01 | confirmed/5 | 0 |  |
| 165 | 2027-02-04 | יעקב אסייג | GK | 1959 | IL | 92/93-93/94 | confirmed/5 | 0 |  |
| 166 | 2027-02-05 | דניאל היידמן | MF | 1982 | IL | 03/04-04/05 | confirmed/5 | 0 |  |
| 167 | 2027-02-06 | אופק עברי | GK | 1999 | IL | 18/19, 20/21 | confirmed/2 | 7 | only 2 sources, one is legacy production DB (worldfootball (גשר תעתיק) · הגרסה שבייצור); audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball; played 20/21 but name not found in IFA rosters (transliteration?) |
| 168 | 2027-02-07 | עדן מלכה | FW | 1991 | IL | 10/11-11/12 | confirmed/4 | 1 | DB seasons (2003+) not in IFA roster: 11/12 |

### hapoel-bs (באר־שבעdle) — pool 146, cycles 2027-01-17

| # | date | player | pos | born | nat | spells | trust/src | score | flags |
|---|---|---|---|---|---|---|---|---|---|
| 49 | 2026-10-11 | עמית ביטון | DF | 1996 | IL | 16/17-20/21 | confirmed/5 | 4 | IFA roster seasons missing from DB: 15/16; DB seasons (2003+) not in IFA roster: 16/17, 17/18, 18/19 |
| 50 | 2026-10-12 | ניסו אביטן | MF | 1971 | IL | 90/91, 94/95, 98/99 | confirmed/3 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: FW |
| 51 | 2026-10-13 | תומר חליבה | DF | 1979 | IL | 02/03-04/05, 07/08 | confirmed/5 | 6 | audit עונות/סתירה: ויקיפדיה מוסיפה 98/99-00/01, 08/09 · המאגר מוסיף 07/08; audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 52 | 2026-10-14 | רותם חטואל | FW | 1998 | IL | 20/21-25/26 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 24/25, 25/26 |
| 53 | 2026-10-15 | ניב זריהן | FW | 1994 | IL | 17/18-19/20 | confirmed/5 | 3 | IFA roster seasons missing from DB: 16/17 |
| 54 | 2026-10-16 | אוסטין אג'ידה | GK | 1984 | NG | 12/13-14/15 | confirmed/5 | 1 | IFA roster marks local but nat=NG |
| 55 | 2026-10-17 | מרואן כבהא | MF | 1991 | IL | 18/19-20/21 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 56 | 2026-10-18 | אנתוני ואקמה | FW | 1989 | NG | 15/16-17/18 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 57 | 2026-10-19 | לואי טאהא | DF | 1989 | IL | 15/16-20/21 | confirmed/5 | 3 | IFA roster seasons missing from DB: 14/15 |
| 58 | 2026-10-20 | בן ביטון | MF | 1991 | IL | 13/14-20/21 | confirmed/5 | 20 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; DB seasons (2003+) not in IFA roster: 20/21; pos MF here vs DF at beitar; pos MF here vs DF at hapoel-ta; pos MF here vs DF at maccabi-ta; Latin alias "Feras Awad" does not transliterate-match "בן ביטון" (score 0.4) (mis-bridge?) |
| 59 | 2026-10-21 | רועי גורדנה | MF | 1990 | IL | 14/15-16/17, 21/22-24/25 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 15/16, 16/17 |
| 60 | 2026-10-22 | איתן טיבי | DF | 1987 | IL | 21/22-24/25 | confirmed/5 | 0 |  |
| 61 | 2026-10-23 | אובידיו הובאן | MF | 1982 | RO | 14/15-16/17 | confirmed/5 | 1 | IFA roster marks local but nat=RO |
| 62 | 2026-10-24 | הלדר לופש | DF | 1989 | PT | 21/22-25/26 | confirmed/4 | 2 | played 25/26 but name not found in IFA rosters (transliteration?) |
| 63 | 2026-10-25 | איתמר שבירו | FW | 1998 | IL | 16/17-20/21 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 16/17, 18/19, 19/20 |
| 64 | 2026-10-26 | לוטם זינו | MF | 1992 | IL | 11/12-13/14 | confirmed/5 | 0 |  |
| 65 | 2026-10-27 | שיר צדק | DF | 1989 | IL | 15/16-20/21 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 20/21 |
| 66 | 2026-10-28 | אביתר אילוז | DF | 1983 | IL | 01/02-04/05, 06/07-14/15 | confirmed/5 | 3 | IFA roster seasons missing from DB: 15/16 |
| 67 | 2026-10-29 | אפרים דוידי | DF | 1959 | IL | 78/79-89/90, 92/93-94/95 | confirmed/3 | 0 |  |
| 68 | 2026-10-30 | מתן אוחיון | DF | 1986 | IL | 15/16-18/19 | confirmed/5 | 0 |  |
| 69 | 2026-10-31 | מאור מליקסון | MF | 1984 | IL | 08/09-10/11, 14/15-19/20 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 10/11 |
| 70 | 2026-11-01 | מאור בוזגלו | FW | 1988 | IL | 13/14-16/17 | confirmed/4 | 10 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; Latin alias "Mihály Korhut" does not transliterate-match "מאור בוזגלו" (score 0.6) (mis-bridge?) |
| 71 | 2026-11-02 | מוחמד גדיר | FW | 1991 | IL | 16/17-17/18 | confirmed/5 | 3 | IFA roster seasons missing from DB: 15/16 |
| 72 | 2026-11-03 | איאד אבו עביד | DF | 1994 | IL | 21/22-23/24 | confirmed/4 | 2 | played 23/24 but name not found in IFA rosters (transliteration?) |
| 73 | 2026-11-04 | אריאל הרוש | GK | 1988 | IL | 18/19-22/23 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 19/20, 20/21 |
| 74 | 2026-11-05 | ינון ברדה | FW | 1984 | IL | 02/03-05/06 | confirmed/4 | 1 | DB seasons (2003+) not in IFA roster: 02/03 |
| 75 | 2026-11-06 | זאהי אחמד | FW | 2001 | IL | 23/24-25/26 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 23/24 |
| 76 | 2026-11-07 | גל נבון | GK | 1996 | IL | 15/16-17/18 | confirmed/3 | 0 |  |
| 77 | 2026-11-08 | דור דוידי | GK | 1987 | IL | 07/08-10/11 | confirmed/3 | 0 |  |
| 78 | 2026-11-09 | אורי מכלוף | GK | 1988 | IL | 07/08-08/09, 10/11 | confirmed/3 | 0 |  |
| 79 | 2026-11-10 | עמית קרן | GK | 1998 | IL | 17/18-18/19, 20/21 | confirmed/3 | 0 |  |
| 80 | 2026-11-11 | אורן נסים | FW | 1976 | IL | 07/08-08/09 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 81 | 2026-11-12 | עדן שמיר | MF | 1995 | IL | 19/20, 22/23-23/24 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 19/20 |
| 82 | 2026-11-13 | מתן בלטקסה | DF | 1995 | IL | 24/25-25/26 | confirmed/5 | 0 |  |
| 83 | 2026-11-14 | דדי בן דיין | DF | 1978 | IL | 03/04-04/05 | confirmed/5 | 0 |  |
| 84 | 2026-11-15 | רובי לבקוביץ' | GK | 1988 | IL | 14/15-15/16 | confirmed/5 | 0 |  |
| 85 | 2026-11-16 | שון גולדברג | DF | 1995 | IL | 19/20-20/21 | confirmed/5 | 3 | pos DF here vs MF at beitar |
| 86 | 2026-11-17 | יוסי בניון | MF | 1980 | IL | 97/98, 02/03 | confirmed/5 | 0 |  |
| 87 | 2026-11-18 | אבי פרץ | GK | 1971 | IL | 95/96-96/97 | confirmed/2 | 0 |  |
| 88 | 2026-11-19 | לאנדרו סימיוני | FW | 1974 | BR | 08/09 | confirmed/5 | 8 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster marks local but nat=BR; IFA roster seasons missing from DB: 07/08 |
| 89 | 2026-11-20 | אלון מזרחי | FW | 1971 | IL | 03/04-04/05 | confirmed/5 | 0 |  |
| 90 | 2026-11-21 | ז'וזואה פשקיירה | MF | 1990 | PT | 19/20-20/21 | confirmed/2 | 2 | played 20/21 but name not found in IFA rosters (transliteration?) |
| 91 | 2026-11-22 | קינגס קאנגווה | MF | 1999 | ZM | 24/25-25/26 | confirmed/4 | 2 | played 25/26 but name not found in IFA rosters (transliteration?) |
| 92 | 2026-11-23 | אלטון אקולטסה | FW | 1995 | NL | 19/20-20/21 | confirmed/5 | 5 | audit עונות/סתירה: ויקיפדיה מוסיפה 21/22-22/23 · המאגר מוסיף 19/20; IFA roster marks local but nat=NL |
| 93 | 2026-11-24 | תומר סויסה | MF | 1988 | IL | 12/13-14/15 | confirmed/5 | 5 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: FW · worldfootball: MF; DB seasons (2003+) not in IFA roster: 14/15 |
| 94 | 2026-11-25 | גיא מזרחי | DF | 2001 | IL | 24/25-25/26 | confirmed/5 | 0 |  |
| 95 | 2026-11-26 | גאטאן וארן | FW | 1990 | IL | 20/21 | confirmed/3 | 6 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); played 20/21 but name not found in IFA rosters (transliteration?) |
| 96 | 2026-11-27 | אנדרה מרטינש | MF | 1990 | PT | 22/23 | confirmed/3 | 6 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); played 22/23 but name not found in IFA rosters (transliteration?) |
| 97 | 2026-11-28 | דניאל ליפשיץ | GK | 1988 | IL | 11/12 | confirmed/5 | 7 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster seasons missing from DB: 10/11 |
| 98 | 2026-11-29 | אלון בן דור | DF | 1952 | IL | 69/70-78/79 | confirmed/4 | 0 |  |
| 99 | 2026-11-30 | יזרסקי רמיגיוס | FW | 1976 | PL | 02/03-03/04 | confirmed/3 | 0 |  |
| 100 | 2026-12-01 | זיו קבדה | MF | 1978 | IL | 08/09 | confirmed/5 | 7 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster seasons missing from DB: 09/10 |
| 101 | 2026-12-02 | טומיסלב פאיוביץ' | DF | 1986 | RS | 13/14-14/15 | confirmed/5 | 0 |  |
| 102 | 2026-12-03 | גיאורגי קיפיאני | MF | 1978 | GE | 05/06 | confirmed/3 | 6 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); played 05/06 but name not found in IFA rosters (transliteration?) |
| 103 | 2026-12-04 | אלירן סולימנפור | GK | 1992 | IL | 11/12-12/13 | confirmed/3 | 0 |  |
| 104 | 2026-12-05 | ניקולאס פלצ'וק | FW | 1986 | AR | 12/13-13/14 | confirmed/4 | 6 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF; played 13/14 but name not found in IFA rosters (transliteration?) |
| 105 | 2026-12-06 | דייבי קורמן | MF | 1971 | BE | 00/01-01/02 | confirmed/4 | 0 |  |
| 106 | 2026-12-07 | דור מיכה | MF | 1992 | IL | 21/22-22/23 | confirmed/5 | 0 |  |
| 107 | 2026-12-08 | ליאור אסולין | FW | 1980 | IL | 09/10-10/11 | confirmed/5 | 0 |  |
| 108 | 2026-12-09 | ליאל זגורי | MF | 1990 | IL | 09/10-10/11 | confirmed/3 | 0 |  |
| 109 | 2026-12-10 | שמעון הרוש | DF | 1987 | IL | 09/10, 11/12 | confirmed/5 | 0 |  |
| 110 | 2026-12-11 | קייס גאנם | FW | 1997 | IL | 20/21-21/22 | confirmed/5 | 4 | IFA roster seasons missing from DB: 19/20; DB seasons (2003+) not in IFA roster: 20/21 |
| 111 | 2026-12-12 | חנן ממן | MF | 1989 | IL | 18/19-19/20 | confirmed/5 | 9 | IFA roster seasons missing from DB: 17/18; DB seasons (2003+) not in IFA roster: 19/20; possible off-by-one season: DB 18/19,19/20 vs IFA 17/18,18/19 |
| 112 | 2026-12-13 | אלון תורגמן | FW | 1991 | IL | 23/24-24/25 | confirmed/4 | 0 |  |
| 113 | 2026-12-14 | איתי שכטר | FW | 1987 | IL | 21/22-22/23 | confirmed/5 | 0 |  |
| 114 | 2026-12-15 | עידו אקסברד | FW | 1988 | IL | 11/12-12/13 | confirmed/5 | 0 |  |
| 115 | 2026-12-16 | יוג'ין אנסה | FW | 1994 | GH | 21/22-22/23 | confirmed/5 | 1 | IFA roster marks local but nat=GH |
| 116 | 2026-12-17 | גל דהן | DF | 1992 | IL | 11/12-12/13 | confirmed/3 | 0 |  |
| 117 | 2026-12-18 | וובה בראון | FW | 1989 | IL | 16/17-17/18 | confirmed/4 | 6 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF; played 17/18 but name not found in IFA rosters (transliteration?) |
| 118 | 2026-12-19 | דור אלו | DF | 1993 | IL | 17/18-19/20 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 19/20 |
| 119 | 2026-12-20 | אבי יחיאל | DF | 1979 | IL | 10/11-11/12 | confirmed/5 | 6 | Latin alias "Avi Yehiel" does not transliterate-match "אבי יחיאל" (score 0.5) (mis-bridge?) |
| 120 | 2026-12-21 | מיחאלי קורהוט | DF | 1988 | IL | 16/17-17/18 | confirmed/3 | 3 | nat IL vs IFA HU |
| 121 | 2026-12-22 | איל שן | MF | 1980 | IL | 05/06, 09/10 | confirmed/3 | 0 |  |
| 122 | 2026-12-23 | ויקטור מורוז | MF | 1968 | UA | 93/94-94/95 | confirmed/4 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: FW |
| 123 | 2026-12-24 | אליאל פרץ | MF | 1996 | IL | 24/25-25/26 | confirmed/5 | 0 |  |
| 124 | 2026-12-25 | דוד רביבו | MF | 1977 | IL | 09/10-10/11 | confirmed/5 | 0 |  |
| 125 | 2026-12-26 | יוסף אבו לבן | FW | 1992 | IL | 11/12-14/15 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 13/14, 14/15 |
| 126 | 2026-12-27 | גיא חיימוב | GK | 1986 | IL | 16/17-17/18 | confirmed/5 | 0 |  |
| 127 | 2026-12-28 | עומרי גלזר | GK | 1996 | IL | 21/22-22/23 | confirmed/5 | 0 |  |
| 128 | 2026-12-29 | אביב סולומון | DF | 1995 | IL | 21/22-22/23 | confirmed/3 | 0 |  |
| 129 | 2026-12-30 | אוהד קדוסי | FW | 1985 | IL | 08/09-09/10 | confirmed/5 | 0 |  |
| 130 | 2026-12-31 | לוקאס ונטורה | MF | 1998 | BR | 24/25-25/26 | confirmed/5 | 1 | IFA roster marks local but nat=BR |
| 131 | 2027-01-01 | אילון אלמוג | MF | 1999 | IL | 23/24-25/26 | confirmed/5 | 8 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: FW · worldfootball: MF; DB seasons (2003+) not in IFA roster: 24/25, 25/26; pos MF here vs FW at maccabi-ta |
| 132 | 2027-01-02 | עילאי טרוסט | MF | 1999 | IL | 19/20-21/22 | confirmed/2 | 9 | IFA roster seasons missing from DB: 18/19; DB seasons (2003+) not in IFA roster: 19/20, 20/21, 21/22; possible off-by-one season: DB 19/20,20/21,21/22 vs IFA 18/19 |
| 133 | 2027-01-03 | אדריאן פאון | MF | 1995 | RO | 22/23-23/24 | confirmed/4 | 2 | played 23/24 but name not found in IFA rosters (transliteration?) |
| 134 | 2027-01-04 | קווין טאפוקו | MF | 1994 | FR | 19/20-20/21 | confirmed/3 | 2 | played 20/21 but name not found in IFA rosters (transliteration?) |
| 135 | 2027-01-05 | איברהים בסיט | FW | 1990 | GH | 10/11-11/12 | confirmed/4 | 2 | played 11/12 but name not found in IFA rosters (transliteration?) |
| 136 | 2027-01-06 | גל אראל | MF | 1989 | IL | 13/14-14/15 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 14/15 |
| 137 | 2027-01-07 | שרון עמר | DF | 1976 | IL | 00/01, 06/07 | confirmed/3 | 0 |  |
| 138 | 2027-01-08 | שלום אביטן | FW | 1951 | IL | 72/73, 75/76-79/80, 81/82-84/85 | confirmed/4 | 6 | nat IL here vs FR at beitar; nat IL here vs FR at hapoel-ta |
| 139 | 2027-01-09 | נייג'ל האסלביינק | FW | 1990 | NL | 18/19-19/20 | confirmed/5 | 0 |  |
| 140 | 2027-01-10 | גיא בדש | MF | 1994 | IL | 23/24-24/25 | confirmed/5 | 8 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: FW · worldfootball: MF; DB seasons (2003+) not in IFA roster: 24/25; pos MF here vs FW at hapoel-ta |
| 141 | 2027-01-11 | שלומי ארבייטמן | FW | 1985 | IL | 14/15-15/16 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 15/16 |
| 142 | 2027-01-12 | עדן בן בסט | FW | 1986 | IL | 18/19-19/20 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 19/20 |
| 143 | 2027-01-13 | אנטוניו ספר | MF | 2000 | RO | 23/24-24/25 | confirmed/5 | 2 | IFA roster marks local but nat=RO; DB seasons (2003+) not in IFA roster: 24/25 |
| 144 | 2027-01-14 | תומר חמד | FW | 1987 | IL | 22/23-23/24 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 23/24 |
| 145 | 2027-01-15 | דיא סבע | FW | 1992 | IL | 12/13, 18/19 | confirmed/4 | 9 | IFA roster seasons missing from DB: 11/12; DB seasons (2003+) not in IFA roster: 12/13, 18/19; possible off-by-one season: DB 12/13,18/19 vs IFA 11/12 |
| 146 | 2027-01-16 | פול גריטה | FW | 1995 | CM | 24/25-25/26 | confirmed/5 | 5 | nat CM vs IFA FR; IFA roster marks local but nat=CM; DB seasons (2003+) not in IFA roster: 25/26 |
| 147 (repeat) | 2027-01-17 | אלי אוזן | DF | 1963 | IL | 80/81-83/84, 85/86-91/92 | confirmed/4 | 0 |  |
| 148 (repeat) | 2027-01-18 | שאול סמדג'ה | GK | 1972 | IL | 91/92-97/98, 01/02 | confirmed/5 | 3 | IFA roster seasons missing from DB: 02/03 |
| 149 (repeat) | 2027-01-19 | דודו גורש | GK | 1980 | IL | 15/16-17/18 | confirmed/5 | 0 |  |
| 150 (repeat) | 2027-01-20 | יוני סטויאנוב | DF | 2001 | BG/IL | 22/23-25/26 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 151 (repeat) | 2027-01-21 | אוהד לויטה | GK | 1986 | IL | 11/12, 18/19-20/21 | confirmed/5 | 6 | Latin alias "Yaniv Ifergan" does not transliterate-match "אוהד לויטה" (score 0.2) (mis-bridge?) |
| 152 (repeat) | 2027-01-22 | נועם גמון | DF | 1997 | IL | 15/16-25/26 | confirmed/4 | 2 | played 25/26 but name not found in IFA rosters (transliteration?) |
| 153 (repeat) | 2027-01-23 | שי אליאס | MF | 1999 | IL | 22/23-25/26 | confirmed/5 | 0 |  |
| 154 (repeat) | 2027-01-24 | דודי טויטו | DF | 1994 | IL | 14/15-16/17, 20/21 | confirmed/3 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 155 (repeat) | 2027-01-25 | ראיין אדליי | DF | 1987 | US/IL | 09/10-12/13 | confirmed/5 | 0 |  |
| 156 (repeat) | 2027-01-26 | אופיר מרציאנו | GK | 1989 | IL | 23/24-25/26 | confirmed/5 | 0 |  |
| 157 (repeat) | 2027-01-27 | שגיב יחזקאל | FW | 1995 | IL | 21/22-22/23 | confirmed/4 | 7 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: DF · worldfootball: FW; IFA roster seasons missing from DB: 20/21 |
| 158 (repeat) | 2027-01-28 | רמזי ספורי | FW | 1995 | IL | 19/20-22/23 | confirmed/5 | 5 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 20/21 |
| 159 (repeat) | 2027-01-29 | אמיר גנאח | MF | 2004 | IL | 23/24-25/26 | confirmed/5 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: FW · worldfootball: MF |
| 160 (repeat) | 2027-01-30 | אורן ביטון | DF | 1994 | IL | 17/18-19/20 | confirmed/5 | 0 |  |
| 161 (repeat) | 2027-01-31 | אמיר אביגדור | FW | 1970 | IL | 89/90-91/92, 93/94-95/96, 97/98 | confirmed/4 | 4 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF |
| 162 (repeat) | 2027-02-01 | עודד גביש | DF | 1989 | IL | 10/11-12/13 | confirmed/5 | 0 |  |
| 163 (repeat) | 2027-02-02 | ויליאם סוארס | DF | 1985 | BR | 09/10-16/17 | confirmed/5 | 6 | audit עונות/סתירה: ויקיפדיה מוסיפה 17/18 · המאגר מוסיף 09/10, 16/17; audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 164 (repeat) | 2027-02-03 | אורן סגרון | FW | 1972 | IL | 91/92-97/98, 01/02-04/05 | confirmed/5 | 7 | audit שנת לידה/סתירה: מאגר: 1972 · ויקיפדיה: 1972 · worldfootball: 1973; IFA roster seasons missing from DB: 05/06 |
| 165 (repeat) | 2027-02-04 | דוד קלטינס | MF | 1995 | IL | 19/20-21/22 | confirmed/5 | 7 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; pos MF here vs DF at beitar |
| 166 (repeat) | 2027-02-05 | סתיו אלימלך | MF | 1969 | IL | 87/88-96/97, 98/99-04/05 | confirmed/5 | 3 | IFA roster seasons missing from DB: 05/06, 06/07 |
| 167 (repeat) | 2027-02-06 | תומר יוספי | MF | 1999 | IL | 19/20-23/24 | confirmed/5 | 9 | IFA roster seasons missing from DB: 18/19; DB seasons (2003+) not in IFA roster: 22/23, 23/24; possible off-by-one season: DB 19/20,20/21,21/22,22/23,23/24 vs IFA 18/19,19/20,20/21,21/22 |
| 168 (repeat) | 2027-02-07 | דן ביטון | MF | 1995 | IL | 14/15-16/17, 24/25-25/26 | confirmed/4 | 1 | DB seasons (2003+) not in IFA roster: 16/17 |

### hapoel-ta (הפועלdle) — pool 183, cycles 2027-02-23

| # | date | player | pos | born | nat | spells | trust/src | score | flags |
|---|---|---|---|---|---|---|---|---|---|
| 49 | 2026-10-11 | אור ישראלוב | DF | 2004 | IL | 21/22-25/26 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 21/22, 22/23 |
| 50 | 2026-10-12 | בן ביטון | DF | 1991 | IL | 10/11-12/13, 21/22-22/23 | confirmed/5 | 13 | IFA roster seasons missing from DB: 20/21; DB seasons (2003+) not in IFA roster: 10/11, 11/12, 12/13; pos DF here vs MF at hapoel-bs; Latin alias "Sintayehu Sallalich" does not transliterate-match "בן ביטון" (score 0.33) (mis-bridge?) |
| 51 | 2026-10-13 | סלים טועמה | MF | 1979 | IL | 98/99-02/03, 06/07, 10/11-13/14 | confirmed/5 | 6 | Latin alias "Tomer Ben Yousef" does not transliterate-match "סלים טועמה" (score 0.5) (mis-bridge?) |
| 52 | 2026-10-14 | כפיר אודי | FW | 1979 | IL | 97/98-02/03, 06/07 | confirmed/4 | 5 | audit עונות/המאגר קצר מדי: חסרות 96/97 · בתיבה יש שנה בודדת, בדוק ידנית; played 06/07 but name not found in IFA rosters (transliteration?) |
| 53 | 2026-10-15 | עומר סניור | FW | 2003 | IL | 20/21-23/24 | confirmed/5 | 5 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 20/21, 21/22 |
| 54 | 2026-10-16 | גילי לנדאו | FW | 1958 | IL | 74/75-89/90 | confirmed/4 | 0 |  |
| 55 | 2026-10-17 | יעקב בריהון | FW | 1993 | IL | 24/25 | confirmed/5 | 8 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target) |
| 56 | 2026-10-18 | בן רייכרט | MF | 1994 | IL | 14/15-16/17 | confirmed/5 | 2 | audit עונות/המאגר ארוך מדי: ויקיפדיה לא מכירה 14/15 — ייתכן שאלה עונות השאלה |
| 57 | 2026-10-19 | עמנואל בואטנג | MF | 1997 | GH | 18/19-20/21 | confirmed/5 | 7 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי; IFA has 2 ids for this name at club (204923,319808); IFA roster marks local but nat=GH; IFA roster seasons missing from DB: 25/26 |
| 58 | 2026-10-20 | שרון מימר | MF | 1973 | IL | 93/94-96/97 | confirmed/4 | 0 |  |
| 59 | 2026-10-21 | שון מלכה | MF | 1993 | IL | 12/13-14/15 | confirmed/4 | 2 | played 14/15 but name not found in IFA rosters (transliteration?) |
| 60 | 2026-10-22 | אייל בן עמי | DF | 1976 | IL | 93/94-03/04 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 03/04 |
| 61 | 2026-10-23 | זיו מורגן | DF | 2000 | IL | 24/25-25/26 | confirmed/5 | 3 | IFA roster seasons missing from DB: 23/24 |
| 62 | 2026-10-24 | ואליד באדיר | MF | 1974 | IL | 05/06-12/13 | confirmed/5 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF |
| 63 | 2026-10-25 | גילי ורמוט | MF | 1985 | IL | 05/06-06/07, 08/09-10/11, 12/13-14/15 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 64 | 2026-10-26 | עידן כהן | DF | 1996 | IL | 15/16-19/20 | confirmed/4 | 1 | DB seasons (2003+) not in IFA roster: 15/16, 16/17 |
| 65 | 2026-10-27 | שגיב יחזקאל | FW | 1995 | IL | 14/15-15/16 | confirmed/4 | 4 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: DF · worldfootball: FW |
| 66 | 2026-10-28 | עדן שרם | FW | 1993 | IL | 10/11-14/15 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 10/11, 11/12, 13/14, 14/15 |
| 67 | 2026-10-29 | אישטוון פישונט | MF | 1970 | HU | 99/00-01/02 | confirmed/4 | 0 |  |
| 68 | 2026-10-30 | ויקטור מרעי | FW | 1989 | IL | 09/10-10/11, 12/13 | confirmed/5 | 4 | IFA roster seasons missing from DB: 08/09; DB seasons (2003+) not in IFA roster: 12/13 |
| 69 | 2026-10-31 | רז שלמה | DF | 1999 | IL | 16/17-20/21 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 16/17, 17/18 |
| 70 | 2026-11-01 | אבי כנפו | FW | 1982 | IL | 01/02-04/05 | confirmed/4 | 2 | played 04/05 but name not found in IFA rosters (transliteration?) |
| 71 | 2026-11-02 | גאבור הולמאי | MF | 1972 | HU | 00/01-02/03 | confirmed/4 | 2 | played 02/03 but name not found in IFA rosters (transliteration?) |
| 72 | 2026-11-03 | עומר דמארי | FW | 1989 | IL | 11/12-13/14, 18/19-19/20 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 18/19 |
| 73 | 2026-11-04 | ג'ון פנטסיל | DF | 1981 | GH | 04/05-05/06, 12/13 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 74 | 2026-11-05 | יגאל אנטבי | DF | 1974 | IL | 99/00-08/09, 12/13-13/14 | confirmed/5 | 3 | IFA roster seasons missing from DB: 11/12 |
| 75 | 2026-11-06 | רן בנימין | MF | 2004 | IL | 22/23-24/25 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 22/23 |
| 76 | 2026-11-07 | גליל בן שאנן | GK | 1982 | IL | 02/03-12/13 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 04/05, 05/06, 08/09, 09/10, 11/12, 12/13 |
| 77 | 2026-11-08 | גיא שרעבי | DF | 1969 | IL | 94/95-96/97 | confirmed/4 | 0 |  |
| 78 | 2026-11-09 | וינסנט אניימה | GK | 1982 | NG | 07/08-10/11 | confirmed/5 | 2 | IFA roster marks local but nat=NG; DB seasons (2003+) not in IFA roster: 10/11 |
| 79 | 2026-11-10 | ביברס נאתכו | MF | 1988 | IL | 06/07-09/10 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 06/07, 09/10 |
| 80 | 2026-11-11 | סרגיי פוגודין | MF | 1968 | UA | 96/97 | confirmed/4 | 4 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target) |
| 81 | 2026-11-12 | אביחי ידין | DF | 1986 | IL | 08/09-11/12, 16/17-17/18 | confirmed/5 | 7 | audit עמדה/סתירה: מאגר: DF · ויקיפדיה: MF · worldfootball: DF; IFA roster seasons missing from DB: 15/16 |
| 82 | 2026-11-13 | סתיו למקין | DF | 2003 | IL | 22/23 | confirmed/5 | 4 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target) |
| 83 | 2026-11-14 | זיו קבדה | MF | 1978 | IL | 98/99-99/00 | confirmed/4 | 0 |  |
| 84 | 2026-11-15 | דוד פרימו | DF | 1946 | IL | 63/64-66/67, 69/70-74/75 | confirmed/4 | 0 |  |
| 85 | 2026-11-16 | עומרי קנדה | DF | 1986 | IL | 08/09-11/12 | confirmed/5 | 3 | IFA roster seasons missing from DB: 07/08 |
| 86 | 2026-11-17 | שי אבוטבול | MF | 1983 | IL | 02/03-14/15 | confirmed/5 | 0 |  |
| 87 | 2026-11-18 | שי אייזן | MF | 2000 | IL | 19/20-21/22 | confirmed/5 | 0 |  |
| 88 | 2026-11-19 | איבזיטו אוגבונה | FW | 1983 | NG | 03/04-06/07 | confirmed/4 | 2 | played 06/07 but name not found in IFA rosters (transliteration?) |
| 89 | 2026-11-20 | טל חן | DF | 1979 | IL | 03/04-07/08 | confirmed/5 | 0 |  |
| 90 | 2026-11-21 | רמזי ספורי | FW | 1995 | IL | 13/14-18/19 | confirmed/5 | 5 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 13/14, 16/17, 17/18 |
| 91 | 2026-11-22 | אפולה אדל | GK | 1986 | AM/CM | 11/12-12/13, 14/15 | confirmed/4 | 6 | audit עונות/סתירה: ויקיפדיה מוסיפה 15/16 · המאגר מוסיף 14/15; played 14/15 but name not found in IFA rosters (transliteration?) |
| 92 | 2026-11-23 | טוטו תמוז | FW | 1988 | IL | 10/11-12/13, 16/17 | confirmed/5 | 4 | audit עונות/סתירה: ויקיפדיה מוסיפה 17/18 · המאגר מוסיף 16/17 |
| 93 | 2026-11-24 | ערן זהבי | FW | 1987 | IL | 06/07-10/11 | confirmed/5 | 5 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 06/07, 07/08, 10/11 |
| 94 | 2026-11-25 | ניר רחמין | FW | 1980 | IL | 98/99-03/04, 05/06 | confirmed/4 | 22 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: GK · worldfootball: FW; pos FW here vs GK at hapoel-bs; raw nat NG overridden by nat-extra to IL — check the rest of the record; Latin alias "Henry Nwosu" does not transliterate-match "ניר רחמין" (score 0.6) (mis-bridge?) |
| 95 | 2026-11-26 | קז'ימיש מוסקאל | MF | 1967 | PL | 94/95-97/98 | confirmed/4 | 0 |  |
| 96 | 2026-11-27 | טל ארצל | MF | 2003 | IL | 22/23-23/24, 25/26 | confirmed/3 | 0 |  |
| 97 | 2026-11-28 | רוי ברנס | GK | 2001 | IL | 20/21-21/22, 23/24 | confirmed/3 | 0 |  |
| 98 | 2026-11-29 | פרחאת עבדי | DF | 1996 | IL | 15/16, 18/19-19/20 | confirmed/3 | 0 |  |
| 99 | 2026-11-30 | גיא סלם | GK | 1984 | IL | 03/04-05/06 | confirmed/3 | 0 |  |
| 100 | 2026-12-01 | הישאם לאיוס | FW | 2000 | IL | 22/23-23/24 | confirmed/5 | 0 |  |
| 101 | 2026-12-02 | בן שהר | FW | 1989 | IL | 10/11, 24/25 | confirmed/5 | 0 |  |
| 102 | 2026-12-03 | דדי בן דיין | DF | 1978 | IL | 09/10-11/12 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 11/12 |
| 103 | 2026-12-04 | רז כהן | MF | 1994 | IL | 18/19-19/20 | confirmed/5 | 0 |  |
| 104 | 2026-12-05 | יעקב כהן | DF | 1956 | IL | 85/86 | confirmed/2 | 4 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target) |
| 105 | 2026-12-06 | כפיר אדרי | MF | 1976 | IL | 03/04-04/05 | confirmed/5 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF |
| 106 | 2026-12-07 | ארנסטס שטקוס | GK | 1985 | LT | 20/21-21/22 | confirmed/4 | 2 | played 21/22 but name not found in IFA rosters (transliteration?) |
| 107 | 2026-12-08 | עידן סרור | MF | 1986 | IL | 04/05, 07/08-08/09 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 04/05, 08/09 |
| 108 | 2026-12-09 | ניל אברבנאל | GK | 1987 | IL | 06/07, 09/10 | confirmed/3 | 0 |  |
| 109 | 2026-12-10 | ניסו אביטן | MF | 1971 | IL | 95/96-96/97 | confirmed/3 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: FW |
| 110 | 2026-12-11 | עמר מנצור | DF | 1985 | IL | 04/05, 07/08 | confirmed/3 | 0 |  |
| 111 | 2026-12-12 | דודו דהאן | FW | 1971 | IL | 00/01-01/02 | confirmed/4 | 4 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: DF |
| 112 | 2026-12-13 | יגאל בקר | GK | 1999 | IL | 20/21-21/22 | confirmed/3 | 0 |  |
| 113 | 2026-12-14 | מילאן אוסטרץ | FW | 1975 | SI | 00/01-01/02 | confirmed/4 | 0 |  |
| 114 | 2026-12-15 | אמיליוס זובאס | GK | 1990 | LT | 23/24 | confirmed/5 | 8 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster marks local but nat=LT; IFA roster seasons missing from DB: 22/23 |
| 115 | 2026-12-16 | עומר פדידה | FW | 1990 | IL | 13/14-14/15 | confirmed/5 | 5 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 14/15 |
| 116 | 2026-12-17 | יזן נסאר | MF | 1997 | IL | 24/25-25/26 | confirmed/4 | 0 |  |
| 117 | 2026-12-18 | עידו שרון | GK | 2002 | IL | 22/23, 24/25 | confirmed/3 | 0 |  |
| 118 | 2026-12-19 | דאבור רופניק | MF | 1971 | HR | 98/99-99/00 | confirmed/4 | 0 |  |
| 119 | 2026-12-20 | דמיטר טלקיסקי | MF | 1977 | IL | 07/08-08/09 | confirmed/3 | 3 | nat IL vs IFA BG |
| 120 | 2026-12-21 | דני גרופר | MF | 1999 | IL | 19/20-21/22 | confirmed/5 | 8 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; DB seasons (2003+) not in IFA roster: 21/22; pos MF here vs DF at maccabi-ta |
| 121 | 2026-12-22 | גיא כוואז | DF | 1984 | IL | 03/04-04/05 | confirmed/3 | 0 |  |
| 122 | 2026-12-23 | דוד קופרמן | DF | 1996 | CO | 24/25 | confirmed/4 | 6 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); played 24/25 but name not found in IFA rosters (transliteration?) |
| 123 | 2026-12-24 | יעקב שוורץ | MF | 1964 | IL | 94/95 | confirmed/4 | 4 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target) |
| 124 | 2026-12-25 | ישראל זגורי | MF | 1990 | IL | 13/14-16/17 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 15/16, 16/17 |
| 125 | 2026-12-26 | דודו ביטון | FW | 1988 | IL | 15/16-16/17 | confirmed/5 | 4 | IFA roster seasons missing from DB: 14/15; DB seasons (2003+) not in IFA roster: 15/16 |
| 126 | 2026-12-27 | אריאל כהן | MF | 2003 | IL | 22/23, 24/25 | confirmed/3 | 0 |  |
| 127 | 2026-12-28 | דניאל (עמוס) | GK | 1987 | IL | 13/14-14/15 | confirmed/3 | 0 |  |
| 128 | 2026-12-29 | דוד אלון | GK | 1997 | IL | 16/17-17/18 | confirmed/3 | 0 |  |
| 129 | 2026-12-30 | ישראל כהן | DF | 1971 | IL | 97/98-99/00 | confirmed/3 | 0 |  |
| 130 | 2026-12-31 | אפק בלס | DF | 1999 | IL | 18/19, 20/21 | confirmed/3 | 0 |  |
| 131 | 2027-01-01 | לוקאס סאשה | MF | 1990 | BR | 13/14-14/15 | confirmed/4 | 2 | played 14/15 but name not found in IFA rosters (transliteration?) |
| 132 | 2027-01-02 | ביוואן פרנסמן | DF | 1983 | ZA | 10/11-11/12 | confirmed/4 | 2 | played 11/12 but name not found in IFA rosters (transliteration?) |
| 133 | 2027-01-03 | רובי לבקוביץ' | GK | 1988 | IL | 18/19, 24/25 | confirmed/5 | 0 |  |
| 134 | 2027-01-04 | דור בנימיני | GK | 2005 | IL | 24/25-25/26 | confirmed/3 | 0 |  |
| 135 | 2027-01-05 | מאור בוזגלו | FW | 1988 | IL | 19/20 | confirmed/5 | 8 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target) |
| 136 | 2027-01-06 | אלין טופוזאקוב | DF | 1977 | BG | 08/09 | confirmed/5 | 8 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster marks local but nat=BG; IFA roster seasons missing from DB: 07/08 |
| 137 | 2027-01-07 | רועי זיקרי | FW | 1992 | IL | 18/19-20/21 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 138 | 2027-01-08 | סמואל יבואה | FW | 1986 | GH | 08/09 | confirmed/5 | 8 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster marks local but nat=GH; IFA roster seasons missing from DB: 09/10 |
| 139 | 2027-01-09 | דוגלאס דה סילבה | DF | 1984 | IL | 08/09-09/10 | confirmed/3 | 3 | nat IL vs IFA BR |
| 140 | 2027-01-10 | אחמד עאבד | FW | 1990 | IL | 18/19-19/20, 24/25 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 19/20 |
| 141 | 2027-01-11 | אריאל הרוש | GK | 1988 | IL | 15/16-16/17 | confirmed/5 | 0 |  |
| 142 | 2027-01-12 | אלן אוז'בולט | FW | 1996 | SI | 22/23-23/24 | confirmed/5 | 1 | IFA roster marks local but nat=SI |
| 143 | 2027-01-13 | רועי דיין | FW | 1984 | IL | 07/08 | confirmed/5 | 8 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA has 2 ids for this name at club (1757,85325); IFA roster seasons missing from DB: 16/17 |
| 144 | 2027-01-14 | עוביידה חטאב | DF | 1992 | IL | 14/15 | confirmed/5 | 10 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); Latin alias "Avraham Chekol" does not transliterate-match "עוביידה חטאב" (score 0.33) (mis-bridge?) |
| 145 | 2027-01-15 | איתי שכטר | FW | 1987 | IL | 09/10-10/11, 13/14 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 10/11, 13/14 |
| 146 | 2027-01-16 | סרגיי קלשצ'נקו | FW | 1972 | MD | 01/02-02/03 | confirmed/4 | 2 | played 02/03 but name not found in IFA rosters (transliteration?) |
| 147 | 2027-01-17 | יורגן קולין | DF | 1981 | NL | 13/14-14/15 | confirmed/5 | 2 | IFA roster marks local but nat=NL; DB seasons (2003+) not in IFA roster: 13/14 |
| 148 | 2027-01-18 | שמעון הרוש | DF | 1987 | IL | 13/14 | confirmed/5 | 7 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster seasons missing from DB: 12/13 |
| 149 | 2027-01-19 | שחר פיבן | DF | 1995 | IL | 25/26 | confirmed/5 | 7 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster seasons missing from DB: 24/25 |
| 150 | 2027-01-20 | רז טויזר | FW | 1999 | IL | 21/22-22/23 | confirmed/3 | 0 |  |
| 151 | 2027-01-21 | פייסל מוליץ' | FW | 1994 | RS | 18/19 | confirmed/4 | 6 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); played 18/19 but name not found in IFA rosters (transliteration?) |
| 152 | 2027-01-22 | אליניב ברדה | FW | 1981 | IL | 05/06-06/07 | confirmed/5 | 0 |  |
| 153 | 2027-01-23 | דמיאן לוקאשיק | DF | 1964 | PL | 94/95-95/96 | confirmed/4 | 0 |  |
| 154 | 2027-01-24 | ליאור לוי | DF | 1987 | IL | 11/12-12/13 | confirmed/4 | 9 | IFA roster seasons missing from DB: 13/14, 14/15; DB seasons (2003+) not in IFA roster: 11/12, 12/13; possible off-by-one season: DB 11/12,12/13 vs IFA 13/14,14/15 |
| 155 | 2027-01-25 | פיליפ מנה | FW | 1991 | IL | 10/11, 14/15 | confirmed/3 | 0 |  |
| 156 | 2027-01-26 | לי און מזרחי | MF | 2002 | IL | 21/22 | confirmed/5 | 11 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); pos MF here vs DF at beitar |
| 157 | 2027-01-27 | עמית למקין | MF | 2005 | IL | 24/25-25/26 | confirmed/3 | 0 |  |
| 158 | 2027-01-28 | אריאל טליאס | GK | 1989 | IL | 12/13-13/14 | confirmed/3 | 0 |  |
| 159 | 2027-01-29 | מועין חלבי | GK | 1996 | IL | 18/19-19/20 | confirmed/3 | 0 |  |
| 160 | 2027-01-30 | בנימין טרידובסקי | DF | 1998 | IL | 17/18, 21/22 | confirmed/3 | 0 |  |
| 161 | 2027-01-31 | אור אוסטוינד | MF | 1987 | IL | 17/18 | confirmed/4 | 6 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); played 17/18 but name not found in IFA rosters (transliteration?) |
| 162 | 2027-02-01 | עופר ורטה | DF | 1990 | IL | 15/16-16/17 | confirmed/5 | 0 |  |
| 163 | 2027-02-02 | איאד ח'וטבא | DF | 1987 | IL | 11/12-12/13 | confirmed/5 | 0 |  |
| 164 | 2027-02-03 | יוסי רוזן | MF | 1979 | IL | 03/04-04/05 | confirmed/2 | 0 |  |
| 165 | 2027-02-04 | שלומי אזולאי (1990) | MF | 1990 | IL | 21/22-22/23 | confirmed/2 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 166 | 2027-02-05 | שלומי אזולאי (1989) | FW | 1989 | IL | 14/15, 21/22 | confirmed/3 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 167 | 2027-02-06 | לירן רוטמן | FW | 1996 | IL | 24/25-25/26 | confirmed/5 | 8 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 25/26; pos FW here vs MF at beitar |
| 168 | 2027-02-07 | איליי טמם | MF | 2001 | IL | 20/21-21/22 | confirmed/4 | 2 | played 21/22 but name not found in IFA rosters (transliteration?) |

### maccabi-haifa (חיפהdle) — pool 215, cycles 2027-03-27

| # | date | player | pos | born | nat | spells | trust/src | score | flags |
|---|---|---|---|---|---|---|---|---|---|
| 49 | 2026-10-11 | נטע לביא | MF | 1996 | IL | 15/16-22/23 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 22/23 |
| 50 | 2026-10-12 | ליאור רפאלוב | MF | 1986 | IL | 04/05-10/11, 23/24-24/25 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 04/05, 10/11 |
| 51 | 2026-10-13 | סינטאיהו סלליך | MF | 1991 | IL | 10/11-13/14, 17/18-19/20 | confirmed/5 | 13 | DB seasons (2003+) not in IFA roster: 11/12, 12/13, 13/14; pos MF here vs FW at beitar; pos MF here vs FW at hapoel-bs; Latin alias "Seydouba Soumah" does not transliterate-match "סינטאיהו סלליך" (score 0.4) (mis-bridge?) |
| 52 | 2026-10-14 | איוואן גצקו | FW | 1968 | UA | 92/93-93/94 | confirmed/2 | 0 |  |
| 53 | 2026-10-15 | חן עזרא | FW | 1989 | IL | 12/13-15/16 | confirmed/5 | 7 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; pos FW here vs MF at hapoel-ta |
| 54 | 2026-10-16 | רוני לוי | MF | 1966 | IL | 92/93-96/97 | confirmed/4 | 0 |  |
| 55 | 2026-10-17 | משה סלקטר | MF | 1961 | IL | 79/80-86/87, 89/90 | confirmed/4 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: FW |
| 56 | 2026-10-18 | שי מימון | DF | 1986 | IL | 03/04-10/11 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 03/04, 04/05, 06/07, 08/09 |
| 57 | 2026-10-19 | יניב קטן | FW | 1981 | IL | 98/99-13/14 | confirmed/5 | 11 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 05/06; Latin alias "John Culma" does not transliterate-match "יניב קטן" (score 0.4) (mis-bridge?) |
| 58 | 2026-10-20 | בויאן שראנוב | GK | 1987 | RS | 11/12-13/14 | confirmed/5 | 1 | IFA roster marks local but nat=RS |
| 59 | 2026-10-21 | עלי מוחמד | MF | 1995 | NE | 21/22-25/26 | confirmed/4 | 0 |  |
| 60 | 2026-10-22 | ג'ובאני רוסו | MF | 1972 | HR | 01/02-04/05, 07/08 | confirmed/4 | 4 | nat HR vs IFA IL; IFA roster marks local but nat=HR |
| 61 | 2026-10-23 | אבי רן | GK | 1963 | IL | 81/82-86/87 | confirmed/4 | 0 |  |
| 62 | 2026-10-24 | אלון חרזי | DF | 1971 | IL | 90/91-08/09 | confirmed/5 | 3 | IFA roster seasons missing from DB: 09/10 |
| 63 | 2026-10-25 | ואליד באדיר | MF | 1974 | IL | 00/01-04/05 | confirmed/5 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF |
| 64 | 2026-10-26 | אוהד לויטה | GK | 1986 | IL | 14/15-17/18 | confirmed/5 | 0 |  |
| 65 | 2026-10-27 | פיטר מסיללה | DF | 1985 | ZA | 07/08-11/12 | confirmed/5 | 0 |  |
| 66 | 2026-10-28 | רועי קהת | MF | 1992 | IL | 16/17-18/19 | confirmed/5 | 0 |  |
| 67 | 2026-10-29 | אליניב ברדה | FW | 1981 | IL | 03/04-04/05 | confirmed/5 | 3 | IFA roster seasons missing from DB: 02/03 |
| 68 | 2026-10-30 | ויאם עמאשה | FW | 1985 | IL | 11/12-14/15 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 13/14 |
| 69 | 2026-10-31 | תום אלמדון | GK | 1984 | IL | 02/03-10/11 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 02/03, 07/08, 08/09, 09/10, 10/11 |
| 70 | 2026-11-01 | גוסטבו בוקולי | MF | 1978 | BR | 04/05-14/15 | confirmed/5 | 4 | nat BR vs IFA IL; IFA roster marks local but nat=BR |
| 71 | 2026-11-02 | סרגיי קנדאורוב | MF | 1971 | UA | 93/94-96/97 | confirmed/3 | 4 | audit שנת לידה/סתירה: מאגר: 1971 · ויקיפדיה: 1972 |
| 72 | 2026-11-03 | עלי עות'מאן | DF | 1987 | IL | 09/10-11/12 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 73 | 2026-11-04 | רוני רוזנטל | FW | 1963 | IL | 79/80-85/86 | confirmed/4 | 0 |  |
| 74 | 2026-11-05 | אלירן עטר | FW | 1987 | IL | 15/16-16/17 | confirmed/5 | 6 | IFA roster seasons missing from DB: 14/15; pos FW here vs MF at maccabi-ta |
| 75 | 2026-11-06 | ג'וש כהן | GK | 1992 | US/IL | 19/20-22/23 | confirmed/4 | 2 | played 22/23 but name not found in IFA rosters (transliteration?) |
| 76 | 2026-11-07 | אלירן אלקיים | DF | 1976 | IL | 94/95-00/01 | confirmed/5 | 3 | IFA roster seasons missing from DB: 02/03 |
| 77 | 2026-11-08 | דודו אוואט | GK | 1977 | IL | 01/02-02/03 | confirmed/5 | 0 |  |
| 78 | 2026-11-09 | ננאד פראליה | MF | 1970 | HR | 00/01-02/03 | confirmed/4 | 2 | played 02/03 but name not found in IFA rosters (transliteration?) |
| 79 | 2026-11-10 | שון וייסמן | FW | 1996 | IL | 14/15-18/19 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 14/15, 16/17, 17/18 |
| 80 | 2026-11-11 | שובל גוזלן | FW | 1994 | IL | 12/13-16/17 | confirmed/5 | 0 |  |
| 81 | 2026-11-12 | ניר דוידוביץ' | GK | 1976 | IL | 94/95-12/13 | confirmed/5 | 0 |  |
| 82 | 2026-11-13 | אדין צוצאליץ' | DF | 1987 | BA | 12/13-14/15 | confirmed/5 | 10 | IFA roster marks local but nat=BA; IFA roster seasons missing from DB: 11/12; DB seasons (2003+) not in IFA roster: 14/15; possible off-by-one season: DB 12/13,13/14,14/15 vs IFA 11/12,12/13,13/14 |
| 83 | 2026-11-14 | חיים מגרלשוילי | DF | 1982 | IL | 04/05-06/07, 11/12 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 11/12 |
| 84 | 2026-11-15 | אלון חזן | MF | 1967 | IL | 92/93-95/96 | confirmed/4 | 0 |  |
| 85 | 2026-11-16 | אופיר קופל | MF | 1975 | IL | 96/97-99/00 | confirmed/4 | 0 |  |
| 86 | 2026-11-17 | דני רום | FW | 1940 | IL | 57/58-72/73 | confirmed/3 | 0 |  |
| 87 | 2026-11-18 | מחמוד ג'אבר | MF | 1999 | IL | 19/20-24/25 | confirmed/5 | 4 | IFA roster seasons missing from DB: 18/19; DB seasons (2003+) not in IFA roster: 19/20, 20/21 |
| 88 | 2026-11-19 | רן אבוקרט | MF | 1988 | IL | 13/14-15/16 | confirmed/5 | 0 |  |
| 89 | 2026-11-20 | דקל קינן | DF | 1984 | IL | 02/03-09/10, 12/13-17/18 | confirmed/5 | 7 | DB seasons (2003+) not in IFA roster: 02/03, 04/05, 05/06, 17/18; Latin alias "Thembinkosi Fanteni" does not transliterate-match "דקל קינן" (score 0.5) (mis-bridge?) |
| 90 | 2026-11-21 | ניקיטה רוקאביציה | FW | 1987 | AU/UA | 16/17-20/21, 22/23 | confirmed/5 | 4 | nat AU/UA vs IFA IL; IFA roster marks local but nat=AU/UA |
| 91 | 2026-11-22 | חיים סילבס | MF | 1975 | IL | 94/95-96/97, 98/99 | confirmed/4 | 0 |  |
| 92 | 2026-11-23 | עופרי ארד | DF | 1998 | IL | 17/18-22/23 | confirmed/5 | 7 | DB seasons (2003+) not in IFA roster: 17/18, 22/23; Latin alias "Mohammad Abu Fani" does not transliterate-match "עופרי ארד" (score 0.4) (mis-bridge?) |
| 93 | 2026-11-24 | עידן ורד | MF | 1989 | IL | 10/11-14/15 | confirmed/5 | 3 | pos MF here vs FW at hapoel-ta |
| 94 | 2026-11-25 | אמיר אדרי | GK | 1985 | IL | 02/03-14/15 | confirmed/5 | 7 | DB seasons (2003+) not in IFA roster: 02/03, 03/04, 07/08, 11/12; Latin alias "Eran Levy" does not transliterate-match "אמיר אדרי" (score 0.25) (mis-bridge?) |
| 95 | 2026-11-26 | אייל גולסה | MF | 1991 | IL | 08/09-13/14 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 08/09, 09/10 |
| 96 | 2026-11-27 | עבדוליי סק | DF | 1992 | SN/IL | 22/23-25/26 | confirmed/3 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 97 | 2026-11-28 | טל בנין | MF | 1971 | IL | 89/90-91/92 | confirmed/4 | 0 |  |
| 98 | 2026-11-29 | אבי פרץ | GK | 1971 | IL | 99/00-00/01 | confirmed/3 | 3 | IFA roster seasons missing from DB: 02/03 |
| 99 | 2026-11-30 | ציון מרילי | DF | 1957 | IL | 83/84-89/90 | confirmed/4 | 0 |  |
| 100 | 2026-12-01 | יוסי בניון | MF | 1980 | IL | 98/99-01/02, 14/15-15/16 | confirmed/5 | 0 |  |
| 101 | 2026-12-02 | סארי פלאח | DF | 1991 | IL | 09/10-13/14 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 09/10, 12/13 |
| 102 | 2026-12-03 | איציק כהן | DF | 1983 | IL | 01/02, 11/12-13/14 | confirmed/4 | 0 |  |
| 103 | 2026-12-04 | אסמאעיל ריאן | DF | 1994 | IL | 12/13-16/17 | confirmed/5 | 8 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי; Latin alias "Iyad Abu Abaid" does not transliterate-match "אסמאעיל ריאן" (score 0) (mis-bridge?) |
| 104 | 2026-12-05 | סאן מנחם | DF | 1993 | IL | 15/16-23/24 | confirmed/5 | 7 | DB seasons (2003+) not in IFA roster: 17/18, 23/24; Latin alias "Kerim Frei" does not transliterate-match "סאן מנחם" (score 0.4) (mis-bridge?) |
| 105 | 2026-12-06 | צ'רון שרי | MF | 1988 | NL | 19/20-23/24 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 106 | 2026-12-07 | שי בירוק | MF | 1984 | IL | 02/03-05/06 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 02/03 |
| 107 | 2026-12-08 | רז מאיר | DF | 1996 | IL | 14/15-22/23 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 14/15, 15/16, 16/17 |
| 108 | 2026-12-09 | שמואל שיימן | DF | 1987 | IL | 12/13-14/15 | confirmed/5 | 0 |  |
| 109 | 2026-12-10 | רמי גרשון | DF | 1988 | IL | 17/18-24/25 | confirmed/5 | 0 |  |
| 110 | 2026-12-11 | רביד גזל | MF | 1982 | IL | 04/05-06/07 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 05/06 |
| 111 | 2026-12-12 | חבייר דירסאו | MF | 1977 | IL | 04/05-06/07 | confirmed/2 | 3 | nat IL vs IFA BR |
| 112 | 2026-12-13 | רועי פוקס | GK | 1998 | IL | 17/18, 20/21-25/26 | confirmed/3 | 0 |  |
| 113 | 2026-12-14 | מוחמד עואד | FW | 1997 | IL | 16/17-20/21 | confirmed/3 | 0 |  |
| 114 | 2026-12-15 | רוני גפני | DF | 1980 | IL | 07/08-08/09 | confirmed/4 | 0 |  |
| 115 | 2026-12-16 | פדראו | DF | 1997 | BR | 24/25-25/26 | confirmed/3 | 2 | played 25/26 but name not found in IFA rosters (transliteration?) |
| 116 | 2026-12-17 | סתיו נחמני | FW | 2002 | IL | 20/21-23/24 | confirmed/4 | 2 | played 23/24 but name not found in IFA rosters (transliteration?) |
| 117 | 2026-12-18 | ליעד אלמליח | MF | 1989 | IL | 08/09-10/11 | confirmed/5 | 5 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; DB seasons (2003+) not in IFA roster: 09/10, 10/11 |
| 118 | 2026-12-19 | גדי קינדה | MF | 1994 | IL | 24/25 | confirmed/5 | 7 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster seasons missing from DB: 23/24 |
| 119 | 2026-12-20 | אלעד גבאי | MF | 1985 | IL | 13/14-14/15 | confirmed/5 | 7 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; pos MF here vs DF at beitar |
| 120 | 2026-12-21 | איתן אזולאי | MF | 2002 | IL | 24/25-25/26 | confirmed/5 | 0 |  |
| 121 | 2026-12-22 | מאור בוזגלו | FW | 1988 | IL | 05/06-07/08, 17/18 | confirmed/5 | 5 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 05/06, 06/07, 07/08 |
| 122 | 2026-12-23 | ניתאי גרייס | GK | 2004 | IL | 23/24-25/26 | confirmed/4 | 1 | DB seasons (2003+) not in IFA roster: 25/26 |
| 123 | 2026-12-24 | שאדי שעבאן | MF | 1992 | IL | 10/11-12/13 | confirmed/4 | 2 | played 12/13 but name not found in IFA rosters (transliteration?) |
| 124 | 2026-12-25 | איברהים דורו | MF | 1970 | BA | 97/98-98/99 | confirmed/4 | 0 |  |
| 125 | 2026-12-26 | חיים רביבו | MF | 1972 | IL | 94/95-95/96 | confirmed/4 | 0 |  |
| 126 | 2026-12-27 | גיז'רמו ישראלביץ' | MF | 1982 | AR | 02/03 | confirmed/5 | 11 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); nat AR vs IFA IL; IFA roster marks local but nat=AR; IFA roster seasons missing from DB: 03/04 |
| 127 | 2026-12-28 | נג'ואן גרייב | DF | 1974 | IL | 94/95, 04/05 | confirmed/5 | 0 |  |
| 128 | 2026-12-29 | דניאל בריילובסקי | MF | 1958 | IL | 86/87-87/88 | confirmed/4 | 0 |  |
| 129 | 2026-12-30 | עומר דמארי | FW | 1989 | IL | 17/18 | confirmed/5 | 7 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster seasons missing from DB: 16/17 |
| 130 | 2026-12-31 | גודסוויי דוניו | FW | 1994 | GH | 20/21-21/22 | confirmed/5 | 0 |  |
| 131 | 2027-01-01 | אלון מזרחי | FW | 1971 | IL | 93/94-98/99 | confirmed/4 | 0 |  |
| 132 | 2027-01-02 | יובל אשכנזי | MF | 1992 | IL | 19/20-21/22 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 21/22 |
| 133 | 2027-01-03 | גילי ורמוט | MF | 1985 | IL | 16/17-17/18 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 134 | 2027-01-04 | אטיין ריינן | DF | 1987 | NL | 18/19 | confirmed/5 | 8 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster marks local but nat=NL; IFA roster seasons missing from DB: 17/18 |
| 135 | 2027-01-05 | בן שהר | FW | 1989 | IL | 21/22-22/23 | confirmed/5 | 0 |  |
| 136 | 2027-01-06 | רועי משפתי | GK | 1992 | IL | 21/22-22/23 | confirmed/5 | 0 |  |
| 137 | 2027-01-07 | מארק ואליינטה | DF | 1987 | ES | 15/16-16/17 | confirmed/5 | 0 |  |
| 138 | 2027-01-08 | גד עמוס | GK | 1988 | IL | 08/09-11/12 | confirmed/5 | 9 | IFA roster seasons missing from DB: 07/08; DB seasons (2003+) not in IFA roster: 09/10, 10/11, 11/12; possible off-by-one season: DB 08/09,09/10,10/11,11/12 vs IFA 07/08,08/09 |
| 139 | 2027-01-09 | סיידו יאיא | MF | 1989 | GH | 10/11-11/12 | confirmed/5 | 0 |  |
| 140 | 2027-01-10 | ולדימיר סטויקוביץ' | GK | 1983 | RS | 14/15-15/16 | confirmed/5 | 1 | IFA roster marks local but nat=RS |
| 141 | 2027-01-11 | אריק שוראנוב | FW | 2002 | DE | 23/24-24/25 | confirmed/5 | 4 | nat DE vs IFA IL; IFA roster marks local but nat=DE |
| 142 | 2027-01-12 | חוסה רודריגס מרטינס | MF | 1994 | ES | 20/21-21/22 | confirmed/2 | 2 | played 21/22 but name not found in IFA rosters (transliteration?) |
| 143 | 2027-01-13 | רפאל אולארה | DF | 1978 | CL | 05/06-06/07 | confirmed/5 | 1 | IFA roster marks local but nat=CL |
| 144 | 2027-01-14 | אליסון דוס סנטוס | DF | 1990 | BR | 17/18-18/19 | confirmed/4 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 145 | 2027-01-15 | ולדימיר דבאלישווילי | FW | 1986 | GE | 09/10-11/12 | confirmed/4 | 2 | played 11/12 but name not found in IFA rosters (transliteration?) |
| 146 | 2027-01-16 | רומן פץ | DF | 1969 | UA | 93/94-94/95 | confirmed/4 | 0 |  |
| 147 | 2027-01-17 | טימבינוקסי פנטיני | FW | 1984 | IL | 07/08-08/09 | confirmed/3 | 3 | nat IL vs IFA ZA |
| 148 | 2027-01-18 | דניאל סונדגרן | DF | 1990 | SE | 22/23-23/24 | confirmed/5 | 4 | nat SE vs IFA IL; IFA roster marks local but nat=SE |
| 149 | 2027-01-19 | שוקי נגר | DF | 1977 | IL | 98/99-99/00 | confirmed/4 | 0 |  |
| 150 | 2027-01-20 | יעקובו איגביני | FW | 1982 | NG | 99/00-02/03 | confirmed/3 | 2 | played 02/03 but name not found in IFA rosters (transliteration?) |
| 151 | 2027-01-21 | אושרי גיטא | FW | 1985 | IL | 03/04, 07/08 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 03/04 |
| 152 | 2027-01-22 | ירדן שועה | FW | 1999 | IL | 19/20 | confirmed/5 | 13 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster seasons missing from DB: 18/19; Latin alias "Ikouwem Utin" does not transliterate-match "ירדן שועה" (score 0.4) (mis-bridge?) |
| 153 | 2027-01-23 | יובל יוסיפוביץ | DF | 1994 | IL | 13/14, 15/16 | confirmed/3 | 0 |  |
| 154 | 2027-01-24 | רדוסלב מיכאלסקי | MF | 1969 | PL | 99/00-00/01 | confirmed/4 | 0 |  |
| 155 | 2027-01-25 | מרטינס דפקוס | DF | 1993 | LT | 12/13-13/14 | confirmed/2 | 5 | audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball; played 13/14 but name not found in IFA rosters (transliteration?) |
| 156 | 2027-01-26 | גל אלברמן | MF | 1983 | IL | 17/18-18/19 | confirmed/5 | 0 |  |
| 157 | 2027-01-27 | עמוס סאסי | DF | 1979 | IL | 99/00 | confirmed/4 | 4 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target) |
| 158 | 2027-01-28 | אייל אלמושנינו | MF | 1976 | IL | 01/02-02/03 | confirmed/5 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF |
| 159 | 2027-01-29 | יהושע גל | FW | 1951 | IL | 73/74 | confirmed/4 | 8 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF; only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target) |
| 160 | 2027-01-30 | דלה ימפולסקי | FW | 1988 | IL | 11/12-12/13 | confirmed/4 | 6 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF; played 12/13 but name not found in IFA rosters (transliteration?) |
| 161 | 2027-01-31 | פרנזי פיירו | FW | 1995 | IL | 22/23-23/24 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 162 | 2027-02-01 | ישראל זגורי | MF | 1990 | IL | 08/09-11/12 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 08/09, 10/11, 11/12 |
| 163 | 2027-02-02 | מקסים פלקושצ'נקו | MF | 1996 | IL | 19/20-22/23 | confirmed/5 | 9 | IFA roster seasons missing from DB: 18/19; DB seasons (2003+) not in IFA roster: 20/21, 21/22, 22/23; possible off-by-one season: DB 19/20,20/21,21/22,22/23 vs IFA 18/19,19/20 |
| 164 | 2027-02-03 | סרגיי קלשצ'נקו | FW | 1972 | MD | 99/00-00/01 | confirmed/4 | 0 |  |
| 165 | 2027-02-04 | מאור קנדיל | DF | 1993 | IL | 23/24-24/25 | confirmed/5 | 0 |  |
| 166 | 2027-02-05 | שמעון אבו חצירא | FW | 1986 | IL | 13/14-15/16 | confirmed/4 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 167 | 2027-02-06 | גוני נאור | MF | 1999 | IL | 23/24-25/26 | confirmed/5 | 13 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; IFA roster seasons missing from DB: 22/23; DB seasons (2003+) not in IFA roster: 24/25, 25/26; possible off-by-one season: DB 23/24,24/25,25/26 vs IFA 22/23,23/24 |
| 168 | 2027-02-07 | רון שושן | GK | 1993 | IL | 12/13-13/14 | confirmed/4 | 0 |  |

### maccabi-ta (מכביdle) — pool 205, cycles 2027-03-17

| # | date | player | pos | born | nat | spells | trust/src | score | flags |
|---|---|---|---|---|---|---|---|---|---|
| 49 | 2026-10-11 | גבי קניקובסקי | MF | 1997 | IL | 15/16-17/18, 21/22-24/25 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 50 | 2026-10-12 | תום מנשרוב | MF | 1987 | IL | 06/07-09/10, 11/12 | confirmed/4 | 1 | DB seasons (2003+) not in IFA roster: 06/07, 07/08 |
| 51 | 2026-10-13 | ברק יצחקי | FW | 1984 | IL | 10/11-17/18 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 12/13 |
| 52 | 2026-10-14 | אנדרייס פרוחורנקובס | FW | 1977 | LV | 02/03-04/05 | confirmed/4 | 2 | played 04/05 but name not found in IFA rosters (transliteration?) |
| 53 | 2026-10-15 | אלי ביטון | MF | 1982 | IL | 98/99-04/05 | confirmed/4 | 0 |  |
| 54 | 2026-10-16 | מתן בלטקסה | DF | 1995 | IL | 20/21-21/22, 23/24 | confirmed/5 | 4 | audit עונות/סתירה: ויקיפדיה מוסיפה 17/18-19/20, 24/25 · המאגר מוסיף 23/24 |
| 55 | 2026-10-17 | ערן זהבי | FW | 1987 | IL | 13/14-15/16, 22/23-24/25 | confirmed/5 | 7 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; IFA roster seasons missing from DB: 12/13 |
| 56 | 2026-10-18 | אורי שטרית | DF | 1986 | IL | 04/05-09/10 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 04/05 |
| 57 | 2026-10-19 | גיז'רמו ישראלביץ' | MF | 1982 | AR | 08/09-11/12 | confirmed/5 | 4 | nat AR vs IFA IL; IFA roster marks local but nat=AR |
| 58 | 2026-10-20 | עמיר תורג'מן | FW | 1972 | IL | 89/90-91/92, 01/02-02/03 | confirmed/5 | 0 |  |
| 59 | 2026-10-21 | אנדרה ז'ראלדש | DF | 1991 | PT | 19/20, 21/22-22/23 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 60 | 2026-10-22 | ויקי פרץ | FW | 1953 | IL | 73/74-79/80, 83/84-84/85 | confirmed/4 | 0 |  |
| 61 | 2026-10-23 | מקסים גרצ'קין | DF | 1996 | IL | 15/16-18/19 | confirmed/3 | 2 | played 18/19 but name not found in IFA rosters (transliteration?) |
| 62 | 2026-10-24 | ניר קלינגר | MF | 1966 | IL | 90/91-97/98 | confirmed/4 | 0 |  |
| 63 | 2026-10-25 | אמיר שלח | DF | 1970 | IL | 90/91-97/98, 00/01-01/02 | confirmed/4 | 0 |  |
| 64 | 2026-10-26 | דור מיכה | MF | 1992 | IL | 11/12-19/20 | confirmed/5 | 0 |  |
| 65 | 2026-10-27 | מתן חוזז | FW | 1996 | IL | 15/16-23/24 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 15/16, 16/17, 17/18, 18/19, 23/24 |
| 66 | 2026-10-28 | האריס מדוניאנין | MF | 1985 | BA | 10/11-11/12, 16/17 | confirmed/5 | 8 | nat BA vs IFA NL; IFA roster marks local but nat=BA; IFA roster seasons missing from DB: 15/16; DB seasons (2003+) not in IFA roster: 16/17 |
| 67 | 2026-10-29 | ארז מסיקה | MF | 1979 | IL | 03/04-07/08 | confirmed/5 | 0 |  |
| 68 | 2026-10-30 | אבי נמני | MF | 1972 | IL | 89/90-02/03, 05/06-07/08 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 07/08 |
| 69 | 2026-10-31 | תמיר כחלון | MF | 1987 | IL | 06/07, 09/10-10/11 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 10/11 |
| 70 | 2026-11-01 | לירן שטראובר | GK | 1974 | IL | 99/00-05/06, 09/10-10/11 | confirmed/5 | 0 |  |
| 71 | 2026-11-02 | גל אלברמן | MF | 1983 | IL | 10/11-16/17 | confirmed/5 | 0 |  |
| 72 | 2026-11-03 | מני לוי | DF | 1980 | IL | 00/01-01/02 | confirmed/5 | 3 | IFA roster seasons missing from DB: 02/03, 03/04 |
| 73 | 2026-11-04 | ריף פרץ | MF | 1991 | IL | 09/10-15/16 | confirmed/5 | 5 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; DB seasons (2003+) not in IFA roster: 09/10, 13/14, 14/15, 15/16 |
| 74 | 2026-11-05 | איתי שכטר | FW | 1987 | IL | 18/19-20/21 | confirmed/5 | 0 |  |
| 75 | 2026-11-06 | ראדה פריצה | FW | 1980 | SE | 13/14-14/15 | confirmed/5 | 4 | IFA roster marks local but nat=SE; IFA roster seasons missing from DB: 12/13 |
| 76 | 2026-11-07 | גיא צרפתי | MF | 1979 | IL | 96/97-01/02 | confirmed/5 | 3 | IFA roster seasons missing from DB: 02/03 |
| 77 | 2026-11-08 | מהראן ראדי | MF | 1982 | IL | 12/13-14/15 | confirmed/5 | 0 |  |
| 78 | 2026-11-09 | רוי רביבו | DF | 2003 | IL | 21/22-25/26 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 21/22, 22/23 |
| 79 | 2026-11-10 | אבי כהן (1956) | DF | 1956 | IL | 74/75-78/79, 81/82-86/87, 88/89-89/90 | confirmed/2 | 6 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי; audit שנת לידה/סתירה: מאגר: 1956 · worldfootball: 1962 |
| 80 | 2026-11-11 | מאיר מליקה | FW | 1969 | IL | 88/89-93/94, 95/96 | confirmed/3 | 0 |  |
| 81 | 2026-11-12 | ארון שוינפלד | FW | 1990 | IL | 17/18-19/20 | confirmed/4 | 2 | played 19/20 but name not found in IFA rosters (transliteration?) |
| 82 | 2026-11-13 | ג'ון פנטסיל | DF | 1981 | GH | 02/03-03/04 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 83 | 2026-11-14 | דניאל טננבאום | GK | 1995 | IL | 16/17-23/24 | confirmed/5 | 0 |  |
| 84 | 2026-11-15 | אילון אלמוג | FW | 1999 | IL | 17/18-22/23 | confirmed/5 | 4 | DB seasons (2003+) not in IFA roster: 17/18, 18/19; pos FW here vs MF at hapoel-bs |
| 85 | 2026-11-16 | גיא חיימוב | GK | 1986 | IL | 03/04-12/13 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 03/04, 04/05, 06/07, 07/08, 09/10, 10/11, 12/13 |
| 86 | 2026-11-17 | גדי ברומר | MF | 1973 | IL | 91/92-03/04 | confirmed/5 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF |
| 87 | 2026-11-18 | לירן כהן | MF | 1983 | IL | 02/03-06/07 | confirmed/5 | 0 |  |
| 88 | 2026-11-19 | אבי יחיאל | DF | 1979 | IL | 05/06-08/09 | confirmed/5 | 7 | DB seasons (2003+) not in IFA roster: 05/06; Latin alias "Avi Yehiel" does not transliterate-match "אבי יחיאל" (score 0.5) (mis-bridge?) |
| 89 | 2026-11-20 | תמיר כהן | MF | 1984 | IL | 02/03-06/07 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 02/03, 06/07 |
| 90 | 2026-11-21 | נועם שוהם | MF | 1970 | IL | 87/88-88/89, 91/92-96/97 | confirmed/4 | 0 |  |
| 91 | 2026-11-22 | אנריק סאבוריט | DF | 1992 | ES | 18/19-23/24 | confirmed/5 | 0 |  |
| 92 | 2026-11-23 | שביט אלימלך | GK | 1971 | IL | 88/89-91/92 | confirmed/4 | 0 |  |
| 93 | 2026-11-24 | ראובן עובד | MF | 1983 | IL | 01/02-03/04 | confirmed/5 | 0 |  |
| 94 | 2026-11-25 | גבי לסרי | DF | 1956 | IL | 82/83 | confirmed/4 | 4 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target) |
| 95 | 2026-11-26 | מאור בוזגלו | FW | 1988 | IL | 08/09-10/11 | confirmed/5 | 4 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW |
| 96 | 2026-11-27 | רוברטו קולאוטי | FW | 1982 | IL | 10/11-12/13 | confirmed/5 | 0 |  |
| 97 | 2026-11-28 | בני טבק | FW | 1956 | IL | 73/74-88/89 | confirmed/4 | 0 |  |
| 98 | 2026-11-29 | רועי משפתי | GK | 1992 | IL | 23/24-25/26 | confirmed/5 | 0 |  |
| 99 | 2026-11-30 | אלכסנדר אובארוב | GK | 1960 | RU | 91/92-99/00 | confirmed/4 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 100 | 2026-12-01 | גיורא שפיגל | MF | 1947 | IL | 69/70-72/73, 78/79 | confirmed/4 | 4 | audit עונות/סתירה: ויקיפדיה מוסיפה 63/64-68/69, 79/80 · המאגר מוסיף 72/73, 78/79 |
| 101 | 2026-12-02 | אבי סטרול | DF | 1980 | IL | 98/99-05/06, 10/11-12/13 | confirmed/5 | 6 | Latin alias "Elad Bounfeld" does not transliterate-match "אבי סטרול" (score 0.33) (mis-bridge?) |
| 102 | 2026-12-03 | גאל מרגוליס | FW | 1994 | IL | 12/13-16/17 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 12/13, 15/16, 16/17 |
| 103 | 2026-12-04 | רוסלן ברסקי | MF | 1992 | IL | 12/13-20/21 | confirmed/4 | 2 | played 20/21 but name not found in IFA rosters (transliteration?) |
| 104 | 2026-12-05 | שגיב יחזקאל | FW | 1995 | IL | 16/17-18/19, 24/25-25/26 | confirmed/4 | 5 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: DF · worldfootball: FW; DB seasons (2003+) not in IFA roster: 17/18, 18/19 |
| 105 | 2026-12-06 | יונס מלדה | FW | 1999 | IL | 24/25-25/26 | confirmed/5 | 3 | IFA roster seasons missing from DB: 23/24 |
| 106 | 2026-12-07 | רז שלמה | DF | 1999 | IL | 24/25-25/26 | confirmed/5 | 3 | IFA roster seasons missing from DB: 23/24 |
| 107 | 2026-12-08 | יניב עזרן | FW | 1983 | IL | 07/08-10/11 | confirmed/5 | 0 |  |
| 108 | 2026-12-09 | איתן טיבי | DF | 1987 | IL | 12/13-20/21 | confirmed/5 | 0 |  |
| 109 | 2026-12-10 | אורן זיתוני | MF | 1976 | IL | 01/02-04/05 | confirmed/5 | 0 |  |
| 110 | 2026-12-11 | טל בן חיים (1982) | DF | 1982 | IL | 02/03-03/04, 15/16-17/18 | confirmed/5 | 3 | audit עונות/המאגר קצר מדי: חסרות 98/99-01/02 |
| 111 | 2026-12-12 | אורוש ניקוליץ' | MF | 1993 | RS | 18/19-20/21 | confirmed/5 | 2 | IFA roster marks local but nat=RS; DB seasons (2003+) not in IFA roster: 19/20 |
| 112 | 2026-12-13 | צבי רוזן | DF | 1947 | IL | 65/66-75/76 | confirmed/4 | 0 |  |
| 113 | 2026-12-14 | יוריס ואן אובריים | MF | 1994 | NL/IL | 22/23-24/25 | confirmed/5 | 0 |  |
| 114 | 2026-12-15 | יואב זיו | DF | 1981 | IL | 10/11-15/16 | confirmed/5 | 0 |  |
| 115 | 2026-12-16 | ליאור ז'אן | DF | 1986 | IL | 04/05-09/10 | confirmed/3 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 116 | 2026-12-17 | שחר פיבן | DF | 1995 | IL | 15/16-22/23 | confirmed/5 | 4 | IFA roster seasons missing from DB: 14/15; DB seasons (2003+) not in IFA roster: 15/16, 16/17, 17/18 |
| 117 | 2026-12-18 | רחמים טלבי | FW | 1943 | IL | 62/63-75/76 | confirmed/4 | 0 |  |
| 118 | 2026-12-19 | אופיר דוידזאדה | DF | 1991 | IL | 17/18-24/25 | confirmed/5 | 0 |  |
| 119 | 2026-12-20 | אלכסנדר פולוקארוב | DF | 1959 | RU | 91/92-93/94 | confirmed/4 | 0 |  |
| 120 | 2026-12-21 | רועי דיין | FW | 1984 | IL | 03/04-06/07 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 04/05 |
| 121 | 2026-12-22 | גיא סולומון | GK | 1977 | IL | 06/07-10/11 | confirmed/2 | 0 |  |
| 122 | 2026-12-23 | רייס ברונו | MF | 1978 | BR | 02/03-04/05 | confirmed/3 | 0 |  |
| 123 | 2026-12-24 | קובי מוסה | DF | 1982 | IL | 02/03-04/05, 06/07-07/08 | confirmed/3 | 0 |  |
| 124 | 2026-12-25 | עדן בן בסט | FW | 1986 | IL | 14/15-16/17 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 16/17 |
| 125 | 2026-12-26 | ז'איר אמאדור | DF | 1989 | PT | 18/19-19/20 | confirmed/5 | 4 | nat PT vs IFA ES; IFA roster marks local but nat=PT |
| 126 | 2026-12-27 | גיא מזרחי | DF | 2001 | IL | 20/21-21/22 | confirmed/3 | 5 | audit עונות/מקור יחיד: אין ויקיפדיה, אין התאחדות, אין worldfootball; played 21/22 but name not found in IFA rosters (transliteration?) |
| 127 | 2026-12-28 | כפיר אדרי | MF | 1976 | IL | 98/99-99/00 | confirmed/4 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF |
| 128 | 2026-12-29 | פרנץ הורבאט | FW | 1973 | HU | 00/01-01/02 | confirmed/4 | 0 |  |
| 129 | 2026-12-30 | רפי דהן | MF | 1989 | IL | 11/12-13/14 | confirmed/5 | 0 |  |
| 130 | 2026-12-31 | פארפה גיאגון | MF | 2001 | CI | 19/20, 22/23 | confirmed/4 | 6 | audit עונות/סתירה: ויקיפדיה מוסיפה 20/21-21/22 · המאגר מוסיף 19/20; played 22/23 but name not found in IFA rosters (transliteration?) |
| 131 | 2027-01-01 | יוסי בניון | MF | 1980 | IL | 16/17 | confirmed/5 | 4 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target) |
| 132 | 2027-01-02 | וידאר קיארטאנסון | FW | 1990 | IS | 16/17-17/18 | confirmed/3 | 0 |  |
| 133 | 2027-01-03 | אליאל פרץ | MF | 1996 | IL | 15/16-18/19 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 17/18, 18/19 |
| 134 | 2027-01-04 | עמירן שקלים | MF | 1988 | IL | 07/08-12/13 | confirmed/5 | 8 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; DB seasons (2003+) not in IFA roster: 08/09, 10/11, 11/12, 12/13; pos MF here vs DF at hapoel-ta |
| 135 | 2027-01-05 | שלומי אזולאי | MF | 1990 | IL | 15/16-16/17 | confirmed/4 | 3 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי; DB seasons (2003+) not in IFA roster: 16/17 |
| 136 | 2027-01-06 | עדן קארצב | MF | 2000 | IL | 20/21, 23/24 | confirmed/5 | 4 | audit עונות/סתירה: ויקיפדיה מוסיפה 18/19-19/20, 24/25 · המאגר מוסיף 23/24 |
| 137 | 2027-01-07 | קלמי סבן | DF | 1980 | IL | 10/11-11/12 | confirmed/5 | 0 |  |
| 138 | 2027-01-08 | חואן פבלו קולינאס | GK | 1978 | ES | 13/14-14/15 | confirmed/2 | 2 | played 14/15 but name not found in IFA rosters (transliteration?) |
| 139 | 2027-01-09 | יובל אבידור | MF | 1986 | IL | 09/10-10/11 | confirmed/5 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: FW · worldfootball: MF |
| 140 | 2027-01-10 | ג'ורג'ה יובאנוביץ' | FW | 1999 | RS | 22/23 | confirmed/4 | 11 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); IFA roster marks local but nat=RS; IFA roster seasons missing from DB: 21/22; nat RS here vs IL at maccabi-haifa |
| 141 | 2027-01-11 | אלעד מדמון | MF | 2004 | IL | 24/25-25/26 | confirmed/5 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: FW · worldfootball: MF |
| 142 | 2027-01-12 | דרגוסלאב יבריץ' | GK | 1974 | RS | 07/08-08/09 | confirmed/5 | 0 |  |
| 143 | 2027-01-13 | דן איינבינדר | MF | 1989 | IL | 13/14-14/15 | confirmed/5 | 0 |  |
| 144 | 2027-01-14 | אליהו זיזוב | MF | 1991 | IL | 11/12-12/13 | confirmed/3 | 0 |  |
| 145 | 2027-01-15 | משה גלאם | DF | 1968 | IL | 97/98-98/99 | confirmed/4 | 0 |  |
| 146 | 2027-01-16 | ג'ובאני רוסו | MF | 1972 | HR | 05/06-06/07 | confirmed/4 | 4 | nat HR vs IFA IL; IFA roster marks local but nat=HR |
| 147 | 2027-01-17 | ג'ונתן אסוס | MF | 1983 | FR | 08/09 | confirmed/5 | 11 | only 1 season — below MIN_SEASONS=2; kept only because already in schedule (forced target); nat FR vs IFA IL; IFA roster marks local but nat=FR; IFA roster seasons missing from DB: 07/08 |
| 148 | 2027-01-18 | עומר פרץ | FW | 1986 | IL | 06/07-07/08 | confirmed/5 | 7 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: DF · worldfootball: FW; pos FW here vs DF at hapoel-ta |
| 149 | 2027-01-19 | נוסא איגיבור | MF | 1990 | NG | 14/15-16/17 | confirmed/4 | 2 | played 16/17 but name not found in IFA rosters (transliteration?) |
| 150 | 2027-01-20 | טייריס אסאנטה | DF | 2002 | NL | 24/25-25/26 | confirmed/5 | 0 |  |
| 151 | 2027-01-21 | אלכסיי קוסולאפוב | MF | 1971 | RU | 98/99-99/00 | confirmed/4 | 4 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF |
| 152 | 2027-01-22 | יקיר שינה | MF | 1985 | IL | 04/05-12/13 | confirmed/5 | 5 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; DB seasons (2003+) not in IFA roster: 06/07, 07/08, 08/09, 09/10, 10/11, 11/12, 12/13 |
| 153 | 2027-01-23 | קובי רפואה | FW | 1974 | IL | 93/94, 00/01 | confirmed/5 | 3 | IFA roster seasons missing from DB: 02/03 |
| 154 | 2027-01-24 | עמנואל מאיוקה | FW | 1990 | ZM | 08/09-09/10 | confirmed/4 | 2 | played 09/10 but name not found in IFA rosters (transliteration?) |
| 155 | 2027-01-25 | ניבאלדו | DF | 1980 | BR | 10/11-11/12 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 156 | 2027-01-26 | דריק לוקאסן | DF | 1995 | GH | 22/23-23/24 | confirmed/5 | 4 | nat GH vs IFA NL; IFA roster marks local but nat=GH |
| 157 | 2027-01-27 | מרקו בלבול | DF | 1967 | IL | 98/99-99/00 | confirmed/4 | 0 |  |
| 158 | 2027-01-28 | מייקל אמנלו | DF | 1965 | NG | 98/99-99/00 | confirmed/4 | 0 |  |
| 159 | 2027-01-29 | יוסף סורינוב | GK | 1946 | IL | 76/77-77/78 | confirmed/4 | 0 |  |
| 160 | 2027-01-30 | גל ניר | GK | 1983 | IL | 03/04-04/05 | confirmed/5 | 0 |  |
| 161 | 2027-01-31 | מואנס דבור | FW | 1992 | IL | 11/12-13/14 | confirmed/5 | 1 | DB seasons (2003+) not in IFA roster: 13/14 |
| 162 | 2027-02-01 | עומר ורד | DF | 1990 | IL | 11/12-12/13 | confirmed/5 | 0 |  |
| 163 | 2027-02-02 | רועי עמדי | GK | 2004 | IL | 23/24-24/25 | confirmed/3 | 0 |  |
| 164 | 2027-02-03 | ניקולה מיטרוביץ' | MF | 1987 | RS | 13/14-15/16 | confirmed/5 | 2 | IFA roster marks local but nat=RS; DB seasons (2003+) not in IFA roster: 15/16 |
| 165 | 2027-02-04 | איליה יברויאן | FW | 1981 | RU | 08/09-09/10 | confirmed/5 | 2 | audit זהות/שני ערכים באותו שם: בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי |
| 166 | 2027-02-05 | הנרי אדו | FW | 2003 | GH | 24/25-25/26 | confirmed/5 | 14 | audit עמדה/סתירה: מאגר: FW · ויקיפדיה: MF · worldfootball: FW; IFA roster marks local but nat=GH; IFA roster seasons missing from DB: 23/24; DB seasons (2003+) not in IFA roster: 25/26; possible off-by-one season: DB 24/25,25/26 vs IFA 23/24,24/25 |
| 167 | 2027-02-06 | ניר ביטון | MF | 1991 | IL | 22/23-24/25 | confirmed/5 | 5 | audit עמדה/סתירה: מאגר: MF · ויקיפדיה: DF · worldfootball: MF; DB seasons (2003+) not in IFA roster: 24/25 |
| 168 | 2027-02-07 | דן רומן | MF | 1982 | IL | 07/08-08/09 | confirmed/5 | 0 |  |

## Method notes

- Tools run offline: `tools/gaps.mjs`, `hidden.mjs`, `trust.mjs`, `audit.mjs`. None needs network or a browser. Their rewritten tracked files were copied to `fresh/`, then restored with `git checkout -- data/review`.
- IFA cross-check: names matched by `normName` against `data/raw/<slug>-ifa.json` rosters, with born/nationality from `data/raw/ifa-players.json`. Common names (בן ביטון, שמואל לוי) can match a different person.
- IFA rosters (~25 per season) are smaller than DB squads, so "DB season not in IFA roster" alone carries little weight. Only "IFA season missing from DB" and the shift pattern are weighted.
- Seasons are stored by end year (2005 = 04/05). Debut age = (first end-year − 1) − born.
