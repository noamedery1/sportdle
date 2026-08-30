/* ============================================================
   clip.mjs — קליפ אנכי של משחק אמיתי, לטיקטוק ולרילס.

   node tools/clip.mjs                    קליפ להיום, ל-clip.mp4
   node tools/clip.mjs --club=beitar      מועדון מסוים
   node tools/clip.mjs --puzzle=12        חידה מסוימת
   node tools/clip.mjs --out=x.mp4

   **הקליפ לעולם לא מראה את החידה של היום.** הוא משחק חידת ארכיון
   מלפני שבוע — תשובה שכבר ידועה לכל מי ששיחק, וסקרנות למי שלא.
   קליפ שמקלקל את החידה הנוכחית עובד פעם אחת.

   המועדון מתחלף לפי מספר החידה, כך שחמישה ימים ברצף נותנים
   חמישה מועדונים בלי לחזור.

   מה שמצולם הוא הדפדפן עצמו: הקלדה תו־תו, רשימת ההצעות נפתחת,
   אריחים נכנסים באנימציה. שלושה דברים מונעים את קפיצת המסך
   שהופכת הקלטה כזאת לבלתי צפייה — focus בלי גלילה, הקלדת שם
   מלא במקום לחיצה על הצעה, ומאזין שמצמיד את הגלילה לראש.

   דורש ffmpeg ב-PATH.
   ============================================================ */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readJSON, loadClubs, parseArgs, log, warn, die } from "../scripts/lib/util.mjs";

const args = parseArgs();
const OUT = args.out || "clip.mp4";
const FRAME = "tools/assets/phone-frame.png";
if (!existsSync(FRAME)) die(`חסר ${FRAME}`);

const site = readJSON("config/site.json");
const base = String(site.siteUrl).replace(/\/$/, "");

function dayIndex() {
  const [y, m, d] = site.start;
  const n = new Date();
  return Math.max(0, Math.floor(
    (Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - Date.UTC(y, m - 1, d)) / 86400000));
}
const todayNo = dayIndex() + 1;

/* חידת ארכיון: שבוע אחורה, ולפחות #1 */
const puzzleNo = args.puzzle ? +args.puzzle : Math.max(1, todayNo - 7);

const clubs = loadClubs();
const club = args.club
  ? clubs.find(c => c.slug === args.club) || die(`מועדון לא מוכר: ${args.club}`)
  : clubs[todayNo % clubs.length];

const db = readJSON(`data/clubs/${club.slug}.json`, null) || die(`אין מאגר ל-${club.slug}`);
const answer = db.schedule[puzzleNo - 1];
if (!answer) die(`אין חידה #${puzzleNo} ב-${club.slug}`);

/* שלושה ניחושים מוטעים, קבועים לכל חידה: אותו קלט → אותו קליפ.
   נבחרים מבין הוותיקים בבריכה, כי שם השמות שאוהד מזהה. */
function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rnd = mulberry32(puzzleNo * 7919 + club.slug.length);
const pool = db.players
  .filter(p => p.target && p.he !== answer && p.seasons >= 5)
  .sort((a, b) => b.seasons - a.seasons)
  .slice(0, 40);
const wrong = [];
while (wrong.length < 3 && pool.length) wrong.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0].he);
if (wrong.length < 3) die("אין מספיק שחקנים לניחושים");

log(`  ${club.game} · חידה #${puzzleNo} · ${wrong.join(" → ")} → ${answer}`);

/* ---------- הקלטה ---------- */
const dir = mkdtempSync(join(tmpdir(), "sportdle-clip-"));
const CSS = `
html{zoom:2}
html,body{overflow:hidden!important}
#tkcap{position:fixed;left:0;right:0;bottom:58px;z-index:99999;display:flex;
  justify-content:center;pointer-events:none;padding:0 14px}
#tkcap span{background:rgba(0,0,0,.88);color:#fff;font-weight:800;font-size:19px;
  line-height:1.3;padding:9px 14px;border-radius:11px;text-align:center;
  font-family:'Segoe UI',Arial,sans-serif;box-shadow:0 5px 22px rgba(0,0,0,.6)}
#tkcap span b{color:${club.colors.brand}}
`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 900, height: 1640 },
  deviceScaleFactor: 1,
  locale: "he-IL",
  recordVideo: { dir, size: { width: 900, height: 1640 } }
});
await ctx.addInitScript(([slug]) => {
  try {
    localStorage.setItem("sportdel:club", slug);
    localStorage.setItem("sportdel:seen", "1");
  } catch (e) {}
}, [club.slug]);

const page = await ctx.newPage();
const cap = (t) => page.evaluate((txt) => {
  let el = document.getElementById("tkcap");
  if (!el) { el = document.createElement("div"); el.id = "tkcap"; document.body.appendChild(el); }
  el.innerHTML = txt ? `<span>${txt}</span>` : "";
}, t);

const guess = async (name, capText) => {
  if (capText !== undefined) await cap(capText);
  await page.evaluate(() => document.querySelector("#guess").focus({ preventScroll: true }));
  const seed = name.split(" ")[0];
  await page.keyboard.type(seed, { delay: 100 });
  await page.waitForTimeout(720);
  await page.keyboard.type(name.slice(seed.length), { delay: 80 });
  await page.waitForTimeout(420);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1400);
};

await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.addStyleTag({ content: CSS });
await page.waitForTimeout(400);
await page.evaluate((n) => loadPuzzle(n), puzzleNo);
await page.waitForTimeout(800);
await page.evaluate(() => {
  window.__pin = () => window.scrollTo(0, 0);
  addEventListener("scroll", window.__pin, { passive: true });
});

await cap("כל יום שחקן אחד. <b>8 ניסיונות.</b>");
await page.waitForTimeout(1400);
await guess(wrong[0], "מקלידים שם — ומקבלים חמישה רמזים");
await guess(wrong[1], "צבע = פגעת. חץ = לכיוון הזה.");
await guess(wrong[2], "עמדה · לאום · עונה · תארים · לידה");
await cap("");
await guess(answer);

await page.waitForTimeout(650);
await page.evaluate(() => {
  removeEventListener("scroll", window.__pin);
  document.documentElement.style.setProperty("overflow", "auto", "important");
  document.body.style.setProperty("overflow", "auto", "important");
  const r = document.querySelector("#result");
  if (r) r.scrollIntoView({ behavior: "smooth", block: "center" });
});
await cap("<b>פיצחת.</b> מחר שחקן חדש.");
await page.waitForTimeout(2000);
await cap(`<b>${base.replace(/^https?:\/\//, "")}</b>`);
await page.waitForTimeout(1800);

await page.close();
await ctx.close();
await browser.close();

/* ---------- הרכבה ---------- */
const raw = readdirSync(dir).find(f => f.endsWith(".webm"));
if (!raw) die("ההקלטה לא נוצרה");
const src = join(dir, raw);

const ff = spawnSync("ffmpeg", [
  "-y", "-v", "error",
  "-ss", "1.1", "-i", src,
  "-i", FRAME,
  "-f", "lavfi", "-t", "60", "-i", "anullsrc=r=44100:cl=stereo",
  "-filter_complex",
  "[0:v]setpts=PTS/1.2,fps=30,scale=900:1640:flags=lanczos," +
  "pad=1080:1920:90:170:color=0x0E0E11,setsar=1[bg];" +
  "[bg][1:v]overlay=0:0:format=auto[v]",
  "-map", "[v]", "-map", "2:a",
  "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p",
  "-profile:v", "high", "-level", "4.0",
  "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart",
  OUT
], { stdio: "inherit" });
rmSync(dir, { recursive: true, force: true });
if (ff.status !== 0) die("ffmpeg נכשל");
log(`  נכתב ${OUT}`);
