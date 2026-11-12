// 科目入口：科目抬头（名称 + 学习进度）、左侧科目导航、章节学习地图、本章概览；原页面内容作为「学习资料」保留在下方。
import { loadModel, topicHref } from "./model.js";
import { el, icon, bar, SUBJECT_ICON, shortSubjectName, statusDot } from "./ui.js";
import { hydrateIcons } from "./common.js";

const SUBJECT_BY_PAGE = { "gs/index.html": "math", "yy/index.html": "english", "jsj/index.html": "computer_basics", "c/index.html": "c_language", "wy/index.html": "web_design" };
const PRACTICE = { math: "gs/practice.html" };

export function splitChapterTitle(title) {
  const m = /^(第\s*[0-9一二三四五六七八九十百]+\s*[章节]|专题[一二三四五六七八九十]+)\s*(.*)$/.exec(String(title || ""));
  return m ? { no: m[1].replace(/\s+/g, " "), name: m[2] } : { no: "", name: String(title || "") };
}

function chapterState(model, node) {
  const p = model.progressOf(node.topics);
  if (!p.total || !p.done) return { p, status: "none" };
  if (p.mastered === p.total) return { p, status: "mastered" };
  return { p, status: "learning" };
}

function firstHref(model, node, base, preferUnlearned) {
  const list = node.topics.filter((t) => topicHref(t, base));
  const pick = (preferUnlearned && list.find((t) => model.topicStatus(t.id) === "none")) || list[0];
  if (pick) return topicHref(pick, base);
  const ref = node.chapter.source_ref;
  return /\.html(#|$)/.test(ref || "") ? base + ref : "";
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

  // 当前章：继续学习所在章，其次第一个未学完的章。
  const cont = model.continueItem();
  let current = nodes.find((n) => cont && cont.subject?.id === subjectId && n.chapter.id === cont.chapter?.id)
    || nodes.find((n) => chapterState(model, n).p.done < n.topics.length) || nodes[0];

  const head = el("header", { class: "subj-head sh-card" }, [
    el("span", { class: "subj-head__icon" }, [icon(SUBJECT_ICON[subjectId] || "book", 24)]),
    el("div", { class: "subj-head__title" }, [el("h1", { text: name })]),
    progress.hasRecords
      ? el("div", { class: "subj-head__progress" }, [
          el("div", { class: "subj-head__row" }, [el("span", { text: "学习进度" }), el("strong", { text: `${progress.pct}%` }), el("span", { class: "subj-head__count", text: `已学 ${progress.done} / ${progress.total} 个知识点` })]),
          bar(progress.pct, `${name}学习进度`)
        ])
      : el("div", { class: "subj-head__progress subj-head__progress--empty" }, [el("span", { text: `${progress.total} 个知识点 · 还没有学习记录` })])
  ]);

  const navItems = [
    ["map", "学习地图", "#shell-map"],
    ["pencil", "练习", PRACTICE[subjectId] ? base + PRACTICE[subjectId] : `${base}study/index.html#/practice`],
    ["book", "错题与复习", `${base}study/index.html#/mistakes`],
    ["folder", "学习资料", "#shell-materials"]
  ];
  const subnav = el("nav", { class: "subj-nav sh-card", "aria-label": `${name}导航` }, navItems.map(([ico, label, href], i) =>
    el("a", { class: `subj-nav__link${i === 0 ? " is-active" : ""}`, href }, [icon(ico, 17), el("span", { text: label })])));

  const list = el("ol", { class: "subj-map__list" }, nodes.map((node) => {
    const { p, status } = chapterState(model, node);
    const t = splitChapterTitle(node.chapter.title);
    const href = firstHref(model, node, base, false);
    const isCurrent = node === current;
    const rowChildren = [
      statusDot(isCurrent && status !== "mastered" ? "current" : status),
      el("span", { class: "subj-map__no", text: t.no }),
      el("span", { class: "subj-map__name", text: t.name || node.chapter.title }),
      p.hasRecords ? el("span", { class: "subj-map__pct", text: `${p.pct}%` }) : el("span", { class: "subj-map__pct subj-map__pct--muted", text: `${p.total} 个知识点` }),
      p.hasRecords ? bar(p.pct, `${node.chapter.title}进度`) : el("span", { class: "subj-map__spacer" }),
      icon("chevron", 16, "subj-map__chev")
    ];
    return el("li", {}, [el(href ? "a" : "div", { class: `subj-map__row${isCurrent ? " is-current" : ""}`, href: href || null, "aria-current": isCurrent ? "step" : null }, rowChildren)]);
  }));
  const map = el("section", { class: "subj-map sh-card", id: "shell-map", "aria-labelledby": "shell-map-title" }, [
    el("h2", { class: "subj-section-title", id: "shell-map-title", text: "学习地图" }),
    nodes.length ? list : el("p", { class: "sh-empty-line", text: "即将开放" })
  ]);

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
    const enter = firstHref(model, current, base, true);
    overview = el("aside", { class: "subj-overview sh-card", "aria-labelledby": "shell-ov-title" }, [
      el("h2", { class: "subj-section-title", id: "shell-ov-title" }, ["本章概览", el("small", { text: `（${t.no || t.name}）` })]),
      el("dl", { class: "subj-overview__rows" }, rows.flatMap(([ico, k, v]) => [el("dt", {}, [icon(ico, 16), k]), el("dd", { text: v })])),
      enter ? el("a", { class: "sh-btn sh-btn--primary subj-overview__go", href: enter }, [el("span", { text: `进入${t.no || "本章"}` }), icon("arrowRight", 16)]) : null
    ]);
  }

  const top = el("div", { class: "subj-shell" }, [head, el("div", { class: "subj-grid" }, [subnav, map, overview])]);
  const materialsHead = el("div", { class: "subj-materials-head", id: "shell-materials" }, [el("h2", { class: "subj-section-title", text: "学习资料" })]);
  const container = main.firstElementChild;
  main.insertBefore(top, container);
  main.insertBefore(materialsHead, container);
  hydrateIcons(main);

  // 左侧导航跟随滚动高亮（学习地图 / 学习资料）。
  const links = subnav.querySelectorAll("a[href^='#']");
  const targets = [...links].map((a) => document.querySelector(a.getAttribute("href")));
  const io = new IntersectionObserver(() => {
    let idx = 0;
    targets.forEach((t, i) => { if (t && t.getBoundingClientRect().top < innerHeight * 0.4) idx = i; });
    links.forEach((a, i) => a.classList.toggle("is-active", i === idx));
  }, { threshold: [0, 1] });
  targets.forEach((t) => t && io.observe(t));
}
