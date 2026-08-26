/* עטיפה ל-Playwright.
   למה דפדפן אמיתי ולא fetch מהשרת: worldfootball וההתאחדות מחזירים 403
   ל-User-Agent של סקריפט. מתוך דפדפן אמיתי אין חסימה.
   הפרופיל נשמר ב-.cache כדי שלא נתחיל כל הרצה מאפס. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { log, warn, sleep } from "./util.mjs";

const CHALLENGE = /just a moment|attention required|checking your browser|verify you are human/i;

export async function openBrowser({ profile = "default", headless = false, locale = "en-US" } = {}) {
  const dir = `.cache/profile-${profile}`;
  mkdirSync(dir, { recursive: true });

  /* channel:"chrome" משתמש בכרום המותקן. ה-headless-shell של Playwright
     נחסם מיד, ובכרום אמיתי הדף נטען כרגיל. */
  const ctx = await chromium.launchPersistentContext(dir, {
    headless,
    channel: headless ? undefined : "chrome",
    locale,
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"]
  }).catch(async err => {
    warn(`כרום לא נמצא (${err.message.split("\n")[0]}) — נופלים ל-chromium של Playwright`);
    return chromium.launchPersistentContext(dir, { headless, locale, viewport: { width: 1280, height: 900 } });
  });

  const page = ctx.pages()[0] || await ctx.newPage();
  return { ctx, page, close: () => ctx.close() };
}

/* ניווט שמחכה שהאתגר ייפתר מעצמו. מחזיר true אם הדף נטען באמת. */
export async function gotoStable(page, url, { waitChallenge = 25, settle = 0 } = {}) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  } catch (e) {
    warn(`ניווט נכשל: ${url} — ${e.message.split("\n")[0]}`);
    return false;
  }
  for (let i = 0; i < waitChallenge; i++) {
    if (!CHALLENGE.test(await page.title().catch(() => ""))) {
      if (settle) await sleep(settle);
      return true;
    }
    await sleep(1000);
  }
  return false;
}

/* ריצה עם נסיגה מדורגת. עוצר נקי אחרי רצף כשלונות במקום להמשיך לדפוק על הדלת. */
export function makeThrottle({ base = 700, maxStreak = 6 } = {}) {
  let streak = 0, wait = base;
  return {
    ok() { streak = 0; wait = base; },
    async fail() {
      streak++; wait = Math.min(wait * 2, 60000);
      if (streak >= maxStreak) return false;
      warn(`נחסמנו — ממתינים ${Math.round(wait / 1000)} שניות (${streak}/${maxStreak})`);
      await sleep(wait);
      return true;
    },
    async pace() { await sleep(base); },
    get streak() { return streak; }
  };
}

export { CHALLENGE };
