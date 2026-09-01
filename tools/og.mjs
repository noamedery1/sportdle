/* ============================================================
   og.mjs — תמונת תצוגה מקדימה לכל מועדון.

   כשמדביקים קישור בוואטסאפ, מה שנפתח הוא הכרטיס: תמונה, כותרת,
   שורת תיאור. עד היום כל חמשת המועדונים חלקו את אותה תמונה
   גנרית, וקישור ל"מכביdle" נראה בדיוק כמו כל קישור אחר.

   node tools/og.mjs        מייצר src/static/og-<slug>.png

   1200x630 — המידה שוואטסאפ, טלגרם, פייסבוק וטוויטר קוראים.
   נכתב ל-src/static כדי שהבנייה תעתיק אותו ל-dist כמו כל נכס.
   ============================================================ */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { loadClubs, readJSON, log } from "../scripts/lib/util.mjs";

const OUT = "src/static";
mkdirSync(OUT, { recursive: true });

/* הכתובת שמודפסת על הכרטיס מגיעה מ-config/site.json ולא מקודדת
   כאן. אחרת החלפת דומיין משאירה חמש תמונות עם הכתובת הישנה. */
const SITE = String(readJSON("config/site.json").siteUrl)
  .replace(/^https?:\/\//, "").replace(/\/$/, "");

const card = (c, db) => `<!doctype html><html lang="he" dir="rtl"><head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Suez+One&family=Heebo:wght@400;700;900&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1200px;height:630px;background:${c.colors.ink};color:#F2F2F0;
       font-family:Heebo,Arial,sans-serif;overflow:hidden;position:relative}
  /* אותה רצועה אלכסונית שיש במשחק עצמו — הכרטיס והמוצר נראים אותו דבר */
  .bar{position:absolute;left:0;right:0;height:26px;
       background:repeating-linear-gradient(115deg,${c.colors.brand} 0 26px,
                  ${c.colors.second || c.colors.ink} 26px 52px)}
  .bar.t{top:0} .bar.b{bottom:0}
  .wrap{position:absolute;inset:26px 0;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:26px;text-align:center}
  h1{font-family:'Suez One',Georgia,serif;font-size:132px;line-height:1;
     color:${c.colors.brand};letter-spacing:-2px}
  h1 span{color:#F2F2F0}
  p.sub{font-size:40px;font-weight:700;color:#F2F2F0}
  p.meta{font-size:27px;color:#9A9AA2;font-weight:400}
  .pills{display:flex;gap:12px;margin-top:6px}
  .pill{background:#1C1C22;border:1px solid #2E2E36;border-radius:999px;
        padding:9px 20px;font-size:23px;font-weight:700;color:#C9C9D1}
  .url{position:absolute;bottom:52px;left:0;right:0;text-align:center;
       font-size:25px;font-weight:700;color:${c.colors.brand};letter-spacing:.4px}
</style></head><body>
  <div class="bar t"></div><div class="bar b"></div>
  <div class="wrap">
    <h1>${c.game.replace(/dle$/, "")}<span>dle</span></h1>
    <p class="sub">שחקן אחד. שמונה ניסיונות.</p>
    <p class="meta">${c.he} · ${db.counts.players} שחקנים · חידה חדשה כל יום</p>
    <div class="pills">
      <div class="pill">עמדה</div><div class="pill">לאום</div>
      <div class="pill">עונה</div><div class="pill">תארים</div>
      <div class="pill">שנת לידה</div>
    </div>
  </div>
  <div class="url">${SITE}</div>
</body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

for (const club of loadClubs()) {
  const db = readJSON(`data/clubs/${club.slug}.json`, null);
  if (!db) continue;
  await page.setContent(card({ ...club, ...db }, db), { waitUntil: "networkidle" });
  await page.waitForTimeout(350);                 // הגופנים
  const path = `${OUT}/og-${club.slug}.png`;
  await page.screenshot({ path });
  log(`  ${path}`);
}
await browser.close();
log("סיום.");
