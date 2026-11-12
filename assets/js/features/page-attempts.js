// 正文页（gs45、yy5、网页设计小测验等）作答的统一约定：题目 ID、作答事件、迁移、总览快照。
// 纯函数，浏览器与 node 测试共用；写库仍走 records.js 的 commitSubmission。
import { enrichTopicIds, isExcludedQuestionId, topicIdsForQuestionId } from "./topic-index.js";

export { enrichTopicIds, isExcludedQuestionId, topicIdsForQuestionId };

export const PAGE_PROVENANCE = Object.freeze({ kind: "page", verified: true });

// 自评三档（看完解答后选择）。映射到既有的 grading / understanding，复习间隔沿用 mistake-rules.js。
export const RATINGS = Object.freeze({
  good: { grading: { status: "correct", auto: false, method: "self_report", score: 1 }, understanding: "mastered" },
  fuzzy: { grading: { status: "pending", auto: false, method: "self_report", score: null }, understanding: "not_understood" },
  again: { grading: { status: "incorrect", auto: false, method: "self_report", score: 0 }, understanding: "still_confused" }
});

const SAFE = /[^0-9A-Za-z_.\-]/g;

export function pageQuestionId(pageKey, itemKey) {
  const page = String(pageKey || "").replace(SAFE, "-");
  const item = String(itemKey || "").replace(SAFE, "-");
  if (!page || !item) throw new Error("pageQuestionId 需要 pageKey 和 itemKey。");
  return `page:${page}:${item}`;
}

export function choiceOutcome(choice, correct) {
  const picked = String(choice || "").trim();
  if (!picked) return { grading: { status: "unanswered", auto: true, score: null }, understanding: "still_confused" };
  const ok = picked === String(correct || "").trim();
  return {
    grading: { status: ok ? "correct" : "incorrect", auto: true, score: ok ? 1 : 0 },
    understanding: ok ? "mastered" : "still_confused"
  };
}

export function ratingOutcome(rating) {
  const row = RATINGS[rating];
  if (!row) throw new Error(`未知自评：${rating}`);
  return { grading: { ...row.grading }, understanding: row.understanding };
}

// FNV-1a 32 位，用于生成确定的幂等键（迁移重复运行不会重复写入）。
export function stableHash(text) {
  let h = 0x811c9dc5;
  const s = String(text);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function migrationAttemptId(storageKey, questionId, value) {
  return `att_mig_${stableHash(`${storageKey}|${questionId}|${JSON.stringify(value)}`)}`;
}

// 把作答描述规范成 recordExternalAttempt 的 payload。
export function normalizePagePayload(input = {}) {
  const questionId = input.questionId;
  if (!questionId || !String(questionId).startsWith("page:")) throw new Error("正文页题目 ID 必须以 page: 开头。");
  let outcome;
  if (input.rating) outcome = ratingOutcome(input.rating);
  else if (Object.hasOwn(input, "choice")) outcome = choiceOutcome(input.choice, input.correct);
  else throw new Error("需要 rating 或 choice。");
  const page = input.page || {};
  return {
    questionId,
    subjectId: input.subjectId || null,
    topicIds: (input.topicIds && input.topicIds.length) ? input.topicIds : topicIdsForQuestionId(questionId),
    type: input.rating ? "self_rated" : "single_choice",
    stem: String(input.stem || "").replace(/\s+/g, " ").trim(),
    answer: input.rating ? null : { option_ids: [String(input.correct || "")] },
    response: input.rating ? { option_ids: [], text: "", rating: input.rating } : { option_ids: input.choice ? [String(input.choice)] : [], text: "" },
    grading: outcome.grading,
    understanding: outcome.understanding,
    provenanceKind: "page",
    page: { url: page.url || "", title: page.title || "", anchor: page.anchor || "" },
    attemptId: input.attemptId || null,
    migratedFrom: input.migratedFrom || null
  };
}

// yy5 旧记录：{ "4-1": "B", ... } → payload 列表（需页面提供每题的正确选项和题干）。
export function migrateChoiceMap(storageKey, answers, questions) {
  const out = [];
  if (!answers || typeof answers !== "object") return out;
  for (const q of questions) {
    const value = answers[q.itemKey];
    if (!["A", "B", "C", "D"].includes(value)) continue;
    out.push(normalizePagePayload({
      questionId: q.questionId,
      subjectId: q.subjectId,
      stem: q.stem,
      choice: value,
      correct: q.correct,
      page: q.page,
      attemptId: migrationAttemptId(storageKey, q.questionId, value),
      migratedFrom: storageKey
    }));
  }
  return out;
}

export function localDay(value) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isRealRecord(record) {
  return record?.counts_toward_real_stats === true && record?.provenance?.kind !== "sample";
}

function pageHref(page, base) {
  if (!page?.url) return "";
  return `${base}${page.url}${page.anchor ? `#${page.anchor}` : ""}`;
}

// 学习总览快照（GPT study-overview.js 的 adapter 约定）。只用真实记录；迁移来的旧记录不计入每日活跃。
export function buildOverviewSnapshot({ attempts = [], mistakes = [], registry = { subjects: [] }, subjects = [], topics = [], now = new Date(), base = "../" } = {}) {
  const visibleAttempts = attempts.filter((a) => !isExcludedQuestionId(a.question_id)).map(enrichTopicIds);
  const visibleMistakes = mistakes.filter((m) => !isExcludedQuestionId(m.question_id)).map(enrichTopicIds);
  const real = visibleAttempts.filter(isRealRecord);
  const names = new Map(subjects.map((s) => [s.id, s.name || s.title || s.id]));
  const topicNames = new Map((topics || []).map((t) => [t.id, t.title || t.id]));
  const latest = new Map();
  for (const a of [...real].sort((x, y) => String(x.submitted_at).localeCompare(String(y.submitted_at)))) latest.set(a.question_id, a);

  const subjectRows = [];
  for (const group of registry.subjects || []) {
    const ids = (group.questions || []).filter((id) => !isExcludedQuestionId(id));
    if (!ids.length) continue;
    const completed = ids.filter((id) => latest.get(id)?.grading?.status === "correct").length;
    subjectRows.push({ id: group.id, title: names.get(group.id) || group.id, completed, total: ids.length, url: group.url ? `${base}${group.url}` : "" });
  }

  const byTopic = new Map();
  for (const a of latest.values()) {
    for (const topicId of a.topic_ids || topicIdsForQuestionId(a.question_id)) {
      const row = byTopic.get(topicId) || { id: topicId, title: topicNames.get(topicId) || topicId, completed: 0, total: 0, url: "" };
      row.total += 1;
      if (a.grading?.status === "correct") row.completed += 1;
      if (!row.url && a.page?.url) row.url = pageHref(a.page, base);
      byTopic.set(topicId, row);
    }
  }
  const topicRows = [...byTopic.values()];

  const counts = new Map();
  for (const a of real) {
    if (a.migrated_from) continue;
    const day = localDay(a.submitted_at);
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  const activity = [...counts].sort().map(([date, count]) => ({ date, count }));

  const reviews = visibleMistakes
    .filter((m) => !m.deleted_at && m.status === "active" && m.next_review_at && isRealRecord(m))
    .map((m) => {
      const topicId = (m.topic_ids || [])[0] || topicIdsForQuestionId(m.question_id)[0] || "";
      return {
        id: m.id,
        title: (m.page?.title ? `${m.page.title} · ` : "") + String(m.stem_snapshot || m.question_id).slice(0, 48),
        dueAt: m.next_review_at,
        url: m.page?.url ? pageHref(m.page, base) : `./index.html#/quiz/${encodeURIComponent(m.question_id)}?mode=retry`,
        topicId,
        topicTitle: topicId ? (topicNames.get(topicId) || topicId) : ""
      };
    });

  const visited = [...real].filter((a) => a.page?.url).sort((x, y) => String(y.submitted_at).localeCompare(String(x.submitted_at)));
  const pick = visited.find((a) => !a.migrated_from) || visited[0];
  const lastVisited = pick ? { title: pick.page.title || pick.stem_snapshot, url: pageHref(pick.page, base) } : null;

  return { hasRecords: real.length > 0, today: localDay(now), subjects: subjectRows, topics: topicRows, activity, reviews, lastVisited };
}
