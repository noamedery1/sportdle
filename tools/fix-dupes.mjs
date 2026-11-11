/* fix-dupes.mjs — QA סבב 3 (11/11/2026): שמות הפוכים מההתאחדות ("כליבאת מוחמד")
   היו מוסתרים כי חסרה להם עמדה. ההשלמה המאומתת נתנה להם עמדה — והם הופיעו
   כשחקן שני לצד האמיתי (ארכיון: אותו אדם נפסל; 3×3: ממלא שתי משבצות).
   הכלל: נשארת הרשומה שבלוח החידות (target); אחרת — סדר השמות הרגיל.
   הנמחקת הופכת לכינוי של הנשארת, כך שגם האיות שלה נמצא בחיפוש. */
import { readFileSync, writeFileSync } from "node:fs";

const MERGE = [            // [club, keep, drop]
  ["hapoel-bs", "ואדים מנזון", "מנזון ואדים"],
  ["maccabi-ta", "רודריגו גולדברג", "גולדברג רודריגו"],     // keep = חידה #45
  ["maccabi-haifa", "מוחמד כליבאת", "כליבאת מוחמד"],        // keep = חידה #11
  ["maccabi-haifa", "מנואל בנסון", "בנסון מנואל"],
  ["hapoel-ta", "כפיר אודי", "אודי כפיר"],                  // keep = חידה #52 (השם ההפוך הוא התשובה שפורסמה)
  ["hapoel-ta", "מירקו אורמוש", "אורמוש מירקו"],
  ["hapoel-ta", "פרננד מאיימבו", "פרנאן מאיימבו"],
  ["maccabi-haifa", "קארים פריי", "קרים פריי"],              // כפילות ישנה (CH / TR)
  ["hapoel-bs", "בלסינג קאקו", "קאקו בלסינג"],              // נמצאו בסריקה אחרי התיקון
  ["maccabi-ta", "רייס ברונו", "ברונו רייס"],                // keep = בלוח החידות
];
const SET = [["beitar", "אדוארדו גררו", { nat: "PA" }]];    // ברשומה של מכבי ת"א כבר PA

const cfgs = {};
const cfg = c => (cfgs[c] ||= JSON.parse(readFileSync(`config/names-${c}.json`, "utf8")));
const entry = (c, he) => { const o = cfg(c), v = o[he];
  return o[he] = (v && typeof v === "object") ? v : (typeof v === "string" ? { he: v } : {}); };

for (const [c, keep, drop] of MERGE) {
  entry(c, drop).drop = true;
  const k = entry(c, keep); k.addAliases = [...new Set([...(k.addAliases || []), drop])];
}
for (const [c, he, set] of SET) Object.assign(entry(c, he), set);
for (const [c, o] of Object.entries(cfgs)) writeFileSync(`config/names-${c}.json`, JSON.stringify(o, null, 2) + "\n");

/* nat-extra נכתב קודם על השם ההפוך */
const ne = readFileSync("config/nat-extra.json", "utf8").replace('"בנסון מנואל": ["AO", "BE"]', '"מנואל בנסון": ["AO", "BE"]');
writeFileSync("config/nat-extra.json", ne);
console.log(`מוזגו ${MERGE.length} · עודכנו ${SET.length}`);
