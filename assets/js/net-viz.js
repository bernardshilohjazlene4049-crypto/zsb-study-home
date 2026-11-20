/* 计算机网络「可视化讲解」：纯原生，无依赖。每个 <figure class="nv" data-viz='JSON'> 滚动到附近时才初始化。
 * 配置：{ m: steps|tabs|slider|checker|judge|static, f: [帧], sl, pre }
 * 帧：{ l: 标签, r: 读数(aria-live), b: [块] }；块 t：bits tbl ln sc tr sp cd tp cap */
(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";
  const h = (tag, cls, text, attrs) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };
  const sv = (tag, attrs, text) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs || {}) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  };
  const clsOf = (s) => String(s || "").split(/\s+/).filter(Boolean);

  const R = {
    cap: (b) => h("p", "nv-cap", b.x),
    bits(b) {
      const wrap = h("div", "nv-bitswrap");
      if (b.x) wrap.append(h("p", "nv-cap", b.x));
      const g = h("div", "nv-bits", null, { "aria-hidden": "true", "data-n": String(b.c.length) });
      g.style.setProperty("--cols", b.cols || Math.min(32, b.c.length));
      g.style.setProperty("--nc", b.nc || 8);
      b.c.forEach((c, i) => {
        const cell = h("span", "nv-bit" + (i % (b.by || 8) === 0 ? " b0" : ""), c[0]);
        for (const k of clsOf(c[1])) cell.classList.add(k);
        g.append(cell);
      });
      wrap.append(g);
      if (b.lg) wrap.append(R.lg(b.lg));
      return wrap;
    },
    lg(items) {
      const ul = h("ul", "nv-legend");
      for (const [c, t] of items) { const li = h("li"); li.append(h("i", c), document.createTextNode(t)); ul.append(li); }
      return ul;
    },
    tbl(b) {
      const wrap = h("div", "tablewrap", null, { tabindex: "0", role: "region", "aria-label": "表格" });
      const t = h("table");
      const cell = (tag, v, scope) => {
        const [txt, cls] = Array.isArray(v) ? v : [v, ""];
        const c = h(tag, "", txt);
        if (scope) c.setAttribute("scope", scope);
        for (const k of clsOf(cls)) c.classList.add(k);
        return c;
      };
      if (b.h) { const tr = h("tr"); b.h.forEach((v) => tr.append(v === "" ? h("td") : cell("th", v, "col"))); t.append(h("thead")); t.firstChild.append(tr); }
      const body = h("tbody");
      for (const r of b.r) { const tr = h("tr"); r.forEach((v, j) => tr.append(j === 0 && b.rh ? cell("th", v, "row") : cell("td", v))); body.append(tr); }
      t.append(body);
      wrap.append(t);
      return wrap;
    },
    ln(b) {
      const d = h("div", "nv-lines");
      for (const it of b.i) {
        const [txt, cls] = Array.isArray(it) ? it : [it, ""];
        const p = h("p", "nv-line", txt);
        for (const k of clsOf(cls)) p.classList.add(k);
        d.append(p);
      }
      return d;
    },
    sc(b) {
      const span = b.max - b.min;
      const pct = (v) => `${((v - b.min) / span) * 100}%`;
      const w = h("div", "nv-scale");
      if (b.mk && b.mk.length) {
        const pins = h("div", "nv-pins");
        for (const [v, t, c] of b.mk) { const f = (v - b.min) / span; const p = h("div", "nv-pin " + (c || "") + (f < 0.14 ? " el" : f > 0.86 ? " er" : "")); p.style.left = pct(v); p.append(h("b", "", t)); pins.append(p); }
        w.append(pins);
      }
      const track = h("div", "nv-track", null, { "aria-hidden": "true" });
      for (const s of b.sg || []) {
        const e = h("div", "nv-seg " + (s.c || "") + (/^[\x20-\x7e]*$/.test(s.x || "") ? " nw" : ""), s.x || "");
        e.style.left = pct(s.a);
        e.style.width = `max(2px, ${((s.b - s.a) / span) * 100}%)`;
        track.append(e);
      }
      w.append(track);
      if (b.tk && b.tk.length) {
        const ticks = h("div", "nv-ticks", null, { "aria-hidden": "true" });
        for (const [v, t] of b.tk) { const f = (v - b.min) / span; const e = h("span", "nv-tick" + (f < 0.1 ? " el" : f > 0.9 ? " er" : ""), t); e.style.left = pct(v); ticks.append(e); }
        w.append(ticks);
      }
      const names = (b.sg || []).filter((s) => s.x && s.lg !== 0);
      if (b.lg !== 0 && names.length > 1) {
        const ul = h("ul", "nv-legend");
        for (const s of names) { const li = h("li"); li.append(h("i", clsOf(s.c)[0] || "g"), document.createTextNode(s.x)); ul.append(li); }
        w.append(ul);
      }
      return w;
    },
    tr(b) {
      const lim = b.d == null ? 99 : b.d;
      const build = (n, depth) => {
        const li = h("li");
        const nd = h("span", "nv-node " + (n.c || ""));
        nd.append(h("strong", "", n.x));
        if (n.s) nd.append(h("span", "", n.s));
        li.append(nd);
        const kids = (n.k || []).filter(() => depth < lim);
        if (kids.length) { const ul = h("ul"); for (const k of kids) ul.append(build(k, depth + 1)); li.append(ul); }
        return li;
      };
      const ul = h("ul", "nv-tree");
      ul.append(build(b.n, 0));
      return ul;
    },
    sp(b) {
      const lim = b.d == null ? 99 : b.d;
      const build = (n, depth) => {
        const box = h("div", "nv-box " + (n.c || ""));
        if (n.w) box.style.setProperty("--w", n.w);
        const kids = (n.k || []).filter(() => depth < lim);
        if (!kids.length) { box.append(h("span", "nv-label", n.x)); return box; }
        box.style.flexDirection = "column";
        const inner = h("div", "nv-split" + (n.dir === "col" ? " col" : ""));
        inner.style.flex = "1 1 0";
        for (const k of kids) inner.append(build(k, depth + 1));
        box.append(h("span", "nv-label", n.x), inner);
        return box;
      };
      const root = h("div", "nv-split");
      root.append(build(b.n, 0));
      return root;
    },
    cd(b) {
      const g = h("div", "nv-cards");
      for (const it of b.i) {
        const c = h("div", "nv-card " + (it.c || ""));
        c.append(h("b", "", it.x));
        if (it.s) c.append(h("span", "", it.s));
        g.append(c);
      }
      return g;
    },
    tp(b) {
      const s = sv("svg", { viewBox: "0 0 320 170", class: "nv-topo", "aria-hidden": "true", focusable: "false" });
      const at = Object.fromEntries(b.n.map((n) => [n[0], n]));
      b.e.forEach((e, i) => {
        const a = at[e[0]], z = at[e[1]];
        s.append(sv("line", { x1: a[1], y1: a[2], x2: z[1], y2: z[2], class: (b.hl || []).includes(i) ? "hi" : "" }));
        if (e[2]) s.append(sv("text", { x: (a[1] + z[1]) / 2, y: (a[2] + z[2]) / 2 - 10, class: "el" }, e[2]));
      });
      for (const n of b.n) {
        const rad = n[5] || 17;
        s.append(sv("circle", { cx: n[1], cy: n[2], r: rad, class: n[4] || "" }), sv("text", { x: n[1], y: n[2], class: n[4] ? "on" : "" }, n[3]));
        if (n[6]) s.append(sv("text", { x: n[1], y: n[2] + rad + 10, class: "el" }, n[6]));
      }
      return s;
    }
  };

  function renderFrame(stage, frame, anim) {
    stage.replaceChildren();
    for (const b of frame.b || []) stage.append(R[b.t](b));
    const read = h("p", "nv-read", frame.r || "", { "aria-live": "polite" });
    stage.append(read);
    if (anim && !reduce) { stage.classList.remove("nv-in"); void stage.offsetWidth; stage.classList.add("nv-in"); }
  }

  function button(label, extra) {
    return h("button", "sh-btn", label, Object.assign({ type: "button" }, extra || {}));
  }

  function mountSteps(fig, cfg, stage) {
    const n = cfg.f.length;
    let i = reduce ? n - 1 : 0, timer = 0;
    const ctl = h("div", "nv-ctl");
    const prev = button("上一步"), next = button("下一步"), again = button("重播");
    const count = h("span", "nv-count", "", { "aria-hidden": "true" });
    ctl.append(prev, count, next, again);
    const stop = () => { clearInterval(timer); timer = 0; };
    const show = (k, anim = true) => {
      i = Math.max(0, Math.min(n - 1, k));
      renderFrame(stage, cfg.f[i], anim);
      count.textContent = `${i + 1} / ${n}`;
      prev.disabled = i === 0;
      next.disabled = i === n - 1;
    };
    prev.addEventListener("click", () => { stop(); show(i - 1); });
    next.addEventListener("click", () => { stop(); show(i + 1); });
    again.addEventListener("click", () => {
      stop();
      if (reduce) { show(n - 1); return; }
      show(0);
      timer = setInterval(() => { if (i >= n - 1) stop(); else show(i + 1); }, 1200);
    });
    fig.append(ctl);
    show(i, false);
  }

  function mountTabs(fig, cfg, stage) {
    const box = h("div", "nv-tabs", null, { role: "group", "aria-label": cfg.sl || "切换" });
    const btns = cfg.f.map((fr, k) => {
      const b = button(fr.l, { "aria-pressed": "false" });
      b.addEventListener("click", () => show(k));
      box.append(b);
      return b;
    });
    const show = (k, anim = true) => {
      btns.forEach((b, j) => b.setAttribute("aria-pressed", String(j === k)));
      renderFrame(stage, cfg.f[k], anim);
    };
    fig.append(box);
    show(cfg.i0 || 0, false);
  }

  function mountSlider(fig, cfg, stage) {
    const n = cfg.f.length;
    const lab = h("label", "nv-slider");
    const inp = h("input", "", null, { type: "range", min: "0", max: String(n - 1), step: "1", value: "0" });
    const val = h("span", "", "");
    lab.append(h("span", "", cfg.sl || ""), inp, val);
    const show = (k, anim = true) => {
      renderFrame(stage, cfg.f[k], anim);
      val.textContent = cfg.f[k].l;
      inp.setAttribute("aria-valuetext", cfg.f[k].l);
    };
    inp.addEventListener("input", () => show(Number(inp.value)));
    fig.append(lab);
    show(0, false);
  }

  // ---- 计算型：地址检查器（1-3-1）与前缀判断器（2-6-1）----
  function checkAddr(s) {
    const parts = s.split(".");
    const dots = s.split(".").length - 1;
    const okNum = parts.length === 4;
    const okDot = dots === 3;
    const range = parts.map((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
    return { parts, okNum, okDot, range, okRange: parts.length > 0 && range.every(Boolean) };
  }
  function checkerFrame(s) {
    const c = checkAddr(s);
    const mark = (v) => (v ? "✔" : "✘");
    return { b: [
      { t: "cd", i: [{ x: s || " ", s: "", c: c.okNum && c.okDot && c.okRange ? "ok" : "bad" }] },
      { t: "cd", i: c.parts.map((p, k) => ({ x: p === "" ? "·" : p, s: c.range[k] ? "0~255 ✔" : "0~255 ✘", c: c.range[k] ? "ok" : "bad" })) },
      { t: "ln", i: [[`四个十进制数 ${mark(c.okNum)}`, c.okNum ? "ok" : "bad"], [`三个 . ${mark(c.okDot)}`, c.okDot ? "ok" : "bad"], [`每一个十进制数范围 0~255 ${mark(c.okRange)}`, c.okRange ? "ok" : "bad"]] }
    ], r: "" };
  }
  function judgeFrame(s) {
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(s.trim());
    if (!m) return { b: [{ t: "ln", i: [["a.b.c.d/n", "bad"]] }], r: "" };
    const o = m.slice(1, 5).map(Number), n = Number(m[5]);
    if (o.some((x) => x > 255) || n > 32) return { b: [{ t: "ln", i: [["a.b.c.d/n", "bad"]] }], r: "" };
    const bin = o.map((x) => x.toString(2).padStart(8, "0")).join("");
    const cells = [...bin].map((ch, i) => [ch, i < n ? "n" : "h"]);
    const hostZero = /^0*$/.test(bin.slice(n));
    const net = [0, 1, 2, 3].map((k) => parseInt((bin.slice(k * 8, k * 8 + 8).split("").map((ch, j) => (k * 8 + j < n ? ch : "0")).join("")), 2)).join(".");
    return { b: [
      { t: "bits", c: cells, cols: 32, nc: 8, lg: [["n", `网络前缀 ${n} 位`], ["h", `主机号 ${32 - n} 位`]] },
      { t: "ln", i: [[`主机号 (32−${n}) = ${32 - n} 位${hostZero ? "全 0" : "不全为 0"}`, ""], [hostZero ? `网络地址 ${net}` : "主机地址", hostZero ? "ok hi" : "hi"]] }
    ], r: "" };
  }
  function mountInput(fig, cfg, stage, frameOf) {
    const row = h("div", "nv-input");
    const inp = h("input", "", null, { type: "text", value: cfg.pre[0], "aria-label": cfg.sl || "输入", autocomplete: "off", spellcheck: "false", inputmode: "text" });
    const presets = h("div", "nv-presets", null, { role: "group", "aria-label": "示例" });
    const btns = cfg.pre.map((p) => { const b = button(p, { "aria-pressed": "false" }); b.addEventListener("click", () => { inp.value = p; show(); }); presets.append(b); return b; });
    const show = () => { renderFrame(stage, frameOf(inp.value), false); btns.forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === inp.value))); };
    inp.addEventListener("input", show);
    row.append(inp);
    fig.append(row, presets);
    show();
  }

  function init(fig) {
    if (fig.dataset.nvReady) return;
    fig.dataset.nvReady = "1";
    let cfg;
    try { cfg = JSON.parse(fig.dataset.viz); } catch { return; }
    const stage = h("div", "nv-stage");
    fig.append(stage);
    if (cfg.m === "steps") mountSteps(fig, cfg, stage);
    else if (cfg.m === "tabs") mountTabs(fig, cfg, stage);
    else if (cfg.m === "slider") mountSlider(fig, cfg, stage);
    else if (cfg.m === "checker") mountInput(fig, cfg, stage, checkerFrame);
    else if (cfg.m === "judge") mountInput(fig, cfg, stage, judgeFrame);
    else renderFrame(stage, cfg.f[0], false);
  }

  const figs = [...document.querySelectorAll("figure.nv[data-viz]")];
  if (!figs.length) return;
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((list) => {
      for (const e of list) if (e.isIntersecting) { io.unobserve(e.target); init(e.target); }
    }, { rootMargin: "400px 0px" });
    figs.forEach((f) => io.observe(f));
  } else figs.forEach(init);
  // 供测试逐个初始化
  window.__nvInitAll = () => figs.forEach(init);
})();
