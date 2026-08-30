/* ============================================================
   clip-versus.mjs — קליפ של קרב חברים.

   node tools/clip-versus.mjs [--club=beitar] [--out=versus.mp4]

   הקרב הוא המנגנון הוויראלי של המשחק: אחד פותח חדר, שלושה
   מצטרפים. קליפ שלו צריך להראות בדיוק את זה, ולכן הוא מוקלט
   משני דפדפנים בו־זמנית — אחד מארח ומצולם, אחד חבר שמצטרף
   ומשחק ברקע. מה שנראה בפריים הוא מסך אחד אמיתי, עם שם של
   מישהו אחר שמופיע בלובי ועם ניקוד שרץ בטבלה.

   התשובה לא ידועה לסקריפט מראש — היא נגזרת מהרמזים שנחשפו על
   המסך, בדיוק כמו ששחקן היה עושה: עמדה, שנת לידה ועונה ראשונה
   מצמצמות לשחקן אחד. אם לא — מחכים לרמז הבא.

   דורש ffmpeg ב-PATH.
   ============================================================ */
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readJSON, loadClubs, parseArgs, log, warn, die } from "../scripts/lib/util.mjs";

const args = parseArgs();
const OUT = args.out || "versus.mp4";
const FRAME = "tools/assets/phone-frame.png";
if (!existsSync(FRAME)) die(`חסר ${FRAME}`);

const site = readJSON("config/site.json");
const base = String(site.siteUrl).replace(/\/$/, "");
const clubs = loadClubs();
const club = args.club ? clubs.find(c => c.slug === args.club) || die("מועדון לא מוכר")
                       : clubs.find(c => c.slug === "beitar") || clubs[0];

const CSS = `
html{zoom:2}
#tkcap{position:fixed;left:0;right:0;bottom:58px;z-index:99999;display:flex;
  justify-content:center;pointer-events:none;padding:0 14px}
#tkcap span{background:rgba(0,0,0,.88);color:#fff;font-weight:800;font-size:19px;
  line-height:1.3;padding:9px 14px;border-radius:11px;text-align:center;
  font-family:'Segoe UI',Arial,sans-serif;box-shadow:0 5px 22px rgba(0,0,0,.6)}
#tkcap span b{color:${club.colors.brand}}
`;

/* מוצא את השחקן שמתאים לרמזים שנחשפו. רץ בתוך הדף. */
const SOLVE = () => {
  const POS = { "שוער": "GK", "מגן": "DF", "קשר": "MF", "חלוץ": "FW" };
  const seen = {};
  for (const el of document.querySelectorAll("#clues > *")) {
    const t = el.innerText.replace(/\s+/g, " ").trim();
    for (const k of ["עמדה", "לאום", "עונה ראשונה", "תארים", "נולד", "השם מתחיל ב"]) {
      if (t.startsWith(k)) seen[k] = t.slice(k.length).trim();
    }
  }
  const players = (window.SPORTDEL && window.SPORTDEL.players) || [];
  const season = y => `${String(y - 1).slice(-2)}/${String(y).slice(-2)}`;
  const spanOf = p => (p.spells || []).reduce((n, [a, b]) => n + (b - a + 1), 0);
  const hits = players.filter(p => {
    if (!p.pos || !p.born || !p.spells || !p.spells.length) return false;
    if (spanOf(p) < 3) return false;
    if (seen["עמדה"] && POS[seen["עמדה"]] !== p.pos) return false;
    if (seen["נולד"] && String(p.born) !== seen["נולד"]) return false;
    if (seen["תארים"] && String(p.titles) !== seen["תארים"]) return false;
    if (seen["עונה ראשונה"] && season(p.spells[0][0]) !== seen["עונה ראשונה"]) return false;
    if (seen["השם מתחיל ב"] && p.he.trim()[0] !== seen["השם מתחיל ב"]) return false;
    return true;
  });
  return { n: Object.keys(seen).length, only: hits.length === 1 ? hits[0].he : null };
};

const dir = mkdtempSync(join(tmpdir(), "sportdle-versus-"));
const browser = await chromium.launch({ headless: true });

const mkCtx = (record) => browser.newContext({
  viewport: { width: 900, height: 1640 },
  deviceScaleFactor: 1,
  locale: "he-IL",
  ...(record ? { recordVideo: { dir, size: { width: 900, height: 1640 } } } : {})
});

const host = await mkCtx(true);
const mate = await mkCtx(false);
for (const c of [host, mate]) {
  await c.addInitScript(([slug]) => {
    try {
      localStorage.setItem("sportdel:club", slug);
      localStorage.setItem("sportdel:seen", "1");
    } catch (e) {}
  }, [club.slug]);
}
const A = await host.newPage();          // מצולם
const B = await mate.newPage();          // החבר

const cap = (t) => A.evaluate((txt) => {
  let el = document.getElementById("tkcap");
  if (!el) { el = document.createElement("div"); el.id = "tkcap"; document.body.appendChild(el); }
  el.innerHTML = txt ? `<span>${txt}</span>` : "";
}, t);

/* לחיצה דרך ה-DOM ולא דרך קואורדינטות. CSS zoom מזיז את מפת
   הפגיעה של הדפדפן, ולחיצה רגילה נוחתת ליד הכפתור. */
const jsClick = (p, sel) => p.evaluate((s) => document.querySelector(s).click(), sel);

const openVersus = async (p, name) => {
  await p.goto(`${base}/`, { waitUntil: "networkidle" });
  await p.addStyleTag({ content: CSS });
  await jsClick(p, '[data-tab="versus"]');
  await p.waitForSelector("#scHome", { state: "visible", timeout: 20000 });
  /* לשונית הקרב טוענת את ה-SDK של פיירבייס רק כשנכנסים אליה,
     וכפתור "פתיחת חדר חדש" לא מחובר עד שהוא מסיים. לחיצה מוקדמת
     לא נכשלת — היא פשוט לא עושה כלום, וזה מה שהפיל את הריצה. */
  await p.waitForTimeout(2600);
  await p.fill("#vName", name);
};

/* לוחצים עד שהמסך באמת מתחלף. שלוש פעמים, ואז מוותרים. */
const clickUntil = async (p, sel, target, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    await jsClick(p, sel);
    try {
      await p.waitForSelector(target, { state: "visible", timeout: 9000 });
      return true;
    } catch (e) { warn(`${sel}: ניסיון ${i + 1} לא הצליח`); }
  }
  return false;
};

await openVersus(A, "נועם");
await cap("<b>קרב חברים.</b> מי מזהה קודם.");
await A.waitForTimeout(1600);

await A.selectOption("#preReveal", "6");
if (!await clickUntil(A, "#btnCreate", "#scLobby")) die("החדר לא נפתח");
const code = (await A.textContent("#lobbyCode")).trim();
log(`  חדר ${code}`);
await cap("פותחים חדר — ומקבלים קוד");
await A.waitForTimeout(2200);

/* החבר מצטרף */
await openVersus(B, "דני");
await B.fill("#joinCode", code);
if (!await clickUntil(B, "#btnJoin", "#scLobby")) die("החבר לא הצטרף");
await cap("שולחים את הקוד — והם בפנים");
await A.waitForTimeout(2600);

await A.selectOption("#setRounds", "5");
await A.selectOption("#setReveal", "6");
await cap("");
if (!await clickUntil(A, "#btnStart", "#scPlay")) die("המשחק לא התחיל");
await cap("רמז נוסף כל שש שניות");
await A.waitForTimeout(6500);
await cap("");

/* פותרים מהרמזים שעל המסך */
let answer = null;
for (let i = 0; i < 6 && !answer; i++) {
  const r = await A.evaluate(SOLVE);
  if (r.only) { answer = r.only; break; }
  await A.waitForTimeout(3000);
}

if (answer) {
  log(`  התשובה: ${answer}`);
  await A.evaluate(() => document.querySelector("#answer").focus({ preventScroll: true }));
  const seed = answer.split(" ")[0];
  await A.keyboard.type(seed, { delay: 95 });
  await A.waitForTimeout(600);
  await A.keyboard.type(answer.slice(seed.length), { delay: 80 });
  await A.waitForTimeout(350);
  await A.keyboard.press("Enter");
  await A.waitForTimeout(1800);
  await cap("<b>מוקדם יותר = יותר נקודות</b>");
} else {
  warn("לא נמצאה תשובה יחידה — הסיבוב יסתיים מעצמו");
  await cap("<b>מוקדם יותר = יותר נקודות</b>");
}
await A.waitForTimeout(3200);

await cap("<b>" + base.replace(/^https?:\/\//, "") + "</b>");
await A.waitForTimeout(2400);

await A.close();
await host.close();
await mate.close();
await browser.close();

/* ---------- הרכבה ---------- */
const raw = readdirSync(dir).find(f => f.endsWith(".webm"));
if (!raw) die("ההקלטה לא נוצרה");
const ff = spawnSync("ffmpeg", [
  "-y", "-v", "error",
  "-ss", "1.1", "-i", join(dir, raw),
  "-i", FRAME,
  "-f", "lavfi", "-t", "60", "-i", "anullsrc=r=44100:cl=stereo",
  "-filter_complex",
  "[0:v]setpts=PTS/1.15,fps=30,scale=900:1640:flags=lanczos," +
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
