/* ============================================================
   rsssf.mjs — RSSSF כמקור אימות ומקור צמיחה.

   node tools/rsssf.mjs            משתמש במטמון אם קיים
   node tools/rsssf.mjs --force    מושך מחדש מ-rsssf.org
   node tools/rsssf.mjs --today=2026-10-11   קובע את "היום" ללוח

   מה נמשך (fetch רגיל, בלי Cloudflare, בקשה לשנייה):
     tablesi/isra99squads … isra03squads   סגל מלא לכל קבוצה:
         שם, עמדה, תאריך לידה, לאום, הערות (הצטרף/עזב באמצע העונה)
     tablesi/israYY.html                    דף העונה: מבקיעים לכל
         משחק בשני טורים — שמאל = בית, ימין = חוץ. 1995/96 ואילך.
         בעונות מוקדמות יותר רק רשימת "Top Scorers" עם שם המועדון.
     tablesi/isratops.html                  מלך השערים לכל עונה

   פלט:
     data/raw/rsssf-squads.json     מטמון סגלים
     data/raw/rsssf-scorers.json    מטמון מבקיעים
     data/review/research/rsssf.md  הדוח
     data/review/research/rsssf.json

   הכלל של VERIFY.md חל גם כאן: **הכלי לא כותב למאגר.** הוא מסמן.

   הגשר לטיני ⇄ עברי, בשלוש מדרגות, וכל אחת מחייבת אישור
   בשנת לידה או בחפיפת עונות:
     1. שם זהה (normLatin) לשם לטיני שכבר מקושר לרשומה העברית:
        כינוי לטיני ב-aliases, קישור בין־לשוני (wikilang/enbridge),
        או רשומת worldfootball/Transfermarkt שקושרה לרשומה באותו
        מבחן שבו משתמש tools/trust.mjs.
     2. שלד עיצורים לטיני — "Cobi Refua" מול "Kobi Refua",
        "Shay Holtzman" מול "Shai Holzman". מועמד יחיד בלבד.
     3. מסנן התעתיק של scripts/lib/translit.mjs, עם דירוג.
   מה שלא מוכרע — נרשם כדו־משמעי. לא מנחשים.
   ============================================================ */
import { existsSync } from "node:fs";
import { readJSON, writeJSON, writeText, loadClubs, normName, normLatin, season, parseArgs, sleep, log } from "../scripts/lib/util.mjs";
import { plausible, score } from "../scripts/lib/translit.mjs";

const args = parseArgs();
const BASE = "https://www.rsssf.org/tablesi/";
const SQUAD_FILE = "data/raw/rsssf-squads.json";
const SCORER_FILE = "data/raw/rsssf-scorers.json";
const SQUAD_PAGES = ["99", "00", "01", "02", "03"];
/* דפי עונה: 1985/86 עד 2002/03. לפני 85/86 אין בדפים מבקיעים כלל
   (נבדק: 69/70, 74/75, 79/80, 83/84, 84/85 — טבלה בלבד). */
const SEASON_PAGES = ["86", "87", "88", "89", "90", "91", "92", "93", "94", "95",
                      "96", "97", "98", "99", "00", "01", "02", "03"];

/* ---------- שמות המועדונים כפי ש-RSSSF כותב אותם ---------- */
const teamKey = s => String(s || "").replace(/\([^)]*\)/g, " ").replace(/['’]/g, "")
  .replace(/[-.]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
const TEAMS = {
  "beitar jerusalem": "beitar", "beitar jerushalaim": "beitar",
  "hapoel beer sheva": "hapoel-bs", "hapoel beer shevah": "hapoel-bs", "hapoel beersheva": "hapoel-bs",
  "hapoel tel aviv": "hapoel-ta",
  "maccabi haifa": "maccabi-haifa",
  "maccabi tel aviv": "maccabi-ta"
};
const slugOf = s => TEAMS[teamKey(s)] || null;

/* ============================================================
   1. משיכה
   ============================================================ */
let lastHit = 0;
async function get(page) {
  const wait = 1000 - (Date.now() - lastHit);
  if (wait > 0) await sleep(wait);
  lastHit = Date.now();
  const url = BASE + page;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (sportdle research; polite 1 req/s)" } });
  if (!res.ok) { log(`  ${url} → ${res.status}`); return null; }
  /* דפי הסגל ב-ISO-8859-1 ("Jérôme"), השאר ASCII */
  return new TextDecoder("windows-1252").decode(await res.arrayBuffer());
}
const strip = s => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ");
const endYearOf = title => {
  const m = String(title).match(/(\d{4})\s*[\/-]\s*(\d{2,4})/);
  if (!m) return null;
  return m[2].length === 4 ? +m[2] : Math.floor(+m[1] / 100) * 100 + +m[2] + (+m[2] < +m[1] % 100 ? 100 : 0);
};

const POS = { GK: "GK", DEF: "DF", DF: "DF", MID: "MF", MF: "MF", FWD: "FW", FW: "FW" };

function parseSquads(html) {
  const title = (html.match(/<TITLE>([^<]*)<\/TITLE>/i) || [])[1] || "";
  const year = endYearOf(title);
  const clubs = {};
  /* כל קבוצה: <H3>שם</H3><PRE>…</PRE> */
  const re = /<H3>([^<]+)<\/H3>\s*<PRE>([\s\S]*?)<\/PRE>/gi;
  let m;
  while ((m = re.exec(html))) {
    const team = strip(m[1]).trim();
    const slug = slugOf(team);
    if (!slug) continue;
    const list = [];
    /* עמודות קבועות לפי שורת הכותרת. regex לבדו נכשל כשתאריך הלידה
       חסר: "Eyal Vakrat  GK  Israel  joined during the season" */
    const lines = m[2].split(/\r?\n/).map(l => strip(l).replace(/\s+$/, ""));
    const head = lines.find(l => /^Name\s+Position/i.test(l)) || "";
    const col = { pos: head.indexOf("Position"), dob: head.indexOf("Birth"),
                  nat: head.indexOf("Nationality"), rem: head.indexOf("Remarks") };
    for (const line of lines) {
      if (/Coach:/i.test(line)) break;           // מכאן והלאה — מאמן, לא שחקן
      if (!line || line === head) continue;
      let rec = null;
      if (col.pos > 0 && col.dob > 0 && col.nat > 0) {
        const cut = (a, b) => line.slice(a, b < 0 ? undefined : b).trim();
        const pos = cut(col.pos, col.dob).split(/\s+/)[0];
        if (POS[pos] && /^\S/.test(line.slice(col.pos)))
          rec = { name: cut(0, col.pos), pos, dob: cut(col.dob, col.nat),
                  nat: cut(col.nat, col.rem), remarks: col.rem > 0 ? cut(col.rem, -1) : "" };
      }
      if (!rec) {
        /* שם ארוך שדחק את העמודות — חוזרים ל-regex */
        const r = line.match(/^(.+?)\s+(GK|DEF|MID|FWD|DF|MF|FW)\s+(\d\d\/\d\d\/\d{4}|\?+)?\s*(\S+(?: \S+)*?)(?:\s{2,}(.*))?$/);
        if (!r) continue;
        rec = { name: r[1].trim(), pos: r[2], dob: r[3] || "", nat: r[4].trim(), remarks: r[5] || "" };
      }
      const by = (rec.dob.match(/(\d{4})$/) || [])[1];
      list.push({
        name: rec.name, pos: POS[rec.pos], dob: rec.dob || null,
        born: by ? +by : null,
        nat: rec.nat || null,
        remarks: (rec.remarks || "").trim() || null
      });
    }
    clubs[slug] = { team, players: list };
  }
  return { year, title, clubs };
}

/* "Sergei Clescenco (55, 56, 88, 90)" · "Ivan Bulat (62 og)" · "Avishay Jano (66 pen)" */
function parseScorerCell(cell) {
  const m = cell.trim().match(/^([A-Za-zÀ-ÿ'’.\- ]+?)\s*\(([^)]*)\)/);
  if (!m) return null;
  const inside = m[2];
  if (!/^[\d\s,+'?ogpenOGPEN.\/]*$/.test(inside) || !/\d|\?/.test(inside)) return null;
  const parts = inside.split(",").map(s => s.trim()).filter(Boolean);
  const og = parts.filter(s => /og/i.test(s)).length;
  return { name: m[1].trim(), goals: parts.length - og, og };
}

function parseSeason(html, page) {
  const title = (html.match(/<TITLE>([^<]*)<\/TITLE>/i) || [])[1] || "";
  const year = endYearOf(title);
  const goals = [];      // {slug, name, goals, home, away, side}
  const tops = [];       // {slug, name, goals, line}
  let cur = null;
  for (const raw of html.split(/\r?\n/)) {
    const line = strip(raw).replace(/\s+$/, "");
    /* כותרת משחק: <B>בית - חוץ  1-1</B> */
    if (/<B>/i.test(raw)) {
      const bold = strip((raw.match(/<B>([\s\S]*?)<\/B>/i) || [])[1] || "");
      const h = bold.match(/^(.+?)\s*-\s+(.+?)\s+(\d+)-(\d+)/);
      if (h) {
        cur = { home: h[1].trim(), away: h[2].trim(), hs: slugOf(h[1]), as: slugOf(h[2]) };
        continue;
      }
      cur = null;
    }
    if (/<H[1-3]/i.test(raw)) cur = null;
    if (!line.trim()) { if (cur && cur.seen) cur = null; continue; }

    if (cur) {
      cur.seen = true;
      /* שני טורים: ימין מתחיל אחרי רווח של 2+ אחרי סוגר, או שהשורה
         כולה מוזחת (אין מבקיע לבית בשורה הזאת) */
      let left = null, right = null;
      if (/^\s{8,}\S/.test(line)) right = line.trim();
      else {
        const k = line.search(/\)\s{2,}\S/);
        if (k >= 0) { left = line.slice(0, k + 1); right = line.slice(k + 1).trim(); }
        else left = line;
      }
      for (const [cell, slug, side] of [[left, cur.hs, "home"], [right, cur.as, "away"]]) {
        if (!cell || !slug) continue;
        const sc = parseScorerCell(cell);
        if (sc && sc.goals > 0)
          goals.push({ slug, name: sc.name, goals: sc.goals, side, match: `${cur.home} - ${cur.away}` });
      }
      continue;
    }

    /* רשימת מלך שערים: "Name (Club)   17" או "Top Scorer: Name (Club) - 16 goals" */
    const t = line.match(/^\s*(?:Top Scorers?:)?\s*([A-Z][A-Za-zÀ-ÿ'’.\- ]+?)\s*\(([^)]+)\)\s*-?\s*(\d+)(?:\s*goals)?\b(.*)$/);
    if (t) {
      const slug = slugOf(t[2]);
      if (slug && !/^\d/.test(t[1]))
        tops.push({ slug, name: t[1].trim(), goals: +t[3], team: t[2].trim(), note: t[4].trim() || null });
    }
  }
  return { page, year, title, goals, tops };
}

function parseTops(html) {
  const out = [];
  let year = null;
  for (const raw of strip(html).split(/\r?\n/)) {
    const m = raw.match(/^(\d{4})[\/-](\d{2})\s+/);
    if (m) year = endYearOf(`${m[1]}/${m[2]}`);
    else if (!/^\s{6,}\S/.test(raw)) continue;
    if (!year) continue;
    const name = raw.slice(9, 30).trim(), team = raw.slice(30, 54).trim();
    const goals = +(raw.slice(54).match(/\d+/) || [])[0];
    const slug = slugOf(team);
    if (name && slug && goals) out.push({ year, slug, name, goals, team });
  }
  return out;
}

async function scrape() {
  const force = !!args.force;
  let squads = !force && existsSync(SQUAD_FILE) ? readJSON(SQUAD_FILE) : null;
  let scorers = !force && existsSync(SCORER_FILE) ? readJSON(SCORER_FILE) : null;

  if (!squads) {
    squads = { source: "rsssf", fetched: new Date().toISOString().slice(0, 10), pages: [], seasons: {} };
    for (const yy of SQUAD_PAGES) {
      const page = `isra${yy}squads.html`;
      const html = await get(page);
      if (!html) continue;
      const p = parseSquads(html);
      squads.pages.push(BASE + page);
      squads.seasons[p.year] = p.clubs;
      log(`  ${page}: ${p.title} · ${Object.entries(p.clubs).map(([s, c]) => `${s} ${c.players.length}`).join(" · ")}`);
    }
    writeJSON(SQUAD_FILE, squads);
  } else log(`  סגלים מהמטמון: ${SQUAD_FILE}`);

  if (!scorers) {
    scorers = { source: "rsssf", fetched: new Date().toISOString().slice(0, 10), pages: [], matchGoals: {}, tops: [] };
    for (const yy of SEASON_PAGES) {
      const page = `isra${yy}.html`;
      const html = await get(page);
      if (!html) continue;
      const p = parseSeason(html, page);
      scorers.pages.push(BASE + page);
      /* מצטבר לפי עונה → מועדון → שם: שערים ומספר משחקים שבהם הבקיע */
      const bucket = scorers.matchGoals[p.year] ||= {};
      for (const g of p.goals) {
        const c = bucket[g.slug] ||= {};
        const r = c[g.name] ||= { goals: 0, matches: 0 };
        r.goals += g.goals; r.matches++;
      }
      for (const t of p.tops) scorers.tops.push({ year: p.year, ...t, src: page });
      log(`  ${page}: ${p.title} · ${p.goals.length} שורות מבקיעים שלנו · ${p.tops.length} ברשימות מלך השערים`);
    }
    const html = await get("isratops.html");
    if (html) {
      scorers.pages.push(BASE + "isratops.html");
      for (const t of parseTops(html)) scorers.tops.push({ ...t, src: "isratops.html" });
    }
    writeJSON(SCORER_FILE, scorers);
  } else log(`  מבקיעים מהמטמון: ${SCORER_FILE}`);
  return { squads, scorers };
}

/* ============================================================
   2. זהויות RSSSF — מועדון + שם (+ שנת לידה כשיש)
   ============================================================ */
function buildIdentities(squads, scorers) {
  const bySlug = {};
  const idOf = (slug, name, born) => {
    const list = bySlug[slug] ||= [];
    const k = normLatin(name);
    let r = list.find(x => x.key === k && (born == null || x.born == null || x.born === born));
    if (!r) list.push(r = { slug, key: k, names: new Set(), born: null, dob: null,
                            pos: {}, nat: null, squad: {}, remarkYears: {}, goals: {}, tops: {} });
    r.names.add(name);
    if (born != null && r.born == null) r.born = born;
    return r;
  };
  for (const [y, clubs] of Object.entries(squads.seasons))
    for (const [slug, c] of Object.entries(clubs))
      for (const p of c.players) {
        const r = idOf(slug, p.name, p.born);
        if (p.dob && !/^00\/00/.test(p.dob)) r.dob ||= p.dob;
        r.pos[p.pos] = (r.pos[p.pos] || 0) + 1;
        r.nat ||= p.nat;
        r.squad[y] = p.remarks || "";
        /* "joined during the season from Maccabi Tel-Aviv" — הוא היה
           גם שם באותה עונה, גם אם לא נרשם בסגל שלהם */
        const other = (p.remarks || "").match(/\b(?:from|to)\s+(.+?)\s*$/i);
        const os = other && slugOf(other[1]);
        if (os && os !== slug) {
          const o = idOf(os, p.name, p.born);
          o.remarkYears[y] = `${p.remarks} (בסגל ${c.team})`;
          if (p.dob && !/^00\/00/.test(p.dob)) o.dob ||= p.dob;
          o.nat ||= p.nat;
          o.pos[p.pos] = (o.pos[p.pos] || 0) + 0.5;
        }
      }
  for (const [y, clubs] of Object.entries(scorers.matchGoals))
    for (const [slug, names] of Object.entries(clubs))
      for (const [name, g] of Object.entries(names)) {
        const r = idOf(slug, name, null);
        r.goals[y] = g;
      }
  for (const t of scorers.tops) {
    const r = idOf(t.slug, t.name, null);
    r.tops[t.year] = Math.max(r.tops[t.year] || 0, t.goals);
  }
  for (const list of Object.values(bySlug))
    for (const r of list) {
      r.name = [...r.names][0];
      r.squadYears = Object.keys(r.squad).map(Number);
      r.scoreYears = [...new Set([...Object.keys(r.goals), ...Object.keys(r.tops)].map(Number))];
      r.years = [...new Set([...r.squadYears, ...r.scoreYears, ...Object.keys(r.remarkYears).map(Number)])].sort();
      r.mainPos = Object.entries(r.pos).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    }
  return bySlug;
}

/* ============================================================
   3. צד המאגר — מפתחות לטיניים לכל רשומה עברית
   ============================================================ */
const yearsOf = spells => {
  const out = [];
  for (const [a, b] of spells || []) for (let y = a; y <= b; y++) out.push(y);
  return out;
};
const span = spells => (spells || []).map(([a, b]) => a === b ? season(a) : `${season(a)}–${season(b)}`).join(", ");
const yrs = ys => [...ys].sort().map(season).join(", ");

/* שלד עיצורים לטיני: "Cobi Refua" = "Kobi Refua", "Holtzman" = "Holzman" */
const skel = s => normLatin(s).split(" ").filter(Boolean).map(w => w
  .replace(/ph/g, "f").replace(/[ck]h/g, "h").replace(/tz|ts/g, "z").replace(/ck/g, "k")
  .replace(/c/g, "k").replace(/q/g, "k").replace(/w/g, "v").replace(/z/g, "s").replace(/x/g, "ks")
  .replace(/[aeiouyh]/g, "").replace(/(.)\1+/g, "$1")).filter(Boolean).sort().join(" ");

function buildDbSide(slug) {
  const db = readJSON(`data/clubs/${slug}.json`);
  const players = db.players.map((p, i) => ({ ...p, i, ys: new Set(yearsOf(p.spells)), latin: new Map() }));
  const addKey = (p, name, via) => { if (name && /[A-Za-z]/.test(name)) p.latin.set(normLatin(name), via); };

  /* כינויים לטיניים שכבר במאגר */
  for (const p of players) for (const a of p.aliases || []) addKey(p, a, "alias");

  /* קישור בין־לשוני — אותו גשר ש-trust.mjs משתמש בו */
  const byHe = new Map();
  for (const p of players)
    for (const n of [p.he, ...(p.aliases || [])]) if (n) {
      const k = normName(n);
      if (!byHe.has(k)) byHe.set(k, []);
      byHe.get(k).push(p);
    }
  for (const src of ["wikilang", "enbridge"]) {
    const j = readJSON(`data/raw/${slug}-${src}.json`, null);
    for (const l of j?.links || []) {
      if (!l.he || !l.en) continue;
      for (const p of byHe.get(normName(l.he)) || []) {
        addKey(p, l.en, src);
        if (l.via) addKey(p, l.via, src);
      }
    }
  }
  const keyIdx = () => {
    const m = new Map();
    for (const p of players) for (const k of p.latin.keys()) {
      if (!m.has(k)) m.set(k, new Set());
      m.get(k).add(p);
    }
    return m;
  };

  /* worldfootball ו-Transfermarkt: רשומה לטינית שמקושרת לרשומה עברית
     בשם זהה, או במבחן של trust.mjs — תעתיק + לידה + עונות, מועמד יחיד */
  const wfRecs = new Map();
  const wf = readJSON(`data/raw/${slug}-worldfootball.json`, null);
  for (const [y, list] of Object.entries(wf?.seasons || {}))
    for (const q of list) {
      if (!q.name) continue;
      const k = `${normLatin(q.name)}|${q.born ?? ""}`;
      if (!wfRecs.has(k)) wfRecs.set(k, { name: q.name, born: q.born ?? null, pos: q.pos || null, nat: q.nat || null, years: [] });
      wfRecs.get(k).years.push(+y);
    }
  const tmRecs = new Map();
  const tm = readJSON(`data/raw/${slug}-transfermarkt.json`, null);
  for (const [y, list] of Object.entries(tm?.seasons || {}))
    for (const q of list) {
      if (!q.name) continue;
      const k = normLatin(q.name);
      if (!tmRecs.has(k)) tmRecs.set(k, { name: q.name, born: null, years: [] });
      tmRecs.get(k).years.push(+y);
    }
  /* קישור רופף רק ל-worldfootball, ורק כשלשני הצדדים יש שנת לידה
     והיא זהה. Transfermarkt בלי שנת לידה קישר בגרסה הראשונה את
     "Asi Avrahami" ל"אדורם קייסי" (תעתיק 0.83, עונה חופפת) — ולכן
     מ-Transfermarkt מתקבל רק שם זהה. */
  const linkLoose = (rec, useBorn) => {
    if (!useBorn || rec.born == null) return null;
    const hits = [];
    for (const p of players) {
      if (p.born == null || p.born !== rec.born) continue;
      if (!rec.years.some(y => p.ys.has(y))) continue;
      if (!plausible(p.he, rec.name).ok) continue;
      hits.push({ p, s: score(p.he, rec.name) });
    }
    if (!hits.length) return null;
    hits.sort((a, b) => b.s - a.s);
    if (hits.length > 1 && hits[0].s - hits[1].s < 0.08) return null;
    return hits[0].s >= 0.85 ? hits[0].p : null;
  };
  let idx = keyIdx();
  for (const [srcName, recs, useBorn] of [["worldfootball", wfRecs, true], ["transfermarkt", tmRecs, false]])
    for (const rec of recs.values()) {
      const k = normLatin(rec.name);
      const named = [...(idx.get(k) || [])].filter(p =>
        rec.years.some(y => p.ys.has(y)) && (!useBorn || p.born == null || rec.born == null || p.born === rec.born));
      const p = named.length === 1 ? named[0] : named.length ? null : linkLoose(rec, useBorn);
      if (p) { if (!p.latin.has(k)) p.latin.set(k, srcName); rec.he = p.he; }
    }
  idx = keyIdx();
  const skIdx = new Map();
  for (const p of players) for (const k of p.latin.keys()) {
    const s = skel(k);
    if (!s.includes(" ")) continue;          // שלד של מילה אחת — חלש מדי
    if (!skIdx.has(s)) skIdx.set(s, new Set());
    skIdx.get(s).add(p);
  }
  return { db, players, idx, skIdx, wfRecs, tmRecs };
}

/* ============================================================
   4. התאמה
   ============================================================ */
function confirm(p, r) {
  const overlap = r.years.filter(y => p.ys.has(y));
  const both = p.born != null && r.born != null;
  return { overlap, bornEq: both && p.born === r.born, bornDiff: both ? r.born - p.born : null };
}

/* חלקיקי שם: "בן" לא יעמוד לבדו מול "Yaniv" (ב=v, נ=n — אותו שק עיצורים) */
const HE_PART = new Set(["בן", "בר", "אבו", "אל", "דה", "די", "דל", "ואן", "בית", "אבן"]);
const LAT_PART = new Set(["ben", "bar", "abu", "el", "al", "de", "di", "da", "del", "van", "von", "bin", "ibn", "beit"]);

/* אות פותחת: השק לא יודע סדר, ולכן "Sharon Sagron" עומד מול
   "סראג נסאר" (S-R-N מול N-S-R). לרשימת "כנראה במאגר", שאין לה
   אישור אחר, דורשים שגם העיצור הראשון של כל מילה יתאים. */
const HE_INIT = { "ב": "PV", "פ": "P", "ף": "P", "ו": "V", "כ": "K", "ך": "K", "ק": "K", "ח": "KH", "ג": "GJ",
  "ד": "D", "ל": "L", "מ": "M", "ם": "M", "נ": "N", "ן": "N", "ר": "R", "ס": "S", "ש": "S", "ז": "SJ",
  "צ": "S", "ץ": "S", "ת": "T", "ט": "T" };
/* ו' שאינה פותחת היא אם קריאה ("אורן" פותח ב-R, לא ב-V) */
const heInit = w => { for (let i = 0; i < w.length; i++) if (HE_INIT[w[i]] && !(w[i] === "ו" && i > 0)) return HE_INIT[w[i]]; return null; };
const latInit = w => {
  const x = w.replace(/^[aeiouy]+/, "");
  if (!x) return null;
  if (/^(ch|kh)/.test(x)) return "KH";
  if (/^(sh|ts|tz)/.test(x)) return "S";
  const c = x[0];
  return { b: "P", p: "P", f: "P", v: "V", w: "V", k: "K", q: "K", c: "KS", g: "G", j: "JG", d: "D", t: "T",
           s: "S", z: "S", x: "S", l: "L", m: "M", n: "N", r: "R", h: "H" }[c] || null;
};
function sameInitials(he, lat) {
  const hw = normName(he).replace(/\([^)]*\)/g, "").split(" ").filter(w => w && !HE_PART.has(w));
  const lw = normLatin(lat).split(" ").filter(w => w.length > 1 && !LAT_PART.has(w));
  const used = new Set();
  for (const l of lw) {
    const li = latInit(l);
    const i = hw.findIndex((h, k) => !used.has(k) && (() => { const hi = heInit(h);
      return !hi || !li || [...li].some(ch => hi.includes(ch)); })());
    if (i < 0) return false;
    used.add(i);
  }
  return true;
}

function matchIdentity(r, side) {
  const tried = [];
  /* מדרגה 1 ו-2: שם לטיני מקושר / שלד */
  for (const [tier, cands] of [
    ["שם לטיני מקושר", [...(side.idx.get(r.key) || [])]],
    ["שלד עיצורים", [...(side.skIdx.get(skel(r.key)) || [])]]
  ]) {
    if (!cands.length) continue;
    const ok = cands.map(p => ({ p, c: confirm(p, r) })).filter(({ c }) =>
      tier === "שם לטיני מקושר"
        ? c.overlap.length || c.bornEq
        : (c.overlap.length && (c.bornDiff == null || Math.abs(c.bornDiff) <= 1)) || c.bornEq);
    if (ok.length === 1) return { p: ok[0].p, tier, via: ok[0].p.latin.get(r.key) || "שלד", ...ok[0].c };
    if (ok.length > 1) {
      /* כמה רשומות באותו שם — לידה מכריעה, אם היא מכריעה */
      const byBorn = ok.filter(x => x.c.bornEq);
      if (byBorn.length === 1) return { p: byBorn[0].p, tier, via: byBorn[0].p.latin.get(r.key) || "שלד", ...byBorn[0].c };
      return { ambiguous: ok.map(x => x.p.he), tier, why: "כמה רשומות עבריות עונות על השם ועל האישור" };
    }
    tried.push(`${tier}: ` + cands.map(p => { const c = confirm(p, r);
      return `${p.he} (${p.born ?? "?"}, ${span(p.spells)}) — ` +
        (c.overlap.length ? `חופף ${yrs(c.overlap)}, אבל לידה ${r.born} מול ${p.born}` : "בלי חפיפת עונות ובלי לידה תואמת"); }).join(" / "));
  }
  /* מדרגה 3: תעתיק עברי ⇄ לטיני, מילה מול מילה.
     המסנן הכללי של translit.mjs משווה את השם כולו כשק עיצורים,
     וזה חלש לשני הכיוונים: "Rami Eliyahu" מקבל מול "מאיר בל" את
     אותו ציון כמו מול "רמי אליהו" (עיצורי Rami ו"מאיר" זהים,
     ו-Eliyahu הוא L בלבד), ו"Moti Ohayon" נופל מול "מוטי אוחיון"
     כי ח' נספרת ו-h לא. לכן כאן כל מילה לטינית צריכה מילה עברית
     משלה, וכל מילה עברית נמדדת בכמה קריאות:
       ו'/י' באמצע מילה כאמות קריאה ("אליהו" = Eliyahu)
       וו כ-w אחת ("אוואט" = Awat)
       ב' כ-v ("יניב" = Yaniv), ח' כ-h שנופלת ("חוגג" = Hogeg) */
  const wsc = (hw, lw) => {
    let best = 0;
    for (const base of [hw, hw.replace(/וו/g, "ו")]) {
      const mid = base[0] + base.slice(1).replace(/[וי]/g, "");
      for (const v of [base, mid])
        for (const x of [v, v.replace(/ב/g, "ו"), v.replace(/ח/g, "ה"), v.replace(/ב/g, "ו").replace(/ח/g, "ה")])
          best = Math.max(best, score(x, lw));
    }
    return best;
  };
  const wordwise = he => {
    const hw = normName(he).replace(/\([^)]*\)/g, "").split(" ").filter(Boolean);
    const used = new Set();
    let sum = 0, n = 0, min = 1;
    for (const lw of normLatin(r.name).split(" ").filter(w => w.length > 1)) {
      let best = -1, bs = 0;
      hw.forEach((w, i) => { if (!used.has(i) && (!HE_PART.has(w) || LAT_PART.has(lw))) { const sc = wsc(w, lw); if (sc > bs) { bs = sc; best = i; } } });
      if (bs < 0.75) return null;
      used.add(best); sum += bs; n++; min = Math.min(min, bs);
    }
    return n ? { avg: sum / n, min } : null;
  };
  /* כמה חזק צריך השם להיות תלוי במה שמאשר אותו. לידה ידועה בשני
     הצדדים חייבת להיות זהה, בלי ±1 — "Liron Basis" (1974) מול
     "ניר סביליה" (1975) עברו את המסנן הכללי ב-0.92.
       לידה + עונה חופפת       — ממוצע ≥ 0.8, כל מילה ≥ 0.75
       רק לידה, בלי חפיפה      — ממוצע ≥ 0.9, כל מילה ≥ 0.85
                                  ("Alon Abramovich" 1980 מול "מילובאן מירושביץ'" 1980)
       רק חפיפה, לידה לא ידועה — ממוצע ≥ 0.85, כל מילה ≥ 0.85
                                  ("Sharon Sagron" מול "אורן סגרון" באותה עונה) */
  const good = [];
  for (const p of side.players) {
    const c = confirm(p, r);
    if (!c.bornEq && !(c.overlap.length && c.bornDiff == null)) continue;
    const w = wordwise(p.he);
    if (!w) continue;
    const ok = (c.bornEq && c.overlap.length && w.avg >= 0.8) ||
               (c.bornEq && w.min >= 0.85 && w.avg >= 0.9) ||
               (c.overlap.length && c.bornDiff == null && w.min >= 0.85 && w.avg >= 0.85);
    if (ok) good.push({ p, c, w, rank: w.avg + (c.bornEq ? 0.1 : 0) + (c.overlap.length ? 0.05 : 0) });
  }
  good.sort((x, y) => y.rank - x.rank);
  if (good.length === 1 || (good.length > 1 && good[0].rank - good[1].rank >= 0.05))
    return { p: good[0].p, tier: "תעתיק", via: `תעתיק ${good[0].w.avg.toFixed(2)}`, ...good[0].c };
  if (good.length > 1)
    return { ambiguous: good.slice(0, 4).map(h => `${h.p.he} (${h.w.avg.toFixed(2)}${h.c.overlap.length ? ", חופף" : ""}${h.c.bornEq ? ", לידה=" : ""})`),
             tier: "תעתיק", why: "כמה מועמדים מאושרים וקרובים" };
  const hits = [];
  for (const p of side.players)
    if (plausible(p.he, r.name).ok) hits.push({ p, s: score(p.he, r.name) });
  hits.sort((x, y) => y.s - x.s);
  if (tried.length) return { ambiguous: tried, tier: "שם", why: "שם תואם בלי אישור", nameOnly: true };
  /* רמז חלש בלבד — לא התאמה. מסמן שאולי הוא כבר במאגר */
  const weak = hits.filter(h => h.s >= 0.75).slice(0, 2).map(h => `${h.p.he} (${span(h.p.spells)}, ${h.p.born ?? "?"})`);
  /* "כנראה כבר במאגר": השם עומד מילה מול מילה ברשומה קיימת, אבל
     אין אישור — בדרך כלל רשומת התאחדות מ-2002/03 בלי שנת לידה,
     שאין לה עונה משותפת עם RSSSF. לא התאמה; רשימה לבדיקה ביד. */
  const likely = side.players.map(p => ({ p, w: wordwise(p.he) }))
    .filter(x => x.w && x.w.min >= 0.85 && x.w.avg >= 0.9)
    .filter(x => !/^\?/.test(r.name) && sameInitials(x.p.he, r.name))
    /* ותקופה סמוכה — עד 3 עונות מהעונה הקרובה ב-RSSSF */
    .filter(x => [...x.p.ys].some(y => r.years.some(z => Math.abs(y - z) <= 3)))
    .filter(x => x.p.born == null || r.born == null || Math.abs(x.p.born - r.born) <= 1)
    .map(x => `${x.p.he} (${span(x.p.spells)}, ${x.p.born ?? "?"})`);
  return { none: true, weak, likely };
}

/* ============================================================
   5. לוח החידות — מה פורסם ומה בדרך
   ============================================================ */
const site = readJSON("config/site.json");
const todayDate = args.today ? new Date(args.today + "T12:00:00") : new Date();
const startUTC = Date.UTC(site.start[0], site.start[1] - 1, site.start[2]);
const todayUTC = Date.UTC(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
const TODAY_NO = Math.max(0, Math.floor((todayUTC - startUTC) / 86400000)) + 1;

/* ============================================================
   הרצה
   ============================================================ */
log("RSSSF — משיכה");
const { squads, scorers } = await scrape();
const ids = buildIdentities(squads, scorers);
const SQUAD_YEARS = Object.keys(squads.seasons).map(Number).sort();

const LINKS = [];
const F = { a: [], b: [], c: [], d1: [], d2: [], d3: [], e: [], f1: [], f2: [], g: [], h: [], amb: [] };
const stats = [];
const NAT = readJSON("config/nat-en.json");
const unconfirmed = readJSON("data/review/unconfirmed.json", { clubs: {} }).clubs;
const POS_HE = { GK: "שוער", DF: "מגן", MF: "קשר", FW: "חלוץ" };

for (const club of loadClubs()) {
  const slug = club.slug;
  const side = buildDbSide(slug);
  const order = readJSON(`config/schedule-${slug}.json`, { order: [] }).order;
  const sched = he => {
    const i = order.indexOf(he);
    if (i < 0) return null;
    const n = i + 1;
    return n <= TODAY_NO ? { n, published: true, label: `פורסם #${n}` }
                         : { n, published: false, label: `בלוח #${n} (בעוד ${n - TODAY_NO} ימים)` };
  };
  const unconf = new Set(unconfirmed[slug] || []);
  const list = ids[slug] || [];
  const st = { slug, game: side.db.game, ids: list.length, squadIds: list.filter(r => r.squadYears.length).length,
               matched: 0, tiers: {}, ambiguous: 0, none: 0 };
  const matchedPlayers = new Map();

  for (const r of list) {
    const m = matchIdentity(r, side);
    r.match = m;
    if (m.ambiguous) {
      st.ambiguous++;
      F.amb.push({ slug, game: side.db.game, name: r.name, born: r.born, years: r.years, cands: m.ambiguous, why: m.why });
      continue;
    }
    if (m.none) { st.none++; continue; }
    st.matched++;
    st.tiers[m.tier] = (st.tiers[m.tier] || 0) + 1;
    const p = m.p;
    LINKS.push({ slug, rsssf: r.name, born: r.born, years: r.years, he: p.he, dbBorn: p.born, span: span(p.spells), tier: m.tier, via: m.via });
    if (!matchedPlayers.has(p)) matchedPlayers.set(p, []);
    matchedPlayers.get(p).push(r);
    const base = { slug, game: side.db.game, he: p.he, rsssf: r.name, tier: m.tier, via: m.via,
                   span: span(p.spells), seasons: p.seasons, target: !!p.target, sched: sched(p.he) };

    /* (א) שנת לידה */
    if (p.born != null && r.born != null && p.born !== r.born)
      F.a.push({ ...base, db: p.born, rs: r.born, dob: r.dob });
    /* (ב) עמדה */
    if (p.pos && r.mainPos && p.pos !== r.mainPos)
      F.b.push({ ...base, db: p.pos, rs: r.mainPos, all: r.pos });
    /* (ג) לאום — זר מול ישראלי */
    if (r.nat) {
      const rsIL = /^israel$/i.test(r.nat);
      const code = NAT[r.nat] || null;
      if (p.nat && ((p.nat === "IL") !== rsIL))
        F.c.push({ ...base, db: p.nat, rs: r.nat });
      else if (p.nat == null)
        F.c.push({ ...base, db: null, rs: r.nat, missing: true, code });
    }
    /* (ד) חברות בסגל */
    const miss = r.squadYears.filter(y => !p.ys.has(y));
    if (miss.length) F.d1.push({ ...base, years: miss, remarks: miss.map(y => r.squad[y]).filter(Boolean) });
    const remarkMiss = Object.keys(r.remarkYears).map(Number).filter(y => !p.ys.has(y) && !miss.includes(y));
    if (remarkMiss.length) F.d1.push({ ...base, years: remarkMiss, remarks: remarkMiss.map(y => r.remarkYears[y]), viaRemark: true });
    /* (ה) הבקיע בעונה שאין במאגר */
    const sMiss = r.scoreYears.filter(y => !p.ys.has(y));
    if (sMiss.length) F.e.push({ ...base, years: sMiss,
      goals: sMiss.map(y => (r.goals[y]?.goals ?? 0) || r.tops[y] || 0) });
    /* (ו2) במאגר, חסרה לידה או עמדה, ו-RSSSF יודע */
    if ((p.born == null && r.born != null) || (p.pos == null && r.mainPos))
      F.f2.push({ ...base, fillBorn: p.born == null ? r.born : null, fillPos: p.pos == null ? r.mainPos : null,
                  dob: r.dob, poolReady: p.seasons >= 2, unconfirmed: unconf.has(p.he) });
    /* (ז) לא מאושר ב-trust, ו-RSSSF מאשר שהוא היה במועדון */
    if (unconf.has(p.he) && confirm(p, r).overlap.length)
      F.g.push({ ...base, years: confirm(p, r).overlap, inSquad: r.squadYears.some(y => p.ys.has(y)) });
  }

  /* (ח) רשומה עברית אחת ששני אנשים שונים ב-RSSSF נקשרו אליה.
     זה כמעט תמיד כינוי לטיני שגוי ב-aliases או קישור בין־לשוני
     שגוי — "דדי בן דיין" נושא את "Bruno Reis". שתי זהויות
     באותו שלד עיצורים ("Reuven Atar"/"Reuven Attar") אינן נספרות. */
  for (const [p, rs] of matchedPlayers) {
    const groups = new Map();
    for (const r of rs) { const k = skel(r.key); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
    if (groups.size < 2) continue;
    F.h.push({ slug, game: side.db.game, he: p.he, span: span(p.spells), seasons: p.seasons, born: p.born, nat: p.nat,
               target: !!p.target, sched: sched(p.he), aliases: (p.aliases || []).filter(a => /[A-Za-z]/.test(a)),
               who: [...groups.values()].map(g => `${g[0].name} (${g.find(r => r.born)?.born ?? "?"}, ${g.find(r => r.nat)?.nat ?? "?"}, ${yrs([...new Set(g.flatMap(r => r.years))])}; דרך ${g[0].match.via})`) });
  }
  for (const a of F.amb.filter(a => a.slug === slug && /כמה רשומות עבריות/.test(a.why)))
    F.h.push({ slug, game: side.db.game, he: a.cands.join(" / "), span: "", seasons: "", born: "", nat: "",
               target: false, sched: null, aliases: [], who: [`${a.name} (${a.born ?? "?"}, ${yrs(a.years)}) — אותו שם לטיני על שתי רשומות`] });

  /* (ד2) במאגר בעונת סגל, ולא בסגל של RSSSF באותה עונה */
  for (const p of side.players) {
    const want = SQUAD_YEARS.filter(y => p.ys.has(y) && squads.seasons[y]?.[slug]);
    if (!want.length) continue;
    const rs = matchedPlayers.get(p);
    if (rs) {
      const absent = want.filter(y => !rs.some(r => r.squad[y] !== undefined || r.remarkYears[y]));
      if (absent.length) F.d2.push({ slug, game: side.db.game, he: p.he, rsssf: rs.map(r => r.name).join(" / "),
        span: span(p.spells), seasons: p.seasons, years: absent, target: !!p.target, sched: sched(p.he),
        scored: absent.filter(y => rs.some(r => r.goals[y] || r.tops[y])) });
    } else {
      /* לא גושר לאף זהות — ייתכן שהוא בסגל בכתיב שלא זוהה */
      const hint = [];
      for (const y of want)
        for (const q of squads.seasons[y][slug].players)
          if (plausible(p.he, q.name).ok && score(p.he, q.name) >= 0.7) hint.push(`${q.name} (${q.born ?? "?"}, ${season(y)})`);
      F.d3.push({ slug, game: side.db.game, he: p.he, born: p.born, span: span(p.spells), seasons: p.seasons,
                  years: want, target: !!p.target, sched: sched(p.he), hint: [...new Set(hint)].slice(0, 3) });
    }
  }

  /* (ו1) צמיחה — זהויות RSSSF שאינן במאגר */
  for (const r of list) {
    if (!r.match?.none) continue;
    const wf = [...side.wfRecs.values()].filter(w => normLatin(w.name) === r.key && (r.born == null || w.born == null || w.born === r.born));
    const tm = side.tmRecs.get(r.key);
    const all = new Set([...r.years, ...wf.flatMap(w => w.years), ...(tm?.years || [])]);
    F.f1.push({ slug, game: side.db.game, name: r.name, dob: r.dob, born: r.born ?? wf[0]?.born ?? null,
                pos: r.mainPos || wf[0]?.pos || null, nat: r.nat || wf[0]?.nat || null,
                rsYears: r.years, squadYears: r.squadYears, scoreYears: r.scoreYears,
                goals: Object.values(r.goals).reduce((s, g) => s + g.goals, 0),
                allYears: [...all].sort(), wfYears: wf.flatMap(w => w.years).sort(), tmYears: tm?.years || [],
                poolReady: all.size >= 2, weak: r.match.weak, likely: r.match.likely || [],
                remarks: Object.values(r.squad).filter(Boolean) });
  }
  stats.push(st);
}

/* ============================================================
   6. דוח
   ============================================================ */
const out = [];
const L = s => out.push(s);
const schedTag = s => s ? (s.published ? `**${s.label}**` : s.label) : "";
const target = f => f.target ? "כן" : "";

L("# RSSSF — אימות וצמיחה");
L("");
L(`נוצר על ידי \`node tools/rsssf.mjs\`. חידת היום: **#${TODAY_NO}** ` +
  `(${todayDate.toISOString().slice(0, 10)}; חידה #1 = ${site.start.join("-")}). ` +
  `"פורסם" = מספר החידה ≤ ${TODAY_NO}.`);
L("");
L("**הכלי לא כותב למאגר.** כל שורה כאן היא הצעה לבדיקה, לא תיקון.");
L("");
L("## המקור");
L("");
L(`* סגלים: ${squads.pages.length} עמודים, עונות ${yrs(SQUAD_YEARS)} — שם, עמדה, תאריך לידה, לאום, הערות.`);
L(`* מבקיעים לכל משחק: ${Object.keys(scorers.matchGoals).filter(y => Object.keys(scorers.matchGoals[y]).length).map(Number).sort().map(season).join(", ")}. ` +
  `שער עצמי (og) לא נספר — הוא שייך לשחקן היריבה.`);
L(`* מלכי שערים (רשימות עונתיות ו-isratops): ${scorers.tops.length} שורות של המועדונים שלנו.`);
L("");
L("## שיעור הגישור");
L("");
L("| מועדון | זהויות RSSSF | מהן בסגל | גושרו | שם מקושר | שלד | תעתיק | דו־משמעי | לא במאגר |");
L("|---|---|---|---|---|---|---|---|---|");
for (const s of stats)
  L(`| ${s.game} | ${s.ids} | ${s.squadIds} | **${s.matched}** (${Math.round(100 * s.matched / Math.max(1, s.ids))}%) | ` +
    `${s.tiers["שם לטיני מקושר"] || 0} | ${s.tiers["שלד עיצורים"] || 0} | ${s.tiers["תעתיק"] || 0} | ${s.ambiguous} | ${s.none} |`);
L("");
L("\"לא במאגר\" פירושו שלא נמצאה רשומה עברית שעוברת את האישור. חלק מהם");
L("כן במאגר בכתיב שלא גושר — העמודה \"רמז חלש\" בסעיף ו מסמנת אותם.");
L("");

const section = (title, intro, head, rows) => {
  L(`## ${title} (${rows.length})`);
  L("");
  if (intro) { L(intro); L(""); }
  if (!rows.length) { L("אין."); L(""); return; }
  L("| " + head.join(" | ") + " |");
  L("|" + head.map(() => "---").join("|") + "|");
  for (const r of rows) L("| " + r.join(" | ") + " |");
  L("");
};
const bySched = (a, b) => ((a.sched ? (a.sched.published ? 0 : 1) : 2) - (b.sched ? (b.sched.published ? 0 : 1) : 2)) ||
                          ((a.sched?.n || 0) - (b.sched?.n || 0)) || (b.seasons - a.seasons);

section("א. שנת לידה — המאגר מול RSSSF",
  "RSSSF נותן תאריך מלא. הפרש של שנה אחת הוא לרוב טעות באחד הצדדים; הפרש גדול יותר חשוד כשיוך שגוי.",
  ["מועדון", "שם", "RSSSF", "במאגר", "RSSSF לידה", "הפרש", "תקופה", "גישור", "בבריכה", "לוח"],
  F.a.sort(bySched).map(f => [f.game, f.he, f.rsssf, f.db, f.dob || f.rs, f.rs - f.db, f.span, f.via, target(f), schedTag(f.sched)]));

section("ב. עמדה",
  "RSSSF: GK/DEF/MID/FWD. שחקן שהוגדר אחרת בעונות שונות מוצג עם כל העמדות.",
  ["מועדון", "שם", "RSSSF", "במאגר", "RSSSF", "תקופה", "בבריכה", "לוח"],
  F.b.sort(bySched).map(f => [f.game, f.he, f.rsssf, f.db, Object.keys(f.all).join("/"), f.span, target(f), schedTag(f.sched)]));

const cMis = F.c.filter(f => !f.missing), cMiss = F.c.filter(f => f.missing);
section("ג. לאום — זר מול ישראלי",
  "רק סתירה בין \"ישראלי\" ל\"זר\". RSSSF רושם אזרחות אחת; שחקן כפול־אזרחות יופיע כאן ודורש שיקול.",
  ["מועדון", "שם", "RSSSF", "במאגר", "RSSSF", "תקופה", "בבריכה", "לוח"],
  cMis.sort(bySched).map(f => [f.game, f.he, f.rsssf, f.db, f.rs, f.span, target(f), schedTag(f.sched)]));
section("ג2. לאום חסר במאגר ו-RSSSF יודע", "",
  ["מועדון", "שם", "RSSSF", "לאום RSSSF", "קוד", "תקופה", "בבריכה", "לוח"],
  cMiss.sort(bySched).map(f => [f.game, f.he, f.rsssf, f.rs, f.code || "?", f.span, target(f), schedTag(f.sched)]));

section("ד1. בסגל RSSSF בעונה שאין במאגר",
  "כולל הערות (הצטרף/עזב באמצע העונה). שורה שמקורה בהערה של קבוצה אחרת (\"joined from…\") מסומנת.",
  ["מועדון", "שם", "RSSSF", "עונות חסרות", "תקופה במאגר", "הערה", "בבריכה", "לוח"],
  F.d1.sort(bySched).map(f => [f.game, f.he, f.rsssf, yrs(f.years), f.span,
    (f.viaRemark ? "מהערה: " : "") + (f.remarks.join("; ") || ""), target(f), schedTag(f.sched)]));

section("ד2. במאגר בעונה 98/99–02/03, גושר, אבל לא בסגל RSSSF של אותה עונה",
  "ייתכן: השאלה, מעבר באמצע עונה, או שהמאגר מאריך תקופה. אם הבקיע באותה עונה — RSSSF סותר את עצמו.",
  ["מועדון", "שם", "RSSSF", "עונות", "תקופה במאגר", "הבקיע בעונה", "בבריכה", "לוח"],
  F.d2.sort(bySched).map(f => [f.game, f.he, f.rsssf, yrs(f.years), f.span, yrs(f.scored), target(f), schedTag(f.sched)]));

section("ד3. במאגר בעונה 98/99–02/03, ולא גושר לאף שם בסגל",
  "**לא בהכרח סתירה** — ייתכן כשל גישור. \"רמז\" = שם בסגל שהתעתיק לא פוסל.",
  ["מועדון", "שם", "לידה", "עונות", "תקופה", "רמז", "בבריכה", "לוח"],
  F.d3.sort(bySched).map(f => [f.game, f.he, f.born ?? "", yrs(f.years), f.span, f.hint.join("; "), target(f), schedTag(f.sched)]));

section("ה. הבקיע למועדון בעונה שאין במאגר",
  "ראיה ל\"שיחק והבקיע\". שערים = מסיכום משחקים, או מרשימת מלך השערים כשאין פירוט.",
  ["מועדון", "שם", "RSSSF", "עונות", "שערים", "תקופה במאגר", "בבריכה", "לוח"],
  F.e.sort(bySched).map(f => [f.game, f.he, f.rsssf, yrs(f.years), f.goals.join(", "), f.span, target(f), schedTag(f.sched)]));

const f1 = F.f1.sort((a, b) => (b.poolReady - a.poolReady) || (b.allYears.length - a.allYears.length));
const growRow = f => [f.game, f.name, f.dob || f.born || "", f.pos || "", f.nat || "", yrs(f.rsYears), f.allYears.length,
  f.goals || "", f.poolReady && f.born && f.pos ? "✔" : "", (f.likely.length ? f.likely : f.weak || []).join("; "), f.remarks.join("; ")];
section("ו1א. כנראה כבר במאגר — רשומה בלי אישור",
  "השם עומד מילה מול מילה ברשומה קיימת, אבל אין חפיפת עונות ואין שנת לידה לאשר — לרוב רשומת התאחדות מ-02/03 " +
  "בלי לידה. **לא הותאם.** אם זה אותו אדם, RSSSF מוסיף לו לידה, עמדה ועונות מוקדמות יותר.",
  ["מועדון", "RSSSF", "לידה", "עמדה", "לאום", "עונות RSSSF", "סה\"כ עונות", "שערים", "≥2", "רשומה במאגר", "הערות"],
  f1.filter(f => f.likely.length).map(growRow));
section("ו1ב. צמיחה — ב-RSSSF ולא במאגר",
  "עונות = RSSSF ∪ worldfootball ∪ Transfermarkt בשם זהה באותו מועדון. ✔ = 2 עונות ומעלה (MIN_SEASONS ב-enrich.mjs) " +
  "ויש לידה ועמדה — יכול להיכנס לבריכה אחרי שם עברי ואישור שני (trust). \"רמז חלש\" = התעתיק לא פוסל, לא יותר.",
  ["מועדון", "שם", "לידה", "עמדה", "לאום", "עונות RSSSF", "סה\"כ עונות", "שערים", "≥2", "רמז חלש", "הערות"],
  f1.filter(f => !f.likely.length).map(growRow));

section("ו2. במאגר בלי לידה/עמדה — RSSSF משלים",
  "\"בריכה\" = 2 עונות ומעלה במאגר, ולכן ההשלמה לבדה מכשירה אותו (בכפוף לאישור שני).",
  ["מועדון", "שם", "RSSSF", "לידה", "עמדה", "עונות במאגר", "תקופה", "בריכה", "לא מאושר ב-trust"],
  F.f2.sort((a, b) => b.seasons - a.seasons).map(f => [f.game, f.he, f.rsssf, f.fillBorn ? (f.dob || f.fillBorn) : "",
    f.fillPos || "", f.seasons, f.span, f.poolReady ? "✔" : "", f.unconfirmed ? "כן" : ""]));

section("ז. לא מאושר ב-trust — ו-RSSSF מאשר",
  "שחקנים שמסוננים מהמשחק בגלל מקור יחיד, ו-RSSSF מכיר אותם במועדון בעונה חופפת. RSSSF אינו נספר היום ב-trust.mjs.",
  ["מועדון", "שם", "RSSSF", "עונות חופפות", "בסגל (לא רק מבקיע)", "תקופה", "עונות"],
  F.g.map(f => [f.game, f.he, f.rsssf, yrs(f.years), f.inSquad ? "כן" : "", f.span, f.seasons]));

section("ח. רשומה אחת — שני אנשים",
  "שתי זהויות RSSSF בשמות שונים נקשרו לאותה רשומה עברית. כמעט תמיד כינוי לטיני שגוי ב-aliases (מגיע מ-config/names) " +
  "או קישור בין־לשוני שגוי. **זה עלול להעביר שנת לידה, לאום ועונות מאדם אחד לאחר.**",
  ["מועדון", "רשומה", "לידה", "לאום", "תקופה", "כינויים לטיניים", "זהויות RSSSF", "בבריכה", "לוח"],
  F.h.map(f => [f.game, f.he, f.born ?? "", f.nat ?? "", f.span, f.aliases.join(", "), f.who.join("<br>"), target(f), schedTag(f.sched)]));

section("דו־משמעי — לא הוכרע", "לא נכנס לאף סעיף למעלה.",
  ["מועדון", "RSSSF", "לידה", "עונות", "מועמדים", "למה"],
  F.amb.map(f => [f.game, f.name, f.born ?? "", yrs(f.years), f.cands.join("; "), f.why]));

/* קישורים בלבד, לשימוש tools/trust.mjs כמקור נוסף ל"שיחק כאן".
   רק מה שגושר ואומת בשנת לידה או בחפיפת עונות. "כנראה במאגר"
   לא נכנס: שם בלבד, ולפעמים עונות שאינן נוגעות ("שי דהן"). */
writeJSON("data/raw/rsssf-links.json",
  LINKS.map(l => ({ slug: l.slug, he: l.he, years: l.years })));

writeText("data/review/research/rsssf.md", out.join("\n") + "\n");
writeJSON("data/review/research/rsssf.json", {
  _comment: "נוצר על ידי `node tools/rsssf.mjs`. ממצאים בלבד — לא נכתב למאגר.",
  today: TODAY_NO, stats, findings: F, links: LINKS
});

console.log("\nמועדון        זהויות גושרו דו־משמעי לא-במאגר");
for (const s of stats) console.log(`${s.slug.padEnd(14)} ${String(s.ids).padStart(6)} ${String(s.matched).padStart(6)} ${String(s.ambiguous).padStart(8)} ${String(s.none).padStart(9)}`);
console.log(`\nא ${F.a.length} · ב ${F.b.length} · ג ${cMis.length} (+${cMiss.length} חסר) · ד1 ${F.d1.length} · ד2 ${F.d2.length} · ד3 ${F.d3.length} · ` +
            `ה ${F.e.length} · ו1 ${F.f1.length} (כנראה במאגר: ${F.f1.filter(f => f.likely.length).length}; חדשים ≥2: ${F.f1.filter(f => !f.likely.length && f.poolReady && f.born && f.pos).length}) · ו2 ${F.f2.length} · ז ${F.g.length} · ח ${F.h.length} · דו־משמעי ${F.amb.length}`);
console.log("נכתבו data/review/research/rsssf.md ו-rsssf.json");
