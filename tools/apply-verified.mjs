/* apply-verified.mjs — מכניס למאגר רק ערכים שאומתו משני מקורות.

   node tools/apply-verified.mjs <verified.json> <missing-full.json> [--dry]

   קלט: קובץ המחקר (data/review/research/verified-*.json) — שורה לכל
   (שחקן, שדה) עם status. נכנס **רק status === "verified"**.

   לאן: config/names-<club>.json, המנגנון הקיים של תיקונים ידניים
   (applyFix ב-enrich.mjs). מפתח = ifaId אם כבר יש לשחקן רשומה תחתיו,
   אחרת השם העברי.

   מדיניות הבריכה (12/10/2026, נועם): שחקן שהשלמה הופכת לכשיר — guessOnly.
   לוח החידות לא גדל. מי שכבר target לא מסומן (זה היה מוציא אותו מהבריכה). */
import { readFileSync, writeFileSync } from "node:fs";

const [, , verPath, invPath, flag] = process.argv;
const dry = flag === "--dry";
const J = p => JSON.parse(readFileSync(p, "utf8"));
const ver = J(verPath), inv = J(invPath);
const invBy = new Map(inv.players.map(p => [p.club + "|" + p.he, p]));

const byClub = {};
let n = 0;
for (const r of ver.players) {
  if (r.status !== "verified") continue;
  const meta = invBy.get(r.club + "|" + r.he);
  if (!meta) { console.warn("לא במלאי, דילוג:", r.club, r.he); continue; }
  (byClub[r.club] ||= new Map());
  const cur = byClub[r.club].get(r.he) || { meta, set: {} };
  cur.set[r.field] = r.value;
  byClub[r.club].set(r.he, cur);
  n++;
}

for (const [club, players] of Object.entries(byClub)) {
  const path = `config/names-${club}.json`;
  const cfg = J(path);
  for (const [he, { meta, set }] of players) {
    const key = meta.ifaId != null && cfg[String(meta.ifaId)] ? String(meta.ifaId) : he;
    const prev = typeof cfg[key] === "object" && cfg[key] ? cfg[key] : (typeof cfg[key] === "string" ? { he: cfg[key] } : {});
    const next = { ...prev, ...set };
    /* כשיר אחרי ההשלמה (יש לידה ועמדה) ולא היה target — לניחוש בלבד */
    const born = next.born ?? meta.born, pos = next.pos ?? meta.pos;
    if (!meta.target && born != null && pos != null) next.guessOnly = true;
    cfg[key] = next;
  }
  console.log(`${club}: ${players.size} שחקנים`);
  if (!dry) writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n");
}
console.log(`סה"כ ${n} שדות מאומתים${dry ? " (dry)" : ""}`);
