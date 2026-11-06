import { h } from "../core/dom.js";
import { UNDERSTANDING, REASON_TAGS } from "./mistake-rules.js";
import { gradeQuestion } from "./grading.js";
import { commitSubmission, getDraft, saveDraft, toggleMark, updateMistakeTags } from "./records.js";
import { CATEGORY_LABEL, GRADING_LABEL, formatWhen, isSampleQuestion } from "./labels.js";
import { getAiStatus } from "../adapters/status.js";

function helpKey(questionId) {
  return `zsb.help.${questionId}`;
}

function readHelp(questionId) {
  try { return sessionStorage.getItem(helpKey(questionId)) || "none"; } catch { return "none"; }
}

function markSeen(questionId) {
  try { sessionStorage.setItem(helpKey(questionId), "saw_explanation"); } catch { /* ignore */ }
}

export function renderQuiz(ctx) {
  const question = ctx.catalog.question(ctx.id);
  if (!question) {
    return h("div", { class: "empty" }, [
      h("strong", {}, "没有这道题"),
      h("a", { class: "btn", href: "#/subjects" }, "返回目录")
    ]);
  }
  const submittedId = ctx.submitted;
  if (submittedId) return renderSubmitted(ctx, question, submittedId);
  return renderAnswering(ctx, question);
}

function renderAnswering(ctx, question) {
  const summaries = (ctx.learning.attempts || [])
    .filter((attempt) => attempt.question_id === question.id)
    .sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)));
  const sample = isSampleQuestion(question);
  const topicId = question.topic_ids?.[0];
  const selected = new Set();
  let text = "";
  let touched = false;
  const root = h("article", { class: "stack" });
  const live = h("div", { class: "notice", role: "status", "aria-live": "polite" }, "作答时不显示答案。");
  const form = h("form", { class: "stack" });
  const submit = h("button", { class: "btn btn-primary", type: "submit" }, "提交答案");
  const blank = h("button", { class: "btn", type: "button" }, "记为未作答");
  const star = h("button", { class: "btn", type: "button" }, "收藏");

  root.append(...[
    h("p", { class: "crumbs" }, [
      topicId ? h("a", { href: `#/topic/${topicId}` }, "返回知识点") : h("a", { href: "#/subjects" }, "目录"),
      " / 练习"
    ]),
    h("div", { class: "row" }, [
      h("h1", {}, "一次一题"),
      sample ? h("span", { class: "badge badge-sample" }, "示例 · 非真题 · 不计入真实统计") : h("span", { class: "badge" }, question.provenance?.kind || "题目"),
      h("span", { class: "badge" }, typeLabel(question.type))
    ]),
    summaries.length ? h("p", { class: "notice" }, `这道题已有 ${summaries.length} 次作答。这次会新记一条，不会覆盖以前的记录，也不会在作答前展示上次答案。`) : null,
    ctx.mode === "retry" ? h("p", { class: "notice" }, "重练开始前不显示上次答案和解析。") : null,
    ctx.action === "not-understood" ? h("p", { class: "notice" }, "如果这题还不会，可以点「记为未作答」，再选「看过仍不懂」。") : null,
    h("p", { class: "stem" }, question.stem),
    form,
    live
  ].filter((node) => node != null));

  if (question.type === "single_choice" || question.type === "true_false") {
    form.append(...question.options.map((option) => h("label", { class: "choice" }, [
      h("input", { type: "radio", name: "option", value: option.id }),
      h("span", {}, `${option.id}. ${option.text}`)
    ])));
  } else if (question.type === "multiple_choice") {
    form.append(h("p", { class: "muted" }, "多选需要与参考答案完全一致才算答对。"), ...question.options.map((option) => h("label", { class: "choice" }, [
      h("input", { type: "checkbox", name: "option", value: option.id }),
      h("span", {}, `${option.id}. ${option.text}`)
    ])));
  } else if (question.type === "fill_blank") {
    form.append(h("label", { class: "stack" }, ["答案", h("input", { name: "text", type: "text", autocomplete: "off" })]));
  } else {
    form.append(
      h("p", { class: "notice" }, "这是开放题。提交后只给参考要点，状态为待评阅，不会假装已经自动判分。"),
      h("label", { class: "stack" }, ["你的作答", h("textarea", { name: "text", rows: "5" })])
    );
  }
  form.append(h("div", { class: "row" }, [submit, blank, star]));

  const applyDraft = (draft) => {
    if (touched || !draft) return;
    const response = draft?.response || {};
    text = response.text || "";
    for (const id of response.option_ids || []) selected.add(id);
    const textField = form.querySelector("[name=text]");
    if (textField) textField.value = text;
    for (const input of form.querySelectorAll("input[name=option]")) {
      input.checked = selected.has(input.value);
    }
  };

  const collect = () => {
    const optionIds = [...form.querySelectorAll("input[name=option]:checked")].map((input) => input.value);
    const textField = form.querySelector("[name=text]");
    return { option_ids: optionIds, text: textField ? textField.value : "" };
  };

  let draftTimer = 0;
  form.addEventListener("change", () => scheduleDraft());
  form.addEventListener("input", () => scheduleDraft());
  function scheduleDraft() {
    touched = true;
    if (!ctx.dbOk || ctx.readOnly) return;
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(() => {
      saveDraft(question.id, collect()).catch(() => {
        live.textContent = "草稿没有保存成功。";
      });
    }, 250);
  }

  if (ctx.dbOk) {
    getDraft(question.id).then(applyDraft).catch(() => {});
    const marked = (ctx.learning.marks || []).some((item) => item.question_id === question.id && item.starred);
    if (marked) star.textContent = "已收藏";
  }

  star.addEventListener("click", async () => {
    if (!ctx.dbOk || ctx.readOnly) {
      live.textContent = "现在不能写入本机数据库。";
      return;
    }
    const next = await toggleMark(question.id);
    star.textContent = next.starred ? "已收藏" : "收藏";
  });

  const started = Date.now();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const response = collect();
    if (!response.option_ids.length && !String(response.text || "").trim()) {
      live.textContent = "还没有填写答案。可以改点「记为未作答」。";
      return;
    }
    await reveal(ctx, root, question, response, Date.now() - started);
  });
  blank.addEventListener("click", async () => {
    await reveal(ctx, root, question, { option_ids: [], text: "" }, Date.now() - started);
  });
  return root;
}

async function reveal(ctx, root, question, response, elapsedMs) {
  const grading = gradeQuestion(question, response);
  const alreadySeen = readHelp(question.id) === "saw_explanation";
  markSeen(question.id);
  const helpLevel = alreadySeen && grading.status !== "unanswered" ? "saw_explanation" : "none";
  const box = h("section", { class: "panel stack" });
  const guessed = h("input", { type: "checkbox" });
  box.append(...[
    h("h2", {}, "解析"),
    h("p", {}, `${GRADING_LABEL[grading.status] || grading.status}${grading.auto ? "" : " · 未自动判分"}`),
    h("p", {}, question.explanation || "这道题没有解析文本。"),
    grading.status === "correct" ? h("label", { class: "choice" }, [guessed, h("span", {}, "这题我是猜对的")]) : null,
    h("p", { class: "muted" }, "选择下面一项后，才生成一条不可变的作答记录。"),
    h("div", { class: "stack" }, UNDERSTANDING.map((item) => h("button", {
      class: "btn",
      type: "button",
      onclick: () => store(ctx, question, response, grading, item.id, guessed.checked && item.id === "not_understood", helpLevel, elapsedMs, box)
    }, `${item.label} · ${item.detail}`)))
  ].filter((node) => node != null));
  const old = root.querySelector(".reveal");
  if (old) old.remove();
  box.classList.add("reveal");
  root.append(box);
  const form = root.querySelector("form");
  if (form) {
    for (const field of form.querySelectorAll("input, textarea, button")) field.disabled = true;
  }
}

async function store(ctx, question, response, grading, understanding, guessed, helpLevel, elapsedMs, box) {
  if (!ctx.dbOk || ctx.readOnly) {
    box.append(h("p", { class: "notice" }, ctx.dbMessage || "数据库不可用，这次没有保存。"));
    return;
  }
  for (const button of box.querySelectorAll("button")) button.disabled = true;
  try {
    const result = await commitSubmission({
      question,
      response,
      grading,
      understanding,
      guessed,
      helpLevel,
      elapsedMs
    });
    await ctx.reload();
    const next = `#/quiz/${question.id}?submitted=${encodeURIComponent(result.attempt.id)}`;
    if (location.hash === next) ctx.render();
    else location.hash = next;
  } catch (error) {
    box.append(h("p", { class: "notice" }, error.message || "保存失败，没有写入新的作答。"));
    for (const button of box.querySelectorAll("button")) button.disabled = false;
  }
}

function renderSubmitted(ctx, question, submittedId) {
  const attempt = (ctx.learning.attempts || []).find((item) => item.id === submittedId && item.question_id === question.id);
  if (!attempt) {
    return h("div", { class: "empty" }, [
      h("strong", {}, "找不到这次作答"),
      h("a", { class: "btn", href: `#/quiz/${question.id}` }, "重新作答")
    ]);
  }
  const mistake = (ctx.learning.mistakes || []).find((item) => item.question_id === question.id && !item.deleted_at);
  const topicId = question.topic_ids?.[0];
  const others = (ctx.learning.attempts || []).filter((item) => item.question_id === question.id);
  const list = topicId ? ctx.catalog.questionsForTopic(topicId) : [];
  const index = list.findIndex((item) => item.id === question.id);
  const next = index >= 0 ? list[index + 1] : null;
  const ai = h("p", { class: "notice", hidden: true });
  const tags = h("div", { class: "row" });
  if (mistake) {
    for (const tag of REASON_TAGS) {
      const pressed = (mistake.reason_tags || []).includes(tag.id);
      tags.append(h("button", {
        class: "btn",
        type: "button",
        "aria-pressed": pressed ? "true" : "false",
        onclick: async (event) => {
          const current = new Set(mistake.reason_tags || []);
          if (current.has(tag.id)) current.delete(tag.id);
          else current.add(tag.id);
          await updateMistakeTags(mistake.id, [...current]);
          event.currentTarget.setAttribute("aria-pressed", current.has(tag.id) ? "true" : "false");
          await ctx.reload();
        }
      }, tag.label));
    }
  }
  return h("article", { class: "stack" }, [
    h("div", { class: "row" }, [
      h("h1", {}, "本次结果"),
      isSampleQuestion(question) ? h("span", { class: "badge badge-sample" }, "示例 · 不计入真实统计") : null
    ]),
    h("p", { class: "stem" }, question.stem),
    h("p", {}, `${GRADING_LABEL[attempt.grading?.status] || "已提交"} · ${labelOfUnderstanding(attempt.understanding)}`),
    attempt.guessed ? h("p", {}, "这次按「猜对」记入复习。") : null,
    h("p", {}, question.explanation || ""),
    h("p", { class: "muted" }, `作答编号 ${attempt.id}`),
    h("p", { class: "muted" }, `同一题目前后共 ${others.length} 条作答，最早一条不会被这条覆盖。`),
    mistake ? h("p", {}, `错题档案：${CATEGORY_LABEL[mistake.category] || mistake.category} · 首次作答 ${mistake.first_attempt_id}`) : h("p", {}, "这次没有进入错题本。"),
    mistake ? h("div", { class: "stack" }, [h("h2", {}, "错因（只改档案，不改作答记录）"), tags]) : null,
    h("p", { class: "muted" }, mistake?.next_review_at ? `下次复习参考时间 ${formatWhen(mistake.next_review_at)}。间隔是可调整的启发式，不是官方安排。` : ""),
    h("div", { class: "row" }, [
      h("a", { class: "btn btn-primary", href: `#/quiz/${question.id}?mode=retry` }, "重练本题"),
      next ? h("a", { class: "btn", href: `#/quiz/${next.id}` }, "下一题") : null,
      topicId ? h("a", { class: "btn", href: `#/topic/${topicId}` }, "返回知识点") : null,
      h("a", { class: "btn", href: "#/mistakes" }, "错题本"),
      h("button", {
        class: "btn",
        type: "button",
        onclick: () => {
          ai.hidden = false;
          ai.textContent = getAiStatus().message;
        }
      }, "AI 一步步讲")
    ]),
    ai
  ]);
}

function labelOfUnderstanding(id) {
  return UNDERSTANDING.find((item) => item.id === id)?.label || id || "未记录";
}

function typeLabel(type) {
  const map = {
    single_choice: "单选",
    multiple_choice: "多选",
    true_false: "判断",
    fill_blank: "填空",
    short_answer: "简答",
    code_reading: "代码阅读",
    step: "步骤题"
  };
  return map[type] || type;
}
