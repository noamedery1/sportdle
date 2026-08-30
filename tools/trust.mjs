/* ============================================================
   trust.mjs — כמה מקורות בלתי תלויים מאשרים שהשחקן הזה באמת
   שיחק במועדון הזה.

   node tools/trust.mjs              כל המועדונים
   node tools/trust.mjs maccabi-ta   מועדון אחד, עם פירוט למסך

   פלט:
     data/review/trust.md    דוח קריא, מקובץ לפי רמת ביטחון
     data/review/trust.csv   שורה לכל שחקן — נפתח באקסל

   למה זה קיים: ליאור אסולין הופיע במכבי חיפה ארבע עונות, היה
   חידה יומית, ומעולם לא שיחק שם. הוא נכנס על סמך worldfootball
   בלבד, ולא הייתה שום בדיקה ששואלת "יש עוד מישהו שמאשר?".
   מקור אחד יכול לטעות. שניים שמסכימים כבר קשה יותר.

   חמישה מקורות, וכל אחד מהם עונה על אותה שאלה בנפרד:

     ההתאחדות     נרשם בסגל, עונה־עונה. 2002/03 ואילך בלבד.
     worldfootball הופיע בסגל. 1969/70 ואילך, סגלים ישנים חלקיים.
     ויקיפדיה עברית — קטגוריה   מקוטלג ככדורגלן המועדון.
     ויקיפדיה עברית — קריירה    שורת המועדון בתיבת המידע.
     ויקיפדיה אנגלית — קריירה   אותו דבר, וזה מה שמכסה זרים.

   שתי הוויקיפדיות אינן באמת בלתי תלויות — ערך אחד מתורגם
   מהשני — אבל טבלת קריירה נכתבת בכל שפה בנפרד ולעיתים סותרת,
   ולכן הן נספרות בנפרד ומסומנות ככאלה בדוח.
   ============================================================ */
import { readJSON, writeText, writeJSON, loadClubs, normName, normLatin, shortName, season, parseArgs } from "../scripts/lib/util.mjs";
import { plausible, score } from "../scripts/lib/translit.mjs";

const args = parseArgs();
const only = process.argv.slice(2).find(a => !a.startsWith("--")) || null;

const yearsOf = spells => {
  const out = [];
  for (const [a, b] of spells || []) for (let y = a; y <= b; y++) out.push(y);
  return out;
};
const span = spells => (spells || []).map(([a, b]) =>
  a === b ? season(a) : `${season(a)}-${season(b)}`).join(", ");

const rows = [];
const stats = [];

for (const club of loadClubs()) {
  if (only && club.slug !== only) continue;
  const db = readJSON(`data/clubs/${club.slug}.json`, null);
  if (!db) continue;

  /* ---------- 1. ההתאחדות ---------- */
  const ifaByKey = new Map(), idByName = new Map();
  const ifaRaw = readJSON(`data/raw/${club.slug}-ifa.json`, null);
  for (const [y, list] of Object.entries(ifaRaw?.seasons || {}))
    for (const p of list) {
      const key = p.id || normName(p.full);
      if (!ifaByKey.has(key)) ifaByKey.set(key, []);
      ifaByKey.get(key).push(+y);
      for (const n of [p.short, p.full]) {
        if (!n) continue;
        if (p.id) idByName.set(normName(n), p.id);
        if (!ifaByKey.has(normName(n))) ifaByKey.set(normName(n), ifaByKey.get(key));
      }
    }

  /* התאחדות — התאמת קידומת מילים.
     המאגר של בית"ר כותב "קלאודמיר", וההתאחדות "קלאודמיר דה סילבה".
     זה אותו אדם, וההתאמה המדויקת מפספסת אותו. הקידומת אינה דמיון
     מחרוזות: היא שוויון מדויק על **מילים שלמות**, ומתקבלת רק כשיש
     מועמד יחיד בכל המועדון וגם חפיפת עונות. שני התנאים יחד. */
  const ifaFull = [];
  for (const [y, list] of Object.entries(ifaRaw?.seasons || {}))
    for (const p of list) {
      const key = p.id || normName(p.full);
      let rec = ifaFull.find(r => r.key === key);
      if (!rec) ifaFull.push(rec = { key, names: new Set(), years: [] });
      rec.years.push(+y);
      for (const n of [p.short, p.full]) if (n) rec.names.add(normName(n));
    }
  const ifaByPrefix = (name, mySeasons) => {
    const words = normName(name).split(" ").filter(Boolean);
    if (words.length < 2) return null;
    const pre = words.join(" ") + " ";
    const hits = ifaFull.filter(r =>
      [...r.names].some(n => n.startsWith(pre)) &&
      r.years.some(y => mySeasons.has(y)));
    return hits.length === 1 ? hits[0].years : null;
  };

  /* ---------- 2. worldfootball ---------- */
  const wfByName = new Map(), wfRecs = new Map();
  const wfRaw = readJSON(`data/raw/${club.slug}-worldfootball.json`, null);
  for (const [y, list] of Object.entries(wfRaw?.seasons || {}))
    for (const p of list) {
      if (!p.name) continue;
      const k = normLatin(p.name);
      if (!wfByName.has(k)) { wfByName.set(k, []); wfRecs.set(k, { name: p.name, born: p.born ?? null, years: [] }); }
      wfByName.get(k).push(+y);
      wfRecs.get(k).years.push(+y);
      if (wfRecs.get(k).born == null && p.born) wfRecs.get(k).born = p.born;
    }

  /* אישור מ-worldfootball גם בלי גשר בין־לשוני.
     "אפרים דוידי" מופיע שם כ-"Efraim Davidi" בשתים־עשרה עונות
     רצופות, ובכל זאת נספר כ"מקור יחיד" — כי לרשומה העברית אין
     שם לטיני ולא נמצא קישור בוויקיפדיה. זה לא חוסר במקור, זה
     חוסר בגשר.

     שלושה תנאים, ורק לספירה — שום נתון לא נכנס מכאן למאגר:
     שנת לידה זהה (או חסרה בצד אחד), חפיפת עונות, ושם שעובר את
     מסנן הדחייה של scripts/lib/translit.mjs. מועמד יחיד בלבד. */
  const wfLoose = (he, born, mySeasons) => {
    const hits = [];
    for (const [k, r] of wfRecs) {
      if (born != null && r.born != null && born !== r.born) continue;
      if (!r.years.some(y => mySeasons.has(y))) continue;
      if (!plausible(he, r.name).ok) continue;
      hits.push({ r, s: score(he, r.name) });
    }
    if (!hits.length) return null;
    /* כשיותר מאחד עובר את המסנן, מכריע הציון הסימטרי — ורק אם
       הוא מוביל בבירור. "דוד דגו" מול David Dego (0.92) ומול
       David Houja (0.83), שניהם ילידי 2001 באותן עונות. בלי
       הדירוג שניהם היו נפסלים כדו-משמעיים, והשחקן היה נשאר
       "מקור יחיד" בזמן ש-worldfootball מכיר אותו בשלוש עונות. */
    hits.sort((x, y) => y.s - x.s);
    if (hits.length > 1 && hits[0].s - hits[1].s < 0.08) return null;
    return hits[0].s >= 0.8 ? hits[0].r : null;
  };

  /* ---------- 3. Transfermarkt: סגל לפי עונה ----------
     אין בו שנת לידה בדף הסגל, ולכן ההתאמה נשענת על שם וחפיפת
     עונות בלבד — ובגלל זה היא נשענת גם על מסנן התעתיק ועל
     דירוג, בדיוק כמו מול worldfootball. */
  const tmRecs = new Map();
  const tmRaw = readJSON(`data/raw/${club.slug}-transfermarkt.json`, null);
  for (const [y, list] of Object.entries(tmRaw?.seasons || {}))
    for (const p of list) {
      if (!p.name) continue;
      const k = normLatin(p.name);
      if (!tmRecs.has(k)) tmRecs.set(k, { name: p.name, years: [] });
      tmRecs.get(k).years.push(+y);
    }
  const tmFind = (he, latinKeys, mySeasons) => {
    for (const k of latinKeys) {
      const r = tmRecs.get(k);
      if (r && r.years.some(y => mySeasons.has(y))) return r;
    }
    const hits = [];
    for (const [, r] of tmRecs) {
      if (!r.years.some(y => mySeasons.has(y))) continue;
      if (!plausible(he, r.name).ok) continue;
      hits.push({ r, s: score(he, r.name) });
    }
    if (!hits.length) return null;
    hits.sort((x, y) => y.s - x.s);
    if (hits.length > 1 && hits[0].s - hits[1].s < 0.08) return null;
    return hits[0].s >= 0.8 ? hits[0].r : null;
  };

  /* ---------- 4. קטגוריית ויקיפדיה ---------- */
  const cat = new Set();
  const catRaw = readJSON(`data/raw/${club.slug}-wikipedia.json`, null);
  for (const e of catRaw?.entries || [])
    for (const n of [e.title, e.name, e.short].filter(Boolean))
      { cat.add(normName(n)); cat.add(normName(shortName(n))); }

  /* ---------- 4. טבלת קריירה עברית ---------- */
  const wcByName = new Map();
  const wcRaw = readJSON(`data/raw/${club.slug}-wikicareer.json`, null);
  for (const d of wcRaw?.details || [])
    for (const k of [normName(d.title), normName(d.name), normName(shortName(d.name))])
      if (!wcByName.has(k)) wcByName.set(k, d);

  /* ---------- גשר לשם הלטיני ----------
     בלעדיו רוני רוזנטל ואייל ברקוביץ' נספרים כ"מקור יחיד":
     worldfootball והערך האנגלי מכירים אותם היטב, אבל הרשומה
     העברית לא מחזיקה שם לטיני ולכן אין במה לחפש. הקישור
     הבין־לשוני של ויקיפדיה הוא בדיוק המפתח הזה. */
  const heToEn = new Map();
  for (const src of ["wikilang", "enbridge"]) {
    const j = readJSON(`data/raw/${club.slug}-${src}.json`, null);
    for (const l of j?.links || []) {
      if (!l.he || !l.en) continue;
      for (const k of [normName(l.he), normName(shortName(l.he))])
        if (!heToEn.has(k)) heToEn.set(k, l.en);
    }
  }

  /* ---------- 5. טבלת קריירה אנגלית ---------- */
  const enByName = new Map();
  const enRaw = readJSON(`data/raw/${club.slug}-enwikicareer.json`, null);
  for (const d of enRaw?.details || [])
    for (const n of [d.title, d.askedAs].filter(Boolean))
      if (!enByName.has(normLatin(n))) enByName.set(normLatin(n), d);

  /* ---------- 6. הגרסה שבייצור (בית"ר בלבד) ----------
     data/raw/beitar-reference.json הוא המאגר שרץ בביתרדל, והוא
     מקור בפני עצמו: הוא נבנה ביד, אומת מול האתר החי, ו-119 חידות
     שפורסמו ממנו עברו תחת עיני אוהדים. בלעדיו 83 שחקני בית"ר
     נראים כמי שאין להם מקור, בעוד שבפועל יש להם את המקור
     האנושי היחיד במאגר כולו. */
  const refNames = new Set();
  const refRaw = readJSON(`data/raw/${club.slug}-reference.json`, null);
  for (const p of refRaw?.players || [])
    for (const n of [p.he, p.name].filter(Boolean))
      { refNames.add(normName(n)); refNames.add(normName(shortName(n))); }

  /* ---------- מעבר על השחקנים ---------- */
  const found = [];
  for (const p of db.players) {
    const keys   = [p.he, ...(p.aliases || [])].filter(Boolean);
    const heKeys = keys.flatMap(n => [normName(n), normName(shortName(n))]);
    const bridged = heKeys.map(k => heToEn.get(k)).filter(Boolean);
    const latin  = [...new Set([...keys.filter(n => /[A-Za-z]/.test(n)), ...bridged]
                     .map(normLatin))];
    const id     = keys.map(n => idByName.get(normName(n))).find(Boolean) || null;

    const mySeasons = new Set(yearsOf(p.spells));
    let ifaYears = id ? (ifaByKey.get(id) || [])
                      : (heKeys.map(k => ifaByKey.get(k)).find(Boolean) || []);
    if (!ifaYears.length) ifaYears = ifaByPrefix(p.he, mySeasons) || [];
    let wfYears  = latin.map(k => wfByName.get(k)).find(Boolean) || [];
    let wfVia = wfYears.length ? "שם" : null;
    if (!wfYears.length) {
      const loose = wfLoose(p.he, p.born, new Set(yearsOf(p.spells)));
      if (loose) { wfYears = loose.years; wfVia = "תעתיק+לידה+עונות"; }
    }
    const tm       = tmFind(p.he, latin, new Set(yearsOf(p.spells)));
    const inCat    = heKeys.some(k => cat.has(k));
    const wc       = heKeys.map(k => wcByName.get(k)).find(Boolean) || null;
    const en       = latin.map(k => enByName.get(k)).find(Boolean) || null;

    const src = {
      ifa:  ifaYears.length > 0,
      wf:   wfYears.length > 0,
      cat:  inCat,
      wiki: !!wc,
      en:   !!en && en.atClub,
      ref:  heKeys.some(k => refNames.has(k)),
      tm:   !!tm
    };
    /* ויקיפדיה נספרת פעם אחת: קטגוריה וטבלה הן אותו ערך */
    const heWiki = src.cat || src.wiki;
    const n = (src.ifa ? 1 : 0) + (src.wf ? 1 : 0) + (heWiki ? 1 : 0) +
              (src.en ? 1 : 0) + (src.ref ? 1 : 0) + (src.tm ? 1 : 0);

    /* סתירה מפורשת: הערך האנגלי קיים, מפרט קריירה, ואין בו
       המועדון שלנו. זה מה שהיה קורה עם אסולין. */
    const denied = !!en && !en.atClub && (en.allClubs || []).length > 0;

    let level;
    if (denied && n <= 1)          level = "סותר";
    else if (n >= 2)               level = "מאושר";
    else if (n === 1)              level = "מקור יחיד";
    else                           level = "בלי מקור";

    /* לא כל "מקור יחיד" שווה. ההתאחדות רושמת מי **נרשם בסגל** של
       המועדון — זו הסמכות הישירה על השאלה, וקשה לטעות בה. אצל
       worldfootball השיוך הוא של אתר זר לסגל של לפני עשרים שנה,
       ובדיוק שם נולדו שתי הטעויות שנמצאו: ליאור אסולין במכבי
       חיפה, ורומן פץ שנשא את הקריירה של מאיר מליקה במכבי ת"א. */
    const risk =
      level === "מאושר"     ? "" :
      level === "סותר"      ? "גבוה" :
      level === "בלי מקור"  ? "גבוה" :
      src.wf                ? "גבוה" :
      src.ifa || src.ref || src.tm ? "נמוך" : "בינוני";

    found.push({
      slug: club.slug, game: db.game, he: p.he, id,
      pos: p.pos, nat: p.nat, born: p.born, seasons: p.seasons, titles: p.titles,
      span: span(p.spells), target: p.target,
      inSchedule: db.schedule.indexOf(p.he) + 1,
      n, level, denied, risk,
      src: [src.ifa && "התאחדות", src.wf && ("worldfootball" + (wfVia === "שם" ? "" : " (גשר תעתיק)")),
            src.cat && "קטגוריה", src.wiki && "קריירה-עברית",
            src.en && "קריירה-אנגלית",
            src.ref && "הגרסה שבייצור",
            src.tm && "Transfermarkt"].filter(Boolean).join(" · "),
      enClubs: en && !en.atClub ? (en.allClubs || []).slice(0, 6).join(" / ") : ""
    });
  }

  const by = l => found.filter(f => f.level === l);
  const risky = found.filter(f => f.target && (f.level === "מקור יחיד" || f.level === "סותר"));
  stats.push({
    game: db.game, slug: club.slug, players: found.length,
    ok: by("מאושר").length, one: by("מקור יחיד").length,
    none: by("בלי מקור").length, denied: by("סותר").length,
    riskyTargets: risky.length,
    riskyPublished: risky.filter(f => f.inSchedule > 0).length
  });
  rows.push(...found);

  if (only) {
    console.log(`\n── ${db.game}: תשובות על מקור יחיד או סתירה ──\n`);
    for (const f of risky.sort((a, b) => b.seasons - a.seasons))
      console.log(`  ${f.level.padEnd(10)} ${f.he.padEnd(22)} ${f.span.padEnd(18)} ` +
                  `${String(f.seasons).padStart(2)} עונות · ${f.src}` +
                  (f.inSchedule > 0 ? `  ← חידה #${f.inSchedule}` : "") +
                  (f.enClubs ? `\n${" ".repeat(14)}באנגלית רשום: ${f.enClubs}` : ""));
  }
}

/* ---------- רשימת הלא-מאושרים, למי שבונה ----------
   מה שאין עליו שני מקורות לא מוצג במשחק: לא כתשובה ולא
   כניחוש. שורת השוואה על נתון שאיש לא מאשר גרועה מהיעדר
   השחקן — היא נראית סמכותית והיא עלולה להיות שגויה.
   הרשומה נשארת במאגר; רק המשחק לא מציג אותה. */
writeJSON("data/review/unconfirmed.json", {
  _comment: "שחקנים בלי אישור משני. build.mjs מסנן אותם מהמשחק. " +
            "נוצר על ידי `node tools/trust.mjs`.",
  generated: rows.length,
  clubs: Object.fromEntries([...new Set(rows.map(r => r.slug))].map(slug =>
    [slug, rows.filter(r => r.slug === slug && r.level !== "מאושר")
             .map(r => r.he).sort((a, b) => a.localeCompare(b, "he"))]))
});

/* ---------- קבצים ---------- */
const esc = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
const CSV = [["מועדון", "שם", "מפתח", "רמה", "סיכון", "מקורות", "כמה", "עמדה", "לאום",
              "לידה", "עונות", "תקופה", "תארים", "בבריכה", "חידה מספר",
              "מועדונים בערך האנגלי"]];
for (const f of rows)
  CSV.push([f.game, f.he, f.id ?? "", f.level, f.risk, f.src, f.n, f.pos ?? "", f.nat ?? "",
            f.born ?? "", f.seasons, f.span, f.titles, f.target ? "כן" : "",
            f.inSchedule > 0 ? f.inSchedule : "", f.enClubs]);
writeText("data/review/trust.csv",
  "﻿" + CSV.map(r => r.map(esc).join(",")).join("\r\n") + "\r\n");

const out = [];
out.push("# כמה מקורות מאשרים כל שחקן");
out.push("");
out.push("השאלה היחידה כאן: האם השחקן הזה באמת שיחק במועדון הזה.");
out.push("ליאור אסולין הופיע במכבי חיפה ארבע עונות, היה חידה יומית,");
out.push("ומעולם לא שיחק שם — הוא נכנס על סמך worldfootball בלבד.");
out.push("");
out.push("| רמה | פירושה |");
out.push("|---|---|");
out.push("| **מאושר** | שני מקורות בלתי תלויים ומעלה |");
out.push("| **מקור יחיד** | מקור אחד. לא בהכרח שגוי — אבל אין מי שיאשר |");
out.push("| **סותר** | לערך האנגלי יש טבלת קריירה, והמועדון שלנו לא בה |");
out.push("| **בלי מקור** | לא נמצא באף מקור. תקלת שיוך |");
out.push("");
const urgent = rows.filter(f => f.risk === "גבוה");
out.push("## מה שדורש בדיקה עכשיו");
out.push("");
out.push("סיכון גבוה: המקור היחיד הוא worldfootball, או שאין מקור, או");
out.push("שהערך האנגלי סותר. שתי הטעויות שנמצאו עד היום — ליאור אסולין");
out.push("ורומן פץ — היו בדיוק כאן.");
out.push("");
if (!urgent.length) out.push("אין. כל שחקן נשען על ההתאחדות, על ויקיפדיה, או על שניהם.");
else {
  out.push("| מועדון | שם | תקופה | עונות | מקורות | בבריכה | חידה | מועדונים בערך האנגלי |");
  out.push("|---|---|---|---|---|---|---|---|");
  for (const f of urgent.sort((a, b) => (b.target - a.target) || b.seasons - a.seasons))
    out.push(`| ${f.game} | ${f.he} | ${f.span} | ${f.seasons} | ${f.src || "—"} | ` +
             `${f.target ? "**כן**" : ""} | ${f.inSchedule > 0 ? "#" + f.inSchedule : ""} | ${f.enClubs} |`);
}
out.push("");
out.push("| מועדון | שחקנים | מאושר | מקור יחיד | סותר | בלי מקור | בבריכה בסיכון | מהם כבר פורסמו |");
out.push("|---|---|---|---|---|---|---|---|");
for (const s of stats)
  out.push(`| ${s.game} | ${s.players} | ${s.ok} | ${s.one} | **${s.denied}** | ${s.none} | ` +
           `**${s.riskyTargets}** | ${s.riskyPublished} |`);
out.push("");

for (const s of stats) {
  const mine = rows.filter(f => f.slug === s.slug);
  for (const [level, title] of [["סותר", "סותר — הערך האנגלי אומר שהוא לא שיחק כאן"],
                                ["בלי מקור", "בלי מקור"],
                                ["מקור יחיד", "מקור יחיד — בבריכת התשובות"]]) {
    let list = mine.filter(f => f.level === level);
    if (level === "מקור יחיד") list = list.filter(f => f.target);
    if (!list.length) continue;
    list.sort((a, b) => (b.inSchedule > 0) - (a.inSchedule > 0) || b.seasons - a.seasons);
    out.push(`## ${s.game} — ${title} (${list.length})`);
    out.push("");
    out.push("| שם | תקופה | עונות | מקורות | חידה | מועדונים בערך האנגלי |");
    out.push("|---|---|---|---|---|---|");
    for (const f of list)
      out.push(`| ${f.he} | ${f.span} | ${f.seasons} | ${f.src || "—"} | ` +
               `${f.inSchedule > 0 ? "#" + f.inSchedule : ""} | ${f.enClubs} |`);
    out.push("");
  }
}
writeText("data/review/trust.md", out.join("\n") + "\n");

/* ---------- מסך ---------- */
const pad = (s, n) => String(s).padEnd(n), num = (s, n) => String(s).padStart(n);
console.log(`\n${pad("מועדון", 14)} ${num("שחקנים", 7)} ${num("מאושר", 6)} ${num("יחיד", 5)} ` +
            `${num("סותר", 5)} ${num("ללא", 4)} ${num("בבריכה בסיכון", 14)} ${num("פורסמו", 7)}`);
console.log("-".repeat(70));
for (const s of stats)
  console.log(`${pad(s.game, 14)} ${num(s.players, 7)} ${num(s.ok, 6)} ${num(s.one, 5)} ` +
              `${num(s.denied, 5)} ${num(s.none, 4)} ${num(s.riskyTargets, 14)} ${num(s.riskyPublished, 7)}`);
console.log("\nנכתבו data/review/trust.md ו-data/review/trust.csv");
