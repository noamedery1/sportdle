/* בדיקת עץ הפריסה לפני דחיפה.
   node tools/qa-deploy.mjs <נתיב-לריפו>

   קיים בגלל באג אמיתי: תוספת ידנית ל-index.html הישן הכניסה
   `!//sportdle//` — שני לוכסנים פותחים הערה, וכל הסקריפט נשבר.
   הדף נראה תקין עד שניסית לשחק. `git diff` לא תופס דבר כזה. */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2];
if (!ROOT || !existsSync(ROOT)) {
  console.error("שימוש: node tools/qa-deploy.mjs <נתיב-לריפו>");
  process.exit(1);
}

const fails = [], ok = [];
const fail = m => fails.push(m);
const pass = m => ok.push(m);

function scripts(html) {
  return [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).filter(s => s.trim());
}

function checkHtml(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return fail(`חסר ${rel}`);
  const html = readFileSync(p, "utf8");

  /* כל בלוק סקריפט חייב להתקמפל */
  scripts(html).forEach((s, i) => {
    try { new Function(s); pass(`${rel} · בלוק סקריפט ${i + 1}`); }
    catch (e) { fail(`${rel} · בלוק סקריפט ${i + 1}: ${e.message}`); }
  });

  /* תגיות מאוזנות */
  const body = html.slice(html.indexOf("<body>")).replace(/<script[\s\S]*?<\/script>/g, "");
  for (const tag of ["div", "section", "nav", "header", "footer"]) {
    const o = (body.match(new RegExp(`<${tag}[\\s>]`, "g")) || []).length;
    const c = (body.match(new RegExp(`</${tag}>`, "g")) || []).length;
    if (o !== c) fail(`${rel} · <${tag}> לא מאוזן (${o}/${c})`);
  }

  /* מזהים כפולים */
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dup = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
  if (dup.length) fail(`${rel} · מזהים כפולים: ${dup.join(", ")}`);

  /* כל נכס יחסי שהדף מבקש חייב להתקיים */
  const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
  const assets = [...html.matchAll(/(?:href|src)="(?!https?:|data:|mailto:|#|javascript:)([^"?#]+)/g)]
    .map(m => m[1]).filter(a => /\.(png|ico|json|css|js)$/.test(a));
  for (const a of [...new Set(assets)]) {
    const target = a.startsWith("/") ? join(ROOT, a) : join(ROOT, dir, a);
    if (!existsSync(target)) fail(`${rel} · נכס חסר: ${a}`);
  }
  if (assets.length) pass(`${rel} · ${new Set(assets).size} נכסים קיימים`);
  return html;
}

/* ---------- הדף הישן ---------- */
const old = checkHtml("index.html");
if (old) {
  if (!/id="toSportdle"/.test(old)) fail("index.html · אין קישור מעבר ל-SportDle");
  else pass("index.html · קישור מעבר קיים");
  if (!/sportdle\./.test(old)) fail("index.html · אין הפניה לפי דומיין");
  else pass("index.html · הפניה לפי דומיין");
  /* ההפניה חייבת להיות יחסית. הפניה לדומיין אחר חוצה origin,
     ואז ה-localStorage של השחקן נשאר מאחור. */
  if (/location\.replace\("https?:/.test(old))
    fail("index.html · ההפניה מוחלטת — חוצה origin ומאבדת אחסון");
  else if (!/location\.replace\("\.\/sportdle\//.test(old))
    fail("index.html · לא נמצאה הפניה יחסית ל-./sportdle/");
  else pass("index.html · הפניה יחסית, אותו origin");
}

/* ---------- הדף החדש ---------- */
const neu = checkHtml("sportdle/index.html");
if (neu) {
  for (const s of ["ביתרdle", "באר־שבעdle", "מכביdle", "חיפהdle", "הפועלdle"])
    if (!neu.includes(s)) fail(`sportdle · חסר המועדון ${s}`);
  pass("sportdle · חמשת המועדונים");
  const mf = join(ROOT, "sportdle/manifest.json");
  if (existsSync(mf)) {
    const m = JSON.parse(readFileSync(mf, "utf8"));
    /* הכל יחסי. "/" כאן היה שולח מי שהתקין דרך הכתובת הישנה
       (…/sportdle/) לשורש beitardle — עמוד אחר. ראה scripts/build.mjs. */
    for (const k of ["start_url", "scope"])
      if (m[k] && !m[k].startsWith("."))
        fail(`sportdle/manifest · ${k}=${m[k]} (צריך יחסי)`);
    const abs = (m.icons || []).map(i => i.src).filter(s => /^([a-z]+:)?\//.test(s));
    if (abs.length) fail(`sportdle/manifest · אייקון מוחלט: ${abs.join(", ")}`);
    if (!fails.some(f => f.includes("manifest"))) pass("sportdle/manifest · יחסי לגמרי");
    for (const i of m.icons || [])
      if (!existsSync(join(ROOT, "sportdle", i.src))) fail(`sportdle/manifest · אייקון חסר ${i.src}`);
  } else fail("sportdle · אין manifest.json");
}

/* ---------- הנתונים של בית"ר זהים בשני הדפים ---------- */
function grab(h, n) {
  const s = h.indexOf(`const ${n} = [`); if (s < 0) return null;
  const o = h.indexOf("[", s); let d = 0, i = o;
  for (; i < h.length; i++) { if (h[i] === "[") d++; else if (h[i] === "]" && !--d) break; }
  return new Function(`return ${h.slice(o, i + 1)}`)();
}
if (old && neu) {
  const S = grab(old, "SCHEDULE");
  const m = neu.match(/const CLUBS\s*=\s*(\{[\s\S]*?\});\nconst CLUB_ORDER/);
  const C = m ? new Function(`return ${m[1]}`)() : null;
  if (!S || !C) fail("לא הצלחתי להשוות את הלוחות");
  else {
    const b = C.beitar.schedule;
    const same = S.every((n, i) => b[i] === n);
    if (!same) {
      const i = S.findIndex((n, i) => b[i] !== n);
      fail(`הלוח נבדל בחידה #${i + 1}: "${S[i]}" ≠ "${b[i]}"`);
    } else pass(`${S.length} החידות של הייצור זהות בשני הדפים`);
  }
}

/* ---------- דוח ---------- */
console.log(`\n✓ עברו ${ok.length}`);
ok.forEach(o => console.log("   " + o));
if (fails.length) {
  console.log(`\n✖ נכשלו ${fails.length}`);
  fails.forEach(f => console.log("   " + f));
  process.exit(1);
}
console.log("\nעץ הפריסה תקין.");
