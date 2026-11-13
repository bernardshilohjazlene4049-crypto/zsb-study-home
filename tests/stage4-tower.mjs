import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildTowerStats } from "../assets/js/tower-stats.js";
import { buildModel } from "../assets/js/shell/model.js";

const ids = ["english", "math", "computer_basics", "c_language", "database", "web_design", "network", "digital_electronics"];
const names = ["英语", "高等数学", "计算机基础", "C 语言", "数据库（SQL Server）", "网页设计", "计算机网络", "数字电子技术"];
function fakeModel({ states = {}, due = [], weak = [], continuation = null, progress = {} } = {}) {
  const subjects = ids.map((id, index) => ({ id, name: names[index], status: ["database", "network"].includes(id) ? "building" : id === "digital_electronics" ? "disabled" : "live", enabled: id !== "digital_electronics", homeUrl: `${id}/index.html` }));
  const topics = ids.flatMap((id) => Array.from({ length: 4 }, (_, index) => ({ id: `${id}.${index}`, subject_id: id, title: `${names[ids.indexOf(id)]}知识点${index}`, legacy_url: `${id}/chapter.html#t${index}` })));
  const topic = (id) => topics.find((t) => t.id === id);
  return {
    subjects, site: { topics }, topicStatus: (id) => states[id] || "none",
    subjectProgress: (id) => ({ pct: progress[id] ?? Math.round(topics.filter((t) => t.subject_id === id && states[t.id]).length / 4 * 100) }),
    dueTopics: () => due.map(([id, count]) => ({ topic: topic(id), count })),
    weakTopics: () => weak.map(([id, count]) => ({ topic: topic(id), count })),
    continueItem: () => continuation ? { topic: topic(continuation) || { id: continuation, subject_id: "math" } } : null
  };
}
const floor = (result, no) => result.floors.find((f) => f.no === no);

test("无记录时统计为空状态、目录总数真实、没有示例进度", () => {
  const result = buildTowerStats(fakeModel());
  assert.deepEqual(result.floors.map((f) => f.no), ["07F", "06F", "05F", "04F", "03F", "02F", "01F"]);
  assert.equal(result.activeFloors, 0);
  assert.equal(result.floorCount, 7);
  for (const f of result.floors.filter((f) => f.open)) {
    assert.equal(f.hasRecords, false);
    assert.equal(f.pct, null);
    assert.equal(f.state, "未开始");
    assert.equal(f.mastered, 0);
    assert.equal(f.learning, 0);
    assert.equal(f.due, 0);
    assert.equal(f.mistakes, 0);
  }
  assert.equal(floor(result, "07F").total, 20);
  assert.equal(floor(result, "07F").next, null);
  assert.equal(floor(result, "04F").total, 4);
  assert.equal(floor(result, "04F").next.id, "c_language.0");
});

test("building 楼层即将开放、无数字与入口，即使存在旧记录", () => {
  const result = buildTowerStats(fakeModel({ states: { "database.0": "mastered", "network.0": "due" }, due: [["network.0", 3]], weak: [["database.0", 5]] }));
  for (const no of ["03F", "01F"]) {
    const f = floor(result, no);
    assert.equal(f.open, false);
    assert.equal(f.state, "即将开放");
    assert.equal(f.hasRecords, false);
    assert.equal(f.homeUrl, null);
    for (const key of ["total", "done", "mastered", "learning", "pct", "due", "mistakes", "next"]) assert.equal(f[key], null);
  }
  assert.equal(result.activeFloors, 0);
  assert.equal(floor(result, "07F").mistakes, 0);
  assert.equal(floor(result, "07F").due, 0);
});

test("06F 合并两科，保留各自真实进度、下一步与 homeUrl", () => {
  const result = buildTowerStats(fakeModel({ states: { "english.0": "mastered", "math.0": "due", "math.1": "learning" }, due: [["math.0", 8]], weak: [["english.0", 2], ["math.0", 4]], continuation: "math.1" }));
  const f = floor(result, "06F");
  assert.equal(f.name, "英语 / 高等数学");
  assert.equal(f.total, 8);
  assert.equal(f.done, 3);
  assert.equal(f.mastered, 1);
  assert.equal(f.learning, 2);
  assert.equal(f.pct, 38);
  assert.equal(f.due, 1);
  assert.equal(f.mistakes, 6);
  assert.equal(f.next.id, "math.1");
  assert.deepEqual(f.subjects.map((s) => [s.name, s.pct, s.homeUrl]), [["英语", 25, "english/index.html"], ["高等数学", 50, "math/index.html"]]);
  assert.equal(result.activeFloors, 1);
});

test("每科已掌握与学习中等于逐个知识点的状态计数，进度直接复用 subjectProgress", () => {
  const model = fakeModel({ states: { "c_language.0": "mastered", "c_language.1": "learning", "c_language.2": "due" }, progress: { c_language: 73 } });
  const f = floor(buildTowerStats(model), "04F");
  const topics = model.site.topics.filter((t) => t.subject_id === "c_language");
  assert.equal(f.mastered, topics.filter((t) => model.topicStatus(t.id) === "mastered").length);
  assert.equal(f.learning, topics.filter((t) => ["learning", "due"].includes(model.topicStatus(t.id))).length);
  assert.equal(f.total, topics.length);
  assert.equal(f.pct, 73);
});

test("今日到期按 model 到期知识点行数计，错题按 weakTopics count 求和", () => {
  const f = floor(buildTowerStats(fakeModel({ states: { "c_language.0": "due", "c_language.1": "due" }, due: [["c_language.0", 7], ["c_language.1", 2], ["math.0", 10]], weak: [["c_language.0", 4], ["c_language.1", 6], ["math.0", 20]] })), "04F");
  assert.equal(f.due, 2);
  assert.equal(f.mistakes, 10);
});

test("全站汇总仅统计已开放且启用的科目，进度按知识点总数加权", () => {
  const states = Object.fromEntries(ids.map((id) => [`${id}.0`, "mastered"]));
  const result = buildTowerStats(fakeModel({ states, due: ids.map((id) => [`${id}.0`, 9]), weak: ids.map((id) => [`${id}.0`, 2]) }));
  const summary = floor(result, "07F");
  assert.equal(summary.total, 20);
  assert.equal(summary.mastered, 5);
  assert.equal(summary.done, 5);
  assert.equal(summary.learning, 0);
  assert.equal(summary.pct, 25);
  assert.equal(summary.due, 5);
  assert.equal(summary.mistakes, 10);
  assert.equal(summary.subjects.length, 5);
  assert.equal(summary.homeUrl, "study/index.html");
  assert.equal(result.activeFloors, 4); // 06F 计一层，07F 不重复计。
});

test("06F 百分比以两科总知识点数加权，不取百分比的简单平均", () => {
  const model = fakeModel({ states: { "english.0": "mastered", "math.0": "mastered", "math.1": "mastered" } });
  model.site.topics = model.site.topics.filter((t) => t.subject_id !== "english" || t.id === "english.0");
  const f = floor(buildTowerStats(model), "06F");
  assert.equal(f.total, 5);
  assert.equal(f.pct, 60);
});

test("下一步优先本科目继续项，其他科目或已删除项回退到首个未学知识点", () => {
  for (const continuation of ["math.0", "deleted", null]) {
    const f = floor(buildTowerStats(fakeModel({ states: { "c_language.0": "mastered" }, continuation })), "04F");
    assert.equal(f.next.id, "c_language.1");
  }
  const f = floor(buildTowerStats(fakeModel({ states: { "c_language.0": "mastered" }, continuation: "c_language.2" })), "04F");
  assert.equal(f.next.id, "c_language.2");
});

test("07F 下一步优先全站继续项，缺失时取首个已开放科目的到期项", () => {
  const options = { due: [["database.0", 1], ["math.1", 2], ["english.0", 1]] };
  assert.equal(floor(buildTowerStats(fakeModel(options)), "07F").next.id, "math.1");
  assert.equal(floor(buildTowerStats(fakeModel({ ...options, continuation: "web_design.2" })), "07F").next.id, "web_design.2");
  assert.equal(floor(buildTowerStats(fakeModel({ ...options, continuation: "database.0" })), "07F").next.id, "math.1");
  assert.equal(floor(buildTowerStats(fakeModel({ ...options, continuation: "deleted" })), "07F").next.id, "math.1");
});

test("全部学过时没有虚构的下一步；无知识点时不出现 NaN", () => {
  const states = Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`c_language.${i}`, "mastered"]));
  assert.equal(floor(buildTowerStats(fakeModel({ states })), "04F").next, null);
  const model = fakeModel();
  model.site.topics = [];
  for (const f of buildTowerStats(model).floors.filter((f) => f.open)) {
    assert.equal(f.total, 0);
    assert.equal(f.pct, null);
    assert.equal(f.next, null);
  }
});

test("纯函数不修改模型和目录输入，目录缺科目时安全回退", () => {
  const model = fakeModel();
  const before = structuredClone({ subjects: model.subjects, site: model.site });
  assert.deepEqual(buildTowerStats(model), buildTowerStats(model));
  assert.deepEqual({ subjects: model.subjects, site: model.site }, before);
  model.subjects = [];
  const result = buildTowerStats(model);
  assert.equal(result.activeFloors, 0);
  assert.equal(result.floors.length, 7);
  assert.ok(result.floors.every((f) => !f.open && f.total === null));
});

test("真实 buildModel 的到期边界、状态与错题直接进入指挥塔", () => {
  const subjects = JSON.parse(readFileSync(new URL("../data/subjects.json", import.meta.url))).subjects;
  const topicsDoc = JSON.parse(readFileSync(new URL("../data/topics.json", import.meta.url)));
  const site = { subjects, ...topicsDoc, edges: [], registry: { subjects: [] } };
  const topic = site.topics.find((t) => t.subject_id === "math");
  const now = new Date(2026, 5, 4, 12);
  const tonight = new Date(2026, 5, 4, 23, 59, 59, 999).toISOString();
  const tomorrow = new Date(2026, 5, 5).toISOString();
  const learning = { ok: true, attempts: [], progress: [{ topic_id: topic.id, mastery_state: "independent_once", updated_at: now.toISOString() }], mistakes: [
    { id: "due", topic_ids: [topic.id], category: "wrong", status: "active", next_review_at: tonight },
    { id: "future", topic_ids: [topic.id], category: "wrong", status: "active", next_review_at: tomorrow }
  ] };
  const model = buildModel(site, learning, now.getTime());
  const result = buildTowerStats(model);
  const math = floor(result, "06F").subjects.find((s) => s.id === "math");
  assert.equal(math.total, site.topics.filter((t) => t.subject_id === "math").length);
  assert.equal(math.learning, 1);
  assert.equal(math.mastered, 0);
  assert.equal(math.due, 1); // 两道复习中仅今晚到期，但知识点只计一次。
  assert.equal(math.mistakes, model.weakTopics().filter((r) => r.topic.subject_id === "math").reduce((sum, r) => sum + r.count, 0));
  assert.equal(math.pct, model.subjectProgress("math").pct);
  assert.equal(floor(result, "07F").total, site.topics.filter((t) => subjects.some((s) => s.id === t.subject_id && s.status === "live" && s.enabled !== false)).length);
});
