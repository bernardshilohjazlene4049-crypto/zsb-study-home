import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildOverviewSnapshot, isRealRecord, migrateChoiceMap, enrichTopicIds } from "../assets/js/features/page-attempts.js";
import { mergeMistake, scheduleReview, isMistakeRecord } from "../assets/js/features/mistake-rules.js";
import { SCHEMA_VERSION, DB_VERSION } from "../assets/js/core/schema.js";

// 旧格式样本：FSRS 上线前（66b5078）站点代码真实写入的记录，来源见 fixtures 文件内 _source。
const old = JSON.parse(readFileSync(new URL("./fixtures/legacy-records-66b5078.json", import.meta.url), "utf8"));
const NOW = Date.parse("2026-11-12T15:00:00Z");

test("旧库 schema 版本与当前一致，无需升级迁移", () => {
  const schema = old.meta.find((m) => m.key === "schema");
  assert.equal(schema.schema_version, SCHEMA_VERSION);
  assert.equal(DB_VERSION, 1);
});

test("旧错题记录（无 fsrs 字段、heuristic 规则）仍被识别，FSRS 可接着排期", () => {
  assert.ok(old.mistake_entries.length > 0);
  for (const m of old.mistake_entries) {
    assert.equal(m.fsrs, undefined);
    assert.equal(m.interval_rule, "heuristic_1_3_7_14");
    assert.ok(isMistakeRecord(m) || m.status === "active");
    const s = scheduleReview({ grading: { status: "correct" }, understanding: "mastered", previousStep: m.interval_step, previous: m, now: NOW });
    assert.equal(s.rule, "fsrs_5");
    assert.ok(Date.parse(s.next_review_at) > NOW);
    const merged = mergeMistake(m, { attempt_ids: ["att_new"], next_review_at: s.next_review_at, interval_rule: s.rule, fsrs: s.fsrs, updated_at: new Date(NOW).toISOString() });
    assert.deepEqual(merged.attempt_ids, [...m.attempt_ids, "att_new"]);
    assert.equal(merged.first_attempt_id, m.first_attempt_id);
    assert.equal(merged.stem_snapshot, m.stem_snapshot);
    assert.ok(merged.fsrs);
  }
});

test("旧作答记录计入真实统计，学习总览能生成", () => {
  const attempts = old.attempts.map(enrichTopicIds);
  const real = attempts.filter(isRealRecord);
  assert.equal(real.length, old.attempts.length);
  const snap = buildOverviewSnapshot({ attempts: old.attempts, mistakes: old.mistake_entries, registry: { subjects: [] }, now: new Date(NOW) });
  assert.equal(snap.hasRecords, true);
});

test("旧 localStorage 选择题记录（liaoning.yy5.quiz.2026）的迁移幂等", () => {
  const saved = JSON.parse(old.localStorage["liaoning.yy5.quiz.2026"]);
  const keys = Object.keys(saved);
  assert.ok(keys.length > 0);
  const questions = keys.map((k) => ({ itemKey: k, questionId: `page:yy5:${k}`, subjectId: "english", correct: "B", stem: k, page: { url: "yy/yy5.html", title: "", anchor: "" } }));
  const a = migrateChoiceMap("liaoning.yy5.quiz.2026", saved, questions);
  const b = migrateChoiceMap("liaoning.yy5.quiz.2026", saved, questions);
  assert.equal(a.length, keys.length);
  assert.deepEqual(a.map((p) => p.attemptId), b.map((p) => p.attemptId));
  // 旧版已迁移过的题在旧库里各有一条作答记录。
  const migratedOld = old.attempts.filter((x) => String(x.source || "").length && x.question_id.startsWith("page:yy5:") && keys.includes(x.question_id.slice(9)));
  assert.equal(migratedOld.length, keys.length);
});
