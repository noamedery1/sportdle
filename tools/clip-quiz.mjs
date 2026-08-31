/* ============================================================
   clip-quiz.mjs — סרטון אתגר: "מי השחקן?"

   node tools/clip-quiz.mjs                    בחירה אוטומטית
   node tools/clip-quiz.mjs --player="ערן זהבי"
   node tools/clip-quiz.mjs --out=quiz.mp4

   זה לא הדגמה של המשחק אלא **אתגר לצופה**. הרמזים נחשפים אחד
   אחד, הצופה מנחש בראש, ורק אז מגיעה התשובה. מה שעוצר גלילה
   הוא שהוא כבר משחק — לא שהוא מבין איך משחקים.

   הנתונים אמיתיים ומגיעים מהמאגר: שחקן ששיחק בשניים או שלושה
   מהמועדונים שבמשחק, כי זה הרמז שמעורר ויכוח. הצירוף עצמו הוא
   הקרס — "מי שיחק גם בבית"ר וגם בהפועל תל אביב".

   הרמזים מסודרים מהרחב למצומצם: מועדונים, עמדה, תארים, עונות,
   שנת לידה. מי שיודע מזהה אחרי השני; מי שלא, נשאר עד הסוף.

   דורש ffmpeg ב-PATH.
   ============================================================ */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readJSON, loadClubs, parseArgs, log, die } from "../scripts/lib/util.mjs";

const args = parseArgs();
const OUT = args.out || "quiz.mp4";
const PAGE = "tools/assets/quiz.html";
if (!existsSync(PAGE)) die(`חסר ${PAGE}`);

const site = readJSON("config/site.json");
const url = String(site.siteUrl).replace(/^https?:\/\//, "").replace(/\/$/, "");

/* ---------- איסוף מועמדים ---------- */
const clubs = loadClubs();
const dbs = new Map();
for (const c of clubs) {
  const d = readJSON(`data/clubs/${c.slug}.json`, null);
  if (d) dbs.set(c.slug, { ...d, colors: c.colors });
}

const POS = { GK: "שוער", DF: "מגן", MF: "קשר", FW: "חלוץ" };
const cand = new Map();
for (const [slug, d] of dbs) {
  for (const p of d.players) {
    if (!p.pos || !p.born || !p.spells?.length) continue;
    const k = `${p.he}|${p.born}`;
    if (!cand.has(k)) cand.set(k, {
      he: p.he, pos: p.pos, born: p.born, seasons: 0, titles: 0, clubs: []
    });
    const m = cand.get(k);
    m.seasons += p.seasons;
    m.titles += p.titles;
    m.clubs.push({ name: d.game, color: d.colors.brand, slug });
  }
}

/* שניים-שלושה מועדונים, ומספיק תארים כדי שהצירוף יהיה מפתיע */
let pool = [...cand.values()]
  .filter(m => m.clubs.length >= 2 && m.titles >= 6 && m.seasons >= 6)
  .sort((a, b) => b.clubs.length - a.clubs.length || b.titles - a.titles);

const pick = args.player
  ? pool.find(m => m.he === args.player) ||
    [...cand.values()].find(m => m.he === args.player) ||
    die(`לא נמצא: ${args.player}`)
  : pool[0];
if (!pick) die("לא נמצא מועמד");

pick.clubs.sort((a, b) => a.name.localeCompare(b.name, "he"));
log(`  ${pick.he} · ${POS[pick.pos]} · ${pick.born} · ` +
    `${pick.seasons} עונות · ${pick.titles} תארים · ${pick.clubs.map(c => c.name).join(" + ")}`);

/* ---------- ציר הזמן ---------- */
const T = { c1: 2.4, c2: 4.9, c3: 7.2, c4: 9.5, c5: 11.8,
            beat: 14.2, reveal: 16.4, cta: 20.6, end: 26.0 };

/* העובדה קודם, השאלה אחריה. "שיחק בכל חמש הקבוצות" עוצר
   גלילה; "מי השחקן?" לבדו הוא עוד סרטון חידות. */
const WORD = { 2: "בשתיים", 3: "בשלוש", 4: "בארבע", 5: "בכל חמש" };
const n = pick.clubs.length;
const QUIZ = {
  hook: n >= 5 ? 'שיחק ב<b>כל חמש</b><br>הקבוצות במשחק'
               : `שיחק <b>${WORD[n] || n}</b><br>מהקבוצות במשחק`,
  sub: "מי הוא?",
  clues: [
    { k: "המועדונים", chips: pick.clubs, at: T.c1, hi: true },
    { k: "עמדה",      v: POS[pick.pos],           at: T.c2 },
    { k: "תארים",     v: String(pick.titles),     at: T.c3 },
    { k: "עונות",     v: String(pick.seasons),    at: T.c4 },
    { k: "נולד",      v: String(pick.born),       at: T.c5 }
  ],
  answer: pick.he,
  meta: `${POS[pick.pos]} · ${pick.titles} תארים · ${pick.seasons} עונות`,
  chips: pick.clubs,
  allClubs: [...dbs.values()].map(d => ({ name: d.game, color: d.colors.brand })),
  url
};

/* ---------- הקלטה ---------- */
const dir = mkdtempSync(join(tmpdir(), "sportdle-quiz-"));
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
  locale: "he-IL",
  recordVideo: { dir, size: { width: 1080, height: 1920 } }
});
await ctx.addInitScript(([q, t]) => {
  window.QUIZ = q;
  addEventListener("DOMContentLoaded", () => {
    const r = document.documentElement.style;
    r.setProperty("--tBeat", t.beat + "s");
    r.setProperty("--tReveal", t.reveal + "s");
    r.setProperty("--tCta", t.cta + "s");
  });
}, [QUIZ, T]);

const page = await ctx.newPage();
await page.goto("file:///" + resolve(PAGE).replace(/\\/g, "/"), { waitUntil: "networkidle" });
/* הגופנים חייבים להיות בפריים הראשון, אחרת רואים החלפת גופן */
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
/* מפעילים את האנימציות רק עכשיו, כדי שהשנייה הראשונה תיקלט */
await page.evaluate(() => {
  document.querySelectorAll("*").forEach(el => {
    const a = getComputedStyle(el).animationName;
    if (a && a !== "none") { el.style.animationPlayState = "running"; }
  });
});
await page.waitForTimeout(T.end * 1000);
await page.close();
await ctx.close();
await browser.close();

/* ---------- הרכבה ---------- */
const raw = readdirSync(dir).find(f => f.endsWith(".webm"));
if (!raw) die("ההקלטה לא נוצרה");
const ff = spawnSync("ffmpeg", [
  "-y", "-v", "error",
  "-i", join(dir, raw),
  "-f", "lavfi", "-t", String(T.end + 2), "-i", "anullsrc=r=44100:cl=stereo",
  "-filter_complex", "[0:v]fps=30,scale=1080:1920:flags=lanczos,setsar=1[v]",
  "-map", "[v]", "-map", "1:a",
  "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-pix_fmt", "yuv420p",
  "-profile:v", "high", "-level", "4.0",
  "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart",
  OUT
], { stdio: "inherit" });
rmSync(dir, { recursive: true, force: true });
if (ff.status !== 0) die("ffmpeg נכשל");
log(`  נכתב ${OUT}`);
