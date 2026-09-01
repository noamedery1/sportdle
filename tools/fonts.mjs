/* ============================================================
   fonts.mjs — מוריד את הגופנים ל-src/static, פעם אחת.

   node tools/fonts.mjs

   למה: עד היום Heebo ו-Suez One נטענו מ-Google Fonts בזמן ריצה.
   באתר זה רק תלות; **באפליקציה זה באג** — בלי רשת המשחק נופל
   לגופן מערכת ונראה שבור, וגם הטיעון "עובד אופליין" מול אפל
   (כלל 4.2) נחלש. חוץ מזה, כל טעינה שולחת בקשה לצד שלישי.

   הכלי מוריד את קובצי ה-woff2 ל-src/static/fonts/ וכותב
   src/static/fonts.css עם אותם @font-face בנתיבים מקומיים.
   הבנייה מעתיקה את src/static ל-dist כמו כל נכס אחר.

   **כל תת-הקבוצות נשמרות בכוונה.** מפתה לזרוק את math ו-symbols,
   אבל החצים ↑ ↓ ו-⇄ הם ליבת המשחק ויושבים באחת מהן. תת-קבוצה
   חסרה לא מתפוצצת — היא נופלת בשקט לגופן מערכת בתוך אריח אחד.
   הן נטענות לפי unicode-range, כך שהדפדפן מוריד רק מה שנחוץ.

   שני הגופנים ברישיון SIL OFL 1.1, שמתיר הפצה מחדש. הרישיון
   מורד לצד הקבצים — זו דרישה של הרישיון, לא נדיבות.
   ============================================================ */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { log, warn, die } from "../scripts/lib/util.mjs";

/* אותה הגדרה שהייתה ב-<link> של התבנית. מקור אמת אחד: אם משנים
   כאן משקל, מריצים מחדש ו-build.mjs מפיל בנייה שמקשרת לגוגל. */
const SPEC = "family=Suez+One&family=Heebo:wght@400;500;700;900";
const CSS_URL = `https://fonts.googleapis.com/css2?${SPEC}&display=swap`;

/* גוגל מגישה woff2 רק ל-UA מודרני. עם UA של node היא מחזירה ttf,
   שהוא גדול פי שלושה. */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const OUT_DIR = "src/static/fonts";
const CSS_OUT = "src/static/fonts.css";

mkdirSync(OUT_DIR, { recursive: true });

log(`  מוריד ${CSS_URL}`);
const res = await fetch(CSS_URL, { headers: { "User-Agent": UA } });
if (!res.ok) die(`Google Fonts החזיר ${res.status}`);
const css = await res.text();
if (!/woff2/.test(css)) die("התשובה אינה woff2 — בדוק את ה-UA");

/* ---------- פירוק ל-@font-face ----------
   הפרסור נשען על הפורמט שגוגל מחזירה: הערת תת-קבוצה, ואחריה
   בלוק. אם הפורמט ישתנה, מספר הבלוקים ייצא 0 והכלי ייפול —
   וזה מה שרצוי, במקום לכתוב CSS חצי-ריק. */
const parts = css.split(/\/\* ([a-z-]+) \*\//).slice(1);
const faces = [];
for (let i = 0; i < parts.length; i += 2) {
  const subset = parts[i];
  const body = parts[i + 1] || "";
  const fam = (body.match(/font-family:\s*'([^']+)'/) || [])[1];
  const wght = (body.match(/font-weight:\s*(\d+)/) || [])[1];
  const style = (body.match(/font-style:\s*(\w+)/) || [])[1] || "normal";
  const url = (body.match(/src:\s*url\(([^)]+)\)/) || [])[1];
  const range = (body.match(/unicode-range:\s*([^;]+);/) || [])[1];
  if (!fam || !wght || !url) continue;
  faces.push({ subset, fam, wght, style, url, range });
}
if (!faces.length) die("לא נמצא אף @font-face — הפורמט של גוגל השתנה");
log(`  ${faces.length} מקטעי @font-face`);

/* ---------- הורדה ---------- */
let total = 0;
const seen = new Set();
for (const f of faces) {
  const slug = f.fam.toLowerCase().replace(/\s+/g, "-");
  f.file = `${slug}-${f.wght}-${f.subset}.woff2`;
  if (seen.has(f.file)) { warn(`שם קובץ כפול: ${f.file}`); continue; }
  seen.add(f.file);

  const r = await fetch(f.url, { headers: { "User-Agent": UA } });
  if (!r.ok) die(`${f.file}: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 200) die(`${f.file} קטן מדי (${buf.length}B) — הורדה חלקית`);
  writeFileSync(`${OUT_DIR}/${f.file}`, buf);
  total += buf.length;
}
log(`  ${seen.size} קבצים · ${(total / 1024).toFixed(0)}KB`);

/* ---------- ה-CSS המקומי ----------
   הנתיבים יחסיים ל-fonts.css עצמו, שיושב בשורש dist. לכן הם
   נפתרים נכון מכל עומק עמוד — /players/beitar/<שם>/ כלול. */
const out = [
  "/* נוצר על ידי tools/fonts.mjs — אל תערוך ביד.",
  `   מקור: ${CSS_URL}`,
  "   Heebo ו-Suez One ברישיון SIL OFL 1.1 (ראה fonts/OFL.txt). */",
  ""
];
for (const f of faces) {
  if (!f.file) continue;
  out.push("@font-face {",
    `  font-family: '${f.fam}';`,
    `  font-style: ${f.style};`,
    `  font-weight: ${f.wght};`,
    "  font-display: swap;",
    `  src: url(fonts/${f.file}) format('woff2');`,
    ...(f.range ? [`  unicode-range: ${f.range};`] : []),
    "}");
}
writeFileSync(CSS_OUT, out.join("\n") + "\n", "utf8");
log(`  נכתב ${CSS_OUT}`);

/* ---------- הרישיון ----------
   OFL מחייב לצרף את נוסח הרישיון להפצה מחדש. אם ההורדה נכשלת
   אנחנו אומרים זאת במקום להמציא נוסח. */
const LIC = `${OUT_DIR}/OFL.txt`;
if (!existsSync(LIC)) {
  const src = "https://raw.githubusercontent.com/google/fonts/main/ofl/heebo/OFL.txt";
  try {
    const r = await fetch(src);
    if (!r.ok) throw new Error(String(r.status));
    const txt = await r.text();
    if (!/SIL OPEN FONT LICENSE/i.test(txt)) throw new Error("לא נוסח OFL");
    writeFileSync(LIC, txt, "utf8");
    log(`  נכתב ${LIC}`);
  } catch (e) {
    warn(`לא הורד נוסח ה-OFL (${e.message}). הורד ידנית מ-${src} ל-${LIC} — ` +
         "הרישיון מחייב לצרפו להפצה, וחנויות האפליקציות בודקות את זה.");
  }
}
