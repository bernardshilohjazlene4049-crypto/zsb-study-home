import { h } from "../core/dom.js";
import { siteUrl } from "../core/paths.js";
import { UI_KEYS } from "../core/schema.js";
import { mountVideo } from "./video.js";
import { buildMindmapNodes, mountMindmap } from "./mindmap.js";
import { saveNote } from "./records.js";
import { MASTERY_LABEL, isSampleQuestion } from "./labels.js";
import { icon } from "./icons.js";

export function renderTopic(ctx) {
  const topic = ctx.catalog.topic(ctx.id);
  if (!topic) {
    return h("div", { class: "empty" }, [
      h("strong", {}, "没有这个知识点"),
      h("a", { class: "btn", href: "#/subjects" }, "返回目录")
    ]);
  }
  try { localStorage.setItem(UI_KEYS.lastTopic, topic.id); } catch { /* ignore */ }
  const subject = ctx.catalog.subject(topic.subject_id);
  const chapter = ctx.catalog.chapter(topic.chapter_id);
  const video = ctx.catalog.primaryVideo(topic.id);
  const questions = ctx.catalog.questionsForTopic(topic.id);
  const progress = (ctx.learning.progress || []).find((item) => item.topic_id === topic.id);
  const note = (ctx.learning.notes || []).find((item) => (item.topic_ids || []).includes(topic.id));
  const prereqs = ctx.catalog.prerequisites ? ctx.catalog.prerequisites(topic.id) : (topic.prereq_ids || []).map((id) => ctx.catalog.topic(id)).filter(Boolean);
  const nextTopics = ctx.catalog.dependents ? ctx.catalog.dependents(topic.id) : [];

  const videoHost = h("div");
  const mapHost = h("div");
  const mistakeCount = (ctx.learning.mistakes || []).filter((m) => !m.deleted_at && (m.topic_ids || []).includes(topic.id) && m.category !== "consolidate").length;
  const tabDefs = [
    ["learn", "学习", "play"],
    ["practice", "练习", "pencil"],
    ["notes", "笔记", "notebook"],
    ["map", "导图", "layers"],
    ["related", "相关", "arrow"]
  ];
  const panels = {
    learn: h("div", { class: "stack" }, [
      video.resource ? videoHost : null,
      topic.legacy_url ? h("a", { class: "wb-topic__open", href: siteUrl(topic.legacy_url) }, [
        h("span", { class: "wb-topic__open-icon" }, [icon("book")]),
        h("span", {}, [h("strong", {}, "打开讲义"), h("small", {}, chapter?.title || subject?.name || "")]),
        icon("arrow")
      ]) : null,
      renderMastery(progress)
    ]),
    practice: h("div", { class: "stack" }, [
      renderQuestions(questions),
      questions[0] ? h("div", { class: "row" }, [h("a", { class: "btn btn-primary", href: `#/quiz/${questions[0].id}` }, "做这个知识点的题")]) : null
    ]),
    notes: renderNotes(ctx, topic, note),
    map: h("section", { class: "panel stack" }, [h("h2", {}, "思维导图"), mapHost]),
    related: h("section", { class: "panel stack" }, [
      h("h2", {}, "前置与后续"),
      prereqs.length ? h("p", {}, ["前置：", ...prereqs.flatMap((item, index) => [index ? "、" : "", h("a", { href: `#/topic/${item.id}` }, item.title)])]) : h("p", { class: "muted" }, "暂无先修"),
      nextTopics.length ? h("p", {}, ["后续：", ...nextTopics.flatMap((item, index) => [index ? "、" : "", h("a", { href: `#/topic/${item.id}` }, item.title)])]) : h("p", { class: "muted" }, "暂无后续"),
      h("div", { class: "row" }, [h("a", { class: "btn", href: `./graph.html?topic=${encodeURIComponent(topic.id)}` }, "查看关系图")])
    ])
  };
  const tabBar = h("div", { class: "wb-tabs", role: "tablist", "aria-label": "知识点内容" });
  const panelWrap = h("div", { class: "wb-panels" });
  for (const [key, label, ico] of tabDefs) {
    const btn = h("button", { type: "button", class: "wb-tab", role: "tab", id: `wb-tab-${key}`, "aria-controls": `wb-panel-${key}`, "aria-selected": key === "learn" ? "true" : "false" }, [icon(ico, 16), label]);
    const panel = h("div", { class: "wb-panel", role: "tabpanel", id: `wb-panel-${key}`, "aria-labelledby": `wb-tab-${key}` }, [panels[key]]);
    if (key !== "learn") panel.hidden = true;
    btn.addEventListener("click", () => {
      for (const b of tabBar.children) b.setAttribute("aria-selected", b === btn ? "true" : "false");
      for (const p of panelWrap.children) p.hidden = p !== panel;
    });
    tabBar.append(btn);
    panelWrap.append(panel);
  }

  const article = h("article", { class: "stack wb-topic__main" }, [
    h("div", { class: "lx-bar wb-topic__bar" }),
    h("header", { class: "wb-topic__head" }, [
      h("h1", {}, topic.title),
      topic.blurb === "示例" ? h("span", { class: "badge badge-sample" }, "示例") : null,
      h("div", { class: "wb-topic__actions" }, [
        progress?.mastery_state ? h("span", { class: "wb-chip" }, MASTERY_LABEL[progress.mastery_state] || progress.mastery_state) : h("span", { class: "wb-chip wb-chip--muted" }, "未学"),
        mistakeCount ? h("a", { class: "wb-chip", href: "#/mistakes" }, `错题（${mistakeCount}）`) : null
      ])
    ]),
    tabBar,
    panelWrap
  ]);
  const toc = h("aside", { class: "lx-toc", id: "lx-toc", "aria-label": "本章目录" });
  const side = h("aside", { class: "lx-side", "aria-label": "学习路径与学习状态" });
  const root = h("div", { class: "lx wb-topic" }, [toc, h("div", { class: "lx-main" }, [article]), side]);

  if (video.resource) {
    mountVideo(videoHost, {
      resource: video.resource,
      anchor: video.anchor,
      dbOk: ctx.dbOk && !ctx.readOnly,
      onPlay: () => {}
    });
  }
  mountMindmap(mapHost, buildMindmapNodes(ctx.catalog, topic.subject_id), topic.id);
  mountShellParts({ topic, toc, side, bar: article.querySelector(".wb-topic__bar") });
  return root;
}

// 左栏目录、右栏学习路径 / 学习状态与讲义页共用外壳组件（异步载入，不影响主体渲染）。
async function mountShellParts({ topic, toc, side, bar }) {
  try {
    const [{ loadModel }, lecture, ui] = await Promise.all([import("../shell/model.js"), import("../shell/lecture.js"), import("../shell/ui.js")]);
    const model = await loadModel();
    const chapter = model.topLevel(topic.chapter_id);
    const backdrop = h("div", { class: "lx-backdrop", hidden: true });
    document.body.append(backdrop);
    const closeToc = () => { toc.classList.remove("is-open"); backdrop.hidden = true; document.documentElement.classList.remove("lx-lock"); };
    const { close } = lecture.renderToc(model, { toc, subjectId: topic.subject_id, chapterIds: chapter ? [chapter.id] : [], rel: "study/index.html", base: "../", current: topic.id, onPick: closeToc });
    close.addEventListener("click", closeToc);
    backdrop.addEventListener("click", closeToc);
    for (const a of toc.querySelectorAll("#lx-panel-toc .lx-toc__item[data-topic]")) a.setAttribute("href", `#/topic/${a.dataset.topic}`);
    const path = lecture.pathCard(model, topic.id, "../");
    for (const a of path.querySelectorAll(".sh-chip[data-topic]")) a.setAttribute("href", `#/topic/${a.dataset.topic}`);
    side.replaceChildren(path, lecture.statusCard(model, topic.id, "../"));
    const tocBtn = h("button", { type: "button", class: "sh-btn lx-bar__toc", "aria-controls": "lx-toc" }, [ui.icon("list", 16), h("span", {}, "本章目录")]);
    tocBtn.addEventListener("click", () => { toc.classList.add("is-open"); backdrop.hidden = false; document.documentElement.classList.add("lx-lock"); toc.querySelector(".lx-toc__close")?.focus(); });
    const crumbs = lecture.crumbs(model, topic, "../", topic.subject_id);
    bar.replaceChildren(h("div", { class: "lx-bar__crumbs" }, [crumbs]), h("div", { class: "lx-bar__actions" }, [tocBtn]));
  } catch (error) {
    console.warn("知识点外壳加载失败", error);
  }
}

function renderNotes(ctx, topic, note) {
  const status = h("p", { class: "muted" }, note ? `上次保存 ${note.updated_at}` : "还没有笔记。");
  return h("section", { class: "panel stack" }, [
    h("h2", {}, "笔记"),
    status,
    h("form", {
      class: "stack",
      onsubmit: async (event) => {
        event.preventDefault();
        if (!ctx.dbOk || ctx.readOnly) {
          status.textContent = ctx.dbMessage || "现在不能保存。";
          return;
        }
        const data = new FormData(event.currentTarget);
        await saveNote({
          topicId: topic.id,
          title: String(data.get("title") || topic.title),
          body: String(data.get("body") || "")
        });
        await ctx.reload();
        ctx.render();
      }
    }, [
      h("label", { class: "stack" }, ["标题", h("input", { name: "title", value: note?.title || topic.title })]),
      h("label", { class: "stack" }, ["正文", h("textarea", { name: "body", rows: "6" }, note?.body || "")]),
      h("button", { class: "btn btn-primary", type: "submit" }, "保存笔记")
    ])
  ]);
}

function renderQuestions(questions) {
  if (!questions.length) {
    return h("section", { class: "panel" }, [
      h("h2", {}, "练习"),
      h("div", { class: "empty" }, [h("strong", {}, "暂无内容")])
    ]);
  }
  return h("section", { class: "panel stack" }, [
    h("h2", {}, "练习"),
    h("ul", { class: "topic-list" }, questions.map((question) => h("li", {}, [
      isSampleQuestion(question) ? h("span", { class: "badge badge-sample" }, "示例") : h("span", { class: "badge" }, "题目"),
      h("a", { href: `#/quiz/${question.id}` }, question.stem)
    ])))
  ]);
}

function renderMastery(progress) {
  if (!progress) return null;
  const state = progress.mastery_state;
  return h("section", { class: "panel stack" }, [
    h("h2", {}, "掌握与复习"),
    state ? h("p", {}, MASTERY_LABEL[state] || state) : null,
    progress.next_review_at ? h("p", {}, `下次复习：${progress.next_review_at}`) : null,
    h("p", {}, `独立做对次数：${progress.independent_correct_count || 0}`)
  ]);
}
