/* ============================================================
   grid.js — גריד 3×3: הליבה (בלי DOM).

   ---------- הרעיון ----------
   שורות ועמודות הן תנאים ("שיחק בבית"ר", "זר", "שוער"...).
   ממלאים כל משבצת בשחקן שעונה על **שני** התנאים. 9 ניחושים.
   שחקן אחד לא יכול להופיע פעמיים.

   ---------- נגזר, לא כתוב ביד ----------
   כמו quiz.js: אין קובץ גרידים. הגריד של יום N נגזר מהמאגר
   שכבר בדף, דטרמיניסטית מ-N, וגם התשובות הנכונות.

   ---------- זהות שחקן בין מועדונים ----------
   כל מועדון הוא מאגר נפרד, ולכן "אותו שחקן" = אותו שם **ואותה
   שנת לידה**. שם זהה עם לידה שונה (רפי כהן 1965/1970) = שני
   אנשים. רשומה בלי שנת לידה מצטרפת רק אם יש לשם בדיוק קבוצת
   לידה אחת — אחרת היא נשארת לבד (זהיר: עדיף לפסול תשובה נכונה
   נדירה מאשר לקבל שגויה).

   רץ גם ב-Node (tools/grid-check.mjs) — ולכן אין כאן window.
   ============================================================ */
(function (root) {
  "use strict";

  const POS_HE = { GK: "שוער", DF: "שחקן הגנה", MF: "קשר", FW: "חלוץ" };
  const DECADES = [1970, 1980, 1990, 2000, 2010, 2020];

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- אינדקס אנשים ---------- */
  function buildIndex(SD) {
    const rows = [];
    for (const slug of SD.order) {
      const c = SD.clubs[slug];
      const league = (c.titles && c.titles.league) || [];
      for (const p of c.players) rows.push({ slug, short: c.short || c.he, p, league });
    }
    const byName = new Map();
    for (const r of rows) {
      if (!byName.has(r.p.he)) byName.set(r.p.he, []);
      byName.get(r.p.he).push(r);
    }
    const people = [];
    for (const [name, rs] of byName) {
      const groups = new Map();                   // born -> rows
      const loose = [];
      for (const r of rs) {
        if (r.p.born) {
          if (!groups.has(r.p.born)) groups.set(r.p.born, []);
          groups.get(r.p.born).push(r);
        } else loose.push(r);
      }
      if (groups.size === 1) groups.values().next().value.push(...loose);
      else for (const r of loose) groups.set("?" + people.length + r.slug, [r]);
      const many = groups.size > 1;
      for (const g of groups.values()) people.push(person(name, g, many));
    }
    /* נבחרת: רק מי שכבר קיים במועדונים (השורות הן תמיד מועדונים) */
    const nat = SD.teams && SD.teams.israel;
    if (nat) for (const np of nat.players) {
      const hit = people.filter(x => x.name === np.he && (!np.born || !x.born || x.born === np.born));
      if (hit.length === 1) { hit[0].caps = np.caps || 1; }
    }
    /* "זר" = אין שום סימן לאזרחות ישראלית. nat במאגר הוא לעתים ארץ הלידה
       של עולה (שלום אביטן נולד במרסיי), ולכן: רשומה אחת עם IL, או הופעה
       בנבחרת — והוא אינו זר. ponytail: עולה בלי הופעות שכל רשומותיו לא-IL
       עדיין ייחשב זר; הדגל foreign של ההתאחדות יסגור את זה. */
    for (const x of people) x.foreign = x.foreign && !x.il && !x.caps;
    /* תווית ייחודית — היא המפתח של ההתקדמות השמורה (מזהים זזים בעדכון) */
    const seen = new Map();
    for (const x of people) { const k = seen.get(x.label) || 0; seen.set(x.label, k + 1); if (k) x.label += " #" + (k + 1); }
    people.forEach((x, i) => x.id = i);
    return { people };
  }

  function person(name, rs, many) {
    const born = (rs.find(r => r.p.born) || {}).p?.born || null;
    const x = {
      name, born, label: many && born ? name + " (" + born + ")" : name,
      clubs: new Set(), pos: null, foreign: false, seasons: 0, caps: 0, aliases: [],
      /* עשור ואליפות נבדקים **באותו מועדון** של המשבצת: "ב"ש × שנות
         ה-70" אינו "שיחק בב"ש, ובשנות ה-70 במקום כלשהו" (מלמיליאן:
         בית"ר בשנות ה-70, ב"ש רק ב-1993). */
      dec: {}, champ: new Set()
    };
    for (const { slug, p, league } of rs) {
      x.clubs.add(slug);
      x.pos = x.pos || p.pos;
      if (p.nat === "IL" || (p.nats || []).includes("IL")) x.il = true;
      else if (p.nat) x.foreign = true;
      const ds = x.dec[slug] = x.dec[slug] || new Set();
      for (const [a, b] of p.spells) {
        x.seasons += b - a + 1;
        /* spells בשנת סיום העונה (2009/10 = 2010); העשור לפי שנת הפתיחה */
        for (const d of DECADES) if (a - 1 <= d + 9 && b - 1 >= d) ds.add(d);
        /* אליפות = עונה שבה המועדון זכה והשחקן היה בסגל */
        if (league.some(y => y >= a && y <= b)) x.champ.add(slug);
      }
      for (const al of p.aliases || []) x.aliases.push(al);
    }
    return x;
  }

  /* ---------- תנאים ---------- */
  function conditions(SD) {
    const out = SD.order.map(s => ({
      id: "club:" + s, kind: "club", he: SD.clubs[s].short || SD.clubs[s].he,
      slug: s, test: x => x.clubs.has(s)
    }));
    out.push({ id: "foreign", kind: "attr", he: "שחקן זר", test: x => x.foreign });
    /* "with" — תנאי שנבדק מול המועדון שבשורה (row.slug) */
    out.push({ id: "champ", kind: "attr", he: "זכה באליפות", with: (x, s) => x.champ.has(s) });
    if (SD.teams && SD.teams.israel)
      out.push({ id: "nat", kind: "attr", he: "שיחק בנבחרת", test: x => x.caps > 0 });
    for (const p of ["GK", "FW"])
      out.push({ id: "pos:" + p, kind: "attr", he: POS_HE[p], test: x => x.pos === p });
    for (const d of DECADES)
      out.push({ id: "dec:" + d, kind: "attr", he: "בשנות ה-" + (d < 2000 ? String(d).slice(2) : d), with: (x, s) => !!(x.dec[s] && x.dec[s].has(d)) });
    return out;
  }

  const known = x => x.seasons >= 4 || x.caps >= 5;

  /* home — מועדון הבית בגריד מועדון: כל תשובה היא שחקן שלו, ועשור/אליפות
     נבדקים בו. בלי home (גריד משותף) a הוא המועדון שבשורה. */
  function valid(x, a, b, home) {
    const h = home || a;
    if (!h.test(x)) return false;
    const ok = c => c === h || (c.with ? c.with(x, h.slug) : c.test(x));
    return ok(a) && ok(b);
  }
  function answers(idx, a, b, home) { return idx.people.filter(x => valid(x, a, b, home)); }

  /* ---------- הגריד של יום n ----------
     שורות: 3 מועדונים. עמודות: מועדון אחד או שניים (אחרים) + תכונות.
     כל משבצת: לפחות 3 תשובות, ולפחות אחת של שחקן מוכר. */
  const MIN_ANS = 3;
  const hash = s => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
  function makeGrid(idx, conds, n, homeSlug) {
    const r = rng(n * 2654435761 + 97 + (homeSlug ? hash(homeSlug) : 0));
    const pick = (arr, k) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a.slice(0, k);
    };
    const home = homeSlug ? conds.find(c => c.slug === homeSlug) : null;
    const clubs = conds.filter(c => c.kind === "club" && c !== home);
    const attrs = conds.filter(c => c.kind === "attr");
    const isDec = c => c.id.startsWith("dec:");
    for (let t = 0; t < 600; t++) {
      let rows, cols;
      if (home) {
        /* גריד מועדון: שורות = תכונות. עמודות = 0–2 מועדונים אחרים + תכונות.
           מועדונים רק בציר אחד — "שיחק בבית"ר, במכבי ובחיפה" קשה מדי. */
        rows = pick(attrs, 3);
        const rest = attrs.filter(c => !rows.includes(c));
        const k = Math.floor(r() * 3);
        cols = pick([...pick(clubs, k), ...pick(rest, 3 - k)], 3);
      } else {
        rows = pick(clubs, 3);
        const rest = clubs.filter(c => !rows.includes(c));
        const k = 1 + Math.floor(r() * 2);
        cols = pick([...pick(rest, k), ...pick(attrs, 3 - k)], 3);
      }
      /* עשור אחד לכל היותר בגריד — שניים הם כמעט אותו תנאי פעמיים */
      if ([...rows, ...cols].filter(isDec).length > 1) continue;
      const cells = [];
      let ok = true;
      for (const a of rows) {
        for (const b of cols) {
          const ans = answers(idx, a, b, home);
          if (ans.length < MIN_ANS || !ans.some(known)) { ok = false; break; }
          cells.push(ans.length);
        }
        if (!ok) break;
      }
      if (ok) return { n, home, rows, cols, sizes: cells };
    }
    return null;
  }


  /* "נדירות" אופליין: כמה מוכר השחקן ביחס לשאר התשובות במשבצת.
     ponytail: פרוקסי מקומי (עונות). הנדירות האמיתית — אחוז מי
     שבחר אותו — דורשת ספירה ב-Firebase; לא מחובר עדיין. */
  function rarity(idx, a, b, x, home) {
    const ans = answers(idx, a, b, home).sort((p, q) => q.seasons - p.seasons);
    const i = ans.findIndex(p => p.id === x.id);
    return Math.round(100 * (i + 1) / ans.length);   // 1..100, גבוה = נדיר
  }

  /* ============================================================
     ממשק (רק בדפדפן)
     ============================================================ */
  /* גריד #1 = 11/11/2026. מספור משלו, לא של החידה היומית. */
  const START = Date.UTC(2026, 10, 11);
  const KEY = "sportdel:grid:";
  const norm = t => t.toLowerCase().replace(/[-־–—]/g, " ").replace(/['"״׳’]/g, "").replace(/\s+/g, " ").trim();
  let G = null;   // { idx, grid, st, sel }

  function dayNo() {
    const d = new Date();
    return Math.max(0, Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - START) / 86400000));
  }
  /* ההתקדמות נשמרת לפי **תווית** השחקן ולא לפי מזהה: המזהה הוא מיקום
     במאגר, ועדכון נתונים (boot.js, בפתיחה הבאה) מזיז אותו. החתימה היא
     התנאים בלבד — ומאז לוח הגרידים הם לא משתנים בעדכון. */
  function load(k, sig) {
    try {
      const v = JSON.parse(localStorage.getItem(k));
      if (v && v.cells && v.sig === sig) {
        /* תווית שנעלמה בעדכון נתונים — המשבצת נשארת מלאה בשם שנשמר */
        v.cells = v.cells.map(c => { if (!c) return null; const x = IDX.people.find(p => p.label === c.k); return { id: x ? x.id : null, k: c.k, rar: c.rar }; });
        return v;
      }
    } catch (e) {}
    return { sig, cells: Array(9).fill(null), left: 9, reveal: false };
  }
  function save() { try { localStorage.setItem(G.key, JSON.stringify(G.st)); } catch (e) {} }
  const $ = s => document.querySelector(s);
  const cellConds = i => [G.grid.rows[Math.floor(i / 3)], G.grid.cols[i % 3]];
  const done = () => G.st.left <= 0 || G.st.cells.every(Boolean);

  /* גריד מועדון: המועדון שנבחר בדף (applyTheme ב-engine.js מציב data-club).
     נבחרת / בלי מועדון → הגריד המשותף. */
  let IDX = null, CONDS = null, wired = false;
  /* באתר — כמו החידה היומית (#46, engine.js WEB_GATE): הלוח של היום מוצג
     כטיזר, והמילוי רק באפליקציה. אותו מתג: בלי חנות live (#appban .stores)
     אין חסימה. */
  const GATE = () => { const C = window.Capacitor;
    if (C && C.isNativePlatform && C.isNativePlatform()) return false;
    return !!document.querySelector("#appban .stores"); };
  function gateNote() {
    if (document.getElementById("gGate")) return;
    const el = document.createElement("div");
    el.id = "gGate"; el.className = "appban";
    el.innerHTML = '<b>לוח 3×3 של היום — רק באפליקציה</b><span class="wgTxt">כל יום לוח חדש לכל מועדון. מלאו אותו באפליקציה, בחינם.</span>' +
      '<span class="stores">' + document.querySelector("#appban .stores").innerHTML + '</span>';
    $("#gBoard").before(el);
  }
  function boot() {
    const cur = document.documentElement.dataset.club || "";
    const slug = window.SD.clubs[cur] ? cur : null;
    if (!G || G.slug !== slug) {
      IDX = IDX || buildIndex(window.SD); CONDS = CONDS || conditions(window.SD);
      const n = dayNo(), saved = slug && window.SD.grids && window.SD.grids[slug] && window.SD.grids[slug][n];
      const grid = (saved && fromIds(CONDS, saved, slug, n)) || makeGrid(IDX, CONDS, n, slug);
      if (!grid) { $("#gNo").textContent = "אין גריד היום"; return; }   // build.mjs מוודא שלא קורה
      const sig = [...grid.rows, ...grid.cols].map(c => c.id).join("|");
      const key = KEY + (slug || "all") + ":" + n;
      G = { idx: IDX, grid, slug, key, st: load(key, sig), sel: -1 };
      $("#gNo").textContent = "לוח #" + (n + 1);
      $("#gWho").textContent = grid.home ? "שחקני " + grid.home.he + " בלבד · " : "";
      msg("");
      if (!wired) { wire(); wired = true; }
      if (GATE()) { G.gate = true; gateNote(); }
    }
    render();
  }
  /* החלפת מועדון כשהלשונית פתוחה */
  if (typeof MutationObserver !== "undefined" && typeof document !== "undefined")
    new MutationObserver(() => { const v = document.getElementById("gridView");
      if (G && v && !v.classList.contains("hide")) boot(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-club"] });

  function render() {
    const { grid, st, idx } = G;
    const b = $("#gBoard"); b.textContent = "";
    const h = (t) => { const d = document.createElement("div"); d.className = "gh"; d.textContent = t; return d; };
    b.appendChild(h(grid.home ? grid.home.he : ""));
    grid.cols.forEach(c => b.appendChild(h(c.he)));
    for (let r = 0; r < 3; r++) {
      b.appendChild(h(grid.rows[r].he));
      for (let c = 0; c < 3; c++) {
        const i = r * 3 + c, v = st.cells[i];
        const el = document.createElement("button");
        el.type = "button"; el.className = "gc"; el.dataset.i = i;
        const [A, B] = cellConds(i);
        if (v) {
          const label = v.id != null ? idx.people[v.id].label : v.k;
          el.classList.add("ok"); el.disabled = true;
          el.innerHTML = "<span></span><span class=r></span>";
          el.firstChild.textContent = label;
          el.lastChild.textContent = "נדירות " + v.rar + "%";
          el.setAttribute("aria-label", A.he + " × " + B.he + ": " + label);
        } else if (st.reveal) {
          el.classList.add("ans"); el.disabled = true;
          const top = answers(idx, A, B, grid.home).sort((p, q) => q.seasons - p.seasons).slice(0, 3);
          el.textContent = top.map(x => x.label).join(" · ");
        } else {
          el.disabled = done() || !!G.gate;
          el.setAttribute("aria-label", A.he + " × " + B.he);
          if (i === G.sel) el.classList.add("sel");
        }
        b.appendChild(el);
      }
    }
    $("#gLeft").textContent = st.left;
    const fin = done();
    if (fin) G.sel = -1;
    $("#gPick").hidden = fin || G.sel < 0 || !!G.gate;
    $("#gEnd").hidden = !fin;
    if (fin) {
      const k = st.cells.filter(Boolean).length;
      const rar = st.cells.filter(Boolean).reduce((s, v) => s + v.rar, 0);
      $("#gScore").textContent = k + "/9 · נדירות " + rar;
      $("#gReveal").hidden = st.reveal;
    }
  }

  function pickCell(i) {
    G.sel = i;
    const [A, B] = cellConds(i);
    $("#gNow").textContent = A.he + " × " + B.he;
    msg("");
    render();
    const inp = $("#gGuess"); inp.value = ""; suggest(""); inp.focus();
    /* במובייל המקלדת מכסה את ההצעות שמתחת לשדה — מעלים את השדה לראש המסך */
    setTimeout(() => $("#gPick").scrollIntoView({ block: "start", behavior: "smooth" }), 300);
  }

  function suggest(q) {
    const box = $("#gSugg"); box.textContent = "";
    const nq = norm(q);
    if (nq.length < 2) { box.classList.remove("on"); return; }
    const used = new Set(G.st.cells.filter(Boolean).map(v => v.id));
    const hits = G.idx.people.filter(x =>
      norm(x.name).includes(nq) || x.aliases.some(a => norm(a).includes(nq))).slice(0, 8);
    for (const x of hits) {
      const btn = document.createElement("button");
      btn.type = "button"; btn.setAttribute("role", "option");
      if (used.has(x.id)) { btn.disabled = true; btn.textContent = x.label + " — כבר בלוח"; }
      else { btn.textContent = x.label; btn.addEventListener("click", () => guess(x)); }
      box.appendChild(btn);
    }
    box.classList.toggle("on", hits.length > 0);
  }

  function msg(t, bad) { const m = $("#gMsg"); m.textContent = t; m.className = bad ? "bad" : ""; }

  function guess(x) {
    const i = G.sel; if (i < 0 || done()) return;
    const box = $("#gSugg"); box.classList.remove("on"); box.textContent = "";
    const [A, B] = cellConds(i);
    G.st.left--;
    const ok = valid(x, A, B, G.grid.home);
    if (ok) {
      G.st.cells[i] = { id: x.id, k: x.label, rar: rarity(G.idx, A, B, x, G.grid.home) };
      G.sel = -1; msg("✓ " + x.label);
    } else { msg("✗ " + x.label + " — " + whyNot(x, A, B), true); $("#gGuess").value = ""; }
    save(); render();
    if (!ok) {
      const el = document.querySelector('#gBoard .gc[data-i="' + i + '"]'); if (el) el.classList.add("bad");
      if (!done()) $("#gGuess").focus();   // המקלדת נשארת פתוחה לניחוש הבא
    }
  }

  function whyNot(x, A, B) {
    const h = G.grid.home || A;
    if (!h.test(x)) return "לא שיחק ב" + h.he;
    const why = c => c.kind === "club" ? "לא שיחק ב" + c.he
      : c.with ? "לא " + c.he + " ב" + h.he : "לא " + c.he;
    return [A, B].filter(c => c !== h && !valid(x, c, c, h)).map(why).join(", ");
  }

  function shareText() {
    const sq = G.st.cells.map(v => v ? "🟩" : "⬛");
    const k = G.st.cells.filter(Boolean).length;
    return "ספורטדל 3×3" + (G.grid.home ? " · " + G.grid.home.he : "") + " · לוח #" + (G.grid.n + 1) + " · " + k + "/9\n" +
      sq.slice(0, 3).join("") + "\n" + sq.slice(3, 6).join("") + "\n" + sq.slice(6).join("") +
      "\n" + link();
  }

  /* ---------- שיתוף ----------
     באפליקציה window.open הוא no-op שקט ב-WebView של אנדרואיד, ו-navigator.share
     עם קובץ נכשל (ראה native.js סעיפים 3, 3ב). לכן: באפליקציה — location.href
     לוואטסאפ, ו-Filesystem+Share לתמונה. בדפדפן — window.open ו-navigator.share. */
  const SITE = "https://sportdle.techbynoam.com";
  const CAP = () => { const C = window.Capacitor; return C && C.isNativePlatform && C.isNativePlatform() ? (C.Plugins || {}) : null; };
  const link = () => SITE + "/" + (G.slug ? G.slug + "/" : "") + "#grid";

  function openWa() {
    const url = "https://wa.me/?text=" + encodeURIComponent(shareText());
    if (CAP()) location.href = url; else window.open(url, "_blank", "noopener");
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }

  /* כרטיס 1080×1920 (סטורי/סטטוס). בלי שמות שחקנים — רק אילו משבצות
     מולאו, כדי לא לשרוף לחברים. התנאים כן מופיעים: הם מה שמסקרן. */
  async function cardCanvas() {
    /* fonts.ready לא מספיק: Suez One לא נטען עד שמשהו מבקש אותו, והכרטיס
       הראשון בסשן יצא בגופן סריף (QA סבב 3) */
    try { await Promise.all(['400 120px "Suez One"', '800 96px Heebo', '500 46px Heebo'].map(f => document.fonts.load(f))); await document.fonts.ready; } catch (e) {}
    const W = 1080, H = 1920, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    const club = G.slug ? window.SD.clubs[G.slug] : null;
    const C = (club && club.colors) || {};
    const ink = C.ink || "#0C0C0E", brand = C.brand || "#FFC72C";
    const dim = "#8C8C94", text = "#F2F2F0", empty = "#24242A";
    ctx.fillStyle = ink; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = brand; ctx.lineWidth = 6; rr(ctx, 40, 40, W - 80, H - 80, 44); ctx.stroke();
    ctx.textAlign = "center";
    try { ctx.direction = "rtl"; } catch (e) {}

    ctx.fillStyle = brand; ctx.font = `900 120px "Suez One", serif`;
    ctx.fillText(club ? club.game : "SportDle", W / 2, 260);
    ctx.fillStyle = dim; ctx.font = `500 54px Heebo, sans-serif`;
    ctx.fillText("3×3 · לוח #" + (G.grid.n + 1), W / 2, 346);

    const k = G.st.cells.filter(Boolean).length;
    const rar = G.st.cells.filter(Boolean).reduce((s, v) => s + v.rar, 0);
    ctx.fillStyle = text; ctx.font = `800 96px Heebo, sans-serif`;
    ctx.fillText(k + "/9", W / 2, 490);
    ctx.fillStyle = dim; ctx.font = `500 46px Heebo, sans-serif`;
    ctx.fillText("נדירות " + rar, W / 2, 560);

    /* הלוח: תוויות השורות בימין (RTL), כמו על המסך */
    const cell = 200, gap = 18, lab = 210;
    const gw = lab + 3 * cell + 3 * gap, x0 = (W - gw) / 2, y0 = 760;
    const colX = c => x0 + (2 - c) * (cell + gap);          // עמודה 0 צמודה לתוויות
    const wrap = (t, x, y, max) => {                        // עד שתי שורות
      const words = t.split(" "); let line = "", lines = [];
      for (const w of words) { const tr = line ? line + " " + w : w;
        if (ctx.measureText(tr).width > max && line) { lines.push(line); line = w; } else line = tr; }
      lines.push(line); lines = lines.slice(0, 2);
      lines.forEach((l, i) => ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * 44));
    };
    ctx.fillStyle = text; ctx.font = `800 38px Heebo, sans-serif`;
    G.grid.cols.forEach((c, i) => wrap(c.he, colX(i) + cell / 2, y0 - 70, cell));
    for (let r = 0; r < 3; r++) {
      const y = y0 + r * (cell + gap);
      ctx.fillStyle = text; ctx.font = `800 38px Heebo, sans-serif`;
      wrap(G.grid.rows[r].he, x0 + 3 * (cell + gap) + lab / 2, y + cell / 2 + 14, lab - 10);
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = G.st.cells[r * 3 + c] ? brand : empty;
        rr(ctx, colX(c), y, cell, cell, 28); ctx.fill();
      }
    }

    ctx.fillStyle = text; ctx.font = `700 50px Heebo, sans-serif`;
    ctx.fillText("מה אתם הייתם עונים?", W / 2, y0 + 3 * (cell + gap) + 130);
    ctx.font = `700 46px Heebo, sans-serif`;
    ctx.fillText(SITE.replace(/^https?:\/\//, ""), W / 2, H - 130);
    return cv;
  }

  async function shareImage() {
    const cv = await cardCanvas();
    const name = "sportdle-grid-" + (G.slug || "all") + "-" + (G.grid.n + 1) + ".png";
    const P = CAP();
    if (P && P.Filesystem && P.Share) {
      const data = cv.toDataURL("image/png").split(",")[1];
      const { uri } = await P.Filesystem.writeFile({ path: name, data, directory: "CACHE" });
      await P.Share.share({ files: [uri], text: link(), dialogTitle: "שיתוף 3×3" });
      return "shared";
    }
    const blob = await new Promise(res => cv.toBlob(res, "image/png"));
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: link() });
      return "shared";
    }
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return "downloaded";
  }

  function wire() {
    const gh = $("#gHelp");
    $("#gHelpBtn").addEventListener("click", () => gh.classList.add("on"));
    $("#gHelpClose").addEventListener("click", () => gh.classList.remove("on"));
    gh.addEventListener("click", e => { if (e.target === gh) gh.classList.remove("on"); });
    /* בפעם הראשונה — ההסבר נפתח מעצמו */
    try { if (!localStorage.getItem(KEY + "seenHelp")) { gh.classList.add("on"); localStorage.setItem(KEY + "seenHelp", "1"); } } catch (e) {}
    $("#gBoard").addEventListener("click", e => {
      const el = e.target.closest(".gc"); if (el && !el.disabled) pickCell(+el.dataset.i);
    });
    const inp = $("#gGuess");
    inp.addEventListener("input", () => suggest(inp.value));
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter") { const f = $("#gSugg.on button:not([disabled])"); if (f) f.click(); }
    });
    $("#gWa").addEventListener("click", openWa);
    $("#gStory").addEventListener("click", async () => {
      const btn = $("#gStory"), was = btn.textContent;
      btn.disabled = true; btn.textContent = "מכין…";
      try { const how = await shareImage(); btn.textContent = how === "shared" ? was : "ירד למחשב ✓"; }
      catch (e) {
        const cancel = (e && e.name === "AbortError") || /cancel/i.test(String(e && (e.message || e)));
        btn.textContent = cancel ? was : "לא הצלחנו לייצר תמונה";
        if (!cancel) console.warn("grid card:", e);
      } finally { btn.disabled = false; setTimeout(() => btn.textContent = was, 2400); }
    });
    $("#gReveal").addEventListener("click", () => { G.st.reveal = true; save(); render(); });
  }

  /* גריד מלוח התנאים השמור (build.mjs → config/grid-schedule.json) */
  function fromIds(conds, str, slug, n) {
    const by = id => conds.find(c => c.id === id);
    const [r, c] = String(str).split("|").map(t => t.split(",").map(by));
    if (!r || !c || r.length !== 3 || c.length !== 3 || [...r, ...c].some(x => !x)) return null;
    return { n, home: slug ? conds.find(x => x.slug === slug) : null, rows: r, cols: c };
  }

  const api = { fromIds, cardCanvas: () => cardCanvas(), buildIndex, conditions, makeGrid, answers, valid, rarity, known, POS_HE,
                boot: () => { if (typeof document !== "undefined") boot(); } };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SportGrid = api;
})(typeof window !== "undefined" ? window : globalThis);
