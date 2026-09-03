/* ============================================================
   icon-ideas2.mjs — סבב שני של הצעות לאייקון: "מפוצצות".

   node tools/icon-ideas2.mjs   →   store/icon-ideas2/

   הסבב הראשון (icon-ideas.mjs) היה שטוח ומינימלי ונדחה. כאן
   ההפך: גרדיאנטים, זוהר, קרניים ותנועה.

   כל הצעה נבדקת גם ב-48 פיקסלים בגיליון ההשוואה, כי זה הגודל
   שבו אייקון נראה בפועל על מסך הבית — ושם רוב הרעיונות מתים.
   ============================================================ */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { loadClubs } from "../scripts/lib/util.mjs";

const INK = "#0C0C0E";
const [Y, BS, MTA, HAI, HTA] = loadClubs().map(c => c.colors.brand);
mkdirSync("store/icon-ideas2", { recursive: true });

const svg = (inner, defs) =>
  '<svg viewBox="0 0 100 100" width="100%" height="100%" style="display:block">' +
  "<defs>" + (defs || "") + "</defs>" + inner + "</svg>";

/* מחומש — הצורה שהופכת עיגול לכדורגל */
function pent(cx, cy, r, rot) {
  const p = [];
  for (let i = 0; i < 5; i++) {
    const a = ((rot || 0) + i * 72) * Math.PI / 180;
    p.push((cx + r * Math.sin(a)).toFixed(1) + "," + (cy - r * Math.cos(a)).toFixed(1));
  }
  return p.join(" ");
}
const deg = d => d * Math.PI / 180;

const IDEAS = [];

/* ---------- G · קרני פיצוץ ---------- */
IDEAS.push({ id: "g", name: "קרני פיצוץ + כדור", html: svg(
  '<rect width="100" height="100" fill="url(#gbg)"/>' +
  Array.from({ length: 24 }, (_, i) => {
    const a1 = i * 15, a2 = a1 + 7.5, r = 80;
    const col = [Y, BS, MTA, HAI, HTA][i % 5];
    return '<polygon points="50,50 ' +
      (50 + r * Math.sin(deg(a1))).toFixed(1) + "," + (50 - r * Math.cos(deg(a1))).toFixed(1) + " " +
      (50 + r * Math.sin(deg(a2))).toFixed(1) + "," + (50 - r * Math.cos(deg(a2))).toFixed(1) +
      '" fill="' + col + '" opacity="' + (i % 5 === 0 ? 0.95 : 0.5) + '"/>';
  }).join("") +
  '<circle cx="50" cy="50" r="31" fill="' + INK + '" opacity=".6"/>' +
  '<circle cx="50" cy="50" r="26" fill="url(#gball)"/>' +
  '<polygon points="' + pent(50, 50, 11, 0) + '" fill="' + INK + '"/>' +
  [0, 1, 2, 3, 4].map(i => '<polygon points="' +
    pent(50 + 19 * Math.sin(deg(i * 72)), 50 - 19 * Math.cos(deg(i * 72)), 7, 180 + i * 72) +
    '" fill="' + INK + '" opacity=".85"/>').join(""),
  '<radialGradient id="gbg" cx="50%" cy="45%"><stop offset="0" stop-color="#2A2A32"/>' +
  '<stop offset="1" stop-color="' + INK + '"/></radialGradient>' +
  '<radialGradient id="gball" cx="38%" cy="30%"><stop offset="0" stop-color="#FFF0B8"/>' +
  '<stop offset=".55" stop-color="' + Y + '"/><stop offset="1" stop-color="#C68A00"/></radialGradient>'
)});

/* ---------- H · ניאון ---------- */
IDEAS.push({ id: "h", name: "ניאון · כדור זוהר", html: svg(
  '<rect width="100" height="100" fill="url(#hbg)"/>' +
  '<g filter="url(#glow)">' +
  '<circle cx="50" cy="50" r="28" fill="none" stroke="' + Y + '" stroke-width="8"/>' +
  '<path d="M22 50 H78" stroke="' + BS + '" stroke-width="5.5"/>' +
  '<path d="M30 30 L70 70" stroke="' + HTA + '" stroke-width="5.5"/>' +
  '<path d="M30 70 L70 30" stroke="' + HAI + '" stroke-width="5.5"/>' +
  "</g>" +
  '<circle cx="50" cy="50" r="28" fill="' + INK + '" opacity=".4"/>' +
  '<circle cx="50" cy="50" r="11" fill="' + Y + '" filter="url(#glow)"/>',
  '<radialGradient id="hbg"><stop offset="0" stop-color="#161628"/>' +
  '<stop offset="1" stop-color="#07070B"/></radialGradient>' +
  '<filter id="glow" x="-60%" y="-60%" width="220%" height="220%">' +
  '<feGaussianBlur stdDeviation="3.4" result="b"/><feMerge>' +
  '<feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
)});

/* ---------- I · סימן שאלה ענק ---------- */
IDEAS.push({ id: "i", name: "סימן שאלה ענק · כדור כנקודה", html: svg(
  '<rect width="100" height="100" fill="url(#ibg)"/>' +
  Array.from({ length: 12 }, (_, i) => {
    const a = i * 30;
    return '<polygon points="50,50 ' +
      (50 + 95 * Math.sin(deg(a))).toFixed(1) + "," + (50 - 95 * Math.cos(deg(a))).toFixed(1) + " " +
      (50 + 95 * Math.sin(deg(a + 15))).toFixed(1) + "," + (50 - 95 * Math.cos(deg(a + 15))).toFixed(1) +
      '" fill="#FFFFFF" opacity=".055"/>';
  }).join("") +
  '<text x="50" y="62" text-anchor="middle" font-size="80" font-weight="900" ' +
  'font-family="Impact, Haettenschweiler, Arial Black, sans-serif" ' +
  'fill="url(#iq)" stroke="' + INK + '" stroke-width="3" paint-order="stroke">?</text>' +
  '<circle cx="50" cy="83" r="10.5" fill="url(#iball)" stroke="' + INK + '" stroke-width="2.2"/>' +
  '<polygon points="' + pent(50, 83, 4.6, 0) + '" fill="' + INK + '"/>',
  '<linearGradient id="ibg" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0" stop-color="#20202A"/><stop offset="1" stop-color="' + INK + '"/></linearGradient>' +
  '<linearGradient id="iq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE894"/>' +
  '<stop offset=".5" stop-color="' + Y + '"/><stop offset="1" stop-color="#E09B00"/></linearGradient>' +
  '<radialGradient id="iball" cx="35%" cy="28%"><stop offset="0" stop-color="#FFFFFF"/>' +
  '<stop offset="1" stop-color="' + Y + '"/></radialGradient>'
)});

/* ---------- J · רצועות אזהרה — השפה שכבר קיימת במשחק ---------- */
IDEAS.push({ id: "j", name: "רצועות אזהרה + כדור", html: svg(
  '<rect width="100" height="100" fill="' + INK + '"/>' +
  Array.from({ length: 14 }, (_, i) =>
    '<polygon points="' + (-40 + i * 14) + ',0 ' + (-26 + i * 14) + ',0 ' +
    (-54 + i * 14) + ',100 ' + (-68 + i * 14) + ',100" fill="' + Y + '"/>').join("") +
  '<rect y="28" width="100" height="44" fill="' + INK + '" opacity=".92"/>' +
  '<circle cx="50" cy="50" r="22" fill="url(#jb)" stroke="' + INK + '" stroke-width="3"/>' +
  '<polygon points="' + pent(50, 50, 9.5, 0) + '" fill="' + INK + '"/>' +
  [0, 1, 2, 3, 4].map(i => '<polygon points="' +
    pent(50 + 15.5 * Math.sin(deg(i * 72)), 50 - 15.5 * Math.cos(deg(i * 72)), 5.8, 180 + i * 72) +
    '" fill="' + [BS, MTA, HAI, HTA, INK][i] + '"/>').join(""),
  '<radialGradient id="jb" cx="34%" cy="26%"><stop offset="0" stop-color="#FFFFFF"/>' +
  '<stop offset=".6" stop-color="#F2F2F0"/><stop offset="1" stop-color="#BFBFBA"/></radialGradient>'
)});

/* ---------- K · פאנלים מתפוצצים ---------- */
IDEAS.push({ id: "k", name: "פאנלים מתפוצצים", html: svg(
  '<rect width="100" height="100" fill="url(#kbg)"/>' +
  '<circle cx="50" cy="53" r="25" fill="url(#kball)"/>' +
  '<polygon points="' + pent(50, 53, 10.5, 0) + '" fill="' + INK + '"/>' +
  [[17, 15, 9.5, BS, -25], [82, 19, 8.5, MTA, 30], [86, 76, 9.5, HAI, 15],
   [15, 80, 8.5, HTA, -40], [50, 8, 7.5, Y, 0]]
    .map(v => '<polygon points="' + pent(v[0], v[1], v[2], v[4]) +
      '" fill="' + v[3] + '" stroke="' + INK + '" stroke-width="2"/>').join("") +
  [[29, 30], [72, 33], [75, 67], [27, 70]].map(v =>
    '<circle cx="' + v[0] + '" cy="' + v[1] + '" r="2.4" fill="' + Y + '" opacity=".85"/>').join(""),
  '<radialGradient id="kbg"><stop offset="0" stop-color="#35353F"/>' +
  '<stop offset="1" stop-color="' + INK + '"/></radialGradient>' +
  '<radialGradient id="kball" cx="34%" cy="26%"><stop offset="0" stop-color="#FFF3C4"/>' +
  '<stop offset=".6" stop-color="' + Y + '"/><stop offset="1" stop-color="#B87E00"/></radialGradient>'
)});

/* ---------- L · תנועה ---------- */
IDEAS.push({ id: "l", name: "תנועה · כדור בועט", html: svg(
  '<rect width="100" height="100" fill="url(#lbg)"/>' +
  [[26, BS, 6], [40, MTA, 5.5], [54, HAI, 5], [68, HTA, 4.5]].map((v, i) =>
    '<path d="M1 ' + v[0] + " Q28 " + (v[0] - 5) + " " + (50 - i * 3) + " " + v[0] +
    '" stroke="' + v[1] + '" stroke-width="' + v[2] +
    '" fill="none" opacity=".9" stroke-linecap="round"/>').join("") +
  '<ellipse cx="70" cy="88" rx="27" ry="5" fill="' + INK + '" opacity=".55"/>' +
  '<circle cx="70" cy="46" r="26" fill="url(#lball)" stroke="' + INK + '" stroke-width="3"/>' +
  '<polygon points="' + pent(70, 46, 11, 0) + '" fill="' + INK + '"/>' +
  [0, 1, 2, 3, 4].map(i => '<polygon points="' +
    pent(70 + 18.5 * Math.sin(deg(i * 72)), 46 - 18.5 * Math.cos(deg(i * 72)), 6.8, 180 + i * 72) +
    '" fill="' + INK + '" opacity=".9"/>').join(""),
  '<linearGradient id="lbg" x1="0" y1="1" x2="1" y2="0">' +
  '<stop offset="0" stop-color="' + INK + '"/><stop offset="1" stop-color="#30303A"/></linearGradient>' +
  '<radialGradient id="lball" cx="33%" cy="25%"><stop offset="0" stop-color="#FFF6D6"/>' +
  '<stop offset=".55" stop-color="' + Y + '"/><stop offset="1" stop-color="#C98C00"/></radialGradient>'
)});

/* ---------- גיליון השוואה ---------- */
const cell = o =>
  '<div style="display:flex;flex-direction:column;align-items:center;gap:10px">' +
  '<div style="position:relative;width:190px;height:190px;border-radius:22%;overflow:hidden;' +
  'box-shadow:0 5px 18px rgba(0,0,0,.45)">' + o.html + "</div>" +
  '<div style="display:flex;align-items:center;gap:12px">' +
  '<div style="position:relative;width:48px;height:48px;border-radius:22%;overflow:hidden">' +
  o.html + "</div>" +
  '<div style="font:600 15px system-ui;color:#F2F2F0">' + o.id.toUpperCase() + " · " + o.name +
  "</div></div></div>";

const sheet = '<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>' +
  "*{margin:0;padding:0;box-sizing:border-box}" +
  "body{background:#17171B;padding:38px;font-family:system-ui}" +
  "h1{color:#F2F2F0;font-size:22px;margin-bottom:6px}" +
  "p{color:#9A9AA2;font-size:14px;margin-bottom:28px}" +
  ".g{display:grid;grid-template-columns:repeat(3,1fr);gap:34px 26px}" +
  "</style></head><body><h1>סבב שני · יותר מפוצצות</h1>" +
  "<p>גרדיאנטים, זוהר, קרניים ותנועה. לכל הצעה — בגדול, ולידה ב-48 פיקסלים.</p>" +
  '<div class="g">' + IDEAS.map(cell).join("") + "</div></body></html>";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 880, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(sheet, { waitUntil: "load" });
await page.screenshot({ path: "store/icon-ideas2/sheet.png", fullPage: true });

for (const o of IDEAS) {
  const p = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  await p.setContent('<!doctype html><html><head><meta charset="utf-8"><style>' +
    "*{margin:0;padding:0;box-sizing:border-box}html,body{width:512px;height:512px;overflow:hidden}" +
    ".s{position:relative;width:512px;height:512px}</style></head><body>" +
    '<div class="s">' + o.html + "</div></body></html>", { waitUntil: "load" });
  await p.screenshot({ path: "store/icon-ideas2/" + o.id + ".png" });
  await p.close();
}
await browser.close();
console.log("נוצרו: " + IDEAS.map(o => o.id).join(", "));
