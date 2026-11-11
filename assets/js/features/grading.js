export function normalizeAnswer(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/≥/g, ">=")
    .replace(/＞/g, ">")
    .replace(/＝/g, "=");
}

export function gradeQuestion(question, response) {
  const type = question?.type;
  const text = String(response?.text || "").trim();
  const optionIds = [...(response?.option_ids || [])];

  if (type === "short_answer" || type === "code_reading" || type === "step") {
    if (!text) return { status: "unanswered", auto: false, score: null };
    return { status: "pending", auto: false, score: null };
  }

  if (type === "fill_blank") {
    if (!text) return { status: "unanswered", auto: true, score: 0 };
    const accepted = (question.answer?.accepted || []).map(normalizeAnswer);
    const ok = accepted.includes(normalizeAnswer(text));
    return { status: ok ? "correct" : "incorrect", auto: true, score: ok ? 1 : 0 };
  }

  if (type === "single_choice" || type === "true_false") {
    if (optionIds.length !== 1) return { status: "unanswered", auto: true, score: 0 };
    const expected = question.answer?.option_ids || [];
    const ok = expected.length === 1 && expected[0] === optionIds[0];
    return { status: ok ? "correct" : "incorrect", auto: true, score: ok ? 1 : 0 };
  }

  if (type === "multiple_choice") {
    if (!optionIds.length) return { status: "unanswered", auto: true, score: 0 };
    const picked = [...optionIds].sort();
    const expected = [...(question.answer?.option_ids || [])].sort();
    const ok = picked.length === expected.length && picked.every((id, index) => id === expected[index]);
    return { status: ok ? "correct" : "incorrect", auto: true, score: ok ? 1 : 0 };
  }

  if (!text && !optionIds.length) return { status: "unanswered", auto: false, score: null };
  return { status: "pending", auto: false, score: null };
}

export function countsAsSample(record) {
  return record?.provenance?.kind === "sample" || record?.counts_toward_real_stats === false && record?.provenance?.kind === "sample";
}

export function splitAttempts(attempts) {
  const real = [];
  const sample = [];
  const other = [];
  for (const attempt of attempts || []) {
    const kind = attempt?.provenance?.kind;
    if (kind === "sample") sample.push(attempt);
    else if ((kind === "verified" || kind === "page") && attempt.counts_toward_real_stats !== false) real.push(attempt);
    else other.push(attempt);
  }
  return { real, sample, other };
}

export function accuracyOf(attempts) {
  const graded = (attempts || []).filter((attempt) => attempt.grading?.auto && (attempt.grading.status === "correct" || attempt.grading.status === "incorrect"));
  const correct = graded.filter((attempt) => attempt.grading.status === "correct").length;
  return {
    correct,
    graded: graded.length,
    rate: graded.length ? correct / graded.length : null
  };
}
