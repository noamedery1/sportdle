/* ============================================================
   clip-hook.mjs — 15 שניות, לפיד ולטיקטוק.

   node tools/clip-hook.mjs
   node tools/clip-hook.mjs --club=beitar --puzzle=2 --out=hook.mp4

   השוני מ-clip.mjs: שם המטרה היא להסביר את המשחק, כאן המטרה היא
   לעצור אגודל. 15 שניות, קצב כפול, וו בשנייה הראשונה וכתובת
   בשלוש האחרונות.

   **האפקטים נעשים ב-CSS בתוך הדפדפן, לא ב-ffmpeg.** שתי סיבות:
   drawtext של ffmpeg לא מעצב עברית — הוא מצייר גליפים בסדר לוגי
   ומחזיר טקסט הפוך; ו-@keyframes נותן פופים, זוהר, רעידה וסוויפים
   מדויקים לפריים שבו האריח נכנס, מה שב-ffmpeg היה דורש חישוב
   זמנים ידני. ffmpeg כאן עושה רק מה שהוא טוב בו: קצב, מסגרת
   טלפון, ויניה וקידוד.

   **לא מראה את החידה של היום** — חידת ארכיון, שבוע אחורה.
   קליפ שמקלקל את החידה הנוכחית עובד פעם אחת.

   דורש ffmpeg ו-ffprobe ב-PATH.
   ============================================================ */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readJSON, loadClubs, parseArgs, log, die } from "../scripts/lib/util.mjs";

const args = parseArgs();
const OUT = args.out || "clip-hook.mp4";

/* תקציב השניות. האצה אחידה על כל הקליפ הייתה מקצרת גם את הכרטיס
   שבו הכתובת מופיעה — ובקליפ של 15 שניות הכתובת היא כל המטרה.
   לכן שלושה קטעים, כל אחד בקצב שלו.

   הוו קבוע, המשחק נגזר מהגלם בהאצה קלה, והסיום סופג את השאר —
   כך שקצב המשחק לא משתנה כשההקלטה יוצאת ארוכה או קצרה במקרה. */
const TARGET   = 15.0;
const T_HOOK   = 2.2;    // קריא, ולא יותר
const PLAY_ACC = 1.15;   // האצה קלה על המשחק. זריז, עוד קריא
const MIN_END  = 3.4;    // רצפת הכרטיס שבו הכתובת
const FRAME = "tools/assets/phone-frame.png";
if (!existsSync(FRAME)) die(`חסר ${FRAME}`);

const site = readJSON("config/site.json");
/* מה שמצולם ומה שנכתב על הכרטיס הם שני דברים שונים.
   הכתובת על הכרטיס תמיד הקנונית מ-config/site.json; ההקלטה
   יכולה לרוץ מול השרת המקומי, וזה גם ברירת המחדל: מסנן התוכן
   ברשת הזאת מחליף תעודות TLS, ו-Chromium של Playwright דוחה
   אותן. `--base=https://…` מקליט מול החי.                     */
const CANON = String(site.siteUrl).replace(/\/$/, "");
const HOST = CANON.replace(/^https?:\/\//, "");
const base = (args.base || "http://localhost:4173").replace(/\/$/, "");

function dayIndex() {
  const [y, m, d] = site.start;
  const n = new Date();
  return Math.max(0, Math.floor(
    (Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - Date.UTC(y, m - 1, d)) / 86400000));
}
const todayNo = dayIndex() + 1;
const puzzleNo = args.puzzle ? +args.puzzle : Math.max(1, todayNo - 7);

const clubs = loadClubs();
const club = args.club
  ? clubs.find(c => c.slug === args.club) || die(`מועדון לא מוכר: ${args.club}`)
  : clubs.find(c => c.slug === "beitar") || clubs[0];

const db = readJSON(`data/clubs/${club.slug}.json`, null) || die(`אין מאגר ל-${club.slug}`);
const answer = db.schedule[puzzleNo - 1];
if (!answer) die(`אין חידה #${puzzleNo} ב-${club.slug}`);

/* שלושה ניחושים מוטעים, קבועים לכל חידה: אותו קלט → אותו קליפ.
   שמות ותיקים, כי אותם אוהד מזהה — וזיהוי הוא מה שעוצר גלילה. */
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
while (wrong.length < 3 && pool.length)
  wrong.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0].he);
if (wrong.length < 3) die("אין מספיק שחקנים לניחושים");

const clubNames = clubs.map(c => c.game);
log(`  ${club.game} · חידה #${puzzleNo} · ${wrong.join(" → ")} → ${answer}`);

/* ---------- העיצוב והאנימציות ---------- */
const BRAND = club.colors.brand;
const CSS = `
html{zoom:2}
html,body{overflow:hidden!important}

/* רעידה ופופ על העמוד כולו. שניהם על .wrap ולא על body, כי
   body הוא flex container וטרנספורם עליו מזיז את הפוטר. */
.wrap{will-change:transform}
@keyframes fxPunch{0%{transform:scale(1)}32%{transform:scale(1.04)}100%{transform:scale(1)}}
@keyframes fxShake{
  0%,100%{transform:translate(0,0)}
  15%{transform:translate(-9px,4px) rotate(-.5deg)}
  30%{transform:translate(8px,-5px) rotate(.5deg)}
  45%{transform:translate(-6px,-3px)}
  60%{transform:translate(6px,4px)}
  80%{transform:translate(-3px,2px)}
}
.fx-punch{animation:fxPunch .42s cubic-bezier(.2,1.5,.3,1)}
.fx-shake{animation:fxShake .62s ease-in-out}

/* הבזק לבן — מסמן את הרגע שבו השורה נכנסת */
#fxFlash{position:fixed;inset:0;background:#fff;opacity:0;z-index:99998;
  pointer-events:none;mix-blend-mode:screen}
@keyframes fxBlink{0%{opacity:0}18%{opacity:.62}100%{opacity:0}}
.fx-blink{animation:fxBlink .26s ease-out}

/* כרטיס מסך מלא — וו, ניצחון, קריאה לפעולה */
#fxCard{position:fixed;inset:0;z-index:99999;display:none;
  flex-direction:column;align-items:center;justify-content:center;
  gap:20px;text-align:center;padding:0 24px;
  font-family:'Heebo','Segoe UI',Arial,sans-serif;
  background:radial-gradient(120% 90% at 50% 0%, #1b1b23 0%, #0a0a0c 62%);}
#fxCard.on{display:flex}
#fxCard .l1{font-size:56px;font-weight:900;line-height:1.02;color:#F2F2F0;
  letter-spacing:-2px}
#fxCard .l1 em{color:${BRAND};font-style:normal}
#fxCard .l2{font-size:40px;font-weight:800;color:${BRAND};line-height:1.1}
#fxCard .l3{font-size:27px;font-weight:500;color:#A8A8B2;line-height:1.35}
/* הכתובת היא כל מטרת הקליפ, ולכן היא לא נחתכת: nowrap כדי שלא
   תישבר, ומידה שמתאימה ל-450px CSS שיש בפריים (900 עם zoom:2)
   פחות הריפוד. 40px חתכו את ה-s של sportsdel. */
#fxCard .url{font-size:27px;font-weight:900;color:#0a0a0c;background:${BRAND};
  padding:13px 20px;border-radius:13px;letter-spacing:-.2px;
  white-space:nowrap;max-width:100%;
  box-shadow:0 0 0 0 ${BRAND}66}
@keyframes fxGlow{
  0%,100%{box-shadow:0 0 0 0 ${BRAND}00;transform:scale(1)}
  50%{box-shadow:0 0 44px 8px ${BRAND}55;transform:scale(1.035)}
}
#fxCard .url{animation:fxGlow 1.15s ease-in-out infinite}

/* כניסה: טשטוש שנפתח, לא fade. הדבר היחיד שנראה "מפוצץ"
   בשלוש הפריימים הראשונות, וזה כל מה שיש כדי לעצור אגודל. */
@keyframes fxIn{
  0%{opacity:0;filter:blur(16px);transform:scale(1.22)}
  60%{opacity:1;filter:blur(0);transform:scale(1)}
  100%{opacity:1;filter:blur(0);transform:scale(1)}
}
#fxCard.on > *{animation:fxIn .42s cubic-bezier(.16,1,.3,1) both}
#fxCard.on > *:nth-child(2){animation-delay:.16s}
#fxCard.on > *:nth-child(3){animation-delay:.3s}
#fxCard.on > *:nth-child(4){animation-delay:.42s}

/* רצועה אלכסונית נעה — אותה רצועה שיש בכרטיסי ה-og */
#fxCard::before,#fxCard::after{content:"";position:absolute;left:-20%;right:-20%;
  height:15px;background:repeating-linear-gradient(115deg,${BRAND} 0 16px,
    ${club.colors.second || "#141418"} 16px 32px);}
#fxCard::before{top:9%;animation:fxSlide 2.6s linear infinite}
#fxCard::after{bottom:9%;animation:fxSlide 2.6s linear infinite reverse}
@keyframes fxSlide{to{transform:translateX(64px)}}

/* חמשת המועדונים בכרטיס הסיום */
#fxCard .chips{display:flex;flex-wrap:wrap;gap:9px;justify-content:center}
#fxCard .chips b{font-size:22px;font-weight:800;color:#C9C9D1;background:#17171d;
  border:1px solid #2E2E36;border-radius:999px;padding:8px 17px}

/* כתובית תחתונה בזמן המשחק */
#fxCap{position:fixed;left:0;right:0;bottom:52px;z-index:99997;display:flex;
  justify-content:center;pointer-events:none;padding:0 16px}
#fxCap span{background:rgba(0,0,0,.9);color:#fff;font-weight:900;font-size:26px;
  line-height:1.25;padding:11px 18px;border-radius:13px;text-align:center;
  font-family:'Heebo','Segoe UI',Arial,sans-serif;
  box-shadow:0 6px 26px rgba(0,0,0,.7);animation:fxIn .3s ease-out both}
#fxCap span i{color:${BRAND};font-style:normal}
`;

/* ---------- הקלטה ---------- */
const dir = mkdtempSync(join(tmpdir(), "sportdle-hook-"));
const browser = await chromium.launch({ headless: true });

/* חותמות זמן לגבולות הקטעים. ההקלטה מתחילה עם יצירת ההקשר והיא
   בזמן אמת, ולכן שעון הקיר מתיישר עם ציר הווידאו בדיוק של כעשירית
   שנייה — די והותר לחיתוך שאיש לא רואה. */
const T0 = Date.now();
const mark = {};
const at = k => { mark[k] = (Date.now() - T0) / 1000; };
const ctx = await browser.newContext({
  viewport: { width: 900, height: 1640 },
  deviceScaleFactor: 1,
  locale: "he-IL",
  /* רק כדי לעבור את המסנן שמחליף תעודות ברשת הזאת. מדובר
     בהקלטה של האתר של הפרויקט עצמו, ולא בערוץ שמעביר נתונים. */
  ignoreHTTPSErrors: true,
  recordVideo: { dir, size: { width: 900, height: 1640 } }
});
await ctx.addInitScript(([slug]) => {
  try {
    localStorage.setItem("sportdel:club", slug);
    localStorage.setItem("sportdel:seen", "1");
  } catch (e) {}
}, [club.slug]);

const page = await ctx.newPage();

const card = (html) => page.evaluate((h) => {
  const el = document.getElementById("fxCard");
  el.innerHTML = h;
  el.classList.toggle("on", Boolean(h));
}, html);

const cap = (t) => page.evaluate((txt) => {
  const el = document.getElementById("fxCap");
  el.innerHTML = txt ? `<span>${txt}</span>` : "";
}, t);

/* פופ + הבזק ברגע שהשורה נכנסת */
const punch = (shake = false) => page.evaluate((sh) => {
  const w = document.querySelector(".wrap");
  const f = document.getElementById("fxFlash");
  const cls = sh ? "fx-shake" : "fx-punch";
  if (w) { w.classList.remove("fx-punch", "fx-shake"); void w.offsetWidth; w.classList.add(cls); }
  if (f) { f.classList.remove("fx-blink"); void f.offsetWidth; f.classList.add("fx-blink"); }
}, shake);

const guess = async (name, capText, last = false) => {
  if (capText !== undefined) await cap(capText);
  await page.evaluate(() => document.querySelector("#guess").focus({ preventScroll: true }));
  /* מהיר. 15 שניות לא סובלות הקלדה איטית, ומה שחשוב לראות הוא
     שהשם נכתב — לא כל תו בנפרד. */
  await page.keyboard.type(name, { delay: 44 });
  await page.waitForTimeout(210);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  await punch(last);
  await page.waitForTimeout(last ? 620 : 500);
};

await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.addStyleTag({ content: CSS });
await page.evaluate(() => {
  for (const id of ["fxFlash", "fxCard", "fxCap"]) {
    const d = document.createElement("div"); d.id = id; document.body.appendChild(d);
  }
  window.__pin = () => window.scrollTo(0, 0);
  addEventListener("scroll", window.__pin, { passive: true });
});
await page.evaluate((n) => loadPuzzle(n), puzzleNo);
await page.waitForTimeout(500);

/* ---------- 0.0–2.1s · הוו ---------- */
at("hookStart");
await card(`<div class="l1">מכיר כדורגל<br>ישראלי?</div>
            <div class="l2">תוכיח ב-8 ניסיונות.</div>`);
await page.waitForTimeout(2100);
at("hookEnd");

/* ---------- 2.1–10.4s · משחק אמיתי ---------- */
await card("");
await cap("שחקן אחד מסתורי. <i>כל יום.</i>");
await page.waitForTimeout(560);
await guess(wrong[0], "מקלידים שם — ומקבלים 5 רמזים");
await guess(wrong[1], "<i>צבע</i> = פגעת · <i>חץ</i> = לכיוון הזה");
await guess(wrong[2], "מצמצמים…");
await cap("");
await guess(answer, undefined, true);

/* וכאן מה שביקשת מזמן רב: שייראו שיש כמה מועדונים.
   בורר אמיתי שנפתח, ואז החלפה שמשנה את צבע המותג של
   המסך כולו — זה נראה בסרטון פי עשר מחמשה שמות על כרטיס. */
await page.waitForTimeout(430);
await cap("וזה רק <i>מועדון אחד</i>");
await page.evaluate(() => openPicker());
await page.waitForTimeout(1250);
await cap("");
const other = (clubs.find(c => c.slug === "maccabi-haifa") || clubs[1]).slug;
/* closePicker חייב להיקרא במפורש: chooseClub עצמו אינו סוגר את
   הבורר, זה קורה ב-onclick של הכפתור. בלי זה הבורר נשאר פתוח
   וההחלפה לא נראית בכלל. */
await page.evaluate((s) => { closePicker(); chooseClub(s); }, other);
await page.waitForTimeout(180);
await punch();
await page.waitForTimeout(1150);
at("playEnd");

/* ---------- הכתובת ---------- */
await card(`<div class="l1">חידה חדשה<br><em>כל בוקר.</em></div>
            <div class="url">${HOST}</div>
            <div class="l3">חמישה מועדונים · בחינם</div>`);
await page.waitForTimeout(4200);
at("end");

await page.close();
await ctx.close();
await browser.close();

/* ---------- הרכבה ---------- */
const raw = readdirSync(dir).find(f => f.endsWith(".webm"));
if (!raw) die("ההקלטה לא נוצרה");
const src = join(dir, raw);

/* הפריים הראשון של recordVideo לבן, ולכן חותכים את ההתחלה.
   אחרי החיתוך מודדים ומאיצים כדי לנחות על 15.0 בדיוק — פיד
   חותך סרטון ארוך, וקריאה לפעולה שנחתכת שווה אפס. */
const CUT = 0.9;
const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries",
  "format=duration", "-of", "csv=p=0", src], { encoding: "utf8" });
if (probe.status !== 0) die("ffprobe נכשל");
const rawDur = parseFloat(probe.stdout.trim());
if (!(rawDur > CUT)) die(`אורך הקלטה לא תקין: ${probe.stdout.trim()}`);

/* גבולות הקטעים על ציר ההקלטה. mark.end מהשעון יכול לחרוג
   מהאורך שההקלטה נסגרה בו, ולכן הגבול האחרון הוא האורך האמיתי. */
const bounds = [Math.max(mark.hookStart, CUT), mark.hookEnd, mark.playEnd,
                Math.min(mark.end, rawDur)];
for (let i = 1; i < bounds.length; i++)
  if (!(bounds[i] > bounds[i - 1])) die(`גבולות קטעים לא תקינים: ${bounds.join(", ")}`);

const rawPlay = bounds[2] - bounds[1];
let tPlay = Math.min(rawPlay / PLAY_ACC, TARGET - T_HOOK - MIN_END);
let tEnd  = TARGET - T_HOOK - tPlay;
const SEG = { hook: T_HOOK, play: tPlay, end: tEnd };

const names = ["hook", "play", "end"];
const seg = names.map((n, i) => {
  const rawLen = bounds[i + 1] - bounds[i];
  return { n, a: bounds[i], b: bounds[i + 1], rawLen, k: rawLen / SEG[n] };
});
for (const s of seg)
  log(`  ${s.n.padEnd(4)} ${s.rawLen.toFixed(2)}s → ${SEG[s.n].toFixed(2)}s  ×${s.k.toFixed(2)}`);

/* trim + setpts לכל קטע, ואז concat. STARTPTS מאופס בכל קטע,
   אחרת ה-concat מקבל חורי זמן והפלט קופא. */
const chain = seg.map((s, i) =>
  `[0:v]trim=start=${s.a.toFixed(3)}:end=${s.b.toFixed(3)},` +
  `setpts=(PTS-STARTPTS)/${s.k.toFixed(6)}[s${i}]`).join(";");

const ff = spawnSync("ffmpeg", [
  "-y", "-v", "error",
  "-i", src,
  "-i", FRAME,
  "-f", "lavfi", "-t", "30", "-i", "anullsrc=r=44100:cl=stereo",
  "-filter_complex",
  `${chain};` +
  `${seg.map((_, i) => `[s${i}]`).join("")}concat=n=${seg.length}:v=1:a=0[cat];` +
  "[cat]fps=30,scale=900:1640:flags=lanczos," +
  /* ויניה עדינה — מחזירה את העין למרכז המסך בפיד קטן */
  "vignette=angle=PI/6," +
  "pad=1080:1920:90:170:color=0x0A0A0C,setsar=1[bg];" +
  "[bg][1:v]overlay=0:0:format=auto[v]",
  "-map", "[v]", "-map", "2:a",
  "-t", String(TARGET),
  "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-pix_fmt", "yuv420p",
  "-profile:v", "high", "-level", "4.0", "-r", "30",
  "-c:a", "aac", "-b:a", "96k", "-shortest", "-movflags", "+faststart",
  OUT
], { stdio: "inherit" });
rmSync(dir, { recursive: true, force: true });
if (ff.status !== 0) die("ffmpeg נכשל");

const out = spawnSync("ffprobe", ["-v", "error", "-show_entries",
  "format=duration,size", "-of", "csv=p=0", OUT], { encoding: "utf8" });
log(`  נכתב ${OUT} · ${out.stdout.trim()}`);
