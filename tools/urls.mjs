/* מייצר את כל הכתובות, לכל מקור ולכל מועדון, להרצה ידנית.
   node tools/urls.mjs            כל המועדונים
   node tools/urls.mjs maccabi-ta מועדון אחד

   פלט:
     data/urls/<slug>-<source>.txt   רשימת כתובות, אחת בשורה
     data/urls/INDEX.md              אינדקס קריא עם לינקים
     data/urls/<slug>-wf-console.js  סקריפט להדבקה בקונסולת הדפדפן
*/
import { writeText, writeJSON, loadClubs, readJSON } from "../scripts/lib/util.mjs";

const only = process.argv[2];
const clubs = loadClubs().filter(c => !only || c.slug === only);
if (!clubs.length) { console.error("מועדון לא מוכר"); process.exit(1); }

const WF_FROM = 1969, WF_TO = 2025;          // שנות פתיחת עונה
const IFA_GUID = "%7B2AE09DED-5019-4C49-BFD5-4458C66F9D24%7D";
const IFA_MIN = 4, IFA_MAX = 27;             // season_id = שנת_סיום − 1999

const wfUrl  = (c, y) => `https://www.worldfootball.net/teams/${c.worldfootball}/vs${y}-${y + 1}/squad/`;
const ifaUrl = (c, s) => `https://www.football.org.il/team-details/?itemid=${IFA_GUID}&season_id=${s}&team_id=${c.ifaTeamId}`;
const wikiUrl = c => "https://he.wikipedia.org/w/api.php?action=query&list=categorymembers"
  + `&cmtitle=${encodeURIComponent(c.wikiCategory)}&cmlimit=500&cmtype=page&format=json`;

/* ------------------------------------------------------------------
   הסקריפט לקונסולה. רץ בדפדפן שלך, אחרי שדף worldfootball כבר
   נטען אצלך — כלומר אתגר Cloudflare כבר עבר בסשן הזה.
   מושך את העונות אחת־אחת מאותו origin, ומוריד JSON מוכן.
   השהיה של 1.5 שניות בין בקשות. אל תוריד אותה.
   ------------------------------------------------------------------ */
function consoleScript(c) {
  return `/* ============================================================
   ${c.he} — שאיבת סגלים מ-worldfootball
   ============================================================
   1. פתח בדפדפן שלך:  https://www.worldfootball.net/teams/${c.worldfootball}/squad/
      חכה שהדף ייטען באמת (לא מסך "Just a moment").
   2. F12 → Console → הדבק את כל הקובץ הזה → Enter.
   3. זה לוקח בערך ${Math.round((WF_TO - WF_FROM + 1) * 2.2 / 60)} דקות. אל תסגור את הלשונית.
      אפשר לעצור באמצע: stop = true
   4. בסוף יורד הקובץ  ${c.slug}-worldfootball.json
      שים אותו ב-  data/raw/${c.slug}-worldfootball.json
      והרץ:        node scripts/enrich.mjs && node scripts/build.mjs
   ============================================================ */
var stop = false;
(async () => {
  const TEAM = ${JSON.stringify(c.worldfootball)};
  const SLUG = ${JSON.stringify(c.slug)};
  const FROM = ${WF_FROM}, TO = ${WF_TO}, DELAY = 1500;

  const POS = {
    "goalkeeper":"GK","goalkeepers":"GK",
    "defence":"DF","defense":"DF","defender":"DF",
    "midfield":"MF","midfielder":"MF",
    "forward":"FW","forwards":"FW","attack":"FW"
  };

  function parse(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const out = [];
    let pos = null;
    for (const tr of doc.querySelectorAll("tr")) {
      const role = tr.querySelector("th.role");
      if (role) { pos = POS[role.textContent.trim().toLowerCase()] || null; continue; }
      if (!tr.classList.contains("entry") || !pos) continue;   // null = מאמן, לא שחקן
      const a = tr.querySelector("td.person-name a");
      if (!a) continue;
      const name = a.textContent.replace(/\\s+/g, " ").trim();
      if (!name) continue;
      const nat = tr.querySelector("td.country-name a");
      const bd  = (tr.querySelector("td.person-birthday") || {}).textContent || "";
      const m   = bd.match(/(\\d{2})\\.(\\d{2})\\.(\\d{4})/);
      out.push({
        name, pos,
        pid: (a.getAttribute("href") || "").replace(/\\/$/, "").split("/").pop() || null,
        nat: nat ? nat.textContent.replace(/\\s+/g, " ").trim() : null,
        born: m ? +m[3] : null
      });
    }
    return out;
  }

  const seasons = {};
  let blocked = 0, stoppedAt = null;
  for (let y = FROM; y <= TO; y++) {
    if (stop) { stoppedAt = y; console.warn("נעצר ידנית ב-" + y); break; }
    const url = "/teams/" + TEAM + "/vs" + y + "-" + (y + 1) + "/squad/";
    try {
      const r = await fetch(url, { credentials: "same-origin" });
      const html = await r.text();
      if (!r.ok || /just a moment|attention required/i.test(html)) {
        blocked++;
        console.warn(y + "/" + (y + 1) + "  ✖ נחסם");
        if (blocked >= 3) {
          stoppedAt = y;
          console.error("שלוש חסימות ברצף. עוצר. רענן את הדף, חכה שייטען, והרץ שוב מ-" + y + ".");
          break;
        }
        await new Promise(s => setTimeout(s, 8000));
        y--; continue;
      }
      blocked = 0;
      const players = parse(html);
      if (players.length) seasons[y + 1] = players;
      console.log(y + "/" + (y + 1) + "  " + players.length + " שחקנים");
    } catch (e) {
      console.warn(y + "/" + (y + 1) + "  שגיאה: " + e.message);
    }
    await new Promise(s => setTimeout(s, DELAY));
  }

  const data = { club: SLUG, source: "worldfootball", team: TEAM,
                 range: [FROM, TO], stoppedAt, seasons };
  const n = Object.values(seasons).reduce((a, l) => a + l.length, 0);
  console.log("סיום: " + Object.keys(seasons).length + " עונות, " + n + " שורות סגל");

  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = SLUG + "-worldfootball.json";
  document.body.appendChild(a); a.click(); a.remove();
})();
`;
}

/* ------------------------------------------------------------------ */
const index = [];
for (const c of clubs) {
  const wf = [], ifa = [];
  for (let y = WF_FROM; y <= WF_TO; y++) wf.push(wfUrl(c, y));
  for (let s = IFA_MIN; s <= IFA_MAX; s++) ifa.push(ifaUrl(c, s));

  writeText(`data/urls/${c.slug}-wf.txt`, wf.join("\n") + "\n");
  writeText(`data/urls/${c.slug}-ifa.txt`, ifa.join("\n") + "\n");
  writeText(`data/urls/${c.slug}-wiki.txt`, wikiUrl(c) + "\n");
  writeText(`data/urls/${c.slug}-wf-console.js`, consoleScript(c));

  index.push({ c, wfCount: wf.length, ifaCount: ifa.length });
  console.log(`${c.slug.padEnd(14)} wf ${wf.length} · ifa ${ifa.length} · wiki 1`);
}

const md = [
  "# כתובות להרצה ידנית",
  "",
  "נוצר על ידי `node tools/urls.mjs`. כל קובץ `.txt` הוא רשימת כתובות, אחת בשורה.",
  "",
  "| מועדון | worldfootball | ההתאחדות | ויקיפדיה | סקריפט לקונסולה |",
  "|---|---|---|---|---|",
  ...index.map(({ c, wfCount, ifaCount }) =>
    `| ${c.he} | [${wfCount} כתובות](${c.slug}-wf.txt) | [${ifaCount} כתובות](${c.slug}-ifa.txt) ` +
    `| [1](${c.slug}-wiki.txt) | [${c.slug}-wf-console.js](${c.slug}-wf-console.js) |`),
  "",
  "## דפי הפתיחה של כל מועדון",
  "",
  "| מועדון | worldfootball | ההתאחדות | קטגוריית ויקיפדיה |",
  "|---|---|---|---|",
  ...index.map(({ c }) =>
    `| ${c.he} | [${c.worldfootball}](https://www.worldfootball.net/teams/${c.worldfootball}/squad/) ` +
    `| [team_id=${c.ifaTeamId}](${ifaUrl(c, IFA_MAX)}) ` +
    `| [${c.wikiCategory}](https://he.wikipedia.org/wiki/${encodeURIComponent(c.wikiCategory)}) |`),
  "",
  "## מבנה הכתובות",
  "",
  "```",
  "worldfootball  https://www.worldfootball.net/teams/<wf>/vs<Y>-<Y+1>/squad/",
  `               Y מ-${WF_FROM} עד ${WF_TO}  (שנת פתיחת עונה)`,
  "",
  "ההתאחדות      https://www.football.org.il/team-details/",
  `               ?itemid=${IFA_GUID}&season_id=<S>&team_id=<id>`,
  `               S מ-${IFA_MIN} עד ${IFA_MAX}   ·   season_id = שנת_סיום − 1999`,
  "",
  "ויקיפדיה       he.wikipedia.org/w/api.php?action=query&list=categorymembers…",
  "```",
  ""
].join("\n");
writeText("data/urls/INDEX.md", md);
console.log("\n→ data/urls/INDEX.md");
