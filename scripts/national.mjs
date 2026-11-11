/* ============================================================
   national.mjs — נבחרת ישראל. מקור יחיד: ויקיפדיה העברית.

   node scripts/national.mjs            שאיבה (עם cache) + בנייה
   node scripts/national.mjs --reparse  בנייה מה-cache בלבד, בלי רשת

   פלט:  data/raw/israel-wiki.json      שורה מפורסרת לכל ערך
         data/clubs/israel.json          מה שנכנס למשחק
         config/schedule-israel.json     לוח החידות המקובע

   **לא דרך scrape/enrich.** אלה בנויים סביב מועדון: עונות, תארים,
   ההתאחדות, worldfootball. לנבחרת אין עונות ואין תארים, ויש לה
   מה שאין למועדון — הופעות ומועדון עיקרי. גם הנבחרת לא נכנסת
   ל-config/clubs.json: כל כלי שעובר על המועדונים (trust, audit,
   reports-apply) היה נשבר עליה. ההגדרה שלה ב-config/teams.json.

   הרמזים:
     עמדה           מתיבת המידע, ואם אין — ממשפט הפתיחה
     מועדון עיקרי   המועדון עם הכי הרבה הופעות בקריירה (בכל
                    התחנות שלו יחד), ואם אין הופעות — הכי הרבה שנים
     הופעה 1        שנת ההופעה הראשונה בנבחרת הבוגרת
     הופעות         מספר ההופעות בנבחרת הבוגרת
     נולד           שנת לידה
   ============================================================ */
import { existsSync } from "node:fs";
import { parseArgs, readJSON, writeJSON, log, warn, die, normName, sleep } from "./lib/util.mjs";

const args = parseArgs();
const TEAM = readJSON("config/teams.json").israel;
const CACHE = "data/raw/html/israel-wikitext.json";       // gitignored
const API = "https://he.wikipedia.org/w/api.php";
const UA = { "user-agent": "sportdel/1.0 (techbynoam@gmail.com)" };

async function api(params) {
  const u = API + "?" + new URLSearchParams({ format: "json", formatversion: "2", ...params });
  for (let t = 0; t < 5; t++) {
    const r = await fetch(u, { headers: UA });
    const tx = await r.text();
    try { return JSON.parse(tx); } catch { await sleep(30000); }
  }
  die("ויקיפדיה לא עונה");
}

/* ---------- 1. שאיבה ---------- */
async function fetchAll() {
  const titles = [];
  let cont = {};
  do {
    const j = await api({ action: "query", list: "categorymembers", cmtitle: TEAM.wikiCategory,
                          cmnamespace: "0", cmlimit: "500", ...cont });
    titles.push(...j.query.categorymembers.map(m => m.title));
    cont = j.continue || null;
  } while (cont);
  /* ערכים עבריים שמקוטלגים רק בקטגוריה האנגלית (דן ביטון, ירדן כהן) */
  const extra = [];
  cont = {};
  do {
    const u = "https://en.wikipedia.org/w/api.php?" + new URLSearchParams({
      format: "json", formatversion: "2", action: "query", generator: "categorymembers",
      gcmtitle: TEAM.wikiCategoryEn, gcmnamespace: "0", gcmlimit: "200",
      prop: "langlinks", lllang: "he", lllimit: "max", ...cont });
    const j = await (await fetch(u, { headers: UA })).json();
    for (const p of j.query?.pages || []) {
      const he = p.langlinks?.[0]?.title;
      if (he && !titles.includes(he) && !extra.includes(he)) extra.push(he);
    }
    cont = j.continue || null;
    await sleep(500);
  } while (cont);
  log(`  קטגוריה: ${titles.length} ערכים · מהאנגלית: ${extra.length}`);

  const wt = {};
  const all = [...titles, ...extra];
  for (let i = 0; i < all.length; i += 50) {
    const j = await api({ action: "query", prop: "revisions", rvprop: "content", rvslots: "main",
                          redirects: "1", titles: all.slice(i, i + 50).join("|") });
    for (const p of j.query.pages) {
      const c = p.revisions?.[0]?.slots?.main?.content;
      if (c) wt[p.title] = c;
    }
    await sleep(1000);
  }
  return { at: new Date().toISOString().slice(0, 10), extra, wt };
}

/* ---------- 2. פירוק תיבת המידע ---------- */
function field(wt, names) {
  for (const n of names) {
    const at = wt.search(new RegExp(`\\|\\s*${n}\\s*=`, "u"));
    if (at < 0) continue;
    let i = wt.indexOf("=", at) + 1, depth = 0, out = "";
    for (; i < wt.length; i++) {
      const c = wt[i], c2 = wt.slice(i, i + 2);
      if (c2 === "{{" || c2 === "[[") { depth++; out += c2; i++; continue; }
      if (c2 === "}}" || c2 === "]]") { depth--; out += c2; i++; continue; }
      if (!depth && (c === "|" || c === "\n")) break;
      out += c;
    }
    if (out.trim()) return out.trim();
  }
  return null;
}
const plain = s => String(s || "")
  .replace(/<[^>]+>/g, "")
  .replace(/\[\[([^\]|]+)\|([^\]]*)\]\]/g, "$2").replace(/\[\[([^\]]+)\]\]/g, "$1")
  .replace(/\{\{[^}]*\}\}/g, " ").replace(/'{2,}/g, "").replace(/\s+/g, " ").trim();
const rows = s => String(s || "").split(/\{\{\s*ש\s*\}\}|<br\s*\/?>/i);
const POS = [[/שוער/, "GK"], [/בלם|מגן|ליברו|הגנה/, "DF"], [/קשר|מקשר|מנוע/, "MF"], [/חלוץ|כנף|קיצוני|וינגר/, "FW"]];
const YEAR = /\[\[(\d{4})\]\]|(?:^|[^\d])(1[89]\d{2}|20\d{2})(?![\d])/g;
const yearsIn = s => [...String(s || "").matchAll(YEAR)].map(m => +(m[1] || m[2]))
  .filter(y => y >= 1900 && y <= 2030);
const lead = wt => { const at = wt.indexOf("'''"); return wt.slice(Math.max(0, at), Math.max(0, at) + 1600); };
const YOUTH = /גיל|צעיר|אולימפ|נוער|עד \d|U-?\d|ב'|חופים|אוניברסיט|מכביה|צעירה\s*=/;

function parse(title, wt, thisYear) {
  if (!/\{\{\s*אישיות כדורגל/.test(wt)) return null;
  const he = title.replace(/\s*\((?:כדורגלן|כדורגל)\)\s*$/, "");

  let pos = null;
  const pr = plain(field(wt, ["תפקיד כשחקן", "תפקיד", "עמדה"]));
  for (const [re, c] of POS) if (re.test(pr)) { pos = c; break; }
  if (!pos) {
    const l = plain(lead(wt)); let best = null;
    for (const [re, c] of POS) { const m = l.match(re); if (m && (!best || m.index < best.i)) best = { i: m.index, c }; }
    pos = best?.c || null;
  }

  let by = yearsIn(field(wt, ["תאריך לידה", "שנת לידה"]));
  if (!by.length) {
    const l = lead(wt), at = l.search(/(?:נולד[הו]?|יליד(?:ת)?)[\s:־-]/u);
    if (at >= 0) by = yearsIn(l.slice(at, at + 140)).filter(y => y <= 2010);
  }
  const born = by.length ? by[by.length - 1] : null;

  /* הנבחרת הבוגרת: השורה של "ישראל" בלי סימון גיל. השדות מיושרים
     לפי אינדקס, מופרדים ב-{{ש}}. */
  const teams = rows(field(wt, ["נבחרת כשחקן"]));
  const nyrs = rows(field(wt, ["שנים בנבחרת כשחקן"]));
  const ncap = rows(field(wt, ["הופעות בנבחרת כשחקן"]));
  let idx = -1;
  teams.forEach((x, i) => { if (/ישראל/.test(x) && !YOUTH.test(x)) idx = i; });
  let caps = null, from = null, to = null;
  if (idx >= 0) {
    const m = (ncap[idx] || "").match(/\d+/);
    caps = m ? +m[0] : null;
    if (caps > 150) caps = null;               // יוסי תא-שמע: "1960" — שנה שנקראה כהופעות
    const y = yearsIn(nyrs[idx]);
    if (y.length) {
      from = Math.min(...y); to = Math.max(...y);
      /* "2018–" / "2018–הווה" — עדיין פעיל, או שאיש לא עדכן */
      if (/[–-]\s*(הווה)?\s*$/.test(plain(nyrs[idx]))) to = thisYear;
    }
  }

  /* הקריירה: מועדון לכל שורה, הופעות לכל שורה. מפתח המועדון הוא
     יעד הקישור בלי סוגריים, כדי ש"וסטהאם" ו"ווסטהאם" יתאחדו. */
  const cRows = rows(field(wt, ["מועדונים כשחקן"]));
  const aRows = rows(field(wt, ["הופעות כשחקן"]));
  const yRows = rows(field(wt, ["שנים כשחקן"]));
  const clubs = new Map();
  cRows.forEach((raw, i) => {
    const link = raw.match(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/);
    if (!link) return;
    const key = normName(link[1].replace(/\s*\([^)]*\)\s*$/, ""));
    const name = (link[2] || link[1].replace(/\s*\([^)]*\)\s*$/, "")).trim();
    const apps = +((aRows[i] || "").replace(/\([^)]*\)/g, "").match(/\d+/) || [0])[0];
    const ys = yearsIn(yRows[i]);
    const yrs = ys.length ? Math.max(...ys) - Math.min(...ys) + 1 : 0;
    const c = clubs.get(key) || { key, name, apps: 0, yrs: 0, first: i };
    c.apps += apps; c.yrs += yrs;
    clubs.set(key, c);
  });
  const list = [...clubs.values()];
  const byApps = list.some(c => c.apps) ;
  list.sort((a, b) => byApps ? (b.apps - a.apps) || (b.yrs - a.yrs) || (a.first - b.first)
                             : (b.yrs - a.yrs) || (a.first - b.first));

  return { title, he, pos, born, caps, from, to,
           club: list[0]?.name || null, clubBy: list.length ? (byApps ? "apps" : "yrs") : null,
           clubs: list.map(c => ({ key: c.key, name: c.name, apps: c.apps, yrs: c.yrs })) };
}

/* ---------- 3. ריצה ---------- */
const thisYear = new Date().getFullYear();
let cache = existsSync(CACHE) && !args.force ? readJSON(CACHE) : null;
if (!cache) {
  if (args.reparse) die(`אין ${CACHE} — הרץ בלי --reparse`);
  cache = await fetchAll();
  writeJSON(CACHE, cache, 0);
}
const parsed = Object.entries(cache.wt).map(([t, w]) => parse(t, w, thisYear)).filter(Boolean);
writeJSON("data/raw/israel-wiki.json", { at: cache.at, source: "he.wikipedia", players: parsed });

/* שם תצוגה אחד לכל מועדון: הקישור זהה, הטקסט משתנה בין ערכים
   ("בני יהודה" / "בני יהודה תל אביב"). הנפוץ מנצח. */
const shown = new Map();
for (const p of parsed) for (const c of p.clubs) {
  const m = shown.get(c.key) || new Map();
  m.set(c.name, (m.get(c.name) || 0) + 1);
  shown.set(c.key, m);
}
const canon = k => [...shown.get(k)].sort((a, b) => b[1] - a[1])[0][0];
for (const p of parsed) if (p.clubs.length) p.club = canon(p.clubs[0].key);

/* שם כפול (שני "שלמה כהן") — מבחינים בשנת לידה, כמו במועדונים */
const count = new Map();
for (const p of parsed) count.set(p.he, (count.get(p.he) || 0) + 1);
for (const p of parsed) if (count.get(p.he) > 1) p.he = p.title.includes("(") ? p.title : `${p.he} (${p.born})`;

/* תיקונים ידניים — config/names-israel.json, כמו names-<club>.json במועדונים.
   ויקיפדיה טועה לפעמים בשדה אחד (שנת עלייה בתור שנת לידה), ושחקן מהסגל
   המורחב שלא הופיע במשחק רשמי נרשם בלי הופעות: { "drop": true } מוציא אותו. */
const FIX = readJSON("config/names-israel.json", {});
const fixOf = he => Object.entries(FIX).find(([k]) => !k.startsWith("_") && normName(k) === normName(he))?.[1];

/* שחקן חייב שנה בנבחרת — זה עמוד השדרה של spells ושל "הופעה 1" */
const players = parsed.filter(p => p.from && p.pos && !fixOf(p.he)?.drop).map(p => {
  const fix = fixOf(p.he) || {};
  const q = { ...p, ...fix };
  const from = fix.spells ? fix.spells[0][0] : q.from;
  return {
    he: q.he, pos: q.pos, nat: "IL", born: q.born,
    spells: fix.spells || [[from, Math.max(from, q.to || from)]],
    titles: 0, caps: q.caps, club: q.club, clubs: [...new Set([...p.clubs.map(c => canon(c.key)), ...(fix.club ? [fix.club] : [])])],
    target: fix.target ?? !!(q.born && q.caps >= TEAM.minCaps),
    aliases: p.title !== q.he ? [p.title] : []
  };
});
const dropped = parsed.length - players.length;

/* ---------- 4. לוח — append-only, כמו במועדונים ---------- */
const SCHED = "config/schedule-israel.json";
const prev = readJSON(SCHED, null)?.order || [];
const byName = new Map(players.map(p => [normName(p.he), p]));
const lost = prev.filter(n => !byName.has(normName(n)));
if (lost.length) die(`בלוח יש ${lost.length} שמות שאינם במאגר: ${lost.slice(0, 5).join(", ")}`);
for (const n of prev) byName.get(normName(n)).target = true;
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const inSched = new Set(prev.map(normName));
const fresh = players.filter(p => p.target && !inSched.has(normName(p.he)))
  .sort((a, b) => a.he.localeCompare(b.he, "he")).map(p => p.he);
const rnd = mulberry32(TEAM.seed);
for (let i = fresh.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [fresh[i], fresh[j]] = [fresh[j], fresh[i]]; }
const schedule = [...prev, ...fresh];
writeJSON(SCHED, { _comment: "סדר קבוע. אין לערבב מחדש ואין למחוק — תוספות בסוף בלבד.", order: schedule }, 1);

const years = players.flatMap(p => p.spells.flat());
writeJSON("data/clubs/israel.json", {
  slug: "israel", kind: "national", start: TEAM.start, he: TEAM.he, short: TEAM.short, game: TEAM.game,
  colors: TEAM.colors, titles: { league: [], cup: [] },
  coverage: { from: Math.min(...years), to: Math.max(...years), sources: ["he.wikipedia"] },
  counts: { players: players.length, targets: players.filter(p => p.target).length },
  players, schedule
});
log(`israel: ${parsed.length} ערכים · ${players.length} במאגר (${dropped} בלי שנה בנבחרת או עמדה) · ` +
    `${players.filter(p => p.target).length} בבריכה · ${fresh.length} נוספו ללוח`);
