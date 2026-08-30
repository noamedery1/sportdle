/* Transfermarkt — סגל לפי מועדון ולפי עונה.

   המקור החמישי, והוא היחיד מלבד ההתאחדות שעונה ישירות על השאלה
   "מי היה בסגל בעונה הזאת". worldfootball עונה עליה גם הוא, אבל
   הסגלים הישנים שלו חלקיים — ובדיוק שם נולדו הטעויות.

   דף "leistungsdaten" ולא "kader": שניהם מחזירים את אותם שחקנים,
   אבל רק הראשון נותן גם את השם בתוך התגית, בלי לפרסר טבלה.

   **מיפוי עונות:** ב-Transfermarkt `saison_id=2004` הוא עונת
   2004/05. אצלנו עונה נרשמת בשנת הסיום שלה, כלומר 2005. ההפרש
   הזה הוא מקור טעות שקטה של שנה שלמה, ולכן ההמרה יושבת כאן
   ובמקום אחד בלבד.

   אין כאן שום עקיפה של הגנות: הדף נטען בבקשה רגילה עם User-Agent
   של דפדפן, ואם יבוא יום והאתר יחסום — הכלי יעצור ויגיד. */
const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9"
};

export const tmSeasonId = endYear => endYear - 1;

const CHALLENGE = /just a moment|attention required|verify you are human|cf-browser-verification/i;

/* מחזיר { ok, players:[{id,name}] } או { ok:false, why } */
export async function fetchSquad(clubId, endYear) {
  const sid = tmSeasonId(endYear);
  const url = `https://www.transfermarkt.com/x/leistungsdaten/verein/${clubId}` +
              `/reldata/%26${sid}/plus/1`;
  let r;
  try { r = await fetch(url, { headers: UA }); }
  catch (e) { return { ok: false, why: e.message }; }
  if (!r.ok) return { ok: false, why: `HTTP ${r.status}` };
  const t = await r.text();
  if (CHALLENGE.test(t)) return { ok: false, why: "אתגר בוטים" };

  /* title="שם" ... href="/slug/profil/spieler/12345" — שם ומזהה
     באותה תגית. שם השחקן מופיע גם בשורות אחרות בדף, ולכן דורשים
     שהקישור יהיה דף השחקן עצמו. */
  const out = new Map();
  const re = /title="([^"]{2,60})"[^>]*href="\/[^"]*\/profil\/spieler\/(\d+)"/g;
  for (const m of t.matchAll(re)) {
    const name = m[1].replace(/\s+/g, " ").trim();
    if (!out.has(m[2])) out.set(m[2], name);
  }
  return { ok: true, players: [...out].map(([id, name]) => ({ id, name })) };
}
