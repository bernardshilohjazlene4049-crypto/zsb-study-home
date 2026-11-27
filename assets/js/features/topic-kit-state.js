import { LEARNER_ID } from "../core/schema.js";

// Read-only view over the same zsb-study v1 stores used by D page attempts.
export async function readTopicKitStates(entries, { learnerId = LEARNER_ID, readAll } = {}) {
  const loadAll = readAll || (await import("../core/storage.js")).getAll;
  const [progressRows, attempts] = await Promise.all([
    loadAll("user_topic_progress"),
    loadAll("attempts")
  ]);
  const topicIds = new Set((entries || []).map((entry) => entry.topicId));
  const questionIds = new Set((entries || []).map((entry) => entry.questionId));
  const progressByTopic = new Map();
  for (const row of progressRows || []) {
    if (row.learner_id === learnerId && topicIds.has(row.topic_id)) progressByTopic.set(row.topic_id, row);
  }
  const latestByQuestion = new Map();
  for (const attempt of attempts || []) {
    if (attempt.learner_id !== learnerId || !questionIds.has(attempt.question_id)) continue;
    const previous = latestByQuestion.get(attempt.question_id);
    if (!previous || String(attempt.submitted_at || "") > String(previous.submitted_at || "")) {
      latestByQuestion.set(attempt.question_id, attempt);
    }
  }
  return (entries || []).map((entry) => ({
    topicId: entry.topicId,
    questionId: entry.questionId,
    progress: progressByTopic.get(entry.topicId) || null,
    latestAttempt: latestByQuestion.get(entry.questionId) || null
  }));
}

export function describeTopicKitStatus(state = {}) {
  const rating = state.latestAttempt?.response?.rating || state.latestAttempt?.rating || "";
  const ratingLabels = { good: "会了", fuzzy: "模糊", again: "不会" };
  if (ratingLabels[rating]) return ratingLabels[rating];

  const mastery = String(state.progress?.mastery_state || "").toLowerCase();
  if (["mastered", "mastery", "completed"].includes(mastery)) return "会了";
  if (["not_understood", "fuzzy"].includes(mastery)) return "模糊";
  if (["still_confused", "again"].includes(mastery)) return "不会";
  if (state.progress || state.latestAttempt) return "已有记录";
  return "未打卡";
}

export function topicKitStatusDetail(state = {}) {
  const next = state.progress?.next_review_at;
  if (next) return `下次复习：${String(next).slice(0, 10)}`;
  const submitted = state.latestAttempt?.submitted_at;
  if (submitted) return `最近记录：${String(submitted).slice(0, 10)}`;
  return "";
}
