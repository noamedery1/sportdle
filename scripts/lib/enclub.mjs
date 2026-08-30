/* נרמול שם מועדון אנגלי, להשוואה מול config/clubs.json → wikiEn.

   ויקיפדיה האנגלית כותבת את אותו מועדון בכמה צורות:
     [[Maccabi Haifa F.C.|Maccabi Haifa]]
     → [[Hapoel Be'er Sheva F.C.|Hapoel Be'er Sheva]] (loan)
   הסיומת התאגידית, הגרש, וסימון ההשאלה כולם רעש. מה שנשאר הוא
   שם המועדון עצמו, באותיות קטנות, ורק אותו משווים.

   חץ ← לפני השם הוא השאלה, והוא נשמר במשמעות ולא בתו: השאלה
   **אל** המועדון שלנו היא עונה לכל דבר, ולכן הוא רק נמחק. */
const NOISE = /\b(?:f\.?c\.?|a\.?f\.?c\.?|s\.?c\.?|football club)\b/g;

export function enClubKey(s) {
  return String(s || "")
    .replace(/^\s*[←→]\s*/, "")            // חץ השאלה
    .replace(/\((?:on\s+)?loan[^)]*\)/gi, "")        // "(loan)" / "(on loan from X)"
    .toLowerCase()
    .replace(NOISE, " ")
    .replace(/[^a-z ]/g, " ")                        // גרשים, נקודות, ספרות
    .replace(/\s+/g, " ")
    .trim();
}

/* האם השורה מדברת על המועדון שלנו.
   השוואה מלאה, ולא הכלה: "hapoel haifa" מכיל "haifa" ו-"maccabi
   haifa" גם, ובלי הכלל הזה כל מועדון בעיר אחת היה בולע את חברו. */
export function isSameClub(rowClub, wantKey) {
  const k = enClubKey(rowClub);
  if (!k || !wantKey) return false;
  if (k === wantKey) return true;
  /* "maccabi tel aviv" מול "maccabi tel aviv youth" — קידומת מלאה
     על גבול מילה בלבד. */
  return k.startsWith(wantKey + " ") || wantKey.startsWith(k + " ");
}
