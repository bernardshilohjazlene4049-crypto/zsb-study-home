// 首页：继续学习、今日到期复习、科目地图进度。没有本机记录时保持空状态。
import { loadModel, resetLearningCache, topicHref } from "./model.js";
import { el, icon, bar, shortSubjectName } from "./ui.js";
import { hydrateIcons } from "./common.js";

function firstLesson(model, base) {
  const subject = model.subjects
    .filter((item) => item.status === "live" && item.enabled !== false)
    .sort((a, b) => a.order - b.order)
    .find((item) => model.topicsOfSubject(item.id).length);
  if (!subject) return null;
  const topic = model.topicsOfSubject(subject.id).find((item) => topicHref(item, base));
  return topic ? { subject, topic, href: topicHref(topic, base) } : null;
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
  const first = firstLesson(model, base);
  if (!first) {
    return el("div", { class: "home-start" }, [
      el("span", { class: "home-start__art" }, [icon("book", 24)]),
      el("span", { class: "home-start__copy" }, [
        el("strong", { text: "从一门科目开始" }),
        el("span", { text: "选择下面的科目进入学习地图。" })
      ]),
      el("a", { class: "sh-btn sh-btn--primary home-start__action", href: "#subjects" }, "选择科目")
    ]);
  }
  return el("div", { class: "home-start" }, [
    el("span", { class: "home-start__art" }, [icon("book", 24)]),
    el("span", { class: "home-start__copy" }, [
      el("strong", { text: "从第一课开始" }),
      el("span", { text: `${shortSubjectName(first.subject)} · ${first.topic.title}` })
    ]),
    el("a", { class: "sh-btn sh-btn--primary home-start__action", href: first.href }, "开始学习")
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
      slot.replaceChildren(startState(model, base));
    }

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
