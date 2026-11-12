// 首页：继续学习、今日到期复习、科目地图进度。没有本机记录时保持空状态。
import { loadModel, topicHref } from "./model.js";
import { el, icon, bar, shortSubjectName } from "./ui.js";
import { hydrateIcons } from "./common.js";

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
  const model = await loadModel();
  const base = shell.base;

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
  }
}
