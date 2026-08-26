/* מפרסר את טבלאות "עונה → זוכה" מוויקיפדיה העברית ומפיק
   רשימות שנים לכל מועדון. שנת התואר = שנת סיום העונה.

   האימות הוא הלב של הסקריפט: אם הפרסור לא משחזר בדיוק את
   שני המועדונים שכבר אומתו ידנית — הוא נפסל ולא נכתב כלום. */
import { readJSON, writeJSON, readText, die } from "../scripts/lib/util.mjs";

const LEAGUE_WT = "data/raw/wiki/ליגת העל בכדורגל.wikitext";
const CUP_WT    = "data/raw/wiki/גביע המדינה בכדורגל.wikitext";

/* שם ויקיפדיה → slug אצלנו */
const CLUB_OF = new Map(Object.entries({
  'בית"ר ירושלים':      "beitar",
  "הפועל באר שבע":      "hapoel-bs",
  "מכבי תל אביב":       "maccabi-ta",
  "מכבי חיפה":          "maccabi-haifa",
  "הפועל תל אביב":      "hapoel-ta",
}));

const LINK = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;

/* מנקה תצוגת קישור: מדגשים (גם ''''' = מודגש+נטוי), רווחים */
const disp = (target, label) =>
  (label || target).replace(/'{2,}/g, "").replace(/\s+/g, " ").trim();

/* מזהה תווית עונה: "1986/1987", "1938", "1966/1968" */
function seasonEnd(text) {
  const m = text.match(/^\(?(\d{4})(?:\s*\/\s*(\d{4}))?\)?$/);
  if (!m) return null;
  return +(m[2] || m[1]);
}

/* שם קבוצה מקנוני: "מכבי תל אביב (כדורגל)" → "מכבי תל אביב" */
function clubName(target, label) {
  const d = disp(target, label);
  return d.replace(/\s*\(כדורגל\)\s*$/, "").trim();
}

/* חותך את הוויקיטקסט לטבלאות, עם ספירת קינון.
   בלי זה טבלת המאמנים וטבלת העולות/יורדות נבלעות פנימה
   ומייצרות "זוכות" מדומות. */
function tables(wikitext) {
  const out = [];
  const lines = wikitext.split("\n");
  let depth = 0, buf = null;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("{|")) { depth++; if (depth === 1) { buf = []; continue; } }
    if (t.startsWith("|}") && depth) { depth--; if (!depth) { out.push(buf.join("\n")); buf = null; continue; } }
    if (buf) buf.push(line);
  }
  return out;
}

/* הטבלה הנכונה היא זו שיש בה גם עמודת "עונה" וגם "אלופה"/"זוכה" */
function isWinnerTable(tbl) {
  const cells = tbl.split("\n")
    .filter(l => l.trimStart().startsWith("!"))
    .flatMap(l => l.trimStart().slice(1).split("!!"))
    .flatMap(c => c.split(/(?<=\S)\s*!\s*/))
    .map(c => c.replace(/^[^|]*\|/, "").replace(/'''/g, "").trim());
  const hasSeason = cells.some(c => /^עונה$/.test(c));
  const hasWinner = cells.some(c => /^(אלופה|זוכה)$/.test(c));
  return hasSeason && hasWinner;
}

/* עובר על בלוקי שורות בטבלאות ומוציא [שנת_סיום, שם_זוכה] */
function seasonWinners(wikitext) {
  const rows = tables(wikitext).filter(isWinnerTable).flatMap(t => t.split(/\n\|-/));
  const out = [];
  for (const row of rows) {
    if (/ללא זוכה|לא נקבעה זוכה|בוטל/.test(row)) continue;
    LINK.lastIndex = 0;
    const links = [];
    let m;
    while ((m = LINK.exec(row))) links.push([m[1], m[2]]);
    if (links.length < 2) continue;

    /* העונה חייבת להיות הקישור הראשון בשורה — כך שורות
       שמתחילות בשם מאמן או בשם שחקן לא נחשבות בטעות. */
    const si = 0;
    if (seasonEnd(disp(links[0][0], links[0][1])) === null) continue;
    if (si + 1 >= links.length) continue;
    const year = seasonEnd(disp(links[si][0], links[si][1]));
    /* הזוכה הוא הקישור הבא — אבל לא קובץ/תמונה/הערה */
    let wi = si + 1;
    while (wi < links.length && /^(קובץ|תמונה|File|Image|:)/.test(links[wi][0])) wi++;
    if (wi >= links.length) continue;
    const name = clubName(links[wi][0], links[wi][1]);
    if (!name || seasonEnd(name) !== null) continue;
    out.push([year, name]);
  }
  return out;
}

function collect(wikitext, label) {
  const pairs = seasonWinners(wikitext);
  const byClub = new Map();
  for (const [year, name] of pairs) {
    const slug = CLUB_OF.get(name);
    if (!slug) continue;
    if (!byClub.has(slug)) byClub.set(slug, new Set());
    byClub.get(slug).add(year);
  }
  console.log(`${label}: ${pairs.length} שורות עונה→זוכה, ` +
    `${[...byClub.keys()].length} מהמועדונים שלנו`);
  /* אם שם מועדון מגיע בכתיב שלא מיפינו הוא ייעלם בשקט — מדפיסים
     את כל השמות שנקלטו כדי שאפשר יהיה לראות את זה בעין. */
  const unknown = [...new Set(pairs.map(p => p[1]))].filter(n => !CLUB_OF.has(n));
  console.log(`   זוכות שאינן מהחמישייה: ${unknown.length}`);
  return byClub;
}

/* ספירות שהכתבה עצמה מציגה בטבלאות הסיכום — בדיקה שנייה
   מול אותו מקור, שתופסת שורה שנפלה בפרסור. */
const EXPECT_TOTAL = {
  "beitar":        { league: 6,  cup: 8  },
  "hapoel-bs":     { league: 6,  cup: 4  },
  "maccabi-ta":    { league: 26, cup: 25 },
  "maccabi-haifa": { league: 15, cup: 6  },
  "hapoel-ta":     { league: 13, cup: 16 },
};

const league = collect(readText(LEAGUE_WT) || die(`חסר ${LEAGUE_WT}`), "אליפויות");
const cup    = collect(readText(CUP_WT)    || die(`חסר ${CUP_WT}`),    "גביעים");

/* המדינה קמה ב-1948. תחרויות המנדט הן מפעל אחר, ולכן מופרדות.
   ממילא המאגר מתחיל ב-1969/70, אז ההפרדה לא משפיעה על הספירה. */
const STATE = 1949;
const split = set => {
  const ys = [...(set || [])].sort((a, b) => a - b);
  return { modern: ys.filter(y => y >= STATE), preState: ys.filter(y => y < STATE) };
};

const result = {};
for (const slug of new Set([...CLUB_OF.values()])) {
  const L = split(league.get(slug)), C = split(cup.get(slug));
  result[slug] = {
    league: L.modern, cup: C.modern,
    leaguePreState: L.preState, cupPreState: C.preState
  };
}

/* ---------- אימות מול המאומתים ---------- */
const cfg = readJSON("config/clubs.json");
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
let bad = 0;
for (const slug of ["beitar", "hapoel-bs"]) {
  const want = cfg[slug]?.titles;
  if (!want || typeof want.league === "string") continue;
  for (const kind of ["league", "cup"]) {
    const got = result[slug][kind];
    if (eq(got, want[kind])) console.log(`✓ ${slug}.${kind} תואם (${got.length})`);
    else {
      bad++;
      console.log(`✖ ${slug}.${kind} לא תואם`);
      console.log(`   מהפרסור: ${got.join(", ")}`);
      console.log(`   מאומת:   ${want[kind].join(", ")}`);
    }
  }
}
for (const [slug, want] of Object.entries(EXPECT_TOTAL)) {
  const r = result[slug];
  for (const kind of ["league", "cup"]) {
    const got = r[kind].length + r[kind === "league" ? "leaguePreState" : "cupPreState"].length;
    if (got !== want[kind]) {
      bad++;
      console.log(`✖ ${slug}.${kind}: נמצאו ${got}, הכתבה מונה ${want[kind]}`);
    }
  }
}
if (bad) die("הפרסור לא משחזר את המועדונים המאומתים — לא כותבים כלום.");

for (const [slug, v] of Object.entries(result))
  console.log(`${slug}: ${v.league.length} אליפויות, ${v.cup.length} גביעים` +
    (v.leaguePreState.length || v.cupPreState.length
      ? `  (ותקופת המנדט: ${v.leaguePreState.length}/${v.cupPreState.length})` : ""));

writeJSON("data/raw/titles.json", result);
console.log("\n→ data/raw/titles.json");
