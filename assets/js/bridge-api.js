import { loadRawCatalog, createCatalog } from "./features/catalog.js";
import { commitSubmission } from "./features/records.js";
import { gradeQuestion } from "./features/grading.js";
import { ensureSchema, get, getAll, put } from "./core/storage.js";
import { PAGE_PROVENANCE, normalizePagePayload } from "./features/page-attempts.js";
import { isExcludedQuestionId, topicIdsForQuestionId } from "./features/topic-index.js";

export async function recordExternalAttempt(payload = {}) {
  const questionId = payload.questionId || payload.question_id;
  if (!questionId) throw new Error("recordAttempt 需要 questionId。");
  if (isExcludedQuestionId(questionId)) return { skipped: true, reason: "excluded" };
  const schema = await ensureSchema();
  if (!schema.ok || schema.readOnly) throw new Error(schema.message || "本机数据库现在不能写入。");
  const raw = await loadRawCatalog();
  const catalog = createCatalog(raw, []);
  const known = catalog.question(questionId);
  const question = known || {
    id: questionId,
    subject_id: payload.subjectId || payload.subject_id || null,
    topic_ids: (payload.topicIds || payload.topic_ids || []).length ? (payload.topicIds || payload.topic_ids) : topicIdsForQuestionId(questionId),
    type: payload.type || "short_answer",
    stem: payload.stem || "",
    answer: payload.answer || null,
    revision: payload.revision || 1,
    provenance: payload.provenanceKind === "page" ? { ...PAGE_PROVENANCE } : { kind: payload.provenanceKind || "external_bridge", verified: false },
    source: "study-bridge"
  };
  const response = payload.response || { option_ids: payload.optionIds || [], text: payload.text || "" };
  const grading = payload.grading || gradeQuestion(question, response);
  return commitSubmission({
    question,
    response,
    grading,
    understanding: payload.understanding || "still_confused",
    guessed: Boolean(payload.guessed),
    helpLevel: payload.helpLevel || payload.help_level || "none",
    elapsedMs: payload.elapsedMs ?? null,
    source: "study-bridge",
    attemptId: payload.attemptId || null,
    page: payload.page || null,
    migratedFrom: payload.migratedFrom || null
  });
}

// 正文页作答：rating（会/模糊/不会）或 choice（选择题）。
export function recordPageAttempt(input = {}) {
  return recordExternalAttempt(normalizePagePayload(input));
}

export async function migrationDone(storageKey) {
  const schema = await ensureSchema();
  if (!schema.ok) return true;
  return Boolean(await get("meta", `migration:${storageKey}`));
}

// 把旧 localStorage 记录导入同一 IndexedDB。原记录保留不删；每条有确定的幂等键，重复运行不重复写。
export async function migratePageRecords(storageKey, payloads = []) {
  const flagId = `migration:${storageKey}`;
  const schema = await ensureSchema();
  if (!schema.ok || schema.readOnly) return { written: 0, skipped: payloads.length };
  let written = 0;
  let skipped = 0;
  for (const payload of payloads) {
    const result = await recordExternalAttempt(payload);
    if (result.duplicate || result.skipped) skipped += 1;
    else written += 1;
  }
  const prev = await get("meta", flagId);
  await put("meta", { key: flagId, value: { last_run_at: new Date().toISOString(), seen: payloads.length, written: (prev?.value?.written || 0) + written } });
  return { written, skipped };
}

// 某道正文页题目的作答历史与错题档案（按时间升序）。
export async function pageQuestionHistory(questionId) {
  const schema = await ensureSchema();
  if (!schema.ok) throw new Error(schema.message || "本机数据库不可用");
  const attempts = (await getAll("attempts"))
    .filter((a) => a.question_id === questionId)
    .sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)));
  const mistake = (await getAll("mistake_entries")).find((m) => m.question_id === questionId && !m.deleted_at) || null;
  return { attempts, mistake };
}
