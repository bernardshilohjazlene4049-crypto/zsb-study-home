import { h } from "../core/dom.js";
import { siteUrl } from "../core/paths.js";
import { UI_KEYS } from "../core/schema.js";
import { mountVideo } from "./video.js";
import { buildMindmapNodes, mountMindmap } from "./mindmap.js";
import { saveNote } from "./records.js";
import { MASTERY_LABEL, isSampleQuestion } from "./labels.js";

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
  const root = h("article", { class: "stack" }, [
    h("p", { class: "crumbs" }, [
      h("a", { href: "#/subjects" }, "目录"),
      " / ",
      h("a", { href: `#/subject/${topic.subject_id}` }, subject?.name || topic.subject_id),
      " / ",
      topic.title
    ]),
    h("header", { class: "page-head" }, [
      h("h1", {}, topic.title),
      topic.blurb === "示例" ? h("span", { class: "badge badge-sample" }, "示例") : null,
      chapter ? h("p", { class: "muted" }, `所在章节：${chapter.title}`) : null
    ]),
    prereqs.length ? h("p", { class: "muted" }, ["前置：", ...prereqs.flatMap((item, index) => [
      index ? "、" : "",
      h("a", { href: `#/topic/${item.id}` }, item.title)
    ])]) : null,
    nextTopics.length ? h("p", { class: "muted" }, ["后续：", ...nextTopics.flatMap((item, index) => [
      index ? "、" : "",
      h("a", { href: `#/topic/${item.id}` }, item.title)
    ])]) : null,
    videoHost,
    h("section", { class: "panel stack" }, [
      h("h2", {}, "思维导图"),
      mapHost
    ]),
    renderNotes(ctx, topic, note),
    renderQuestions(questions),
    renderMastery(progress),
    h("div", { class: "row" }, [
      topic.legacy_url ? h("a", { class: "btn", href: siteUrl(topic.legacy_url) }, "打开原页面") : null,
      questions[0] ? h("a", { class: "btn btn-primary", href: `#/quiz/${questions[0].id}` }, "做这个知识点的题") : null
    ])
  ]);

  mountVideo(videoHost, {
    resource: video.resource,
    anchor: video.anchor,
    dbOk: ctx.dbOk && !ctx.readOnly,
    onPlay: () => {}
  });
  mountMindmap(mapHost, buildMindmapNodes(ctx.catalog, topic.subject_id), topic.id);
  return root;
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
