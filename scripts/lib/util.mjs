/* עזרים משותפים לכל הסקריפטים. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- קבצים ---------- */
export function readJSON(path, fallback = undefined) {
  if (!existsSync(path)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`חסר קובץ: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}
export function writeJSON(path, data, pretty = 1) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, pretty) + "\n", "utf8");
  return path;
}
export function readText(path, fallback = null) {
  return existsSync(path) ? readFileSync(path, "utf8") : fallback;
}
export function writeText(path, s) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, s, "utf8");
  return path;
}

/* ---------- לוג ---------- */
const t0 = Date.now();
const stamp = () => String(((Date.now() - t0) / 1000).toFixed(1)).padStart(6) + "s";
export const log  = (...a) => console.log(stamp(), ...a);
export const warn = (...a) => console.log(stamp(), "⚠ ", ...a);
export const die  = m => { console.error("\n✖ " + m + "\n"); process.exit(1); };

/* ---------- נרמול שמות (באג 6.4) ----------
   ויקיפדיה כותבת "תומר בן-יוסף", משתמשים מקלידים "תומר בן יוסף".
   מנרמלים את שני הצדדים לפני כל השוואה. */
export function normName(s) {
  return String(s || "")
    .replace(/[־‐-―\-–—]/g, " ")   // מקף עברי, מקפים לועזיים
    .replace(/["'׳״‘’“”`]/g, "")
    .replace(/[֑-ׇ]/g, "")               // ניקוד וטעמים
    .replace(/\s+/g, " ")
    .trim();
}

/* חלקיקי שם משפחה — "בן שושן" הוא שם משפחה אחד, לא שם אמצעי.
   בלי הרשימה הזאת "דודו בן שושן" הופך ל"דודו שושן", וזה סתם שם אחר. */
const PARTICLES = new Set(["בן", "בר", "אבו", "אל", "דה", "די", "דל", "ואן", "מק", "בית", "אבן"]);

/* שם קצר: מילה ראשונה + שם המשפחה.
   ההתאחדות רושמת "עדן מנחם יונה" — אוהדים מקלידים "עדן יונה". */
export function shortName(s) {
  const w = normName(s).split(" ").filter(Boolean);
  if (w.length <= 2) return w.join(" ");
  /* שם המשפחה מתחיל בחלקיק האחרון שמופיע לפני המילה האחרונה */
  let start = w.length - 1;
  while (start > 1 && PARTICLES.has(w[start - 1])) start--;
  return [w[0], ...w.slice(start)].join(" ");
}

/* ההתאחדות מסמנת שחקן זר בתגית /זר/ בתוך השם.
   מנקים אותה מהשם, אבל שומרים את הסימן — הוא הרמז היחיד
   שיש לנו על לאום כשאין ערך ויקיפדיה. */
export const isForeignIfa = raw => /\/\s*זר\s*\//.test(String(raw || ""));

/* ניקוי שם מההתאחדות: הטקסט מגיע לפעמים כפול, ולזרים יש תגית /זר/ */
export function cleanIfaName(raw) {
  let s = String(raw || "").replace(/\s+/g, " ").trim();
  s = s.replace(/\s*\/\s*זר\s*\/\s*/g, " ");          // "דימטרי/זר/ אוליאנוב"
  s = s.replace(/\s+/g, " ").trim();
  // "דן ביטון דן ביטון" → "דן ביטון"
  const half = s.length / 2;
  if (s.length % 2 === 1 && s[Math.floor(half)] === " ") {
    const a = s.slice(0, Math.floor(half)), b = s.slice(Math.ceil(half));
    if (a === b) s = a;
  }
  return s;
}

/* נרמול שם לטיני, לצורך גישור worldfootball ⇄ ויקיפדיה האנגלית.
   "Carlos García" ו-"Carlos Garcia" הם אותו אדם. */
export function normLatin(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // הסרת סימני ניקוד לטיניים
    .toLowerCase()
    .replace(/[.'’`´-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- שקילות שמות פרטיים ----------
   ההתאחדות רושמת שם חוקי, ויקיפדיה רושמת כינוי: "יצחק קורנפיין"
   מול "איציק קורנפיין". בלי זה מאבדים את החיבור.

   הכלל שמונע את הטעות של סעיף 4 במפרט: מחליפים **רק את השם
   הפרטי**, ורק לפי הטבלה הסגורה. שם המשפחה נשאר זהה תו־בתו,
   ולכן "אריאל עוז" לעולם לא יזווג ל"אריאל הרוש". */
let _nick = null;
function nickMap() {
  if (_nick) return _nick;
  _nick = new Map();
  const cfg = readJSON("config/nicknames.json", { groups: [] });
  for (const g of cfg.groups)
    for (const a of g) {
      if (!_nick.has(a)) _nick.set(a, new Set());
      for (const b of g) if (b !== a) _nick.get(a).add(b);
    }
  return _nick;
}
export function nameVariants(name) {
  const w = normName(name).split(" ").filter(Boolean);
  if (w.length < 2) return [];
  const [first, ...rest] = w;
  return [...(nickMap().get(first) || [])].map(alt => [alt, ...rest].join(" "));
}

/* ניקוי הבהרה בסוגריים מוויקיפדיה: "אבי כהן (הירושלמי)" */
export function stripParen(s) {
  return String(s || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/* האם ההבהרה בסוגריים מכילה שנה?
   "דוד אמסלם (כדורגלן)"  — הבהרה מול תחום אחר. הצורה החשופה בטוחה.
   "גיא מלמד (1979)"      — הבהרה מול כדורגלן אחר באותו שם. הצורה
                            החשופה **לא** בטוחה: היא שייכת לשניהם.
   בלי ההבחנה הזאת שנת הלידה של האחד נדבקת לשני. */
export const hasYearDisambig = s => {
  const m = String(s || "").match(/\(([^)]*)\)\s*$/);
  return !!m && /\d{4}/.test(m[1]);
};

/* ---------- עונות ותקופות ---------- */
/* רשימת שנות סיום עונה → רצפים. [2003,2004,2005,2008] → [[2003,2005],[2008,2008]] */
export function toSpells(years) {
  const ys = [...new Set(years.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
  const out = [];
  for (const y of ys) {
    const last = out[out.length - 1];
    if (last && y === last[1] + 1) last[1] = y;
    else out.push([y, y]);
  }
  return out;
}
export const seasonsIn = spells => spells.reduce((n, [a, b]) => n + (b - a + 1), 0);

/* תואר בשנה t נספר אם השחקן היה בסגל באותה עונה: a <= t <= b.
   (אומת מול מאגר הייצור של ביתרדל — 0 סטיות ב-410 שחקנים.) */
export function countTitles(spells, titleYears) {
  return titleYears.filter(y => spells.some(([a, b]) => y >= a && y <= b)).length;
}

/* תצוגת עונה: 2014 → "13/14" */
export const season = y => `${String(y - 1).slice(-2)}/${String(y).slice(-2)}`;

/* ---------- ארגומנטים ---------- */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (const a of argv) {
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      out[k] = v === undefined ? true : v;
    } else out._.push(a);
  }
  return out;
}

/* ---------- מועדונים ---------- */
export function loadClubs({ all = false } = {}) {
  const cfg = readJSON("config/clubs.json");
  return Object.entries(cfg)
    .filter(([k]) => !k.startsWith("_"))
    .map(([slug, c]) => ({ slug, ...c }))
    .filter(c => all || c.verified);
}
export function pickClubs(args) {
  const all = loadClubs({ all: true });
  if (args.club) {
    const want = String(args.club).split(",").map(s => s.trim());
    const got = all.filter(c => want.includes(c.slug));
    const missing = want.filter(w => !all.some(c => c.slug === w));
    if (missing.length) die(`מועדון לא מוכר: ${missing.join(", ")}`);
    return got;
  }
  const verified = all.filter(c => c.verified);
  if (!verified.length) die("אין מועדון מאומת ב-config/clubs.json");
  return verified;
}
