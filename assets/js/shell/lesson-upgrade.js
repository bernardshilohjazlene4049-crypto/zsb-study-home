import { el, icon } from "./ui.js";

const ROOT = new URL("../../../", import.meta.url);
const CHECKLIST_KEY = "zsb.lesson-checklist.v1";
let guidePromise = null;

function normalize(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function readChecklist() {
  try {
    return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveChecklist(data) {
  try {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(data));
  } catch {
    // 清单是辅助功能；存储失败不影响正文阅读。
  }
}

function loadGuides() {
  if (!guidePromise) {
    guidePromise = fetch(new URL("data/lesson-guides.json", ROOT))
      .then((response) => response.ok ? response.json() : { pages: {} })
      .catch(() => ({ pages: {} }));
  }
  return guidePromise;
}

function categoryLabel(rel) {
  if (rel.includes("/html5/")) return "HTML5";
  if (rel.includes("/html/")) return "HTML";
  if (rel.includes("/css/")) return "CSS / CSS3";
  if (rel.includes("/js/")) return "JavaScript / DOM";
  if (rel.includes("/ch1/")) return "网页基本概念";
  if (rel.includes("/ch2/")) return "HTML5 文档结构";
  if (rel.includes("reference")) return "速查工具";
  if (rel.includes("examples")) return "实例索引";
  return "课程内容";
}

function fallbackGuide(rel, title, lead) {
  const type = categoryLabel(rel);
  return {
    type,
    level: title.includes("自测") || title.includes("速查") || title.includes("总结") ? "复习工具" : "课程重点",
    objectives: [
      `能用自己的话说清「${title}」的作用和适用范围。`,
      "能修改下方示例，并解释修改前后的结果差异。",
      "能识别至少一个常见错误，并说出修正方法。"
    ],
    focus: lead || `先掌握「${title}」的核心规则，再通过示例验证理解。`,
    checks: [
      "我能不按原文复述本页核心结论",
      "我能预测示例中至少一处修改的结果",
      "我知道本页最容易出错的地方"
    ],
    source: "站内课程目录与页面原内容整理"
  };
}

function addBrief(article, guide, rel) {
  const hero = article.querySelector(".page-hero, .wy-point-head, .hero-area, .chapter-heading, .chapter-top");
  if (!hero || article.querySelector(".lesson-brief")) return;
  const title = normalize(article.querySelector("h1")?.textContent || document.title.split("·")[0]);
  const examples = article.querySelectorAll(".tryit").length;
  const quizItems = article.querySelectorAll(".qitem").length;
  const bodyChars = normalize(article.innerText).length;
  const minutes = guide.minutes || Math.max(4, Math.min(18, Math.ceil(bodyChars / 260) + examples * 2));
  const tryit = article.querySelector(".tryit");
  const review = article.querySelector(".lesson-review");
  const firstQuiz = article.querySelector(".qitem");
  const objectives = guide.objectives.map((text, index) => {
    if (index !== 2 || examples || firstQuiz) return text;
    return "能用自己的例子复述本页规则，并说明它与前后知识点的关系。";
  });

  const actions = [];
  if (tryit) {
    const button = el("button", { type: "button", class: "sh-btn sh-btn--primary" }, [
      icon("playCircle", 15),
      el("span", { text: "开始示例" })
    ]);
    button.addEventListener("click", () => tryit.scrollIntoView({ block: "center", behavior: "smooth" }));
    actions.push(button);
  }
  if (firstQuiz) {
    const button = el("button", { type: "button", class: "sh-btn" }, [icon("pencil", 15), el("span", { text: "去自测" })]);
    button.addEventListener("click", () => firstQuiz.scrollIntoView({ block: "center", behavior: "smooth" }));
    actions.push(button);
  }
  if (review) {
    const button = el("button", { type: "button", class: "sh-btn" }, [icon("check", 15), el("span", { text: "完成复盘" })]);
    button.addEventListener("click", () => review.scrollIntoView({ block: "center", behavior: "smooth" }));
    actions.push(button);
  }

  const brief = el("section", { class: "lesson-brief", "aria-labelledby": "lesson-brief-title" }, [
    el("div", { class: "lesson-brief__head" }, [
      el("div", {}, [
        el("p", { class: "lesson-brief__eyebrow", text: `${guide.type || categoryLabel(rel)} · ${guide.level || "课程重点"}` }),
        el("h2", { id: "lesson-brief-title", text: "本页学习任务" })
      ]),
      el("div", { class: "lesson-brief__chips" }, [
        el("span", {}, [icon("clock", 14), el("span", { text: `约 ${minutes} 分钟` })]),
        el("span", {}, [icon("code", 14), el("span", { text: `${examples} 个可运行示例` })]),
        el("span", {}, [icon("pencil", 14), el("span", { text: quizItems ? `${quizItems} 道自测` : "自测分批补充" })])
      ])
    ]),
    el("ol", { class: "lesson-brief__objectives" }, objectives.map((text) => el("li", { text }))),
    el("div", { class: "lesson-brief__focus" }, [
      el("strong", { text: "本页先抓这个判断：" }),
      el("span", { text: guide.focus })
    ]),
    guide.factNote ? el("div", { class: "lesson-brief__correction" }, [
      el("strong", { text: "事实校注：" }),
      el("span", { text: guide.factNote })
    ]) : null,
    el("div", { class: "lesson-brief__actions" }, actions)
  ]);
  hero.insertAdjacentElement("afterend", brief);
}

function addReview(article, guide, rel) {
  if (article.querySelector(".lesson-review")) return;
  const title = normalize(article.querySelector("h1")?.textContent || document.title.split("·")[0]);
  const all = readChecklist();
  const state = { ...(all[rel] || {}) };
  const list = el("div", { class: "lesson-review__checks" });
  const checks = guide.checks || fallbackGuide(rel, title, "").checks;
  checks.forEach((text, index) => {
    const id = `lesson-check-${rel.replace(/[^a-z0-9]+/gi, "-")}-${index}`;
    const input = el("input", { id, type: "checkbox" });
    input.checked = Boolean(state[index]);
    input.addEventListener("change", () => {
      state[index] = input.checked;
      all[rel] = state;
      saveChecklist(all);
      updateSummary();
    });
    list.append(el("label", { class: "lesson-review__check", for: id }, [input, el("span", { text })]));
  });
  const summary = el("p", { class: "lesson-review__summary", role: "status", "aria-live": "polite" });
  const updateSummary = () => {
    const done = Object.values(state).filter(Boolean).length;
    summary.textContent = done === checks.length
      ? "本页复盘完成。建议用下方上一节/下一节继续学习，并在到期复习时回看。"
      : `已完成 ${done} / ${checks.length} 项。`;
  };

  const review = el("section", { class: "lesson-review", "aria-labelledby": "lesson-review-title" }, [
    el("div", { class: "lesson-review__head" }, [
      el("div", {}, [
        el("p", { class: "lesson-brief__eyebrow", text: "QUICK REVIEW" }),
        el("h2", { id: "lesson-review-title", text: "用 1 分钟完成本页复盘" })
      ]),
      summary
    ]),
    list,
    el("p", { class: "lesson-review__source" }, [
      el("strong", { text: "内容说明：" }),
      el("span", { text: guide.source || "站内课程目录与页面原内容整理" }),
      el("span", { text: " “重点”表示站内复习优先级，不等同官方考纲。" })
    ])
  ]);
  updateSummary();
  const articleEnd = article.querySelector(".wy-pager");
  if (articleEnd) articleEnd.before(review);
  else article.append(review);
}

function addSideCard(sk, guide, rel) {
  if (sk.side.querySelector(".lesson-side-card")) return;
  sk.side.append(el("section", { class: "sh-card lesson-side-card" }, [
    el("h2", { class: "sh-card__title" }, [icon("target", 18), el("span", { text: "本页怎么学" })]),
    el("ol", { class: "lesson-side-card__steps" }, [
      el("li", {}, [el("strong", { text: "先读判断" }), el("span", { text: "看本页学习任务和一句结论。" })]),
      el("li", {}, [el("strong", { text: "再改示例" }), el("span", { text: "每次只改一处，先预测再运行。" })]),
      el("li", {}, [el("strong", { text: "最后复盘" }), el("span", { text: "勾选清单并进入下一节。" })])
    ]),
    el("a", { class: "lx-path__graph", href: new URL("study/index.html#/mistakes", ROOT).href }, [
      el("span", { text: "查看学习与复习" }),
      icon("chevron", 14)
    ])
  ]));
}

function addToolFilter(article, rel) {
  if (rel === "wy/reference/index.html" && !article.querySelector("[data-reference-filter]")) {
    const rows = [...article.querySelectorAll(".ref-table tbody tr")];
    const input = el("input", {
      id: "reference-filter",
      type: "search",
      placeholder: "搜索标签、属性或用途…",
      autocomplete: "off",
      "data-reference-filter": ""
    });
    const status = el("span", { class: "tool-filter__status", role: "status", "aria-live": "polite" });
    const box = el("label", { class: "tool-filter", for: "reference-filter" }, [
      el("span", { class: "tool-filter__label", text: "即时筛选" }),
      input,
      status
    ]);
    const update = () => {
      const query = input.value.trim().toLowerCase();
      let shown = 0;
      for (const row of rows) {
        const hit = !query || row.textContent.toLowerCase().includes(query);
        row.hidden = !hit;
        if (hit) shown += 1;
      }
      for (const heading of article.querySelectorAll("h2")) {
        const next = heading.nextElementSibling;
        if (next?.classList.contains("ref-wrap")) heading.hidden = !next.querySelector("tbody tr:not([hidden])");
      }
      status.textContent = query ? `找到 ${shown} 条` : `共 ${rows.length} 条`;
    };
    input.addEventListener("input", update);
    update();
    article.querySelector("h1")?.insertAdjacentElement("afterend", box);
  }

  if (rel === "wy/examples/index.html" && !article.querySelector("[data-example-filter]")) {
    const links = [...article.querySelectorAll(".ex-list a")];
    const input = el("input", {
      id: "example-filter",
      type: "search",
      placeholder: "搜索 HTML、CSS、JS 或知识点…",
      autocomplete: "off",
      "data-example-filter": ""
    });
    const status = el("span", { class: "tool-filter__status", role: "status", "aria-live": "polite" });
    const box = el("label", { class: "tool-filter", for: "example-filter" }, [
      el("span", { class: "tool-filter__label", text: "筛选可运行实例" }),
      input,
      status
    ]);
    const update = () => {
      const query = input.value.trim().toLowerCase();
      let shown = 0;
      for (const link of links) {
        const hit = !query || `${link.textContent} ${link.getAttribute("href")}`.toLowerCase().includes(query);
        link.hidden = !hit;
        if (hit) shown += 1;
      }
      status.textContent = query ? `找到 ${shown} 个入口` : `共 ${links.length} 个入口`;
    };
    input.addEventListener("input", update);
    update();
    article.querySelector(".page-hero")?.after(box);
  }
}

function addBoxCalculator(article) {
  if (article.querySelector(".box-calculator")) return;
  const field = (id, label, value) => {
    const input = el("input", { id, type: "number", min: "0", step: "1", value: String(value), inputmode: "numeric" });
    return { input, label: el("label", { for: id }, [el("span", { text: label }), input]) };
  };
  const width = field("box-width", "CSS width", 200);
  const padding = field("box-padding", "单侧 padding", 20);
  const border = field("box-border", "单侧 border", 4);
  const margin = field("box-margin", "单侧 margin", 10);
  const mode = el("select", { id: "box-sizing-mode" }, [
    el("option", { value: "content-box", text: "content-box（默认）" }),
    el("option", { value: "border-box", text: "border-box" })
  ]);
  const output = el("div", { class: "box-calculator__result", role: "status", "aria-live": "polite" });
  const update = () => {
    const cssWidth = Math.max(0, Number(width.input.value) || 0);
    const p = Math.max(0, Number(padding.input.value) || 0);
    const b = Math.max(0, Number(border.input.value) || 0);
    const m = Math.max(0, Number(margin.input.value) || 0);
    const borderBox = mode.value === "border-box" ? cssWidth : cssWidth + p * 2 + b * 2;
    const content = mode.value === "border-box" ? Math.max(0, cssWidth - p * 2 - b * 2) : cssWidth;
    output.replaceChildren(
      el("strong", { text: `最终可见宽度：${borderBox}px` }),
      el("span", { text: `内容区：${content}px · 单侧 padding ${p}px · 单侧 border ${b}px` }),
      el("span", { text: `加 margin 后占位：${borderBox + m * 2}px（margin 不计入 CSS width）` })
    );
  };
  [width.input, padding.input, border.input, margin.input].forEach((input) => input.addEventListener("input", update));
  mode.addEventListener("change", update);
  const lab = el("section", { class: "box-calculator", "aria-labelledby": "box-calculator-title" }, [
    el("div", { class: "box-calculator__head" }, [
      el("div", {}, [
        el("p", { class: "lesson-brief__eyebrow", text: "CSS LAB" }),
        el("h2", { id: "box-calculator-title", text: "盒子尺寸计算器" })
      ]),
      el("label", { for: "box-sizing-mode" }, [el("span", { text: "box-sizing" }), mode])
    ]),
    el("div", { class: "box-calculator__fields" }, [width.label, padding.label, border.label, margin.label]),
    output
  ]);
  update();
  article.querySelector(".lesson-brief")?.insertAdjacentElement("afterend", lab);
}

function addSelectorCalculator(article) {
  if (article.querySelector(".selector-weight")) return;
  const input = el("input", {
    id: "selector-weight-input",
    type: "text",
    value: "#result.notice:first-child",
    autocomplete: "off",
    spellcheck: "false"
  });
  const output = el("div", { class: "selector-weight__result", role: "status", "aria-live": "polite" });
  const update = () => {
    const selector = input.value.trim();
    const ids = (selector.match(/#[\w-]+/g) || []).length;
    const classes = (selector.match(/\.[\w-]+/g) || []).length;
    const attrs = (selector.match(/\[[^\]]+\]/g) || []).length;
    const pseudoElements = (selector.match(/::[\w-]+/g) || []).length;
    const pseudoClasses = (selector.replace(/::[\w-]+/g, "").match(/:(?!:)[\w-]+(?:\([^)]*\))?/g) || []).length;
    const elementCount = (selector
      .replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\([^)]*\))?/g, " ")
      .match(/(^|[\s>+~])([a-z][\w-]*)/gi) || []).length;
    const tuple = [ids, classes + attrs + pseudoClasses, elementCount + pseudoElements];
    output.replaceChildren(
      el("strong", { text: `权重元组：(${tuple.join(", ")})` }),
      el("span", { text: `ID ${ids} · 类/属性/伪类 ${classes + attrs + pseudoClasses} · 元素/伪元素 ${elementCount + pseudoElements}` }),
      el("span", { text: "比较时逐列比较且不进位；11 个类选择器仍小于 1 个 ID。同权重再看来源、层叠层和声明顺序。" })
    );
  };
  input.addEventListener("input", update);
  update();
  const lab = el("section", { class: "selector-weight", "aria-labelledby": "selector-weight-title" }, [
    el("p", { class: "lesson-brief__eyebrow", text: "SELECTOR LAB" }),
    el("h2", { id: "selector-weight-title", text: "选择器权重拆解" }),
    el("label", { for: "selector-weight-input" }, [el("span", { text: "输入一个选择器" }), input]),
    output
  ]);
  article.querySelector(".lesson-brief")?.insertAdjacentElement("afterend", lab);
}

export async function enhanceLesson({ shell, sk, current }) {
  const rel = shell.rel;
  const article = sk.body.querySelector(".wy-article") || sk.body.querySelector("article");
  if (!article) return;
  const guides = await loadGuides();
  const title = normalize(article.querySelector("h1")?.textContent || document.title.split("·")[0]);
  const lead = normalize(article.querySelector(".lead")?.textContent || "");
  const guide = guides.pages?.[rel] || fallbackGuide(rel, title, lead);
  addReview(article, guide, rel);
  addToolFilter(article, rel);
  addBrief(article, guide, rel);
  if (rel === "wy/css/box.html") addBoxCalculator(article);
  if (rel === "wy/css/selectors.html") addSelectorCalculator(article);
  addSideCard(sk, guide, rel);
  document.documentElement.classList.add("lesson-upgraded");
  if (current) article.dataset.topicId = current;
}
