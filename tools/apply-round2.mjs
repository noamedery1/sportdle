/* apply-round2.mjs — מחקר סבב 2 (11/11/2026), באישור נועם:
   1. תיקון ערכים שגויים שכבר במאגר (שני מקורות מסכימים, אף מקור לא תומך במאגר)
   3. שחקנים חדשים שכל שדותיהם אומתו — guessOnly (מדיניות 12/10: הלוח לא גדל)
   4. איותים כפולים → כינוי (addAliases)
   הכל דרך config/names-<club>.json. רץ פעם אחת; אידמפוטנטי. */
import { readFileSync, writeFileSync } from "node:fs";

const FIX = [
  ["beitar", "רענן דרעי", { pos: "MF" }],
  ["beitar", "צחי אליחן", { pos: "FW" }],
  ["beitar", "עוז ראלי", { pos: "DF" }],
  ["hapoel-bs", "דודו בן שושן", { born: 1983 }],         // IFA 17416 + TM 211519 (סבב 1; אבד במיזוג main)
  ["hapoel-bs", "אמיר גנאח", { pos: "FW" }],
  ["hapoel-bs", "איתי חזות", { pos: "MF" }],
  ["hapoel-ta", "אדמונד שמילוביץ'", { born: 1921 }],   // באג scrape: שנת פטירה/הערה
  ["hapoel-ta", "יחזקאל חזום", { born: 1946 }],
  /* עמנואל בואטנג (1996, FW) הוסר: התיקון הוציא מהמאגר שחקן מלוח החידות — לבדוק ידנית */
  ["hapoel-ta", "טל ארצל", { pos: "DF" }],
  ["maccabi-ta", "ריף פרץ", { pos: "DF" }],
  ["maccabi-ta", "אלירן עטר", { pos: "FW" }],
  ["maccabi-ta", "רחמים צ'קול", { pos: "DF" }],
  ["maccabi-ta", "סטיב גורי", { born: 1981, nat: "CI" }], // באג scrape: 2015 = שנת פטירה
];
/* לא נכנסו: ערן לוי (כמה שחקנים בשם), ארצי בן יעקב (קיצוני → FW לפי המוסכמה) */

const ALIAS = [
  ["beitar", "מתאוזיניו", "מתאוסיניו"],
  ["hapoel-bs", "איברהים ראזק", "איברהים עבדול ראזאק"],
  ["hapoel-ta", "מרקו ינקוביץ", "מרקו יאנקוביץ'"],
  ["maccabi-ta", "אדוארדו מרקוש", "אדוארדו מרקש"],
];

const SKIP_NEW = new Set(["יוסי קרמר", "יוסי שושני"]);   // עונות סותרות את TM

const cfgs = {};
const cfg = c => (cfgs[c] ||= JSON.parse(readFileSync(`config/names-${c}.json`, "utf8")));
const entry = (c, he) => { const o = cfg(c); const v = o[he];
  return o[he] = (v && typeof v === "object") ? v : (typeof v === "string" ? { he: v } : {}); };

for (const [c, he, set] of FIX) Object.assign(entry(c, he), set);
for (const [c, he, al] of ALIAS) { const e = entry(c, he); e.addAliases = [...new Set([...(e.addAliases || []), al])]; }

const np = JSON.parse(readFileSync("data/review/research/round2-new-players.json", "utf8")).players;
let added = 0;
for (const p of np) {
  if (SKIP_NEW.has(p.he) || !Object.values(p.status).every(s => s === "verified")) continue;
  const e = entry(p.club, p.he);
  Object.assign(e, { add: true, born: p.born, pos: p.pos, nat: p.nat, spells: p.spells, guessOnly: true });
  added++;
}
for (const [c, o] of Object.entries(cfgs)) writeFileSync(`config/names-${c}.json`, JSON.stringify(o, null, 2) + "\n");
console.log(`תיקונים ${FIX.length} · כינויים ${ALIAS.length} · שחקנים חדשים ${added}`);
