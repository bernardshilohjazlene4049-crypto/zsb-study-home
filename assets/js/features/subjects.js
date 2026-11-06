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
  return h("div", { class: "subject-grid", id: "subjectGrid" }, subjects.map((subject) => subjectCard(catalog, learning, subject)));
}

function subjectCard(catalog, learning, subject) {
  const visual = visualFor(subject.id);
  const topics = subjectTopics(catalog, subject.id);
  const { done, total } = progressCount(catalog, learning, subject.id);
  const pct = total ? Math.round(done / total * 100) : 0;
  const ready = subject.status === "live" && Boolean(subject.homeUrl);
  return h("a", {
    class: "subject-card",
    href: `#/subject/${subject.id}`,
    style: `--subject-color:${visual.color};--subject-tint:${visual.tint}`
  }, [
    h("div", { class: "subject-top" }, [
      h("div", { class: "subject-icon" }, visual.ico),
      h("span", { class: `status ${ready ? "ready" : "build"}` }, ready ? "已有科目页面" : "建设中 / 待配置")
    ]),
    h("h4", {}, subject.name),
    h("p", {}, subject.summary || ""),
    h("div", { class: "subject-meta" }, [
      h("span", {}, `${topics.length} 个目录节点`),
      h("span", {}, ready ? "打开现有页面" : "资源待配置")
    ]),
    h("div", { class: "mini-progress" }, [h("i", { style: `width:${pct}%` })]),
    h("span", { class: "subject-arrow" }, [icon("arrow", 14)])
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
        h("div", { class: "eyebrow" }, "SUBJECT LIBRARY"),
        h("h1", {}, "七科知识目录"),
        h("p", {}, catalog.disclaimer || "目录未经官方考纲核验。")
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
      h("div", { class: "subject-grid" }, extra.map((subject) => subjectCard(catalog, ctx.learning, subject)))
    ]) : h("p", { class: "muted" }, "数字电子技术默认关闭。可在设置中打开，历史记录不会因此被改写。")
  ]);
}

function renderSearchResults(results) {
  if (!results.length) {
    return h("div", { class: "empty" }, [
      h("strong", {}, "没有匹配内容"),
      h("p", {}, "只搜索已经导入的目录、视频标题、示例题和本机笔记。没导入的讲义不会被编成结果。")
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
    : h("p", { class: "notice" }, "建设中，暂无科目页，所以这里不放链接。");
  return h("div", { class: "stack" }, [
    h("div", { class: "subject-detail-head" }, [
      h("a", { class: "back-link", href: "#/subjects", "aria-label": "返回目录" }, [icon("back", 16)]),
      h("div", { class: "detail-icon", style: `background:${visual.tint};color:${visual.color}` }, visual.ico),
      h("div", { class: "detail-copy" }, [
        h("div", { class: "eyebrow" }, "SUBJECT LIBRARY"),
        h("h1", { id: "detailTitle" }, subject.name),
        h("p", { id: "detailDesc" }, [subject.summary, subject.catalog_note].filter(Boolean).join(" · "))
      ]),
      h("div", { class: "detail-actions" }, [
        legacy,
        statusBadge(subject),
        h("span", { class: "badge" }, "未核验目录")
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
          h("span", {}, `${subjectTopics(ctx.catalog, subject.id).length} 个目录节点`)
        ]),
        h("div", { class: "stack" }, roots.map((chapter) => renderChapter(ctx.catalog, chapter, query)))
      ])
      : h("div", { class: "empty" }, [
        h("strong", {}, "还没有章节"),
        h("p", {}, "这个科目尚未导入目录。空着，是为了避免编造章节。")
      ]),
    h("div", { class: "panel glass" }, [
      h("div", { class: "panel-title" }, [h("h3", {}, "学习路径"), h("span", {}, "已导入的顺序")]),
      h("p", { style: "font-size:11px;color:#8794a7;margin:0" }, subject.catalog_note || ctx.catalog.disclaimer || "目录未经官方考纲核验。")
    ])
  ]);
}

function renderVideos(ctx, subject) {
  const topicIds = new Set(subjectTopics(ctx.catalog, subject.id).map((topic) => topic.id));
  const videos = ctx.catalog.resources.filter((resource) => resource.kind === "video" && resource.url && (resource.topic_ids || []).some((id) => topicIds.has(id)));
  return h("div", { class: "panel glass" }, [
    h("div", { class: "panel-title" }, [h("h3", {}, "视频讲解"), h("span", {}, videos.length ? `${videos.length} 条已登记` : "待添加")]),
    videos.length
      ? h("div", {}, videos.map((resource) => {
        const topicId = (resource.topic_ids || []).find((id) => topicIds.has(id));
        const topic = topicId ? ctx.catalog.topic(topicId) : null;
        return h("div", { class: "video-card" }, [
          h("div", { class: "video-thumb" }, [icon("video", 23)]),
          h("div", { style: "min-width:0;flex:1" }, [
            h("strong", {}, resource.title || topic?.title || "已登记视频"),
            h("small", {}, `${topic?.title || "未指定知识点"} · 时长与秒数以登记内容为准`),
            h("div", { style: "margin-top:6px" }, [
              topicId ? h("a", { class: "btn small", href: `#/topic/${topicId}` }, "打开知识点") : null
            ])
          ])
        ]);
      }))
      : h("div", { class: "resource-empty" }, [
        h("div", { class: "empty-icon" }, [icon("video", 21)]),
        h("strong", {}, "尚未配置视频资源"),
        h("p", {}, "这里不会显示虚构的视频时长或时间点。视频只来自仓库里已经登记的资源。")
      ])
  ]);
}

function renderMindmap(ctx, subject) {
  const host = h("div");
  const nodes = buildMindmapNodes(ctx.catalog, subject.id);
  if (nodes.length) mountMindmap(host, nodes, "");
  return h("div", { class: "panel glass" }, [
    h("div", { class: "panel-title" }, [h("h3", {}, "知识结构图"), h("span", {}, "已导入目录")]),
    nodes.length
      ? h("div", {}, [
        host,
        h("div", { class: "map-caption" }, "节点来自当前科目的导航草案。点击知识点会打开对应页面。")
      ])
      : h("div", { class: "resource-empty" }, [
        h("strong", {}, "还没有可展开的导图节点"),
        h("p", {}, "这个科目尚未导入章节，所以不绘制示意节点。")
      ])
  ]);
}

function renderSubjectNotes(ctx, subject) {
  const topicIds = new Set(subjectTopics(ctx.catalog, subject.id).map((topic) => topic.id));
  const notes = (ctx.learning?.notes || []).filter((note) => (note.topic_ids || []).some((id) => topicIds.has(id)));
  return h("div", { class: "panel glass" }, [
    h("div", { class: "panel-title" }, [h("h3", {}, "我的学习笔记"), h("span", {}, "保存在当前浏览器")]),
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
        h("strong", {}, "还没有笔记"),
        h("p", {}, "到具体知识点页面写一条。笔记保存在本机，不会自动上传。")
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
          catalog.questionsForTopic(topic.id).some((question) => question.provenance?.kind === "sample") ? " · 示例题" : ""
        ].join(""))
      ]),
      h("a", { class: "btn small", href: `#/topic/${topic.id}` }, "打开")
    ]))) : h("p", { class: "muted" }, "这一层还没有知识点。"),
    ...children.map((child) => renderChapter(catalog, child, query))
  ]);
}
