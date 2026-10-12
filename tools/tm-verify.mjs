/* ============================================================
   tm-verify.mjs — אימות בריכת התשובות מול דפי השחקן ב-Transfermarkt.

   node tools/tm-verify.mjs              הכל: מיפוי, משיכה, דוח
   node tools/tm-verify.mjs --report     דוח בלבד, מהמטמון, בלי רשת
   node tools/tm-verify.mjs --limit=40   משיכה מוגבלת (לבדיקה)
   node tools/tm-verify.mjs --growth=300 תקרת דפי פרופיל לחלק הצמיחה

   פלט:
     data/raw/tm-profiles.json                 מטמון, נשמר תוך כדי — ההרצה הבאה ממשיכה
     data/review/research/transfermarkt.md     דוח קריא
     data/review/research/transfermarkt.json   אותו דבר, למכונה

   הכלל שלא משתנה: **הכלי לא כותב למאגר ולא ל-config.** הוא מסמן.

   הגשר: דף הסגל של Transfermarkt (data/raw/<slug>-transfermarkt.json)
   נותן מזהה ושם לטיני לכל עונה. לרשומה העברית אין מזהה, ולכן
   מועמדים נבנים כמו ב-tools/trust.mjs — שם לטיני מגשר ויקיפדיה,
   או מסנן התעתיק של scripts/lib/translit.mjs, תמיד עם חפיפת עונות.
   ההכרעה בין מועמדים נעשית רק אחרי שנמשך דף השחקן, כי שם יש
   "Name in home country" — השם העברי כפי ש-Transfermarkt מכיר
   אותו — ותאריך לידה. אין ניחושים: מה שלא מוכרע נכתב כלא ממופה.

   הופעות: דף "Stats by club" נטען בצד הלקוח מ-/ceapi/performance-game,
   וזו אותה בקשה שהדפדפן שולח. בקשה רגילה, User-Agent של דפדפן,
   ושום עקיפה. אתגר בוטים או 403 חוזר — הכלי עוצר ושומר.
   ============================================================ */
import { readJSON, writeJSON, writeText, loadClubs, normName, normLatin, shortName,
         nameVariants, stripParen, season, parseArgs, sleep, log, warn } from "../scripts/lib/util.mjs";
import { plausible, score } from "../scripts/lib/translit.mjs";

const args  = parseArgs();
const CACHE = "data/raw/tm-profiles.json";
const OUT   = "data/review/research/transfermarkt";
const GAP   = 1500;
const GROWTH_CAP = +(args.growth ?? 300);
const LIMIT = args.limit ? +args.limit : Infinity;
const OFFLINE = !!args.report || !!args.console || !!args.import;
/* מה שחסר במטמון — נאסף בכל מצב, ובמצב --console נכתב כסקריפט לדפדפן */
const needProf = new Set(), needPerf = new Set();

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9"
};
const CHALLENGE = /just a moment|attention required|verify you are human|cf-browser-verification/i;

/* ---------- היום ומה כבר פורסם ----------
   חידה n היא order[n-1] (src/engine.js: answerFor). מספר החידה של
   היום נגזר מ-config/site.json start, בדיוק כמו dayIndex(). */
const site = readJSON("config/site.json");
const TODAY = args.today ? new Date(args.today + "T00:00:00Z") : new Date(Date.UTC(2026, 9, 11));
const todayNo = Math.floor((Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), TODAY.getUTCDate()) -
                Date.UTC(site.start[0], site.start[1] - 1, site.start[2])) / 86400000) + 1;
/* ביתרדל הישן פרסם 119 חידות מאותו סדר — הן כבר נראו בעיני אוהדים */
const legacyBeitar = new Set(readJSON("config/published-beitar.json", []));

/* ---------- מטמון ---------- */
const cache = readJSON(CACHE, null) || {
  _comment: "נוצר על ידי tools/tm-verify.mjs. profiles = דף השחקן; perf = הופעות לפי מועדון ועונה " +
            "(שנת סיום עונה), [שיחק, רשום במשחק]. אפשר למחוק — ההרצה הבאה תמשוך מחדש.",
  profiles: {}, perf: {}
};
let dirty = 0;
const save = (force = false) => {
  if (!dirty) return;
  if (force || dirty >= 10) { writeJSON(CACHE, cache, 0); dirty = 0; }
};

/* ---------- ייבוא מהדפדפן ----------
   כשהבקשות הישירות נחסמות (403), אותן בקשות רצות מכרום שלך דרך
   הקונסול: `--console` כותב data/review/research/tm-console.js,
   מדביקים אותו בקונסול כשפתוח דף כלשהו ב-transfermarkt.com, והוא
   מוריד tm-import.json. `--import=<path>` ממזג אותו למטמון. */
if (args.import) {
  const imp = readJSON(String(args.import));
  let a = 0, b = 0;
  for (const [id, v] of Object.entries(imp.profiles || {})) if (v && !cache.profiles[id]) { cache.profiles[id] = v; a++; }
  for (const [id, v] of Object.entries(imp.perf || {}))     if (v && !cache.perf[id])     { cache.perf[id] = v; b++; }
  writeJSON(CACHE, cache, 0);
  log(`יובאו ${a} פרופילים ו-${b} רשומות הופעות מ-${args.import}`);
}

/* ---------- רשת ---------- */
let fetched = 0, strikes = 0, stopped = null;
async function get(url, json = false) {
  if (stopped) return { ok: false, why: stopped };
  if (fetched >= LIMIT) return { ok: false, why: "limit" };
  fetched++;
  for (let attempt = 0; attempt < 2; attempt++) {
    await sleep(GAP);
    let r;
    try { r = await fetch(url, { headers: json ? { ...UA, Accept: "application/json" } : UA }); }
    catch (e) { if (attempt) return { ok: false, why: e.message }; continue; }
    if (r.status === 404) return { ok: false, why: "404", gone: true };
    if (r.status === 429) { warn("429 — ממתין דקה"); await sleep(60000); continue; }
    if (r.status === 403 || r.status === 503) {
      if (++strikes >= 3) stopped = `HTTP ${r.status} שלוש פעמים ברצף — עוצר`;
      return { ok: false, why: `HTTP ${r.status}` };
    }
    if (!r.ok) return { ok: false, why: `HTTP ${r.status}` };
    const t = await r.text();
    if (!json && CHALLENGE.test(t.slice(0, 5000))) {
      if (++strikes >= 3) stopped = "אתגר בוטים שלוש פעמים ברצף — עוצר";
      return { ok: false, why: "אתגר בוטים" };
    }
    strikes = 0;
    return { ok: true, text: t };
  }
  return { ok: false, why: "429 חוזר" };
}

/* ---------- פרסור דף השחקן ---------- */
const decode = s => String(s || "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/&#039;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ").trim();
function infoField(t, label) {
  const re = new RegExp(`info-table__content--regular">\\s*${label}\\s*</span>\\s*` +
                        `<span class="info-table__content info-table__content--bold[^"]*">([\\s\\S]*?)</span>\\s*` +
                        `(?=<span class="info-table__content info-table__content--regular|</div>)`);
  const m = t.match(re);
  return m ? m[1] : null;
}
function parseProfile(t) {
  const title = (t.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  const name = decode(title.split(" - ")[0]);
  const he = decode(infoField(t, "Name in home country:") || "") || null;
  const full = decode(infoField(t, "Full name:") || "") || null;
  const dobRaw = decode((t.match(/itemprop="birthDate"[^>]*>([\s\S]*?)<\/span>/) || [])[1] ||
                        infoField(t, "Date of birth/Age:") || "");
  const by = dobRaw.match(/\b(18|19|20)\d\d\b/);
  const citRaw = infoField(t, "Citizenship:") ||
                 (t.match(/itemprop="nationality"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || "";
  const cit = [...new Set([...citRaw.matchAll(/<img[^>]*title="([^"]+)"/g)].map(m => decode(m[1])))];
  const main = decode((t.match(/detail-position__position">([^<]*)</) || [])[1] || "") ||
               decode(infoField(t, "Position:") || "") || null;
  const other = [...t.matchAll(/detail-position__title">Other position:<\/dt>([\s\S]*?)<\/div>/g)]
    .flatMap(m => [...m[1].matchAll(/detail-position__position">([^<]*)</g)].map(x => decode(x[1])));
  return { name, he, full, dob: dobRaw.replace(/\s*\(\d+\)\s*$/, "") || null,
           born: by ? +by[0] : null, cit, pos: main, other };
}

/* הופעות: [שיחק, רשום] לכל מועדון ולכל שנת סיום עונה */
function parsePerf(text) {
  const j = JSON.parse(text);
  const out = {};
  for (const g of j?.data?.performance || []) {
    if (g.gameInformation?.isNationalGame) continue;
    const club = g.clubsInformation?.club?.clubId;
    const sid = g.gameInformation?.seasonId;
    if (!club || sid == null) continue;
    const y = +sid + 1;             // seasonId=2014 הוא 2014/15 — שנת סיום 2015
    const st = g.statistics?.generalStatistics?.participationState;
    const c = (out[club] ||= {});
    const row = (c[y] ||= [0, 0]);
    if (st === "played") row[0]++;
    if (st !== "played for a different team") row[1]++;
  }
  return out;
}

async function profile(id) {
  if (cache.profiles[id]) return cache.profiles[id];
  needProf.add(id);
  if (OFFLINE) return null;
  const r = await get(`https://www.transfermarkt.com/x/profil/spieler/${id}`);
  if (!r.ok) {
    if (r.gone) { cache.profiles[id] = { err: "404" }; dirty++; }
    return null;
  }
  cache.profiles[id] = parseProfile(r.text); dirty++; save();
  return cache.profiles[id];
}
async function perf(id) {
  if (cache.perf[id]) return cache.perf[id];
  needPerf.add(id);
  if (OFFLINE) return null;
  const r = await get(`https://www.transfermarkt.com/ceapi/performance-game/${id}`, true);
  if (!r.ok) {
    if (r.gone) { cache.perf[id] = { err: "404" }; dirty++; }
    return null;
  }
  try { cache.perf[id] = parsePerf(r.text); }
  catch { cache.perf[id] = { err: "json" }; }
  dirty++; save();
  return cache.perf[id];
}

/* ---------- השוואת שמות עבריים ----------
   השם בדף השחקן הוא לעיתים שם מלא ("אליהו אוחנה") ולעיתים כתיב
   אחר ("אוחנא"). שלוש רמות: זהה, זהה בלי אמות קריאה, ושם משפחה
   זהה. רק הראשונות מכריעות לבדן; השלישית רק פוסלת מועמד שאין לו
   אפילו את זה. */
const isHeb = s => /[א-ת]/.test(s || "");
const loose = s => normName(s).replace(/[יואה](?=\s|$)/g, "").replace(/[יו]/g, "")
  .replace(/ך/g, "כ").replace(/ם/g, "מ").replace(/ן/g, "נ").replace(/ף/g, "פ").replace(/ץ/g, "צ");
function heNames(p) {
  const base = [p.he, ...(p.aliases || [])].filter(isHeb).map(stripParen);
  const s = new Set();
  for (const n of base) for (const v of [n, shortName(n), ...nameVariants(n)]) s.add(normName(v));
  return [...s];
}
function heMatch(dbNames, tmHe) {
  if (!isHeb(tmHe)) return null;
  const t = [normName(tmHe), shortName(tmHe)].map(normName);
  if (dbNames.some(n => t.includes(n))) return "exact";
  const tl = t.map(loose);
  if (dbNames.some(n => tl.includes(loose(n)))) return "loose";
  const last = s => normName(s).split(" ").pop();
  if (dbNames.some(n => n.split(" ").length > 1 && loose(last(n)) === loose(last(tmHe)))) return "surname";
  return "no";
}

/* ---------- עמדה ולאום ---------- */
function tmPos(s) {
  if (!s) return null;
  if (/goalkeeper/i.test(s)) return "GK";
  if (/winger/i.test(s)) return "W";
  if (/back|defen[cs]/i.test(s)) return "DF";
  if (/midfield/i.test(s)) return "MF";
  if (/forward|striker|attack/i.test(s)) return "FW";
  return null;
}
const natEn = readJSON("config/nat-en.json");
const NAT_MORE = {               // שמות ש-Transfermarkt כותב אחרת מ-worldfootball
  "Cote d'Ivoire": "CI", "Korea, South": "KR", "United States": "US", "Curacao": "CW",
  "Martinique": "MQ", "Guadeloupe": "GP", "Suriname": "SR", "Trinidad and Tobago": "TT",
  "Guatemala": "GT", "Niger": "NE", "New Caledonia": "NC", "Madagascar": "MG",
  "Costa Rica": "CR", "Mauritania": "MR", "Equatorial Guinea": "GQ", "Gabon": "GA",
  "Central African Republic": "CF", "Congo": "CG", "Burundi": "BI", "Rwanda": "RW",
  "Ethiopia": "ET", "Eritrea": "ER", "Sudan": "SD", "Libya": "LY", "Jordan": "JO",
  "Lebanon": "LB", "Palestine": "PS", "Syria": "SY", "Iraq": "IQ", "Iran": "IR",
  "Kazakhstan": "KZ", "Kyrgyzstan": "KG", "Tajikistan": "TJ", "Turkmenistan": "TM",
  "Luxembourg": "LU", "Malta": "MT", "Faroe Islands": "FO", "Liechtenstein": "LI",
  "Haiti": "HT", "Honduras": "HN", "El Salvador": "SV", "Panama": "PA", "Nicaragua": "NI",
  "Dominican Republic": "DO", "Cuba": "CU", "Mozambique": "MZ", "Namibia": "NA",
  "Botswana": "BW", "Malawi": "MW", "Tanzania": "TZ", "Comoros": "KM", "Chad": "TD",
  "French Guiana": "GF", "Réunion": "RE", "Reunion": "RE", "Mayotte": "YT", "Bermuda": "BM",
  "Barbados": "BB", "Grenada": "GD", "Montserrat": "MS", "St. Kitts & Nevis": "KN",
  "Aruba": "AW", "Neth. Antilles": "CW", "The Gambia": "GM", "Congo DR": "CD",
  "Bosnia-Herzegovina": "BA", "Türkiye": "TR", "Czechia": "CZ", "CSSR": "CZ",
  "UdSSR": "RU", "Jugoslawien (SFR)": "RS", "Serbia and Montenegro": "RS",
  "Chinese Taipei": "TW", "China": "CN", "Thailand": "TH", "Vietnam": "VN",
  "Indonesia": "ID", "Philippines": "PH", "India": "IN", "New Zealand": "NZ",
  "Northern Ireland": "IE", "Wales": "EN", "Scotland": "SC", "England": "EN"
};
const natCode = n => natEn[n] || NAT_MORE[n] || null;
const natExtra = readJSON("config/nat-extra.json", {});

/* ---------- מאגר, סגלים וגשרים ---------- */
const yearsOf = spells => {
  const out = [];
  for (const [a, b] of spells || []) for (let y = a; y <= b; y++) out.push(y);
  return out;
};
const spanOf = years => {
  const ys = [...new Set(years)].sort((a, b) => a - b), out = [];
  for (const y of ys) { const l = out.at(-1); if (l && y === l[1] + 1) l[1] = y; else out.push([y, y]); }
  return out.map(([a, b]) => a === b ? season(a) : `${season(a)}–${season(b)}`).join(", ");
};

const clubs = [];
for (const club of loadClubs()) {
  const db = readJSON(`data/clubs/${club.slug}.json`, null);
  const tmRaw = readJSON(`data/raw/${club.slug}-transfermarkt.json`, null);
  if (!db || !tmRaw) continue;
  const order = readJSON(`config/schedule-${club.slug}.json`, { order: [] }).order;

  /* סגל לפי מזהה, לא לפי שם — שני "Avi Cohen" הם שני אנשים */
  const tm = new Map();
  for (const [y, list] of Object.entries(tmRaw.seasons || {}))
    for (const p of list) {
      if (!tm.has(p.id)) tm.set(p.id, { id: p.id, name: p.name, key: normLatin(p.name), years: [] });
      tm.get(p.id).years.push(+y);
    }
  const tmSeasons = new Set(Object.keys(tmRaw.seasons || {}).map(Number));

  const heToEn = new Map();
  for (const src of ["wikilang", "enbridge"]) {
    const j = readJSON(`data/raw/${club.slug}-${src}.json`, null);
    for (const l of j?.links || []) {
      if (!l.he || !l.en) continue;
      for (const k of [normName(l.he), normName(stripParen(l.he)), normName(shortName(stripParen(l.he)))])
        if (!heToEn.has(k)) heToEn.set(k, new Set());
      for (const k of [normName(l.he), normName(stripParen(l.he)), normName(shortName(stripParen(l.he)))])
        heToEn.get(k).add(normLatin(l.en)), l.via && heToEn.get(k).add(normLatin(l.via));
    }
  }

  const byHe = new Map(db.players.map(p => [p.he, p]));
  const orderIdx = new Map(order.map((n, i) => [n, i]));
  clubs.push({ ...club, db, tm, tmSeasons, heToEn, order, orderIdx, byHe, teamId: String(tmRaw.teamId) });
}

/* מועמדים לשחקן: גשר לטיני מדויק, או תעתיק סביר — תמיד עם חפיפת
   עונות (±1, כי עונת מעבר נרשמת לפעמים בצד הלא נכון) */
function candidates(c, p) {
  const exact = new Set(yearsOf(p.spells));
  const my = new Set(yearsOf(p.spells).flatMap(y => [y - 1, y, y + 1]));
  const keys = [p.he, ...(p.aliases || [])].filter(Boolean);
  const latin = new Set(keys.filter(n => /[A-Za-z]/.test(n)).map(normLatin));
  for (const k of keys.flatMap(n => [normName(n), normName(stripParen(n)), normName(shortName(stripParen(n)))]))
    for (const e of c.heToEn.get(k) || []) latin.add(e);
  const out = [];
  for (const r of c.tm.values()) {
    if (!r.years.some(y => my.has(y))) continue;
    const bridge = latin.has(r.key);
    const pl = plausible(stripParen(p.he), r.name);
    if (!bridge && !pl.ok) continue;
    out.push({ id: r.id, name: r.name, years: r.years, bridge, ov: r.years.filter(y => exact.has(y)).length,
               s: +score(stripParen(p.he), r.name).toFixed(2) });
  }
  out.sort((a, b) => (b.bridge - a.bridge) || b.s - a.s);
  return out.slice(0, 6);
}

/* הכרעה — רק מה שבאמת מוכרע. מחזיר {id, via} או {amb, why} או null */
function resolve(p, cands) {
  const names = heNames(p);
  const withProf = cands.map(c => ({ ...c, prof: cache.profiles[c.id] || null }))
    .filter(c => !c.prof?.err);
  for (const c of withProf) c.hm = c.prof ? heMatch(names, c.prof.he) : null;
  const born = p.born ?? null;
  const bornOk = c => born == null || c.prof?.born == null || c.prof.born === born;

  const strong = withProf.filter(c => c.hm === "exact" || c.hm === "loose");
  if (strong.length === 1) return { id: strong[0].id, via: "שם עברי ב-TM (" + strong[0].hm + ")" };
  if (strong.length > 1) {
    const b = strong.filter(c => born != null && c.prof?.born === born);
    if (b.length === 1) return { id: b[0].id, via: "שם עברי + לידה" };
    return { amb: true, why: "כמה מזהים עם אותו שם עברי", cands: strong };
  }
  /* מועמד ששמו העברי ב-TM שונה לגמרי — אדם אחר */
  const alive = withProf.filter(c => c.hm !== "no");
  const bridge = alive.filter(c => c.bridge);
  /* כינוי לטיני במאגר יכול להיות שגוי בעצמו — "יניב אלול" נושא את
     Blessing Kaku. אם מועמד תעתיק חזק חופף יותר עונות, לא מכריעים. */
  if (bridge.length === 1) {
    const rival = alive.filter(c => !c.bridge && c.s >= 0.8 && c.s > bridge[0].s + 0.1 && c.ov > bridge[0].ov);
    if (rival.length) return { amb: true, why: "הגשר הלטיני (כינוי/ויקיפדיה) סותר מועמד תעתיק עם יותר עונות משותפות — ייתכן כינוי שגוי במאגר",
                               cands: [bridge[0], ...rival] };
    return { id: bridge[0].id, via: "גשר ויקיפדיה (שם לטיני)" };
  }
  if (bridge.length > 1) {
    const b = bridge.filter(c => born != null && c.prof?.born === born);
    if (b.length === 1) return { id: b[0].id, via: "גשר ויקיפדיה + לידה" };
    return { amb: true, why: "כמה מזהים עם אותו שם לטיני", cands: bridge };
  }
  const tr = alive.filter(c => !c.bridge).sort((a, b) => b.s - a.s);
  if (!tr.length) {
    const rejected = withProf.filter(c => c.hm === "no");
    return rejected.length ? { amb: true, why: "המועמדים נושאים שם עברי אחר ב-TM", cands: rejected } : null;
  }
  if (tr[0].s < 0.8) return { amb: true, why: "תעתיק חלש (<0.8)", cands: tr.slice(0, 3) };
  if (tr.length > 1 && tr[0].s - tr[1].s < 0.08) {
    const b = tr.filter(c => born != null && c.prof?.born === born && c.s >= 0.8);
    if (b.length === 1) return { id: b[0].id, via: "תעתיק + לידה (מתוך כמה)" };
    return { amb: true, why: "שני מועמדי תעתיק צמודים", cands: tr.slice(0, 3) };
  }
  if (!tr[0].prof) return { amb: true, why: "דף השחקן לא נמשך", cands: [tr[0]] };
  if (!bornOk(tr[0])) return { amb: true, why: `תעתיק בלבד ושנת הלידה שונה (TM ${tr[0].prof.born})`, cands: [tr[0]] };
  if (born == null && tr[0].prof.born == null)
    return { amb: true, why: "תעתיק בלבד, ואין שנת לידה בשום צד", cands: [tr[0]] };
  return { id: tr[0].id, via: "תעתיק + לידה" };
}

/* ---------- 1. מי נבדק ---------- */
const subjects = [];
for (const c of clubs) {
  const want = new Set([...c.db.players.filter(p => p.target).map(p => p.he), ...c.order]);
  for (const he of want) {
    const p = c.byHe.get(he);
    const idx = c.orderIdx.has(he) ? c.orderIdx.get(he) : -1;
    const status = idx < 0 ? "pool" :
      (idx < todayNo || (c.slug === "beitar" && legacyBeitar.has(he))) ? "published" : "upcoming";
    subjects.push({ c, he, p, idx, status, puzzle: idx >= 0 ? idx + 1 : null });
  }
}
log(`חידה של היום: #${todayNo} · ${subjects.length} שחקנים לאימות`);

/* ---------- 2. מועמדים ודפי שחקן ---------- */
for (const s of subjects) s.cands = s.p ? candidates(s.c, s.p) : [];
const rank = s => s.status === "published" ? 0 : s.status === "upcoming" ? 1 : 2;
const queue = [...subjects].sort((a, b) => rank(a) - rank(b) || (a.idx - b.idx));
{
  const ids = [...new Set(queue.flatMap(s => s.cands.map(c => c.id)))].filter(id => !cache.profiles[id]);
  if (!OFFLINE && ids.length) log(`דפי שחקן למועמדים: ${ids.length} חסרים במטמון`);
  let n = 0;
  for (const id of ids) {
    if (!OFFLINE && (stopped || fetched >= LIMIT)) break;
    await profile(id);
    if (!OFFLINE && ++n % 50 === 0) log(`  ${n}/${ids.length} פרופילים`);
  }
  save(true);
}
for (const s of subjects) s.res = s.p && s.cands.length ? resolve(s.p, s.cands) : null;

/* מזהה אחד לשני שחקנים באותו מועדון — לא ממפים אף אחד מהם */
{
  const seen = new Map();
  for (const s of subjects) if (s.res?.id) {
    const k = s.c.slug + "|" + s.res.id;
    if (seen.has(k)) {
      const o = seen.get(k);
      for (const x of [o, s]) x.res = { amb: true, why: `אותו מזהה TM לשני שחקנים (${o.he} / ${s.he})`, cands: [{ id: s.res.id, name: s.c.tm.get(s.res.id)?.name }] };
    } else seen.set(k, s);
  }
}

/* ---------- 3. הופעות למי שמופה ---------- */
{
  const ids = [...new Set(queue.filter(s => s.res?.id).map(s => s.res.id))].filter(id => !cache.perf[id]);
  if (!OFFLINE && ids.length) log(`הופעות: ${ids.length} חסרים במטמון`);
  let n = 0;
  for (const id of ids) {
    if (!OFFLINE && (stopped || fetched >= LIMIT)) break;
    await perf(id);
    if (!OFFLINE && ++n % 50 === 0) log(`  ${n}/${ids.length} הופעות`);
  }
  save(true);
}

/* ---------- 4. צמיחה: מי שב-TM ולא אצלנו ----------
   "תפוס" = כל מזהה שמישהו מהמאגר (לא רק מהבריכה) מצביע עליו —
   מיפוי מוכרע, או מועמד מוביל לפי כללי trust.mjs. זה שמרני בכוונה:
   עדיף להחמיץ מועמד לצמיחה מאשר להציע שחקן שכבר קיים. */
const claimed = new Map(clubs.map(c => [c.slug, new Set()]));
for (const s of subjects) if (s.res?.id) claimed.get(s.c.slug).add(s.res.id);
for (const s of subjects) if (s.res?.amb) for (const x of s.res.cands || []) claimed.get(s.c.slug).add(x.id);
for (const c of clubs) {
  for (const p of c.db.players) {
    const cs = candidates(c, p);
    const top = cs.filter(x => x.bridge);
    if (top.length) top.forEach(x => claimed.get(c.slug).add(x.id));
    else if (cs.length && cs[0].s >= 0.8 && (cs.length === 1 || cs[0].s - cs[1].s >= 0.08))
      claimed.get(c.slug).add(cs[0].id);
    for (const x of cs) {
      const pr = cache.profiles[x.id];
      if (pr && !pr.err && ["exact", "loose"].includes(heMatch(heNames(p), pr.he))) claimed.get(c.slug).add(x.id);
    }
  }
}
const allDbHe = new Map();
for (const c of clubs) for (const p of c.db.players) for (const n of heNames(p)) {
  if (!allDbHe.has(n)) allDbHe.set(n, []);
  allDbHe.get(n).push(`${p.he} (${c.slug})`);
}
let growth = [];
for (const c of clubs)
  for (const r of c.tm.values())
    if (r.years.length >= 2 && !claimed.get(c.slug).has(r.id))
      growth.push({ slug: c.slug, game: c.db.game, id: r.id, name: r.name, years: r.years.sort((a, b) => a - b) });
growth.sort((a, b) => b.years.length - a.years.length || Math.max(...b.years) - Math.max(...a.years));
{
  let budget = GROWTH_CAP, n = 0;
  for (const g of growth) {
    if (cache.profiles[g.id]) continue;
    if (budget <= 0 || (!OFFLINE && (stopped || fetched >= LIMIT))) break;
    budget--;
    await profile(g.id);
    if (!OFFLINE && ++n % 50 === 0) log(`  ${n} פרופילים לצמיחה`);
  }
  save(true);
}
for (const g of growth) {
  const pr = cache.profiles[g.id];
  g.prof = pr && !pr.err ? pr : null;
  if (g.prof?.he && isHeb(g.prof.he)) {
    const hits = [normName(g.prof.he), shortName(g.prof.he)].flatMap(n => allDbHe.get(normName(n)) || []);
    if (hits.length) g.inDbAs = [...new Set(hits)];
  }
}

/* ---------- 5. ממצאים ---------- */
const seasonCovered = new Map();      // slug → Set(endYear) שבהן ל-TM יש נתוני משחקים למועדון
for (const c of clubs) seasonCovered.set(c.slug, new Set());
for (const [, pf] of Object.entries(cache.perf)) {
  if (!pf || pf.err) continue;
  for (const c of clubs) for (const [y, [, l]] of Object.entries(pf[c.teamId] || {}))
    if (l > 0) seasonCovered.get(c.slug).add(+y);
}

const F = { born: [], pos: [], posWinger: [], nat: [], apps: [], seasons: [] };
const mapped = [], unmapped = [], ambiguous = [];
const tag = s => ({ slug: s.c.slug, game: s.c.db.game, he: s.he, status: s.status, puzzle: s.puzzle });

for (const s of subjects) {
  if (!s.p) { unmapped.push({ ...tag(s), why: "השם בלוח החידות לא נמצא במאגר" }); continue; }
  if (!s.res) {
    unmapped.push({ ...tag(s), why: s.cands.length ? "אין מועמד שנשאר" : "אין מועמד ב-TM עם חפיפת עונות ושם תואם",
                    span: spanOf(yearsOf(s.p.spells)) });
    continue;
  }
  if (s.res.amb) {
    ambiguous.push({ ...tag(s), born: s.p.born, span: spanOf(yearsOf(s.p.spells)), why: s.res.why,
      cands: (s.res.cands || []).map(x => ({ id: x.id, name: x.name, he: x.prof?.he || cache.profiles[x.id]?.he || null,
        born: x.prof?.born ?? cache.profiles[x.id]?.born ?? null, score: x.s })) });
    continue;
  }
  const id = s.res.id, pr = cache.profiles[id], p = s.p, r = s.c.tm.get(id);
  const base = { ...tag(s), tmId: id, tmName: r?.name || pr?.name, tmHe: pr?.he || null, via: s.res.via,
                 url: `https://www.transfermarkt.com/x/profil/spieler/${id}` };
  mapped.push(base);

  /* (ה) עונות הסגל ב-TM מול התקופות במאגר */
  if (r) {
    const dbY = new Set(yearsOf(p.spells).filter(y => s.c.tmSeasons.has(y)));
    const tmY = new Set(r.years);
    const dbOnly = [...dbY].filter(y => !tmY.has(y)), tmOnly = [...tmY].filter(y => !dbY.has(y));
    if (dbOnly.length || tmOnly.length) {
      const both = [...dbY].filter(y => tmY.has(y)).length;
      const n = dbOnly.length + tmOnly.length;
      F.seasons.push({ ...base, db: spanOf([...dbY]), tm: spanOf([...tmY]),
        dbOnly: spanOf(dbOnly), tmOnly: spanOf(tmOnly), dbSeasons: p.seasons, tmSeasons: tmY.size,
        sev: both === 0 ? "high" : n >= 3 ? "medium" : "low" });
    }
  }

  if (!pr || pr.err) continue;

  /* (א) שנת לידה */
  if (pr.born != null && p.born != null && pr.born !== p.born) {
    const d = Math.abs(pr.born - p.born);
    F.born.push({ ...base, db: p.born, tm: pr.born, dob: pr.dob, sev: d >= 2 ? "high" : "medium" });
  } else if (pr.born != null && p.born == null)
    F.born.push({ ...base, db: null, tm: pr.born, dob: pr.dob, sev: "info" });

  /* (ב) עמדה */
  const tp = tmPos(pr.pos);
  if (tp && p.pos && tp !== p.pos) {
    if (tp === "W") {
      if (p.pos !== "MF" && p.pos !== "FW")
        F.pos.push({ ...base, db: p.pos, tm: pr.pos, sev: "high" });
      else F.posWinger.push({ ...base, db: p.pos, tm: pr.pos, sev: "low" });
    } else {
      const far = p.pos === "GK" || tp === "GK" || (p.pos === "DF" && tp === "FW") || (p.pos === "FW" && tp === "DF");
      const alsoOther = (pr.other || []).some(o => tmPos(o) === p.pos || (tmPos(o) === "W" && /MF|FW/.test(p.pos)));
      F.pos.push({ ...base, db: p.pos, tm: pr.pos, other: pr.other, sev: far ? "high" : alsoOther ? "low" : "medium" });
    }
  }

  /* (ג) לאום. null במאגר = ישראלי בפועל */
  const dbNats = natExtra[p.he] || natExtra[stripParen(p.he)] || [p.nat || "IL"];
  const tmNats = pr.cit.map(natCode);
  const unknown = pr.cit.filter(n => !natCode(n));
  if (pr.cit.length) {
    const primaryOk = tmNats.includes(dbNats[0]);
    const anyOk = dbNats.some(n => tmNats.includes(n));
    if (!anyOk && !unknown.length)
      F.nat.push({ ...base, db: dbNats.join("/") + (p.nat == null ? " (null)" : ""), tm: pr.cit.join(" / "),
                   sev: (dbNats[0] !== "IL" && !tmNats.includes("IL")) || (dbNats[0] === "IL" && !tmNats.includes("IL")) ? "high" : "medium" });
    else if (!anyOk && unknown.length)
      F.nat.push({ ...base, db: dbNats.join("/"), tm: pr.cit.join(" / "), sev: "check", note: "שם מדינה לא ממופה: " + unknown.join(", ") });
    else if (!primaryOk)
      F.nat.push({ ...base, db: dbNats.join("/"), tm: pr.cit.join(" / "), sev: "medium", note: "הלאום הראשי במאגר אינו הראשי ב-TM" });
    else if (tmNats.filter(Boolean).some(n => !dbNats.includes(n)))
      F.nat.push({ ...base, db: dbNats.join("/"), tm: pr.cit.join(" / "), sev: "low", note: "אזרחות נוספת ב-TM שאין במאגר" });
  }

  /* (ד) הופעות במועדון שלנו, רק בעונות ש-TM מכסה */
  const pf = cache.perf[id];
  if (pf && !pf.err) {
    const cov = seasonCovered.get(s.c.slug);
    const mine = yearsOf(p.spells).filter(y => cov.has(y));
    const rows = pf[s.c.teamId] || {};
    const played = Object.values(rows).reduce((n, [a]) => n + a, 0);
    const listed = Object.values(rows).reduce((n, [, b]) => n + b, 0);
    const playedInSpell = mine.reduce((n, y) => n + (rows[y]?.[0] || 0), 0);
    if (mine.length) {
      const sev = played === 0 ? "high" : played <= 5 ? "medium" : (playedInSpell === 0 ? "medium" : null);
      if (sev) F.apps.push({ ...base, played, listed, playedInSpell, coveredSeasons: mine.length,
        dbSeasons: p.seasons, perSeason: Object.fromEntries(Object.entries(rows).map(([y, v]) => [y, v[0]])), sev,
        note: played === 0 ? (listed ? "רשום במשחקים, לא שותף" : "אין אף משחק במועדון") :
              playedInSpell === 0 ? "ההופעות מחוץ לתקופה שבמאגר" : "" });
    }
  }


}

/* ---------- 6. דוח ---------- */
const SEV = { high: 0, medium: 1, check: 2, low: 3, info: 4 };
const ST = { published: 0, upcoming: 1, pool: 2 };
const order = (a, b) => ST[a.status] - ST[b.status] || SEV[a.sev] - SEV[b.sev] ||
  (a.puzzle ?? 1e9) - (b.puzzle ?? 1e9);
for (const k of Object.keys(F)) F[k].sort(order);
growth = growth.filter(g => !g.inDbAs).concat(growth.filter(g => g.inDbAs));

const poolN = subjects.filter(s => s.p).length;
const summary = {
  generated: new Date().toISOString(), todayNo, subjects: subjects.length,
  mapped: mapped.length, ambiguous: ambiguous.length, unmapped: unmapped.length,
  coverage: +(100 * mapped.length / subjects.length).toFixed(1),
  byClub: Object.fromEntries(clubs.map(c => {
    const mine = subjects.filter(s => s.c === c);
    return [c.slug, { subjects: mine.length, mapped: mapped.filter(m => m.slug === c.slug).length,
      tmMatchSeasons: [...seasonCovered.get(c.slug)].sort((a, b) => a - b).join(",") }];
  })),
  counts: Object.fromEntries(Object.entries(F).map(([k, v]) => [k, v.length])),
  growth: growth.filter(g => !g.inDbAs).length,
  fetchedThisRun: fetched, stopped
};
writeJSON(OUT + ".json", { _comment: "נוצר על ידי tools/tm-verify.mjs — אין לערוך ידנית.", summary,
  findings: F, ambiguous, unmapped, mapped, growth }, 1);

const stIcon = s => s.status === "published" ? `**פורסם #${s.puzzle}**` : s.status === "upcoming" ? `בתור #${s.puzzle}` : "בריכה";
const tmLink = x => `[${x.tmName}](${x.url})`;
const md = [];
md.push("# אימות מול Transfermarkt", "");
md.push(`נוצר ב-${summary.generated.slice(0, 10)} על ידי \`node tools/tm-verify.mjs\`. חידת היום: #${todayNo}. ` +
        `"פורסם" = מקום בלוח החידות לפני היום (ובבית"ר גם 119 החידות של ביתרדל הישן).`, "");
md.push("הכלי לא משנה דבר במאגר. כל שורה כאן היא הצעה לבדיקה, לא תיקון.", "");
md.push(`**כיסוי מיפוי:** ${mapped.length} מתוך ${subjects.length} (${summary.coverage}%) · דו-משמעי ${ambiguous.length} · לא ממופה ${unmapped.length}`, "");
md.push("| מועדון | נבדקו | מופו | % |", "|---|---|---|---|");
for (const [slug, b] of Object.entries(summary.byClub))
  md.push(`| ${slug} | ${b.subjects} | ${b.mapped} | ${(100 * b.mapped / b.subjects).toFixed(0)}% |`);
md.push("");
md.push("| סעיף | ממצאים | high | medium |", "|---|---|---|---|");
for (const [k, v] of Object.entries(F))
  md.push(`| ${k} | ${v.length} | ${v.filter(x => x.sev === "high").length} | ${v.filter(x => x.sev === "medium").length} |`);
md.push("");
const table = (title, list, cols, note) => {
  md.push(`## ${title} (${list.length})`, "");
  if (note) md.push(note, "");
  if (!list.length) { md.push("אין.", ""); return; }
  md.push("| מצב | מועדון | שם | TM | " + cols.map(c => c[0]).join(" | ") + " | חומרה |");
  md.push("|---|---|---|---|" + cols.map(() => "---").join("|") + "|---|");
  for (const x of list)
    md.push(`| ${stIcon(x)} | ${x.slug} | ${x.he} | ${tmLink(x)} | ` + cols.map(c => c[1](x) ?? "").join(" | ") + ` | ${x.sev} |`);
  md.push("");
};
table("א. שנת לידה", F.born, [["מאגר", x => x.db ?? "—"], ["TM", x => x.dob || x.tm], ["מיפוי", x => x.via]],
  "info = במאגר אין שנת לידה ו-TM יודע.");
table("ב. עמדה", F.pos, [["מאגר", x => x.db], ["TM", x => x.tm + (x.other?.length ? ` (גם: ${x.other.join(", ")})` : "")]],
  "high = שוער מול שחקן שדה, או הגנה מול התקפה. low = העמדה שבמאגר מופיעה כעמדה משנית ב-TM.");
table("ב2. כנפיים — MF/FW דו-משמעי", F.posWinger, [["מאגר", x => x.db], ["TM", x => x.tm]]);
table("ג. לאום", F.nat, [["מאגר", x => x.db], ["TM", x => x.tm], ["הערה", x => x.note || ""]],
  "null במאגר נקרא כישראלי. low = אזרחות נוספת ב-TM (config/nat-extra.json הוא המקום להוסיף).");
table("ד. מעט או אפס הופעות במועדון", F.apps,
  [["שיחק", x => x.played], ["רשום", x => x.listed], ["בתקופה שבמאגר", x => x.playedInSpell],
   ["עונות מכוסות", x => x.coveredSeasons], ["עונות במאגר", x => x.dbSeasons], ["הערה", x => x.note]],
  "נבדק רק כשלפחות עונה אחת מהתקופה שבמאגר מכוסה בנתוני משחקים של TM למועדון. " +
  "high = אפס משחקים — רשום בסגל בלבד, חשוד כתשובה.");
table("ה. עונות בסגל TM מול המאגר", F.seasons,
  [["מאגר", x => x.db], ["TM", x => x.tm], ["רק במאגר", x => x.dbOnly], ["רק ב-TM", x => x.tmOnly]],
  "רק עונות שיש להן סגל ב-data/raw/<slug>-transfermarkt.json. high = אין אף עונה משותפת.");

md.push(`## לא ממופה (${unmapped.length})`, "");
md.push("| מצב | מועדון | שם | תקופה | למה |", "|---|---|---|---|---|");
for (const x of unmapped.sort(order)) md.push(`| ${stIcon(x)} | ${x.slug} | ${x.he} | ${x.span || ""} | ${x.why} |`);
md.push("");
md.push(`## דו-משמעי — לא הוכרע (${ambiguous.length})`, "");
md.push("| מצב | מועדון | שם | לידה | תקופה | למה | מועמדים |", "|---|---|---|---|---|---|---|");
for (const x of ambiguous.sort(order))
  md.push(`| ${stIcon(x)} | ${x.slug} | ${x.he} | ${x.born ?? "—"} | ${x.span} | ${x.why} | ` +
    x.cands.map(c => `[${c.name}](https://www.transfermarkt.com/x/profil/spieler/${c.id})${c.he ? " " + c.he : ""}${c.born ? " " + c.born : ""}`).join("; ") + " |");
md.push("");

md.push(`## צמיחה — שתי עונות ומעלה ב-TM, ואין רשומה עברית (${summary.growth})`, "");
md.push(`מזהים שאף רשומה במאגר לא מצביעה עליהם. השם העברי, כשיש, הוא "Name in home country" של TM — ` +
        `נקודת פתיחה בלבד, לא שם מאומת. דפי פרופיל נמשכו לפי סדר מספר העונות, עד ${GROWTH_CAP}. ` +
        "הופעות לא נמשכו כאן (בקשה כבדה לכל שחקן).", "");
md.push("| מועדון | TM | שם בעברית ב-TM | לידה | עמדה | לאום | עונות | תקופה |", "|---|---|---|---|---|---|---|---|");
for (const g of growth.filter(g => !g.inDbAs))
  md.push(`| ${g.slug} | [${g.name}](https://www.transfermarkt.com/x/profil/spieler/${g.id}) | ${g.prof?.he || ""} | ` +
          `${g.prof?.dob || ""} | ${g.prof?.pos || ""} | ${g.prof?.cit?.join(" / ") || ""} | ${g.years.length} | ${spanOf(g.years)} |`);
md.push("");
const inDb = growth.filter(g => g.inDbAs);
if (inDb.length) {
  md.push(`### נראו כחדשים, אבל השם העברי שלהם ב-TM כבר במאגר (${inDb.length})`, "");
  md.push("כנראה פער גשר, לא שחקן חסר — כדאי לבדוק שהרשומה הקיימת מכסה את העונות.", "");
  md.push("| מועדון | TM | שם עברי ב-TM | במאגר בשם | עונות ב-TM |", "|---|---|---|---|---|");
  for (const g of inDb)
    md.push(`| ${g.slug} | [${g.name}](https://www.transfermarkt.com/x/profil/spieler/${g.id}) | ${g.prof.he} | ${g.inDbAs.join(", ")} | ${spanOf(g.years)} |`);
  md.push("");
}
writeText(OUT + ".md", md.join("\n") + "\n");

log(`מופו ${mapped.length}/${subjects.length} (${summary.coverage}%) · דו-משמעי ${ambiguous.length} · לא ממופה ${unmapped.length}`);
log("ממצאים:", JSON.stringify(summary.counts), "· צמיחה", summary.growth);
log(`בקשות בהרצה: ${fetched}` + (stopped ? ` · נעצר: ${stopped}` : ""));
if (stopped) process.exitCode = 2;

/* ---------- סקריפט לקונסול ---------- */
if (args.console || stopped) {
  const prof = [...needProf], pf = [...needPerf];
  const js = `/* נוצר על ידי tools/tm-verify.mjs --console. להדביק בקונסול של דף ב-transfermarkt.com.
   ${prof.length} דפי שחקן, ${pf.length} רשומות הופעות, 1.5 שניות בין בקשות.
   בסוף יורד tm-import.json; עצירה באמצע: tmDump() מוריד את מה שנאסף.
   אחר כך: node tools/tm-verify.mjs --import=<הקובץ> ושוב --console עד שלא חסר כלום. */
(async () => {
const PROF = ${JSON.stringify(prof)}, PERF = ${JSON.stringify(pf)};
const decode = ${decode.toString()};
${infoField.toString()}
${parseProfile.toString()}
${parsePerf.toString()}
const out = { profiles: {}, perf: {} }; let bad = 0;
window.tmDump = () => { const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out)], { type: "application/json" }));
  a.download = "tm-import.json"; a.click(); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const jobs = [...PROF.map(id => ["p", id]), ...PERF.map(id => ["f", id])];
for (let i = 0; i < jobs.length; i++) {
  const [k, id] = jobs[i];
  await wait(1500);
  const url = k === "p" ? "/x/profil/spieler/" + id : "/ceapi/performance-game/" + id;
  let r; try { r = await fetch(url); } catch (e) { continue; }
  if (r.status === 404) { (k === "p" ? out.profiles : out.perf)[id] = { err: "404" }; continue; }
  if (!r.ok) { console.warn(r.status, url); if (++bad >= 3) { console.error("נעצר"); break; } continue; }
  bad = 0;
  const t = await r.text();
  try { if (k === "p") out.profiles[id] = parseProfile(t); else out.perf[id] = parsePerf(t); } catch (e) {}
  if (i % 25 === 0) console.log(i + "/" + jobs.length);
}
window.tmDump();
})();
`;
  writeText("data/review/research/tm-console.js", js);
  log(`נכתב data/review/research/tm-console.js — ${prof.length} פרופילים, ${pf.length} הופעות חסרים`);
}
