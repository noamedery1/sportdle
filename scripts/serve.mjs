/* שרת סטטי מקומי ל-dist. עם no-cache, כמו בייצור (באג 6.6).

   בנוסף: נקודת קליטה לשאיבה ידנית מהדפדפן.
     POST /ingest/<שם-קובץ>   →  נכתב ל-data/raw/<שם-קובץ>
   זה מה שמאפשר להריץ את tools/urls.mjs → *-wf-console.js בדפדפן
   שלך, ולשלוח את התוצאה ישירות לפרויקט בלי להוריד קובץ ולהעביר ידנית.
   מאזין על לוקאלהוסט בלבד. */
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize, basename } from "node:path";
import { gunzipSync } from "node:zlib";

const PORT = +(process.env.PORT || 4173);
const ROOT = "dist";

/* ---------- הדומיין הקנוני ----------
   הכתובת הישנה ב-Railway עוד מגישה תנועה, ושני דומיינים עם אותו
   תוכן מפצלים דירוג בגוגל ומבלבלים תצוגות מקדימה. 301 מאחד אותם.

   מקור האמת הוא CANONICAL_HOST, ואם הוא לא מוגדר — הדומיין
   שב-config/site.json. אין דומיין מקודד כאן.

   **הערה חשובה:** השרת הזה מאזין על 127.0.0.1 בלבד והוא שרת
   פיתוח. הייצור הוא קבצים סטטיים במאגר אחר (ראה README), ולכן
   ההפניה שם צריכה לשבת ב-Cloudflare ולא בקוד. מה שכאן קיים כדי
   שההתנהגות תהיה זהה אם השרת הזה יוגש אי פעם. */
const CANONICAL_HOST = process.env.CANONICAL_HOST ||
  new URL(JSON.parse(readFileSync("config/site.json", "utf8")).siteUrl).host;

/* localhost נשאר בחוץ, אחרת פיתוח מקומי מקבל 301 לאתר החי */
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/i;

/* Cloudflare מסיים את ה-TLS ומעביר את המקור בכותרות. Host מגיע
   כ-x-forwarded-host, ולכן הוא נבדק ראשון — בדיוק מה ש-trust
   proxy עושה במסגרות אחרות.

   **אין כאן הפניית http→https.** מול Cloudflare במצב Full הבקשה
   מגיעה לאפליקציה ב-HTTP תמיד, ובדיקה על req.protocol הייתה
   יוצרת לופ אינסופי. אם צריך לאכוף https — x-forwarded-proto,
   וגם זה מיותר כשהאכיפה נעשית ב-Cloudflare. */
function canonicalRedirect(req, res) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  if (!host || LOCAL.test(host)) return false;
  if (host.toLowerCase() === CANONICAL_HOST.toLowerCase()) return false;

  const target = `https://${CANONICAL_HOST}${req.url}`;   // req.url כולל query
  /* כתובת האמת של הלקוח מגיעה מ-Cloudflare, לא מהחיבור */
  const ip = req.headers["cf-connecting-ip"] ||
             String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
             req.socket.remoteAddress;
  console.log(`301 ${host}${req.url} → ${target}  (${ip})`);
  res.writeHead(301, { Location: target, "Cache-Control": "no-store" });
  res.end();
  return true;
}
const TYPES = {
  ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml"
};

createServer((req, res) => {
  /* לפני הכל — לפני הקליטה, לפני ההגשה הסטטית, לפני כל השאר */
  if (canonicalRedirect(req, res)) return;

  const url = decodeURIComponent(req.url.split("?")[0]);

  /* --- קליטה מהדפדפן --- */
  if (url.startsWith("/ingest/")) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type"
    };
    if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
    if (req.method !== "POST") { res.writeHead(405, cors); return res.end("POST בלבד"); }

    const name = basename(url.slice("/ingest/".length));
    if (!/^[\w.-]+\.json$/.test(name)) {
      res.writeHead(400, cors); return res.end("שם קובץ לא תקין");
    }
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      let body = Buffer.concat(chunks).toString("utf8");
      /* מותר לשלוח gzip+base64 — קטן פי שמונה, וזה מה שמאפשר
         להעביר סגל של 57 עונות בבקשה אחת */
      if (req.headers["x-encoding"] === "gzip-base64") {
        try { body = gunzipSync(Buffer.from(body, "base64")).toString("utf8"); }
        catch (e) { res.writeHead(400, cors); return res.end("פענוח נכשל: " + e.message); }
      }
      try { JSON.parse(body); }
      catch (e) { res.writeHead(400, cors); return res.end("לא JSON תקין: " + e.message); }
      mkdirSync("data/raw", { recursive: true });
      writeFileSync(join("data/raw", name), body, "utf8");
      console.log(`נקלט data/raw/${name} · ${(body.length / 1024).toFixed(0)}KB`);
      res.writeHead(200, { ...cors, "Content-Type": "text/plain; charset=utf-8" });
      res.end("נשמר");
    });
    return;
  }

  /* --- קליטת אייקון שנוצר בקנבס בדפדפן ---
     POST /ingest-icon/<שם-קובץ>  עם base64 בגוף → נכתב ל-src/static/ */
  if (url.startsWith("/ingest-icon/") && req.method === "POST") {
    const name = basename(url.slice("/ingest-icon/".length));
    if (!/^[\w.-]+\.(png|ico)$/.test(name)) {
      res.writeHead(400); return res.end("שם קובץ לא תקין");
    }
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => {
      const buf = Buffer.from(Buffer.concat(chunks).toString("utf8"), "base64");
      mkdirSync("src/static", { recursive: true });
      writeFileSync(join("src/static", name), buf);
      console.log(`נקלט src/static/${name} · ${(buf.length / 1024).toFixed(1)}KB`);
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok " + buf.length);
    });
    return;
  }

  /* --- הגשה סטטית --- */
  let p = join(ROOT, normalize(url).replace(/^(\.\.[/\\])+/, ""));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p)) p = join(ROOT, "index.html");
  res.writeHead(200, {
    "Content-Type": TYPES[extname(p)] || "application/octet-stream",
    "Cache-Control": "no-cache, no-store, must-revalidate"
  });
  res.end(readFileSync(p));
}).listen(PORT, "127.0.0.1", () => {
  console.log(`http://localhost:${PORT}`);
  console.log(`קליטה: POST http://localhost:${PORT}/ingest/<slug>-worldfootball.json`);
});
