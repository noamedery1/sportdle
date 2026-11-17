/* ============================================================
   קבוצות חברים — טבלה סגורה של החידה היומית, לכל מועדון בנפרד.

   ביקשו את זה אוהדים: "תחרות פנימית בין חברים". מי שבקבוצה וסיים את
   החידה של היום — התוצאה שלו נכנסת לבד, והטבלה מראה מי פיצח ובכמה,
   ומי מוביל ב-7 וב-30 הימים האחרונים.

   **אפליקציה בלבד בפועל:** באתר אין חידה יומית (WEB_GATE), ולכן גם אין
   מה לפרסם. קישור הזמנה שנפתח בדפדפן מסביר את זה ומפנה לאפליקציה.

   נתונים: Firebase דרך REST, כמו הנדירות של 3×3 — בלי ה-SDK ובלי
   מאזין חי. הטבלה נמשכת כשפותחים אותה.
     groups/v1/<מועדון>/<קוד>/name|host|at       נכתבים פעם אחת
     groups/v1/<מועדון>/<קוד>/m/<uid>/n          כינוי
     groups/v1/<מועדון>/<קוד>/r/d<חידה>/<uid>    1..12 = ניחושים, 0 = לא פיצח
   החוקים ב-config/firebase-rules.json (groups). תוצאה לא נדרסת ולא נמחקת.

   בטיחות (App Store 1.2): אותם כלים של קרב החברים — סינון כינויים,
   תנאים, דיווח וחסימה, ו-bans/ — דרך window.SportSafety מ-versus.js.
   ============================================================ */
(() => {
  const FBDB = "__FBDB__";
  const ALPH = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";   // בלי 0/O ו-1/I/L
  const NICK = "sportdel:groupNick";
  const S = () => window.SportSafety || {};
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const slug = () => (window.SPORTDEL && window.SPORTDEL.slug) || "beitar";
  const native = () => { const C = window.Capacitor; return !!(C && C.isNativePlatform && C.isNativePlatform()); };
  const uid = () => {
    let u = null;
    try { u = localStorage.getItem("sportdel:uid"); } catch (e) {}
    if (!u) { u = Math.random().toString(36).slice(2, 10); try { localStorage.setItem("sportdel:uid", u); } catch (e) {} }
    return u;
  };
  const KEY = () => `sportdel:${slug()}:groups`;
  const mine = () => { try { return JSON.parse(localStorage.getItem(KEY())) || []; } catch (e) { return []; } };
  const saveMine = a => { try { localStorage.setItem(KEY(), JSON.stringify(a)); } catch (e) {} };
  const day = n => "d" + String(n).padStart(5, "0");

  function fb(path, q = "") {
    let base = FBDB, ns = "";
    try { const e = localStorage.getItem("sportdel:fbEmu");    // בדיקות: tools/fb-emu
          if (e && /^http/.test(FBDB)) { ns = "ns=" + new URL(FBDB).hostname.split(".")[0]; base = "http://" + e; } } catch (e) {}
    if (!/^http/.test(base)) return null;
    const qs = [ns, q].filter(Boolean).join("&");
    return `${base.replace(/\/$/, "")}/groups/v1/${slug()}/${path}.json${qs ? "?" + qs : ""}`;
  }
  async function call(method, path, body, q) {
    const u = fb(path, q); if (!u) throw new Error("no db");
    const r = await fetch(u, { method, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error("db " + r.status);
    return r.json();
  }
  async function bans() {
    try {
      const u = fb("x").replace(/groups\/v1\/[^/]+\/x\.json/, "bans.json");
      const d = await (await fetch(u)).json() || {};
      for (const [k, v] of Object.entries(d)) if (v && S().banned) S().banned.add(k);
    } catch (e) {}
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

  /* התוצאה של היום — נשמרת מקומית כדי לפרסם גם בקבוצה שמצטרפים אליה אחרי הסיום */
  const RES = () => `sportdel:${slug()}:groupRes`;
  function lastResult() { try { return JSON.parse(localStorage.getItem(RES())) || null; } catch (e) { return null; } }
  async function postTo(code, res) {
    if (!res) return;
    try { await call("PUT", `${code}/r/${day(res.n)}/${uid()}`, res.g); } catch (e) {}   // 401 = כבר פורסם
  }

  async function create() {
    if (S().ensureTerms && !(await S().ensureTerms())) return;
    const g = await ask("<b>קבוצה חדשה</b><br>שם לקבוצה — החברים יראו אותו.", [{ k: "name", max: 24, ph: "למשל: החבר'ה מהשכונה" }], "המשך");
    if (!g || !g.name.trim()) return;
    if (S().isBadNick && S().isBadNick(g.name)) return say("השם הזה לא מתאים. נסו שם אחר.");
    const nick = await askNick(); if (!nick) return;
    let code = "";
    for (let t = 0; t < 5 && !code; t++) {
      const c = Array.from({ length: 6 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join("");
      try { if (!(await call("GET", `${c}/name`))) code = c; } catch (e) { return say("אין חיבור לשרת. נסו שוב."); }
    }
    try {
      await call("PATCH", code, { name: g.name.trim(), host: uid(), at: { ".sv": "timestamp" }, [`m/${uid()}`]: { n: nick } });
    } catch (e) { return say("לא הצלחנו לפתוח קבוצה. נסו שוב."); }
    saveMine([...mine(), { c: code, name: g.name.trim() }]);
    await postTo(code, lastResult());
    await show();
    invite(code, g.name.trim());
  }

  async function join(raw) {
    let code = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code) {
      const r = await ask("<b>הצטרפות לקבוצה</b><br>הקוד שקיבלתם מחבר.", [{ k: "c", max: 6, ph: "קוד בן 6 תווים" }], "הצטרפות");
      if (!r) return;
      code = r.c.toUpperCase().replace(/[^A-Z0-9]/g, "");
    }
    if (code.length !== 6) return say("קוד קבוצה הוא 6 תווים.");
    if (mine().some(x => x.c === code)) return show();
    let name;
    try { name = await call("GET", `${code}/name`); } catch (e) { return say("אין חיבור לשרת. נסו שוב."); }
    if (!name) return say(`לא מצאנו קבוצה עם הקוד <b>${esc(code)}</b> במועדון הזה.`);
    await bans();
    if (S().banned && S().banned.has(uid())) return say("הכינוי הזה הורחק בעקבות דיווח. לפניות: techbynoam@gmail.com");
    if (S().ensureTerms && !(await S().ensureTerms())) return;
    const nick = await askNick(); if (!nick) return;
    try { await call("PUT", `${code}/m/${uid()}`, { n: nick }); } catch (e) { return say("לא הצלחנו להצטרף. נסו שוב."); }
    saveMine([...mine(), { c: code, name }]);
    await postTo(code, lastResult());
    if (ctx) show();
    else say(`הצטרפת ל<b>${esc(name)}</b> 🎉<br>הטבלה מופיעה בסוף החידה היומית.`);
  }

  function inviteUrl(code) {
    const base = ((window.SPORTDEL && window.SPORTDEL.siteUrl) || "https://sportdle.techbynoam.com").replace(/\/$/, "");
    return `${base}/${slug()}/?g=${code}`;
  }
  function invite(code, name) {
    const txt = `הצטרפו לקבוצה "${name}" ב-SportDle — טבלה סגורה של החידה היומית 🏆\n` +
      `באפליקציה: חידה יומית ← אחרי הסיום ← "הצטרפות בקוד" ← ${code}\n${inviteUrl(code)}`;
    const u = "https://wa.me/?text=" + encodeURIComponent(txt);
    /* עוגן ולא window.open — כמו openExternal ב-versus.js (ב-WebView open עלול להיות no-op) */
    const a = document.createElement("a"); a.href = u; a.target = "_blank"; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
  }

  async function leave(code) {
    const v = await S().vModal("<b>לצאת מהקבוצה?</b><br>התוצאות שכבר נכנסו נשארות בטבלה של החברים.",
      [{ id: "ok", label: "יציאה", primary: true }, { id: "no", label: "ביטול" }]);
    if (v !== "ok") return;
    try { await call("DELETE", `${code}/m/${uid()}`); } catch (e) {}
    saveMine(mine().filter(x => x.c !== code));
    show();
  }

  /* ניקוד: פיצוח ב-k ניחושים = MAX+1-k נקודות, כישלון = 0.
     התחרות היא על סך הנקודות מאז שכל אחד הצטרף: מי ששיחק כל יום וגם
     פיצח מהר — מוביל. שוויון: יותר פיצוחים, ואז ממוצע ניחושים נמוך. */
  const DAYS = 7;
  const pts = (v, max) => v > 0 ? max + 1 - v : 0;
  function rowsOf(g, max) {
    const R = g.r || {};
    return Object.entries(g.m || {}).filter(([id]) => !(S().banned && S().banned.has(id))).map(([id, m]) => {
      let games = 0, wins = 0, sumG = 0, p = 0;
      for (const byU of Object.values(R)) {
        const v = byU[id]; if (v == null) continue;
        games++; p += pts(v, max);
        if (v > 0) { wins++; sumG += v; }
      }
      return { id, name: S().dispName ? S().dispName(id, m.n) : m.n, games, wins, avg: wins ? sumG / wins : 0, p };
    }).sort((a, b) => b.p - a.p || b.wins - a.wins || (a.avg || 99) - (b.avg || 99));
  }
  /* שם התשובה רק לחידה שכבר נסגרה. החידה של היום עדיין באוויר אצל אחרים. */
  function answerName(n, today) {
    if (n >= today) return "";
    try { const a = typeof answerFor === "function" ? answerFor(n) : null; return a ? a.name : ""; } catch (e) { return ""; }
  }
  function table(g, today, max) {
    const me = uid(), R = g.r || {}, rows = rowsOf(g, max);
    const mods = id => id === me ? "" :
      `<span class="mods"><button type="button" data-gmod="report" data-id="${id}">דיווח</button>` +
      `<button type="button" data-gmod="block" data-id="${id}">${S().blocked && S().blocked.has(id) ? "חסום" : "חסימה"}</button></span>`;
    const medal = i => ["🥇", "🥈", "🥉"][i] || String(i + 1);
    const lead = `<table class="gtab"><thead><tr><th>#</th><th>שם</th><th>חידות</th><th>פיצח</th><th>ממוצע</th><th>נק׳</th></tr></thead><tbody>` +
      rows.map((r, i) => `<tr class="${r.id === me ? "me" : ""}"><td>${r.p ? medal(i) : i + 1}</td><td><span class="gnm">${esc(r.name)}</span>${mods(r.id)}</td>` +
        `<td>${r.games}</td><td>${r.wins}</td><td>${r.wins ? r.avg.toFixed(1) : "—"}</td><td><b>${r.p}</b></td></tr>`).join("") + `</tbody></table>`;
    /* יומן: עמודה לכל חידה מ-DAYS האחרונות, היום מימין */
    const days = Array.from({ length: DAYS }, (_, i) => today - i).filter(n => n >= 1);
    const cell = v => v == null ? `<td class="nx">·</td>` : v > 0 ? `<td class="ok">${v}</td>` : `<td class="no">✗</td>`;
    const hist = `<div class="ghist"><table class="gtab gday"><thead><tr><th></th>` +
      days.map(n => { const nm = answerName(n, today);
        return `<th>${n === today ? "היום" : "#" + n}${nm ? `<i>${esc(nm)}</i>` : ""}</th>`; }).join("") +
      `</tr></thead><tbody>` +
      rows.map(r => `<tr class="${r.id === me ? "me" : ""}"><td>${esc(r.name)}</td>` +
        days.map(n => cell((R[day(n)] || {})[r.id])).join("") + `</tr>`).join("") + `</tbody></table></div>`;
    return lead + `<div class="hd gsub">${DAYS} החידות האחרונות · המספר = באיזה ניחוש פיצח</div>` + hist;
  }

  function explain(max) {
    return S().vModal(`<b>איך זה מחושב?</b><br>` +
      `• כל מי שבקבוצה ומסיים את החידה היומית — התוצאה שלו נכנסת לבד. מי שמצטרף נספר מאותו יום והלאה.<br>` +
      `• <b>נקודות:</b> פיצוח בניחוש הראשון = ${max}, בשני = ${max - 1}, וכך הלאה עד ניחוש ${max} = 1. לא פיצח = 0. יום שלא שיחקת = 0.<br>` +
      `• <b>הדירוג</b> לפי סך הנקודות. בשוויון — מי שפיצח יותר, ואז מי שהממוצע שלו נמוך יותר.<br>` +
      `• <b>חידות</b> = כמה שיחק, <b>פיצח</b> = כמה פתר, <b>ממוצע</b> = ניחושים בממוצע בחידות שפתר.<br>` +
      `• ביומן: המספר הוא הניחוש שבו פיצח, ✗ = לא פיצח, · = לא שיחק. שם השחקן מופיע רק אחרי שהחידה נסגרה — בחידה של היום רק "היום".<br>` +
      `• חידה מהארכיון לא נספרת — רק החידה של אותו יום.`,
      [{ id: "ok", label: "הבנתי", primary: true }]);
  }

  let ctx = null;   // { el, today, max }
  async function show() {
    if (!ctx) return;
    const { el, today, max } = ctx, list = mine();
    const actions = `<div class="gact"><button type="button" class="ghost" data-g="create">פתיחת קבוצה</button>` +
      `<button type="button" class="ghost" data-g="join">הצטרפות בקוד</button></div>`;
    const how = `<button type="button" class="glink" data-g="how">איך זה מחושב?</button>`;
    if (!list.length) {
      el.innerHTML = `<div class="hd"><b>קבוצת חברים</b> · תחרות סגורה רק לכם: מי פיצח, בכמה ניסיונות, ומי מוביל. ${how}</div>${actions}`;
      el.classList.add("on"); return;
    }
    el.innerHTML = `<div class="hd"><b>קבוצות החברים</b> · טוען…</div>`;
    el.classList.add("on");
    await bans();
    const parts = await Promise.all(list.map(async x => {
      try {
        const [m, r] = await Promise.all([call("GET", `${x.c}/m`), call("GET", `${x.c}/r`)]);
        /* הוצאו (חסימה של מנהל, או שהמזהה הוסר) — הקבוצה יוצאת מהרשימה המקומית */
        if (!m || !m[uid()]) return { x, gone: true };
        return { x, g: { m, r } };
      } catch (e) { return { x, err: true }; }
    }));
    const gone = parts.filter(p => p.gone).map(p => p.x.c);
    if (gone.length) saveMine(mine().filter(x => !gone.includes(x.c)));
    if (!ctx || ctx.el !== el) return;
    el.innerHTML = parts.filter(p => !p.gone).map(p =>
      `<div class="grp1"><div class="hd"><b>${esc(p.x.name)}</b> · קוד <b dir="ltr">${p.x.c}</b> · ${how}</div>` +
      (p.err ? `<div class="hd">אין חיבור כרגע.</div>` : table(p.g, today, max)) +
      `<div class="gact"><button type="button" class="ghost" data-g="invite" data-c="${p.x.c}">הזמנת חברים</button>` +
      `<button type="button" class="ghost" data-g="leave" data-c="${p.x.c}">יציאה</button></div></div>`).join("") + actions;
  }

  document.addEventListener("click", async e => {
    const b = e.target.closest("#grp button[data-g], #grp button[data-gmod]");
    if (!b) return;
    const a = b.dataset.g, c = b.dataset.c;
    if (a === "create") return create();
    if (a === "join") return join();
    if (a === "leave") return leave(c);
    if (a === "invite") return invite(c, (mine().find(x => x.c === c) || {}).name || "");
    if (a === "how") return explain(ctx ? ctx.max : 8);
    /* דיווח / חסימה — כמו בקרב החברים */
    const id = b.dataset.id, s = S();
    const nm = ((b.closest("td") && b.closest("td").querySelector(".gnm")) || {}).textContent || "";
    const grp = b.closest(".grp1"), code = grp ? grp.querySelector("b[dir]").textContent : "";
    if (b.dataset.gmod === "block" && s.blocked.has(id)) { s.blocked.delete(id); s.saveBlocked(); return show(); }
    const rep = b.dataset.gmod === "report";
    const v = await s.vModal(rep
      ? `<b>לדווח על "${esc(nm)}"?</b><br>הדיווח נשלח אלינו ונבדק תוך 24 שעות. השחקן גם ייחסם אצלך.`
      : `<b>לחסום את "${esc(nm)}"?</b><br>הכינוי שלו יוסתר אצלך מיד. אפשר גם לצאת מהקבוצה בכל רגע. החסימה מדווחת גם לנו, ונבדקת תוך 24 שעות.`,
      [{ id: "ok", label: rep ? "דיווח" : "חסימה", primary: true }, { id: "no", label: "ביטול" }]);
    if (v !== "ok") return;
    s.sendReport(id, nm, "קבוצה " + code, rep ? "דיווח" : "חסימה");
    s.blocked.add(id); s.saveBlocked();
    /* מנהל הקבוצה מוציא את מי שחסם — הקבוצה כתיבה לכל מי שיודע את הקוד */
    try { const host = await call("GET", `${code}/host`); if (host === uid()) await call("DELETE", `${code}/m/${id}`); } catch (e) {}
    show();
  });

  /* קישור הזמנה: /<מועדון>/?g=CODE. באפליקציה native.js מעביר את g הלאה. */
  try {
    const g = new URLSearchParams(location.search).get("g");
    if (g) setTimeout(() => window.SportGroups.invited(g), 900);
  } catch (e) {}

  window.SportGroups = {
    /** אחרי סיום החידה של היום (אפליקציה). g = ניחושים, 0 = לא פיצח. */
    async done(el, n, g, max) {
      if (!el) return;
      try { localStorage.setItem(RES(), JSON.stringify({ n, g })); } catch (e) {}
      ctx = { el, today: n, max };
      await Promise.all(mine().map(x => postTo(x.c, { n, g })));
      show();
    },
    hide() { ctx = null; },
    /** ?g=CODE בכתובת. באפליקציה — מצטרפים; בדפדפן — מסבירים. */
    async invited(code) {
      if (native()) return join(code);
      await new Promise(r => setTimeout(r, 400));   // vModal מגיע מ-versus.js (module) — אחרי הסקריפטים הרגילים
      if (S().vModal) say(`<b>הוזמנת לקבוצת חברים 🏆</b><br>קבוצות החברים והחידה היומית פועלות באפליקציה.` +
        ` הורידו אותה, סיימו את החידה של היום, ולחצו "הצטרפות בקוד": <b dir="ltr">${esc(code)}</b>`);
    }
  };
})();
