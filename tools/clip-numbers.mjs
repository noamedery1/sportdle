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
/* המותג הוא **SportDle** ולא שם המועדון. הקליפ מוכר את המשחק
   לכל חמשת המועדונים, וכותרת "ביתרdle" הייתה מצמצמת אותו
   לאוהדי מועדון אחד — וזה בדיוק מה שהוא לא. */
#tknew .t0{font-family:'Segoe UI',Arial,sans-serif;font-weight:900;font-size:34px;
  color:#fff;letter-spacing:1px;opacity:.92;
  animation:fxSlam .45s cubic-bezier(.2,1.7,.35,1) both}
#tknew .t1{font-family:'Segoe UI',Arial,sans-serif;font-weight:900;font-size:74px;
  color:${BR};text-shadow:0 6px 34px rgba(0,0,0,.8);letter-spacing:-2px;
  animation:fxSlam .5s .1s cubic-bezier(.2,1.7,.35,1) both}
#tknew .t2{font-family:'Segoe UI',Arial,sans-serif;font-weight:800;font-size:28px;
  color:#fff;text-shadow:0 4px 20px rgba(0,0,0,.9);text-align:center;
  animation:fxSlam .5s .22s cubic-bezier(.2,1.7,.35,1) both}
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

/* ---------- מיתוג ----------
   הכותרת בעמוד היא שם המועדון ("ביתרdle"), כי זה עמוד המועדון.
   אבל הקליפ מוכר את הקרב, שרץ כאן על שלושה מועדונים ומיועד
   לכל החמישה — וכותרת של מועדון אחד מצמצמת אותו לאוהדיו.

   לכן שם המוצר מונח מעל אזור הכותרת לכל אורך הקליפ. זו שכבת
   וידאו כמו הכיתובים ותג ה-VS, ואינה משנה דבר במשחק. */
#tkbrand{position:fixed;left:0;right:0;top:0;height:118px;z-index:99994;
  display:flex;align-items:center;justify-content:center;pointer-events:none;
  background:linear-gradient(180deg,#0C0C0E 62%,rgba(12,12,14,.94) 84%,transparent)}
#tkbrand span{font-family:'Segoe UI',Arial,sans-serif;font-weight:900;
  font-size:46px;letter-spacing:-1px;color:#F2F2F0}
#tkbrand span b{color:${BR}}

/* ---------- שני השחקנים ----------
   תג שמופיע ברגע שהסיבוב מתחיל. הוא אומר בלי מילים שיש כאן
   שני אנשים אמיתיים, וזה מה שמחליף את קטע השיתוף שהוסר. */
#tkvs{position:fixed;left:0;right:0;top:9%;z-index:99999;display:flex;
  align-items:center;justify-content:center;gap:14px;pointer-events:none;
  font-family:'Segoe UI',Arial,sans-serif;animation:fxPop .4s ease-out both}
#tkvs .p{background:rgba(0,0,0,.9);border:2px solid ${BR};color:#fff;
  font-weight:900;font-size:26px;padding:8px 18px;border-radius:24px}
#tkvs .v{color:${BR};font-weight:900;font-size:34px;
  animation:fxPunch .8s ease-in-out infinite}

/* ---------- קונפטי בחשיפה ---------- */
#tkconf{position:fixed;inset:0;z-index:99996;pointer-events:none;overflow:hidden}
#tkconf i{position:absolute;top:-8%;width:12px;height:20px;border-radius:2px;
  animation:fxFall 1.9s linear both}
@keyframes fxFall{0%{transform:translateY(0) rotate(0);opacity:1}
                  100%{transform:translateY(125vh) rotate(760deg);opacity:.15}}

/* ---------- סוויפ אור ---------- */
#tksw{position:fixed;inset:0;z-index:99995;pointer-events:none;overflow:hidden}
#tksw i{position:absolute;top:-30%;bottom:-30%;width:38%;
  background:linear-gradient(90deg,transparent,${BR}3a,transparent);
  transform:rotate(12deg) translateX(-160%);animation:fxSw 1s ease-out both}
@keyframes fxSw{to{transform:rotate(12deg) translateX(300%)}}

/* ---------- קרדיט סוגר ----------
   הכתובת נחתכה משני הצדדים: 44px על 22 תווים רחבים מהפריים.
   nowrap עם גודל שנגזר מרוחב הפריים, ועוד ריפוד — כדי שגם
   דומיין ארוך יותר לא ייצא החוצה. */
#tkend{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:18px;pointer-events:none;
  padding:0 26px;background:rgba(8,8,10,.985);
  font-family:'Segoe UI',Arial,sans-serif;animation:fxPop .4s ease-out both}
#tkend .a{font-weight:900;font-size:32px;color:#fff;text-align:center}
/* 23 תווים ב-32px הם 414px על מסך של 450 פחות ריפוד — האות
   האחרונה נחתכה. הגודל נגזר מרוחב הפריים ולא ממספר קבוע, כדי
   שגם דומיין ארוך יותר יישאר בפנים. */
#tkend .b{font-weight:900;font-size:min(5.4vw,25px);color:${BR};
  letter-spacing:0;white-space:nowrap;direction:ltr;
  border-top:2px solid ${BR}55;border-bottom:2px solid ${BR}55;padding:10px 0}
#tkend .c{font-weight:700;font-size:21px;color:#cfcfd6;text-align:center;
  line-height:1.5}
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

/* המיתוג עולה **לפני** נקודת החיתוך, אחרת חצי השנייה הראשונה
   של הקליפ מראה את שם המועדון — וזה בדיוק מה שהוא בא להחליף. */
await fx("tkbrand", `<span>Sport<b>Dle</b></span>`);
await A.waitForTimeout(250);

/* ---------- ההקמה כולה מתחת לכיסוי ----------
   פתיחת חדר, קוד, שיתוף והצטרפות — כל זה מנגנון ולא משחק. הוא
   לא משכנע אף אחד לשחק, והוא עלה עשר שניות בפריים. לכן הוו
   נשאר על המסך לכל אורך ההקמה, והוא יורד רק כשכבר יש שני
   שחקנים וסיבוב שרץ.

   זו עריכה ולא זיוף: החדר נפתח באמת, החבר מצטרף באמת, ומה
   שרואים אחרי שהכיסוי יורד הוא המצב האמיתי של המשחק. */
const HOOK_AT = (Date.now() - REC0) / 1000;
log(`  הוו בשנייה ${HOOK_AT.toFixed(1)} של ההקלטה`);
await fx("tknew",
  `<div class="burst"></div>` +
  `<div class="t0">SportDle</div>` +
  `<div class="t1">משחק חדש</div>` +
  `<div class="t2">דו-קרב מספרים · לכל חמשת המועדונים</div>`);

/* חדר על כמה מועדונים: כך השאלות אינן של מועדון אחד, וזה גם
   מה שהכיתוב מבטיח. */
for (const s of ["maccabi-ta", "maccabi-haifa"]) {
  await jsClick(A, `#clubPick [data-club="${s}"]`).catch(() => {});
  await A.waitForTimeout(120);
}
await jsClick(A, '#modePick [data-mode="quiz"]');
await A.waitForTimeout(400);
const hint = (await A.textContent("#modeHint").catch(() => "")) || "";
log(`  ${hint.trim()}`);

if (!await clickUntil(A, "#btnCreate", "#scLobby")) die("החדר לא נפתח");
const code = (await A.textContent("#lobbyCode")).trim();
log(`  חדר ${code}`);

await mateReady;
await B.fill("#joinCode", code);
if (!await clickUntil(B, "#btnJoin", "#scLobby")) die("החבר לא הצטרף");

await A.selectOption("#setRounds", "5").catch(() => {});
if (!await clickUntil(A, "#btnStart", "#scPlay")) die("המשחק לא התחיל");
await A.waitForTimeout(700);

/* הכיסוי יורד — ומהשנייה הראשונה רואים דו-קרב עם שני שחקנים */
await fx("tknew", "");
await fx("tksw", "<i></i>");
await fx("tkvs", `<span class="p">נועם</span><span class="v">VS</span><span class="p">דני</span>`);
await cap(`<b>${(hint.match(/[\d,]+/) || ["2,400"])[0]} שאלות</b> · הכי קרוב זוכה`);
await A.waitForTimeout(2100);
await fx("tksw", "");
await fx("tkvs", "");

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
/* בספירה נמוכה החיסור ירד ל-0 — "דני ענה 0 עונות" נראה כמו
   מישהו שלא ניסה, לא כמו הערכה. רצפה של 1, וכשאין מקום למטה
   הסטייה עולה כלפי מעלה. */
const mine  = truth == null ? 6  : truth + near;
const yours = truth == null ? 11
            : (isYear || truth - far >= 1) ? truth - far : truth + far;
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
/* קונפטי בצבעי המועדון — הרגע היחיד בקליפ שבו מישהו ניצח,
   וזה מה שהופך אותו לרגע ולא לשקופית. */
await fx("tkconf", Array.from({ length: 34 }, (_, i) => {
  const x = (i * 2.9 + (i % 5) * 3) % 100;
  const c = i % 3 === 0 ? "#fff" : BR;
  return `<i style="left:${x}%;background:${c};animation-delay:${(i % 9) * 55}ms"></i>`;
}).join(""));
await A.waitForTimeout(500);
await fx("tkflash", "");
await cap("<b>הכי קרוב לוקח את הנקודה</b>");
await A.waitForTimeout(2400);
await fx("tkconf", "");
await A.waitForTimeout(1000);

/* סוגרים */
await cap("");
await fx("tksw", "<i></i>");
await fx("tkend",
  `<div class="a">משחק חדש בקרב חברים</div>` +
  `<div class="b">${base.replace(/^https?:\/\//, "")}</div>` +
  `<div class="c">חמישה מועדונים · פותחים חדר · משחקים</div>`);
await A.waitForTimeout(2800);

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
const SS = Math.max(0, HOOK_AT - 0.5).toFixed(2);
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
