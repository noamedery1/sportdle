/* מחלץ את PLAYERS_RAW ו-SCHEDULE מתוך reference/beitardle.html
   לקובץ fixture, כדי שנוכל להשוות מולו את פלט הצינור.
   רץ פעם אחת. לא חלק מהבנייה. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const html = readFileSync("reference/beitardle.html", "utf8");

function grab(name) {
  const start = html.indexOf(`const ${name} = [`);
  if (start < 0) throw new Error(`לא נמצא ${name}`);
  const open = html.indexOf("[", start);
  let depth = 0, i = open;
  for (; i < html.length; i++) {
    if (html[i] === "[") depth++;
    else if (html[i] === "]") { depth--; if (!depth) break; }
  }
  return html.slice(open, i + 1);
}

const players  = new Function(`return ${grab("PLAYERS_RAW")}`)();
const schedule = new Function(`return ${grab("SCHEDULE")}`)();

mkdirSync("data/reference", { recursive: true });
writeFileSync("data/reference/beitar-reference.json",
  JSON.stringify({ players, schedule }, null, 1), "utf8");

console.log(`שחקנים: ${players.length}`);
console.log(`בבריכת התשובות (target): ${players.filter(p => p.target).length}`);
console.log(`בלוח: ${schedule.length}`);

/* בדיקה: איזה כלל ספירת תארים משחזר את הנתונים בפועל? */
const LEAGUE = [1987, 1993, 1997, 1998, 2007, 2008];
const CUPS   = [1976, 1979, 1985, 1986, 1989, 2008, 2009, 2023];
const ALL    = [...LEAGUE, ...CUPS];
const rules = {
  "a<=t<=b": (s, y) => s.some(([a, b]) => y >= a && y <= b),
  "a< t<=b": (s, y) => s.some(([a, b]) => y >  a && y <= b),
};
for (const [label, fn] of Object.entries(rules)) {
  const bad = players.filter(p => ALL.filter(y => fn(p.spells, y)).length !== p.titles);
  console.log(`כלל ${label}: ${bad.length} סטיות` +
    (bad.length ? ` — לדוגמה ${bad.slice(0, 3).map(p => p.he).join(", ")}` : ""));
}
