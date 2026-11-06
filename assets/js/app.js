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
import { getAiStatus, getLabsStatus, getOcrStatus, getSyncStatus } from "./adapters/status.js";
import { visualFor } from "./features/subject-visual.js";
import { brandMark, icon } from "./features/icons.js";

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
      h("h1", {}, title),
      text ? h("p", {}, text) : null
    ]),
    actions ? h("div", { class: "head-actions" }, actions) : null
  ]);
}

function navLink(key, href, label, iconName, extra) {
  return h("a", { class: "nav-item", href, "data-nav": key }, [
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
    h("header", { class: "topbar" }, [
      h("div", { class: "brand" }, [
        h("div", { class: "brand-mark" }, [brandMark()]),
        h("div", { class: "brand-copy" }, [
          h("strong", {}, "学习工作台"),
          h("span", {}, "辽宁专升本 · 计算机组")
        ])
      ]),
      h("div", { class: "top-actions" }, [
        h("div", { class: "search-wrap" }, [
          h("span", { class: "search-icon", id: "searchIcon" }, [icon("search", 16)]),
          h("input", { class: "search", id: "globalSearch", placeholder: "搜索科目、知识点…", "aria-label": "搜索科目和知识点" }),
          h("div", { class: "search-results", id: "searchResults" })
        ]),
        h("a", { class: "icon-btn", href: "../tower/index.html", title: "打开学习指挥塔", "aria-label": "打开学习指挥塔" }, [icon("tower", 17)]),
        h("div", { class: "avatar", title: "本地学习档案" }, "学")
      ])
    ]),
    h("div", { class: "layout" }, [
      h("aside", { class: "sidebar" }, [
        h("div", { class: "side-card glass" }, [
          h("div", { class: "side-label" }, "学习空间"),
          h("nav", { class: "nav-list" }, [
            navLink("home", "#/home", "工作台首页", "home"),
            navLink("subject", "#/subjects", "七科知识目录", "layers"),
            navLink("practice", "#/practice", "在线练习", "pencil"),
            navLink("mistakes", "#/mistakes", "错题与复习 ", "notebook", mistakeCount)
          ]),
          h("div", { class: "side-label", style: "margin-top:15px" }, "个人管理"),
          h("nav", { class: "nav-list" }, [
            navLink("settings", "#/settings", "设置与数据", "settings")
          ])
        ]),
        h("div", { class: "side-card glass" }, [
          h("div", { class: "side-label" }, "当前学习方式"),
          h("div", { class: "side-note" }, [
            h("strong", {}, "循序渐进 · 以理解为准"),
            h("p", {}, "先学知识点，再做练习。做错的题目进入复习队列。")
          ])
        ]),
        h("div", { class: "side-card glass" }, [
          h("div", { class: "side-label" }, "数据状态"),
          h("div", { class: "setting-line" }, [h("span", {}, "本地保存"), h("span", { class: "tag-muted", id: "saveStatus" }, "已启用")]),
          h("div", { class: "setting-line" }, [h("span", {}, "云端同步"), h("span", { class: "tag-muted" }, "未连接")]),
          h("div", { class: "setting-line" }, [h("span", {}, "AI 服务"), h("span", { class: "tag-muted" }, "待配置")])
        ])
      ]),
      h("main", { class: "main", id: "main", tabindex: "-1" }),
      h("aside", { class: "rightbar", id: "rightbar" }, [
        h("div", { class: "right-card glass" }, [
          h("div", { class: "profile-row" }, [
            h("div", { class: "profile-avatar" }, [icon("user")]),
            h("div", {}, [h("strong", {}, "我的学习档案"), h("small", {}, "本地设备 · 未登录")])
          ]),
          h("div", { class: "progress-ring", id: "overallRing" }, [h("span", { id: "overallPercent" }, "0%")]),
          h("div", { class: "center-note" }, "练习记录占比"),
          h("p", { style: "font-size:9px;color:#a0aaba;text-align:center;margin:4px 0 0" }, "只统计有练习记录的知识点，不等于熟练")
        ]),
        h("div", { class: "right-card glass" }, [
          h("div", { class: "panel-title" }, [h("h3", {}, "科目进度"), h("span", {}, "LOCAL")]),
          h("div", { class: "subject-progress", id: "rightProgress" })
        ]),
        h("div", { class: "right-card glass tip-card" }, [
          h("div", { class: "panel-title" }, [h("h3", {}, "学习提示"), h("span", {}, "NOTE")]),
          h("strong", { style: "font-size:11px" }, "答对不等于掌握"),
          h("p", {}, "如果答案是猜出来的，建议标记为“尚未理解”，稍后用一道变式题验证。")
        ]),
        h("div", { class: "right-card glass" }, [
          h("div", { class: "panel-title" }, [h("h3", {}, "学习指挥塔"), h("span", {}, "VISUAL")]),
          h("p", { style: "font-size:10px;color:#8996a8;margin:0 0 11px" }, "查看七层科目空间。任务服务尚未接通。"),
          h("a", { class: "btn small", href: "../tower/index.html" }, "打开学习指挥塔 ↗")
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
  for (const link of document.querySelectorAll("[data-nav]")) {
    const on = link.dataset.nav === key;
    link.classList.toggle("active", on);
    if (on) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  const mistakes = (state.learning.mistakes || []).filter((item) => !item.deleted_at);
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
  if (!state.catalog || !list) return;
  const progressIds = new Set((state.learning.progress || []).map((item) => item.topic_id));
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
  return h("div", { class: "metric glass" }, [
    h("div", { class: "metric-top" }, [label, iconName ? h("span", { class: "metric-icon" }, [icon(iconName)]) : null]),
    h("div", { class: "metric-value" }, String(value)),
    h("div", { class: "metric-foot" }, foot)
  ]);
}

function toolCard(href, iconName, title, note) {
  return h("a", { class: "tool-card", href }, [
    h("span", { class: "tool-icon" }, [icon(iconName)]),
    h("span", {}, [h("strong", {}, title), h("small", {}, note)])
  ]);
}

function learningCounts() {
  const attempts = state.learning.attempts || [];
  const mistakes = (state.learning.mistakes || []).filter((item) => !item.deleted_at);
  const recorded = new Set((state.learning.progress || []).map((item) => item.topic_id));
  const days = new Set(attempts.map((item) => String(item.submitted_at || "").slice(0, 10)).filter(Boolean));
  return { attempts, mistakes, recorded, days };
}

function renderContinue() {
  let lastId = "";
  try { lastId = localStorage.getItem(UI_KEYS.lastTopic) || ""; } catch { /* ignore */ }
  const topic = lastId ? state.catalog.topic(lastId) : null;
  if (!topic) {
    return h("div", { class: "empty-mini" }, "还没有学习记录。选择一门科目，开始建立自己的学习轨迹。");
  }
  const subject = state.catalog.subject(topic.subject_id);
  return h("div", { class: "task-row" }, [
    h("span", { class: "task-dot" }),
    h("div", { class: "task-copy" }, [
      h("strong", {}, `${subject?.name || ""} · ${topic.title}`),
      h("small", {}, "上次打开的知识点")
    ]),
    h("a", { class: "btn small", href: `#/topic/${topic.id}` }, "继续练习")
  ]);
}

function renderDiagnosis() {
  const attempts = state.learning.attempts || [];
  if (!attempts.length) {
    return h("div", { class: "empty-mini" }, "完成练习后，这里会根据实际记录显示各科作答。");
  }
  const real = attempts.filter((item) => item.provenance?.kind !== "sample");
  if (!real.length) {
    return h("div", { class: "empty-mini" }, "目前只有示例作答，不显示真实正确率。");
  }
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
    ])),
    h("p", { style: "font-size:9px;color:#9aa5b4;margin:8px 0 0" }, "只统计已核验题目。示例作答不在这里。")
  ]);
}

function renderHome() {
  const { attempts, mistakes, recorded, days } = learningCounts();
  const subjects = fixedSubjects();
  let exportHint = "";
  try {
    if (attempts.length && !localStorage.getItem(UI_KEYS.lastExportAt)) {
      exportHint = "已有本机作答。建议到设置里导出 JSON 备份，备份不会自动上传。";
    }
  } catch { /* ignore */ }
  return h("div", {}, [
    pageHead("YOUR STUDY SPACE", "今天，从一个知识点开始。", "把学习内容拆小，理解之后再向前一步。", [
      h("span", { class: "pill demo" }, "目录为导航草案")
    ]),
    h("div", { class: "hero" }, [
      h("div", { class: "hero-content" }, [
        h("div", { class: "hero-kicker" }, [h("i", { class: "live-dot" }), " PERSONAL LEARNING DESK"]),
        h("h2", {}, ["让每一次练习，", h("br"), "都变成真正的理解。"]),
        h("p", {}, "七科内容统一整理。视频、思维导图、练习与错题记录，在同一个学习空间里衔接。"),
        h("div", { class: "hero-bottom" }, [
          h("a", { class: "btn primary", href: "#/subjects" }, [icon("book"), "浏览七科目录"]),
          h("a", { class: "btn", href: "#/practice" }, [icon("play"), "开始练习"])
        ])
      ]),
      h("div", { class: "hero-art", "aria-hidden": "true" }, [
        h("div", { class: "hero-line" }),
        h("div", { class: "orb one" }),
        h("div", { class: "orb two" }),
        h("div", { class: "orb three" })
      ])
    ]),
    exportHint ? h("p", { class: "notice" }, exportHint) : null,
    state.dbMessage ? h("p", { class: "notice" }, state.dbMessage) : null,
    state.catalog.warnings.length ? h("p", { class: "notice" }, `目录有 ${state.catalog.warnings.length} 条跳过提示，设置页导入时也会单独报告。`) : null,
    h("div", { class: "metrics" }, [
      metric("累计练习", attempts.length, "来自本地答题记录", "target"),
      metric("错题待复习", mistakes.length, "还在复习队列中的错题", "rotate"),
      metric("练习记录", recorded.size, "有练习证据，不等于熟练", "check"),
      metric("学习记录", days.size, "有记录的学习日期", "clock")
    ]),
    h("div", { class: "section-head" }, [
      h("h3", {}, "七科学习入口"),
      h("span", {}, `七科 · ${subjects.length}`)
    ]),
    renderCatalogGrid(state.catalog, state.learning, optionalOn()),
    h("div", { class: "section-head" }, [h("h3", {}, "学习工具"), h("span", {}, "辅助学习与专项训练")]),
    h("div", { class: "tools-grid" }, [
      toolCard("#/ocr", "camera", "拍照识题", "尚未接通"),
      toolCard("#/exam", "exam", "模拟考试", "尚未接通"),
      toolCard("#/labs", "lab", "代码实验室", "尚未接通"),
      toolCard("#/plan", "plan", "学习计划", "尚未接通")
    ]),
    h("div", { class: "dashboard-extra" }, [
      h("div", { class: "panel glass" }, [
        h("div", { class: "panel-title" }, [
          h("h3", {}, "今日学习计划"),
          h("a", { class: "btn small", href: "#/plan" }, "＋ 添加")
        ]),
        h("div", { class: "empty-mini" }, "尚未接通。这里不会生成倒计时或虚构任务。")
      ]),
      h("div", { class: "panel glass" }, [
        h("div", { class: "panel-title" }, [h("h3", {}, "学习诊断"), h("span", {}, "基于本地作答")]),
        renderDiagnosis()
      ])
    ]),
    h("div", { class: "section-head" }, [h("h3", {}, "继续上次学习"), h("span", {}, "根据本地记录生成")]),
    h("div", { class: "panel glass", id: "continuePanel" }, [renderContinue()])
  ]);
}

function renderPracticeHome(ctx) {
  const questions = ctx.catalog.questions.filter((question) => question.provenance?.kind === "sample");
  return h("div", {}, [
    pageHead("PRACTICE ROOM", "在线练习", "先独立思考，再核对答案和解析。", [
      h("span", { class: "pill demo" }, "示例题 · 非官方真题")
    ]),
    h("div", { class: "practice-layout" }, [
      h("div", { class: "question-card glass" }, [
        questions.length
          ? h("div", { class: "topic-list" }, questions.map((question) => h("a", { class: "topic-item", href: `#/quiz/${question.id}` }, [
            h("div", { class: "topic-info" }, [
              h("strong", {}, question.stem),
              h("small", {}, `${ctx.catalog.subject(question.subject_id)?.name || ""} · 示例题，不计入真实统计`)
            ])
          ])))
          : h("div", { class: "empty-state" }, [
            h("strong", {}, "还没有示例题"),
            h("p", {}, "不会用空白题冒充已有题库。")
          ])
      ]),
      h("aside", { class: "practice-side" }, [
        h("div", { class: "panel glass" }, [
          h("div", { class: "panel-title" }, [h("h3", {}, "练习说明"), h("span", {}, "HOW TO USE")]),
          h("p", { style: "font-size:10px;color:#8793a5;margin:0" }, "选择答案后提交。答错会进入错题本。示例题不计入真实正确率。")
        ]),
        h("a", { class: "btn", href: "#/ocr" }, "拍照识题 · 尚未接通"),
        h("a", { class: "btn", href: "#/exam" }, "模拟考试 · 尚未接通")
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
    pageHead("PRACTICE ROOM", "在线练习", "先独立思考，再核对答案和解析。", [
      h("span", { class: "pill demo" }, "示例题 · 非官方真题")
    ]),
    h("div", { class: "practice-layout" }, [
      h("div", { class: "question-card glass", id: "questionCard" }, [renderQuiz(ctx)]),
      h("aside", { class: "practice-side" }, [
        h("div", { class: "panel glass" }, [
          h("div", { class: "panel-title" }, [h("h3", {}, "练习说明"), h("span", {}, "HOW TO USE")]),
          h("p", { style: "font-size:10px;color:#8793a5;margin:0" }, "选择答案后提交。答错会进入错题本；答对也会保留作答记录。")
        ]),
        h("div", { class: "panel glass" }, [
          h("div", { class: "panel-title" }, [h("h3", {}, "当前练习"), indexText ? h("span", {}, indexText) : null]),
          h("div", { class: "progress-track" }, [h("i", { style: `width:${width}` })]),
          h("p", { style: "font-size:10px;color:#98a3b2;margin:9px 0 0" }, "题目来自仓库里已经导入的题，不会临时编造题干。")
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
    pageHead("NOTES", "本机笔记", "纯文本保存在本机，不会自动上传。"),
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
    ]))) : h("div", { class: "empty-state" }, [h("strong", {}, "还没有笔记"), h("p", {}, "到知识点页面写一条即可。未导入的资料不会出现在搜索里。")])
  ]);
}

function renderDisconnected(eyebrow, title, message) {
  return h("article", { class: "stack" }, [
    pageHead(eyebrow, title, ""),
    h("div", { class: "empty-state" }, [
      h("strong", {}, "尚未接通"),
      h("p", {}, message)
    ]),
    h("a", { class: "btn", href: "#/home" }, "回到学习首页")
  ]);
}

function renderOcr() {
  const note = h("p", { class: "notice", role: "status" }, getOcrStatus().message);
  return h("article", { class: "stack" }, [
    pageHead("QUESTION CAPTURE", "拍照识题", "尚未接通。不会上传图片，也不会编造识别文字。"),
    note,
    h("p", {}, "题目照片可能含有姓名或学号。这一阶段不会把图片上传，也不会生成识别文字。"),
    h("label", { class: "btn" }, [
      "选择图片（不会上传）",
      h("input", {
        class: "file-input",
        type: "file",
        accept: "image/jpeg,image/png,image/webp",
        onchange: (event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          note.textContent = file
            ? `已选择「${file.name}」。识题未连接，图片没有上传，也没有识别结果。`
            : getOcrStatus().message;
        }
      })
    ]),
    h("p", { class: "muted" }, "HEIC 需要先转换成 JPEG、PNG 或 WebP。人工核对留到下一阶段。")
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
  if (route.name === "ai") return renderDisconnected("AI", "AI 辅导", getAiStatus().message);
  if (route.name === "ocr") return renderOcr();
  if (route.name === "exam") return renderDisconnected("PRACTICE EXAM", "模拟考试", "尚未接通。这里没有试卷，也不会在交卷前展示答案或编造分数。");
  if (route.name === "plan") return renderDisconnected("PLAN", "学习计划", "尚未接通。没有可执行的计划，也没有考试日期，页面不显示倒计时。");
  if (route.name === "labs") return renderDisconnected("CODE WORKSHOP", "实验室", getLabsStatus().message);
  if (route.name === "sync") return renderDisconnected("SYNC", "跨设备同步", getSyncStatus().message);
  return renderDisconnected("MISSING", "没有这个页面", "从七科目录重新进入即可。");
}

function footer() {
  const links = [
    ["首页", "../index.html"],
    ["学习工作台", "../study/index.html"],
    ["学习指挥塔", "../tower/index.html"],
    ["高等数学", "../gs/index.html"],
    ["计算机基础", "../jsj/index.html"],
    ["C语言", "../c/index.html"],
    ["英语", "../yy/index.html"],
    ["网页设计", "../wy/index.html"]
  ];
  return h("div", { class: "stack" }, [
    h("nav", { class: "site-links site-links-foot site-links-show", "aria-label": "页脚导航" }, links.map(([label, href]) => h("a", {
      href,
      "aria-current": href.endsWith("study/index.html") ? "page" : null
    }, label))),
    h("div", { class: "footer-note" }, "目录未经官方考纲核验 · 学习记录保存在当前浏览器")
  ]);
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
