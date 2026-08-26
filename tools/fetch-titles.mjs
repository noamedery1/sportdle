/* מושך את רשימות האלופות וגביעי המדינה מוויקיפדיה העברית
   כטקסט גולמי, כדי שנפרסר אותן דטרמיניסטית ולא "מהזיכרון". */
import { writeText } from "../scripts/lib/util.mjs";

const pages = process.argv.slice(2);
for (const p of pages) {
  const u = new URL("https://he.wikipedia.org/w/api.php");
  u.searchParams.set("action", "parse");
  u.searchParams.set("page", p);
  u.searchParams.set("prop", "wikitext");
  u.searchParams.set("format", "json");
  u.searchParams.set("formatversion", "2");
  const r = await fetch(u, { headers: { "User-Agent": "sportdel/1.0 (fan project)" } });
  const j = await r.json();
  if (j.error) { console.log(`✖ ${p}: ${j.error.info}`); continue; }
  const wt = j.parse.wikitext;
  const file = `data/raw/wiki/${p.replace(/[\\/:*?"<>|]/g, "_")}.wikitext`;
  writeText(file, wt);
  console.log(`✓ ${p} → ${file} (${wt.length} תווים)`);
}
