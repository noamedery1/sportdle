/* ============================================================
   screenshots.mjs — צילומי מסך וגרפיקה לדפי החנויות.

   npm run serve            # בחלון אחר
   node tools/screenshots.mjs

   הפלט: store/play/*.png (1080×1920), store/ios/*.png
   (1290×2796), store/tablet7/*.png (1152×2048),
   store/tablet10/*.png (1440×2560), ו-store/feature-1024x500.png.

   --base=https://sportdle.techbynoam.com עובד גם בלי שרת מקומי.

   **הצילומים הם מהמשחק האמיתי, מחידת ארכיון.** לא מוקאפים ולא
   הרכבות: מה שנראה בתמונה הוא מה שהשחקן יקבל. חנויות דוחות
   צילומים שאינם מייצגים את האפליקציה, ומשתמשים מרגישים את זה
   מיד גם כשהחנות לא.

   **לא מציג את החידה של היום** — חידת ארכיון, כמו בקליפים.

   המידות: 1080×1920 הוא מה שגוגל פליי מבקשת לטלפון, ו-1290×2796
   הוא מסך 6.7 אינץ' של אפל — הגודל שממנו אפל גוזרת את השאר.
   ============================================================ */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { readJSON, loadClubs, parseArgs, log, die } from "../scripts/lib/util.mjs";

const args = parseArgs();
const BASE = (args.base || "http://localhost:4173").replace(/\/$/, "");
const site = readJSON("config/site.json");

/* גוגל דורשת יחס 16:9 או 9:16 **גם לטאבלטים**, ולא את היחס
   האמיתי של טאבלט (4:3). לכן כל המידות כאן הן כפולות מדויקות של
   (9,16) — יחס לא מדויק נדחה בהעלאה. הטווחים: 7 אינץ' 320–3840
   בכל צד, 10 אינץ' 1080–7680 בכל צד.

   ה-viewport (w/scale) הוא מה שקובע איזה פריסה תיראה בצילום,
   ולכן לטאבלטים הוא רחב יותר — 576 ו-720 CSS פיקסלים מול 360
   בטלפון. אותה פריסה, שטח נשימה אחר. */
const SIZES = [
  { dir: "store/play",    w: 1080, h: 1920, scale: 3, guesses: 3 },  // פליי, טלפון
  { dir: "store/ios",     w: 1290, h: 2796, scale: 3, guesses: 3 },  // אפל, 6.7"
  { dir: "store/tablet7", w: 1152, h: 2048, scale: 2, guesses: 5 },  // 7" · 9:16
  { dir: "store/tablet10",w: 1440, h: 2560, scale: 2, guesses: 5 }   // 10" · 9:16
];

/* guesses: כמה ניחושים שגויים לפני הצילום של הלוח.

   ברוחב טאבלט התוכן מילא כ-55% מפריים 9:16, והשליש התחתון יצא
   שחור וריק — בחנות זה נראה כמו אפליקציה לא גמורה. שלוש שורות
   ניחוש נוספות ממלאות אותו בתוכן אמיתי, ולא בריווח מלאכותי.
   שמונה ניסיונות מותרים, כך שחמישה שגויים ועוד התשובה חוקיים. */

function dayIndex() {
  const [y, m, d] = site.start;
  const n = new Date();
  return Math.max(0, Math.floor(
    (Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - Date.UTC(y, m - 1, d)) / 86400000));
}
const puzzleNo = Math.max(1, dayIndex() + 1 - 7);

const clubs = loadClubs();
const club = clubs.find(c => c.slug === "beitar") || clubs[0];
const db = readJSON(`data/clubs/${club.slug}.json`, null) || die("אין מאגר");
const answer = db.schedule[puzzleNo - 1] || die(`אין חידה #${puzzleNo}`);

/* אותם ניחושים בכל הרצה — צילומים יציבים בין גרסאות */
const wrong = db.players
  .filter(p => p.target && p.he !== answer && p.seasons >= 8)
  .sort((a, b) => b.seasons - a.seasons || a.he.localeCompare(b.he, "he"))
  .slice(0, 5).map(p => p.he);
if (wrong.length < 5) die("אין מספיק שחקנים לניחושים");

log(`  ${club.game} · חידה #${puzzleNo} · ${wrong.join(" → ")} → ${answer}`);

const browser = await chromium.launch({ headless: true });

/* מסתירים את פוטר הניווט בצילומים של המשחק: הוא נכון לאתר, אבל
   בחנות הוא רק גוזל שליש מהפריים בקישורי טקסט קטנים. */
const HIDE_NAV = ".sitenav{display:none!important}";

async function shot(page, dir, name) {
  const path = `${dir}/${name}.png`;
  await page.screenshot({ path });
  log(`  ${path}`);
}

async function typeGuess(page, name) {
  await page.evaluate(() => document.querySelector("#guess").focus({ preventScroll: true }));
  await page.keyboard.type(name, { delay: 8 });
  await page.waitForTimeout(120);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(420);
}

for (const S of SIZES) {
  mkdirSync(S.dir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: Math.round(S.w / S.scale), height: Math.round(S.h / S.scale) },
    deviceScaleFactor: S.scale,
    locale: "he-IL",
    ignoreHTTPSErrors: true
  });
  await ctx.addInitScript(([slug]) => {
    try {
      localStorage.setItem("sportdel:club", slug);
      localStorage.setItem("sportdel:seen", "1");
    } catch (e) {}
  }, [club.slug]);

  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: HIDE_NAV });
  await page.evaluate((n) => loadPuzzle(n), puzzleNo);
  await page.waitForTimeout(400);

  /* 1. הלוח באמצע משחק — התמונה שמסבירה את המשחק בשנייה */
  for (const w of wrong.slice(0, S.guesses)) await typeGuess(page, w);
  await page.waitForTimeout(300);
  await shot(page, S.dir, "1-board");

  /* 2. ניצחון */
  await typeGuess(page, answer);
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const r = document.querySelector("#result");
    if (r) r.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(400);
  await shot(page, S.dir, "2-win");

  /* 3. בורר המועדונים — חמישה צבעים, ההוכחה שיש חמישה משחקים */
  await page.evaluate(() => { window.scrollTo(0, 0); openPicker(); });
  await page.waitForTimeout(500);
  await shot(page, S.dir, "3-clubs");

  /* 4. איך משחקים — טבלת הרמזים */
  await page.evaluate(() => closePicker());
  await page.goto(`${BASE}/how-to-play/`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: HIDE_NAV });
  await page.evaluate(() => {
    const t = [...document.querySelectorAll("h2")].find(h => h.textContent.includes("חמשת הרמזים"));
    if (t) t.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(350);
  await shot(page, S.dir, "4-rules");

  /* 5. דף שחקן — מה שהופך את זה למאגר ולא רק למשחק */
  const slug = answer.replace(/['"׳״]/g, "").replace(/[()]/g, " ").trim().replace(/\s+/g, "-");
  await page.goto(`${BASE}/players/${club.slug}/${encodeURIComponent(slug)}/`,
    { waitUntil: "networkidle" });
  await page.addStyleTag({ content: HIDE_NAV });
  await page.waitForTimeout(300);
  await shot(page, S.dir, "5-player");

  await ctx.close();
}

/* ---------- גרפיקת הכותרת של גוגל פליי ----------
   1024×500, מידה נוקשה. היא מוצגת חתוכה במקומות שונים בחנות,
   ולכן כל מה שחייב להיראות יושב במרכז ורחוק מהקצוות. */
{
  mkdirSync("store", { recursive: true });
  const cols = clubs.map(c => c.colors.brand);
  const band = 6, gap = 7;
  const span = cols.length * band + (cols.length - 1) * gap;
  const start = (100 - span) / 2;
  const stops = [`#0C0C0E 0 ${start}%`];
  cols.forEach((c, i) => {
    const a = start + i * (band + gap);
    stops.push(`${c} ${a}% ${a + band}%`, `#0C0C0E ${a + band}% ${a + band + gap}%`);
  });
  stops.push(`#0C0C0E ${start + span}% 100%`);

  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<link rel="stylesheet" href="${BASE}/fonts.css"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:1024px;height:500px;overflow:hidden;position:relative;
       background:linear-gradient(115deg,${stops.join(",")});
       font-family:'Heebo',Arial,sans-serif;color:#F2F2F0}
  .in{position:absolute;inset:0;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:16px;
      background:radial-gradient(70% 120% at 50% 50%, rgba(12,12,14,.82) 0%, rgba(12,12,14,.55) 100%)}
  h1{font-family:'Suez One',Georgia,serif;font-size:96px;line-height:1;letter-spacing:-3px}
  h1 span{color:${cols[0]}}
  p{font-size:30px;font-weight:700;color:#DCDCD8}
  .s{font-size:21px;font-weight:500;color:#9A9AA2}
</style></head><body><div class="in">
  <h1>Sport<span>Dle</span></h1>
  <p>חידת השחקן היומית</p>
  <div class="s">חמישה מועדונים · שמונה ניסיונות · כל בוקר</div>
</div></body></html>`;

  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);                     // הגופנים
  await page.screenshot({ path: "store/feature-1024x500.png" });
  log("  store/feature-1024x500.png  1024×500");
  await page.close();
}

await browser.close();
log("סיום. הצילומים ב-store/.");
