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

const POS_HE = { GK: "שוער", DF: "מגן", MF: "קשר", FW: "חלוץ" };
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
  { path: "terms",       he: "תנאי שימוש" }
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
   אותם טוקנים ואותם גופנים כמו המשחק. לא ייבאתי את ה-CSS של
   המשחק: הוא כתוב סביב הרשת, האריחים והמודאלים, ורובו לא נוגע
   לדף טקסט. שכפול שני עיצובים היה מזמין דריפט, ולכן מה שכאן הוא
   תת-קבוצה מכוונת — אותם משתנים בדיוק, מהמקור אחד. */
const CSS = `
:root{
  --ink:#0C0C0E; --ink-2:#141418; --ink-3:#1C1C22; --line:#2E2E36;
  --brand:#FFC72C; --near:#8A6A1C; --slate:#24242A;
  --text:#F2F2F0; --dim:#8C8C94; --r:10px;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{background:var(--ink);-webkit-text-size-adjust:100%}
html,body{margin:0;padding:0}
body{background:var(--ink);color:var(--text);font-family:'Heebo',system-ui,sans-serif;
  font-size:16px;line-height:1.7;min-height:100dvh;display:flex;flex-direction:column;
  padding-bottom:env(safe-area-inset-bottom)}
.wrap{max-width:640px;width:100%;margin:0 auto;padding:0 16px 40px;flex:1}
@media (min-width:640px){
  body{background:radial-gradient(900px 520px at 50% -8%, #1A1A21 0%, rgba(12,12,14,0) 68%), var(--ink)}
  .wrap{max-width:680px;padding:0 30px 56px;
        border-inline:1px solid rgba(46,46,54,.7)}
}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:16px 0 14px;border-bottom:1px solid rgba(46,46,54,.55);margin-bottom:22px}
.logo{font-family:'Suez One',Georgia,serif;font-size:22px;color:var(--brand);
  text-decoration:none;letter-spacing:-.5px}
.logo span{color:var(--text)}
.toplink{font-size:13px;color:var(--dim);text-decoration:none;border:1px solid var(--line);
  border-radius:999px;padding:6px 14px;white-space:nowrap}
.toplink:hover{color:var(--brand);border-color:var(--brand)}
.crumb{font-size:12.5px;color:#6A6A72;margin:0 0 14px}
.crumb a{color:#8C8C94;text-decoration:none}
.crumb a:hover{color:var(--brand)}
h1{font-family:'Suez One',Georgia,serif;font-size:clamp(27px,7.5vw,36px);line-height:1.15;
  margin:0 0 6px;color:var(--text)}
.kicker{color:var(--dim);font-size:14.5px;margin:0 0 26px}
h2{font-size:20px;font-weight:900;margin:32px 0 10px;color:var(--text)}
h3{font-size:16.5px;font-weight:700;margin:22px 0 6px;color:var(--brand)}
p{margin:0 0 14px;color:#DCDCD8}
a{color:var(--brand)}
ul,ol{margin:0 0 16px;padding-inline-start:22px;color:#DCDCD8}
li{margin-bottom:7px}
strong,b{color:var(--text);font-weight:700}
.note{background:var(--ink-3);border:1px solid var(--line);border-inline-start:3px solid var(--brand);
  border-radius:var(--r);padding:13px 15px;margin:0 0 22px;font-size:14.5px;color:#C9C9D1}
.note b{color:var(--brand)}
table{width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14.5px;display:block;
  overflow-x:auto;white-space:nowrap}
th,td{text-align:start;padding:9px 10px;border-bottom:1px solid rgba(46,46,54,.7)}
th{color:var(--dim);font-weight:500;font-size:13px}
td{color:#DCDCD8}
td b{color:var(--text)}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:0 0 22px}
.fact{background:var(--ink-2);border:1px solid var(--line);border-radius:var(--r);padding:11px 13px}
.fact .k{font-size:11.5px;color:var(--dim);display:block;margin-bottom:2px}
.fact .v{font-size:17px;font-weight:700;color:var(--text)}
.chip{display:inline-block;font-size:12.5px;color:#C9C9D1;background:var(--ink-3);
  border:1px solid var(--line);border-radius:999px;padding:5px 12px;margin:0 0 6px 6px;
  text-decoration:none}
.chip:hover{border-color:var(--brand);color:var(--brand)}
.cards{display:grid;gap:10px;margin:0 0 24px}
.card{display:block;background:var(--ink-2);border:1px solid var(--line);border-radius:var(--r);
  padding:13px 15px;text-decoration:none}
.card:hover{border-color:var(--brand)}
.card .n{font-size:12px;color:var(--dim)}
.card .t{font-size:16.5px;font-weight:700;color:var(--text);margin-top:1px}
.card .s{font-size:13px;color:var(--dim);margin-top:3px}
.swatch{display:inline-block;width:13px;height:13px;border-radius:3px;vertical-align:-2px;
  margin-inline-end:7px;border:1px solid rgba(255,255,255,.14)}
.sw-hit{background:var(--brand)} .sw-near{background:var(--near)} .sw-miss{background:var(--slate)}
.demo{border:1px solid var(--line);border-radius:var(--r);overflow-x:auto;margin:0 0 8px}
.demo table{margin:0;border:0}
.demo th{background:var(--ink-3)}
.demo td{font-size:13.5px}
.demo .hit{background:rgba(255,199,44,.15);color:var(--brand);font-weight:700}
.demo .near{background:rgba(138,106,28,.22);color:#D9BE7A}
.demo .miss{color:#9A9AA2}
.pager{display:flex;justify-content:space-between;gap:10px;margin:24px 0 0;font-size:14px}
.pager a{text-decoration:none}
footer{border-top:1px solid rgba(46,46,54,.55);margin-top:34px;padding:16px 0 0;
  font-size:12px;color:#55555E;line-height:1.9}
.sitenav{display:flex;flex-wrap:wrap;gap:0 6px;margin-bottom:10px}
.sitenav a{color:#8C8C94;text-decoration:none;font-size:12.5px}
.sitenav a:hover{color:var(--brand)}
.sitenav span{color:#3A3A42}
footer .who a{color:#55555E;text-decoration:none}
footer .who a:hover{color:var(--dim)}
`;

/* ---------- הפוטר המשותף ----------
   אותו סימן בדיוק גם במסך המשחק (src/template.html), כדי שדף
   התוכן והמשחק ייראו כמו אתר אחד ולא כמו שני אתרים. */
export function navHtml(depth) {
  const u = up(depth);
  return `<nav class="sitenav" aria-label="ניווט באתר">` +
    `<a href="${u}">חידה יומית</a>` +
    NAV.map(n => `<span>·</span><a href="${u}${n.path}/">${n.he}</a>`).join("") +
    `</nav>`;
}

/* ---------- שלד הדף ---------- */
function shell({ depth, path, title, desc, h1, kicker, body, crumbs, base, siteName, jsonld }) {
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

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
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
<meta name="theme-color" content="#0C0C0E">
<link rel="icon" href="${u}favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="${u}icon-32.png">
<link rel="apple-touch-icon" href="${u}icon-180.png">
<link rel="stylesheet" href="${u}fonts.css">
<style>${CSS}</style>
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
  out.push({ v: NAT_HE[g.nat] || g.nat,
    s: g.nat === a.nat ? "hit" : (REGION[g.nat] && REGION[g.nat] === REGION[a.nat] ? "near" : "miss") });
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
     למשל "העמדה של X היא מגן ולא קשר", או "Y שיחק במועדון עד
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

  /* ==================== 3. פרטיות ====================
     ⚠ טיוטה. חייבת אישור של בעל האתר לפני פרסום — ראה ההערה
        בגוף הדף ובראש הקובץ הזה. */
  {
    const hasAnalytics = Boolean(site.analyticsUrl);
    const body = `
  <p class="kicker" style="margin-bottom:22px">עדכון אחרון: ספטמבר 2026</p>

  <p>SportDle הוא משחק ללא חשבונות — באתר ובאפליקציה. אין הרשמה,
     אין סיסמה ואין פרופיל. אין דרך לדעת מי אתה, וגם לא צריך.
     הדף הזה מפרט מה כן נשמר, איפה, ולמה.</p>
  <p>המדיניות חלה על האתר <b>sportsdel.techbynoam.com</b> ועל
     אפליקציית <b>SportDle</b> לאנדרואיד ול-iOS. האפליקציה מריצה
     בדיוק את אותו משחק, מקומית במכשיר.</p>

  <h2>מה נשמר במכשיר שלך</h2>
  <p>המשחק שומר את מצבו ב-<code>localStorage</code> של הדפדפן.
     זהו אחסון מקומי: הוא נשאר במכשיר שלך, ואינו נשלח אליי.
     נשמרים:</p>
  <ul>
    <li>הניחושים שלך בחידה הנוכחית, לכל מועדון בנפרד</li>
    <li>הרצף היומי, מספר הניצחונות והסטטיסטיקה שלך</li>
    <li>המועדון שבחרת, כדי שייפתח בפעם הבאה</li>
    <li>סימון שראית את מסך ההסבר, כדי שלא ייפתח שוב</li>
    <li>מזהה מקומי אקראי, שנוצר בדפדפן ומשמש למניעת כפילויות
        בדיווחים</li>
  </ul>
  <p><b>מחיקה:</b> ניקוי נתוני האתר בדפדפן מוחק את כל אלה לחלוטין
     ומיד. אין לי עותק שלהם, ולכן גם אין לי מה למחוק בבקשתך.
     המשמעות היא גם שהרצף שלך אינו עובר בין דפדפנים או מכשירים.</p>

  <h2>באפליקציה</h2>
  <p>האפליקציה היא אותו משחק, ארוז לרוץ במכשיר. כל הקבצים —
     המנוע, העיצוב, הגופנים ומאגר השחקנים — מותקנים עם האפליקציה,
     ולכן <b>היא עובדת בלי חיבור לאינטרנט</b>. אין שרת שמגיש לה
     את החידה: היא מחשבת אותה מהתאריך, במכשיר.</p>
  <p><b>התראה יומית.</b> אם תאשר, האפליקציה תזכיר לך בבוקר שהחידה
     החדשה באוויר. ההתראה מתוזמנת <b>במכשיר עצמו</b> ואינה Push:
     אין שרת שמחזיק רשימת מכשירים, אין טוקן, ואיני יודע אם קיבלת
     אותה או לחצת עליה. הבקשה מופיעה רק אחרי שסיימת חידה ראשונה,
     ואפשר לבטל בכל עת בהגדרות המערכת.</p>
  <p><b>רטט ושיתוף.</b> רטט קל בכל אריח שנחשף — מקומי לגמרי.
     כפתור השיתוף פותח את גיליון השיתוף של המערכת עם טקסט
     התוצאה; מה שנשלח ולאן זה בשליטתך.</p>
  <p><b>מה שאין באפליקציה:</b> אין גישה לאנשי קשר, למצלמה,
     למיקרופון, למיקום, לתמונות או לקבצים. אין מזהה פרסום בשימוש.
     ההרשאות היחידות הן אינטרנט (ללשונית הקרב ולמדידה) והרשאת
     התראות, שהיא בהסכמתך.</p>

  <h2>איסוף שימוש</h2>
  ${hasAnalytics ? `<p>האתר שולח מדידת שימוש בסיסית לנקודת קצה
     ב-Google Apps Script שבשליטתי. הנתונים הם מצרפיים ותפעוליים
     — כמה משחקים שוחקו, באיזה מועדון, האם נפתר — ואין בהם שם,
     כתובת מייל או מזהה אישי. לא נעשה בהם שימוש לפרסום ממוקד ולא
     נמסרים לצד שלישי.</p>
  <p>כמו בכל בקשת רשת, ספק השירות רואה בעת הבקשה כתובת IP ומזהה
     דפדפן (User-Agent). הם משמשים להעברת הבקשה ולאבחון תקלות.</p>`
    : `<p>האתר אינו מפעיל מערכת מדידה או ניתוח תנועה.</p>`}

  <h2>קרב חברים</h2>
  <p>בלשונית "קרב חברים" נוצר חדר משחק בזמן אמת. השם שאתה מקליד
     והניחושים שלך במשחק הזה נשמרים בשירות Google Firebase כדי
     שהמשתתפים האחרים יראו אותם. השם הוא כל מה שאתה בוחר להקליד
     — אין חובה להזין שם אמיתי. חדרים הם זמניים. אם אינך משתמש
     בלשונית הזאת, לא נשלח ממך דבר.</p>

  <h2>פרסום, ו-cookies של צד שלישי</h2>
  <p>בכוונתי להציג פרסומות. <b>באתר</b> באמצעות Google AdSense,
     <b>באפליקציה</b> באמצעות Google AdMob — שתי מערכות נפרדות,
     כי AdSense אינו מיועד לאפליקציות. כרגע אין פרסומות באף אחד
     מהם. הפירוט כאן ניתן מראש, כדי שיהיה גלוי לפני ההפעלה:</p>
  <ul>
    <li>Google, כספק צד שלישי, משתמשת ב-cookies כדי להציג
        פרסומות.</li>
    <li>השימוש של Google ב-<b>cookie ה-DART</b> מאפשר לה ולשותפיה
        להציג פרסומות למשתמשים על בסיס ביקורים באתר זה ובאתרים
        אחרים באינטרנט.</li>
    <li>ספקי צד שלישי ורשתות פרסום עשויים אף הם להשתמש ב-cookies
        ובמשואות אינטרנט (web beacons) למטרה זו.</li>
  </ul>
  <p><b>איך מבטלים:</b> ניתן לכבות פרסום מותאם אישית בעמוד
     <a href="https://adssettings.google.com/" target="_blank" rel="noopener nofollow">הגדרות
     המודעות של Google</a>, או להצטרף לביטול הכללי דרך
     <a href="https://optout.aboutads.info/" target="_blank" rel="noopener nofollow">optout.aboutads.info</a>.
     חסימת cookies בהגדרות הדפדפן עובדת גם היא, ואינה פוגעת
     במשחק.</p>
  <p><b>באפליקציה:</b> באנדרואיד — הגדרות → פרטיות → מודעות →
     איפוס או מחיקת מזהה הפרסום. ב-iOS — הגדרות → פרטיות ואבטחה →
     מעקב, ושם אפשר למנוע מכל אפליקציה לבקש מעקב. אם וכאשר
     האפליקציה תציג פרסומות ב-iOS, היא תבקש את אישורך במסך של
     אפל (ATT) לפני כל מעקב, וסירוב אינו פוגע במשחק.</p>

  <h2>הבסיס החוקי, והזכויות שלך</h2>
  <p>לאחסון המקומי ההכרחי להפעלת המשחק — אינטרס לגיטימי בהפעלת
     השירות. ל-cookies של פרסום מותאם ולמדידה שאינה הכרחית —
     הסכמה, שניתן לחזור ממנה בכל עת בדרכים שלמעלה.</p>
  <p>לפי תקנת ה-GDPR יש לך זכות לעיין בנתונים הנוגעים אליך,
     לתקן אותם, למחוק אותם, להגביל את עיבודם, להתנגד לעיבוד
     ולקבל אותם בפורמט נייד. מכיוון שאיני מחזיק חשבונות ואיני
     שומר נתונים אישיים בשרת, בפועל כל הנתונים שלך נמצאים
     בדפדפן שלך ובשליטתך המלאה. לכל בקשה או שאלה:
     <a href="mailto:${MAIL}">${MAIL}</a>.</p>
  <p>ליבת הנתונים של המשחק — שמות שחקנים, עמדות, שנים — היא
     מידע ספורט היסטורי ופומבי, ואינה מידע אישי על מבקרי האתר.</p>

  <h2>קטינים</h2>
  <p>האתר אינו מיועד לגיוס נתונים מילדים ואינו מבקש פרטים
     מזהים מאף אחד.</p>

  <h2>שינויים</h2>
  <p>אם אשנה את המדיניות — למשל כשהפרסומות יופעלו בפועל —
     הדף הזה יעודכן.</p>`;
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
  <p class="kicker" style="margin-bottom:22px">עדכון אחרון: ספטמבר 2026</p>

  <p>השימוש ב-SportDle — באתר או באפליקציה — מהווה הסכמה לתנאים
     שלהלן. אם אינך מסכים להם, אל תשתמש בהם.</p>

  <h2>מה זה</h2>
  <p>SportDle הוא משחק חידות יומי בחינם, פרויקט אוהדים פרטי,
     הזמין כאתר וכאפליקציה לאנדרואיד ול-iOS.
     הוא <b>אינו רשמי</b> ואינו מסונף למועדון, לליגה, להתאחדות
     לכדורגל או לכל גוף אחר. שמות המועדונים מוזכרים לשם תיאור
     עובדתי בלבד.</p>

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
     והאתר מסופק "כמות שהוא" (AS IS) בלי אחריות מכל סוג —
     לרלוונטיות, לדיוק, לזמינות או להתאמה למטרה מסוימת. אין
     להסתמך על תוכן האתר כמקור סמכותי, ואיני נושא באחריות לנזק
     ישיר או עקיף שייגרם משימוש בו.</p>
  <p>השירות אינו מתחייב לרצף פעולה. הוא עשוי להיות לא זמין,
     והנתונים המקומיים שלך עשויים להיאבד — למשל בניקוי הדפדפן או
     בהסרת האפליקציה. <b>גיבוי אינו קיים</b>, וההתקדמות אינה
     עוברת בין האתר לאפליקציה או בין מכשירים: הן נשמרות מקומית
     בכל אחד בנפרד.</p>

  <h2>שינויים בשירות ובתנאים</h2>
  <p>אני עשוי לשנות את המשחק, את המאגר, את התנאים או להפסיק את
     השירות, בכל עת וללא הודעה מוקדמת. חידות שכבר פורסמו לא
     משנות את תשובתן — זה כלל שאני שומר עליו בקוד — אבל שאר
     חלקי האתר יכולים להשתנות. המשך שימוש לאחר שינוי מהווה
     הסכמה לגרסה המעודכנת.</p>

  <h2>פרטיות, ודין</h2>
  <p>הטיפול בנתונים מתואר ב<a href="${up(1)}privacy/">מדיניות
     הפרטיות</a>. על תנאים אלה יחולו דיני מדינת ישראל.</p>`;
    add("terms/", shell({
      depth: 1, path: "terms/", base, siteName: site.name,
      title: `תנאי שימוש · ${site.name}`,
      desc: `תנאי השימוש ב-SportDle: שימוש מותר, קניין רוחני, היעדר אחריות ושינויים בשירות.`,
      h1: "תנאי שימוש", kicker: "משחק חינמי · פרויקט אוהדים · לא רשמי.",
      crumbs: [HOME, { he: "תנאי שימוש", path: "terms/" }], body
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
  <table>
    <tr><th>רמז</th><th>מה זה</th><th>מתי "קרוב"</th></tr>
    <tr><td><b>עמדה</b></td><td>שוער, מגן, קשר או חלוץ</td>
        <td>עמדה שכנה בסדר שוער→מגן→קשר→חלוץ</td></tr>
    <tr><td><b>לאום</b></td><td>הלאום שבמאגר</td>
        <td>אותו אזור בעולם, מדינה אחרת</td></tr>
    <tr><td><b>עונה 1</b></td><td>העונה הראשונה של השחקן במועדון</td>
        <td>עד שלוש שנים הפרש</td></tr>
    <tr><td><b>תארים</b></td><td>תארי המועדון בשנים שבהן היה בסגל</td>
        <td>הפרש של תואר אחד</td></tr>
    <tr><td><b>נולד</b></td><td>שנת הלידה</td>
        <td>עד שלוש שנים הפרש</td></tr>
  </table>
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
        return `  <a class="card" href="${rec ? up(2) + rec.path : up(2)}">
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
      const n = players.filter(r => r.slug === s).length;
      const cov = data[s].coverage;
      return `  <a class="card" href="${up(1)}players/${s}/">
    <div class="n">${esc(data[s].he)}</div>
    <div class="t">${esc(data[s].game)}</div>
    <div class="s">${n} שחקנים בבריכת התשובות · ${season(cov.from)}–${season(cov.to)}</div>
  </a>`;
    });
    add("players/", shell({
      depth: 1, path: "players/", base, siteName: site.name,
      title: `שחקנים · ${site.name}`,
      desc: `כל השחקנים שיכולים להיות תשובה ב-SportDle, לפי מועדון: עמדה, שנים במועדון, מספר עונות ותארים.`,
      h1: "שחקנים",
      kicker: `${players.length} שחקנים בבריכות התשובות של חמשת המועדונים.`,
      crumbs: [HOME, { he: "שחקנים", path: "players/" }],
      body: `
  <p>אלה השחקנים שיכולים להיות התשובה לחידה יומית. לכל אחד דף
     עם מה שהמאגר יודע עליו — עמדה, לאום, שנת לידה, השנים
     במועדון, מספר העונות והתארים שנספרו בזמן שהיה בסגל.</p>
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

    /* ---------- טבלת סגל לכל מועדון ---------- */
    for (const s of order) {
      const club = data[s];
      const list = players.filter(r => r.slug === s)
        .sort((a, b) => a.p.spells[0][0] - b.p.spells[0][0] ||
                        a.p.he.localeCompare(b.p.he, "he"));
      const rows = list.map(r => {
        const p = r.p;
        return `    <tr><td><b><a href="${up(2)}players/${s}/${r.s}/">${esc(p.he)}</a></b></td>` +
          `<td>${esc(POS_HE[p.pos] || "")}</td>` +
          `<td>${esc(p.spells.map(([a, b]) => `${season(a)}–${season(b)}`).join(", "))}</td>` +
          `<td>${seasonsIn(p.spells)}</td><td>${p.titles}</td></tr>`;
      });
      add(`players/${s}/`, shell({
        depth: 2, path: `players/${s}/`, base, siteName: site.name,
        title: `שחקני ${club.he} · ${site.name}`,
        desc: `${list.length} שחקנים מבריכת התשובות של ${club.he}, עם עמדה, שנים במועדון, מספר עונות ותארים.`,
        h1: `שחקני ${club.he}`,
        kicker: `${list.length} שחקנים בבריכת התשובות, לפי סדר העונה הראשונה במועדון.`,
        crumbs: [HOME, { he: "שחקנים", path: "players/" },
                 { he: club.he, path: `players/${s}/` }],
        body: `
  <p>כל השחקנים שיכולים להיות התשובה לחידה של ${esc(club.game)},
     מסודרים לפי העונה הראשונה שלהם במועדון. "תארים" הוא מספר
     תארי המועדון בעונות שבהן השחקן היה בסגל — ראה
     <a href="${up(2)}how-to-play/">איך משחקים</a>.</p>
  <table>
    <tr><th>שחקן</th><th>עמדה</th><th>שנים</th><th>עונות</th><th>תארים</th></tr>
${rows.join("\n")}
  </table>
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
      depth: 3, path: rec.path, base, siteName: site.name,
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
