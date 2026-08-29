/* ============================================================
   audit.mjs — מצליב כל מקור מול המאגר, ומראה איפה הם לא מסכימים.

   node tools/audit.mjs                 כל המועדונים, סיכום + קבצים
   node tools/audit.mjs maccabi-ta      מועדון אחד בלבד
   node tools/audit.mjs --only=seasons  ב-CSV רק ממצאי עונות

   פלט:
     data/review/audit-<slug>.md   דוח קריא, מקובץ לפי סוג הממצא
     data/review/audit.csv         שורה לכל ממצא — נפתח באקסל

   הכלי לא כותב למאגר. הוא מסמן, ומציע שורה מוכנה להדבקה
   ל-config/names-<slug>.json. ההחלטה אנושית, תמיד: ויקיפדיה
   רושמת תקופת חוזה, ההתאחדות ו-worldfootball רושמים סגל בפועל.
   שחקן שהושאל החוצה מופיע אצל ויקיפדיה כאילו נשאר, וזה בדיוק
   סוג ההבדל שאסור להכריע בו אוטומטית.
   ============================================================ */
import { readJSON, writeText, loadClubs, normName, normLatin, shortName, season, toSpells } from "../scripts/lib/util.mjs";

const argv = process.argv.slice(2);
const only = argv.find(a => !a.startsWith("--")) || null;
const onlyKind = (argv.find(a => a.startsWith("--only=")) || "").split("=")[1] || null;

const yearsOf = spells => {
  const out = [];
  for (const [a, b] of spells || []) for (let y = a; y <= b; y++) out.push(y);
  return out;
};
const fmt = ys => ys.length
  ? toSpells(ys).map(([a, b]) => a === b ? season(a) : `${season(a)}-${season(b)}`).join(", ")
  : "-";
const minus = (a, b) => [...a].filter(x => !b.has(x)).sort((x, y) => x - y);

const rows = [];
const stats = [];

for (const club of loadClubs()) {
  if (only && club.slug !== only) continue;
  const db = readJSON(`data/clubs/${club.slug}.json`, null);
  if (!db) continue;

  /* ---------- אינדוקס המקורות ---------- */
  const ifaRaw = readJSON(`data/raw/${club.slug}-ifa.json`, null);
  const ifaById = new Map(), ifaByName = new Map(), idByName = new Map();
  for (const [y, list] of Object.entries(ifaRaw?.seasons || {}))
    for (const p of list) {
      const key = p.id || normName(p.full);
      if (!ifaById.has(key)) ifaById.set(key, []);
      ifaById.get(key).push(+y);
      for (const n of [p.short, p.full]) {
        if (!n) continue;
        if (!ifaByName.has(normName(n))) ifaByName.set(normName(n), key);
        if (p.id) idByName.set(normName(n), p.id);
      }
    }

  const wfRaw = readJSON(`data/raw/${club.slug}-worldfootball.json`, null);
  const wfByName = new Map();
  for (const [y, list] of Object.entries(wfRaw?.seasons || {}))
    for (const p of list) {
      if (!p.name) continue;
      const k = normLatin(p.name);
      if (!wfByName.has(k)) wfByName.set(k, { name: p.name, years: [], pos: null, born: null });
      const r = wfByName.get(k);
      r.years.push(+y);
      if (!r.pos && p.pos) r.pos = p.pos;
      if (r.born == null && p.born) r.born = p.born;
    }

  /* שני ערכי ויקיפדיה באותו שם — "גיא מלמד" יליד 1979 ו-1992 — הם
     בדיוק המקרה שבו אסור להציע תיקון. לכן מפתח מחזיק **רשימה**,
     ומקור נחשב רק כשיש בו בדיוק אחד. */
  const addAll = (map, d, keys) => {
    for (const k of keys) {
      if (!map.has(k)) map.set(k, []);
      if (!map.get(k).includes(d)) map.get(k).push(d);
    }
  };
  const one = (map, keys) => {
    for (const k of keys) {
      const v = map.get(k);
      if (v?.length === 1) return { hit: v[0], ambiguous: false };
      if (v?.length > 1)   return { hit: null,  ambiguous: true  };
    }
    return { hit: null, ambiguous: false };
  };

  const wcRaw = readJSON(`data/raw/${club.slug}-wikicareer.json`, null);
  const wcByName = new Map();
  for (const d of wcRaw?.details || [])
    addAll(wcByName, d, [normName(d.title), normName(d.name), normName(shortName(d.name))]);

  const boxByName = new Map();
  for (const f of ["wikiplayers", "wikiextra"]) {
    const j = readJSON(`data/raw/${club.slug}-${f}.json`, null);
    for (const d of j?.details || [])
      addAll(boxByName, d, [normName(d.title), normName(d.name), normName(shortName(d.name))]);
  }

  /* ---------- מעבר על השחקנים ---------- */
  let clean = 0;
  const found = [];
  for (const p of db.players) {
    const keys = [p.he, ...(p.aliases || [])].filter(Boolean);
    const heKeys = keys.flatMap(n => [normName(n), normName(shortName(n))]);
    const latin  = keys.filter(n => /[A-Za-z]/.test(n)).map(normLatin);

    const ifaKey = keys.map(n => idByName.get(normName(n)) || ifaByName.get(normName(n)))
                       .find(Boolean) || null;
    const ifaYears = new Set(ifaById.get(ifaKey) || []);
    const wf = latin.map(k => wfByName.get(k)).find(Boolean) || null;
    const wcOne = one(wcByName, heKeys);
    const wc = wcOne.hit;
    const wcYears = new Set(wc?.years || []);
    const boxOne = one(boxByName, heKeys);
    const box = boxOne.hit;
    const dubious = wcOne.ambiguous || boxOne.ambiguous;
    const dbYears = new Set(yearsOf(p.spells));
    const id = keys.map(n => idByName.get(normName(n))).find(Boolean) || null;

    const base = {
      slug: club.slug, game: db.game, he: p.he, id,
      db: fmt([...dbYears]), wiki: fmt([...wcYears]),
      ifa: fmt([...ifaYears]), wf: fmt([...(wf?.years || [])]),
      dbPos: p.pos, boxPos: box?.pos ?? null, wfPos: wf?.pos ?? null,
      dbBorn: p.born, boxBorn: box?.born ?? null, wfBorn: wf?.born ?? null
    };

    /* --- עונות --- */
    if (wcYears.size) {
      const missing = minus(wcYears, dbYears);
      const extra   = minus(dbYears, wcYears);
      if (missing.length && extra.length)
        found.push({ ...base, kind: "seasons", verdict: "סתירה",
          detail: `ויקיפדיה מוסיפה ${fmt(missing)} · המאגר מוסיף ${fmt(extra)}`, fix: null });
      else if (missing.length)
        found.push({ ...base, kind: "seasons", verdict: "המאגר קצר מדי",
          detail: `חסרות ${fmt(missing)}` + (wc.ambiguous ? " · בתיבה יש שנה בודדת, בדוק ידנית" : ""),
          fix: wc.ambiguous ? null
             : `"${id ?? p.he}": { "spells": ${JSON.stringify(toSpells([...wcYears, ...dbYears]))} }` });
      else if (extra.length)
        found.push({ ...base, kind: "seasons", verdict: "המאגר ארוך מדי",
          detail: `ויקיפדיה לא מכירה ${fmt(extra)} — ייתכן שאלה עונות השאלה`, fix: null });
      else clean++;
    } else if (!ifaYears.size && !(wf?.years || []).length) {
      found.push({ ...base, kind: "seasons", verdict: "מקור יחיד",
        detail: "אין ויקיפדיה, אין התאחדות, אין worldfootball", fix: null });
    } else clean++;

    if (dubious) {
      found.push({ ...base, kind: "name", verdict: "שני ערכים באותו שם",
        detail: "בוויקיפדיה יש יותר מערך אחד בשם הזה — אין תיקון אוטומטי", fix: null });
    }

    /* --- עמדה --- */
    const posVals = [["ויקיפדיה", box?.pos], ["worldfootball", wf?.pos]].filter(v => v[1]);
    if (p.pos == null && posVals.length)
      found.push({ ...base, kind: "pos", verdict: "יש מקור, לא נכנס",
        detail: posVals.map(v => `${v[0]}: ${v[1]}`).join(" · "),
        fix: dubious ? null : `"${id ?? p.he}": { "pos": "${posVals[0][1]}" }` });
    else if (p.pos == null)
      found.push({ ...base, kind: "pos", verdict: "אין בשום מקור", detail: "", fix: null });
    else if (posVals.length && posVals.some(v => v[1] !== p.pos))
      found.push({ ...base, kind: "pos", verdict: "סתירה",
        detail: `מאגר: ${p.pos} · ` + posVals.map(v => `${v[0]}: ${v[1]}`).join(" · "), fix: null });

    /* --- שנת לידה --- */
    const bornVals = [["ויקיפדיה", box?.born], ["worldfootball", wf?.born]].filter(v => v[1]);
    if (p.born == null && bornVals.length)
      found.push({ ...base, kind: "born", verdict: "יש מקור, לא נכנס",
        detail: bornVals.map(v => `${v[0]}: ${v[1]}`).join(" · "),
        fix: dubious ? null : `"${id ?? p.he}": { "born": ${bornVals[0][1]} }` });
    else if (p.born == null)
      found.push({ ...base, kind: "born", verdict: "אין בשום מקור", detail: "", fix: null });
    else if (bornVals.length && bornVals.some(v => v[1] !== p.born))
      found.push({ ...base, kind: "born", verdict: "סתירה",
        detail: `מאגר: ${p.born} · ` + bornVals.map(v => `${v[0]}: ${v[1]}`).join(" · "), fix: null });
  }

  const byKind = k => found.filter(f => f.kind === k);
  stats.push({
    game: db.game, players: db.players.length, clean,
    seasonsBad: byKind("seasons").length, posBad: byKind("pos").length,
    bornBad: byKind("born").length, fixable: found.filter(f => f.fix).length
  });
  rows.push(...found);

  /* ---------- דוח למועדון ---------- */
  const out = [];
  out.push(`# בדיקת מקורות - ${db.game}`);
  out.push("");
  out.push(`${db.players.length} שחקנים במאגר · ${found.length} ממצאים · ` +
           `${found.filter(f => f.fix).length} עם תיקון מוכן להדבקה`);
  out.push("");
  out.push("המקורות: ויקיפדיה העברית (תיבת המידע וטבלת הקריירה), ההתאחדות");
  out.push("לכדורגל, ו-worldfootball. ויקיפדיה רושמת תקופת חוזה; השניים");
  out.push("האחרים רושמים סגל בפועל. ההפרש ביניהם הוא לרוב השאלה, ולכן");
  out.push('"המאגר ארוך מדי" לא מקבל תיקון אוטומטי.');
  out.push("");
  const TITLES = { seasons: "עונות", pos: "עמדה", born: "שנת לידה", name: "זהות" };
  for (const kind of ["seasons", "pos", "born", "name"]) {
    const list = byKind(kind);
    if (!list.length) continue;
    out.push(`## ${TITLES[kind]} - ${list.length}`);
    out.push("");
    for (const v of [...new Set(list.map(f => f.verdict))]) {
      const sub = list.filter(f => f.verdict === v);
      out.push(`### ${v} - ${sub.length}`);
      out.push("");
      out.push("| שם | מפתח | מאגר | ויקיפדיה | התאחדות | worldfootball | פירוט |");
      out.push("|---|---|---|---|---|---|---|");
      for (const f of sub)
        out.push(`| ${f.he} | ${f.id ?? "*(שם)*"} | ${f.db} | ${f.wiki} | ${f.ifa} | ${f.wf} | ${f.detail} |`);
      out.push("");
      const fixes = sub.filter(f => f.fix);
      if (fixes.length) {
        out.push("להדבקה ב-`config/names-" + club.slug + ".json`:");
        out.push("");
        out.push("```json");
        for (const f of fixes) out.push(f.fix + ",");
        out.push("```");
        out.push("");
      }
    }
  }
  writeText(`data/review/audit-${club.slug}.md`, out.join("\n") + "\n");
}

/* ---------- CSV אחד לכולם ---------- */
const CSV = [["מועדון", "שם", "מפתח", "סוג", "ממצא", "פירוט",
              "עונות במאגר", "עונות ויקיפדיה", "עונות התאחדות", "עונות worldfootball",
              "עמדה מאגר", "עמדה ויקיפדיה", "עמדה wf",
              "לידה מאגר", "לידה ויקיפדיה", "לידה wf", "תיקון מוצע"]];
const KIND = { seasons: "עונות", pos: "עמדה", born: "שנת לידה", name: "זהות" };
for (const f of rows) {
  if (onlyKind && f.kind !== onlyKind) continue;
  CSV.push([f.game, f.he, f.id ?? "", KIND[f.kind], f.verdict, f.detail,
            f.db, f.wiki, f.ifa, f.wf,
            f.dbPos ?? "", f.boxPos ?? "", f.wfPos ?? "",
            f.dbBorn ?? "", f.boxBorn ?? "", f.wfBorn ?? "", f.fix ?? ""]);
}
const esc = v => '"' + String(v).replace(/"/g, '""') + '"';
/* BOM — בלעדיו אקסל בווינדוס קורא UTF-8 כ-1255 והעברית יוצאת ג'יבריש */
writeText("data/review/audit.csv",
  "﻿" + CSV.map(r => r.map(esc).join(",")).join("\r\n") + "\r\n");

/* ---------- מסך ---------- */
const pad = (s, n) => String(s).padEnd(n), num = (s, n) => String(s).padStart(n);
console.log(`\n${pad("מועדון", 14)} ${num("שחקנים", 7)} ${num("עונות", 7)} ${num("עמדה", 6)} ${num("לידה", 6)} ${num("תיקון מוכן", 11)}`);
console.log("-".repeat(56));
for (const s of stats)
  console.log(`${pad(s.game, 14)} ${num(s.players, 7)} ${num(s.seasonsBad, 7)} ${num(s.posBad, 6)} ${num(s.bornBad, 6)} ${num(s.fixable, 11)}`);
console.log(`\nנכתבו data/review/audit-<מועדון>.md ו-data/review/audit.csv (${rows.length} ממצאים).`);
