const STEPS = [1, 3, 7, 14];

export const UNDERSTANDING = [
  { id: "mastered", label: "会了", detail: "我独立会做，理解了" },
  { id: "not_understood", label: "答对但不理解", detail: "答对了，但还说不清为什么" },
  { id: "want_steps", label: "不会想一步步学", detail: "我不会，想一步步学" },
  { id: "still_confused", label: "看过仍不懂", detail: "我看过讲解仍然没理解" }
];

export const REASON_TAGS = [
  { id: "concept", label: "概念不清" },
  { id: "method", label: "方法不会" },
  { id: "calc", label: "计算失误" },
  { id: "reading", label: "审题错误" },
  { id: "memory", label: "记忆不足" },
  { id: "other", label: "其他" }
];

export function classifyOutcome({ grading, understanding, guessed }) {
  const status = grading?.status;
  if (status === "unanswered") return { entersReview: true, category: "unanswered" };
  if (status === "pending") {
    if (understanding === "mastered") return { entersReview: false, category: null };
    return { entersReview: true, category: "not_understood" };
  }
  if (status === "incorrect") return { entersReview: true, category: "wrong" };
  if (status === "correct") {
    if (guessed) return { entersReview: true, category: "guessed" };
    if (understanding === "mastered") return { entersReview: false, category: null };
    return { entersReview: true, category: "not_understood" };
  }
  return { entersReview: true, category: "unanswered" };
}

export function scheduleReview({ grading, understanding, previousStep = 0, now = Date.now() }) {
  let step = 0;
  let days = 1;
  const correctAndClear = grading?.status === "correct" && understanding === "mastered" && !grading?.pending;
  if (correctAndClear) {
    step = Math.min((previousStep || 0) + 1, STEPS.length - 1);
    days = STEPS[step];
  } else if (grading?.status === "pending" && understanding === "mastered") {
    step = previousStep || 0;
    days = STEPS[Math.min(step, STEPS.length - 1)];
  }
  return {
    next_review_at: new Date(now + days * 86400000).toISOString(),
    interval_step: step,
    interval_days: days,
    rule: "heuristic_1_3_7_14"
  };
}

export function buildAttempt({
  question,
  response,
  grading,
  understanding,
  guessed = false,
  helpLevel = "none",
  elapsedMs = null,
  learnerId,
  id,
  now,
  source
}) {
  const provenance = question.provenance || { kind: "unknown", verified: false };
  return {
    id,
    schema_version: 1,
    question_id: question.id,
    question_revision: question.revision || 1,
    learner_id: learnerId,
    response,
    grading,
    understanding,
    guessed: Boolean(guessed) && grading?.status === "correct",
    confidence: guessed && grading?.status === "correct" ? "guessed" : understanding,
    help_level: helpLevel || "none",
    elapsed_ms: elapsedMs,
    provenance,
    counts_toward_real_stats: provenance.kind === "verified",
    stem_snapshot: question.stem || "",
    answer_snapshot: question.answer || null,
    topic_ids: [...(question.topic_ids || [])],
    subject_id: question.subject_id || null,
    submitted_at: now,
    created_at: now,
    source: source || question.source || "local"
  };
}

export function initialMistake(attempt, decision, schedule, id, now) {
  return {
    id,
    schema_version: 1,
    question_id: attempt.question_id,
    learner_id: attempt.learner_id,
    subject_id: attempt.subject_id,
    topic_ids: attempt.topic_ids,
    stem_snapshot: attempt.stem_snapshot,
    answer_snapshot: attempt.answer_snapshot,
    provenance: attempt.provenance,
    counts_toward_real_stats: attempt.counts_toward_real_stats,
    category: decision.category,
    first_category: decision.category,
    reason_tags: [],
    status: decision.entersReview ? "active" : "resting",
    first_attempt_id: attempt.id,
    first_response: attempt.response,
    first_grading: attempt.grading,
    first_understanding: attempt.understanding,
    last_attempt_id: attempt.id,
    attempt_ids: [attempt.id],
    note: "",
    next_review_at: schedule.next_review_at,
    interval_step: schedule.interval_step,
    interval_rule: schedule.rule,
    last_reviewed_at: now,
    created_at: now,
    updated_at: now,
    source: "local",
    alias_ids: [],
    deleted_at: null
  };
}

export function mergeMistake(existing, incoming) {
  if (!existing) return incoming;
  if (existing.deleted_at && !incoming.deleted_at) return existing;
  const attemptIds = [...(existing.attempt_ids || [])];
  for (const id of incoming.attempt_ids || []) {
    if (id && !attemptIds.includes(id)) attemptIds.push(id);
  }
  const alias = new Set([...(existing.alias_ids || []), ...(incoming.alias_ids || [])]);
  if (incoming.id && incoming.id !== existing.id) alias.add(incoming.id);
  return {
    ...existing,
    category: incoming.category || existing.category,
    status: incoming.status || existing.status,
    reason_tags: incoming.reason_tags?.length ? [...incoming.reason_tags] : existing.reason_tags || [],
    note: incoming.note ? incoming.note : existing.note || "",
    last_attempt_id: incoming.last_attempt_id || existing.last_attempt_id,
    attempt_ids: attemptIds,
    next_review_at: incoming.next_review_at || existing.next_review_at,
    interval_step: incoming.interval_step ?? existing.interval_step,
    interval_rule: incoming.interval_rule || existing.interval_rule,
    last_reviewed_at: incoming.last_reviewed_at || existing.last_reviewed_at,
    updated_at: incoming.updated_at || existing.updated_at,
    alias_ids: [...alias],
    id: existing.id,
    question_id: existing.question_id,
    learner_id: existing.learner_id,
    created_at: existing.created_at,
    first_attempt_id: existing.first_attempt_id,
    first_response: existing.first_response,
    first_grading: existing.first_grading,
    first_understanding: existing.first_understanding,
    first_category: existing.first_category,
    stem_snapshot: existing.stem_snapshot,
    provenance: existing.provenance,
    counts_toward_real_stats: existing.counts_toward_real_stats
  };
}

export function nextProgress(prev, attempt, decision, topicId) {
  const evidence = [...(prev?.evidence_attempt_ids || [])];
  if (!evidence.includes(attempt.id)) evidence.push(attempt.id);
  let independent = prev?.independent_correct_count || 0;
  let state = prev?.mastery_state || "practicing";
  const solo = attempt.grading?.status === "correct"
    && attempt.understanding === "mastered"
    && attempt.help_level === "none"
    && !attempt.guessed;
  if (solo) {
    independent += 1;
    state = "independent_once";
  } else if (attempt.grading?.status === "correct" && attempt.help_level === "saw_explanation") {
    state = "prompted_correct";
  } else if (decision.entersReview) {
    state = "needs_review";
  }
  return {
    id: prev?.id || `prog:${attempt.learner_id}:${topicId}`,
    schema_version: 1,
    topic_id: topicId,
    learner_id: attempt.learner_id,
    mastery_state: state,
    evidence_attempt_ids: evidence,
    independent_correct_count: independent,
    next_review_at: decision.schedule?.next_review_at || prev?.next_review_at || null,
    updated_at: attempt.submitted_at,
    created_at: prev?.created_at || attempt.submitted_at,
    source: "derived",
    counts_toward_real_stats: attempt.counts_toward_real_stats,
    note: "一次独立正确只记作证据，不表示已完全掌握。"
  };
}

export function applyReasonTags(mistake, reasonTags, now) {
  return {
    ...mistake,
    reason_tags: [...reasonTags],
    updated_at: now
  };
}
