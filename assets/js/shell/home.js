// 首页：继续学习、今日到期复习、科目地图进度。没有本机记录时保持空状态。
import { loadModel, resetLearningCache, topicHref } from "./model.js";
import { el, icon, bar, shortSubjectName } from "./ui.js";
import { hydrateIcons } from "./common.js";

function startState(model) {
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
  return el("div", { class: "home-start" }, [
    el("span", { class: "home-start__art" }, [icon("book", 24)]),
    el("span", { class: "home-start__copy" }, [
      el("strong", { text: "还没有学习记录" }),
      el("span", { text: "从一门科目的知识目录开始。" })
    ]),
    el("a", { class: "sh-btn sh-btn--primary home-start__action", href: "#review-subjects" }, "选择科目")
  ]);
}

function dueEmptyState(model, base) {
  const hasRecords = model.hasRecords;
  return el("div", { class: "home-due__empty" }, [
    el("p", {
      class: "sh-empty-line",
      text: hasRecords ? "今天没有到期的复习。" : "完成一次自测后，复习任务会在这里排队。"
    }),
    el("a", {
      href: hasRecords ? `${base}study/overview.html` : "#review-subjects",
      text: hasRecords ? "查看全部学习记录 →" : "选择第一个知识点 →"
    })
  ]);
}

export async function mount(shell) {
  hydrateIcons();
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
      slot.replaceChildren(startState(model));
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

  const initialModel = await loadModel();
  paint(initialModel);
  import("./system-study.js")
    .then((m) => m.enhanceHomeAndOverview({ shell, model: initialModel }))
    .catch(() => {});
  addEventListener("pageshow", async (event) => {
    const navigation = performance.getEntriesByType("navigation")[0];
    if (!event.persisted && navigation?.type !== "back_forward") return;
    resetLearningCache();
    const freshModel = await loadModel();
    paint(freshModel);
    import("./system-study.js")
      .then((m) => m.enhanceHomeAndOverview({ shell, model: freshModel }))
      .catch(() => {});
  });
}
