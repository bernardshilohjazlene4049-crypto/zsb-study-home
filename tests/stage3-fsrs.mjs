import assert from "node:assert/strict";
import test from "node:test";
import { createFsrs, RATING } from "../assets/js/features/fsrs.js";
import { REVIEW_SCHEDULER } from "../assets/js/features/review-config.js";
import { initialMistake, mergeMistake, reviewRating, scheduleReview, classifyOutcome } from "../assets/js/features/mistake-rules.js";

const T0 = Date.parse("2026-03-01T08:00:00Z");
const DAY = 86400000;
const wrong = { status: "incorrect" };
const right = { status: "correct" };

test("默认仍用 1/3/7/14 规则", () => {
  assert.equal(REVIEW_SCHEDULER, "heuristic");
  const s = scheduleReview({ grading: wrong, understanding: "still_confused", now: T0 });
  assert.equal(s.rule, "heuristic_1_3_7_14");
  assert.equal(s.interval_days, 1);
  assert.equal("fsrs" in s, false);
});

test("FSRS 新题四档的初始间隔与 ts-fsrs 长期模式一致", () => {
  const f = createFsrs();
  // ts-fsrs 4.7.1，enable_short_term=false，enable_fuzz=false 的结果
  assert.deepEqual([1, 2, 3, 4].map((g) => f.review(null, g, T0).days), [1, 2, 3, 16]);
  const good = f.review(null, RATING.good, T0).state;
  assert.equal(good.stability, 3.173);
  assert.equal(good.reps, 1);
  assert.equal(good.lapses, 0);
});

test("FSRS 连续答对间隔变长，答错后变短并记一次遗忘", () => {
  const f = createFsrs();
  let { state, days } = f.review(null, "good", T0);
  let now = T0;
  const gaps = [days];
  for (let i = 0; i < 3; i++) {
    now += days * DAY;
    ({ state, days } = f.review(state, "good", now));
    gaps.push(days);
  }
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] > gaps[i - 1], `间隔应递增：${gaps}`);
  now += days * DAY;
  const lapse = f.review(state, "again", now);
  assert.ok(lapse.days < days);
  assert.equal(lapse.state.lapses, 1);
  assert.ok(lapse.state.stability <= state.stability);
});

test("作答结果到 FSRS 评分的映射", () => {
  assert.equal(reviewRating({ grading: wrong, understanding: "mastered" }), "again");
  assert.equal(reviewRating({ grading: { status: "unanswered" } }), "again");
  assert.equal(reviewRating({ grading: right, understanding: "still_confused" }), "again");
  assert.equal(reviewRating({ grading: right, understanding: "mastered", guessed: true }), "hard");
  assert.equal(reviewRating({ grading: { status: "pending" }, understanding: "not_understood" }), "hard");
  assert.equal(reviewRating({ grading: right, understanding: "mastered" }), "good");
});

test("开关切到 fsrs 时状态写进错题档案并在下次作答时延续", () => {
  const attempt = { id: "att-1", question_id: "q1", learner_id: "me", subject_id: "s", topic_ids: [], response: {}, grading: wrong, understanding: "still_confused", provenance: { kind: "page" }, counts_toward_real_stats: true, stem_snapshot: "", answer_snapshot: null };
  const s1 = scheduleReview({ grading: wrong, understanding: "still_confused", now: T0, scheduler: "fsrs" });
  assert.equal(s1.rule, "fsrs_5");
  const m1 = initialMistake(attempt, classifyOutcome({ grading: wrong, understanding: "still_confused" }), s1, "m1", new Date(T0).toISOString());
  assert.deepEqual(m1.fsrs, s1.fsrs);
  const t2 = T0 + s1.interval_days * DAY;
  const s2 = scheduleReview({ grading: right, understanding: "mastered", now: t2, previous: m1, scheduler: "fsrs" });
  assert.equal(s2.fsrs.reps, 2);
  const m2 = mergeMistake(m1, initialMistake({ ...attempt, id: "att-2" }, { entersReview: false, category: null }, s2, "m1", new Date(t2).toISOString()));
  assert.equal(m2.fsrs.reps, 2);
  assert.equal(m2.next_review_at, s2.next_review_at);
});

test("切回 heuristic 不受已有 FSRS 状态影响（可回滚）", () => {
  const prev = { interval_step: 1, fsrs: { stability: 30, difficulty: 5, last_review: new Date(T0).toISOString(), reps: 4, lapses: 0 } };
  const s = scheduleReview({ grading: right, understanding: "mastered", previousStep: prev.interval_step, previous: prev, now: T0, scheduler: "heuristic" });
  assert.equal(s.rule, "heuristic_1_3_7_14");
  assert.equal(s.interval_days, 7);
});
