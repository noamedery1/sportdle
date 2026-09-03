/* בדיקת עץ הפריסה לפני דחיפה.
   node tools/qa-deploy.mjs <נתיב-לריפו>

   קיים בגלל באג אמיתי: תוספת ידנית ל-index.html הישן הכניסה
   `!//sportdle//` — שני לוכסנים פותחים הערה, וכל הסקריפט נשבר.
   הדף נראה תקין עד שניסית לשחק. `git diff` לא תופס דבר כזה. */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2];
if (!ROOT || !existsSync(ROOT)) {
  console.error("שימוש: node tools/qa-deploy.mjs <נתיב-לריפו>");
  process.exit(1);
}

const fails = [], ok = [];
const fail = m => fails.push(m);
const pass = m => ok.push(m);

function scripts(html) {
  /* ld+json אינו JavaScript — new Function עליו נכשל תמיד.
     תוקפו נבדק בנפרד, כ-JSON. */
  return [...html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .filter(m => !/application\/ld\+json/.test(m[1] || ""))
    .map(m => m[2]).filter(s => s.trim());
}

function jsonLd(html) {
  return [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]);
}

function checkHtml(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { fail(`חסר ${rel}`); return null; }
  const html = readFileSync(p, "utf8");

  /* כל בלוק סקריפט חייב להתקמפל */
  scripts(html).forEach((s, i) => {
    try { new Function(s); pass(`${rel} · בלוק סקריפט ${i + 1}`); }
    catch (e) { fail(`${rel} · בלוק סקריפט ${i + 1}: ${e.message}`); }
  });

  /* הנתונים המובנים חייבים להיות JSON תקין. גוגל מתעלם בשקט
     מ-ld+json שבור, ואז אין תגובה ואין הודעה. */
  jsonLd(html).forEach((s, i) => {
    try { JSON.parse(s); pass(`${rel} · ld+json ${i + 1}`); }
    catch (e) { fail(`${rel} · ld+json ${i + 1}: ${e.message}`); }
  });

  /* תגיות מאוזנות */
  const body = html.slice(html.indexOf("<body>")).replace(/<script[\s\S]*?<\/script>/g, "");
  for (const tag of ["div", "section", "nav", "header", "footer"]) {
    const o = (body.match(new RegExp(`<${tag}[\\s>]`, "g")) || []).length;
    const c = (body.match(new RegExp(`</${tag}>`, "g")) || []).length;
    if (o !== c) fail(`${rel} · <${tag}> לא מאוזן (${o}/${c})`);
  }

  /* מזהים כפולים */
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dup = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  if (dup.length) fail(`${rel} · מזהים כפולים: ${dup.join(", ")}`);

  /* כל נכס יחסי שהדף מבקש חייב להתקיים */
  const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
  const assets = [...html.matchAll(/(?:href|src)="(?!https?:|data:|mailto:|#|javascript:)([^"?#]+)/g)]
    .map(m => m[1]).filter(a => /\.(png|ico|json|css|js)$/.test(a));
  for (const a of [...new Set(assets)]) {
    const target = a.startsWith("/") ? join(ROOT, a) : join(ROOT, dir, a);
    if (!existsSync(target)) fail(`${rel} · נכס חסר: ${a}`);
  }
  if (assets.length) pass(`${rel} · ${new Set(assets).size} נכסים קיימים`);
  return html;
}

/* ---------- שני העתקים, תוכן אחד ----------
   הפריסה מעתיקה את dist/ פעמיים: לשורש, שהוא מה שהדומיין הקנוני
   מגיש, וגם ל-sportdle/, כדי שקישורים ותיקים לכתובת הישנה לא
   יישברו. אם שני ההעתקים ייפרדו — למשל העתקה שנפלה באמצע — אנשים
   ישחקו שתי גרסאות שונות של אותו משחק ולא תהיה שום הודעת שגיאה. */
const old = checkHtml("index.html");
const neu = checkHtml("sportdle/index.html");
if (old && neu) {
  if (old === neu) pass("שורש ו-sportdle/ — אותו תוכן בדיוק");
  else fail("index.html בשורש שונה מזה שב-sportdle/ — ההעתקה חלקית");
}

if (neu) {
  for (const s of ["ביתרdle", "באר־שבעdle", "מכביdle", "חיפהdle", "הפועלdle"])
    if (!neu.includes(s)) fail(`sportdle · חסר המועדון ${s}`);
  pass("sportdle · חמשת המועדונים");
}

/* ---------- המניפסטים ----------
   אחד בשורש ואחד ב-sportdle/, ושניהם חייבים להישאר יחסיים: אותו
   קובץ מוגש משני נתיבים, ו-"/" היה שולח מי שהתקין דרך …/sportdle/
   לשורש — משחק אחר. ראה scripts/build.mjs. */
for (const dir of ["", "sportdle"]) {
  const label = dir ? `${dir}/manifest` : "manifest";
  const mf = join(ROOT, dir, "manifest.json");
  if (!existsSync(mf)) { fail(`${label} · חסר`); continue; }
  const m = JSON.parse(readFileSync(mf, "utf8"));
  const bad = [];
  for (const k of ["start_url", "scope"])
    if (m[k] && !m[k].startsWith(".")) bad.push(`${k}=${m[k]}`);
  const abs = (m.icons || []).map(i => i.src).filter(s => /^([a-z]+:)?\//.test(s));
  if (abs.length) bad.push(`אייקון מוחלט ${abs.join(", ")}`);
  for (const i of m.icons || [])
    if (!existsSync(join(ROOT, dir, i.src))) bad.push(`אייקון חסר ${i.src}`);
  if (bad.length) fail(`${label} · ${bad.join(" · ")}`);
  else pass(`${label} · יחסי, האייקונים קיימים`);
}

/* ---------- ביתרדל ההיסטורי ----------
   המשחק עבר לשורש, והעמוד שממנו הכל התחיל עבר ל-beitardle/.
   הבדיקה כאן היא שהמעבר לא השאיר אותו שבור: הקישור למשחק חייב
   להיות מוחלט (מתוך /beitardle/ הצורה היחסית מובילה ל-404), ואסור
   שתישאר בו ההפניה האוטומטית שהייתה זורקת מבקרים לאותו 404. */
const arc = join(ROOT, "beitardle/index.html");
if (existsSync(arc)) {
  const a = readFileSync(arc, "utf8");
  if (/href="\.\/sportdle\/"/.test(a))
    fail("beitardle · הקישור למשחק נשאר יחסי — מוביל ל-404");
  else if (!/href="https:\/\/[^"]+"/.test(a))
    fail("beitardle · אין קישור למשחק");
  else if (/host\.indexOf\("sportdle\."\)\s*===\s*0/.test(a))
    fail("beitardle · ההפניה האוטומטית עוד פעילה — תזרוק ל-404");
  else pass("beitardle · הארכיון שלם, בלי הפניה");
}

/* ---------- החידות שכבר פורסמו ----------
   עד שהמשחק עבר לשורש, ההשוואה נעשתה מול לוח החידות שהיה מוטבע
   בעמוד ביתרדל שיושב שם. זה היה שומר על 119 החידות שפורסמו מפני
   שינוי שקט של זהות: מי שפתר חידה #40 וחזר לראות אותה, חייב לראות
   את אותו שחקן.

   העמוד ההיסטורי עבר ל-beitardle/ ואינו עוד מקור לשוות אליו, ולכן
   הלוח הוקפא ל-config/published-beitar.json. השוואה מול קובץ קפוא
   חזקה יותר מהקודמת — היא לא נשענת על עמוד שיכול לזוז או להיעלם.

   הנתיב נגזר ממקום הסקריפט ולא מ-cwd: ב-CI הפקודה היא
   `node src-repo/tools/qa-deploy.mjs deploy-repo`, ואז cwd הוא
   התיקייה שמעל שני המאגרים. */
const PUBLISHED = new URL("../config/published-beitar.json", import.meta.url);

/* המאגר עבר מ-`const CLUBS = {…}` שבמנוע ל-window.SD ש-boot.js
   מציב, ולכן ה-regex הקודם הפסיק להתאים והבדיקה הזאת נכשלה —
   **וזה היה נכון.** בדיקה שאיבדה את מקור האמת שלה חייבת להיכשל
   ולא לעבור בשקט: אחרת החידות שפורסמו היו חשופות בלי שאף אחד
   יידע. הפריסה נחסמה עד שהיא הוסבה, וכך צריך להיות.

   עכשיו יש **שני** מקורות לאמת אותם, ולכן הבדיקה חזקה מקודם:
   המוטבע בעמוד הוא מה שמריץ את המשחק, ו-players.json הוא מה
   שהאפליקציה מושכת. הם חייבים להיות זהים — אחרת מי שמשחק
   באתר ומי שמשחק באפליקציה יראו לוחות שונים. */
let S = null;
try { S = JSON.parse(readFileSync(PUBLISHED, "utf8")); }
catch (e) { fail(`לא נקרא config/published-beitar.json: ${e.message}`); }

/* 1. הלוח שמוטבע בעמוד — מה שמריץ את המשחק */
let pageSched = null;
if (neu) {
  const m = neu.match(/var BUNDLED\s*=\s*(\{[\s\S]*?\});/);
  let C = null;
  if (m) { try { C = new Function(`return ${m[1]}`)(); } catch (e) {} }
  if (!C || !C.clubs || !C.clubs.beitar)
    fail("לא נמצא המאגר המוטבע (var BUNDLED) בעמוד — אין מה להשוות");
  else {
    pageSched = C.clubs.beitar.schedule || [];
    if (S) {
      const i = S.findIndex((n, k) => pageSched[k] !== n);
      if (i !== -1) fail(`חידה #${i + 1} שפורסמה השתנתה: "${S[i]}" ← "${pageSched[i]}"`);
      else pass(`${S.length} החידות שפורסמו לא זזו (המוטבע בעמוד)`);
    }
  }
}

/* 2. players.json — מה שהאפליקציה מושכת. חייב להיות בשני
      ההעתקים, ולהיות זהה למוטבע. */
for (const dir of ["", "sportdle"]) {
  const label = dir ? `${dir}/players.json` : "players.json";
  const p = join(ROOT, dir, "players.json");
  if (!existsSync(p)) { fail(`${label} · חסר — האפליקציה לא תמצא עדכוני נתונים`); continue; }
  let J = null;
  try { J = JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { fail(`${label} · JSON שבור: ${e.message}`); continue; }
  if (!J.v || !J.order || !J.clubs || !J.clubs.beitar) { fail(`${label} · מבנה חסר`); continue; }
  const b = J.clubs.beitar.schedule || [];
  if (S) {
    const i = S.findIndex((n, k) => b[k] !== n);
    if (i !== -1) { fail(`${label} · חידה #${i + 1} שפורסמה השתנתה: "${S[i]}" ← "${b[i]}"`); continue; }
  }
  if (pageSched && JSON.stringify(b) !== JSON.stringify(pageSched)) {
    fail(`${label} · הלוח שונה מזה שמוטבע בעמוד — אתר ואפליקציה יראו משחקים שונים`);
    continue;
  }
  pass(`${label} · v=${J.v} · זהה למוטבע`);
}

/* ---------- דוח ---------- */
console.log(`\n✓ עברו ${ok.length}`);
ok.forEach(o => console.log("   " + o));
if (fails.length) {
  console.log(`\n✖ נכשלו ${fails.length}`);
  fails.forEach(f => console.log("   " + f));
  process.exit(1);
}
console.log("\nעץ הפריסה תקין.");
