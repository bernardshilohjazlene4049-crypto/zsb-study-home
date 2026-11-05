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
