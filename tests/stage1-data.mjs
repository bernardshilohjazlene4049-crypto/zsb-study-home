import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));

test("catalog files stay inside the repo-relative contract", () => {
  const subjects = read("data/subjects.json");
  const topics = read("data/topics.json");
  const resources = read("data/resources.json");
  const anchors = read("data/video-anchors.json");
  const questions = read("data/questions/sample.json");
  const byId = Object.fromEntries(subjects.subjects.map((subject) => [subject.id, subject]));

  assert.equal(byId.web_design.homeUrl, "wy/index.html");
  assert.equal(byId.database.homeUrl, null);
  assert.equal(byId.network.homeUrl, null);
  assert.equal(byId.english.homeUrl, "yy/index.html");
  assert.equal(byId.math.homeUrl, "gs/index.html");
  assert.equal(byId.computer_basics.homeUrl, "jsj/index.html");
  assert.equal(byId.c_language.homeUrl, "c/index.html");
  assert.equal(subjects.subjects.filter((subject) => !subject.optional).length, 7);
  assert.equal(byId.digital_electronics.optional, true);
  assert.equal(byId.digital_electronics.enabled, false);

  for (const anchor of anchors.anchors) {
    assert.equal(Object.hasOwn(anchor, "start_sec"), false);
    assert.equal(Object.hasOwn(anchor, "end_sec"), false);
  }
  for (const question of questions.questions) {
    assert.equal(question.provenance.kind, "sample");
    assert.equal(question.provenance.verified, false);
    assert.match(question.stem, /示例/);
  }
  const blob = JSON.stringify({ subjects, topics, resources, anchors, questions });
  assert.equal(blob.includes("官方考点"), false);
  assert.equal(blob.includes("\"/gs/"), false);
  assert.equal(blob.includes("\"/yy/"), false);
  for (const resource of resources.resources) {
    assert.equal(resource.url.startsWith("/"), false);
    assert.equal(fs.existsSync(path.join(root, resource.url)), true);
  }
});

test("the old homepage keeps subject cards and gains a reversible study link", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const href of ["yy/index.html", "gs/index.html", "jsj/index.html", "c/index.html", "wy/index.html", "study/index.html"]) {
    assert.equal(html.includes(href), true, href);
  }
  assert.equal(html.includes("数据库"), true);
  assert.equal(html.includes("计算机网络"), true);
});


function htmlIds(rel) {
  const html = fs.readFileSync(path.join(root, rel), "utf8");
  const ids = new Set();
  for (const match of html.matchAll(/\bid=["']([^"']+)["']/g)) ids.add(match[1]);
  for (const match of html.matchAll(/\bname=["']([^"']+)["']/g)) ids.add(match[1]);
  return ids;
}

function assertTarget(label, ref) {
  if (!ref) return;
  const [file, hash] = ref.split("#");
  assert.equal(fs.existsSync(path.join(root, file)), true, `${label} 缺少文件 ${file}`);
  if (hash) {
    assert.equal(htmlIds(file).has(hash), true, `${label} 缺少锚点 ${ref}`);
  }
}

test("知识点目录锚点真实存在，先修边与 prereq_ids 一致", () => {
  const topics = read("data/topics.json");
  const deps = read("data/dependencies.json");
  const topicIds = new Set(topics.topics.map((t) => t.id));
  const fromEdges = new Map();
  for (const edge of deps.edges) {
    assert.equal(Boolean(edge.topicId && edge.prerequisiteId), true);
    assert.equal(["hard", "soft"].includes(edge.strength), true, edge.topicId);
    assert.equal(typeof edge.reason, "string");
    assert.equal(topicIds.has(edge.topicId), true, edge.topicId);
    assert.equal(topicIds.has(edge.prerequisiteId), true, edge.prerequisiteId);
    const list = fromEdges.get(edge.topicId) || [];
    list.push(edge.prerequisiteId);
    fromEdges.set(edge.topicId, list);
  }
  for (const item of [...topics.topics, ...topics.chapters]) {
    assertTarget(item.id, item.source_ref);
    assertTarget(item.id, item.legacy_url);
  }
  for (const topic of topics.topics) {
    assert.deepEqual(topic.prereq_ids || [], fromEdges.get(topic.id) || []);
  }
  const blob = JSON.stringify({ topics, deps });
  for (const banned of ["36-7", "38-2", "46-5", "补-5", "math.p123"]) {
    assert.equal(blob.includes(banned), false, banned);
  }
  assert.equal(topics.topics.some((t) => t.id === "math.function_limit" && t.legacy_url === "gs/gs1.html#point-4"), true);
  assert.equal(topics.topics.some((t) => t.id === "math.p48" && t.legacy_url === "gs/gs45.html#point-48"), true);
  assert.equal(topics.topics.some((t) => t.id === "web.html.quiz"), true);
  assert.equal(topics.chapters.some((c) => c.subject_id === "database" || c.subject_id === "network"), false);
  assert.deepEqual(topics.chapters.filter((c) => c.subject_id === "c_language").map((c) => c.id), ["c.existing"]);
  assert.equal(blob.includes("cn-math-taxonomy"), true);
});

test("subject summaries do not contain file paths (.html or .json)", () => {
  const subjects = read("data/subjects.json");
  for (const subject of subjects.subjects) {
    if (subject.summary) {
      assert.equal(subject.summary.includes(".html"), false, `Subject ${subject.id} summary contains .html: ${subject.summary}`);
      assert.equal(subject.summary.includes(".json"), false, `Subject ${subject.id} summary contains .json: ${subject.summary}`);
    }
  }
});

