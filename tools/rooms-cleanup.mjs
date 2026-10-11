/* ============================================================
   rooms-cleanup.mjs — מחיקת חדרי קרב שננטשו

   FIREBASE_SA='<json של חשבון השירות>' node tools/rooms-cleanup.mjs [--dry]

   נקרא מ-.github/workflows/rooms-cleanup.yml, פעם ברבעון.

   למה זה קיים: חדר נמחק רק כשאחרון המשתתפים לוחץ "יציאה"
   (dropRoomIfEmpty ב-versus.js). מי שפשוט סוגר את האפליקציה משאיר
   את החדר במסד לנצח — עם כינויים ומזהים. מדיניות הפרטיות מתחייבת
   לניקוי לפחות פעם בשלושה חודשים, וזה הניקוי.

   **חדר "נטוש" = נוצר לפני יותר מ-48 שעות.** משחק נמשך דקות; חדר
   באמצע משחק אחרי יומיים לא קיים בפועל. חדר בלי createdAt (גרסה
   ישנה או כתיבה שבורה) נמחק גם הוא.

   **למה חשבון שירות ולא חוקי הפיירבייס:** הרשימה rooms/v2 אינה
   קריאה לאף לקוח בכוונה — אחרת כל אחד היה רואה את כל קודי החדרים.
   טוקן OAuth של חשבון שירות עוקף את החוקים, כמו הקונסולה.

   בלי תלויות: JWT חתום ב-RS256 עם node:crypto, והחלפה בטוקן ב-oauth2.
   ============================================================ */
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const DRY = process.argv.includes("--dry");
const MAX_AGE_MS = 48 * 3600 * 1000;
const DB = JSON.parse(readFileSync("config/site.json", "utf8")).firebase.databaseURL.replace(/\/$/, "");
const ROOMS = "rooms/v2";

const fail = m => { console.log(`::error::${m}`); process.exit(1); };

let sa;
try { sa = JSON.parse(process.env.FIREBASE_SA || ""); }
catch { fail("FIREBASE_SA חסר או אינו JSON — ראה את ההוראות בראש rooms-cleanup.yml"); }
if (!sa.client_email || !sa.private_key) fail("FIREBASE_SA אינו קובץ מפתח של חשבון שירות (חסר client_email או private_key)");

const b64u = x => Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url");

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const aud = sa.token_uri || "https://oauth2.googleapis.com/token";
  const unsigned = b64u({ alg: "RS256", typ: "JWT" }) + "." + b64u({
    iss: sa.client_email, aud, iat: now, exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email"
  });
  const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const r = await fetch(aud, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + sig })
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) fail(`החלפת הטוקן נכשלה (${r.status}): ${j.error_description || j.error || "?"}`);
  return j.access_token;
}

const auth = { authorization: `Bearer ${await token()}` };
const get = async path => {
  const r = await fetch(`${DB}/${path}.json${path === ROOMS ? "?shallow=true" : ""}`, { headers: auth });
  if (!r.ok) fail(`קריאה מ-${path} נכשלה (${r.status}) — לחשבון השירות אין גישה למסד?`);
  return r.json();
};

const codes = Object.keys((await get(ROOMS)) || {});
const cutoff = Date.now() - MAX_AGE_MS;
const stale = [];
for (const code of codes) {
  const created = await get(`${ROOMS}/${code}/createdAt`);
  if (typeof created !== "number" || created < cutoff) stale.push(code);
}
console.log(`${codes.length} חדרים · ${stale.length} נטושים (מעל 48 שעות)${DRY ? " · הרצה יבשה, לא נמחק דבר" : ""}`);

if (stale.length && !DRY) {
  /* עדכון מרובה נתיבים: null מוחק. אצוות של 500 כדי לא לשלוח גוף ענק. */
  for (let i = 0; i < stale.length; i += 500) {
    const body = Object.fromEntries(stale.slice(i, i + 500).map(c => [c, null]));
    const r = await fetch(`${DB}/${ROOMS}.json`, { method: "PATCH", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) fail(`המחיקה נכשלה (${r.status}) אחרי ${i} חדרים`);
  }
  console.log(`נמחקו ${stale.length} חדרים.`);
}
