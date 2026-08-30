/* השוואת שם עברי לשם לטיני, כמסנן דחייה בלבד.

   לא מזהים כאן אף אחד — הזיהוי כבר נעשה לפי שנת לידה וחפיפת
   עונות. כאן רק פוסלים צמד ששום קריאה סבירה לא מחברת בין שני
   צדדיו, כמו "יקיר לוסקי" מול "Mesay Dego".

   ההשוואה היא על **ריבוי עיצורים**, בלי סדר: סדר המילים מתהפך
   ("יזרסקי רמיגיוס" מול "Remigiusz Jezierski"), אמות קריאה
   נופלות ונוספות, ו-j נכתבת גם ג' וגם י. מה שנשאר יציב הוא
   אילו עיצורים מופיעים וכמה פעמים. */
const LAT_BASE = {
  b:"P", p:"P", f:"P", v:"V", w:"V", k:"K", q:"K", g:"G", j:"G",
  d:"D", l:"L", m:"M", n:"N", r:"R", s:"S", z:"S", x:"S", t:"T", h:"", y:"",
  a:"", e:"", i:"", o:"", u:""
};
/* c נקראת גם K וגם S — "Costrov" מול "Cesarec", "Dirceu" מול
   "דירסאו". בונים את שתי הקריאות ולוקחים את הטובה. */
const LAT_K = new Map(Object.entries({ ...LAT_BASE, c:"K" }));
const LAT_S = new Map(Object.entries({ ...LAT_BASE, c:"S" }));
const HEB = new Map(Object.entries({
  "ב":"P","פ":"P","ף":"P","ו":"V","כ":"K","ך":"K","ק":"K","ח":"K","ג":"G",
  "ד":"D","ל":"L","מ":"M","ם":"M","נ":"N","ן":"N","ר":"R","ס":"S","ש":"S",
  "ז":"S","צ":"S","ץ":"S","ת":"T","ט":"T","ה":"","א":"","ע":"","י":""
}));

const clean = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const bag = (s, map) => {
  const m = new Map();
  for (const ch of s) {
    const c = map.get(ch);
    if (c) m.set(c, (m.get(c) || 0) + 1);
  }
  return m;
};
const size = m => [...m.values()].reduce((a, b) => a + b, 0);
const overlap = (a, b) => {
  let hit = 0;
  for (const [k, n] of a) hit += Math.min(n, b.get(k) || 0);
  return hit;
};
/* איזה חלק מהצד הקטן נמצא גם בצד הגדול */
const containment = (a, b) => {
  const [s, l] = size(a) <= size(b) ? [a, b] : [b, a];
  return size(s) ? overlap(s, l) / size(s) : 0;
};
/* סימטרי: כמה משני הצדדים חופפים. "דוד דגו" מול "David Dego"
   ומול "David Houja" מקבלים שניהם 1.0 בחד־כיווני, כי שני השמות
   הלטיניים קצרים ומוכלים; הכיוון השני מפריד — 0.92 מול 0.83. */
const symmetric = (a, b) => {
  if (!size(a) || !size(b)) return 0;
  const hit = overlap(a, b);
  return (hit / size(a) + hit / size(b)) / 2;
};

const words = s => String(s).trim().split(/\s+/).filter(Boolean);

/* שם לטיני בן מילה אחת הוא כינוי ברזילאי — Dirceu, Wescley,
   Ricardinho — והעברית שומרת גם שם פרטי שאינו קיים בו. השוואת
   השם המלא מענישה אותו על מילה שממילא לא אמורה להימצא, ולכן
   מותר לו להתחרות גם מול כל מילה עברית בנפרד. */
function bestPair(he, en, fn) {
  const heFull = bag(he, HEB);
  let best = 0;
  for (const lat of [LAT_K, LAT_S]) {
    best = Math.max(best, fn(heFull, bag(clean(en), lat)));
    if (words(en).length === 1)
      for (const w of words(he))
        best = Math.max(best, fn(bag(w, HEB), bag(clean(en), lat)));
  }
  return best;
}

export const score = (he, en) => bestPair(he, en, symmetric);

export function plausible(he, en) {
  const c = bestPair(he, en, containment);
  const h = bag(String(he), HEB), e = bag(clean(en), LAT_K);
  return { ok: c >= 0.85 && size(h) >= 3 && size(e) >= 3, score: +c.toFixed(2) };
}
