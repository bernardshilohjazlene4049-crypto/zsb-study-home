import assert from "node:assert/strict";
import test from "node:test";
import { buildModel } from "../assets/js/shell/model.js";

const site = {
  subjects: [
    { id: "math", name: "高等数学", order: 1, status: "live", enabled: true }
  ],
  chapters: [
    { id: "math.ch1", subject_id: "math", title: "第一章", order: 1 }
  ],
  topics: [
    { id: "math.domain", subject_id: "math", chapter_id: "math.ch1", title: "定义域", order: 1, legacy_url: "gs/gs1.html#point-1" },
    { id: "math.limits", subject_id: "math", chapter_id: "math.ch1", title: "极限", order: 2, legacy_url: "gs/gs1.html#point-2" }
  ],
  merged_topics: {},
  edges: [],
  resources: [],
  registry: { subjects: [] }
};

test("只打开讲义时，最近学习也能成为继续入口", () => {
  const model = buildModel(site, {
    ok: true,
    attempts: [],
    mistakes: [],
    progress: [],
    recentTopic: {
      topic_id: "math.limits",
      opened_at: "2026-11-15T08:00:00.000Z"
    }
  }, Date.parse("2026-11-15T09:00:00.000Z"));
  assert.equal(model.continueItem().topic.id, "math.limits");
  assert.equal(model.hasRecords, false, "打开讲义不能虚增完成率");
});

test("最近学习与答题、进度共用同一条时间线", () => {
  const model = buildModel(site, {
    ok: true,
    attempts: [],
    mistakes: [],
    progress: [{
      id: "progress-domain",
      topic_id: "math.domain",
      updated_at: "2026-11-15T08:30:00.000Z",
      mastery_state: "practicing"
    }],
    recentTopic: {
      topic_id: "math.limits",
      opened_at: "2026-11-15T08:45:00.000Z"
    }
  }, Date.parse("2026-11-15T09:00:00.000Z"));
  assert.equal(model.continueItem().topic.id, "math.limits");

  const olderRecent = buildModel(site, {
    ok: true,
    attempts: [],
    mistakes: [],
    progress: [{
      id: "progress-domain",
      topic_id: "math.domain",
      updated_at: "2026-11-15T08:30:00.000Z",
      mastery_state: "practicing"
    }],
    recentTopic: {
      topic_id: "math.limits",
      opened_at: "2026-11-15T08:15:00.000Z"
    }
  }, Date.parse("2026-11-15T09:00:00.000Z"));
  assert.equal(olderRecent.continueItem().topic.id, "math.domain");
});
