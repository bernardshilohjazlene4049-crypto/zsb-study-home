// 首页：继续学习、今日到期复习、科目地图进度。没有本机记录时保持空状态。
import { loadModel, resetLearningCache, topicHref } from "./model.js";
import { el, icon, bar, shortSubjectName } from "./ui.js";
import { hydrateIcons } from "./common.js";

const START_SUBJECTS = ["network", "web_design", "computer_basics"];
const START_ICONS = { network: "network", web_design: "web", computer_basics: "monitor" };
const START_LABELS = { network: "计算机网络", web_design: "网页制作基础", computer_basics: "计算机基础" };

function recommendedLessons(model, base) {
  const ordered = model.subjects
    .filter((item) => item.status === "live" && item.enabled !== false)
    .sort((a, b) => {
      const ai = START_SUBJECTS.indexOf(a.id);
      const bi = START_SUBJECTS.indexOf(b.id);
      return (ai < 0 ? START_SUBJECTS.length : ai) - (bi < 0 ? START_SUBJECTS.length : bi) || a.order - b.order;
    });
  const rows = [];
  for (const subject of ordered) {
    const subjectTopics = model.topicsOfSubject(subject.id);
    const topic = subjectTopics.find((item) => topicHref(item, base).includes("notes/"))
      || subjectTopics.find((item) => topicHref(item, base));
    if (!topic) continue;
    rows.push({
      subject,
      label: START_LABELS[subject.id] || shortSubjectName(subject),
      topic,
      href: topicHref(topic, base),
      icon: START_ICONS[subject.id] || "book"
    });
    if (rows.length === 2) break;
  }
  return rows;
}

function startState(model, base) {
  if (!model.dbOk) {
    return el("div", { class: "home-start home-start--error" }, [
      el("span", { class: "home-start__art" }, [icon("alert", 24)]),
      el("span", { class: "home-start__copy" }, [
        el("strong", { text: "学习记录暂时打不开" }),
        el("span", { text: "你仍可以浏览讲义；恢复后再继续记录学习。" })
      ]),
      el("button", { class: "sh-btn home-start__action", type: "button", onclick: () => location.reload() }, "重试")
    ]);
  }
  const recommendations = recommendedLessons(model, base);
  if (!recommendations.length) {
    return el("div", { class: "home-start" }, [
      el("span", { class: "home-start__art" }, [icon("book", 24)]),
      el("span", { class: "home-start__copy" }, [
        el("strong", { text: "从一门科目开始" }),
        el("span", { text: "选择下面的科目进入学习地图。" })
      ]),
      el("a", { class: "sh-btn sh-btn--primary home-start__action", href: "#subjects" }, "选择科目")
    ]);
  }
  return el("div", { class: "home-recommendations" }, recommendations.map((item) => el(
    "a",
    { class: "home-start home-start--recommended", href: item.href },
    [
      el("span", { class: "home-start__art" }, [icon(item.icon, 22)]),
      el("span", { class: "home-start__copy" }, [
        el("strong", { text: `从 ${item.label} 开始` }),
        el("span", { text: item.topic.title })
      ]),
      icon("chevron", 16, "home-start__chev")
    ]
  )));
}

function dueEmptyState(model, base) {
  const hasRecords = model.hasRecords;
  return el("div", { class: "home-due__empty" }, [
    el("p", {
      class: "sh-empty-line",
      text: hasRecords ? "今天没有到期的复习。" : "完成一次自测后，复习任务会在这里排队。"
    }),
    el("a", {
      href: hasRecords ? `${base}study/overview.html` : `${base}notes/index.html`,
      text: hasRecords ? "查看全部学习记录 →" : "选择第一个知识点 →"
    })
  ]);
}

export async function mount(shell) {
  hydrateIcons();
  for (const link of document.querySelectorAll("[data-review-href]")) link.href = link.dataset.reviewHref;
  for (const chev of document.querySelectorAll(".home-subject__chev:empty")) chev.append(icon("chevron", 16));
  const q = document.querySelector("#home-q");
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !e.ctrlKey && !e.metaKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) {
      e.preventDefault();
      q?.focus();
    }
  });
  const base = shell.base;

  function paint(model) {
    for (const node of document.querySelectorAll(".home-subject[data-subject]")) {
      const meta = node.querySelector("[data-subject-meta]");
      if (!meta) continue;
      const p = model.subjectProgress(node.dataset.subject);
      if (!p.hasRecords) continue;
      meta.replaceChildren(bar(p.pct, `${shortSubjectName(model.subjectById.get(node.dataset.subject))}进度`), el("span", { class: "sh-pct", text: `${p.pct}%` }));
      node.classList.add("has-progress");
    }

    const cont = model.continueItem();
    const slot = document.querySelector('[data-slot="continue"]');
    if (cont && slot) {
      const href = topicHref(cont.topic, base);
      const pct = cont.progress?.pct ?? 0;
      slot.replaceChildren(el(href ? "a" : "div", { class: "home-continue__item", href: href || null }, [
        el("span", { class: "home-continue__art" }, [icon("book", 26)]),
        el("span", { class: "home-continue__text" }, [
          el("strong", { text: shortSubjectName(cont.subject) }),
          el("span", { class: "home-continue__where", text: [cont.chapter?.title, cont.topic.title].filter(Boolean).join(" · ") }),
          el("span", { class: "home-continue__progress" }, [bar(pct, "本章进度"), el("span", { class: "sh-pct", text: `${pct}%` })])
        ]),
        el("span", { class: "home-continue__play" }, [icon("play", 16)])
      ]));
    } else if (slot) {
      slot.replaceChildren(startState(model, base));
    }
    slot?.setAttribute("aria-busy", "false");

    const due = model.dueTopics();
    const dueSlot = document.querySelector('[data-slot="due"]');
    if (due.length && dueSlot) {
      dueSlot.replaceChildren(el("ul", { class: "home-due__list" }, due.slice(0, 5).map((row) => {
        const href = topicHref(row.topic, base);
        return el("li", {}, [el(href ? "a" : "span", { class: "home-due__item", href: href || null }, [
          el("span", { class: "home-due__box", "aria-hidden": "true" }),
          el("span", { class: "home-due__title", text: row.topic.title }),
          el("span", { class: "home-due__meta", text: `（${shortSubjectName(row.subject)}${row.chapter ? " · " + row.chapter.title : ""}）` }),
          icon("chevron", 16, "home-due__chev")
        ])]);
      })));
      if (due.length > 5) dueSlot.append(el("a", { class: "sh-more", href: `${base}study/index.html#/mistakes`, text: `全部 ${due.length} 个` }));
    } else if (dueSlot && !model.dbOk) {
      dueSlot.replaceChildren(el("p", { class: "sh-empty-line", text: "记录恢复后才能检查到期复习。" }));
    } else if (dueSlot) {
      dueSlot.replaceChildren(dueEmptyState(model, base));
    }
  }

  paint(await loadModel());
  addEventListener("pageshow", async (event) => {
    const navigation = performance.getEntriesByType("navigation")[0];
    if (!event.persisted && navigation?.type !== "back_forward") return;
    resetLearningCache();
    paint(await loadModel());
  });
}
