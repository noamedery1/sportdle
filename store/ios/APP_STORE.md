# SportDle ל-App Store — כל מה שצריך ליום ההגשה

הכל מוכן בצד הקוד. המסמך הזה הוא שני דברים: **רשימת צעדים לפי
הסדר**, ו**ערכים מוכנים להעתקה** לכל שדה ב-App Store Connect.

מה כבר נעשה ונבדק במאגר (ענף `ios-prep`):

| | מה | איפה |
|---|---|---|
| ✅ | אייקון 1024 נוכחי (הכדור והקרניים), בלי שקיפות | `ios/App/App/Assets.xcassets/AppIcon.appiconset` |
| ✅ | מסך פתיחה כהה עם הלוגו (במקום ברירת המחדל של Capacitor) | `Splash.imageset` |
| ✅ | `arm64` במקום `armv7` — דרישת armv7 נדחית בהעלאה | `Info.plist` |
| ✅ | שורת סטטוס בהירה קבועה — אחרת שעון שחור על רקע שחור במצב בהיר | `Info.plist` |
| ✅ | `ITSAppUsesNonExemptEncryption = NO` — בלי שאלון הצפנה בכל בנייה | `Info.plist` |
| ✅ | שפה עברית, ממשק כהה, אייפון בלבד (בלי iPad — בלי צילומי iPad) | `Info.plist`, `project.pbxproj` |
| ✅ | רקע WKWebView כהה — בלי הבהוב לבן בקפיצה האלסטית | `capacitor.config.json` |
| ✅ | בנייה, חתימה בענן והעלאה מ-GitHub Actions, בלי מק | `.github/workflows/ios-release.yml` |
| ✅ | 5 צילומי מסך 1206×2622 לשדה ברירת המחדל (ו-1290×2796 כמקור) | `store/ios/6.3/*.png` |
| ✅ | Universal Links — נוצר אוטומטית כשממלאים Team ID | `config/site.json` → `iosAppLinks` |

---

## מחר, לפי הסדר

### 1. חשבון מפתח (דפדפן)
1. https://developer.apple.com/programs/enroll — **Individual**, עם ה-Apple ID שלך. 99$.
2. ⚠ **האישור לא תמיד מיידי.** אפל מאמתת זהות, ולפעמים זה לוקח 24–48 שעות.
   כל עוד ההרשמה "בטיפול", אין גישה ל-App Store Connect. כדאי להירשם
   כמה שיותר מוקדם ביום.
3. אחרי האישור: https://appstoreconnect.apple.com → **Business / Agreements** —
   לאשר את **Free Apps Agreement**. אפליקציה חינמית לא צריכה פרטי בנק.

### 2. רשומת האפליקציה ב-App Store Connect
**Apps → "+" → New App**

| שדה | ערך |
|---|---|
| Platforms | iOS |
| Name | `SportDle` (תפוס? → `SportDle – חידת כדורגל`) |
| Primary Language | Hebrew |
| Bundle ID | `sportdle.techbynoam.com` |
| SKU | `sportdle-ios` |
| User Access | Full Access |

אם ה-Bundle ID לא מופיע ברשימה: developer.apple.com → Certificates,
Identifiers & Profiles → **Identifiers → "+" → App IDs → App** →
Bundle ID **Explicit** `sportdle.techbynoam.com`. אין צורך לסמן
Capabilities (Push לא נדרש — התזכורת היומית היא התראה מקומית).

### 3. מפתח API ל-GitHub Actions
**Users and Access → Integrations → App Store Connect API → Team Keys → "+"**
- Name: `github-actions` · Access: **Admin**
- מורידים `AuthKey_XXXXXXXXXX.p8` — **פעם אחת בלבד**, לשמור בצד
- רושמים **Key ID** ו-**Issuer ID** (בראש הדף)
- **Team ID**: developer.apple.com → Account → Membership details

המרת המפתח ל-base64 (PowerShell):
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXXXXXXXX.p8")) | Set-Clipboard
```

GitHub → המאגר → **Settings → Secrets and variables → Actions → New repository secret**:

| סוד | ערך |
|---|---|
| `APPLE_TEAM_ID` | ה-Team ID (10 תווים) |
| `ASC_KEY_ID` | ה-Key ID |
| `ASC_ISSUER_ID` | ה-Issuer ID (UUID) |
| `ASC_KEY_P8_BASE64` | מה שהועתק מהפקודה למעלה |

### 4. בנייה והעלאה
GitHub → **Actions → IPA → Run workflow** (version `1.0`, upload ✅).
~15 דקות על הראנר, ואז **5–30 דקות עיבוד אצל אפל** עד שהבנייה מופיעה
ב-App Store Connect → TestFlight.

אם נכשל — הלוג אומר איפה. התקלות הצפויות:
- `No suitable application records` → שלב 2 לא בוצע או Bundle ID שונה
- `Cloud signing permission error` → המפתח אינו Admin
- `requires iOS 26 SDK` → נבנה ב-Xcode ישן; השלב "בחירת Xcode" מדפיס באיזה

### 5. בדיקה על אייפון אמיתי (מומלץ מאוד, 10 דקות)
TestFlight → **Internal Testing → "+"** → להוסיף את עצמך או חבר עם אייפון.
מתקינים את TestFlight מהחנות, ובודקים את 5 הנקודות מ-`APP.md`
("מה שנשאר לבדוק על מכשיר אמיתי"): קרב חברים, וואטסאפ, התראה, רצף
אחרי סגירה, אופליין.

### 6. דף החנות — הערכים בהמשך המסמך
**App Store → iOS App → 1.0 Prepare for Submission**: טקסטים, צילומים,
בנייה. ואז בתפריט הצד: **App Privacy**, **Age Rating** (בתוך App
Information), **Pricing and Availability** (Free).

### 7. Submit for Review
בדרך כלל 24–48 שעות.

### 8. אחרי האישור הראשון — Universal Links
כדי שקישורי הזמנה (`/join/?room=…`) ייפתחו באפליקציה ולא בספארי:
1. ב-`config/site.json` → `iosAppLinks.teamId` = ה-Team ID → פריסה.
   הבנייה תיצור `/.well-known/apple-app-site-association`.
2. באפליקציה: הרשאת **Associated Domains** עם
   `applinks:sportdle.techbynoam.com` → גרסה 1.1.

בכוונה **לא** בגרסה הראשונה: הרשאה נוספת היא עוד מקום שבו חתימה
ראשונה יכולה להיכשל, והאפליקציה עובדת מצוין גם בלעדיה.

---

## ערכים להעתקה

### Name (30)
```
SportDle
```

### Subtitle (30)
```
חידת השחקן היומית
```
(17 תווים. חלופה: `חידת כדורגל ישראלי יומית` — 24)

### Promotional Text (170)
```
כל יום שחקן מסתורי אחד וחמישה רמזים. שמונה ניסיונות לנחש, קרב חי מול חברים, ומי שמכיר את הקבוצה באמת — מנצח.
```

### Description (4000)
```
שחקן אחד מסתורי בכל יום. שמונה ניסיונות למצוא אותו.

SportDle הוא משחק ניחוש יומי על כדורגלנים ישראלים. כל ניחוש מחזיר חמישה רמזים, וכל רמז מסמן אם הוא מדויק, קרוב או רחוק:

• עמדה — שוער, מגן, קשר או חלוץ
• לאום
• העונה הראשונה של השחקן במועדון
• מספר התארים שהמועדון זכה בהם בזמן שהיה בסגל
• שנת הלידה

בשלושת הרמזים המספריים מופיע גם חץ שאומר לאיזה כיוון לזוז — וזה הכלי היעיל ביותר במשחק.

חמישה מועדונים, ולכל אחד מאגר שחקנים, לוח חידות, רצף וסטטיסטיקה נפרדים: בית"ר ירושלים, מכבי תל אביב, הפועל תל אביב, מכבי חיפה והפועל באר שבע.

קרב חברים: פותחים חדר, שולחים קוד בן ארבע אותיות, ומשחקים בזמן אמת עם עד ארבעה שחקנים — הרמזים נחשפים אחד אחד, ומי שמזהה ראשון לוקח הכי הרבה נקודות. אפשר לפתוח חדר על כמה מועדונים יחד.

מה יש באפליקציה:
• חידה חדשה כל יום
• תזכורת יומית, אם תרצו
• עובד בלי אינטרנט — כל המאגר מותקן עם האפליקציה
• קרב חברים בזמן אמת
• ארכיון של כל החידות שפורסמו
• רטט על כל רמז שנחשף
• בלי הרשמה, בלי חשבון, בלי סיסמה, בלי פרסומות

על המאגר: הנתונים נאספו ואומתו מול כמה מקורות בלתי תלויים — אתר ההתאחדות לכדורגל, worldfootball, ויקיפדיה וטרנספרמרקט. שחקן שאין עליו הסכמה בין שני מקורות אינו מופיע במשחק, לא כחידה ולא כניחוש.

SportDle הוא פרויקט אוהדים עצמאי ואינו רשמי. אין לו קשר למועדון, לליגה, להתאחדות לכדורגל או לכל גוף אחר, ואינו עושה שימוש בסמלי מועדונים. שמות המועדונים מוזכרים לשם תיאור עובדתי בלבד.

משוב, תיקונים והצעות: techbynoam@gmail.com
```
**שונה מדף גוגל בכוונה:** אין "דף לכל שחקן בבריכת התשובות" — דפי השחקן
מוצאים מהאפליקציה ב-`tools/app-prepare.mjs`, ואפל דוחה תיאור שמבטיח מה
שאין (כלל 2.3.1). נוספו קרב החברים והרטט, שקיימים.

### Keywords (100)
```
כדורגל,חידה,טריוויה,ליגת העל,שחקנים,ישראלי,ניחוש,יומי,ספורט,אוהדים,כדורגלנים,חידון,משחק מילים
```
(93 תווים) **בלי שמות מועדונים ובלי "wordle"** — מילות מפתח של סימנים
מסחריים או שמות אפליקציות אחרות הן דחייה לפי כלל 2.3.7. שמות המועדונים
נמצאים בתיאור, ושם החיפוש של אפל קורא אותם ממילא.

### URLs
| שדה | ערך |
|---|---|
| Support URL | `https://sportdle.techbynoam.com/contact/` |
| Marketing URL | `https://sportdle.techbynoam.com/` |
| Privacy Policy URL | `https://sportdle.techbynoam.com/privacy/` |

### Copyright
```
2026 TechByNoam
```

### Category
- Primary: **Games** → Subcategories: **Trivia**, **Sports**
- Secondary: **Sports**

### Version / What's New
גרסה ראשונה — השדה לא מוצג. בגרסאות הבאות:
```
תיקונים ושיפורים במאגר השחקנים.
```

---

## Age Rating

כל השאלות על תוכן (אלימות, מין, שפה, הימורים, סמים, אימה וכו'): **None**.

| שאלה | תשובה | למה |
|---|---|---|
| Unrestricted Web Access | **No** | קישורים חיצוניים נפתחים בספארי/וואטסאפ, לא בדפדפן בתוך האפליקציה |
| Messaging and Chat | **No** | אין צ'אט |
| Advertising | **No** | אין פרסומות |
| Gambling / Contests | **No** | אין פרסים ואין כסף |
| User-Generated Content | **ראה למטה** | |

**User-Generated Content** — ההחלטה שלך. מה שקיים: בקרב חברים כל שחקן
מקליד **כינוי** (עד 14 תווים) שרואים רק מי שקיבלו ממנו קוד חדר פרטי. אין
צ'אט, אין פרופילים, אין תוכן ציבורי.
- תשובה **Yes** היא המדויקת, אבל מפעילה את כלל 1.2 (דיווח וחסימה של תוכן
  פוגעני). יש באפליקציה טופס פידבק ומייל, ואין חסימת משתמש.
- ההמלצה: **Yes**, ולציין בהערות לבודק את ההסבר שלמעלה (מופיע בטקסט
  ההערות בהמשך). חדר פרטי של חברים עם כינוי בלבד מתקבל בדרך כלל.

התוצאה הצפויה: **4+**.

---

## App Privacy (תוויות הפרטיות)

**Data Used to Track You:** None. אין SDK פרסום, אין IDFA, אין מעקב בין אפליקציות.

**Do you or your third-party partners collect data from this app?** → **Yes**

| קטגוריה | סוג | מקושר לזהות? | מעקב? | מטרה | מה זה בפועל |
|---|---|---|---|---|---|
| Usage Data | Product Interaction | No | No | Analytics | אירוע אנונימי: מועדון, מספר חידה, נפתר/לא (Google Apps Script בשליטתך) |
| User Content | Gameplay Content | No | No | App Functionality | בקרב חברים: הכינוי והתשובות בחדר (Firebase) |
| Identifiers | User ID | No | No | App Functionality | מזהה אקראי שנוצר במכשיר לחדר הקרב — לא קשור לזהות |
| User Content | Other User Content | No | No | App Functionality | טופס פידבק ותיקון שחקן — טקסט חופשי |
| Contact Info | Email Address | **Yes** | No | App Functionality | **רק** אם המשתמש כותב מייל בטופס הפידבק כדי לקבל תשובה |
| Contact Info | Name | **Yes** | No | App Functionality | כנ"ל, אם כותב שם בטופס |

**לא נאסף:** מיקום, אנשי קשר, תמונות, אודיו, היסטוריית גלישה, מידע פיננסי,
בריאות. ההתקדמות, הרצף והסטטיסטיקה נשמרים **רק במכשיר** — לא נאספים.

ב-`Info.plist` אין שום בקשת הרשאה (מצלמה, מיקום וכו'). ההתראות המקומיות
מבקשות אישור בזמן ריצה, אחרי המשחק הראשון.

---

## App Review Information

**Sign-in required:** No · **Contact:** Noam Edery · techbynoam@gmail.com

**Notes** (באנגלית — הבודקים קוראים אנגלית):
```
SportDle is a daily guessing game about Israeli football players, in Hebrew (right-to-left). No account, no login, no purchases, no ads.

HOW TO PLAY
1. Pick a club on the first screen (the first card, Beitar Jerusalem, is the easiest to test).
2. Type a player's name in the search field and choose a suggestion. Names are in Hebrew. Without a Hebrew keyboard, paste one of these Beitar players: אלי אוחנה / שי חדד / אורי מלמיליאן
3. Each guess reveals five clues (position, nationality, first season, titles, birth year), colored exact / close / far, with arrows for the numeric ones. Eight attempts.

NATIVE FEATURES (beyond a website)
- The full player database is bundled with the app: the game works completely offline (try airplane mode).
- Optional daily local notification reminding the user about the new puzzle (asked after the first game).
- Haptic feedback on every revealed clue.
- Native share sheet for results.

FRIENDS DUEL (tab "קרב חברים")
A real-time room for 2–4 players. To test it alone: in the app, open the duel tab, type any nickname and tap "פתיחת חדר חדש" to get a 4-letter code. On a computer, open https://sportdle.techbynoam.com, tap "קרב חברים", type a nickname and the code, then tap "התחלה" in the app.
Players only type a short nickname (max 14 characters), visible only to the people they shared the private room code with. There is no chat, no public content and no profiles. Users can contact us through the feedback form in the app or at techbynoam@gmail.com.

SportDle is an independent fan project, not affiliated with any club or league. It uses no club logos; club names appear only descriptively.
```

---

## צילומי מסך

`store/ios/6.3/` — 1206×2622, לשדה **iPhone with Dynamic Island (medium display)**,
שהוא ברירת המחדל מאז שאפל שינתה את הדף (אוקטובר 2026). השדה דוחה 1290×2796
("File dimensions are invalid"); הוא מקבל רק 1179×2556 או 1206×2622, ואפל
מקטינה ממנו לשאר הגדלים. הקבצים ב-`store/ios/` הם המקור ב-1290×2796; הגרסה
הקטנה נוצרה מהם בהקטנה ובחיתוך של 2 פיקסלים מכל צד:
`ffmpeg -i X.png -vf "scale=1210:2622:flags=lanczos,crop=1206:2622" -pix_fmt rgb24 6.3/X.png`.
להעלות לפי הסדר:

1. `1-board.png` — לוח עם רמזים צבועים
2. `2-win.png` — מסך ניצחון
3. `3-clubs.png` — בורר חמשת המועדונים
4. `4-rules.png` — איך משחקים
5. `5-duel.png` — קרב חברים, חדר של כל חמשת המועדונים

**צילום דף השחקן הוצא** — הדף לא קיים באפליקציה (כלל 2.3.3). הקרב צולם
מחדש ב-`tools/screenshots-ios-duel.mjs`, **בלי** באנר "אפליקציית
אנדרואיד" של האתר (כלל 2.3.10 — אזכור פלטפורמה אחרת).

**לא להשתמש בהקלטות מהאמולטור** — הן כוללות את שורת הסטטוס והניווט
של אנדרואיד.

---

## אם יש דחייה

| קוד | מה זה | מה עושים |
|---|---|---|
| 4.2 Minimum Functionality | "אתר עטוף" | להפנות לסעיף NATIVE FEATURES בהערות: אופליין מלא, התראה יומית, רטט, גיליון שיתוף. לענות בתוך Resolution Center |
| 2.1 App Completeness | הבודק לא הצליח לבדוק משהו | לרוב הקרב (צריך שני שחקנים) — ההוראות בהערות |
| 1.2 User-Generated Content | כינויים בקרב | אפשר להוסיף סינון מילים לכינוי ולהגיש מחדש |
| 5.2.1 Intellectual Property | שמות מועדונים | ההצהרה "פרויקט אוהדים לא רשמי" כבר בתיאור; אין סמלים |
