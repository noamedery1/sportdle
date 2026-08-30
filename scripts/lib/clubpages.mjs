/* עמוד ייעודי לכל מועדון.

   קישור ששותף בוואטסאפ מציג כרטיס: תמונה, כותרת, תיאור. עד היום
   כל חמשת המועדונים חלקו כרטיס גנרי אחד, וקישור ל"מכביdle" נראה
   בדיוק כמו כל קישור אחר. עכשיו לכל אחד עמוד תחת /<slug>/ עם
   og:image בצבעיו — וזה גם מה שנותן לגוגל חמישה דפים לאנדקס
   במקום אחד.

   הדף זהה למשחק לכל דבר. שלושה הבדלים בלבד:
     1. תגיות ה-head — כותרת, תיאור, og
     2. נתיבי הנכסים עולים תיקייה אחת (../favicon.ico)
     3. משתנה window.SPORTDLE_CLUB אומר למנוע באיזה מועדון להיפתח

   הקובץ הזה נפרד מ-build.mjs כי הוא ספוג ביטויים רגולריים עם
   לוכסנים, וכתיבתם דרך סקריפט תיקון שברה אותם פעם אחר פעם. */
import { writeText } from "./util.mjs";

export function writeClubPages({ html, data, order, siteUrl }) {
  const base = String(siteUrl).replace(/\/$/, "");
  for (const slug of order) {
    const c = data[slug];
    if (!c) continue;
    const title = `${c.game} · חידת השחקן היומית של ${c.he}`;
    const desc = `${c.he}: שחקן אחד מסתורי בכל יום, שמונה ניסיונות. ` +
                 `עמדה, לאום, עונה ראשונה, תארים ושנת לידה.`;

    const page = html
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(/(<meta name="description"\s+content=")[^"]*/, `$1${desc}`)
      .replace(/(<meta property="og:title"\s+content=")[^"]*/, `$1${title}`)
      .replace(/(<meta property="og:description"\s+content=")[^"]*/, `$1${desc}`)
      .replace(/(<meta property="og:url"\s+content=")[^"]*/, `$1${base}/${slug}/`)
      .replace(/(<meta property="og:image"\s+content=")[^"]*/, `$1${base}/og-${slug}.png`)
      .replace(/(<meta name="theme-color" content=")[^"]*/, `$1${c.colors.ink}`)
      .replace(/(href|content)="(favicon\.ico|icon-\d+\.png|manifest\.json|og\.png)"/g,
               '$1="../$2"')
      /* לפני הסקריפט הראשון, כדי שהמנוע יראה את המשתנה */
      .replace("<script>", `<script>window.SPORTDLE_CLUB=${JSON.stringify(slug)};</script>\n<script>`);

    writeText(`dist/${slug}/index.html`, page);
  }
  return order.length;
}
