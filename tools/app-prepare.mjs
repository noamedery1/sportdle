/* ============================================================
   app-prepare.mjs — dist/ → app-dist/, בשינוי אחד.

   node tools/app-prepare.mjs

   **הבאג שזה מתקן.** ב-WebView של Capacitor כל 561 הדפים היו
   נשברים: לחיצה על "איך משחקים" טענה את המשחק מחדש. הסיבה
   בקוד של Capacitor, ב-WebViewLocalServer.handleLocalRequest:

     if (path.equals("/") ||
         (!request.getUrl().getLastPathSegment().contains(".")
          && html5mode))
       → מגיש את index.html של השורש

   `/how-to-play/` נותן סגמנט אחרון `how-to-play`, בלי נקודה,
   ו-html5mode דלוק כברירת מחדל. אז נשלח המשחק במקום הדף.

   **ולמה לא פשוט לכבות html5mode**, שהוא אכן ניתן להגדרה
   כ-`server.html5mode`: כי אחרי הבלוק הזה הקוד מטפל **רק**
   בנתיבים שיש בהם נקודה (`periodIndex >= 0`), ול-openAsset אין
   שום פתרון של תיקייה ל-index.html. כיבוי היה מחליף "המשחק נטען
   שוב" ב-404 — גרוע יותר, לא טוב יותר.

   לכן: בעותק של האפליקציה כל קישור פנימי שמסתיים בלוכסן מקבל
   `index.html` מפורש. עם נקודה בסגמנט האחרון, Capacitor מגיש את
   הקובץ הנכון.

   **האתר לא נוגע.** שם `/how-to-play/` היא הכתובת הקנונית, וכך
   היא נשארת — ה-rewrite קורה רק ב-app-dist, שאינו במאגר.
   ============================================================ */
import { cpSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { log, die } from "../scripts/lib/util.mjs";

const SRC = "dist";
const OUT = "app-dist";

if (!existsSync(join(SRC, "index.html"))) die(`אין ${SRC}/index.html — הרץ קודם node scripts/build.mjs`);

rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true });

/* כל href יחסי שמסתיים בלוכסן. לא נוגעים ב-http, mailto, #,
   ולא בכל דבר שיש בו סיומת — fonts.css, icon-32.png וכאלה
   כבר עובדים, כי יש נקודה בסגמנט האחרון. */
const RE = /href="(?!https?:|mailto:|tel:|data:|javascript:|#)([^"]*\/)"/g;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith(".html")) out.push(p);
  }
  return out;
}

let files = 0, links = 0;
for (const f of walk(OUT)) {
  const html = readFileSync(f, "utf8");
  let n = 0;
  const fixed = html.replace(RE, (m, href) => { n++; return `href="${href}index.html"`; });
  if (n) { writeFileSync(f, fixed, "utf8"); files++; links += n; }
}
log(`  ${links} קישורים תוקנו ב-${files} דפים`);

/* ---------- השומר ----------
   אם נשאר קישור פנימי שמסתיים בלוכסן, דף אחד באפליקציה יטען את
   המשחק במקום את עצמו — ואף שגיאה לא תופיע. זה בדיוק סוג הבאג
   שהתגלה רק על מכשיר, ולכן הוא נבדק כאן ולא מקווים. */
const left = [];
for (const f of walk(OUT)) {
  const html = readFileSync(f, "utf8");
  const m = [...html.matchAll(RE)];
  if (m.length) left.push(`${f}: ${m.slice(0, 3).map(x => x[1]).join(", ")}`);
}
if (left.length) {
  console.error(left.slice(0, 10).map(s => "  " + s).join("\n"));
  die(`${left.length} דפים עם קישור שמסתיים בלוכסן — ייטענו כמשחק באפליקציה`);
}
log(`  ${OUT} מוכן. אפס קישורים שמסתיימים בלוכסן.`);
