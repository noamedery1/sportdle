/* ============================================================
   friend-check.mjs — האם "עזרת חבר" אומרת אמת?

   node tools/friend-check.mjs [--games=60]

   הפיצ'ר גוזר גבולות על המבוקש מתוך החצים והצבעים בלבד. אם גבול
   אחד שגוי, ההודעה ששלחת לחבר **פוסלת את התשובה הנכונה** — והוא
   יחפש במקום שאין בו כלום. זו לא תקלה שמתגלה בעין: הטקסט ייראה
   סביר לחלוטין.

   לכן הבדיקה כאן היא תכונה ולא דוגמה: משחקים משחקים אמיתיים בדף
   האמיתי, עם compare() האמיתי, ואחרי כל ניחוש מוודאים שהתשובה
   שנבחרה לחידה עדיין נמצאת בתוך כל גבול שנגזר.

   הדף מורץ מ-dist דרך scripts/serve.mjs, כי הלוגיקה חיה בתוך
   engine.js אחרי ההזרקה של build.mjs — בדיקה על המקור הייתה
   בודקת קובץ אחר מזה שרץ אצל השחקן.
   ============================================================ */
import { chromium } from "playwright";
import { spawn } from "node:child_process";

const args  = Object.fromEntries(process.argv.slice(2)
  .map(a => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const GAMES = +(args.games || 60);
const PORT  = 4187;
const BASE  = `http://localhost:${PORT}`;

const srv = spawn(process.execPath, ["scripts/serve.mjs"],
  { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
const stop = () => { try { srv.kill(); } catch (e) {} };
process.on("exit", stop);

/* המתנה לשרת במקום sleep קבוע */
for (let i = 0; i < 50; i++) {
  try { await fetch(BASE + "/players.json"); break; } catch (e) {}
  await new Promise(r => setTimeout(r, 200));
}

const browser = await chromium.launch({ headless: true });
const clubs = ["beitar", "maccabi-haifa", "maccabi-ta", "hapoel-ta", "hapoel-bs"];

let checks = 0, bad = [];
let sample = null;

for (const slug of clubs) {
  const ctx  = await browser.newContext({ locale: "he-IL" });
  await ctx.addInitScript(([s]) => {
    try { localStorage.clear(); localStorage.setItem("sportdel:seen", "1"); } catch (e) {}
  }, [slug]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${slug}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof submit === "function" && typeof knownFacts === "function");

  for (let g = 0; g < Math.ceil(GAMES / clubs.length); g++) {
    const res = await page.evaluate((seed) => {
      /* חידה אקראית מתוך אלה שכבר פורסמו, ולא רק של היום */
      const n = 1 + Math.floor(Math.random() * Math.max(1, todayNo));
      loadPuzzle(n);

      /* ניחושים אקראיים מהמאגר הניתן לניחוש, בלי לפגוע בתשובה —
         פגיעה מסיימת את המשחק ומאפסת את הלוח. */
      const pool = club.players.filter(p => p.he !== answer.name);
      const pick = () => pool[Math.floor(Math.random() * pool.length)].he;

      const out = [];
      const howMany = 3 + Math.floor(Math.random() * 4);   // 3..6
      for (let i = 0; i < howMany && !over; i++) {
        submit(pick());
        if (over) break;
        const f = knownFacts();
        out.push({
          n, guesses: guesses.length,
          pos:  [...f.posCand],
          natHit: f.natHit, natOut: [...f.natOut],
          num:  JSON.parse(JSON.stringify(f.num)),
          /* מה שהבדיקה מצליבה מולו — נקרא כאן ולא נחשף לדף */
          a: { pos: answer.pos, nats: answer.nats.map(x => NAT_HE[x] || x),
               from: answer.from, titles: answer.titles, born: answer.born },
          text: friendText()
        });
      }
      return out;
    });

    for (const r of res) {
      checks++;
      if (!sample && r.guesses >= 4) sample = r.text;
      const why = [];

      if (r.a.pos && !r.pos.includes(r.a.pos))
        why.push(`עמדה ${r.a.pos} נשללה (נותרו ${r.pos.join(",")})`);

      if (r.natHit && !r.a.nats.includes(r.natHit))
        why.push(`לאום "${r.natHit}" אינו של המבוקש (${r.a.nats.join(",")})`);
      for (const n of r.natOut)
        if (r.a.nats.includes(n)) why.push(`לאום "${n}" נפסל אך הוא של המבוקש`);

      const cmp = [["עונה 1", r.a.from], ["תארים", r.a.titles], ["נולד", r.a.born]];
      for (const [k, v] of cmp) {
        const b = r.num[k];
        if (v == null) continue;
        if (b.exact != null && b.exact !== v) why.push(`${k}: מדויק ${b.exact} אך בפועל ${v}`);
        if (b.lo != null && v < b.lo)         why.push(`${k}: גבול תחתון ${b.lo} אך בפועל ${v}`);
        if (b.hi != null && v > b.hi)         why.push(`${k}: גבול עליון ${b.hi} אך בפועל ${v}`);
      }
      if (why.length) bad.push({ slug, puzzle: r.n, guesses: r.guesses, why });
    }
  }
  await ctx.close();
}

/* ---------- כיוון דו-כיווני ----------
   ההודעה נקראת גם בוואטסאפ ווב בממשק אנגלי, כלומר בהקשר LTR. תו
   ניטרלי בתחילת שורה (נקודה, מקף, מספר) נוחת שם בצד ההפוך, והשורה
   נראית שבורה — בלי שום שגיאה ובלי שזה נראה במכשיר שלנו.

   הבדיקה מודדת מיקום בפועל: כל תו בנפרד, בשני ההקשרים, ומשווה את
   הסדר החזותי. שורה שהסדר שלה זהה בשניהם יציבה. חריגים מוכרים:
   סימן שאלה בסוף משפט וקו נטוי בסוף כתובת — שניהם כבר קיימים
   ב-shareText() מאז ומעולם. */
{
  const page = await (await browser.newContext({ locale: "he-IL" })).newPage();
  /* נמדד **בלי הכוכביות**, כי זה מה שמוצג בפועל: וואטסאפ בולע אותן
     כסימון bold. מדידה על הטקסט הגולמי מדווחת על תו שאיש לא רואה,
     ואז מסננים חריגים אמיתיים כדי להשתיק רעש. */
  const lines = (sample || "").split("\n").map(l => l.replace(/\*/g, "").trim()).filter(Boolean);
  await page.setContent(`<meta charset="utf-8">` +
    lines.map((_, i) => `<div id="l${i}" dir="ltr"></div><div id="r${i}" dir="rtl"></div>`).join(""));
  const diff = await page.evaluate((lines) => {
    const order = (el, txt) => {
      el.textContent = txt;
      const n = el.firstChild, out = [];
      for (let i = 0; i < txt.length; i++) {
        if (txt[i] === " ") continue;
        const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1);
        out.push([r.getBoundingClientRect().left, txt[i]]);
      }
      return out.sort((a, b) => a[0] - b[0]).map(x => x[1]).join("");
    };
    return lines.map((t, i) => ({
      t,
      same: order(document.getElementById("l" + i), t) === order(document.getElementById("r" + i), t)
    })).filter(x => !x.same).map(x => x.t);
  }, lines);

  /* הכלל שנמדד: שורה יציבה אם היא **מתחילה ומסתיימת** באות עברית.
     הכוכביות של ה-bold אינן נספרות — וואטסאפ בולע אותן.

     החריגים המותרים הם שורות שמסתיימות בלועזית או בספרה מעצם
     טבען: הכותרת (שם המשחק נגמר ב-"dle" ואחריו "#N") והכתובת.
     שורה שנופלת מסיבה אחרת — ובעיקר כזו שמתחילה בתו ניטרלי — היא
     תקלה אמיתית ומפילה את הבדיקה. */
  const known = t => /^https?:\/\//.test(t) || /[A-Za-z0-9]$/.test(t);
  const real  = diff.filter(t => !known(t));
  console.log(`\nbidi: ${lines.length} שורות · ${diff.length} זזות · ${real.length} תקלות`);
  for (const t of diff.filter(known)) console.log(`  ~ חריג מותר: ${t}`);
  for (const t of real) { console.log(`  ✗ ${t}`); bad.push({ slug: "bidi", puzzle: "-", guesses: "-", why: [t] }); }
}

await browser.close();
stop();

console.log(`\nנבדקו ${checks} מצבי לוח על פני ${clubs.length} מועדונים.`);
if (sample) console.log(`\n--- דוגמה להודעה ---\n${sample}\n--------------------`);
if (bad.length) {
  console.log(`\n✗ ${bad.length} סתירות:`);
  for (const b of bad.slice(0, 12))
    console.log(`  ${b.slug} #${b.puzzle} אחרי ${b.guesses}: ${b.why.join(" · ")}`);
  process.exit(1);
}
console.log("✓ אף גבול לא שלל את המבוקש.");
