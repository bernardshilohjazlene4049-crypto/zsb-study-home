import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { TOPIC_KIT_BY_ID } from "../assets/js/features/topic-kit-data.js";
import { mountMathCh1Mindmaps } from "../assets/js/features/math-ch1-mindmaps.js";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, ROOT), "utf8");
const D1_EXPECTED = [
  ["math.domain", "point-1", "gs/gs1/illus/k01-domain.webp"],
  ["math.function_properties", "point-2", "gs/gs1/illus/k02-properties.webp"],
  ["math.sequence_limit", "point-3", "gs/gs1/illus/k03-sequence.webp"],
  ["math.function_limit", "point-4", "gs/gs1/illus/k04-function-limit.webp"],
  ["math.infinitesimal", "point-5", "gs/gs1/illus/k05-infinitesimal.webp"],
  ["math.equivalent", "point-6", "gs/gs1/illus/k06-compare.webp"],
  ["math.important_limits", "point-7", "gs/gs1/illus/k08-important-limits.webp"],
  ["math.asymptote", "point-8", "gs/gs1/illus/k09-asymptote.webp"],
  ["math.continuity", "point-9", "gs/gs1/illus/k10-continuity.webp"],
  ["math.discontinuity", "point-10", "gs/gs1/illus/k11-discontinuity.webp"],
  ["math.continuous_properties", "point-11", "gs/gs1/illus/k12-closed-interval.webp"]
];

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.attributes = {};
    this.className = "";
    this.textContent = "";
  }

  get nextSibling() {
    if (!this.parentNode) return null;
    const index = this.parentNode.children.indexOf(this);
    return this.parentNode.children[index + 1] || null;
  }

  appendChild(child) {
    if (child.parentNode) {
      const old = child.parentNode.children.indexOf(child);
      if (old >= 0) child.parentNode.children.splice(old, 1);
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child, reference) {
    if (!reference) return this.appendChild(child);
    const index = this.children.indexOf(reference);
    if (index < 0) throw new Error("reference node is not a child");
    if (child.parentNode) {
      const old = child.parentNode.children.indexOf(child);
      if (old >= 0) child.parentNode.children.splice(old, 1);
    }
    child.parentNode = this;
    this.children.splice(index, 0, child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  querySelector(selector) {
    if (selector === ":scope > header") {
      return this.children.find((child) => child.tagName === "HEADER" || child.className.split(" ").includes("topic-header")) || null;
    }
    if (selector === "header") {
      return this.children.find((child) => child.tagName === "HEADER") || null;
    }
    if (selector === ".math-ch1-mindmap") {
      return this.find((child) => child.className.split(" ").includes("math-ch1-mindmap"));
    }
    return null;
  }

  find(predicate) {
    for (const child of this.children) {
      if (predicate(child)) return child;
      const nested = child.find(predicate);
      if (nested) return nested;
    }
    return null;
  }
}

class FakeDocument {
  constructor(sections) {
    this.sections = sections;
    this.head = new FakeElement("head");
    this.nodes = new Map(sections.map((section) => [section.id, section]));
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  getElementById(id) {
    return this.nodes.get(id) || null;
  }

  querySelector(selector) {
    if (selector === 'link[data-math-ch1-mindmap-style="true"]') {
      return this.head.find((node) => node.tagName === "LINK" && node.dataset.mathCh1MindmapStyle === "true");
    }
    return null;
  }
}

test("高数第一章 D1 仍为 11 点，逐点导图与原练习讲解图并存", () => {
  const d1 = Object.entries(TOPIC_KIT_BY_ID).filter(([, point]) => point.batch === "D1");
  assert.equal(Object.keys(TOPIC_KIT_BY_ID).length, 104);
  assert.equal(d1.length, 11);

  for (const [topicId, anchor, visualHref] of D1_EXPECTED) {
    const point = TOPIC_KIT_BY_ID[topicId];
    assert.ok(point, `${topicId} 必须存在`);
    assert.equal(point.anchor, anchor);
    assert.equal(point.mindmap.status, "有");
    assert.equal(point.mindmap.label, "本点导图");
    const number = Number(anchor.slice("point-".length));
    assert.equal(point.mindmap.href, `assets/mindmaps/math/ch1/point-${String(number).padStart(2, "0")}.svg`);
    assert.ok(point.extraLinks.some((link) => link.label === "科目总图" && link.href === "gs/mindmap.html"));
    assert.equal(point.practice.visualHref, visualHref);
  }
});

test("D2 与其它学科资源索引不被第一章导图接入改写", () => {
  const d2 = Object.values(TOPIC_KIT_BY_ID).filter((point) => point.batch === "D2");
  assert.equal(d2.length, 13);
  for (const point of d2) {
    assert.equal(point.mindmap.href, "gs/mindmap.html");
    assert.deepEqual(point.extraLinks, []);
  }
  assert.equal(TOPIC_KIT_BY_ID["english.attributive.basics"].mindmap.href, "yy/mm/mm2.svg");
});

test("11 份本地 SVG 与 E1 topicId 一一对应，且不依赖 Mermaid CDN", () => {
  for (const [topicId, anchor] of D1_EXPECTED) {
    const number = Number(anchor.slice("point-".length));
    const svg = read(`assets/mindmaps/math/ch1/point-${String(number).padStart(2, "0")}.svg`);
    assert.match(svg, /^<svg\b/);
    assert.ok(svg.includes(`data-topic-id="${topicId}"`));
    assert.match(svg, /<title id="svg-title">/);
    assert.match(svg, /<desc id="svg-desc">/);
    assert.match(svg, /<\/svg>\s*$/);
    assert.doesNotMatch(svg, /<script\b|(?:href|src)=["']https?:\/\//i);
    assert.doesNotMatch(svg, /<text\b[^>]*>\s*<\/text>/, `${topicId} 的 SVG 不得包含空文本叶子`);
  }
});

test("GS1 运行时挂载 11 张导图且幂等，不覆盖讲义、视频、插图或课堂总图", () => {
  const sections = D1_EXPECTED.map(([, anchor]) => {
    const section = new FakeElement("section");
    section.id = anchor;
    const header = new FakeElement("header");
    header.className = "topic-header";
    const video = new FakeElement("div");
    video.className = "pvideo kdvideo";
    const lecture = new FakeElement("div");
    lecture.className = "gs-pt";
    const entry = new FakeElement("div");
    entry.className = "wy-entry";
    const illustration = new FakeElement("div");
    illustration.className = "gs-illus";
    if (anchor === "point-6") {
      const equation = new FakeElement("div");
      equation.id = "6-eq";
      illustration.appendChild(equation);
      section._equation = equation;
    }
    const v1 = new FakeElement("div");
    v1.id = anchor === "point-1" ? "videos-v1-gs1-1-2" : "";
    for (const child of [header, video, lecture, entry, illustration, v1]) section.appendChild(child);
    section._preserved = [video, lecture, entry, illustration, v1];
    return section;
  });
  const classroomMap = new FakeElement("section");
  classroomMap.id = "mindmap";
  const doc = new FakeDocument([...sections, classroomMap]);

  assert.equal(mountMathCh1Mindmaps(doc), 11);
  assert.equal(mountMathCh1Mindmaps(doc), 0);
  assert.equal(doc.head.children.length, 1);

  for (const section of sections) {
    assert.equal(section.children[1].className, "math-ch1-mindmap");
    assert.equal(section.children[2], section._preserved[0]);
    assert.deepEqual(section.children.slice(2), section._preserved);
    if (section.id === "point-6") assert.equal(section._preserved[3].children[0], section._equation);
    const figure = section.children[1];
    assert.ok(figure.dataset.mathCh1MindmapTopicId);
    const image = figure.children[1].children[0];
    assert.equal(image.loading, "lazy");
    assert.equal(image.decoding, "async");
    assert.match(image.src, /assets\/mindmaps\/math\/ch1\/point-\d{2}\.svg$/);
  }
  assert.equal(classroomMap.children.length, 0);
});

test("page-study 只在 gs1 折回入口中动态加载导图模块，并保留原有映射与折叠", () => {
  const source = read("assets/js/page-study.js");
  assert.ok(source.includes("GS1_TOPIC_IDS"));
  const guard = source.indexOf('if (pageKey !== "gs1") return;');
  assert.notEqual(guard, -1);
  const start = source.lastIndexOf("foldGs1MindmapEntry", guard);
  assert.notEqual(start, -1);
  const end = source.indexOf("\n  }", guard);
  assert.notEqual(end, -1, "foldGs1MindmapEntry 必须有明确的函数结束位置");
  const body = source.slice(start, end);
  assert.ok(body.includes('if (pageKey !== "gs1") return;'));
  const guardAt = body.indexOf('if (pageKey !== "gs1") return;');
  const importAt = body.indexOf('import(new URL("assets/js/features/math-ch1-mindmaps.js", root).href)');
  assert.ok(importAt > guardAt, "导图模块只在 gs1 guard 之后动态加载");
  assert.equal(
    source.indexOf('import(new URL("assets/js/features/math-ch1-mindmaps.js", root).href)'),
    source.lastIndexOf('import(new URL("assets/js/features/math-ch1-mindmaps.js", root).href)'),
    "导图模块只能在 foldGs1MindmapEntry 中加载"
  );
  assert.ok(body.includes(".catch(() => {})"), "导图加载失败不得打断侧栏折叠");
  assert.ok(body.includes('appendKitLink(target, "本页导图区", "gs/gs1.html#mindmap")'));
  assert.ok(body.includes("navLink.remove()"));
});
