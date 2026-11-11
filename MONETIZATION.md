# מונטיזציה — פרסומת קטנה וכפתור "קפה"

מחקר בלבד, 11/11/2026. אין כאן קוד, ולא נפתח שום חשבון. כל טענה
על מדיניות מקושרת למקור הרשמי. זה לא ייעוץ משפטי או פיננסי.

**השורה התחתונה:** מתחילים בכפתור "קפה" **באתר ובאנדרואיד בלבד**
(קישור חיצוני, בלי עמלת חנות), ובפרסומת **באתר בלבד**: יחידה אחת בתוך
כרטיס התוצאה ובדפי התוכן, לא באנר צף. AdMob באפליקציות נדחה עד שיש
מספיק משתמשים שזה שווה את הכנסת ה-SDK, את מסכי ההסכמה ואת עדכון טפסי
הפרטיות בשתי החנויות. ב-iOS: בלי כפתור קפה, או "צנצנת טיפים" ב-IAP.

---

## 1. האתר — AdSense

### מצב נוכחי (נבדק)

| מה | מצב |
|---|---|
| קוד פרסומות במאגר | אין (בבקשתך) |
| `https://sportdle.techbynoam.com/ads.txt` | 404 |
| אישור AdSense לאתר | **לא ידוע מהמאגר.** צריך לבדוק בחשבון AdSense, תחת Sites. דפי התוכן (555) נבנו כדי לעבור את הבדיקה. |
| דף הפרטיות | כבר מתאר את AdSense ואת AdMob בלשון "בכוונתי" (`scripts/lib/content.mjs`, בערך שורה 773) |

### מיקום: יחידה בתוך הדף, לא עוגן תחתון

| אפשרות | הערכה |
|---|---|
| **עוגן תחתון (anchor, דרך Auto ads)** | נצמד לתחתית המסך בטלפון. **מעל שדה הניחוש והקלדה בזמן משחק**, ולכן סיכון ממשי ללחיצות בטעות. גוגל אוסרת מיקום שעלול להיראות כחלק מהניווט או מהממשק ([AdSense Program policies](https://support.google.com/adsense/answer/48182)). לא מומלץ על מסך המשחק. |
| **יחידה רספונסיבית אחת בכרטיס התוצאה** (`#result`) | **מומלץ.** מופיעה רק אחרי שהחידה נגמרה, ולכן לא מפריעה למשחק. צריך מרווח ברור מכפתורי השיתוף, ותווית "פרסומת". אסור לעודד לחיצה, ואסור למקם בצורה שמושכת את העין אל המודעה ([AdSense Program policies](https://support.google.com/adsense/answer/48182)). |
| **דפי תוכן** (ארכיון, שחקנים, מועדונים) | **מומלץ.** יש בהם טקסט, וגוגל אוסרת פרסומות בדפים "שאין בהם תוכן" ([שם](https://support.google.com/adsense/answer/48182)). יחידה אחת אחרי הפסקה הראשונה. |

את Auto ads מכבים, או מגבילים ל-in-page בלבד. כך שליטה מלאה במיקום,
ואף פעם לא יופיע interstitial או עוגן מעל המשחק.

### הסכמה (CMP)

| קהל | מה נדרש |
|---|---|
| **EEA, בריטניה, שווייץ** | פרסום מותאם אישית מחייב **CMP מוסמך של גוגל, המשולב ב-IAB TCF**. בתוקף מ-16/01/2024, ובשווייץ מ-31/07/2024. בלי CMP מוסמך יוצגו לכל היותר פרסומות לא מותאמות או מוגבלות ([Google — CMP requirements](https://support.google.com/adsense/answer/13554116), [EU user consent policy](https://www.google.com/about/company/user-consent-policy/)). **הפתרון הזול:** ה-CMP של גוגל עצמה, בלשונית Privacy & messaging ב-AdSense. הוא חינמי ומוסמך, וההודעה מוצגת רק לגולשים מאירופה. |
| **ישראל** | לא מצאתי בחוק הישראלי חובה מפורשת לבאנר הסכמה לעוגיות. חוק הגנת הפרטיות (כולל תיקון 13) מחייב שקיפות, ודף הפרטיות כבר מכסה את זה. **לא נבדק מול עורך דין.** |
| **ארה"ב** (מדינות עם חוקי פרטיות) | בלשונית Privacy & messaging יש גם הודעת US states. התנועה מארה"ב זניחה, וזה אופציונלי. |

### מה משתנה בדף הפרטיות

1. "בכוונתי להציג" הופך ל"מוצגות" (כבר מתועד בזיכרון כצעד הבא).
2. משפט על הודעת ההסכמה לגולשים מאירופה, וקישור "ניהול הסכמה" שפותח
   אותה מחדש. ה-CMP של גוגל מספק את הקישור.
3. באפליקציות: רק אם AdMob נכנס (סעיף 2). עד אז, נשאר "כרגע אין".

---

## 2. האפליקציות — AdMob

**AdSense ב-WebView אסור.** ההנחיה הרשמית היא שבאפליקציה מציגים
מודעות דרך SDK של AdMob, ליד ה-WebView ([AdSense Program policies](https://support.google.com/adsense/answer/48182)).
לכן קוד ה-AdSense חייב **לא להגיע ל-`app-dist`** (פירוט בסעיף 4).

### התוסף

| תוסף | גרסה | הערה |
|---|---|---|
| **`@capacitor-community/admob`** | **8.3.0** (`latest`, עודכן 30/10/2026; נבדק ב-`npm view`) | הסדרה 8.x תואמת ל-Capacitor 8. התוסף הקהילתי הוותיק, ומדריך הפרסומות של Capacitor מפנה אליו ([Capacitor — Ads guide](https://capacitorjs.com/docs/guides/ads)). כולל UMP (הסכמה) ו-ATT. **המלצה.** |
| `@capgo/capacitor-admob` | 8.2.7, peer ‎`@capacitor/core >=8.0.0` | חלופה פעילה. אין סיבה להעדיף אותה. |

### מיקום

| אפשרות | הערכה |
|---|---|
| באנר קבוע בתחתית כל הזמן | הבאנר הנייטיב יושב מעל ה-WebView, **בדיוק איפה שהמקלדת ושדה הניחוש**. גוגל פליי אוסרת מודעות ש"מופיעות פתאום באזור שבו המשתמש רגיל להקיש" ([Play — Ads policy](https://support.google.com/googleplay/android-developer/answer/9857753)), ו-AdMob מגדירה מיקום באנרים ליד אלמנטים לחיצים כמיקום בעייתי ([AdMob policies](https://support.google.com/admob/answer/6128543)). דורש גם padding ב-CSS מתחת לבאנר. |
| **באנר רק במסך הסיום** | **מומלץ.** מוצג כשכרטיס התוצאה נפתח, ומוסתר כשחוזרים למשחק או לאימון. אותו MutationObserver על `#result` שכבר מפעיל את `rateApp` ב-`src/native.js`. |
| Interstitial | **לא.** מסך מלא באמצע המשחק אסור, וגם interstitial שלא נסגר אחרי 15 שניות ([Play — Ads policy](https://support.google.com/googleplay/android-developer/answer/9857753)). מעבר לכך, זה בדיוק ה"מפריע" שביקשת להימנע ממנו. |

### רשימת הכנה (מהבעלים)

| צעד | איפה | מקור |
|---|---|---|
| חשבון AdMob, ושתי אפליקציות (Android ו-iOS) שמקושרות לחנויות | admob.google.com | — |
| **`app-ads.txt`** בשורש הדומיין של **"אתר המפתח" בדף החנות**. אם אתר המפתח הוא `sportdle.techbynoam.com`, הקובץ הוא `https://sportdle.techbynoam.com/app-ads.txt` (היום 404). | `dist/` דרך `build.mjs` | [AdMob — app-ads.txt](https://support.google.com/admob/answer/9363762) |
| **הודעת GDPR** ב-Privacy & messaging, ו-UMP בקוד: `requestConsentInfoUpdate` בכל פתיחה, ולא לבקש מודעה לפני `canRequestAds` | AdMob ו-`native.js` | [AdMob — UMP SDK](https://developers.google.com/admob/android/privacy), [CMP requirement](https://support.google.com/adsense/answer/13554116) |
| **ATT ב-iOS**: מוצג רק אם רוצים IDFA, כלומר פרסום מותאם. אפשרות פשוטה יותר: **לא לבקש ATT**, ולקבל רק מודעות לא מותאמות (פחות כסף, אפס חלונות). | `Info.plist` (`NSUserTrackingUsageDescription`) | [Apple — User Privacy and Data Use](https://developer.apple.com/app-store/user-privacy-and-data-use/) |
| Play Console → App content → **Ads: "Yes, contains ads"** | Play Console | [Play — Ads policy](https://support.google.com/googleplay/android-developer/answer/9857753), [Play — Prepare your app for review](https://support.google.com/googleplay/android-developer/answer/9859455) |
| **Data safety**: להוסיף את מה ש-AdMob אוסף (Device or other IDs, App interactions, Diagnostics) למטרות Advertising/Analytics | Play Console | [Play — Data safety](https://support.google.com/googleplay/android-developer/answer/10787469), [AdMob — Data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure) |
| **App Privacy (תווית התזונה)**: Identifiers, Usage Data, Diagnostics. "Used to track" רק אם מבקשים ATT. | App Store Connect | [Apple — App privacy details](https://developer.apple.com/app-store/app-privacy-details/), [AdMob iOS — data disclosure](https://developers.google.com/admob/ios/privacy/data-disclosure) |
| `com.google.android.gms.permission.AD_ID` במניפסט (התוסף מוסיף), והצהרת Advertising ID ב-Play | Play Console | [Play — Advertising ID](https://support.google.com/googleplay/android-developer/answer/6048248) |

**סיכון iOS נוסף:** אפליקציה שעוטפת אתר ומוסיפה פרסומות לא עוזרת
לטיעון נגד 4.2. אפל דוחה אפליקציות "שתוכננו בעיקר להצגת פרסומות"
(3.2.2(iii)) ואפליקציות שאינן יותר מאתר ארוז (4.2)
([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)).
באנר רק במסך הסיום לא אמור להיחשב "בעיקר פרסומות", אבל אם 4.2 כבר
גבולי, כדאי לא להוסיף לו עוד סיבה.

### כמה כסף (הערכה גסה מאוד)

לא מצאתי מקור ציבורי אמין עם eCPM לישראל. המספרים הם סדר גודל, וכל
אחד מהם יכול לטעות פי 3 לכל כיוון:

- **באנר AdMob:** ממוצע עולמי בערך 0.20–0.80$ ל-1,000 הצגות, ובשווקי Tier-1 בערך 0.50–1.50$
  ([Playwire, 09/2025](https://www.playwire.com/blog/admob-ecpm-benchmarks-what-publishers-should-expect); בלוג של סוכנות, לא גוגל). ישראל כנראה באמצע. **הנחה: 0.3–1$.**
- **AdSense באתר:** RPM של 0.5–3$ לכל 1,000 צפיות בדף, בהערכה. תנועה בעברית בדרך כלל בתחתית הטווח.
- **חישוב:** כ-1–2 הצגות למשתמש ביום (מסך סיום אחד, ולפעמים אימון).

| משתמשים ביום | הצגות בחודש | הכנסה בחודש (טווח) |
|---|---|---|
| 300 | ‏~15,000 | **‏~5–15$** |
| 1,000 | ‏~50,000 | **‏~15–50$** |
| 3,000 | ‏~150,000 | **‏~45–150$** |

**למה זה חשוב:** ב-AdSense וב-AdMob יש סף תשלום (בדרך כלל 100$; לא
אומת בסבב הזה). ב-300 משתמשים ביום עשויים לעבור חודשים עד התשלום
הראשון. ב-EEA, בלי הסכמה, ההכנסה נמוכה עוד יותר. המספר האמיתי יגיע
רק מדוח ה-eCPM בחשבון, אחרי כשבועיים.

---

## 3. כפתור "קפה" — מה מותר ואיפה

### הפלטפורמה לקבלת הכסף (ישראלי, יחיד)

| שירות | בישראל | הערה |
|---|---|---|
| **Buy Me a Coffee** | **כנראה לא עובד.** התשלומים עוברים רק דרך Stripe ([BMC — Stripe payouts](https://help.buymeacoffee.com/en/articles/5777478-how-to-set-up-payouts-with-stripe-express)), ו-Stripe לא תומכת בחשבונות בישראל ([רשימת המדינות של Stripe](https://stripe.com/global)). צריך לאמת בהרשמה. | |
| **Ko-fi** | **עובד דרך PayPal.** Ko-fi מתחבר ל-PayPal או ל-Stripe ([Ko-fi — אמצעי תשלום](https://help.ko-fi.com/hc/en-us/articles/24482435253661-What-payment-methods-are-available-on-Ko-fi)). אין עמלת פלטפורמה על טיפים בחשבון החינמי, אבל PayPal גובה עמלה. | **מומלץ לאתר.** |
| **PayPal.me** | עובד | הכי פשוט. הדף פחות "חמים", ומוביל ישר לתשלום. |
| **Bit / PayBox** | עובד, אבל רק לישראלים | Bit לאדם פרטי מבוסס מספר טלפון, ופרסומו באתר ציבורי חושף אותו. לפייבוקס יש קישור "קופה". אפשר כאופציה שנייה, לא כראשי. |

### מה החנויות מתירות

| פלטפורמה | כלל | מסקנה |
|---|---|---|
| **אתר** | אין מגבלה. רק בלי לשים את הכפתור צמוד למודעה, כדי שלא יבלבל (AdSense אוסר עיצוב שגורם למודעה להיראות כמו תוכן או כמו כפתור). | ✅ קישור ל-Ko-fi |
| **Google Play** | טיפ "ממשתמש ליוצר" **אינו מחייב Play Billing**, בתנאי ש-**100% מגיע ליוצר** ושה**תשלום לא פותח שום תוכן דיגיטלי**. אחרת חובה להשתמש ב-Billing ([Play — Understanding Payments policy, FAQ](https://support.google.com/googleplay/android-developer/answer/10281818); [Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)). | ✅ **קישור חיצוני מותר**, כל עוד הכפתור לא נותן כלום (בלי תג "תומך" ובלי ביטול פרסומות). **אזור אפור:** עמלת PayPal או Ko-fi אולי מתנגשת עם ה-"100%". Bit או PayBox (בלי עמלה) נקיים יותר. סבירות נמוכה לאכיפה. |
| **Apple (חנות ישראל)** | 3.1.1: "טיפ" למפתח **דרך IAP**. 3.1.3 ו-3.1.1(a): מחוץ לחנות ארה"ב **אסור** כפתור או קישור שמפנה לאמצעי תשלום אחר. 3.2.1(vii) מתיר מתנה כספית בלי IAP רק **בין משתמשים** ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)). | ❌ **קישור חיצוני אסור.** אפשרויות: (א) **להסתיר את הכפתור ב-iOS** (מומלץ); (ב) צנצנת טיפים ב-IAP: מוצרים consumable ב-App Store Connect, תוסף רכישות, ואפל לוקחת 15% (Small Business Program); (ג) לחנות ארה"ב קישור מותר, אבל האפליקציה מופצת בעיקר בישראל ([3.1.1(a)](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase)). |

**חלופה לאנדרואיד שאין בה שום אזור אפור:** להציג את הכפתור באפליקציה
רק ב-Android, כקישור שנפתח בדפדפן החיצוני (`location.href`, כמו
`rateApp`). אם רוצים אפס סיכון: גם שם להסתיר, ולהשאיר את הכפתור
באתר בלבד.

### נוסח

"נהנים? ☕ קפה קטן עוזר להמשיך לבנות" — שורה בסגנון `.rate`, אחרי
ניצחון, באותו מקום ש-`rateApp` ו-`getApp` מופיעים. בלי חלון קופץ.
גם "אהבתם? אני בונה מערכות כאלה — TechByNoam" (`.promo`) כבר שם.
כדאי לבחור אחד מהשניים בכל רגע, שלא יהיו שלוש בקשות ברצף.

---

## 4. התוכנית

### שלב 1: מיד, עלות אפס, סיכון אפס

| מה | מי | קוד |
|---|---|---|
| חשבון Ko-fi, מחובר ל-PayPal | **בעלים** | — |
| כפתור "קפה" **באתר בלבד** (`hidden`, ומוצג רק כשאין Capacitor) | — | `src/template.html`: כפתור ושורת CSS (~5 שורות, מצטרף לסלקטור של `#getApp`). JS: ~10 שורות ליד `showGetApp`. כתובת Ko-fi ב-`config/site.json`, לפי הדפוס של `androidApp`. |

### שלב 2: AdSense באתר (אחרי אישור האתר)

| מה | מי | קוד |
|---|---|---|
| לבדוק שהאתר **Ready** ב-AdSense → Sites | **בעלים** | — |
| Privacy & messaging: להפעיל הודעת GDPR (ה-CMP של גוגל) | **בעלים** | — |
| לכבות Auto ads, או להשאיר In-page בלבד | **בעלים** | — |
| `ads.txt` ב-`dist/` | — | `scripts/build.mjs`: ~5 שורות. מזהה `pub-` ב-`config/site.json`. |
| יחידה אחת ב-`#result`, ויחידה אחת ב-`shell()` | — | `src/template.html`: div ותווית "פרסומת", ~10 שורות. `scripts/lib/content.mjs` → `shell()`: ~8 שורות. |
| **לא להכניס את AdSense לאפליקציה** | — | `tools/app-prepare.mjs`: להסיר את תגית `adsbygoogle` מכל HTML ב-`app-dist` (~5 שורות). כך הקוד לא נמצא ב-WebView בכלל, ולא רק מוסתר. |
| דף פרטיות: "מוצגות", הסכמה לאירופה, קישור לניהול הסכמה | — | `scripts/lib/content.mjs`, בערך 3 שורות טקסט |

### שלב 3: AdMob באפליקציות (רק כשיש מעל ~1,000 משתמשים ביום באפליקציה)

| מה | מי | קוד |
|---|---|---|
| חשבון AdMob, שתי אפליקציות, יחידת באנר לכל אחת, הודעת GDPR | **בעלים** | — |
| Play: Ads = Yes, Data safety, Advertising ID. Apple: App Privacy. | **בעלים** | — |
| `npm i @capacitor-community/admob@^8` ו-`cap sync` | — | `package.json`, ‏`AndroidManifest.xml` (meta-data עם App ID), ‏`Info.plist` (‏`GADApplicationIdentifier`, ‏`SKAdNetworkItems`, ואולי ATT) |
| UMP בפתיחה; באנר `showBanner` כש-`#result.on`, ו-`hideBanner` כשסוגרים | — | `src/native.js`: ~40 שורות, ליד ה-MutationObserver של `rateApp` |
| `app-ads.txt` בשורש הדומיין של "אתר המפתח" | — | `scripts/build.mjs`: ~3 שורות |
| גרסה חדשה לשתי החנויות | **בעלים** | — |

### שלב 4 (אופציונלי): קפה באנדרואיד, צנצנת טיפים ב-iOS

- **אנדרואיד:** להציג את אותו כפתור, כקישור יציאה, כשה-platform הוא `android`. בערך 2 שורות ב-`native.js`.
- **iOS:** רק אם יש ביקוש. 2–3 מוצרי consumable ב-App Store Connect, תוסף
  רכישות (למשל `@capgo/native-purchases` או RevenueCat), וכ-60 שורות. לרוב לא שווה.

---

## החלטות שהן שלך

1. **כפתור קפה: איפה?** (א) אתר בלבד; (ב) אתר ואנדרואיד (מותר לפי ה-FAQ של Play, עם אזור אפור בעמלה); (ג) הכל, כולל IAP ב-iOS.
2. **איזה ארנק?** Ko-fi דרך PayPal (בינלאומי), PayBox או Bit (ישראלי, בלי עמלה), או שניהם.
3. **AdSense:** לאשר יחידה בכרטיס התוצאה ובדפי התוכן, **בלי** עוגן תחתון.
4. **AdMob:** עכשיו, או רק אחרי סף משתמשים? וב-iOS: לבקש ATT (יותר כסף, חלון של אפל), או בלי ATT (רק לא-מותאם)?
5. **כפתור הקפה מול שורת TechByNoam:** האם להחליף ביניהם, או להציג את שניהם?
