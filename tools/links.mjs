/* ============================================================
   links.mjs — כל קישור פנימי ב-dist חייב להוביל לקובץ קיים.

   node tools/links.mjs [dist]

   קיים בגלל צורת הפריסה: אותו dist מוגש משני נתיבים — שורש
   הדומיין הקנוני, וגם /sportdle/ בכתובת הישנה. לכן כל קישור
   פנימי חייב להיות **יחסי**, וקישור יחסי שגוי בעומק אחד עובד
   מושלם בעומק אחר. 555 דפים בשלוש רמות עומק זה יותר ממה שאפשר
   לבדוק בעין.

   מה נבדק:
     · כל href/src יחסי מוביל לקובץ או לתיקייה עם index.html
     · אין קישור פנימי שמתחיל בלוכסן — הוא היה נשבר תחת /sportdle/
     · כל דף מגיע מהשורש (אין דף יתום שגוגל לא יכול להגיע אליו)
     · כל דף מקשר חזרה לעמוד הראשי

   **להריץ על dist בלבד.** על עץ הפריסה זה ייתן מאות התראות
   שקריות: שם יש שני העתקים של האתר (השורש ו-sportdle/), ודף
   בתוך sportdle/ מקשר לשורש **שלו** ולא לשורש העץ. בדיקות
   "אין קישור לעמוד הראשי" ו"דף יתום" מניחות אתר אחד.
   ============================================================ */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, normalize, relative } from "node:path";

const ROOT = process.argv[2] || "dist";
if (!existsSync(ROOT)) { console.error(`אין ${ROOT}`); process.exit(1); }

const fails = [];
const fail = m => fails.push(m);

/* ---------- כל דפי ה-HTML ---------- */
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".html")) out.push(p);
  }
  return out;
}
/* join/index.html הוא נקודת קצה טכנית: אף אחד לא מקשר אליו והוא
   לא מקשר הביתה — הוא מפנה מיד. בדיקות "יתום" ו"קישור הביתה"
   מניחות דף תוכן, ולכן הוא מוחרג. */
const SKIP = new Set(["join/index.html"]);
const pages = walk(ROOT).map(p => relative(ROOT, p).split("\\").join("/"))
  .filter(p => !SKIP.has(p));

/* ---------- הקישורים ---------- */
const graph = new Map();          // דף → קבוצת דפים שהוא מקשר אליהם
let checked = 0;

for (const rel of pages) {
  const html = readFileSync(join(ROOT, rel), "utf8");
  const dir = dirname(rel) === "." ? "" : dirname(rel);
  const outs = new Set();
  graph.set(rel, outs);

  const links = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]);
  for (const raw of links) {
    if (/^(https?:|mailto:|data:|javascript:|#|tel:)/i.test(raw)) continue;

    if (raw.startsWith("/")) {
      fail(`${rel} · קישור מוחלט "${raw}" — יישבר תחת /sportdle/`);
      continue;
    }
    const clean = decodeURIComponent(raw.split("#")[0].split("?")[0]);
    if (!clean) continue;

    /* פתרון יחסי, כמו שהדפדפן עושה */
    let target = normalize(join(dir, clean)).split("\\").join("/");
    if (target.startsWith("..")) {
      fail(`${rel} · "${raw}" יוצא מחוץ לשורש`);
      continue;
    }
    const abs = join(ROOT, target);
    let hit = abs;
    if (clean.endsWith("/") || (existsSync(abs) && statSync(abs).isDirectory()))
      hit = join(abs, "index.html");

    checked++;
    if (!existsSync(hit)) { fail(`${rel} · "${raw}" → אין ${target}`); continue; }

    if (hit.endsWith("index.html"))
      outs.add(relative(ROOT, hit).split("\\").join("/"));
  }

  /* כל דף חייב דרך חזרה הביתה */
  const home = [...outs].includes("index.html");
  if (rel !== "index.html" && !home)
    fail(`${rel} · אין קישור לעמוד הראשי`);
}

/* ---------- דפים יתומים ---------- */
const seen = new Set(["index.html"]);
const queue = ["index.html"];
while (queue.length) {
  const cur = queue.shift();
  for (const nxt of graph.get(cur) || []) {
    if (seen.has(nxt)) continue;
    seen.add(nxt); queue.push(nxt);
  }
}
const orphans = pages.filter(p => !seen.has(p));
if (orphans.length)
  fail(`${orphans.length} דפים לא נגישים מהשורש: ${orphans.slice(0, 5).join(", ")}` +
       (orphans.length > 5 ? " …" : ""));

/* ---------- דוח ---------- */
console.log(`${pages.length} דפים · ${checked} קישורים פנימיים נבדקו · ` +
            `${seen.size} נגישים מהשורש`);
if (fails.length) {
  console.log(`\n✖ ${fails.length} תקלות`);
  fails.slice(0, 40).forEach(f => console.log("   " + f));
  if (fails.length > 40) console.log(`   … ועוד ${fails.length - 40}`);
  process.exit(1);
}
console.log("כל הקישורים תקינים.");
