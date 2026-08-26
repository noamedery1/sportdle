/* ============================================================
   הפועל באר שבע — שאיבת סגלים מ-worldfootball
   ============================================================
   1. פתח בדפדפן שלך:  https://www.worldfootball.net/teams/te17757/hapoel-beer-sheva/squad/
      חכה שהדף ייטען באמת (לא מסך "Just a moment").
   2. F12 → Console → הדבק את כל הקובץ הזה → Enter.
   3. זה לוקח בערך 2 דקות. אל תסגור את הלשונית.
      אפשר לעצור באמצע: stop = true
   4. בסוף יורד הקובץ  hapoel-bs-worldfootball.json
      שים אותו ב-  data/raw/hapoel-bs-worldfootball.json
      והרץ:        node scripts/enrich.mjs && node scripts/build.mjs
   ============================================================ */
var stop = false;
(async () => {
  const TEAM = "te17757/hapoel-beer-sheva";
  const SLUG = "hapoel-bs";
  const FROM = 1969, TO = 2025, DELAY = 1500;

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
      const name = a.textContent.replace(/\s+/g, " ").trim();
      if (!name) continue;
      const nat = tr.querySelector("td.country-name a");
      const bd  = (tr.querySelector("td.person-birthday") || {}).textContent || "";
      const m   = bd.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      out.push({
        name, pos,
        pid: (a.getAttribute("href") || "").replace(/\/$/, "").split("/").pop() || null,
        nat: nat ? nat.textContent.replace(/\s+/g, " ").trim() : null,
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
