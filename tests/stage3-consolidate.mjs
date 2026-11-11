import assert from "node:assert/strict";
import test from "node:test";
import { CONSOLIDATE, FIRST_CONSOLIDATION_STEP, classifyOutcome, consolidationOutcome, isMistakeRecord, scheduleReview } from "../assets/js/features/mistake-rules.js";
import { buildOverviewSnapshot } from "../assets/js/features/page-attempts.js";

const T0 = Date.parse("2026-03-01T08:00:00Z");
const right = { status: "correct" };

test("新题答「会」安排 7 天后的巩固复习，不算错题", () => {
  const decision = classifyOutcome({ grading: right, understanding: "mastered", guessed: false });
  assert.equal(decision.entersReview, false);
  const schedule = scheduleReview({ grading: right, understanding: "mastered", previousStep: FIRST_CONSOLIDATION_STEP, now: T0 });
  assert.equal(schedule.interval_days, 7);
  const entry = consolidationOutcome({ existing: null, schedule });
  assert.deepEqual(entry, { entersReview: true, category: CONSOLIDATE });
  assert.equal(isMistakeRecord({ category: CONSOLIDATE }), false);
  assert.equal(isMistakeRecord({ category: "wrong" }), true);
  assert.equal(isMistakeRecord({ category: "wrong", deleted_at: "x" }), false);
});

test("已有错题答「会」继续顺延，14 天那一档之后才转为暂歇", () => {
  const mid = { interval_step: 1, category: "wrong" };
  const s1 = scheduleReview({ grading: right, understanding: "mastered", previousStep: 1, now: T0 });
  assert.deepEqual(consolidationOutcome({ existing: mid, schedule: s1 }), { entersReview: true, category: null });
  const last = { interval_step: 3, category: "wrong" };
  const s2 = scheduleReview({ grading: right, understanding: "mastered", previousStep: 3, now: T0 });
  assert.equal(consolidationOutcome({ existing: last, schedule: s2 }).entersReview, false);
});

test("巩固复习到期后出现在学习总览的复习列表", () => {
  const due = new Date(T0 - 86400000).toISOString();
  const snap = buildOverviewSnapshot({
    attempts: [],
    mistakes: [{ id: "m", question_id: "page:x:1", status: "active", category: CONSOLIDATE, next_review_at: due, counts_toward_real_stats: true, provenance: { kind: "page" }, stem_snapshot: "题", page: { url: "gs/gs1.html", title: "第一章" } }],
    now: new Date(T0)
  });
  assert.equal(snap.reviews.length, 1);
});
