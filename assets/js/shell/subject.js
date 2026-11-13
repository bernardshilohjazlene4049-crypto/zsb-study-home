// 科目首页：真实章节目录、学习地图和本章概览；讲义原文保留在学习资料中。
import { loadModel, topicHref } from "./model.js";
import { el, icon, bar, SUBJECT_ICON, shortSubjectName, statusDot } from "./ui.js";
import { hydrateIcons } from "./common.js";

const SUBJECT_BY_PAGE = { "gs/index.html": "math", "yy/index.html": "english", "jsj/index.html": "computer_basics", "c/index.html": "c_language", "wy/index.html": "web_design" };
const PRACTICE = { math: "gs/practice.html" };

export function splitChapterTitle(title) {
  const m = /^(第\s*[0-9一二三四五六七八九十百]+\s*[章节]|专题[一二三四五六七八九十]+)\s*(.*)$/.exec(String(title || ""));
  return m ? { no: m[1].replace(/\s+/g, " "), name: m[2] } : { no: "", name: String(title || "") };
}

// 继续学习必须命中本科目的实际知识点；否则沿用第一个未学完章，再选章内未学项。
export function selectCurrentTopic(nodes, subjectId, continuation, topicStatus) {
  const continued = continuation?.subject?.id === subjectId
    ? nodes.flatMap((node) => node.topics).find((t) => t.id === continuation.topic?.id) : null;
  const chapter = (continued && nodes.find((node) => node.topics.some((t) => t.id === continued.id)))
    || nodes.find((node) => node.topics.some((t) => topicStatus(t.id) === "none"))
    || nodes.find((node) => node.topics.length) || null;
  const topic = continued || chapter?.topics.find((t) => topicStatus(t.id) === "none") || chapter?.topics[0] || null;
  return { chapter, topic };
}

// sections 是章内小标题；章直属的知识点仍保留，且不重复列出分节知识点。
export function groupChapterTopics(node) {
  const included = new Set();
  const groups = (node.sections || []).map((section) => ({
    chapter: section.chapter,
    topics: section.topics.filter((t) => {
      if (included.has(t.id) || !node.topics.some((item) => item.id === t.id)) return false;
      included.add(t.id);
      return true;
    })
  }));
  const direct = node.topics.filter((t) => !included.has(t.id));
  if (direct.length) groups.push({ chapter: null, topics: direct });
  return groups;
}

function firstHref(node, base) {
  const pick = node.topics.find((t) => topicHref(t, base));
  if (pick) return topicHref(pick, base);
  const ref = node.chapter.source_ref;
  return /\.html(#|$)/.test(ref || "") ? base + ref : "";
}

function setExpanded(button, panel, expanded) {
  button.setAttribute("aria-expanded", String(expanded));
  panel.hidden = !expanded;
}

export async function mount(shell) {
  const subjectId = SUBJECT_BY_PAGE[shell.rel];
  const main = document.querySelector("main.site-main") || document.querySelector("main");
  if (!subjectId || !main) return;
  const base = shell.base;
  document.body.classList.add("shell-page", "shell-subject");
  const hero = main.querySelector(".page-hero");
  if (hero) hero.classList.add("subj-old-hero");

  const model = await loadModel();
  const subject = model.subjectById.get(subjectId);
  const name = shortSubjectName(subject);
  const nodes = model.chaptersOf(subjectId);
  const progress = model.subjectProgress(subjectId);
  const { chapter: current, topic: currentTopic } = selectCurrentTopic(nodes, subjectId, model.continueItem(), model.topicStatus);
  const mobile = matchMedia("(max-width: 760px)");

  function subjectCard(compact = false) {
    return el(compact ? "div" : "header", { class: `subj-head${compact ? " subj-head--compact" : " sh-card"}` }, [
      el("span", { class: "subj-head__icon" }, [icon(SUBJECT_ICON[subjectId] || "book", 24)]),
      el("div", { class: "subj-head__title" }, [el(compact ? "strong" : "h1", { text: name })]),
      progress.hasRecords
        ? el("div", { class: "subj-head__progress" }, [
            el("div", { class: "subj-head__row" }, [el("strong", { text: `${progress.pct}%` }), el("span", { text: `${progress.done} / ${progress.total} 个知识点` })]),
            bar(progress.pct, `${name}学习进度`)
          ])
        : el("div", { class: "subj-head__progress subj-head__progress--empty", text: `${progress.total} 个知识点 · 还没有学习记录` })
    ]);
  }

  function topicList(node, prefix) {
    return el("div", { class: "subj-topics", id: prefix }, groupChapterTopics(node).flatMap((group) => [
      group.chapter ? el("h3", { class: "subj-topics__section", text: group.chapter.title }) : null,
      el("ol", { class: "subj-topics__list" }, group.topics.map((topic) => {
        const isCurrent = topic.id === currentTopic?.id;
        const href = topicHref(topic, base);
        return el("li", {}, [el(href ? "a" : "div", {
          class: `subj-topic${isCurrent ? " is-current" : ""}`, href: href || null, "aria-current": isCurrent ? "true" : null
        }, [
          statusDot(isCurrent ? "current" : model.topicStatus(topic.id)),
          Number.isFinite(topic.order) ? el("span", { class: "subj-topic__no", text: String(topic.order) }) : null,
          el("span", { class: "subj-topic__title", text: topic.title }),
          href ? icon("chevron", 14, "subj-topic__chev") : null
        ])]);
      }))
    ]));
  }

  function chapterList(prefix) {
    return el("ol", { class: "subj-chapters" }, nodes.map((node, index) => {
      const panel = topicList(node, `${prefix}-${index}`);
      const button = el("button", {
        type: "button", class: "subj-chapter__toggle", "aria-controls": panel.id,
        onclick: () => setExpanded(button, panel, panel.hidden)
      }, [icon("chevron", 16, "subj-chapter__chev"), el("span", { class: "subj-chapter__title", text: node.chapter.title }),
        el("small", { class: "subj-chapter__count", text: `${node.topics.length} 个知识点` })]);
      setExpanded(button, panel, node === current);
      return el("li", { class: `subj-chapter${node === current ? " is-current" : ""}` }, [button, panel]);
    }));
  }

  const tocChapters = el("div", { id: "shell-toc-chapters" }, [chapterList("shell-toc-chapter")]);
  const tocMap = el("ol", { class: "subj-chapters subj-toc__map", id: "shell-toc-map", hidden: true }, nodes.map((node) => {
    const href = firstHref(node, base);
    return el("li", {}, [el(href ? "a" : "div", { class: "subj-toc__map-link", href: href || null }, [
      el("span", { text: node.chapter.title }), icon("chevron", 14)
    ])]);
  }));
  const tabButtons = ["本章目录", "学习地图"].map((label, index) => el("button", {
    type: "button", class: "subj-toc__tab", "aria-pressed": String(index === 0),
    "aria-controls": index === 0 ? tocChapters.id : tocMap.id,
    onclick: () => selectTocTab(index)
  }, [label]));
  function selectTocTab(index) {
    tabButtons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    tocChapters.hidden = index !== 0;
    tocMap.hidden = index !== 1;
  }
  const tocPanel = el("div", { id: "shell-toc-panel", class: "subj-toc__panel" }, [
    subjectCard(true), el("div", { class: "subj-toc__tabs", "aria-label": "本章目录" }, tabButtons), tocChapters, tocMap
  ]);
  const tocToggle = el("button", {
    type: "button", class: "subj-disclosure subj-toc__toggle", "aria-controls": tocPanel.id,
    onclick: () => setExpanded(tocToggle, tocPanel, tocPanel.hidden)
  }, [icon("list", 20), el("span", { class: "subj-disclosure__text" }, [
    el("strong", { text: "本章目录" }), el("small", { text: [current?.chapter.title, currentTopic?.title].filter(Boolean).join(" · ") })
  ]), icon("chevron", 16, "subj-disclosure__chev")]);
  const toc = el("aside", { class: "subj-toc sh-card", "aria-label": "本章目录" }, [tocToggle, tocPanel]);

  const navItems = [
    ["学习地图", "#shell-map"],
    ["练习", PRACTICE[subjectId] ? base + PRACTICE[subjectId] : `${base}study/index.html#/practice`],
    ["错题与复习", `${base}study/index.html#/mistakes`],
    ["学习资料", "#shell-materials"]
  ];
  const subnav = el("nav", { class: "subj-nav sh-card", "aria-label": `${name}导航` }, navItems.map(([label, href], i) =>
    el("a", { class: `subj-nav__link${i === 0 ? " is-active" : ""}`, href }, [label])));

  const mapPanel = el("div", { id: "shell-map-panel" }, [chapterList("shell-map-chapter")]);
  const mapToggle = el("button", {
    type: "button", class: "subj-disclosure subj-map__toggle", "aria-controls": mapPanel.id,
    onclick: () => setExpanded(mapToggle, mapPanel, mapPanel.hidden)
  }, [icon("graph", 20), el("span", { class: "subj-disclosure__text" }, [
    el("strong", { text: "学习地图" }), el("small", { text: `${nodes.length} 章 · ${progress.total} 个知识点` })
  ]), icon("chevron", 16, "subj-disclosure__chev")]);
  const map = el("section", { class: "subj-map sh-card", id: "shell-map", "aria-labelledby": "shell-map-title" }, [
    el("h2", { class: "subj-section-title subj-map__title", id: "shell-map-title", text: "学习地图" }), mapToggle, mapPanel
  ]);
  subnav.querySelector('a[href="#shell-map"]').addEventListener("click", () => setExpanded(mapToggle, mapPanel, true));

  let overview = null;
  if (current) {
    const stats = current.topics.map((t) => model.topicStats(t.id));
    const t = splitChapterTitle(current.chapter.title);
    const rows = [
      ["list", "知识点", `${current.topics.length} 个`],
      ["check", "已学", stats.some((s) => s.touched) ? `${stats.filter((s) => s.touched).length} 个` : "—"],
      ["pencil", "练习", stats.some((s) => s.answered) ? `${stats.reduce((n, s) => n + s.answered, 0)} 题` : "—"],
      ["book", "错题", stats.some((s) => s.mistakes) ? `${stats.reduce((n, s) => n + s.mistakes, 0)} 道` : "—"]
    ];
    overview = el("aside", { class: "subj-overview sh-card", "aria-labelledby": "shell-ov-title" }, [
      el("h2", { class: "subj-section-title", id: "shell-ov-title" }, ["本章概览", el("small", { text: `（${t.no || t.name}）` })]),
      el("dl", { class: "subj-overview__rows" }, rows.flatMap(([ico, k, v]) => [el("dt", {}, [icon(ico, 16), k]), el("dd", { text: v })]))
    ]);
  }

  // DOM 顺序与手机阅读、Tab 顺序一致；桌面通过 grid 将目录置于左栏。
  const top = el("div", { class: "subj-shell subj-grid" }, [subjectCard(), subnav, toc, map, overview]);
  const materialsHead = el("div", { class: "subj-materials-head", id: "shell-materials" }, [el("h2", { class: "subj-section-title", text: "学习资料" })]);
  const container = main.firstElementChild;
  main.insertBefore(top, container);
  main.insertBefore(materialsHead, container);
  hydrateIcons(main);

  function syncViewport() {
    selectTocTab(0);
    setExpanded(tocToggle, tocPanel, !mobile.matches);
    setExpanded(mapToggle, mapPanel, !mobile.matches);
  }
  syncViewport();
  mobile.addEventListener("change", syncViewport);

  const links = subnav.querySelectorAll("a[href^='#']");
  const targets = [...links].map((a) => document.querySelector(a.getAttribute("href")));
  const io = new IntersectionObserver(() => {
    let idx = 0;
    targets.forEach((t, i) => { if (t && t.getBoundingClientRect().top < innerHeight * 0.4) idx = i; });
    links.forEach((a, i) => a.classList.toggle("is-active", i === idx));
  }, { threshold: [0, 1] });
  targets.forEach((t) => t && io.observe(t));
}
