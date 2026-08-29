/* השוואת שם עברי לשם לטיני, כמסנן דחייה בלבד.

   לא מזהים כאן אף אחד — מזהים כבר זוהה לפי שנת לידה וחפיפת
   עונות. כאן רק פוסלים צמד ששום קריאה סבירה לא מחברת בין שני
   צדדיו, כמו "יקיר לוסקי" מול "Mesay Dego".

   ההשוואה היא על **ריבוי עיצורים**, בלי סדר: סדר המילים מתהפך
   ("יזרסקי רמיגיוס" מול "Remigiusz Jezierski"), אמות קריאה
   נופלות ונוספות, ו-j נכתבת גם ג' וגם י. מה שנשאר יציב הוא
   אילו עיצורים מופיעים וכמה פעמים. */
const LAT = new Map(Object.entries({
  b:"P", p:"P", f:"P", v:"V", w:"V", c:"K", k:"K", q:"K", g:"G", j:"G",
  d:"D", l:"L", m:"M", n:"N", r:"R", s:"S", z:"S", x:"S", t:"T", h:"", y:"",
  a:"", e:"", i:"", o:"", u:""
}));
const HEB = new Map(Object.entries({
  "ב":"P","פ":"P","ף":"P","ו":"V","כ":"K","ך":"K","ק":"K","ח":"K","ג":"G",
  "ד":"D","ל":"L","מ":"M","ם":"M","נ":"N","ן":"N","ר":"R","ס":"S","ש":"S",
  "ז":"S","צ":"S","ץ":"S","ת":"T","ט":"T","ה":"","א":"","ע":"","י":""
}));
const bag = (s, map) => {
  const m = new Map();
  for (const ch of s) {
    const c = map.get(ch);
    if (c) m.set(c, (m.get(c) || 0) + 1);
  }
  return m;
};
const size = m => [...m.values()].reduce((a, b) => a + b, 0);
/* איזה חלק מהצד הקטן נמצא גם בצד הגדול */
function containment(a, b) {
  const [s, l] = size(a) <= size(b) ? [a, b] : [b, a];
  if (!size(s)) return 0;
  let hit = 0;
  for (const [k, n] of s) hit += Math.min(n, l.get(k) || 0);
  return hit / size(s);
}
export function plausible(he, en) {
  const h = bag(String(he), HEB);
  const e = bag(String(en).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), LAT);
  const c = containment(h, e);
  /* ג' ו-צ' נכתבות עם גרש; הגרש עצמו לא נספר, וזה בסדר */
  return { ok: c >= 0.85 && size(h) >= 3 && size(e) >= 3, score: +c.toFixed(2) };
}
