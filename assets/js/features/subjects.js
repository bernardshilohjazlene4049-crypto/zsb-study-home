import { h } from "../core/dom.js";
import { siteUrl } from "../core/paths.js";
import { SUBJECT_STATUS } from "./labels.js";
import { searchCatalog } from "./catalog.js";

function statusBadge(subject) {
  const label = SUBJECT_STATUS[subject.status] || subject.status;
  return h("span", { class: `badge badge-${subject.status}` }, label);
}

export function renderSubjectIndex(ctx) {
  const { catalog, optionalOn, query } = ctx;
  const subjects = catalog.visibleSubjects(optionalOn);
  const fixed = subjects.filter((subject) => !subject.optional);
  const extra = subjects.filter((subject) => subject.optional);
  const results = query ? searchCatalog(catalog, query, ctx.notes || [], optionalOn) : [];
  return h("div", { class: "stack" }, [
    h("header", { class: "page-head" }, [
      h("p", { class: "kicker" }, "七科目录"),
      h("h1", {}, "按科目进入章节"),
      h("p", { class: "muted" }, catalog.disclaimer || "目录未经官方考纲核验。")
    ]),
    h("form", {
      class: "search-form",
      role: "search",
      onsubmit: (event) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get("q") || "";
        location.hash = `#/subjects?q=${encodeURIComponent(String(value).trim())}`;
      }
    }, [
      h("label", { class: "search-label", for: "catalog-q" }, "搜索目录"),
      h("input", { id: "catalog-q", name: "q", type: "search", value: query || "", placeholder: "科目、章节、知识点、视频标题" }),
      h("button", { class: "btn btn-primary", type: "submit" }, "搜索")
    ]),
    query ? renderSearchResults(results) : null,
    h("section", { class: "stack" }, [
      h("h2", {}, `固定七科 · ${fixed.length}`),
      h("div", { class: "card-grid" }, fixed.map((subject) => subjectCard(catalog, subject)))
    ]),
    extra.length ? h("section", { class: "stack" }, [
      h("h2", {}, "可选扩展"),
      h("p", { class: "muted" }, "这一科不计入上面的七科数量。"),
      h("div", { class: "card-grid" }, extra.map((subject) => subjectCard(catalog, subject)))
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
  return h("ul", { class: "result-list" }, results.map((result) => h("li", {}, [
    h("a", { href: result.href }, [
      h("span", { class: "badge" }, result.type),
      h("strong", {}, result.title)
    ]),
    h("span", { class: "muted" }, result.source)
  ])));
}

function subjectCard(catalog, subject) {
  const topicCount = catalog.topics.filter((topic) => topic.subject_id === subject.id).length;
  const sampleCount = catalog.questions.filter((question) => question.subject_id === subject.id && question.provenance?.kind === "sample").length;
  return h("a", { class: "info-card", href: `#/subject/${subject.id}` }, [
    h("div", { class: "row" }, [h("h3", {}, subject.name), statusBadge(subject)]),
    h("p", {}, subject.summary || ""),
    h("p", { class: "muted" }, `${topicCount} 个导航知识点${sampleCount ? ` · ${sampleCount} 道示例题` : ""}`)
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
  const query = (ctx.query || "").trim().toLowerCase();
  const roots = ctx.catalog.childChapters(null, subject.id);
  const legacy = subject.homeUrl
    ? h("a", { class: "btn", href: siteUrl(subject.homeUrl) }, "打开原科目页")
    : h("p", { class: "notice" }, "建设中，暂无科目页，所以这里不放链接。");
  return h("div", { class: "stack" }, [
    h("p", { class: "crumbs" }, [
      h("a", { href: "#/subjects" }, "七科目录"),
      " / ",
      subject.name
    ]),
    h("header", { class: "page-head" }, [
      h("div", { class: "row" }, [h("h1", {}, subject.name), statusBadge(subject), h("span", { class: "badge" }, "未核验目录")]),
      h("p", {}, subject.summary || ""),
      h("p", { class: "muted" }, subject.catalog_note || "")
    ]),
    legacy,
    roots.length
      ? h("div", { class: "stack" }, roots.map((chapter) => renderChapter(ctx.catalog, chapter, query)))
      : h("div", { class: "empty" }, [
        h("strong", {}, "还没有章节"),
        h("p", {}, "这个科目尚未导入目录。空着，是为了避免编造章节。")
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
    topics.length ? h("ul", { class: "topic-list" }, topics.map((topic) => h("li", {}, [
      h("a", { href: `#/topic/${topic.id}` }, topic.title),
      catalog.videosForTopic(topic.id).length ? h("span", { class: "badge" }, "有视频") : h("span", { class: "badge" }, "视频待添加"),
      catalog.questionsForTopic(topic.id).some((question) => question.provenance?.kind === "sample")
        ? h("span", { class: "badge badge-sample" }, "示例题")
        : null
    ]))) : h("p", { class: "muted" }, "这一层还没有知识点。"),
    ...children.map((child) => renderChapter(catalog, child, query))
  ]);
}
