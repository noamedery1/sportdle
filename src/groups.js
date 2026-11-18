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

     **עונה שבועית** (נועם 18/11: "מה שאנשים אוהבים — תחרות בין החברים
     לאורך זמן"): שבוע = ראשון–שבת. הדירוג הראשי לפי נקודות השבוע; בסוף
     כל שבוע מי שהוביל הוא "אלוף השבוע" 👑 — הכתר ליד השם לכל השבוע
     הבא, וארון הגביעים סופר תארים. הכל מחושב כאן מ-r, בלי שדה חדש בשרת. */
  const DAYS = 7, DAY_MS = 864e5;
  /* תאריך (UTC חצות) של יום n בקבוצה — לפי הלוח של הסוג */
  function dateOf(x, n) {
    if (x.k === "grid") return Date.UTC(2026, 10, 11) + (n - 1) * DAY_MS;
    const st = typeof START !== "undefined" ? START : [2026, 9, 1];
    return Date.UTC(st[0], st[1] - 1, st[2]) + (n - 1) * DAY_MS;
  }
  const weekOf = ms => ms - new Date(ms).getUTCDay() * DAY_MS;          // ראשון של אותו שבוע
  const dm = ms => { const d = new Date(ms); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`; };
  /* ⁦…⁩: טווח תאריכים לטיני בתוך שורה עברית מתהפך ("21/11–15/11") בלי בידוד */
  const weekLabel = w => `⁦${dm(w)}–${dm(w + 6 * DAY_MS)}⁩`;
  const ptsOf = (x, v) => x.k === "grid" ? v % 1000 : (v > 0 ? KIND[x.k].max() + 1 - v : 0);
  const winOf = (x, v) => x.k === "grid" ? Math.floor(v / 1000) : (v > 0 ? 1 : 0);

  function season(x, g) {
    const R = g.r || {}, members = Object.entries(g.m || {}).filter(([id]) => !(S().banned && S().banned.has(id)));
    const ids = members.map(([id]) => id), names = Object.fromEntries(members.map(([id, m]) => [id, S().dispName ? S().dispName(id, m.n) : m.n]));
    const today = KIND[x.k].today(), thisWeek = weekOf(dateOf(x, today));
    const tot = {}, wk = {}, byWeek = {};
    ids.forEach(id => { tot[id] = { games: 0, wins: 0, sumG: 0, p: 0 }; wk[id] = { p: 0, wins: 0 }; });
    for (const [d, byU] of Object.entries(R)) {
      const w = weekOf(dateOf(x, +d.slice(1)));
      for (const id of ids) {
        const v = byU[id]; if (v == null) continue;
        const p = ptsOf(x, v), wn = winOf(x, v), t = tot[id];
        t.games++; t.p += p; t.wins += wn; if (x.k === "daily" && v > 0) t.sumG += v;
        if (w === thisWeek) { wk[id].p += p; wk[id].wins += wn; }
        else if (w < thisWeek) { const b = (byWeek[w] ||= {}); const e = (b[id] ||= { p: 0, wins: 0 }); e.p += p; e.wins += wn; }
      }
    }
    /* אלופי כל שבוע שנגמר: הכי הרבה נקודות, ואז הכי הרבה פיצוחים. תיקו מוחלט — שני אלופים */
    const champs = Object.keys(byWeek).map(Number).sort((a, b) => b - a).map(w => {
      const e = Object.entries(byWeek[w]).filter(([, s]) => s.p > 0);
      if (!e.length) return null;
      const top = Math.max(...e.map(([, s]) => s.p)), c1 = e.filter(([, s]) => s.p === top);
      const tw = Math.max(...c1.map(([, s]) => s.wins));
      return { w, ids: c1.filter(([, s]) => s.wins === tw).map(([id]) => id), p: top };
    }).filter(Boolean);
    const titles = {}; champs.forEach(c => c.ids.forEach(id => titles[id] = (titles[id] || 0) + 1));
    const lastW = thisWeek - 7 * DAY_MS, crowned = new Set((champs.find(c => c.w === lastW) || { ids: [] }).ids);
    const rows = ids.map(id => ({ id, name: names[id], week: wk[id].p, weekWins: wk[id].wins, ...tot[id],
      avg: tot[id].wins && x.k === "daily" ? tot[id].sumG / tot[id].wins : 0, titles: titles[id] || 0, crown: crowned.has(id) }))
      .sort((a, b) => b.week - a.week || b.weekWins - a.weekWins || b.p - a.p);
    return { rows, champs, names, thisWeek, today };
  }

  /* שם התשובה רק לחידה יומית שכבר נסגרה, ורק במועדון של הדף (answerFor שייך לו) */
  function answerName(x, n, today) {
    if (x.k !== "daily" || n >= today || x.s !== slug()) return "";
    try { const a = typeof answerFor === "function" ? answerFor(n) : null; return a ? a.name : ""; } catch (e) { return ""; }
  }

  /* צבע הקבוצה = צבע המועדון שלה (לא של הדף — קבוצת בית"ר בדף מכבי נשארת צהובה) */
  function clubColors(s) {
    const c = (window.SD && window.SD.clubs && window.SD.clubs[s] && window.SD.clubs[s].colors) || {};
    const bg = c.brand || "var(--brand)", hex = /^#([0-9a-f]{6})$/i.exec(c.brand || "");
    let fg = "#121214";
    if (hex) { const n = parseInt(hex[1], 16), l = (0.299 * (n >> 16) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255; if (l < 0.55) fg = "#fff"; }
    return { bg, fg };
  }

  /* ---------- חלונית תחתונה (bottom sheet) ----------
     לתפריט ⋯ של קבוצה ולראש בראש. מחזירה את מזהה הפריט שנבחר, או null.
     "חזור" באנדרואיד סוגר אותה (native.js מחפש .gsheet). */
  function sheet(head, items, color) {
    return new Promise(res => {
      const w = document.createElement("div");
      w.className = "gsheet";
      w.innerHTML = `<div class="gscrim"></div><div class="gbs" role="dialog" aria-modal="true" style="--gc:${color || "var(--brand)"}">` +
        `<div class="grab"></div>${head}<div class="glist">` +
        items.map(i => `<button type="button" data-v="${i.id}" class="${i.danger ? "danger" : ""}">${i.label}</button>`).join("") +
        `</div></div>`;
      const done = v => { w.remove(); res(v); };
      w.addEventListener("click", e => {
        const b = e.target.closest("[data-v]");
        if (b) return done(b.dataset.v);
        if (e.target === w || e.target.classList.contains("gscrim")) done(null);
      });
      document.body.appendChild(w);
      const f = w.querySelector(".glist button"); if (f) setTimeout(() => f.focus({ preventScroll: true }), 30);
    });
  }

  function table(x, g) {
    const me = uid(), R = g.r || {}, grid = x.k === "grid", S1 = season(x, g), { rows, today } = S1;
    const medal = i => ["🥇", "🥈", "🥉"][i] || String(i + 1);
    const lead = `<div class="gweek"><span>השבוע ${weekLabel(S1.thisWeek)}</span><span>👑 מוכתר ביום ראשון</span></div>` +
      `<table class="lb"><thead><tr><th></th><th>שם</th><th>השבוע</th><th>סה״כ</th><th>👑</th></tr></thead><tbody>` +
      rows.map((r, i) => `<tr class="${r.id === me ? "me" : ""}"><td>${r.week ? medal(i) : i + 1}</td>` +
        `<td class="nm"><button type="button" data-g="h2h" data-id="${r.id}"><span class="gnm">${esc(r.name)}</span>${r.crown ? " 👑" : ""}${r.id === me ? " <i>(אני)</i>" : ""}</button></td>` +
        `<td class="wk">${r.week}</td><td class="dim">${r.p}</td><td class="dim">${r.titles || "—"}</td></tr>`).join("") + `</tbody></table>`;
    const days = Array.from({ length: DAYS }, (_, i) => today - i).filter(n => n >= 1);
    const cell = v => v == null ? `<td class="nx">·</td>`
      : grid ? `<td class="ok">${Math.floor(v / 1000)}</td>`
      : v > 0 ? `<td class="ok">${v}</td>` : `<td class="no">✗</td>`;
    const hist = `<div class="ghist"><table class="gtab gday"><thead><tr><th></th>` +
      days.map(n => { const nm = answerName(x, n, today);
        return `<th>${n === today ? "היום" : "#" + n}${nm ? `<i>${esc(nm)}</i>` : ""}</th>`; }).join("") +
      `</tr></thead><tbody>` +
      rows.map(r => `<tr class="${r.id === me ? "me" : ""}"><td>${esc(r.name)}</td>` +
        days.map(n => cell((R[day(n)] || {})[r.id])).join("") + `</tr>`).join("") + `</tbody></table></div>` +
      `<div class="gnote">${grid ? "המספר = כמה משבצות מילא" : "המספר = באיזה ניחוש פיצח · ✗ לא פיצח"} · · לא שיחק</div>`;
    const cab = S1.champs.length
      ? `<ul class="gcabl">` + S1.champs.slice(0, 26).map(c => `<li><span>${weekLabel(c.w)}</span> <b>👑 ${c.ids.map(id => esc(S1.names[id] || "")).join(" + ")}</b> · ${c.p} נק׳</li>`).join("") + `</ul>`
      : `<div class="gnote">יתמלא בסוף השבוע הראשון.</div>`;
    return lead +
      `<details class="more-sec"><summary>${DAYS} הימים האחרונים</summary>${hist}</details>` +
      `<details class="more-sec"><summary>🏆 ארון הגביעים${S1.champs.length ? ` · ${S1.champs.length} שבועות` : ""}</summary>${cab}</details>`;
  }

  /* שורת סיכום לקבוצה מקופלת: המקום שלי, הנקודות שלי, מי מוביל */
  function summary(x, g) {
    const S1 = season(x, g), me = uid(), i = S1.rows.findIndex(r => r.id === me), r = S1.rows[i], top = S1.rows[0];
    if (!r) return "";
    return `אתה <b>#${i + 1}</b> השבוע · <b>${r.week}</b> נק׳` + (top && top.id !== me && top.week ? ` · מוביל: ${esc(top.name)}` : "");
  }

  /* ---------- ראש בראש (חלונית תחתונה, עם דיווח וחסימה) ----------
     כל יום ששניכם שיחקתם: מי קיבל יותר נקודות. */
  function record(x, g, a, b) {
    let w = 0, l = 0, t = 0;
    for (const byU of Object.values(g.r || {})) {
      const va = byU[a], vb = byU[b]; if (va == null || vb == null) continue;
      const pa = ptsOf(x, va), pb = ptsOf(x, vb); pa > pb ? w++ : pa < pb ? l++ : t++;
    }
    return { w, l, t };
  }
  async function h2h(x, g, other) {
    const me = uid(), S1 = season(x, g), col = clubColors(x.s).bg;
    if (other === me) {
      const rs = S1.rows.filter(r => r.id !== me).map(r => {
        const { w, l, t } = record(x, g, me, r.id);
        return `<li><b>${esc(r.name)}</b><span>${w}–${l}${t ? ` · ${t} תיקו` : ""}</span></li>`;
      });
      return sheet(`<h3>ראש בראש — אתה מול כולם</h3><div class="gsub2">ניצחונות–הפסדים, בכל יום ששניכם שיחקתם</div>` +
        `<ul class="gvs">${rs.join("") || "<li>עוד אין חברים בקבוצה.</li>"}</ul>`, [{ id: "x", label: "סגירה" }], col);
    }
    const nm = S1.names[other] || "", { w, l, t } = record(x, g, me, other), n = w + l + t;
    const verdict = !n ? "עוד לא שיחקתם באותו יום." : w > l ? "אתה מוביל 💪" : w < l ? `${esc(nm)} מוביל 👀` : "שוויון מוחלט 🤝";
    const s = S(), isBlocked = s.blocked && s.blocked.has(other);
    const v = await sheet(`<h3>אתה מול ${esc(nm)}</h3><div class="gsub2">כל יום ששניכם שיחקתם — מי קיבל יותר נקודות</div>` +
      (n ? `<div class="gscore"><div><b>${w}</b>אתה</div><div class="dash">–</div><div><b>${l}</b>${esc(nm)}</div></div>${t ? `<div class="gsub2 c">${t} תיקו</div>` : ""}` : "") +
      `<div class="gsub2 c">${verdict}</div>`,
      [{ id: "report", label: "🚩 דיווח על הכינוי" },
       { id: "block", label: isBlocked ? "↩️ ביטול חסימה" : `⛔ חסימת ${esc(nm)}`, danger: !isBlocked }], col);
    if (v === "report" || v === "block") return moderate(x, other, nm, v);
  }

  /* דיווח / חסימה — כמו בקרב החברים */
  async function moderate(x, id, nm, kind) {
    const s = S();
    if (kind === "block" && s.blocked.has(id)) { s.blocked.delete(id); s.saveBlocked(); return render(); }
    const rep = kind === "report";
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
  }

  /* תפריט ⋯ של קבוצה */
  async function menu(x) {
    const v = await sheet(`<h3>${esc(x.name)}</h3><div class="gsub2">${KIND[x.k].he} · ${esc(clubName(x.s))} · קוד <b dir="ltr">${x.c}</b></div>`,
      [{ id: "copy", label: "🔗 העתקת קוד הקבוצה" }, { id: "nick", label: "✏️ שינוי הכינוי שלי" },
       { id: "how", label: "ℹ️ איך זה מחושב?" }, { id: "leave", label: "🚪 יציאה מהקבוצה", danger: true }], clubColors(x.s).bg);
    if (v === "copy") {
      try { await navigator.clipboard.writeText(x.c); say(`הקוד <b dir="ltr">${x.c}</b> הועתק.`); }
      catch (e) { say(`קוד הקבוצה: <b dir="ltr">${x.c}</b>`); }
    } else if (v === "nick") {
      const nick = await askNick(); if (!nick) return;
      try { await call("PUT", `${gp(x)}/m/${uid()}`, { n: nick }); } catch (e) { return say("לא הצלחנו לשנות. נסו שוב."); }
      render();
    } else if (v === "how") explain();
    else if (v === "leave") leave(x);
  }

  /* ---------- "מי עוד לא שיחק היום" ---------- */
  function nudge(x, g) {
    const me = uid(), S1 = season(x, g), today = (g.r || {})[day(S1.today)] || {};
    const missing = S1.rows.filter(r => r.id !== me && today[r.id] == null).map(r => r.name);
    if (!missing.length) return S().vModal("כולם כבר שיחקו היום 💪", [{ id: "ok", label: "סגירה", primary: true }]);
    const txt = `${missing.join(", ")} — עוד לא שיחקתם היום ב"${x.name}" 👀\n${KIND[x.k].he} · ${clubName(x.s)} · SportDle\n${inviteUrl(x)}`;
    const a = document.createElement("a"); a.href = "https://wa.me/?text=" + encodeURIComponent(txt); a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- תמונת "טבלת השבוע" לוואטסאפ ---------- */
  async function shareCard(x, g, btn) {
    const S1 = season(x, g), cs = getComputedStyle(document.documentElement);
    const brand = cs.getPropertyValue("--brand").trim() || "#FFC72C", onB = cs.getPropertyValue("--on-brand").trim() || "#121214";
    try { await Promise.all(['400 90px "Suez One"', '800 60px Heebo', '500 40px Heebo'].map(f => document.fonts.load(f))); } catch (e) {}
    const rows = S1.rows.slice(0, 8), W = 1080, H = 560 + rows.length * 110;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d"); c.direction = "rtl"; c.textAlign = "center";
    c.fillStyle = "#0C0C0E"; c.fillRect(0, 0, W, H);
    c.fillStyle = brand; c.fillRect(0, 0, W, 16);
    c.fillStyle = brand; c.font = `400 86px "Suez One", serif`; c.fillText(x.name, W / 2, 140);
    c.fillStyle = "#A0A0A8"; c.font = `500 40px Heebo, sans-serif`;
    c.fillText(`טבלת השבוע ${weekLabel(S1.thisWeek)} · ${KIND[x.k].he} · ${clubName(x.s)}`, W / 2, 210);
    rows.forEach((r, i) => {
      const y = 290 + i * 110;
      c.fillStyle = i === 0 ? brand : "#1C1C21"; c.beginPath(); c.roundRect(70, y, W - 140, 90, 22); c.fill();
      const ink = i === 0 ? onB : "#EDEDEF";
      c.fillStyle = ink; c.font = `800 52px Heebo, sans-serif`;
      c.textAlign = "right"; c.fillText(`${["🥇", "🥈", "🥉"][i] || i + 1}  ${r.name}${r.crown ? " 👑" : ""}`, W - 110, y + 63);
      c.textAlign = "left"; c.fillText(String(r.week), 110, y + 63);
      c.textAlign = "center";
    });
    const last = S1.champs[0];
    c.fillStyle = "#A0A0A8"; c.font = `500 38px Heebo, sans-serif`;
    if (last) c.fillText(`👑 אלוף ${weekLabel(last.w)}: ${last.ids.map(id => S1.names[id]).join(" + ")}`, W / 2, H - 150);
    c.fillStyle = brand; c.font = `800 44px Heebo, sans-serif`; c.fillText("sportdle.techbynoam.com", W / 2, H - 70);
    const name = `sportdle-week-${x.c}.png`, text = `טבלת השבוע ב"${x.name}" 🏆 מי מוריד את ${rows[0] ? rows[0].name : "המוביל"} מהפסגה?\n${inviteUrl(x)}`;
    const C = window.Capacitor, P = C && C.isNativePlatform && C.isNativePlatform() ? (C.Plugins || {}) : null;
    const was = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = "מכין…"; }
    try {
      if (P && P.Filesystem && P.Share) {
        const { uri } = await P.Filesystem.writeFile({ path: name, data: cv.toDataURL("image/png").split(",")[1], directory: "CACHE" });
        await P.Share.share({ files: [uri], text, dialogTitle: "טבלת השבוע" });
      } else {
        const blob = await new Promise(res => cv.toBlob(res, "image/png"));
        const file = new File([blob], name, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text });
        else { const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
      }
    } catch (e) { /* ביטול שיתוף */ }
    finally { if (btn) { btn.disabled = false; btn.textContent = was; } }
  }

  function explain() {
    const max = KIND.daily.max();
    return S().vModal(`<b>איך זה מחושב?</b><br>` +
      `• יש שני סוגי קבוצות: <b>חידה יומית</b> ו-<b>3×3</b>. כל קבוצה שייכת למועדון אחד. אפשר להיות בכמה קבוצות במקביל, גם של מועדונים שונים.<br>` +
      `• כשמסיימים את המשחק של היום, התוצאה נכנסת לבד לכל הקבוצות של אותו סוג ואותו מועדון. מי שמצטרף נספר מאותו יום והלאה.<br>` +
      `• <b>חידה יומית:</b> פיצוח בניחוש הראשון = ${max} נקודות, בשני = ${max - 1}, וכך הלאה. לא פיצח = 0.<br>` +
      `• <b>3×3:</b> הנקודות הן סכום הנדירות של המשבצות שמילאת (עד 900 ללוח) — שחקן שפחות אנשים בחרו שווה יותר.<br>` +
      `• <b>עונה שבועית:</b> הטבלה מדורגת לפי נקודות השבוע (ראשון–שבת) ומתאפסת ביום ראשון. מי שסיים ראשון הוא <b>אלוף השבוע 👑</b> — הכתר ליד השם כל השבוע הבא, והתואר נשמר ב"ארון הגביעים". בשוויון — מי שפיצח (או מילא) יותר; אם עדיין שוויון — שני אלופים.<br>` +
      `• <b>סה״כ</b> = כל הנקודות מאז ההצטרפות. יום שלא שיחקת = 0.<br>` +
      `• <b>ראש בראש:</b> לחיצה על שם מראה את המאזן מולו — בכל יום ששניכם שיחקתם, מי קיבל יותר נקודות.<br>` +
      `• ביומן: המספר הוא הניחוש שבו פיצח (או כמה משבצות מילא), ✗ = לא פיצח, · = לא שיחק. שם השחקן מופיע רק אחרי שהחידה נסגרה.<br>` +
      `• משחק מהארכיון לא נספר — רק המשחק של אותו יום.`,
      [{ id: "tour", label: "👆 סיור על המסך" }, { id: "ok", label: "הבנתי", primary: true }])
      .then(v => { if (v === "tour" && window.SportTour) setTimeout(() => window.SportTour.start("groups"), 120); });
  }

  /* ---------- הלשונית ----------
     היררכיה (סקירת UX 18/11): למעלה הפעולות הכלליות (קבוצה חדשה /
     הצטרפות) בסגנון אחר; כל קבוצה כרטיס משלה עם פס בצבע המועדון שלה,
     ⋯ לתפריט, ופעולות הקבוצה בתחתית הכרטיס. קבוצה שאינה הראשונה —
     מקופלת לשורת סיכום (הפתוחות נזכרות ב-localStorage). */
  const body = () => $("#groupsBody");
  const DATA = {};   // קוד → { m, r } מהטעינה האחרונה (לתמונה, לתזכורת ולראש בראש)
  const OPEN = "sportdel:groupsOpen";
  const openSet = list => { const o = get(OPEN); return new Set(Array.isArray(o) ? o : list.slice(0, 1).map(x => x.c)); };
  async function render() {
    const el = body(); if (!el) return;
    const how = `<button type="button" class="glink" data-g="how">איך זה מחושב?</button>`;
    const top = `<div class="gtop"><h2>הקבוצות שלי</h2>${how}</div>`;
    if (!native()) {
      el.innerHTML = top + `<div class="gempty gweb">תחרות סגורה רק לכם על החידה היומית ועל ה-3×3.<br>` +
        `<b>הקבוצות פועלות באפליקציה</b> — שם משחקים את החידה היומית ואת ה-3×3. הורידו אותה מהבאנר למטה.</div>`;
      return;
    }
    const global = `<div class="gglobal"><button type="button" class="plus" data-g="create">＋ קבוצה חדשה</button>` +
      `<button type="button" data-g="join">הצטרפות בקוד</button></div>`;
    const list = mine();
    if (!list.length) {
      el.innerHTML = top + `<div class="gempty">🏆 <b>תחרות סגורה רק לכם ולחברים</b><br>חידה יומית או 3×3 · טבלה שבועית עם אלוף 👑 · ראש בראש.<br>פתחו קבוצה ושלחו את הקישור בוואטסאפ.</div>` + global;
      return;
    }
    el.innerHTML = top + global + `<div class="gnote">טוען…</div>`;
    await bans();
    const parts = await Promise.all(list.map(async x => {
      try {
        const [m, r] = await Promise.all([call("GET", `${gp(x)}/m`), call("GET", `${gp(x)}/r`)]);
        /* הוצאו מהקבוצה (חסימה של המנהל) — יוצאת מהרשימה המקומית */
        if (!m || !m[uid()]) return { x, gone: true };
        DATA[x.c] = { m, r };
        return { x, g: { m, r } };
      } catch (e) { return { x, err: true }; }
    }));
    const gone = parts.filter(p => p.gone).map(p => p.x.c);
    if (gone.length) saveMine(mine().filter(x => !gone.includes(x.c)));
    const open = openSet(list);
    el.innerHTML = top + global + parts.filter(p => !p.gone).map(p => {
      const { x, g } = p, c = clubColors(x.s), isOpen = open.has(x.c) || p.err;
      const members = g ? Object.keys(g.m || {}).length : 0;
      const head = `<header class="gcard-h"><button type="button" class="gtog" data-g="toggle" aria-expanded="${isOpen}">` +
        `<span class="n">${esc(x.name)}</span><span class="s"><span class="pill" style="background:${c.bg};color:${c.fg}">${KIND[x.k].he} · ${esc(clubName(x.s))}</span>` +
        `<span>${members ? members + " חברים · " : ""}קוד <b class="code" dir="ltr">${x.c}</b></span></span></button>` +
        `<button type="button" class="gmore" data-g="menu" aria-label="עוד פעולות לקבוצה">⋯</button></header>`;
      const inner = p.err ? `<div class="gnote">אין חיבור כרגע.</div>`
        : isOpen ? table(x, g) +
            `<div class="gfoot"><button type="button" class="pri" data-g="invite">הזמנת חברים</button>` +
            `<button type="button" class="sec" data-g="card">📸 טבלה</button><button type="button" class="sec" data-g="nudge">👀 מי לא שיחק</button></div>`
        : `<button type="button" class="gsum" data-g="toggle"><span>${summary(x, g)}</span><span aria-hidden="true">▾</span></button>`;
      return `<section class="gcard${isOpen ? "" : " collapsed"}" data-c="${x.c}" style="--gc:${c.bg}">${head}${inner}</section>`;
    }).join("");
  }
  function toggle(x) {
    const o = openSet(mine());
    o.has(x.c) ? o.delete(x.c) : o.add(x.c);
    put(OPEN, [...o]);
    render();
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
    const b = e.target.closest("button[data-g]");
    if (!b) return;
    const a = b.dataset.g, card = b.closest(".gcard");
    const x = card ? mine().find(y => y.c === card.dataset.c) : null;
    if (a === "tab") return openTab();
    if (a === "create") return create();
    if (a === "join") return join();
    if (a === "how") return explain();
    if (!x) return;
    if (a === "toggle") return toggle(x);
    if (a === "menu") return menu(x);
    if (a === "invite") return invite(x);
    if (DATA[x.c]) {
      if (a === "card") return shareCard(x, DATA[x.c], b);
      if (a === "nudge") return nudge(x, DATA[x.c]);
      if (a === "h2h") return h2h(x, DATA[x.c], b.dataset.id);
    }
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
