/* ============================================================
   social.mjs — הפוסט היומי.

   node tools/social.mjs            הרצה יבשה: מדפיס ולא שולח
   node tools/social.mjs --post     שולח בפועל
   node tools/social.mjs --day=12   מייצר את הפוסט של חידה #12
   node tools/social.mjs --post --video=clip.mp4   פוסט עם סרטון

   מה נשלח, ולמה דווקא זה:

   **תשובות של אתמול + קישור להיום.** לא רמז ולא שאלה על החידה
   הנוכחית — כל דבר כזה משנה את המשחק למי שעוד לא שיחק, ופוסט
   שמקלקל חידה עובד פעם אחת ואז אנשים מפסיקים לעקוב. תשובות של
   אתמול נותנות סגירה למי ששיחק, סקרנות למי שלא, ואפס נזק.

   שני ערוצים, שניהם אופציונליים ועצמאיים:
     FB_PAGE_ID + FB_PAGE_TOKEN   → עמוד פייסבוק
     TG_BOT_TOKEN + TG_CHAT_ID    → ערוץ טלגרם
   חסר סוד — הערוץ מדולג בשקט. הריצה לא נכשלת בגללו, כי cron
   שנכשל כל יום מפסיקים להסתכל עליו.
   ============================================================ */
import { readFileSync, existsSync } from "node:fs";
import { readJSON, loadClubs, parseArgs, log, warn, season } from "../scripts/lib/util.mjs";

const args = parseArgs();
const POST = !!args.post;
const GRAPH = "https://graph.facebook.com/v21.0";

/* מספר החידה של היום — אותו חישוב בדיוק כמו במשחק */
function dayIndex() {
  const site = readJSON("config/site.json");
  const [y, m, d] = site.start;
  const start = Date.UTC(y, m - 1, d);
  const n = new Date();
  const today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  return Math.max(0, Math.floor((today - start) / 86400000));
}

const todayNo = args.day ? +args.day : dayIndex() + 1;
const site = readJSON("config/site.json");
const base = String(site.siteUrl).replace(/\/$/, "");

/* ---------- הרכבת הטקסט ---------- */
const rows = [];
for (const club of loadClubs()) {
  const db = readJSON(`data/clubs/${club.slug}.json`, null);
  if (!db) continue;
  const y = db.schedule[todayNo - 2];        // אתמול
  if (!y) continue;
  const p = db.players.find(x => x.he === y);
  const era = p ? ` (${season(p.spells[0][0])})` : "";
  rows.push(`${db.game} — ${y}${era}`);
}

const lines = [`SportDle · חידה #${todayNo}`, ""];
if (rows.length) {
  lines.push(`התשובות של אתמול (#${todayNo - 1}):`, ...rows, "");
}
lines.push("החידה של היום כבר באוויר. שמונה ניסיונות.");
lines.push("חמישה מועדונים, לכל אחד מאגר ולוח משלו.");
lines.push("");
lines.push(`${base}/`);
const message = lines.join("\n");

/* ---------- שליחה ---------- */
async function toFacebook(text) {
  const id = process.env.FB_PAGE_ID, token = process.env.FB_PAGE_TOKEN;
  if (!id || !token) { warn("פייסבוק: אין FB_PAGE_ID/FB_PAGE_TOKEN — מדלגים"); return null; }
  const body = new URLSearchParams({ message: text, link: `${base}/`, access_token: token });
  const r = await fetch(`${GRAPH}/${id}/feed`, { method: "POST", body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { warn(`פייסבוק ${r.status}: ${JSON.stringify(j).slice(0, 300)}`); return null; }
  log(`  פייסבוק: פורסם (${j.id})`);
  return j.id;
}

async function toTelegram(text) {
  const token = process.env.TG_BOT_TOKEN, chat = process.env.TG_CHAT_ID;
  if (!token || !chat) { warn("טלגרם: אין TG_BOT_TOKEN/TG_CHAT_ID — מדלגים"); return null; }
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: false })
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) { warn(`טלגרם: ${JSON.stringify(j).slice(0, 300)}`); return null; }
  log("  טלגרם: פורסם");
  return true;
}

/* וידאו — אותו עמוד, נקודת קצה אחרת. הפוסט הופך לסרטון עם
   טקסט, וזה מה שפייסבוק דוחף הכי חזק. טיקטוק לא נכנס לכאן:
   ה-API שלו לפרסום דורש אישור שותפים, וההעלאה שם ידנית. */
async function videoToFacebook(text, path) {
  const id = process.env.FB_PAGE_ID, token = process.env.FB_PAGE_TOKEN;
  if (!id || !token) { warn("פייסבוק: אין סודות — מדלגים על הווידאו"); return null; }
  if (!existsSync(path)) { warn(`אין קובץ וידאו: ${path}`); return null; }
  const fd = new FormData();
  fd.set("access_token", token);
  fd.set("description", text);
  fd.set("source", new Blob([readFileSync(path)], { type: "video/mp4" }), "clip.mp4");
  const r = await fetch(`${GRAPH}/${id}/videos`, { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { warn(`פייסבוק וידאו ${r.status}: ${JSON.stringify(j).slice(0, 300)}`); return null; }
  log(`  פייסבוק: סרטון פורסם (${j.id})`);
  return j.id;
}

async function videoToTelegram(text, path) {
  const token = process.env.TG_BOT_TOKEN, chat = process.env.TG_CHAT_ID;
  if (!token || !chat) { warn("טלגרם: אין סודות — מדלגים על הווידאו"); return null; }
  if (!existsSync(path)) return null;
  const fd = new FormData();
  fd.set("chat_id", chat);
  fd.set("caption", text);
  fd.set("video", new Blob([readFileSync(path)], { type: "video/mp4" }), "clip.mp4");
  const r = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) { warn(`טלגרם וידאו: ${JSON.stringify(j).slice(0, 300)}`); return null; }
  log("  טלגרם: סרטון פורסם");
  return true;
}

/* ---------- ראשי ---------- */
console.log("\n" + "─".repeat(52));
console.log(message);
console.log("─".repeat(52) + "\n");

if (!POST) {
  log("הרצה יבשה. לשליחה בפועל: node tools/social.mjs --post");
} else {
  if (args.video) {
    await videoToFacebook(message, args.video);
    await videoToTelegram(message, args.video);
  } else {
    await toFacebook(message);
    await toTelegram(message);
  }
  log("סיום.");
}
