/* ============================================================
   ios-signing.mjs — תעודת הפצה ופרופיל App Store דרך ה-API של
   App Store Connect, לריצה אחת ב-CI.

   node tools/ios-signing.mjs create   → כותב ל-$RUNNER_TEMP:
        dist.cer, profile.mobileprovision, signing.json
   node tools/ios-signing.mjs cleanup  → מוחק את התעודה והפרופיל
                                         שנוצרו ב-create

   **למה לא החתימה האוטומטית של Xcode.** הניסיון הראשון נכשל ב-archive:
   "Your team has no devices from which to generate a provisioning
   profile". חתימה אוטומטית בונה קודם בפרופיל פיתוח, ופרופיל פיתוח
   דורש מכשיר רשום — ואין לנו אייפון רשום. פרופיל App Store לא דורש
   מכשירים, ולכן יוצרים אותו ישירות.

   **תעודה לכל ריצה, ונמחקת בסוף.** אפל מגבילה את מספר תעודות ההפצה
   לצוות. ביטול תעודה לא פוגע בבנייה שכבר הועלתה — אפל חותמת מחדש
   את מה שמופץ מהחנות. כך אין סוד נוסף לשמור (.p12) ואין תעודות
   שמצטברות.

   סביבה: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (ה-.p8), BUNDLE_ID,
   CSR_PATH (ל-create), RUNNER_TEMP.
   ============================================================ */
import { createSign, createPrivateKey } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, BUNDLE_ID, CSR_PATH, RUNNER_TEMP } = process.env;
const OUT = RUNNER_TEMP || ".";
const STATE = join(OUT, "signing.json");
const API = "https://api.appstoreconnect.apple.com/v1";

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

async function create() {
  /* ה-App ID רשום מראש (Identifiers). כאן רק מוצאים את המזהה הפנימי. */
  const b = await api("GET", `/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}&limit=5`);
  const bundle = (b.data || []).find(x => x.attributes.identifier === BUNDLE_ID);
  if (!bundle) throw new Error(`App ID ${BUNDLE_ID} לא רשום — Certificates, Identifiers & Profiles → Identifiers`);

  const csr = readFileSync(CSR_PATH, "utf8");
  const cert = await api("POST", "/certificates", { data: { type: "certificates",
    attributes: { certificateType: "DISTRIBUTION", csrContent: csr } } });
  const certId = cert.data.id;
  writeFileSync(join(OUT, "dist.cer"), Buffer.from(cert.data.attributes.certificateContent, "base64"));
  /* נשמר מיד — אם יצירת הפרופיל נכשלת, cleanup עדיין מוחק את התעודה */
  writeFileSync(STATE, JSON.stringify({ certId }));

  const name = `SportDle CI ${process.env.GITHUB_RUN_NUMBER || Date.now()}`;
  const prof = await api("POST", "/profiles", { data: { type: "profiles",
    attributes: { name, profileType: "IOS_APP_STORE" },
    relationships: {
      bundleId: { data: { type: "bundleIds", id: bundle.id } },
      certificates: { data: [{ type: "certificates", id: certId }] }
    } } });
  writeFileSync(join(OUT, "profile.mobileprovision"), Buffer.from(prof.data.attributes.profileContent, "base64"));
  writeFileSync(STATE, JSON.stringify({ certId, profileId: prof.data.id, profileName: name,
    profileUuid: prof.data.attributes.uuid }));
  console.log(`תעודה ${certId} · פרופיל "${name}" (${prof.data.attributes.uuid})`);
}

async function cleanup() {
  if (!existsSync(STATE)) return console.log("אין מה לנקות");
  const s = JSON.parse(readFileSync(STATE, "utf8"));
  for (const [kind, id] of [["profiles", s.profileId], ["certificates", s.certId]]) {
    if (!id) continue;
    try { await api("DELETE", `/${kind}/${id}`); console.log(`נמחק ${kind}/${id}`); }
    catch (e) { console.log(`::warning::מחיקת ${kind}/${id} נכשלה — ${e.message}`); }
  }
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
try { await (cmd === "cleanup" ? cleanup() : cmd === "patch" ? patch() : create()); }
catch (e) { console.log(`::error::${e.message}`); process.exit(1); }
