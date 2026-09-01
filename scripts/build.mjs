/* ============================================================
   build.mjs — מרכיב את dist/index.html מהתבנית ומהמאגרים.

   הבנייה נכשלת אם אחת מבדיקות סעיף 8 במפרט נכשלת. זו לא
   אזהרה — קובץ שגוי לא נכתב, כי אחרי שהוא באוויר כבר מאוחר.
   ============================================================ */
import { rmSync, existsSync, cpSync } from "node:fs";
import {
  parseArgs, pickClubs, readJSON, readText, writeText, writeJSON,
  log, warn, die, normName, season
} from "./lib/util.mjs";
import { writeClubPages } from "./lib/clubpages.mjs";
import { writeContentPages } from "./lib/content.mjs";

const args  = parseArgs();
const clubs = pickClubs(args);
const site  = readJSON("config/site.json");

/* ============================================================
   טבלאות תרגום שמשותפות לכל המועדונים
   ============================================================ */
const NAT_HE = {
  IL:"ישראל", UA:"אוקראינה", HU:"הונגריה", GH:"גאנה", MK:"מקדוניה", PT:"פורטוגל",
  BR:"ברזיל", AR:"ארגנטינה", ES:"ספרד", FR:"צרפת", NG:"ניגריה", GE:"גאורגיה",
  CO:"קולומביה", RU:"רוסיה", CM:"קמרון", RO:"רומניה", UY:"אורוגוואי", CL:"צ'ילה",
  RS:"סרביה", HR:"קרואטיה", BA:"בוסניה", SI:"סלובניה", ME:"מונטנגרו", BG:"בולגריה",
  PL:"פולין", CZ:"צ'כיה", SK:"סלובקיה", NL:"הולנד", BE:"בלגיה", DE:"גרמניה",
  IT:"איטליה", EN:"אנגליה", SC:"סקוטלנד", IE:"אירלנד", SE:"שוודיה", NO:"נורווגיה",
  DK:"דנמרק", FI:"פינלנד", GR:"יוון", TR:"טורקיה", US:"ארצות הברית", CA:"קנדה",
  MX:"מקסיקו", PY:"פרגוואי", VE:"ונצואלה", PE:"פרו", EC:"אקוודור", CI:"חוף השנהב",
  SN:"סנגל", MA:"מרוקו", TN:"תוניסיה", DZ:"אלג'יריה", EG:"מצרים", ZA:"דרום אפריקה",
  CD:"קונגו", AO:"אנגולה", ML:"מאלי", GN:"גינאה", TG:"טוגו", BJ:"בנין", ZW:"זימבבואה",
  KE:"קניה", AU:"אוסטרליה", JP:"יפן", KR:"דרום קוריאה", UZ:"אוזבקיסטן", AM:"ארמניה",
  AZ:"אזרבייג'ן", MD:"מולדובה", BY:"בלארוס", LT:"ליטא", LV:"לטביה", EE:"אסטוניה",
  AL:"אלבניה", XK:"קוסובו", CH:"שווייץ", AT:"אוסטריה", IS:"איסלנד", JM:"ג'מייקה",
  CY:"קפריסין"
};
const EU = ["UA","HU","MK","PT","ES","FR","GE","RU","RO","RS","HR","BA","SI","ME","BG",
            "PL","CZ","SK","NL","BE","DE","IT","EN","SC","IE","SE","NO","DK","FI","GR",
            "TR","AM","AZ","MD","BY","LT","LV","EE","AL","XK","CH","AT","IS","CY"];
const AF = ["GH","NG","CM","CI","SN","MA","TN","DZ","EG","ZA","CD","AO","ML","GN","TG","BJ","ZW","KE"];
const SA = ["BR","AR","CO","UY","CL","PY","VE","PE","EC"];
const NA = ["US","CA","MX","JM"];
const AS = ["JP","KR","UZ","AU"];
const REGION = { IL: "ME" };
for (const c of EU) REGION[c] = "EU";
for (const c of AF) REGION[c] = "AF";
for (const c of SA) REGION[c] = "SA";
for (const c of NA) REGION[c] = "NA";
for (const c of AS) REGION[c] = "AS";

/* ============================================================
   בדיקות חובה
   ============================================================ */
const problems = [];
const fail = (club, msg) => problems.push(`[${club}] ${msg}`);

function checkClub(c) {
  const names = c.players.map(p => p.he);

  /* 1. אין שם עברי כפול באותו מועדון */
  const seen = new Map();
  for (const n of names) {
    const k = normName(n);
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  const dups = [...seen].filter(([, n]) => n > 1);
  if (dups.length)
    fail(c.slug, `${dups.length} שמות עבריים כפולים: ${dups.slice(0, 5).map(d => d[0]).join(", ")}`);

  /* 3. הלוח מכיל בדיוק את בריכת התשובות */
  const pool  = new Set(c.players.filter(p => p.target).map(p => normName(p.he)));
  const sched = c.schedule.map(normName);
  const orphans = sched.filter(n => !pool.has(n));
  const missing = [...pool].filter(n => !sched.includes(n));
  if (orphans.length) fail(c.slug, `בלוח ${orphans.length} שמות שאינם בבריכת התשובות: ${orphans.slice(0, 5).join(", ")}`);
  if (missing.length) fail(c.slug, `${missing.length} שחקנים בבריכה שאינם בלוח: ${missing.slice(0, 5).join(", ")}`);
  if (new Set(sched).size !== sched.length) fail(c.slug, "יש שם כפול בלוח החידות");

  /* 4. לכל שחקן בבריכה יש born ו-pos */
  const thin = c.players.filter(p => p.target && (!p.born || !p.pos));
  if (thin.length) fail(c.slug, `${thin.length} בבריכה בלי שנת לידה או עמדה: ${thin.slice(0, 5).map(p => p.he).join(", ")}`);

  /* 5. spells תקינים: a <= b, ממוינים, בלי חפיפה */
  for (const p of c.players) {
    const s = p.spells;
    if (!Array.isArray(s) || !s.length) { fail(c.slug, `${p.he}: אין spells`); continue; }
    for (let i = 0; i < s.length; i++) {
      const [a, b] = s[i];
      if (!(Number.isInteger(a) && Number.isInteger(b))) fail(c.slug, `${p.he}: spell לא שלם`);
      else if (a > b) fail(c.slug, `${p.he}: spell הפוך [${a},${b}]`);
      if (i && s[i - 1][1] >= a) fail(c.slug, `${p.he}: spells חופפים או לא ממוינים`);
    }
  }

  /* בדיקת שפיות מול הציפייה שהוגדרה ב-clubs.json */
  const cfg = clubs.find(x => x.slug === c.slug);
  if (cfg?.expect) {
    if (cfg.expect.players !== c.counts.players)
      fail(c.slug, `ציפינו ל-${cfg.expect.players} שחקנים, יש ${c.counts.players}`);
    if (cfg.expect.targets !== c.counts.targets)
      fail(c.slug, `ציפינו ל-${cfg.expect.targets} בבריכה, יש ${c.counts.targets}`);
  }
}

/* תגיות div מאוזנות.
   `</div>` אחד חסר בחלונית מודאלית בלע את בורר המועדונים כולו:
   הוא נשאר ב-DOM, נפתח, וגודלו אפס — כי אב־קדמון היה display:none.
   שום בדיקה קיימת לא תפסה את זה, והדפדפן מתקן בשקט. */
function checkTags(html) {
  const body = html.slice(html.indexOf("<body>"));
  const noScript = body.replace(/<script[\s\S]*?<\/script>/g, "");
  for (const tag of ["div", "section", "nav", "header", "footer"]) {
    const open  = (noScript.match(new RegExp(`<${tag}[\\s>]`, "g")) || []).length;
    const close = (noScript.match(new RegExp(`</${tag}>`, "g")) || []).length;
    if (open !== close)
      fail("html", `תגיות <${tag}> לא מאוזנות: ${open} נפתחו, ${close} נסגרו`);
  }
}

/* אין תלות ריצה בצד שלישי לגופנים.
   הגופנים מקומיים (tools/fonts.mjs). קישור לגוגל שיחזור לכאן
   ישבור את האפליקציה אופליין בשקט — הטקסט ייפול לגופן מערכת,
   הכל ייראה "כמעט נכון", ואף בדיקה לא תצעק. */
function checkFonts(html) {
  const ext = [...html.matchAll(/https?:\/\/fonts\.(?:googleapis|gstatic)\.com[^"')\s]*/g)]
    .map(m => m[0]);
  if (ext.length)
    fail("html", `גופן מקישור חיצוני — שובר אופליין: ${[...new Set(ext)].join(", ")}`);
  if (!/href="fonts\.css"/.test(html))
    fail("html", 'אין קישור ל-fonts.css — הרץ node tools/fonts.mjs');
  if (!existsSync("src/static/fonts.css"))
    fail("html", "חסר src/static/fonts.css — הרץ node tools/fonts.mjs");
}

/* 2. אין id כפול ב-HTML */
function checkIds(html) {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (dup.length) fail("html", `מזהים כפולים: ${[...new Set(dup)].join(", ")}`);
}

/* 6. טקסט השיתוף מכיל רק תווים מהמישור הבסיסי */
function checkShareChars(html) {
  const m = html.match(/const EMOJI = \{[\s\S]*?\};/);
  if (!m) return fail("html", "לא נמצא טבלת האמוג'ים");
  const styleM = html.match(/const SHARE_STYLE\s*=\s*"([^"]+)"/);
  const style = styleM ? styleM[1] : "safe";
  const set = new Function(`${m[0]}; return EMOJI[${JSON.stringify(style)}];`)();
  for (const [k, ch] of Object.entries(set)) {
    for (const cp of [...ch]) {
      if (cp.codePointAt(0) > 0xFFFF)
        fail("html", `תו השיתוף "${ch}" (${k}) מחוץ למישור הבסיסי — נשבר בוואטסאפ ווב`);
    }
  }
}

/* שני כפתורי הכותרת חייבים להשתנות יחד.
   כלל נפרד ל-#archBtn שהגיע אחרי הכלל המשותף גרם לכך שבמסך רחב
   הארכיון היה 33px והעזרה 30px, בגבהים שונים — וזה נראה עקום.
   כל כלל שקובע גודל או מיקום לאחד מהם חייב לכלול את שניהם. */
function checkHeaderButtons(html) {
  /* בלי הסרת ההערות, טקסט הערה שמזכיר #archBtn נקרא כסלקטור */
  const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"))
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...css.matchAll(/([^{};]*#(?:helpBtn|archBtn)[^{};]*)\{([^}]*)\}/g)];
  for (const [, sel, body] of rules) {
    if (!/\b(width|height|top)\s*:/.test(body)) continue;      // מיקום אופקי מותר בנפרד
    const both = sel.includes("#helpBtn") && sel.includes("#archBtn");
    if (!both)
      fail("html", `כלל שקובע גודל לכפתור כותרת אחד בלבד: "${sel.trim()}" — שניהם חייבים להשתנות יחד`);
  }
}

/* שורת הסמלים בשיתוף חייבת להיות מבודדת כיוונית.
   בלי זה היא מורכבת רק מתווים ניטרליים, הכיוון נקבע לפי הלקוח,
   ובוואטסאפ ווב היא מתהפכת — הרמז הימני על המסך מופיע שמאלי. */
function checkShareDir(html) {
  const m = html.match(/const grid = guesses\.map\([^\n]*\n?[^\n]*/);
  if (!m) return fail("html", "לא נמצאה בניית רשת השיתוף");
  if (!/RLI \+/.test(m[0]) || !/\+ PDI/.test(m[0]))
    fail("html", "רשת השיתוף בלי בידוד כיווני — היא תתהפך בוואטסאפ");
  for (const ch of ["⁧", "⁩"])
    if (!html.includes(ch)) fail("html", `חסר תו הבידוד U+${ch.codePointAt(0).toString(16).toUpperCase()}`);
}

/* 7. ה-JS עובר new Function בלי שגיאת תחביר.
   שני בלוקים: המנוע (סקריפט רגיל) והקרב (מודול). שניהם נבדקים —
   `node --check` על הקובץ לבדו לא היה תופס את זה. */
function checkSyntax(html) {
  const blocks = [...html.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)];
  if (!blocks.length) return fail("html", "לא נמצא בלוק סקריפט");
  blocks.forEach((m, i) => {
    const body = m[1].trim();
    if (!body) return;
    try { new Function(body); }
    catch (e) { fail("html", `שגיאת תחביר בבלוק סקריפט ${i + 1}: ${e.message}`); }
  });
}

/* ============================================================
   הרכבה
   ============================================================ */
const data = {};
for (const c of clubs) {
  const path = `data/clubs/${c.slug}.json`;
  if (!existsSync(path)) { warn(`${c.slug}: אין ${path} — מדלגים`); continue; }
  const d = readJSON(path);
  checkClub(d);
  /* שחקן בלי עמדה לא נכנס למשחק. העמדה היא הרמז הראשון בשורה,
     וסימן שאלה במקומה לא מלמד כלום — הוא נראה כמו תקלה. שחקן כזה
     גם לא יכול להיות תשובה, כי הבריכה דורשת עמדה ושנת לידה.

     שנת לידה חסרה לבדה היא סיפור אחר: נשארים ארבעה רמזים מתוך
     חמישה, וזה עדיין ניחוש שימושי. בית"ר מריצה 17 כאלה בייצור.

     הגבול כאן, ולא ב"חסרים שני השדות", כי שאיבת דפי השחקן של
     ההתאחדות ממלאת שנת לידה בלי עמדה — ובלי הכלל הזה היא הייתה
     מחזירה למשחק מאות שחקנים עם "?" בעמדה.

     המאגר נשאר שלם: `node tools/hidden.mjs` מוציא את הרשימה
     לתיקון, וברגע שיש עמדה השחקן חוזר מעצמו. המספרים שמוצגים
     לשחקן נספרים אחרי הסינון — אחרת הכותרת מבטיחה שחקנים שאי
     אפשר להקליד. */
  /* ומי שאין עליו שני מקורות בלתי תלויים גם הוא לא נכנס.
     ליאור אסולין הופיע ארבע עונות במכבי חיפה, היה חידה יומית,
     ומעולם לא שיחק שם — הוא נשען על מקור אחד. שורת השוואה על
     נתון שאיש לא מאשר גרועה מהיעדר השחקן: היא נראית סמכותית.
     הרשימה מ-`node tools/trust.mjs`, והרשומות נשארות במאגר. */
  const unconfirmed = new Set(
    (readJSON("data/review/unconfirmed.json", { clubs: {} }).clubs[c.slug] || []));
  const playable = d.players.filter(p => p.pos != null && !unconfirmed.has(p.he));
  const blocked = d.schedule.filter(n => unconfirmed.has(n));
  if (blocked.length)
    fail(c.slug, `${blocked.length} שמות בלוח החידות בלי אישור משני: ` +
                 `${blocked.slice(0, 5).join(", ")}`);
  const hidden = d.players.length - playable.length;
  const unconf = d.players.filter(p => p.pos != null && unconfirmed.has(p.he)).length;
  const spanYears = playable.flatMap(p => p.spells.flat());
  data[c.slug] = {
    slug: d.slug, he: d.he, short: d.short, game: d.game,
    colors: d.colors, titles: d.titles,
    coverage: { ...d.coverage, from: Math.min(...spanYears), to: Math.max(...spanYears) },
    counts: { players: playable.length,
              targets: playable.filter(p => p.target).length,
              hidden, unconfirmed: unconf },
    players: playable.map(p => ({
      he: p.he, pos: p.pos, nat: p.nat, born: p.born,
      spells: p.spells, titles: p.titles, target: p.target,
      ...(p.aliases?.length ? { aliases: p.aliases } : {})
    })),
    schedule: d.schedule
  };
}
if (!Object.keys(data).length) die("אין נתוני מועדון לבנות מהם. הרץ קודם enrich.");

const order = clubs.map(c => c.slug).filter(s => data[s]);

let engine = readText("src/engine.js");
const subst = {
  __SITE_URL__:      site.siteUrl.replace(/\/$/, ""),
  __START__:         JSON.stringify(site.start),
  __MAX__:           String(site.maxGuesses),
  __BUILD__:         site.build,
  __SHARE_STYLE__:   site.shareStyle,
  __ANALYTICS_URL__: site.analyticsUrl || "",
  __CLUBS__:         JSON.stringify(data),
  __CLUB_ORDER__:    JSON.stringify(order),
  __RESET__:         JSON.stringify(site.reset || {}),
  __NAT_HE__:        JSON.stringify(NAT_HE),
  __REGION__:        JSON.stringify(REGION)
};
for (const [k, v] of Object.entries(subst)) engine = engine.split(k).join(v);

/* לשונית הקרב. נטענת כ-<script type="module"> — ה-SDK של פיירבייס
   יורד רק כשנכנסים ללשונית, אז מי שמשחק רק את החידה לא משלם עליו. */
let versus = readText("src/versus.js", "");
if (versus) {
  versus = versus.split("__FIREBASE__").join(JSON.stringify(site.firebase || null, null, 2));
  if (!site.firebase)
    warn("config/site.json בלי firebase — לשונית הקרב תיטען ותיכשל בהודעה על המסך");
}

let html = readText("src/template.html");
html = html
  .split("__VERSUS__").join(versus)
  .split("__SITE_TITLE__").join(site.title)
  .split("__SITE_NAME__").join(site.name)
  .split("__SITE_URL__").join(site.siteUrl.replace(/\/$/, ""))
  /* תמונת התצוגה המקדימה נפרדת מ-SITE_URL: האתר יושב בתת-תיקייה,
     והתמונה יכולה לשבת בשורש */
  .split("__OG_IMAGE__").join(site.ogImage || site.siteUrl.replace(/\/$/, "") + "/og.png")
  /* Organization בעמוד הראשי. עמודי המועדון מחליפים אותו
     ב-BreadcrumbList — scripts/lib/clubpages.mjs */
  .split("__JSONLD__").join(JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: site.siteUrl.replace(/\/$/, "") + "/",
    logo: site.siteUrl.replace(/\/$/, "") + "/icon-512.png",
    email: "techbynoam@gmail.com",
    description: "משחק ניחוש יומי על כדורגלנים ישראלים, בחמישה מועדונים.",
    founder: { "@type": "Person", name: "נועם אדרי" },
    sameAs: ["https://techbynoam.com/"]
  }))
  .split("__ENGINE__").join(engine)
  /* הדבק המקומי של Capacitor. נכנס לאותו קובץ ולא כסקריפט חיצוני,
     כדי שהאפליקציה תעבוד אופליין בלי בקשה נוספת. */
  .split("__NATIVE__").join(readText("src/native.js", ""));

const leftovers = [...html.matchAll(/__[A-Z_]+__/g)].map(m => m[0]);
if (leftovers.length) fail("html", `נותרו מצייני מקום שלא הוחלפו: ${[...new Set(leftovers)].join(", ")}`);

checkTags(html);
checkIds(html);
checkFonts(html);
checkShareChars(html);
checkShareDir(html);
checkHeaderButtons(html);
checkSyntax(html);

if (problems.length) {
  console.error("\n✖ הבנייה נכשלה:\n" + problems.map(p => "  · " + p).join("\n") + "\n");
  die(`${problems.length} בדיקות נכשלו — dist לא נכתב.`);
}

/* ---------- כתיבה ---------- */
rmSync("dist", { recursive: true, force: true });
writeText("dist/index.html", html);
if (existsSync("src/static"))
  cpSync("src/static", "dist", { recursive: true,
    filter: src => !/README.md$/.test(src) });   // התיעוד נשאר במקור

/* manifest.json — התבנית מקשרת אליו, אז אנחנו מייצרים אותו.
   האייקונים עצמם הם קבצי מקור שצריך להניח ב-src/static/.

   start_url ו-scope נשארים יחסיים, ולא "/" — וזה נגד האינטואיציה,
   כי הדומיין הקנוני אכן מגיש את המשחק בשורש.

   הסיבה: הפריסה מעתיקה את dist/ ל-beitardle/sportdle/ (ראה
   .github/workflows/deploy.yml), ולכן אותם קבצים מוגשים גם מתחת
   ל-/sportdle/ בכתובת הישנה. "/" היה שולח את מי שהתקין את המשחק
   למסך הבית משם אל שורש beitardle — עמוד אחר לגמרי.

   ביחסי אין הכרעה כזאת: המניפסט יושב לצד index.html, ולכן "./"
   נפתר לשורש בדומיין החדש ול-/sportdle/ בישן. אותה התנהגות
   בשניהם, ובדומיין הקנוני זה בדיוק "/". tools/qa-deploy.mjs
   מפיל את הפריסה אם זה יהפוך למוחלט. */
if (!existsSync("dist/manifest.json"))
  writeJSON("dist/manifest.json", {
    name: site.title, short_name: site.name,
    start_url: "./", scope: "./", display: "standalone", dir: "rtl", lang: "he",
    background_color: "#0C0C0E", theme_color: "#0C0C0E",
    icons: [
      { src: "icon-32.png",  sizes: "32x32",   type: "image/png" },
      { src: "icon-180.png", sizes: "180x180", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  }, 2);

/* ---------- דפי התוכן ----------
   אודות, צור קשר, פרטיות, תנאים, איך משחקים, הארכיון ודף לכל
   שחקן בבריכת התשובות. לפני ה-sitemap, כי הוא נגזר מהכתובות
   שנכתבו כאן ולא מרשימה שנכתבת ביד. */
const content = writeContentPages({
  data, order, site, NAT_HE, REGION, maxGuesses: site.maxGuesses
});
log(`  נכתבו ${content.routes.length} דפי תוכן · ` +
    `${content.players} דפי שחקן · ${content.pastCount} חידות בארכיון`);

/* ---------- sitemap.xml ו-robots.txt ----------
   שניהם נגזרים מ-siteUrl ומהכתובות שנבנו, ולא נכתבים ביד: קובץ
   שמצביע לדומיין הישן גרוע מקובץ שלא קיים, כי גוגל מאמין לו. */
{
  const base = site.siteUrl.replace(/\/$/, "");
  const paths = ["/", ...order.map(s => `/${s}/`), ...content.routes];
  writeText("dist/sitemap.xml",
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    /* קצב ועדיפות לפי סוג הדף. "daily" על 500 דפי שחקן שלא
       משתנים הוא אות רועש, וגוזל מהזחלן את התקציב שהיה אמור
       ללכת לדפים שכן מתחלפים. */
    paths.map(p => {
      const g = p === "/" || /^\/[a-z-]+\/$/.test(p) && order.includes(p.slice(1, -1));
      const arc = /^\/archive\/\d+\/$/.test(p);
      const ply = p.startsWith("/players/");
      const freq = g ? "daily" : p === "/archive/" ? "daily" : arc ? "yearly" : "monthly";
      const pri  = p === "/" ? "1.0" : g ? "0.9"
                 : p === "/archive/" || p === "/how-to-play/" ? "0.7"
                 : ply ? "0.4" : arc ? "0.5" : "0.3";
      return "  <url>\n" +
      `    <loc>${base}${encodeURI(p)}</loc>\n` +
      `    <changefreq>${freq}</changefreq>\n` +
      `    <priority>${pri}</priority>\n` +
      "  </url>";
    }).join("\n") +
    "\n</urlset>\n");

  writeText("dist/robots.txt",
    "User-agent: *\n" +
    "Allow: /\n" +
    `Sitemap: ${base}/sitemap.xml\n`);
  log(`  נכתבו sitemap.xml (${paths.length} כתובות) ו-robots.txt`);
}

const pages = writeClubPages({ html, data, order, siteUrl: site.siteUrl });
log(`  נכתבו ${pages} עמודי מועדון — dist/<slug>/index.html`);

/* מזהירים על נכסים שהדף מבקש ולא קיימים — 404 בפרודקשן זה שקט מדי */
const wanted = ["favicon.ico", "icon-32.png", "icon-180.png"];
/* og.png נדרש רק אם לא הוגדרה תמונה חיצונית ב-config/site.json */
if (!site.ogImage) wanted.push("og.png");
const absent = wanted.filter(f => !existsSync(`dist/${f}`));
if (absent.length) warn(`נכסים חסרים (הדף מקשר אליהם): ${absent.join(", ")} — הנח ב-src/static/`);
writeJSON("dist/clubs.json", Object.fromEntries(
  order.map(s => [s, { game: data[s].game, ...data[s].counts, coverage: data[s].coverage }])), 2);

const kb = (html.length / 1024).toFixed(0);
log(`נכתב dist/index.html · ${kb}KB · גרסה ${site.build}`);
for (const s of order)
  log(`  ${data[s].game.padEnd(8)} ${String(data[s].counts.players).padStart(4)} שחקנים · ` +
      `${String(data[s].counts.targets).padStart(3)} בבריכה · ` +
      `${season(data[s].coverage.from)}–${season(data[s].coverage.to)}` +
      (data[s].counts.hidden
        ? ` · ${data[s].counts.hidden} מוסתרים` +
          ` (${data[s].counts.unconfirmed} בלי אישור משני)`
        : ""));
log("כל הבדיקות עברו.");
