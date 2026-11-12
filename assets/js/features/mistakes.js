import { h } from "../core/dom.js";
import { siteUrl } from "../core/paths.js";
import { CATEGORY_LABEL, formatWhen, isSampleQuestion } from "./labels.js";
import { isMistakeRecord } from "./mistake-rules.js";
import { enrichTopicIds, isExcludedQuestionId } from "./topic-index.js";

// 错题与复习：错题本（按知识点聚合）/ 今日复习 / 复习计划。只读本地记录，没有记录时显示空状态。
function hashParams() {
  const raw = String(location.hash || "").split("?")[1] || "";
  return new URLSearchParams(raw);
}

function mistakesHref(params) {
  const clean = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value && !(key === "sort" && value === "recent")) clean.set(key, value);
  const text = clean.toString();
  return `#/mistakes${text ? `?${text}` : ""}`;
}

function subjectOf(ctx, item) {
  if (item.subject_id) return item.subject_id;
  const topic = ctx.catalog.topic(item.topic_ids?.[0] || "");
  return topic?.subject_id || "";
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function dayKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortName(name) {
  return String(name || "").replace(/（[^）]*）/g, "").trim();
}

export function renderMistakes(ctx) {
  const params = hashParams();
  const tab = ["today", "plan"].includes(ctx.tab) ? ctx.tab : "book";
  const subject = ctx.subjectFilter || "";
  const category = ctx.categoryFilter || "";
  const only = params.get("only") || "";
  const sort = params.get("sort") || "recent";
  const focusTopic = params.get("topic") || "";

  const all = (ctx.learning.mistakes || []).filter((item) => !item.deleted_at && !isExcludedQuestionId(item.question_id)).map(enrichTopicIds);
  const rows = all.filter(isMistakeRecord);
  const isSample = (item) => item.provenance?.kind === "sample";
  const real = rows.filter((item) => item.counts_toward_real_stats === true);
  const sample = rows.filter(isSample);
  const other = rows.filter((item) => !real.includes(item) && !sample.includes(item));
  const reviewPool = all.filter((item) => !isSample(item) && item.status !== "resting" && item.next_review_at);

  const tabs = h("div", { class: "mk-tabs", role: "tablist", "aria-label": "错题与复习" }, [
    ["book", "错题本"], ["today", "今日复习"], ["plan", "复习计划"]
  ].map(([key, label]) => h("a", {
    class: "mk-tab",
    role: "tab",
    href: mistakesHref({ tab: key === "book" ? "" : key, subject: key === "book" ? subject : "" }),
    "aria-selected": key === tab ? "true" : "false"
  }, label)));

  const head = h("header", { class: "mk-head" }, [
    h("h1", {}, "错题与复习"),
    tabs
  ]);

  let body;
  if (tab === "today") body = renderToday(ctx, reviewPool);
  else if (tab === "plan") body = renderPlan(ctx, reviewPool);
  else if (focusTopic) body = renderTopicDetail(ctx, focusTopic, real.concat(other), { subject, category, only, sort });
  else body = renderBook(ctx, { real, sample, other, subject, category, only, sort });
  return h("div", { class: "mk stack" }, [head, body]);
}

function renderBook(ctx, { real, sample, other, subject, category, only, sort }) {
  const pool = real.concat(other);
  const bySubject = new Map();
  for (const item of pool) {
    const id = subjectOf(ctx, item);
    bySubject.set(id, (bySubject.get(id) || 0) + 1);
  }
  const filtered = pool.filter((item) => {
    if (subject && subjectOf(ctx, item) !== subject) return false;
    if (category && item.category !== category) return false;
    if (only === "open" && item.status === "resting") return false;
    if (only === "solved" && item.status !== "resting") return false;
    return true;
  });
  const groups = new Map();
  for (const item of filtered) {
    const id = item.topic_ids?.[0] || "";
    const list = groups.get(id) || [];
    list.push(item);
    groups.set(id, list);
  }
  const cards = [...groups.entries()].map(([topicId, list]) => {
    const latest = list.map((item) => item.updated_at || item.created_at || "").sort().pop() || "";
    const open = list.filter((item) => item.status !== "resting").length;
    return { topicId, list, latest, open };
  });
  cards.sort((a, b) => sort === "count" ? b.list.length - a.list.length || b.latest.localeCompare(a.latest) : b.latest.localeCompare(a.latest));
  const openTopics = cards.filter((card) => card.open > 0).length;

  const subjects = ctx.catalog.visibleSubjects(ctx.optionalOn).filter((item) => ctx.catalog.topics.some((topic) => topic.subject_id === item.id));
  const filters = h("aside", { class: "mk-filters panel", "aria-label": "筛选" }, [
    h("h2", {}, "按科目"),
    h("ul", { class: "mk-subjects list-plain" }, [
      h("li", {}, [h("a", { href: mistakesHref({ category, only, sort }), "aria-current": subject ? null : "true" }, [h("span", {}, "全部错题"), h("span", { class: "mk-count" }, String(pool.length))])]),
      ...subjects.map((item) => h("li", {}, [h("a", {
        href: mistakesHref({ subject: item.id, category, only, sort }),
        "aria-current": subject === item.id ? "true" : null
      }, [h("span", {}, shortName(item.name)), h("span", { class: "mk-count" }, String(bySubject.get(item.id) || 0))])]))
    ]),
    h("form", {
      class: "mk-form stack",
      onchange: (event) => {
        const data = new FormData(event.currentTarget);
        location.hash = mistakesHref({ subject, category: data.get("category"), only: data.get("only"), sort: data.get("sort") });
      }
    }, [
      h("h2", {}, "筛选"),
      h("label", { class: "inline-field" }, ["状态", selectOf("only", only, [["", "全部"], ["open", "只看未掌握"], ["solved", "只看已解决"]])]),
      h("label", { class: "inline-field" }, ["原因", categorySelect(category)]),
      h("label", { class: "inline-field" }, ["排序", selectOf("sort", sort, [["recent", "最近错误优先"], ["count", "错题多优先"]])])
    ])
  ]);

  const list = cards.length
    ? h("ul", { class: "mk-cards list-plain" }, cards.map((card) => topicCard(ctx, card, { subject, category, only, sort })))
    : h("div", { class: "empty" }, [h("strong", {}, pool.length ? "没有符合筛选的错题" : "还没有错题"), pool.length ? null : h("p", { class: "muted" }, "做题时答错或选“不会”，会自动收进这里。")]);

  const main = h("section", { class: "mk-main stack", "aria-label": "按知识点聚合" }, [
    h("div", { class: "mk-main__head" }, [
      h("h2", {}, "按知识点聚合"),
      cards.length ? h("span", { class: "muted" }, `共 ${cards.length} 个知识点，未掌握 ${openTopics} 个`) : null
    ]),
    list,
    sample.length ? h("details", { class: "mk-sample" }, [
      h("summary", {}, `示例题错题（${sample.length}）`),
      groupedMistakeList(ctx, sample)
    ]) : null
  ]);
  return h("div", { class: "mk-grid" }, [filters, main]);
}

function topicCard(ctx, card, state) {
  const topic = ctx.catalog.topic(card.topicId);
  const subject = ctx.catalog.subject(topic?.subject_id || subjectOf(ctx, card.list[0]));
  const chapter = topic ? ctx.catalog.chapter(topic.chapter_id) : null;
  const title = topic?.title || "未归类";
  return h("li", {}, [h("a", { class: "mk-card panel", href: mistakesHref({ ...state, topic: card.topicId || "none" }) }, [
    h("div", { class: "mk-card__main" }, [
      h("strong", {}, title),
      h("span", { class: "muted" }, [shortName(subject?.name), chapter?.title].filter(Boolean).join(" · "))
    ]),
    h("div", { class: "mk-card__meta" }, [
      h("span", { class: "mk-badge" }, `错题 ${card.list.length}`),
      card.open ? h("span", { class: "mk-badge mk-badge--warn" }, "未掌握") : h("span", { class: "mk-badge mk-badge--ok" }, "已解决"),
      card.latest ? h("span", { class: "muted" }, `最近 ${formatWhen(card.latest)}`) : null
    ])
  ])]);
}

function renderTopicDetail(ctx, topicId, pool, state) {
  const list = pool.filter((item) => (item.topic_ids?.[0] || "none") === topicId);
  const topic = ctx.catalog.topic(topicId);
  const subject = topic ? ctx.catalog.subject(topic.subject_id) : null;
  const chapter = topic ? ctx.catalog.chapter(topic.chapter_id) : null;
  const prereqs = topic && ctx.catalog.prerequisites ? ctx.catalog.prerequisites(topic.id) : [];
  const nexts = topic && ctx.catalog.dependents ? ctx.catalog.dependents(topic.id) : [];
  const open = list.filter((item) => item.status !== "resting").length;
  if (!list.length && !topic) {
    return h("div", { class: "stack" }, [
      h("a", { class: "mk-back", href: mistakesHref({ ...state, topic: "" }) }, "← 返回错题本"),
      h("div", { class: "empty" }, [h("strong", {}, "这个知识点暂无错题")])
    ]);
  }
  const links = (items) => items.length
    ? h("ul", { class: "mk-links list-plain" }, items.map((item) => h("li", {}, [h("a", { href: `#/topic/${item.id}` }, item.title)])))
    : h("p", { class: "muted" }, "暂无");
  return h("div", { class: "stack" }, [
    h("a", { class: "mk-back", href: mistakesHref({ ...state, topic: "" }) }, "← 返回错题本"),
    h("div", { class: "mk-grid mk-grid--detail" }, [
      h("section", { class: "panel stack mk-detail" }, [
        h("h2", {}, topic?.title || "未归类"),
        h("p", { class: "muted" }, [shortName(subject?.name), chapter?.title].filter(Boolean).join(" · ")),
        h("div", { class: "row" }, [
          h("span", { class: "mk-badge" }, `错题 ${list.length}`),
          open ? h("span", { class: "mk-badge mk-badge--warn" }, "未掌握") : null
        ]),
        h("div", { class: "row" }, [
          topic?.legacy_url ? h("a", { class: "btn btn-primary", href: siteUrl(topic.legacy_url) }, "进入讲义") : null,
          topic ? h("a", { class: "btn", href: `#/topic/${topic.id}` }, "复习该知识点") : null
        ]),
        topic ? h("div", { class: "mk-rel" }, [
          h("div", {}, [h("h3", {}, "相关先修"), links(prereqs)]),
          h("div", {}, [h("h3", {}, "相关后续"), links(nexts)])
        ]) : null
      ]),
      h("section", { class: "stack mk-main" }, [
        h("h2", {}, `错题（${list.length}）`),
        list.length ? h("ul", { class: "stack list-plain" }, list.map((item) => mistakeCard(ctx, item))) : h("p", { class: "muted" }, "暂无内容")
      ])
    ])
  ]);
}

function reviewRow(ctx, item) {
  const question = ctx.catalog.question(item.question_id);
  const topic = ctx.catalog.topic(item.topic_ids?.[0] || "");
  const href = item.page?.url ? `../${item.page.url}${item.page.anchor ? `#${item.page.anchor}` : ""}` : `#/quiz/${item.question_id}?mode=retry`;
  return h("li", { class: "mk-row panel" }, [
    h("div", { class: "mk-card__main" }, [
      h("strong", {}, topic?.title || "未归类"),
      h("span", { class: "muted mk-stem" }, item.stem_snapshot || question?.stem || "")
    ]),
    h("a", { class: "btn btn-primary", href }, "去复习")
  ]);
}

function renderToday(ctx, pool) {
  const limit = endOfToday();
  const due = pool.filter((item) => new Date(item.next_review_at).getTime() <= limit)
    .sort((a, b) => String(a.next_review_at).localeCompare(String(b.next_review_at)));
  if (!due.length) return h("div", { class: "empty" }, [h("strong", {}, "今天没有到期的复习")]);
  return h("section", { class: "stack" }, [
    h("h2", {}, `今日到期（${due.length}）`),
    h("ul", { class: "stack list-plain" }, due.map((item) => reviewRow(ctx, item)))
  ]);
}

function renderPlan(ctx, pool) {
  const limit = endOfToday();
  const upcoming = pool.filter((item) => new Date(item.next_review_at).getTime() > limit)
    .sort((a, b) => String(a.next_review_at).localeCompare(String(b.next_review_at)));
  if (!upcoming.length) return h("div", { class: "empty" }, [h("strong", {}, "暂无复习计划")]);
  const days = new Map();
  for (const item of upcoming) {
    const key = dayKey(item.next_review_at);
    const list = days.get(key) || [];
    list.push(item);
    days.set(key, list);
  }
  return h("section", { class: "stack" }, [...days.entries()].map(([key, list]) => h("div", { class: "stack mk-day" }, [
    h("h2", {}, `${key.slice(5).replace("-", " 月 ")} 日 · ${list.length} 道`),
    h("ul", { class: "stack list-plain" }, list.map((item) => reviewRow(ctx, item)))
  ])));
}

function selectOf(name, current, options) {
  const select = h("select", { name }, []);
  for (const [value, label] of options) {
    const option = h("option", { value }, label);
    if (value === current) option.selected = true;
    select.append(option);
  }
  return select;
}

function categorySelect(current) {
  const select = h("select", { name: "category" }, [h("option", { value: "" }, "全部")]);
  for (const [id, label] of Object.entries(CATEGORY_LABEL)) {
    const option = h("option", { value: id }, label);
    if (id === current) option.selected = true;
    select.append(option);
  }
  return select;
}

function mistakeCard(ctx, item) {
  const attempts = (ctx.learning.attempts || [])
    .filter((attempt) => attempt.question_id === item.question_id)
    .sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)));
  const question = ctx.catalog.question(item.question_id);
  const sample = item.provenance?.kind === "sample" || isSampleQuestion(question);
  return h("li", { class: "panel stack" }, [
    h("div", { class: "row" }, [
      h("strong", {}, CATEGORY_LABEL[item.category] || item.category || "错题"),
      sample ? h("span", { class: "badge badge-sample" }, "示例") : null,
      h("span", { class: "badge" }, item.status === "resting" ? "暂歇" : "在复习队列")
    ]),
    h("p", {}, item.stem_snapshot || question?.stem || item.question_id),
    h("p", { class: "muted" }, `共作答 ${item.attempt_ids?.length || attempts.length} 次 · 下次复习 ${formatWhen(item.next_review_at)}`),
    h("div", { class: "row" }, [
      item.page?.url
        ? h("a", { class: "btn btn-primary", href: `../${item.page.url}${item.page.anchor ? `#${item.page.anchor}` : ""}` }, "回到原题")
        : h("a", { class: "btn btn-primary", href: `#/quiz/${item.question_id}?mode=retry` }, "重练"),
      (question?.topic_ids?.[0] || item.topic_ids?.[0]) ? h("a", { class: "btn", href: `#/topic/${question?.topic_ids?.[0] || item.topic_ids[0]}` }, "知识点") : null
    ]),
    h("details", {}, [
      h("summary", {}, "查看历次作答存档"),
      h("ul", { class: "stack" }, attempts.map((attempt) => h("li", {}, [
        h("p", {}, `${formatWhen(attempt.submitted_at)} · ${attempt.grading?.status || "已记录"} · ${attempt.understanding || ""}`),
        h("p", {}, `作答：${formatResponse(attempt.response)}`)
      ])))
    ])
  ]);
}

function formatResponse(response) {
  if (!response) return "（空）";
  const options = (response.option_ids || []).join("、");
  const text = response.text || "";
  return [options, text].filter(Boolean).join(" / ") || "（空）";
}

function groupedMistakeList(ctx, items) {
  const groups = new Map();
  const loose = [];
  for (const item of items) {
    const topicId = item.topic_ids?.[0] || "";
    if (!topicId) { loose.push(item); continue; }
    const list = groups.get(topicId) || [];
    list.push(item);
    groups.set(topicId, list);
  }
  const blocks = [];
  for (const [topicId, list] of groups) {
    const topic = ctx.catalog.topic(topicId);
    const title = topic?.title || topicId;
    blocks.push(h("div", { class: "stack" }, [
      h("p", { class: "muted" }, [
        "知识点：",
        h("a", { href: `#/topic/${topicId}` }, title),
        ` · ${list.length}`
      ]),
      h("ul", { class: "stack list-plain" }, list.map((item) => mistakeCard(ctx, item)))
    ]));
  }
  if (loose.length) {
    blocks.push(h("ul", { class: "stack list-plain" }, loose.map((item) => mistakeCard(ctx, item))));
  }
  return h("div", { class: "stack" }, blocks);
}
