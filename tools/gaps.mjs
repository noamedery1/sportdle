/* מפה של מה חסר. מריצים אחרי enrich.
   node tools/gaps.mjs            סיכום לכל המועדונים
   node tools/gaps.mjs maccabi-ta פירוט שמות למועדון אחד */
import { readJSON, loadClubs, normName } from "../scripts/lib/util.mjs";

const only = process.argv[2];
const WF_FROM = 1970, IFA_FROM = 2003;

/* player_id של ההתאחדות — זה המפתח שצריך לכתוב ב-config/names-<slug>.json,
   ולא השם, כי השם לא בהכרח ייחודי. */
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

const rows = [];
for (const c of loadClubs()) {
  if (only && c.slug !== only) continue;
  const d = readJSON(`data/clubs/${c.slug}.json`, null);
  const r = readJSON(`data/review/${c.slug}.json`, null);
  if (!d) continue;

  const cand = d.players.filter(p => p.seasons >= 3);          // מועמדים לבריכה
  const noPos  = cand.filter(p => !p.pos);
  const noBorn = cand.filter(p => !p.born);
  const blocked = cand.filter(p => !p.pos || !p.born);
  const seasonsHave = new Set(d.players.flatMap(p => {
    const out = []; for (const [a, b] of p.spells) for (let y = a; y <= b; y++) out.push(y); return out;
  }));
  const missingSeasons = [];
  for (let y = WF_FROM; y < IFA_FROM; y++) if (!seasonsHave.has(y)) missingSeasons.push(y);

  rows.push({
    slug: c.slug, game: d.game,
    players: d.counts.players, pool: d.counts.targets,
    cand: cand.length, blockedCount: blocked.length,
    noPos: noPos.length, noBorn: noBorn.length,
    ambiguous: r?.ambiguous.length || 0,
    missingSeasons: missingSeasons.length,
    span: `${d.coverage.from}–${d.coverage.to}`,
    /* שחקנים שworldfootball מכיר אבל אין להם שם עברי — הם לא
       במאגר בכלל, אז הם לא נספרים כ"חסומים". זה הפער האמיתי שנשאר. */
    noHe: (r?.noHebrew || []).filter(x => x.seasons >= 3),
    blocked: blocked.map(p => ({ p, id: ifaId(c.slug, p) })),
    ambiguousNames: (r?.ambiguous || []).map(a => `${a.he} — ${a.why}`)
  });
}

const pad = (s, n) => String(s).padEnd(n);
const num = (s, n) => String(s).padStart(n);
console.log(`\n${pad("מועדון", 14)} ${num("שחקנים", 7)} ${num("בריכה", 6)} ${num("מועמדים", 8)} ` +
            `${num("חסומים", 7)} ${num("בלי עמדה", 9)} ${num("בלי שם עברי", 13)} ${num("עונות חסרות", 12)}`);
console.log("─".repeat(78));
for (const r of rows)
  console.log(`${pad(r.game, 14)} ${num(r.players, 7)} ${num(r.pool, 6)} ${num(r.cand, 8)} ` +
              `${num(r.blockedCount, 7)} ${num(r.noPos, 9)} ${num(r.noHe.length, 13)} ${num(r.missingSeasons, 12)}`);

console.log(`\n"מועמדים" = שיחקו 3 עונות ומעלה.` +
  `\n"חסומים"  = במאגר, אבל בלי עמדה או שנת לידה — לא נכנסים לבריכה.` +
  `\n"בלי שם עברי" = worldfootball מכיר אותם ואין גשר לעברית, אז הם לא במאגר בכלל.` +
  `\n"עונות חסרות" = מתוך 1970–2002.`);

if (only && rows[0]) {
  console.log(`\n── ${rows[0].game}: מועמדים חסומים ──`);
  console.log(`   העתק־הדבק ל-config/names-${rows[0].slug}.json, מלא את מה שחסר:\n`);
  for (const { p, id } of rows[0].blocked) {
    const need = [!p.pos && `"pos": "??"`, !p.born && `"born": 0`].filter(Boolean).join(", ");
    const key = id ?? p.he;
    console.log(`  "${key}": { ${need} },`.padEnd(46) +
      `// ${p.he} · ${p.seasons} עונות${id ? "" : "  ← אין player_id, מפתח לפי שם"}`);
  }
  if (rows[0].noHe.length) {
    console.log(`\n── ${rows[0].game}: יש ב-worldfootball, אין שם עברי ──`);
    console.log(`   הוסף ל-config/names-${rows[0].slug}.json כ- "<שם אנגלי>": "<שם עברי>"\n`);
    for (const x of rows[0].noHe)
      console.log(`  ${JSON.stringify(x.en)}: "",`.padEnd(40) +
        `// ${x.seasons} עונות · ${x.span || ""} · ${x.pos || "?"} · ${x.born || "?"}`);
  }
  if (rows[0].ambiguousNames.length) {
    console.log(`\n── דו-משמעיים (שני ערכי ויקיפדיה באותו שם) ──`);
    rows[0].ambiguousNames.forEach(n => console.log("  · " + n));
  }
}
