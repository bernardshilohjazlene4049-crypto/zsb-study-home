import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  PAGE_PROVENANCE,
  buildOverviewSnapshot,
  choiceOutcome,
  migrateChoiceMap,
  migrationAttemptId,
  normalizePagePayload,
  pageQuestionId,
  ratingOutcome
} from "../assets/js/features/page-attempts.js";
import { buildAttempt, classifyOutcome, initialMistake, mergeMistake, scheduleReview } from "../assets/js/features/mistake-rules.js";
import { splitAttempts } from "../assets/js/features/grading.js";
import { buildRegistry, listHtml } from "../.github/scripts/page-questions.mjs";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const page = { url: "yy/yy5.html", title: "英语", anchor: "topic-4" };

function attemptFrom(payload, id, iso) {
  return buildAttempt({
    question: { id: payload.questionId, subject_id: payload.subjectId, topic_ids: [], type: payload.type, stem: payload.stem, answer: payload.answer, provenance: { ...PAGE_PROVENANCE } },
    response: payload.response,
    grading: payload.grading,
    understanding: payload.understanding,
    learnerId: "local-guest",
    id,
    now: iso,
    page: payload.page,
    migratedFrom: payload.migratedFrom
  });
}

test("题目 ID 统一为 page:<页>:<题>，非法字符替换", () => {
  assert.equal(pageQuestionId("yy5", "4-1"), "page:yy5:4-1");
  assert.equal(pageQuestionId("gs45", "37/4"), "page:gs45:37-4");
  assert.throws(() => pageQuestionId("", "1"));
  assert.throws(() => normalizePagePayload({ questionId: "q_x", rating: "good" }));
});

test("选择题：答错进错题本，答对不进", () => {
  const wrong = choiceOutcome("A", "B");
  assert.equal(wrong.grading.status, "incorrect");
  assert.deepEqual(classifyOutcome({ ...wrong, guessed: false }), { entersReview: true, category: "wrong" });
  const right = choiceOutcome("B", "B");
  assert.equal(classifyOutcome({ ...right, guessed: false }).entersReview, false);
});

test("自评三档沿用 mistake-rules 的复习间隔", () => {
  const good = ratingOutcome("good");
  const fuzzy = ratingOutcome("fuzzy");
  const again = ratingOutcome("again");
  assert.equal(classifyOutcome({ ...good }).entersReview, false);
  assert.equal(classifyOutcome({ ...fuzzy }).category, "not_understood");
  assert.equal(classifyOutcome({ ...again }).category, "wrong");
  assert.equal(scheduleReview({ ...again, now: NOW }).interval_days, 1);
  assert.equal(scheduleReview({ ...fuzzy, now: NOW }).interval_days, 1);
  assert.equal(scheduleReview({ ...good, previousStep: 0, now: NOW }).interval_days, 3);
  assert.equal(scheduleReview({ ...good, previousStep: 1, now: NOW }).interval_days, 7);
  assert.throws(() => ratingOutcome("maybe"));
});

test("正文页作答计入真实记录，并把出处带进错题档案", () => {
  const payload = normalizePagePayload({ questionId: "page:yy5:4-1", subjectId: "english", stem: " The  nurse ", choice: "A", correct: "B", page });
  const attempt = attemptFrom(payload, "att_1", new Date(NOW).toISOString());
  assert.equal(attempt.counts_toward_real_stats, true);
  assert.equal(attempt.stem_snapshot, "The nurse");
  assert.deepEqual(attempt.page, page);
  assert.equal(splitAttempts([attempt]).real.length, 1);
  const decision = classifyOutcome({ grading: attempt.grading, understanding: attempt.understanding });
  const schedule = scheduleReview({ grading: attempt.grading, understanding: attempt.understanding, now: NOW });
  const mistake = initialMistake(attempt, decision, schedule, "mst:local-guest:page:yy5:4-1", attempt.submitted_at);
  assert.equal(mistake.status, "active");
  assert.deepEqual(mistake.page, page);
  assert.deepEqual(mergeMistake(mistake, { ...mistake, page: undefined, attempt_ids: ["att_2"] }).page, page);
});

test("迁移 yy5 旧记录：只取 A–D，幂等键确定", () => {
  const questions = [
    { itemKey: "4-1", questionId: "page:yy5:4-1", subjectId: "english", correct: "B", stem: "q1", page },
    { itemKey: "4-2", questionId: "page:yy5:4-2", subjectId: "english", correct: "C", stem: "q2", page },
    { itemKey: "4-3", questionId: "page:yy5:4-3", subjectId: "english", correct: "A", stem: "q3", page }
  ];
  const saved = { "4-1": "B", "4-2": "A", "4-3": "Z", "9-9": "A" };
  const first = migrateChoiceMap("liaoning.yy5.quiz.2026", saved, questions);
  const again = migrateChoiceMap("liaoning.yy5.quiz.2026", saved, questions);
  assert.equal(first.length, 2);
  assert.deepEqual(first.map((p) => p.attemptId), again.map((p) => p.attemptId));
  assert.equal(first[0].attemptId, migrationAttemptId("liaoning.yy5.quiz.2026", "page:yy5:4-1", "B"));
  assert.notEqual(first[0].attemptId, first[1].attemptId);
  assert.equal(first[1].grading.status, "incorrect");
  assert.equal(first[0].migratedFrom, "liaoning.yy5.quiz.2026");
  assert.deepEqual(migrateChoiceMap("k", null, questions), []);
});

test("学习总览：无记录时不出统计", () => {
  const snap = buildOverviewSnapshot({ registry: { subjects: [{ id: "english", url: "yy/yy5.html", questions: ["page:yy5:4-1"] }] }, now: new Date(NOW) });
  assert.equal(snap.hasRecords, false);
  assert.deepEqual(snap.activity, []);
  assert.deepEqual(snap.reviews, []);
  assert.equal(snap.lastVisited, null);
});

test("学习总览：迁移记录不算当日活跃；示例记录不计入", () => {
  const iso = new Date(NOW).toISOString();
  const migrated = attemptFrom(normalizePagePayload({ questionId: "page:yy5:4-1", subjectId: "english", choice: "B", correct: "B", page, migratedFrom: "k", attemptId: "att_mig_1" }), "att_mig_1", iso);
  const live = attemptFrom(normalizePagePayload({ questionId: "page:yy5:4-2", subjectId: "english", choice: "A", correct: "C", page }), "att_2", iso);
  const sample = { ...live, id: "att_s", provenance: { kind: "sample" }, counts_toward_real_stats: false };
  const decision = classifyOutcome({ grading: live.grading, understanding: live.understanding });
  const schedule = scheduleReview({ grading: live.grading, understanding: live.understanding, now: NOW - 2 * 86400000 });
  const mistake = initialMistake(live, decision, schedule, "mst:local-guest:page:yy5:4-2", iso);
  const snap = buildOverviewSnapshot({
    attempts: [migrated, live, sample],
    mistakes: [mistake],
    registry: { subjects: [{ id: "english", url: "yy/yy5.html", questions: ["page:yy5:4-1", "page:yy5:4-2", "page:yy5:4-3"] }] },
    subjects: [{ id: "english", name: "英语" }],
    now: new Date(NOW)
  });
  assert.equal(snap.hasRecords, true);
  assert.deepEqual(snap.subjects, [{ id: "english", title: "英语", completed: 1, total: 3, url: "../yy/yy5.html" }]);
  assert.equal(snap.activity.reduce((n, d) => n + d.count, 0), 1);
  assert.equal(snap.reviews.length, 1);
  assert.equal(snap.reviews[0].url, "../yy/yy5.html#topic-4");
  assert.equal(snap.lastVisited.url, "../yy/yy5.html#topic-4");
});

test("data/page-questions.json 与正文页一致", () => {
  const expected = buildRegistry(listHtml());
  const actual = JSON.parse(readFileSync("data/page-questions.json", "utf8"));
  assert.deepEqual(actual, expected);
  const english = actual.subjects.find((s) => s.id === "english");
  assert.equal(english.questions.length, 50);
});
