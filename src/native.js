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
    if (platform === "android") await P.StatusBar.setBackgroundColor({ color: "#0C0C0E" });
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

     התזמון הוא התראה מקומית חוזרת, לא Push. אין שרת, אין FCM,
     אין טוקנים, ואין תלות ברשת — וזה כל מה שצריך כדי להגיד
     "החידה של היום באוויר". Push יתווסף רק אם נרצה לשלוח
     הודעות שאינן יומיות. */
  const NOTIF_ID = 1;
  const HOUR = 8, MINUTE = 30;

  async function scheduleDaily() {
    if (!P.LocalNotifications) return;
    const perm = await P.LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;
    /* מחיקה לפני קביעה: בלי זה עדכון של הטקסט או השעה משאיר את
       הקודמת בתוקף, והמשתמש מקבל שתי התראות בבוקר. */
    await P.LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] }).catch(() => {});
    await P.LocalNotifications.schedule({
      notifications: [{
        id: NOTIF_ID,
        title: "SportDle",
        body: "החידה של היום באוויר. מי השחקן?",
        /* allowWhileIdle כבוי בכוונה. הוא מתרגם לאזעקה מדויקת,
           ואזעקה מדויקת דורשת SCHEDULE_EXACT_ALARM — הרשאה שגוגל
           מצפה שתידרש רק כשתזמון מדויק הוא ליבת האפליקציה.
           תזכורת יומית שמגיעה 8:30 או 8:41 היא אותה תזכורת, ולכן
           אין שום סיבה לבקש את זה ולהזמין שאלות בביקורת. */
        schedule: { on: { hour: HOUR, minute: MINUTE }, repeats: true },
        smallIcon: "ic_stat_sportdle"
      }]
    });
    set("daily", "1");
  }

  async function askThenSchedule() {
    if (!P.LocalNotifications) return;
    if (get("asked")) { if (get("daily")) scheduleDaily(); return; }
    set("asked", "1");
    const res = await P.LocalNotifications.requestPermissions();
    if (res.display === "granted") await scheduleDaily();
  }

  /* מחדשים את התזמון בכל פתיחה של מי שכבר אישר — התראה חוזרת
     יכולה להיאבד באיפוס מכשיר או בעדכון גרסה. */
  safe(() => { if (get("daily")) scheduleDaily(); });

  /* הרגע הנכון לבקש: התוצאה נחשפה. #result מקבל class="on"
     גם בניצחון וגם בהפסד, ובשני המקרים "מחר שחקן חדש" נכון. */
  safe(() => {
    const result = document.getElementById("result");
    if (!result || !window.MutationObserver) return;
    const obs = new MutationObserver(() => {
      if (!result.classList.contains("on")) return;
      obs.disconnect();
      setTimeout(askThenSchedule, 1400);   // אחרי שהשחקן ראה את התשובה
    });
    obs.observe(result, { attributes: true, attributeFilter: ["class"] });
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
    const go = (raw) => {
      const c = String(raw || "").toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 4);
      if (c.length !== 4) return;
      /* כבר באותו חדר — בלי זה לחיצה חוזרת על הקישור טוענת מחדש */
      if (new URLSearchParams(location.search).get("room") === c) return;
      location.replace(`/?room=${c}`);
    };
    P.App.addListener("appUrlOpen", (ev) => go(roomOf(ev && ev.url)));
    const launch = await P.App.getLaunchUrl();
    if (launch && launch.url) go(roomOf(launch.url));
  });

  /* פתיחה מתוך ההתראה — לא צריך לעשות כלום מלבד לא להיתקע */
  safe(() => P.LocalNotifications &&
    P.LocalNotifications.addListener("localNotificationActionPerformed", () => {}));
})();
