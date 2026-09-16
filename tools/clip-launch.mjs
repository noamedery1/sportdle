/* ============================================================
   clip-launch.mjs — סרטון ההשקה. "חצות".

   node tools/clip-launch.mjs
   node tools/clip-launch.mjs --out=launch.mp4

   **מה הסרטון עונה עליו.** ביום שהאפליקציה יוצאת השאלה אינה
   "מה המשחק" אלא "למה שיהיה לי את זה בטלפון", והתשובה אינה
   "יש משחק" אלא **"יש רגע"**: חצות, וכל אוהד מקבל את החידה של
   הקבוצה שלו.

   **תיקון עובדתי לגרסה הראשונה.** היא אמרה "אותו שחקן לכולם",
   וזה פשוט לא נכון: לכל מועדון לוח נפרד ותשובה משלו. ב-16/09,
   למשל, בית"ר קיבלה את אביאל זרגרי וחיפה את נהוראי יפרח. מה
   שמשותף הוא **השעה**, לא התשובה — וזה גם הסיפור הנכון יותר,
   כי הוא אומר "חמישה משחקים" ולא "משחק אחד".

   **המנגנון החזותי הוא כל הסרטון.** בכל חדר חשוך מסך הטלפון הוא
   מקור האור היחיד, והוא צובע את הפנים בצבע המועדון. החיתוך בין
   חדר לחדר הוא על ההידלקות — האור עובר מיריב ליריב כמו מסירה.

   **ושם המועדון נכנס על כל פנים.** בלעדיו הצופה רואה חמישה
   אנשים בחמישה צבעים ולא מבין שאלה חמישה מועדונים — דווח
   מהשטח, וזו הייתה החולשה הגדולה של הגרסה הראשונה.

   **חמישה אנשים שונים ולא אחד** — אישה בת 35, גבר בן 65, נער בן
   17, וגברים בני 30 ו-45. אוהד כדורגל ישראלי אינו רק בן שלושים.

   **ההידלקות של בית"ר היא וידאו אמיתי מ-Flow**, והשאר הן רמפת
   אור ב-CSS בין אותה תמונה מוחשכת לתמונה המוארת. ההבדל קטן כי
   זה אותו פריים בדיוק — מה ש-Flow מוסיף הוא מיקרו-תנועה:
   אישונים שמצטמצמים, מצמוץ, הבעה שנפתחת. לשדרוג של השאר צריך
   עוד ארבע הרצות, וזה מה שהקובץ הזה מוכן לקבל: להחליף ramp
   ב-video בכל אחד מהחמישה.

   **נכסי החנות אמיתיים** — הסמל, השם, המפתח והתיאור הקצר נשלפו
   מ-Play Console ולא נכתבו כאן. הקטע האחרון מציג אותם בדיוק כפי
   שהם יופיעו בדף.

   כל טקסט וכל אפקט ב-CSS, כי drawtext מחזיר עברית הפוכה.
   דורש ffmpeg ו-ffprobe ב-PATH.
   ============================================================ */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
const log = m => console.log(m);
const die = m => { console.error("✖ " + m); process.exit(1); };

const OUT = args.out || "sportdle-launch.mp4";
const W = 900, H = 1600;
const DIR = "tools/assets/launch";

/* סדר ההידלקויות. בית"ר פותח — הוא גם היחיד עם וידאו מ-Flow. */
const CLUBS = JSON.parse(readFileSync("config/clubs.json", "utf8"));
const FANS = ["beitar", "maccabi-haifa", "maccabi-ta", "hapoel-ta", "hapoel-bs"].map(s => ({
  slug: s,
  he: CLUBS[s].he,              /* שם המועדון ושם המשחק נקראים מהקונפיג */
  game: CLUBS[s].game,          /* ולא נכתבים כאן, אחרת הם יסתרו את האתר */
  color: CLUBS[s].colors.brand,
  /* **בלי וידאו.** ignite-beitar.mp4 נוצר מהתמונה הקודמת של
     בית"ר, וזו הייתה אותה דמות בדיוק כמו באר שבע — דווח מהשטח,
     ובצדק. בית"ר עברה לדמות החוזרת מכל הקליפים, והווידאו נשאר
     מאחור עם הפרצוף הישן. לשחזור: להריץ את ההידלקות ב-Flow מול
     beitar.jpg החדש, ואז להחזיר כאן { video: ... }. */
}));

for (const f of FANS)
  for (const p of [`${f.slug}.jpg`, `dark-${f.slug}.jpg`, ...(f.video ? [f.video] : [])])
    if (!existsSync(join(DIR, p))) die(`חסר ${join(DIR, p)}`);
for (const p of ["store/icon.png"])
  if (!existsSync(join(DIR, p))) die(`חסר ${join(DIR, p)}`);

/* ---------- החידה, מהמאגר ---------- */
const club = JSON.parse(readFileSync("data/clubs/beitar.json", "utf8"));
const ANSWER = "אלי אוחנה";
const p = club.players.find(x => x.he === ANSWER);
if (!p?.target) die(`${ANSWER} אינו בבריכת התשובות`);
const POS_HE = { GK: "שוער", DF: "הגנה", MF: "קישור", FW: "התקפה" };
const season = y => `${String(y - 1).slice(2)}/${String(y).slice(2)}`;
const CLUES = [["עמדה", POS_HE[p.pos]], ["לאום", "ישראל"],
               ["עונה 1", season(p.spells[0][0])], ["תארים", String(p.titles)],
               ["נולד", String(p.born)]];

const site = JSON.parse(readFileSync("config/site.json", "utf8"));
const HOST = String(site.siteUrl).replace(/^https?:\/\//, "").replace(/\/$/, "");
/* נשלף מ-Play Console, לא נכתב כאן */
const STORE = { name: "SportDle", dev: "TechByNoam",
                desc: "חידת השחקן היומית. חמישה מועדונים, שמונה ניסיונות." };

const b64 = f => readFileSync(join(DIR, f)).toString("base64");
const jpg = f => `data:image/jpeg;base64,${b64(f)}`;
const FONT = pathToFileURL(resolve("src/static/fonts/heebo-400-hebrew.woff2")).href;

const fanHtml = FANS.map((f, i) => f.video
  ? `<div class="fan" id="f${i}">
       <video class="lit" muted playsinline preload="auto" poster="${jpg(`dark-${f.slug}.jpg`)}" src="${f.video}"></video>
     </div>`
  : `<div class="fan" id="f${i}">
       <div class="dark" style="background-image:url('${jpg(`dark-${f.slug}.jpg`)}')"></div>
       <div class="lit ramp" style="background-image:url('${jpg(`${f.slug}.jpg`)}')"></div>
     </div>`).join("\n  ");

const gridHtml = FANS.map(f =>
  `<div class="cell" style="background-image:url('${jpg(`${f.slug}.jpg`)}')"></div>`).join("");

const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<style>
@font-face{font-family:Heebo;src:url("${FONT}") format("woff2");font-weight:400 900;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#000;
  font-family:Heebo,system-ui,sans-serif;color:#fff}
#stage{position:relative;width:100%;height:100%;overflow:hidden;background:#000}

/* ---------- שעון חצות ---------- */
#clock{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:30px;opacity:0;transition:opacity .3s}
#clock.on{opacity:1}
#clock .t{font-size:150px;font-weight:900;letter-spacing:4px;font-variant-numeric:tabular-nums}
#clock .t.hit{color:#FFC72C;animation:pop .5s cubic-bezier(.2,.9,.3,1.6)}
@keyframes pop{0%{transform:scale(1)}40%{transform:scale(1.16)}100%{transform:scale(1)}}
#clock .c{font-size:44px;color:#9aa0a6}

/* ---------- אוהדים ---------- */
.fan{position:absolute;inset:0;opacity:0}
.fan.on{opacity:1}
.fan .dark,.fan .lit{position:absolute;inset:0;background-size:cover;background-position:center}
.fan video.lit{width:100%;height:100%;object-fit:cover}
.fan .ramp{opacity:0}
.fan.go .ramp{animation:ignite 1.15s cubic-bezier(.4,0,.2,1) forwards}
@keyframes ignite{0%{opacity:0}55%{opacity:.75}100%{opacity:1}}
/* הבזק רך של צבע המועדון ברגע ההידלקות — מה שמחבר חדר לחדר */
#tint{position:absolute;inset:0;opacity:0;pointer-events:none;mix-blend-mode:screen}
#tint.go{animation:tint .6s ease-out}
@keyframes tint{0%{opacity:.34}100%{opacity:0}}

/* ---------- שם המועדון על הפנים ----------
   נכנס בחבטה: מגיע גדול ונופל למקומו תוך 0.22 שניות, ומתחתיו
   פס בצבע המועדון שנפתח מהמרכז. בלי זה הצופה רואה חמישה אנשים
   בחמישה צבעים ולא מבין שאלה חמישה מועדונים. */
#club{position:absolute;left:0;right:0;top:132px;text-align:center;opacity:0;z-index:40}
#club.go{animation:clubin .5s cubic-bezier(.16,1,.3,1) forwards}
@keyframes clubin{0%{opacity:0;transform:scale(1.5)}60%{opacity:1}100%{opacity:1;transform:scale(1)}}
#club .n{font-size:74px;font-weight:900;line-height:1.05;
  text-shadow:0 4px 26px rgba(0,0,0,.95),0 2px 6px rgba(0,0,0,.9)}
#club .g{font-size:38px;font-weight:900;margin-top:10px;color:#fff;opacity:.92;
  text-shadow:0 3px 18px rgba(0,0,0,.95)}
#club .bar{height:9px;width:0;margin:20px auto 0;border-radius:6px}
#club.go .bar{animation:barin .42s .16s cubic-bezier(.16,1,.3,1) forwards}
@keyframes barin{to{width:300px}}

/* ---------- הבזק חצות ---------- */
#flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
#flash.go{animation:fl .5s ease-out}
@keyframes fl{0%{opacity:1}100%{opacity:0}}
#streak{position:absolute;inset:0;display:flex;opacity:0;pointer-events:none}
#streak div{flex:1;transform:scaleY(0)}
#streak.go{opacity:1}
#streak.go div{animation:str .62s cubic-bezier(.16,1,.3,1) forwards}
#streak.go div:nth-child(2){animation-delay:.05s}
#streak.go div:nth-child(3){animation-delay:.1s}
#streak.go div:nth-child(4){animation-delay:.15s}
#streak.go div:nth-child(5){animation-delay:.2s}
@keyframes str{0%{transform:scaleY(0)}55%{transform:scaleY(1)}100%{transform:scaleY(0)}}

/* ---------- כיתוב ---------- */
/* z-index כי הכיתוב מוגדר בדום לפני הרשת ולפני דף החנות, ובלעדיו
   הן צובעות מעליו — "חמישה מועדונים. חמש חידות." פשוט לא נראה. */
#cap{position:absolute;left:0;right:0;bottom:160px;text-align:center;padding:0 70px;z-index:50}
/* בקטע החנות הכיתוב יורד לתחתית הפריים ומכסה את צילומי המסך.
   שם הוא עולה לראש, מעל שורת Google Play. */
#cap.top{bottom:auto;top:26px}
#cap b{display:inline-block;background:rgba(0,0,0,.82);font-weight:900;font-size:62px;
  line-height:1.3;padding:14px 32px;opacity:0;transform:translateY(16px)}
#cap b.on{animation:capin .36s cubic-bezier(.2,.9,.3,1.4) forwards}
@keyframes capin{to{opacity:1;transform:translateY(0)}}

/* ---------- לוח הרמזים ---------- */
#board{position:absolute;inset:0;background:#0b0b0c;opacity:0;display:flex;
  flex-direction:column;align-items:center;justify-content:center;gap:24px;text-align:center}
#board.on{opacity:1}
#board h2{font-size:42px;font-weight:900;color:#FFC72C}
.row{display:flex;gap:11px;width:100%;max-width:780px;justify-content:center;flex-wrap:wrap}
.cl{flex:0 0 236px;background:#17181b;border:3px solid #2a2c31;border-radius:18px;
  padding:18px 8px;text-align:center;opacity:0;transform:scale(.88)}
.cl.on{animation:pop2 .28s cubic-bezier(.2,.9,.3,1.5) forwards}
@keyframes pop2{to{opacity:1;transform:scale(1)}}
.cl .k{font-size:25px;color:#9aa0a6}
.cl .v{font-size:44px;font-weight:900;margin-top:4px}
#nm{font-size:76px;font-weight:900;color:#FFC72C;opacity:0;margin-top:10px}
#nm.on{animation:capin .4s forwards}

/* ---------- רשת חמשת החדרים ---------- */
#grid{position:absolute;inset:0;opacity:0;display:grid;
  grid-template-columns:1fr 1fr;grid-template-rows:repeat(3,1fr);gap:6px;background:#000}
#grid.on{opacity:1}
#grid .cell{background-size:cover;background-position:center;opacity:0}
#grid.on .cell{animation:cellin .5s ease-out forwards}
#grid .cell:nth-child(1){animation-delay:.05s}
#grid .cell:nth-child(2){animation-delay:.15s}
#grid .cell:nth-child(3){animation-delay:.25s}
#grid .cell:nth-child(4){animation-delay:.35s}
#grid .cell:nth-child(5){animation-delay:.45s;grid-column:1/3}
@keyframes cellin{0%{opacity:0;transform:scale(1.14)}100%{opacity:1;transform:scale(1)}}

/* ---------- התכנסות אל הסמל ----------
   הסמל עצמו הוא כדור זהב על קרניים בחמשת צבעי המועדונים, ולכן
   הסיום הנכון הוא שחמשת הצבעים שראינו על חמישה פרצופים מתכנסים
   בדיוק אל שם. בלי זה הסרטון חתך מפנים לדף לבן, וזה היה הרגע
   החלש היחיד בו. */
#conv{position:absolute;inset:0;background:#000;opacity:0;display:flex;
  align-items:center;justify-content:center;overflow:hidden}
#conv.on{opacity:1}
#conv .rays{position:absolute;width:2400px;height:2400px;border-radius:50%;
  opacity:0;transform:scale(1.9) rotate(0deg)}
#conv.on .rays{animation:rays 1.5s cubic-bezier(.5,0,.2,1) forwards}
@keyframes rays{
  0%{opacity:0;transform:scale(1.9) rotate(-38deg)}
  25%{opacity:1}
  100%{opacity:.95;transform:scale(.21) rotate(14deg)}}
#conv .ic{position:absolute;width:420px;height:420px;border-radius:94px;
  background-size:cover;opacity:0;transform:scale(.4)}
#conv.on .ic{animation:icpop .75s .95s cubic-bezier(.16,1,.3,1) forwards}
@keyframes icpop{0%{opacity:0;transform:scale(.4)}
  60%{opacity:1;transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
#conv .wm{position:absolute;bottom:330px;font-size:86px;font-weight:900;
  letter-spacing:-3px;opacity:0}
#conv .wm i{color:#FFC72C;font-style:normal}
#conv.on .wm{animation:capin .5s 1.5s forwards}

/* ---------- דף החנות ---------- */
#store{position:absolute;inset:0;opacity:0;background:#fff;color:#202124;
  display:flex;flex-direction:column;padding:70px 56px}
#store.on{opacity:1}
#store .bar{display:flex;align-items:center;gap:14px;color:#5f6368;font-size:28px;margin-bottom:54px}
#store .bar .g{font-size:34px;font-weight:900;color:#202124}
#store .head{display:flex;gap:28px;align-items:center}
#store .ic{width:170px;height:170px;border-radius:38px;background-size:cover;flex:0 0 auto;
  box-shadow:0 6px 22px rgba(0,0,0,.22)}
#store.on .ic{animation:icin .6s cubic-bezier(.16,1,.3,1)}
@keyframes icin{0%{transform:scale(.62) rotate(-8deg)}70%{transform:scale(1.07)}100%{transform:scale(1)}}
#store .nm2{font-size:52px;font-weight:900;line-height:1.15}
#store .dev{font-size:30px;color:#01875f;margin-top:8px}
#store .meta{display:flex;gap:40px;margin:46px 4px 34px;color:#5f6368;font-size:26px}
#store .meta b{display:block;color:#202124;font-size:32px;font-weight:900}
#store .btn{background:#01875f;color:#fff;font-size:36px;font-weight:900;text-align:center;
  padding:22px;border-radius:14px;margin-bottom:40px}
#store .desc{font-size:30px;line-height:1.55;color:#3c4043}
#store .shots{display:flex;gap:14px;margin-top:auto}
#store .shots div{flex:1;aspect-ratio:9/16;border-radius:16px;background:#0b0b0c;
  background-size:cover;background-position:center}
</style></head><body><div id="stage">

  <div id="clock"><div class="t" id="ct">23:59:57</div><div class="c" id="cc">חידה חדשה בעוד רגע</div></div>

  ${fanHtml}
  <div id="tint"></div>
  <div id="club"><div class="n"></div><div class="g"></div><div class="bar"></div></div>
  <div id="streak">${FANS.map(f => `<div style="background:${f.color}"></div>`).join("")}</div>
  <div id="flash"></div>
  <div id="cap"></div>

  <div id="board">
    <h2>שמונה ניסיונות. חמישה רמזים.</h2>
    <div class="row" id="r1"></div><div class="row" id="r2"></div>
    <div id="nm">${ANSWER}</div>
  </div>

  <div id="grid">${gridHtml}</div>

  <div id="conv">
    <div class="rays"></div>
    <div class="ic" style="background-image:url('data:image/png;base64,${b64("store/icon.png")}')"></div>
    <div class="wm">Sport<i>Dle</i></div>
  </div>

  <div id="store">
    <div class="bar"><span class="g">Google Play</span></div>
    <div class="head">
      <div class="ic" style="background-image:url('data:image/png;base64,${b64("store/icon.png")}')"></div>
      <div><div class="nm2">${STORE.name}</div><div class="dev">${STORE.dev}</div></div>
    </div>
    <div class="meta"><div><b>חינם</b>ללא פרסומות</div><div><b>עברית</b>מלא</div><div><b>3+</b>לכל הגילים</div></div>
    <div class="btn">התקנה</div>
    <div class="desc">${STORE.desc}</div>
    <div class="shots">
      <div style="background-image:url('data:image/png;base64,${b64("store/shot1.png")}')"></div>
      <div style="background-image:url('data:image/png;base64,${b64("store/shot2.png")}')"></div>
    </div>
  </div>
</div>
<script>
const $ = s => document.querySelector(s);
const CL = ${JSON.stringify(CLUES)};
const COLORS = ${JSON.stringify(FANS.map(f => f.color))};
CL.forEach(([k, v], i) => {
  const d = document.createElement("div");
  d.className = "cl"; d.id = "c" + i;
  d.innerHTML = '<div class="k">' + k + '</div><div class="v">' + v + '</div>';
  (i < 3 ? $("#r1") : $("#r2")).appendChild(d);
});
window.clock = (t, hit) => { const e = $("#ct"); e.textContent = t; e.classList.toggle("hit", !!hit); };
window.clockOn = on => $("#clock").classList.toggle("on", on);
window.clockCap = t => { $("#cc").textContent = t; };
window.fan = i => {
  document.querySelectorAll(".fan").forEach((e, n) => e.classList.toggle("on", n === i));
  const el = document.querySelector("#f" + i);
  const v = el.querySelector("video");
  if (v) { v.currentTime = 0; v.play(); } else { el.classList.add("go"); }
  const t = $("#tint");
  t.style.background = COLORS[i];
  t.classList.remove("go"); void t.offsetWidth; t.classList.add("go");
};
window.fansOff = () => document.querySelectorAll(".fan").forEach(e => e.classList.remove("on"));
const NAMES = ${JSON.stringify(FANS.map(f => [f.he, f.game]))};
window.club = i => {
  const c = $("#club");
  c.querySelector(".n").textContent = NAMES[i][0];
  c.querySelector(".n").style.color = COLORS[i];
  c.querySelector(".g").textContent = NAMES[i][1];
  c.querySelector(".bar").style.background = COLORS[i];
  c.classList.remove("go"); void c.offsetWidth; c.classList.add("go");
};
window.clubOff = () => $("#club").classList.remove("go");
window.flash = () => { const f = $("#flash"); f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); };
window.streak = () => { const s = $("#streak"); s.classList.remove("go"); void s.offsetWidth; s.classList.add("go"); };
window.cap = (t, top) => {
  const c = $("#cap");
  c.classList.toggle("top", !!top);
  c.innerHTML = t ? '<b class="on">' + t + '</b>' : "";
};
window.board = on => $("#board").classList.toggle("on", on);
window.clue = i => $("#c" + i).classList.add("on");
window.name_ = () => $("#nm").classList.add("on");
window.grid = on => $("#grid").classList.toggle("on", on);
window.store = on => $("#store").classList.toggle("on", on);
window.conv = on => {
  const c = $("#conv");
  if (on) {
    /* הקרניים נבנות מצבעי המועדונים עצמם, כדי שההתכנסות תהיה
       אל אותם חמישה צבעים שראינו על הפרצופים. */
    const step = 360 / (COLORS.length * 2);
    const stops = [];
    COLORS.forEach((col, i) => {
      const a = i * 2 * step;
      stops.push(col + " " + a + "deg " + (a + step) + "deg",
                 "#0b0b0c " + (a + step) + "deg " + (a + 2 * step) + "deg");
    });
    c.querySelector(".rays").style.background = "conic-gradient(" + stops.join(",") + ")";
  }
  c.classList.toggle("on", on);
};
</script></body></html>`;

const page$ = join(DIR, "_launch.html");
writeFileSync(page$, html, "utf8");

/* ---------- הקלטה ---------- */
const dir = mkdtempSync(join(tmpdir(), "launch-"));
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "he-IL",
  recordVideo: { dir, size: { width: W, height: H } }
});
const page = await ctx.newPage();
await page.goto(pathToFileURL(resolve(page$)).href);

const wait = ms => page.waitForTimeout(ms);
const run = (fn, ...a) => page.evaluate(([f, args]) => window[f](...args), [fn, a]);
const FAN_N = FANS.length;
await wait(1100);                       // גופן, תמונות, poster

/* 1 · חצות. ההבזק ופסי הצבע הם הפתיחה של הסרטון, לא קישוט —
   חמשת הצבעים מופיעים לפני שמבינים מה הם, ואז כל אחד חוזר. */
await run("clockOn", true);
for (const t of ["23:59:57", "23:59:58", "23:59:59"]) { await run("clock", t); await wait(720); }
await run("clock", "00:00:00", true); await run("clockCap", "חמש חידות חדשות");
await wait(1250);
await run("flash"); await run("streak");
await wait(420);
await run("clockOn", false);

/* 2 · חמש הידלקויות. שם המועדון נכנס בחבטה על כל אחת — בלעדיו
   רואים חמישה אנשים בחמישה צבעים ולא מבינים שאלה חמישה מועדונים.
   2.7 שניות לכל אחד: מספיק לקרוא את השם ואת שם המשחק בנחת. */
for (let i = 0; i < FAN_N; i++) {
  await run("fan", i);
  await wait(260);
  await run("club", i);
  if (i === 0) {
    await wait(1250); await run("cap", "כל לילה, בחצות.");
    await wait(2000); await run("cap", "");
    await wait(200);
  } else await wait(2450);
  await run("clubOff");
}

/* 3 · חמישה מועדונים, חמש חידות. הכיתוב יושב 3 שניות, כי
   בגרסה הראשונה הוא עבר מהר מדי מכדי להיקרא. */
await run("fansOff"); await run("grid", true);
await wait(800); await run("cap", "חמישה מועדונים. חמש חידות.");
await wait(3000); await run("cap", "");
await wait(300);

/* 4 · מה המשחק באמת */
await run("grid", false); await run("board", true);
await wait(450);
for (let i = 0; i < CLUES.length; i++) { await run("clue", i); await wait(560); }
await wait(400); await run("name_");
await wait(1700);

/* 5 · ההתכנסות אל הסמל, ואז החנות */
await run("board", false); await run("conv", true);
await wait(2700);
await run("conv", false); await run("store", true);
await wait(900); await run("cap", "עכשיו בגוגל פליי.", true);
await wait(3400);

await page.close(); await ctx.close(); await browser.close();

/* ---------- קידוד ---------- */
const raw = readdirSync(dir).find(f => f.endsWith(".webm"));
if (!raw) die("ההקלטה לא נוצרה");
const src = join(dir, raw);
const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
  "-of", "csv=p=0", src], { encoding: "utf8" });
if (probe.status !== 0) die("ffprobe נכשל");
if (!(parseFloat(probe.stdout.trim()) > 5)) die(`אורך לא תקין: ${probe.stdout.trim()}`);

const ff = spawnSync("ffmpeg", ["-y", "-v", "error",
  "-ss", "1.35", "-i", src,
  "-vf", "scale=1080:1920:flags=lanczos,eq=saturation=1.05:contrast=1.03,format=yuv420p",
  "-r", "30", "-c:v", "libx264", "-preset", "slow", "-crf", "19",
  "-movflags", "+faststart", "-an", OUT], { encoding: "utf8" });
if (ff.status !== 0) die("ffmpeg נכשל: " + (ff.stderr || "").slice(0, 400));

const out = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration,size",
  "-of", "csv=p=0", OUT], { encoding: "utf8" });
rmSync(dir, { recursive: true, force: true });
rmSync(page$, { force: true });
log(`  החידה: ${ANSWER} · ${CLUES.map(([k, v]) => `${k} ${v}`).join(" · ")}`);
log(`  נכתב ${OUT} · ${out.stdout.trim()}`);
