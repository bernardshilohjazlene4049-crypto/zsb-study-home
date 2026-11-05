import { loadRawCatalog, createCatalog } from "./features/catalog.js";
import { commitSubmission } from "./features/records.js";
import { gradeQuestion } from "./features/grading.js";
import { ensureSchema } from "./core/storage.js";

export async function recordExternalAttempt(payload = {}) {
  const questionId = payload.questionId || payload.question_id;
  if (!questionId) throw new Error("recordAttempt 需要 questionId。");
  const schema = await ensureSchema();
  if (!schema.ok || schema.readOnly) throw new Error(schema.message || "本机数据库现在不能写入。");
  const raw = await loadRawCatalog();
  const catalog = createCatalog(raw, []);
  const known = catalog.question(questionId);
  const question = known || {
    id: questionId,
    subject_id: payload.subjectId || payload.subject_id || null,
    topic_ids: payload.topicIds || payload.topic_ids || [],
    type: payload.type || "short_answer",
    stem: payload.stem || "",
    answer: payload.answer || null,
    revision: payload.revision || 1,
    provenance: { kind: payload.provenanceKind || "external_bridge", verified: false },
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
    source: "study-bridge"
  });
}
