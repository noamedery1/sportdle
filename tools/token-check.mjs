/* ============================================================
   token-check.mjs — האם ל-DEPLOY_TOKEN יש הרשאת כתיבה למאגר הפריסה

   node tools/token-check.mjs <http-code> <body-file> <owner/repo>

   נקרא מ-.github/workflows/deploy.yml, לפני שהריצה עושה עבודה.

   למה זה קיים: מאגר הפריסה ציבורי. קריאה ממאגר ציבורי לא דורשת
   טוקן בכלל, ולכן actions/checkout שלו מצליח גם עם טוקן פג-תוקף
   או עם טוקן לקריאה בלבד — והכישלון האמיתי מגיע רק ב-git push,
   בסוף הריצה, בהודעה שלא אומרת איזה סוד לתקן ואיפה.

   למה node ולא jq בתוך ה-YAML: כדי שאפשר יהיה להריץ את זה מקומית
   ולראות שההודעות נכונות. לוגיקה שקיימת רק בתוך workflow נבדקת
   רק בפרודקשן.
   ============================================================ */
import { readFileSync } from "node:fs";

const [code, bodyFile, repo] = process.argv.slice(2);

/* ::error:: הופך לאנוטציה בעמוד הריצה, ומופיע גם במייל הכישלון של
   גיטהאב. שורה אחת בלבד — אנוטציה לא נושאת שורות חדשות. */
const fail = m => { console.log(`::error::${m}`); process.exit(1); };

let body = {};
try { body = JSON.parse(readFileSync(bodyFile, "utf8")); }
catch { /* לא JSON — הקוד למטה מטפל */ }

if (code !== "200")
  fail(`ה-API החזיר ${code} על ${repo} — DEPLOY_TOKEN פג תוקף, שגוי, ` +
       `או שהמאגר אינו ברשימת המאגרים שלו.` +
       (body.message ? ` תשובת גיטהאב: ${body.message}` : ""));

/* בטוקן עדין השדה הזה משקף את הרשאות *הטוקן*, לא את אלה של המשתמש.
   בקשה בלי טוקן תקף למאגר ציבורי מחזירה 200 בלי השדה בכלל — ולכן
   היעדרו נחשב "אין כתיבה" ולא "לא ידוע". */
if (!body.permissions || body.permissions.push !== true)
  fail(`ל-DEPLOY_TOKEN אין הרשאת כתיבה ל-${repo}. ` +
       `בטוקן עדין: Repository permissions → Contents → Read and write, ` +
       `וגם ש-${repo} נמצא ב-Repository access.`);

console.log(`הטוקן תקף ויש לו הרשאת כתיבה ל-${repo}.`);
