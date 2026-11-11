/* ============================================================
   ttt.js — איקס-עיגול 3×3 בתוך קרב חברים.

   ---------- הרעיון ----------
   שני שחקנים, לוח 3×3 של תנאים (אותו מחולל של 3×3, src/grid.js).
   בתור שלך בוחרים משבצת ומקלידים שחקן: תשובה נכונה תופסת אותה
   בצבע שלך, טעות או זמן שנגמר — התור עובר. שלוש בשורה מנצחות;
   לוח מלא, או 6 תורות ברצף בלי תשובה נכונה (מבוי סתום) — מי שתפס
   יותר. אותו שחקן לא נספר פעמיים בלוח.

   ---------- איפה המצב ----------
   rooms/v2/<code>/ttt — אובייקט אחד, וכל מהלך הוא runTransaction
   עליו. כך שני לקוחות לא יכולים לשחק באותו תור: הטרנזקציה בודקת
   שהתור שלי ושהמשבצת ריקה, ואחרת לא נוגעת. גם "הזמן נגמר" הוא
   טרנזקציה שכל לקוח רשאי להריץ — אבל רק אם ה-deadline לא השתנה
   מאז שראה אותו, ולכן היא לא מקדמת פעמיים.
   השדה דורש שורה בחוקי הפיירבייס (config/firebase-rules.json).

   ---------- הממשק ל-versus.js ----------
   versus.js מחזיק את החדר, השחקנים והלובי. כאן רק הלוח. מקבלים
   ctx עם פונקציות הפיירבייס והמצב, ומחזירים start / render / reset.
   ============================================================ */
(function () {
  "use strict";
  const TURN_MS = 20000;
  const STALL = 6;                        // תורות ברצף בלי תשובה נכונה → מסיימים
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const norm = t => t.toLowerCase().replace(/[-־–—]/g, " ").replace(/['"״׳’]/g, "").replace(/\s+/g, " ").trim();
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

  let IDX = null, CONDS = null;
  const idx = () => (IDX ||= window.SportGrid.buildIndex(window.SD));
  const conds = () => (CONDS ||= window.SportGrid.conditions(window.SD));
  const hash = s => [...String(s)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;

  function create(ctx) {
    let sel = -1, timer = null, wired = false, lastKey = "", prev = null;

    /* ---------- לוח חדש ----------
       לא הלוח היומי של 3×3 — זה היה חושף תשובות של היום. זרע מקוד
       החדר ומספר המשחק, ולכן ריוואנש מביא לוח אחר. */
    function newBoard(code, game, slug) {
      const seed = 900000 + (hash(code) % 50000) + game * 977;
      const g = window.SportGrid.makeGrid(idx(), conds(), seed, slug);
      return g && g.rows.map(c => c.id).join(",") + "|" + g.cols.map(c => c.id).join(",");
    }

    /* המארח מתחיל: X הוא מי שפתח את החדר, O הראשון שהצטרף אחריו.
       שאר מי שבחדר צופים. בריוואנש (game אי-זוגי) O פותח. */
    async function start(state) {
      const live = Object.entries(state.players || {}).filter(([, p]) => !p.gone)
        .sort((a, b) => (a[1].at || 0) - (b[1].at || 0)).map(([id]) => id);
      const x = live.includes(state.host) ? state.host : live[0];
      const o = live.find(id => id !== x);
      if (!o) throw new Error("צריך שני שחקנים");
      const slug = (state.clubs && state.clubs[0]) || ctx.slug();
      const game = state.game || 0;
      const grid = newBoard(ctx.code(), game, slug);
      if (!grid) throw new Error("לא נמצא לוח");
      await ctx.update(ctx.roomRef(), {
        status: "playing",
        ttt: { grid, slug, x, o, turn: game % 2 ? o : x, deadline: ctx.now() + TURN_MS, miss: 0 }
      });
    }

    const gridOf = t => window.SportGrid.fromIds(conds(), t.grid, t.slug, 0);
    const mark = (t, id) => id === t.x ? "x" : id === t.o ? "o" : null;
    /* פיירבייס מחזיר cells כמערך עם חורים ([x, null, o]) כשהמפתחות מספריים */
    const filled = t => Object.values(t.cells || {}).filter(Boolean);
    const count = (t, m) => filled(t).filter(c => c.by === m).length;

    /* סיום: שלוש בשורה, לוח מלא, או מבוי סתום */
    function judge(t) {
      const c = t.cells || {};
      for (const L of LINES) {
        const a = c[L[0]], b = c[L[1]], d = c[L[2]];
        if (a && b && d && a.by === b.by && b.by === d.by) { t.win = a.by; t.line = L.join(","); return; }
      }
      const filled = Object.keys(c).length;
      if (filled === 9 || t.miss >= STALL) {
        const x = count(t, "x"), o = count(t, "o");
        t.win = x > o ? "x" : o > x ? "o" : "draw";
      }
    }

    /* מהלך. person === null → דילוג/טעות. הבדיקה של התשובה נעשית כאן,
       בלקוח של מי שמנחש — זה משחק חברים, לא דירוג. */
    async function move(i, person) {
      const uid = ctx.uid();
      let res = null;
      await ctx.tx(ctx.tttRef(), t => {
        if (!t || t.win || t.turn !== uid) return;              // לא התור שלי — לא נוגעים
        if (person && t.cells && t.cells[i]) return;          // דילוג לא צריך משבצת פנויה
        const me = mark(t, uid);
        const g = gridOf(t);
        const used = new Set(filled(t).map(c => c.k));
        const [A, B] = [g.rows[Math.floor(i / 3)], g.cols[i % 3]];
        const ok = person && !used.has(person.label) && window.SportGrid.valid(person, A, B, g.home);
        if (ok) { t.cells = { ...(t.cells || {}), [i]: { by: me, k: person.label } }; t.miss = 0; }
        else t.miss = (t.miss || 0) + 1;
        res = ok ? "ok" : (person && used.has(person.label) ? "used" : "bad");
        t.turn = me === "x" ? t.o : t.x;
        t.deadline = ctx.now() + TURN_MS;
        judge(t);
        return t;
      });
      return res;
    }

    /* הזמן נגמר — כל לקוח רשאי לקדם, אבל רק את אותו deadline שראה */
    async function expire(seen) {
      await ctx.tx(ctx.tttRef(), t => {
        if (!t || t.win || t.deadline !== seen || ctx.now() < seen + 800) return;
        t.miss = (t.miss || 0) + 1;
        t.turn = t.turn === t.x ? t.o : t.x;
        t.deadline = ctx.now() + TURN_MS;
        judge(t);
        return t;
      });
    }

    /* ---------- תצוגה ---------- */
    function render(state) {
      const t = state.ttt;
      ctx.show("scTtt");
      if (!t) return;
      if (!wired) { wire(); wired = true; }
      const g = gridOf(t);
      const uid = ctx.uid(), me = mark(t, uid);
      const nm = id => esc(ctx.name(id));
      const key = t.grid + "|" + JSON.stringify(t.cells || {}) + t.turn + t.win;
      const myTurn = !t.win && t.turn === uid;
      if (!myTurn) sel = -1;

      $("#tX").innerHTML = `<b>X</b> ${nm(t.x)} <i class="n">${count(t, "x")}</i>`;
      $("#tO").innerHTML = `<b>O</b> ${nm(t.o)} <i class="n">${count(t, "o")}</i>`;
      announce(t, me);
      $("#tX").classList.toggle("on", !t.win && t.turn === t.x);
      $("#tO").classList.toggle("on", !t.win && t.turn === t.o);
      const ps = state.players || {}, foe = me === "x" ? t.o : me === "o" ? t.x : null;
      $("#tTurn").textContent = t.win ? "" : foe && ps[foe] && ps[foe].gone ? `${ctx.name(foe)} התנתק · ממתינים…`
        : myTurn ? "התור שלך" : `התור של ${ctx.name(t.turn)}`;

      if (key !== lastKey) {
        lastKey = key;
        const b = $("#tBoard"); b.textContent = "";
        const h = txt => { const d = document.createElement("div"); d.className = "gh"; d.textContent = txt; return d; };
        b.appendChild(h(g.home ? g.home.he : ""));
        g.cols.forEach(c => b.appendChild(h(c.he)));
        const line = (t.line || "").split(",").filter(Boolean).map(Number);
        for (let r = 0; r < 3; r++) {
          b.appendChild(h(g.rows[r].he));
          for (let c = 0; c < 3; c++) {
            const i = r * 3 + c, v = (t.cells || {})[i];
            const el = document.createElement("button");
            el.type = "button"; el.className = "gc"; el.dataset.i = i;
            if (v) {
              el.classList.add(v.by === "x" ? "tx" : "to"); el.disabled = true;
              el.innerHTML = "<b></b><span></span>";
              el.firstChild.textContent = v.by.toUpperCase(); el.lastChild.textContent = v.k;
              if (line.includes(i)) el.classList.add("tw");
            } else {
              el.disabled = !myTurn;
              if (i === sel) el.classList.add("sel");
            }
            el.setAttribute("aria-label", g.rows[r].he + " × " + g.cols[c].he + (v ? ": " + v.k : ""));
            b.appendChild(el);
          }
        }
      }
      $("#tPick").hidden = !myTurn || sel < 0;
      $("#tEnd").hidden = !t.win;
      if (t.win) {
        const w = t.win === "draw" ? "תיקו!" : `${ctx.name(t.win === "x" ? t.x : t.o)} ניצח!`;
        $("#tResult").textContent = w;
        /* \u2066…\u2069: הספירה הלטינית מבודדת, אחרת היא מתהפכת בתוך שורה עברית */
        const tally = `על הלוח: \u2066X ${count(t, "x")} · O ${count(t, "o")}\u2069`;
        $("#tWhy").textContent = t.line ? "שלוש בשורה" : (t.miss || 0) >= STALL ? `${STALL} תורות ברצף בלי תשובה · ${tally}` : tally;
        const hostGone = (ps[state.host] || {}).gone;
        $("#tRematch").hidden = !ctx.isHost();
        $("#tWait").hidden = ctx.isHost();
        $("#tWait").textContent = hostGone ? "מנהל החדר יצא — פתחו חדר חדש" : "מנהל החדר יכול לפתוח ריוואנש";
      }
      if (!me && !t.win) $("#tTurn").textContent += " · צופים";
      tickTimer(t);
    }

    /* מה קרה בתור של היריב — וניקוי ההודעה בלוח חדש */
    function announce(t, me) {
      const cells = t.cells || {};
      if (!prev || prev.grid !== t.grid) { if (prev) msg(""); prev = { grid: t.grid, cells: {}, turn: t.turn, miss: t.miss || 0 }; }
      const fresh = [...Array(9).keys()].find(i => cells[i] && !prev.cells[i]);
      if (me && fresh != null && cells[fresh].by !== me) msg(`${ctx.name(cells[fresh].by === "x" ? t.x : t.o)} תפס: ${cells[fresh].k}`);
      else if (me && !t.win && fresh == null && t.turn !== prev.turn && (t.miss || 0) > prev.miss && t.turn === ctx.uid()) msg(`${ctx.name(prev.turn)} פספס — התור שלך`, true);
      prev = { grid: t.grid, cells: { ...cells }, turn: t.turn, miss: t.miss || 0 };
    }
    function msg(txt, bad) { const m = $("#tMsg"); m.textContent = txt; m.className = bad ? "bad" : ""; }

    function tickTimer(t) {
      clearInterval(timer);
      const bar = $("#tBar");
      document.querySelector("#scTtt .tTurn").style.visibility = t.win ? "hidden" : "";
      if (t.win) { bar.style.width = "0"; return; }
      const step = () => {
        const left = Math.max(0, t.deadline - ctx.now());
        bar.style.width = (100 * left / TURN_MS) + "%";
        $("#tClock").textContent = $("#tClock2").textContent = Math.ceil(left / 1000);
        if (left <= 0) { clearInterval(timer); setTimeout(() => expire(t.deadline), 900); }
      };
      step(); timer = setInterval(step, 250);
    }

    function pick(i) {
      sel = i; lastKey = "";
      const st = ctx.state(), g = gridOf(st.ttt);
      $("#tNow").textContent = g.rows[Math.floor(i / 3)].he + " × " + g.cols[i % 3].he;
      $("#tMsg").textContent = "";
      render(st);
      const inp = $("#tGuess"); inp.value = ""; suggest(""); inp.focus();
      setTimeout(() => $("#tPick").scrollIntoView({ block: "start", behavior: "smooth" }), 300);
    }

    function suggest(q) {
      const box = $("#tSugg"); box.textContent = "";
      const nq = norm(q);
      if (nq.length < 2) { box.classList.remove("on"); return; }
      const t = ctx.state().ttt;
      const used = new Set(filled(t).map(c => c.k));
      const hits = idx().people.filter(x => norm(x.name).includes(nq) || x.aliases.some(a => norm(a).includes(nq))).slice(0, 8);
      for (const x of hits) {
        const b = document.createElement("button");
        b.type = "button";
        if (used.has(x.label)) { b.disabled = true; b.textContent = x.label + " — כבר בלוח"; }
        else { b.textContent = x.label; b.addEventListener("click", () => guess(x)); }
        box.appendChild(b);
      }
      box.classList.toggle("on", hits.length > 0);
    }

    async function guess(x) {
      const i = sel; if (i < 0) return;
      const box = $("#tSugg"); box.classList.remove("on"); box.textContent = "";
      $("#tGuess").value = "";
      sel = -1;
      const g = gridOf(ctx.state().ttt), A = g.rows[Math.floor(i / 3)], B = g.cols[i % 3];
      const r = await move(i, x);
      /* איזה תנאי נכשל — כמו whyNot ב-3×3 */
      const miss = [A, B].filter(c => !window.SportGrid.valid(x, c, c, g.home)).map(c => c.he).join(" / ");
      msg(r === "ok" ? "✓ " + x.label : r === "used" ? x.label + " — כבר בלוח"
        : r === "bad" ? "✗ " + x.label + (miss ? " — לא: " + miss : " — לא עונה על שני התנאים") : "", r !== "ok");
    }

    function wire() {
      $("#tBoard").addEventListener("click", e => {
        const el = e.target.closest(".gc"); if (el && !el.disabled) pick(+el.dataset.i);
      });
      const inp = $("#tGuess");
      inp.addEventListener("input", () => suggest(inp.value));
      inp.addEventListener("keydown", e => { if (e.key === "Enter") { const f = $("#tSugg.on button:not([disabled])"); if (f) f.click(); } });
      $("#tPass").addEventListener("click", async () => { const i = sel; sel = -1; await move(i < 0 ? 0 : i, null); });
      $("#tRematch").addEventListener("click", () => ctx.rematch());
      $("#tLeave").addEventListener("click", () => ctx.leave());
      $("#tShare").addEventListener("click", () => ctx.share(shareText()));
    }

    function shareText() {
      const t = ctx.state().ttt, c = t.cells || {};
      const sq = i => c[i] ? (c[i].by === "x" ? "❌" : "⭕") : "⬜";
      /* \u200F בראש כל שורה: שורת אימוג'י בלבד היא LTR ומשבצת 0 (ימין בלוח) הייתה קופצת שמאלה */
      const rows = [0, 3, 6].map(r => "\u200F" + sq(r) + sq(r + 1) + sq(r + 2)).join("\n");
      const w = t.win === "draw" ? "תיקו" : `${ctx.name(t.win === "x" ? t.x : t.o)} ניצח`;
      return `ספורטדל · איקס-עיגול 3×3 · ${w}\n${rows}\n${ctx.link()}`;
    }

    function stop() { clearInterval(timer); lastKey = ""; sel = -1; }
    return { start, render, stop, newBoard };
  }

  window.SportTTT = { create, TURN_MS, LINES };
})();
