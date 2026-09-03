/* ============================================================
   appicons.mjs — נכסי האפליקציה: אייקונים ומסך פתיחה.

   node tools/appicons.mjs
   ואחריו:  npx @capacitor/assets generate --android

   Capacitor מגיע עם אייקון ברירת מחדל משלו. אפליקציה שמגיעה
   לביקורת עם האייקון הזה נראית לא גמורה, וזה בדיוק סוג הדבר
   שמזמין דחייה.

   ---------- העיצוב, ולמה הוא השתנה ----------
   העיצוב הראשון היה חמש רצועות אלכסוניות בצבעי חמשת המועדונים.
   **הבודקים התלוננו שלא רואים מספיק צהוב, והם צדקו:** הצהוב
   היה רצועה אחת מחמש בעלת משקל זהה, ולכן העין לא תפסה אותו.

   העיצוב הנוכחי — "קרני פיצוץ": כדור זהב במרכז, ומאחוריו
   קרניים בצבעי חמשת המועדונים. הצהוב הוא הצבע הראשי, השאר
   נספחים, ויש כדורגל שקורא בשנייה.

   נבחר מתוך שנים־עשר מועמדים (tools/icon-ideas.mjs ו-
   icon-ideas2.mjs) לפי מבחן אחד: **מה נשאר קריא ב-48 פיקסלים.**
   זה הגודל שבו אייקון נראה בפועל על מסך הבית, ורוב הרעיונות
   שנראים טוב ב-1024 מתפרקים שם. קרניים רדיאליות וכדור מלא
   שורדים; דגמים עדינים לא.

   הצבעים נקראים מ-config/clubs.json ולא מקודדים כאן: מועדון
   שיתווסף ישנה את האייקון מעצמו.

   נוצר ב-SVG ולא מקובץ קיים: icon-512 הוא 512 פיקסלים,
   וחנויות דורשות 1024. הגדלה הייתה מטשטשת את הקצוות.
   ============================================================ */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { loadClubs, log } from "../scripts/lib/util.mjs";

const OUT = "assets";
mkdirSync(OUT, { recursive: true });
mkdirSync("android/app/src/main/res/drawable", { recursive: true });
mkdirSync("store/upload", { recursive: true });

const INK = "#0C0C0E";
const cols = loadClubs().map(c => c.colors.brand);
if (cols.length < 2) throw new Error("אין מספיק צבעי מועדון");
const Y = cols[0];                                  // ביתר — הצבע הראשי

const deg = d => d * Math.PI / 180;

/* מחומש. הצורה שהופכת עיגול לכדורגל, וגם מה שמחזיק את הזיהוי
   בגודל קטן: כדור חלק נראה כמו נקודה. */
function pent(cx, cy, r, rot = 0) {
  const p = [];
  for (let i = 0; i < 5; i++) {
    const a = deg(rot + i * 72);
    p.push(`${(cx + r * Math.sin(a)).toFixed(1)},${(cy - r * Math.cos(a)).toFixed(1)}`);
  }
  return p.join(" ");
}

/* ---------- הקרניים ----------
   24 טריזים מהמרכז, מחזוריות של חמשת צבעי המועדונים. כל צבע
   חמישי מודגש, כדי שהצהוב יחזור בקצב ולא ייבלע.
   bleed>1 מרחיב מעבר לפריים: המסכה של המשגר חותכת את הפינות,
   וקרן חתוכה היא עוד קרן. */
function burst({ bleed = 1, alpha = 1 } = {}) {
  const n = 24, r = 80 * bleed;
  return Array.from({ length: n }, (_, i) => {
    const a1 = i * (360 / n), a2 = a1 + (360 / n) / 2;
    const col = cols[i % cols.length];
    const x1 = 50 + r * Math.sin(deg(a1)), y1 = 50 - r * Math.cos(deg(a1));
    const x2 = 50 + r * Math.sin(deg(a2)), y2 = 50 - r * Math.cos(deg(a2));
    const op = (i % cols.length === 0 ? 0.95 : 0.5) * alpha;
    return `<polygon points="50,50 ${x1.toFixed(1)},${y1.toFixed(1)} ` +
           `${x2.toFixed(1)},${y2.toFixed(1)}" fill="${col}" opacity="${op}"/>`;
  }).join("");
}

/* ---------- הכדור ----------
   מחומש מרכזי + חמישה סביבו. לא דגם מלא של 32 פאות: בגודל קטן
   הוא נהפך לרעש אפור. */
function ball(r = 26, cx = 50, cy = 50, fill = "url(#gold)") {
  return `<circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="${INK}" opacity=".6"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>
    <polygon points="${pent(cx, cy, r * 0.42, 0)}" fill="${INK}"/>
    ${[0, 1, 2, 3, 4].map(i => {
      const a = deg(i * 72);
      return `<polygon points="${pent(cx + r * 0.73 * Math.sin(a),
        cy - r * 0.73 * Math.cos(a), r * 0.27, 180 + i * 72)}"
        fill="${INK}" opacity=".85"/>`;
    }).join("")}`;
}

const GOLD = `<radialGradient id="gold" cx="38%" cy="30%">
  <stop offset="0" stop-color="#FFF0B8"/>
  <stop offset=".55" stop-color="${Y}"/>
  <stop offset="1" stop-color="#C68A00"/></radialGradient>`;
const BG = `<radialGradient id="bg" cx="50%" cy="45%">
  <stop offset="0" stop-color="#2A2A32"/>
  <stop offset="1" stop-color="${INK}"/></radialGradient>`;

const svg$ = (inner, defs = "") =>
  `<svg viewBox="0 0 100 100" width="100%" height="100%" style="display:block">
     <defs>${defs}</defs>${inner}</svg>`;

const page$ = (size, inner, bg = "transparent") => `<!doctype html><html><head>
<meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${size}px;height:${size}px;overflow:hidden;background:${bg}}
  .st{position:relative;width:${size}px;height:${size}px;overflow:hidden}
</style></head><body><div class="st">${inner}</div></body></html>`;

const browser = await chromium.launch({ headless: true });

async function shot(file, size, html, transparent = false) {
  const page = await browser.newPage({
    viewport: { width: size, height: size }, deviceScaleFactor: 1
  });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: file, omitBackground: transparent });
  await page.close();
  log(`  ${file}  ${size}×${size}`);
}

/* ---------- 1. האייקון הראשי ----------
   מלבן מלא. העיגול והפינות המעוגלות נעשים על ידי המערכת, ולכן
   אין לצייר אותם כאן — אחרת מקבלים פינה בתוך פינה.

   1024 ל-@capacitor/assets, ו-512 לדף החנות ב-Play. */
const ICON = svg$(
  `<rect width="100" height="100" fill="url(#bg)"/>${burst()}${ball()}`,
  GOLD + BG);
await shot(`${OUT}/icon.png`, 1024, page$(1024, ICON, INK));
await shot("store/upload/icon-512.png", 512, page$(512, ICON, INK));

/* ---------- 2. אייקון אדפטיבי לאנדרואיד ----------
   שתי שכבות. המסכה של המשגר חותכת את השוליים, וזו הסיבה שהחוק
   הוא "תוכן חשוב בתוך 66% המרכזיים".

   ברקע הקרניים בלבד, והן מורחבות ב-1.35: קרן חתוכה היא עוד קרן,
   ולכן מותר להן מלוא הפריים. בחזית הכדור בלבד, ממורכז וקטן
   דיו כדי שלא ייחתך בשום צורת מסכה. */
await shot(`${OUT}/icon-background.png`, 1024,
  page$(1024, svg$(`<rect width="100" height="100" fill="url(#bg)"/>` +
    burst({ bleed: 1.35 }), BG), INK));
await shot(`${OUT}/icon-foreground.png`, 1024,
  page$(1024, svg$(ball(21), GOLD)), true);

/* ---------- 3. מסך פתיחה ----------
   2732 מרובע — @capacitor/assets חותך ממנו לכל יחס מסך, ולכן
   כל מה שחייב להיראות יושב במרכז. הקרניים עמומות בכוונה: מסך
   פתיחה רועש נראה כמו פרסומת, ומטרתו רק לכסות את הרגע שלפני
   שהגופנים נטענו. */
const splash = `${svg$(burst({ bleed: 1.1, alpha: 0.16 }))}
  <div style="position:absolute;inset:0;display:flex;align-items:center;
    justify-content:center;font-family:Georgia,serif;font-size:210px;
    font-weight:700;color:#F2F2F0;letter-spacing:-6px">
    Sport<span style="color:${Y}">Dle</span></div>`;
await shot(`${OUT}/splash.png`, 2732, page$(2732, splash, INK));
await shot(`${OUT}/splash-dark.png`, 2732, page$(2732, splash, INK));

/* ---------- 4. אייקון ההתראה ----------
   אנדרואיד צובע אותו בלבן ומתעלם מכל צבע אחר, ולכן הוא נוצר
   כצללית לבנה על שקוף. אייקון צבעוני כאן מופיע כריבוע לבן אטום
   בשורת ההתראות — תקלה שנראית כמו באג ולא כמו עיצוב.

   כדור ולא קרניים: קרניים בלבן הן כתם לבן. הכדור נשמר כצללית
   עם מחומשים **מנוקבים** (שקופים), וזה מה שמשאיר אותו מזוהה
   כשהמערכת צובעת הכל בלבן.
   נכתב ישירות ל-drawable; @capacitor/assets אינו מייצר אותו. */
const NOTIF = "android/app/src/main/res/drawable/ic_stat_sportdle.png";
await shot(NOTIF, 96, page$(96, svg$(
  `<mask id="holes">
     <rect width="100" height="100" fill="white"/>
     <polygon points="${pent(50, 50, 15, 0)}" fill="black"/>
     ${[0, 1, 2, 3, 4].map(i => {
       const a = deg(i * 72);
       return `<polygon points="${pent(50 + 26 * Math.sin(a),
         50 - 26 * Math.cos(a), 9.5, 180 + i * 72)}" fill="black"/>`;
     }).join("")}
   </mask>
   <circle cx="50" cy="50" r="38" fill="#FFFFFF" mask="url(#holes)"/>`
)), true);

await browser.close();
log("סיום. הרץ:  npx @capacitor/assets generate --android");
