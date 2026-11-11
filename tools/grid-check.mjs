/* בדיקת הגריד: מייצר גרידים ל-N ימים מהמאגר ומדווח.
   node tools/grid-check.mjs [ימים=120] */
import { readFileSync } from "node:fs";
await import("../src/grid.js");            // מציב globalThis.SportGrid
const G = globalThis.SportGrid;
const J = f => JSON.parse(readFileSync(new URL("../" + f, import.meta.url), "utf8"));

/* בודקים את מה שהמשתמשים מקבלים: dist/players.json (אחרי סינון הבנייה) */
const SD = J("dist/players.json");
const order = SD.order;
const idx = G.buildIndex(SD), conds = G.conditions(SD);
const days = +process.argv[2] || 120;
const multi = idx.people.filter(x => x.clubs.size > 1).length;
console.log(`אנשים: ${idx.people.length} · ביותר ממועדון אחד: ${multi} · בנבחרת: ${idx.people.filter(x => x.caps).length}`);

console.log("\nתשובות לכל צירוף (מועדון × תנאי):");
for (const a of conds.filter(c => c.kind === "club")) {
  console.log(a.he.padEnd(14), conds.filter(b => b !== a).map(b => `${b.he}:${G.answers(idx, a, b).length}`).join("  "));
}

let fail = 0, min = 1e9, seen = new Set(), dup = 0;
for (let n = 0; n < days; n++) {
  const g = G.makeGrid(idx, conds, n);
  if (!g) { fail++; continue; }
  min = Math.min(min, ...g.sizes);
  const key = [...g.rows, ...g.cols].map(c => c.id).join("|");
  if (seen.has(key)) dup++; seen.add(key);
  if (n < 3) console.log(`\nיום ${n}: שורות ${g.rows.map(c => c.he).join(" / ")} · עמודות ${g.cols.map(c => c.he).join(" / ")} · גדלים ${g.sizes}`);
}
console.log(`\n${days} ימים: נכשלו ${fail}, כפולים ${dup}, משבצת הכי דלה ${min} תשובות`);
/* בדיקות שחייבות לעבור */
const rafi = idx.people.filter(x => x.name === "רפי כהן");
console.assert(rafi.length >= 2, "רפי כהן 1965/1970 חייבים להיות שני אנשים");
console.assert(fail === 0, "יום בלי גריד");
for (let n = 0; n < days; n++) { const a = G.makeGrid(idx, conds, n), b = G.makeGrid(idx, conds, n);
  console.assert(JSON.stringify(a.sizes) === JSON.stringify(b.sizes) && a.cols[0].id === b.cols[0].id, "לא דטרמיניסטי " + n); }
/* עשור ואליפות נבדקים באותו מועדון של השורה */
const by = id => conds.find(c => c.id === id);
const mal = idx.people.find(x => x.name === "אורי מלמיליאן");
console.assert(!G.valid(mal, by("club:hapoel-bs"), by("dec:1970")), "מלמיליאן אינו ב\"ש × שנות ה-70");
console.assert(G.valid(mal, by("club:beitar"), by("dec:1970")), "מלמיליאן הוא בית\"ר × שנות ה-70");

/* גריד מועדון: כל מועדון, שנה קדימה */
for (const s of order) {
  let f = 0, mn = 1e9; const seen = new Set();
  for (let n = 0; n < days; n++) {
    const g = G.makeGrid(idx, conds, n, s);
    if (!g) { f++; continue; }
    mn = Math.min(mn, ...g.sizes); seen.add([...g.rows, ...g.cols].map(c => c.id).sort().join("|"));
    for (const a of g.rows) for (const b of g.cols)
      console.assert(G.answers(idx, a, b, g.home).every(x => x.clubs.has(s)), "תשובה מחוץ למועדון " + s);
  }
  console.log(`גריד ${s}: נכשלו ${f}, גרידים שונים ${seen.size}/${days}, משבצת דלה ${mn}`);
  console.assert(f === 0, "יום בלי גריד מועדון " + s);
}
const g0 = G.makeGrid(idx, conds, 0, "beitar");
console.log("דוגמה בית\"ר:", g0.rows.map(c => c.he).join(" / "), "×", g0.cols.map(c => c.he).join(" / "), g0.sizes.join(","));

/* ממצאי QA 11/11: "זר" לפי אזרחות, לא לפי ארץ לידה */
const foreignOf = n => idx.people.filter(x => x.name === n).map(x => x.foreign);
console.assert(!foreignOf("שלום אביטן").some(Boolean), "אביטן (נולד במרסיי, נבחרת) אינו זר");
console.assert(!foreignOf("שייע פייגנבוים").some(Boolean), "פייגנבוים אינו זר");
console.assert(!foreignOf("ברק בדש").some(Boolean), "בדש אינו זר");
/* לוח הגרידים השמור תואם את המחולל ואת התנאים */
for (const s of order) (SD.grids?.[s] || []).forEach((str, n) =>
  console.assert(G.fromIds(conds, str, s, n), `לוח: תנאי לא מוכר ${s} #${n + 1}`));
/* QA סבב 3: שם הפוך מההתאחדות ("כליבאת מוחמד") לצד הרשומה האמיתית = אותו אדם פעמיים */
for (const s of order) {
  const names = new Set(SD.clubs[s].players.map(p => p.he));
  for (const n of names) { const w = n.split(" ");
    for (let i = 1; i < w.length; i++) { const r = [...w.slice(i), ...w.slice(0, i)].join(" ");
      console.assert(r === n || !names.has(r), `כפילות שם הפוך ב-${s}: ${n} / ${r}`); } }
}
