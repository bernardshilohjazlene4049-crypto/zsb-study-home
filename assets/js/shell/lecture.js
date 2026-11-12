// 讲义 / 知识点页外壳：桌面三栏（本章目录 | 讲义正文 | 学习路径 + 学习状态），手机上目录收进抽屉、学习路径放到正文后面。
// 正文节点原样搬进中栏，不改动其中任何文字。
import { loadModel, topicHref, pagePath, anchorOf, cnNumber } from "./model.js";
import { el, icon, bar, statusDot, shortSubjectName, formatDay, STATUS_LABEL } from "./ui.js";
import { splitChapterTitle } from "./subject.js";

const WY = { subject: "web_design", wrap: ".wy-layout", hide: [".wy-side", ".mobile-toc-btn"] };
const PAGES = {
  "gs/gs1.html": { subject: "math", wrap: ".study-layout", hide: [".study-index"], hero: ".page-hero", nav: ".study-index a[href^='#']", sections: true },
  "gs/gs45.html": { subject: "math", wrap: ".study-layout", hide: [".study-index"], hero: ".page-hero", before: [".route-panel"], nav: ".study-index a[href^='#']", sections: true },
  "yy/yy5.html": { subject: "english", children: "main .site-container", sections: true },
  "jsj/jsj1.html": { subject: "computer_basics", wrap: "main.learn-main", hero: ".hero-area", hide: [".map-index"], sections: true, proxy: (id) => document.querySelector(`.map-index__item[data-chapter="${id.replace(/^mind-/, "")}"]`) },
  "jsj/ppt5.html": { subject: "computer_basics", wrap: "main.learn-main", hero: ".hero-area", sections: true, anchor: (t) => /^(\d\.\d)/.test(t.title) ? `chapter-${t.title.slice(0, 3)}` : "" }
};

function configFor(rel) {
  if (PAGES[rel]) return PAGES[rel];
  if (/^wy\//.test(rel)) return WY;
  return null;
}

function q(sel) { return sel ? document.querySelector(sel) : null; }

function labelPrefix(topic, anchor) {
  let m = /^point-(\d+)$/.exec(anchor);
  if (m) return String(m[1]).padStart(2, "0");
  m = /^topic-(\d+)$/.exec(anchor);
  if (m) return `专题${cnNumber(Number(m[1]))}`;
  return "";
}

export function buildSkeleton(cfg) {
  let host, anchorNode, moving = [];
  if (cfg.children) {
    host = q(cfg.children);
    if (!host) return null;
    moving = [...host.children];
    anchorNode = null;
  } else {
    const wrap = q(cfg.wrap);
    if (!wrap) return null;
    host = wrap.parentElement;
    anchorNode = wrap;
    const hero = q(cfg.hero);
    moving = [hero, ...(cfg.before || []).map(q), wrap].filter(Boolean);
  }
  for (const sel of cfg.hide || []) for (const n of document.querySelectorAll(sel)) n.classList.add("lx-hidden");
  const toc = el("aside", { class: "lx-toc", id: "lx-toc", "aria-label": "本章目录" });
  const bar = el("div", { class: "lx-bar" });
  const body = el("div", { class: "lx-body" });
  const side = el("aside", { class: "lx-side", "aria-label": "学习路径与学习状态" });
  const center = el("div", { class: "lx-main" }, [bar, body]);
  const grid = el("div", { class: "lx" }, [toc, center, side]);
  if (anchorNode) host.insertBefore(grid, anchorNode);
  else host.prepend(grid);
  for (const n of moving) body.append(n);
  host.classList.add("lx-host");
  if (host.matches(".site-container") === false && host.closest(".site-container")) host.closest(".site-container").classList.add("lx-host");
  document.body.classList.add("shell-lecture");
  return { grid, toc, bar, body, side };
}

function tocItem(model, t, base, rel, cfg, current) {
  const anchor = (cfg.anchor && cfg.anchor(t)) || anchorOf(t.legacy_url);
  const samePage = pagePath(t.legacy_url) === rel;
  const href = samePage && anchor ? `#${anchor}` : topicHref(t, base);
  const prefix = samePage ? labelPrefix(t, anchor) : "";
  const status = model.topicStatus(t.id);
  const a = el(href ? "a" : "span", { class: "lx-toc__item", href: href || null, "data-topic": t.id, "data-anchor": samePage ? anchor : null }, [
    statusDot(status, STATUS_LABEL[status]),
    prefix ? el("span", { class: "lx-toc__no", text: prefix }) : null,
    el("span", { class: "lx-toc__text", text: t.title })
  ]);
  if (t.id === current) { a.classList.add("is-current"); a.setAttribute("aria-current", "page"); }
  return el("li", {}, [a]);
}

export function renderToc(model, { toc, subjectId, chapterIds, rel, base, cfg = {}, current, extras = { before: [], after: [] }, onPick }) {
  const subject = model.subjectById.get(subjectId);
  const nodes = model.chaptersOf(subjectId);
  const mine = nodes.filter((n) => chapterIds.includes(n.chapter.id));
  const head = el("div", { class: "lx-toc__subject" }, [
    el("a", { class: "lx-toc__subject-link", href: subject?.homeUrl ? base + subject.homeUrl : null }, [
      el("span", { class: "lx-toc__subject-icon" }, [icon("book", 18)]),
      el("span", {}, [el("strong", { text: shortSubjectName(subject) }), el("small", { text: mine.map((n) => n.chapter.title).join(" · ") })])
    ])
  ]);
  const p = model.progressOf(mine.flatMap((n) => n.topics));
  const prog = p.hasRecords
    ? el("div", { class: "lx-toc__progress" }, [el("div", {}, [el("span", { text: "本章进度" }), el("span", { text: `${p.pct}%` })]), bar(p.pct, "本章进度")])
    : null;

  const tabs = el("div", { class: "lx-toc__tabs", role: "tablist" });
  const panelToc = el("div", { class: "lx-toc__panel", role: "tabpanel", id: "lx-panel-toc" });
  const panelMap = el("div", { class: "lx-toc__panel", role: "tabpanel", id: "lx-panel-map", hidden: true });
  const mkTab = (label, panel, on) => {
    const b = el("button", { type: "button", class: `lx-toc__tab${on ? " is-on" : ""}`, role: "tab", "aria-selected": on ? "true" : "false", "aria-controls": panel.id, text: label });
    b.addEventListener("click", () => {
      for (const x of tabs.children) { x.classList.toggle("is-on", x === b); x.setAttribute("aria-selected", x === b ? "true" : "false"); }
      panelToc.hidden = panel !== panelToc;
      panelMap.hidden = panel !== panelMap;
    });
    return b;
  };
  tabs.append(mkTab("本章目录", panelToc, true), mkTab("学习地图", panelMap, false));

  const extraList = (items, cls) => items.length ? el("ul", { class: `lx-toc__list lx-toc__list--extra ${cls}` }, items.map((x) =>
    el("li", {}, [el("a", { class: "lx-toc__item lx-toc__item--extra", href: x.href, "data-anchor": x.href.slice(1) }, [el("span", { class: "lx-toc__no", text: x.no }), el("span", { class: "lx-toc__text", text: x.text })])]))) : null;

  panelToc.append(extraList(extras.before, "is-before") || "");
  for (const node of mine) {
    const group = el("section", { class: "lx-toc__group" }, [el("h3", { class: "lx-toc__chapter", text: node.chapter.title })]);
    if (node.sections.length) {
      for (const sec of node.sections) {
        if (!sec.topics.length) continue;
        group.append(el("h4", { class: "lx-toc__section", text: sec.chapter.title }), el("ul", { class: "lx-toc__list" }, sec.topics.map((t) => tocItem(model, t, base, rel, cfg, current))));
      }
    } else {
      group.append(el("ul", { class: "lx-toc__list" }, node.topics.map((t) => tocItem(model, t, base, rel, cfg, current))));
    }
    panelToc.append(group);
  }
  panelToc.append(extraList(extras.after, "is-after") || "");

  panelMap.append(el("ul", { class: "lx-toc__list" }, nodes.map((node) => {
    const pp = model.progressOf(node.topics);
    const first = node.topics.map((t) => topicHref(t, base)).find(Boolean);
    const st = !pp.done ? "none" : pp.mastered === pp.total ? "mastered" : "learning";
    return el("li", {}, [el(first ? "a" : "span", { class: `lx-toc__item${chapterIds.includes(node.chapter.id) ? " is-current" : ""}`, href: first || null }, [
      statusDot(st), el("span", { class: "lx-toc__text", text: node.chapter.title }), pp.hasRecords ? el("span", { class: "lx-toc__pct", text: `${pp.pct}%` }) : null
    ])]);
  })));

  const close = el("button", { type: "button", class: "lx-toc__close", "aria-label": "关闭目录" }, [icon("close", 18)]);
  toc.replaceChildren(close, head, prog || "", tabs, panelToc, panelMap);
  toc.addEventListener("click", (e) => {
    const a = e.target.closest("a.lx-toc__item");
    if (a && onPick) onPick(a, e);
  });
  return { close };
}

export function pathCard(model, topicId, base, { compact = false } = {}) {
  const pre = model.prereqs(topicId).filter((e) => e.topic);
  const post = model.successors(topicId).filter((e) => e.topic);
  const chip = (e, dir) => {
    const href = topicHref(e.topic, base);
    return el(href ? "a" : "span", { class: `sh-chip${e.strength === "soft" && dir === "pre" ? " sh-chip--soft" : ""}`, href: href || null, "data-topic": e.topic.id, title: dir === "pre" ? (e.strength === "hard" ? "硬先修" : "软先修") : "后续" }, [el("span", { text: e.topic.title }), icon("chevron", 14)]);
  };
  const row = (label, list, dir) => el("div", { class: "lx-path__row" }, [
    el("span", { class: "lx-path__label", text: label }),
    el("div", { class: "lx-path__chips" }, list.length ? list.map((e) => chip(e, dir)) : [el("span", { class: "lx-path__none", text: dir === "pre" ? "暂无先修" : "暂无后续" })])
  ]);
  const unreviewed = [...pre, ...post].some((e) => !e.reviewed);
  const card = el("section", { class: `sh-card lx-path${compact ? " lx-path--inline" : ""}`, "aria-label": "学习路径" }, [
    el("header", { class: "sh-card__head" }, [
      el("h2", { class: "sh-card__title" }, [icon("graph", 18), el("span", { text: "学习路径" })]),
      el("a", { class: "lx-path__graph", href: `${base}study/graph.html?topic=${encodeURIComponent(topicId)}` }, [el("span", { text: "关系图" }), icon("chevron", 14)])
    ]),
    row("先修", pre, "pre"),
    row("后续", post, "post"),
    unreviewed ? el("p", { class: "sh-note" }, [icon("alert", 15), el("span", { text: "先修关系尚未核对。" })]) : null
  ]);
  return card;
}

export function statusCard(model, topicId, base) {
  const s = model.topicStats(topicId);
  const check = (on, text) => el("li", { class: `lx-status__item${on ? " is-on" : ""}` }, [
    el("span", { class: "lx-status__box", "aria-hidden": "true" }, on ? [icon("check", 13)] : []),
    el("span", { text }), el("span", { class: "sh-sr", text: on ? "（是）" : "（否）" })
  ]);
  const list = el("ul", { class: "lx-status__list" }, [
    check(s.answered > 0, s.total ? `已练习（${s.answered} / ${s.total} 题）` : (s.answered ? `已练习（${s.answered} 题）` : "已练习")),
    check(s.correct > 0, "有答对的题"),
    check(s.reviews > 0, s.reviews ? `已加入复习（${s.reviews} 道）` : "已加入复习"),
    check(s.mastery === "independent_once" && !s.mistakes, "已独立做对")
  ]);
  const foot = s.nextReview ? el("p", { class: "lx-status__foot" }, [icon("clock", 15), el("span", { text: `下次复习 ${formatDay(s.nextReview)}` })]) : null;
  return el("section", { class: "sh-card lx-status", "aria-label": "学习状态" }, [
    el("header", { class: "sh-card__head" }, [el("h2", { class: "sh-card__title" }, [icon("chart", 18), el("span", { text: "学习状态" })]),
      s.mistakes ? el("a", { class: "lx-path__graph", href: `${base}study/index.html#/mistakes` }, [el("span", { text: `错题 ${s.mistakes}` }), icon("chevron", 14)]) : null]),
    s.touched || s.reviews ? null : el("p", { class: "lx-status__empty", text: "还没有学习记录" }),
    list, foot
  ]);
}

export function crumbs(model, topic, base, subjectId) {
  const subject = model.subjectById.get(subjectId);
  const chapter = topic ? model.topLevel(topic.chapter_id) : null;
  const nav = el("nav", { class: "lx-crumbs", "aria-label": "当前位置" }, [
    el("a", { href: `${base}index.html`, class: "lx-crumbs__home", "aria-label": "首页" }, [icon("home", 15)]),
    icon("chevron", 13, "lx-crumbs__sep"),
    el("a", { href: subject?.homeUrl ? base + subject.homeUrl : null, text: shortSubjectName(subject) }),
    chapter ? icon("chevron", 13, "lx-crumbs__sep") : null,
    chapter ? el("span", { text: chapter.title }) : null,
    topic ? icon("chevron", 13, "lx-crumbs__sep") : null,
    topic ? el("span", { class: "lx-crumbs__current", "aria-current": "location", text: topic.title }) : null
  ]);
  return nav;
}

export async function mount(shell) {
  const cfg = configFor(shell.rel);
  if (!cfg) return;
  const sk = buildSkeleton(cfg);
  if (!sk) return;
  const base = shell.base;
  const rel = shell.rel;
  const model = await loadModel();
  const subjectId = cfg.subject;
  const all = model.topicsOfSubject(subjectId);
  const onPage = all.filter((t) => pagePath(t.legacy_url) === rel);
  const anchorFor = (t) => (cfg.anchor && cfg.anchor(t)) || anchorOf(t.legacy_url);
  const sectionTopics = cfg.sections ? onPage.filter((t) => anchorFor(t) && document.getElementById(anchorFor(t))) : [];
  // 同一锚点只保留第一个知识点（例如五专题讲义的总入口与专题共用页面）。
  const seenAnchor = new Set();
  const tracked = sectionTopics.filter((t) => { const a = anchorFor(t); if (seenAnchor.has(a)) return false; seenAnchor.add(a); return true; });
  let current = (tracked[0] || onPage[0] || null)?.id || null;
  const chapterIds = [...new Set((onPage.length ? onPage : all.slice(0, 1)).map((t) => model.topLevel(t.chapter_id)?.id).filter(Boolean))];

  // 原页面目录里不是知识点的条目（如总流程、方法索引、思维导图）。
  const topicAnchors = new Set(onPage.map(anchorFor).filter(Boolean));
  const extras = { before: [], after: [] };
  if (cfg.nav) {
    let seenTopic = false;
    for (const a of document.querySelectorAll(cfg.nav)) {
      const h = a.getAttribute("href");
      if (topicAnchors.has(h.slice(1))) { seenTopic = true; continue; }
      const no = a.querySelector("span")?.textContent.trim() || "";
      let text = a.textContent.replace(/\s+/g, " ").trim();
      if (no && text.startsWith(no)) text = text.slice(no.length).trim();
      (seenTopic ? extras.after : extras.before).push({ href: h, no, text });
    }
  }

  const drawer = sk.toc;
  const backdrop = el("div", { class: "lx-backdrop", hidden: true });
  document.body.append(backdrop);
  let lastFocus = null;
  const openToc = () => { lastFocus = document.activeElement; drawer.classList.add("is-open"); backdrop.hidden = false; document.documentElement.classList.add("lx-lock"); drawer.querySelector(".lx-toc__close")?.focus(); };
  const closeToc = () => { drawer.classList.remove("is-open"); backdrop.hidden = true; document.documentElement.classList.remove("lx-lock"); lastFocus?.focus?.(); };
  backdrop.addEventListener("click", closeToc);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("is-open")) closeToc(); });

  const pick = (a, e) => {
    const anchor = a.dataset.anchor;
    if (anchor && cfg.proxy) {
      const target = document.getElementById(anchor);
      const btn = cfg.proxy(anchor);
      if (target && target.hidden && btn) { e.preventDefault(); btn.click(); target.scrollIntoView({ block: "start" }); history.replaceState(null, "", `#${anchor}`); }
    }
    if (drawer.classList.contains("is-open")) closeToc();
  };
  const { close } = renderToc(model, { toc: sk.toc, subjectId, chapterIds, rel, base, cfg, current, extras, onPick: pick });
  close.addEventListener("click", closeToc);

  const tocBtn = el("button", { type: "button", class: "sh-btn lx-bar__toc", "aria-controls": "lx-toc" }, [icon("list", 16), el("span", { text: "本章目录" })]);
  tocBtn.addEventListener("click", openToc);
  const pager = el("div", { class: "lx-pager" });
  const crumbSlot = el("div", { class: "lx-bar__crumbs" });
  sk.bar.replaceChildren(crumbSlot, el("div", { class: "lx-bar__actions" }, [tocBtn, pager]));

  const order = all.filter((t) => topicHref(t, base));
  const linkFor = (t) => {
    const a = anchorFor(t);
    return pagePath(t.legacy_url) === rel && a ? `#${a}` : topicHref(t, base);
  };
  function paint() {
    const topic = current ? model.topicById.get(current) : null;
    crumbSlot.replaceChildren(crumbs(model, topic, base, subjectId));
    const i = topic ? order.findIndex((t) => t.id === topic.id) : -1;
    const prev = i > 0 ? order[i - 1] : null;
    const next = i >= 0 && i < order.length - 1 ? order[i + 1] : null;
    pager.replaceChildren(
      el(prev ? "a" : "span", { class: `sh-btn lx-pager__btn${prev ? "" : " is-off"}`, href: prev ? linkFor(prev) : null, "aria-disabled": prev ? null : "true", title: prev?.title || null }, [icon("chevronLeft", 15), el("span", { text: "上一节" })]),
      el(next ? "a" : "span", { class: `sh-btn lx-pager__btn${next ? "" : " is-off"}`, href: next ? linkFor(next) : null, "aria-disabled": next ? null : "true", title: next?.title || null }, [el("span", { text: "下一节" }), icon("chevron", 15)])
    );
    sk.side.replaceChildren(...(topic ? [pathCard(model, topic.id, base), statusCard(model, topic.id, base)] : []));
    for (const a of sk.toc.querySelectorAll(".lx-toc__item[data-topic]")) {
      const on = a.dataset.topic === current;
      a.classList.toggle("is-current", on);
      if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
    }
  }
  paint();

  // 手机：每个知识点正文后面放一张学习路径卡（多知识点长页）。
  if (tracked.length > 1 && !cfg.proxy) {
    for (const t of tracked) {
      const sec = document.getElementById(anchorFor(t));
      if (!sec) continue;
      const inline = pathCard(model, t.id, base, { compact: true });
      sec.after(inline);
    }
  } else {
    document.body.classList.add("lx-single");
  }

  if (tracked.length > 1) {
    const els = tracked.map((t) => [t.id, document.getElementById(anchorFor(t))]);
    let ticking = false;
    const spy = () => {
      ticking = false;
      const line = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sh-header")) || 60) + 120;
      let id = els[0][0];
      for (const [tid, node] of els) {
        if (node.hidden) continue;
        if (node.getBoundingClientRect().top <= line) id = tid;
      }
      if (id !== current) { current = id; paint(); }
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
    addEventListener("hashchange", spy);
    setTimeout(spy, 300);
  }
}
