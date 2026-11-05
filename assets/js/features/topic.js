import { h } from "../core/dom.js";
import { siteUrl } from "../core/paths.js";
import { UI_KEYS } from "../core/schema.js";
import { mountVideo } from "./video.js";
import { buildMindmapNodes, mountMindmap } from "./mindmap.js";
import { saveNote } from "./records.js";
import { MASTERY_LABEL, isSampleQuestion } from "./labels.js";
import { getAiStatus } from "../adapters/status.js";

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
  const prereqs = (topic.prereq_ids || []).map((id) => ctx.catalog.topic(id)).filter(Boolean);

  const videoHost = h("div");
  const mapHost = h("div");
  const aiNote = h("p", { class: "notice", hidden: true });
  const root = h("article", { class: "stack" }, [
    h("p", { class: "crumbs" }, [
      h("a", { href: "#/subjects" }, "目录"),
      " / ",
      h("a", { href: `#/subject/${topic.subject_id}` }, subject?.name || topic.subject_id),
      " / ",
      topic.title
    ]),
    h("header", { class: "page-head" }, [
      h("div", { class: "row" }, [
        h("h1", {}, topic.title),
        h("span", { class: "badge" }, "未核验目录")
      ]),
      h("p", {}, topic.blurb || ""),
      h("p", { class: "muted" }, chapter ? `所在章节：${chapter.title}` : "")
    ]),
    prereqs.length ? h("p", { class: "muted" }, ["前置：", ...prereqs.flatMap((item, index) => [
      index ? "、" : "",
      h("a", { href: `#/topic/${item.id}` }, item.title)
    ])]) : null,
    videoHost,
    h("section", { class: "panel stack" }, [
      h("h2", {}, "思维导图"),
      h("p", { class: "muted" }, "节点来自当前科目的导航草案。点击知识点会打开对应页面。"),
      mapHost
    ]),
    renderNotes(ctx, topic, note),
    renderQuestions(questions),
    renderMastery(progress),
    h("div", { class: "row" }, [
      topic.legacy_url ? h("a", { class: "btn", href: siteUrl(topic.legacy_url) }, "打开原页面") : null,
      h("button", {
        class: "btn",
        type: "button",
        onclick: () => {
          aiNote.hidden = false;
          aiNote.textContent = getAiStatus().message;
        }
      }, "我没理解，想一步步学"),
      questions[0] ? h("a", { class: "btn btn-primary", href: `#/quiz/${questions[0].id}` }, "做这个知识点的题") : null
    ]),
    aiNote
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
    h("p", { class: "muted" }, "纯文本保存在本机，不会自动上传。"),
    status,
    h("form", {
      class: "stack",
      onsubmit: async (event) => {
        event.preventDefault();
        if (!ctx.dbOk || ctx.readOnly) {
          status.textContent = ctx.dbMessage || "现在不能写入本机数据库。";
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
      h("div", { class: "empty" }, [h("strong", {}, "还没有题目"), h("p", {}, "不会用空白题冒充已有题库。")])
    ]);
  }
  return h("section", { class: "panel stack" }, [
    h("h2", {}, "练习"),
    h("ul", { class: "topic-list" }, questions.map((question) => h("li", {}, [
      isSampleQuestion(question) ? h("span", { class: "badge badge-sample" }, "示例") : h("span", { class: "badge" }, question.provenance?.kind || "题目"),
      h("a", { href: `#/quiz/${question.id}` }, question.stem)
    ])))
  ]);
}

function renderMastery(progress) {
  const state = progress?.mastery_state;
  return h("section", { class: "panel stack" }, [
    h("h2", {}, "掌握与复习"),
    h("p", {}, state ? (MASTERY_LABEL[state] || state) : "还没有这个知识点的练习记录。"),
    h("p", { class: "muted" }, progress?.next_review_at
      ? `下次复习（1/3/7/14 天启发式，不是官方间隔）：${progress.next_review_at}`
      : "还没有下次复习时间。一次做对不会被标成已经完全掌握。"),
    progress ? h("p", { class: "muted" }, `独立做对次数：${progress.independent_correct_count || 0}。示例题不计入真实统计。`) : null
  ]);
}
