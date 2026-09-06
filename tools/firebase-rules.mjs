/* ============================================================
   firebase-rules.mjs — גרסה להדבקה בקונסולה.

   node tools/firebase-rules.mjs          → מדפיס למסך
   node tools/firebase-rules.mjs <קובץ>   → כותב לקובץ

   config/firebase-rules.json הוא מקור האמת, ויש בו תיעוד בעברית
   במפתחות שמתחילים ב-"_". עורך החוקים של פיירבייס מצפה לאובייקט
   שבשורשו "rules" בלבד, ומפתח אחר לצידו נדחה.

   לכן הכלי הזה גוזר את מה שמדביקים **מאותו קובץ** במקום להחזיק
   עותק שני. שני עותקים של חוקי אבטחה נפרדים בשקט, ואז מה שרץ
   בענן אינו מה שכתוב במאגר — ואין שום בדיקה שתתפוס את זה.
   ============================================================ */
import { readFileSync, writeFileSync } from "node:fs";

const src = JSON.parse(readFileSync("config/firebase-rules.json", "utf8"));
if (!src.rules) { console.error("אין מפתח rules ב-config/firebase-rules.json"); process.exit(1); }

/* התיעוד יורד מכל רמה, לא רק מהשורש: מפתח שמתחיל ב-"_" בתוך
   בלוק חוקים ייקרא כשם ילד ויקבל חוקים משלו. */
function strip(node) {
  if (Array.isArray(node)) return node.map(strip);
  if (node && typeof node === "object") {
    const out = {};
    for (const [k, v] of Object.entries(node)) if (!k.startsWith("_")) out[k] = strip(v);
    return out;
  }
  return node;
}

const text = JSON.stringify({ rules: strip(src.rules) }, null, 2) + "\n";
const dest = process.argv[2];
if (dest) { writeFileSync(dest, text, "utf8"); console.error(`נכתב ${dest} · ${text.length} תווים`); }
else process.stdout.write(text);
