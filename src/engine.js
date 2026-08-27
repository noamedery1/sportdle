/* ============================================================
   1. הגדרות — נכתבות על ידי scripts/build.mjs
   ============================================================ */
const SITE_URL      = "__SITE_URL__";   // בלי / בסוף
const START         = __START__;        // [שנה, חודש 1-12, יום] של חידה #1
const MAX           = __MAX__;
const BUILD         = "__BUILD__";
/* סט האמוג'ים לשיתוף.
   "safe"   — עיגולים גיאומטריים (יוניקוד 1.1, 1993). שני בתים,
              קיימים בכל פונט. מלא=מדויק, חצי=קרוב, ריק=רחוק.
   "square" — ריבועים צבעוניים (יוניקוד 12, 2019). יפים יותר, אבל
              נשברים בווינדוס ישן ובאנדרואיד עתיק. */
const SHARE_STYLE   = "__SHARE_STYLE__";
/* כתובת ה-Web App מ-Apps Script. השאר ריק כדי לכבות איסוף לגמרי.
   אותו endpoint משרת שלושה דברים: סטטיסטיקה, טופס תיקון השחקן,
   ופידבק חופשי שיוצא ממנו כמייל. */
const ANALYTICS_URL = "__ANALYTICS_URL__";
/* לאן פידבק חופשי מגיע כשה-endpoint לא מוגדר או נפל */
const CONTACT_MAIL  = "techbynoam@gmail.com";

/* ============================================================
   2. המועדונים — כל המאגרים מוטמעים בקובץ.
      אין תלות בקבצים חיצוניים. הקובץ עומד בפני עצמו.
   ============================================================ */
const CLUBS      = __CLUBS__;
const CLUB_ORDER = __CLUB_ORDER__;

/* ============================================================
   3. טבלאות תרגום
   ============================================================ */
const POS_HE = {GK:"שוער", DF:"מגן", MF:"קשר", FW:"חלוץ"};
const POS_ORDER = ["GK","DF","MF","FW"];
const NAT_HE = __NAT_HE__;
const REGION = __REGION__;

/* ============================================================
   4. עזרים
   ============================================================ */
const $ = s => document.querySelector(s);
const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} }
};

/* כל מועדון הוא עולם נפרד — מפתחות, רצף, סטטיסטיקה, ארכיון.
   תבנית המפתח: sportdel:<slug>:<key> */
const GKEY = k => `sportdel:${k}`;
const K    = k => `sportdel:${club.slug}:${k}`;

/* ערבוב דטרמיניסטי — אותו seed, אותו סדר, בכל מכשיר */
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a>>>15, 1 | a);
    t = t + Math.imul(t ^ t>>>7, 61 | t) ^ t;
    return ((t ^ t>>>14) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, seed){
  const rnd = mulberry32(seed), a = [...arr];
  for (let i=a.length-1; i>0; i--){
    const j = Math.floor(rnd()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

/* מספר החידה של היום — לפי תאריך מקומי */
function dayIndex(){
  const s = Date.UTC(START[0], START[1]-1, START[2]);
  const n = new Date();
  const today = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.max(0, Math.floor((today - s)/86400000));
}

/* תואר בשנה t נספר אם השחקן היה בסגל באותה עונה */
function countTitles(spells){
  return [...club.titles.league, ...club.titles.cup]
    .filter(y => spells.some(([a,b]) => y >= a && y <= b)).length;
}
function normalize(p){
  const spells = p.spells;
  return {
    name: p.he || p.name,
    pos:  p.pos,
    nat:  p.nat,
    spells,
    aliases: p.aliases || [],
    born: p.born || null,
    target: p.target !== false,
    titles: typeof p.titles === "number" ? p.titles : countTitles(spells),
    from: Math.min(...spells.map(s=>s[0])),
    to:   Math.max(...spells.map(s=>s[1]))
  };
}
/* המאגר שומר שנת סיום עונה. שחקן שנרשם כ-2014 שיחק בעונת 2013/14 —
   בין אם הגיע בקיץ 2013 ובין אם בחלון החורף של 2014.
   לכן מציגים עונה ולא שנה: זה נכון בשני המקרים. */
const season  = y => `${String(y-1).slice(-2)}/${String(y).slice(-2)}`;
const eraLabel = p => p.spells.map(([a,b]) =>
  a === b ? season(a) : season(a)+"–"+season(b)).join(" / ");

/* נרמול לחיפוש: מקף ← רווח, בלי גרשיים, רווחים מכווצים. בשני הצדדים. */
const norm = t => t.replace(/[-־–—]/g, " ").replace(/['"״׳’]/g, "").replace(/\s+/g, " ").trim();

/* ============================================================
   5. מצב המשחק
   ============================================================ */
let club = null;
let PLAYERS = [], POOL = [], answer = null;
let todayNo = 1, puzzleNo = 1;          // puzzleNo = החידה המשוחקת כרגע
let practice = false, guesses = [], over = false, hinted = false;
const isToday = () => !practice && puzzleNo === todayNo;
const board = $("#board"), input = $("#guess"), sugg = $("#sugg");

function compare(g, a){
  const out = [];

  const gi = POS_ORDER.indexOf(g.pos), ai = POS_ORDER.indexOf(a.pos);
  /* שחקן בלי עמדה ניתן לניחוש אבל לא יכול להיות תשובה. בלי
     ה-"?" בסוף התא היה מציג את המחרוזת "null". */
  out.push({k:"עמדה", v:POS_HE[g.pos]||g.pos||"?",
            s: g.pos && g.pos===a.pos ? "hit" : (g.pos && Math.abs(gi-ai)===1 ? "near" : "miss")});

  out.push({k:"לאום", v:NAT_HE[g.nat]||g.nat||"?",
            s: g.nat===a.nat ? "hit" : (REGION[g.nat]&&REGION[g.nat]===REGION[a.nat] ? "near" : "miss")});

  const gd = a.from - g.from;
  out.push({k:"עונה 1", v:season(g.from), ar: gd===0 ? "" : (gd>0?"↑":"↓"),
            s: gd===0 ? "hit" : (Math.abs(gd)<=3 ? "near" : "miss")});

  const d = a.titles - g.titles;
  out.push({k:"תארים", v:g.titles, ar: d===0 ? "" : (d>0?"↑":"↓"),
            s: d===0 ? "hit" : (Math.abs(d)<=1 ? "near" : "miss")});

  if (a.born && g.born){
    const b = a.born - g.born;
    out.push({k:"נולד", v:g.born, ar: b===0 ? "" : (b>0?"↑":"↓"),
              s: b===0 ? "hit" : (Math.abs(b)<=3 ? "near" : "miss")});
  } else {
    out.push({k:"נולד", v:g.born || "?", s:"miss"});
  }

  return out;
}

function saveState(){
  if (practice) return;
  store.set(K("p"+puzzleNo), JSON.stringify({ g: guesses.map(x => x.name), over, h: hinted }));
}

function render(g, instant){
  const cells = compare(g, answer);
  const row = document.createElement("div");
  row.className = "row";
  if (instant) row.style.cssText = "animation:none";
  row.innerHTML =
    `<p class="who">${g.name}<i>ניחוש ${guesses.length}</i></p><div class="tiles">` +
    cells.map((c,i)=>
      `<div class="tile ${c.s}" style="${instant?"animation:none;opacity:1;transform:none":`animation-delay:${i*90}ms`}">
         <span class="k">${c.k}</span>
         <span class="v">${c.v}${c.ar?` <span class="ar">${c.ar}</span>`:""}</span>
       </div>`).join("") + `</div>`;
  board.appendChild(row);
  $("#left").textContent = MAX - guesses.length;
}

const askText = () => `הקלידו שם של שחקן ${club.short}…`;
function flash(msg){
  input.value = ""; input.placeholder = msg;
  setTimeout(()=> input.placeholder = askText(), 1800);
}

function submit(name){
  if (over) return;
  const p = PLAYERS.find(x => x.name === name);
  if (!p) return;
  if (guesses.some(x => x.name === name)) { flash("כבר ניחשתם את השחקן הזה"); return; }
  guesses.push(p); render(p);
  input.value = ""; closeSugg();
  if (p.name === answer.name) finish(true);
  else if (guesses.length >= MAX) finish(false);
  else { saveState(); maybeHint(); }
}

/* ---------- רצף ---------- */
function loadStreak(){
  try{ return JSON.parse(store.get(K("streak"))) || {last:null,n:0}; }
  catch(e){ return {last:null,n:0}; }
}
function bumpStreak(won){
  let st = loadStreak();
  if (st.last === puzzleNo) return st.n;          // כבר נספר היום
  st.n = won ? (st.last === puzzleNo-1 ? st.n+1 : 1) : 0;
  st.last = puzzleNo;
  store.set(K("streak"), JSON.stringify(st));
  return st.n;
}
function showStreak(){
  const st = loadStreak();
  const live = st.n > 0 && (st.last === puzzleNo || st.last === puzzleNo-1);
  $("#streakn").textContent = st.n;
  $("#streak").classList.toggle("on", live);
}

/* ---------- ספירה לאחור ---------- */
function tickCountdown(){
  const n = new Date();
  const mid = new Date(n.getFullYear(), n.getMonth(), n.getDate()+1, 0,0,0);
  let s = Math.max(0, Math.floor((mid - n)/1000));
  const h = String(Math.floor(s/3600)).padStart(2,"0");
  const m = String(Math.floor(s%3600/60)).padStart(2,"0");
  const ss= String(s%60).padStart(2,"0");
  const el = $("#cd"); if (el) el.textContent = `${h}:${m}:${ss}`;
}
setInterval(tickCountdown, 1000);

function finish(won){
  over = true; input.disabled = true;
  $("#rtitle").textContent = won ? "פיצחתם!" : "נגמרו הניסיונות";
  $("#rtext").innerHTML = won
    ? `<b>${answer.name}</b> · <span dir="ltr">${eraLabel(answer)}</span> · ${guesses.length} מתוך ${MAX}`
    : `השחקן היה <b>${answer.name}</b> · <span dir="ltr">${eraLabel(answer)}</span> · ${answer.titles} תארים`;

  const mini = $("#mini"); mini.innerHTML = "";
  guesses.forEach(g=>{
    const r = document.createElement("div"); r.className = "r";
    compare(g, answer).forEach(c=>{
      const i = document.createElement("i"); i.className = c.s; r.appendChild(i);
    });
    mini.appendChild(r);
  });

  $("#hintRow").classList.remove("on");
  if (isToday()){
    saveState();
    bumpStreak(won); showStreak();
    addStat(won, guesses.length);
    renderStats(won ? guesses.length : 0);
    track("done", {guesses: guesses.length, won, hint: hinted});
    // המתנה קצרה כדי שהדיווח שלנו כבר ייספר
    if (ANALYTICS_URL) setTimeout(() => {
      const n = guesses.length, w = won;
      fetchStats(puzzleNo).then(r => renderComm(r && r.stats, n, w));
    }, 1200);
    $("#next").style.display = "";
  } else {
    if (!practice) saveState();
    $("#next").style.display = practice ? "none" : "";
    $("#stats").innerHTML = "";
    $("#comm").classList.remove("on");
  }
  tickCountdown();
  $("#share").style.display = practice ? "none" : "";
  $("#wa").style.display = practice ? "none" : "";
  $("#result").classList.add("on");
  $("#result").scrollIntoView({behavior:"smooth", block:"nearest"});
}

/* ---------- שיתוף — עם קישור ----------
   רק תווים מהמישור הבסיסי של יוניקוד. אמוג'י צבעוני הוא ארבעה
   בתים ונשבר בוואטסאפ ווב בווינדוס — נבדק בשטח ונכשל. */
const EMOJI = {
  safe:   {hit:"●", near:"◐", miss:"○"},   // מלא / חצי / ריק
  square: {hit:"🟨", near:"🟫", miss:"⬛"}
};
/* שורת הסמלים היא כולה תווים ניטרליים — אין בה אף תו חזק, ולכן
   הכיוון שלה נקבע לפי הלקוח. בוואטסאפ ווב בהקשר LTR היא מתהפכת,
   והרמז הימני ביותר על המסך מופיע שמאלי בשיתוף.
   בידוד RTL מפורש (U+2067…U+2069) מקבע את הכיוון — נמדד ואומת
   בשני ההקשרים. שני התווים במישור הבסיסי, אז בדיקת הבנייה עוברת. */
const RLI = "⁧", PDI = "⁩";

function shareText(){
  const M = EMOJI[SHARE_STYLE] || EMOJI.safe;
  const grid = guesses.map(g => RLI + compare(g,answer).map(c=>M[c.s]).join("") + PDI).join("\n");
  const won = guesses[guesses.length-1].name === answer.name;
  const hs = hinted ? " (עם רמז)" : "";
  /* חייבת להיות מילה עברית בין שם המשחק למספר החידה.
     "ביתרdle #3" מתרנדר לפי כללי bidi כ-ביתר → #3 → dle: המספר
     נכנס לאמצע השם ושובר אותו. המילה "חידה" מחזירה הקשר RTL
     ומחזירה את הסדר. נבדק מול מדידת מיקום בפועל. */
  const head = won
    ? `${club.game} · חידה #${puzzleNo} · פיצחתי ב-${guesses.length} ${guesses.length===1?"ניחוש":"ניחושים"} מתוך ${MAX}${hs}`
    : `${club.game} · חידה #${puzzleNo} · לא פיצחתי (${MAX}/${MAX})${hs}`;
  const key = `${M.hit} מדויק  ${M.near} קרוב  ${M.miss} רחוק`;
  return `${head}\n\n${grid}\n\n${key}\n${SITE_URL}`;
}
async function copyText(txt){
  // הדרך המודרנית — דורשת HTTPS
  try{
    if (navigator.clipboard && window.isSecureContext){
      await navigator.clipboard.writeText(txt);
      return true;
    }
  }catch(e){}
  // גיבוי לדפדפנים ישנים
  try{
    const ta = document.createElement("textarea");
    ta.value = txt;
    ta.setAttribute("readonly","");
    ta.style.cssText = "position:fixed;top:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }catch(e){ return false; }
}

$("#share").addEventListener("click", async ()=>{
  const btn = $("#share");
  const ok = await copyText(shareText());
  btn.textContent = ok ? "הועתק ✓" : "לא הצלחנו להעתיק — סמנו ידנית";
  setTimeout(()=> btn.textContent = "העתקת התוצאה", 2200);
});

$("#wa").addEventListener("click", ()=>{
  window.open("https://wa.me/?text=" + encodeURIComponent(shareText()), "_blank", "noopener");
});

$("#again").addEventListener("click", ()=>{
  practice = true; over = false; guesses = []; hinted = false;
  $("#share").style.display = "none";
  $("#yday").classList.remove("on");
  $("#hintRow").classList.remove("on"); $("#hintOut").textContent = "";
  $("#hintBtn").style.display = "";
  answer = POOL[Math.floor(Math.random()*POOL.length)];
  board.innerHTML = ""; $("#result").classList.remove("on");
  input.disabled = false; input.value = ""; $("#left").textContent = MAX;
  $("#pnum").textContent = "אימון";
  $("#wa").style.display = "none";
  input.focus();
});

/* ---------- השלמה אוטומטית ---------- */
let selIdx = -1;
function openSugg(list){
  sugg.innerHTML = list.map(p => `<button type="button" data-name="${p.name}" role="option">${p.name}</button>`).join("");
  sugg.classList.add("on"); selIdx = -1;
}
function closeSugg(){ sugg.classList.remove("on"); sugg.innerHTML = ""; selIdx = -1; }

input.addEventListener("input", ()=>{
  const q = input.value.trim();
  if (!q) return closeSugg();
  const nq = norm(q);
  /* מחפשים גם בשמות הרשמיים המלאים — "עדן מנחם יונה" נמצא
     גם כשמקלידים "עדן יונה" */
  const hits = PLAYERS.filter(p =>
      (norm(p.name).includes(nq) || p.aliases.some(a => norm(a).includes(nq)))
      && !guesses.some(g=>g.name===p.name)).slice(0,7);
  hits.length ? openSugg(hits) : closeSugg();
});
sugg.addEventListener("click", e=>{
  const b = e.target.closest("button"); if (b) submit(b.dataset.name);
});
input.addEventListener("keydown", e=>{
  const opts = [...sugg.querySelectorAll("button")];
  if (e.key === "ArrowDown" || e.key === "ArrowUp"){
    if (!opts.length) return;
    e.preventDefault();
    selIdx = e.key === "ArrowDown" ? (selIdx+1)%opts.length : (selIdx-1+opts.length)%opts.length;
    opts.forEach((o,i)=> o.classList.toggle("sel", i===selIdx));
    opts[selIdx].scrollIntoView({block:"nearest"});
  } else if (e.key === "Enter"){
    e.preventDefault();
    if (selIdx >= 0 && opts[selIdx]) submit(opts[selIdx].dataset.name);
    else if (opts.length) submit(opts[0].dataset.name);
  } else if (e.key === "Escape") closeSugg();
});
document.addEventListener("click", e=>{ if (!e.target.closest(".searchbox")) closeSugg(); });

/* במובייל המקלדת מסתירה את ההצעות — מגלגלים את השדה למעלה */
input.addEventListener("focus", ()=>{
  setTimeout(()=> document.querySelector(".searchbox")
    .scrollIntoView({behavior:"smooth", block:"start"}), 320);
});

/* ---------- טעינת חידה ---------- */
function answerFor(n){ return POOL[(n - 1) % POOL.length]; }

function loadPuzzle(n){
  practice = false; puzzleNo = n; answer = answerFor(n);
  guesses = []; over = false; hinted = false;
  board.innerHTML = "";
  $("#result").classList.remove("on");
  $("#hintOut").textContent = ""; $("#hintRow").classList.remove("on");
  $("#hintBtn").style.display = "";
  input.disabled = false; input.value = "";
  $("#left").textContent = MAX;
  $("#pnum").textContent = "#" + n + (n === todayNo ? "" : " · ארכיון");
  $("#yday").classList.toggle("on", n === todayNo && todayNo > 1);
  restore();
  showStreak();          // עכשיו puzzleNo נכון, אז התג באמת מופיע
  scrollTo({top:0, behavior:"smooth"});
}

/* ---------- דיווח אנונימי: מועדון, מספר חידה ותוצאה בלבד ---------- */
function track(type, extra){
  if (!ANALYTICS_URL || practice) return;
  try{
    const body = JSON.stringify({ type, club: club.slug, puzzle: puzzleNo, ...extra });
    if (navigator.sendBeacon) navigator.sendBeacon(ANALYTICS_URL, body);
    else fetch(ANALYTICS_URL, {method:"POST", mode:"no-cors", body});
  }catch(e){}
}

/* ---------- רמז ---------- */
function decadeHe(y){
  const d = Math.floor(y / 10) * 10;
  if (d >= 2000) return `שנות ה-${d}`;      // שנות ה-2010
  return `שנות ה-${String(d).slice(-2)}`;   // שנות ה-80
}
function hintText(){
  return `השם מתחיל באות ${answer.name.trim()[0]} · הגיע ב${decadeHe(answer.from - 1)}`;
}
function maybeHint(){
  $("#hintRow").classList.toggle("on", !over && guesses.length >= 5);
}
$("#hintBtn").addEventListener("click", ()=>{
  hinted = true;
  $("#hintOut").textContent = hintText();
  $("#hintBtn").style.display = "none";
  saveState();
});

/* ---------- סטטיסטיקה קהילתית ---------- */
const MIN_PLAYERS = 20;      // מתחת לזה לא מציגים — מדגם קטן נראה עלוב

function fetchStats(puzzle){
  // GET רגיל, ואם CORS חוסם — נפילה ל-JSONP
  const q = `puzzle=${puzzle}&club=${encodeURIComponent(club.slug)}`;
  return fetch(`${ANALYTICS_URL}?${q}`)
    .then(r => r.json())
    .catch(() => new Promise(res => {
      const cb = "__bs" + Date.now();
      const t  = setTimeout(() => { cleanup(); res(null); }, 6000);
      const sc = document.createElement("script");
      function cleanup(){ clearTimeout(t); delete window[cb]; sc.remove(); }
      window[cb] = d => { cleanup(); res(d); };
      sc.src = `${ANALYTICS_URL}?${q}&callback=${cb}`;
      sc.onerror = () => { cleanup(); res(null); };
      document.body.appendChild(sc);
    }))
    .catch(() => null);
}

function renderComm(st, myGuesses, iWon){
  const el = $("#comm");
  if (!st || st.done < MIN_PLAYERS){ el.classList.remove("on"); return; }

  /* בלי המספר המוחלט של השחקנים — רק יחסים.
     מספר קטן נראה עלוב גם כשהוא נכון, וברגע שהכותרת מסתירה אותו
     גם הגרף חייב: בר שכתוב עליו "2" מדליף בדיוק את מה שהוסתר.
     MIN_PLAYERS עדיין חוסם את כל הבלוק מתחת למדגם סביר. */
  const pct = Math.round(st.wins / st.done * 100);
  let html = `<div class="hd"><b>${pct}%</b> פיצחו היום${
    st.avg ? ` · ממוצע <b>${st.avg}</b> ניחושים` : ""}</div>`;

  // כמה סיימו גרוע ממני: יותר ניחושים, או לא פיצחו בכלל
  if (iWon){
    let worse = st.fail;
    for (let i = myGuesses; i < MAX; i++) worse += st.dist[i] || 0;
    const better = Math.round(worse / st.done * 100);
    if (better >= 5)
      html += `<div class="rank">פיצחת ב-${myGuesses} — טוב יותר מ-${better}% מהשחקנים היום</div>`;
  }

  /* חידות מלפני שהשרת התחיל לשמור פילוח מחזירות שורת מצרפים
     נכונה ודליים ריקים. גרף של אפסים נראה שבור, אז מדלגים עליו
     ומשאירים את הכותרת — שהיא נכונה בכל מקרה. */
  const total = (st.dist || []).reduce((a, b) => a + (b || 0), 0) + (st.fail || 0);
  if (total > 0){
    const max   = Math.max(1, ...st.dist, st.fail);
    /* אחוז מהמסיימים. תווית ריקה כשאין אף אחד — "0%" בכל בר ריק
       הוא רעש, והרוחב לבד אומר את זה. */
    const label = v => v ? Math.round(v / total * 100) + "%" : "";
    for (let i = 1; i <= MAX; i++){
      const v = st.dist[i-1] || 0;
      html += `<div class="cb${iWon && i===myGuesses ? " me" : ""}"><i>${i}</i>
        <u style="width:${12 + v/max*72}%">${label(v)}</u></div>`;
    }
    if (st.fail)
      html += `<div class="cb${!iWon ? " me" : ""}"><i>✕</i>
        <u style="width:${12 + st.fail/max*72}%">${label(st.fail)}</u></div>`;
  }

  el.innerHTML = html;
  el.classList.add("on");
}

/* ---------- סטטיסטיקה אישית ---------- */
function loadStats(){
  try{ return JSON.parse(store.get(K("stats"))) || null; }catch(e){ return null; }
}
function addStat(won, n){
  const st = loadStats() || {played:0, wins:0, dist:{}, last:null, max:0};
  if (st.last === puzzleNo) return st;
  st.played++;
  if (won){ st.wins++; st.dist[n] = (st.dist[n]||0) + 1; }
  st.last = puzzleNo;
  const cur = loadStreak().n;
  st.max = Math.max(st.max || 0, cur);
  store.set(K("stats"), JSON.stringify(st));
  return st;
}
function renderStats(highlight){
  const st = loadStats();
  const el = $("#stats");
  if (!st || !st.played){ el.innerHTML = ""; return; }
  const pct = Math.round(st.wins / st.played * 100);
  const max = Math.max(1, ...Object.values(st.dist));
  let bars = "";
  for (let i = 1; i <= MAX; i++){
    const v = st.dist[i] || 0;
    const w = 12 + (v / max) * 78;
    bars += `<div class="b${highlight===i?" now":""}"><i>${i}</i>
      <span style="width:${w}%">${v}</span></div>`;
  }
  el.innerHTML =
    `<div class="nums">
       <div><b>${st.played}</b>שיחקת</div>
       <div><b>${pct}%</b>הצלחה</div>
       <div><b>${st.max||0}</b>רצף שיא</div>
     </div>
     <div class="bars">${bars}</div>`;
}

/* המקרא בחלונית מתיישר עם סט האמוג'ים שנבחר */
(() => {
  const M = EMOJI[SHARE_STYLE] || EMOJI.safe;
  const el = document.getElementById("lgnd");
  if (el) el.textContent = `${M.hit} מדויק · ${M.near} קרוב · ${M.miss} רחוק`;
})();

/* ---------- דיווח על טעות ---------- */
const rep = $("#rep");
function openRep(){
  closeHelp();
  $("#repStat").textContent = ""; $("#repStat").className = "";
  $("#repSend").textContent = "שליחה"; $("#repSend").disabled = false;
  rep.classList.add("on");
  setTimeout(()=> $("#repMsg").focus(), 60);
}
function closeRep(){ rep.classList.remove("on"); }
$("#closeRep").addEventListener("click", closeRep);
rep.addEventListener("click", e => { if (e.target === rep) closeRep(); });

$("#repSend").addEventListener("click", async ()=>{
 const st = $("#repStat"), btn = $("#repSend");
 try{
  const txt = $("#repMsg").value.trim();
  if (txt.length < 5){
    st.textContent = "כתבו קצת יותר כדי שאבין מה קרה."; st.className = "bad"; return;
  }
  /* בלי endpoint אין לאן לשלוח — פותחים את תוכנת הדואר עם הטקסט מוכן.
     כך פידבק תמיד מגיע לתיבה רגילה, גם כשהשרת מכובה. */
  if (!ANALYTICS_URL){
    const s = encodeURIComponent(`${club.game} — פידבק`);
    const b = encodeURIComponent(`${txt}\n\n—\nחידה ${puzzleNo}, מועדון ${club.slug}`);
    location.href = `mailto:${CONTACT_MAIL}?subject=${s}&body=${b}`;
    st.textContent = "נפתחת אצלכם תוכנת הדואר."; st.className = "ok"; return;
  }
  btn.disabled = true; btn.textContent = "שולח…";
  // המצב נדחס לתוך שדה החידה, כדי שלא יידרש שינוי בצד השרת
  const tag = practice              ? `${todayNo} · אימון`
            : puzzleNo === todayNo  ? `${puzzleNo} · יומית`
            :                         `${puzzleNo} · ארכיון`;
  const body = JSON.stringify({
    type: "feedback", club: club.slug, puzzle: `${club.game} ${tag}`,
    player: answer ? answer.name : "",
    text: txt, contact: $("#repFrom").value.trim()
  });
  try{
    let sent = false;
    try{ sent = !!(navigator.sendBeacon && navigator.sendBeacon(ANALYTICS_URL, body)); }catch(e){}
    if (!sent) await fetch(ANALYTICS_URL, {method:"POST", mode:"no-cors", body});
    st.textContent = "תודה, הדיווח נשלח."; st.className = "ok";
    $("#repMsg").value = ""; $("#repFrom").value = "";
    btn.textContent = "נשלח ✓";
    setTimeout(closeRep, 1400);
  }catch(e){
    st.textContent = `השליחה נכשלה. אפשר לכתוב ל-${CONTACT_MAIL}`;
    st.className = "bad"; btn.disabled = false; btn.textContent = "שליחה";
  }
 }catch(err){
  st.textContent = "שגיאה: " + (err && err.message ? err.message : err);
  st.className = "bad"; btn.disabled = false; btn.textContent = "שליחה";
 }
});

/* ============================================================
   תיקון פרטי שחקן — טופס שדות סגורים
   ------------------------------------------------------------
   מה שנשלח מכאן נכנס לצינור אוטומטי שכותב ל-config/names-<slug>.json
   ופותח PR. לכן אין כאן שדה טקסט חופשי, ואין כאן שום שדה מלבד שם
   ועמדה: כל מה שנכנס לצינור חייב להיות ניתן לאימות מול enum.

   הטופס נפתח רק מפאנל הסיום. לפני שהסיבוב נגמר, הצגת השחקן הייתה
   חושפת את התשובה.

   שלוש שכבות אימות: כאן (מיידי למשתמש), ב-Apps Script (לפני שנשמר),
   וב-tools/reports-apply.mjs (לפני שנכתב למאגר). רק השתיים
   האחרונות הן הגנה — הראשונה היא נימוס.
   ============================================================ */
const HE_NAME = /^[\u05D0-\u05EA][\u05D0-\u05EA \u05F3\u05F4'"\u2019\u05BE-]{0,38}[\u05D0-\u05EA]$/;

/* מזהה מדווח — מספר אקראי מקומי, לא זהות. תפקידו היחיד הוא לספור
   מדווחים נפרדים לאותה טעות. מי שינקה את האחסון יקבל מזהה חדש,
   וזה בסדר: זה מסנן כפילויות תמימות, לא תוקף נחוש. הערובה האמיתית
   היא שאף שינוי לא מתמזג בלי אישור ידני. */
function reporterId(){
  let id = store.get(GKEY("rid"));
  if (!id){
    id = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    store.set(GKEY("rid"), id);
  }
  return id;
}

const fixM = $("#fix");
function closeFix(){ fixM.classList.remove("on"); }
function fixField(){
  const he = $("#fixField").value === "he";
  $("#fixHeWrap").classList.toggle("hide", !he);
  $("#fixPosWrap").classList.toggle("hide", he);
}
function openFix(){
  if (!over || !answer) return;          // אין שחקן חשוף — אין מה לתקן
  closeRep(); closeHelp();
  $("#fixWho").textContent    = answer.name;
  $("#fixPosNow").textContent = POS_HE[answer.pos] || "עמדה לא ידועה";
  $("#fixName").value   = answer.name;
  $("#fixPosVal").value = POS_ORDER.includes(answer.pos) ? answer.pos : "MF";
  $("#fixField").value  = "he";
  fixField();
  $("#fixStat").textContent = ""; $("#fixStat").className = "";
  $("#fixSend").textContent = "שליחה"; $("#fixSend").disabled = false;
  fixM.classList.add("on");
}
$("#fixField").addEventListener("change", fixField);
$("#closeFix").addEventListener("click", closeFix);
fixM.addEventListener("click", e => { if (e.target === fixM) closeFix(); });
$("#fixLink").addEventListener("click", e => { e.preventDefault(); openFix(); });
$("#fixToRep").addEventListener("click", e => { e.preventDefault(); closeFix(); openRep(); });
$("#repToFix").addEventListener("click", e => { e.preventDefault(); closeRep(); openFix(); });

/* מה שהטופס מרשה לשלוח, ולמה. כל דחייה חוזרת למשתמש בעברית. */
function fixPayload(){
  const field = $("#fixField").value;
  if (field !== "he" && field !== "pos") return { err: "שדה לא מוכר." };

  if (field === "pos"){
    const proposed = $("#fixPosVal").value;
    if (!POS_ORDER.includes(proposed)) return { err: "עמדה לא מוכרת." };
    if (proposed === answer.pos)       return { err: "זו העמדה שכבר רשומה." };
    return { field, current: answer.pos || "", proposed };
  }

  const proposed = $("#fixName").value.replace(/\s+/g, " ").trim();
  if (!HE_NAME.test(proposed))  return { err: "השם צריך להיות בעברית, בין 2 ל-40 תווים." };
  if (proposed === answer.name) return { err: "זה השם שכבר רשום." };
  /* שם שתפוס בידי שחקן אחר יפיל את בדיקת הכפילות בבנייה. עוצרים כאן,
     כדי שהמדווח יקבל תשובה מובנת ולא ייעלם בצינור. */
  if (PLAYERS.some(p => p.name !== answer.name && norm(p.name) === norm(proposed)))
    return { err: "השם הזה שייך כבר לשחקן אחר במאגר." };
  return { field, current: answer.name, proposed };
}

$("#fixSend").addEventListener("click", async () => {
  const st = $("#fixStat"), btn = $("#fixSend");
  const p = fixPayload();
  if (p.err){ st.textContent = p.err; st.className = "bad"; return; }
  if (!ANALYTICS_URL){
    st.textContent = `השליחה לא מוגדרת. אפשר לכתוב ל-${CONTACT_MAIL}`;
    st.className = "bad"; return;
  }
  btn.disabled = true; btn.textContent = "שולח…";
  const body = JSON.stringify({
    type: "fix", club: club.slug, player: answer.name,
    field: p.field, current: p.current, proposed: p.proposed,
    rid: reporterId(), puzzle: practice ? 0 : puzzleNo
  });
  try{
    /* בלי כותרת Content-Type — כך הבקשה נשארת "פשוטה" ואין preflight,
       ש-Apps Script לא יודע לענות עליו. */
    const r = await fetch(ANALYTICS_URL, { method: "POST", body });
    const d = await r.json();
    if (d && d.ok){
      st.textContent = "תודה. התיקון ייבדק מול המקורות ויעלה בעדכון הבא.";
      st.className = "ok"; btn.textContent = "נשלח ✓";
      setTimeout(closeFix, 1800);
    } else {
      st.textContent = (d && d.error) ? `נדחה: ${d.error}` : "השליחה נדחתה.";
      st.className = "bad"; btn.disabled = false; btn.textContent = "שליחה";
    }
  }catch(e){
    /* חסימת CORS או רשת שנפלה. beacon לא מחזיר תשובה, ולכן ההודעה
       לא מבטיחה שנשמר — רק שנשלח. */
    let sent = false;
    try{ sent = !!(navigator.sendBeacon && navigator.sendBeacon(ANALYTICS_URL, body)); }catch(e2){}
    st.textContent = sent ? "נשלח. אין אישור קבלה מהשרת." : "השליחה נכשלה. נסו שוב מאוחר יותר.";
    st.className = sent ? "ok" : "bad";
    btn.disabled = !sent; btn.textContent = sent ? "נשלח ✓" : "שליחה";
  }
});

/* ---------- אתמול ---------- */
$("#ydayShow").addEventListener("click", ()=>{
  const y = answerFor(todayNo - 1);
  $("#ydayTxt").innerHTML = `אתמול (#${todayNo-1}) היה <b>${y.name}</b>`;
  $("#ydayShow").style.display = "none";
  store.set(K("yshown"), String(todayNo));
});

/* ---------- ארכיון ---------- */
const arch = $("#arch");
function stateOf(n){
  try{ return JSON.parse(store.get(K("p"+n)) || "null"); }catch(e){ return null; }
}
function openArch(){
  const list = $("#archList");
  let html = "";
  for (let n = todayNo; n >= 1; n--){
    const st = stateOf(n);
    let tag = '<i>טרם שוחקה</i>';
    if (st && st.over){
      const won = st.g.length && st.g[st.g.length-1] === answerFor(n).name;
      tag = won ? `<i class="win">פוצחה ב-${st.g.length}</i>` : '<i class="lose">לא פוצחה</i>';
    } else if (st && st.g && st.g.length){
      tag = `<i>באמצע · ${st.g.length}/${MAX}</i>`;
    }
    html += `<button data-n="${n}" class="${st&&st.over?"done":""} ${n===puzzleNo?"cur":""}">
      <span>חידה #${n}${n===todayNo?" · היום":""}</span>${tag}</button>`;
  }
  list.innerHTML = html;
  list.querySelectorAll("button").forEach(b => b.onclick = ()=>{
    closeArch(); loadPuzzle(+b.dataset.n);
  });
  arch.classList.add("on");
}
function closeArch(){ arch.classList.remove("on"); }
$("#archBtn").addEventListener("click", openArch);
$("#closeArch").addEventListener("click", closeArch);
arch.addEventListener("click", e => { if (e.target === arch) closeArch(); });

/* ---------- שחזור מהלך ---------- */
function restore(){
  try{
    const st = stateOf(puzzleNo);
    if (!st || !Array.isArray(st.g) || !st.g.length) return;
    hinted = !!st.h;
    st.g.forEach(n => {
      const pl = PLAYERS.find(x => x.name === n);
      if (pl){ guesses.push(pl); render(pl, true); }
    });
    if (!guesses.length) return;
    if (hinted){ $("#hintOut").textContent = hintText(); $("#hintBtn").style.display = "none"; }
    else $("#hintBtn").style.display = "";
    const last = guesses[guesses.length - 1];
    if (st.over || last.name === answer.name || guesses.length >= MAX)
      finish(last.name === answer.name);
    else maybeHint();
  }catch(e){}
}

/* ---------- חלונית עזרה ---------- */
const help = $("#help");
function openHelp(){ help.classList.add("on"); store.set(GKEY("seen"),"1"); }
function closeHelp(){ help.classList.remove("on"); }
$("#helpBtn").addEventListener("click", openHelp);
$("#reportLink").addEventListener("click", e => { e.preventDefault(); openRep(); });
$("#closeHelp").addEventListener("click", closeHelp);
help.addEventListener("click", e => { if (e.target === help) closeHelp(); });
$("#repFromHelp").addEventListener("click", e => { e.preventDefault(); openRep(); });
addEventListener("keydown", e => { if (e.key === "Escape"){ closeHelp(); closeRep(); closeFix(); closeArch(); } });

/* ============================================================
   6. בורר המועדון
   ============================================================ */
const picker = $("#picker");

function renderPicker(){
  $("#clubList").innerHTML = CLUB_ORDER.map(slug => {
    const c = CLUBS[slug];
    /* עונות ולא שנים — כמו בכל מקום אחר במשחק */
    const cov = `${c.counts.players} שחקנים · ${season(c.coverage.from)}–${season(c.coverage.to)}`;
    return `<button type="button" data-slug="${slug}" style="--c:${c.colors.brand};--c2:${c.colors.second || c.colors.ink}"
              class="${club && club.slug===slug ? "cur" : ""}">
        <span class="swatch"></span>
        <span class="t"><b>${c.game}</b><i>${c.he} · ${cov}</i></span>
      </button>`;
  }).join("");
  $("#clubList").querySelectorAll("button").forEach(b =>
    b.onclick = () => { closePicker(); chooseClub(b.dataset.slug); });
}
function openPicker(){ renderPicker(); picker.classList.add("on"); }
function closePicker(){ picker.classList.remove("on"); }
$("#clubBtn").addEventListener("click", openPicker);

/* צבע המותג מוחלף בשורש. hex → rgb כדי שהשקיפויות יעבדו גם הן. */
function applyTheme(c){
  const r = document.documentElement.style;
  r.setProperty("--brand", c.colors.brand);
  r.setProperty("--near",  c.colors.near);
  r.setProperty("--ink",   c.colors.ink);
  const m = c.colors.brand.replace("#","").match(/.{2}/g).map(h => parseInt(h,16));
  r.setProperty("--brand-rgb", m.join(","));
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute("content", c.colors.ink);
}

function chooseClub(slug){
  if (!CLUBS[slug]) slug = CLUB_ORDER[0];
  store.set(GKEY("club"), slug);
  bootClub(slug);
  /* מי שהגיע דרך הבורר עוד לא ראה את ההסבר */
  if (!store.get(GKEY("seen"))) openHelp();
}

/* ============================================================
   6ב. גשר ללשונית הקרב
   הקרב הוא <script type="module">, ומודול **לא רואה** const
   שהוצהר בסקריפט רגיל. כל מה שהוא צריך עובר במפורש דרך window.
   זה הפיל את המשחק בייצור פעם אחת — לא לגעת.
   ============================================================ */
window.SPORTDEL = window.SPORTDEL || {};

/* כל המועדונים, פעם אחת — לא רק הנבחר. חדר קרב על כמה קבוצות בונה
   מהם בריכה מאוחדת, וכל הנתונים כבר בדף, אז זו חשיפה ולא העתקה.

   אזהרה: אל תזכיר שם של מציין מקום בהערה כאן. הבנייה עושה
   split/join על כל מציין מקום בקובץ הזה, כולל בתוך הערות —
   הערה שהזכירה את שם המשתנה הזה תפחה את הדף ב-268KB. */
window.SPORTDEL.clubs = CLUBS;
window.SPORTDEL.order = CLUB_ORDER;

function publishClub(c){
  window.SPORTDEL.slug         = c.slug;
  window.SPORTDEL.game         = c.game;
  window.SPORTDEL.short        = c.short;
  window.SPORTDEL.he           = c.he;
  window.SPORTDEL.players      = c.players;
  window.SPORTDEL.analyticsUrl = ANALYTICS_URL;
  window.SPORTDEL.siteUrl      = SITE_URL;
}

function bootClub(slug){
  const switching = club && club.slug !== slug;
  club = CLUBS[slug];
  publishClub(club);
  /* אם הקרב כבר נטען — לצאת מהחדר ולרענן את הבריכה.
     חדר שייך למועדון אחד. */
  if (switching && typeof window.SPORTDEL.versusClubChanged === "function") {
    try { window.SPORTDEL.versusClubChanged(slug); } catch(e){}
  }
  applyTheme(club);

  PLAYERS = club.players.map(normalize);
  const byName = new Map(PLAYERS.map(p => [p.name, p]));
  POOL = club.schedule.map(n => byName.get(n)).filter(Boolean);
  PLAYERS.filter(p => p.target && !club.schedule.includes(p.name)).forEach(p => POOL.push(p));
  todayNo = dayIndex() + 1;

  document.title = `${club.game} · חידת השחקן היומית`;
  $("#gameName").textContent = club.game;
  $("#gameName").setAttribute("aria-label", club.game);
  $("#footName").textContent = club.game;
  document.querySelectorAll(".clubShort").forEach(el => el.textContent = club.short);
  $("#hLeague").textContent = club.titles.league.join(", ") || "—";
  $("#hCups").textContent   = club.titles.cup.join(", ")    || "—";
  $("#hScope").innerHTML =
    `המאגר הוא שחקני ${club.short} מעונת ${season(club.coverage.from)} ועד היום — ` +
    `<b>${club.counts.players}</b> שחקנים, מתוכם <b>${club.counts.targets}</b> יכולים להיות התשובה.`;

  input.disabled = false;
  input.placeholder = askText();
  board.innerHTML = "";
  $("#result").classList.remove("on");
  $("#comm").classList.remove("on");
  $("#stats").innerHTML = "";
  /* showStreak משווה מול puzzleNo, ו-puzzleNo נקבע רק ב-loadPuzzle
     שרץ בהמשך. לכן היא נקראת גם שם — אחרת תג הרצף לא מופיע בטעינה
     אלא רק אחרי שמסיימים חידה, ומשתמש חוזר חושב שאיבד את הרצף. */
  tickCountdown(); renderStats();

  // "אתמול" — מוסתר עד לחיצה, כדי לא לקלקל את הארכיון
  $("#ydayShow").style.display = "";
  $("#ydayTxt").textContent = "";
  if (todayNo > 1){
    if (store.get(K("yshown")) === String(todayNo)){
      const y = answerFor(todayNo - 1);
      $("#ydayTxt").innerHTML = `אתמול (#${todayNo-1}) היה <b>${y.name}</b>`;
      $("#ydayShow").style.display = "none";
    } else {
      $("#ydayTxt").textContent = `רוצים לדעת מי היה אתמול?`;
    }
  }

  loadPuzzle(todayNo);
  track("view");
}

/* ============================================================
   7. אתחול
   ============================================================ */
/* ---------- הגירה מביתרדל ----------
   רץ פעם אחת, ורק אם יש מפתחות ישנים ואין חדשים.
   localStorage הוא לפי origin, אז זה עובד **רק אם ספורטדל מוגש
   מאותה כתובת שביתרדל היה בה**. בכתובת חדשה אין מה למצוא והפונקציה
   פשוט לא עושה כלום — לכן היא בטוחה להריץ תמיד. */
function migrateFromBeitardle(){
  try{
    if (store.get(GKEY("migrated"))) return;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if (k && k.startsWith("beitardle:")) keys.push(k);
    }
    if (!keys.length) return;

    let moved = 0;
    const put = (from, to) => {
      const v = store.get(from);
      if (v !== null && store.get(to) === null){ store.set(to, v); moved++; }
    };
    for (const k of keys){
      const m = k.match(/^beitardle:v2:(\d+)$/);
      if (m) put(k, `sportdel:beitar:p${m[1]}`);
    }
    put("beitardle:streak", "sportdel:beitar:streak");
    put("beitardle:stats",  "sportdel:beitar:stats");
    put("beitardle:yshown", "sportdel:beitar:yshown");
    put("beitardle:seen",   GKEY("seen"));
    /* בכוונה **לא** קובעים כאן sportdel:club.
       ספורטדל הוא דף בחירת מועדון, וגם מי שהגיע מביתרדל צריך לראות
       שיש עוד ארבעה. הנתונים שלו מחכים לו — ברגע שיבחר בית"ר,
       הרצף, הסטטיסטיקה והארכיון כבר שם. */

    store.set(GKEY("migrated"), "1");
    if (moved) console.info(`ספורטדל: הועברו ${moved} מפתחות מביתרדל`);
  }catch(e){}
}

(function init(){
  $("#bld").textContent = BUILD;
  migrateFromBeitardle();
  const saved = store.get(GKEY("club"));
  if (saved && CLUBS[saved]){
    bootClub(saved);
    if (!store.get(GKEY("seen"))) openHelp();
  } else {
    openPicker();
  }
})();
