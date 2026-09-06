/* ============================================================
   clip-numbers.mjs — 30 שניות: משחק המספרים החדש בקרב חברים.

   node tools/clip-numbers.mjs
   node tools/clip-numbers.mjs --club=maccabi-haifa --out=numbers.mp4
   node tools/clip-numbers.mjs --base=http://localhost:4173

   ---------- מה הקליפ הזה מוכר ----------
   לא "יש משחק חדש" אלא **המנגנון שלו**: שאלה שאף אחד לא יודע,
   שני אנשים שיורים מספר, ומי שקרוב יותר לוקח. זה מובן בשלוש
   שניות בלי הסבר, וזה מה שגורם לצופה לרצות לפתוח חדר.

   הרגע שעוצר אגודל הוא בשנייה ~14: השאלה על המסך, טיימר רץ,
   וכיתוב "מה **אתה** עונה?". הצופה עונה בראש — ומרגע שהוא ענה
   הוא חייב לראות אם צדק. זה אותו לופ פתוח של clip-clues.mjs,
   רק שכאן הוא זול יותר: אין צורך להכיר שחקן, מספיק להעריך.

   ---------- למה שני דפדפנים ואמיתי ----------
   מסך אחד עם שני שמות בטבלה נראה מבוים. כאן באמת נפתח חדר,
   באמת מצטרף שני, ושניהם באמת עונים — הניקוד שרץ בטבלה הוא
   מה שפיירבייס החזיר. מוקלט רק המארח; החבר משחק מחוץ לפריים.

   ---------- האפקטים ב-CSS ולא ב-ffmpeg ----------
   drawtext של ffmpeg מצייר עברית בסדר לוגי ומחזיר טקסט הפוך,
   ו-@keyframes נותן פופים וזוהר מדויקים לפריים. ffmpeg עושה רק
   את מה שהוא טוב בו: קצב, מסגרת טלפון וקידוד.

   ---------- אין כאן ספוילר ----------
   השאלות אינן החידה היומית אלא בנק שנגזר מהמאגר, ולכן קליפ
   כזה אינו מקלקל דבר לאיש — בניגוד ל-clip.mjs שחייב ארכיון.

   דורש ffmpeg ב-PATH.
   ============================================================ */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readJSON, loadClubs, parseArgs, log, warn, die } from "../scripts/lib/util.mjs";

const args  = parseArgs();
const OUT   = args.out || "clip-numbers.mp4";
const FRAME = "tools/assets/phone-frame.png";
if (!existsSync(FRAME)) die(`חסר ${FRAME}`);

const site  = readJSON("config/site.json");
const base  = args.base || String(site.siteUrl).replace(/\/$/, "");
const clubs = loadClubs();
const club  = args.club ? clubs.find(c => c.slug === args.club) || die("מועדון לא מוכר")
                        : clubs.find(c => c.slug === "beitar") || clubs[0];
const BR = club.colors.brand;

/* ============================================================
   שכבת האפקטים
   ============================================================ */
const CSS = `
html{zoom:2}

/* ---------- כיתוב תחתון ---------- */
#tkcap{position:fixed;left:0;right:0;bottom:52px;z-index:99998;display:flex;
  justify-content:center;pointer-events:none;padding:0 12px}
#tkcap span{background:rgba(0,0,0,.9);color:#fff;font-weight:800;font-size:20px;
  line-height:1.35;padding:10px 16px;border-radius:12px;text-align:center;
  font-family:'Segoe UI',Arial,sans-serif;box-shadow:0 6px 26px rgba(0,0,0,.65);
  animation:fxPop .34s cubic-bezier(.2,1.5,.4,1) both}
#tkcap span b{color:${BR}}
@keyframes fxPop{0%{transform:scale(.74) translateY(10px);opacity:0}
                 100%{transform:scale(1) translateY(0);opacity:1}}

/* ---------- באנר "חדש" ---------- */
/* הצללה מאחורי הוו: בלעדיה "משחק חדש" נקרא על גבי הטופס ושורת
   המשנה מתנגשת בכפתור. בשנייה הראשונה הבאנר חייב להיות הדבר
   היחיד שרואים. */
#tknew{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;
  justify-content:center;pointer-events:none;flex-direction:column;gap:16px;
  background:rgba(6,6,8,.74)}
#tknew .burst{position:absolute;width:150vmax;height:150vmax;border-radius:50%;
  background:radial-gradient(circle,${BR}55 0%,transparent 62%);
  animation:fxRing .85s ease-out both}
@keyframes fxRing{0%{opacity:1;transform:scale(.05)}100%{opacity:0;transform:scale(1)}}
#tknew .t1{font-family:'Segoe UI',Arial,sans-serif;font-weight:900;font-size:74px;
  color:${BR};text-shadow:0 6px 34px rgba(0,0,0,.8);letter-spacing:-2px;
  animation:fxSlam .5s cubic-bezier(.2,1.7,.35,1) both}
#tknew .t2{font-family:'Segoe UI',Arial,sans-serif;font-weight:800;font-size:30px;
  color:#fff;text-shadow:0 4px 20px rgba(0,0,0,.9);
  animation:fxSlam .5s .16s cubic-bezier(.2,1.7,.35,1) both}
@keyframes fxSlam{0%{transform:scale(2.4) rotate(-7deg);opacity:0}
                  100%{transform:scale(1) rotate(0);opacity:1}}

/* ---------- זרקור על השאלה ---------- */
.tkspot{position:relative;z-index:60!important;
  animation:fxBeat 1.05s ease-in-out infinite;
  box-shadow:0 0 0 4px ${BR}, 0 0 60px 14px ${BR}66 !important}
@keyframes fxBeat{0%,100%{transform:scale(1)}50%{transform:scale(1.035)}}

/* ---------- "מה אתה עונה?" ---------- */
#tkask{position:fixed;left:0;right:0;top:16%;z-index:99999;text-align:center;
  pointer-events:none;font-family:'Segoe UI',Arial,sans-serif;font-weight:900;
  font-size:44px;color:#fff;text-shadow:0 5px 26px rgba(0,0,0,.9);
  animation:fxPunch .7s ease-in-out infinite}
#tkask b{color:${BR}}
@keyframes fxPunch{0%,100%{transform:scale(1)}45%{transform:scale(1.07)}}

/* ---------- ספירה לאחור ---------- */
#tkcd{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;
  justify-content:center;pointer-events:none;font-family:'Segoe UI',Arial,sans-serif;
  font-weight:900;font-size:150px;color:#fff;text-shadow:0 8px 40px rgba(0,0,0,.95);
  animation:fxTick .5s ease-out both}
@keyframes fxTick{0%{transform:scale(2.1);opacity:0}45%{opacity:1}100%{transform:scale(1);opacity:.16}}

/* ---------- הבזק בחשיפה ---------- */
#tkflash{position:fixed;inset:0;z-index:99997;background:${BR};pointer-events:none;
  animation:fxBlink .42s ease-out both}
@keyframes fxBlink{0%{opacity:0}20%{opacity:.55}100%{opacity:0}}

/* ---------- רעידה ---------- */
.tkshake{animation:fxShake .42s both}
@keyframes fxShake{
  0%{transform:translate(0,0)}   22%{transform:translate(-9px,4px)}
  46%{transform:translate(8px,-4px)} 70%{transform:translate(-5px,2px)}
  100%{transform:translate(0,0)}}

/* ---------- קרדיט סוגר ---------- */
#tkend{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:16px;pointer-events:none;
  background:rgba(8,8,10,.9);font-family:'Segoe UI',Arial,sans-serif;
  animation:fxPop .4s ease-out both}
#tkend .a{font-weight:900;font-size:38px;color:#fff}
#tkend .b{font-weight:900;font-size:44px;color:${BR};letter-spacing:-1px}
#tkend .c{font-weight:700;font-size:24px;color:#cfcfd6}
`;

/* ============================================================
   עזרים בדף
   ============================================================ */
const dir = mkdtempSync(join(tmpdir(), "sportdle-numbers-"));
const browser = await chromium.launch({ headless: true });

const mkCtx = (record) => browser.newContext({
  viewport: { width: 900, height: 1640 },
  deviceScaleFactor: 1,
  locale: "he-IL",
  ...(record ? { recordVideo: { dir, size: { width: 900, height: 1640 } } } : {})
});

const host = await mkCtx(true);
/* ההקלטה מתחילה עם יצירת ההקשר, ומכאן ועד שהדף נטען ונכנסים
   ללשונית הקרב עוברות כעשר שניות של מסך ריק. בטיקטוק שתי
   השניות הראשונות מכריעות, ולכן נמדד כאן אפס־זמן, והחיתוך
   ב-ffmpeg נגזר מהרגע שבו הוו באמת עלה — ולא ממספר קבוע
   שמשתנה עם מהירות הרשת. */
const REC0 = Date.now();
const mate = await mkCtx(false);
for (const c of [host, mate]) {
  await c.addInitScript(([slug]) => {
    try {
      localStorage.setItem("sportdel:club", slug);
      localStorage.setItem("sportdel:seen", "1");
    } catch (e) {}
  }, [club.slug]);
}
const A = await host.newPage();     // מצולם
const B = await mate.newPage();     // החבר, מחוץ לפריים

const cap = (t) => A.evaluate((txt) => {
  let el = document.getElementById("tkcap");
  if (!el) { el = document.createElement("div"); el.id = "tkcap"; document.body.appendChild(el); }
  el.innerHTML = txt ? `<span>${txt}</span>` : "";
}, t);

const fx = (name, html) => A.evaluate(([id, inner]) => {
  const old = document.getElementById(id); if (old) old.remove();
  if (!inner) return;
  const d = document.createElement("div"); d.id = id; d.innerHTML = inner;
  document.body.appendChild(d);
}, [name, html]);

const shake = () => A.evaluate(() => {
  const w = document.querySelector(".wrap") || document.body;
  w.classList.remove("tkshake"); void w.offsetWidth; w.classList.add("tkshake");
});

const spot = (sel, on) => A.evaluate(([s, v]) => {
  const el = document.querySelector(s); if (!el) return;
  el.classList.toggle("tkspot", v);
}, [sel, on]);

/* לחיצה דרך ה-DOM: CSS zoom מזיז את מפת הפגיעה של הדפדפן. */
const jsClick = (p, sel) => p.evaluate((s) => {
  const el = document.querySelector(s); if (el) el.click();
}, sel);

const clickUntil = async (p, sel, target, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    await jsClick(p, sel);
    try { await p.waitForSelector(target, { state: "visible", timeout: 9000 }); return true; }
    catch (e) { warn(`${sel}: ניסיון ${i + 1} לא הצליח`); }
  }
  return false;
};

const openVersus = async (p, name) => {
  await p.goto(`${base}/`, { waitUntil: "networkidle" });
  await p.addStyleTag({ content: CSS });
  await jsClick(p, '[data-tab="versus"]');
  await p.waitForSelector("#scHome", { state: "visible", timeout: 20000 });
  /* פיירבייס נטען רק בכניסה ללשונית, וכפתור הפתיחה אינו מחובר
     עד שהוא מסיים. לחיצה מוקדמת לא נכשלת — היא פשוט לא עושה כלום. */
  await p.waitForTimeout(2800);
  await p.fill("#vName", name);
};

/* ============================================================
   התסריט
   ============================================================ */
await openVersus(A, "נועם");

/* ---------- החבר נטען במקביל ----------
   טעינת הדף שלו לוקחת שמונה שניות, והן היו נספרות בתוך הקליפ
   כשלוש שניות של מסך מחכה. הבטחה שנפתחת כאן ומחכים לה רק
   כשצריך — הטעינה מתרחשת מאחורי הקלעים בזמן שהמארח על המסך. */
const mateReady = openVersus(B, "דני").catch(e => { warn("החבר לא נטען: " + e.message); });

/* 0–2 — הוו */
const HOOK_AT = (Date.now() - REC0) / 1000;
log(`  הוו בשנייה ${HOOK_AT.toFixed(1)} של ההקלטה`);
await fx("tknew",
  `<div class="burst"></div><div class="t1">משחק חדש</div>` +
  `<div class="t2">בקרב חברים של ${club.game}</div>`);
await A.waitForTimeout(2200);
await fx("tknew", "");

/* 2.4–6 — בוחרים "מספרים" */
await cap("בפתיחת חדר בוחרים <b>איזה משחק</b>");
await spot("#modePick", true);
await A.waitForTimeout(1500);
await jsClick(A, '#modePick [data-mode="quiz"]');
await shake();
await A.waitForTimeout(1600);
await spot("#modePick", false);

const hint = (await A.textContent("#modeHint").catch(() => "")) || "";
log(`  ${hint.trim()}`);
await cap(`<b>${(hint.match(/[\d,]+/) || ["2,400"])[0]} שאלות</b> · הכי קרוב זוכה`);
await A.waitForTimeout(1900);

/* 6–9 — חדר וקוד */
await cap("");
if (!await clickUntil(A, "#btnCreate", "#scLobby")) die("החדר לא נפתח");
const code = (await A.textContent("#lobbyCode")).trim();
log(`  חדר ${code}`);
await cap("פותחים חדר ומקבלים <b>קוד</b>");
await A.waitForTimeout(2100);

/* החבר מצטרף — מחוץ לפריים. הדף שלו כבר נטען במקביל. */
await mateReady;
await jsClick(B, '#modePick [data-mode="quiz"]').catch(() => {});
await B.fill("#joinCode", code);
if (!await clickUntil(B, "#btnJoin", "#scLobby")) die("החבר לא הצטרף");
await cap("שולחים אותו לחברים — והם בפנים");
await A.waitForTimeout(2300);

/* 9 — מתחילים */
await cap("");
await A.selectOption("#setRounds", "5").catch(() => {});
if (!await clickUntil(A, "#btnStart", "#scPlay")) die("המשחק לא התחיל");
await A.waitForTimeout(900);

const q = (await A.textContent("#qText").catch(() => "")) || "";
log(`  השאלה: ${q.trim()}`);

/* 10–15 — הלופ הפתוח: הצופה עונה בראש */
await spot("#qText", true);
await fx("tkask", "מה <b>אתה</b> עונה?");
await A.waitForTimeout(3400);
await fx("tkask", "");
await spot("#qText", false);

/* ---------- התשובות חייבות להתאים לסולם השאלה ----------
   קודם הן היו קבועות — "6" ו-"11". על "כמה עונות" זה סביר, אבל
   הגרלה נתנה "באיזו שנה נולד", והחשיפה הציגה "הפרש 1987" מול
   "הפרש 1982". זה לא נראה כמו שני אנשים שמעריכים אלא כמו משחק
   שבור, ובקליפ שיווקי זה גרוע פי כמה מקליפ משעמם.

   התשובה האמיתית נלקחת מהבנק לפי טקסט השאלה — אותו מחולל שרץ
   בדף, ולכן אין כאן ידע חיצוני. משם נגזרות שתי הערכות סבירות:
   קרובה ורחוקה יותר. מי שמצולם קרוב יותר, וזה גם הסיפור הנכון. */
const truth = await A.evaluate(() => {
  const q = (document.querySelector("#qText") || {}).textContent || "";
  const S = window.SPORTDEL;
  if (!S || typeof S.buildQuiz !== "function") return null;
  const hit = S.buildQuiz(S.order).find(x => x.q === q.trim());
  return hit ? hit.a : null;
});
/* ---------- הסטייה לפי סוג המספר, לא לפי גודלו ----------
   סטייה יחסית נכשלה: שני אחוזים מ-1997 הם ארבעים שנה, והחשיפה
   הציגה "נועם 2037" מול "דני 1877". שנה ומספר עונות הם שני
   סולמות שונים לגמרי, ומה שקובע הוא כמה **אדם** מפספס:
   בשנה טועים בשנתיים-שש, ובספירה טועים באחד-ארבעה. */
const isYear = truth != null && Math.abs(truth) >= 1900;
const near = isYear ? 2 : 1;
const far  = isYear ? 6 : 4;
const mine  = truth == null ? 6  : truth + near;
const yours = truth == null ? 11 : truth - far;
log(`  התשובה ${truth} · נועם ${mine} · דני ${yours}`);

await cap("כל אחד עונה <b>מספר</b>");
await A.evaluate(() => document.querySelector("#answer").focus({ preventScroll: true }));
await A.keyboard.type(String(mine), { delay: 200 });
await A.waitForTimeout(700);
await A.keyboard.press("Enter");
await A.waitForTimeout(1500);

await B.evaluate((v) => {
  const i = document.querySelector("#answer");
  i.value = String(v);
  i.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
}, yours);
await cap("ומחכים לשאר");
await A.waitForTimeout(2200);

/* ---------- ההמתנה היא התוכן ----------
   הסיבוב נסגר רק כשהטיימר של החדר נגמר, וזה זמן אמיתי שאי אפשר
   לקצר בלי לזייף. במקום להמתין מול מסך סטטי, **הטיימר של המשחק
   עצמו מוגדל לכל הפריים**: הספירה שנראית היא המספר שהחדר מציג,
   והמתח שהיא בונה אמיתי גם הוא.

   הלולאה יוצאת ברגע שהחשיפה עולה, ולכן היא מתאימה את עצמה לזמן
   שנשאר בפועל ולא לזמן משוער. */
await cap("");
for (let i = 0; i < 44; i++) {
  const st = await A.evaluate(() => ({
    rev: !document.querySelector("#scReveal").classList.contains("hide"),
    left: (document.querySelector("#rTime") || {}).textContent || ""
  })).catch(() => ({ rev: true, left: "" }));
  if (st.rev) break;
  const n = parseInt(st.left, 10);
  await fx("tkcd", Number.isFinite(n) && n <= 9 ? String(n) : "");
  await A.waitForTimeout(650);
}
await fx("tkcd", "");

/* החשיפה */
await A.waitForSelector("#scReveal", { state: "visible", timeout: 30000 }).catch(() => {});
await fx("tkflash", " ");
await shake();
await A.waitForTimeout(500);
await fx("tkflash", "");
await cap("<b>הכי קרוב לוקח את הנקודה</b>");
await A.waitForTimeout(3600);

/* 26–30 — סוגרים */
await cap("");
await fx("tkend",
  `<div class="a">משחק חדש בקרב חברים</div>` +
  `<div class="b">${base.replace(/^https?:\/\//, "")}</div>` +
  `<div class="c">פותחים חדר · שולחים קוד · משחקים</div>`);
await A.waitForTimeout(3000);

await A.close();
await host.close();
await mate.close();
await browser.close();

/* ---------- הרכבה ----------
   setpts=PTS/1.4 — האצה אמיתית ולא קוסמטית. הקצב של פיירבייס
   הוא זמן אמת: טעינת דף, המתנה להצטרפות, וסיבוב בן 25 שניות
   שאי אפשר לקצר בלי לזייף. בלי ההאצה הקליפ יוצא דקה שלמה, וזה
   כפול ממה שאגודל נותן לסרטון שלא מכיר.

   נקודת החיתוך נמדדת ולא מנוחשת: HOOK_AT הוא הרגע שבו הוו עלה
   בפועל, פחות שנייה ושליש: ההקלטה מתחילה מעט אחרי יצירת ההקשר, ומרווח
   קטן מדי חתך את הוו עצמו. */
const raw = readdirSync(dir).find(f => f.endsWith(".webm"));
if (!raw) die("ההקלטה לא נוצרה");
const SS = Math.max(0, HOOK_AT - 0.95).toFixed(2);
log(`  חיתוך מ-${SS} שניות`);
const ff = spawnSync("ffmpeg", [
  "-y", "-v", "error",
  "-ss", SS, "-i", join(dir, raw),
  "-i", FRAME,
  "-f", "lavfi", "-t", "60", "-i", "anullsrc=r=44100:cl=stereo",
  "-filter_complex",
  "[0:v]setpts=PTS/1.4,fps=30,scale=900:1640:flags=lanczos," +
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
