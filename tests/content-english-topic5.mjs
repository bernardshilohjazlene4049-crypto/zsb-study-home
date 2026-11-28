import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { mountEnglishTopic5Visuals } from "../assets/js/features/english-topic5-viz.js";
import { TOPIC_KIT_BY_ID } from "../assets/js/features/topic-kit-data.js";

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
    this.id = "";
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
    details.id = `point-5-${number}`;
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
    article.setAttribute("data-question", `5-${number}`);
    article.className = "question-card quiz-question";
    article.appendChild(new ElementFixture("div"));
    const feedback = new ElementFixture("div");
    feedback.className = "answer-feedback";
    article.appendChild(feedback);
    article.appendChild(new ElementFixture("footer"));
    articles.set(`5-${number}`, article);
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
      if (selector === 'link[data-english-topic5-style="true"]') {
        return head.children.find((child) => child.tagName === "link" && child.dataset.englishTopic5Style === "true") || null;
      }
      const match = selector.match(/^article\.quiz-question\[data-question="(5-\d+)"\]$/);
      return match ? articles.get(match[1]) || null : null;
    }
  };
}

test("专题五运行时把 13 张导图与 10 张练习图挂到正确容器，重复执行不重复插入", () => {
  const doc = makeFixtureDocument();
  const first = mountEnglishTopic5Visuals(doc);
  assert.deepEqual(first, { mindmaps: 13, practices: 10 });

  for (let number = 1; number <= 13; number += 1) {
    const details = doc.getElementById(`point-5-${number}`);
    const content = details.querySelector(".point-content");
    const figure = content.firstChild;
    assert.equal(figure.tagName, "figure");
    assert.equal(figure.dataset.englishTopic5Visual, `mindmap-${number}`);
    assert.equal(figure.className, "english-topic5-visual english-topic5-visual--mindmap");
    const image = figure.querySelector("img");
    assert.equal(image.src, `../assets/mindmaps/english/topic5/point-5-${number}.svg`);
    assert.match(image.alt, new RegExp(`考点 5-${number}`));
    assert.equal(image.loading, "lazy");
    assert.equal(image.decoding, "async");
  }

  for (let number = 1; number <= 10; number += 1) {
    const article = doc.articles.get(`5-${number}`);
    const feedback = article.children.find((child) => child.className === "answer-feedback");
    const feedbackIndex = article.children.indexOf(feedback);
    const figure = article.children[feedbackIndex + 1];
    assert.equal(figure.tagName, "figure");
    assert.equal(figure.dataset.englishTopic5Visual, `practice-${number}`);
    const image = figure.querySelector("img");
    assert.equal(image.src, `../assets/mindmaps/english/topic5/quiz-5-${number}.svg`);
    assert.match(image.alt, new RegExp(`第 ${number} 题`));
  }

  assert.equal(doc.head.children.length, 1, "样式表只加载一次");
  assert.equal(doc.head.children[0].href, "../assets/css/english-topic5-viz.css");
  assert.deepEqual(mountEnglishTopic5Visuals(doc), { mindmaps: 0, practices: 0 });
  assert.equal(doc.head.children.length, 1);
});

test("专题五 23 份本地 SVG 完整，答案、存疑口径与交叉标注均按源稿保留", () => {
  const answers = ["A", "C", "B", "D", "B", "C", "A", "D", "B", "C"];
  for (let number = 1; number <= 13; number += 1) {
    const relative = `assets/mindmaps/english/topic5/point-5-${number}.svg`;
    assert.equal(existsSync(path.join(root, relative)), true, `缺少 ${relative}`);
    const svg = read(relative);
    assert.match(svg, new RegExp(`data-point-id="point-5-${number}"`));
    assert.match(svg, /<title id="svg-title">/);
    assert.doesNotMatch(svg, /<script\b|(?:href|src)="https?:\/\//i);
  }

  for (let number = 1; number <= 10; number += 1) {
    const relative = `assets/mindmaps/english/topic5/quiz-5-${number}.svg`;
    assert.equal(existsSync(path.join(root, relative)), true, `缺少 ${relative}`);
    const svg = read(relative);
    assert.match(svg, new RegExp(`data-question="5-${number}"`));
    assert.match(svg, new RegExp(`data-answer="${answers[number - 1]}"`));
    assert.doesNotMatch(svg, /<script\b|(?:href|src)="https?:\/\//i);
  }

  const point52 = read("assets/mindmaps/english/topic5/point-5-2.svg");
  assert.match(point52, /【看不清】Who\/What we went study for is a question/);
  assert.match(point52, /句法不完整 原样保留 暂不据此判断 Who\/What 的答案/);
  assert.doesNotMatch(point52, /(?:答案为|正确答案是)\s*(?:Who|What)/i);

  const point53 = read("assets/mindmaps/english/topic5/point-5-3.svg");
  assert.match(point53, /见专题七/);
  assert.doesNotMatch(point53, /href=|point-7|english\.agreement/);

  const quiz09 = read("assets/mindmaps/english/topic5/quiz-5-9.svg");
  assert.match(quiz09, /data-related-points="5-12,5-2"/);
  assert.doesNotMatch(quiz09, /7-12|point-7|english\.agreement/);
});

test("E1 仅补齐 english.noun.basics 的专题五入口，104 点及其他英语专题保持不变", () => {
  assert.equal(Object.keys(TOPIC_KIT_BY_ID).length, 104);
  const noun = TOPIC_KIT_BY_ID["english.noun.basics"];
  assert.equal(noun.mindmap.href, "yy/mm/mm3.svg");
  assert.equal(noun.practice.visualHref, "yy/yy5.html#quiz-5");
  assert.equal(noun.practice.hasLab, false);
  assert.deepEqual(noun.extraLinks, [
    { label: "本专题逐点导图", href: "yy/yy5.html#points-5" }
  ]);

  const attributive = TOPIC_KIT_BY_ID["english.attributive.basics"];
  assert.equal(attributive.mindmap.href, "yy/mm/mm2.svg");
  assert.equal(attributive.practice.visualHref, "yy/yy5.html#quiz-4");
  assert.deepEqual(attributive.extraLinks, [
    { label: "本专题逐点导图", href: "yy/yy5.html#points-4" }
  ]);
  const adverbial = TOPIC_KIT_BY_ID["english.adverbial.basics"];
  assert.equal(adverbial.mindmap.href, "yy/mm/mm4.svg");
  assert.equal(adverbial.practice.visualHref, "yy/yy5.html#quiz-6");
  assert.equal(adverbial.practice.hasLab, false);
  assert.deepEqual(adverbial.extraLinks, [
    { label: "本专题逐点导图", href: "yy/yy5.html#points-6" }
  ]);
  assert.equal(TOPIC_KIT_BY_ID["english.agreement.basics"].mindmap.href, "yy/mm/mm3.svg");
  assert.equal(TOPIC_KIT_BY_ID["english.special.basics"].mindmap.href, "yy/mm/mm4.svg");
});

test("yy5 页尾在专题四模块之后仅增加专题五模块，并保留原有 v1 块与无尾换行", {
  skip: !existsSync(path.join(root, "yy/yy5.html")) && "完整 yy/yy5.html 未包含在离线上下文包中"
}, () => {
  const html = read("yy/yy5.html");
  const topic4 = '<script type="module" src="../assets/js/features/english-topic4-viz.js"></script>';
  const topic5 = '<script type="module" src="../assets/js/features/english-topic5-viz.js"></script>';
  const topic6 = '<script type="module" src="../assets/js/features/english-topic6-viz.js"></script>';
  assert.equal(html.split(topic4).length - 1, 1, "专题四模块仍只加载一次");
  assert.equal(html.split(topic5).length - 1, 1, "专题五模块应恰好加载一次");
  assert.equal(html.split(topic6).length - 1, 1, "专题六模块应恰好加载一次");
  assert.match(
    html,
    /<script src="\.\.\/assets\/js\/lecture-player\.js" defer><\/script>\n<script type="module" src="\.\.\/assets\/js\/features\/english-topic4-viz\.js"><\/script>\n<script type="module" src="\.\.\/assets\/js\/features\/english-topic5-viz\.js"><\/script>\n<script type="module" src="\.\.\/assets\/js\/features\/english-topic6-viz\.js"><\/script>\n<\/body><\/html>$/,
    "专题六脚本必须紧接专题五脚本，保留原无尾换行页尾"
  );
  assert.equal(html.endsWith("\n"), false);
  assert.equal((html.match(/<!-- videos-v1:start -->/g) || []).length, 5);
  assert.equal((html.match(/id="videos-v1-topic-5"/g) || []).length, 1);
});
