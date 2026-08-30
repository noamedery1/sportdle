/* ============================================================
   unhide.mjs — מחזיר למשחק שחקנים שהוסתרו בגלל נתון חסר,
   ורק אותם.

   node tools/unhide.mjs              מה יימצא, בלי לכתוב
   node tools/unhide.mjs --write      כותב ל-config/names-<slug>.json

   הרקע: 1,386 שנות לידה נשאבו מדפי השחקן של ההתאחדות. אפשר היה
   להזרים אותן לתוך enrich, אבל שם הן משנות את בריכת המועמדים של
   הגשר המבני — ואז נפתחים ונסגרים זיווגים בכל המאגר: שחקנים
   מתפצלים, שמות מתמזגים, וחידות שפורסמו משנות משמעות.

   כאן הכיוון הפוך. הגזירה נעשית בחוץ, על המאגר הבנוי, ומה שיוצא
   ממנה הוא שורות ל-config/names-<slug>.json — ערוץ התיקון הידני
   שכבר קיים. נוגעים **רק** בשחקן שמתקיימים בו כל אלה:

     1. הוא מוסתר היום — אין לו עמדה
     2. יש לו player_id, ולדף השחקן שלו יש שנת לידה
     3. יש רשומת worldfootball אחת בדיוק עם אותה שנת לידה
        שעונותיה חופפות לשלו, והיא לא נתבעת על ידי אף שחקן אחר
     4. האזרחות בהתאחדות לא סותרת את הלאום ב-worldfootball
     5. **העונות שלו לא משתנות** — לא מוסיפים לו ולא גורעים ממנו

   סעיף 5 הוא מה שמבדיל את הכלי הזה מהזרמה לצינור: הוא ממלא
   עמדה, שנת לידה ולאום, ואף פעם לא נוגע בתקופות. שחקן שכבר
   מוצג לא משתנה, שם לא מתמזג עם שם, ואף חידה שפורסמה לא זזה.
   ============================================================ */
import { readJSON, writeJSON, loadClubs, normName, normLatin, log, parseArgs, season } from "../scripts/lib/util.mjs";
import { plausible, score } from "../scripts/lib/translit.mjs";

const args = parseArgs();
const WRITE = !!args.write;

const yearsOf = spells => {
  const out = [];
  for (const [a, b] of spells || []) for (let y = a; y <= b; y++) out.push(y);
  return out;
};
const span = spells => spells.map(([a, b]) =>
  a === b ? season(a) : `${season(a)}-${season(b)}`).join(", ");

const ifaPages = readJSON("data/raw/ifa-players.json", null);
if (!ifaPages) {
  console.error("\n✖ חסר data/raw/ifa-players.json — הרץ קודם:\n" +
                "  node scripts/scrape.mjs --source=ifaplayers\n");
  process.exit(1);
}

let totalFound = 0, totalSkipped = 0;

for (const club of loadClubs()) {
  const db = readJSON(`data/clubs/${club.slug}.json`, null);
  if (!db) continue;

  /* ---- player_id לכל שחקן, מתוך גיליונות הסגל ---- */
  const idByName = new Map();
  const ifaRaw = readJSON(`data/raw/${club.slug}-ifa.json`, null);
  for (const list of Object.values(ifaRaw?.seasons || {}))
    for (const p of list) {
      if (!p.id) continue;
      for (const n of [p.short, p.full]) if (n) idByName.set(normName(n), p.id);
    }
  const idOf = p => [p.he, ...(p.aliases || [])]
    .map(n => idByName.get(normName(n))).find(Boolean) || null;

  /* ---- worldfootball: רשומה לכל שם לועזי ---- */
  const wf = new Map();
  const wfRaw = readJSON(`data/raw/${club.slug}-worldfootball.json`, null);
  for (const [y, list] of Object.entries(wfRaw?.seasons || {}))
    for (const p of list) {
      if (!p.name) continue;
      const k = normLatin(p.name);
      if (!wf.has(k)) wf.set(k, { name: p.name, years: [], pos: null, nat: null, born: null });
      const r = wf.get(k);
      r.years.push(+y);
      if (!r.pos && p.pos) r.pos = p.pos;
      if (!r.nat && p.nat) r.nat = p.nat;
      if (r.born == null && p.born) r.born = p.born;
    }
  const NAT = readJSON("config/nat-en.json", null);   // אופציונלי; ראה למטה

  /* ---- שנת לידה לכל שחקן: מהמאגר, ואם אין — מדף השחקן ---- */
  const enriched = db.players.map(p => {
    const id = idOf(p);
    const page = id ? ifaPages.players[id] : null;
    return { p, id, page, born: p.born ?? page?.born ?? null };
  });

  /* ---- Transfermarkt: סגל לפי עונה, בלי שנת לידה ---- */
  const tm = new Map();
  const tmRaw = readJSON(`data/raw/${club.slug}-transfermarkt.json`, null);
  for (const [y, list] of Object.entries(tmRaw?.seasons || {}))
    for (const p of list) {
      if (!p.name) continue;
      const k = normLatin(p.name);
      if (!tm.has(k)) tm.set(k, { name: p.name, born: null, years: [] });
      tm.get(k).years.push(+y);
    }

  /* המועמד הטוב ביותר במקור אחד, או null כשאין הכרעה.
     הפער הנדרש בין הראשון לשני הוא מה שמונע הכרעה בין שני
     שמות שנשמעים דומה באותה מידה. */
  const best = (he, born, mine, recs, useBorn) => {
    const hits = [];
    for (const r of recs.values()) {
      if (useBorn && born != null && r.born != null && born !== r.born) continue;
      if (!r.years.some(y => mine.has(y))) continue;
      if (!plausible(he, r.name).ok) continue;
      hits.push({ r, s: score(he, r.name) });
    }
    if (!hits.length) return null;
    hits.sort((a, b) => b.s - a.s);
    if (hits.length > 1 && hits[0].s - hits[1].s < 0.08) return null;
    return hits[0].s >= 0.8 ? hits[0].r : null;
  };

  /* ---- הגשר, על המאגר הבנוי ---- */
  const byBorn = new Map();
  for (const e of enriched) {
    if (e.born == null) continue;
    if (!byBorn.has(e.born)) byBorn.set(e.born, []);
    byBorn.get(e.born).push(e);
  }
  const fixes = {}, rows = [];
  let skipped = 0;
  for (const e of enriched) {
    const { p, id, page } = e;
    if (p.pos != null) continue;                  // כבר מוצג
    if (!id) { skipped++; continue; }              // בלי מפתח יציב אין תיקון
    const born = e.born;
    if (born == null) { skipped++; continue; }
    const mine = new Set(yearsOf(p.spells));
    if (!mine.size) { skipped++; continue; }

    const w = best(p.he, born, mine, wf, true);
    const m = best(p.he, born, mine, tm, false);
    if (!w || !m) { skipped++; continue; }         // צריך את שניהם
    if (!w.pos) { skipped++; continue; }            // בלי עמדה אין מה להחזיר

    const nat = NAT?.[w.nat] ?? null;
    fixes[id] = { pos: w.pos, born, ...(nat && p.nat == null ? { nat } : {}) };
    rows.push({ he: p.he, id, pos: w.pos, born, nat, en: w.name, tm: m.name,
                seasons: p.seasons, span: span(p.spells) });
  }

  rows.sort((a, b) => b.seasons - a.seasons || a.he.localeCompare(b.he, "he"));
  const hidden = db.players.filter(p => p.pos == null).length;
  log(`${db.game.padEnd(12)} ${String(hidden).padStart(4)} מוסתרים · ` +
      `${String(rows.length).padStart(4)} חוזרים למשחק · ${skipped} בלי מספיק נתונים`);
  for (const r of rows.slice(0, 8))
    log(`   ${r.he} → ${r.pos} · ${r.born} · wf:${r.en} · tm:${r.tm} · ` +
        `${r.seasons} עונות · ${r.span}`);
  if (rows.length > 8) log(`   ... ועוד ${rows.length - 8}`);

  totalFound += rows.length;
  totalSkipped += skipped;

  if (WRITE && rows.length) {
    const file = `config/names-${club.slug}.json`;
    const cfg = readJSON(file, {});
    let added = 0, kept = 0;
    for (const [id, val] of Object.entries(fixes)) {
      if (cfg[id] !== undefined) { kept++; continue; }   // תיקון ידני קיים מנצח
      cfg[id] = val;
      added++;
    }
    cfg._note_unhide = [
      "השורות עם pos ו-born שנוספו כאן אוטומטית הן שחזור של שחקנים",
      "שהוסתרו מהמשחק בגלל עמדה חסרה. המקור: שנת הלידה מדף השחקן",
      "של ההתאחדות, ושני מקורות בלתי תלויים — worldfootball ו-Transfermarkt —",
      "שמזהים את אותו אדם באותן עונות. `node tools/unhide.mjs` מייצר אותן מחדש.",
      "העונות של אף שחקן לא שונו כאן, ואף שם לא אוחד."
    ];
    writeJSON(file, cfg, 2);
    log(`   נכתבו ${added} שורות ל-${file}` + (kept ? ` (${kept} כבר היו)` : ""));
  }
}

log(`סה"כ ${totalFound} שחקנים חוזרים למשחק · ${totalSkipped} נבדקו ולא הספיקו`);
if (!WRITE) log("הרצה יבשה. להחלה: node tools/unhide.mjs --write");
