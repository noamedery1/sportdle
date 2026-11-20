/* ============================================================
   עונות השאלה — מה מורידים מהתקופה במועדון.

   הבעיה (נועם 20/11, איתן טיבי): בטבלת הקריירה בוויקיפדיה כתוב
   "2006–2010 בית"ר" ומתחתיו "2007–2008 ← הפועל רעננה", "2008–2009
   ← הכח רמת גן". האיחוד ב-enrich.mjs לקח את 2006–2010 במלואה, ושתי
   עונות ההשאלה היו בדיוק עונות התארים — 4 תארים במקום 1.

   scrape.mjs שומר עכשיו לכל ערך `away` (עונות שבהן שורה של מועדון
   אחר יושבת בתוך התקופה שלנו). כאן מחליטים לכל עונה כזאת:
     remove   — אף מקור עונתי (ההתאחדות, טרנספרמרקט) לא רושם אותו
                אצלנו באותה עונה. מורידים.
     conflict — מקור עונתי כן רושם אותו. לא נוגעים; לבדיקה ידנית
                (השאלה באמצע עונה, או ויקיפדיה טועה).
   ההתאחדות רושמת רק מ-02/03, טרנספרמרקט חלקי בשנות ה-70–90 — ולכן
   "אין רישום" לפני כן הוא היעדר ראיה, אבל ויקיפדיה עם שורת השאלה
   מפורשת היא עדיין הראיה הטובה ביותר שיש.
   ============================================================ */
import { readJSON, normName, stripParen } from "./util.mjs";

/* כל המקורות העונתיים של מועדון: שם מנורמל → Set של עונות */
export function seasonIndex(slug) {
  const idx = new Map();
  const add = (name, y) => {
    if (!name) return;
    const k = normName(stripParen(name));
    if (!idx.has(k)) idx.set(k, new Map());
    const m = idx.get(k);
    if (!m.has(+y)) m.set(+y, new Set());
    return m.get(+y);
  };
  const ifa = readJSON(`data/raw/${slug}-ifa.json`, null);
  for (const [y, list] of Object.entries(ifa?.seasons || {}))
    for (const p of list) { add(p.full, y)?.add("ifa"); add(p.short, y)?.add("ifa"); }
  const tm = readJSON(`data/raw/${slug}-transfermarkt.json`, null);
  const prof = readJSON("data/raw/tm-profiles.json", null)?.profiles || {};
  for (const [y, list] of Object.entries(tm?.seasons || {}))
    for (const p of list) { const he = prof[p.id]?.he; if (he) add(he.replace(/‎/g, ""), y)?.add("tm"); }
  return {
    /* באילו מקורות הוא רשום באותה עונה */
    at: (he, y) => [...(idx.get(normName(stripParen(he)))?.get(+y) || [])],
    covers: { ifa: Object.keys(ifa?.seasons || {}).map(Number), tm: Object.keys(tm?.seasons || {}).map(Number) }
  };
}

/** החלטה לכל עונת השאלה של שחקן: [{ y, verdict, seen }] */
/* מ-02/03 ההתאחדות מכריעה: טרנספרמרקט רושם לפעמים בסגל של עונה גם מי
   שהושאל ממנו החוצה (טיבי לא, אבל ריף פרץ 13/14 כן). לפני כן אין
   התאחדות, וטרנספרמרקט לבדו מספיק כדי לא לגעת. */
export function loanVerdicts(he, away, spellsYears, idx) {
  const ifaFrom = Math.min(...idx.covers.ifa, Infinity);
  return (away || []).filter(y => spellsYears.has(y)).map(y => {
    const seen = idx.at(he, y);
    const keep = seen.includes("ifa") || (y < ifaFrom && seen.length > 0);
    return { y, verdict: keep ? "conflict" : "remove", seen };
  });
}
