import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { loadClubs } from "../scripts/lib/util.mjs";

const INK = "#0C0C0E";
const C = loadClubs().map(c => c.colors.brand);   // ביתר, ב"ש, מכבי ת"א, חיפה, הפועל ת"א
const [Y, BS, MTA, HAI, HTA] = C;
mkdirSync("store/icon-ideas", { recursive: true });

/* כדור פשוט: מחומש מרכזי + חמישה סביבו. זה הדגם שקורא כ"כדורגל"
   גם ב-48 פיקסלים, בשונה מדגם מלא של 32 פאות. */
function ball(center, ring, stroke = INK) {
  const pent = (cx, cy, r, rot) => {
    const p = [];
    for (let i = 0; i < 5; i++) {
      const a = (rot + i * 72) * Math.PI / 180;
      p.push(`${(cx + r * Math.sin(a)).toFixed(1)},${(cy - r * Math.cos(a)).toFixed(1)}`);
    }
    return p.join(" ");
  };
  const outer = ring.map((col, i) => {
    const a = (i * 72) * Math.PI / 180;
    const cx = 50 + 33 * Math.sin(a), cy = 50 - 33 * Math.cos(a);
    return `<polygon points="${pent(cx, cy, 15, 180 + i * 72)}" fill="${col}"
             stroke="${stroke}" stroke-width="2.5"/>`;
  }).join("");
  return `<svg viewBox="0 0 100 100" width="100%" height="100%">
    <circle cx="50" cy="50" r="46" fill="#F2F2F0"/>
    ${outer}
    <polygon points="${pent(50,50,17,0)}" fill="${center}" stroke="${stroke}" stroke-width="2.5"/>
    <circle cx="50" cy="50" r="46" fill="none" stroke="${stroke}" stroke-width="4"/>
  </svg>`;
}

const IDEAS = [
  { id:"a", name:"כדור · צהוב במרכז",
    html:`<div style="position:absolute;inset:0;background:${INK};padding:9%">
            ${ball(Y, [BS, MTA, HAI, HTA, "#1A1A1E"])}</div>` },

  { id:"b", name:"כדור צהוב · פאנלים צבעוניים",
    html:`<div style="position:absolute;inset:0;background:${INK};padding:9%">
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <circle cx="50" cy="50" r="46" fill="${Y}"/>
              ${[BS,MTA,HAI,HTA].map((c,i)=>{const a=(i*90+45)*Math.PI/180;
                 const cx=50+31*Math.sin(a), cy=50-31*Math.cos(a);
                 return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="11" fill="${c}"/>`}).join("")}
              <circle cx="50" cy="50" r="13" fill="${INK}"/>
              <circle cx="50" cy="50" r="46" fill="none" stroke="${INK}" stroke-width="5"/>
            </svg></div>` },

  { id:"c", name:"כדור · סימן שאלה",
    html:`<div style="position:absolute;inset:0;background:${INK};padding:9%">
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <circle cx="50" cy="50" r="46" fill="${Y}"/>
              ${[BS,MTA,HAI,HTA].map((c,i)=>{const a=(i*90+45)*Math.PI/180;
                 const cx=50+34*Math.sin(a), cy=50-34*Math.cos(a);
                 return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="8" fill="${c}"/>`}).join("")}
              <text x="50" y="72" text-anchor="middle" font-family="Georgia,serif"
                font-size="62" font-weight="700" fill="${INK}">?</text>
            </svg></div>` },

  { id:"d", name:"אריחי רמזים · צהוב ראשי",
    html:`<div style="position:absolute;inset:0;background:${INK};
            display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;
            gap:7%;padding:13%">
            <div style="background:${Y};border-radius:14%"></div>
            <div style="background:${MTA};border-radius:14%"></div>
            <div style="background:${HAI};border-radius:14%"></div>
            <div style="background:${BS};border-radius:14%"></div>
          </div>` },

  { id:"e", name:"צהוב דומיננטי · רצועה אחת",
    html:`<div style="position:absolute;inset:0;background:${Y};overflow:hidden">
            <div style="position:absolute;inset:-20%;
              background:linear-gradient(115deg,transparent 0 44%,${INK} 44% 56%,transparent 56% 100%)"></div>
            <svg viewBox="0 0 100 100" style="position:absolute;inset:0" width="100%" height="100%">
              <circle cx="50" cy="50" r="21" fill="${INK}"/>
              <circle cx="50" cy="50" r="14" fill="${Y}"/>
            </svg></div>` },

  { id:"f", name:"כדור צהוב · תפרים בצבעים",
    html:`<div style="position:absolute;inset:0;background:${INK};padding:8%">
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <circle cx="50" cy="50" r="47" fill="${Y}"/>
              <path d="M50 3 L50 97" stroke="${INK}" stroke-width="6"/>
              <path d="M9 26 L91 74" stroke="${BS}" stroke-width="6"/>
              <path d="M9 74 L91 26" stroke="${MTA}" stroke-width="6"/>
              <circle cx="50" cy="50" r="16" fill="${INK}"/>
              <circle cx="50" cy="50" r="9" fill="${HAI}"/>
            </svg></div>` },
];

/* גיליון השוואה: כל רעיון בגדול, וליד — 48 פיקסלים, הגודל
   שבו אייקון נראה בפועל על מסך הבית. */
const cell = (o) => `
  <div style="display:flex;flex-direction:column;align-items:center;gap:10px">
    <div style="position:relative;width:190px;height:190px;border-radius:22%;
      overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.35)">${o.html}</div>
    <div style="display:flex;align-items:center;gap:12px">
      <div style="position:relative;width:48px;height:48px;border-radius:22%;
        overflow:hidden">${o.html}</div>
      <div style="font:600 15px system-ui;color:#F2F2F0">${o.id.toUpperCase()} · ${o.name}</div>
    </div>
  </div>`;

const sheet = `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
 *{margin:0;padding:0;box-sizing:border-box}
 body{background:#17171B;padding:38px;font-family:system-ui}
 h1{color:#F2F2F0;font-size:22px;margin-bottom:6px}
 p{color:#9A9AA2;font-size:14px;margin-bottom:28px}
 .g{display:grid;grid-template-columns:repeat(3,1fr);gap:34px 26px}
</style></head><body>
 <h1>שש הצעות לאייקון</h1>
 <p>לכל הצעה: בגדול, ולידה ב-48 פיקסלים — הגודל שבו אייקון נראה באמת על מסך הבית.</p>
 <div class="g">${IDEAS.map(cell).join("")}</div>
</body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 880, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(sheet, { waitUntil: "load" });
await page.screenshot({ path: "store/icon-ideas/sheet.png", fullPage: true });
for (const o of IDEAS) {
  const p = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}html,body{width:512px;height:512px;overflow:hidden}
    .s{position:relative;width:512px;height:512px}</style></head>
    <body><div class="s">${o.html}</div></body></html>`, { waitUntil: "load" });
  await p.screenshot({ path: `store/icon-ideas/${o.id}.png` });
  await p.close();
}
await browser.close();
console.log("נוצרו:", IDEAS.map(o=>o.id).join(", "));
