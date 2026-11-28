import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { mountEnglishTopic4Visuals } from "../assets/js/features/english-topic4-viz.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

class ElementFixture {
  constructor(tagName) {
    this.tagName = tagName.toLowerCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.parentNode = null;
    this.className = "";
    this.textContent = "";
    this.src = "";
    this.alt = "";
    this.loading = "";
    this.decoding = "";
    this.rel = "";
    this.href = "";
  }

  get firstChild() {
    return this.children[0] || null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith("data-")) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = String(value);
    }
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child, reference) {
    child.parentNode = this;
    const index = reference ? this.children.indexOf(reference) : -1;
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }

  insertAdjacentElement(position, child) {
    assert.equal(position, "afterend");
    const index = this.parentNode.children.indexOf(this);
    child.parentNode = this.parentNode;
    this.parentNode.children.splice(index + 1, 0, child);
    return child;
  }

  matches(selector) {
    if (/^[a-z][a-z0-9-]*$/i.test(selector)) return this.tagName === selector.toLowerCase();
    if (selector.startsWith(".")) return this.className.split(/\s+/).includes(selector.slice(1));
    const dataMatch = selector.match(/^\[data-([a-z0-9-]+)="([^"]+)"\]$/);
    if (dataMatch) {
      const key = dataMatch[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return this.dataset[key] === dataMatch[2];
    }
    return false;
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
}

function makeFixtureDocument() {
  const byId = new Map();
  const articles = new Map();
  const head = new ElementFixture("head");

  for (let number = 1; number <= 13; number += 1) {
    const details = new ElementFixture("details");
    details.id = `point-4-${number}`;
    const summary = new ElementFixture("summary");
    const content = new ElementFixture("div");
    content.className = "point-content";
    content.appendChild(new ElementFixture("p"));
    details.appendChild(summary);
    details.appendChild(content);
    byId.set(details.id, details);
  }

  for (let number = 1; number <= 10; number += 1) {
    const article = new ElementFixture("article");
    article.setAttribute("data-question", `4-${number}`);
    article.className = "question-card quiz-question";
    article.appendChild(new ElementFixture("div"));
    const feedback = new ElementFixture("div");
    feedback.className = "answer-feedback";
    article.appendChild(feedback);
    article.appendChild(new ElementFixture("footer"));
    articles.set(`4-${number}`, article);
  }

  return {
    head,
    byId,
    articles,
    createElement(tagName) {
      return new ElementFixture(tagName);
    },
    getElementById(id) {
      return byId.get(id) || null;
    },
    querySelector(selector) {
      if (selector.startsWith("link[")) {
        return head.children.find((child) => child.tagName === "link" && child.dataset.englishTopic4Style === "true") || null;
      }
      const match = selector.match(/^article\.quiz-question\[data-question="(4-\d+)"\]$/);
      return match ? articles.get(match[1]) || null : null;
    }
  };
}

test("专题四运行时把 13 张导图与 10 张练习图挂到正确容器，重复执行不重复插入", () => {
  const doc = makeFixtureDocument();
  const first = mountEnglishTopic4Visuals(doc);
  assert.deepEqual(first, { mindmaps: 13, practices: 10 });

  for (let number = 1; number <= 13; number += 1) {
    const details = doc.getElementById(`point-4-${number}`);
    const content = details.querySelector(".point-content");
    const figure = content.firstChild;
    assert.equal(figure.tagName, "figure");
    assert.equal(figure.dataset.englishTopic4Visual, `mindmap-${number}`);
    const image = figure.querySelector("img");
    assert.equal(image.src, `../assets/mindmaps/english/topic4/point-4-${number}.svg`);
    assert.match(image.alt, new RegExp(`考点 4-${number}`));
    assert.equal(image.loading, "lazy");
  }

  for (let number = 1; number <= 10; number += 1) {
    const article = doc.articles.get(`4-${number}`);
    const feedback = article.children.find((child) => child.className === "answer-feedback");
    const feedbackIndex = article.children.indexOf(feedback);
    const figure = article.children[feedbackIndex + 1];
    assert.equal(figure.tagName, "figure");
    assert.equal(figure.dataset.englishTopic4Visual, `practice-${number}`);
    const image = figure.querySelector("img");
    assert.equal(image.src, `../assets/mindmaps/english/topic4/quiz-4-${number}.svg`);
    assert.match(image.alt, new RegExp(`第 ${number} 题`));
  }

  assert.equal(doc.head.children.length, 1, "样式表只加载一次");
  assert.equal(doc.head.children[0].href, "../assets/css/english-topic4-viz.css");
  assert.deepEqual(mountEnglishTopic4Visuals(doc), { mindmaps: 0, practices: 0 });
  assert.equal(doc.head.children.length, 1);
});

test("专题四本地 SVG 资源完整、无外链脚本，且保留底稿限制", () => {
  const answers = ["B", "C", "A", "D", "B", "C", "D", "A", "B", "C"];
  for (let number = 1; number <= 13; number += 1) {
    const relative = `assets/mindmaps/english/topic4/point-4-${number}.svg`;
    assert.equal(existsSync(path.join(root, relative)), true, `缺少 ${relative}`);
    const svg = read(relative);
    assert.match(svg, new RegExp(`data-point-id="point-4-${number}"`));
    assert.match(svg, /<title id="svg-title">/);
    assert.doesNotMatch(svg, /<script\b|(?:href|src)="https?:\/\//i);
  }

  for (let number = 1; number <= 10; number += 1) {
    const relative = `assets/mindmaps/english/topic4/quiz-4-${number}.svg`;
    assert.equal(existsSync(path.join(root, relative)), true, `缺少 ${relative}`);
    const svg = read(relative);
    assert.match(svg, new RegExp(`data-question="4-${number}"`));
    assert.match(svg, new RegExp(`data-answer="${answers[number - 1]}"`));
    assert.doesNotMatch(svg, /<script\b|(?:href|src)="https?:\/\//i);
  }

  const point44 = read("assets/mindmaps/english/topic4/point-4-4.svg");
  assert.match(point44, /未完句片段/);
  assert.match(point44, /which my grandfather grew up in/);
  const point48 = read("assets/mindmaps/english/topic4/point-4-8.svg");
  assert.match(point48, /未提供完整选项/);
  assert.match(point48, /不据此还原试卷/);
  const q09 = read("assets/mindmaps/english/topic4/quiz-4-9.svg");
  assert.match(q09, /7-12/);
  assert.match(q09, /专题七，本批不接入/);
  assert.doesNotMatch(q09, /href=.*point-7|english\.agreement/);
});

test("yy5 保留专题四页尾模块顺序并在其后追加专题五模块，仍无尾换行", () => {
  const html = read("yy/yy5.html");
  const topic4Script = '<script type="module" src="../assets/js/features/english-topic4-viz.js"></script>';
  const topic5Script = '<script type="module" src="../assets/js/features/english-topic5-viz.js"></script>';
  const topic6Script = '<script type="module" src="../assets/js/features/english-topic6-viz.js"></script>';
  assert.equal(html.split(topic4Script).length - 1, 1);
  assert.equal(html.split(topic5Script).length - 1, 1);
  assert.equal(html.split(topic6Script).length - 1, 1);
  assert.match(
    html,
    /<script src="\.\.\/assets\/js\/lecture-player\.js" defer><\/script>\n<script type="module" src="\.\.\/assets\/js\/features\/english-topic4-viz\.js"><\/script>\n<script type="module" src="\.\.\/assets\/js\/features\/english-topic5-viz\.js"><\/script>\n<script type="module" src="\.\.\/assets\/js\/features\/english-topic6-viz\.js"><\/script>\n<\/body><\/html>$/
  );
  assert.equal(html.endsWith("\n"), false);
});
