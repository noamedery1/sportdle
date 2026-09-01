/* ============================================================
   appicons.mjs — נכסי האפליקציה: אייקונים ומסך פתיחה.

   node tools/appicons.mjs
   ואחריו:  npx @capacitor/assets generate --android

   Capacitor מגיע עם אייקון ברירת מחדל משלו. אפליקציה שמגיעה
   לביקורת עם האייקון הזה נראית לא גמורה, וזה בדיוק סוג הדבר
   שמזמין דחייה.

   העיצוב הוא אותו עיצוב של האייקון הקיים באתר — חמש רצועות
   אלכסוניות בצבעי המותג של חמשת המועדונים על רקע דיו. הצבעים
   נקראים מ-config/clubs.json ולא מקודדים כאן: מועדון שיתווסף
   ישנה את האייקון מעצמו.

   נוצר ב-HTML ולא מקובץ קיים: icon-512 הוא 512 פיקסלים,
   וחנויות דורשות 1024. הגדלה הייתה מטשטשת את הקצוות
   האלכסוניים — ורצועה מטושטשת נראית זול.
   ============================================================ */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { loadClubs, log } from "../scripts/lib/util.mjs";

const OUT = "assets";
mkdirSync(OUT, { recursive: true });
mkdirSync("android/app/src/main/res/drawable", { recursive: true });

const INK = "#0C0C0E";
const cols = loadClubs().map(c => c.colors.brand);
if (cols.length < 2) throw new Error("אין מספיק צבעי מועדון");

/* ---------- הרצועות ----------
   גרדיאנט אחד עם עצירות קשות, ולא חמישה div מסובבים. הניסיון עם
   skew יצא פזור: שתי רצועות נדחקו לקצה ואחת יצאה מהפריים לגמרי.
   בגרדיאנט המיקום מחושב באחוזים ולכן הוא מדויק בכל מידה — וזה
   גם אותו ניב שכבר בשימוש בכרטיסי ה-og ובחגורות שבמשחק.

   gapCol הוא צבע המרווח: דיו באייקון, שקוף באייקון ההתראה. */
function stripes({ bleed = 1, alpha = 1, gapCol = INK, colors = cols }) {
  const n = colors.length;
  const band = 8;                                  // רוחב רצועה, באחוזים
  const gap = 8;                                   // מרווח
  const span = n * band + (n - 1) * gap;
  const start = (100 - span) / 2;                  // ממורכז
  const stops = [`${gapCol} 0 ${start}%`];
  colors.forEach((c, i) => {
    const a = start + i * (band + gap);
    stops.push(`${c} ${a}% ${a + band}%`);
    stops.push(`${gapCol} ${a + band}% ${a + band + gap}%`);
  });
  stops.push(`${gapCol} ${start + span}% 100%`);
  return `<div style="position:absolute;inset:0;opacity:${alpha};
    transform:scale(${bleed});
    background:linear-gradient(115deg,${stops.join(",")})"></div>`;
}

const page$ = (size, inner, bg = "transparent") => `<!doctype html><html><head>
<meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${size}px;height:${size}px;overflow:hidden;background:${bg}}
  .st{position:relative;width:${size}px;height:${size}px;overflow:hidden}
</style></head><body><div class="st">${inner}</div></body></html>`;

const browser = await chromium.launch({ headless: true });

async function shot(file, size, html, transparent = false) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1
  });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: `${file}`, omitBackground: transparent });
  await page.close();
  log(`  ${file}  ${size}×${size}`);
}

/* ---------- 1. האייקון הראשי, 1024 ----------
   מלבן מלא. העיגול והפינות המעוגלות נעשים על ידי המערכת, ולכן
   אין לצייר אותם כאן — אחרת מקבלים פינה בתוך פינה. */
await shot(`${OUT}/icon.png`, 1024,
  page$(1024, stripes({}), INK));

/* ---------- 2. אייקון אדפטיבי לאנדרואיד ----------
   שתי שכבות. המסכה של המשגר חותכת את השוליים, וזו הסיבה שהחוק
   הוא "תוכן חשוב בתוך 66% המרכזיים". דגם של רצועות הוא היוצא
   מן הכלל: רצועה חתוכה היא עוד רצועה, ולכן מותר מלוא הפריים —
   וזה גם נראה טוב יותר מדגם מרחף עם שוליים. */
await shot(`${OUT}/icon-background.png`, 1024,
  page$(1024, "", INK));
await shot(`${OUT}/icon-foreground.png`, 1024,
  page$(1024, stripes({ bleed: 1.35, gapCol: "transparent" })), true);

/* ---------- 3. מסך פתיחה ----------
   2732 מרובע — @capacitor/assets חותך ממנו לכל יחס מסך, ולכן
   כל מה שחייב להיראות יושב במרכז. הרצועות עמומות בכוונה: מסך
   פתיחה רועש נראה כמו פרסומת, ומטרתו רק לכסות את הרגע שלפני
   שהגופנים נטענו. */
const splash = `${stripes({ bleed: 1.1, alpha: 0.14 })}
  <div style="position:absolute;inset:0;display:flex;align-items:center;
    justify-content:center;font-family:Georgia,serif;font-size:210px;
    font-weight:700;color:#F2F2F0;letter-spacing:-6px">
    Sport<span style="color:${cols[0]}">Dle</span></div>`;
await shot(`${OUT}/splash.png`, 2732, page$(2732, splash, INK));
await shot(`${OUT}/splash-dark.png`, 2732, page$(2732, splash, INK));

/* ---------- 4. אייקון ההתראה ----------
   אנדרואיד צובע אותו בלבן ומתעלם מכל צבע אחר, ולכן הוא נוצר
   כצללית לבנה על שקוף. אייקון צבעוני כאן מופיע כריבוע לבן אטום
   בשורת ההתראות — תקלה שנראית כמו באג ולא כמו עיצוב.
   נכתב ישירות ל-drawable; @capacitor/assets אינו מייצר אותו. */
const NOTIF = "android/app/src/main/res/drawable/ic_stat_sportdle.png";
await shot(NOTIF, 96, page$(96, stripes({
  bleed: 1.3, gapCol: "transparent", colors: cols.map(() => "#FFFFFF")
})), true);

await browser.close();
log("סיום. הרץ:  npx @capacitor/assets generate --android");
