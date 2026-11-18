/* ============================================================
   סיור על המסך — הסבר ויזואלי לכל לשונית, בלחיצת כפתור.

   המסך מוחשך, האלמנט שמסבירים עליו נשאר מואר עם מסגרת, יד מונפשת
   מצביעה עליו, והקמע — כדור עם צעיף בצבעי המועדון שבדף — מסביר
   במשפט-שניים. הבא / הקודם / סיום, ו-Esc.

   לכל לשונית סיור משלה (נועם, 18/11): חידה יומית, קרב חברים, 3×3,
   קבוצות. נכנסים מהכפתור "👆 קח אותי לסיור" שבכל חלון הסבר; בכניסה
   הראשונה חלון ההסבר של החידה נפתח ממילא, עם הכפתור.

   צעד שהאלמנט שלו לא קיים או מוסתר — מדולג. בחידה היומית, כשהלוח
   ריק, נכנסת **שורת דוגמה** לזמן הסיור בלבד: שחקן בדוי בצבעים
   קבועים, כדי לא לרמוז דבר על התשובה של היום.
   ============================================================ */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const vis = el => !!el && el.offsetParent !== null && el.getClientRects().length > 0;

  const ARW = `<svg class="arw" viewBox="0 0 12 14" aria-hidden="true"><path d="M6 1.5v11M1.8 5.7 6 1.5l4.2 4.2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  /* שורת הדוגמה: אותו מבנה כמו render() ב-engine.js */
  const tile = (s, k, v, ar) => `<div class="tile ${s}" style="animation:none;opacity:1;transform:none"><span class="k">${k}</span>` +
    `<span class="v">${v}${ar ? ` <span class="ar${ar === "dn" ? " dn" : ""}">${ARW}</span>` : ""}</span></div>`;
  function demoRow() {
    const row = document.createElement("div");
    row.className = "row tour-demo";
    row.style.cssText = "animation:none";
    row.innerHTML = `<p class="who"><span class="nm">שחקן לדוגמה</span><i>ניחוש לדוגמה</i></p><div class="tiles">` +
      tile("hit", "עמדה", "התקפה") + tile("near", "לאום", "צרפת") + tile("miss", "עונה 1", "14/15", "up") +
      tile("miss", "תארים", "0", "up") + tile("near", "נולד", "1993", "dn") + `</div>`;
    return row;
  }

  const MAXG = () => (typeof MAX !== "undefined" ? MAX : 8);
  const TOURS = {
    daily: () => [
      { t: "#guess", m: "מקלידים שם של שחקן ובוחרים אותו מהרשימה. כל ניחוש מקרב אתכם לתשובה." },
      { t: ".tour-demo, #board .row", m: "כל ניחוש מחזיר חמישה רמזים: עמדה, לאום, עונה ראשונה, תארים ושנת לידה — כל אחד בהשוואה לשחקן המסתורי." },
      { t: ".tour-demo .tile.hit, #board .row .tile.hit", m: "צבע המועדון = מדויק. הרמז הזה זהה לתשובה." },
      { t: ".tour-demo .tile.near, #board .row .tile.near", m: "גוון כהה = קרוב: אותה יבשת, או שנה-שלוש הפרש." },
      { t: ".tour-demo .ar, #board .row .ar", m: "החץ אומר לאן ללכת: ↑ התשובה גבוהה או מאוחרת יותר, ↓ נמוכה או מוקדמת יותר." },
      { t: "#left", m: `יש ${MAXG()} ניסיונות. חידה חדשה כל יום בחצות.` },
      { t: "#hintBtn", m: "נתקעתם? אפשר לקבל רמז נוסף." },
      { t: '.nav [data-tab="groups"]', m: "ובסוף — התחרו עם החברים: בלשונית הקבוצות התוצאה נכנסת לבד לטבלה." }
    ],
    versus: () => [
      { t: "#modePick", m: "בוחרים משחק: מי השחקן (רמזים נחשפים, מי שמזהה ראשון), מספרים, או איקס-עיגול 3×3." },
      { t: "#btnCreate", m: "פותחים חדר ומקבלים קוד בן ארבע אותיות. שולחים אותו לחברים." },
      { t: "#btnJoin", m: "קיבלתם קוד מחבר? מזינים אותו כאן ונכנסים לחדר." },
      { t: '.nav [data-tab="versus"]', m: "צריך לפחות שני שחקנים. מי שצובר הכי הרבה נקודות — מנצח." }
    ],
    grid: () => [
      { t: "#gBoard", m: "לוח 3×3: לכל שורה ולכל עמודה יש תנאי. בכל משבצת צריך שחקן שעונה על שניהם." },
      { t: "#gBoard .gc", m: "לוחצים על משבצת ומקלידים שם. שחקן אחד — משבצת אחת." },
      { t: "#gLeft", m: "9 ניחושים לכל הלוח, וגם ניחוש שגוי נספר. כדאי לחשוב לפני שבוחרים." },
      { t: "#gBoard", m: "כל תשובה נכונה מקבלת נדירות: ככל שפחות אנשים בחרו בשחקן — יותר נקודות. לוח חדש כל יום." }
    ],
    groups: () => [
      { t: '#groupsBody [data-g="create"]', m: "פותחים קבוצה: על החידה היומית או על ה-3×3, של המועדון שבדף." },
      { t: '#groupsBody [data-g="join"]', m: "קיבלתם קוד מחבר? מצטרפים כאן. אפשר להיות בכמה קבוצות, גם של מועדונים שונים." },
      { t: "#groupsBody .grp1", m: "לכל קבוצה טבלה משלה. מסיימים את המשחק של היום — והתוצאה נכנסת לבד." },
      { t: '#groupsBody [data-g="how"]', m: "כאן כל החישוב: נקודות, דירוג ויומן שבעת הימים." },
      { t: "#groupsBody .gweb", m: "קבוצות החברים פועלות באפליקציה — שם משחקים את החידה היומית ואת ה-3×3." }
    ]
  };

  /* הקמע: כדור עם פרצוף וצעיף בצבעי המועדון (--brand / --second מ-applyTheme) */
  const MASCOT = `<svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="28" r="22" fill="#fff" stroke="#17181c" stroke-width="2.5"/>
    <path d="M32 15l7 5-3 8h-8l-3-8z" fill="#17181c"/>
    <path d="M14 22l6-2 3 7-4 5-6-3zM50 22l-6-2-3 7 4 5 6-3z" fill="#17181c" opacity=".85"/>
    <circle cx="25" cy="33" r="2.6" fill="#17181c"/><circle cx="39" cy="33" r="2.6" fill="#17181c"/>
    <path d="M26 39q6 5 12 0" fill="none" stroke="#17181c" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M12 46q20 9 40 0l-2 7q-18 7-36 0z" fill="var(--brand)" stroke="#17181c" stroke-width="2"/>
    <path d="M22 49.5v5M32 50.5v5M42 49.5v5" stroke="var(--second, #17181c)" stroke-width="3.2"/>
    <path d="M44 49l5 12-6-1-3-10z" fill="var(--brand)" stroke="#17181c" stroke-width="2"/>
  </svg>`;
  const HAND = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10m0-.5V8.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.2a6 6 0 0 1-4.6-2.2L4.4 15.3a1.6 1.6 0 0 1 2.4-2.1L9 15.5" fill="#fff" stroke="#17181c" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  (function css() {
    const s = document.createElement("style");
    s.textContent = `
    .tour{position:fixed;inset:0;z-index:10000;pointer-events:auto}
    .tour .spot{position:fixed;border-radius:14px;box-shadow:0 0 0 9999px rgba(10,10,14,.68);outline:3px solid var(--brand);outline-offset:3px;transition:all .35s cubic-bezier(.3,.8,.3,1);pointer-events:none}
    .tour .hand{position:fixed;width:42px;height:42px;transition:left .35s,top .35s;pointer-events:none;animation:tourTap 1.1s ease-in-out infinite;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}
    @keyframes tourTap{0%,100%{transform:translate(0,0) rotate(-8deg)}50%{transform:translate(-4px,-8px) rotate(-8deg) scale(.94)}}
    .tour .bub{position:fixed;left:12px;right:12px;max-width:420px;margin:0 auto;background:#fff;color:#17181c;border-radius:16px;padding:14px 14px 12px 32px;direction:rtl;text-align:right;box-shadow:0 10px 30px rgba(0,0,0,.35);transition:top .35s;font-size:15px;line-height:1.55}
    .tour .bub .top{display:flex;align-items:center;gap:10px}
    .tour .mas{flex:0 0 52px;width:52px;height:52px;animation:tourBob 2.4s ease-in-out infinite}
    @keyframes tourBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
    .tour .txt{flex:1}
    .tour .row2{display:flex;align-items:center;gap:8px;margin-top:10px}
    .tour .cnt{font-size:12px;font-weight:800;color:#5b5e66;margin-inline-end:auto}
    .tour .row2 button{font:inherit;font-size:14px;font-weight:800;border-radius:10px;padding:8px 14px;cursor:pointer;width:auto;min-height:0;margin:0;border:1px solid #cfcbc2;background:#fff;color:#17181c}
    .tour .row2 .nx{background:var(--brand);border-color:var(--brand);color:var(--on-brand,#121214)}
    .tour .x{position:absolute;top:6px;left:8px;background:none;border:0;font-size:20px;line-height:1;color:#5b5e66;cursor:pointer;width:auto;min-height:0;padding:4px;margin:0}
    @media (prefers-reduced-motion:reduce){.tour .spot,.tour .hand,.tour .bub{transition:none}.tour .hand,.tour .mas{animation:none}}`;
    document.head.appendChild(s);
  })();

  let T = null;   // { steps, i, el, demo }
  function stop() {
    if (!T) return;
    T.el.remove();
    if (T.demo) T.demo.remove();
    removeEventListener("resize", place); removeEventListener("scroll", place, true);
    T = null;
  }
  function target() { return T && document.querySelector(T.steps[T.i].t); }
  function place() {
    if (!T) return;
    const el = target(); if (!el) return;
    const r = el.getBoundingClientRect(), pad = 6, vh = innerHeight;
    const spot = $(".spot", T.el), hand = $(".hand", T.el), bub = $(".bub", T.el);
    Object.assign(spot.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
    Object.assign(hand.style, { left: Math.min(innerWidth - 50, r.left + r.width / 2 - 8) + "px", top: Math.min(vh - 50, r.top + r.height / 2) + "px" });
    const bh = bub.offsetHeight || 150;
    const below = r.bottom + 16 + bh < vh - 8;
    bub.style.top = (below ? r.bottom + 16 : Math.max(8, r.top - bh - 16)) + "px";
  }
  function show(i) {
    const steps = T.steps;
    /* צעד בלי אלמנט נראה — מדלגים, לפי כיוון התנועה */
    const dir = i >= T.i ? 1 : -1;
    while (i >= 0 && i < steps.length && !vis(document.querySelector(steps[i].t))) i += dir;
    if (i < 0) i = T.i;
    if (i >= steps.length) return stop();
    T.i = i;
    const el = target();
    el.scrollIntoView({ block: "center", behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
    const total = steps.filter(s => vis(document.querySelector(s.t))).length;
    const pos = steps.slice(0, i + 1).filter(s => vis(document.querySelector(s.t))).length;
    $(".txt", T.el).textContent = steps[i].m;
    $(".cnt", T.el).textContent = `${pos}/${total}`;
    $(".pv", T.el).style.visibility = pos > 1 ? "visible" : "hidden";
    $(".nx", T.el).textContent = pos >= total ? "סיום" : "הבא";
    requestAnimationFrame(place);
  }

  function start(kind) {
    stop();
    const make = TOURS[kind]; if (!make) return;
    let demo = null;
    if (kind === "daily" && !$("#board .row")) { demo = demoRow(); $("#board").prepend(demo); }
    const el = document.createElement("div");
    el.className = "tour";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "סיור על המסך");
    el.innerHTML = `<div class="spot"></div><div class="hand">${HAND}</div>` +
      `<div class="bub"><button type="button" class="x" aria-label="סיום הסיור">×</button>` +
      `<div class="top"><div class="mas">${MASCOT}</div><div class="txt" aria-live="polite"></div></div>` +
      `<div class="row2"><span class="cnt"></span><button type="button" class="pv">הקודם</button><button type="button" class="nx">הבא</button></div></div>`;
    document.body.appendChild(el);
    T = { steps: make(), i: 0, el, demo };
    el.addEventListener("click", e => {
      if (e.target.closest(".x")) return stop();
      if (e.target.closest(".nx")) return show(T.i + 1);
      if (e.target.closest(".pv")) return show(T.i - 1);
    });
    addEventListener("resize", place); addEventListener("scroll", place, true);
    show(0);
    setTimeout(() => { const b = $(".nx", el); if (b) b.focus({ preventScroll: true }); }, 50);
  }
  addEventListener("keydown", e => {
    if (!T) return;
    if (e.key === "Escape") stop();
    else if (e.key === "ArrowLeft") show(T.i + 1);    // RTL: שמאלה = קדימה
    else if (e.key === "ArrowRight") show(T.i - 1);
  });

  /* כפתור "👆 קח אותי לסיור" בכל חלון הסבר: data-tour="<לשונית>". סוגר את החלון ומתחיל. */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-tour]");
    if (!b) return;
    const m = b.closest(".modal");
    if (m) { m.classList.remove("on"); }
    const v = b.closest(".vmodal"); if (v) v.remove();
    setTimeout(() => start(b.dataset.tour), 120);
  });

  window.SportTour = { start, stop };
})();
