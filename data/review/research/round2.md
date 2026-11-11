# סבב מחקר 2 — נתוני שחקנים (12/11/2026)

קבצים: `round2-fields.json` (שדות חסרים במאגר), `round2-new-players.json` (שחקנים שאינם במאגר). כלים: `tools/research/r2-*.mjs`. כלל: מאומת = לפחות שתי משפחות מקורות בלתי תלויות מסכימות (ויקיפדיה עברית+אנגלית = משפחה אחת). שנים = שנת סיום העונה.

## א. נתונים קיימים במאגר שנראים שגויים

### שנת לידה = שנת פטירה / שנה מהערת שוליים

באג ב-scripts/scrape.mjs (parsePlayerArticle): כשאין "תאריך לידה" בתיבה, נלקחת השנה **האחרונה** בפתיח — כלומר שנת הפטירה, או שנה מתוך {{הערה}}.

| מועדון | שחקן | במאגר | נכון | מקורות |
|---|---|---|---|---|
| הפועל ת"א | אדמונד שמילוביץ' | 1973 | 1921 | he.wikipedia (אדמונד שמילוביץ') + national-football-teams |
| מכבי ת"א | סטיב גורי | 2015 | 1981 | he.wikipedia (סטיב גורי) |

### שדות שסותרים שני מקורות בלתי תלויים שמסכימים ביניהם (ואף מקור לא תומך במאגר)

| מועדון | שחקן | שדה | במאגר | המקורות אומרים | מקורות |
|---|---|---|---|---|---|
| ביתר | ארצי בן יעקב | pos | FW | **MF** | he.wikipedia=MF, national-football-teams=MF | בלוח |
| ביתר | רענן דרעי | pos | DF | **MF** | Transfermarkt=MF, he.wikipedia=MF | פורסם+בלוח |
| ביתר | צחי אליחן | pos | MF | **FW** | Transfermarkt=FW, he.wikipedia=FW | פורסם+בלוח |
| ביתר | ערן לוי | pos | FW | **MF** | Transfermarkt=MF, he.wikipedia=MF | בלוח |
| ביתר | עוז ראלי | pos | MF | **DF** | Transfermarkt=DF, he.wikipedia=DF | בלוח |
| הפועל ב"ש | אמיר גנאח | pos | MF | **FW** | Transfermarkt=FW, he.wikipedia=FW | בלוח |
| הפועל ב"ש | איתי חזות | pos | DF | **MF** | Transfermarkt=MF, worldfootball=MF |  |
| הפועל ת"א | אדמונד שמילוביץ' | born | 1973 | **1921** | he.wikipedia=1921, national-football-teams=1921 |  |
| הפועל ת"א | יחזקאל חזום | born | 1947 | **1946** | Transfermarkt=1946, national-football-teams=1946 | בלוח |
| הפועל ת"א | עמנואל בואטנג | born | 1997 | **1996** | he.wikipedia=1996, worldfootball=1996 | בלוח |
| הפועל ת"א | עמנואל בואטנג | pos | MF | **FW** | he.wikipedia=FW, worldfootball=FW | בלוח |
| הפועל ת"א | טל ארצל | pos | MF | **DF** | Transfermarkt=DF, worldfootball=DF | בלוח |
| מכבי ת"א | ריף פרץ | pos | MF | **DF** | Transfermarkt=DF, he.wikipedia=DF, worldfootball=DF | בלוח |
| מכבי ת"א | אלירן עטר | pos | MF | **FW** | Transfermarkt=FW, he.wikipedia=FW, worldfootball=FW | בלוח |
| מכבי ת"א | רחמים צ'קול | pos | MF | **DF** | Transfermarkt=DF, he.wikipedia=DF |  |

בנוסף 36 מקרים "split" (רוב מול המאגר, אבל מקור אחד תומך במאגר) — ב-tools/research/r2-audit.json. עמדות: TM מסווג כנף כ-FW ו-worldfootball לפעמים כ-MF, כך שחלק מהפערים בעמדה הם עניין של מוסכמה ולא טעות.

### כפילויות: שחקן מוויקיפדיה שכבר קיים במאגר באיות אחר

| מועדון | ויקיפדיה | במאגר | עונות ויקי | עונות מאגר |
|---|---|---|---|---|
| ביתר | מתאוסיניו | מתאוזיניו | [[2021,2021]] | [[2021,2021]] |
| הפועל ב"ש | איברהים עבדול ראזאק | איברהים ראזק | [[2012,2012]] | [[2011,2011]] |
| הפועל ת"א | מרקו יאנקוביץ' | מרקו ינקוביץ | [[2023,2023]] | [[2022,2022]] |
| מכבי ת"א | אדוארדו מרקש | אדוארדו מרקוש | [[2006,2006]] | [[2005,2005]] |

הפרש של עונה אחת כאן נובע משנה בודדת בטבלת הקריירה בוויקיפדיה ("2022" = חצי עונה), לא בהכרח טעות במאגר. כדאי להוסיף את האיות של ויקיפדיה כ-alias.

## ב. שדות חסרים (מטרה 1+3)

599 שורות: 242 unconfirmed + 8 conflict מסבב 1, ועוד 349 שדות שבסבב 1 לא היה להם אף מקור.

| מועדון | מאומת עכשיו | עדיין מקור יחיד | סתירה | בלי מקור |
|---|---|---|---|---|
| ביתר | 0 | 15 | 0 | 19 |
| הפועל ב"ש | 7 | 88 | 3 | 94 |
| הפועל ת"א | 11 | 56 | 2 | 66 |
| מכבי חיפה | 9 | 45 | 1 | 71 |
| מכבי ת"א | 7 | 49 | 1 | 55 |

- born: conflict → conflict: 1
- born: conflict → verified-majority: 1
- born: no-source → no-source: 89
- born: no-source → unconfirmed: 2
- born: unconfirmed → unconfirmed: 148
- born: unconfirmed → verified: 16
- nat: no-source → no-source: 6
- nat: no-source → unconfirmed: 21
- nat: no-source → verified: 4
- nat: unconfirmed → unconfirmed: 5
- nat: unconfirmed → verified: 2
- pos: conflict → conflict: 5
- pos: conflict → unconfirmed: 1
- pos: no-source → no-source: 210
- pos: no-source → unconfirmed: 8
- pos: no-source → verified: 9
- pos: unconfirmed → conflict: 1
- pos: unconfirmed → unconfirmed: 68
- pos: unconfirmed → verified: 2

### סתירות שנותרו

- הפועל ב"ש · ולדימיר אנדונוב · pos: Transfermarkt=FW, worldfootball=MF
- הפועל ב"ש · גיימס ביסו · pos: Transfermarkt=MF, worldfootball=FW
- הפועל ב"ש · רועי אזוט · pos: Transfermarkt=FW, worldfootball=MF
- מכבי ת"א · גויאגון פארפה · pos: Transfermarkt=FW, worldfootball=MF
- מכבי חיפה · אלעד צחקו · pos: worldfootball=MF, Transfermarkt=DF
- הפועל ת"א · אבי קנפו · pos: worldfootball=FW, RSSSF=MF
- הפועל ת"א · איבה אוגובונה · born: Transfermarkt=1983, worldfootball=1986

## ג. שחקנים שאינם במאגר (מטרה 2)

ההערה ב-enrich.mjs מדברת על 565 — זה מספר ישן. בדיקה מול data/clubs/*.json (שם מנורמל + aliases) מוצאת היום 117 כותרות עם טבלת קריירה שאינן במאגר, מתוכן 4 כפילויות איות (למעלה). רובן (97) עם שנה בודדת דו-משמעית בטבלה — בעיקר זרים לעונה אחת.

| מועדון | שחקנים | כל 4 השדות מאומתים | שנה+עמדה+עונות מאומתים |
|---|---|---|---|
| ביתר | 22 | 7 | 9 |
| הפועל ב"ש | 16 | 7 | 8 |
| הפועל ת"א | 33 | 6 | 12 |
| מכבי חיפה | 12 | 4 | 7 |
| מכבי ת"א | 30 | 9 | 12 |

- born: missing: 1
- born: unconfirmed: 54
- born: verified: 58
- nat: conflict: 2
- nat: missing: 8
- nat: unconfirmed: 61
- nat: verified: 42
- pos: conflict: 6
- pos: missing: 7
- pos: unconfirmed: 48
- pos: verified: 47
- pos: verified-majority: 5
- spells: conflict: 2
- spells: unconfirmed: 53
- spells: verified: 42
- spells: verified-shifted: 16

`verified-shifted` = ויקיפדיה רושמת שנה בודדת (דו-משמעית), ודף הסגל של TM/worldfootball שם את השחקן עונה אחת קודם; הערך שנשמר הוא של הסגל.

### הוותיקים (5+ עונות) — הכי חשובים לאוהדים

| מועדון | שחקן | לידה | עמדה | לאום | עונות | סטטוס (לידה/עמדה/לאום/עונות) |
|---|---|---|---|---|---|---|
| מכבי ת"א | שלום שלומזון | 1919 | DF | RO | 1936–1954 | unconfirmed / unconfirmed / unconfirmed / unconfirmed |
| הפועל ת"א | יעקב חודורוב | 1927 | GK | IL | 1947–1962 | verified / verified / verified / unconfirmed |
| מכבי ת"א | ג'רי בית הלוי | 1912 | FW | PL | 1928, 1931–1945 | unconfirmed / conflict / unconfirmed / unconfirmed |
| מכבי חיפה | יוסי קרמר | 1957 | DF | IL | 1974–1985, 1988–1990 | verified / verified / verified / conflict |
| הפועל ב"ש | ג'קי דקל | ? | DF | ? | 1960–1973 | missing / unconfirmed / missing / unconfirmed |
| הפועל ת"א | שלמה פוליאקוב | 1912 | FW | ? | 1928–1941 | unconfirmed / unconfirmed / missing / unconfirmed |
| ביתר | יוסי אמינוף | 1940 | FW | IL | 1958–1967, 1971–1973 | unconfirmed / unconfirmed / unconfirmed / unconfirmed |
| ביתר | צביקה זוכוביצקי | 1936 | ? | IL | 1957–1966 | unconfirmed / missing / unconfirmed / unconfirmed |
| מכבי חיפה | משה אדלר | 1947 | FW | IL | 1969–1977, 1980 | unconfirmed / unconfirmed / unconfirmed / unconfirmed |
| הפועל ב"ש | יוסי שושני | 1963 | MF | IL | 1981–1989 | verified / verified / verified / conflict |
| הפועל ת"א | דני בורסוק | 1944 | MF | IL | 1962–1969 | verified / unconfirmed / verified / unconfirmed |
| הפועל ת"א | וילי ברגר | 1906 | GK | IL | 1928, 1931–1937 | verified / verified / verified / unconfirmed |
| מכבי ת"א | מנחם מרימוביץ' | 1916 | ? | CY | 1932–1938, 1940 | unconfirmed / missing / unconfirmed / unconfirmed |
| מכבי חיפה | שמעון שנהר | 1942 | ? | IL | 1962–1968 | unconfirmed / missing / unconfirmed / unconfirmed |
| ביתר | ראול גלר | 1936 | FW | PE | 1966–1970, 1972 | unconfirmed / unconfirmed / unconfirmed / unconfirmed |
| מכבי ת"א | צבי פוקס | 1917 | MF | PL | 1937–1942 | unconfirmed / unconfirmed / unconfirmed / unconfirmed |
| מכבי ת"א | שמואל מליקה | 1947 | GK | IL | 1964–1965, 1973–1975 | unconfirmed / unconfirmed / unconfirmed / unconfirmed |

## ד. מקורות — מה עבד ומה נחסם

- **ויקיפדיה עברית/אנגלית (API)** — עובד, אבל מחזיר 429 בקצב גבוה; POST ב-50 כותרות + השהיה 1.5 ש' + backoff. 2,068 ערכים עבריים במטמון (tools/research/r2-wiki-cache.json).
- **national-football-teams.com** — עובד (fetch רגיל). סגלי נבחרת ישראל 1934–2012 עם תאריך לידה, עמדה ומועדון לכל שנה (r2-nft.json, 1,472 שורות). המקור הלא-ויקיפדי היחיד שנמצא לשחקני שנות ה-40–60. התאמה רק כשעמודת המועדון היא המועדון שלנו באותה שנה.
- **Transfermarkt** — נחסם (403 CloudFront) כמעט מיד: רק 30 פרופילים חדשים בכ-שעה, ונעצר. נשארו ~240 פרופילים של חברי סגל עם שם דומה, ממוינים לפי דמיון — `node tools/research/r2-tmfetch.mjs` ממשיך מאיפה שנעצר (live-cache.json). זה הצוואר: רוב 147 שנות הלידה שנשארו IFA-בלבד מחכות לפרופיל TM עם "Name in home country".
- **worldfootball.net** — 403 ב-fetch חי; השתמשנו רק במטמון הסגלים (data/raw/*-worldfootball.json, 1970+).
- **eu-football.info** — 404/ריק, לא שמיש.
- **IFA** — מטמון בלבד (data/raw/ifa-players.json); עונות בהתאחדות הן כל הקריירה, לא לפי מועדון — לא שימשו לעונות.
- **עונות בוויקיפדיה ("מכבי תל אביב בעונת 1985/86")** — לא מכילות שנות לידה, ולכן לא עזרו לפער שנשאר לפני 2002 (בעיקר שנות לידה של שחקני ביתר 94–99 כמו יהיב כרדי, מאיר סלמי, א. ואזנה).

## ה. הערות זהות

- כלל סבב 1 נשמר: התאמה לטינית בלבד (בלי IFA/שם עברי ב-TM/ערך ויקי) דורשת ציון שם ≥0.95. לכן פרוחננקובס, ז'וטאוטאס, פרליה נאנד וארוס פרננדו נשארו unconfirmed למרות 3 מקורות מסכימים — שלושת הראשונים כמעט בוודאות נכונים; "ארוס פרננדו" הותאם ל-Bruno Reis ונראה חשוד.
- התאמה "born-anchored": שם דומה (≥0.7) + אותה שנת לידה כמו ב-IFA + יחיד בסגלי המועדון בעונות שלו. ראה identity בכל שורה.
- "ערן לוי": יש כמה שחקנים בשם הזה; הערך בוויקיפדיה (לידה 2012 בתיבה = טעות בערך או ערך של אדם אחר) — לא לסמוך על השוואת העמדה שלו.
- שלמה ממן (ביתר) ב-TM הוא "שלומי ממן" — אותו אדם לפי שנת לידה, הכינוי שונה.
