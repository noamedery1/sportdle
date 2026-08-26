/* בדיקת שלמות מול ויקיפדיה — התפקיד שסעיף 3 במפרט ייעד לה.
   מי שמקוטלג כשחקן המועדון בוויקיפדיה אבל לא נמצא במאגר שבנינו.

   node tools/missing-players.mjs            סיכום
   node tools/missing-players.mjs maccabi-ta פירוט */
import { readJSON, loadClubs, normName, shortName, nameVariants } from "../scripts/lib/util.mjs";

const only = process.argv[2];
const rows = [];

for (const c of loadClubs()) {
  if (only && c.slug !== only) continue;
  const club = readJSON(`data/clubs/${c.slug}.json`, null);
  const cat  = readJSON(`data/raw/${c.slug}-wikipedia.json`, null);
  if (!club || !cat) continue;

  /* כל מה שיש במאגר, בכל צורה שאפשר לזהות לפיה */
  const have = new Set();
  for (const p of club.players)
    for (const n of [p.he, ...(p.aliases || [])])
      for (const k of [normName(n), normName(shortName(n)), ...nameVariants(n)])
        have.add(k);

  const missing = [];
  for (const e of cat.entries) {
    const keys = [e.name, e.title, e.short].filter(Boolean)
      .flatMap(n => [normName(n), normName(shortName(n)), ...nameVariants(n)]);
    if (keys.some(k => have.has(k))) continue;
    missing.push(e.name);
  }
  rows.push({ slug: c.slug, game: club.game, cat: cat.entries.length,
              have: club.players.length, missing });
}

const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);
console.log(`\n${pad("מועדון", 13)} ${num("בקטגוריה", 9)} ${num("במאגר", 7)} ${num("חסרים", 7)}`);
console.log("─".repeat(42));
for (const r of rows)
  console.log(`${pad(r.game, 13)} ${num(r.cat, 9)} ${num(r.have, 7)} ${num(r.missing.length, 7)}`);
console.log(`\n"חסרים" = יש להם ערך ויקיפדיה שמקטלג אותם כשחקני המועדון,` +
            `\nאבל אף אחד משני מקורות הסגל לא מכיר אותם שם.`);

if (only && rows[0]) {
  console.log(`\n── ${rows[0].game}: ${rows[0].missing.length} חסרים ──`);
  rows[0].missing.forEach(n => console.log("  · " + n));
}
