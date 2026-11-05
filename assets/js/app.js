import { h } from "./core/dom.js";
import { siteUrl } from "./core/paths.js";
import { UI_KEYS } from "./core/schema.js";
import { ensureSchema, getAll } from "./core/storage.js";
import { createCatalog, loadRawCatalog, searchCatalog } from "./features/catalog.js";
import { accuracyOf, splitAttempts } from "./features/grading.js";
import { renderSubjectDetail, renderSubjectIndex } from "./features/subjects.js";
import { renderTopic } from "./features/topic.js";
import { renderQuiz } from "./features/quiz.js";
import { renderMistakes } from "./features/mistakes.js";
import { renderSettings } from "./features/settings.js";
import { loadLearningState } from "./features/records.js";
import { getAiStatus, getLabsStatus, getOcrStatus, getSyncStatus } from "./adapters/status.js";

const NAV = [
  ["home", "学习首页", "#/home"],
  ["subjects", "七科目录", "#/subjects"],
  ["mistakes", "错题本", "#/mistakes"],
  ["notes", "笔记", "#/notes"],
  ["ai", "AI 辅导", "#/ai"],
  ["ocr", "拍照识题", "#/ocr"],
  ["exam", "模拟考试", "#/exam"],
  ["plan", "学习计划", "#/plan"],
  ["labs", "实验室", "#/labs"],
  ["sync", "同步", "#/sync"],
  ["settings", "设置", "#/settings"]
];

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

function mountShell() {
  const app = document.querySelector("#app");
  app.replaceChildren(
    h("a", { class: "skip", href: "#main" }, "跳到内容"),
    h("aside", { class: "sidebar", id: "sidebar" }),
    h("div", { class: "workspace" }, [
      h("header", { class: "topbar" }, [
        h("a", { class: "brand", href: "#/home" }, "学习工作台"),
        h("a", { class: "btn", href: siteUrl("index.html") }, "返回旧首页")
      ]),
      h("div", { class: "columns" }, [
        h("main", { id: "main", tabindex: "-1" }),
        h("aside", { class: "rail", id: "rail" })
      ])
    ]),
    h("nav", { class: "bottom-nav", "aria-label": "学习导航" }, [
      h("a", { href: "#/home", "data-nav": "home" }, "首页"),
      h("a", { href: "#/subjects", "data-nav": "subjects" }, "目录"),
      h("a", { href: "#/mistakes", "data-nav": "mistakes" }, "错题"),
      h("a", { href: "#/settings", "data-nav": "settings" }, "设置"),
      h("button", { type: "button", id: "more-open" }, "更多")
    ]),
    h("div", { id: "more-layer", hidden: true })
  );
  document.querySelector("#more-open").addEventListener("click", openMore);
}

function openMore() {
  const layer = document.querySelector("#more-layer");
  const close = () => { layer.hidden = true; layer.replaceChildren(); };
  const dialog = h("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-label": "更多入口" }, [
    h("div", { class: "row" }, [
      h("h2", {}, "更多"),
      h("button", { class: "btn", type: "button", onclick: close }, "关闭")
    ]),
    h("div", { class: "stack" }, NAV.map(([, label, href]) => h("a", { class: "btn", href, onclick: close }, label))),
    h("a", { class: "btn", href: siteUrl("tower/index.html") }, "3D 指挥塔（阶段 5 占位）"),
    h("a", { class: "btn", href: siteUrl("index.html") }, "旧首页")
  ]);
  layer.replaceChildren(h("div", { class: "backdrop", onclick: close }, [dialog]));
  layer.hidden = false;
  dialog.querySelector("button").focus();
  layer.onkeydown = (event) => { if (event.key === "Escape") close(); };
}

function renderNav(route) {
  const sidebar = document.querySelector("#sidebar");
  sidebar.replaceChildren(
    h("p", { class: "kicker" }, "辽宁专升本 · 计算机组"),
    h("nav", { class: "side-nav", "aria-label": "工作台" }, NAV.map(([name, label, href]) => h("a", {
      href,
      "aria-current": route.name === name ? "page" : null
    }, label))),
    h("a", { class: "btn", href: siteUrl("tower/index.html") }, "指挥塔占位")
  );
  for (const link of document.querySelectorAll(".bottom-nav a")) {
    if (link.dataset.nav === route.name) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

function renderRail() {
  const rail = document.querySelector("#rail");
  const { real, sample, other } = splitAttempts(state.learning.attempts || []);
  const realScore = accuracyOf(real);
  const sampleMistakes = (state.learning.mistakes || []).filter((item) => item.provenance?.kind === "sample" && !item.deleted_at);
  let exportHint = "";
  try {
    if ((state.learning.attempts || []).length && !localStorage.getItem(UI_KEYS.lastExportAt)) {
      exportHint = "已有本机作答。建议到设置里导出 JSON 备份，备份不会自动上传。";
    }
  } catch { /* ignore */ }
  rail.replaceChildren(
    h("section", { class: "panel stack" }, [
      h("h2", {}, "学习记录"),
      h("p", {}, realScore.graded
        ? `已核验题目正确率 ${realScore.correct}/${realScore.graded}`
        : "已核验题目还没有作答，所以不显示真实正确率。"),
      h("p", { class: "muted" }, `示例作答 ${sample.length} 次，不计入真实统计。`),
      other.length ? h("p", { class: "muted" }, `其他来源作答 ${other.length} 次，也不计入真实统计。`) : null,
      h("p", { class: "muted" }, `示例错题档案 ${sampleMistakes.length} 份。`),
      exportHint ? h("p", { class: "notice" }, exportHint) : null,
      state.dbMessage ? h("p", { class: "notice" }, state.dbMessage) : null
    ])
  );
}

function renderHome(ctx) {
  const subjects = state.catalog.visibleSubjects(optionalOn()).filter((subject) => !subject.optional);
  let last = null;
  try { last = localStorage.getItem(UI_KEYS.lastTopic); } catch { /* ignore */ }
  const lastTopic = last ? state.catalog.topic(last) : null;
  return h("div", { class: "stack" }, [
    h("header", { class: "page-head" }, [
      h("p", { class: "kicker" }, "阶段 1 · 学习闭环"),
      h("h1", {}, "学习工作台"),
      h("p", {}, "从目录进入知识点，看已登记的视频，做明确标注的示例题，再把错题留在本机。"),
      h("p", { class: "muted" }, state.catalog.disclaimer)
    ]),
    h("div", { class: "row" }, [
      h("a", { class: "btn btn-primary", href: "#/topic/math.domain" }, "从高数「定义域」示例开始"),
      lastTopic ? h("a", { class: "btn", href: `#/topic/${lastTopic.id}` }, `继续：${lastTopic.title}`) : null,
      h("a", { class: "btn", href: "#/mistakes" }, "错题本")
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
      h("label", { class: "search-label", for: "home-q" }, "搜索已导入内容"),
      h("input", { id: "home-q", name: "q", type: "search", placeholder: "例如：定义域、洛必达、Excel" }),
      h("button", { class: "btn", type: "submit" }, "搜索")
    ]),
    state.catalog.warnings.length ? h("div", { class: "notice" }, `目录有 ${state.catalog.warnings.length} 条跳过提示，设置页导入时也会单独报告。`) : null,
    h("section", { class: "stack" }, [
      h("h2", {}, `七科 · ${subjects.length}`),
      h("div", { class: "card-grid" }, subjects.map((subject) => h("a", { class: "info-card", href: `#/subject/${subject.id}` }, [
        h("h3", {}, subject.name),
        h("p", {}, subject.status === "building" ? "建设中，没有科目页链接。" : "打开导航草案"),
        subject.homeUrl ? h("span", { class: "muted" }, `原页面 ${subject.homeUrl}`) : null
      ])))
    ]),
    h("section", { class: "panel" }, [
      h("h2", {}, "还没做的部分"),
      h("p", {}, "AI、识题、模拟考试、实验室、云同步和 3D 指挥塔都还没有完成。对应入口会说明未连接，不会显示编造的结果。")
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
    h("h1", {}, "本机笔记"),
    h("form", {
      class: "search-form",
      role: "search",
      onsubmit: (event) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get("q") || "";
        location.hash = `#/notes?q=${encodeURIComponent(String(value).trim())}`;
      }
    }, [
      h("label", { class: "search-label", for: "note-q" }, "搜索笔记"),
      h("input", { id: "note-q", name: "q", type: "search", value: query }),
      h("button", { class: "btn", type: "submit" }, "搜索")
    ]),
    visible.length ? h("ul", { class: "stack list-plain" }, visible.map((note) => h("li", { class: "panel" }, [
      h("h2", {}, note.title || "笔记"),
      h("p", {}, note.body || ""),
      h("a", { href: `#/topic/${note.topic_ids?.[0] || ""}` }, "打开知识点")
    ]))) : h("div", { class: "empty" }, [h("strong", {}, "还没有笔记"), h("p", {}, "到知识点页面写一条即可。未导入的资料不会出现在搜索里。")])
  ]);
}

function renderPlaceholder(title, message) {
  return h("article", { class: "stack" }, [
    h("h1", {}, title),
    h("p", { class: "notice" }, message),
    h("a", { class: "btn", href: "#/home" }, "回到学习首页")
  ]);
}

function renderOcr() {
  const note = h("p", { class: "notice", role: "status" }, getOcrStatus().message);
  return h("article", { class: "stack" }, [
    h("h1", {}, "拍照识题"),
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
  if (route.name === "home") return renderHome(ctx);
  if (route.name === "subjects") return renderSubjectIndex(ctx);
  if (route.name === "subject") return renderSubjectDetail(ctx);
  if (route.name === "topic") return renderTopic(ctx);
  if (route.name === "quiz") return renderQuiz(ctx);
  if (route.name === "mistakes") return renderMistakes(ctx);
  if (route.name === "notes") return renderNotes(ctx);
  if (route.name === "settings") return renderSettings(ctx);
  if (route.name === "ai") return renderPlaceholder("AI 辅导", getAiStatus().message);
  if (route.name === "ocr") return renderOcr();
  if (route.name === "exam") return renderPlaceholder("模拟考试", "阶段 3 还没有做。这里没有试卷，也不会在交卷前展示答案。");
  if (route.name === "plan") return renderPlaceholder("学习计划", "还没有可执行的计划。未设置考试日期，页面也不显示倒计时。");
  if (route.name === "labs") return renderPlaceholder("实验室", getLabsStatus().message);
  if (route.name === "sync") return renderPlaceholder("跨设备同步", getSyncStatus().message);
  if (route.query.get("q")) {
    const results = searchCatalog(state.catalog, route.query.get("q"), state.learning.notes || [], optionalOn());
    return h("div", { class: "stack" }, [h("h1", {}, "搜索"), ...results.map((item) => h("a", { href: item.href }, `${item.type} · ${item.title}`))]);
  }
  return renderPlaceholder("没有这个页面", "从七科目录重新进入即可。");
}

async function render() {
  const route = parseRoute();
  renderNav(route);
  renderRail();
  const main = document.querySelector("#main");
  try {
    const page = renderPage(route);
    if (state.notice) {
      const note = h("p", { class: "notice", role: "status" }, state.notice);
      state.notice = "";
      main.replaceChildren(h("div", { class: "stack" }, [note, page]));
    } else {
      main.replaceChildren(page);
    }
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
