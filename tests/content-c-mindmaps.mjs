import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { TOPIC_KIT_BY_ID } from "../assets/js/features/topic-kit-data.js";
import { mountCMindmaps } from "../assets/js/features/c-mindmaps.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const cPoints = Object.entries(TOPIC_KIT_BY_ID)
  .filter(([, config]) => config.batch === "D4")
  .sort(([, left], [, right]) => Number(left.anchor.slice(6)) - Number(right.anchor.slice(6)));
const newPoints = cPoints.filter(([, config]) => config.mindmap.href?.startsWith("assets/mindmaps/c/"));

test("24 个新增 C 导图资源真实存在，topicId、锚点与 E1 href 一一对应", () => {
  assert.equal(cPoints.length, 27);
  assert.equal(newPoints.length, 24);
  for (const [topicId, config] of newPoints) {
    const number = Number(config.anchor.slice("point-".length));
    const expectedHref = `assets/mindmaps/c/c-point-${String(number).padStart(2, "0")}.svg`;
    assert.equal(config.mindmap.status, "有");
    assert.equal(config.mindmap.label, "本点导图");
    assert.equal(config.mindmap.href, expectedHref);
    assert.ok(existsSync(path.join(root, expectedHref)), `${expectedHref} 文件缺失`);
    const svg = read(expectedHref);
    assert.match(svg, new RegExp(`<svg[^>]*data-topic-id="${topicId.replaceAll(".", "\\.")}"`));
    assert.match(svg, new RegExp(`<title id="svg-title">point-${number} 思维导图</title>`));
    assert.match(svg, /viewBox="0 0 1200 \d+"/);
    assert.doesNotMatch(svg, /<script\b|(?:href|src)="https?:\/\//i);
  }
  const pointOneSvg = read("assets/mindmaps/c/c-point-01.svg");
  assert.match(pointOneSvg, /UNIX/);
  assert.match(pointOneSvg, /Linux/);

  for (const number of [5, 6, 27]) {
    const config = cPoints[number - 1][1];
    assert.equal(config.mindmap.href, `c/notes.html#point-${number}`);
    assert.equal(config.mindmap.label, "页内导图");
  }
  assert.ok(cPoints.every(([, config]) =>
    config.extraLinks.some((link) => link.label === "速记口诀表" && link.href === "c/notes.html#overview")
  ));
});

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.parentNode = null;
    this.className = "";
    this.textContent = "";
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  insertBefore(child, reference) {
    const index = this.children.indexOf(reference);
    if (index < 0) throw new Error("reference node is not a child");
    child.parentNode = this;
    this.children.splice(index, 0, child);
    return child;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
}

function createPageDocument() {
  const script = { src: "https://example.test/assets/js/features/c-mindmaps.js" };
  const head = new FakeElement("head");
  const sections = new Map();
  for (const [topicId, config] of newPoints) {
    const gsPt = new FakeElement("div");
    gsPt.className = "gs-pt";
    const coreStack = new FakeElement("div");
    coreStack.className = "core-stack";
    const parent = new FakeElement("div");
    parent.appendChild(gsPt);
    parent.appendChild(coreStack);
    const section = {
      children: parent.children,
      querySelector(selector) {
        if (selector === ".gs-pt") return gsPt;
        if (selector === ".core-stack") return coreStack;
        if (selector.startsWith("#memory-")) return null;
        if (selector === ".c-mindmap-embed") return this.children.find((child) => child.className === "c-mindmap-embed") || null;
        return null;
      }
    };
    sections.set(config.anchor, { section, parent, gsPt, coreStack, topicId });
  }
  const doc = {
    head,
    querySelector(selector) {
      if (selector === 'script[type="module"][data-page="c-notes"][src*="c-mindmaps.js"]') return script;
      if (selector === 'link[data-c-mindmap-style="true"]') {
        return head.children.find((child) => child.dataset.cMindmapStyle === "true") || null;
      }
      return null;
    },
    getElementById(id) {
      return sections.get(id)?.section || null;
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    }
  };
  return { doc, sections, head };
}

test("运行时把 24 张本地导图插在 gs-pt 之后、core-stack 之前，且可重复调用", () => {
  const { doc, sections, head } = createPageDocument();
  assert.equal(mountCMindmaps(doc), 24);
  assert.equal(head.children.length, 1);
  assert.equal(head.children[0].tagName, "link");
  assert.equal(head.children[0].href.endsWith("/assets/css/c-mindmaps.css"), true);

  for (const [anchor, { parent, gsPt, coreStack }] of sections) {
    assert.equal(parent.children.length, 3, `${anchor} 应只插入一个导图 figure`);
    assert.equal(parent.children[0], gsPt);
    const figure = parent.children[1];
    assert.equal(figure.className, "c-mindmap-embed");
    assert.equal(figure.children[0].tagName, "figcaption");
    assert.equal(figure.children[0].textContent, `本点思维导图 · ${anchor}`);
    assert.equal(figure.children[1].tagName, "a");
    assert.equal(figure.children[1].children[0].tagName, "img");
    assert.equal(figure.children[1].children[0].src.endsWith(`/assets/mindmaps/c/c-point-${String(Number(anchor.slice(6))).padStart(2, "0")}.svg`), true);
    assert.equal(parent.children[2], coreStack);
  }
  assert.equal(mountCMindmaps(doc), 0, "重复调用不得重复挂载");
  assert.equal(head.children.length, 1, "样式表不得重复添加");
});
