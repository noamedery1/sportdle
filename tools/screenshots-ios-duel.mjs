/* ============================================================
   screenshots-ios-duel.mjs — צילום "קרב חברים" לדף ה-App Store.

   node tools/screenshots-ios-duel.mjs [--base=https://sportdle.techbynoam.com]

   הפלט: store/ios/5-duel.png (1290×2796).

   **למה צילום נפרד ולמה לא דף השחקן.** screenshots.mjs מצלם כצילום
   חמישי את דף השחקן, אבל tools/app-prepare.mjs מוציא את דפי השחקן
   מהאפליקציה. בגוגל זה עבר; באפל צילום שמראה מסך שאין באפליקציה
   הוא דחייה לפי כלל 2.3.3. במקומו — הקרב, שקיים באפליקציה.

   **קרב אמיתי, לא מוקאפ:** שני דפדפנים באותו חדר דרך Firebase של
   האתר. המארח פותח חדר עם כל חמשת המועדונים, האורח מצטרף עם הקוד,
   ומצלמים את המארח באמצע סיבוב, כשכבר נחשפו כמה רמזים. בסוף שני
   הצדדים יוצאים מהחדר.

   לא מהאמולטור: הצילומים שם כוללים את שורת הסטטוס והניווט של
   אנדרואיד, ואפל דוחה צילומים שמראים פלטפורמה אחרת.
   ============================================================ */
import { chromium } from "playwright";
import { parseArgs, log, die } from "../scripts/lib/util.mjs";

const args = parseArgs();
const BASE = (args.base || "https://sportdle.techbynoam.com").replace(/\/$/, "");
const OUT = "store/ios/5-duel.png";
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 430×932 ב-3x = 1290×2796, המסך של אייפון 6.7" — אותו גודל כמו
   שאר צילומי store/ios. */
const PHONE = { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, locale: "he-IL", isMobile: true, hasTouch: true };

const browser = await chromium.launch();
const mk = async (club) => {
  const ctx = await browser.newContext(PHONE);
  await ctx.addInitScript(c => { try { localStorage.setItem("sportdel:seen", "1"); localStorage.setItem("sportdel:club", c); } catch {} }, club);
  return ctx.newPage();
};
const host = await mk("hapoel-ta");
const guest = await mk("maccabi-ta");

try {
  await host.goto(`${BASE}/hapoel-ta/#versus`, { waitUntil: "networkidle" });
  await host.waitForSelector("#vName", { state: "visible" });
  await host.fill("#vName", "דניאל");
  await host.click('#modePick button[data-mode="players"]');
  for (const s of ["beitar", "hapoel-bs", "maccabi-ta", "maccabi-haifa"])
    await host.click(`#clubPick button[data-club="${s}"]`);
  await host.click("#btnCreate");
  await host.waitForFunction(() => /^[A-Z2-9]{4}$/.test(document.querySelector("#lobbyCode")?.textContent.trim() || ""));
  const code = (await host.textContent("#lobbyCode")).trim();
  log(`חדר ${code}`);
  await host.evaluate(() => { for (const [s, v] of [["#setReveal", "6"], ["#setRounds", "5"]]) {
    const e = document.querySelector(s); if (e) { e.value = v; e.dispatchEvent(new Event("change", { bubbles: true })); } } });

  await guest.goto(`${BASE}/maccabi-ta/?room=${code}`, { waitUntil: "networkidle" });
  await guest.waitForSelector("#vName", { state: "visible" });
  await guest.fill("#vName", "אלון");
  await guest.click("#btnJoin");
  await host.waitForFunction(() => document.querySelectorAll("#lobbyPlayers > *").length >= 2, null, { timeout: 20000 });
  await sleep(800);
  await host.click("#btnStart");

  /* ארבעה רמזים גלויים (בקצב 6 שניות): מספיק כדי להבין את המשחק,
     ועדיין לא מסגיר את השחקן */
  await host.waitForSelector("#scPlay:not(.hide)", { timeout: 20000 });
  await sleep(6000 * 3 + 1500);
  /* באנר "אפליקציית אנדרואיד / Google Play" קיים באתר ולא באפליקציה
     (app-prepare מוחק אותו). בצילום לאפל הוא דחייה בטוחה — כלל 2.3.10 */
  await host.addStyleTag({ content: "#appban{display:none!important}" });
  await host.evaluate(() => { document.querySelector("#scPlay").scrollIntoView({ block: "start" }); });
  await sleep(300);
  await host.screenshot({ path: OUT });
  log(`✓ ${OUT}`);
} catch (e) {
  die("הצילום נכשל: " + e.message);
} finally {
  for (const p of [host, guest]) await p.evaluate(() => {
    document.querySelector("#btnLeavePlay")?.click(); document.querySelector("#btnLeave")?.click(); }).catch(() => {});
  await sleep(800);
  await browser.close();
}
