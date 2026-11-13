import assert from "node:assert/strict";
import test from "node:test";
import { pointTabLabel, panelForHash, pointNeighbors } from "../assets/js/shell/lecture.js";

const panels = [
  { id: "route", anchors: ["route-title"] },
  { id: "point-36", anchors: ["practice-36", "q-36-1"] },
  { id: "point-37", anchors: ["video-plane-line"] },
  { id: "answer-key", anchors: ["答案"] }
];
const topic = (id, legacy_url) => ({ id, legacy_url });
const order = [
  topic("p35", "gs/previous.html#point-35"),
  topic("p36", "gs/gs45.html#point-36"),
  topic("p37", "gs/gs45.html#point-37"),
  topic("p49", "gs/next.html#point-49")
];

test("标签名：考点和专题复用中文数字，PPT 保留原编号", () => {
  for (const [id, expected] of [
    ["point-1", "考点一"], ["point-10", "考点十"], ["point-11", "考点十一"],
    ["point-20", "考点二十"], ["point-36", "考点三十六"], ["point-48", "考点四十八"],
    ["topic-4", "专题四"], ["topic-8", "专题八"],
    ["chapter-5.1", "5.1"], ["chapter-5.6", "5.6"]
  ]) assert.equal(pointTabLabel(id, "原始标题"), expected);
});

test("附加分区和 jsj1 的标签保留原目录或第一个标题，不自造文案", () => {
  for (const [id, original] of [
    ["route", "8 天学习路线"], ["suji", "考前速记"], ["last-30", "考前 30 分钟"],
    ["other-notes", "其他补充"], ["answer-key", "答案速查表"], ["directory", "专题目录"],
    ["comparison", "五大专题综合辨析"], ["uncertain", "底稿存疑与原样保留区"],
    ["mind-1.2", "计算机的特点、分类与应用"]
  ]) assert.equal(pointTabLabel(id, original), original);
  assert.equal(pointTabLabel("unknown"), "");
});

test("hash 既能直接命中分区，也能命中任意内部 id", () => {
  assert.equal(panelForHash(panels, "#point-36"), panels[1]);
  assert.equal(panelForHash(panels, "#answer-key"), panels[3]);
  assert.equal(panelForHash(panels, "#q-36-1"), panels[1]);
  assert.equal(panelForHash(panels, "route-title"), panels[0]);
  assert.equal(panelForHash(panels, "#%E7%AD%94%E6%A1%88"), panels[3]);
  const english = [{ id: "topic-6", anchors: ["quiz-6", "words-6"] }];
  assert.equal(panelForHash(english, "#quiz-6"), english[0]);
});

test("空、未知、无效 URL 编码不误选分区，也不抛错", () => {
  for (const hash of ["", "#", null, undefined, "#missing", "#point-3", "#%E0%A4%A"])
    assert.equal(panelForHash(panels, hash), null);
  assert.equal(panelForHash([], "#point-36"), null);
  assert.equal(panelForHash([{ id: "plain" }], "#plain")?.id, "plain");
  assert.equal(panelForHash([{ id: "%bad" }], "#%bad")?.id, "%bad");
});

test("上/下一个沿分区顺序，包括路线和答案等附加分区", () => {
  assert.deepEqual(pointNeighbors(panels, 1, order, "gs/gs45.html"), {
    previous: panels[0], next: panels[2]
  });
  assert.deepEqual(pointNeighbors(panels, 2, order, "gs/gs45.html"), {
    previous: panels[1], next: panels[3]
  });
});

test("首尾分区连接 order 中本页之外的前/后知识点", () => {
  assert.deepEqual(pointNeighbors(panels, 0, order, "gs/gs45.html"), {
    previous: order[0], next: panels[1]
  });
  assert.deepEqual(pointNeighbors(panels, 3, order, "gs/gs45.html"), {
    previous: panels[2], next: order[3]
  });
});

test("科目首尾没有跨页目标时返回 null，供按钮禁用", () => {
  const local = order.slice(1, 3);
  assert.equal(pointNeighbors(panels, 0, local, "gs/gs45.html").previous, null);
  assert.equal(pointNeighbors(panels, 3, local, "gs/gs45.html").next, null);
  assert.deepEqual(pointNeighbors([panels[1]], 0, order, "gs/gs45.html"), {
    previous: order[0], next: order[3]
  });
});

test("无效索引、空分区或 order 中没有本页时安全禁用", () => {
  for (const index of [-1, panels.length])
    assert.deepEqual(pointNeighbors(panels, index, order, "gs/gs45.html"), { previous: null, next: null });
  assert.deepEqual(pointNeighbors([], 0, order, "gs/gs45.html"), { previous: null, next: null });
  assert.deepEqual(pointNeighbors([panels[0]], 0, order, "unknown.html"), { previous: null, next: null });
});
