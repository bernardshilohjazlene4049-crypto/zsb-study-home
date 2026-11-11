import { LEARNER_ID } from "../core/schema.js";
import { createId, draftId, markId, mistakeId, playbackId, progressId } from "../core/ids.js";
import { get, getAll, put, remove } from "../core/storage.js";
import { bus } from "../core/events.js";
import {
  applyReasonTags,
  buildAttempt,
  classifyOutcome,
  initialMistake,
  mergeMistake,
  nextProgress,
  scheduleReview
} from "./mistake-rules.js";

export async function loadLearningState() {
  const [attempts, mistakes, notes, progress, marks, reviews] = await Promise.all([
    getAll("attempts"),
    getAll("mistake_entries"),
    getAll("note_entries"),
    getAll("user_topic_progress"),
    getAll("marks"),
    getAll("review_events")
  ]);
  return { attempts, mistakes, notes, progress, marks, reviews };
}

export async function commitSubmission({
  question,
  response,
  grading,
  understanding,
  guessed = false,
  helpLevel = "none",
  elapsedMs = null,
  reasonTags = [],
  learnerId = LEARNER_ID,
  source,
  attemptId = null,
  page = null,
  migratedFrom = null
}) {
  const now = new Date().toISOString();
  if (attemptId) {
    const seen = await get("attempts", attemptId);
    if (seen) return { attempt: seen, mistake: null, decision: null, progress: [], duplicate: true };
  }
  const attempt = buildAttempt({
    question,
    response,
    grading,
    understanding,
    guessed,
    helpLevel,
    elapsedMs,
    learnerId,
    id: attemptId || createId("att"),
    now,
    source,
    page,
    migratedFrom
  });
  const duplicate = await get("attempts", attempt.id);
  if (duplicate) throw new Error("这次提交的编号已存在，没有覆盖旧记录。");
  await put("attempts", attempt);

  const decision = classifyOutcome({
    grading,
    understanding,
    guessed: attempt.guessed
  });
  const allMistakes = await getAll("mistake_entries");
  const existingMistake = allMistakes.find((item) => item.learner_id === learnerId && item.question_id === question.id && !item.deleted_at) || null;
  let mistake = existingMistake;
  if (decision.entersReview || existingMistake) {
    const schedule = scheduleReview({
      grading,
      understanding,
      previousStep: existingMistake?.interval_step || 0,
      now: Date.parse(now)
    });
    decision.schedule = schedule;
    const patch = initialMistake(
      attempt,
      decision,
      schedule,
      existingMistake?.id || mistakeId(learnerId, question.id),
      now
    );
    if (reasonTags.length) patch.reason_tags = reasonTags;
    mistake = mergeMistake(existingMistake, patch);
    await put("mistake_entries", mistake);
    await put("review_events", {
      id: createId("rev"),
      schema_version: 1,
      mistake_id: mistake.id,
      attempt_id: attempt.id,
      outcome: `${grading.status}:${understanding}`,
      category: decision.category,
      reviewed_at: now,
      next_review_at: mistake.next_review_at,
      created_at: now,
      source: "local"
    });
  }

  const progress = [];
  const topicIds = attempt.topic_ids.length ? attempt.topic_ids : [];
  for (const topicId of topicIds) {
    const id = progressId(learnerId, topicId);
    const prev = await get("user_topic_progress", id);
    const next = nextProgress(prev, attempt, decision, topicId);
    next.id = id;
    await put("user_topic_progress", next);
    progress.push(next);
  }
  await remove("drafts", draftId(learnerId, question.id));
  bus.emit("attempt:committed", { attempt, mistake, decision });
  return { attempt, mistake, decision, progress };
}

export async function updateMistakeTags(mistakeIdValue, reasonTags) {
  const current = await get("mistake_entries", mistakeIdValue);
  if (!current) throw new Error("找不到这条错题档案。");
  const next = applyReasonTags(current, reasonTags, new Date().toISOString());
  await put("mistake_entries", next);
  return next;
}

export async function getDraft(questionId, learnerId = LEARNER_ID) {
  return get("drafts", draftId(learnerId, questionId));
}

export async function saveDraft(questionId, response, learnerId = LEARNER_ID) {
  const now = new Date().toISOString();
  const id = draftId(learnerId, questionId);
  const prev = await get("drafts", id);
  return put("drafts", {
    id,
    schema_version: 1,
    question_id: questionId,
    learner_id: learnerId,
    response,
    created_at: prev?.created_at || now,
    updated_at: now
  });
}

export async function saveNote({ topicId, title, body, learnerId = LEARNER_ID }) {
  const now = new Date().toISOString();
  const id = `note:${learnerId}:${topicId}`;
  const prev = await get("note_entries", id);
  return put("note_entries", {
    id,
    schema_version: 1,
    learner_id: learnerId,
    topic_ids: [topicId],
    title: title || "笔记",
    body,
    attachments: [],
    visibility: "local",
    created_at: prev?.created_at || now,
    updated_at: now,
    source: "local"
  });
}

export async function savePlayback(resourceId, currentTime, playbackRate, learnerId = LEARNER_ID) {
  return put("playback", {
    id: playbackId(learnerId, resourceId),
    schema_version: 1,
    resource_id: resourceId,
    learner_id: learnerId,
    current_time: currentTime,
    playback_rate: playbackRate,
    updated_at: new Date().toISOString()
  });
}

export async function readPlayback(resourceId, learnerId = LEARNER_ID) {
  return get("playback", playbackId(learnerId, resourceId));
}

export async function toggleMark(questionId, learnerId = LEARNER_ID) {
  const id = markId(learnerId, questionId);
  const current = await get("marks", id);
  const next = {
    id,
    schema_version: 1,
    question_id: questionId,
    learner_id: learnerId,
    starred: !current?.starred,
    updated_at: new Date().toISOString()
  };
  await put("marks", next);
  return next;
}

export function attemptSummaries(attempts, questionId) {
  return (attempts || [])
    .filter((attempt) => attempt.question_id === questionId)
    .sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)))
    .map((attempt) => ({
      id: attempt.id,
      submitted_at: attempt.submitted_at,
      status: attempt.grading?.status,
      understanding: attempt.understanding,
      help_level: attempt.help_level
    }));
}
