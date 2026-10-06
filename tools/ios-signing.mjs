/* ============================================================
   ios-signing.mjs — תעודת הפצה ופרופיל App Store דרך ה-API של
   App Store Connect, לחתימה ב-CI.

   node tools/ios-signing.mjs create   → כותב ל-$RUNNER_TEMP:
        dist.cer, profile.mobileprovision, signing.json
   node tools/ios-signing.mjs patch    → חתימה ידנית למטרה App

   **למה לא החתימה האוטומטית של Xcode.** היא נכשלה ב-archive:
   "Your team has no devices from which to generate a provisioning
   profile". חתימה אוטומטית בונה קודם בפרופיל פיתוח, ופרופיל פיתוח
   דורש מכשיר רשום — ואין לנו אייפון רשום. פרופיל App Store לא דורש
   מכשירים, ולכן יוצרים אותו ישירות.

   **תעודה אחת קבועה — אסור לבטל אותה.** הגרסה הקודמת יצרה תעודה לכל
   ריצה וביטלה אותה בסוף. ההעלאה עברה, אבל ההגשה לבדיקה נדחתה
   אוטומטית: ITMS-90035 Invalid Signature. אפל בודקת את החתימה שוב
   בזמן ההגשה, והתעודה כבר הייתה מבוטלת. ביטול לא פוגע רק במה שכבר
   נמכר בחנות.
   לכן המפתח הפרטי נשמר בסוד DIST_KEY_BASE64, והתעודה נמצאת לפי
   המפתח הציבורי שלה: אם יש תעודת הפצה בתוקף שמתאימה למפתח — משתמשים
   בה; אם אין (ריצה ראשונה, או שפג תוקפה אחרי שנה) — יוצרים אחת מה-CSR
   של אותו מפתח. אף פעם לא מבטלים.
   גם הפרופיל קבוע: שם אחד, ונוצר מחדש רק כשאינו בתוקף או כשאינו
   כולל את התעודה.

   סביבה: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (ה-.p8), BUNDLE_ID,
   DIST_KEY_PATH (המפתח הפרטי של התעודה), CSR_PATH (CSR מאותו מפתח),
   RUNNER_TEMP.
   ============================================================ */
import { createSign, createPrivateKey, createPublicKey, X509Certificate } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, BUNDLE_ID, DIST_KEY_PATH, CSR_PATH, RUNNER_TEMP } = process.env;
const OUT = RUNNER_TEMP || ".";
const STATE = join(OUT, "signing.json");
const API = "https://api.appstoreconnect.apple.com/v1";
const PROFILE_NAME = "SportDle App Store";
/* תעודה שפגה בעוד פחות מזה — מחליפים כבר עכשיו, לא באמצע בדיקה */
const MIN_DAYS_LEFT = 30;

/* JWT של ES256 — Node חותם ב-DER, ואפל מצפה ל-r||s (ieee-p1363) */
function jwt() {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" })}.${b64({
    iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" })}`;
  const key = createPrivateKey(readFileSync(ASC_KEY_PATH));
  const sig = createSign("SHA256").update(data).sign({ key, dsaEncoding: "ieee-p1363" });
  return `${data}.${sig.toString("base64url")}`;
}

async function api(method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${jwt()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

const spki = k => k.export({ type: "spki", format: "der" });

/* תעודת ההפצה של המפתח שלנו: קיימת ובתוקף, או חדשה */
async function certificate() {
  const mine = spki(createPublicKey(createPrivateKey(readFileSync(DIST_KEY_PATH))));
  const list = await api("GET", "/certificates?filter[certificateType]=DISTRIBUTION&limit=200");
  const soon = Date.now() + MIN_DAYS_LEFT * 864e5;
  for (const c of list.data || []) {
    const der = Buffer.from(c.attributes.certificateContent, "base64");
    const x = new X509Certificate(der);
    if (spki(x.publicKey).equals(mine) && new Date(x.validTo).getTime() > soon) {
      console.log(`תעודה קיימת ${c.id} · בתוקף עד ${x.validTo}`);
      return { id: c.id, der };
    }
  }
  const cert = await api("POST", "/certificates", { data: { type: "certificates",
    attributes: { certificateType: "DISTRIBUTION", csrContent: readFileSync(CSR_PATH, "utf8") } } });
  console.log(`::notice::נוצרה תעודת הפצה חדשה ${cert.data.id} — היא תשמש את כל הריצות הבאות. לא לבטל אותה.`);
  return { id: cert.data.id, der: Buffer.from(cert.data.attributes.certificateContent, "base64") };
}

/* הפרופיל הקבוע: בתוקף וכולל את התעודה, או נוצר מחדש */
async function profile(bundleId, certId) {
  const q = `/profiles?filter[name]=${encodeURIComponent(PROFILE_NAME)}&include=certificates&limit=20`;
  const found = (await api("GET", q)).data || [];
  const good = found.find(p => p.attributes.profileState === "ACTIVE" &&
    (p.relationships?.certificates?.data || []).some(c => c.id === certId) &&
    new Date(p.attributes.expirationDate).getTime() > Date.now() + MIN_DAYS_LEFT * 864e5);
  if (good) { console.log(`פרופיל קיים "${PROFILE_NAME}" (${good.attributes.uuid})`); return good; }
  /* פרופיל באותו שם שכבר לא מתאים — מוחקים כדי שהשם יישאר חד-משמעי */
  for (const p of found) await api("DELETE", `/profiles/${p.id}`);
  const prof = await api("POST", "/profiles", { data: { type: "profiles",
    attributes: { name: PROFILE_NAME, profileType: "IOS_APP_STORE" },
    relationships: {
      bundleId: { data: { type: "bundleIds", id: bundleId } },
      certificates: { data: [{ type: "certificates", id: certId }] }
    } } });
  console.log(`נוצר פרופיל "${PROFILE_NAME}" (${prof.data.attributes.uuid})`);
  return prof.data;
}

async function create() {
  /* ה-App ID רשום מראש (Identifiers). כאן רק מוצאים את המזהה הפנימי. */
  const b = await api("GET", `/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}&limit=5`);
  const bundle = (b.data || []).find(x => x.attributes.identifier === BUNDLE_ID);
  if (!bundle) throw new Error(`App ID ${BUNDLE_ID} לא רשום — Certificates, Identifiers & Profiles → Identifiers`);

  const cert = await certificate();
  writeFileSync(join(OUT, "dist.cer"), cert.der);
  const prof = await profile(bundle.id, cert.id);
  writeFileSync(join(OUT, "profile.mobileprovision"), Buffer.from(prof.attributes.profileContent, "base64"));
  writeFileSync(STATE, JSON.stringify({ certId: cert.id, profileName: PROFILE_NAME,
    profileUuid: prof.attributes.uuid }));
}

/* חתימה ידנית **רק למטרה App**, בקובץ הפרויקט. בשורת הפקודה של
   xcodebuild ההגדרות היו חלות גם על חבילות ה-SPM של Capacitor, ושם
   פרופיל הוא שגיאה ("does not support provisioning profiles").
   CODE_SIGN_STYLE = Automatic מופיע רק בתצורות של המטרה App. */
function patch() {
  const p = "ios/App/App.xcodeproj/project.pbxproj";
  const { profileName } = JSON.parse(readFileSync(STATE, "utf8"));
  let s = readFileSync(p, "utf8");
  const n = (s.match(/CODE_SIGN_STYLE = Automatic;/g) || []).length;
  if (!n) throw new Error("לא נמצא CODE_SIGN_STYLE = Automatic בפרויקט");
  const t = "\t\t\t\t";
  s = s.replace(/CODE_SIGN_STYLE = Automatic;/g, [
    "CODE_SIGN_STYLE = Manual;",
    `${t}CODE_SIGN_IDENTITY = "Apple Distribution";`,
    `${t}"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Distribution";`,
    `${t}DEVELOPMENT_TEAM = ${process.env.TEAM};`,
    `${t}PROVISIONING_PROFILE_SPECIFIER = "${profileName}";`
  ].join("\n"));
  writeFileSync(p, s);
  console.log(`חתימה ידנית ב-${n} תצורות של App · פרופיל "${profileName}"`);
}

const cmd = process.argv[2];
try { await (cmd === "patch" ? patch() : create()); }
catch (e) { console.log(`::error::${e.message}`); process.exit(1); }
