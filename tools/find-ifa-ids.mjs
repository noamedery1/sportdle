/* מוצא את team_id של הקבוצות הבוגרות באתר ההתאחדות.
   חשוב: לנוער, לנערים ולילדים יש מזהים נפרדים — לוקחים רק בוגרת. */
import { openBrowser, gotoStable } from "../scripts/lib/browser.mjs";
import { log } from "../scripts/lib/util.mjs";

const br = await openBrowser({ profile: "ifa", locale: "he-IL" });
const { page } = br;

const pages = [
  "https://www.football.org.il/leagues/league/?league_id=40&season_id=27",
  "https://www.football.org.il/leagues/",
];

for (const u of pages) {
  const ok = await gotoStable(page, u, { waitChallenge: 20, settle: 2500 });
  const d = await page.evaluate(() => ({
    title: document.title,
    teamLinks: [...new Set([...document.querySelectorAll('a[href*="team_id="]')]
      .map(a => `${a.textContent.replace(/\s+/g, " ").trim()} :: ${a.getAttribute("href")}`))].slice(0, 60),
    leagueLinks: [...new Set([...document.querySelectorAll('a[href*="league_id="]')]
      .map(a => `${a.textContent.replace(/\s+/g, " ").trim()} :: ${a.getAttribute("href")}`))].slice(0, 30)
  }));
  log(u, ok ? "ok" : "CHALLENGED");
  console.log(JSON.stringify(d, null, 1).slice(0, 4000));
}

await br.close();
