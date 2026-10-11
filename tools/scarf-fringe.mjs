/* ============================================================
   scarf-fringe.mjs — גדילי הצעיף, בשני צבעי המועדון

   node tools/scarf-fringe.mjs

   קלט:  assets/scarf-fringe-src.png — חיתוך הגדילים מהקומפוזיציה
         המאושרת של עולם הצעיף (Gemini, אוקטובר 2026), הקצה הימני.
   פלט:  src/static/scarf/fringe-<slug>.webp לכל מועדון, עם שקיפות.

   למה לא צביעה ב-CSS: בקומפוזיציה הגדילים מתחלפים — צהוב, שחור,
   צהוב — ו-multiply יכול לצבוע רק בצבע אחד. כאן הגדילים הבהירים
   מזוהים לפי צבע (צהוב רווי), והכהים נגזרים מהם בהסטה של חצי מחזור,
   כי הם יושבים בדיוק ביניהם. הכהים לא ניתנים להפרדה מהקרקע הכהה
   לפי צבע, ולכן לא מנסים.

   בלי תלויות: ffmpeg מפענח ל-RGBA גולמי ומקודד חזרה ל-WebP.
   ============================================================ */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SRC = "assets/scarf-fringe-src.png";
const [W, H] = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", SRC],
  { encoding: "utf8" }).trim().split(",").map(Number);
const px = execFileSync("ffmpeg", ["-v", "error", "-i", SRC, "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 64 << 20 });

/* גדיל בהיר: צהוב רווי. ערך רך כדי שהשוליים לא ייצאו מדורגים. */
const light = new Float32Array(W * H), shade = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) {
  const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
  const sat = (Math.min(r, g) - b) / 255;                 // צהוב: R,G גבוהים, B נמוך
  light[i] = Math.max(0, Math.min(1, (sat - .18) / .22));
  shade[i] = Math.min(1, (r + g) / 2 / 235);              // ההצללה של הצמר
}

/* המחזור: אוטוקורלציה של סכומי השורות בגדילים הבהירים */
const rows = Array.from({ length: H }, (_, y) => light.slice(y * W, y * W + W).reduce((a, v) => a + v, 0));
let best = 0, period = 60;
for (let p = 30; p < Math.min(160, H / 2); p++) {
  let s = 0; for (let y = 0; y + p < H; y++) s += rows[y] * rows[y + p];
  if (s > best) { best = s; period = p; }
}
const half = Math.round(period / 2);

const hex = h => h.replace("#", "").match(/.{2}/g).map(x => parseInt(x, 16));
const lum = h => { const [R, G, B] = hex(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return .2126 * R + .7152 * G + .0722 * B; };
/* פס כהה מדי לא מראה צמר: אותו רצפה כמו --second-band ב-applyTheme */
const floor = h => lum(h) < lum("#26272D") ? "#26272D" : h;

const clubs = JSON.parse(readFileSync("config/clubs.json", "utf8"));
/* config/clubs.json ממופה לפי slug, והמפתחות שמתחילים ב-"_" הם תיעוד */
const list = Object.entries(clubs).filter(([k, v]) => !k.startsWith("_") && v && v.colors).map(([slug, v]) => ({ ...v, slug }));
for (const c of list) {
  const A = hex(c.colors.brand), B = hex(floor(c.colors.second || c.colors.ink));
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, j = ((y + half) % H) * W + x;     // הגדיל הכהה: אותו צורה, חצי מחזור הלאה
    const a = light[i], d = light[j] * (1 - a);
    const sa = .55 + .45 * shade[i], sd = .55 + .45 * shade[j];
    const al = Math.min(1, a + d);
    for (let k = 0; k < 3; k++)
      out[i * 4 + k] = al ? Math.round((A[k] * sa * a + B[k] * sd * d) / al) : 0;
    out[i * 4 + 3] = Math.round(al * 255);
  }
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-i", "-",
    "-c:v", "libwebp", "-quality", "85", `src/static/scarf/fringe-${c.slug}.webp`], { input: out });
  console.log(`fringe-${c.slug}.webp · מחזור ${period}px`);
}
