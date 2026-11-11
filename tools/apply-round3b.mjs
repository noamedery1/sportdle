/* apply-round3b.mjs — מחקר סבבים 2+3: שדות חסרים שאומתו (status === "verified",
   ≥2 מקורות מסכימים) ושחקנים חדשים שכל שדותיהם אומתו. guessOnly — הלוח לא גדל.
   רק שדה שחסר במאגר (current == null) — לא דורס ערך קיים; סתירות הולכות
   ל-apply-round3.mjs (ידני, אחרי בדיקה). אידמפוטנטי. */
import { readFileSync, writeFileSync } from "node:fs";

const J = p => JSON.parse(readFileSync(p, "utf8"));
/* node tools/apply-round3b.mjs [round3|round4|...] — אותם כללים לכל סבב */
const R = process.argv[2] || "round3";
const rows = J(`data/review/research/${R}-fields.json`).players;
const fresh = J(`data/review/research/${R}-new-players.json`).players;
const SKIP_NEW = new Set(["יוסי קרמר", "יוסי שושני"]);   // עונות סותרות את TM (סבב 2)

const target = new Set();
for (const c of ["beitar", "hapoel-bs", "hapoel-ta", "maccabi-haifa", "maccabi-ta"])
  for (const p of J(`data/clubs/${c}.json`).players) if (p.target) target.add(c + "|" + p.he);

const cfgs = {};
const cfg = c => (cfgs[c] ||= J(`config/names-${c}.json`));
const entry = (c, he) => { const o = cfg(c), v = o[he];
  return o[he] = (v && typeof v === "object") ? v : (typeof v === "string" ? { he: v } : {}); };

let f = 0, n = 0;
for (const r of rows) {
  if (r.status !== "verified" || r.current != null) continue;
  const e = entry(r.club, r.he);
  if (e[r.field] == null) { e[r.field] = r.value; f++; }
  /* מי שההשלמה הופכת לכשיר — לניחוש בלבד (מדיניות 12/10) */
  if (!target.has(r.club + "|" + r.he)) e.guessOnly = true;
}
for (const p of fresh) {
  if (SKIP_NEW.has(p.he) || p.current || !Object.values(p.status).every(s => s === "verified")) continue;
  const e = entry(p.club, p.he);
  if (e.add) continue;                                    // נוסף כבר בסבב 2
  Object.assign(e, { add: true, born: p.born, pos: p.pos, nat: p.nat, spells: p.spells, guessOnly: true });
  n++;
}
for (const [c, o] of Object.entries(cfgs)) writeFileSync(`config/names-${c}.json`, JSON.stringify(o, null, 2) + "\n");
console.log(`שדות ${f} · שחקנים חדשים ${n}`);
