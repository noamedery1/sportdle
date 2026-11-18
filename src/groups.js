/* ============================================================
   קבוצות חברים — תחרות סגורה בין חברים, בלשונית משלה ("קבוצות").

   שני סוגים: **חידה יומית** ו-**3×3**. כל קבוצה שייכת למועדון אחד
   ולסוג אחד; שחקן יכול להיות בכמה קבוצות במקביל, גם של מועדונים
   שונים. בסיום החידה (או ה-3×3) של היום התוצאה נכנסת לבד לכל
   הקבוצות של אותו סוג ואותו מועדון.

   **אפליקציה בלבד בפועל:** באתר אין חידה יומית ואין 3×3 (WEB_GATE),
   ולכן הלשונית שם מסבירה ומפנה לאפליקציה.

   נתונים: Firebase דרך REST, כמו הנדירות של 3×3 — בלי SDK.
     groups/v2/<קוד>/name|host|at|slug|kind   נכתבים פעם אחת
     groups/v2/<קוד>/m/<uid>/n                כינוי
     groups/v2/<קוד>/r/d<יום>/<uid>           תוצאה, פעם אחת:
         daily: 1..12 = הניחוש שבו פיצח, 0 = לא פיצח
         grid:  משבצות*1000 + נדירות (0..9900)
   הקוד גלובלי (לא תחת המועדון), כדי שאפשר להצטרף מכל דף.
   קבוצות מהגרסה הראשונה (groups/v1/<מועדון>/<קוד>, 17/11) ממשיכות
   לעבוד: הרשומה המקומית מסומנת v1. חוקים: config/firebase-rules.json.

   בטיחות (App Store 1.2): סינון כינויים, תנאים, דיווח וחסימה, bans/ —
   דרך window.SportSafety מ-versus.js.

   הסקריפט נטען **לפני** engine.js: restore() קורא ל-finish כבר בטעינה,
   ובלי זה הקבוצות לא הופיעו כשנכנסים מחדש לחידה שכבר נפתרה.
   ============================================================ */
(() => {
  const FBDB = "__FBDB__";
  const ALPH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";   // בלי 0/O ו-1/I/L
  const NICK = "sportdel:groupNick", LIST = "sportdel:groups", RES = "sportdel:groupRes";
  const S = () => window.SportSafety || {};
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const slug = () => (window.SPORTDEL && window.SPORTDEL.slug) || document.documentElement.dataset.club || "";
  const clubName = s => { const c = window.SD && window.SD.clubs && window.SD.clubs[s]; return c ? (c.short || c.he) : s; };
  const native = () => { const C = window.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()); };
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const uid = () => {
    let u = null;
    try { u = localStorage.getItem("sportdel:uid"); } catch (e) {}
    if (!u) { u = Math.random().toString(36).slice(2, 10); try { localStorage.setItem("sportdel:uid", u); } catch (e) {} }
    return u;
  };
  const day = n => "d" + String(n).padStart(5, "0");

  const KIND = {
    daily: { he: "חידה יומית", max: () => (typeof MAX !== "undefined" ? MAX : 8),
             today: () => (typeof todayNo !== "undefined" ? todayNo : 1) },
    grid:  { he: "3×3", max: () => 9,
             /* כמו dayNo ב-grid.js (גריד #1 = 11/11/2026), ועוד 1 — הלוח המוצג */
             today: () => { const d = new Date();
               return Math.max(0, Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(2026, 10, 11)) / 864e5)) + 1; } }
  };

  /* רשימה אחת לכל המועדונים. הגרסה הראשונה שמרה רשימה לכל מועדון — מעבירים פעם אחת. */
  function mine() {
    let a = get(LIST);
    if (!Array.isArray(a)) {
      a = [];
      for (const s of (window.SD && window.SD.order) || []) {
        for (const x of get(`sportdel:${s}:groups`) || []) a.push({ c: x.c, s, k: "daily", name: x.name, v1: true });
      }
      put(LIST, a);
    }
    return a;
  }
  const saveMine = a => put(LIST, a);
  const gp = x => x.v1 ? `groups/v1/${x.s}/${x.c}` : `groups/v2/${x.c}`;

  function fb(path, q = "") {
    let base = FBDB, ns = "";
    try { const e = localStorage.getItem("sportdel:fbEmu");    // בדיקות: tools/fb-emu
          if (e && /^http/.test(FBDB)) { ns = "ns=" + new URL(FBDB).hostname.split(".")[0]; base = "http://" + e; } } catch (e) {}
    if (!/^http/.test(base)) return null;
    const qs = [ns, q].filter(Boolean).join("&");
    return `${base.replace(/\/$/, "")}/${path}.json${qs ? "?" + qs : ""}`;
  }
  async function call(method, path, body) {
    const u = fb(path); if (!u) throw new Error("no db");
    const r = await fetch(u, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error("db " + r.status);
    return r.json();
  }
  async function bans() {
    try { const d = await call("GET", "bans") || {};
          for (const [k, v] of Object.entries(d)) if (v && S().banned) S().banned.add(k); } catch (e) {}
  }

  /* חלון עם שדות. vModal מסיר את החלון בלחיצה, אז הערכים נאספים בזמן ההקלדה. */
  async function ask(html, fields, okLabel) {
    const val = {};
    const inner = html + fields.map(f =>
      `<input class="gin" data-k="${f.k}" maxlength="${f.max}" placeholder="${esc(f.ph)}" value="${esc(f.v || "")}"` +
      ` style="width:100%;box-sizing:border-box;margin-top:10px;padding:11px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:#0f0f12;color:#f2f2f0;font:inherit">`).join("");
    fields.forEach(f => val[f.k] = f.v || "");
    const v = await S().vModal(inner, [{ id: "ok", label: okLabel, primary: true }, { id: "no", label: "ביטול" }], box => {
      box.querySelectorAll(".gin").forEach(i => i.addEventListener("input", () => val[i.dataset.k] = i.value));
      const first = box.querySelector(".gin"); if (first) first.focus();
    });
    return v === "ok" ? val : null;
  }
  const say = html => S().vModal(html, [{ id: "ok", label: "סגירה", primary: true }]);

  async function askNick() {
    let nick = ""; try { nick = localStorage.getItem(NICK) || ""; } catch (e) {}
    for (;;) {
      const r = await ask("<b>הכינוי שלך בקבוצה</b>", [{ k: "n", max: 16, ph: "כינוי", v: nick }], "המשך");
      if (!r) return null;
      nick = r.n.trim();
      if (!nick) continue;
      if (S().isBadNick && S().isBadNick(nick)) { await say("הכינוי הזה לא מתאים. נסו כינוי אחר."); continue; }
      try { localStorage.setItem(NICK, nick); } catch (e) {}
      return nick;
    }
  }

  /* ---------- פרסום תוצאה ---------- */
  const resKey = (k, s) => `${k}:${s}`;
  async function postTo(x) {
    const r = (get(RES) || {})[resKey(x.k, x.s)];
    if (!r || r.n !== KIND[x.k].today()) return;   // רק תוצאה של היום — לא של אתמול שנשמרה
    try { await call("PUT", `${gp(x)}/r/${day(r.n)}/${uid()}`, r.v); } catch (e) {}   // 401 = כבר נכנס
  }
  /** סיום משחק היום: שומר מקומית ומפרסם לכל הקבוצות המתאימות. מחזיר כמה. */
  function post(k, s, n, v) {
    if (!s) return 0;
    const all = get(RES) || {}; all[resKey(k, s)] = { n, v }; put(RES, all);
    const list = mine().filter(x => x.k === k && x.s === s);
    list.forEach(postTo);
    return list.length;
  }

  /* ---------- פתיחה, הצטרפות, יציאה ---------- */
  async function create() {
    if (!native()) return say("קבוצות החברים פועלות באפליקציה.");
    const s = slug();
    if (!window.SD || !window.SD.clubs || !window.SD.clubs[s]) return say("בחרו קודם מועדון (החלפת מועדון למעלה) — כל קבוצה שייכת למועדון אחד.");
    const k = await S().vModal(`<b>קבוצה חדשה של ${esc(clubName(s))}</b><br>על מה מתחרים?`,
      [{ id: "daily", label: "חידה יומית", primary: true }, { id: "grid", label: "3×3" }, { id: "no", label: "ביטול" }]);
    if (k !== "daily" && k !== "grid") return;
    if (S().ensureTerms && !(await S().ensureTerms())) return;
    const g = await ask(`<b>שם לקבוצה</b><br>${KIND[k].he} · ${esc(clubName(s))}. החברים יראו את השם.`, [{ k: "name", max: 24, ph: "למשל: החבר'ה מהשכונה" }], "המשך");
    if (!g || !g.name.trim()) return;
    const name = g.name.trim();
    if (S().isBadNick && S().isBadNick(name)) return say("השם הזה לא מתאים. נסו שם אחר.");
    const nick = await askNick(); if (!nick) return;
    let code = "";
    for (let t = 0; t < 5 && !code; t++) {
      const c = Array.from({ length: 6 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join("");
      try { if (!(await call("GET", `groups/v2/${c}/name`))) code = c; } catch (e) { return say("אין חיבור לשרת. נסו שוב."); }
    }
    try {
      await call("PATCH", `groups/v2/${code}`, { name, host: uid(), slug: s, kind: k, at: { ".sv": "timestamp" }, [`m/${uid()}`]: { n: nick } });
    } catch (e) { return say("לא הצלחנו לפתוח קבוצה. נסו שוב."); }
    const x = { c: code, s, k, name };
    saveMine([...mine(), x]);
    await postTo(x);
    await render();
    invite(x);
  }

  async function join(raw) {
    if (!native()) return say("קבוצות החברים פועלות באפליקציה.");
    let code = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code) {
      const r = await ask("<b>הצטרפות לקבוצה</b><br>הקוד שקיבלתם מחבר.", [{ k: "c", max: 6, ph: "קוד בן 6 תווים" }], "הצטרפות");
      if (!r) return;
      code = r.c.toUpperCase().replace(/[^A-Z0-9]/g, "");
    }
    if (code.length !== 6) return say("קוד קבוצה הוא 6 תווים.");
    if (mine().some(x => x.c === code)) return openTab();
    let x;
    try {
      const [name, s, k] = await Promise.all(["name", "slug", "kind"].map(f => call("GET", `groups/v2/${code}/${f}`)));
      if (name) x = { c: code, s, k, name };
      else {   // קישור ישן מהגרסה הראשונה — הקבוצה יושבת תחת המועדון של הדף
        const old = await call("GET", `groups/v1/${slug()}/${code}/name`);
        if (old) x = { c: code, s: slug(), k: "daily", name: old, v1: true };
      }
    } catch (e) { return say("אין חיבור לשרת. נסו שוב."); }
    if (!x) return say(`לא מצאנו קבוצה עם הקוד <b dir="ltr">${esc(code)}</b>.`);
    await bans();
    if (S().banned && S().banned.has(uid())) return say("הכינוי הזה הורחק בעקבות דיווח. לפניות: techbynoam@gmail.com");
    if (S().ensureTerms && !(await S().ensureTerms())) return;
    const nick = await askNick(); if (!nick) return;
    try { await call("PUT", `${gp(x)}/m/${uid()}`, { n: nick }); } catch (e) { return say("לא הצלחנו להצטרף. נסו שוב."); }
    saveMine([...mine(), x]);
    await postTo(x);
    openTab();
    say(`הצטרפת ל<b>${esc(x.name)}</b> 🎉<br>${KIND[x.k].he} · ${esc(clubName(x.s))}. התוצאה שלך תיכנס לבד בכל יום.`);
  }

  function inviteUrl(x) {
    const base = ((window.SPORTDEL && window.SPORTDEL.siteUrl) || "https://sportdle.techbynoam.com").replace(/\/$/, "");
    return `${base}/${x.s}/?g=${x.c}`;
  }
  function invite(x) {
    const txt = `הצטרפו לקבוצה "${x.name}" ב-SportDle — תחרות ${KIND[x.k].he} של ${clubName(x.s)} 🏆\n` +
      `באפליקציה: לשונית "קבוצות" ← "הצטרפות בקוד" ← ${x.c}\n${inviteUrl(x)}`;
    const u = "https://wa.me/?text=" + encodeURIComponent(txt);
    /* עוגן ולא window.open — כמו openExternal ב-versus.js (ב-WebView open עלול להיות no-op) */
    const a = document.createElement("a"); a.href = u; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function leave(x) {
    const v = await S().vModal("<b>לצאת מהקבוצה?</b><br>התוצאות שכבר נכנסו נשארות בטבלה של החברים.",
      [{ id: "ok", label: "יציאה", primary: true }, { id: "no", label: "ביטול" }]);
    if (v !== "ok") return;
    try { await call("DELETE", `${gp(x)}/m/${uid()}`); } catch (e) {}
    saveMine(mine().filter(y => y.c !== x.c));
    render();
  }

  /* ---------- הטבלה ----------
     יומית: פיצוח ב-k ניחושים = MAX+1-k נקודות, לא פיצח = 0.
     3×3: הנקודות הן סכום הנדירות (עד 900 ללוח).
     הדירוג לפי סך הנקודות מאז ההצטרפות; שוויון — יותר פיצוחים/משבצות. */
  const DAYS = 7;
  function rowsOf(x, g) {
    const max = KIND[x.k].max(), R = g.r || {};
    return Object.entries(g.m || {}).filter(([id]) => !(S().banned && S().banned.has(id))).map(([id, m]) => {
      let games = 0, wins = 0, sumG = 0, p = 0;
      for (const byU of Object.values(R)) {
        const v = byU[id]; if (v == null) continue;
        games++;
        if (x.k === "grid") { wins += Math.floor(v / 1000); p += v % 1000; }
        else { p += v > 0 ? max + 1 - v : 0; if (v > 0) { wins++; sumG += v; } }
      }
      return { id, name: S().dispName ? S().dispName(id, m.n) : m.n, games, wins, avg: wins ? sumG / wins : 0, p };
    }).sort((a, b) => b.p - a.p || b.wins - a.wins || (a.avg || 99) - (b.avg || 99));
  }
  /* שם התשובה רק לחידה יומית שכבר נסגרה, ורק במועדון של הדף (answerFor שייך לו) */
  function answerName(x, n, today) {
    if (x.k !== "daily" || n >= today || x.s !== slug()) return "";
    try { const a = typeof answerFor === "function" ? answerFor(n) : null; return a ? a.name : ""; } catch (e) { return ""; }
  }
  function table(x, g) {
    const me = uid(), R = g.r || {}, rows = rowsOf(x, g), today = KIND[x.k].today(), grid = x.k === "grid";
    const mods = id => id === me ? "" :
      `<span class="mods"><button type="button" data-gmod="report" data-id="${id}">דיווח</button>` +
      `<button type="button" data-gmod="block" data-id="${id}">${S().blocked && S().blocked.has(id) ? "חסום" : "חסימה"}</button></span>`;
    const medal = i => ["🥇", "🥈", "🥉"][i] || String(i + 1);
    const head = grid ? `<th>לוחות</th><th>משבצות</th><th>נק׳</th>` : `<th>חידות</th><th>פיצח</th><th>ממוצע</th><th>נק׳</th>`;
    const lead = `<table class="gtab"><thead><tr><th>#</th><th>שם</th>${head}</tr></thead><tbody>` +
      rows.map((r, i) => `<tr class="${r.id === me ? "me" : ""}"><td>${r.p ? medal(i) : i + 1}</td><td><span class="gnm">${esc(r.name)}</span>${mods(r.id)}</td>` +
        `<td>${r.games}</td><td>${r.wins}</td>` + (grid ? "" : `<td>${r.wins ? r.avg.toFixed(1) : "—"}</td>`) +
        `<td><b>${r.p}</b></td></tr>`).join("") + `</tbody></table>`;
    const days = Array.from({ length: DAYS }, (_, i) => today - i).filter(n => n >= 1);
    const cell = v => v == null ? `<td class="nx">·</td>`
      : grid ? `<td class="ok">${Math.floor(v / 1000)}</td>`
      : v > 0 ? `<td class="ok">${v}</td>` : `<td class="no">✗</td>`;
    const hist = `<div class="ghist"><table class="gtab gday"><thead><tr><th></th>` +
      days.map(n => { const nm = answerName(x, n, today);
        return `<th>${n === today ? "היום" : "#" + n}${nm ? `<i>${esc(nm)}</i>` : ""}</th>`; }).join("") +
      `</tr></thead><tbody>` +
      rows.map(r => `<tr class="${r.id === me ? "me" : ""}"><td>${esc(r.name)}</td>` +
        days.map(n => cell((R[day(n)] || {})[r.id])).join("") + `</tr>`).join("") + `</tbody></table></div>`;
    return lead + `<div class="hd gsub">${DAYS} הימים האחרונים · ${grid ? "המספר = כמה משבצות מילא" : "המספר = באיזה ניחוש פיצח"}</div>` + hist;
  }

  function explain() {
    const max = KIND.daily.max();
    return S().vModal(`<b>איך זה מחושב?</b><br>` +
      `• יש שני סוגי קבוצות: <b>חידה יומית</b> ו-<b>3×3</b>. כל קבוצה שייכת למועדון אחד. אפשר להיות בכמה קבוצות במקביל, גם של מועדונים שונים.<br>` +
      `• כשמסיימים את המשחק של היום, התוצאה נכנסת לבד לכל הקבוצות של אותו סוג ואותו מועדון. מי שמצטרף נספר מאותו יום והלאה.<br>` +
      `• <b>חידה יומית:</b> פיצוח בניחוש הראשון = ${max} נקודות, בשני = ${max - 1}, וכך הלאה. לא פיצח = 0.<br>` +
      `• <b>3×3:</b> הנקודות הן סכום הנדירות של המשבצות שמילאת (עד 900 ללוח) — שחקן שפחות אנשים בחרו שווה יותר.<br>` +
      `• יום שלא שיחקת = 0. הדירוג לפי סך הנקודות; בשוויון — מי שפיצח (או מילא) יותר.<br>` +
      `• ביומן: המספר הוא הניחוש שבו פיצח (או כמה משבצות מילא), ✗ = לא פיצח, · = לא שיחק. שם השחקן מופיע רק אחרי שהחידה נסגרה.<br>` +
      `• משחק מהארכיון לא נספר — רק המשחק של אותו יום.`,
      [{ id: "tour", label: "👆 סיור על המסך" }, { id: "ok", label: "הבנתי", primary: true }])
      .then(v => { if (v === "tour" && window.SportTour) setTimeout(() => window.SportTour.start("groups"), 120); });
  }

  /* ---------- הלשונית ---------- */
  const body = () => $("#groupsBody");
  async function render() {
    const el = body(); if (!el) return;
    const how = `<button type="button" class="glink" data-g="how">איך זה מחושב?</button>`;
    if (!native()) {
      el.innerHTML = `<div class="hd"><b>קבוצות חברים</b> · תחרות סגורה רק לכם על החידה היומית ועל ה-3×3. ${how}</div>` +
        `<div class="hd gweb">הקבוצות פועלות באפליקציה — שם משחקים את החידה היומית ואת ה-3×3. הורידו אותה מהבאנר למטה.</div>`;
      return;
    }
    const actions = `<div class="gact"><button type="button" class="ghost" data-g="create">פתיחת קבוצה</button>` +
      `<button type="button" class="ghost" data-g="join">הצטרפות בקוד</button></div>`;
    const list = mine();
    if (!list.length) {
      el.innerHTML = `<div class="hd"><b>הקבוצות שלי</b> · תחרות סגורה רק לכם: חידה יומית או 3×3, לכל מועדון. ${how}</div>${actions}`;
      return;
    }
    el.innerHTML = `<div class="hd"><b>הקבוצות שלי</b> · טוען…</div>`;
    await bans();
    const parts = await Promise.all(list.map(async x => {
      try {
        const [m, r] = await Promise.all([call("GET", `${gp(x)}/m`), call("GET", `${gp(x)}/r`)]);
        /* הוצאו מהקבוצה (חסימה של המנהל) — יוצאת מהרשימה המקומית */
        if (!m || !m[uid()]) return { x, gone: true };
        return { x, g: { m, r } };
      } catch (e) { return { x, err: true }; }
    }));
    const gone = parts.filter(p => p.gone).map(p => p.x.c);
    if (gone.length) saveMine(mine().filter(x => !gone.includes(x.c)));
    el.innerHTML = `<div class="hd"><b>הקבוצות שלי</b> · ${how}</div>` + actions +
      parts.filter(p => !p.gone).map(p =>
        `<div class="grp1" data-c="${p.x.c}"><div class="hd gtitle"><b>${esc(p.x.name)}</b>` +
        `<span class="gchip">${KIND[p.x.k].he} · ${esc(clubName(p.x.s))}</span> · קוד <b dir="ltr">${p.x.c}</b></div>` +
        (p.err ? `<div class="hd">אין חיבור כרגע.</div>` : table(p.x, p.g)) +
        `<div class="gact"><button type="button" class="ghost" data-g="invite">הזמנת חברים</button>` +
        `<button type="button" class="ghost" data-g="leave">יציאה</button></div></div>`).join("");
  }
  function openTab() {
    const b = document.querySelector('.nav [data-tab="groups"]');
    if (b && !b.classList.contains("on")) b.click(); else render();
  }

  /* שורה קטנה בסוף המשחק — "נכנס ל-N קבוצות · לטבלה" */
  function line(el, n) {
    if (!el) return;
    if (!native()) { el.classList.remove("on"); el.innerHTML = ""; return; }
    el.innerHTML = n
      ? `<button type="button" class="glink" data-g="tab">🏆 התוצאה נכנסה ${n === 1 ? "לקבוצה אחת" : "ל-" + n + " קבוצות"} · לטבלה</button>`
      : `<button type="button" class="glink" data-g="tab">🏆 תחרות עם חברים? הקבוצות שלי</button>`;
    el.classList.add("on");
  }

  document.addEventListener("click", async e => {
    const b = e.target.closest("button[data-g], #groupsBody button[data-gmod]");
    if (!b) return;
    const a = b.dataset.g, card = b.closest(".grp1");
    const x = card ? mine().find(y => y.c === card.dataset.c) : null;
    if (a === "tab") return openTab();
    if (a === "create") return create();
    if (a === "join") return join();
    if (a === "how") return explain();
    if (a === "leave" && x) return leave(x);
    if (a === "invite" && x) return invite(x);
    if (!b.dataset.gmod || !x) return;
    /* דיווח / חסימה — כמו בקרב החברים */
    const id = b.dataset.id, s = S();
    const nm = ((b.closest("td") && b.closest("td").querySelector(".gnm")) || {}).textContent || "";
    if (b.dataset.gmod === "block" && s.blocked.has(id)) { s.blocked.delete(id); s.saveBlocked(); return render(); }
    const rep = b.dataset.gmod === "report";
    const v = await s.vModal(rep
      ? `<b>לדווח על "${esc(nm)}"?</b><br>הדיווח נשלח אלינו ונבדק תוך 24 שעות. השחקן גם ייחסם אצלך.`
      : `<b>לחסום את "${esc(nm)}"?</b><br>הכינוי שלו יוסתר אצלך מיד. אפשר גם לצאת מהקבוצה בכל רגע. החסימה מדווחת גם לנו, ונבדקת תוך 24 שעות.`,
      [{ id: "ok", label: rep ? "דיווח" : "חסימה", primary: true }, { id: "no", label: "ביטול" }]);
    if (v !== "ok") return;
    s.sendReport(id, nm, "קבוצה " + x.c, rep ? "דיווח" : "חסימה");
    s.blocked.add(id); s.saveBlocked();
    /* מנהל הקבוצה מוציא את מי שחסם — הקבוצה כתיבה לכל מי שיודע את הקוד */
    try { const host = await call("GET", `${gp(x)}/host`); if (host === uid()) await call("DELETE", `${gp(x)}/m/${id}`); } catch (e) {}
    render();
  });

  window.SportGroups = {
    /** סיום החידה היומית של היום. g = ניחושים, 0 = לא פיצח. */
    daily(el, n, g) { line(el, post("daily", slug(), n, g)); },
    /** סיום ה-3×3 של היום (גריד מועדון בלבד). n = מספר הלוח המוצג. */
    grid(el, s, n, k, rar) { line(el, post("grid", s, n, k * 1000 + Math.min(900, Math.max(0, Math.round(rar))))); },
    hideLine(el) { if (el) { el.classList.remove("on"); el.innerHTML = ""; } },
    render, explain,
    /** ?g=CODE בכתובת. באפליקציה — מצטרפים; בדפדפן — מסבירים. */
    async invited(code) {
      if (native()) { openTab(); return join(code); }
      if (S().vModal) say(`<b>הוזמנת לקבוצת חברים 🏆</b><br>קבוצות החברים פועלות באפליקציה.` +
        ` הורידו אותה, פתחו את הלשונית "קבוצות" ולחצו "הצטרפות בקוד": <b dir="ltr">${esc(code)}</b>`);
    }
  };

  /* קישור הזמנה: /<מועדון>/?g=CODE. באפליקציה native.js מעביר את g הלאה.
     ההמתנה — vModal ו-SportSafety מגיעים מ-versus.js (module), אחרי כל הסקריפטים. */
  try {
    const g = new URLSearchParams(location.search).get("g");
    if (g) addEventListener("load", () => setTimeout(() => window.SportGroups.invited(g), 600));
  } catch (e) {}
})();
