/* rank-check.mjs — הדירוג מחושב פעמיים: בשרת (rankScore_) ובמכשיר
   (rankScore). אם הם נפרדים, השחקן ממקם את עצמו בטבלה של ציון אחר.
   node tools/rank-check.mjs */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const pick = (file, name) => {
  const src = readFileSync(file, "utf8");
  const m = src.match(new RegExp(String.raw`function ${name}\([^)]*\)\s*\{[\s\S]*?
?
\}`));
  assert.ok(m, `${name} not found in ${file}`);
  return m[0];
};
const server = new Function(`var MAX_GUESSES=8,RANK_K=10,RANK_PRIOR=5.5;${pick("server/apps-script.gs", "rankScore_")};return rankScore_`)();
const client = new Function(`const MAX=8;${pick("src/engine.js", "rankScore")};return rankScore`)();
const beats  = new Function(`${pick("src/engine.js", "beats")};return beats`)();

for (const [p, w, s] of [[3,3,3],[80,80,320],[10,7,30],[1,0,0],[200,180,700]])
  assert.equal(client(p, w, s).toFixed(9), server(p, w, s).toFixed(9), `mismatch ${p},${w},${s}`);

// נפח גובר על מזל
assert.ok(client(80, 80, 320) < client(3, 3, 3), "veteran avg 4 must beat 3 lucky 1-guess wins");
// כישלון גרוע מכל פיצוח
assert.ok(client(10, 10, 10*8) < client(10, 9, 9*8), "a loss must cost more than an 8-guess win");
// אחוזונים
const q = Array.from({ length: 101 }, (_, i) => i);
assert.equal(beats(q, 50, false), 50);
assert.equal(beats(q, 50, true), 50);
assert.equal(beats(q, -1, true), 100);
console.log("rank-check ok");
