/* מכין את ROWS ל-tools/tm-audit.browser.js: "tmId team spells;..." לפי
   data/raw/tm-map.json (שחקני הלוח שזוהו בטרנספרמרקט). */
import { readJSON } from "../scripts/lib/util.mjs";
const map = readJSON("data/raw/tm-map.json");
const team = s => String(readJSON(`data/raw/${s}-transfermarkt.json`).teamId);
const rows = map.map(({ club, he, tm }) => {
  const p = readJSON(`data/clubs/${club}.json`).players.find(x => x.he === he);
  return p ? `${tm} ${team(club)} ${p.spells.map(([a, b]) => a === b ? a % 100 : `${a % 100}-${b % 100}`).join(",")}` : null;
}).filter(Boolean);
console.log(rows.join(";"));
