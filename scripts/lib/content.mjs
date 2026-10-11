/* ============================================================
   content.mjs — דפי התוכן של האתר.

   האתר היה מסך אחד: משחק, בלי טקסט שאפשר לקרוא. זה מה שמונע
   אינדוקס בגוגל, וזו הסיבה המרכזית ש-AdSense דוחה אתרים כאלה.
   כאן נוצרים הדפים שנותנים לזחלן מה לקרוא.

   הכל נכתב כ-HTML סטטי בזמן הבנייה — אין כאן שום דבר שנבנה בצד
   הלקוח. מה שהזחלן מקבל בבקשה הראשונה הוא הטקסט המלא.

   שני כללי ברזל בקובץ הזה:

   1. **אין המצאת עובדות.** כל נתון על שחקן מגיע מ-data/clubs/.
      שדה חסר — מושמט. אין ניחוש, אין השלמה, אין "כנראה".
      המאגר מכיל עמדה, לאום, שנת לידה, טווחי שנים, מספר עונות
      ומספר תארים. הוא **אינו** מכיל הופעות, שערים או מלל, ולכן
      הם לא מופיעים בשום דף.

   2. **אין ספוילרים.** הארכיון נחתך על החידה של אתמול. הלוח
      המלא שמור ב-config/schedule-*.json ומכיל גם את העתיד;
      דף מאונדקס שמציג אותו היה הופך כל תשובה עתידית לחיפוש
      בגוגל.
   ============================================================ */
import { writeText, season, seasonsIn } from "./util.mjs";

/* אותן תוויות כמו ב-src/engine.js. שמות של קווים ולא של
   תפקידים: המאגר מחזיק ארבע קטגוריות ואינו יודע להבחין בין
   בלם למגן. ראה את ההערה המלאה שם. */
const POS_HE = { GK: "שוער", DF: "הגנה", MF: "קישור", FW: "התקפה" };
const DAY_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MAIL = "techbynoam@gmail.com";
const AUTHOR = "נועם אדרי";

/* הפוטר שמופיע בכל דף, כולל מסך המשחק. הסדר הוא סדר החשיבות
   לקורא: קודם איך משחקים, אחר כך מה היה, ואז מי אנחנו. */
export const NAV = [
  { path: "how-to-play", he: "איך משחקים" },
  { path: "archive",     he: "ארכיון" },
  { path: "players",     he: "שחקנים" },
  { path: "about",       he: "אודות" },
  { path: "contact",     he: "צור קשר" },
  { path: "privacy",     he: "פרטיות" },
  { path: "terms",       he: "תנאי שימוש" },
  { path: "accessibility", he: "נגישות" }
];

/* ---------- כתובות ----------
   הקישורים יחסיים ולא מוחלטים, כי אותו dist מוגש משני נתיבים:
   שורש הדומיין הקנוני, וגם /sportdle/ בכתובת הישנה. קישור
   שמתחיל בלוכסן היה שובר את השני. depth הוא מספר הרמות מהשורש. */
const up = depth => "../".repeat(depth);

/* עברית בכתובת עובדת, וגם עדיפה לאתר בעברית — אבל הגרש נופל.
   "ג'ון" ו-"גון" אינם שני שחקנים שונים באף מועדון, ובדקנו את זה:
   writeContentPages מפיל את הבנייה אם שני שמות מקבלים אותה כתובת. */
export function slugify(he) {
  return String(he)
    .replace(/['"׳״]/g, "")
    .replace(/[()]/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

const esc = s => String(s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

/* ---------- העיצוב ----------
   אותה שפה כמו המשחק אחרי סבב ה-UI/UX השני (src/template.html,
   הבלוק "חלק ובהיר"): קרקע אבן בהירה, משטחים לבנים חלקים, דיו
   מלא, כפתורים מוצקים. אותם טוקנים בדיוק — --ui-ink, --ui-ink-2,
   --ui-line, --ui-ctl — ובלי קווקוו, בלי בד ובלי קרקע כהה.

   הצעיף נשאר רק בלוגו שבראש הדף: פס סרוג ב---brand עם שורות קצה
   ב---second-band וגדילים בשני הקצוות. האותיות בדיו מלא.
   דף בלי מועדון לובש את צהוב-שחור של SportDle (ברירת המחדל של
   העמוד הראשי). דף של מועדון מקבל את צבעיו מ-themeStyle() על
   <html>, ואת הגדילים שלו דרך __FRINGE__.

   __U__ מוחלף ב-up(depth) ב-shell(): הדפים יושבים בעומק 1–3,
   וכתובת יחסית ב-<style> נפתרת מול הדף. */
const CSS = `
:root{
  --ground:#ECEAE5; --surface:#FFFFFF; --surface-2:#F5F4F1;
  --ui-ink:#17181C; --ui-ink-2:#454850; --ui-line:#D4D0C8; --ui-ctl:#77736B;
  --miss:#454750; --on-miss:#FFFFFF; --knit-mute:.68; --r-ctl:12px;
  --brand:#FFC72C; --brand-rgb:255,199,44; --on-brand:#121214;
  --second-band:#26272D; --title-ink:#0C0C0E;
  --knit:url(__U__scarf/knit.webp);
  /* הטוקנים הישנים שבאנר האפליקציה קורא — אותו מיפוי כמו במשחק */
  --text:#17181C; --dim:#454850; --line:#D4D0C8; --ink-2:#FFFFFF;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{-webkit-text-size-adjust:100%;scrollbar-color:#B9B5AD var(--ground)}
html,body{margin:0;padding:0;background:var(--ground)}
body{color:var(--ui-ink);font-family:'Heebo',system-ui,sans-serif;
  font-size:17px;line-height:1.75;min-height:100dvh;display:flex;flex-direction:column;overflow-wrap:break-word;
  padding-top:var(--safe-area-inset-top,env(safe-area-inset-top));padding-bottom:var(--safe-area-inset-bottom,env(safe-area-inset-bottom))}
::selection{background:var(--ui-ink);color:#fff}
.wrap{max-width:700px;width:100%;margin:0 auto;padding:0 16px 48px;flex:1}
/* 18px על 592px של טקסט: כ-70 תווים בשורה */
@media (min-width:640px){body{font-size:18px}.wrap{max-width:640px;padding:0 24px 64px}}

/* ---- ראש הדף: הלוגו כצעיף, וכפתור משני לחידה ---- */
.top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px 12px;
  padding:22px 0 20px;margin-bottom:26px;border-bottom:1px solid var(--ui-line)}
.logo{position:relative;display:block;margin:0 22px;padding:13px 16px 14px;
  font-weight:900;font-size:26px;line-height:1;letter-spacing:-.02em;color:var(--title-ink);text-decoration:none;
  background:
    linear-gradient(var(--second-band),var(--second-band)) top/100% 6px no-repeat,
    linear-gradient(var(--second-band),var(--second-band)) bottom/100% 6px no-repeat,
    linear-gradient(rgba(var(--brand-rgb),var(--knit-mute)),rgba(var(--brand-rgb),var(--knit-mute))),
    var(--knit) center/auto 100% repeat-x,
    var(--brand);
  background-blend-mode:normal,normal,normal,multiply}
.logo span{color:inherit}
.logo::before,.logo::after{content:"";position:absolute;top:1px;bottom:1px;width:22px;pointer-events:none;
  background:url(__U__scarf/fringe-__FRINGE__.webp) no-repeat center top/100% auto}
.logo::after{right:-21px}
.logo::before{left:-21px;transform:scaleX(-1)}
.toplink,.pager a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:9px 16px;
  background:var(--surface);color:var(--ui-ink);border:1.5px solid var(--ui-ctl);border-radius:var(--r-ctl);
  box-shadow:0 1px 2px rgba(23,24,28,.08);font-size:15px;font-weight:700;line-height:1.3;text-decoration:none;white-space:nowrap}
.toplink:hover,.pager a:hover{background:#F1EFEA;border-color:var(--ui-ink);box-shadow:none}
@media (max-width:359px){.top{gap:14px 8px}.logo{font-size:20px;padding:11px 10px 12px;margin:0 18px}
  .logo::before,.logo::after{width:18px}.logo::after{right:-17px}.logo::before{left:-17px}
  .toplink{font-size:13.5px;padding:8px 10px}}
@media (min-width:640px){.logo{font-size:30px;padding:15px 20px 16px;margin:0 26px}
  .logo::before,.logo::after{width:26px}.logo::after{right:-25px}.logo::before{left:-25px}}

/* ---- טקסט ---- */
.crumb{font-size:14px;line-height:1.6;color:var(--ui-ink-2);margin:0 0 14px}
.crumb a{color:var(--ui-ink-2)}
h1{font-weight:900;font-size:clamp(30px,8.4vw,44px);line-height:1.12;letter-spacing:-.015em;
  margin:0 0 10px;color:var(--ui-ink)}
.kicker{color:var(--ui-ink-2);font-size:16px;line-height:1.6;margin:0 0 30px}
h2{font-size:23px;font-weight:900;line-height:1.3;margin:48px 0 12px;color:var(--ui-ink)}
h3{font-size:18.5px;font-weight:700;line-height:1.35;margin:32px 0 8px;color:var(--ui-ink)}
p{margin:0 0 18px}
ul,ol{margin:0 0 22px;padding-inline-start:24px}
li{margin-bottom:10px;padding-inline-start:4px}
li::marker{color:var(--ui-ink-2);font-weight:700}
strong,b{font-weight:700}
a{color:var(--ui-ink);text-decoration:underline;text-decoration-color:var(--ui-ctl);
  text-decoration-thickness:1.5px;text-underline-offset:3px}
a:hover{text-decoration-color:var(--ui-ink);text-decoration-thickness:2px}
:focus-visible{outline:2.5px solid var(--ui-ink);outline-offset:3px;border-radius:4px}

/* ---- משטחים ---- */
.note{background:linear-gradient(var(--brand),var(--brand)) right/5px 100% no-repeat,var(--surface);border:1px solid var(--ui-line);
  border-radius:var(--r-ctl);padding:14px 23px 14px 18px;margin:0 0 26px;font-size:16px;line-height:1.7;color:var(--ui-ink-2)}
.note b{color:var(--ui-ink)}
.tbl{overflow-x:auto;margin:0 0 24px;background:var(--surface);border:1px solid var(--ui-line);border-radius:var(--r-ctl)}
table{width:100%;border-collapse:collapse;font-size:15.5px;line-height:1.5}
th,td{text-align:start;padding:11px 14px;border-bottom:1px solid #E6E3DD;vertical-align:top}
tr:last-child td{border-bottom:0}
th{color:var(--ui-ink-2);font-weight:700;font-size:14px;background:var(--surface-2);white-space:nowrap}
tr:nth-child(2n+3) td{background:#FAF9F7}
td:first-child{min-width:7.5em}
.nw{white-space:nowrap}
@media (max-width:479px){table{font-size:15px}th,td{padding:10px 10px}}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 30px}
.fact{background:linear-gradient(var(--brand),var(--brand)) top/100% 5px no-repeat,var(--surface);border:1px solid var(--ui-line);
  border-radius:10px;padding:15px 14px 12px;line-height:1.35}
.fact .k{font-size:13.5px;font-weight:500;color:var(--ui-ink-2);display:block;margin-bottom:4px}
.fact .v{font-size:19px;font-weight:900;color:var(--ui-ink)}
.chip{display:inline-flex;align-items:center;min-height:44px;font-size:15px;font-weight:700;line-height:1.2;
  color:var(--ui-ink);background:var(--surface);border:1.5px solid var(--ui-ctl);border-radius:22px;
  padding:8px 16px;margin:0 0 8px 8px;text-decoration:none}
.chip:hover{background:#F1EFEA;border-color:var(--ui-ink)}
.cards{display:grid;gap:10px;margin:0 0 28px}
@media (min-width:640px){.cards{grid-template-columns:1fr 1fr}}
.card{display:block;background:var(--surface);border:1px solid var(--ui-line);border-radius:var(--r-ctl);
  padding:14px 18px 15px;text-decoration:none;color:var(--ui-ink);line-height:1.45;box-shadow:0 1px 2px rgba(23,24,28,.05)}
.card[style]{background:linear-gradient(var(--c),var(--c)) right/6px 100% no-repeat,var(--surface);padding-right:24px}
.card:hover{border-color:var(--ui-ink)}
.card .n{font-size:13.5px;font-weight:500;color:var(--ui-ink-2)}
.card .t{font-size:18px;font-weight:900;margin-top:2px}
.card .s{font-size:14.5px;color:var(--ui-ink-2);margin-top:4px}

/* ---- שפת הרמזים: אותם ריבועים שטוחים כמו במשחק ---- */
.swatch{display:inline-block;width:15px;height:15px;border-radius:3px;vertical-align:-2px;
  margin-inline-end:8px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.28)}
.sw-hit{background:var(--brand)} .sw-miss{background:var(--miss)}
.sw-near{background:var(--near,#8A6A1C)}
.demo{overflow-x:auto;margin:0 0 14px;background:var(--surface);border:1px solid var(--ui-line);border-radius:var(--r-ctl);padding:6px}
.demo table{border-collapse:separate;border-spacing:6px}
.demo th{background:none;border:0;padding:2px 6px;text-align:center}
.demo td{border:0;border-radius:8px;padding:12px 10px;font-size:15px;font-weight:900;text-align:center;white-space:nowrap;
  background:var(--surface-2)}
.demo td:first-child{text-align:start;background:none;padding-inline:4px}
.demo .hit{background:var(--brand);color:var(--on-brand)}
.demo .near{background:var(--near,#8A6A1C);color:#fff}
.demo .miss{background:var(--miss);color:var(--on-miss)}
.pager{display:flex;justify-content:space-between;gap:10px;margin:28px 0 0}

/* ---- פוטר ---- */
.appban{background:var(--surface);border:1px solid var(--ui-line);border-radius:16px;box-shadow:none}
.appban b{color:var(--ui-ink)} .appban span{color:var(--ui-ink-2)}
.appban a.play span{color:#fff}
footer{border-top:1px solid var(--ui-line);margin-top:48px;padding:6px 0 0;
  font-size:14px;color:var(--ui-ink-2);line-height:1.8}
.sitenav{display:flex;flex-wrap:wrap;gap:0 8px;margin:18px 0 12px;border-top:1px solid var(--ui-line);padding-top:12px}
.sitenav a{display:inline-block;padding:4px 0;color:var(--ui-ink-2);font-size:14px;text-decoration:none}
.sitenav a:hover{color:var(--ui-ink);text-decoration:underline}
.sitenav span{color:var(--ui-ctl);padding:4px 0}
footer .who a{color:var(--ui-ink-2)}
footer .who a:hover{color:var(--ui-ink)}
`;

/* ---------- צבעי מועדון לדף של מועדון ----------
   אותו חישוב כמו applyTheme ב-src/engine.js, בזמן הבנייה: הפס
   השני, ודיו קריא על כל אחד מהם — לפי ניגודיות ולא לפי מועדון. */
const rgbOf = h => h.replace("#", "").match(/.{2}/g).map(x => parseInt(x, 16));
const lumOf = h => { const [R, G, B] = rgbOf(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * R + .7152 * G + .0722 * B; };
const onOf = h => (lumOf(h) + .05) / (lumOf("#121214") + .05) >= 1.05 / (lumOf(h) + .05) ? "#121214" : "#FFFFFF";
const ratio = (a, b) => { const [x, y] = [lumOf(a), lumOf(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
function themeStyle(colors) {
  const second = colors.second || colors.ink;
  return [`--brand:${colors.brand}`, `--brand-rgb:${rgbOf(colors.brand).join(",")}`,
    `--on-brand:${onOf(colors.brand)}`,
    `--second-band:${lumOf(second) < lumOf("#26272D") ? "#26272D" : second}`,
    `--title-ink:${ratio(colors.brand, second) >= 3 ? second : onOf(colors.brand)}`].join(";");
}
/* פס הצבע בכרטיס של מועדון (ארכיון, מפתח השחקנים) */
const cardTint = c => c && c.colors ? ` style="--c:${c.colors.brand}"` : "";

/* ---------- באנר האפליקציה ----------
   מקור אחד גם לדפי התוכן וגם למסך המשחק: build.mjs מזריק את
   שניהם ל-src/template.html דרך __APP_BANNER_CSS__ ו-__APP_BANNER__.

   המצב נשלט מ-`androidApp` ב-config/site.json, ולכן המעבר
   מ"בקרוב" לקישור הורדה הוא **שינוי קונפיג ופריסה, בלי קוד**.

   var(--brand) עם נפילה: גם דפי התוכן וגם המשחק מגדירים אותו,
   ובמשחק הוא צבע המועדון — כך הכפתור מתלבש על המועדון שנבחר.

   **הבאנר נמחק מעותק האפליקציה** (tools/app-prepare.mjs). באנר
   "בקרוב תהיה אפליקציה" בתוך האפליקציה עצמה הוא שטות. */
export const APP_BANNER_CSS = `
.appban{margin:26px auto 0;max-width:430px;padding:14px 16px;border-radius:10px;
  background:var(--ink-2,#141418);border:1px solid var(--line,#2E2E36);
  text-align:center;line-height:1.6}
.appban b{display:block;color:var(--text,#F2F2F0);font-size:14.5px;font-weight:700}
.appban span{display:block;font-size:12.5px;color:var(--dim,#8C8C94);margin-top:3px}
.appban a{display:inline-block;margin-top:9px;background:var(--brand,#FFC72C);
  color:#0C0C0E;text-decoration:none;font-weight:700;font-size:13.5px;
  padding:9px 20px;border-radius:8px}
/* תג Google Play — שחור עם מסגרת אפורה, כמו התג הרשמי, כי זה הצורה
   שאנשים מזהים כ"כאן מורידים". לא צבע המועדון: כפתור צהוב נראה
   כמו עוד כפתור באתר. ltr כי הלוגו משמאל לשם, כמו בתג המקורי. */
.appban a.play{display:inline-flex;align-items:center;gap:9px;direction:ltr;
  background:#000;color:#fff;border:1px solid #A6A6A6;padding:7px 16px 7px 12px;
  border-radius:9px;line-height:1.15;text-align:left}
.appban a.play svg{width:26px;height:28px;flex:none}
.appban a.play span{display:block;margin:0;color:#fff}
.appban a.play small{display:block;font-size:10.5px;font-weight:400;direction:rtl;text-align:left}
.appban a.play em{display:block;font-style:normal;font-size:17px;font-weight:700;letter-spacing:.2px}
.appban span.stores{display:flex;margin:0;flex-wrap:wrap;justify-content:center;gap:0 10px}
`;

/* הלוגו של Play בארבעת הצבעים, inline — בלי בקשה נוספת ובלי תלות
   בקובץ חיצוני. */
const PLAY_LOGO = `<svg viewBox="0 0 24 26" aria-hidden="true">
<path fill="#32BBFF" d="M1.6 1.2 13.4 13 1.6 24.8c-.4-.3-.6-.8-.6-1.4V2.6c0-.6.2-1.1.6-1.4z"/>
<path fill="#00D26A" d="M1.6 1.2c.5-.4 1.2-.4 1.9 0L17.3 9.1 13.4 13z"/>
<path fill="#FF3A44" d="M1.6 24.8 13.4 13l3.9 3.9-13.8 7.9c-.7.4-1.4.4-1.9 0z"/>
<path fill="#FFC900" d="m17.3 9.1 4.4 2.5c1.1.6 1.1 2.2 0 2.8l-4.4 2.5-3.9-3.9z"/>
</svg>`;

const APPLE_LOGO = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M12.15 6.9c-.95 0-2.42-1.08-3.96-1.04-2.04.03-3.91 1.18-4.96 3.01-2.12 3.68-.55 9.1 1.52 12.09 1.01 1.45 2.21 3.09 3.79 3.04 1.52-.07 2.09-.99 3.94-.99 1.83 0 2.35.99 3.96.95 1.64-.03 2.68-1.48 3.68-2.95 1.16-1.69 1.64-3.33 1.66-3.42-.04-.01-3.18-1.22-3.22-4.86-.03-3.04 2.48-4.49 2.6-4.56-1.43-2.09-3.62-2.32-4.39-2.38-2-.16-3.68 1.09-4.61 1.09zM15.53 3.83c.84-1.01 1.4-2.43 1.25-3.83-1.21.05-2.66.81-3.53 1.82-.78.9-1.45 2.34-1.27 3.71 1.34.1 2.71-.69 3.56-1.7"/></svg>`;

/** מטא של Smart App Banner — ספארי באייפון מציג מעליו פס "פתיחה/קבלה" לאפליקציה. */
export function iosMetaHtml(site) {
  const i = (site && site.iosApp) || {};
  return i.state === "live" && i.id ? `<meta name="apple-itunes-app" content="app-id=${i.id}">` : "";
}

export function appBannerHtml(site) {
  const a = (site && site.androidApp) || {}, i = (site && site.iosApp) || {};
  const play = a.state === "live" && a.url
    ? `<a class="play" href="${a.url}" target="_blank" rel="noopener" aria-label="להורדה מ-Google Play">${PLAY_LOGO}<span><small>זמין ב-</small><em>Google Play</em></span></a>` : "";
  const apple = i.state === "live" && i.url
    ? `<a class="play" href="${i.url}" target="_blank" rel="noopener" aria-label="להורדה מ-App Store">${APPLE_LOGO}<span><small>להורדה ב-</small><em>App Store</em></span></a>` : "";
  if (play || apple)
    return `<div class="appban" id="appban">
    <b>${play && apple ? "האפליקציה — לאייפון ולאנדרואיד" : apple ? "אפליקציית אייפון" : "אפליקציית אנדרואיד"}</b>
    <span>אותו משחק, גם בלי חיבור לאינטרנט, ותזכורת לחידה היומית.</span>
    <span class="stores">${apple}${play}</span>
  </div>`;
  if (a.state === "off") return "";
  return `<div class="appban" id="appban">
    <b>אפליקציית אנדרואיד — בקרוב</b>
    <span>הגרסה בבדיקות. כשהיא תאושר, קישור ההורדה יופיע כאן.</span>
  </div>`;
}

/* ---------- הפוטר המשותף ----------
   אותו סימן בדיוק גם במסך המשחק (src/template.html), כדי שדף
   התוכן והמשחק ייראו כמו אתר אחד ולא כמו שני אתרים. */
/* נקבע פעם אחת ב-writeContentPages. shell() אינו מקבל את site,
   ויש לו עשרות קריאות — השחלה דרך כולן הייתה שינוי רחב בלי תמורה. */
let SITE = null;

export function navHtml(depth) {
  const u = up(depth);
  return appBannerHtml(SITE) +
    `<nav class="sitenav" aria-label="ניווט באתר">` +
    `<a href="${u}">חידה יומית</a>` +
    NAV.map(n => `<span>·</span><a href="${u}${n.path}/">${n.he}</a>`).join("") +
    `</nav>`;
}

/* ---------- שלד הדף ---------- */
function shell({ depth, path, title, desc, h1, kicker, body, crumbs, base, siteName, jsonld, club }) {
  const u = up(depth);
  /* מקודד. שמות השחקנים בכתובת הם עברית, וה-sitemap חייב אחוזים
     לפי התקן — אם ה-canonical היה גולמי, גוגל היה משווה שתי
     מחרוזות שונות לאותו דף. encodeURI שומר על הלוכסנים. */
  const canon = `${base}/${encodeURI(path)}`;
  const ld = [];

  /* BreadcrumbList בכל דף מקונן — זה מה שנותן לגוגל את שורת
     הניווט מתחת לכותרת בתוצאות החיפוש. */
  if (crumbs && crumbs.length)
    ld.push({
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem", position: i + 1, name: c.he,
        item: `${base}/${encodeURI(c.path)}`
      }))
    });
  if (jsonld) ld.push(jsonld);

  /* דף של מועדון אחד לובש את צבעיו ואת הגדילים שלו; כל השאר — ברירת המחדל */
  const css = CSS.split("__U__").join(u).split("__FRINGE__").join(club ? club.slug : "beitar");
  return `<!DOCTYPE html>
<html lang="he" dir="rtl"${club ? ` data-club="${club.slug}" style="${themeStyle(club.colors)}"` : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canon}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canon}">
<meta property="og:image" content="${base}/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${base}/og.png">
<meta name="theme-color" content="#ECEAE5">${iosMetaHtml(SITE)}
<link rel="icon" href="${u}favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="${u}icon-32.png">
<link rel="apple-touch-icon" href="${u}icon-180.png">
<link rel="stylesheet" href="${u}fonts.css">
<style>${APP_BANNER_CSS}${css}</style>
${ld.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
</head>
<body>
<div class="wrap">
  <div class="top">
    <a class="logo" href="${u}">Sport<span>Dle</span></a>
    <a class="toplink" href="${u}">לחידה של היום ←</a>
  </div>
${crumbs && crumbs.length > 1 ? `  <p class="crumb">` +
    crumbs.slice(0, -1).map(c => `<a href="${u}${c.path === "" ? "" : c.path}">${c.he}</a>`).join(" › ") +
    ` › ${esc(crumbs[crumbs.length - 1].he)}</p>` : ""}
  <h1>${esc(h1)}</h1>
${kicker ? `  <p class="kicker">${kicker}</p>` : ""}
${body}
  <footer>
    ${navHtml(depth)}
    <div class="who">${esc(siteName)} · פרויקט אוהדים · לא רשמי<br>
      <a href="mailto:${MAIL}">${MAIL}</a> ·
      <a href="https://techbynoam.com/" target="_blank" rel="noopener">TechByNoam</a>
    </div>
  </footer>
</div>
</body>
</html>
`;
}

/* ---------- תיאור שחקן, נגזר בלבד ----------
   כל מה שכאן נבנה מהשדות שקיימים. אין תואר, אין הערכה, אין
   "נחשב לאחד מ…". מה שאין במאגר לא מופיע במשפט. */
function playerSentence(p, club) {
  const spells = p.spells.map(([a, b]) => `${season(a)}–${season(b)}`).join(", ");
  const bits = [`${p.he} מופיע במאגר של ${club.he}`];
  if (p.spells.length === 1) bits.push(`בעונות ${spells}`);
  else bits.push(`בשני טווחים — ${spells}`);
  const s = [`${bits.join(" ")}, ${seasonsIn(p.spells)} עונות בסך הכל.`];
  if (POS_HE[p.pos]) s.push(`עמדתו במאגר היא ${POS_HE[p.pos]}.`);
  if (p.titles > 0)
    s.push(`בזמן שהיה בסגל זכה המועדון ב-${p.titles} ` +
           `${p.titles === 1 ? "תואר" : "תארים"} מבין אלה שהמאגר סופר.`);
  else s.push("המאגר אינו סופר תארים של המועדון בשנים שבהן היה בסגל.");
  return s.join(" ");
}

/* ---------- השוואה, כמו במנוע ----------
   משוכפל מ-src/engine.js compare() כדי שההדגמה בדף "איך משחקים"
   תהיה מה שקורה באמת ולא תיאור שלו. אם הכללים במנוע ישתנו,
   הדגמה כאן תשקר — לכן build.mjs מאמת אותה מול המנוע. */
const POS_ORDER = ["GK", "DF", "MF", "FW"];
function compareRow(g, a, NAT_HE, REGION) {
  const gi = POS_ORDER.indexOf(g.pos), ai = POS_ORDER.indexOf(a.pos);
  const gf = g.spells[0][0], af = a.spells[0][0];
  const out = [];
  out.push({ v: POS_HE[g.pos] || "?",
    s: g.pos === a.pos ? "hit" : (Math.abs(gi - ai) === 1 ? "near" : "miss") });
  /* חפיפת אזרחויות, כמו במנוע. ראה config/nat-extra.json. */
  const gn = (g.nats && g.nats.length) ? g.nats : [g.nat].filter(Boolean);
  const an = (a.nats && a.nats.length) ? a.nats : [a.nat].filter(Boolean);
  const shared = gn.find(n => an.includes(n));
  const nearNat = !shared &&
    gn.some(x => REGION[x] && an.some(y => REGION[x] === REGION[y]));
  const shownNat = shared || gn[0];
  out.push({ v: NAT_HE[shownNat] || shownNat,
    s: shared ? "hit" : (nearNat ? "near" : "miss") });
  const gd = af - gf;
  out.push({ v: season(gf) + (gd === 0 ? "" : gd > 0 ? " ↑" : " ↓"),
    s: gd === 0 ? "hit" : (Math.abs(gd) <= 3 ? "near" : "miss") });
  const td = a.titles - g.titles;
  out.push({ v: g.titles + (td === 0 ? "" : td > 0 ? " ↑" : " ↓"),
    s: td === 0 ? "hit" : (Math.abs(td) <= 1 ? "near" : "miss") });
  const bd = a.born - g.born;
  out.push({ v: g.born + (bd === 0 ? "" : bd > 0 ? " ↑" : " ↓"),
    s: bd === 0 ? "hit" : (Math.abs(bd) <= 3 ? "near" : "miss") });
  return out;
}

/* ============================================================
   הכתיבה
   ============================================================ */
export function writeContentPages({ data, order, site, NAT_HE, REGION, maxGuesses }) {
  SITE = site;                       // navHtml קורא ממנו את מצב הבאנר
  const base = String(site.siteUrl).replace(/\/$/, "");
  const routes = [];
  const add = (path, page) => {
    writeText(`dist/${path}index.html`, page);
    routes.push("/" + path);
  };
  const HOME = { he: "חידה יומית", path: "" };

  /* ---------- מספר החידה של היום ----------
     ב-UTC בכוונה. ישראל לפני UTC, ולכן חישוב ב-UTC יכול לפגר יום
     אחד — לכל היותר חידה אחת פחות בארכיון. הכיוון הזה בטוח;
     הכיוון ההפוך היה מפרסם את התשובה של היום. */
  const st = Date.UTC(site.start[0], site.start[1] - 1, site.start[2]);
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const todayIdx = Math.max(0, Math.floor((todayUTC - st) / 86400000));   // 0-based
  const pastCount = todayIdx;                       // חידות 1..todayIdx הן עבר
  const dateOf = i => new Date(st + i * 86400000);  // i הוא 0-based
  const dateNum = d => `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;
  /* "ב-יום שני" ו-"מ-יום שני" הן עברית שבורה, ולכן הצורה הזאת
     מופיעה רק אחרי "של" או לבד ככותרת. במשפט זורם — dateNum. */
  const dateHe = d => `יום ${DAY_HE[d.getUTCDay()]}, ${dateNum(d)}`;

  /* ---------- מפת שחקנים ----------
     מטרה = שחקן שיכול להיות תשובה. אותו שם בשני מועדונים אינו
     בהכרח אותו אדם, והפרויקט אינו ממזג כפילויות שם — ולכן
     הכתובת מקננת את המועדון: /players/<מועדון>/<שם>/. */
  const players = [];        // { club, p, slug, path }
  const bySlug = new Map();
  for (const slug of order) {
    const club = data[slug];
    const seen = new Map();
    for (const p of club.players) {
      if (!p.target) continue;
      const s = slugify(p.he);
      if (seen.has(s))
        throw new Error(`שתי כתובות זהות ב-${slug}: "${p.he}" ו-"${seen.get(s)}" → ${s}`);
      seen.set(s, p.he);
      const rec = { club, slug, p, s, path: `players/${slug}/${s}/` };
      players.push(rec);
      bySlug.set(`${slug}/${p.he}`, rec);
    }
  }

  /* איזו חידה שפורסמה ענתה על השחקן הזה */
  const answered = new Map();               // "slug/he" → [מספרי חידה]
  for (const slug of order) {
    const sch = data[slug].schedule || [];
    for (let i = 0; i < Math.min(sch.length, pastCount); i++) {
      const k = `${slug}/${sch[i]}`;
      if (!answered.has(k)) answered.set(k, []);
      answered.get(k).push(i + 1);
    }
  }

  const link = (depth, rec) =>
    `<a href="${up(depth)}${rec.path}">${esc(rec.p.he)}</a>`;

  /* ==================== 1. אודות ==================== */
  {
    /* counts.players הוא מה ש**גלוי** במשחק, לא סך הרשומות.
       המוסתרים אינם תת-קבוצה שלו אלא נוספים עליו, ולכן סך
       הרשומות הוא הסכום. טעות כאן נותנת שני מספרים שלא
       מסתכמים, וזה בדיוק סוג הדבר שקורא שם לב אליו. */
    const shown = order.reduce((n, s) => n + data[s].counts.players, 0);
    const hid = order.reduce((n, s) => n + (data[s].counts.hidden || 0), 0);
    const tot = shown + hid;
    const pool = order.reduce((n, s) => n + data[s].counts.targets, 0);
    const cov = order.map(s => data[s].coverage);
    const from = Math.min(...cov.map(c => c.from)), to = Math.max(...cov.map(c => c.to));
    const body = `
  <p><b>SportDle</b> הוא משחק ניחוש יומי על כדורגלנים ישראלים.
     בכל יום נבחר שחקן אחד מסתורי לכל מועדון, ולפותר יש
     ${maxGuesses} ניסיונות למצוא אותו. כל ניחוש מחזיר חמישה
     רמזים — עמדה, לאום, העונה הראשונה במועדון, מספר התארים
     ושנת הלידה — וכל רמז מסמן אם הוא מדויק, קרוב או רחוק.</p>

  <h2>מי בונה את זה</h2>
  <p>את האתר בונה ומתחזק ${AUTHOR}, מפתח תוכנה, לבד. זה אינו
     פרויקט של מועדון, של ליגה או של גוף רשמי כלשהו, ואין לו שום
     קשר אליהם. אין כאן צוות, אין חברה ואין מודל עסקי — פרויקט
     אוהדים שנבנה מתוך עניין בכדורגל הישראלי ובנתונים שלו.
     לכל דבר: <a href="mailto:${MAIL}">${MAIL}</a>.</p>

  <h2>איך זה התחיל</h2>
  <p>הגרסה הראשונה הייתה <b>ביתרדל</b> — מועדון אחד, בית"ר
     ירושלים, ולוח חידות אחד. היא עבדה, אנשים שיחקו בה כל יום,
     והבקשה שחזרה הכי הרבה הייתה מועדונים נוספים. מכאן נולד
     SportDle: חמישה מועדונים, ולכל אחד מאגר, לוח חידות, רצף
     וסטטיסטיקה נפרדים. העמוד המקורי לא נמחק והוא עוד חי
     ב-<a href="${base}/beitardle/">beitardle</a>, עם ההיסטוריה שלו.</p>
  <!-- הקישור הזה מוחלט בכוונה. /beitardle/ נוצר בשורש מאגר
       הפריסה (tools/archive-legacy.mjs) ואינו חלק מ-dist, ולכן
       קישור יחסי מתוך /sportdle/about/ היה מוביל ל-404. -->

  <h2>המאגר, ולמה הוא הדבר החשוב כאן</h2>
  <p>המאגר מכיל ${tot.toLocaleString("he-IL")} רשומות שחקנים
     בחמשת המועדונים, בטווח העונות ${season(from)}–${season(to)}.
     ${shown.toLocaleString("he-IL")} מהן מופיעות במשחק, ומתוכן
     ${pool.toLocaleString("he-IL")} יכולות לשמש כתשובה לחידה.
     הנתונים נאספו ואומתו מול כמה מקורות בלתי תלויים: אתר
     ההתאחדות לכדורגל, worldfootball, ויקיפדיה בעברית ובאנגלית
     וטרנספרמרקט.</p>
  <p>ההחלטה המרכזית בפרויקט היא מה <b>לא</b> להציג. שחקן שאין לו
     הסכמה בין שני מקורות בלתי תלויים אינו מופיע במשחק — לא
     כחידה ולא כניחוש. כרגע ${hid.toLocaleString("he-IL")} רשומות
     מוסתרות מהסיבה הזאת — הן במאגר, ואינן במשחק. זו החלטה
     שמקטינה את המשחק בכוונה:
     חידה שהתשובה שלה שגויה גרועה יותר מחידה שלא קיימת, ומשחק
     ידע שאי אפשר לסמוך עליו מאבד את כל המשמעות שלו.</p>
  <p>מכאן שגם טעויות נלקחות ברצינות. אם ראית פרט שגוי — עמדה,
     שנה, לאום — יש בתוך המשחק קישור לדיווח, וכל דיווח נבדק מול
     המקורות לפני שהוא נכנס. תיקונים מגיעים מפותרים לעתים
     קרובות יותר מאשר מהמקורות עצמם.</p>

  <h2>מה אין כאן</h2>
  <p>אין חשבון, אין הרשמה ואין סיסמה. ההתקדמות, הרצף
     והסטטיסטיקה נשמרים ב-<code>localStorage</code> בדפדפן שלך
     ולא נשלחים לשרת. הפירוט המלא נמצא ב<a href="${up(1)}privacy/">מדיניות
     הפרטיות</a>.</p>`;
    add("about/", shell({
      depth: 1, path: "about/", base, siteName: site.name,
      title: `אודות · ${site.name}`,
      desc: `מי בונה את SportDle, איך נבנה מאגר השחקנים של חמשת המועדונים, ולמה שחקן לא מאומת אינו מופיע במשחק.`,
      h1: "אודות", kicker: "מי עומד מאחורי המשחק, ואיך נבנה המאגר.",
      crumbs: [HOME, { he: "אודות", path: "about/" }], body,
      jsonld: {
        "@context": "https://schema.org", "@type": "AboutPage",
        name: `אודות ${site.name}`, url: `${base}/about/`,
        author: { "@type": "Person", name: AUTHOR, email: MAIL }
      }
    }));
  }

  /* ==================== 2. צור קשר ==================== */
  {
    const body = `
  <p>הדרך היחידה, והיא נקראת: <a href="mailto:${MAIL}"><b>${MAIL}</b></a>.
     אין טופס ואין בוט — המייל מגיע לאדם.</p>

  <h2>מצאת טעות בפרטי שחקן?</h2>
  <p>זה הדיווח המועיל ביותר, ואני מבקש אותו במפורש. כדי שאוכל
     לבדוק ולתקן, כתוב <b>מה</b> שגוי ו<b>מה</b> הפרט הנכון —
     למשל "העמדה של X היא הגנה ולא קישור", או "Y שיחק במועדון עד
     2011 ולא עד 2010". אם יש לך מקור, אפילו קישור אחד, זה מקצר
     את הבדיקה מאוד.</p>
  <p>בתוך המשחק עצמו, מתחת לתשובה, יש קישור <b>"טעות בפרטי
     השחקן?"</b> שממלא את הפרטים מראש. הוא נוח יותר ממייל מאפס.</p>

  <h2>באג, או משהו שנראה שבור</h2>
  <p>עוזר לי מאוד לדעת שלושה דברים: באיזה מועדון, באיזה דפדפן
     או מכשיר, ומה ראית על המסך. צילום מסך שווה יותר מתיאור.</p>

  <h2>הצעת שחקן</h2>
  <p>אם שחקן חסר מהמאגר או שנראה לך שהוא צריך להיות בבריכת
     התשובות, כתוב לי את השם והמועדון. שים לב: שחקן נכנס למשחק
     רק כשיש עליו הסכמה בין שני מקורות בלתי תלויים, ולכן
     הוספה יכולה לקחת זמן או לא לקרות — לא מתוך חוסר עניין אלא
     כדי שלא ייכנסו נתונים שאינם מאומתים. הרקע המלא
     ב<a href="${up(1)}about/">אודות</a>.</p>

  <h2 id="delete">בקשת מחיקת נתונים</h2>
  <p>המשחק לא מחזיק חשבונות, ורוב מה שנוגע אליך — הרצף,
     הסטטיסטיקה והניחושים — יושב בדפדפן או במכשיר שלך, ומחיקת
     נתוני האתר או הסרת האפליקציה מוחקת אותו מיד ובלי לבקש דבר.</p>
  <p>שלושה דברים כן יכולים להגיע אליי, ואותם אפשר לבקש למחוק:</p>
  <ul>
    <li>דיווח שכתבת בטופס, כולל שדה "איך לחזור אליכם?" אם מילאת אותו</li>
    <li>דיווח על טעות בפרטי שחקן, כולל המזהה המקומי האקראי
        שנשלח איתו כדי למנוע כפילויות</li>
    <li>השם שהקלדת ב"קרב חברים", כל עוד החדר קיים</li>
  </ul>
  <p>לבקשה: מייל ל-<a href="mailto:${MAIL}">${MAIL}</a> עם המשפט
     "בקשת מחיקת נתונים" ותיאור שיאפשר לי לאתר את הרשומה — התאריך
     המשוער ומה כתבת, או השם שהקלדת בקרב חברים. <b>אין צורך
     להזדהות</b>, ואיני מבקש שום פרט נוסף. אני מוחק בתוך
     <b>30 יום</b> ומאשר במייל חוזר. הפירוט המלא של מה נשמר ולמה
     נמצא ב<a href="${up(1)}privacy/">מדיניות הפרטיות</a>.</p>

  <h2>עוד</h2>
  <p>שאלות על הפרטיות והנתונים שנשמרים — ראה
     <a href="${up(1)}privacy/">מדיניות פרטיות</a>. תנאי השימוש
     נמצאים <a href="${up(1)}terms/">כאן</a>.</p>`;
    add("contact/", shell({
      depth: 1, path: "contact/", base, siteName: site.name,
      title: `צור קשר · ${site.name}`,
      desc: `כתובת המייל של SportDle, ואיך לדווח על טעות בפרטי שחקן, על באג או להציע שחקן למאגר.`,
      h1: "צור קשר", kicker: "מייל אחד, ואדם אחד שקורא אותו.",
      crumbs: [HOME, { he: "צור קשר", path: "contact/" }], body,
      jsonld: {
        "@context": "https://schema.org", "@type": "ContactPage",
        name: "צור קשר", url: `${base}/contact/`, email: MAIL
      }
    }));
  }

  /* הדומיין נגזר מ-siteUrl ואינו מקודד בטקסט: החלפת דומיין
     השאירה כאן פעם אחת את הכתובת הישנה בתוך מדיניות הפרטיות,
     שהיא בדיוק המקום שבו אי-דיוק כזה עולה ביוקר. */
  const HOST = base.replace(/^https?:\/\//, "");

  /* ==================== 3. פרטיות ====================
     נבדק מול חוק הגנת הפרטיות (כולל תיקון 13), Apple 5.1.1 ומדיניות
     User Data של Google Play — אוקטובר 2026. **כל שינוי בקוד ששולח
     מידע החוצה מחייב עדכון כאן** — המזהה המקומי כבר נפל על זה פעם. */
  {
    const hasAnalytics = Boolean(site.analyticsUrl);
    const body = `
  <p class="kicker" style="margin-bottom:22px">עדכון אחרון: אוקטובר 2026</p>

  <p>SportDle הוא משחק ללא חשבונות — באתר ובאפליקציה. אין הרשמה,
     אין סיסמה ואין פרופיל. הדף הזה מפרט מה נשמר, איפה, למה, וכמה זמן.</p>
  <p>המדיניות חלה על האתר <b>${HOST}</b> ועל
     אפליקציית <b>SportDle</b> לאנדרואיד ול-iOS. האפליקציה מריצה
     בדיוק את אותו משחק, מקומית במכשיר.</p>
  <p><b>האחראי למידע</b> (בעל השליטה במאגר, כלשון חוק הגנת הפרטיות):
     ${AUTHOR}, הפועל בשם TechByNoam. לכל עניין של פרטיות:
     <a href="mailto:${MAIL}">${MAIL}</a>.</p>
  <p><b>אין חובה חוקית למסור לי מידע כלשהו.</b> כל מה שנשלח אליי
     נשלח ביוזמתך — טופס, דיווח או כניסה לקרב חברים. בלי אף אחד
     מהם אפשר לשחק בכל המשחק כרגיל.</p>

  <h2>מה נשמר במכשיר שלך</h2>
  <p>המשחק שומר את מצבו ב-<code>localStorage</code> של הדפדפן או
     האפליקציה. זהו אחסון מקומי, שנשאר במכשיר. נשמרים:</p>
  <ul>
    <li>הניחושים שלך בחידה הנוכחית, לכל מועדון בנפרד</li>
    <li>הרצף היומי, מספר הניצחונות והסטטיסטיקה שלך</li>
    <li>המועדון שבחרת, וסימון שראית את מסך ההסבר</li>
    <li>בקרב חברים: הכינוי האחרון שלך, הסכמתך לתנאי הקרב, ורשימת
        השחקנים שחסמת</li>
    <li><b>מזהה מקומי אקראי</b> שנוצר במכשיר. אין בו שם או פרט
        מזהה. הוא נשלח אליי כשאתה שולח דיווח תיקון, ובקרב חברים
        הוא המזהה שלך בחדר (ראה למטה)</li>
  </ul>
  <p><b>מחיקה:</b> ניקוי נתוני האתר בדפדפן, או הסרת האפליקציה, מוחק
     את כל אלה מיד. ההתקדמות אינה עוברת בין דפדפנים או מכשירים.</p>

  <h2>באפליקציה</h2>
  <p>האפליקציה היא אותו משחק, ארוז לרוץ במכשיר. מאגר השחקנים מותקן
     איתה, ולכן <b>היא עובדת בלי חיבור לאינטרנט</b>. כשיש חיבור, היא
     מורידה מהאתר עדכונים למאגר — בלי לשלוח עליך דבר.</p>
  <p><b>התראה יומית.</b> אם תאשר, האפליקציה תזכיר לך בבוקר שהחידה
     החדשה באוויר. ההתראה מתוזמנת <b>במכשיר עצמו</b> ואינה Push:
     אין שרת שמחזיק רשימת מכשירים, ואיני יודע אם קיבלת אותה. אפשר
     לבטל בכל עת בהגדרות המערכת.</p>
  <p><b>מה שאין באפליקציה:</b> אין גישה לאנשי קשר, למצלמה,
     למיקרופון, למיקום, לתמונות או לקבצים, ואין מזהה פרסום בשימוש.
     ההרשאות הן אינטרנט והתראות, והשנייה בהסכמתך.</p>

  <h2>איסוף שימוש</h2>
  ${hasAnalytics ? `<p>המשחק שולח מדידת שימוש בסיסית לנקודת קצה
     ב-Google Apps Script שבשליטתי: כמה משחקים שוחקו, באיזה מועדון,
     והאם נפתרו. הנתונים מצרפיים, ואין בהם שם, מייל או מזהה אישי.</p>
  <p>כמו בכל בקשת רשת, ספק השירות רואה בעת הבקשה כתובת IP ומזהה
     דפדפן (User-Agent). הם משמשים להעברת הבקשה ולאבחון תקלות.</p>`
    : `<p>האתר אינו מפעיל מערכת מדידה או ניתוח תנועה.</p>`}

  <h2 id="forms">טפסי דיווח</h2>
  <p><b>דיווח חופשי ("ספרו לי כאן").</b> נשלחים הטקסט שכתבת,
     המועדון והחידה, ו<b>שדה "איך לחזור אליכם?"</b> — שם או מייל.
     השדה אינו חובה. אם תמלא אותו, הוא משמש רק כדי לחזור אליך
     בעניין אותו דיווח.</p>
  <p><b>תיקון פרטי שחקן.</b> נשלחים שם השחקן, השדה שלטענתך שגוי,
     הערך הקיים והמוצע, והמזהה המקומי האקראי — כדי לזהות שני
     דיווחים זהים ולא לספור אותם פעמיים.</p>

  <h2>קרב חברים</h2>
  <p>בלשונית "קרב חברים" נוצר חדר משחק בזמן אמת. כדי שהמשתתפים יראו
     זה את זה, נשמרים בחדר: <b>הכינוי</b> שהקלדת, <b>המזהה המקומי
     האקראי</b> שלך, התשובות והניקוד. כל מי שמחזיק בקוד החדר יכול
     לראות אותם. אין חובה להקליד שם אמיתי, ואם אינך משתמש בלשונית,
     לא נשלח ממך דבר.</p>
  <p><b>דיווח וחסימה.</b> כשאתה מדווח על שחקן או חוסם אותו, נשלחים
     אליי הכינוי שלו, המזהה האקראי שלו וקוד החדר. אם הדיווח מוצדק,
     המזהה נכנס לרשימת הרחקה, ומשם אי אפשר לפתוח חדר או להצטרף לחדר,
     והכינוי מוסתר אצל כולם. רשימת החסומים שלך נשמרת רק במכשיר.</p>

  <h2>איפה המידע נשמר, ומי מעבד אותו</h2>
  <p>איני מוסר מידע לאף גורם. הוא נשמר אצל ספקי תשתית של Google,
     שמעבדים אותו בשמי: <b>Firebase Realtime Database</b> (חדרי
     הקרב ורשימת ההרחקה, בשרתים באיחוד האירופי), ו-<b>Google Apps
     Script</b>, <b>Google Sheets</b> ו-<b>Gmail</b> (מדידה, דיווחים
     ופניות). ייתכן שחלק מהמידע יאוחסן מחוץ לישראל.</p>

  <h2>כמה זמן</h2>
  <ul>
    <li><b>חדר קרב</b> נמחק כשאחרון המשתתפים יוצא ממנו. חדר שננטש
        בלי יציאה (סגרו את האפליקציה) נמחק בניקוי תקופתי, לפחות פעם
        בשלושה חודשים.</li>
    <li><b>דיווחים ופניות</b> נשמרים עד 12 חודשים, ונמחקים לאחר מכן.</li>
    <li><b>מזהה ברשימת ההרחקה</b> נשמר כל עוד ההרחקה בתוקף.</li>
    <li><b>נתוני מדידה מצרפיים</b> נשמרים ללא הגבלה. אין בהם מידע
        מזהה.</li>
  </ul>

  <h2>פרסום, ו-cookies של צד שלישי</h2>
  <p>בכוונתי להציג פרסומות. <b>באתר</b> באמצעות Google AdSense,
     <b>באפליקציה</b> באמצעות Google AdMob. כרגע אין פרסומות באף אחד
     מהם. הפירוט כאן ניתן מראש, כדי שיהיה גלוי לפני ההפעלה:</p>
  <ul>
    <li>Google, כספק צד שלישי, משתמשת ב-cookies כדי להציג
        פרסומות, כולל פרסומות על בסיס ביקורים באתר זה ובאתרים אחרים.</li>
    <li>ספקי צד שלישי ורשתות פרסום עשויים אף הם להשתמש ב-cookies
        ובמשואות אינטרנט (web beacons) למטרה זו.</li>
    <li>כשיוצגו פרסומות, גולשים מהאיחוד האירופי, מבריטניה ומשוויץ
        יתבקשו להסכים לפני שייעשה שימוש ב-cookies לפרסום מותאם.</li>
  </ul>
  <p><b>איך מבטלים:</b> ניתן לכבות פרסום מותאם אישית בעמוד
     <a href="https://adssettings.google.com/" target="_blank" rel="noopener nofollow">הגדרות
     המודעות של Google</a>, או דרך
     <a href="https://optout.aboutads.info/" target="_blank" rel="noopener nofollow">optout.aboutads.info</a>.
     חסימת cookies בדפדפן אינה פוגעת במשחק.</p>
  <p><b>באפליקציה:</b> באנדרואיד — הגדרות → פרטיות → מודעות →
     מחיקת מזהה הפרסום. ב-iOS — הגדרות → פרטיות ואבטחה → מעקב. אם
     האפליקציה תציג פרסומות ב-iOS, היא תבקש את אישורך במסך של אפל
     (ATT) לפני כל מעקב, וסירוב אינו פוגע במשחק.</p>

  <h2 id="rights">הזכויות שלך</h2>
  <p>המידע נאסף בהסכמתך, על סמך ההסבר בדף זה. לפי <b>חוק הגנת
     הפרטיות, התשמ"א-1981</b>, אתה רשאי לעיין במידע עליך שמוחזק אצלי,
     ולבקש לתקן או למחוק מידע שאינו נכון, שלם, ברור או מעודכן. אם
     אתה באיחוד האירופי, עומדות לך גם הזכויות לפי ה-GDPR.</p>
  <p><b>איך מבקשים:</b> מייל ל-<a href="mailto:${MAIL}">${MAIL}</a>
     עם תיאור — התאריך המשוער ומה כתבת, או הכינוי שהקלדת בקרב. אין
     צורך להזדהות: אין חשבונות, והתיאור הוא מה שמאפשר לי לאתר את
     הרשומה. אני עונה ומטפל בתוך <b>30 יום</b>.</p>
  <p>ליבת הנתונים של המשחק — שמות שחקנים, עמדות, שנים — היא מידע
     ספורט היסטורי ופומבי. שחקן שמבקש לתקן פרט עליו, או להסירו,
     מוזמן לפנות באותו מייל.</p>

  <h2>קטינים</h2>
  <p>המשחק מתאים לכל הגילים ואינו מבקש פרטים מזהים. ילדים מתחת
     לגיל 14 מתבקשים לא להקליד שם אמיתי בקרב חברים, ולא למלא פרטי
     קשר בטופס בלי הורה. הורה שמבקש למחוק מידע של ילדו מוזמן לפנות
     אליי במייל.</p>

  <h2>שינויים</h2>
  <p>שינוי מהותי במדיניות יפורסם בדף זה, עם תאריך העדכון בראשו —
     למשל כשהפרסומות יופעלו בפועל.</p>`;
    add("privacy/", shell({
      depth: 1, path: "privacy/", base, siteName: site.name,
      title: `מדיניות פרטיות · ${site.name}`,
      desc: `מדיניות הפרטיות של SportDle — באתר ובאפליקציה: מה נשמר במכשיר, מה נשלח, התראות, cookies של פרסום ואיך מבטלים.`,
      h1: "מדיניות פרטיות",
      kicker: "אין חשבונות. ההתקדמות נשמרת במכשיר שלך, ולא אצלי.",
      crumbs: [HOME, { he: "מדיניות פרטיות", path: "privacy/" }], body
    }));
  }

  /* ==================== 4. תנאי שימוש ==================== */
  {
    const body = `
  <p class="kicker" style="margin-bottom:22px">עדכון אחרון: אוקטובר 2026</p>

  <p>השימוש ב-SportDle — באתר או באפליקציה — מהווה הסכמה לתנאים
     שלהלן. אם אינך מסכים להם, אל תשתמש בהם.</p>

  <h2>מה זה</h2>
  <p>SportDle הוא משחק חידות יומי בחינם, פרויקט אוהדים פרטי,
     הזמין כאתר וכאפליקציה לאנדרואיד ול-iOS.
     הוא <b>אינו רשמי</b> ואינו מסונף למועדון, לליגה, להתאחדות
     לכדורגל או לכל גוף אחר. שמות המועדונים מוזכרים לשם תיאור
     עובדתי בלבד, והם סימנים של בעליהם.</p>

  <h2>שימוש מותר</h2>
  <p>מותר לשחק, לשתף קישורים ותוצאות, ולספר עלינו. אסור:</p>
  <ul>
    <li>להפעיל סקריפטים, בוטים או כלים אוטומטיים שמעמיסים על
        השירות או שואבים ממנו את המאגר בכמות</li>
    <li>לנסות לשבש את פעולת האתר, לעקוף מגבלות או לפגוע
        במשתמשים אחרים</li>
    <li>להשתמש בלשונית "קרב חברים" לפרסום תוכן פוגעני, מטריד או
        בלתי חוקי בשדה השם</li>
    <li>להציג את האתר או את תוכנו כאילו הם רשמיים או שלך</li>
  </ul>
  <p>אני שומר את הזכות לחסום גישה שפוגעת בשירות או במשתמשים.</p>

  <h2>קרב חברים: כינויים, דיווח וחסימה</h2>
  <p>התוכן היחיד שמשתמשים יוצרים ב-SportDle הוא הכינוי בקרב חברים,
     והוא גלוי רק לשחקנים באותו חדר. <b>אין שום סובלנות</b> לכינויים
     פוגעניים, גזעניים, מיניים, מאיימים או מסיתים, ולמשתמשים שמתנהגים
     כך.</p>
  <ul>
    <li><b>סינון:</b> כינוי שמכיל מילה פוגענית נחסם עוד לפני הכניסה
        לחדר, ומוסתר אם הופיע בכל זאת.</li>
    <li><b>דיווח:</b> ליד כל שחקן בחדר יש כפתור "דיווח". כל דיווח
        מגיע אליי ונבדק תוך 24 שעות.</li>
    <li><b>חסימה:</b> כפתור "חסימה" מסתיר את השחקן אצלך מיד, מנהל החדר
        מוציא אותו מהחדר, והחסימה מדווחת גם אליי.</li>
    <li><b>טיפול:</b> תוך 24 שעות מכל דיווח או חסימה אני בודק את
        הכינוי. כינוי פוגעני מוסר, והמשתמש שיצר אותו מורחק מקרב
        החברים — הוא לא יכול לפתוח חדר או להצטרף לחדר, והכינוי שלו
        מוסתר אצל כולם.</li>
    <li>אפשר לפנות אליי בכל עניין ב-<a href="mailto:${MAIL}">${MAIL}</a>.</li>
  </ul>
  <p>הכניסה לקרב חברים מהווה הסכמה לתנאים האלה.</p>

  <h2>קניין רוחני</h2>
  <p>הקוד, העיצוב, הטקסטים ומבנה המאגר של האתר הם שלי. העובדות
     עצמן — שמו של שחקן, עמדתו, השנים שבהן שיחק — הן מידע
     היסטורי פומבי ואינן בבעלות אף אחד, ואינני טוען לבעלות
     עליהן. סמלי מועדונים אינם בשימוש באתר.</p>
  <p>אם אתה בעל זכויות וסבור שתוכן באתר פוגע בהן, כתוב
     ל-<a href="mailto:${MAIL}">${MAIL}</a> ואטפל בזה.</p>

  <h2>דיוק, ואחריות</h2>
  <p>אני משתדל מאוד שהנתונים יהיו נכונים, ומסתיר במכוון שחקנים
     שאין עליהם הסכמה בין מקורות. עם זאת <b>ייתכנו טעויות</b>,
     והאתר מסופק "כמות שהוא" (AS IS) — לרלוונטיות, לדיוק, לזמינות
     או להתאמה למטרה מסוימת. אין להסתמך על תוכן האתר כמקור סמכותי.
     במידה המרבית שהדין מתיר, לא אהיה אחראי לנזק שייגרם מהשימוש
     בשירות החינמי. אין באמור כדי לפטור מאחריות לנזק שנגרם בזדון
     או ברשלנות רבתי.</p>
  <p>השירות אינו מתחייב לרצף פעולה. הוא עשוי להיות לא זמין,
     והנתונים המקומיים שלך עשויים להיאבד — למשל בניקוי הדפדפן או
     בהסרת האפליקציה. <b>גיבוי אינו קיים</b>, וההתקדמות אינה
     עוברת בין האתר לאפליקציה או בין מכשירים: הן נשמרות מקומית
     בכל אחד בנפרד.</p>

  <h2>שינויים בשירות ובתנאים</h2>
  <p>אני עשוי לשנות את המשחק ואת המאגר, או להפסיק את השירות. חידות
     שכבר פורסמו לא משנות את תשובתן — זה כלל שאני שומר עליו בקוד.</p>
  <p><b>שינוי מהותי בתנאים אלה</b> יפורסם באתר 7 ימים לפני כניסתו
     לתוקף, עם תאריך העדכון בראש הדף. המשך שימוש לאחר מכן מהווה
     הסכמה לגרסה המעודכנת.</p>

  <h2>פרטיות, ודין</h2>
  <p>הטיפול בנתונים מתואר ב<a href="${up(1)}privacy/">מדיניות
     הפרטיות</a>. על תנאים אלה יחולו דיני מדינת ישראל, וסמכות השיפוט
     בכל עניין הנוגע להם נתונה לבתי המשפט המוסמכים בישראל.</p>
  <p>הצהרת הנגישות נמצאת <a href="${up(1)}accessibility/">כאן</a>.</p>`;
    add("terms/", shell({
      depth: 1, path: "terms/", base, siteName: site.name,
      title: `תנאי שימוש · ${site.name}`,
      desc: `תנאי השימוש ב-SportDle: שימוש מותר, קניין רוחני, היעדר אחריות ושינויים בשירות.`,
      h1: "תנאי שימוש", kicker: "משחק חינמי · פרויקט אוהדים · לא רשמי.",
      crumbs: [HOME, { he: "תנאי שימוש", path: "terms/" }], body
    }));
  }

  /* ==================== 4ב. הצהרת נגישות ====================
     תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות),
     תקנה 35: כנראה פטור (אדם פרטי בלי מחזור), אבל ההצהרה מקטינה סיכון
     למכתבי דרישה. כשתהיה הכנסה מפרסום — לבדוק שוב את הפטור. */
  {
    const body = `
  <p class="kicker" style="margin-bottom:22px">עדכון אחרון: אוקטובר 2026</p>

  <p>SportDle מופעל בידי אדם פרטי, ללא מחזור עסקי. אני משתדל שהמשחק
     יהיה נגיש לכולם, ופועל לפי עקרונות התקן הישראלי <b>ת"י 5568</b>
     (המבוסס על WCAG 2.0, רמה AA), גם כשאין חובה לכך.</p>

  <h2>מה נעשה</h2>
  <ul>
    <li>המשחק ניתן להפעלה במקלדת, כולל בחירת שחקן מרשימת ההצעות</li>
    <li>הרמזים אינם מסתמכים על צבע בלבד: לרמזים המספריים יש גם חץ</li>
    <li>טקסט בהיר על רקע כהה, בניגודיות גבוהה</li>
    <li>שפת הדף מוגדרת לעברית, וכיוון הכתיבה מימין לשמאל</li>
  </ul>

  <h2>מה עדיין לא מושלם</h2>
  <p>הקרב בזמן אמת מוגבל בזמן, ולכן קשה יותר למי שמשתמש בטכנולוגיה
     מסייעת. אפשר לבחור בו זמן ארוך יותר בין רמז לרמז.</p>

  <h2>נתקלת בקושי?</h2>
  <p>כתוב לי ל-<a href="mailto:${MAIL}">${MAIL}</a> — מה ניסית לעשות,
     ובאיזה מכשיר ודפדפן. אחזור אליך ואטפל בזה. רכז הנגישות: ${AUTHOR}.</p>`;
    add("accessibility/", shell({
      depth: 1, path: "accessibility/", base, siteName: site.name,
      title: `הצהרת נגישות · ${site.name}`,
      desc: `הצהרת הנגישות של SportDle: מה נעשה כדי שהמשחק יהיה נגיש, מה עוד לא מושלם, ואיך פונים.`,
      h1: "הצהרת נגישות", kicker: "משחק לכולם.",
      crumbs: [HOME, { he: "הצהרת נגישות", path: "accessibility/" }], body
    }));
  }

  /* ==================== 5. איך משחקים ==================== */
  {
    /* ההדגמה בנויה מחידה שכבר פורסמה, ומשחקן אמיתי כניחוש.
       אם עוד לא פורסמה אף חידה, אין הדגמה — ולא נמציא אחת. */
    let demo = "";
    const cs = order[0];
    const sch = data[cs].schedule || [];
    if (pastCount >= 1 && sch.length) {
      const ansName = sch[0];
      const club = data[cs];
      const ans = club.players.find(p => p.he === ansName);
      const guess = club.players.find(p =>
        p.target && p.he !== ansName && p.spells.length && p.born);
      if (ans && guess) {
        const row = compareRow(guess, ans, NAT_HE, REGION);
        const cols = ["עמדה", "לאום", "עונה 1", "תארים", "נולד"];
        demo = `
  <h3>דוגמה מלאה, מחידה אמיתית</h3>
  <p>חידה #1 של ${esc(club.game)} — התשובה הייתה
     <b>${esc(ansName)}</b>. נניח שהניחוש הראשון שלך היה
     <b>${esc(guess.he)}</b>. זה מה שהיית מקבל:</p>
  <div class="demo"><table>
    <tr><th>ניחוש</th>${cols.map(c => `<th>${c}</th>`).join("")}</tr>
    <tr><td><b>${esc(guess.he)}</b></td>${
      row.map(c => `<td class="${c.s}">${esc(c.v)}</td>`).join("")}</tr>
  </table></div>
  <p>וכך קוראים את השורה: כל תא צבוע לפי מידת הקרבה, וחץ מופיע
     רק במספרים — הוא אומר לאיזה כיוון לזוז. הניחוש הבא שלך אמור
     לשמור על מה שיצא מדויק ולתקן את השאר.</p>`;
      }
    }

    const body = `
  <p>SportDle הוא משחק ניחוש יומי: בכל יום, לכל מועדון, נבחר
     שחקן אחד מסתורי מתוך הבריכה של אותו מועדון. יש לך
     <b>${maxGuesses} ניסיונות</b> למצוא אותו. הכל בחינם, בלי
     הרשמה, ואותה חידה בדיוק מוצגת לכולם באותו יום.</p>

  <h2>איך מנחשים</h2>
  <ol>
    <li>בחר מועדון. כל מועדון הוא משחק בפני עצמו — מאגר שחקנים,
        לוח חידות, רצף וסטטיסטיקה נפרדים.</li>
    <li>הקלד שם של שחקן. השדה משלים תוך כדי הקלדה, ואפשר להקליד
        גם איות חלופי או שם באנגלית.</li>
    <li>אחרי כל ניחוש נפתחת שורה עם חמישה רמזים, שמשווים את
        השחקן שניחשת לשחקן המסתורי.</li>
    <li>המשך לצמצם. פתרת — או שנגמרו הניסיונות והתשובה נחשפת.</li>
  </ol>

  <h2>מה כל צבע אומר</h2>
  <p>שלושה מצבים, וזו כל השפה של המשחק:</p>
  <ul>
    <li><span class="swatch sw-hit"></span><b>מדויק</b> —
        הרמז זהה לשחקן המסתורי.</li>
    <li><span class="swatch sw-near"></span><b>קרוב</b> —
        לא נכון, אבל קרוב מאוד. המשמעות המדויקת משתנה בין
        הרמזים, וכתובה בטבלה למטה.</li>
    <li><span class="swatch sw-miss"></span><b>רחוק</b> —
        לא זה, ולא קרוב.</li>
  </ul>
  <p>בשלושת הרמזים המספריים מופיע גם <b>חץ</b>:
     <b>↑</b> פירושו שהשחקן המסתורי גבוה או מאוחר יותר,
     <b>↓</b> פירושו נמוך או מוקדם יותר. החץ הוא הכלי היעיל
     ביותר במשחק — הוא חוצה את טווח החיפוש בכל ניחוש.</p>

  <h2>חמשת הרמזים, במדויק</h2>
  <div class="tbl"><table>
    <tr><th>רמז</th><th>מה זה</th><th>מתי "קרוב"</th></tr>
    <tr><td><b>עמדה</b></td><td>שוער, הגנה, קישור או התקפה</td>
        <td>קו שכן בסדר שוער→הגנה→קישור→התקפה</td></tr>
    <tr><td><b>לאום</b></td><td>הלאום שבמאגר</td>
        <td>אותו אזור בעולם, מדינה אחרת</td></tr>
    <tr><td><b>עונה 1</b></td><td>העונה הראשונה של השחקן במועדון</td>
        <td>עד שלוש שנים הפרש</td></tr>
    <tr><td><b>תארים</b></td><td>תארי המועדון בשנים שבהן היה בסגל</td>
        <td>הפרש של תואר אחד</td></tr>
    <tr><td><b>נולד</b></td><td>שנת הלידה</td>
        <td>עד שלוש שנים הפרש</td></tr>
  </table></div>
  <p>שני דברים ששווה לדעת על "תארים": הוא נספר לפי <b>נוכחות
     בסגל</b> בעונה שבה המועדון זכה, ולא לפי תרומה למשחקים.
     ולכן שחקן מתקופה מוצלחת יקבל מספר גבוה גם אם שיחק מעט.
     זה הופך את הרמז הזה למצביע חזק על <b>תקופה</b>, לא על
     איכות.</p>
  ${demo}

  <h2>ניקוד, רצף וסטטיסטיקה</h2>
  <p>אין ניקוד בנקודות. מה שנמדד הוא בכמה ניחושים פתרת, והמשחק
     שומר לך לכל מועדון בנפרד: מספר המשחקים, אחוז הפתירה,
     ההתפלגות לפי מספר ניחושים, הרצף הנוכחי והרצף הטוב ביותר.
     הרצף עולה ביום שבו פתרת, ומתאפס ביום שהחמצת. הכל נשמר
     בדפדפן שלך בלבד — ראה <a href="${up(1)}privacy/">פרטיות</a>.</p>

  <h2>שיטה שעובדת</h2>
  <p>הניחוש הראשון לא צריך להיות ניסיון לפגוע, אלא ניסיון
     ל<b>מדוד</b>. שחקן מוכר מתקופה מרכזית במועדון פותח את חמשת
     הרמזים בבת אחת ונותן ארבעה חצים לעבוד איתם. משם: תן קודם
     לחצים לצמצם את השנים, ורק כשהטווח קטן — נסה שם מסוים.
     העמדה והלאום מצמצמים את הרשימה הכי הרבה, ולכן שווה לנעול
     אותם מוקדם.</p>

  <h2>עוד</h2>
  <p>בלשונית <b>קרב חברים</b> אפשר לפתוח חדר ולשחק את אותה חידה
     עם חברים בזמן אמת. חידות שפורסמו נמצאות
     ב<a href="${up(1)}archive/">ארכיון</a>, וכל התשובות שהיו
     מקושרות משם לדף השחקן.</p>`;

    add("how-to-play/", shell({
      depth: 1, path: "how-to-play/", base, siteName: site.name,
      title: `איך משחקים · ${site.name}`,
      desc: `הכללים המלאים של SportDle: ${maxGuesses} ניסיונות, חמישה רמזים, מה אומר כל צבע וכל חץ, ודוגמה מחידה אמיתית.`,
      h1: "איך משחקים",
      kicker: `${maxGuesses} ניסיונות, חמישה רמזים, שחקן אחד.`,
      crumbs: [HOME, { he: "איך משחקים", path: "how-to-play/" }], body,
      jsonld: {
        "@context": "https://schema.org", "@type": "HowTo",
        name: "איך משחקים ב-SportDle", url: `${base}/how-to-play/`,
        step: [
          { "@type": "HowToStep", name: "בחירת מועדון" },
          { "@type": "HowToStep", name: "הקלדת שם שחקן" },
          { "@type": "HowToStep", name: "קריאת חמשת הרמזים" },
          { "@type": "HowToStep", name: "צמצום עד לתשובה" }
        ]
      }
    }));
  }

  /* ==================== 6. ארכיון ==================== */
  {
    /* מספר החידות שיש להן תשובה בכל המועדונים */
    const maxN = Math.min(pastCount, ...order.map(s => (data[s].schedule || []).length));

    const rows = [];
    for (let n = maxN; n >= 1; n--) {
      const d = dateOf(n - 1);
      const answers = order
        .map(s => (data[s].schedule || [])[n - 1])
        .filter(Boolean);
      rows.push(`  <a class="card" href="${up(1)}archive/${n}/">
    <div class="n">חידה #${n} · ${dateHe(d)}</div>
    <div class="t">${answers.length} תשובות</div>
    <div class="s">${answers.map(esc).join(" · ")}</div>
  </a>`);
    }

    const body = maxN < 1 ? `
  <p>עוד לא פורסמה אף חידה. הארכיון מתמלא מעצמו: כל בוקר,
     כשהחידה של אתמול מפסיקה להיות החידה של היום, נוסף לה דף.</p>`
    : `
  <p>כל החידות שפורסמו, מהחדשה לישנה. לכל חידה דף משלה עם
     התאריך והתשובה בכל אחד מחמשת המועדונים, וקישור לדף השחקן.</p>
  <div class="note">החידה של <b>היום</b> אינה כאן, וגם לא תופיע
     כאן עד מחר — הארכיון נחתך בכוונה על החידה של אתמול.</div>
  <div class="cards">
${rows.join("\n")}
  </div>
  <p>הארכיון גדל בכל יום. ${maxN} ${maxN === 1 ? "חידה" : "חידות"}
     עד כה.</p>`;

    add("archive/", shell({
      depth: 1, path: "archive/", base, siteName: site.name,
      title: `ארכיון החידות · ${site.name}`,
      desc: `כל החידות היומיות שפורסמו ב-SportDle, מהחדשה לישנה, עם התשובות בכל חמשת המועדונים.`,
      h1: "ארכיון", kicker: "כל החידות שפורסמו, והתשובות שלהן.",
      crumbs: [HOME, { he: "ארכיון", path: "archive/" }], body,
      jsonld: {
        "@context": "https://schema.org", "@type": "CollectionPage",
        name: "ארכיון החידות", url: `${base}/archive/`
      }
    }));

    /* ---------- דף לכל חידה ---------- */
    for (let n = 1; n <= maxN; n++) {
      const d = dateOf(n - 1);
      const items = order.map(s => {
        const name = (data[s].schedule || [])[n - 1];
        if (!name) return "";
        const rec = bySlug.get(`${s}/${name}`);
        const p = rec && rec.p;
        const meta = p ? [
          POS_HE[p.pos],
          p.spells.map(([a, b]) => `${season(a)}–${season(b)}`).join(", "),
          `${seasonsIn(p.spells)} עונות`
        ].filter(Boolean).join(" · ") : "";
        return `  <a class="card"${cardTint(data[s])} href="${rec ? up(2) + rec.path : up(2)}">
    <div class="n">${esc(data[s].game)}</div>
    <div class="t">${esc(name)}</div>
    ${meta ? `<div class="s">${esc(meta)}</div>` : ""}
  </a>`;
      }).filter(Boolean);

      const prev = n > 1 ? `<a href="${up(1)}${n - 1}/">← חידה #${n - 1}</a>` : "<span></span>";
      const next = n < maxN ? `<a href="${up(1)}${n + 1}/">חידה #${n + 1} →</a>` : "<span></span>";

      const body = `
  <p>אלה היו התשובות של ${dateHe(d)}, בכל אחד מחמשת המועדונים.
     לחיצה על שחקן פותחת את דף השחקן שלו.</p>
  <div class="cards">
${items.join("\n")}
  </div>
  <div class="note">המשחק מגיש תמיד את החידה של <b>היום</b>, ולכן
     אי אפשר לשחק חידה מהארכיון מתוך הדף הזה.
     <a href="${up(2)}">לחידה של היום</a>.</div>
  <div class="pager">${prev}${next}</div>
  <p style="margin-top:20px"><a href="${up(1)}">↑ כל הארכיון</a></p>`;

      add(`archive/${n}/`, shell({
        depth: 2, path: `archive/${n}/`, base, siteName: site.name,
        title: `חידה #${n} · ${dateHe(d)} · ${site.name}`,
        desc: `התשובות לחידה #${n} של SportDle, ${dateNum(d)}, בכל חמשת המועדונים.`,
        h1: `חידה #${n}`, kicker: dateHe(d),
        crumbs: [HOME, { he: "ארכיון", path: "archive/" },
                 { he: `חידה #${n}`, path: `archive/${n}/` }],
        body,
        jsonld: {
          "@context": "https://schema.org", "@type": "Article",
          headline: `חידה #${n} — ${dateHe(d)}`,
          datePublished: dateOf(n - 1).toISOString().slice(0, 10),
          url: `${base}/archive/${n}/`,
          author: { "@type": "Person", name: AUTHOR }
        }
      }));
    }
  }

  /* ==================== 7א. מפתח השחקנים ====================
     בלי הדפים האלה 156 מדפי השחקן היו יתומים — אין אליהם מסלול
     מהשורש, ולכן גוזל לא מגיע אליהם בכלל. הם גם התוכן העשיר
     ביותר באתר: טבלת סגל שלמה לכל מועדון.
     tools/links.mjs מפיל את הבנייה אם דף חוזר להיות יתום. */
  {
    const cards = order.map(s => {
      const n = data[s].players.length;
      const cov = data[s].coverage;
      return `  <a class="card"${cardTint(data[s])} href="${up(1)}players/${s}/">
    <div class="n">${esc(data[s].he)}</div>
    <div class="t">${esc(data[s].game)}</div>
    <div class="s">${n} שחקנים · ${season(cov.from)}–${season(cov.to)}</div>
  </a>`;
    });
    const allPlayable = order.reduce((a, s) => a + data[s].players.length, 0);
    add("players/", shell({
      depth: 1, path: "players/", base, siteName: site.name,
      title: `שחקנים · ${site.name}`,
      desc: `כל השחקנים שאפשר לנחש ב-SportDle, לפי מועדון: עמדה, שנים במועדון, מספר עונות ותארים.`,
      h1: "שחקנים",
      kicker: `${allPlayable} שחקנים בחמשת המועדונים.`,
      crumbs: [HOME, { he: "שחקנים", path: "players/" }],
      body: `
  <p>אלה כל השחקנים שאפשר להקליד במשחק. ${players.length} מהם יכולים
     גם להיות התשובה לחידה יומית, ולכל אחד מאלה דף עם מה שהמאגר
     יודע עליו — עמדה, לאום, שנת לידה, השנים במועדון, מספר
     העונות והתארים שנספרו בזמן שהיה בסגל.</p>
  <p>שחקן שאין עליו הסכמה בין שני מקורות בלתי תלויים אינו כאן
     ואינו במשחק. הרקע ב<a href="${up(1)}about/">אודות</a>.</p>
  <div class="cards">
${cards.join("\n")}
  </div>`,
      jsonld: {
        "@context": "https://schema.org", "@type": "CollectionPage",
        name: "שחקנים", url: `${base}/players/`
      }
    }));

    /* ---------- טבלת סגל לכל מועדון ----------
       הטבלה היא **מי שאפשר להקליד**, ולא מי שיכול להיות התשובה.
       שני הדברים אינם זהים: בריכת התשובות דורשת שתי עונות ומעלה,
       והמשחק מקבל כל שם במאגר. דווח מהשטח על שלומי אזולאי — שיחק
       בבית"ר עונה אחת בהשאלה, ולכן נעדר מהרשימה בזמן שהוא כן
       בתיבת החיפוש. מי שמחפש שם ולא מוצא אותו מסיק שהוא לא במשחק,
       וזה בדיוק ההפך מהאמת.

       דף אישי נשאר רק למי שבבריכה. לדף כזה יש מה לומר — באיזו
       חידה הוא היה התשובה — ולמי שאינו בבריכה אין, וזה גם היה
       מכפיל את דפי התוכן ב-710 בלי תוכן חדש. שורה בלי קישור
       אומרת את זה בדיוק: הוא במשחק, אין לו דף. */
    for (const s of order) {
      const club = data[s];
      const linked = new Map(players.filter(r => r.slug === s).map(r => [r.p.he, r]));
      const list = [...data[s].players]
        .sort((a, b) => a.spells[0][0] - b.spells[0][0] ||
                        a.he.localeCompare(b.he, "he"));
      const rows = list.map(p => {
        const r = linked.get(p.he);
        const name = r ? `<a href="${up(2)}players/${s}/${r.s}/">${esc(p.he)}</a>`
                       : esc(p.he);
        return `    <tr><td><b>${name}</b></td>` +
          `<td>${esc(POS_HE[p.pos] || "")}</td>` +
          /* טווח אחד לא נשבר באמצע; השורה נשברת רק בין טווחים */
          `<td>${p.spells.map(([a, b]) => `<span class="nw">${esc(`${season(a)}–${season(b)}`)}</span>`).join(", ")}</td>` +
          `<td>${seasonsIn(p.spells)}</td><td>${p.titles}</td></tr>`;
      });
      const inPool = list.filter(p => linked.has(p.he)).length;
      add(`players/${s}/`, shell({
        depth: 2, path: `players/${s}/`, base, siteName: site.name, club: { slug: s, colors: club.colors },
        title: `שחקני ${club.he} · ${site.name}`,
        desc: `${list.length} שחקני ${club.he} שאפשר לנחש ב-${club.game}, עם עמדה, שנים במועדון, מספר עונות ותארים.`,
        h1: `שחקני ${club.he}`,
        kicker: `${list.length} שחקנים שאפשר להקליד, לפי סדר העונה הראשונה במועדון.`,
        crumbs: [HOME, { he: "שחקנים", path: "players/" },
                 { he: club.he, path: `players/${s}/` }],
        body: `
  <p>כל השחקנים שאפשר לנחש ב-${esc(club.game)}, מסודרים לפי העונה
     הראשונה שלהם במועדון. "תארים" הוא מספר תארי המועדון בעונות
     שבהן השחקן היה בסגל — ראה
     <a href="${up(2)}how-to-play/">איך משחקים</a>.</p>
  <p><b>${inPool}</b> מהם יכולים גם להיות התשובה לחידה היומית, והם
     אלה שיש להם דף משלהם. השאר שיחקו במועדון עונה אחת בלבד, או
     שאין לנו את שנת הלידה שלהם — ובשני המקרים אפשר להקליד אותם,
     אבל לא להיות התשובה.</p>
  <div class="tbl"><table>
    <tr><th>שחקן</th><th>עמדה</th><th>שנים</th><th>עונות</th><th>תארים</th></tr>
${rows.join("\n")}
  </table></div>
  <p><a href="${up(2)}${s}/">לחידה של ${esc(club.game)}</a> ·
     <a href="${up(1)}">כל המועדונים</a> ·
     <a href="${up(2)}">לעמוד הראשי</a></p>`,
        jsonld: {
          "@context": "https://schema.org", "@type": "CollectionPage",
          name: `שחקני ${club.he}`, url: `${base}/players/${s}/`
        }
      }));
    }
  }

  /* ==================== 7ב. דף לכל שחקן ==================== */
  for (const rec of players) {
    const { club, slug, p } = rec;
    const spells = p.spells.map(([a, b]) => `${season(a)}–${season(b)}`).join(", ");
    const was = answered.get(`${slug}/${p.he}`) || [];

    /* רק שדות שקיימים. אין השלמה ואין ניחוש. */
    const facts = [
      ["עמדה", POS_HE[p.pos]],
      ["לאום", NAT_HE[p.nat] || p.nat],
      ["שנת לידה", p.born],
      ["עונות במועדון", seasonsIn(p.spells)],
      ["תארים בזמן שהיה בסגל", p.titles],
      ["טווח שנים", spells]
    ].filter(([, v]) => v !== undefined && v !== null && v !== "");

    /* שחקנים מאותה תקופה במועדון — קישור פנימי אמיתי, ולא
       רשימה שרירותית: חופפים בלפחות עונה אחת. */
    const [af, al] = [p.spells[0][0], p.spells[p.spells.length - 1][1]];
    const mates = players
      .filter(r => r.slug === slug && r.p.he !== p.he &&
              r.p.spells.some(([a, b]) => a <= al && b >= af))
      .slice(0, 12);

    const body = `
  <p>${esc(playerSentence(p, club))}</p>
  <div class="facts">
${facts.map(([k, v]) => `    <div class="fact"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("\n")}
  </div>
${p.aliases && p.aliases.length ? `  <h2>איות חלופי</h2>
  <p>המשחק מקבל גם את הצורות האלה בשדה הניחוש:
     ${p.aliases.map(a => `<b>${esc(a)}</b>`).join(", ")}.</p>` : ""}

  <h2>מה המאגר לא מכיל</h2>
  <p>על ${esc(p.he)} יש כאן את מה שרשום למעלה, וזה הכל. המאגר
     אינו מכיל הופעות, שערים, גובה או פרטי ביוגרפיה, ולכן הם
     אינם מופיעים בדף הזה — במקום להשלים אותם בניחוש.</p>

${was.length ? `  <h2>היה התשובה</h2>
  <p>${esc(p.he)} היה התשובה ל${was.length === 1 ? "חידה" : "חידות"}
     ${was.map(n => `<a href="${up(3)}archive/${n}/">#${n}</a>`).join(", ")}
     של ${esc(club.game)}.</p>` : ""}

${mates.length ? `  <h2>מאותה תקופה ב${esc(club.he)}</h2>
  <p>שחקנים מבריכת התשובות שהיו במועדון באותן עונות:</p>
  <p>${mates.map(r => `<a class="chip" href="${up(3)}players/${r.slug}/${r.s}/">${esc(r.p.he)}</a>`).join("")}</p>` : ""}

  <h2>קישורים</h2>
  <p><a href="${up(1)}">כל שחקני ${esc(club.he)}</a> ·
     <a href="${up(3)}${slug}/">${esc(club.game)} — החידה של היום</a> ·
     <a href="${up(3)}archive/">ארכיון החידות</a> ·
     <a href="${up(3)}">לעמוד הראשי</a></p>`;

    add(rec.path, shell({
      depth: 3, path: rec.path, base, siteName: site.name, club: { slug, colors: data[slug].colors },
      title: `${p.he} · ${club.he} · ${site.name}`,
      desc: `${p.he} במאגר של ${club.he}: ` +
            [POS_HE[p.pos], spells, `${seasonsIn(p.spells)} עונות`].filter(Boolean).join(", ") + ".",
      h1: p.he, kicker: `${club.he} · ${spells}`,
      crumbs: [HOME, { he: "שחקנים", path: "players/" },
               { he: club.he, path: `players/${slug}/` },
               { he: p.he, path: rec.path }],
      body,
      jsonld: {
        "@context": "https://schema.org", "@type": "Person",
        name: p.he, url: `${base}/${encodeURI(rec.path)}`,
        ...(p.born ? { birthDate: String(p.born) } : {}),
        ...(POS_HE[p.pos] ? { jobTitle: `כדורגלן · ${POS_HE[p.pos]}` } : {})
      }
    }));
  }

  return { routes, pastCount, players: players.length };
}
