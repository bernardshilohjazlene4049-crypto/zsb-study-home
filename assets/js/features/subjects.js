import { h } from "../core/dom.js";
import { siteUrl } from "../core/paths.js";
import { SUBJECT_STATUS } from "./labels.js";
import { searchCatalog } from "./catalog.js";
import { visualFor } from "./subject-visual.js";
import { icon } from "./icons.js";
import { buildMindmapNodes, mountMindmap } from "./mindmap.js";

const TABS = [
  ["topics", "知识点目录"],
  ["videos", "视频讲解"],
  ["mindmap", "思维导图"],
  ["notes", "个人笔记"]
];

function statusBadge(subject) {
  const label = SUBJECT_STATUS[subject.status] || subject.status;
  return h("span", { class: `badge badge-${subject.status}` }, label);
}

function subjectTopics(catalog, subjectId) {
  return catalog.topics.filter((topic) => topic.subject_id === subjectId);
}

function progressCount(catalog, learning, subjectId) {
  const topics = subjectTopics(catalog, subjectId);
  const ids = new Set((learning?.progress || []).map((item) => item.topic_id));
  return { done: topics.filter((topic) => ids.has(topic.id)).length, total: topics.length };
}

export function renderCatalogGrid(catalog, learning, optionalOn) {
  const subjects = catalog.visibleSubjects(optionalOn).filter((subject) => !subject.optional);
  return h("div", { class: "subject-grid card-grid", id: "subjectGrid" }, subjects.map((subject) => subjectCard(catalog, learning, subject)));
}

function subjectCard(catalog, learning, subject) {
  const visual = visualFor(subject.id);
  const topics = subjectTopics(catalog, subject.id);
  const { done, total } = progressCount(catalog, learning, subject.id);
  const pct = total ? Math.round(done / total * 100) : 0;
  const ready = subject.status === "live" && Boolean(subject.homeUrl);
  return h("a", {
    class: "subject-card content-card",
    href: `#/subject/${subject.id}`,
    style: `--subject-color:${visual.color};--subject-tint:${visual.tint}`
  }, [
    h("div", { class: "content-card__body" }, [
      h("div", { class: "subject-top" }, [
        h("div", { class: "subject-icon" }, visual.ico),
        ready ? null : h("span", { class: "badge badge--warning" }, "即将开放")
      ]),
      h("h3", { class: "content-card__title" }, subject.name),
      subject.summary && !subject.summary.includes("即将开放") ? h("p", { class: "content-card__text" }, subject.summary) : null,
      h("div", { class: "content-card__footer" }, [
        h("span", {}, `${topics.length} 个知识点`)
      ]),
      h("div", { class: "progress-track" }, [h("span", { class: "progress-track__fill", style: `width:${pct}%` })])
    ])
  ]);
}

export function renderSubjectIndex(ctx) {
  const { catalog, optionalOn, query } = ctx;
  const fixed = catalog.visibleSubjects(optionalOn).filter((subject) => !subject.optional);
  const extra = catalog.visibleSubjects(optionalOn).filter((subject) => subject.optional);
  const results = query ? searchCatalog(catalog, query, ctx.notes || [], optionalOn) : [];
  return h("div", { class: "stack" }, [
    h("header", { class: "page-head" }, [
      h("div", {}, [
        h("h1", {}, "七科知识目录")
      ])
    ]),
    query ? renderSearchResults(results) : null,
    h("div", { class: "section-head" }, [
      h("h3", {}, "七科学习入口"),
      h("span", {}, `七科 · ${fixed.length}`)
    ]),
    renderCatalogGrid(catalog, ctx.learning, optionalOn),
    extra.length ? h("section", { class: "stack" }, [
      h("h2", {}, "可选扩展"),
      h("p", { class: "muted" }, "这一科不计入上面的七科数量。"),
      h("div", { class: "subject-grid card-grid" }, extra.map((subject) => subjectCard(catalog, ctx.learning, subject)))
    ]) : null
  ]);
}

function renderSearchResults(results) {
  if (!results.length) {
    return h("div", { class: "empty" }, [
      h("strong", {}, "没有匹配内容")
    ]);
  }
  return h("div", { class: "panel glass" }, [
    h("div", { class: "panel-title" }, [h("h3", {}, "搜索结果"), h("span", {}, `${results.length} 条`)]),
    h("div", { class: "topic-list" }, results.map((result) => h("a", { class: "topic-item", href: result.href }, [
      h("span", { class: "badge" }, result.type),
      h("div", { class: "topic-info" }, [
        h("strong", {}, result.title),
        h("small", {}, result.source || "")
      ])
    ])))
  ]);
}

export function renderSubjectDetail(ctx) {
  const subject = ctx.catalog.subject(ctx.id);
  if (!subject || (subject.optional && !ctx.optionalOn)) {
    return h("div", { class: "empty" }, [
      h("strong", {}, "没有这个科目"),
      h("a", { class: "btn", href: "#/subjects" }, "返回目录")
    ]);
  }
  const visual = visualFor(subject.id);
  const tab = TABS.some(([id]) => id === ctx.tab) ? ctx.tab : "topics";
  const legacy = subject.homeUrl
    ? h("a", { class: "btn small", href: siteUrl(subject.homeUrl) }, "打开原科目页 ↗")
    : h("p", { class: "notice" }, "暂无科目页");
  return h("div", { class: "stack" }, [
    h("div", { class: "subject-detail-head" }, [
      h("a", { class: "back-link", href: "#/subjects", "aria-label": "返回目录" }, [icon("back", 16)]),
      h("div", { class: "detail-icon", style: `background:${visual.tint};color:${visual.color}` }, visual.ico),
      h("div", { class: "detail-copy" }, [
        h("h1", { id: "detailTitle" }, subject.name),
        subject.summary ? h("p", { id: "detailDesc" }, subject.summary) : null
      ]),
      h("div", { class: "detail-actions" }, [
        legacy,
        statusBadge(subject)
      ])
    ]),
    h("div", { class: "tabs" }, TABS.map(([id, label]) => h("a", {
      class: `tab${tab === id ? " active" : ""}`,
      href: id === "topics" ? `#/subject/${subject.id}` : `#/subject/${subject.id}?tab=${id}`
    }, label))),
    renderTab(ctx, subject, tab)
  ]);
}

function renderTab(ctx, subject, tab) {
  if (tab === "videos") return renderVideos(ctx, subject);
  if (tab === "mindmap") return renderMindmap(ctx, subject);
  if (tab === "notes") return renderSubjectNotes(ctx, subject);
  return renderTopics(ctx, subject);
}

function renderTopics(ctx, subject) {
  const query = (ctx.query || "").trim().toLowerCase();
  const roots = ctx.catalog.childChapters(null, subject.id);
  return h("div", { class: "stack" }, [
    roots.length
      ? h("div", { class: "panel glass" }, [
        h("div", { class: "panel-title" }, [
          h("h3", {}, "知识点目录"),
          h("span", {}, `${subjectTopics(ctx.catalog, subject.id).length} 个知识点`)
        ]),
        h("div", { class: "stack" }, roots.map((chapter) => renderChapter(ctx.catalog, chapter, query)))
      ])
      : h("div", { class: "empty" }, [
        h("strong", {}, "还没有章节")
      ])
  ]);
}

function renderVideos(ctx, subject) {
  const topicIds = new Set(subjectTopics(ctx.catalog, subject.id).map((topic) => topic.id));
  const videos = ctx.catalog.resources.filter((resource) => resource.kind === "video" && resource.url && (resource.topic_ids || []).some((id) => topicIds.has(id)));
  return h("div", { class: "panel glass" }, [
    h("div", { class: "panel-title" }, [h("h3", {}, "视频讲解"), h("span", {}, videos.length ? `${videos.length} 条` : "待添加")]),
    videos.length
      ? h("div", {}, videos.map((resource) => {
        const topicId = (resource.topic_ids || []).find((id) => topicIds.has(id));
        const topic = topicId ? ctx.catalog.topic(topicId) : null;
        return h("div", { class: "video-card" }, [
          h("div", { class: "video-thumb" }, [icon("video", 23)]),
          h("div", { style: "min-width:0;flex:1" }, [
            h("strong", {}, resource.title || topic?.title || "已登记视频"),
            h("small", {}, topic?.title || ""),
            h("div", { style: "margin-top:6px" }, [
              topicId ? h("a", { class: "btn small", href: `#/topic/${topicId}` }, "打开知识点") : null
            ])
          ])
        ]);
      }))
      : h("div", { class: "resource-empty" }, [
        h("div", { class: "empty-icon" }, [icon("video", 21)]),
        h("strong", {}, "待添加")
      ])
  ]);
}

function renderMindmap(ctx, subject) {
  const host = h("div");
  const nodes = buildMindmapNodes(ctx.catalog, subject.id);
  if (nodes.length) mountMindmap(host, nodes, "");
  return h("div", { class: "panel glass" }, [
    h("div", { class: "panel-title" }, [h("h3", {}, "知识结构图")]),
    nodes.length
      ? h("div", {}, [
        host
      ])
      : h("div", { class: "resource-empty" }, [
        h("strong", {}, "还没有章节")
      ])
  ]);
}

function renderSubjectNotes(ctx, subject) {
  const topicIds = new Set(subjectTopics(ctx.catalog, subject.id).map((topic) => topic.id));
  const notes = (ctx.learning?.notes || []).filter((note) => (note.topic_ids || []).some((id) => topicIds.has(id)));
  return h("div", { class: "panel glass" }, [
    h("div", { class: "panel-title" }, [h("h3", {}, "我的学习笔记")]),
    notes.length
      ? h("div", { class: "topic-list" }, notes.map((note) => {
        const topicId = (note.topic_ids || []).find((id) => topicIds.has(id));
        return h("a", { class: "topic-item", href: topicId ? `#/topic/${topicId}` : "#/notes" }, [
          h("div", { class: "topic-info" }, [
            h("strong", {}, note.title || "笔记"),
            h("small", {}, note.body || "")
          ])
        ]);
      }))
      : h("div", { class: "resource-empty" }, [
        h("strong", {}, "还没有笔记")
      ])
  ]);
}

function chapterMatches(catalog, chapter, query) {
  if (!query) return true;
  if (chapter.title.toLowerCase().includes(query)) return true;
  if (catalog.topicsOf(chapter.id).some((topic) => topicMatches(topic, query))) return true;
  return catalog.childChapters(chapter.id, chapter.subject_id).some((child) => chapterMatches(catalog, child, query));
}

function topicMatches(topic, query) {
  return topic.title.toLowerCase().includes(query)
    || (topic.aliases || []).some((alias) => alias.toLowerCase().includes(query));
}

function renderChapter(catalog, chapter, query) {
  if (!chapterMatches(catalog, chapter, query)) return null;
  const topics = catalog.topicsOf(chapter.id).filter((topic) => !query || topicMatches(topic, query) || chapter.title.toLowerCase().includes(query));
  const children = catalog.childChapters(chapter.id, chapter.subject_id);
  return h("details", { class: "fold", open: true }, [
    h("summary", {}, chapter.title),
    topics.length ? h("div", { class: "topic-list" }, topics.map((topic) => h("div", { class: "topic-item" }, [
      h("div", { class: "topic-info" }, [
        h("a", { href: `#/topic/${topic.id}` }, [h("strong", {}, topic.title)]),
        h("small", {}, [
          catalog.videosForTopic(topic.id).length ? "有视频" : "视频待添加",
          catalog.questionsForTopic(topic.id).some((question) => question.provenance?.kind === "sample") ? " · 示例" : ""
        ].join(""))
      ]),
      h("a", { class: "btn small", href: `#/topic/${topic.id}` }, "打开")
    ]))) : h("p", { class: "muted" }, "这一层还没有知识点。"),
    ...children.map((child) => renderChapter(catalog, child, query))
  ]);
}
