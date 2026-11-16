const REVIEWABLE_STATES = new Set(["needs_review", "independent_once", "prompted_correct"]);

function baseProgress(prev, { topicId, learnerId, now, source }) {
  return {
    ...(prev || {}),
    id: prev?.id || `prog:${learnerId}:${topicId}`,
    schema_version: 1,
    topic_id: topicId,
    learner_id: learnerId,
    evidence_attempt_ids: [...(prev?.evidence_attempt_ids || [])],
    independent_correct_count: prev?.independent_correct_count || 0,
    mastery_state: REVIEWABLE_STATES.has(prev?.mastery_state) ? prev.mastery_state : "studied",
    next_review_at: prev?.next_review_at || null,
    created_at: prev?.created_at || now,
    updated_at: now,
    source: prev?.source || source,
    counts_toward_real_stats: true
  };
}

export function markTopicStudied(prev, { topicId, learnerId, now, source = "classroom-note" }) {
  return {
    ...baseProgress(prev, { topicId, learnerId, now, source }),
    note: "在课堂笔记中手动标记已阅读；具体掌握程度仍由后续练习与复习记录判断。"
  };
}

export function scheduleTopicReview(prev, { topicId, learnerId, now, days = 3, source = "classroom-note" }) {
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error("复习间隔必须是 1–30 天。");
  return {
    ...baseProgress(prev, { topicId, learnerId, now, source }),
    next_review_at: new Date(Date.parse(now) + days * 86400000).toISOString(),
    note: `在课堂笔记中手动安排 ${days} 天后的知识点复习。`
  };
}
