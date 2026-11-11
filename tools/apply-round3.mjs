/* apply-round3.mjs — מחקר סבב 3 (11/11/2026), באישור נועם ("תקן את שאר השחקנים").
   כל שורה: רוב מקורות (≥2, בלי מקור שתומך במאגר — או רוב ברור) נגד הערך במאגר.
   aliases: מערך מלא שמחליף (להסרת כינוי שגוי); addAliases: מוסיף. */
import { readFileSync, writeFileSync } from "node:fs";

const FIX = [
  ["beitar", "שמואל מלול", { born: 1993, addAliases: ["שמוליק מלול"] }],   // he.wiki + IFA + TM; "שמוליק" — נועם
  ["beitar", "יעקב בוזגלו", { pos: "MF" }],                                 // he.wiki + NFT
  ["beitar", "ארצי בן יעקב", { pos: "MF" }],                                // he.wiki + NFT ("קשר ימני")
  /* ברק בדש: הרשומה איחדה אותו עם הברזילאי Fábio Rosa מאותו סגל 2005 */
  ["hapoel-ta", "ברק בדש", { pos: "FW", nat: "IL", aliases: ["ברק בדש"] }],
  /* "Roy Dayan" ב-TM הוא שחקן אחר (יליד 1997, סגל 2017) */
  ["hapoel-ta", "רועי דיין", { aliases: ["רועי דיין"] }],
  ["hapoel-ta", "ירון בן דב", { born: 1970 }],                              // he.wiki + TM + NFT (wf לבדו 1971)
  ["maccabi-haifa", "סרגיי קנדאורוב", { born: 1972 }],                      // he.wiki + TM + FBref (wf לבדו 1971)
  ["maccabi-haifa", "ג'ון קולמה", { pos: "MF" }],                           // he.wiki + Wikidata + TM
  /* אסמאעיל ריאן (DF→FW) לא נכנס: הרשומה מאוחדת עם Iyad Abu Abaid, ושלב איחוד מאוחר דורס את העמדה. בלוח החידות — פיצול ידני */
];

const cfgs = {};
const cfg = c => (cfgs[c] ||= JSON.parse(readFileSync(`config/names-${c}.json`, "utf8")));
const entry = (c, he) => { const o = cfg(c), v = o[he];
  return o[he] = (v && typeof v === "object") ? v : (typeof v === "string" ? { he: v } : {}); };
for (const [c, he, set] of FIX) {
  const e = entry(c, he), { addAliases, ...rest } = set;
  Object.assign(e, rest);
  if (addAliases) e.addAliases = [...new Set([...(e.addAliases || []), ...addAliases])];
}
for (const [c, o] of Object.entries(cfgs)) writeFileSync(`config/names-${c}.json`, JSON.stringify(o, null, 2) + "\n");
console.log(`תיקונים ${FIX.length}`);
