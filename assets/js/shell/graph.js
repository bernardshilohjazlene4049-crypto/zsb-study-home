// 知识点关系图：只画当前知识点附近一层（上面先修、下面后续）。硬先修实线、软先修虚线；可按本机学习记录着色。
import { loadModel, topicHref } from "./model.js";
import { el, icon, statusDot, STATUS_LABEL, shortSubjectName } from "./ui.js";
import { hydrateIcons } from "./common.js";
import { renderToc, crumbs } from "./lecture.js";

const COLOR_KEY = "zsb.ui.graphColor";
const NS = "http://www.w3.org/2000/svg";

function pickTopic(model) {
  const want = new URLSearchParams(location.search).get("topic");
  if (want && model.topicById.has(want)) return model.topicById.get(want);
  let last = "";
  try { last = localStorage.getItem("zsb.ui.lastTopic") || ""; } catch { /* ignore */ }
  if (model.topicById.has(last)) return model.topicById.get(last);
  return model.continueItem()?.topic || model.topicsOfSubject("math")[0] || model.site.topics[0];
}

function node(model, topic, base, kind, edge, colored) {
  const href = topicHref(topic, base);
  const status = model.topicStatus(topic.id);
  const tag = kind === "current" ? "当前知识点" : kind === "pre" ? (edge.strength === "hard" ? "硬先修" : "软先修") : "后续";
  const label = `${topic.title}，${tag}${colored ? "，" + STATUS_LABEL[status] : ""}`;
  return el(href ? "a" : "span", { class: `g-node g-node--${kind}${colored ? ` is-${status}` : ""}`, href: href || null, "data-topic": topic.id, "aria-label": label, title: topic.title }, [
    kind === "current" ? icon("book", 20, "g-node__book") : (colored ? statusDot(status) : el("span", { class: "sh-dot sh-dot--plain" })),
    el("span", { class: "g-node__text" }, [el("strong", { text: topic.title }), el("small", { text: tag })])
  ]);
}

function drawEdges(stage, svg) {
  const box = stage.getBoundingClientRect();
  svg.setAttribute("width", String(box.width));
  svg.setAttribute("height", String(box.height));
  svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
  const keep = svg.querySelector("defs");
  svg.replaceChildren(keep);
  const cur = stage.querySelector(".g-node--current");
  if (!cur) return;
  const c = cur.getBoundingClientRect();
  const cx = c.left + c.width / 2 - box.left;
  for (const n of stage.querySelectorAll(".g-node--pre, .g-node--post")) {
    const r = n.getBoundingClientRect();
    const x = r.left + r.width / 2 - box.left;
    const pre = n.classList.contains("g-node--pre");
    const y1 = pre ? r.bottom - box.top : c.bottom - box.top;
    const y2 = pre ? c.top - box.top - 4 : r.top - box.top - 4;
    const x1 = pre ? x : cx, x2 = pre ? cx : x;
    const mid = (y1 + y2) / 2;
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", `M${x1},${y1} C${x1},${mid} ${x2},${mid} ${x2},${y2}`);
    path.setAttribute("class", `g-edge${n.dataset.strength === "soft" ? " g-edge--soft" : ""}${pre ? "" : " g-edge--post"}`);
    path.setAttribute("marker-end", "url(#g-arrow)");
    svg.append(path);
  }
}

function legend() {
  const line = (cls, text) => el("li", {}, [el("span", { class: `g-legend__line ${cls}`, "aria-hidden": "true" }), el("span", { text })]);
  const dot = (st, text) => el("li", {}, [statusDot(st), el("span", { text })]);
  return el("div", { class: "g-legend", id: "g-legend" }, [
    el("h2", { class: "g-legend__title", text: "图例" }),
    el("p", { class: "g-legend__group", text: "关系类型" }),
    el("ul", {}, [line("is-hard", "硬先修（必须先学）"), line("is-soft", "软先修（建议先学）"), line("is-post", "后续")]),
    el("p", { class: "g-legend__group g-legend__status", text: "学习状态" }),
    el("ul", { class: "g-legend__status" }, [dot("mastered", "已掌握"), dot("learning", "学习中"), dot("due", "不稳 / 到期复习"), dot("none", "未学")])
  ]);
}

export async function mount(shell) {
  hydrateIcons();
  const base = shell.base;
  const stage = document.querySelector('[data-slot="stage"]');
  const tools = document.querySelector('[data-slot="tools"]');
  const side = document.querySelector('[data-slot="side"]');
  const toc = document.querySelector("#lx-toc");
  const bar = document.querySelector(".lx-bar");
  document.body.classList.add("shell-lecture");
  const model = await loadModel();
  const topic = pickTopic(model);
  if (!topic) { stage.replaceChildren(el("div", { class: "graph-state" }, [el("p", { text: "暂无可展示的关联知识点" })])); return; }
  document.title = `${topic.title} · 知识点关系图 · 辽宁专升本计算机组`;
  const chapter = model.topLevel(topic.chapter_id);

  // 左栏：本章目录，点知识点切换关系图。
  const backdrop = el("div", { class: "lx-backdrop", hidden: true });
  document.body.append(backdrop);
  const closeToc = () => { toc.classList.remove("is-open"); backdrop.hidden = true; document.documentElement.classList.remove("lx-lock"); };
  const { close } = renderToc(model, { toc, subjectId: topic.subject_id, chapterIds: chapter ? [chapter.id] : [], rel: shell.rel, base, current: topic.id, onPick: closeToc });
  close.addEventListener("click", closeToc);
  backdrop.addEventListener("click", closeToc);
  for (const a of toc.querySelectorAll("#lx-panel-toc .lx-toc__item[data-topic]")) a.setAttribute("href", `?topic=${encodeURIComponent(a.dataset.topic)}`);
  const tocBtn = el("button", { type: "button", class: "sh-btn lx-bar__toc", "aria-controls": "lx-toc" }, [icon("list", 16), el("span", { text: "本章目录" })]);
  tocBtn.addEventListener("click", () => { toc.classList.add("is-open"); backdrop.hidden = false; document.documentElement.classList.add("lx-lock"); toc.querySelector(".lx-toc__close")?.focus(); });
  const cr = crumbs(model, topic, base, topic.subject_id);
  cr.append(icon("chevron", 13, "lx-crumbs__sep"), el("span", { class: "lx-crumbs__current", text: "知识点关系图" }));
  cr.querySelector(".lx-crumbs__current")?.removeAttribute("aria-current");
  bar.replaceChildren(el("div", { class: "lx-bar__crumbs" }, [cr]), el("div", { class: "lx-bar__actions" }, [tocBtn]));

  const pre = model.prereqs(topic.id).filter((e) => e.topic);
  const post = model.successors(topic.id).filter((e) => e.topic);
  let colored = true;
  try { colored = localStorage.getItem(COLOR_KEY) !== "0"; } catch { /* ignore */ }

  // 工具：着色开关、图例、全屏。
  const sw = el("button", { type: "button", class: "g-switch", role: "switch", "aria-checked": String(colored) }, [el("span", { class: "g-switch__track", "aria-hidden": "true" }, [el("i")]), el("span", { text: "按学习状态着色" })]);
  const legendBtn = el("button", { type: "button", class: "sh-btn g-tool", "aria-expanded": "true", "aria-controls": "g-legend" }, [icon("legend", 16), el("span", { text: "图例" })]);
  const fullBtn = el("button", { type: "button", class: "sh-btn g-tool g-tool--icon", "aria-label": "全屏查看" }, [icon("expand", 16)]);
  tools.replaceChildren(sw, legendBtn, fullBtn);

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "g-edges");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = '<defs><marker id="g-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>';

  function paint() {
    const rows = [];
    if (pre.length) rows.push(el("div", { class: "g-row g-row--pre" }, pre.map((e) => { const n = node(model, e.topic, base, "pre", e, colored); n.dataset.strength = e.strength; return n; })));
    rows.push(el("div", { class: "g-row g-row--current" }, [node(model, topic, base, "current", null, colored)]));
    if (post.length) rows.push(el("div", { class: "g-row g-row--post" }, post.map((e) => { const n = node(model, e.topic, base, "post", e, colored); n.dataset.strength = e.strength; return n; })));
    const canvas = el("div", { class: "g-canvas" }, [svg, el("div", { class: "g-rows" }, rows)]);
    const leg = legend();
    leg.classList.toggle("no-status", !colored);
    leg.hidden = legendBtn.getAttribute("aria-expanded") !== "true";
    const content = [el("div", { class: "g-wrap" }, [canvas, leg])];
    if (!pre.length && !post.length) {
      const href = topicHref(topic, base);
      content.push(el("div", { class: "graph-state graph-state--empty" }, [
        icon("graph", 26), el("p", { class: "graph-state__title", text: "暂无可展示的关联知识点" }),
        href ? el("a", { class: "sh-btn", href, text: "继续学习本知识点" }) : null
      ]));
    }
    stage.replaceChildren(...content);
    requestAnimationFrame(() => drawEdges(canvas, svg));
  }
  sw.addEventListener("click", () => {
    colored = !colored;
    sw.setAttribute("aria-checked", String(colored));
    try { localStorage.setItem(COLOR_KEY, colored ? "1" : "0"); } catch { /* ignore */ }
    paint();
  });
  legendBtn.addEventListener("click", () => {
    const open = legendBtn.getAttribute("aria-expanded") !== "true";
    legendBtn.setAttribute("aria-expanded", String(open));
    const leg = stage.querySelector(".g-legend");
    if (leg) leg.hidden = !open;
    const canvas = stage.querySelector(".g-canvas");
    if (canvas) requestAnimationFrame(() => drawEdges(canvas, svg));
  });
  fullBtn.addEventListener("click", () => {
    const card = document.querySelector(".graph-card");
    if (document.fullscreenElement) document.exitFullscreen?.();
    else card?.requestFullscreen?.().catch(() => {});
  });
  if (matchMedia("(max-width: 820px)").matches) legendBtn.setAttribute("aria-expanded", "false");
  paint();
  const ro = new ResizeObserver(() => { const canvas = stage.querySelector(".g-canvas"); if (canvas) drawEdges(canvas, svg); });
  ro.observe(stage);

  // 右栏：当前知识点信息与操作。
  const s = model.topicStats(topic.id);
  const status = model.topicStatus(topic.id);
  const href = topicHref(topic, base);
  const rel = (label, list, ico) => el("details", { class: "g-related" }, [
    el("summary", {}, [icon(ico, 15), el("span", { text: `${label}（${list.length}）` }), icon("chevron", 14, "g-related__chev")]),
    list.length ? el("ul", {}, list.map((e) => { const h = topicHref(e.topic, base); return el("li", {}, [el("a", { href: `?topic=${encodeURIComponent(e.topic.id)}`, text: e.topic.title }), h ? el("a", { class: "g-related__go", href: h, "aria-label": `打开讲义：${e.topic.title}` }, [icon("arrowRight", 14)]) : null]); })) : el("p", { class: "lx-path__none", text: "暂无" })
  ]);
  side.replaceChildren(el("section", { class: "sh-card g-info", "aria-label": "当前知识点" }, [
    el("span", { class: "g-info__chip", text: "当前知识点" }),
    el("h2", { class: "g-info__title", text: topic.title }),
    el("dl", { class: "g-info__rows" }, [
      el("dt", {}, [icon("book", 15), "所属章节"]), el("dd", { text: chapter?.title || shortSubjectName(model.subjectById.get(topic.subject_id)) }),
      el("dt", {}, [icon("layers", 15), "关系统计"]), el("dd", { text: `先修 ${pre.length} 个 · 后续 ${post.length} 个` }),
      ...(model.hasRecords ? [el("dt", {}, [icon("chart", 15), "学习状态"]), el("dd", { text: STATUS_LABEL[status] })] : [])
    ]),
    el("h3", { class: "g-info__sub", text: "操作" }),
    el("div", { class: "g-info__actions" }, [
      href ? el("a", { class: "sh-btn sh-btn--primary", href }, [icon("playCircle", 16), el("span", { text: "进入本知识点" })]) : null,
      s.total ? el("a", { class: "sh-btn", href }, [icon("pencil", 16), el("span", { text: `查看练习（${s.total} 题）` })]) : null,
      s.reviews ? el("a", { class: "sh-btn", href: `${base}study/index.html#/mistakes` }, [icon("book", 16), el("span", { text: `复习（${s.reviews}）` })]) : null
    ]),
    el("h3", { class: "g-info__sub", text: "相关链接" }),
    rel("先修知识", pre, "arrowUp"),
    rel("后续知识", post, "arrowDown")
  ]));
}
