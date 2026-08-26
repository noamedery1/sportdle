/* ============================================================
   reports-guard.mjs — מה מותר לצינור האוטומטי לשנות

   node tools/reports-guard.mjs

   נכשל אם הצינור נגע בקובץ שאינו ברשימה, או אם התוכן שנכתב
   ל-config/names-*.json אינו עומד בסכימה.

   ------------------------------------------------------------
   זה החלק שהוא הגנה, ולא הבטחה.

   כל השאר בצינור — האימות בטופס, האימות ב-Apps Script, האימות
   ב-reports-apply — הוא קוד שאני כתבתי ושאפשר שיהיה בו באג. הבדיקה
   כאן היא הרשת התחתונה: גם אם משהו למעלה נשבר או נעקף, מה שיוצא
   מהריצה הוא לכל היותר שינוי בשדות he/pos בקובץ דריסות אחד.

   הרשימה מכוונת להיות משעממת. כל הוספה אליה מרחיבה את מה שאוטומט
   יכול לשנות בלי שאדם הסתכל, ולכן היא צריכה להיות החלטה מדעת.
   ============================================================ */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const ALLOWED = [
  /^config\/names-[a-z-]+\.json$/,
  /^data\/review\/reports-seen\.json$/
];

const FIELDS = ["he", "pos", "nat", "born", "spells"];   // מה שקובץ הדריסות תומך בו
const AUTO   = ["he", "pos"];                            // מה שהצינור מורשה לכתוב
const POSES  = ["GK", "DF", "MF", "FW"];
const HE_NAME = /^[א-ת][א-ת ׳״'"’־-]{0,38}[א-ת]$/;

const fails = [];
const fail = m => fails.push(m);

/* ---------- 1. אילו קבצים נגעו ---------- */
let changed;
try {
  changed = execSync("git status --porcelain", { encoding: "utf8" })
    .split("\n").map(l => l.slice(3).trim()).filter(Boolean);
} catch (e) {
  console.error("✖ אין git — אין מה לשמור עליו. הרץ את זה בתוך מאגר.");
  process.exit(1);
}

if (!changed.length) {
  console.log("אין שינויים.");
  process.exit(0);
}

for (const f of changed)
  if (!ALLOWED.some(re => re.test(f)))
    fail(`קובץ מחוץ לרשימה: ${f}`);

/* ---------- 2. תוכן קובצי הדריסות ---------- */
for (const f of changed.filter(f => /^config\/names-[a-z-]+\.json$/.test(f))) {
  if (!existsSync(f)) { fail(`${f}: נמחק — הצינור לא מוחק קבצים`); continue; }

  let obj;
  try { obj = JSON.parse(readFileSync(f, "utf8")); }
  catch (e) { fail(`${f}: JSON לא תקין — ${e.message}`); continue; }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) { fail(`${f}: לא אובייקט`); continue; }

  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith("_")) continue;                   // תיעוד ודוגמאות

    /* שלוש צורות מפתח חוקיות, וזה הכול: player_id של ההתאחדות, שם
       עברי כפי שהצינור הפיק אותו, או שם לטיני לתעתיק ידני — הצורה
       שמתועדת ב-_howto ושהיא הפתרון היחיד למי שאין לו ערך ויקיפדיה.
       לא נתיב, לא דגל, לא שום דבר שדומה לפקודה.
       הצינור האוטומטי לעולם אינו יוצר מפתח לטיני — הוא עובד לפי שם
       עברי מהמאגר. לכן מפתח לטיני חוקי בקובץ אבל אסור בתוספת
       אוטומטית, וזה נאכף בסעיף 3. */
    const LATIN_KEY = /^[A-Za-z][A-Za-z .'’-]{1,38}$/;
    if (!/^\d{1,8}$/.test(key) && !HE_NAME.test(key) && !LATIN_KEY.test(key))
      fail(`${f}: מפתח לא תקין — ${JSON.stringify(key)}`);

    if (typeof val === "string") {
      if (!HE_NAME.test(val)) fail(`${f}: ${key} → שם לא תקין ${JSON.stringify(val)}`);
      continue;
    }
    if (!val || typeof val !== "object" || Array.isArray(val)) {
      fail(`${f}: ${key} → הערך חייב להיות מחרוזת או אובייקט`);
      continue;
    }

    for (const [k, v] of Object.entries(val)) {
      if (!FIELDS.includes(k)) { fail(`${f}: ${key} → שדה לא מוכר "${k}"`); continue; }
      if (k === "he"  && !HE_NAME.test(v))        fail(`${f}: ${key} → he לא תקין`);
      if (k === "pos" && !POSES.includes(v))      fail(`${f}: ${key} → pos לא מוכר "${v}"`);
      if (k === "nat" && !/^[A-Z]{2}$/.test(v))   fail(`${f}: ${key} → nat לא תקין`);
      if (k === "born" && !(Number.isInteger(v) && v >= 1900 && v <= 2015))
        fail(`${f}: ${key} → born לא סביר`);
      if (k === "spells" && !(Array.isArray(v) && v.every(s =>
            Array.isArray(s) && s.length === 2 && s.every(y => Number.isInteger(y) && y >= 1900 && y <= 2100))))
        fail(`${f}: ${key} → spells לא תקין`);
    }
  }
}

/* ---------- 3. מה מותר לריצה אוטומטית, בניגוד לאדם ----------
   nat, born ו-spells חוקיים בקובץ — אבל רק מיד אדם. כך גם מפתח
   תעתיק לטיני. אם ריצה אוטומטית נגעה בהם, משהו למעלה לא עושה את מה
   שנדמה לי שהוא עושה, וזו הנקודה לעצור.

   ההשוואה היא בין ה-JSON המפורסר שלפני ואחרי, ולא בין שורות הדיף.
   טקסט של דיף אינו מבחין בין מפתח שחקן לשם שדה — הגרסה הראשונה
   כאן דיווחה על "born": 1955 כאילו היה מפתח לטיני. */
if (process.env.GUARD_AUTO === "1") {
  const shape = v => typeof v === "string" ? { he: v }
               : (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
  const same  = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  for (const f of changed.filter(f => /^config\/names-[a-z-]+\.json$/.test(f))) {
    let before = {};
    try { before = JSON.parse(execSync(`git show HEAD:${f}`, { encoding: "utf8" })); }
    catch (e) { before = {}; }                      // קובץ חדש — הכול תוספת
    let after;
    try { after = JSON.parse(readFileSync(f, "utf8")); } catch (e) { continue; }  // דווח בסעיף 2

    for (const [k, v] of Object.entries(after)) {
      if (same(before[k], v)) continue;             // לא נגעו בו
      if (k.startsWith("_")) { fail(`${f}: ריצה אוטומטית שינתה את התיעוד "${k}"`); continue; }
      if (/[A-Za-z]/.test(k))
        fail(`${f}: ריצה אוטומטית הוסיפה או שינתה מפתח לטיני "${k}" — תעתיק הוא החלטה של אדם`);

      const bo = shape(before[k]), ao = shape(v);
      for (const fld of Object.keys(ao))
        if (!same(bo[fld], ao[fld]) && !AUTO.includes(fld))
          fail(`${f}: ${k} → ריצה אוטומטית כתבה "${fld}" — מותר רק ${AUTO.join(", ")}`);
      for (const fld of Object.keys(bo))
        if (!(fld in ao)) fail(`${f}: ${k} → ריצה אוטומטית הסירה את "${fld}"`);
    }

    for (const k of Object.keys(before))
      if (!(k in after)) fail(`${f}: ריצה אוטומטית הסירה את "${k}" — הצינור לא מוחק`);
  }
}

/* ---------- תוצאה ---------- */
if (fails.length) {
  console.error("\n✖ שומר הסף עצר את הריצה:\n" + fails.map(f => "  · " + f).join("\n") + "\n");
  console.error(`${fails.length} בדיקות נכשלו — לא נדחף דבר.`);
  process.exit(1);
}
console.log(`✔ ${changed.length} קבצים, כולם ברשימה ובסכימה:`);
for (const f of changed) console.log("  · " + f);
