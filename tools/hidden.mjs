/* מי לא מוצג במשחק, ולמה.
   שחקן בלי עמדה וגם בלי שנת לידה יורד מהמשחק ב-build.mjs: ניחוש
   עליו לא נותן את הרמז הראשון, והוא לא יכול להיות תשובה. הוא
   נשאר במאגר, וכאן הרשימה שצריך למלא כדי להחזיר אותו.

   node tools/hidden.mjs             סיכום + כתיבת data/review/hidden.md
   node tools/hidden.mjs maccabi-ta  פירוט למועדון אחד למסך */
import { readJSON, writeText, loadClubs, normName, season } from "../scripts/lib/util.mjs";

const only = process.argv[2];

/* player_id של ההתאחדות — המפתח היציב ל-config/names-<slug>.json */
const ifaCache = new Map();
function ifaId(slug, player) {
  if (!ifaCache.has(slug)) {
    const raw = readJSON(`data/raw/${slug}-ifa.json`, null);
    const m = new Map();
    for (const list of Object.values(raw?.seasons || {}))
      for (const p of list) {
        if (p.id == null) continue;
        m.set(normName(p.full), p.id);
        m.set(normName(p.short), p.id);
      }
    ifaCache.set(slug, m);
  }
  const m = ifaCache.get(slug);
  for (const k of [player.he, ...(player.aliases || [])])
    if (m.has(normName(k))) return m.get(normName(k));
  return null;
}

const span = p => p.spells.map(([a, b]) =>
  a === b ? season(a) : `${season(a)}–${season(b)}`).join(", ");

const rows = [];
for (const c of loadClubs()) {
  if (only && c.slug !== only) continue;
  const d = readJSON(`data/clubs/${c.slug}.json`, null);
  if (!d) continue;
  const tag = p => ({
    he: p.he, id: ifaId(c.slug, p), seasons: p.seasons, span: span(p),
    titles: p.titles, nat: p.nat, pos: p.pos, born: p.born,
    aliases: (p.aliases || []).filter(a => a !== p.he)
  });
  rows.push({
    slug: c.slug, game: d.game, total: d.players.length,
    /* מוסתר — אין עמדה */
    out: d.players.filter(p => p.pos == null)
      .sort((a, b) => b.seasons - a.seasons || a.he.localeCompare(b.he, "he")).map(tag),
    /* מוצג, אבל שנת הלידה עדיין "?" */
    partial: d.players.filter(p => p.pos != null && p.born == null)
      .sort((a, b) => b.seasons - a.seasons || a.he.localeCompare(b.he, "he")).map(tag)
  });
}

/* ---------- מסך ---------- */
const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);
console.log(`\n${pad("מועדון", 14)} ${num("במאגר", 6)} ${num("מוסתרים", 9)} ${num("במשחק", 7)} ${num("חלקיים", 8)}`);
console.log("─".repeat(50));
for (const r of rows)
  console.log(`${pad(r.game, 14)} ${num(r.total, 6)} ${num(r.out.length, 9)} ` +
              `${num(r.total - r.out.length, 7)} ${num(r.partial.length, 8)}`);
console.log(`\n"מוסתרים" = בלי עמדה — לא מוצגים במשחק.` +
            `\n"חלקיים"  = מוצגים, אבל שנת הלידה עדיין "?".`);

if (only && rows[0]) {
  console.log(`\n── ${rows[0].game}: מוסתרים ──`);
  console.log(`   העתק־הדבק ל-config/names-${rows[0].slug}.json, מלא את מה שחסר:\n`);
  for (const p of rows[0].out)
    console.log(`  "${p.id ?? p.he}": { "pos": "??", "born": 0 },`.padEnd(48) +
      `// ${p.he} · ${p.seasons} עונות · ${p.span}` +
      (p.id ? "" : "  ← אין player_id, מפתח לפי שם"));
}

/* ---------- קובץ ---------- */
const POS_HE = { GK: "שוער", DF: "מגן", MF: "קשר", FW: "חלוץ" };
const out = [];
out.push("# מי לא מוצג במשחק");
out.push("");
out.push("שחקן בלי עמדה יורד מהמשחק: העמדה היא הרמז הראשון, וסימן");
out.push("שאלה במקומה לא מלמד כלום. הוא גם לא יכול להיות תשובה. הוא נשאר");
out.push("במאגר — הרשימה כאן היא מה שצריך למלא כדי להחזיר אותו.");
out.push("");
out.push("התיקון: `config/names-<slug>.json`, מפתח לפי `player_id` של ההתאחדות");
out.push("(או לפי השם כשאין), ואחר כך `node scripts/enrich.mjs && node scripts/build.mjs`.");
out.push("");
out.push("| מועדון | במאגר | מוסתרים | במשחק | חלקיים |");
out.push("|---|---|---|---|---|");
for (const r of rows)
  out.push(`| ${r.game} | ${r.total} | **${r.out.length}** | ${r.total - r.out.length} | ${r.partial.length} |`);
out.push("");
for (const r of rows) {
  out.push(`## ${r.game} — ${r.out.length} מוסתרים`);
  out.push("");
  if (!r.out.length) out.push("אין. כל השחקנים במשחק.");
  else {
    out.push("| שם | מפתח לתיקון | עונות | תקופה | תארים | שמות נוספים |");
    out.push("|---|---|---|---|---|---|");
    for (const p of r.out)
      out.push(`| ${p.he} | ${p.id ?? "*(לפי שם)*"} | ${p.seasons} | ${p.span} | ${p.titles} | ${p.aliases.join(", ")} |`);
  }
  out.push("");
  if (r.partial.length) {
    out.push(`### ${r.game} — ${r.partial.length} חלקיים (מוצגים עם "?" אחד)`);
    out.push("");
    out.push("| שם | מפתח לתיקון | חסר | יש | עונות | תקופה |");
    out.push("|---|---|---|---|---|---|");
    for (const p of r.partial) {
      const miss = p.pos == null ? "עמדה" : "שנת לידה";
      const has  = p.pos == null ? `נולד ${p.born}` : POS_HE[p.pos] || p.pos;
      out.push(`| ${p.he} | ${p.id ?? "*(לפי שם)*"} | ${miss} | ${has} | ${p.seasons} | ${p.span} |`);
    }
    out.push("");
  }
}
if (!only) console.log("\nנכתב " + writeText("data/review/hidden.md", out.join("\n") + "\n"));
