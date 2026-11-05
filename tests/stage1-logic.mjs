import assert from "node:assert/strict";
import test from "node:test";
import { gradeQuestion, splitAttempts, accuracyOf } from "../assets/js/features/grading.js";
import {
  buildAttempt,
  classifyOutcome,
  initialMistake,
  mergeMistake,
  nextProgress,
  scheduleReview
} from "../assets/js/features/mistake-rules.js";
import { partitionById, validateBundle } from "../assets/js/core/backup.js";
import { publicAnchor } from "../assets/js/features/catalog.js";

const sampleQuestion = {
  id: "q_sample_math_domain_001",
  subject_id: "math",
  topic_ids: ["math.domain"],
  type: "single_choice",
  stem: "示例",
  options: [{ id: "A", text: "a" }, { id: "D", text: "d" }],
  answer: { option_ids: ["D"] },
  provenance: { kind: "sample", verified: false },
  revision: 1
};

test("single choice grades without leaking through status", () => {
  assert.equal(gradeQuestion(sampleQuestion, { option_ids: [] }).status, "unanswered");
  assert.equal(gradeQuestion(sampleQuestion, { option_ids: ["A"] }).status, "incorrect");
  assert.equal(gradeQuestion(sampleQuestion, { option_ids: ["D"] }).status, "correct");
});

test("multiple choice requires the full set", () => {
  const question = {
    type: "multiple_choice",
    answer: { option_ids: ["A", "B", "D"] }
  };
  assert.equal(gradeQuestion(question, { option_ids: ["D", "A", "B"] }).status, "correct");
  assert.equal(gradeQuestion(question, { option_ids: ["A", "B"] }).status, "incorrect");
});

test("fill blank accepts the documented variants", () => {
  const question = { type: "fill_blank", answer: { accepted: [">=0", "≥0", "大于等于0", "非负"] } };
  assert.equal(gradeQuestion(question, { text: " ≥ 0 " }).status, "correct");
  assert.equal(gradeQuestion(question, { text: ">0" }).status, "incorrect");
});

test("short answer stays pending", () => {
  const question = { type: "short_answer", answer: { reference_points: ["交集"] } };
  assert.equal(gradeQuestion(question, { text: "因为都要满足" }).status, "pending");
  assert.equal(gradeQuestion(question, { text: "因为都要满足" }).auto, false);
});

test("correct but not understood enters review and does not erase the first wrong attempt", () => {
  const now = "2026-11-05T00:00:00.000Z";
  const wrong = buildAttempt({
    question: sampleQuestion,
    response: { option_ids: ["A"] },
    grading: { status: "incorrect", auto: true, score: 0 },
    understanding: "want_steps",
    learnerId: "local-guest",
    id: "att_first",
    now
  });
  const decision = classifyOutcome({ grading: wrong.grading, understanding: wrong.understanding, guessed: false });
  assert.equal(decision.category, "wrong");
  const schedule = scheduleReview({ grading: wrong.grading, understanding: wrong.understanding, now: Date.parse(now) });
  const mistake = initialMistake(wrong, decision, schedule, "mst:local-guest:q", now);
  const again = buildAttempt({
    question: sampleQuestion,
    response: { option_ids: ["D"] },
    grading: { status: "correct", auto: true, score: 1 },
    understanding: "not_understood",
    learnerId: "local-guest",
    id: "att_second",
    now: "2026-11-05T01:00:00.000Z"
  });
  const againDecision = classifyOutcome({ grading: again.grading, understanding: again.understanding, guessed: false });
  assert.equal(againDecision.category, "not_understood");
  const patch = initialMistake(again, againDecision, scheduleReview({
    grading: again.grading,
    understanding: again.understanding,
    previousStep: mistake.interval_step,
    now: Date.parse("2026-11-05T01:00:00.000Z")
  }), mistake.id, "2026-11-05T01:00:00.000Z");
  const merged = mergeMistake(mistake, patch);
  assert.equal(merged.first_attempt_id, "att_first");
  assert.deepEqual(merged.first_response.option_ids, ["A"]);
  assert.deepEqual(merged.attempt_ids, ["att_first", "att_second"]);
  assert.equal(merged.id, mistake.id);
});

test("a correct guess is not counted as an independent success", () => {
  const attempt = buildAttempt({
    question: sampleQuestion,
    response: { option_ids: ["D"] },
    grading: { status: "correct", auto: true, score: 1 },
    understanding: "not_understood",
    guessed: true,
    learnerId: "local-guest",
    id: "att_guess",
    now: "2026-11-05T00:00:00.000Z"
  });
  const decision = classifyOutcome({ grading: attempt.grading, understanding: attempt.understanding, guessed: attempt.guessed });
  assert.equal(decision.category, "guessed");
  const progress = nextProgress(null, attempt, decision, "math.domain");
  assert.equal(progress.mastery_state, "needs_review");
  assert.equal(progress.independent_correct_count, 0);
});

test("sample attempts stay out of real accuracy", () => {
  const attempt = buildAttempt({
    question: sampleQuestion,
    response: { option_ids: ["D"] },
    grading: { status: "correct", auto: true, score: 1 },
    understanding: "mastered",
    learnerId: "local-guest",
    id: "att_sample",
    now: "2026-11-05T00:00:00.000Z"
  });
  const split = splitAttempts([attempt]);
  assert.equal(split.sample.length, 1);
  assert.equal(split.real.length, 0);
  assert.equal(accuracyOf(split.real).rate, null);
});

test("import skips duplicate attempt ids", () => {
  const { accept, skip } = partitionById(["att_1"], [{ id: "att_1" }, { id: "att_2" }, {}]);
  assert.equal(accept.length, 1);
  assert.equal(accept[0].id, "att_2");
  assert.equal(skip.length, 2);
});

test("newer backup versions are rejected", () => {
  assert.throws(() => validateBundle({ schema_version: 99, stores: {} }), /更新的数据版本/);
});

test("unverified anchors do not keep a timestamp", () => {
  const anchor = publicAnchor({ id: "a", resource_id: "r", topic_id: "t", verified: false, start_sec: 204, note: "暂无定位" });
  assert.equal(anchor.located, false);
  assert.equal(anchor.start_sec, null);
});
