/* ============================================================
   בדיקת עונות השאלה — כל השחקנים בכל המועדונים.

     node tools/loan-audit.mjs            → data/review/loans.json + loans.md
     node tools/loan-audit.mjs --name="איתן טיבי"

   לכל שחקן שבטבלת הקריירה שלו בוויקיפדיה יש שורת מועדון אחר בתוך
   התקופה שלו אצלנו (scrape.mjs → `away`), מדפיס:
     - העונות, המועדון שאליו הושאל, ומה ההתאחדות/טרנספרמרקט אומרות
     - remove (הוסרה ב-enrich) / conflict (נשארה — מקור עונתי רושם אותו)
     - תארים עם עונות ההשאלה מול בלעדיהן
   conflict = לבדיקה ידנית; ההכרעה נרשמת ב-config/names-<slug>.json
   (spells ידני) והוא גובר על הכל.

   קודם: node scripts/scrape.mjs --source=wikicareer, ואחריו npm run enrich.
   ============================================================ */
import { readJSON, writeJSON, writeText, parseArgs, normName, stripParen, countTitles, season, toSpells } from "../scripts/lib/util.mjs";
import { seasonIndex, loanVerdicts } from "../scripts/lib/loans.mjs";

const args = parseArgs();
const site = readJSON("config/clubs.json");   // { beitar: {...}, ... } + _comment
const slugs = Object.keys(site).filter(k => !k.startsWith("_")).filter(s => readJSON(`data/raw/${s}-wikicareer.json`, null));
const flat = sp => (sp || []).flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i));

const out = [];
for (const slug of slugs) {
  const club = readJSON(`data/clubs/${slug}.json`);
  const titleYears = [...club.titles.league, ...club.titles.cup];
  const wc = readJSON(`data/raw/${slug}-wikicareer.json`).details.filter(d => d.away?.length);
  const byName = new Map(wc.map(d => [normName(d.name), d]));
  const idx = seasonIndex(slug);
  for (const p of club.players) {
    if (args.name && normName(p.he) !== normName(args.name)) continue;
    const w = (p.wiki && wc.find(d => d.title === p.wiki)) || byName.get(normName(stripParen(p.he)));
    if (!w) continue;
    const now = new Set(flat(p.spells));
    const v = loanVerdicts(p.he, w.away, new Set([...flat(w.spells), ...now]), idx);
    if (!v.length) continue;
    const withLoans = toSpells([...now, ...v.map(x => x.y)]);
    out.push({
      club: slug, he: p.he, target: !!p.target,
      spells: p.spells,
      loans: v.map(x => ({ season: season(x.y), verdict: now.has(x.y) ? "conflict" : "remove", seen: x.seen })),
      to: w.awayRows,
      titles: { now: p.titles, withLoans: countTitles(withLoans, titleYears) }
    });
  }
}

out.sort((a, b) => (b.titles.withLoans - b.titles.now) - (a.titles.withLoans - a.titles.now) || a.club.localeCompare(b.club));
if (args.name) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }

writeJSON("data/review/loans.json", out, 1);
const conf = out.filter(r => r.loans.some(l => l.verdict === "conflict"));
const md = [
  "# עונות השאלה — דוח בדיקה",
  "",
  `${out.length} שחקנים עם עונות השאלה בוויקיפדיה · ${out.filter(r => r.titles.withLoans !== r.titles.now).length} שהתארים שלהם השתנו · ${conf.length} בסתירה (לבדיקה ידנית).`,
  "",
  "remove = הוסרה (אף מקור עונתי לא רושם אותו אצלנו) · conflict = נשארה, ההתאחדות/טרנספרמרקט רושמים אותו באותה עונה.",
  "",
  "| מועדון | שחקן | בלוח | עונות השאלה | לאן | תארים (היה→עכשיו) |",
  "|---|---|---|---|---|---|",
  ...out.map(r => `| ${r.club} | ${r.he} | ${r.target ? "✓" : ""} | ${r.loans.map(l => l.season + (l.verdict === "conflict" ? ` ⚠️(${l.seen.join("+") || "ידני"})` : "")).join(", ")} | ${r.to.map(t => `${t.club} ${t.years}`).join("; ")} | ${r.titles.withLoans}→${r.titles.now} |`)
].join("\n");
writeText("data/review/loans.md", md + "\n");
console.log(`${out.length} שחקנים · ${conf.length} בסתירה → data/review/loans.md`);
