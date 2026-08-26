/* ============================================================
   FIREBASE — הגדרות הפרויקט
   ============================================================ */
const FIREBASE_CONFIG = __FIREBASE__;


/* ============================================================
   קרב חברים — נטען רק כשנכנסים ללשונית.
   פיירבייס לא יורד בכלל למי שמשחק רק את החידה היומית.
   ============================================================ */

/* המועדון הנוכחי. משתנה כשמחליפים מועדון, וכל הנתיבים
   `rooms/${SLUG}/${code}` מתעדכנים איתו אוטומטית. */
let SLUG = (window.SPORTDEL && window.SPORTDEL.slug) || "beitar";
let VKEY = `sportdel:${SLUG}:versus`;

const $ = s => document.querySelector(s);
let vReady = false, initVersus = null;

/* דיווח אנונימי על שימוש בקרב.
   נשלח לאותה נקודת קצה עם puzzle="קרב", אז בגיליון daily נוצרת שורה אחת:
   "נכנסו" = חדרים שנפתחו · "סיימו" = משחקים שהסתיימו · "ממוצע" = ממוצע משתתפים */
function vTrack(type, extra){
  try{
    const URL_ = window.SPORTDEL && window.SPORTDEL.analyticsUrl;
    if (typeof URL_ !== "string" || !URL_) return;
    const body = JSON.stringify({ type, puzzle: "קרב " + (window.SPORTDEL?.slug || ""), ...extra });
    if (navigator.sendBeacon) navigator.sendBeacon(URL_, body);
    else fetch(URL_, { method:"POST", mode:"no-cors", body });
  }catch(e){}
}

async function bootVersus(){
  if (vReady) return;
  vReady = true;
  try{ await startVersus(); }
  catch(err){
    vReady = false;
    console.error("קרב חברים:", err);
    const box = document.querySelector("#scHome .card");
    if (box) box.insertAdjacentHTML("beforeend",
      `<div class="err">לא הצלחנו לטעון את הקרב. נסו לרענן.<br><span style="opacity:.6">${err.message}</span></div>`);
  }
}

async function startVersus(){
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const { getDatabase, ref, set, get, update, onValue, onDisconnect,
          runTransaction, serverTimestamp, off }
    = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js");

  /* המודול נטען לפני שנבחר מועדון, אז SLUG מקבל ערך התחלתי בלבד.
     כאן — כשנכנסים ללשונית — כבר יש בחירה, ומסנכרנים. */
  SLUG = (window.SPORTDEL && window.SPORTDEL.slug) || SLUG;
  VKEY = `sportdel:${SLUG}:versus`;

  const app = initializeApp(FIREBASE_CONFIG);
  const db  = getDatabase(app);

  
  
  
  /* ============================================================
     2. בריכת השחקנים
     ============================================================ */
  /* שתי בריכות, נגזרות מהמאגר הראשי — בלי עותק כפול:
     CORE  = 3+ עונות. אלה שגם בחידה היומית, מוכרים היטב.
     WIDE  = 2+ עונות. מרחיב את המגוון כדי שמשחקים לא יחזרו על עצמם.
     רוב הסיבובים נלקחים מ-CORE, כדי שלא יהיו יותר מדי סיבובים מתים. */
  /* שתי בריכות, נגזרות מהמאגר של המועדון הנבחר — בלי עותק כפול.
     בקרב אין משוב מצמצם, אז שחקן אלמוני הוא לא חידה קשה אלא
     סיבוב מת. לכן הסף גבוה מזה של החידה היומית.

     הסף מסתגל: מתחילים ב-5 עונות, ויורדים כל עוד יש פחות מ-40
     ב-CORE. לא יורדים מתחת ל-3 — נבדק בשטח, וזה שובר את המשחק. */
  let CORE = [], WIDE = [], POOL = [], CORE_MIN = 5;
  function refreshPools(){
    const raw = (window.SPORTDEL && window.SPORTDEL.players) || [];
    /* seasons לא נשמר בקובץ הבנוי — הוא נגזר מ-spells, וזה חוסך
       שדה כפול על פני חמישה מאגרים */
    const ok  = raw.filter(p => p.born && p.pos)
      .map(p => p.seasons ? p : { ...p, seasons: p.spells.reduce((n,[a,b]) => n + (b-a+1), 0) });
    CORE_MIN = 5;
    while (CORE_MIN > 3 && ok.filter(p => p.seasons >= CORE_MIN).length < 40) CORE_MIN--;
    CORE = ok.filter(p => p.seasons >= CORE_MIN);
    WIDE = ok.filter(p => p.seasons >= 3 && p.seasons < CORE_MIN);
    POOL = CORE.concat(WIDE);
  }
  refreshPools();
  
  const V_POS={GK:"שוער",DF:"מגן",MF:"קשר",FW:"חלוץ"};
  const V_NAT={IL:"ישראל",UA:"אוקראינה",HU:"הונגריה",GH:"גאנה",MK:"מקדוניה",PT:"פורטוגל",
    BR:"ברזיל",AR:"ארגנטינה",ES:"ספרד",FR:"צרפת",NG:"ניגריה",GE:"גאורגיה",CO:"קולומביה",
    RU:"רוסיה",CM:"קמרון",RO:"רומניה",UY:"אורוגוואי",CL:"צ'ילה",HR:"קרואטיה",RS:"סרביה",
    SK:"סלובקיה",CI:"חוף השנהב",CD:"קונגו",SN:"סנגל",NL:"הולנד",BE:"בלגיה",DE:"גרמניה",
    IT:"איטליה",PL:"פולין",SE:"שוודיה",US:"ארה\"ב",CR:"קוסטה ריקה",VE:"ונצואלה",TG:"טוגו",
    MQ:"מרטיניק",NC:"קלדוניה החדשה",TT:"טרינידד",PY:"פרגוואי",MG:"מדגסקר",CV:"כף ורדה",
    MD:"מולדובה",BY:"בלארוס",XK:"קוסובו",AL:"אלבניה",SI:"סלובניה",CZ:"צ'כיה",AT:"אוסטריה",
    CH:"שווייץ",GR:"יוון",TR:"טורקיה",EN:"אנגליה",AU:"אוסטרליה",BG:"בולגריה",DK:"דנמרק",
    ME:"מונטנגרו",BA:"בוסניה",GT:"גואטמלה",MA:"מרוקו",LV:"לטביה",LT:"ליטא",KZ:"קזחסטן",
    ZM:"זמביה",JM:"ג'מייקה",KE:"קניה",RW:"רואנדה",SR:"סורינאם",FI:"פינלנד",GA:"גבון",PE:"פרו"};
  
  const vSeason = y => `${String(y-1).slice(-2)}/${String(y).slice(-2)}`;
  const vNorm = t => (t||"").replace(/[-־]/g," ").replace(/['"״׳]/g,"")
                           .replace(/\s+/g," ").trim();
  
  /* חמשת הרמזים, לפי סדר חשיפה */
  function cluesOf(p){
    return [
      ["עמדה",  V_POS[p.pos] || p.pos],
      ["לאום",  V_NAT[p.nat] || p.nat],
      ["עונה ראשונה", vSeason(p.spells[0][0])],
      ["תארים", String(p.titles)],
      ["נולד",  String(p.born)],
      ["השם מתחיל ב",  p.he.trim()[0]]
    ];
  }
  const CLUES = 6;
  const POINTS = [6,5,4,3,2,1];

  /* "חם או קר": כמה מהרמזים של הניחוש תואמים לתשובה.
     מחזיר מספר בלבד — בלי לגלות אילו, כדי שאי אפשר יהיה
     לצמצם שיטתית ולהפוך את זה למרוץ הקלדה. */
  function matchCount(g, a){
    let n = 0;
    if (g.pos === a.pos) n++;
    if (g.nat === a.nat) n++;
    if (g.spells[0][0] === a.spells[0][0]) n++;
    if (g.titles === a.titles) n++;
    if (Math.abs(g.born - a.born) <= 2) n++;          // דור, לא שנה מדויקת
    if (g.he.trim()[0] === a.he.trim()[0]) n++;
    return n;
  }
  const HEAT = ["קר לגמרי","קר","פושר","חם","חם מאוד","בוער","כמעט"];        // לפי כמה רמזים היו חשופים
  
  /* ============================================================
     3. עזרים
     ============================================================ */
  const show = id => { ["scHome","scLobby","scPlay","scReveal","scEnd"]
    .forEach(s => $("#"+s).classList.toggle("hide", s !== id)); };
  
  const uid = (() => {
    let u = null;
    try { u = localStorage.getItem("sportdel:uid"); } catch(e){}
    if (!u){ u = Math.random().toString(36).slice(2,10);
             try{ localStorage.setItem("sportdel:uid",u); }catch(e){} }
    return u;
  })();
  
  let skew = 0;                       // הפרש שעון מול השרת
  onValue(ref(db,".info/serverTimeOffset"), s => skew = s.val() || 0);
  const now = () => Date.now() + skew;
  
  function mkCode(){
    const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // בלי I O 0 1
    return Array.from({length:4}, () => A[Math.floor(Math.random()*A.length)]).join("");
  }
  function mulberry32(a){
    return function(){ a|=0; a=a+0x6D2B79F5|0;
      let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
      return ((t^t>>>14)>>>0)/4294967296; };
  }
  /** בחירת סיבובים דטרמיניסטית מהקוד — כל המשתתפים מקבלים אותם שחקנים.
      ~70% מהמוכרים, ~30% מהרחב, כדי לשמור על רעננות בלי סיבובים מתים. */
  function pickRounds(code, n){
    let seed = 0; for (const c of code) seed = (seed*31 + c.charCodeAt(0))|0;
    const r = mulberry32(seed);
    const shuffle = arr => { const a=[...arr];
      for (let i=a.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
      return a; };

    const nWide = WIDE.length ? Math.min(WIDE.length, Math.round(n * 0.3)) : 0;
    const nCore = n - nWide;
    const picks = shuffle(CORE).slice(0, nCore).concat(shuffle(WIDE).slice(0, nWide));
    return shuffle(picks).map(p => POOL.indexOf(p));
  }
  
  /* ============================================================
     4. מצב מקומי
     ============================================================ */
  let room = null, roomRef = null, unsub = null, state = null;
  let isHost = false, tick = null, lastStage = -1, locked = 0, answered = false;
  let presenceOff = null;
  
  /* זיכרון מקומי: באיזה חדר אני ומה השם שלי */
  const mem = {
    get(){ try{ return JSON.parse(localStorage.getItem(VKEY)) || null; }catch(e){ return null; } },
    set(v){ try{ localStorage.setItem(VKEY, JSON.stringify(v)); }catch(e){} },
    clear(){ try{ localStorage.removeItem(VKEY); }catch(e){} }
  };
  
  /* נוכחות: בכל התחברות מחדש מנקה את סימון היציאה ומחדש את onDisconnect.
     בלי זה, נתק של חצי שנייה מוחק שחקן מהחדר לתמיד. */
  function keepPresence(code){
    if (presenceOff) presenceOff();
    const gRef = ref(db, `rooms/${SLUG}/${code}/players/${uid}/gone`);
    const un = onValue(ref(db, ".info/connected"), snap => {
      if (snap.val() !== true) return;
      onDisconnect(gRef).set(true);
      set(gRef, null);
    });
    presenceOff = () => off(ref(db, ".info/connected"), "value", un);
  }
  
  /* ============================================================
     5. פתיחה והצטרפות
     ============================================================ */
  $("#btnCreate").addEventListener("click", async () => {
    const name = $("#vName").value.trim();
    if (!name) return $("#vName").focus();
    const pre = +($("#preReveal").value || 8);
    const sel = $("#setReveal"); if (sel) sel.value = String(pre);
    const code = mkCode();
    const btn = $("#btnCreate"), err = $("#joinErr");
    btn.disabled = true; err.textContent = "";
    try {
      isHost = true; room = code; roomRef = ref(db, `rooms/${SLUG}/${code}`);
      await set(roomRef, {
        createdAt: serverTimestamp(), host: uid, status: "lobby",
        settings: { rounds: 10, revealMs: pre * 1000, roundMs: pre * 1000 * (CLUES - 1) + 12000 },
        players: { [uid]: { name, score: 0, at: serverTimestamp() } }
      });
      mem.set({ room: code, name });
      keepPresence(code);
      vTrack("view");
      watch();
    } catch (e) {
      /* בלי זה הכפתור פשוט מת ואין שום סימן על המסך.
         PERMISSION_DENIED כאן כמעט תמיד אומר שחוקי הפיירבייס
         עדיין מתירים רק rooms/<code> ולא rooms/<slug>/<code>. */
      isHost = false; room = null; roomRef = null;
      err.textContent = /PERMISSION_DENIED/i.test(e.message || "")
        ? "אין הרשאה לפתוח חדר. צריך לעדכן את חוקי הפיירבייס (config/firebase-rules.json)."
        : "לא הצלחנו לפתוח חדר: " + (e.message || e);
      console.error("createRoom:", e);
    } finally { btn.disabled = false; }
  });
  
  $("#joinCode").addEventListener("input", e => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,"").slice(0,4);
  });
  
  $("#btnJoin").addEventListener("click", async () => {
    const code = $("#joinCode").value.trim().toUpperCase();
    const name = $("#vName").value.trim();
    const err  = $("#joinErr");
    err.textContent = "";
    if (code.length !== 4) return err.textContent = "קוד בן ארבע אותיות";
    if (!name) return err.textContent = "צריך שם";
  
    const snap = await get(ref(db, `rooms/${SLUG}/${code}`));
    if (!snap.exists()) return err.textContent = "אין חדר עם הקוד הזה";
    if (snap.val().status === "done") return err.textContent = "המשחק בחדר הזה כבר נגמר";
    if (snap.val().status === "playing" && !(snap.val().players||{})[uid])
      return err.textContent = "המשחק כבר התחיל — בקשו לפתוח חדר חדש";
  
    room = code; isHost = snap.val().host === uid; roomRef = ref(db, `rooms/${SLUG}/${code}`);
    await update(ref(db, `rooms/${SLUG}/${code}/players/${uid}`),
                 { name, score: 0, at: serverTimestamp(), gone: null });
    mem.set({ room: code, name });
    keepPresence(code);
    watch();
  });
  
  $("#btnLeave").addEventListener("click", leaveRoom);
  
  $("#btnShare").addEventListener("click", async () => {
    const link = `${location.origin}${location.pathname}?room=${room}`;
    const txt =
`⚫🟡 בואו לדו־קרב בביתרdle

מי מזהה את שחקן בית"ר הכי מהר?
הרמזים נחשפים לכולם יחד — והראשון שפוגע לוקח את הסיבוב.

פתחתי חדר. תלחצו וזה נכנס לבד 👇
${link}

(אם צריך ידנית — קוד החדר: ${room})`;
    try{
      if (navigator.share) return void await navigator.share({ text: txt });
      await navigator.clipboard.writeText(txt);
      $("#btnShare").textContent = "הועתק ✓";
      setTimeout(()=> $("#btnShare").textContent = "שיתוף הקוד", 1800);
    }catch(e){}
  });
  
  $("#btnStart").addEventListener("click", async () => {
    const ps = Object.values(state?.players || {}).filter(p => !p.gone);
    if (ps.length < 2) return $("#startErr").textContent = "צריך לפחות שני שחקנים";
    await update(roomRef, {
      status: "playing", round: 0, roundStartedAt: serverTimestamp(),
      settings: {
        rounds:   +$("#setRounds").value,
        revealMs: +$("#setReveal").value * 1000,
        roundMs:  +$("#setReveal").value * 1000 * (CLUES - 1) + 12000
      }
    });
  });
  
  $("#btnAgain").addEventListener("click", () => { mem.clear(); location.reload(); });
  $("#btnHome").addEventListener("click", () => { mem.clear(); location.href = "./"; });
  
  /* יציאה מרצון */
  async function leaveRoom(){
    if (room){
      try{ await update(ref(db, `rooms/${SLUG}/${room}/players/${uid}`), { gone: true }); }catch(e){}
    }
    if (presenceOff) presenceOff();
    mem.clear();
    location.reload();
  }
  
  /* ---------- הגעה מקישור הזמנה ---------- */
  (function fromLink(){
    const code = new URLSearchParams(location.search).get("room");
    if (!code) return;
    const c = code.toUpperCase().replace(/[^A-Z2-9]/g,"").slice(0,4);
    if (c.length !== 4) return;
    const f = $("#joinCode");
    f.value = c; f.readOnly = true; f.style.opacity = ".75";
    $("#joinErr").textContent = "";
    const saved = (mem.get() || {}).name;
    if (saved) $("#vName").value = saved;
    setTimeout(() => $("#vName").focus(), 200);
    // מסמן ויזואלית שזו הזמנה
    const card = f.closest(".card");
    if (card){
      const lb = card.querySelector("label");
      if (lb) lb.textContent = `הוזמנת לחדר ${c} — איך קוראים לך?`;
    }
  })();

  /* ---------- חזרה אוטומטית אחרי רענון ---------- */
  (async function resume(){
    const m = mem.get();
    if (!m || !m.room) return;
    try{
      const snap = await get(ref(db, `rooms/${SLUG}/${m.room}`));
      if (!snap.exists() || snap.val().status === "done"){ mem.clear(); return; }
      room = m.room; roomRef = ref(db, `rooms/${SLUG}/${room}`);
      isHost = snap.val().host === uid;
      await update(ref(db, `rooms/${SLUG}/${room}/players/${uid}`),
                   { name: m.name, at: snap.val().players?.[uid]?.at || serverTimestamp(), gone: null });
      keepPresence(room);
      watch();
    }catch(e){ mem.clear(); }
  })();
  
  /* ============================================================
     6. מעקב אחרי מצב החדר
     ============================================================ */
  function watch(){
    if (unsub) off(roomRef);
    unsub = onValue(roomRef, snap => {
      state = snap.val();
      if (!state) return;
      isHost = state.host === uid;
      render();
    });
  }
  
  /** כולם — כולל מנותקים. מי שנופל לרגע לא נעלם מהטבלה. */
  function allPlayers(){
    return Object.entries(state.players || {})
      .map(([id,p]) => ({ id, ...p, score: p.score || 0 }))
      .sort((a,b) => b.score - a.score || (a.at||0) - (b.at||0));
  }
  const livePlayers = () => allPlayers().filter(p => !p.gone);
  
  function render(){
    if (state.status === "lobby"){
      show("scLobby");
      $("#lobbyCode").textContent = room;
      $("#lobbyPlayers").innerHTML = allPlayers().map(p =>
        `<div class="${p.id===uid?"me":""}" style="${p.gone?"opacity:.45":""}">${esc(p.name)}
           <i>${p.gone ? "מנותק" : (p.id===state.host?"מנהל החדר":"")}</i></div>`).join("");
      $("#hostBox").classList.toggle("hide", !isHost);
      $("#waitMsg").classList.toggle("hide", isHost);
      return;
    }
    if (state.status === "done"){ show("scEnd"); drawBoard("#endBoard"); stopTick(); return; }
    if (state.status === "playing") runRound();
  }
  
  const esc = s => String(s).replace(/[<>&"]/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));
  
  function drawBoard(sel){
    $(sel).innerHTML = allPlayers().map((p,i) =>
      `<div class="${p.id===uid?"me":""}">
         <span class="rk">${i+1}</span>
         <span class="nm" style="${p.gone?"opacity:.5":""}">${esc(p.name)}</span>
         <span class="sc">${p.score}</span>
       </div>`).join("");
  }
  
  /* ============================================================
     7. סיבוב
     ============================================================ */
  function stopTick(){ if (tick){ clearInterval(tick); tick = null; } }
  
  function runRound(){
    const st = state.settings, rounds = pickRounds(room, st.rounds);
    const idx = state.round;
    if (idx >= rounds.length){ finishGame(); return; }
  
    const answer = POOL[rounds[idx]];
    const res    = (state.results || {})[idx] || null;
  
    if (res){ showReveal(answer, res); return; }
  
    show("scPlay");
    $("#rNum").textContent = idx + 1;
    $("#rTot").textContent = st.rounds;
    if (lastStage === -1 || $("#clues").dataset.round != idx) buildClues(idx);
    drawBoard("#liveBoard");
  
    stopTick();
    tick = setInterval(() => {
      const el = now() - (state.roundStartedAt || now());
      const left = Math.max(0, st.roundMs - el);
      $("#rTime").textContent = Math.ceil(left/1000);
      $("#rBar").style.width = (left / st.roundMs * 100) + "%";
  
      const stage = Math.min(CLUES, Math.floor(el / st.revealMs) + 1);
      if (stage !== lastStage){ revealTo(stage); lastStage = stage; }
  
      if (left <= 0){ stopTick(); closeRound(idx, null, 0); }
    }, 200);
  }
  
  function buildClues(idx){
    const c = $("#clues");
    c.dataset.round = idx; c.innerHTML = ""; lastStage = -1;
    answered = false; locked = 0;
    $("#answer").value = ""; $("#answer").disabled = false;
    $("#feed").textContent = ""; $("#feed").className = "feed";
    const rounds = pickRounds(room, state.settings.rounds);
    cluesOf(POOL[rounds[idx]]).forEach(([k,v]) => {
      const d = document.createElement("div");
      d.className = "clue";
      d.innerHTML = `<span>${k}</span><b>${v}</b>`;
      c.appendChild(d);
    });
  }
  
  function revealTo(stage){
    [...$("#clues").children].forEach((el,i) => {
      el.classList.toggle("on", i < stage);
      el.classList.toggle("fresh", i === stage-1);
    });
  }
  
  /** סוגר סיבוב — טרנזקציה כדי שרק ניחוש אחד ייקלט כמנצח */
  async function closeRound(idx, winnerId, pts){
    const r = ref(db, `rooms/${SLUG}/${room}/results/${idx}`);
    const out = await runTransaction(r, cur => {
      if (cur) return;                                  // כבר נסגר
      return { winner: winnerId || null, pts, at: serverTimestamp() };
    });
    if (!out.committed) return;
  
    if (winnerId){
      await runTransaction(ref(db, `rooms/${SLUG}/${room}/players/${winnerId}/score`),
                           s => (s || 0) + pts);
    }
    // כל לקוח שמגיע לכאן ראשון מקדם — הטרנזקציה מונעת קפיצה כפולה
    setTimeout(() => {
      runTransaction(ref(db, `rooms/${SLUG}/${room}/round`), r2 => (r2 === idx ? idx + 1 : undefined))
        .then(() => update(roomRef, { roundStartedAt: serverTimestamp() }));
    }, 4200);
  }
  
  function showReveal(answer, res){
    show("scReveal");
    stopTick();
    const who = res.winner ? (state.players[res.winner]?.name || "מישהו") : null;
    $("#revText").innerHTML = who
      ? `<b>${esc(answer.he)}</b><br>${esc(who)} זיהה ראשון · ${res.pts} נקודות`
      : `<b>${esc(answer.he)}</b><br>אף אחד לא זיהה`;
    drawBoard("#revBoard");
  }
  
  async function finishGame(){
    stopTick();
    if (isHost){
      await update(roomRef, { status: "done" });
      vTrack("done", { guesses: allPlayers().length, won: true });
    }
    show("scEnd"); drawBoard("#endBoard");
  }
  
  /* ============================================================
     8. ניחוש
     ============================================================ */
  const inp = $("#answer"), sg = $("#vSugg");

  /* ------------------------------------------------------------
     מקלדת פתוחה

     באייפון המקלדת לא מכווצת את פריסת הדף — היא רק מכסה אותה.
     פריסת הדף נשארת בגובה המלא, ולכן answerbox ה-sticky נשאר
     מתחת למקלדת; ספארי גולל כדי לחשוף את השדה; הגלילה משנה את
     הפריסה, שינוי הפריסה מזיז את הגלילה שוב — וזה הריצוד.
     באנדרואיד הגלילה הזאת שקטה יותר, ולכן שם זה נראה תקין.

     במקום להיאבק בגלילה: מודדים את החלון הנראה ב-visualViewport,
     ומסך המשחק יוצא מהגלילה ונועל את עצמו אליו בדיוק (הכלל ב-CSS,
     תחת body.kb). אין גלילה → אין מה לגלול → אין ריצוד, והשדה
     יושב תמיד בתחתית האזור הנראה, מעל המקלדת.
     ------------------------------------------------------------ */
  (function keyboardAware(){
    const vv   = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let on = false, raf = 0, lastH = -1, lastTop = -1;

    const apply = () => {
      raf = 0;
      /* מה שהמקלדת מכסה מלמטה: גובה הפריסה פחות החלון הנראה
         והיסט החלון הנראה בתוכו. */
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);

      if (vv.height  !== lastH)   root.style.setProperty("--vvh",   (lastH   = vv.height)    + "px");
      if (vv.offsetTop !== lastTop) root.style.setProperty("--vvtop", (lastTop = vv.offsetTop) + "px");

      /* שני ספים ולא אחד. סף יחיד מהבהב: הפריסה שמתכווצת מזיזה את
         הגלילה, המדידה חוזרת לגבול, והמחלקה מתחלפת שוב ושוב. */
      const was = on;
      if      (!on && inset > 140) on = true;
      else if ( on && inset <  80) on = false;
      if (was === on) return;

      document.body.classList.toggle("kb", on);
      /* חזרה לגלילה: ספארי השאיר את הדף גלול למקום שבו חשף את
         השדה, ובלי זה מסך המשחק חוזר לזרימה באמצע העמוד. */
      if (was && !on) {
        const sec = $("#scPlay");
        if (sec && !sec.classList.contains("hide")) sec.scrollIntoView({ block: "start" });
      }
    };

    const check = () => { if (!raf) raf = requestAnimationFrame(apply); };
    vv.addEventListener("resize", check);
    vv.addEventListener("scroll", check);
    addEventListener("orientationchange", check);
    inp.addEventListener("blur", () => setTimeout(check, 120));
    check();
  })();
  
  inp.addEventListener("input", () => {
    const q = vNorm(inp.value);
    if (!q) return closeSugg();
    /* עם מקלדת פתוחה נשארים 350px מסך. שש הצעות מכסות גם את הרמזים,
       וגם ההגבלה ב-CSS לא מספיקה — פחות שורות זה פחות מה שמוסתר. */
    const hits = POOL.filter(p => vNorm(p.he).includes(q))
                     .slice(0, document.body.classList.contains("kb") ? 4 : 6);
    sg.innerHTML = hits.map(p => `<button type="button" data-n="${esc(p.he)}">${esc(p.he)}</button>`).join("");
    sg.classList.toggle("on", hits.length > 0);
  });
  function closeSugg(){ sg.classList.remove("on"); sg.innerHTML = ""; }
  sg.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (b){ inp.value = b.dataset.n; closeSugg(); submit(); }
  });
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter"){ e.preventDefault();
      const first = sg.querySelector("button");
      if (first && vNorm(inp.value) !== vNorm(first.dataset.n)) inp.value = first.dataset.n;
      closeSugg(); submit(); }
  });
  
  function submit(){
    if (answered || !state || state.status !== "playing") return;
    if (now() < locked) return;
    const idx = state.round;
    if ((state.results || {})[idx]) return;
  
    const rounds = pickRounds(room, state.settings.rounds);
    const answer = POOL[rounds[idx]];
    const guess  = vNorm(inp.value);
    if (!guess) return;
    const p = POOL.find(x => vNorm(x.he) === guess);
    inp.value = ""; closeSugg();
    if (!p) return;
  
    if (guess === vNorm(answer.he)){
      answered = true;
      inp.disabled = true;
      const el = now() - (state.roundStartedAt || now());
      const stage = Math.min(CLUES, Math.floor(el / state.settings.revealMs) + 1);
      const pts = POINTS[stage-1] || 1;
      $("#feed").textContent = `נכון! ${pts} נקודות`;
      $("#feed").className = "feed good";
      closeRound(idx, uid, pts);
    } else {
      locked = now() + 3000;
      const hit = matchCount(p, answer);
      const word = HEAT[hit] || HEAT[0];
      const fb = $("#feed");
      fb.className = "feed bad";
      fb.innerHTML = `<b>${hit}/${CLUES}</b> מתאימים · ${word}` +
                     `<span class="cd"> · 3</span>`;
      let n = 3;
      const c = setInterval(() => {
        const s = fb.querySelector(".cd");
        if (--n <= 0){ clearInterval(c); if (s) s.remove(); }
        else if (s) s.textContent = ` · ${n}`;
      }, 1000);
    }
  }
  /* החלפת מועדון: יוצאים מהחדר ומרעננים את הבריכה.
     חדר שייך למועדון אחד — אי אפשר לגרור אותו הלאה. */
  window.SPORTDEL.versusClubChanged = async (slug) => {
    if (room) { try { await leaveRoom(); } catch(e){} }
    SLUG = slug;
    VKEY = `sportdel:${slug}:versus`;
    refreshPools();
    show("scHome");
  };
}

/* ---------- לשוניות ---------- */
const vHelp = $("#vHelp");
$("#vHelpBtn").addEventListener("click", () => vHelp.classList.add("on"));
$("#vHelpClose").addEventListener("click", () => vHelp.classList.remove("on"));
vHelp.addEventListener("click", e => { if (e.target === vHelp) vHelp.classList.remove("on"); });
addEventListener("keydown", e => { if (e.key === "Escape") vHelp.classList.remove("on"); });

const views = { daily: $("#dailyView"), versus: $("#versusView") };
function openTab(t){
  document.querySelectorAll(".nav button").forEach(b =>
    b.classList.toggle("on", b.dataset.tab === t));
  views.daily.classList.toggle("hide", t !== "daily");
  views.versus.classList.toggle("hide", t !== "versus");
  try{ history.replaceState(null, "", t === "versus" ? "#versus" : location.pathname); }
  catch(e){ /* iframe עם origin שונה — לא קריטי */ }
  // גלילה לראש כדי שהמעבר לא יקפוץ באמצע הדף


  window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
  if (t === "versus") bootVersus();
}
document.querySelectorAll(".nav button").forEach(b =>
  b.addEventListener("click", () => openTab(b.dataset.tab)));
const hasRoom = new URLSearchParams(location.search).has("room");
if (hasRoom || location.hash === "#versus") openTab("versus");