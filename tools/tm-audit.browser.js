/* ============================================================
   בדיקת עונות מול היסטוריית ההעברות בטרנספרמרקט — רץ בדפדפן.

   טרנספרמרקט חוסם סקריפטים מבחוץ, אבל מתוך לשונית פתוחה של
   transfermarkt.com ה-API הפנימי עונה (20/11/2026: 746 שחקנים, 0 חסימות,
   3 תהליכים במקביל, ~20 דקות).

   שימוש:
     1. node tools/tm-audit.prep.mjs  → מדפיס את ROWS (tmId team spells) לכל שחקן בלוח
        (המיפוי עברית→tmId: data/raw/tm-map.json)
     2. בלשונית transfermarkt.com, בקונסולה: הדבק את הקובץ הזה, ואז
          await tmAudit(ROWS)
        מחזיר שורות "אינדקס:שנה@איפה,..." — עונות שאצלנו במועדון ולפי
        טרנספרמרקט היה כל העונה (אוגוסט–מאי) במקום אחר.
     3. ההכרעות נרשמות כ-notSeasons ב-config/names-<slug>.json (ראה
        data/review/tm-seasons.md). מ-02/03 רק כשגם ההתאחדות לא רושמת אותו.
   ============================================================ */
const OURS = { "3793": /B\. Jerusalem|Beitar Jerusalem/i, "2976": /H\. Beer Sheva|Hapoel Beer Sheva/i,
  "1017": /Hapoel Tel Aviv/i, "1064": /Maccabi Haifa/i, "119": /M\. Tel Aviv|Maccabi Tel Aviv/i };
const cid = h => (String(h || "").match(/verein\/(\d+)/) || [])[1] || null;
const sleep = ms => new Promise(z => setTimeout(z, ms));

async function tmHistories(ids, workers = 3, gap = 1500) {
  const res = {}, queue = [...new Set(ids)];
  const work = async () => {
    while (queue.length) {
      const id = queue.shift();
      try {
        const r = await fetch(`/ceapi/transferHistory/list/${id}`);
        if (r.status === 429 || r.status === 403) { queue.push(id); await sleep(60000); continue; }
        const j = await r.json();
        res[id] = j.transfers.map(t => [t.dateUnformatted, cid(t.from.href), t.from.clubName, cid(t.to.href), t.to.clubName]);
      } catch (e) { console.warn(id, e); }
      await sleep(gap);
    }
  };
  await Promise.all(Array.from({ length: workers }, work));
  return res;
}

/* ROWS: "tmId team spells;..." — spells בשנתיים ספרות ("6-7,10" = 05/06–06/07, 09/10) */
async function tmAudit(ROWS) {
  const rows = ROWS.split(";").map(r => r.split(" "));
  const res = await tmHistories(rows.map(r => r[0]));
  const Y = n => +n < 50 ? 2000 + +n : 1900 + +n;
  return rows.map(([tm, team, sp], i) => {
    const years = sp.split(",").flatMap(r => { const [a, b] = r.split("-"); const A = Y(a), B = b === undefined ? A : Y(b); return Array.from({ length: B - A + 1 }, (_, k) => A + k); });
    const t = (res[tm] || []).filter(x => x[0]).sort((a, b) => a[0].localeCompare(b[0]));
    if (!t.length) return null;
    const seg = t.map((x, k) => ({ from: Date.parse(x[0]), to: k + 1 < t.length ? Date.parse(t[k + 1][0]) : Date.parse("2100-01-01"),
      ours: x[3] === team || (/\b(U\d\d|Youth|Yth|II|B)\b/.test(x[4]) && OURS[team].test(x[4])), name: x[4] }));
    const bad = [];
    for (const y of years) {
      const a = Date.UTC(y - 1, 7, 1), b = Date.UTC(y, 4, 31);
      if (a < seg[0].from) continue;                     // לפני ההיסטוריה הידועה
      let here = false; const where = new Set();
      for (const s of seg) { if (Math.min(b, s.to) - Math.max(a, s.from) <= 0) continue; if (s.ours) here = true; else where.add(s.name); }
      if (!here) bad.push(y % 100 + "@" + [...where].join("/"));
    }
    return bad.length ? i + ":" + bad.join(",") : null;
  }).filter(Boolean).join("\n");
}
