/* ============================================================
   enrich.mjs — מצליב את המקורות למאגר מוכן לכל מועדון.
   פלט:  data/clubs/<slug>.json   — מה שנכנס למשחק
         data/review/<slug>.json  — מה שצריך עין אנושית
         config/schedule-<slug>.json — לוח החידות המקובע

   כלל ברזל: אין התאמה אוטומטית לפי דמיון מחרוזות. רק שוויון
   מדויק אחרי נרמול. כל התאמה שמשנה שם פרטי או שם משפחה
   הולכת לקובץ הבדיקה ומחכה לאישור אנושי.
   ============================================================ */
import { existsSync } from "node:fs";
import {
  parseArgs, pickClubs, readJSON, writeJSON, log, warn, die,
  normName, normLatin, shortName, stripParen, hasYearDisambig, toSpells, seasonsIn, countTitles, season, nameVariants
} from "./lib/util.mjs";

const args  = parseArgs();
const clubs = pickClubs(args);
const SHUFFLE_SEED = readJSON("config/site.json").shuffleSeed || 20260825;

/* ערבוב דטרמיניסטי — אותו seed, אותו סדר, בכל הרצה */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, seed) {
  const rnd = mulberry32(seed), a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================
   1. איסוף שחקנים מהמקורות
   ============================================================ */

/* ביתר: הגרסה שרצה בייצור היא מקור האמת. היא כוללת גם את
   תיקוני העונות הידניים (ראה 6.5 במפרט) שאין בשום מקור אחר. */
function fromReference(raw) {
  return raw.players.map(p => ({
    he: p.he,
    name: p.name || null,
    pos: p.pos || null,
    nat: p.nat || null,
    born: p.born ?? null,
    years: null,
    spells: p.spells,
    aliases: [],
    src: ["reference"]
  }));
}

/* ההתאחדות: שם רשמי + ציר העונות. אין בה עמדה ואין שנת לידה. */
function fromIfa(raw) {
  const byId = new Map();
  for (const [endYear, list] of Object.entries(raw.seasons)) {
    for (const p of list) {
      const key = p.id || normName(p.full);
      if (!byId.has(key)) byId.set(key, {
        he: p.short, name: null, pos: null, nat: null, born: null,
        years: [], spells: null, aliases: [], src: ["ifa"],
        ifaId: p.id || null, official: p.full, foreign: false
      });
      const rec = byId.get(key);
      rec.years.push(+endYear);
      if (p.foreign) rec.foreign = true;
      /* השם הרשמי משתנה לפעמים בין עונות — שומרים את כולם לחיפוש */
      if (!rec.aliases.includes(p.full)) rec.aliases.push(p.full);
    }
  }
  return [...byId.values()];
}

/* worldfootball: שלד המאגר. שם באנגלית, עמדה, לאום, שנת לידה, עונות.
   זה המקור היחיד שמכסה 1969 ואילך. */
const NAT_FROM_EN = {
  "Israel":"IL","Ukraine":"UA","Hungary":"HU","Ghana":"GH","North Macedonia":"MK",
  "Macedonia":"MK","Portugal":"PT","Brazil":"BR","Argentina":"AR","Spain":"ES",
  "France":"FR","Nigeria":"NG","Georgia":"GE","Colombia":"CO","Russia":"RU",
  "Soviet Union":"RU","Cameroon":"CM","Romania":"RO","Uruguay":"UY","Chile":"CL",
  "Serbia":"RS","Serbia and Montenegro":"RS","Yugoslavia":"RS","Croatia":"HR",
  "Bosnia-Herzegovina":"BA","Bosnia and Herzegovina":"BA","Slovenia":"SI",
  "Montenegro":"ME","Bulgaria":"BG","Poland":"PL","Czech Republic":"CZ",
  "Czechoslovakia":"CZ","Slovakia":"SK","Netherlands":"NL","Belgium":"BE",
  "Germany":"DE","East Germany":"DE","Italy":"IT","England":"EN","Scotland":"SC",
  "Wales":"EN","Northern Ireland":"IE","Ireland":"IE","Republic of Ireland":"IE",
  "Sweden":"SE","Norway":"NO","Denmark":"DK","Finland":"FI","Greece":"GR",
  "Turkey":"TR","USA":"US","United States":"US","Canada":"CA","Mexico":"MX",
  "Paraguay":"PY","Venezuela":"VE","Peru":"PE","Ecuador":"EC","Bolivia":"BO",
  "Ivory Coast":"CI","Cote d'Ivoire":"CI","Senegal":"SN","Morocco":"MA",
  "Tunisia":"TN","Algeria":"DZ","Egypt":"EG","South Africa":"ZA",
  "DR Congo":"CD","Congo DR":"CD","Congo":"CD","Angola":"AO","Mali":"ML",
  "Guinea":"GN","Togo":"TG","Benin":"BJ","Zimbabwe":"ZW","Kenya":"KE",
  "Australia":"AU","Japan":"JP","South Korea":"KR","Korea Republic":"KR",
  "Uzbekistan":"UZ","Armenia":"AM","Azerbaijan":"AZ","Moldova":"MD",
  "Belarus":"BY","Lithuania":"LT","Latvia":"LV","Estonia":"EE","Albania":"AL",
  "Kosovo":"XK","Switzerland":"CH","Austria":"AT","Iceland":"IS","Jamaica":"JM",
  "Cyprus":"CY","Gambia":"GM","Liberia":"LR","Zambia":"ZM","Uganda":"UG",
  "Burkina Faso":"BF","Sierra Leone":"SL","Guinea-Bissau":"GW","Cape Verde":"CV"
};

function fromWf(raw) {
  const byName = new Map();
  for (const [endYear, list] of Object.entries(raw.seasons)) {
    for (const p of list) {
      if (!p.name) continue;
      /* המפתח הוא שם + שנת לידה, לא שם בלבד. ב-worldfootball יש
         שני "Guy Melamed" — מגן יליד 1979 וחלוץ יליד 1992 — ומפתוח
         לפי שם היה מאחד אותם לשחקן אחד עם קריירה של 29 שנה. */
      const key = `${p.name}|${p.born ?? ""}`;
      if (!byName.has(key)) byName.set(key, {
        he: null, name: p.name, en: p.name,
        pos: p.pos || null, nat: null, natEn: p.nat || null,
        born: p.born ?? null, years: [], spells: null,
        aliases: [], src: ["wf"]
      });
      const r = byName.get(key);
      r.years.push(+endYear);
      if (!r.pos && p.pos) r.pos = p.pos;
      if (r.born == null && p.born) r.born = p.born;
      if (!r.natEn && p.nat) r.natEn = p.nat;
    }
  }
  for (const r of byName.values()) {
    if (r.natEn) r.nat = NAT_FROM_EN[r.natEn] || null;
  }
  return [...byName.values()];
}

/* ============================================================
   2. שיוך תכונות מוויקיפדיה — שוויון מדויק בלבד
   ============================================================ */
function wikiIndex(details) {
  const full = new Map(), short = new Map();
  const add = (map, k, v) => {
    if (!k) return;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(v);
  };
  for (const d of details) {
    /* כותרת עם שנה בסוגריים — הצורה החשופה שייכת גם למישהו אחר,
       אז לא מוסיפים אותה לאינדקס. רק הכותרת המלאה. */
    if (hasYearDisambig(d.title)) {
      add(full, normName(d.title), d);
      continue;
    }
    add(full, normName(d.name), d);
    add(short, normName(shortName(d.name)), d);
    /* השם שבאמת חיפשנו, לפני שוויקיפדיה הפנתה לכותרת אחרת */
    for (const a of d.askedAs || []) {
      add(full, normName(a), d);
      add(short, normName(shortName(a)), d);
    }
  }
  return { full, short };
}

/* מחזיר {hit, why}. hit=null כשאין התאמה או כשיש יותר מאחת. */
function matchWiki(idx, player) {
  const keys = [player.he, player.official, ...(player.aliases || [])].filter(Boolean);
  for (const k of keys) {
    const exact = idx.full.get(normName(k));
    if (exact?.length === 1) return { hit: exact[0], why: "שם מלא" };
    if (exact?.length > 1) return { hit: null, why: `${exact.length} ערכים באותו שם` };
  }
  for (const k of keys) {
    const s = idx.short.get(normName(shortName(k)));
    if (s?.length === 1) return { hit: s[0], why: "שם קצר" };
    if (s?.length > 1) return { hit: null, why: `${s.length} ערכים באותו שם קצר` };
  }
  /* רק עכשיו — שקילות שם פרטי, עם שם משפחה זהה */
  for (const k of keys) {
    for (const v of nameVariants(k)) {
      const e = idx.full.get(v) || idx.short.get(normName(shortName(v)));
      if (e?.length === 1) return { hit: e[0], why: `כינוי (${k} ← ${v})` };
    }
  }
  return { hit: null, why: "לא נמצא בוויקיפדיה" };
}

/* ============================================================
   3. הרכבה
   ============================================================ */
for (const club of clubs) {
  log(`── ${club.slug} (${club.he}) ──`);

  const R = f => readJSON(`data/raw/${club.slug}-${f}.json`, null);
  const ref   = R("reference");
  const ifa   = R("ifa");
  const wikiC = R("wikipedia");
  /* קטגוריית המועדון + חיפוש ישיר לפי שם. שני המקורות באותו מבנה. */
  const wpA = R("wikiplayers"), wpB = R("wikiextra");
  const wikiP = (wpA || wpB)
    ? { details: [...(wpA?.details || []), ...(wpB?.details || [])] }
    : null;

  const wf   = R("worldfootball");
  const lang = R("wikilang");
  const namesFix = readJSON(`config/names-${club.slug}.json`, null);

  /* תעתיק ידני: "Avi Nimny": "אבי נימני" בקובץ התיקונים.
     זה הפתרון היחיד לשחקנים שאין להם ערך ויקיפדיה שאפשר לגשר אליו. */
  const manualHe = new Map();
  for (const [k, v] of Object.entries(namesFix || {})) {
    if (k.startsWith("_")) continue;
    const he = typeof v === "string" ? v : v?.he;
    if (he && /[A-Za-z]/.test(k)) manualHe.set(normLatin(k), he);
  }

  const review = { club: club.slug, noAttributes: [], ambiguous: [],
                   duplicates: [], forcedTargets: [], noHebrew: [], notes: [] };
  const sources = [];
  let players;
  if (ref) {
    /* בית"ר: הגרסה שבייצור מנצחת. יש בה תיקוני עונות ידניים
       שאין בשום מקור, ו-119 חידות שכבר פורסמו תלויות בשמות שלה. */
    players = fromReference(ref); sources.push("reference");
  } else if (ifa) {
    /* ההתאחדות היא הבסיס: היא היחידה שנותנת שם עברי לכל שורה.
       worldfootball נכנס מעליה כשכבה — לא כבסיס — כי חצי מהשמות
       שלו לא ניתנים לגישור לעברית, ובסיס באנגלית פשוט יאבד אותם. */
    players = fromIfa(ifa); sources.push("ifa");
  } else { warn(`${club.slug}: אין מקור בסיס — מדלגים`); continue; }

  /* --- דף השחקן של ההתאחדות: שנת לידה ואזרחות ---
     נכנס כאן, לפני שכבת worldfootball, ולא אחריה. הגשר המבני שם
     נשען על שנת לידה, ובלעדיה שחקן שאין לו ערך ויקיפדיה לא מתחבר
     לשום רשומה לועזית — ולכן גם לא מקבל עמדה. שנת לידה אחת פותחת
     את שתי התכונות.
     המקור: data/raw/ifa-players.json, מ-`--source=ifaplayers`. */
  {
    /* מאחורי דגל, בכוונה. שנות הלידה משנות את המאגר עמוקות: הן
       מזיזות 244 זיווגים בגשר המבני, מפצלות שחקנים שהיו רשומה
       אחת (שני "מוחמד גדיר", שני "עמנואל בואטנג"), ומשנות רמזים
       של תשע חידות שכבר פורסמו. השינוי הזה נכון, אבל הוא דורש
       שלוש הכרעות אנושיות על שמות שכבר היו באוויר — ולכן הוא
       לא נכנס מאליו. להרצה: node scripts/enrich.mjs --ifaborn */
    const ifaP = args.ifaborn ? readJSON("data/raw/ifa-players.json", null) : null;
    let nBorn = 0, nNat = 0;
    for (const p of ifaP ? players : []) {
      const rec = p.ifaId ? ifaP.players[p.ifaId] : null;
      if (!rec) continue;
      if (p.born == null && rec.born) { p.born = rec.born; p.src.push("ifa:born"); nBorn++; }
      /* האזרחות נשמרת, אבל **לא** הופכת ללאום שמוצג במשחק. ההתאחדות
         רושמת אזרחות משפטית: ג'ובאני רוסו הקרואטי, גוסטבו בוקולי
         הברזילאי וניקיטה רוקאביציה כולם "ישראל" אצלה אחרי שהתאזרחו.
         הרמז במשחק הוא לאום כדורגלני, וזה מה שוויקיפדיה ו-worldfootball
         נותנים. מאותה סיבה בדיוק היא גם לא משמשת שומר בגשר המבני —
         "ישראל" מול "Croatia" אינה סתירה אלא שני דברים שונים. */
      if (rec.natIso) { p.natIfa = rec.natIso; nNat++; }
    }
    if (nBorn || nNat) log(`  דפי שחקן בהתאחדות: ${nBorn} שנות לידה · ${nNat} אזרחויות (לתיעוד, לא לתצוגה)`);
  }

  /* --- worldfootball כשכבה נוספת ---
     שני תפקידים:
     1. להשלים עמדה / שנת לידה / לאום למי שכבר במאגר
     2. להוסיף את מי שלפני 2002/03, שההתאחדות לא מכסה בכלל
     הגשר לעברית הוא הקישור הרשמי בין ערך עברי לערך אנגלי. */
  if (!ref && wf) {
    /* שני גשרים לעברית, באותו מבנה:
       wikilang — קישור בין־שפתי מהערך העברי (כתיב זהה)
       enbridge — חיפוש בוויקיפדיה האנגלית ואז קישור לעברית,
                  מאומת בשנת לידה (כתיב שונה) */
    const bridge = R("enbridge");
    const enToHe = new Map();
    for (const l of [...(lang?.links || []), ...(bridge?.links || [])]) {
      /* אותו כלל: כותרת עברית עם שנה בסוגריים נשארת כמו שהיא,
         כי הצורה החשופה שייכת לעוד מישהו */
      const he = hasYearDisambig(l.he) ? l.he : stripParen(l.he);
      const k = normLatin(l.en);
      if (!enToHe.has(k)) enToHe.set(k, []);
      if (!enToHe.get(k).includes(he)) enToHe.get(k).push(he);
    }
    if (bridge) sources.push("enbridge");

    const byHe = new Map();
    const idx = (p) => {
      for (const src of [p.he, p.official, ...(p.aliases || [])].filter(Boolean))
        for (const k of [normName(src), normName(shortName(src)), ...nameVariants(src)])
          if (!byHe.has(k)) byHe.set(k, p);
    };
    players.forEach(idx);

    /* גשר שני, מבני. הכתיב הלטיני של worldfootball לא תמיד זהה
       לזה של ויקיפדיה האנגלית — "Avi Nimny" מול "Avi Nimni" —
       ואז הקישור הבין־שפתי לא תופס. אבל שנת לידה + חפיפת עונות
       הן זהות מבנית, לא דמיון מחרוזות: אם בדיוק שחקן אחד בכל
       צד מתאים, זה אותו אדם. דו-משמעיות → לא משייכים. */
    function structuralMatch(wfList, pool) {
      const link = new Map();                       // wf.en → שחקן
      const byBorn = new Map();
      for (const p of pool) {
        if (p.born == null || !p.years?.length) continue;
        if (!byBorn.has(p.born)) byBorn.set(p.born, []);
        byBorn.get(p.born).push(p);
      }
      const claims = new Map();                     // שחקן → כמה wf תובעים אותו
      for (const w of wfList) {
        if (w.born == null || !w.years.length) continue;
        const ws = new Set(w.years);
        /* שנת לידה וחפיפת עונות לא מספיקות. "אלון אברמוביץ", ישראלי
           לפי ההתאחדות, זווג ל-"Akaki Mikuchadze" הגאורגי: אותה שנת
           לידה, אותה עונה, ובאותו רגע הוא היה היחיד בבריכה עם שנת
           לידה. לאום סותר פוסל את הזיווג. */
        /* בלי שומר לאום. ניסיתי ארבע גרסאות — אזרחות ההתאחדות,
           לאום ויקיפדיה, תגית /זר/, ודרישת הסכמה מלאה — וכל אחת
           פסלה זיווגים נכונים בדיוק כמו שגויים: ההתאחדות רושמת
           אזרחות משפטית, וויקיפדיה נכנסת מאוחר יותר בצינור.
           מה שכן השתפר: שנות הלידה מדפי השחקן. כשלכל רשומה יש
           שנת לידה, מבחן היחידאות באמת בודק — קודם הוא עבר בקלות
           רק כי מעטים היו מועמדים בכלל. */
        const hits = (byBorn.get(w.born) || []).filter(p => {
          if (!p.years.some(y => ws.has(y))) return false;
          /* אזרחות רשומה בהתאחדות שסותרת את הלאום ב-worldfootball
             פוסלת את הזיווג. זה מה שהפריד את "אלעד בונפלד" מ-"Aminu
             Sani" הניגרי — אותה שנת לידה, אותה עונה, שני אנשים.

             המחיר ידוע ומכוון: שחקן זר שהתאזרח רשום "ישראל" אצל
             ההתאחדות, ולכן מאבד את הקישור לרשומה הלועזית שלו. הוא
             נשאר עם מה שוויקיפדיה נתנה, בלי העונות מ-worldfootball.
             נתון חסר עדיף על נתון שגוי: הרמז במשחק חייב להיות נכון. */
          if (p.natIfa && w.nat && p.natIfa !== w.nat) return false;
          return true;
        });
        if (hits.length !== 1) continue;
        link.set(w.en, hits[0]);
        claims.set(hits[0], (claims.get(hits[0]) || 0) + 1);
      }
      /* חד־ערכיות גם בכיוון השני */
      for (const [en, p] of [...link]) if (claims.get(p) > 1) link.delete(en);
      return link;
    }
    /* השחקנים שכבר יש להם שנת לידה מוויקיפדיה — הם הצד העברי */
    const wfAll = fromWf(wf);
    const wikiIdxForBorn = wpA || wpB ? wikiIndex(wikiP.details) : null;
    /* רק שנת לידה, ובכוונה לא הלאום. שאיבת הלאום לכאן הכפילה את
       מספר הזיווגים המבניים — ובתוכם "דיא סבע" יליד 1992 שקיבל
       עונות 97/98, ו"ואליד באדיר" שהפך לשוער. יותר נתונים לפני
       הגשר פירושם יותר מועמדים שנפסלים, ופתאום מישהו נשאר "יחיד"
       בלי שהוא נכון. הלאום שכן משמש שומר הוא זה שמדף השחקן של
       ההתאחדות, שנכנס למעלה, והוא אזרחות רשומה ולא נגזרת. */
    if (wikiIdxForBorn)
      for (const p of players)
        if (p.born == null) { const m = matchWiki(wikiIdxForBorn, p); if (m.hit?.born) p.born = m.hit.born; }
    const sameEn = new Map();
    for (const w of wfAll) {
      const k = normLatin(w.en);
      sameEn.set(k, (sameEn.get(k) || 0) + 1);
    }
    const structural = structuralMatch(wfAll, players);
    if (structural.size) log(`  גשר מבני (לידה + חפיפת עונות): ${structural.size}`);

    let filled = 0, addedHist = 0, noBridge = 0, ambig = 0;
    for (const w of wfAll) {
      /* תעתיק ידני גובר על הגשר האוטומטי */
      const manual = manualHe.get(normLatin(w.en));
      /* אם ל-worldfootball יש שתי רשומות באותו שם אנגלי (שני אנשים
         שונים), גשר לפי שם לא יכול להכריע ביניהם. מדלגים עליו
         ונשענים על הגשר המבני, שמבחין לפי שנת לידה. */
      const shared = sameEn.get(normLatin(w.en)) > 1;
      const cands = manual ? [manual] : (shared ? null : enToHe.get(normLatin(w.en)));
      if (cands && cands.length > 1) { ambig++; continue; }
      const heName = cands?.[0] || null;

      /* מחפשים התאמה במאגר הקיים — קודם לפי השם העברי שהגשר נתן,
         ואם אין, לפי הגשר המבני */
      let hit = null;
      if (heName)
        for (const k of [normName(heName), normName(shortName(heName)), ...nameVariants(heName)]) {
          hit = byHe.get(k); if (hit) break;
        }
      if (!hit) hit = structural.get(w.en) || null;

      if (hit) {
        if (!hit.pos && w.pos)        { hit.pos = w.pos;   hit.src.push("wf:pos"); }
        if (hit.born == null && w.born) { hit.born = w.born; hit.src.push("wf:born"); }
        if (!hit.nat && w.nat)        { hit.nat = w.nat;   hit.src.push("wf:nat"); }
        hit.years.push(...w.years);              // worldfootball מפספס עונות, וגם ההתאחדות
        if (w.en && !hit.aliases.includes(w.en)) hit.aliases.push(w.en);
        /* גם השם העברי שהגשר הבין־לשוני נתן, גם כשההתאחדות כבר
           נתנה שם. ההתאחדות כותבת "הלדר לופז" וויקיפדיה "הלדר
           לופש", והשני הוא זה שהאוהדים מקלידים — ושבו נכתבה החידה.
           בלי הכינוי הזה שלב התכונות לא מוצא את הערך בוויקיפדיה,
           השם נשאר הרשמי, וכל חידה שפורסמה בשם השני מתנתקת. */
        if (heName && !hit.aliases.includes(heName)) hit.aliases.push(heName);
        hit.src.push("wf");
        filled++;
      } else if (heName) {
        const p = { ...w, he: heName, years: [...w.years], src: ["wf", "wikilang"] };
        players.push(p); idx(p);
        addedHist++;
      } else {
        noBridge++;
        review.noHebrew.push({ en: w.en, pos: w.pos, born: w.born,
          seasons: new Set(w.years).size,
          span: `${Math.min(...w.years)}–${Math.max(...w.years)}` });
      }
    }
    review.noHebrew.sort((a, b) => b.seasons - a.seasons);
    log(`  worldfootball: ${filled} הושלמו · ${addedHist} נוספו · ` +
        `${noBridge} בלי גשר לעברית · ${ambig} דו-משמעיים`);
    sources.push("worldfootball");
    if (lang) sources.push("wikilang");
  }

  if (wpA) sources.push("wikiplayers");
  if (wpB) sources.push("wikiextra");
  if (lang) sources.push("wikilang");

  /* שם מוסתר בדף ההתאחדות ("*****") אינו שחקן */
  players = players.filter(p => !/^[*\s]+$/.test(p.he || ""));



  /* --- תכונות מוויקיפדיה --- */
  if (wikiP) {
    const idx = wikiIndex(wikiP.details);
    for (const p of players) {
      const { hit, why } = matchWiki(idx, p);
      if (!hit) {
        if (/ערכים/.test(why)) review.ambiguous.push({ he: p.he, why });
        /* אם כבר יש תכונות מהמקור הבסיסי — אין בעיה */
        if (p.pos == null || p.born == null) review.noAttributes.push({ he: p.he, why });
        continue;
      }
      p.wiki = hit.title;
      if (p.pos  == null && hit.pos)  { p.pos  = hit.pos;  p.src.push("wiki:pos"); }
      if (p.born == null && hit.born) { p.born = hit.born; p.src.push("wiki:born"); }
      if (p.nat  == null && hit.nat)  { p.nat  = hit.nat;  p.src.push("wiki:nat"); }
      /* שם הערך בוויקיפדיה הוא מה שאוהדים מכירים — עדיף על השם הרשמי */
      if (!ref && hit.name && hit.name !== p.he) {
        if (!p.aliases.includes(p.he)) p.aliases.push(p.he);
        p.he = hit.name;
      }
    }
  }

  /* --- ברירת מחדל ללאום --- */
  for (const p of players) {
    if (p.nat == null && p.foreign === false && p.ifaId) { p.nat = "IL"; p.src.push("ifa:local"); }
  }

  /* --- תיקונים ידניים. גוברים על הכל. --- */
  /* שינוי שם של שחקן שכבר מופיע בלוח החידות מנתק את הלוח מהמאגר.
     הלוח מפנה לשחקנים לפי שם, ולכן הוא חייב לעקוב אחרי השינוי —
     אחרת כל תיקון איות של שחקן מהבריכה מפיל את enrich. הלוח נשמר
     כלשונו: אותו סדר, אותו שחקן, איות מעודכן. */
  const renamed = new Map();
  if (namesFix) {
    const byKey = new Map(players.map(p => [String(p.ifaId ?? normName(p.he)), p]));
    let n = 0;
    for (const [key, val] of Object.entries(namesFix)) {
      if (key.startsWith("_")) continue;
      if (/[A-Za-z]/.test(key) && typeof val === "string") continue;   // תעתיק, כבר הוחל
      const p = byKey.get(key) || players.find(x => normName(x.he) === normName(key));
      if (!p) { review.notes.push(`תיקון שם ללא שחקן תואם: ${key}`); continue; }
      const before = p.he;
      if (typeof val === "string") p.he = val;
      else Object.assign(p, val);
      if (p.he !== before) renamed.set(normName(before), p.he);
      p.src.push("manual");
      n++;
    }
    log(`  תיקונים ידניים: ${n}`);
  }

  /* --- תקופות, עונות, תארים --- */
  const titleYears = [...club.titles.league, ...club.titles.cup];
  for (const p of players) {
    if (!p.spells) p.spells = toSpells(p.years || []);
    p.seasons = seasonsIn(p.spells);
    p.titles  = countTitles(p.spells, titleYears);
  }

  /* --- בריכת התשובות ---
     המפרט: seasons >= 3 && born != null.
     הוספתי גם pos != null, כי בדיקת הבנייה דורשת ששחקן בבריכה
     יהיה עם עמדה, ובלי זה הבנייה נופלת על הסתירה הזאת. */
  for (const p of players) p.target = p.seasons >= 3 && p.born != null && p.pos != null;

  /* --- איחוד רשומות של אותו אדם ---
     "גיל ורמוט" ו"גילי ורמוט" נוצרו כשתי רשומות: זו של ההתאחדות
     קיבלה את הכינוי רק אחרי ששכבת worldfootball כבר רצה, אז הגשר
     לא מצא אותה והוסיף שחקן חדש.

     הכלל כאן הוא זהות מבנית ולא דמיון: **אותה שנת לידה בדיוק**
     וגם שם משותף באחד הכינויים. שני התנאים יחד, אחרת לא ממזגים. */
  {
    const byKey = new Map();
    const keysOf = p => [p.he, p.official, ...(p.aliases || [])].filter(Boolean)
      .flatMap(n => [normName(n), normName(shortName(n)), ...nameVariants(n)]);
    let merged = 0;
    for (const p of players) {
      if (p.born == null) continue;
      let hit = null;
      for (const k of keysOf(p)) {
        const cand = byKey.get(`${p.born}|${k}`);
        if (cand && cand !== p) { hit = cand; break; }
      }
      if (hit) {
        hit.years = [...(hit.years || []), ...(p.years || [])];
        if (p.spells) hit.spells = toSpells([
          ...(hit.spells || []).flatMap(([a, b]) => Array.from({length: b-a+1}, (_, i) => a+i)),
          ...p.spells.flatMap(([a, b]) => Array.from({length: b-a+1}, (_, i) => a+i))
        ]);
        for (const f of ["pos", "born", "nat", "ifaId", "official"])
          if (hit[f] == null && p[f] != null) hit[f] = p[f];
        for (const a of [p.he, ...(p.aliases || [])])
          if (a && !hit.aliases.includes(a)) hit.aliases.push(a);
        hit.src.push("merged");
        p._gone = true;
        merged++;
        review.notes.push(`אוחדו: "${p.he}" ← "${hit.he}" (שניהם ${p.born})`);
        continue;
      }
      for (const k of keysOf(p)) if (!byKey.has(`${p.born}|${k}`)) byKey.set(`${p.born}|${k}`, p);
    }
    if (merged) {
      players = players.filter(p => !p._gone);
      /* התקופות השתנו — מחשבים מחדש */
      for (const p of players) {
        p.seasons = seasonsIn(p.spells);
        p.titles  = countTitles(p.spells, titleYears);
        p.target  = p.seasons >= 3 && p.born != null && p.pos != null;
      }
      log(`  אוחדו ${merged} רשומות של אותו אדם`);
    }
  }

  /* --- מחיקת רשומה חשופה שהיא תעתיק אחר של שחקן מזוהה ---
     "דראגוסלב יבריץ" ו"דרגוסלאב יבריץ'" הם אותו שוער, ובמשחק הם
     הופיעו כשני שחקנים: אחד עם עמדה, לאום ושנת לידה — והשני עם
     חמישה סימני שאלה. הרשומה של ההתאחדות לא תפסה אף גשר לעברית,
     כי הכתיב שלה שונה, והמיזוג שמעל לא נגע בה: הוא דורש שנת לידה
     בשני הצדדים, ולחשופה אין.

     שלושה תנאים מבניים, כולם יחד:
     1. אין בחשופה עמדה ואין שנת לידה — אין מה לאבד ממחיקתה
     2. שלד עיצורים זהה, אחרי הסרת אמות הקריאה (א, ו, י, ה) —
        "דראגוסלב" ו"דרגוסלאב" נותנים "דרגסלב"
     3. העונות שלה **מוכלות** בעונות של המזוהה
     ומועמד אחד בדיוק. שניים — לא ממזגים.

     ההכלה היא מה שמונע את הטעות: "אביחי דהן" ו"אביחי ידין" חולקים
     שלד, אבל שיחקו בעונות שונות ולכן לא ייגעו זה בזה. היא גם מה
     שמשאיר את המזוהה בלי שינוי — לא נוספת לו עונה, ולכן מספר
     העונות והתארים שלו זהה, וחידות שפורסמו לא נוגעו.

     השם החשוף עובר ל-aliases, כך שמי שמקליד אותו עוד מוצא. */
  {
    const skel = s => normName(s).replace(/[אוהי]/g, "").replace(/\s+/g, " ").trim();
    const yearsOf = p => new Set((p.spells || []).flatMap(([a, b]) =>
      Array.from({ length: b - a + 1 }, (_, i) => a + i)));
    /* אין כאן הגנה על שמות שכבר פורסמו, בכוונה: רשומה חשופה לא
       יכולה להיות התשובה של אף חידה — הבריכה דורשת עמדה ושנת
       לידה. כששמה זהה לשם שבלוח, החידה שייכת לרשומה השנייה,
       וההגנה הייתה מונעת דווקא את המחיקה הנכונה. */
    /* התנאי הוא **בלי עמדה**, ולא "בלי שום תכונה". מאז ששנות
       הלידה מגיעות מדפי השחקן, לרשומת התעתיק הכפולה כבר יש שנת
       לידה — ובניסוח הישן היא חמקה מהמחיקה וחזרה להיות שחקן שני.
       שנת הלידה לא מפריעה, היא מאשרת: כשהיא קיימת בשני הצדדים
       היא חייבת להיות זהה. */
    const known = players.filter(p => p.pos != null);
    let absorbed = 0;
    for (const p of players) {
      if (p.pos != null) continue;
      const k = skel(p.he), ys = yearsOf(p);
      if (!k || !ys.size) continue;
      const cands = known.filter(q => !q._gone && skel(q.he) === k &&
        (p.born == null || q.born == null || p.born === q.born) &&
        [...ys].every(y => yearsOf(q).has(y)));
      if (cands.length !== 1) continue;
      const hit = cands[0];
      for (const a of [p.he, p.official, ...(p.aliases || [])])
        if (a && !hit.aliases.includes(a)) hit.aliases.push(a);
      if (hit.ifaId == null && p.ifaId != null) hit.ifaId = p.ifaId;
      if (hit.born == null && p.born != null) hit.born = p.born;
      hit.src.push("absorbed");
      p._gone = true;
      absorbed++;
      review.notes.push(`נמחקה רשומה חשופה: "${p.he}" ← "${hit.he}" (תעתיק אחר, עונות מוכלות)`);
    }
    if (absorbed) {
      players = players.filter(p => !p._gone);
      log(`  נמחקו ${absorbed} רשומות חשופות שהן תעתיק אחר של שחקן מזוהה`);
    }
  }

  /* --- כפילויות בשם העברי (חובה — שובר השלמה אוטומטית וניצחון) --- */
  const byHe = new Map();
  for (const p of players) {
    const k = normName(p.he);
    if (!byHe.has(k)) byHe.set(k, []);
    byHe.get(k).push(p);
  }
  for (const [k, group] of byHe) {
    if (group.length < 2) continue;
    /* ניסיון ראשון: להחזיר את השם הרשמי המלא, אם הוא מפריד ביניהם */
    const officials = group.map(p => p.official || p.he);
    if (new Set(officials.map(normName)).size === group.length) {
      group.forEach((p, i) => {
        if (!p.aliases.includes(p.he)) p.aliases.push(p.he);
        p.he = officials[i];
      });
      review.notes.push(`כפילות "${group[0].aliases.at(-1)}" נפתרה בשמות הרשמיים`);
      continue;
    }
    /* שני אנשים עם אותו שם באמת קורה — "טל בן חיים" שיחק במכבי ת"א
       פעמיים, שני שחקנים שונים. לא ממזגים ולא בוחרים: מוסיפים הבהרה,
       בדיוק כמו שוויקיפדיה עושה. השם הנקי נשאר בחיפוש דרך aliases.
       אם בפועל מדובר באדם אחד — זה רשום ב-review ומחכה לאדם. */
    const borns = group.map(p => p.born);
    const useBorn = borns.every(Boolean) && new Set(borns).size === group.length;
    const tags = group.map(p => useBorn ? String(p.born) : season(p.spells[0][0]));
    if (new Set(tags).size === group.length) {
      group.forEach((p, i) => {
        if (!p.aliases.includes(p.he)) p.aliases.push(p.he);
        p.he = `${p.he} (${tags[i]})`;
        p.disambiguated = true;
      });
      review.duplicates.push({ he: k, count: group.length, resolved: "הבהרה אוטומטית",
        detail: group.map(p => p.he) });
    } else {
      review.duplicates.push({ he: k, count: group.length, resolved: null,
        detail: group.map(p => `${p.official || p.he} (${p.spells.map(s => s.join("-")).join(",")})`) });
    }
  }

  /* ============================================================
     4. לוח החידות — סדר מקובע (באג 6.2)
        קיים → נשמר כלשונו. חדשים נוספים בסוף בלבד.
     ============================================================ */
  const schedFile = `config/schedule-${club.slug}.json`;
  let schedule = readJSON(schedFile, null)?.order || null;

  if (!schedule && ref?.schedule) {
    schedule = [...ref.schedule];
    log(`  לוח נטען מהגרסה שבייצור: ${schedule.length} חידות`);
  }
  if (!schedule) schedule = [];

  /* תיקון איות עובר גם ללוח. זו אותה חידה ואותו שחקן — רק הכתיב
     השתנה, והמקום בסדר נשמר. */
  if (renamed.size) {
    let moved = 0;
    schedule = schedule.map(n => {
      const to = renamed.get(normName(n));
      if (to && to !== n) { moved++; return to; }
      return n;
    });
    if (moved) log(`  שמות שעודכנו בלוח: ${moved}`);
  }

  /* הבהרה בסוגריים היא תוצר של המאגר, לא חלק מהשם. כשכפילות
     מתגלה כרשומה אחת — ההבהרה מתייתרת, והשם בלוח נשאר מצביע על
     צורה שאיננה. זו אותה חידה ואותו שחקן, ולכן הלוח עוקב, אבל רק
     כשהזיהוי חד־ערכי: בדיוק שחקן אחד נושא את השם בלי ההבהרה,
     בשמו או באחד מכינוייו. שניים — נופלים, כמו קודם. */
  {
    const byAny = new Map();
    for (const p of players)
      for (const n of [p.he, ...(p.aliases || [])].filter(Boolean)) {
        const k = normName(n);
        if (!byAny.has(k)) byAny.set(k, new Set());
        byAny.get(k).add(p);
      }
    const live = new Set(players.map(p => normName(p.he)));
    let followed = 0;
    schedule = schedule.map(n => {
      if (live.has(normName(n))) return n;
      for (const k of [normName(n), normName(stripParen(n))]) {
        const c = byAny.get(k);
        if (c?.size === 1) { followed++; return [...c][0].he; }
      }
      return n;
    });
    if (followed) log(`  שמות בלוח שעקבו אחרי הבהרה שהשתנתה: ${followed}`);
  }

  const byName = new Map(players.map(p => [normName(p.he), p]));
  const missing = schedule.filter(n => !byName.has(normName(n)));
  if (missing.length)
    die(`${club.slug}: בלוח יש ${missing.length} שמות שאינם במאגר — ` +
        `${missing.slice(0, 5).join(", ")}. תקן ידנית ב-${schedFile}, אל תמחק שורות.`);

  /* שם שכבר פורסם חייב להישאר תשובה, גם אם הכללים השתנו מאז */
  for (const n of schedule) {
    const p = byName.get(normName(n));
    if (!p.target) {
      p.target = true;
      review.forcedTargets.push({ he: p.he, why: "מופיע בלוח שכבר פורסם" });
    }
  }

  /* התוספות נכנסות בסוף, אבל לא לפי סדר כרונולוגי — אחרת החידות
     רצות מהוותיקים לצעירים וזה צפוי. ערבוב עם seed קבוע: אותו
     קלט נותן תמיד אותו סדר, אז הלוח עדיין דטרמיניסטי. */
  const inSched = new Set(schedule.map(normName));
  const fresh = players
    .filter(p => p.target && !inSched.has(normName(p.he)))
    .sort((a, b) => (a.spells[0][0] - b.spells[0][0]) || a.he.localeCompare(b.he, "he"))
    .map(p => p.he);
  const seed = [...club.slug].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, SHUFFLE_SEED);
  const additions = seededShuffle(fresh, seed);
  schedule.push(...additions);
  if (additions.length) log(`  נוספו ללוח בסוף: ${additions.length}`);

  writeJSON(schedFile, {
    _comment: "סדר קבוע. אין לערבב מחדש ואין למחוק — תוספות בסוף בלבד. " +
      "שינוי כאן משנה תשובות של חידות שכבר פורסמו.",
    order: schedule
  }, 1);

  /* ============================================================
     5. כתיבה
     ============================================================ */
  /* דו-משמעיות שנפתרה בדרך אחרת — תיקון ידני, או מקור בסיס שכבר
     החזיק עמדה ושנת לידה — היא רעש. היא לא חוסמת אף אחד מהבריכה,
     ואם היא נשארת בדוח היא מטביעה את המקרים שכן דורשים החלטה. */
  {
    const done = new Set();
    for (const p of players)
      if (p.pos && p.born) for (const k of [p.he, ...(p.aliases || [])]) done.add(normName(k));
    review.ambiguous = review.ambiguous.filter(a => !done.has(normName(a.he)));
  }

  const out = players
    .map(p => ({
      he: p.he, pos: p.pos, nat: p.nat, born: p.born,
      spells: p.spells, seasons: p.seasons, titles: p.titles, target: p.target,
      ...(p.aliases?.length ? { aliases: [...new Set(p.aliases)] } : {})
    }))
    .sort((a, b) => (a.spells[0][0] - b.spells[0][0]) || a.he.localeCompare(b.he, "he"));

  const years = players.flatMap(p => p.spells.flat());
  const club_out = {
    slug: club.slug, he: club.he, short: club.short, game: club.game,
    colors: club.colors,
    titles: club.titles,
    coverage: { from: Math.min(...years), to: Math.max(...years), sources },
    counts: { players: out.length, targets: out.filter(p => p.target).length },
    players: out,
    schedule
  };
  writeJSON(`data/clubs/${club.slug}.json`, club_out);
  writeJSON(`data/review/${club.slug}.json`, review);

  const exp = club.expect;
  const okP = !exp || exp.players === out.length;
  const okT = !exp || exp.targets === club_out.counts.targets;
  log(`  ${out.length} שחקנים · ${club_out.counts.targets} בבריכה · ` +
      `${club_out.coverage.from}–${club_out.coverage.to}` +
      (exp ? `  [ציפייה ${exp.players}/${exp.targets} ${okP && okT ? "✓" : "✗"}]` : ""));
  const unresolved = review.duplicates.filter(d => !d.resolved);
  log(`  לבדיקה אנושית: ${review.noAttributes.length} בלי תכונות · ` +
      `${review.ambiguous.length} דו-משמעיים · ${review.duplicates.length} כפילויות ` +
      `(${review.duplicates.length - unresolved.length} נפתרו בהבהרה)`);
  if (unresolved.length)
    warn(`${club.slug}: ${unresolved.length} שמות עבריים כפולים שלא נפתרו — הבנייה תיפול עליהם`);
}

log("סיום.");
