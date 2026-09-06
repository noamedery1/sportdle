/* ============================================================
   quiz.js — מחולל שאלות המספרים לדו-קרב.

   ---------- הרעיון ----------
   סבב שני בדו-קרב: שאלה שהתשובה שלה **מספר**, כל אחד עונה,
   והכי קרוב מקבל את הנקודה. שאלה שאיש אינו יודע עדיין משחקת —
   "כמה עונות שיחק דוד אמסלם" אינה ידיעה אלא הערכה, וזה בדיוק
   מה שהופך אותה למשחק ולא למבחן.

   ---------- הכלל היחיד: נגזר, לא כתוב ביד ----------
   כל שאלה כאן נגזרת מהמאגר שכבר נשלח ללקוח. **אין קובץ שאלות.**
   הסיבה אינה נוחות: במשחק שבו "הכי קרוב זוכה", תשובה שגויה
   נותנת את הנקודה לאדם הלא נכון ואי אפשר לגלות את זה מהמשחק.
   שאלה שנגזרת נשארת נכונה כשהמאגר משתנה; שאלה שנכתבה ביד
   מתיישנת בשקט ביום שבו מתקנים שחקן.

   ולכן גם: **אין כאן שאלה על נתון שאין במאגר.** אין שערים, אין
   הופעות, אין גביע הטוטו ואין משחקים באירופה — ולכן אין עליהם
   שאלות. הדחף לכתוב "מתי אלי אוחנה כבש את שערו הראשון" מובן,
   ואין לו מקור.

   ---------- למה זה רץ בלקוח ----------
   ~6,000 שאלות הן כחצי מגה-בייט. הנתונים שמהם הן נגזרות כבר
   נמצאים בדף. לכן נשלח **המחולל** (2KB) ולא התוצאה, והבנק
   מתעדכן מעצמו עם כל תיקון נתונים — בלי גרסה בחנות.

   ---------- הסדר חייב להיות דטרמיניסטי ----------
   pickRounds ב-versus.js נגזר מקוד החדר בלבד, ולכן כל לקוח
   חייב לבנות את **אותה רשימה בדיוק באותו סדר**. אחרת שני
   שחקנים באותו חדר יראו שאלות שונות באותו סיבוב. אין כאן
   שום מיון תלוי-סביבה ואין Math.random.

   ---------- שם המועדון הוא חלק מהשאלה ----------
   דוד אמסלם נמצא במאגר של ביתר (12 עונות) **וגם** של הפועל
   ת"א (עונה אחת). "כמה עונות שיחק דוד אמסלם" יש לה שתי תשובות
   נכונות. כל שאלת שחקן נושאת את המועדון.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- מי מספיק מוכר כדי לשאול עליו ----------
     הבריכה כולה היא סף של שתי עונות, וזה נמוך מדי לשאלה: על מי
     שעבר פה עונתיים ב-1994 אין למי שעונה על מה להישען.

     נמדדו חמישה כללים. "ארבע עונות **או** תואר אחד" נתן 583
     שחקנים אבל הטה את המשחק למכבי חיפה ומכבי ת"א (150 ו-147
     מול 87 בהפועל ת"א) — כי במועדון שזוכה הרבה, גם מי שעבר
     לעונה נכנס. שלושה תארים ומעלה מתקן את זה: הוא משאיר את
     המעוטרים באמת ומוציא את מי שבמקרה היה שם בעונת זכייה.

     395 שחקנים, מאוזן: 86 / 52 / 105 / 86 / 66. */
  var MIN_SEASONS = 4;
  var MIN_TITLES  = 3;

  function seasonsOf(p) {
    var n = 0;
    for (var i = 0; i < p.spells.length; i++) n += p.spells[i][1] - p.spells[i][0] + 1;
    return n;
  }
  function longestRun(a) {
    var best = a.length ? 1 : 0, cur = 1;
    for (var i = 1; i < a.length; i++) {
      cur = a[i] === a[i - 1] + 1 ? cur + 1 : 1;
      if (cur > best) best = cur;
    }
    return best;
  }
  function widestGap(a) {
    var m = 0;
    for (var i = 1; i < a.length; i++) if (a[i] - a[i - 1] > m) m = a[i] - a[i - 1];
    return m;
  }

  /* ---------- שאלות על המועדון ----------
     skipZero: שאלה שהתשובה שלה 0 אינה שאלה — "כמה אליפויות
     טרום-מדינה" למועדון שאין לו אף אחת. לעומת זאת אצל שחקן
     "בכמה תארים זכתה הקבוצה בזמנו" עם 0 היא תשובה לגיטימית
     ומעניינת, ולכן שם הדגל כבוי. */
  var CLUB_Q = [
    ["ttl-lg",   "כמה אליפויות יש ל{C}?",                          function (c) { return c.t.league.length; }, 1],
    ["ttl-cup",  "כמה גביעי מדינה יש ל{C}?",                       function (c) { return c.t.cup.length; }, 1],
    ["ttl-all",  "כמה תארים יש ל{C} בסך הכל?",                     function (c) { return c.t.league.length + c.t.cup.length; }, 1],
    ["lg-first", "באיזו שנה זכתה {C} באליפות הראשונה שלה?",        function (c) { return c.t.league[0]; }, 1],
    ["lg-last",  "באיזו שנה זכתה {C} באליפות האחרונה שלה?",        function (c) { return c.t.league[c.t.league.length - 1]; }, 1],
    ["cup-first","באיזו שנה זכתה {C} בגביע הראשון שלה?",           function (c) { return c.t.cup[0]; }, 1],
    ["cup-last", "באיזו שנה זכתה {C} בגביע האחרון שלה?",           function (c) { return c.t.cup[c.t.cup.length - 1]; }, 1],
    ["lg-span",  "כמה שנים עברו בין האליפות הראשונה של {C} לאחרונה?", function (c) { return c.t.league[c.t.league.length - 1] - c.t.league[0]; }, 1],
    ["lg-2000",  "בכמה אליפויות זכתה {C} מ-2000 והלאה?",           function (c) { return c.t.league.filter(function (y) { return y >= 2000; }).length; }, 1],
    ["cup-2000", "בכמה גביעים זכתה {C} מ-2000 והלאה?",             function (c) { return c.t.cup.filter(function (y) { return y >= 2000; }).length; }, 1],
    ["lg-run",   "מה הרצף הארוך ביותר של אליפויות רצופות ל{C}?",   function (c) { return longestRun(c.t.league); }, 1],
    ["lg-gap",   "מה הפער הארוך ביותר בשנים בין שתי אליפויות של {C}?", function (c) { return widestGap(c.t.league); }, 1],
    ["pre-lg",   "בכמה אליפויות טרום-מדינה זכתה {C}?",             function (c) { return c.pre.league.length; }, 1],
    ["pre-cup",  "בכמה גביעים טרום-מדינה זכתה {C}?",               function (c) { return c.pre.cup.length; }, 1],
    ["sq-all",   "כמה שחקנים יש במאגר של {C}?",                    function (c) { return c.players.length; }, 1],
    ["sq-pool",  "כמה שחקנים יכולים להיות התשובה ב{C}?",           function (c) { return c.schedule.length; }, 1],
    ["sq-old",   "באיזו שנה נולד השחקן הוותיק ביותר במאגר של {C}?", function (c) { return c.oldest; }, 1],
    ["sq-forgn", "כמה שחקנים לא-ישראלים יש בבריכת התשובות של {C}?", function (c) { return c.foreign; }, 1]
    /* הוסרו: "השחקן הצעיר ביותר" — 80% מהתשובות 2006, ו"מאיזו
       שנה מתחיל המאגר" — 60% מהן 1970. שאלה ששני שלישים מהמשיבים
       קולעים בה מהניחוש הזול אינה שאלה. */
  ];

  /* ---------- שאלות על שחקן ---------- */
  var PLAYER_Q = [
    ["seasons",  "כמה עונות שיחק {P} ב{C}?",                       function (p) { return p.__n; }, 1],
    ["arrived",  "באיזו שנה הגיע {P} ל{C}?",                       function (p) { return p.spells[0][0]; }, 1],
    /* "עזב" נשאל רק על מי שבאמת עזב. לשחקן פעיל התקופה מסתיימת
       בעונה הנוכחית, והשאלה הייתה מצהירה שהוא עזב — 65 שחקנים
       היו במצב הזה, ורועי משפתי "עזב את מכבי ת\"א ב-2026". */
    ["left",     "באיזו שנה עזב {P} את {C}?",
      function (p) { var y = p.spells[p.spells.length - 1][1]; return y >= p.__to ? null : y; }, 1],
    ["born",     "באיזו שנה נולד {P}?",                            function (p) { return p.born; }, 1],
    ["age",      "בן כמה היה {P} בעונה הראשונה שלו ב{C}?",         function (p) { return p.spells[0][0] - p.born; }, 1],
    ["titles",   "בכמה תארים זכתה {C} בזמן ש{P} היה בסגל?",        function (p) { return p.titles; }, 0]
    /* הוסר: "בכמה תקופות נפרדות שיחק" — **68% מהתשובות הן 1**.
       מי שעונה 1 בכל פעם מנצח את רוב הסבבים בלי לדעת דבר. */
  ];

  function ok(v, skipZero) {
    return typeof v === "number" && isFinite(v) && !isNaN(v) && (skipZero ? v > 0 : v >= 0);
  }

  /* מחזיר מערך שאלות בסדר קבוע.
     slugs — רשימת המועדונים שהחדר משחק בהם. */
  function build(slugs) {
    var all = (window.SPORTDEL && window.SPORTDEL.clubs) || {};
    var out = [];
    for (var s = 0; s < slugs.length; s++) {
      var slug = slugs[s], c = all[slug];
      if (!c || !c.titles) continue;

      var born = [], i, p;
      for (i = 0; i < c.players.length; i++) if (c.players[i].born) born.push(c.players[i].born);
      var pool = {};
      for (i = 0; i < c.schedule.length; i++) pool[c.schedule[i]] = 1;
      var foreign = 0;
      for (i = 0; i < c.players.length; i++) {
        p = c.players[i];
        if (!pool[p.he]) continue;
        var isIL = p.nats ? p.nats.indexOf("IL") !== -1 : p.nat === "IL";
        if (!isIL) foreign++;
      }
      var from = Infinity;
      for (i = 0; i < c.players.length; i++)
        for (var k = 0; k < c.players[i].spells.length; k++)
          if (c.players[i].spells[k][0] < from) from = c.players[i].spells[k][0];

      var ctx = {
        t: c.titles, pre: c.titlesPreState || { league: [], cup: [] },
        players: c.players, schedule: c.schedule,
        oldest: Math.min.apply(null, born), youngest: Math.max.apply(null, born),
        foreign: foreign, from: from,
        /* העונה האחרונה שהמאגר מכיר — מי שתקופתו מסתיימת בה
           עדיין במועדון. משמש את שאלת "עזב". */
        to: (c.coverage && c.coverage.to) || 0
      };

      for (i = 0; i < CLUB_Q.length; i++) {
        var t = CLUB_Q[i], v;
        try { v = t[2](ctx); } catch (e) { v = null; }
        if (!ok(v, t[3])) continue;
        out.push({ id: slug + "|" + t[0], club: slug,
                   q: t[1].split("{C}").join(c.short), a: v });
      }

      /* סדר השחקנים הוא סדר המאגר — קבוע בכל הלקוחות */
      for (i = 0; i < c.players.length; i++) {
        p = c.players[i];
        if (!pool[p.he] || !p.born || !p.spells || !p.spells.length) continue;
        p.__n = seasonsOf(p);
        p.__to = ctx.to;
        if (p.__n < MIN_SEASONS && !(p.titles >= MIN_TITLES)) continue;
        for (var j = 0; j < PLAYER_Q.length; j++) {
          var pt = PLAYER_Q[j], pv;
          try { pv = pt[2](p); } catch (e) { pv = null; }
          if (!ok(pv, pt[3])) continue;
          out.push({ id: slug + "|" + p.he + "|" + pt[0], club: slug,
                     q: pt[1].split("{C}").join(c.short).split("{P}").join(p.he), a: pv });
        }
      }
    }
    return out;
  }

  window.SPORTDEL = window.SPORTDEL || {};
  window.SPORTDEL.buildQuiz = build;
  window.SPORTDEL.QUIZ_MIN_SEASONS = MIN_SEASONS;
})();
