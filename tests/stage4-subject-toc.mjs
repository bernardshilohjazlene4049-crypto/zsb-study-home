import assert from "node:assert/strict";
import test from "node:test";
import { selectCurrentTopic, groupChapterTopics } from "../assets/js/shell/subject.js";

const a = { id: "a", chapter_id: "s1", title: "考点一" };
const b = { id: "b", chapter_id: "s1", title: "考点二" };
const c = { id: "c", chapter_id: "ch2", title: "专题一" };
const nodes = [
  { chapter: { id: "ch1", title: "第一章" }, topics: [a, b], sections: [{ chapter: { id: "s1", title: "第一节" }, topics: [a, b] }] },
  { chapter: { id: "ch2", title: "第二章" }, topics: [c], sections: [] }
];
const status = (records = {}) => (id) => records[id] || "none";

test("本科目继续学习优先，按知识点实际归属找章（包括节内知识点）", () => {
  const continuation = { subject: { id: "math" }, topic: b, chapter: { id: "stale" } };
  assert.deepEqual(selectCurrentTopic(nodes, "math", continuation, status()), { chapter: nodes[0], topic: b });
  assert.deepEqual(selectCurrentTopic(nodes, "math", { ...continuation, topic: c }, status()), { chapter: nodes[1], topic: c });
});

test("其他科目、缺失或已删除的继续学习记录回退到当前章首个未学项", () => {
  for (const continuation of [null, { subject: { id: "english" }, topic: c }, { subject: { id: "math" }, topic: { id: "deleted" } }, { subject: { id: "math" } }]) {
    assert.deepEqual(selectCurrentTopic(nodes, "math", continuation, status({ a: "mastered" })), { chapter: nodes[0], topic: b });
  }
});

test("先前章节全有记录时选择下一未学章；全部学过时选择首章首项", () => {
  assert.deepEqual(selectCurrentTopic(nodes, "math", null, status({ a: "mastered", b: "learning" })), { chapter: nodes[1], topic: c });
  assert.deepEqual(selectCurrentTopic(nodes, "math", null, status({ a: "mastered", b: "due", c: "learning" })), { chapter: nodes[0], topic: a });
});

test("空章、空科目和仅一个知识点安全回退", () => {
  const empty = { chapter: { id: "empty" }, topics: [], sections: [] };
  assert.deepEqual(selectCurrentTopic([], "math", null, status()), { chapter: null, topic: null });
  assert.deepEqual(selectCurrentTopic([empty], "math", null, status()), { chapter: null, topic: null });
  assert.deepEqual(selectCurrentTopic([empty, nodes[1]], "math", null, status()), { chapter: nodes[1], topic: c });
});

test("无 sections 的章直接列出知识点，保持原顺序", () => {
  assert.deepEqual(groupChapterTopics(nodes[1]), [{ chapter: null, topics: [c] }]);
  assert.deepEqual(groupChapterTopics({ topics: [b, a] }), [{ chapter: null, topics: [b, a] }]);
  assert.deepEqual(groupChapterTopics({ topics: [] }), []);
});

test("按 sections 分组并保留小标题、节内顺序和章直属项，不改动输入", () => {
  const chapter = { chapter: { id: "mixed" }, topics: [a, b, c], sections: [
    { chapter: { id: "s2", title: "第二节" }, topics: [b] },
    { chapter: { id: "s1", title: "第一节" }, topics: [a] }
  ] };
  const before = structuredClone(chapter);
  assert.deepEqual(groupChapterTopics(chapter), [
    { chapter: chapter.sections[0].chapter, topics: [b] },
    { chapter: chapter.sections[1].chapter, topics: [a] },
    { chapter: null, topics: [c] }
  ]);
  assert.deepEqual(chapter, before);
});

test("分组不重复列出节内知识点，也不引入本章之外的项", () => {
  const grouped = groupChapterTopics({ topics: [a, b], sections: [
    { chapter: { id: "one" }, topics: [a, a, c] },
    { chapter: { id: "two" }, topics: [a, b] }
  ] });
  assert.deepEqual(grouped.map((group) => group.topics), [[a], [b]]);
});
