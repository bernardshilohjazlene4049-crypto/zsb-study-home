import { h } from "../core/dom.js";
import { CATEGORY_LABEL, formatWhen, isSampleQuestion } from "./labels.js";

export function renderMistakes(ctx) {
  const subject = ctx.subjectFilter || "";
  const category = ctx.categoryFilter || "";
  const rows = (ctx.learning.mistakes || []).filter((item) => !item.deleted_at);
  const filtered = rows.filter((item) => {
    if (subject && item.subject_id !== subject) return false;
    if (category && item.category !== category) return false;
    return true;
  });
  const sample = filtered.filter((item) => item.provenance?.kind === "sample" || item.counts_toward_real_stats === false && item.provenance?.kind === "sample");
  const real = filtered.filter((item) => item.counts_toward_real_stats === true);
  const other = filtered.filter((item) => !real.includes(item) && !sample.includes(item));
  return h("div", { class: "stack" }, [
    h("header", { class: "page-head" }, [
      h("h1", {}, "错题本"),
      h("p", { class: "muted" }, "同一题只有一份档案和多次作答。重练会新增记录，不会改掉第一次的答案。")
    ]),
    h("form", {
      class: "row",
      onchange: (event) => {
        const data = new FormData(event.currentTarget);
        const params = new URLSearchParams();
        if (data.get("subject")) params.set("subject", data.get("subject"));
        if (data.get("category")) params.set("category", data.get("category"));
        location.hash = `#/mistakes${params.toString() ? `?${params}` : ""}`;
      }
    }, [
      h("label", { class: "inline-field" }, ["科目", subjectSelect(ctx, subject)]),
      h("label", { class: "inline-field" }, ["原因", categorySelect(category)])
    ]),
    h("section", { class: "stack" }, [
      h("h2", {}, `已核验题目的错题 · ${real.length}`),
      real.length ? h("ul", { class: "stack list-plain" }, real.map((item) => mistakeCard(ctx, item))) : h("p", { class: "muted" }, "还没有。示例题不会出现在这里。")
    ]),
    h("section", { class: "stack" }, [
      h("h2", {}, `示例错题 · ${sample.length}`),
      h("p", { class: "muted" }, "这些记录可以重练，但不进入真实学习统计。"),
      sample.length ? h("ul", { class: "stack list-plain" }, sample.map((item) => mistakeCard(ctx, item))) : h("p", { class: "muted" }, "还没有示例错题。")
    ]),
    other.length ? h("section", { class: "stack" }, [
      h("h2", {}, `其他来源 · ${other.length}`),
      h("ul", { class: "stack list-plain" }, other.map((item) => mistakeCard(ctx, item)))
    ]) : null
  ]);
}

function subjectSelect(ctx, current) {
  const select = h("select", { name: "subject" }, [h("option", { value: "" }, "全部")]);
  for (const subject of ctx.catalog.visibleSubjects(ctx.optionalOn)) {
    const option = h("option", { value: subject.id }, subject.name);
    if (subject.id === current) option.selected = true;
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
    h("p", { class: "muted" }, `档案 ${item.id}`),
    h("p", { class: "muted" }, `首次作答 ${item.first_attempt_id} · 最近 ${item.last_attempt_id} · 共 ${item.attempt_ids?.length || attempts.length} 次`),
    h("p", { class: "muted" }, `下次复习参考 ${formatWhen(item.next_review_at)}`),
    h("div", { class: "row" }, [
      h("a", { class: "btn btn-primary", href: `#/quiz/${item.question_id}?mode=retry` }, "重练"),
      question ? h("a", { class: "btn", href: `#/topic/${question.topic_ids?.[0] || ""}` }, "知识点") : null
    ]),
    h("details", {}, [
      h("summary", {}, "查看历次作答存档"),
      h("ul", { class: "stack" }, attempts.map((attempt) => h("li", {}, [
        h("p", {}, `${formatWhen(attempt.submitted_at)} · ${attempt.grading?.status || "已记录"} · ${attempt.understanding || ""}`),
        h("p", { class: "muted" }, attempt.id),
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
