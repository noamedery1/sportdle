/* ============================================================
   clip-80s.mjs — 24 שניות, טרנד שנות ה-80, והבדיחה היא המוצר.

   node tools/clip-80s.mjs
   node tools/clip-80s.mjs --out=80s.mp4

   **הרעיון.** הטרנד שרץ עכשיו הוא "1980s AI photo": מעלים תמונה
   עכשווית ומקבלים דיוקן מ-1986. הוא שואל "איך הייתי נראה אז",
   כלומר מדמיין עבר. ספורטדל לא צריך לדמיין — המאגר באמת מגיע
   לשם, 42 שחקנים בבריכה עם עונה ראשונה בין 1980 ל-1990.

   לכן הקליפ לוקח את הדמות שכבר קיימת, מעביר **אותה** ל-1986,
   ומשאיר את הבדיחה לעשות את העבודה: היה לו הכול חוץ מהמשחק.
   שלושת הפריימים חולקים מסגרת, ולכן המעבר ביניהם הוא חיתוך
   התאמה — אותו אדם, אותו צעיף, ארבעים שנה, והפעם המסך נדלק.

   **הכול בדפדפן, כמו בשאר הקליפים.** ffmpeg מחזיר עברית הפוכה
   ב-drawtext, ולכן כל טקסט וכל אפקט הם CSS. מה שכן ב-ffmpeg הוא
   רק מה שאי אפשר בדפדפן: חיתוך ההתחלה הלבנה של recordVideo,
   ההגדלה ל-1080 והקידוד.

   **ואין כאן re-timing.** בניגוד ל-clip-clues, הדף הזה שלנו
   מתחילתו ועד סופו ואין בו המתנות לרשת — ההקלטה עצמה כבר בקצב
   הנכון, ולכן אין פיצול לקטעים ואין האצה. פחות חלקים, פחות
   מקומות להישבר.

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

const OUT = args.out || "sportdle-80s.mp4";
const W = 900, H = 1600;          // הקלטה. ffmpeg מגדיל ל-1080×1920.
const DIR = "tools/assets/80s";

for (const f of ["char-1986-phone.jpg", "char-1986-shrug.jpg", "src/character-beitar.png"])
  if (!existsSync(join(DIR, f))) die(`חסר ${join(DIR, f)}`);

/* ---------- החידה, מהמאגר ולא מהראש ---------- */
const club = JSON.parse(readFileSync("data/clubs/beitar.json", "utf8"));
const ANSWER = "אלי אוחנה";
const p = club.players.find(x => x.he === ANSWER);
if (!p) die(`${ANSWER} אינו במאגר — אולי השם השתנה`);
if (!p.target) die(`${ANSWER} אינו בבריכת התשובות`);

const POS_HE = { GK: "שוער", DF: "הגנה", MF: "קישור", FW: "התקפה" };
const season = y => `${String(y - 1).slice(2)}/${String(y).slice(2)}`;
const CLUES = [
  ["עמדה",  POS_HE[p.pos]],
  ["לאום",  "ישראל"],
  ["עונה 1", season(p.spells[0][0])],
  ["תארים", String(p.titles)],
  ["נולד",  String(p.born)]
];
log(`  החידה: ${ANSWER} · ${CLUES.map(([k, v]) => `${k} ${v}`).join(" · ")}`);

const site = JSON.parse(readFileSync("config/site.json", "utf8"));
const HOST = String(site.siteUrl).replace(/^https?:\/\//, "").replace(/\/$/, "");

/* ---------- הדף ---------- */
const b64 = f => readFileSync(join(DIR, f)).toString("base64");
const IMG = {
  a: `data:image/jpeg;base64,${b64("char-1986-phone.jpg")}`,
  b: `data:image/jpeg;base64,${b64("char-1986-shrug.jpg")}`,
  c: `data:image/png;base64,${b64("src/character-beitar.png")}`,
  grid: `data:image/jpeg;base64,${b64("grid.jpg")}`
};
const FONT = pathToFileURL(resolve("src/static/fonts/heebo-400-hebrew.woff2")).href;

const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<style>
@font-face{font-family:Heebo;src:url("${FONT}") format("woff2");font-weight:400 900;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#000;
  font-family:Heebo,system-ui,sans-serif;color:#fff}
#stage{position:relative;width:100%;height:100%;overflow:hidden}

/* ---------- שכבות התמונה ---------- */
.shot{position:absolute;inset:0;opacity:0;background-size:cover;background-position:center;
  transform:scale(1.06);transition:opacity .18s linear}
.shot.on{opacity:1}
.shot.push{animation:push 7s linear forwards}
@keyframes push{from{transform:scale(1.02)}to{transform:scale(1.14)}}

/* ---------- VHS ---------- */
#vhs{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .2s}
#vhs.on{opacity:1}
#vhs::before{content:"";position:absolute;inset:0;
  background:repeating-linear-gradient(to bottom,rgba(0,0,0,.28) 0 2px,transparent 2px 4px)}
#vhs::after{content:"";position:absolute;left:0;right:0;height:120px;
  background:linear-gradient(to bottom,transparent,rgba(255,255,255,.10),transparent);
  animation:track 3.1s linear infinite}
@keyframes track{from{top:-130px}to{top:${H}px}}
#grain{position:absolute;inset:-40%;opacity:0;pointer-events:none;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='.5'/></svg>");
  animation:jitter .09s steps(2) infinite;mix-blend-mode:overlay}
#grain.on{opacity:.5}
@keyframes jitter{0%{transform:translate(0,0)}100%{transform:translate(-6px,4px)}}
#flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
#flash.go{animation:fl .42s ease-out}
@keyframes fl{0%{opacity:.95}100%{opacity:0}}

/* ---------- כיתובים ---------- */
#cap{position:absolute;left:0;right:0;bottom:150px;text-align:center;padding:0 60px}
#cap b{display:inline-block;background:#000;color:#fff;font-weight:900;font-size:62px;
  line-height:1.25;padding:10px 26px;opacity:0;transform:translateY(18px)}
#cap b.on{animation:capin .34s cubic-bezier(.2,.9,.3,1.4) forwards}
#cap b.y{background:#f7d117;color:#111}
@keyframes capin{to{opacity:1;transform:translateY(0)}}

/* ---------- לוח הרמזים ----------
   רשת הניאון נשארת מתחת ללוח ומתחת לתשובה. בלעדיה שני הקטעים
   האלה הם שחור שטוח אחרי שתי תמונות עשירות, והקליפ מתפרק לשניים
   באמצע — בדיוק במקום שבו הצופה אמור להתחיל לשחק. */
#board{position:absolute;inset:0;opacity:0;
  background:#0b0b0c center/cover no-repeat;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px}
#board::before,#rev::before{content:"";position:absolute;inset:0;background:rgba(11,11,12,.74)}
#board>*,#rev>*{position:relative}
#board.on{opacity:1}
#board h2{font-size:46px;font-weight:900;color:#f7d117;letter-spacing:-1px}
#board .sub{font-size:30px;color:#9aa0a6;margin-top:-14px}
.row{display:flex;gap:12px;width:760px;justify-content:center;flex-wrap:wrap}
.cl{flex:0 0 232px;background:#17181b;border:3px solid #2a2c31;border-radius:18px;
  padding:20px 10px;text-align:center;opacity:0;transform:scale(.86)}
.cl.on{animation:pop .3s cubic-bezier(.2,.9,.3,1.5) forwards}
@keyframes pop{to{opacity:1;transform:scale(1)}}
.cl .k{font-size:26px;color:#9aa0a6}
.cl .v{font-size:46px;font-weight:900;margin-top:6px}
.cl.hot{border-color:#f7d117;box-shadow:0 0 0 6px rgba(247,209,23,.16)}
#count{font-size:150px;line-height:1;height:160px;font-weight:900;color:#f7d117;opacity:0}
#count.on{animation:cnt .82s ease-out forwards}
@keyframes cnt{0%{opacity:0;transform:scale(1.5)}25%{opacity:1;transform:scale(1)}
  100%{opacity:0;transform:scale(.82)}}

/* ---------- התשובה ---------- */
#rev{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:14px;opacity:0;background:#0b0b0c center/cover no-repeat}
#rev.on{opacity:1}
#rev .nm{font-size:96px;font-weight:900;color:#f7d117;animation:glitch .5s steps(2) 3}
#rev .mt{font-size:38px;color:#e8eaed}
#rev .tt{font-size:34px;color:#9aa0a6}
@keyframes glitch{0%{transform:translate(0);text-shadow:none}
  33%{transform:translate(-5px,2px);text-shadow:5px 0 #ff0044,-5px 0 #00e5ff}
  66%{transform:translate(4px,-2px);text-shadow:-4px 0 #ff0044,4px 0 #00e5ff}
  100%{transform:translate(0);text-shadow:none}}

/* ---------- סיום ---------- */
#cta{position:absolute;inset:0;opacity:0;background:#000 center/cover no-repeat;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px}
#cta.on{opacity:1}
#cta .lg{font-size:104px;font-weight:900;letter-spacing:-3px}
#cta .lg i{color:#f7d117;font-style:normal}
#cta .u{font-size:min(5.4vw,44px);font-weight:900;background:#f7d117;color:#111;
  padding:12px 30px;border-radius:14px;white-space:nowrap}
#cta .s{font-size:34px;color:#e8eaed}
</style></head><body><div id="stage">
  <div class="shot" id="sa" style="background-image:url('${IMG.a}')"></div>
  <div class="shot" id="sb" style="background-image:url('${IMG.b}')"></div>
  <div class="shot" id="sc" style="background-image:url('${IMG.c}')"></div>
  <div id="vhs"></div><div id="grain"></div><div id="flash"></div>
  <div id="cap"></div>

  <div id="board" style="background-image:url('${IMG.grid}')">
    <h2>מי השחקן?</h2><div class="sub">בית"ר ירושלים</div>
    <div class="row" id="r1"></div><div class="row" id="r2"></div>
    <div id="count"></div>
  </div>

  <div id="rev" style="background-image:url('${IMG.grid}')"><div class="nm">${ANSWER}</div>
    <div class="mt">${POS_HE[p.pos]} · ${p.spells.map(([a, b]) => `${season(a)}–${season(b)}`).join(", ")}</div>
    <div class="tt">${p.titles} תארים · אלופת 86/87</div></div>

  <div id="cta" style="background-image:url('${IMG.grid}')">
    <div class="lg">Sport<i>Dle</i></div>
    <div class="s">חידה חדשה כל יום בחצות</div>
    <div class="u">${HOST}</div>
  </div>
</div>
<script>
const $ = s => document.querySelector(s);
const CL = ${JSON.stringify(CLUES)};
const r1 = $("#r1"), r2 = $("#r2");
CL.forEach(([k, v], i) => {
  const d = document.createElement("div");
  d.className = "cl"; d.id = "c" + i;
  d.innerHTML = '<div class="k">' + k + '</div><div class="v">' + v + '</div>';
  (i < 3 ? r1 : r2).appendChild(d);
});
window.shot = n => { for (const s of ["sa","sb","sc"]) $("#"+s).classList.toggle("on", s === "s"+n); };
window.push = n => $("#s"+n).classList.add("push");
window.vhs  = on => { $("#vhs").classList.toggle("on", on); $("#grain").classList.toggle("on", on); };
window.flash = () => { const f = $("#flash"); f.classList.remove("go"); void f.offsetWidth; f.classList.add("go"); };
window.cap = (t, y) => { $("#cap").innerHTML = t ? '<b class="on' + (y ? " y" : "") + '">' + t + '</b>' : ""; };
window.board = on => $("#board").classList.toggle("on", on);
window.clue = i => { const e = $("#c"+i); e.classList.add("on"); if (i) $("#c"+(i-1)).classList.remove("hot"); e.classList.add("hot"); };
window.count = n => { const e = $("#count"); e.textContent = n; e.classList.remove("on"); void e.offsetWidth; e.classList.add("on"); };
window.rev = on => $("#rev").classList.toggle("on", on);
window.cta = on => $("#cta").classList.toggle("on", on);
</script></body></html>`;

const page$ = join(DIR, "_clip.html");
writeFileSync(page$, html, "utf8");

/* ---------- הקלטה ---------- */
const dir = mkdtempSync(join(tmpdir(), "clip80s-"));
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: "he-IL",
  recordVideo: { dir, size: { width: W, height: H } }
});
const page = await ctx.newPage();
await page.goto(pathToFileURL(resolve(page$)).href);
await page.waitForTimeout(900);          // גופן ותמונות

const wait = ms => page.waitForTimeout(ms);
const run = (fn, ...a) => page.evaluate(([f, args]) => window[f](...args), [fn, a]);

/* 1 · 1986 — היה לו הכול */
await run("vhs", true); await run("shot", "a"); await run("push", "a");
await wait(600); await run("cap", "1986. היה לו הכול.");
await wait(3200);

/* 2 · חוץ מהמשחק */
await run("shot", "b"); await run("cap", "");
await wait(500); await run("cap", "חוץ מהמשחק.");
await wait(2600);

/* 3 · חיתוך התאמה להיום */
await run("cap", ""); await run("flash"); await wait(120);
await run("vhs", false); await run("shot", "c"); await run("push", "c");
await wait(420); await run("cap", "היום כן.", true);
await wait(2400);

/* 4 · הלוח */
await run("cap", ""); await run("board", true);
await wait(420);
for (let i = 0; i < CLUES.length; i++) { await run("clue", i); await wait(1050); }
await wait(500);

/* 5 · ספירה */
for (const n of ["3", "2", "1"]) { await run("count", n); await wait(820); }

/* 6 · התשובה */
await run("board", false); await run("rev", true);
await wait(3200);

/* 7 · סיום */
await run("rev", false); await run("cta", true);
await wait(3300);

await page.close(); await ctx.close(); await browser.close();

/* ---------- קידוד ---------- */
const raw = readdirSync(dir).find(f => f.endsWith(".webm"));
if (!raw) die("ההקלטה לא נוצרה");
const src = join(dir, raw);

const probe = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
  "-of", "csv=p=0", src], { encoding: "utf8" });
if (probe.status !== 0) die("ffprobe נכשל");
const dur = parseFloat(probe.stdout.trim());
if (!(dur > 5)) die(`אורך הקלטה לא תקין: ${probe.stdout.trim()}`);

/* הפריים הראשון של recordVideo לבן — חותכים את ההתחלה */
const CUT = 0.8;
const ff = spawnSync("ffmpeg", ["-y", "-v", "error",
  "-ss", String(CUT), "-i", src,
  "-vf", `scale=1080:1920:flags=lanczos,eq=saturation=1.06:contrast=1.04,format=yuv420p`,
  "-r", "30", "-c:v", "libx264", "-preset", "slow", "-crf", "19",
  "-movflags", "+faststart", "-an", OUT], { encoding: "utf8" });
if (ff.status !== 0) die("ffmpeg נכשל: " + (ff.stderr || "").slice(0, 400));

const out = spawnSync("ffprobe", ["-v", "error", "-show_entries",
  "format=duration,size", "-of", "csv=p=0", OUT], { encoding: "utf8" });
rmSync(dir, { recursive: true, force: true });
rmSync(page$, { force: true });
log(`  נכתב ${OUT} · ${out.stdout.trim()}`);
