/* ============================================================
   archive-legacy.mjs — מעביר את ביתרדל ההיסטורי ל-beitardle/

   node tools/archive-legacy.mjs <נתיב-למאגר-הפריסה>

   למה זה קיים: המשחק עבר לשורש מאגר הפריסה, ובשורש יושב העמוד
   שממנו הכל התחיל — ביתרדל, מועדון אחד, נתונים מוטבעים בקובץ.
   העתקה של dist/ לשורש הייתה דורסת אותו.

   git שומר כל גרסה בהיסטוריה גם בלי הסקריפט הזה, אבל "קיים
   ב-git log" זה לא "אפשר לשחק בו". לכן העמוד עובר ל-beitardle/
   ונשאר חי בכתובת משלו.

   ההעברה היא git mv ולא copy+delete: git מזהה שינוי-שם, וכל
   ההיסטוריה של הקובץ נוסעת איתו לנתיב החדש.

   הסקריפט אידמפוטנטי — הוא רץ בכל פריסה ולא עושה כלום אחרי
   הפעם הראשונה.
   ============================================================ */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { readJSON } from "../scripts/lib/util.mjs";
import { join } from "node:path";

const ROOT = process.argv[2];
if (!ROOT || !existsSync(ROOT)) {
  console.error("שימוש: node tools/archive-legacy.mjs <נתיב-למאגר-הפריסה>");
  process.exit(1);
}

const DIR = "beitardle";
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" });

/* הקבצים של העמוד הישן. לא מועברים:
     apps-script.gs — כלי האיסוף, לא חלק מהעמוד
     versus.html    — כרזה שמפנה ל-#versus, ותמשיך לעבוד בשורש
     sportdle/      — ההעתק הקיים של המשחק                        */
const FILES = [
  "index.html", "manifest.json", "favicon.ico",
  "icon-32.png", "icon-180.png", "icon-192.png", "icon-512.png",
  "og-beitardle.png", "players.json", "players_1.json"
];

/* ---------- כבר בוצע? ---------- */
if (existsSync(join(ROOT, DIR, "index.html"))) {
  console.log(`${DIR}/ קיים — אין מה לארכב.`);
  process.exit(0);
}

/* ---------- באמת העמוד הישן? ----------
   הסימן הוא הכפתור "עברו ל-SportDle", שקיים רק בעמוד ההיסטורי.
   בלי הבדיקה הזאת פריסה שנייה הייתה מארכבת את SportDle עצמו. */
const idx = join(ROOT, "index.html");
if (!existsSync(idx)) {
  console.log("אין index.html בשורש — אין מה לארכב.");
  process.exit(0);
}
const html = readFileSync(idx, "utf8");
if (!html.includes('id="toSportdle"')) {
  console.log("ה-index.html בשורש אינו העמוד ההיסטורי — לא נוגעים.");
  process.exit(0);
}

/* ---------- ההעברה ---------- */
mkdirSync(join(ROOT, DIR), { recursive: true });
const moved = [];
for (const f of FILES) {
  if (!existsSync(join(ROOT, f))) continue;
  git("mv", f, `${DIR}/${f}`);          // שינוי-שם, לא העתקה
  moved.push(f);
}
console.log(`הועברו ל-${DIR}/: ${moved.join(", ")}`);

/* ---------- תיקון הקישורים בעמוד המארכב ----------
   שני דברים היו נשברים בנתיב החדש:

   1. הכפתור "עברו ל-SportDle" מצביע ל-"./sportdle/", שמתוך
      /beitardle/ נפתר ל-/beitardle/sportdle/ — 404.
   2. יש הפניה אוטומטית לפי דומיין, שנועדה לשלוח מבקרים מ-sportdle.*
      אל ./sportdle/. בארכיון אין לה שום מובן: מי שהגיע לכאן הגיע
      בכוונה, וההפניה רק הייתה זורקת אותו ל-404.

   הגרסה שלא נגעו בה נשארת ב-git log. */
const target = join(ROOT, DIR, "index.html");
let a = readFileSync(target, "utf8");
/* נגזר ולא מקודד — החלפת דומיין לא צריכה לגעת בקובץ הזה */
const CANON = String(readJSON("config/site.json").siteUrl).replace(/\/*$/, "") + "/";
const edits = [];

/* 1. הקישור למשחק — מוחלט, כדי שיעבוד מכל נתיב ולתמיד */
const before1 = a;
a = a.replace(/href="\.\/sportdle\/"/g, `href="${CANON}"`);
if (a !== before1) edits.push("הקישור ל-SportDle");

/* 2. ביטול ההפניה האוטומטית */
const GATE = /if\s*\(host\.indexOf\("sportdle\."\)\s*===\s*0\s*&&\s*path\.indexOf\("\/sportdle\/"\)\s*===\s*-1\)/;
if (GATE.test(a)) {
  a = a.replace(GATE, "if (false) /* ארכיון: בלי הפניה אוטומטית */");
  edits.push("ההפניה האוטומטית");
} else {
  console.error("אזהרה: לא נמצאה ההפניה האוטומטית — בדוק אותה ידנית.");
}

/* 3. שלא יתחרה במשחק בתוצאות החיפוש */
const before3 = a;
a = a.replace(/<head>/, '<head>\n<meta name="robots" content="noindex">');
if (a !== before3) edits.push("noindex");

writeFileSync(target, a, "utf8");
git("add", `${DIR}/index.html`);
console.log(`תוקנו בעמוד המארכב: ${edits.join(", ")}`);
console.log(`ביתרדל ההיסטורי נשמר ב-/${DIR}/`);
