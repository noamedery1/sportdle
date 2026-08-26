/* ============================================================
   reports-apply.mjs — מהתור בגיליון אל config/names-<slug>.json

   node tools/reports-apply.mjs [--dry] [--min=3] [--max=5]

   סביבה:
     REPORTS_URL     כתובת ה-/exec של Apps Script
     REPORTS_TOKEN   הטוקן שמאפשר לקרוא את התור
     SUMMARY_OUT     לאן לכתוב סיכום markdown (ברירת מחדל: זמני)

   ------------------------------------------------------------
   למה אין כאן מודל שפה

   התור מכיל רק שדות מוקלדים: מועדון, שחקן, שדה, ערך מוצע. אין בו
   טקסט חופשי, ולכן אין מה לפרש — יש מה לאמת. אימות מול enum הוא
   ודאי; פרשנות של טקסט אינה. טקסט חופשי מהמשחק הולך למייל, ואדם
   קורא אותו.

   מה שמונע כתיבה שגויה, בסדר הזה:
     1. כל שורה נבדקת מול המאגר עצמו — השחקן חייב להתקיים, והערך
        הקיים בשורה חייב להיות זהה למה שבמאגר עכשיו. דיווח על מצב
        שכבר השתנה נדחה, ולא דורס תיקון חדש יותר.
     2. שדה חייב להיות he או pos. עמדה חייבת להיות מתוך ארבע.
        שם חייב לעבור ביטוי רגולרי של עברית בלבד.
     3. שם מוצע שתפוס בידי שחקן אחר נדחה — אחרת הבנייה תיפול על
        בדיקת הכפילות, אחרי שהקובץ כבר נכתב.
     4. צריך MIN_REPORTERS מדווחים נפרדים לאותו תיקון בדיוק.
     5. לכל היותר MAX_PER_RUN תיקונים בריצה.
     6. הקובץ היחיד שנכתב הוא config/names-<slug>.json. את זה אוכף
        tools/reports-guard.mjs, כי הבטחה בתיעוד אינה אכיפה.
     7. שום דבר לא מתמזג בלי אישור אדם — הריצה פותחת PR.
   ============================================================ */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));

const DRY            = !!args.dry;
const MIN_REPORTERS  = Number(args.min || process.env.MIN_REPORTERS || 3);
const MAX_PER_RUN    = Number(args.max || process.env.MAX_PER_RUN   || 5);
const LEDGER         = "data/review/reports-seen.json";
const FIELDS         = ["he", "pos"];
const POSES          = ["GK", "DF", "MF", "FW"];
const HE_NAME        = /^[א-ת][א-ת ׳״'"’־-]{0,38}[א-ת]$/;

const log  = m => console.log(m);

/* הכישלון נכתב גם לסיכום הריצה, לא רק ללוג. מייל הכישלון של גיטהאב
   מקשר לעמוד הריצה, והסיכום הוא מה שנראה שם בלי לפתוח לוגים. */
const die  = m => {
  console.error("✖ " + m);
  const sum = process.env.GITHUB_STEP_SUMMARY;
  if (sum) {
    try { appendFileSync(sum, ["### ✖ הצינור נעצר", "", "```", m, "```", ""].join("\n")); }
    catch { /* אין סיכום — הלוג עדיין קיים */ }
  }
  process.exit(1);
};

/* נרמול זהה לזה של המנוע ושל scripts/lib/util.mjs — מקף לרווח,
   בלי גרשיים, רווחים מכווצים. חייב להיות זהה, אחרת "אותו שם"
   כאן ו"אותו שם" בבנייה הם שני דברים. */
const norm = t => String(t)
  .replace(/[-־–—]/g, " ")
  .replace(/['"״׳’]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const readJSON  = (p, dflt) => existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : dflt;
const writeJSON = (p, o) => {
  const dir = p.slice(0, p.lastIndexOf("/"));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(p, JSON.stringify(o, null, 2) + "\n");
};

/* ============================================================
   1. שליפת התור
   ============================================================ */
const URL_  = process.env.REPORTS_URL;
const TOKEN = process.env.REPORTS_TOKEN;
if (!URL_ || !TOKEN) die("חסר REPORTS_URL או REPORTS_TOKEN בסביבה.");

/* כשהשליפה נכשלת, ההודעה חייבת להגיד *מה לתקן*. מייל "run failed"
   בלי זה שולח אותך לחפש בלוגים, ואת מה שאי אפשר לאבחן מהמייל
   מפסיקים לאבחן. TROUBLE ממופה לפי התשובה שהשרת מחזיר בפועל. */
const TROUBLE = {
  "אין הרשאה":
    "השרת דחה את הטוקן.\n" +
    "    הסוד REPORTS_TOKEN בגיטהאב (Settings → Secrets → Actions) אינו זהה\n" +
    "    ל-Script property בשם REPORTS_TOKEN ב-Apps Script, או שהוא קצר מ-16 תווים.\n" +
    `    אורך הטוקן שנשלח מכאן: ${TOKEN.length} תווים.\n` +
    "    צריך להיות תו-בתו זהה — רווח מוביל או שורה חדשה בהדבקה נחשבים הבדל."
};

/* גם תקלת רשת היא תשובה. בלי try, כישלון fetch הוא stack trace. */
let res;
try {
  res = await fetch(`${URL_}?fn=fixes&token=${encodeURIComponent(TOKEN)}`, {
    redirect: "follow", headers: { "User-Agent": "sportdle-reports/1" }
  });
} catch (e) {
  die(`השליפה נכשלה ברשת: ${e.message}\n` +
      "    בדוק שהסוד REPORTS_URL הוא כתובת ה-/exec המלאה של Apps Script.");
}
if (!res.ok) die(`השרת החזיר ${res.status}. כתובת /exec לא תקינה, או שהפריסה של Apps Script לא פעילה.`);

const raw = await res.text();
let payload = null;
try { payload = JSON.parse(raw); } catch { /* לא JSON — מטופל מיד */ }

if (!payload)
  die("השרת לא החזיר JSON. כנראה שהפריסה של Apps Script אינה פתוחה ל-Anyone,\n" +
      "    ומה שחזר הוא דף התחברות של גוגל.\n" +
      `    150 התווים הראשונים: ${raw.slice(0, 150).replace(/\s+/g, " ")}`);

if (payload.ok !== true)
  die((TROUBLE[payload.error] || `השרת השיב: ${JSON.stringify(payload)}`));

if (!Array.isArray(payload.rows))
  die("התשובה בלי שדה rows. כנראה שהפריסה של Apps Script היא גרסה ישנה —\n" +
      "    Deploy → Manage deployments → Edit → Version: New.");

const rows = payload.rows;
log(`התור: ${rows.length} שורות ממתינות`);
if (!rows.length) { log("אין מה לעשות."); process.exit(0); }

/* ============================================================
   2. אימות שורה־שורה מול המאגר
   ============================================================ */
/* clubs.json הוא אובייקט לפי slug, ומפתחות שמתחילים בקו תחתון הם
   תיעוד ומקורות — לא מועדונים. */
const clubsCfg = readJSON("config/clubs.json", null);
if (!clubsCfg) die("חסר config/clubs.json");
const KNOWN = new Set(Object.keys(clubsCfg).filter(k => !k.startsWith("_")));
if (!KNOWN.size) die("לא נמצא אף מועדון ב-config/clubs.json");

const ledger = readJSON(LEDGER, { applied: {}, rejected: {} });
ledger.applied  = ledger.applied  || {};
ledger.rejected = ledger.rejected || {};

const clubData = new Map();
function club(slug) {
  if (!clubData.has(slug)) clubData.set(slug, readJSON(`data/clubs/${slug}.json`, null));
  return clubData.get(slug);
}

/* הערך שבמאגר עכשיו, אחרי כל הדריסות — זה מה שהמדווח ראה */
function playerOf(slug, name) {
  const d = club(slug);
  if (!d) return null;
  const k = norm(name);
  return d.players.find(p => norm(p.he) === k) || null;
}

const valid = [], dropped = [];
const drop = (r, why) => dropped.push({ row: r.row, why, r });

for (const r of rows) {
  if (ledger.rejected[r.row])                   { drop(r, "נדחתה בריצה קודמת"); continue; }
  if (!KNOWN.has(r.club))                       { drop(r, "מועדון לא מוכר"); continue; }
  if (!FIELDS.includes(r.field))                { drop(r, "שדה לא מוכר"); continue; }
  if (!club(r.club))                            { drop(r, "אין קובץ מועדון"); continue; }

  const p = playerOf(r.club, r.player);
  if (!p)                                       { drop(r, "השחקן לא קיים במאגר"); continue; }

  if (r.field === "pos") {
    if (!POSES.includes(r.proposed))            { drop(r, "עמדה לא מוכרת"); continue; }
    if ((p.pos || "") !== r.current)            { drop(r, `הדיווח על "${r.current}" והמאגר על "${p.pos}"`); continue; }
    if (p.pos === r.proposed)                   { drop(r, "אין שינוי"); continue; }
  } else {
    if (!HE_NAME.test(r.proposed))              { drop(r, "השם המוצע לא עובר אימות"); continue; }
    if (norm(p.he) !== norm(r.current))         { drop(r, "השם הקיים בדיווח אינו השם שבמאגר"); continue; }
    if (norm(p.he) === norm(r.proposed))        { drop(r, "אין שינוי"); continue; }
    const taken = club(r.club).players.find(q => q !== p && norm(q.he) === norm(r.proposed));
    if (taken)                                  { drop(r, "השם תפוס בידי שחקן אחר"); continue; }
  }
  valid.push({ ...r, key: `${r.club}|${norm(r.player)}|${r.field}|${r.proposed}` });
}

/* שורות שנפסלו על תוכן — לא על ספירה — נסגרות לתמיד. שורה שנפלה רק
   כי טרם הצטברו מדווחים חייבת להישאר בתור, אחרת המדווח השלישי
   שיגיע מחר לא יועיל לכלום. */
for (const d of dropped) if (!ledger.rejected[d.row]) ledger.rejected[d.row] = d.why;

/* ============================================================
   3. קיבוץ: אותו תיקון בדיוק, ממדווחים נפרדים
   ============================================================ */
const groups = new Map();
for (const v of valid) {
  if (!groups.has(v.key)) groups.set(v.key, { ...v, rids: new Set(), rows: [] });
  const g = groups.get(v.key);
  g.rids.add(v.rid);
  g.rows.push(v.row);
}

const ready = [...groups.values()]
  .filter(g => !ledger.applied[g.key])
  .filter(g => g.rids.size >= MIN_REPORTERS)
  .sort((a, b) => b.rids.size - a.rids.size);

const waiting = [...groups.values()]
  .filter(g => !ledger.applied[g.key] && g.rids.size < MIN_REPORTERS);

const apply   = ready.slice(0, MAX_PER_RUN);
const deferred = ready.slice(MAX_PER_RUN);

/* ============================================================
   4. כתיבה ל-config/names-<slug>.json
   ============================================================ */
/* השחקן יכול להיות כבר דרוס. במקרה כזה המפתח בקובץ הוא השם המקורי
   שהצינור הפיק, לא השם שהמדווח ראה — ותיקון נוסף חייב לשבת על
   אותו מפתח, אחרת ייווצרו שתי דריסות סותרות לאותו אדם. */
function resolveKey(fix, name) {
  const target = norm(name);
  for (const [k, v] of Object.entries(fix)) {
    if (k.startsWith("_")) continue;
    const he = typeof v === "string" ? v : v && v.he;
    if (he && norm(he) === target) return k;
  }
  return name;
}

const touched = new Set(), applied = [];
for (const g of apply) {
  const path = `config/names-${g.club}.json`;
  const fix  = readJSON(path, {});
  const key  = resolveKey(fix, g.player);
  const cur  = fix[key];

  if (g.field === "he") {
    /* מחרוזת היא קיצור מוכר לשינוי שם. אם יש כבר אובייקט עם שדות
       אחרים — משמרים אותם ומחליפים רק את he. */
    fix[key] = (cur && typeof cur === "object") ? { ...cur, he: g.proposed } : g.proposed;
  } else {
    if (cur && typeof cur === "object")      fix[key] = { ...cur, pos: g.proposed };
    else if (typeof cur === "string")        fix[key] = { he: cur, pos: g.proposed };
    else                                     fix[key] = { pos: g.proposed };
  }

  if (!DRY) writeJSON(path, fix);
  touched.add(g.club);
  applied.push({ ...g, key2: key });
  ledger.applied[g.key] = {
    date: new Date().toISOString().slice(0, 10),
    reporters: g.rids.size, rows: g.rows, configKey: key
  };
}

if (!DRY) writeJSON(LEDGER, ledger);

/* ============================================================
   5. סיכום — נכתב לקובץ מחוץ למאגר, לגוף ה-PR
   ============================================================ */
const POS_HE = { GK: "שוער", DF: "מגן", MF: "קשר", FW: "חלוץ" };
const show = (f, v) => f === "pos" ? (POS_HE[v] || v) : v;

const lines = [];
lines.push(`## תיקונים מהטופס`, "");
if (applied.length) {
  lines.push(`### הוחלו (${applied.length})`, "");
  lines.push("| מועדון | שחקן | שדה | מ- | ל- | מדווחים |");
  lines.push("|---|---|---|---|---|---|");
  for (const g of applied)
    lines.push(`| ${g.club} | ${g.player} | ${g.field === "he" ? "שם" : "עמדה"} | ` +
               `${show(g.field, g.current)} | ${show(g.field, g.proposed)} | ${g.rids.size} |`);
  lines.push("");
}
if (waiting.length) {
  lines.push(`### ממתינים לעוד מדווחים (${waiting.length})`, "");
  for (const g of waiting)
    lines.push(`- ${g.club} · ${g.player} · ${g.field === "he" ? "שם" : "עמדה"} → ` +
               `${show(g.field, g.proposed)} — ${g.rids.size} מתוך ${MIN_REPORTERS}`);
  lines.push("");
}
if (deferred.length) {
  lines.push(`### נדחו לריצה הבאה — תקרת ${MAX_PER_RUN} לריצה (${deferred.length})`, "");
  for (const g of deferred)
    lines.push(`- ${g.club} · ${g.player} · ${g.field === "he" ? "שם" : "עמדה"} → ${show(g.field, g.proposed)}`);
  lines.push("");
}
if (dropped.length) {
  lines.push(`### נפסלו (${dropped.length})`, "");
  for (const d of dropped.slice(0, 40))
    lines.push(`- שורה ${d.row} · ${d.r.club} · ${d.r.player} → ${d.r.proposed} — ${d.why}`);
  if (dropped.length > 40) lines.push(`- ...ועוד ${dropped.length - 40}`);
  lines.push("");
}
lines.push(`נדרשים ${MIN_REPORTERS} מדווחים נפרדים לאותו תיקון · תקרה ${MAX_PER_RUN} לריצה.`);

const summary = lines.join("\n");
const out = process.env.SUMMARY_OUT || join(tmpdir(), "reports-summary.md");
writeFileSync(out, summary + "\n");

log("");
log(summary);
log("");
log(`הסיכום נכתב ל-${out}`);

/* שורות שהוחלו — לסמן בגיליון כדי שלא יחזרו בתור */
if (applied.length && !DRY) {
  const rows2 = applied.flatMap(g => g.rows);
  const r2 = await fetch(URL_, {
    method: "POST",
    body: JSON.stringify({ type: "ack", token: TOKEN, rows: rows2, status: "הוחל" })
  }).then(r => r.json()).catch(e => ({ ok: false, error: String(e) }));
  log(r2 && r2.ok ? `סומנו ${r2.marked} שורות בגיליון` : `אזהרה: סימון הגיליון נכשל — ${r2 && r2.error}`);
}

/* גם שורות שנפסלו — אין טעם שיחזרו כל שעה */
if (dropped.length && !DRY) {
  const r3 = await fetch(URL_, {
    method: "POST",
    body: JSON.stringify({ type: "ack", token: TOKEN, rows: dropped.map(d => d.row), status: "נפסל" })
  }).then(r => r.json()).catch(e => ({ ok: false, error: String(e) }));
  if (!(r3 && r3.ok)) log(`אזהרה: סימון הפסולות נכשל — ${r3 && r3.error}`);
}

/* קוד יציאה 0 גם כשלא הוחל דבר. מי שמחליט אם יש מה לדחוף הוא
   git status ב-workflow, לא הסקריפט הזה. */
log(applied.length ? `הוחלו ${applied.length} תיקונים ב-${[...touched].join(", ")}`
                   : "לא הוחל דבר.");
