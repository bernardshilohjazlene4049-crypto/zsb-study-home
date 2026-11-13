// 讲义 / 知识点页外壳：桌面三栏（本章目录 | 讲义正文 | 学习路径 + 学习状态），手机上目录收进抽屉、学习路径放到正文后面。
// 正文节点原样搬进中栏，不改动其中任何文字。
import { loadModel, topicHref, pagePath, anchorOf, cnNumber } from "./model.js";
import { el, icon, bar, statusDot, shortSubjectName, formatDay, STATUS_LABEL } from "./ui.js";
import { splitChapterTitle } from "./subject.js";

const WY = { subject: "web_design", wrap: ".wy-layout", hide: [".wy-side", ".mobile-toc-btn"] };
const PAGES = {
  "gs/gs1.html": { subject: "math", wrap: ".study-layout", hide: [".study-index"], hero: ".page-hero", nav: ".study-index a[href^='#']", panels: ".study-content > section", sections: true },
  "gs/gs45.html": { subject: "math", wrap: ".study-layout", hide: [".study-index"], hero: ".page-hero", before: [".route-panel"], nav: ".study-index a[href^='#']", panels: ".route-panel, .study-content > section", sections: true },
  "yy/yy5.html": { subject: "english", children: "main .site-container", panels: ":scope > section", sections: true },
  "jsj/jsj1.html": { subject: "computer_basics", wrap: "main.learn-main", hero: ".hero-area", hide: [".map-index"], panels: ".map-stage > article", sections: true, proxy: (id) => document.querySelector(`.map-index__item[data-chapter="${id.replace(/^mind-/, "")}"]`) },
  "jsj/ppt5.html": { subject: "computer_basics", wrap: "main.learn-main", hero: ".hero-area", panels: ".ppt-card-stack > article", sections: true, anchor: (t) => /^(\d\.\d)/.test(t.title) ? `chapter-${t.title.slice(0, 3)}` : "" }
};

function configFor(rel) {
  if (PAGES[rel]) return PAGES[rel];
  if (/^wy\/ch[12]\/[^/]+\.html$/.test(rel)) return { ...WY, chapterPoints: true };
  if (/^wy\//.test(rel)) return WY;
  return null;
}

export function directoryTopics(topics, chapterPoints = false) {
  return chapterPoints ? topics.filter((t) => !/^wy\/ch[12]\/index\.html$/.test(pagePath(t.legacy_url))) : topics;
}

// 章节页本身不在知识点顺序里：上一节 = 上一章最后一个知识点，下一节 = 本章第一个知识点。
export function chapterPageNeighbors(model, order, chapterId) {
  const k = order.findIndex((t) => model.topLevel(t.chapter_id)?.id === chapterId);
  if (k < 0) return { prev: null, next: null };
  return { prev: k > 0 ? order[k - 1] : null, next: order[k] };
}

export function lectureChapterIds(model, onPage, all, explicit = "") {
  if (explicit && model.topLevel(explicit)) return [model.topLevel(explicit).id];
  return [...new Set((onPage.length ? onPage : all.slice(0, 1)).map((t) => model.topLevel(t.chapter_id)?.id).filter(Boolean))];
}

function q(sel) { return sel ? document.querySelector(sel) : null; }

// 纯数据接口也供 node:test 使用；anchors 包含分区内全部原始 id。
export function pointTabLabel(id, original = "") {
  const numbered = /^(point|topic)-(\d+)$/.exec(id);
  if (numbered) return (numbered[1] === "point" ? "考点" : "专题") + cnNumber(Number(numbered[2]));
  const chapter = /^chapter-(\d+(?:\.\d+)+)$/.exec(id);
  return chapter ? chapter[1] : original;
}

export function panelForHash(panels, hash) {
  let id = String(hash || "").replace(/^#/, "");
  try { id = decodeURIComponent(id); } catch { /* 保留不完整的 URL 编码。 */ }
  if (!id) return null;
  return panels.find((panel) => panel.id === id || panel.anchors?.includes(id)) || null;
}

export function pointNeighbors(panels, index, order, rel) {
  if (index < 0 || index >= panels.length) return { previous: null, next: null };
  const pageIndices = order.map((topic, i) => pagePath(topic.legacy_url) === rel ? i : -1).filter((i) => i >= 0);
  const first = pageIndices[0], last = pageIndices.at(-1);
  return {
    previous: index > 0 ? panels[index - 1] : (first > 0 ? order[first - 1] : null),
    next: index + 1 < panels.length ? panels[index + 1] : (last !== undefined ? order[last + 1] || null : null)
  };
}

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
  const mine = nodes.filter((n) => chapterIds.includes(n.chapter.id)).map((n) => ({ ...n, topics: directoryTopics(n.topics, cfg.chapterPoints) }));
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
  const card = el("section", { class: `sh-card lx-path${compact ? " lx-path--inline" : ""}`, "aria-label": "学习路径" }, [
    el("header", { class: "sh-card__head" }, [
      el("h2", { class: "sh-card__title" }, [icon("graph", 18), el("span", { text: "学习路径" })]),
      el("a", { class: "lx-path__graph", href: `${base}study/graph.html?topic=${encodeURIComponent(topicId)}` }, [el("span", { text: "关系图" }), icon("chevron", 14)])
    ]),
    row("先修", pre, "pre"),
    row("后续", post, "post")
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

export function crumbs(model, topic, base, subjectId, chapterId = "") {
  const subject = model.subjectById.get(subjectId);
  const chapter = model.topLevel(topic?.chapter_id || chapterId);
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

function mountPointTabs({ sk, cfg, tracked, anchorFor, order, rel, linkFor, openToc, closeToc, onCurrent }) {
  const panels = [...sk.body.querySelectorAll(cfg.panels)].map((node, i) => {
    if (!node.id) node.id = `lx-point-panel-${i + 1}`;
    const topic = tracked.find((t) => node.id === anchorFor(t) || node.contains(document.getElementById(anchorFor(t))));
    const originalLink = [...document.querySelectorAll(cfg.nav || "nav a[href^='#']")].find((a) => a.getAttribute("href") === `#${node.id}`);
    const original = originalLink?.querySelector(".index-label, .index-tile__name")?.textContent.trim()
      || originalLink?.querySelector(":scope > span:last-child")?.textContent.trim()
      || originalLink?.textContent.trim()
      || node.querySelector("h2, h3")?.textContent.trim() || "";
    return { id: node.id, node, topic, anchors: [...node.querySelectorAll("[id]")].map((n) => n.id), label: pointTabLabel(node.id, original) };
  });
  if (panels.length < 2) return null;
  document.body.classList.add("lx-point-mode");
  const strip = el("div", { class: "lx-point-switch" });
  const list = el("div", { class: "lx-point-tabs", role: "tablist", "aria-label": "考点切换", "aria-orientation": "horizontal" });
  const arrow = (previous) => el("button", { type: "button", class: "lx-point-arrow", "aria-label": previous ? "上一个考点" : "下一个考点", hidden: true }, [icon(previous ? "chevronLeft" : "chevron", 16)]);
  const left = arrow(true), right = arrow(false);
  const drawer = el("button", { type: "button", class: "lx-point-directory", "aria-label": "本章目录", "aria-controls": "lx-toc" }, [icon("chevronDown", 18)]);
  drawer.addEventListener("click", openToc);
  strip.append(el("strong", { class: "lx-point-switch__label", text: "考点切换" }), left, list, right, drawer);
  // 整条放在 hero 之后；保留各页原来的正文容器及所有正文节点。
  const hero = sk.body.querySelector(cfg.hero || ".page-hero");
  if (hero) hero.after(strip); else sk.body.prepend(strip);
  let active = null, printing = false, proxyObserver = null;
  let alignFrame = 0, routeFrame = 0, alignTimer = 0, layoutObserver = null;
  const alignmentCleanups = [];
  const pagers = new Map();
  const hashFor = (panel) => `#${encodeURIComponent(panel.id)}`;
  const headerBottom = () => document.querySelector(".shell-header")?.getBoundingClientRect().bottom || 0;

  function stopAlignment() {
    cancelAnimationFrame(alignFrame);
    clearTimeout(alignTimer);
    layoutObserver?.disconnect();
    layoutObserver = null;
    while (alignmentCleanups.length) alignmentCleanups.pop()();
  }
  // 一次布局帧内合并定位；图片/字体完成时仅在用户尚未滚动的短窗口内校正。
  function alignTarget(target, focus = false) {
    stopAlignment();
    let settling = true;
    const align = () => {
      cancelAnimationFrame(alignFrame);
      alignFrame = requestAnimationFrame(() => {
        if (!settling || !target.isConnected) return;
        const top = Math.min(document.documentElement.scrollHeight - innerHeight, Math.max(0, scrollY + target.getBoundingClientRect().top - headerBottom() - 16));
        if (Math.abs(scrollY - top) > 1) scrollTo({ top, behavior: "instant" });
        if (focus) {
          if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
          target.focus({ preventScroll: true });
          focus = false;
        }
      });
    };
    const stop = () => { settling = false; stopAlignment(); };
    // stopAlignment 也取消旧目标的异步字体回调。
    const observer = new ResizeObserver(align);
    layoutObserver = observer;
    observer.observe(active?.node || target);
    // 浏览器首次加载/恢复历史时的原生锚点滚动可能晚于分区折叠。
    addEventListener("scroll", align, { passive: true });
    addEventListener("load", align, { once: true });
    alignmentCleanups.push(() => { removeEventListener("scroll", align); removeEventListener("load", align); });
    align();
    document.fonts?.ready.then(() => { if (layoutObserver === observer) align(); });
    alignTimer = setTimeout(stop, 4000);
  }
  for (const event of ["wheel", "touchmove", "pointerdown", "keydown"]) addEventListener(event, stopAlignment, { passive: true, capture: true });

  function showTab(panel) {
    const tab = panel.tab;
    if (tab.offsetLeft < list.scrollLeft) list.scrollLeft = tab.offsetLeft;
    else if (tab.offsetLeft + tab.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollLeft = tab.offsetLeft + tab.offsetWidth - list.clientWidth;
    updateOverflow();
  }
  function updateOverflow() {
    const overflow = list.scrollWidth > list.clientWidth + 1;
    left.hidden = right.hidden = !overflow;
    left.disabled = list.scrollLeft <= 1;
    right.disabled = list.scrollLeft + list.clientWidth >= list.scrollWidth - 1;
  }
  function paintPager(host, panel = active) {
    const neighbors = pointNeighbors(panels, panels.indexOf(panel), order, rel);
    host.replaceChildren(...[neighbors.previous, neighbors.next].map((item, i) => {
      const href = item ? (item.node ? hashFor(item) : linkFor(item)) : null;
      return el(href ? "a" : "button", { type: href ? null : "button", class: `sh-btn lx-pager__btn${href ? "" : " is-off"}`, href, disabled: !href, "aria-disabled": href ? null : "true" }, i === 0
        ? [icon("chevronLeft", 15), el("span", { text: "上一个考点" })]
        : [el("span", { text: "下一个考点" }), icon("chevron", 15)]);
    }));
  }
  function observeProxy() {
    if (proxyObserver) for (const panel of panels) proxyObserver.observe(panel.node, { attributes: true, attributeFilter: ["hidden"] });
  }
  function activate(panel, { proxy = true, historyMode = null, revealBar = false, focus = false } = {}) {
    if (!panel || printing) return;
    stopAlignment();
    const bounds = strip.getBoundingClientRect();
    const outOfView = bounds.top < headerBottom() || bounds.bottom > innerHeight;
    proxyObserver?.disconnect();
    if (cfg.proxy && proxy) cfg.proxy(panel.id)?.click();
    active = panel;
    for (const entry of panels) {
      const selected = entry === panel;
      if (selected) entry.node.removeAttribute("hidden");
      else entry.node.setAttribute("hidden", "until-found");
      entry.tab.setAttribute("aria-selected", String(selected));
      entry.tab.tabIndex = selected ? 0 : -1;
    }
    observeProxy();
    if (historyMode) history[historyMode](null, "", hashFor(panel));
    onCurrent(panel.topic?.id);
    for (const [entry, hosts] of pagers) for (const host of hosts) paintPager(host, entry);
    showTab(panel);
    if (focus) panel.tab.focus({ preventScroll: true });
    if (revealBar && outOfView) alignTarget(strip);
  }

  panels.forEach((panel, i) => {
    const tab = el("button", { type: "button", class: "lx-point-tab", id: `lx-point-tab-${i + 1}`, role: "tab", "aria-selected": "false", "aria-controls": panel.id, tabindex: "-1", text: panel.label });
    panel.tab = tab;
    panel.node.classList.add("lx-point-panel");
    panel.node.setAttribute("role", "tabpanel");
    panel.node.setAttribute("aria-labelledby", tab.id);
    panel.node.setAttribute("tabindex", "0");
    list.append(tab);
    tab.addEventListener("click", () => activate(panel, { historyMode: "replaceState", revealBar: true }));
    tab.addEventListener("keydown", (event) => {
      let index = i;
      if (event.key === "ArrowLeft") index = (i + panels.length - 1) % panels.length;
      else if (event.key === "ArrowRight") index = (i + 1) % panels.length;
      else if (event.key === "Home") index = 0;
      else if (event.key === "End") index = panels.length - 1;
      else if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activate(panels[index], { historyMode: "replaceState", revealBar: true, focus: true });
    });
    panel.node.addEventListener("beforematch", () => activate(panel, { historyMode: "replaceState" }));
    let head = panel.node.querySelector(":scope > .topic-header, :scope > .chapter-heading, :scope > .chapter-top, :scope > .mind-head, :scope > .route-heading, :scope > .reference-heading, :scope > .index-head");
    if (!head) {
      const title = panel.node.querySelector("h2, h3");
      head = el("div");
      if (title) { title.before(head); head.append(title); } else panel.node.prepend(head);
    }
    head.classList.add("lx-point-heading");
    const top = el("div", { class: "lx-pager lx-point-pager lx-point-pager--top" });
    const bottom = el("div", { class: "lx-pager lx-point-pager lx-point-pager--bottom" });
    head.append(top);
    panel.node.append(bottom);
    pagers.set(panel, [top, bottom]);
  });
  const slide = (direction) => list.scrollBy({ left: direction * list.clientWidth * .75, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  left.addEventListener("click", () => slide(-1));
  right.addEventListener("click", () => slide(1));
  list.addEventListener("scroll", updateOverflow, { passive: true });
  new ResizeObserver(() => { if (active) showTab(active); else updateOverflow(); }).observe(list);

  function navigateHash({ focus = false } = {}) {
    cancelAnimationFrame(routeFrame);
    routeFrame = requestAnimationFrame(() => {
      const panel = panelForHash(panels, location.hash);
      let id = location.hash.slice(1);
      try { id = decodeURIComponent(id); } catch { /* 原始 id */ }
      const target = id ? document.getElementById(id) : null;
      if (panel) activate(panel);
      else if (!active || !location.hash) activate(panels.find((p) => p.topic) || panels[0]);
      if (target) {
        for (let ancestor = target.parentElement; ancestor && ancestor !== panel?.node; ancestor = ancestor.parentElement) {
          if (ancestor.tagName === "DETAILS") ancestor.open = true;
        }
        alignTarget(target, focus);
      }
    });
  }
  document.addEventListener("click", (event) => {
    const a = event.target.closest("a[href]");
    if (!a || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || a.hasAttribute("download") || (a.target && a.target !== "_self")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash) return;
    let id = url.hash.slice(1);
    try { id = decodeURIComponent(id); } catch { /* 原始 id */ }
    if (!document.getElementById(id)) return;
    event.preventDefault();
    // 旧讲义的平滑滚动处理不能在分区切换前抢先定位。
    event.stopPropagation();
    if (sk.toc.classList.contains("is-open")) closeToc();
    history.pushState(null, "", url.hash);
    navigateHash({ focus: true });
  }, true);
  // hash-scroll 将既有校正窗口交给标签控制器，避免两个定位器互相拉动。
  globalThis.zsbHashScroll?.setNavigator(navigateHash);
  addEventListener("hashchange", navigateHash);
  addEventListener("popstate", navigateHash);

  if (cfg.proxy) {
    proxyObserver = new MutationObserver(() => {
      if (printing) return;
      const visible = panels.find((p) => !p.node.hasAttribute("hidden"));
      if (visible && visible !== active) activate(visible, { proxy: false, historyMode: "replaceState" });
    });
  }
  let printHidden = null;
  addEventListener("beforeprint", () => {
    if (printing) return;
    printing = true;
    stopAlignment();
    proxyObserver?.disconnect();
    printHidden = panels.map((p) => p.node.getAttribute("hidden"));
    for (const panel of panels) panel.node.removeAttribute("hidden");
  });
  addEventListener("afterprint", () => {
    if (!printing) return;
    panels.forEach((p, i) => { if (printHidden[i] === null) p.node.removeAttribute("hidden"); else p.node.setAttribute("hidden", printHidden[i]); });
    printing = false;
    observeProxy();
  });
  navigateHash();
  return { paintPager };
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
  const explicitChapter = cfg.chapterPoints ? q(cfg.wrap)?.dataset.chapter || "" : "";
  const chapterIds = lectureChapterIds(model, onPage, all, explicitChapter);

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

  const order = directoryTopics(all.filter((t) => topicHref(t, base)), cfg.chapterPoints);
  const linkFor = (t) => {
    const a = anchorFor(t);
    return pagePath(t.legacy_url) === rel && a ? `#${a}` : topicHref(t, base);
  };
  let pointTabs = null;
  function paint() {
    const topic = current ? model.topicById.get(current) : null;
    crumbSlot.replaceChildren(crumbs(model, topic, base, subjectId, explicitChapter));
    const i = topic ? order.findIndex((t) => t.id === topic.id) : -1;
    const { prev, next } = i < 0 && explicitChapter ? chapterPageNeighbors(model, order, explicitChapter)
      : { prev: i > 0 ? order[i - 1] : null, next: i >= 0 && i < order.length - 1 ? order[i + 1] : null };
    if (pointTabs) pointTabs.paintPager(pager);
    else pager.replaceChildren(
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

  if (tracked.length > 1) {
    pointTabs = mountPointTabs({ sk, cfg, tracked, anchorFor, order, rel, linkFor, openToc, closeToc,
      onCurrent: (id) => { if (id) current = id; paint(); } });
    paint();
  } else {
    document.body.classList.add("lx-single");
  }
}
