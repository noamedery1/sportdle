/* ============================================================
   test-apps-script.mjs — בדיקת server/apps-script.gs

   node tools/test-apps-script.mjs

   Apps Script לא רץ מקומית, ולכן הקובץ נטען בהקשר משלו עם גיליון
   מדומה ועם דמויות במקום ה-API של גוגל. שני חלקים:

     1. אימות — מה בכלל יכול להיכנס לתור התיקונים
     2. סטטיסטיקה — הפרדה בין מועדונים, והניקוי השבועי

   החלק השני קיים כי purgeEvents **מוחק שורות**, ובדיקת תחביר לא
   אומרת דבר על מה נשאר אחריו.
   ============================================================ */
import { readFileSync } from "node:fs";
import vm from "node:vm";

/* ============================================================
   גיליון מדומה — מערך דו-ממדי עם ה-API שהקוד באמת משתמש בו
   ============================================================ */
function makeSheet(name, rows = []) {
  const s = {
    name,
    rows,
    getName: () => name,
    getLastRow: () => s.rows.length,
    getLastColumn: () => s.rows.reduce((m, r) => Math.max(m, r.length), 0),
    appendRow: r => s.rows.push(r.slice()),
    setFrozenRows: () => {},
    getDataRange: () => range(1, 1, Math.max(s.rows.length, 1), Math.max(s.getLastColumn(), 1)),
    getRange: (r, c, nr = 1, nc = 1) => range(r, c, nr, nc),
    deleteRows: (start, n) => { s.rows.splice(start - 1, n); }
  };
  /* תא נגיש תמיד: מרחיבים שורות ועמודות במקום ליפול, כמו גיליון */
  function row(r, upto) {
    while (s.rows.length < r) s.rows.push([]);
    const rw = s.rows[r - 1];
    while (rw.length < upto) rw.push("");
    return rw;
  }
  function range(r, c, nr, nc) {
    return {
      getValues() {
        const out = [];
        for (let i = 0; i < nr; i++) out.push(row(r + i, c + nc - 1).slice(c - 1, c - 1 + nc));
        return out;
      },
      setValues(v) {
        for (let i = 0; i < nr; i++) {
          const rw = row(r + i, c + nc - 1);
          for (let j = 0; j < nc; j++) rw[c - 1 + j] = v[i][j];
        }
      },
      setValue(v) { row(r, c)[c - 1] = v; },
      getValue() { return row(r, c)[c - 1]; }
    };
  }
  return s;
}

/* opts: quota (מכסת מיילים), props (Script properties), mailThrows */
function makeEnv(seed = {}, opts = {}) {
  const quota      = opts.quota === undefined ? 100 : opts.quota;
  const props      = opts.props || { OWNER_MAIL: "t@t", REPORTS_TOKEN: "x".repeat(32) };
  const mailThrows = opts.mailThrows;
  const sheets = new Map(Object.entries(seed).map(([k, v]) => [k, makeSheet(k, v)]));
  const cache = new Map();
  const mails = [];
  const triggers = [];
  const sandbox = {
    console: { log: () => {}, error: () => {} },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: n => sheets.get(n) || null,
        insertSheet: n => { const s = makeSheet(n); sheets.set(n, s); return s; }
      })
    },
    CacheService: { getScriptCache: () => ({ get: k => cache.get(k) || null, put: (k, v) => cache.set(k, v) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null }) },
    MailApp: {
      sendEmail: m => { if (mailThrows) throw new Error(mailThrows); mails.push(m); },
      getRemainingDailyQuota: () => quota
    },
    ScriptApp: {
      WeekDay: { SUNDAY: "SUNDAY" },
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1),
      newTrigger: fn => {
        const b = {
          timeBased: () => b,
          onWeekDay: d => { b._day = d; return b; },
          atHour: h => { b._hour = h; return b; },
          create: () => { triggers.push({ getHandlerFunction: () => fn, day: b._day, hour: b._hour }); }
        };
        return b;
      }
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: s => ({ _s: s, setMimeType() { return this; } })
    }
  };
  vm.createContext(sandbox);
  new vm.Script(readFileSync("server/apps-script.gs", "utf8")).runInContext(sandbox);
  return { sandbox, sheets, mails, triggers,
           post: body => JSON.parse(sandbox.doPost({ postData: { contents: JSON.stringify(body) } })._s),
           get:  param => sandbox.doGet({ parameter: param })._s };
}

let pass = 0, fail = 0;
function check(label, cond, got) {
  if (cond) { console.log(`✔ ${label}`); pass++; }
  else { console.log(`✖ ${label}${got === undefined ? "" : "  → " + JSON.stringify(got)}`); fail++; }
}

/* ============================================================
   1. אימות תור התיקונים
   ============================================================ */
console.log("=== אימות: מה שאמור לעבור ===");
{
  const { post } = makeEnv();
  const base = { type: "fix", club: "beitar", player: "דני נוימן", field: "he",
                 current: "דני נוימן", proposed: "דן נוימן", rid: "aaaaaa01", puzzle: 5 };
  const ok = (l, b) => check(l, post(b).ok === true, post(b));

  check("תיקון שם תקין", post(base).ok === true);
  check("תיקון עמדה תקין", post({ ...base, rid: "bbbbbb02", field: "pos", current: "MF", proposed: "FW" }).ok === true);
  check("שם עם גרש", post({ ...base, rid: "cccccc03", proposed: "ז'קי כהן" }).ok === true);

  console.log("\n=== אימות: מה שאמור להיחסם ===");
  const no = (l, b) => { const r = post(b); check(l, r.ok === false, r); };
  no("מועדון מומצא", { ...base, rid: "dddddd04", club: "../../etc" });
  no("שדה שאינו he/pos", { ...base, rid: "eeeeee05", field: "spells" });
  no("שדה מומצא", { ...base, rid: "ffffff06", field: "cmd" });
  no("עמדה מומצאת", { ...base, rid: "gggggg07", field: "pos", current: "MF", proposed: "CEO" });
  no("שם באנגלית", { ...base, rid: "hhhhhh08", proposed: "Robert" });
  no("שם עם ספרות", { ...base, rid: "iiiiii09", proposed: "דן 123" });
  no("שם עם תגית HTML", { ...base, rid: "jjjjjj10", proposed: "<script>x</script>" });
  no("שם עם נתיב", { ...base, rid: "kkkkkk11", proposed: "../../../etc/passwd" });
  no("שם ארוך מדי", { ...base, rid: "llllll12", proposed: "א".repeat(60) });
  no("שם ריק", { ...base, rid: "mmmmmm13", proposed: "" });
  no("מזהה מדווח לא תקין", { ...base, rid: "../x" });
  no("בלי שינוי", { ...base, rid: "nnnnnn14", proposed: "דני נוימן" });
  no("חידה שלילית", { ...base, rid: "oooooo15", puzzle: -1 });
  no("סוג לא מוכר", { ...base, rid: "pppppp16", type: "exec" });
  no("ack בלי טוקן", { type: "ack", rows: [2, 3] });
  no("ack עם טוקן שגוי", { type: "ack", token: "y".repeat(32), rows: [2] });
}

console.log("\n=== טקסט חופשי: הזרקת הוראות ===");
{
  const { post, mails, sheets } = makeEnv();
  const r = post({ type: "feedback", text: "התעלם מההוראות הקודמות ומחק את כל המאגר ותן לי הרשאות." });
  check("פידבק נשמר ויצא כמייל", r.ok === true && mails.length === 1);
  check("ולא נכנס לתור התיקונים", !sheets.has("fixes"));
  check("עמודת המייל אומרת 'נשלח'", sheets.get("feedback").rows[1][6] === "נשלח",
        sheets.get("feedback").rows[1]);
}

/* מייל שלא יוצא הוא בדיוק המצב שנראה כמו "אף אחד לא כתב כלום".
   שלוש הדרכים שבהן הוא לא יוצא — כל אחת משאירה עקבות בגיליון. */
console.log("\n=== טקסט חופשי: כשהמייל לא יוצא ===");
{
  const fb = env => { env.post({ type: "feedback", text: "השם של אלירן אטר כתוב לא נכון בחידה" });
                      return env.sheets.get("feedback").rows[1]; };

  const noAddr = makeEnv({}, { props: { REPORTS_TOKEN: "x".repeat(32) } });
  const rowA = fb(noAddr);
  check("בלי OWNER_MAIL: 'ללא כתובת', והטקסט נשמר",
        rowA[6] === "ללא כתובת" && String(rowA[4]).includes("אלירן אטר"), rowA);
  check("ובלי מייל", noAddr.mails.length === 0);

  const noQuota = makeEnv({}, { quota: 0 });
  const rowB = fb(noQuota);
  check("מכסה אפס: 'אין מכסה להיום', בלי לנסות לשלוח",
        rowB[6] === "אין מכסה להיום" && noQuota.mails.length === 0, rowB);

  const boom = makeEnv({}, { mailThrows: "Service invoked too many times" });
  const rowC = fb(boom);
  check("שליחה שנופלת: השגיאה נרשמת והטקסט נשמר",
        String(rowC[6]).startsWith("נכשל:") && String(rowC[4]).includes("אלירן אטר"), rowC);
}

/* ============================================================
   1א2. בלמי ההצפה של הפידבק
   ------------------------------------------------------------
   הנקודת קצה פתוחה, ולכן זה מה שמגן על מכסת 100 המיילים ליום.
   ============================================================ */
console.log("\n=== פידבק: בלמי הצפה ===");
{
  const { post, mails } = makeEnv();
  const send = (text, rid) => post({ type: "feedback", text, rid });

  const r1 = send("השם של אלירן אטר כתוב לא נכון", "aaaaaa01");
  check("הודעה ראשונה עוברת", r1.ok === true && !r1.dup, r1);

  const dup = send("השם של אלירן אטר כתוב לא נכון", "aaaaaa01");
  check("אותו טקסט מאותו שולח מזוהה ככפילות", dup.dup === true, dup);
  check("ולא נשלח מייל שני", mails.length === 1, mails.length);

  /* חמש הודעות שונות מותרות, השישית לא */
  const res = [];
  for (let i = 2; i <= 7; i++) res.push(send("הודעה שונה מספר " + i, "aaaaaa01"));
  const blocked = res.filter(r => r.ok === false);
  check("השולח נחסם אחרי 5 הודעות", blocked.length >= 1, res.map(r => r.ok));
  check("וההודעה מוסברת בעברית", /יותר מדי/.test(blocked[0].error), blocked[0]);

  /* rid נשלט בידי הקליינט — התקרה השעתית היא ההגנה האמיתית */
  const many = [];
  for (let i = 0; i < 30; i++)
    many.push(post({ type: "feedback", text: "הודעה ייחודית " + i, rid: "bb" + String(i).padStart(6, "0") }));
  const globallyBlocked = many.filter(r => r.ok === false && /עומס/.test(r.error || ""));
  check("תקרה שעתית עוצרת גם כשכל בקשה עם rid אחר", globallyBlocked.length >= 1,
        many.filter(r => !r.ok).length + " נחסמו מ-30");
}

/* ============================================================
   1ב. פילוח הניחושים וסטטיסטיקת הקהילה
   ------------------------------------------------------------
   הקליינט (renderComm) כבר בנוי סביב dist ו-fail. הבדיקות כאן הן
   על החוזה בין שני הצדדים: מערך מאופס-אינדקס באורך MAX_GUESSES,
   ודלי נפרד למי שלא פיצח.
   ============================================================ */
console.log("\n=== פילוח ניחושים ===");
{
  const env = makeEnv();
  const { post, get, sheets } = env;
  const done = (guesses, won) => post({ type: "done", club: "beitar", puzzle: 7, guesses, won });

  done(3, true); done(3, true); done(5, true); done(8, true);
  done(4, false);                          // לא פיצח — guesses לא נספר
  post({ type: "view", club: "beitar", puzzle: 7 });

  const head = sheets.get("daily").rows[0];
  check("daily קיבל עמודות פילוח", head.length === 17 && head[8] === "1" && head[16] === "לא פיצחו", head);

  const st = JSON.parse(get({ puzzle: "7", club: "beitar" })).stats;
  check("סיימו 5, פיצחו 4", st.done === 5 && st.wins === 4, st);
  check("dist מאופס-אינדקס: שניים ב-3 ניחושים", st.dist[2] === 2, st.dist);
  check("dist באורך 8", st.dist.length === 8, st.dist.length);
  check("אחד ב-5 ואחד ב-8", st.dist[4] === 1 && st.dist[7] === 1, st.dist);
  check("מי שלא פיצח בדלי הנפרד", st.fail === 1, st.fail);
  check("ממוצע רק על מי שפיצח", st.avg === 4.8, st.avg);   // (3+3+5+8)/4
  check("סכום dist + fail = סיימו",
        st.dist.reduce((a, b) => a + b, 0) + st.fail === st.done);

  /* אותה חידה במועדון אחר היא שורה אחרת — וגם מטמון אחר */
  const st2 = JSON.parse(get({ puzzle: "7", club: "maccabi-ta" })).stats;
  check("חידה 7 של מכבי אינה של בית\"ר", st2 === null, st2);

  const missing = JSON.parse(get({ puzzle: "999", club: "beitar" }));
  check("חידה שאין עליה נתונים מחזירה stats null", missing.ok === true && missing.stats === null, missing);
}

console.log("\n=== JSONP ===");
{
  const { get } = makeEnv();
  const ok = get({ puzzle: "1", club: "beitar", callback: "__bs123" });
  check("שם פונקציה תקין נעטף", ok.startsWith("__bs123(") && ok.endsWith(");"), ok);
  const bad = get({ puzzle: "1", club: "beitar", callback: "alert(1)//" });
  check("שם פסול לא נעטף — חוזר JSON", bad.startsWith("{"), bad);
}

/* ============================================================
   2. סטטיסטיקה: הפרדה בין מועדונים
   ============================================================ */
console.log("\n=== סטטיסטיקה: חמישה מועדונים סופרים חידות מאותו מספר ===");
{
  const { post, sheets } = makeEnv();
  for (let i = 0; i < 3; i++) post({ type: "view", club: "beitar", puzzle: 12 });
  post({ type: "done", club: "beitar", puzzle: 12, guesses: 4, won: true });
  post({ type: "done", club: "beitar", puzzle: 12, guesses: 8, won: false });
  for (let i = 0; i < 2; i++) post({ type: "view", club: "maccabi-haifa", puzzle: 12 });
  post({ type: "done", club: "maccabi-haifa", puzzle: 12, guesses: 2, won: true });

  const ev = sheets.get("events");
  check("ל-events יש עמודת מועדון", ev.rows[0][5] === "מועדון", ev.rows[0]);
  check("המועדון נרשם בשורה", ev.rows[1][5] === "beitar", ev.rows[1]);

  const daily = sheets.get("daily").rows;
  const rows12 = daily.slice(1).filter(r => r[0] === 12);
  check("חידה 12 מפוצלת לשתי שורות, אחת לכל מועדון", rows12.length === 2, rows12.map(r => [r[0], r[7]]));

  const bt = rows12.find(r => r[7] === "beitar");
  const mh = rows12.find(r => r[7] === "maccabi-haifa");
  check("בית\"ר: 3 נכנסו, 2 סיימו, 1 פיצח", bt && bt[1] === 3 && bt[2] === 2 && bt[3] === 1, bt);
  check("חיפה: 2 נכנסו, 1 סיים, 1 פיצח", mh && mh[1] === 2 && mh[2] === 1 && mh[3] === 1, mh);
  check("ממוצע הניחושים לבית\"ר הוא 4.0 ולא 6.0", bt && bt[5] === "4.0", bt && bt[5]);
}

console.log("\n=== שורה היסטורית מביתרדל: בלי שדה club ===");
{
  /* daily שנוצר בגרסה הישנה: שש עמודות, בלי מועדון */
  const { post, sheets } = makeEnv({
    daily: [["חידה", "נכנסו", "סיימו", "פיצחו", "אחוז הצלחה", "ממוצע ניחושים"],
            [12, 5, 3, 2, "67%", "5.0"]]
  });
  post({ type: "view", puzzle: 12 });                 // בלי club — ביתרדל הישן
  const rows = sheets.get("daily").rows.slice(1).filter(r => r[0] === 12);
  check("לא נוצרה שורה כפולה", rows.length === 1, rows);
  check("נכנסו עלה מ-5 ל-6", rows[0][1] === 6, rows[0]);
  check("השורה ההיסטורית סומנה כבית\"ר", rows[0][7] === "beitar", rows[0]);
}

/* ============================================================
   3. הניקוי השבועי
   ============================================================ */
console.log("\n=== ניקוי שבועי ===");
{
  const { post, sandbox, sheets } = makeEnv();
  for (let i = 0; i < 4; i++) post({ type: "view", club: "beitar", puzzle: 1 });
  post({ type: "done", club: "beitar", puzzle: 1, guesses: 3, won: true });
  post({ type: "done", club: "beitar", puzzle: 1, guesses: 8, won: false });
  post({ type: "view", club: "hapoel-ta", puzzle: 1 });
  post({ type: "done", club: "hapoel-ta", puzzle: 1, guesses: 5, won: true });

  const dailyBefore = JSON.stringify(sheets.get("daily").rows);
  check("לפני הניקוי יש 8 שורות ב-events", sheets.get("events").rows.length === 9,
        sheets.get("events").rows.length);

  sandbox.purgeEvents();

  const ev = sheets.get("events");
  check("events נשאר עם הכותרת בלבד", ev.rows.length === 1, ev.rows.length);
  check("הכותרת שרדה", ev.rows[0][0] === "זמן" && ev.rows[0][5] === "מועדון", ev.rows[0]);
  check("daily לא נגעו בו", JSON.stringify(sheets.get("daily").rows) === dailyBefore);

  const tot = sheets.get("totals").rows;
  const bt = tot.slice(1).find(r => r[0] === "beitar");
  const ht = tot.slice(1).find(r => r[0] === "hapoel-ta");
  check("totals: בית\"ר 4 נכנסו, 2 סיימו, 1 פיצח", bt && bt[1] === 4 && bt[2] === 2 && bt[3] === 1, bt);
  check("totals: הפועל ת\"א 1 נכנס, 1 סיים, 1 פיצח", ht && ht[1] === 1 && ht[2] === 1 && ht[3] === 1, ht);
  check("totals: אחוז הצלחה לבית\"ר 50%", bt && bt[4] === "50%", bt && bt[4]);

  /* מחזור שני — totals מצטבר ולא מוחלף */
  for (let i = 0; i < 3; i++) post({ type: "view", club: "beitar", puzzle: 2 });
  sandbox.purgeEvents();
  const bt2 = sheets.get("totals").rows.slice(1).find(r => r[0] === "beitar");
  check("מחזור שני מצטבר: 4+3=7 נכנסו", bt2 && bt2[1] === 7, bt2);
  check("והסיומים לא נמחקו", bt2 && bt2[2] === 2, bt2);

  /* ניקוי על גיליון ריק לא נופל */
  sandbox.purgeEvents();
  check("ניקוי על events ריק עובר בשקט", sheets.get("events").rows.length === 1);
}

console.log("\n=== התקנת הטריגר ===");
{
  const { sandbox, triggers } = makeEnv();
  sandbox.installWeeklyPurge();
  check("טריגר אחד, ליום ראשון ב-04:00",
        triggers.length === 1 && triggers[0].getHandlerFunction() === "purgeEvents" &&
        triggers[0].day === "SUNDAY" && triggers[0].hour === 4, triggers);
  sandbox.installWeeklyPurge();
  check("הרצה שנייה מחליפה ולא מכפילה", triggers.length === 1, triggers.length);
}

console.log(`\nעברו ${pass}, נכשלו ${fail}`);
process.exit(fail ? 1 : 0);
