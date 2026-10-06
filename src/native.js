/* ============================================================
   native.js — מה שהאפליקציה עושה ודפדפן לא יכול.

   נטען בכל מקום, כולל האתר, ויוצא מיד כשאין Capacitor. **אין כאן
   שום שינוי בלוגיקת המשחק** — הכל תוספת מסביב, ולכן האתר
   והאפליקציה מריצים בדיוק אותו מנוע.

   למה זה קיים ולא רק "עטיפה": כלל 4.2 של אפל דוחה אתר עטוף.
   ארבעה דברים כאן הם ערך שאי אפשר לתת בדפדפן — התראה יומית,
   רטט על כל אריח, גיליון שיתוף מקומי, וכפתור "חזור" של אנדרואיד
   שסוגר חלונית במקום לצאת מהאפליקציה.

   הגישה לתוספים היא דרך window.Capacitor.Plugins ולא דרך import.
   בכוונה: לפרויקט אין באנדלר, והרצת ה-import הייתה מחייבת אותו.
   Capacitor מזריק את הגשר לפני הסקריפטים של הדף, כך שהתוספים
   זמינים כאן.
   ============================================================ */
(function () {
  "use strict";

  const Cap = window.Capacitor;
  /* isNativePlatform מבדיל בין האפליקציה לדפדפן. בלי הבדיקה הזאת
     כל מה שכאן היה נזרק באתר. */
  if (!Cap || typeof Cap.isNativePlatform !== "function" || !Cap.isNativePlatform()) return;

  const P = Cap.Plugins || {};
  const platform = (typeof Cap.getPlatform === "function" && Cap.getPlatform()) || "";
  document.documentElement.classList.add("native", "native-" + platform);

  const KEY = k => "sportdel:native:" + k;
  const get = k => { try { return localStorage.getItem(KEY(k)); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(KEY(k), v); } catch (e) {} };

  /* כל קריאה לתוסף עטופה. תוסף חסר או הרשאה שנדחתה לא אמורים
     להפיל את המשחק — הוא חייב לעבוד גם כשכל אלה נכשלים. */
  const safe = async (fn) => { try { return await fn(); } catch (e) {
    console.warn("[native]", e && e.message ? e.message : e); return null; } };

  /* ---------- 1. שורת מצב ומסך פתיחה ---------- */
  safe(async () => {
    if (!P.StatusBar) return;
    await P.StatusBar.setStyle({ style: "DARK" });
    if (platform === "android") {
      /* **האפליקציה מתחת לשורת הסטטוס, לא תחתיה.** ברירת המחדל של
         @capacitor/status-bar היא overlaysWebView=true — ה-WebView
         מצויר מאחורי השורה. ובאנדרואיד 14 ומטה SystemBars של
         Capacitor מניח שאין חפיפה ומזריק --safe-area-inset-top=0,
         כך שהכותרת ("ביתרdle" והכפתורים) נחתכה מתחת לשעון.
         באנדרואיד 15+ זה no-op: שם Capacitor מטפל בשוליים בעצמו.
         רק באנדרואיד — ב-iOS ה-WebView מתחת לשורה ו-env() מדויק. */
      await P.StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      await P.StatusBar.setBackgroundColor({ color: "#0C0C0E" });
    }
  });

  /* המסך נסגר אחרי שהגופנים נטענו, לא אחרי DOMContentLoaded.
     אחרת רואים חצי שנייה של טקסט בגופן מערכת שמתחלף — וזה
     נראה כמו באג. */
  const hideSplash = () => safe(() => P.SplashScreen && P.SplashScreen.hide({ fadeOutDuration: 220 }));
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(hideSplash, 60));
    setTimeout(hideSplash, 2500);          // רשת ביטחון — לא להשאיר מסך פתיחה תקוע
  } else {
    addEventListener("load", () => setTimeout(hideSplash, 120));
  }

  /* ---------- 2. רטט על כל אריח ----------
     המנוע מוסיף אריחים ל-#board עם אנימציית flip. במקום לגעת בו,
     מאזין על התוספות ל-DOM. רטט קל לכל אריח, וחזק יותר כשהאריח
     מדויק — האצבע מרגישה את התוצאה לפני שהעין קוראת אותה. */
  safe(() => {
    if (!P.Haptics) return;
    const board = document.getElementById("board");
    if (!board || !window.MutationObserver) return;
    let last = 0;
    new MutationObserver((muts) => {
      let light = 0, hit = 0;
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        const tiles = n.classList && n.classList.contains("tile") ? [n]
                    : (n.querySelectorAll ? n.querySelectorAll(".tile") : []);
        for (const t of tiles) { light++; if (t.classList.contains("hit")) hit++; }
      }
      if (!light) return;
      /* מגבלה של פעם ב-120ms. חמישה אריחים נכנסים כמעט יחד,
         וחמישה רטטים בזה אחר זה מרגישים כמו תקלה. */
      const now = Date.now();
      if (now - last < 120) return;
      last = now;
      P.Haptics.impact({ style: hit ? "MEDIUM" : "LIGHT" }).catch(() => {});
    }).observe(board, { childList: true, subtree: true });
  });

  /* ---------- 3. גיליון שיתוף מקומי ----------
     באתר הכפתור מעתיק ללוח. באפליקציה זה מרגיש שבור: המשתמש
     מצפה לגיליון השיתוף של המערכת. shareText() הוא גלובלי של
     המנוע, ולכן אין צורך לשכפל את בניית הטקסט.

     ההאזנה היא בשלב ה-capture עם stopImmediatePropagation, כדי
     להחליף התנהגות בלי לערוך את engine.js. */
  safe(() => {
    if (!P.Share) return;
    const btn = document.getElementById("share");
    if (!btn || typeof window.shareText !== "function") return;
    btn.addEventListener("click", (ev) => {
      ev.stopImmediatePropagation();
      ev.preventDefault();
      P.Share.share({ text: window.shareText(), dialogTitle: "שיתוף התוצאה" })
        .catch(() => {});
    }, true);
  });

  /* ---------- 3ב. כפתור וואטסאפ ----------
     המנוע קורא ל-window.open(url, "_blank"). ב-WebView של אנדרואיד
     זה תלוי ב-setSupportMultipleWindows, ש-Capacitor **אינו**
     מגדיר, וגם אין onCreateWindow — כלומר בגרסאות WebView מסוימות
     הקריאה היא no-op שקט והכפתור פשוט לא עושה כלום.

     location.href הוא ניווט באותו פריים, ולכן הוא תמיד מפעיל את
     shouldOverrideUrlLoading. משם Bridge.launchIntent רואה מפתח
     שאינו ה-origin של האפליקציה ופותח Intent.ACTION_VIEW — כלומר
     וואטסאפ. הדף עצמו לא מנווט לשום מקום, כי launchIntent מחזיר
     true ומבטל את הניווט. */
  safe(() => {
    const wa = document.getElementById("wa");
    if (!wa || typeof window.shareText !== "function") return;
    wa.addEventListener("click", (ev) => {
      ev.stopImmediatePropagation();
      ev.preventDefault();
      location.href = "https://wa.me/?text=" + encodeURIComponent(window.shareText());
    }, true);
  });

  /* ---------- 3ג. עזרת חבר ----------
     אותה מלכודת בדיוק כמו 3ב, ומאותה סיבה: המנוע קורא ל-window.open
     ובלעדי העקיפה הזאת הכפתור לא עושה שום דבר באפליקציה — בשקט,
     בלי שגיאה. אם מוסיפים עוד כפתור שפותח כתובת חיצונית, הוא צריך
     את אותו טיפול.

     שים לב: stopImmediatePropagation מבטל גם את track() שבמאזין של
     המנוע, ולכן הדיווח נשלח כאן. window.SPORTDEL.analyticsUrl הוא
     מה שהמנוע כבר מפרסם. */
  safe(() => {
    const fb = document.getElementById("friendBtn");
    if (!fb || typeof window.friendText !== "function") return;
    fb.addEventListener("click", (ev) => {
      ev.stopImmediatePropagation();
      ev.preventDefault();
      if (typeof window.trackFriend === "function") window.trackFriend();
      location.href = "https://wa.me/?text=" + encodeURIComponent(window.friendText());
    }, true);
  });

  /* ---------- 4. כפתור "חזור" של אנדרואיד ----------
     בלי זה לחיצה אחת על "חזור" סוגרת את האפליקציה מתוך חלונית
     פתוחה. זו אחת התלונות הנפוצות בביקורות, ובדיקת איכות של
     גוגל מתייחסת לזה. */
  safe(() => {
    if (!P.App || platform !== "android") return;
    P.App.addListener("backButton", () => {
      /* סדר סגירה מהפנימי לחיצוני */
      const open = [
        document.querySelector("#sugg.on"),
        document.querySelector(".modal.on"),
        document.querySelector("#picker.on")
      ].filter(Boolean)[0];
      if (open) { open.classList.remove("on"); return; }
      /* בלשונית הקרב — חזרה לחידה היומית, לא יציאה */
      const versus = document.querySelector("#versusView");
      if (versus && !versus.classList.contains("hide")) {
        const daily = document.querySelector('[data-tab="daily"], #tabDaily');
        if (daily) { daily.click(); return; }
      }
      P.App.minimizeApp().catch(() => P.App.exitApp().catch(() => {}));
    });
  });

  /* ---------- 5. ההתראה היומית ----------
     הפיצ'ר שמחזיר אנשים, וגם מה שהופך את זה לאפליקציה.

     **ההרשאה נדרשת רק אחרי שהשחקן סיים חידה ראשונה**, ולא
     בפתיחה. בקשה קרה בשנייה הראשונה נדחית ברוב המקרים, ואחרי
     דחייה אין דרך חזרה בלי להישלח להגדרות המערכת. אחרי שפתרת
     חידה, "להזכיר לך מחר?" הוא בדיוק מה שמצפים לו.

     ההתראה מקומית, לא Push. אין שרת, אין FCM, אין טוקנים, ואין
     תלות ברשת — וזה כל מה שצריך כדי להגיד "החידה של היום באוויר".

     **תזכורות מתוארכות, לא התראה חוזרת.** עד 1.0.11 זו הייתה
     התראה אחת "כל יום ב-8:30" (repeats), והיא לא יכלה לדעת
     שכבר פתרת: מי ששיחק אחרי חצות קיבל בבוקר "החידה של היום
     באוויר" על חידה שכבר סיים. עכשיו כל יום הוא התראה נפרדת עם
     מזהה של התאריך, לשבועיים קדימה, וסיום החידה של היום מבטל את
     של היום. כל פתיחה ממלאת את החלון מחדש, כך שהוא לא נגמר.

     **isExactNotification: false.** ברירת המחדל של התוסף היא אזעקה
     מדויקת. באנדרואיד 12+ בלי הרשאת SCHEDULE_EXACT_ALARM הוא פותח
     את מסך "Alarms & reminders" של המערכת מעל האפליקציה — וזה מה
     שקרה לכל מי שאישר התראות, מיד אחרי התוצאה. ההרשאה גם הוסרה
     מהמניפסט. allowWhileIdle כבוי מאותה סיבה: תזכורת שמגיעה 8:30
     או 8:41 היא אותה תזכורת. */
  const LEGACY_ID = 1;                // ההתראה החוזרת של 1.0.11 ומטה
  const HOUR = 8, MINUTE = 30;
  const DAYS = 14;
  const BASE = 2000000;               // מזהה = BASE + מספר היום (שעון מקומי)

  const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const dayNum = d => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);

  /* החידה של היום כבר נגמרה, באיזה מועדון שהוא. נרשם כשכרטיס התוצאה
     נפתח על חידת היום — לא ארכיון ולא משחק אימון. */
  const doneToday = () => get("done") === dayKey(new Date());

  async function scheduleDaily() {
    if (!P.LocalNotifications) return;
    const perm = await P.LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;

    const now = new Date();
    const ids = [{ id: LEGACY_ID }];
    const items = [];
    for (let i = 0; i < DAYS; i++) {
      /* Date מגלגל חודש ושנה בעצמו, ושומר 8:30 מקומי גם במעבר שעון */
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, HOUR, MINUTE);
      const id = BASE + dayNum(at);
      ids.push({ id });
      if (at <= now) continue;                     // השעה של היום כבר עברה
      if (i === 0 && doneToday()) continue;        // כבר פתרת היום
      items.push({
        id, title: "SportDle", body: "החידה של היום באוויר. מי השחקן?",
        schedule: { at, allowWhileIdle: false },
        isExactNotification: false,
        smallIcon: "ic_stat_sportdle"
      });
    }
    /* מחיקה לפני קביעה — כולל ההתראה החוזרת הישנה, אחרת מי שמעדכן
       מ-1.0.11 מקבל שתי התראות בכל בוקר. */
    await P.LocalNotifications.cancel({ notifications: ids }).catch(() => {});
    if (items.length) await P.LocalNotifications.schedule({ notifications: items });
    set("daily", "1");
  }

  async function askThenSchedule() {
    if (!P.LocalNotifications) return;
    if (get("asked")) { if (get("daily")) scheduleDaily(); return; }
    set("asked", "1");
    const res = await P.LocalNotifications.requestPermissions();
    if (res.display === "granted") await scheduleDaily();
  }

  /* מחדשים את החלון בכל פתיחה של מי שכבר אישר. */
  safe(() => { if (get("daily")) scheduleDaily(); });

  /* כרטיס התוצאה נפתח: גם הרגע לבקש הרשאה (פעם אחת), וגם הסימן
     שהחידה של היום נגמרה. #result מקבל class="on" בניצחון ובהפסד.

     המשתנים של המנוע (puzzleNo, todayNo, practice) גלויים כאן: שני
     הקבצים הם סקריפטים רגילים באותו דף, לא מודולים.

     **בדיקה גם בטעינה**, לא רק בשינוי: מי שפותח אחרי שכבר פתר — המנוע
     משחזר את הלוח ומדליק את הכרטיס לפני שהסקריפט הזה רץ, והמשקיף
     לא היה רואה שום שינוי. */
  safe(() => {
    const result = document.getElementById("result");
    if (!result || !window.MutationObserver) return;
    let asked = false;
    const onResult = (fromChange) => {
      if (!result.classList.contains("on")) return;
      const today = typeof puzzleNo !== "undefined" && typeof todayNo !== "undefined"
        && puzzleNo === todayNo && !(typeof practice !== "undefined" && practice);
      if (today && !doneToday()) {
        set("done", dayKey(new Date()));
        if (get("daily")) scheduleDaily();
      }
      if (fromChange && !asked) { asked = true; setTimeout(askThenSchedule, 1400); }
    };
    new MutationObserver(() => onResult(true))
      .observe(result, { attributes: true, attributeFilter: ["class"] });
    onResult(false);
  });

  /* ---------- 7. חתימת גרסה גלויה ----------
     שלוש גרסאות APK הגיעו למכשיר באותו יום, ואי אפשר היה להבדיל
     ביניהן במסך — מה שהפך "יש עוד באג" לשאלה על איזה קובץ מדובר.
     versionName הוא 1.0.<run_number>, כלומר המספר בפוטר מצביע
     ישירות על הריצה ב-Actions שממנה הקובץ הגיע. */
  safe(() => {
    if (!P.App) return;
    const stamp = async () => {
      const info = await P.App.getInfo();
      const el = document.getElementById("bld");
      if (!el || !info || !info.version) return;
      if (el.dataset.appv) return;                 // לא להוסיף פעמיים
      el.dataset.appv = info.version;
      el.textContent = `${el.textContent} · app ${info.version}`;
    };
    if (document.readyState === "complete") setTimeout(stamp, 300);
    else addEventListener("load", () => setTimeout(stamp, 300));
  });

  /* ---------- 8. קישור הזמנה שנפתח באפליקציה ----------
     intent-filter במניפסט קולט https://<הדומיין>/join/... ומעביר
     את הכתובת לכאן. **בלי הקוד הזה האפליקציה הייתה נפתחת בעמוד
     הראשי ומתעלמת מהחדר** — כלומר הקישור עובד, ההזמנה לא.

     שתי דרכים להגיע: appUrlOpen כשהאפליקציה כבר פתוחה,
     ו-getLaunchUrl כשהיא נפתחת מאפס. שתיהן נדרשות.

     הניווט הוא ל-"/?room=CODE" ולא קריאה ישירה למנוע הקרב:
     המסלול הזה כבר קיים ונבדק (fromLink ב-versus.js פותח את
     הלשונית וממלא את הקוד), ומסלול הצטרפות שני היה מקום נוסף
     שיכול להישבר. */
  safe(async () => {
    if (!P.App) return;
    const roomOf = (url) => {
      try { return new URL(url).searchParams.get("room"); } catch (e) { return null; }
    };
    const goRoom = (raw) => {
      const c = String(raw || "").toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 4);
      if (c.length !== 4) return false;
      /* כבר באותו חדר — בלי זה לחיצה חוזרת על הקישור טוענת מחדש */
      if (new URLSearchParams(location.search).get("room") === c) return true;
      location.replace(`/?room=${c}`);
      return true;
    };

    /* שיתוף הפתרון היומי מקשר ל-/<slug>/ — דף המועדון. באפליקציה
       פותחים את אותו מועדון דרך ?club=, שהמנוע כבר יודע לקרוא. */
    const goClub = (url) => {
      let seg;
      try { seg = new URL(url).pathname.split("/").filter(Boolean)[0]; }
      catch (e) { return false; }
      const known = (window.SPORTDEL && window.SPORTDEL.order) || [];
      if (!seg || !known.includes(seg)) return false;
      if (new URLSearchParams(location.search).get("club") === seg) return true;
      location.replace(`/?club=${encodeURIComponent(seg)}`);
      return true;
    };

    const route = (url) => {
      if (!url) return;
      if (goRoom(roomOf(url))) return;
      goClub(url);
    };

    P.App.addListener("appUrlOpen", (ev) => route(ev && ev.url));
    const launch = await P.App.getLaunchUrl();
    if (launch && launch.url) route(launch.url);
  });

  /* פתיחה מתוך ההתראה — לא צריך לעשות כלום מלבד לא להיתקע */
  safe(() => P.LocalNotifications &&
    P.LocalNotifications.addListener("localNotificationActionPerformed", () => {}));
})();
