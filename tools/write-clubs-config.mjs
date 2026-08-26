/* מרכיב את config/clubs.json מהמזהים שאומתו ומרשימות התארים
   שנגזרו ב-tools/parse-titles.mjs. כתיבה בסקריפט ולא ביד —
   21 אליפויות ו-19 גביעים למכבי ת"א זה בדיוק המקום שבו
   הקלדה ידנית מייצרת שנה שגויה. */
import { readJSON, writeJSON } from "../scripts/lib/util.mjs";

const T = readJSON("data/raw/titles.json");

/* worldfootball: אומת מול דפי הקבוצה עצמם.
   ifaTeamId: נלקח מטבלת ליגת WINNER (עונה 27) — קבוצה בוגרת בלבד.
   שני המזהים שכבר היו מאומתים (3595, 2171) יצאו מאותה טבלה זהים,
   וזו הבדיקה שהמספרים החדשים נכונים. */
const CLUBS = {
  beitar: {
    he: 'בית"ר ירושלים', short: 'בית"ר', game: "ביתרdle",
    worldfootball: "te214/beitar-jerusalem", ifaTeamId: 3595,
    wikiCategory: 'קטגוריה:כדורגלני בית"ר ירושלים',
    colors: { brand: "#FFC72C", near: "#8A6A1C", ink: "#0C0C0E", second: "#0C0C0E" },
    /* בייצור היו 119 בבריכה. שניים — מאיר קדוש ואילן אלהרר — נפלו
       ממנה רק כי לא הייתה להם שנת לידה, וויקיפדיה סיפקה אותה.
       שניהם נוספו בסוף הלוח, כך ש-119 החידות שכבר פורסמו לא זזו. */
    expect: { players: 410, targets: 121 }
  },
  "hapoel-bs": {
    he: "הפועל באר שבע", short: 'הפועל ב"ש', game: "באר־שבעdle",
    worldfootball: "te17757/hapoel-beer-sheva", ifaTeamId: 2171,
    wikiCategory: "קטגוריה:כדורגלני הפועל באר שבע",
    colors: { brand: "#E4002B", near: "#8C2233", ink: "#0C0C0E", second: "#0C0C0E" },
    /* המפרט ציפה ל-350/89, אבל זה מספר שמניח את worldfootball מ-1969.
       בלעדיו הכיסוי מתחיל ב-2002/03. משאירים בלי expect כדי שהבדיקה
       לא תשקר — היא תחזור ברגע ש-worldfootball ייכנס. */
    expect: null
  },
  "maccabi-ta": {
    he: "מכבי תל אביב", short: 'מכבי ת"א', game: "מכביdle",
    worldfootball: "te1258/maccabi-tel-aviv", ifaTeamId: 1061,
    wikiCategory: "קטגוריה:כדורגלני מכבי תל אביב",
    colors: { brand: "#0033A0", near: "#1F3A6E", ink: "#0C0C0E", second: "#FFD100" },
    expect: null
  },
  "maccabi-haifa": {
    he: "מכבי חיפה", short: "מכבי חיפה", game: "חיפהdle",
    worldfootball: "te1254/maccabi-haifa", ifaTeamId: 1005,
    wikiCategory: "קטגוריה:כדורגלני מכבי חיפה",
    colors: { brand: "#00843D", near: "#1E5B37", ink: "#0C0C0E", second: "#FFFFFF" },
    expect: null
  },
  "hapoel-ta": {
    he: "הפועל תל אביב", short: 'הפועל ת"א', game: "הפועלdle",
    worldfootball: "te956/hapoel-tel-aviv", ifaTeamId: 2176,
    wikiCategory: "קטגוריה:כדורגלני הפועל תל אביב",
    colors: { brand: "#C8102E", near: "#8C2233", ink: "#0C0C0E", second: "#FFFFFF" },
    expect: null
  }
};

const out = {
  _comment: "נבנה על ידי tools/write-clubs-config.mjs. " +
    "שנת התואר = השנה שבה העונה הסתיימה. גביע הטוטו לא נספר. " +
    "titles = אליפויות וגביעי מדינה מקום המדינה ואילך; " +
    "titlesPreState = תקופת המנדט, לא נספר במשחק (המאגר מתחיל ב-1969/70).",
  _source: {
    titles: "he.wikipedia — ליגת העל בכדורגל · גביע המדינה בכדורגל",
    ifaTeamId: "football.org.il — טבלת ליגת WINNER, season_id=27, קבוצה בוגרת",
    worldfootball: "worldfootball.net — דפי הקבוצה"
  }
};

for (const [slug, c] of Object.entries(CLUBS)) {
  const t = T[slug];
  out[slug] = {
    verified: true,
    he: c.he, short: c.short, game: c.game,
    worldfootball: c.worldfootball,
    ifaTeamId: c.ifaTeamId,
    wikiCategory: c.wikiCategory,
    colors: c.colors,
    titles: { league: t.league, cup: t.cup },
    titlesPreState: { league: t.leaguePreState, cup: t.cupPreState },
    ...(c.expect ? { expect: c.expect } : {})
  };
}

writeJSON("config/clubs.json", out, 2);
for (const [slug, c] of Object.entries(out)) {
  if (slug.startsWith("_")) continue;
  console.log(`${slug.padEnd(14)} wf=${String(c.worldfootball).padEnd(28)} ` +
    `ifa=${String(c.ifaTeamId).padEnd(5)} ${c.titles.league.length} אליפויות, ${c.titles.cup.length} גביעים`);
}
console.log("\n→ config/clubs.json");
