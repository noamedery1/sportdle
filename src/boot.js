/* ============================================================
   boot.js — מאיפה המנוע מקבל את מאגר השחקנים.

   ---------- הבעיה שזה פותר ----------
   עד כאן המאגר היה מוטבע ב-engine.js בזמן בנייה. באתר זה בסדר
   (פריסה מעדכנת מיד), אבל **באפליקציה המאגר ארוז ב-AAB**, ולכן
   תיקון שם של שחקן אחד דרש גרסה חדשה בחנות, עם versionCode,
   העלאה, ובדיקה. זה לא סביר לתיקון נתונים.

   ---------- מה קורה כאן ----------
   1. המאגר הארוז נטען מיד וסינכרונית. **האפליקציה עובדת
      אופליין מהשנייה הראשונה, ובלי בקשת רשת** — זו הדרישה
      שאין לפגוע בה, וגם הטיעון מול כלל 4.2 של אפל.
   2. אם יש בזיכרון המקומי עותק מעודכן שעבר אימות, הוא מחליף
      אותו.
   3. אחרי הטעינה, ברקע, נמשך clubs.json מהאתר. אם הוא תקין
      הוא נשמר לזיכרון המקומי — **ונכנס לתוקף בפתיחה הבאה.**

   ההחלפה בפתיחה הבאה ולא באמצע משחק היא בכוונה: החלפת מאגר
   תחת משחק פעיל הייתה משנה את התשובה מתחת לידיים של השחקן.

   ---------- למה האימות אינו קוסמטי ----------
   בלי אימות, פריסה שבורה אחת שוברת את האפליקציה אצל **כל** מי
   שהתקין, וזה גרוע בהרבה מהמצב שהיה. לכן עותק מרוחק נדחה אלא
   אם: הוא JSON תקין, יש בו בדיוק אותם מועדונים, מספר השחקנים
   בכל מועדון אינו קטן מ-90% מהארוז, **ולוח החידות אינו מתקצר.**

   הבדיקה האחרונה היא זו שמגנה על הרצף: חידה מספר N היא
   order[N-1], ולכן לוח שהתקצר או שסודר מחדש היה מזיז חידות
   שכבר פורסמו ומכריז על תשובות נכונות כשגויות.

   ---------- מדיניות ----------
   **נמשך JSON בלבד, לעולם לא קוד.** הורדת קוד להרצה אסורה
   במדיניות של Google Play, ומשיכת נתונים מותרת.
   ============================================================ */
(function () {
  "use strict";

  var BUNDLED = __BUNDLED__;
  var KEY = "sportdel:data";
  var URL_ = __DATA_URL__;

  /* ---------- אימות ---------- */
  function valid(cand) {
    try {
      if (!cand || !cand.clubs || !cand.order) return false;
      var bk = Object.keys(BUNDLED.clubs), ck = Object.keys(cand.clubs);
      if (bk.length !== ck.length) return false;
      for (var i = 0; i < bk.length; i++) {
        var s = bk[i], b = BUNDLED.clubs[s], c = cand.clubs[s];
        if (!c) return false;
        if (!Array.isArray(c.players) || !Array.isArray(c.schedule)) return false;
        /* מאגר שהתכווץ משמעותית = בנייה שבורה */
        if (c.players.length < b.players.length * 0.9) return false;
        /* לוח החידות הוא append-only. התקצרות מזיזה חידות שפורסמו. */
        if (c.schedule.length < b.schedule.length) return false;
      }
      return true;
    } catch (e) { return false; }
  }

  /* ---------- מה שנטען עכשיו ---------- */
  var use = BUNDLED;
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var hit = JSON.parse(raw);
      /* base מקשר את המחסן לגרסה הארוזה שממנה הוא נגזר. אחרי
         עדכון אפליקציה הארוז הוא הידוע-הטוב האחרון, ולכן מחסן
         שנגזר מגרסה אחרת נזרק ולא מנוצח על ידי בדיקות. */
      if (hit && hit.base === BUNDLED.v && valid(hit.data)) use = hit.data;
      else localStorage.removeItem(KEY);
    }
  } catch (e) { /* אין localStorage, או JSON שבור — הארוז עומד בפני עצמו */ }

  window.SD = use;

  /* ---------- רענון ברקע ----------
     **רק באפליקציה.** באתר המאגר המוטבע הוא תמיד הטרי — פריסה
     כותבת index.html מחדש — ולכן בקשה נוספת שם היא בזבוז לכל
     מבקר.

     **ולמה CapacitorHttp ולא fetch:** ב-Capacitor ה-origin הוא
     https://localhost, ולכן כל בקשה לאתר היא cross-origin.
     fetch רגיל נחסם ב-CORS, וזה נגלה רק בהרצה — הקונסולה
     הראתה "blocked by CORS policy" והמכניזם היה מת בשקט.
     ה-HTTP הנייטיבי עובר בשכבת Java ואינו כפוף ל-CORS, ולכן
     גם אין צורך בכותרת בצד השרת.

     נמשך JSON בלבד. הורדת קוד להרצה אסורה במדיניות Play. */
  var Cap = window.Capacitor;
  var native = Cap && typeof Cap.isNativePlatform === "function" && Cap.isNativePlatform();
  if (!URL_ || !native) return;

  function store(j) {
    if (!valid(j)) return;                          // שקט בכוונה: רענון, לא תקלה
    if (j.v === use.v) return;                      // אין חדש
    try {
      localStorage.setItem(KEY, JSON.stringify({ base: BUNDLED.v, data: j }));
      window.SD_PENDING = j.v;                      // לאבחון בלבד
    } catch (e) {}
  }

  function refresh() {
    var H = (Cap.Plugins && Cap.Plugins.CapacitorHttp) || Cap.CapacitorHttp;
    if (!H || typeof H.get !== "function") return;  // גרסה בלי התוסף — הארוז עומד בפני עצמו
    try {
      H.get({ url: URL_, headers: { "Cache-Control": "no-cache" } })
        .then(function (r) {
          if (!r || r.status < 200 || r.status >= 300) return;
          store(typeof r.data === "string" ? JSON.parse(r.data) : r.data);
        })
        .catch(function () {});
    } catch (e) {}
  }

  /* אחרי שהמסך צבוע. המשחק לא ממתין לרשת בשום שלב. */
  if (window.requestIdleCallback) requestIdleCallback(refresh, { timeout: 4000 });
  else setTimeout(refresh, 2500);
})();
