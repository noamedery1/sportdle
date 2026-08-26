/* ============================================================
   ספורטדל — שרת האיסוף
   ------------------------------------------------------------
   Web App אחד שמשרת ארבעה דברים:

     view / done   סטטיסטיקה (כמו קודם)
     fix           טופס תיקון פרטי שחקן — שדות סגורים בלבד
     feedback      טקסט חופשי, יוצא כמייל ולא נכנס לשום צינור
     ack           סימון שורות שהוחלו, מגיע רק מ-CI עם טוקן

   ------------------------------------------------------------
   התקנה:
   1. הגיליון הקיים → Extensions → Apps Script
   2. להחליף את כל התוכן בקובץ הזה
   3. Project Settings → Script properties → להוסיף:
        OWNER_MAIL     = techbynoam@gmail.com
        REPORTS_TOKEN  = <מחרוזת אקראית ארוכה שתייצר>
   4. Deploy → Manage deployments → Edit → Version: New → Deploy
        Execute as:     Me
        Who has access: Anyone
   5. את ה-URL שמסתיים ב-/exec לשים ב-config/site.json תחת
      analyticsUrl, ואת ה-URL והטוקן גם כ-GitHub Secrets
      (REPORTS_URL, REPORTS_TOKEN).

   ------------------------------------------------------------
   למה כל האימות כאן, ולא רק בקליינט:
   הקליינט הוא HTML פתוח. כל אחד יכול לשלוח POST ידני עם כל תוכן.
   מה שנשמר בגיליון נכנס לצינור שכותב למאגר, ולכן כל שדה נבדק כאן
   מול רשימה סגורה — לפני שהוא נוגע בגיליון בכלל.

   מה שהצינור *לא* יקבל לעולם, לא משנה מה נכתב בהודעה:
   שם קובץ, נתיב, פקודה, טקסט חופשי, או שדה שאינו he/pos.
   אין כאן פרשנות של טקסט — יש התאמה מול enum.
   ============================================================ */

const SHEET_EVENTS   = 'events';
const SHEET_DAILY    = 'daily';
const SHEET_FIXES    = 'fixes';
const SHEET_FEEDBACK  = 'feedback';
const SHEET_TOTALS   = 'totals';

/* רשימות סגורות. שינוי מועדון או עמדה מחייב שינוי כאן — במכוון. */
const CLUBS  = ['beitar', 'hapoel-bs', 'hapoel-ta', 'maccabi-haifa', 'maccabi-ta'];
const FIELDS = ['he', 'pos'];
const POSES  = ['GK', 'DF', 'MF', 'FW'];

/* שם בעברית: אות ראשונה ואחרונה חייבות להיות אות עברית.
   באמצע מותרים רווח, גרש, גרשיים, ומקף. שום דבר אחר —
   לא לטינית, לא ספרות, לא סימני פיסוק, לא תווי בקרה. */
const HE_NAME = /^[א-ת][א-ת ׳״'"’־-]{0,38}[א-ת]$/;

/* בלמי הצפה. לא אבטחה — רק שלא ימלא לי את הגיליון בלילה. */
const MAX_FIX_ROWS   = 20000;   // מעבר לזה הגיליון מסרב לקבל
const MAX_PER_RID    = 15;      // תיקונים למדווח בחלון של 6 שעות
const MAX_TEXT       = 1500;    // אורך פידבק חופשי

/* ============================================================
   נתיב הכתיבה
   ============================================================ */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return json_({ ok: false, error: 'גוף ריק' });
    if (e.postData.contents.length > 4000)         return json_({ ok: false, error: 'גוף גדול מדי' });

    var d;
    try { d = JSON.parse(e.postData.contents); }
    catch (err) { return json_({ ok: false, error: 'JSON לא תקין' }); }
    if (!d || typeof d !== 'object') return json_({ ok: false, error: 'גוף לא תקין' });

    switch (d.type) {
      case 'fix':      return handleFix_(d);
      case 'feedback': return handleFeedback_(d);
      case 'ack':      return handleAck_(d);
      case 'view':
      case 'done':     return handleEvent_(d);
      default:         return json_({ ok: false, error: 'סוג לא מוכר' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ---------- תיקון פרטי שחקן ----------
   כאן נמצא כל האימות שקובע מה בכלל יכול להיכנס לצינור. */
function handleFix_(d) {
  /* התקרות כאן רחבות בכוונה, והאימות האמיתי הוא ה-enum והביטוי
     הרגולרי שאחריהן. תקרה צמודה הייתה *חותכת* קלט ארוך במקום לדחות
     אותו: שם באורך 60 היה נהפך לשם באורך 40 שעובר אימות, ונשמר
     קטוע. חיתוך לא יכול להפוך קלט פסול לקלט כשר. */
  var club     = str_(d.club, 60);
  var player   = str_(d.player, 120);
  var field    = str_(d.field, 20);
  var current  = str_(d.current, 120);
  var proposed = str_(d.proposed, 120);
  var rid      = str_(d.rid, 60);
  var puzzle   = Number(d.puzzle);

  if (CLUBS.indexOf(club) === -1)   return json_({ ok: false, error: 'מועדון לא מוכר' });
  if (FIELDS.indexOf(field) === -1) return json_({ ok: false, error: 'שדה לא מוכר' });
  if (!HE_NAME.test(player))        return json_({ ok: false, error: 'שם שחקן לא תקין' });
  if (!/^[a-z0-9]{6,24}$/.test(rid)) return json_({ ok: false, error: 'מזהה מדווח לא תקין' });
  if (!isFinite(puzzle) || puzzle < 0 || puzzle > 100000 || puzzle !== Math.floor(puzzle))
    return json_({ ok: false, error: 'מספר חידה לא תקין' });

  if (field === 'pos') {
    if (POSES.indexOf(proposed) === -1) return json_({ ok: false, error: 'עמדה לא מוכרת' });
    if (current && POSES.indexOf(current) === -1) return json_({ ok: false, error: 'עמדה קיימת לא מוכרת' });
  } else {
    if (!HE_NAME.test(proposed)) return json_({ ok: false, error: 'השם המוצע לא תקין' });
    if (!HE_NAME.test(current))  return json_({ ok: false, error: 'השם הקיים לא תקין' });
  }
  if (proposed === current) return json_({ ok: false, error: 'אין שינוי' });

  var cache = CacheService.getScriptCache();

  /* אותו מדווח, אותו תיקון — לא שורה נוספת. שתי לחיצות זה לא
     שני מדווחים, והצינור סופר מדווחים נפרדים. */
  var dupKey = 'dup:' + rid + ':' + club + ':' + player + ':' + field + ':' + proposed;
  if (cache.get(dupKey)) return json_({ ok: true, dup: true });

  var cntKey = 'cnt:' + rid;
  var cnt = Number(cache.get(cntKey) || 0);
  if (cnt >= MAX_PER_RID) return json_({ ok: false, error: 'יותר מדי דיווחים. נסו מאוחר יותר.' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return json_({ ok: false, error: 'עומס. נסו שוב.' });
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(SHEET_FIXES);
    if (!sh) {
      sh = ss.insertSheet(SHEET_FIXES);
      sh.appendRow(['זמן', 'מועדון', 'שחקן', 'שדה', 'קיים', 'מוצע', 'מדווח', 'חידה', 'מצב']);
      sh.setFrozenRows(1);
    }
    if (sh.getLastRow() >= MAX_FIX_ROWS) return json_({ ok: false, error: 'התור מלא' });

    sh.appendRow([new Date(), club, player, field, current, proposed, rid, puzzle, '']);
  } finally {
    lock.releaseLock();
  }

  cache.put(dupKey, '1', 21600);
  cache.put(cntKey, String(cnt + 1), 21600);
  return json_({ ok: true });
}

/* ---------- פידבק חופשי ----------
   יוצא כמייל. לא נקרא בשום צינור אוטומטי, ולכן מותר בו הכול. */
function handleFeedback_(d) {
  var text = str_(d.text, MAX_TEXT);
  if (text.length < 5) return json_({ ok: false, error: 'טקסט קצר מדי' });

  var club    = str_(d.club, 20);
  var puzzle  = str_(d.puzzle, 60);
  var player  = str_(d.player, 40);
  var contact = str_(d.contact, 80);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_FEEDBACK);
  if (!sh) {
    sh = ss.insertSheet(SHEET_FEEDBACK);
    sh.appendRow(['זמן', 'מועדון', 'חידה', 'שחקן', 'טקסט', 'ליצירת קשר']);
    sh.setFrozenRows(1);
  }
  sh.appendRow([new Date(), club, puzzle, player, text, contact]);

  var to = PropertiesService.getScriptProperties().getProperty('OWNER_MAIL');
  if (to) {
    try {
      /* plain text בכוונה: מה שנכתב כאן הוא קלט של זר, ואין סיבה
         להריץ אותו כ-HTML בתיבת הדואר שלי. */
      MailApp.sendEmail({
        to: to,
        subject: 'ספורטדל · פידבק — ' + (puzzle || club || ''),
        body: text + '\n\n— — —\nמועדון: ' + club + '\nחידה: ' + puzzle +
              '\nשחקן: ' + player + '\nליצירת קשר: ' + (contact || 'לא נמסר')
      });
    } catch (err) {
      /* מיילים נגמרו למכסה היומית — הטקסט כבר בגיליון, לא אבוד */
    }
  }
  return json_({ ok: true });
}

/* ---------- סימון שורות שהוחלו — רק עם טוקן ---------- */
function handleAck_(d) {
  if (!checkToken_(d.token)) return json_({ ok: false, error: 'אין הרשאה' });
  var rows = Array.isArray(d.rows) ? d.rows.slice(0, 200) : [];
  var status = str_(d.status, 20) || 'הוחל';
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_FIXES);
  if (!sh) return json_({ ok: true, marked: 0 });

  var last = sh.getLastRow(), n = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = Number(rows[i]);
    if (r >= 2 && r <= last && r === Math.floor(r)) { sh.getRange(r, 9).setValue(status); n++; }
  }
  return json_({ ok: true, marked: n });
}

/* ---------- סטטיסטיקה ----------
   עמודת המועדון נוספה **בסוף**, ולא באמצע, כדי שכל השורות שנרשמו
   עד היום ישמרו על המשמעות שלהן. שורה בלי מועדון היא מביתרדל הישן,
   שהוא הלקוח היחיד שאינו שולח את השדה — ולכן ברירת המחדל היא בית"ר
   ולא ריק. */
function clubOf_(d) {
  var c = str_(d.club, 20);
  return CLUBS.indexOf(c) === -1 ? 'beitar' : c;
}

function handleEvent_(d) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_EVENTS);
  if (!sh) {
    sh = ss.insertSheet(SHEET_EVENTS);
    sh.appendRow(['זמן', 'סוג', 'חידה', 'ניחושים', 'פוצח', 'מועדון']);
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < 6) {
    sh.getRange(1, 6).setValue('מועדון');
  }
  sh.appendRow([
    new Date(),
    str_(d.type, 20),
    str_(d.puzzle, 60),
    Number(d.guesses) || '',
    d.won === true ? 'כן' : (d.won === false ? 'לא' : ''),
    clubOf_(d)
  ]);
  rollup_(ss, d);
  return json_({ ok: true });
}

/** סיכום יומי מתגלגל — כדי שלא תצטרך לחשב ידנית.
    המפתח הוא **מועדון + חידה**, לא חידה לבדה. חמשת המועדונים סופרים
    חידות מאותו מספר, ולכן חידה 12 של חיפה וחידה 12 של בית"ר היו
    נבלעות באותה שורה — כל הסטטיסטיקה של ארבעה מועדונים הייתה
    מתערבבת עם זו של החמישי.

    עמודה 7 היא סכום הניחושים המצטבר (ממנו נגזר הממוצע), ועמודה 8
    היא המועדון. שתיהן בסוף כדי לא להזיז את מה שכבר רשום, ושורה
    היסטורית בלי מועדון נחשבת לבית"ר — כי זה מה שהיא. */
function rollup_(ss, d) {
  if (!d.puzzle) return;
  var club = clubOf_(d);
  var sh = ss.getSheetByName(SHEET_DAILY);
  if (!sh) {
    sh = ss.insertSheet(SHEET_DAILY);
    sh.appendRow(['חידה', 'נכנסו', 'סיימו', 'פיצחו', 'אחוז הצלחה',
                  'ממוצע ניחושים', 'סכום ניחושים', 'מועדון']);
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < 8) {
    sh.getRange(1, 7, 1, 2).setValues([['סכום ניחושים', 'מועדון']]);
  }

  var data = sh.getDataRange().getValues();
  var row = -1;
  for (var i = 1; i < data.length; i++)
    if (data[i][0] == d.puzzle && String(data[i][7] || 'beitar') === club) { row = i + 1; break; }
  if (row === -1) {
    sh.appendRow([d.puzzle, 0, 0, 0, '', '', 0, club]);
    row = sh.getLastRow();
  } else if (!data[row - 1][7]) {
    sh.getRange(row, 8).setValue(club);       // השלמה לשורה היסטורית
  }

  var cur = sh.getRange(row, 1, 1, 6).getValues()[0];
  var views = Number(cur[1]) || 0, done = Number(cur[2]) || 0, wins = Number(cur[3]) || 0;

  var sumCell = sh.getRange(row, 7);
  var sum = Number(sumCell.getValue()) || 0;

  if (d.type === 'view') views++;
  if (d.type === 'done') {
    done++;
    if (d.won) { wins++; sum += Number(d.guesses) || 0; }
  }

  sumCell.setValue(sum);
  sh.getRange(row, 2, 1, 5).setValues([[
    views, done, wins,
    done ? Math.round(wins / done * 100) + '%' : '',
    wins ? (sum / wins).toFixed(1) : ''
  ]]);
}

/* ============================================================
   ניקוי שבועי של events
   ------------------------------------------------------------
   גיליון events גדל בשורה לכל צפייה. הוא לא נחוץ לטווח ארוך: כל מה
   שרוצים ממנו כבר מסוכם ב-daily (לפי חידה) וב-totals (מצטבר לתמיד).
   הניקוי סוכם קודם לתוך totals, ורק אחר כך מוחק — ובאותו סדר, כדי
   שנפילה באמצע תשאיר את הנתונים ולא תמחק אותם בלי לספור.

   התקנה, פעם אחת: לבחור בעורך את הפונקציה installWeeklyPurge
   וללחוץ Run. היא מתקינה טריגר לכל יום ראשון ב-04:00.

   שם הפונקציה בלי קו תחתון בסוף — פונקציה שנגמרת בקו תחתון היא
   פרטית ב-Apps Script, ואי אפשר לבחור אותה כיעד של טריגר.
   ============================================================ */
function purgeEvents() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { console.log('הניקוי דילג — נעול'); return; }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ev = ss.getSheetByName(SHEET_EVENTS);
    if (!ev) { console.log('אין גיליון events'); return; }

    var last = ev.getLastRow();
    if (last < 2) { console.log('events ריק'); return; }

    var cols = Math.max(ev.getLastColumn(), 6);
    var v = ev.getRange(2, 1, last - 1, cols).getValues();

    /* צבירה לפי מועדון */
    var agg = {};
    for (var i = 0; i < v.length; i++) {
      var club = CLUBS.indexOf(String(v[i][5])) === -1 ? 'beitar' : String(v[i][5]);
      var a = agg[club] || (agg[club] = { views: 0, done: 0, wins: 0, sum: 0 });
      var type = String(v[i][1]);
      if (type === 'view') a.views++;
      else if (type === 'done') {
        a.done++;
        if (String(v[i][4]) === 'כן') { a.wins++; a.sum += Number(v[i][3]) || 0; }
      }
    }

    /* מיזוג ל-totals — מצטבר, לא מוחלף */
    var tot = ss.getSheetByName(SHEET_TOTALS);
    if (!tot) {
      tot = ss.insertSheet(SHEET_TOTALS);
      tot.appendRow(['מועדון', 'נכנסו', 'סיימו', 'פיצחו',
                     'אחוז הצלחה', 'ממוצע ניחושים', 'סכום ניחושים', 'נוקה לאחרונה']);
      tot.setFrozenRows(1);
    }
    var td = tot.getDataRange().getValues();
    var now = new Date();

    for (var club2 in agg) {
      var a2 = agg[club2], r = -1;
      for (var j = 1; j < td.length; j++) if (String(td[j][0]) === club2) { r = j + 1; break; }
      if (r === -1) { tot.appendRow([club2, 0, 0, 0, '', '', 0, '']); r = tot.getLastRow(); }

      var cur = tot.getRange(r, 1, 1, 8).getValues()[0];
      var views = (Number(cur[1]) || 0) + a2.views;
      var done  = (Number(cur[2]) || 0) + a2.done;
      var wins  = (Number(cur[3]) || 0) + a2.wins;
      var sum   = (Number(cur[6]) || 0) + a2.sum;

      tot.getRange(r, 2, 1, 7).setValues([[
        views, done, wins,
        done ? Math.round(wins / done * 100) + '%' : '',
        wins ? (sum / wins).toFixed(1) : '',
        sum, now
      ]]);
    }

    /* מוחקים בדיוק את השורות שנקראו. שורה שנרשמה בין הקריאה למחיקה
       יושבת אחרי last, עולה מקום, ותיספר בניקוי הבא. */
    ev.deleteRows(2, last - 1);
    console.log('נוקו ' + (last - 1) + ' שורות; totals עודכן ל-' +
                Object.keys(agg).length + ' מועדונים');
  } finally {
    lock.releaseLock();
  }
}

/** להריץ פעם אחת מהעורך. מחליף טריגר קיים ולא מוסיף עליו. */
function installWeeklyPurge() {
  var all = ScriptApp.getProjectTriggers();
  for (var i = 0; i < all.length; i++)
    if (all[i].getHandlerFunction() === 'purgeEvents') ScriptApp.deleteTrigger(all[i]);

  ScriptApp.newTrigger('purgeEvents')
    .timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(4).create();

  var msg = 'הותקן טריגר: ניקוי events כל יום ראשון ב-04:00';
  console.log(msg);
  return msg;
}

/* ============================================================
   נתיב הקריאה — ?fn=fixes&token=…
   מחזיר רק שורות שממתינות (עמודת "מצב" ריקה). מי שממלא בעמודה
   הזאת משהו ידנית — למשל "לא" — מוציא את השורה מהתור לתמיד.
   ============================================================ */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.fn !== 'fixes') return json_({ ok: true, msg: 'sportdle collector is running' });
  if (!checkToken_(p.token)) return json_({ ok: false, error: 'אין הרשאה' });

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_FIXES);
  if (!sh || sh.getLastRow() < 2) return json_({ ok: true, rows: [] });

  var days = Math.min(Number(p.days) || 120, 400);
  var floor = new Date().getTime() - days * 86400000;

  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues();
  var rows = [];
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][8]).trim() !== '') continue;                 // כבר טופל או נדחה ידנית
    var ts = v[i][0] instanceof Date ? v[i][0].getTime() : 0;
    if (ts && ts < floor) continue;
    rows.push({
      row: i + 2, ts: ts,
      club: String(v[i][1]), player: String(v[i][2]), field: String(v[i][3]),
      current: String(v[i][4]), proposed: String(v[i][5]),
      rid: String(v[i][6]), puzzle: Number(v[i][7]) || 0
    });
  }
  return json_({ ok: true, rows: rows });
}

/* ============================================================
   עזרים
   ============================================================ */
function checkToken_(got) {
  var want = PropertiesService.getScriptProperties().getProperty('REPORTS_TOKEN');
  if (!want || String(want).length < 16) return false;   // לא הוגדר טוקן → סגור
  got = String(got || '');
  if (got.length !== String(want).length) return false;
  /* השוואה באורך קבוע. פרנויה זולה. */
  var diff = 0;
  for (var i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ String(want).charCodeAt(i);
  return diff === 0;
}

/** מחרוזת בטוחה: מסירים תווי בקרה ובקרת כיווניות, מכווצים רווחים,
    חותכים אורך. התווים כתובים כ-\u ולא כעצמם, אחרת הקובץ נקרא
    בינארי בכל grep.
    בקרת כיווניות מוסרת כי היא בלתי נראית בגיליון ובדיף: שם שמוטמע
    בו U+202E נראה זהה לשם תקין ואינו זהה לו. */
function str_(v, max) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/[\u0000-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
