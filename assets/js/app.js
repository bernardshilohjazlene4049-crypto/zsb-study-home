import { h } from "./core/dom.js";
import { UI_KEYS } from "./core/schema.js";
import { ensureSchema, getAll } from "./core/storage.js";
import { createCatalog, loadRawCatalog, searchCatalog } from "./features/catalog.js";
import { renderCatalogGrid, renderSubjectDetail, renderSubjectIndex } from "./features/subjects.js";
import { renderTopic } from "./features/topic.js";
import { renderQuiz } from "./features/quiz.js";
import { renderMistakes } from "./features/mistakes.js";
import { renderSettings } from "./features/settings.js";
import { loadLearningState } from "./features/records.js";
import { isMistakeRecord } from "./features/mistake-rules.js";
import { isExcludedQuestionId } from "./features/topic-index.js";
import { visualFor } from "./features/subject-visual.js";
import { icon } from "./features/icons.js";

const state = {
  raw: null,
  catalog: null,
  learning: { attempts: [], mistakes: [], notes: [], progress: [], marks: [], reviews: [] },
  dbOk: false,
  dbMessage: "",
  readOnly: false,
  notice: ""
};

function optionalOn() {
  try { return localStorage.getItem(UI_KEYS.optionalSubject) === "1"; } catch { return false; }
}

function parseRoute() {
  const raw = (location.hash || "#/home").replace(/^#/, "");
  const [path, queryString] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  return {
    name: parts[0] || "home",
    id: decodeURIComponent(parts.slice(1).join("/")),
    query: new URLSearchParams(queryString || "")
  };
}

function navKey(route) {
  if (route.name === "home") return "home";
  if (route.name === "practice" || route.name === "quiz") return "practice";
  if (route.name === "mistakes") return "mistakes";
  if (route.name === "settings") return "settings";
  if (route.name === "subjects" || route.name === "subject" || route.name === "topic") return "subject";
  return "";
}

async function reload() {
  if (!state.dbOk || !state.raw) return;
  const imported = state.readOnly ? [] : await getAll("imported_questions");
  state.catalog = createCatalog(state.raw, imported);
  state.learning = await loadLearningState();
}

function viewContext(route) {
  return {
    catalog: state.catalog,
    learning: state.learning,
    dbOk: state.dbOk,
    readOnly: state.readOnly,
    dbMessage: state.dbMessage,
    optionalOn: optionalOn(),
    id: route.id,
    query: route.query.get("q") || "",
    tab: route.query.get("tab") || "topics",
    subjectFilter: route.query.get("subject") || "",
    categoryFilter: route.query.get("category") || "",
    submitted: route.query.get("submitted") || "",
    mode: route.query.get("mode") || "",
    action: route.query.get("action") || "",
    notes: state.learning.notes || [],
    reload,
    render,
    setNotice(message) { state.notice = message; }
  };
}

function fixedSubjects() {
  return state.catalog.visibleSubjects(optionalOn()).filter((subject) => !subject.optional);
}

function pageHead(eyebrow, title, text, actions) {
  return h("div", { class: "page-head" }, [
    h("div", {}, [
      eyebrow ? h("div", { class: "eyebrow" }, eyebrow) : null,
      h("h1", { class: "page-title" }, title),
      text ? h("p", {}, text) : null
    ]),
    actions ? h("div", { class: "head-actions" }, actions) : null
  ]);
}

function navLink(key, href, label, iconName, extra) {
  return h("a", { class: "nav-item nav-list__link", href, "data-nav": key }, [
    icon(iconName),
    label,
    extra || null
  ]);
}

function mountShell() {
  const app = document.querySelector("#app");
  const mistakeCount = h("span", { class: "nav-count", id: "mistakeCount" }, "0");
  app.replaceChildren(
    h("a", { class: "skip", href: "#main" }, "跳到内容"),
    h("div", { class: "dashboard-layout" }, [
      h("aside", { class: "dashboard-sidebar sidebar glass-panel" }, [
        h("nav", { class: "nav-list", "aria-label": "学习导航" }, [
          navLink("home", "#/home", "工作台首页", "home"),
          navLink("overview", "./overview.html", "学习总览", "plan"),
          navLink("subject", "#/subjects", "七科知识目录", "layers"),
          navLink("practice", "#/practice", "在线练习", "pencil"),
          navLink("mistakes", "#/mistakes", "错题与复习 ", "notebook", mistakeCount),
          navLink("settings", "#/settings", "设置与数据", "settings")
        ])
      ]),
      h("div", { class: "dashboard-main" }, [
        h("div", { class: "search-wrap", style: "margin-bottom:20px;width:min(420px,100%)" }, [
          h("label", { class: "search-field" }, [
            h("span", { id: "searchIcon" }, [icon("search", 16)]),
            h("input", { id: "globalSearch", placeholder: "搜索科目、知识点…", "aria-label": "搜索科目和知识点" })
          ]),
          h("div", { class: "search-results", id: "searchResults" })
        ]),
        h("main", { class: "main", id: "main", tabindex: "-1" })
      ]),
      h("aside", { class: "dashboard-aside", id: "rightbar" }, [
        h("div", { class: "glass-panel" }, [
          h("div", { class: "profile-row" }, [
            h("div", { class: "profile-avatar" }, [icon("user")]),
            h("div", {}, [h("strong", {}, "我的学习档案")])
          ]),
          h("div", { class: "progress-ring", id: "overallRing" }, [h("span", { id: "overallPercent" }, "0%")])
        ]),
        h("div", { class: "glass-panel" }, [
          h("h3", { class: "section-title", style: "font-size:var(--sg-text-md)" }, "科目进度"),
          h("div", { class: "subject-progress", id: "rightProgress" })
        ])
      ])
    ]),
    h("nav", { class: "mobile-nav bottom-nav", "aria-label": "学习导航" }, [
      h("a", { href: "#/home", "data-nav": "home" }, [icon("home"), "首页"]),
      h("a", { href: "#/subjects", "data-nav": "subject" }, [icon("layers"), "七科"]),
      h("a", { href: "#/practice", "data-nav": "practice" }, [icon("pencil"), "练习"]),
      h("a", { href: "#/mistakes", "data-nav": "mistakes" }, [icon("notebook"), "错题"]),
      h("a", { href: "#/settings", "data-nav": "settings" }, [icon("settings"), "设置"])
    ])
  );
}

function bindSearch() {
  const input = document.querySelector("#globalSearch");
  const box = document.querySelector("#searchResults");
  const paint = () => {
    const query = input.value.trim();
    const results = query && state.catalog ? searchCatalog(state.catalog, query, state.learning.notes || [], optionalOn()).slice(0, 7) : [];
    box.replaceChildren(...results.map((item) => h("a", { class: "search-result", href: item.href }, [
      h("strong", {}, item.title),
      h("small", {}, `${item.type} · ${item.source || ""}`)
    ])));
    box.classList.toggle("open", results.length > 0);
  };
  input.addEventListener("input", paint);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const query = input.value.trim();
    box.classList.remove("open");
    location.hash = `#/subjects?q=${encodeURIComponent(query)}`;
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-wrap")) box.classList.remove("open");
  });
}

function renderChrome(route) {
  const key = navKey(route);
  const layout = document.querySelector(".dashboard-layout");
  if (layout) layout.classList.toggle("is-wide", route.name === "topic" || route.name === "mistakes");
  for (const link of document.querySelectorAll("[data-nav]")) {
    const on = link.dataset.nav === key;
    link.classList.toggle("active", on);
    link.classList.toggle("is-active", on);
    if (on) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  const mistakes = (state.learning.mistakes || []).filter(isMistakeRecord).filter((item) => !isExcludedQuestionId(item.question_id));
  const count = document.querySelector("#mistakeCount");
  if (count) count.textContent = String(mistakes.length);
  const save = document.querySelector("#saveStatus");
  if (save) save.textContent = state.dbOk ? (state.readOnly ? "只读" : "已启用") : "不可用";
  renderRight();
}

function renderRight() {
  const ring = document.querySelector("#overallRing");
  const label = document.querySelector("#overallPercent");
  const list = document.querySelector("#rightProgress");
  const aside = document.querySelector("#rightbar");
  if (!state.catalog || !list) return;
  const records = state.learning.progress || [];
  if (aside) aside.hidden = records.length === 0;
  const progressIds = new Set(records.map((item) => item.topic_id));
  let total = 0;
  let done = 0;
  const rows = fixedSubjects().map((subject) => {
    const topics = state.catalog.topics.filter((topic) => topic.subject_id === subject.id);
    const count = topics.filter((topic) => progressIds.has(topic.id)).length;
    total += topics.length;
    done += count;
    const pct = topics.length ? Math.round(count / topics.length * 100) : 0;
    return h("div", { class: "progress-row" }, [
      h("span", {}, subject.name),
      h("div", { class: "progress-track" }, [h("i", { style: `width:${pct}%;background:${visualFor(subject.id).color}` })]),
      h("span", {}, `${count}/${topics.length}`)
    ]);
  });
  const pct = total ? Math.round(done / total * 100) : 0;
  if (ring) ring.style.background = `conic-gradient(#6e91d3 ${pct * 3.6}deg,#dfe7f4 0deg)`;
  if (label) label.textContent = `${pct}%`;
  list.replaceChildren(...rows);
}

function metric(label, value, foot, iconName) {
  return h("article", { class: "metric stat-card" }, [
    h("div", { class: "metric-top" }, [label, iconName ? h("span", { class: "metric-icon" }, [icon(iconName)]) : null]),
    h("div", { class: "metric-value" }, String(value)),
    foot ? h("div", { class: "metric-foot" }, foot) : null
  ]);
}

function toolCard(href, iconName, title, note) {
  return h("a", { class: "tool-card", href }, [
    h("span", { class: "tool-icon" }, [icon(iconName)]),
    h("span", {}, [h("strong", {}, title), h("small", {}, note)])
  ]);
}

function learningCounts() {
  const attempts = (state.learning.attempts || []).filter((item) => !isExcludedQuestionId(item.question_id));
  const mistakes = (state.learning.mistakes || []).filter(isMistakeRecord).filter((item) => !isExcludedQuestionId(item.question_id));
  const recorded = new Set((state.learning.progress || []).map((item) => item.topic_id));
  const days = new Set(attempts.map((item) => String(item.submitted_at || "").slice(0, 10)).filter(Boolean));
  return { attempts, mistakes, recorded, days };
}

function renderContinue() {
  let lastId = "";
  try { lastId = localStorage.getItem(UI_KEYS.lastTopic) || ""; } catch { /* ignore */ }
  const topic = lastId ? state.catalog.topic(lastId) : null;
  if (!topic) return null;
  const subject = state.catalog.subject(topic.subject_id);
  return h("div", { class: "task-row" }, [
    h("span", { class: "task-dot" }),
    h("div", { class: "task-copy" }, [
      h("strong", {}, `${subject?.name || ""} · ${topic.title}`)
    ]),
    h("a", { class: "btn small", href: `#/topic/${topic.id}` }, "继续练习")
  ]);
}

function renderDiagnosis() {
  const attempts = (state.learning.attempts || []).filter((item) => !isExcludedQuestionId(item.question_id));
  const real = attempts.filter((item) => item.provenance?.kind !== "sample");
  if (!real.length) return null;
  const grouped = new Map();
  for (const attempt of real) {
    const name = state.catalog.subject(attempt.subject_id)?.name || attempt.subject_id;
    const row = grouped.get(name) || { total: 0, correct: 0 };
    row.total += 1;
    if (attempt.grading?.status === "correct") row.correct += 1;
    grouped.set(name, row);
  }
  return h("div", {}, [
    ...[...grouped.entries()].slice(0, 4).map(([name, row]) => h("div", { class: "setting-line" }, [
      h("span", {}, name),
      h("span", { class: "tag-muted" }, `${row.correct}/${row.total} 正确`)
    ]))
  ]);
}

function renderHome() {
  const { attempts, mistakes, recorded, days } = learningCounts();
  const subjects = fixedSubjects();
  const diagnosis = renderDiagnosis();
  const continued = renderContinue();
  return h("div", {}, [
    pageHead("", "工作台", "", [h("a", { class: "btn", href: "./overview.html" }, "学习总览")]),
    state.dbMessage ? h("p", { class: "notice" }, state.dbMessage) : null,
    h("div", { class: "metrics stat-grid" }, [
      metric("累计练习", attempts.length, "", "target"),
      metric("错题待复习", mistakes.length, "", "rotate"),
      metric("练习记录", recorded.size, "", "check"),
      metric("学习记录", days.size, "", "clock")
    ]),
    h("div", { class: "section-heading" }, [
      h("h2", { class: "section-title" }, "七科学习入口"),
      h("span", {}, `七科 · ${subjects.length}`)
    ]),
    renderCatalogGrid(state.catalog, state.learning, optionalOn()),
    h("div", { class: "section-head" }, [h("h3", {}, "学习工具")]),
    h("div", { class: "tools-grid" }, [
      toolCard("#/ocr", "camera", "拍照识题", "即将开放"),
      toolCard("#/exam", "exam", "模拟考试", "即将开放"),
      toolCard("#/labs", "lab", "代码实验室", "即将开放"),
      toolCard("#/plan", "plan", "学习计划", "即将开放")
    ]),
    diagnosis ? h("div", { class: "dashboard-extra" }, [
      h("div", { class: "panel glass" }, [
        h("div", { class: "panel-title" }, [h("h3", {}, "学习诊断")]),
        diagnosis
      ])
    ]) : null,
    continued ? h("div", {}, [
      h("div", { class: "section-head" }, [h("h3", {}, "继续上次学习")]),
      h("div", { class: "panel glass", id: "continuePanel" }, [continued])
    ]) : null
  ]);
}

function renderPracticeHome(ctx) {
  const questions = ctx.catalog.questions.filter((question) => question.provenance?.kind === "sample");
  return h("div", {}, [
    pageHead("", "在线练习", "", [
      h("span", { class: "pill demo" }, "示例")
    ]),
    h("div", { class: "question-card glass" }, [
      questions.length
        ? h("div", { class: "topic-list" }, questions.map((question) => h("a", { class: "topic-item", href: `#/quiz/${question.id}` }, [
          h("div", { class: "topic-info" }, [
            h("strong", {}, question.stem),
            h("small", {}, `${ctx.catalog.subject(question.subject_id)?.name || ""} · 示例`)
          ])
        ])))
        : h("div", { class: "empty-state" }, [
          h("strong", {}, "暂无内容")
        ])
    ])
  ]);
}

function renderPracticeFrame(ctx) {
  const question = ctx.catalog.question(ctx.id);
  let indexText = "";
  let width = "0%";
  let next = null;
  if (question) {
    const topicId = question.topic_ids?.[0];
    const list = topicId ? ctx.catalog.questionsForTopic(topicId) : [];
    const index = list.findIndex((item) => item.id === question.id);
    if (index >= 0 && list.length) {
      indexText = `${String(index + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`;
      width = `${Math.round(((index + 1) / list.length) * 100)}%`;
      next = list[index + 1] || null;
    }
  }
  return h("div", {}, [
    pageHead("", "在线练习", "", [
      h("span", { class: "pill demo" }, "示例")
    ]),
    h("div", { class: "practice-layout" }, [
      h("div", { class: "question-card glass", id: "questionCard" }, [renderQuiz(ctx)]),
      h("aside", { class: "practice-side" }, [
        h("div", { class: "panel glass" }, [
          h("div", { class: "panel-title" }, [h("h3", {}, "当前练习"), indexText ? h("span", {}, indexText) : null]),
          h("div", { class: "progress-track" }, [h("i", { style: `width:${width}` })])
        ]),
        next ? h("a", { class: "btn", href: `#/quiz/${next.id}` }, "下一题 →") : h("a", { class: "btn", href: "#/practice" }, "返回练习列表")
      ])
    ])
  ]);
}

function renderNotes(ctx) {
  const notes = state.learning.notes || [];
  const query = ctx.query;
  const visible = query
    ? notes.filter((note) => `${note.title} ${note.body}`.toLowerCase().includes(query.toLowerCase()))
    : notes;
  return h("div", { class: "stack" }, [
    pageHead("", "笔记", ""),
    h("form", {
      class: "row",
      role: "search",
      onsubmit: (event) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get("q") || "";
        location.hash = `#/notes?q=${encodeURIComponent(String(value).trim())}`;
      }
    }, [
      h("label", { class: "inline-field" }, ["搜索笔记", h("input", { id: "note-q", name: "q", type: "search", value: query })]),
      h("button", { class: "btn", type: "submit" }, "搜索")
    ]),
    visible.length ? h("ul", { class: "stack list-plain" }, visible.map((note) => h("li", { class: "panel glass" }, [
      h("h2", {}, note.title || "笔记"),
      h("p", {}, note.body || ""),
      h("a", { class: "btn small", href: `#/topic/${note.topic_ids?.[0] || ""}` }, "打开知识点")
    ]))) : h("div", { class: "empty-state" }, [h("strong", {}, "还没有笔记")])
  ]);
}

function renderDisconnected(title, message) {
  const tag = message === undefined ? "即将开放" : message;
  return h("article", { class: "stack" }, [
    pageHead("", title, ""),
    tag ? h("span", { class: "pill" }, tag) : null,
    h("a", { class: "btn", href: "#/home" }, "回到学习首页")
  ]);
}

function renderPage(route) {
  const ctx = viewContext(route);
  if (!state.catalog) return h("p", { class: "notice" }, state.dbMessage || "目录还没有载入。");
  if (route.name === "home") return renderHome();
  if (route.name === "subjects" && route.id) return renderSubjectDetail({ ...ctx, id: route.id });
  if (route.name === "subjects") return renderSubjectIndex(ctx);
  if (route.name === "subject") return renderSubjectDetail(ctx);
  if (route.name === "topic") return renderTopic(ctx);
  if (route.name === "practice" || (route.name === "quiz" && !route.id)) return renderPracticeHome(ctx);
  if (route.name === "quiz") return renderPracticeFrame(ctx);
  if (route.name === "mistakes") return renderMistakes(ctx);
  if (route.name === "notes") return renderNotes(ctx);
  if (route.name === "settings") return renderSettings(ctx);
  if (route.name === "ai") return renderDisconnected("AI 辅导");
  if (route.name === "ocr") return renderDisconnected("拍照识题");
  if (route.name === "exam") return renderDisconnected("模拟考试");
  if (route.name === "plan") return renderDisconnected("学习计划");
  if (route.name === "labs") return renderDisconnected("实验室");
  if (route.name === "sync") return renderDisconnected("跨设备同步");
  return renderDisconnected("没有这个页面", "");
}

function footer() {
  return null;
}

async function render() {
  const route = parseRoute();
  renderChrome(route);
  const main = document.querySelector("#main");
  try {
    const page = renderPage(route);
    const note = state.notice ? h("p", { class: "notice", role: "status" }, state.notice) : null;
    state.notice = "";
    main.replaceChildren(h("div", { class: "stack" }, [note, page, footer()]));
  } catch (error) {
    main.replaceChildren(h("p", { class: "notice" }, error.message || "这个页面没有打开。"));
  }
}

function consumeQuestionQuery() {
  const params = new URLSearchParams(location.search);
  const question = params.get("question");
  if (!question || location.hash) return;
  const action = params.get("action");
  const next = new URLSearchParams();
  if (action) next.set("action", action);
  const suffix = next.toString();
  location.hash = `#/quiz/${encodeURIComponent(question)}${suffix ? `?${suffix}` : ""}`;
}

async function boot() {
  mountShell();
  bindSearch();
  consumeQuestionQuery();
  const main = document.querySelector("#main");
  main.replaceChildren(h("p", {}, "正在读取目录…"));
  try {
    state.raw = await loadRawCatalog();
    state.catalog = createCatalog(state.raw, []);
  } catch (error) {
    main.replaceChildren(h("p", { class: "notice" }, error.message || "目录读取失败。"));
    return;
  }
  try {
    const schema = await ensureSchema();
    state.dbOk = true;
    state.readOnly = Boolean(schema.readOnly);
    state.dbMessage = schema.message || "";
    await reload();
  } catch (error) {
    state.dbOk = false;
    state.dbMessage = error.message || "本机数据库不可用。";
  }
  window.addEventListener("hashchange", () => { void render(); });
  await render();
}

boot();
