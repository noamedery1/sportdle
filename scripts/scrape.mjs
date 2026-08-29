/* ============================================================
   scrape.mjs — שואב את המקורות לכל מועדון.
   פלט: data/raw/<slug>-<source>.json  (+ HTML גולמי ב-data/raw/html/)

   מקורות (--source, מופרדים בפסיק):
     wf           worldfootball — שלד המאגר מ-1969. חסום כרגע, ראה README
     ifa          ההתאחדות — שם רשמי + ציר עונות, מ-2002/03
     wiki         קטגוריית המועדון בוויקיפדיה
     wikiplayers  עמדה, שנת לידה ולאום מתוך {{אישיות כדורגל}}
     wikiextra    חיפוש ישיר בוויקיפדיה למי שלא מקוטלג תחת המועדון
     reference    reference/beitardle.html — מאגר הייצור של בית"ר

   דוגמאות:
     node scripts/scrape.mjs --club=beitar
     node scripts/scrape.mjs --club=beitar --source=ifa
     node scripts/scrape.mjs --source=wiki --club=beitar,hapoel-bs
     node scripts/scrape.mjs --club=beitar --source=wf --reparse   (בלי רשת)

   דגלים:
     --from=1969 --to=2025   טווח עונות ב-worldfootball (שנת פתיחה)
     --headless              בלי חלון דפדפן (worldfootball נחסם ככה)
     --force                 להתעלם מה-cache ולמשוך מחדש
     --reparse               לפרסר רק מה-cache, בלי לגעת ברשת
   ============================================================ */
import { existsSync } from "node:fs";
import {
  parseArgs, pickClubs, readJSON, writeJSON, readText, writeText,
  log, warn, die, sleep, cleanIfaName, isForeignIfa, shortName, stripParen, normName, normLatin, nameVariants, toSpells
} from "./lib/util.mjs";
import { openBrowser, gotoStable, makeThrottle } from "./lib/browser.mjs";

const args   = parseArgs();
const clubs  = pickClubs(args);
const only   = args.source ? String(args.source).split(",")
             : ["reference", "wf", "ifa", "wiki", "wikiplayers", "wikiextra", "wikilang", "wikicareer", "enbridge"];
const FROM   = +(args.from || 1969);
const TO     = +(args.to   || 2025);
const FORCE  = !!args.force;
const REPARSE= !!args.reparse;

const htmlPath = (slug, key) => `data/raw/html/${slug}/${key}.html`;

/* ============================================================
   מקור 1 — worldfootball. שלד המאגר.
   ============================================================ */
/* רץ בתוך הדף. הטבלה **בלי class** — אין `table.standard_tabelle`.
   עוברים על השורות לפי הסדר: th.role קובע עמדה, tr.entry הוא שחקן. */
function extractSquadInPage() {
  const POS = {
    "goalkeeper": "GK", "goalkeepers": "GK",
    "defence": "DF", "defense": "DF", "defender": "DF",
    "midfield": "MF", "midfielder": "MF",
    "forward": "FW", "forwards": "FW", "attack": "FW"
  };
  const rows = [...document.querySelectorAll("tr")];
  const out = [];
  let pos = null;
  for (const tr of rows) {
    const role = tr.querySelector("th.role");
    if (role) {
      pos = POS[role.textContent.trim().toLowerCase()] || null;   // Manager / Ass. Coach → null
      continue;
    }
    if (!tr.classList.contains("entry")) continue;
    if (!pos) continue;                                           // צוות אימון — לא שחקן
    const a = tr.querySelector("td.person-name a");
    if (!a) continue;
    const name = a.textContent.replace(/\s+/g, " ").trim();
    if (!name) continue;
    const nat = (tr.querySelector("td.country-name a") || {}).textContent;
    const bd  = (tr.querySelector("td.person-birthday") || {}).textContent || "";
    const m   = bd.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    out.push({
      name,
      pid: (a.getAttribute("href") || "").match(/\/player_summary\/([^/]+)/)?.[1]
        || (a.getAttribute("href") || "").replace(/\/$/, "").split("/").pop() || null,
      nat: nat ? nat.replace(/\s+/g, " ").trim() : null,
      born: m ? +m[3] : null
    });
  }
  return { players: out, roles: [...document.querySelectorAll("th.role")].map(t => t.textContent.trim()) };
}

async function scrapeWorldfootball(club, page, thr) {
  const seasons = {};
  let fetched = 0, cached = 0, blocked = 0;

  for (let y = FROM; y <= TO; y++) {
    const key = `wf-vs${y}-${y + 1}`;
    const file = htmlPath(club.slug, key);
    const endYear = y + 1;

    if (!existsSync(file) || FORCE) {
      if (REPARSE) continue;
      const url = `https://www.worldfootball.net/teams/${club.worldfootball}/vs${y}-${y + 1}/squad/`;
      let ok = false;
      for (;;) {
        ok = await gotoStable(page, url, { waitChallenge: 25 });
        if (ok) break;
        blocked++;
        if (!(await thr.fail())) {
          warn(`worldfootball חוסם ברצף. עוצרים על ${club.slug} בעונה ${y}/${endYear}.`);
          warn(`מה שכבר נשמר נשאר ב-data/raw/html/${club.slug}/ — הרצה חוזרת תמשיך מכאן.`);
          return { seasons, fetched, cached, blocked, stoppedAt: y };
        }
      }
      thr.ok();
      writeText(file, await page.content());
      fetched++;
      await thr.pace();
    } else cached++;

    /* פרסור מה-cache — עובד גם בלי רשת */
    const html = readText(file);
    if (!html) continue;
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const { players } = await page.evaluate(extractSquadInPage);
    if (players.length) seasons[endYear] = players;
    if (players.length) log(`  ${club.slug} wf ${y}/${endYear}: ${players.length} שחקנים`);
  }
  return { seasons, fetched, cached, blocked };
}

/* ============================================================
   מקור 2 — ההתאחדות לכדורגל. שמות רשמיים בעברית.
   season_id = שנת_סיום − 1999.  מכסה 2002/03 ואילך בלבד.
   ============================================================ */
const IFA_GUID = "%7B2AE09DED-5019-4C49-BFD5-4458C66F9D24%7D";
const IFA_MIN = 4, IFA_MAX = 27;

function extractIfaInPage() {
  const as = [...document.querySelectorAll('a[href*="/players/player/?player_id="]')];
  const seen = new Set(), out = [];
  for (const a of as) {
    const href = a.getAttribute("href") || "";
    const id = (href.match(/player_id=(\d+)/) || [])[1] || null;
    const raw = a.textContent.replace(/\s+/g, " ").trim();
    if (!raw) continue;
    const k = id || raw;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ id, raw });
  }
  return out;
}

async function scrapeIfa(club, page, thr) {
  const seasons = {};
  let fetched = 0, cached = 0, blocked = 0;

  for (let sid = IFA_MIN; sid <= IFA_MAX; sid++) {
    const endYear = sid + 1999;
    if (endYear > TO + 1) continue;
    const key = `ifa-s${sid}`;
    const file = htmlPath(club.slug, key);

    if (!existsSync(file) || FORCE) {
      if (REPARSE) continue;
      const url = `https://www.football.org.il/team-details/?itemid=${IFA_GUID}`
                + `&season_id=${sid}&team_id=${club.ifaTeamId}`;
      const ok = await gotoStable(page, url, { waitChallenge: 20, settle: 1500 });
      if (!ok) {
        blocked++;
        if (!(await thr.fail())) {
          warn(`ההתאחדות חוסמת ברצף. עוצרים על ${club.slug} ב-season_id=${sid}.`);
          return { seasons, fetched, cached, blocked, stoppedAt: sid };
        }
        sid--; continue;
      }
      thr.ok();
      writeText(file, await page.content());
      fetched++;
      await thr.pace();
    } else cached++;

    const html = readText(file);
    if (!html) continue;
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const raw = await page.evaluate(extractIfaInPage);
    const players = raw.map(r => {
      const full = cleanIfaName(r.raw);
      return { id: r.id, full, short: shortName(full), foreign: isForeignIfa(r.raw) };
    }).filter(p => p.full);
    if (players.length) {
      seasons[endYear] = players;
      log(`  ${club.slug} ifa ${endYear - 1}/${endYear}: ${players.length} שחקנים`);
    }
  }
  return { seasons, fetched, cached, blocked };
}

/* ============================================================
   מקור 3 — ויקיפדיה. בדיקת שלמות. עובד עם fetch רגיל.
   ה-API ולא גירוד הדף: הדף מציג 200 ערכים בלבד.
   ============================================================ */
async function scrapeWikipedia(club) {
  const names = [];
  let cont = null, pages = 0;
  do {
    const u = new URL("https://he.wikipedia.org/w/api.php");
    u.searchParams.set("action", "query");
    u.searchParams.set("list", "categorymembers");
    u.searchParams.set("cmtitle", club.wikiCategory);
    u.searchParams.set("cmlimit", "500");
    u.searchParams.set("cmtype", "page");
    u.searchParams.set("format", "json");
    if (cont) u.searchParams.set("cmcontinue", cont);
    const r = await fetch(u, { headers: { "User-Agent": "sportdel/1.0 (fan project)" } });
    if (!r.ok) { warn(`ויקיפדיה ${r.status} עבור ${club.slug}`); break; }
    const j = await r.json();
    for (const m of j.query?.categorymembers || []) names.push(m.title);
    cont = j.continue?.cmcontinue || null;
    pages++;
    if (cont) await sleep(300);
  } while (cont && pages < 20);

  /* "אבי כהן (הירושלמי)" → שומרים את שתי הגרסאות */
  const entries = names.map(title => {
    const bare = stripParen(title);
    return { title, name: bare, short: shortName(bare), variants: [...new Set([title, bare])] };
  });
  log(`  ${club.slug} wiki: ${entries.length} ערכים`);
  return { entries };
}

/* ============================================================
   מקור 3ב — תיבות המידע של ויקיפדיה.
   דפי הסגל של ההתאחדות נותנים שם ועונה בלבד — אין בהם עמדה
   ואין שנת לידה. את שניהם לוקחים מתבנית {{אישיות כדורגל}}.
   ה-API מחזיר 50 ערכים בבקשה, אז זה זול: ~8 בקשות למועדון.
   ============================================================ */
/* הסדר קובע כשיש כמה מילים בטקסט אחד. "קשר התקפי" הוא קשר,
   "מגן ימני" הוא מגן. "קיצוני" ו"וינגר" הם עמדה התקפית — worldfootball
   מסווג אותם Forward, אז FW. */
const POS_HE_TO_CODE = [
  [/שוער/,                    "GK"],
  [/בלם|מגן|ליברו|הגנה/,      "DF"],
  [/קשר|מקשר|מנוע/,           "MF"],
  [/חלוץ|כנף|קיצוני|וינגר/,   "FW"]
];
const NAT_HE_TO_ISO = {
  "ישראל": "IL", "אוקראינה": "UA", "הונגריה": "HU", "גאנה": "GH", "מקדוניה": "MK",
  "מקדוניה הצפונית": "MK", "פורטוגל": "PT", "ברזיל": "BR", "ארגנטינה": "AR",
  "ספרד": "ES", "צרפת": "FR", "ניגריה": "NG", "גאורגיה": "GE", "קולומביה": "CO",
  "רוסיה": "RU", "קמרון": "CM", "רומניה": "RO", "אורוגוואי": "UY", "צ'ילה": "CL",
  "סרביה": "RS", "קרואטיה": "HR", "בוסניה והרצגובינה": "BA", "סלובניה": "SI",
  "מונטנגרו": "ME", "בולגריה": "BG", "פולין": "PL", "צ'כיה": "CZ", "סלובקיה": "SK",
  "הולנד": "NL", "בלגיה": "BE", "גרמניה": "DE", "איטליה": "IT", "אנגליה": "EN",
  "סקוטלנד": "SC", "אירלנד": "IE", "שוודיה": "SE", "נורווגיה": "NO", "דנמרק": "DK",
  "פינלנד": "FI", "יוון": "GR", "טורקיה": "TR", "ארצות הברית": "US", "קנדה": "CA",
  "מקסיקו": "MX", "פרגוואי": "PY", "ונצואלה": "VE", "פרו": "PE", "אקוודור": "EC",
  "חוף השנהב": "CI", "סנגל": "SN", "מרוקו": "MA", "תוניסיה": "TN", "אלג'יריה": "DZ",
  "מצרים": "EG", "דרום אפריקה": "ZA", "קונגו": "CD", "אנגולה": "AO", "מאלי": "ML",
  "גינאה": "GN", "טוגו": "TG", "בנין": "BJ", "זימבבואה": "ZW", "קניה": "KE",
  "אוסטרליה": "AU", "יפן": "JP", "דרום קוריאה": "KR", "אוזבקיסטן": "UZ",
  "ארמניה": "AM", "אזרבייג'ן": "AZ", "מולדובה": "MD", "בלארוס": "BY",
  "ליטא": "LT", "לטביה": "LV", "אסטוניה": "EE", "אלבניה": "AL", "קוסובו": "XK",
  "שווייץ": "CH", "אוסטריה": "AT", "איסלנד": "IS", "ג'מייקה": "JM", "קפריסין": "CY"
};

/* קורא ערך שדה מתיבת המידע.
   אי אפשר פשוט לעצור ב-| הראשון: "תאריך לידה = {{ל|1971|3|4}}"
   הוא ערך אחד עם צינורות בתוכו. סופרים עומק סוגריים ומסיימים
   רק בצינור שנמצא ברמה 0. */
function infoboxField(wt, names) {
  for (const n of names) {
    const at = wt.search(new RegExp(`\\|\\s*${n}\\s*=`, "u"));
    if (at < 0) continue;
    let i = wt.indexOf("=", at) + 1;
    let depth = 0, out = "";
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
  .replace(/\[\[([^\]|]+)\|([^\]]*)\]\]/g, "$2")
  .replace(/\[\[([^\]]+)\]\]/g, "$1")
  .replace(/\{\{דגל\|([^}|]+)[^}]*\}\}/g, "$1")
  .replace(/\{\{[^}]*\}\}/g, " ")
  .replace(/'{2,}/g, "")
  .replace(/\s+/g, " ").trim();

/* משפט הפתיחה מתחיל אחרי תיבת המידע, ואצל שחקן עם קריירה ארוכה
   התיבה יכולה להיות ארוכה מ-1200 תווים. חותכים לפי השם המודגש,
   ואם אין — לפי סוף התבנית הראשונה. */
function leadOf(wt) {
  let at = wt.indexOf("'''");
  if (at < 0) {
    let depth = 0, i = 0;
    for (; i < wt.length - 1; i++) {
      if (wt.startsWith("{{", i)) { depth++; i++; }
      else if (wt.startsWith("}}", i)) { depth--; i++; if (!depth) { i++; break; } }
    }
    at = i;
  }
  return wt.slice(at, at + 1600);
}

function parsePlayerArticle(title, wt) {
  if (!/\{\{\s*אישיות כדורגל/.test(wt)) return null;

  const posRaw = plain(infoboxField(wt, ["תפקיד כשחקן", "תפקיד", "עמדה"]));
  let pos = null, posFrom = null;
  if (posRaw) for (const [re, code] of POS_HE_TO_CODE)
    if (re.test(posRaw)) { pos = code; posFrom = "תיבה"; break; }
  /* שוערים בפרט לא ממלאים "תפקיד כשחקן", והעמדה מופיעה רק במשפט
     הפתיחה: "הוא שוער כדורגל ישראלי". לוקחים את ההתאמה הראשונה. */
  if (!pos) {
    const lead = plain(leadOf(wt));
    let best = null;
    for (const [re, code] of POS_HE_TO_CODE) {
      const m = lead.match(re);
      if (m && (best === null || m.index < best.i)) best = { i: m.index, code };
    }
    if (best) { pos = best.code; posFrom = "פתיח"; }
  }

  /* הרבה ערכים לא ממלאים "תאריך לידה" בתיבה, והשנה מופיעה רק
     במשפט הפתיחה: "(נולד ב-21 בינואר 1991)". נופלים לשם. */
  const YEAR = /\[\[(\d{4})\]\]|(?:^|[^\d])(1[89]\d{2}|20\d{2})(?![\d])/g;
  const yearsIn = s => [...String(s || "").matchAll(YEAR)]
    .map(m => +(m[1] || m[2])).filter(y => y >= 1900 && y <= 2015);

  let by = yearsIn(infoboxField(wt, ["תאריך לידה", "שנת לידה"]));
  if (!by.length) {
    /* בלי \b — ב-JS גבול־מילה נשען על [A-Za-z0-9_], ואות עברית
       איננה תו־מילה. לכן /נולד\b/ פשוט לא נתפס לפני רווח, וכל
       השחקנים שהשנה שלהם רק במשפט הפתיחה יצאו בלי שנת לידה. */
    const lead = leadOf(wt);
    const at = lead.search(/(?:נולד[הו]?|יליד(?:ת)?)[\s:־-]/u);
    if (at >= 0) by = yearsIn(lead.slice(at, at + 140));
  }
  const born = by.length ? by[by.length - 1] : null;

  /* לאום: קודם שדה הנבחרת, ואם אין — ארץ הלידה */
  const natCandidates = [
    plain(infoboxField(wt, ["נבחרת", "נבחרת לאומית"])),
    plain(infoboxField(wt, ["מקום לידה"]))
  ].filter(Boolean);
  let nat = null;
  for (const c of natCandidates) {
    const hit = Object.keys(NAT_HE_TO_ISO).find(k => c.includes(k));
    if (hit) { nat = NAT_HE_TO_ISO[hit]; break; }
  }

  return { title, name: stripParen(title), pos, posRaw, posFrom, born, nat,
           natRaw: natCandidates[0] || null };
}

async function scrapeWikiPlayers(club) {
  const cat = readJSON(`data/raw/${club.slug}-wikipedia.json`, null);
  if (!cat) { warn(`${club.slug}: הרץ קודם --source=wiki`); return null; }
  const titles = cat.entries.map(e => e.title);
  const details = [];
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const u = new URL("https://he.wikipedia.org/w/api.php");
    u.searchParams.set("action", "query");
    u.searchParams.set("prop", "revisions");
    u.searchParams.set("rvprop", "content");
    u.searchParams.set("rvslots", "main");
    u.searchParams.set("titles", batch.join("|"));
    u.searchParams.set("format", "json");
    u.searchParams.set("formatversion", "2");
    /* ויקיפדיה מחזירה 429 אם דוחפים יותר מדי בקשות ברצף — נסיגה ולא ויתור */
    let j = null;
    for (let attempt = 0, wait = 2000; attempt < 6; attempt++, wait *= 2) {
      const r = await fetch(u, { headers: { "User-Agent": "sportdel/1.0 (fan project)" } });
      if (r.ok) { j = await r.json(); break; }
      if (r.status !== 429 && r.status < 500) { warn(`ויקיפדיה ${r.status}`); break; }
      warn(`ויקיפדיה ${r.status} — ממתינים ${wait / 1000} שניות`);
      await sleep(wait);
    }
    if (!j) { warn(`${club.slug}: ויקיפדיה לא נענתה, עוצרים אחרי ${details.length} ערכים`); break; }
    for (const p of j.query?.pages || []) {
      const wt = p.revisions?.[0]?.slots?.main?.content;
      if (!wt) continue;
      const d = parsePlayerArticle(p.title, wt);
      if (d) details.push(d);
    }
    await sleep(1200);
  }
  const withPos  = details.filter(d => d.pos).length;
  const withBorn = details.filter(d => d.born).length;
  log(`  ${club.slug} wikiplayers: ${details.length} ערכים · עמדה ל-${withPos} · שנת לידה ל-${withBorn}`);
  return { details };
}

/* ============================================================
   מקור 3ג — חיפוש ישיר בוויקיפדיה לפי שם.
   קטגוריית המועדון לא שלמה: הרבה שחקנים יש להם ערך, אבל הערך
   לא מקוטלג תחת המועדון. מחפשים את השם ככותרת מדויקת.

   שני שומרים מפני שיוך לאדם אחר באותו שם:
   1. הערך חייב להכיל {{אישיות כדורגל}}
   2. הערך חייב להזכיר את שם המועדון
   בלי שניהם — לא לוקחים. אין כאן ניחוש לפי דמיון.
   ============================================================ */
async function wikiBatch(titles) {
  const u = new URL("https://he.wikipedia.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("prop", "revisions");
  u.searchParams.set("rvprop", "content");
  u.searchParams.set("rvslots", "main");
  u.searchParams.set("titles", titles.join("|"));
  u.searchParams.set("redirects", "1");
  u.searchParams.set("format", "json");
  u.searchParams.set("formatversion", "2");
  for (let attempt = 0, wait = 2000; attempt < 6; attempt++, wait *= 2) {
    const r = await fetch(u, { headers: { "User-Agent": "sportdel/1.0 (fan project)" } });
    if (r.ok) return r.json();
    if (r.status !== 429 && r.status < 500) { warn(`ויקיפדיה ${r.status}`); return null; }
    warn(`ויקיפדיה ${r.status} — ממתינים ${wait / 1000} שניות`);
    await sleep(wait);
  }
  return null;
}

async function scrapeWikiExtra(club) {
  const ifa = readJSON(`data/raw/${club.slug}-ifa.json`, null);
  const cat = readJSON(`data/raw/${club.slug}-wikipedia.json`, null);
  if (!ifa) { warn(`${club.slug}: אין נתוני התאחדות — מדלגים`); return null; }

  const known = new Set((cat?.entries || []).flatMap(e => [normName(e.title), normName(e.name)]));
  const cand = new Set();
  for (const list of Object.values(ifa.seasons)) {
    for (const p of list) {
      /* גם וריאנט של השם הפרטי — ההתאחדות רושמת "יצחק קורנפיין"
         ובוויקיפדיה הערך הוא "איציק קורנפיין". */
      for (const n of [p.short, p.full, ...nameVariants(p.short), ...nameVariants(p.full)]) {
        if (!n || /^[*\s]+$/.test(n)) continue;
        if (known.has(normName(n))) continue;
        cand.add(n);
      }
    }
  }
  const titles = [...cand];
  const details = [];
  let checked = 0, rejected = 0;
  /* השוואת שם המועדון בנרמול: הכתבות כותבות "הפועל באר-שבע"
     עם מקף ו-"בית"ר" עם גרש. עדיין השוואה מדויקת, רק מנורמלת. */
  const clubKey = normName(club.he);

  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const j = await wikiBatch(batch);
    if (!j) break;

    /* ויקיפדיה מחזירה כותרת אחרי הפניה — "תומר חליוה" → "תומר חליבה".
       בלי המיפוי הזה אי אפשר לקשור את הערך בחזרה לשחקן. */
    const back = new Map();
    for (const n of j.query?.normalized || []) back.set(n.to, n.from);
    for (const r of j.query?.redirects  || []) back.set(r.to, back.get(r.from) || r.from);
    const askedFor = t => {
      const chain = [];
      let cur = t;
      while (back.has(cur) && !chain.includes(back.get(cur))) { cur = back.get(cur); chain.push(cur); }
      return chain;
    };

    for (const p of j.query?.pages || []) {
      if (p.missing) continue;
      const wt = p.revisions?.[0]?.slots?.main?.content;
      if (!wt) continue;
      checked++;
      if (!normName(wt).includes(clubKey)) { rejected++; continue; }   // לא מזכיר את המועדון
      const d = parsePlayerArticle(p.title, wt);
      if (!d) { rejected++; continue; }
      d.askedAs = askedFor(p.title);
      details.push(d);
    }
    await sleep(1200);
  }
  log(`  ${club.slug} wikiextra: ${titles.length} שמות נבדקו · ${details.length} אומתו · ${rejected} נדחו`);
  return { details, candidates: titles.length };
}

/* ============================================================
   מקור 3ד — קישורי בין־שפה.
   worldfootball מחזיר שם באנגלית, וכל שאר המקורות בעברית.
   הגשר הוא הקישור הרשמי בין ערך עברי לערך אנגלי:
     "אלי אוחנה" ⇄ "Eli Ohana"
   זה מזהה מדויק שוויקיפדיה מתחזקת, לא ניחוש תעתיק. כ-83%
   מהערכים מכוסים.
   ============================================================ */
async function scrapeWikiLang(club) {
  const titles = new Set();
  for (const f of ["wikipedia", "wikiextra", "wikiplayers"]) {
    const j = readJSON(`data/raw/${club.slug}-${f}.json`, null);
    for (const e of j?.entries || []) titles.add(e.title);
    for (const d of j?.details || []) titles.add(d.title);
  }
  const list = [...titles];
  if (!list.length) { warn(`${club.slug}: אין ערכי ויקיפדיה — הרץ קודם --source=wiki`); return null; }

  const links = [];
  for (let i = 0; i < list.length; i += 50) {
    const u = new URL("https://he.wikipedia.org/w/api.php");
    u.searchParams.set("action", "query");
    u.searchParams.set("prop", "langlinks");
    u.searchParams.set("lllang", "en");
    u.searchParams.set("lllimit", "500");
    u.searchParams.set("titles", list.slice(i, i + 50).join("|"));
    u.searchParams.set("redirects", "1");
    u.searchParams.set("format", "json");
    u.searchParams.set("formatversion", "2");
    let j = null;
    for (let a = 0, wait = 2000; a < 6; a++, wait *= 2) {
      const r = await fetch(u, { headers: { "User-Agent": "sportdel/1.0 (fan project)" } });
      if (r.ok) { j = await r.json(); break; }
      if (r.status !== 429 && r.status < 500) { warn(`ויקיפדיה ${r.status}`); break; }
      warn(`ויקיפדיה ${r.status} — ממתינים ${wait / 1000} שניות`);
      await sleep(wait);
    }
    if (!j) break;
    for (const p of j.query?.pages || []) {
      const en = p.langlinks?.[0]?.title;
      if (en) links.push({ he: p.title, en });
    }
    await sleep(900);
  }
  log(`  ${club.slug} wikilang: ${links.length} מתוך ${list.length} ערכים עם שם אנגלי`);
  return { links };
}

/* ============================================================
   מקור 3ה — גשר דרך ויקיפדיה האנגלית.
   הכתיב הלטיני של worldfootball לא זהה לזה של ויקיפדיה:
   "Beni Tabak" מול "Benny Tabak", "Yuval Shpungin" מול "Yuval Spungin".
   לכן חיפוש כותרת מדויקת נכשל.

   הפתרון: מחפשים באנגלית, ומהערך שנמצא הולכים בקישור הבין־שפתי
   לעברית. שני אימותים לפני שמקבלים:
     1. לערך האנגלי יש קישור לעברית
     2. שנת הלידה בערך זהה לזו של worldfootball
   בלי שניהם — לא מקבלים. אין כאן ניחוש תעתיק.
   ============================================================ */
async function enWiki(params) {
  const u = new URL("https://en.wikipedia.org/w/api.php");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("format", "json");
  u.searchParams.set("formatversion", "2");
  for (let a = 0, wait = 2500; a < 6; a++, wait *= 2) {
    const r = await fetch(u, { headers: { "User-Agent": "sportdel/1.0 (fan project)" } });
    if (r.ok) return r.json();
    if (r.status !== 429 && r.status < 500) { warn(`en.wikipedia ${r.status}`); return null; }
    await sleep(wait);
  }
  return null;
}

/* מאמת שהערך האנגלי הוא באמת ביוגרפיה של כדורגלן, ושהשנה שנמצאה
   היא שנת הלידה שלו — ולא סתם שנה כלשהי בטקסט.

   בלי זה חיפוש "Gal Navon footballer" מחזיר את הערך של המועדון
   ("Beitar Jerusalem F.C."), ובכתבה על מועדון יש מאות שנים, אז
   בדיקת שנת הלידה עוברת והשם העברי שנקלט הוא שם המועדון. */
function enBirthYear(wt) {
  if (!/\{\{\s*Infobox football biography/i.test(wt)) return null;   // לא ביוגרפיה
  const m = wt.match(/\|\s*birth_date\s*=([^\n]*)/i);
  const src = m ? m[1] : (wt.match(/'''[^']*'''[^\n]{0,200}/) || [""])[0];
  const ys = [...src.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(x => +x[1])
    .filter(y => y >= 1930 && y <= 2012);
  return ys.length ? ys[0] : null;
}

async function scrapeEnBridge(club) {
  if (existsSync(`data/raw/${club.slug}-reference.json`)) {
    log(`  ${club.slug}: יש מאגר ייצור, שכבת worldfootball לא בשימוש — מדלגים`);
    return null;
  }
  const wf = readJSON(`data/raw/${club.slug}-worldfootball.json`, null);
  if (!wf) { warn(`${club.slug}: אין נתוני worldfootball — מדלגים`); return null; }
  const lang = readJSON(`data/raw/${club.slug}-wikilang.json`, { links: [] });
  const bridged = new Set(lang.links.map(l => normLatin(l.en)));

  /* רק מי שעוד לא מגושר, ורק מי ששיחק מספיק כדי להיות תשובה */
  const byName = new Map();
  for (const [y, list] of Object.entries(wf.seasons))
    for (const p of list) {
      if (!p.name || bridged.has(normLatin(p.name))) continue;
      if (!byName.has(p.name)) byName.set(p.name, { name: p.name, born: p.born, years: [] });
      byName.get(p.name).years.push(+y);
      if (!byName.get(p.name).born && p.born) byName.get(p.name).born = p.born;
    }
  const todo = [...byName.values()]
    .filter(p => p.born && new Set(p.years).size >= 2)
    .sort((a, b) => b.years.length - a.years.length);

  /* המשך מהרצה קודמת. השלב הזה איטי — ויקיפדיה מווסתת אותנו —
     ובלי נקודת שמירה, קטיעה באמצע מאבדת את הכול. */
  const outFile = `data/raw/${club.slug}-enbridge.json`;
  const prev = readJSON(outFile, null);
  const links = prev?.links ? [...prev.links] : [];
  const done = new Set(links.map(l => l.en));
  const tried = new Set(prev?.tried || []);          // נבדקו ולא נמצאו
  const save = () => writeJSON(outFile, {
    club: club.slug, source: "enbridge",
    links, tried: [...tried], checked: done.size + tried.size
  });
  if (prev) log(`  ${club.slug}: ממשיכים — ${links.length} כבר מגושרים, ${tried.size} כבר נבדקו`);

  /* מעבר ראשון, זול: אולי השם של worldfootball הוא בדיוק כותרת
     הערך האנגלי. 50 בבקשה אחת במקום חיפוש לכל שחקן. */
  const fresh = todo.filter(p => !done.has(p.name) && !tried.has(p.name));
  for (let i = 0; i < fresh.length; i += 50) {
    const batch = fresh.slice(i, i + 50);
    const j = await enWiki({ action: "query", prop: "langlinks|revisions",
      lllang: "he", rvprop: "content", rvslots: "main", rvsection: "0",
      redirects: "1", titles: batch.map(p => p.name).join("|") });
    if (!j) break;
    const back = new Map();
    for (const n of j.query?.normalized || []) back.set(n.to, n.from);
    for (const r of j.query?.redirects  || []) back.set(r.to, back.get(r.from) || r.from);
    for (const pg of j.query?.pages || []) {
      if (pg.missing) continue;
      const he = pg.langlinks?.[0]?.title;
      if (!he) continue;
      const asked = back.get(pg.title) || pg.title;
      const p = batch.find(x => normLatin(x.name) === normLatin(asked));
      if (!p) continue;
      const wt = pg.revisions?.[0]?.slots?.main?.content || "";
      if (enBirthYear(wt) !== p.born) continue;      // ביוגרפיה + שנת לידה תואמת
      links.push({ en: p.name, he: stripParen(he), via: pg.title, born: p.born, how: "כותרת" });
      done.add(p.name);
    }
    save();
    await sleep(900);
  }
  log(`  ${club.slug} enbridge: ${links.length} בכותרת מדויקת, ` +
      `${todo.length - done.size - tried.size} עוברים לחיפוש`);

  let searched = 0, rejected = 0;
  for (const p of todo) {
    if (done.has(p.name) || tried.has(p.name)) continue;
    const s = await enWiki({ action: "query", list: "search",
      srsearch: `${p.name} footballer`, srlimit: "3" });
    searched++;
    const titles = (s?.query?.search || []).map(x => x.title);
    if (!titles.length) { tried.add(p.name); await sleep(700); continue; }

    const k = await enWiki({ action: "query", prop: "langlinks|revisions",
      lllang: "he", rvprop: "content", rvslots: "main", rvsection: "0",
      titles: titles.join("|") });
    let hit = null;
    for (const pg of k?.query?.pages || []) {
      const he = pg.langlinks?.[0]?.title;
      if (!he) continue;
      const wt = pg.revisions?.[0]?.slots?.main?.content || "";
      if (enBirthYear(wt) !== p.born) continue;      // ביוגרפיה + שנת לידה תואמת
      hit = { en: p.name, he: stripParen(he), via: pg.title, born: p.born, how: "חיפוש" };
      break;
    }
    if (hit) { links.push(hit); done.add(p.name); }
    else { tried.add(p.name); rejected++; }
    /* נקודת שמירה כל עשרה — קטיעה עולה לכל היותר עשרה חיפושים */
    if (searched % 10 === 0) save();
    if (searched % 25 === 0)
      log(`    ${club.slug}: ${searched} נבדקו בהרצה זו · ${links.length} מגושרים בסך הכול`);
    await sleep(700);
  }
  save();
  log(`  ${club.slug} enbridge: ${todo.length} מועמדים · ${links.length} גושרו · ${rejected} נדחו בחיפוש`);
  return null;   // כבר נכתב בנקודות השמירה
}

/* ============================================================
   מקור 4 (ביתר בלבד) — הגרסה שרצה בייצור.
   זהו מאגר שאומת מול משתמשים אמיתיים, ולכן הוא מקור אמת
   לשמות העבריים ולתיקוני העונות שנעשו ידנית.
   ============================================================ */
function scrapeReference(club) {
  if (club.slug !== "beitar") return null;
  /* הגרסה עם הקרב היא המאוחרת, וזו שרצה בפועל. אומת מול האתר החי:
     PLAYERS_RAW ו-SCHEDULE זהים לה בדיוק. הקובץ הישן נשאר רק
     כהיסטוריה — הלוח שלו נבדל מהייצור מחידה #4 והלאה. */
  const path = ["reference/beitardle-versus.html", "reference/beitardle.html"]
    .find(p => existsSync(p));
  if (!path) return null;
  log(`  ${club.slug}: מקור הייצור — ${path}`);
  const html = readText(path);
  const grab = name => {
    const s = html.indexOf(`const ${name} = [`);
    if (s < 0) return null;
    const open = html.indexOf("[", s);
    let d = 0, i = open;
    for (; i < html.length; i++) {
      if (html[i] === "[") d++;
      else if (html[i] === "]" && !--d) break;
    }
    return new Function(`return ${html.slice(open, i + 1)}`)();
  };
  const players = grab("PLAYERS_RAW"), schedule = grab("SCHEDULE");
  if (!players) return null;
  log(`  ${club.slug} reference: ${players.length} שחקנים, ${schedule?.length || 0} בלוח`);
  return { players, schedule };
}

/* ============================================================
   מקור 2ב — דף השחקן של ההתאחדות.

   דף הסגל נותן שם ועונה ותו לא. דף השחקן עצמו נותן **שנת לידה
   ואזרחות**, וזה בדיוק מה שחסר ל-562 השחקנים שיורדים מהמשחק.
   אין בו עמדה — אבל שנת הלידה לבדה מפעילה את הגשר המבני מול
   worldfootball (לידה + חפיפת עונות), ומשם מגיעה גם העמדה.

   אימות: 1426 מחזיר 04/1972, וויקיפדיה כותבת 26 באפריל 1972.

   הקובץ משותף לכל המועדונים ולא מפוצל לפיהם, כי המפתח הוא
   השחקן ולא הקבוצה: מי ששיחק בשתיים מהן לא נשאב פעמיים.
   הריצה המשכית — נשמרת כל 20 שחקנים, ומדלגת על מי שכבר נבדק.
   ============================================================ */
const IFA_PLAYERS_FILE = "data/raw/ifa-players.json";

function extractIfaPlayerInPage() {
  const t = document.body.innerText;
  const flat = t.replace(/\s+/g, " ");
  const born = (flat.match(/תאריך לידה:\s*(\d{1,2})\/(\d{4})/) || []).slice(1);
  /* על טקסט שטוח אי אפשר לדעת איפה נגמרת האזרחות ומתחיל השם.
     שורה שלמה מה-innerText היא הגבול הנכון. */
  const nat  = (t.match(/אזרחות:[ \t]*([^\n]+)/) || [])[1] || null;
  /* השם יושב בשורה שמעל "תאריך לידה" */
  const name = (t.match(/([^\n]+)\n\s*תאריך לידה/) || [])[1] || null;
  const seasons = [...document.querySelectorAll("select option")]
    .map(o => o.textContent.trim())
    .filter(s => /^\d{4}\/\d{4}$/.test(s))
    .map(s => +s.split("/")[1]);
  return {
    name: name ? name.trim() : null,
    born: born.length ? +born[1] : null,
    bornMonth: born.length ? +born[0] : null,
    nat: nat ? nat.trim() : null,
    seasons: [...new Set(seasons)].sort((a, b) => a - b)
  };
}

async function scrapeIfaPlayers(clubList, page, thr) {
  const store = readJSON(IFA_PLAYERS_FILE, { players: {} });
  const want = new Map();                       // id → מאיזה מועדון ראינו אותו
  for (const club of clubList) {
    const ifa = readJSON(`data/raw/${club.slug}-ifa.json`, null);
    for (const list of Object.values(ifa?.seasons || {}))
      for (const p of list) if (p.id && !want.has(p.id)) want.set(p.id, club.slug);
  }
  /* ברירת מחדל: רק מי שאין לו עדיין שנת לידה במאגר. --all סורק הכול. */
  const onlyMissing = !args.all;
  const need = [...want.keys()].filter(id => {
    const have = store.players[id];
    if (!have) return true;
    return onlyMissing ? have.born == null : false;
  });
  const limit = args.limit ? +args.limit : need.length;
  const todo = need.slice(0, limit);
  log(`  התאחדות — דפי שחקן: ${want.size} מזהים · ${todo.length} לסריקה עכשיו`);

  let done = 0, blocked = 0, gotBorn = 0;
  for (const id of todo) {
    const url = `https://www.football.org.il/players/player/?player_id=${id}`;
    const ok = await gotoStable(page, url, { waitChallenge: 25, settle: 800 });
    if (!ok) {
      blocked++;
      if (!(await thr.fail())) { warn(`ההתאחדות חוסמת ברצף — עוצרים על ${id}`); break; }
      continue;
    }
    thr.ok();
    const d = await page.evaluate(extractIfaPlayerInPage);
    /* האזרחות מגיעה בעברית. הטבלה כבר קיימת כאן בשביל ויקיפדיה,
       וההמרה בשלב השאיבה חוסכת טבלה שנייה ב-enrich. */
    const natHe = d.nat ? d.nat.split(/[,/]/)[0].trim() : null;
    const natIso = natHe ? (NAT_HE_TO_ISO[natHe] ?? null) : null;
    store.players[id] = { ...d, natHe, natIso,
                          club: want.get(id), at: new Date().toISOString().slice(0, 10) };
    if (d.born) gotBorn++;
    done++;
    if (done % 20 === 0) {
      writeJSON(IFA_PLAYERS_FILE, store);
      log(`  ${done}/${todo.length} · ${gotBorn} עם שנת לידה`);
    }
    await thr.pace();
  }
  writeJSON(IFA_PLAYERS_FILE, store);
  log(`  התאחדות — דפי שחקן: ${done} נסרקו · ${gotBorn} עם שנת לידה · ${blocked} חסימות`);
  return { done, gotBorn, blocked, total: Object.keys(store.players).length };
}

/* ============================================================
   מקור 3ה — טבלת הקריירה מתיבת המידע.

   זה המקור היחיד שיודע מתי שחקן **התחיל** במועדון. ההתאחדות
   מתחילה ב-2002/03, וסגלי worldfootball של שנות השבעים והתשעים
   חלקיים — אצל מאיר נמני הוא הכיר שלוש עונות מתוך שלוש-עשרה.
   התיבה של ויקיפדיה העברית רושמת את השורה במלואה:

     | שנים כשחקן    = 1989–1998 {{ש}} 1998 {{ש}} 1998–2003
     | מועדונים כשחקן = מכבי תל אביב {{ש}} אתלטיקו מדריד {{ש}} מכבי תל אביב

   שתי הרשימות מקבילות, ולכן מפצלים את שתיהן על {{ש}} ומרכיבים
   זוגות. שומרים רק שורות של המועדון שלנו.

   המרה לעונות: "1989–1998" הוא 89/90 עד 97/98, כלומר שנות סיום
   1990 עד 1998. שנה בודדת ("1998") היא עונה אחת שמסתיימת ב-1999,
   אבל היא גם הצורה שבה נרשמת השאלה של חצי עונה — ולכן היא
   מסומנת `ambiguous` ולא נכנסת לתיקון אוטומטי.

   חץ ← לפני שם מועדון הוא השאלה. השאלה **אל** המועדון שלנו היא
   עונה לכל דבר; השאלה ממנו החוצה רשומה על המועדון האחר ולכן
   נופלת מעצמה בסינון.
   ============================================================ */
const SPLIT_ROWS = /\{\{\s*ש\s*\}\}|<\s*br\s*\/?\s*>/i;

function careerRows(wt) {
  const split = s => String(s).split(SPLIT_ROWS).map(x => plain(x).trim());
  const ys = infoboxField(wt, ["שנים כשחקן", "שנים"]);
  const cs = infoboxField(wt, ["מועדונים כשחקן", "מועדונים"]);
  if (ys && cs) {
    const a = split(ys), b = split(cs), out = [];
    for (let i = 0; i < Math.min(a.length, b.length); i++)
      if (a[i] && b[i]) out.push({ years: a[i], club: b[i] });
    return out;
  }
  /* התבנית הממוספרת: | שנים1 = ... | מועדון1 = ... */
  const out = [];
  for (let i = 1; i <= 25; i++) {
    const y = infoboxField(wt, [`שנים${i}`]);
    const c = infoboxField(wt, [`מועדון${i}`, `מועדונים${i}`]);
    if (!y || !c) continue;
    out.push({ years: plain(y).trim(), club: plain(c).trim() });
  }
  return out;
}

/* מחרוזת שנים → [שנת סיום ראשונה, שנת סיום אחרונה] */
function rowSpell(s, openEnd) {
  const t = String(s).replace(/\s+/g, "");
  let m = t.match(/^(\d{4})[–—−-](\d{4})$/);
  if (m) {
    const a = +m[1] + 1, b = +m[2];
    return a <= b ? { spell: [a, b], ambiguous: false } : null;
  }
  m = t.match(/^(\d{4})[–—−-]$/);                    // "2019–" — עדיין בקבוצה
  if (m) {
    const a = +m[1] + 1;
    return a <= openEnd ? { spell: [a, openEnd], ambiguous: false } : null;
  }
  m = t.match(/^(\d{4})$/);                          // שנה בודדת — עונה או חצי
  if (m) return { spell: [+m[1] + 1, +m[1] + 1], ambiguous: true };
  return null;
}

async function scrapeWikiCareer(club) {
  const titles = new Set();
  for (const f of ["wikipedia", "wikiextra", "wikiplayers"]) {
    const j = readJSON(`data/raw/${club.slug}-${f}.json`, null);
    for (const e of j?.entries  || []) titles.add(e.title);
    for (const d of j?.details  || []) titles.add(d.title);
  }
  const list = [...titles];
  if (!list.length) { warn(`${club.slug}: אין כותרות ויקיפדיה — הרץ קודם --source=wiki`); return null; }

  const clubKey = normName(stripParen(club.he));
  const isOurs = name => {
    const n = normName(stripParen(String(name).replace(/^\s*[←→]\s*/, "")));
    return n === clubKey || n.includes(clubKey);
  };
  const openEnd = TO + 1;

  const details = [];
  let withRows = 0, noBox = 0;
  for (let i = 0; i < list.length; i += 50) {
    const j = await wikiBatch(list.slice(i, i + 50));
    if (!j) break;
    for (const p of j.query?.pages || []) {
      if (p.missing) continue;
      const wt = p.revisions?.[0]?.slots?.main?.content;
      if (!wt || !/\{\{\s*אישיות כדורגל/.test(wt)) { noBox++; continue; }
      const rows = careerRows(wt).filter(r => isOurs(r.club));
      if (!rows.length) continue;
      const spells = [], raw = [];
      let ambiguous = false;
      for (const r of rows) {
        const got = rowSpell(r.years, openEnd);
        raw.push({ years: r.years, club: r.club, ok: !!got });
        if (!got) { ambiguous = true; continue; }
        if (got.ambiguous) ambiguous = true;
        spells.push(got.spell);
      }
      if (!spells.length) continue;
      const years = new Set();
      for (const [a, b] of spells) for (let y = a; y <= b; y++) years.add(y);
      details.push({
        title: p.title, name: stripParen(p.title),
        spells: toSpells([...years]), years: [...years].sort((a, b) => a - b),
        ambiguous, rows: raw
      });
      withRows++;
    }
    await sleep(1200);
  }
  log(`  ${club.slug} wikicareer: ${list.length} ערכים · ${withRows} עם טבלת קריירה · ${noBox} בלי תיבה`);
  return { details, checked: list.length };
}

/* ============================================================
   ראשי
   ============================================================ */
const wantWf   = only.includes("wf");
const wantIfa  = only.includes("ifa");
const wantIfaP = only.includes("ifaplayers");
/* גם פרסור מ-cache צריך DOM, אז שני המקורות האלה תמיד פותחים דפדפן */
const needsBrowser = wantWf || wantIfa || wantIfaP;

let br = null;
if (needsBrowser) {
  br = await openBrowser({ headless: !!args.headless });
  if (args.headless) warn("מצב headless — worldfootball יחסום. השתמש בלי --headless.");
}

try {
  /* דפי השחקן של ההתאחדות רצים פעם אחת לכל המועדונים יחד — המפתח
     הוא השחקן, ומי ששיחק בשתיים מהן לא נשאב פעמיים. */
  if (wantIfaP) {
    const thr = makeThrottle({ base: 800, maxStreak: 5 });
    await scrapeIfaPlayers(clubs, br.page, thr);
  }

  for (const club of clubs) {
    log(`── ${club.slug} (${club.he}) ──`);

    if (only.includes("reference")) {
      const ref = scrapeReference(club);
      if (ref) writeJSON(`data/raw/${club.slug}-reference.json`,
        { club: club.slug, source: "reference", ...ref });
      else if (club.slug === "beitar") warn("reference/beitardle.html לא נמצא");
    }

    if (wantWf) {
      if (!club.worldfootball || club.worldfootball === "TODO") {
        warn(`${club.slug}: אין מזהה worldfootball — מדלגים`);
      } else {
        const thr = makeThrottle({ base: 900, maxStreak: 5 });
        const r = await scrapeWorldfootball(club, br.page, thr);
        writeJSON(`data/raw/${club.slug}-worldfootball.json`, {
          club: club.slug, source: "worldfootball", team: club.worldfootball,
          range: [FROM, TO], stoppedAt: r.stoppedAt ?? null, seasons: r.seasons
        });
        log(`${club.slug} wf: ${Object.keys(r.seasons).length} עונות ` +
            `(חדשות ${r.fetched}, מה-cache ${r.cached}, חסימות ${r.blocked})`);
      }
    }

    if (wantIfa) {
      if (!club.ifaTeamId || club.ifaTeamId === "TODO") {
        warn(`${club.slug}: אין team_id בהתאחדות — מדלגים`);
      } else {
        const thr = makeThrottle({ base: 800, maxStreak: 5 });
        const r = await scrapeIfa(club, br.page, thr);
        writeJSON(`data/raw/${club.slug}-ifa.json`, {
          club: club.slug, source: "ifa", teamId: club.ifaTeamId,
          stoppedAt: r.stoppedAt ?? null, seasons: r.seasons
        });
        log(`${club.slug} ifa: ${Object.keys(r.seasons).length} עונות ` +
            `(חדשות ${r.fetched}, מה-cache ${r.cached})`);
      }
    }

    if (only.includes("wiki")) {
      if (!club.wikiCategory || club.wikiCategory === "TODO") {
        warn(`${club.slug}: אין קטגוריית ויקיפדיה — מדלגים`);
      } else {
        const r = await scrapeWikipedia(club);
        writeJSON(`data/raw/${club.slug}-wikipedia.json`,
          { club: club.slug, source: "wikipedia", category: club.wikiCategory, ...r });
      }
    }

    if (only.includes("wikiplayers")) {
      const r = await scrapeWikiPlayers(club);
      if (r) writeJSON(`data/raw/${club.slug}-wikiplayers.json`,
        { club: club.slug, source: "wikiplayers", ...r });
    }

    if (only.includes("wikiextra")) {
      const r = await scrapeWikiExtra(club);
      if (r) writeJSON(`data/raw/${club.slug}-wikiextra.json`,
        { club: club.slug, source: "wikiextra", ...r });
    }

    if (only.includes("wikilang")) {
      const r = await scrapeWikiLang(club);
      if (r) writeJSON(`data/raw/${club.slug}-wikilang.json`,
        { club: club.slug, source: "wikilang", ...r });
    }

    if (only.includes("wikicareer")) {
      const r = await scrapeWikiCareer(club);
      if (r) writeJSON(`data/raw/${club.slug}-wikicareer.json`,
        { club: club.slug, source: "wikicareer", ...r });
    }

    if (only.includes("enbridge")) {
      const r = await scrapeEnBridge(club);
      if (r) writeJSON(`data/raw/${club.slug}-enbridge.json`,
        { club: club.slug, source: "enbridge", ...r });
    }
  }
} finally {
  if (br) await br.close();
}

log("סיום.");
