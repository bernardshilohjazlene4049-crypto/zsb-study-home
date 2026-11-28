import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { mountEnglishTopic7Visuals } from "../assets/js/features/english-topic7-viz.js";
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

  for (let number = 1; number <= 15; number += 1) {
    const details = new ElementFixture("details");
    details.id = `point-7-${number}`;
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
    article.setAttribute("data-question", `7-${number}`);
    article.className = "question-card quiz-question";
    article.appendChild(new ElementFixture("div"));
    const feedback = new ElementFixture("div");
    feedback.className = "answer-feedback";
    article.appendChild(feedback);
    article.appendChild(new ElementFixture("footer"));
    articles.set(`7-${number}`, article);
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
      if (selector === 'link[data-english-topic7-style="true"]') {
        return head.children.find((child) => child.tagName === "link" && child.dataset.englishTopic7Style === "true") || null;
      }
      const match = selector.match(/^article\.quiz-question\[data-question="(7-\d+)"\]$/);
      return match ? articles.get(match[1]) || null : null;
    }
  };
}

test("专题七运行时把 15 张导图与 10 张练习图挂到正确容器，重复执行不重复插入", () => {
  const doc = makeFixtureDocument();
  assert.deepEqual(mountEnglishTopic7Visuals(doc), { mindmaps: 15, practices: 10 });

  for (let number = 1; number <= 15; number += 1) {
    const details = doc.getElementById(`point-7-${number}`);
    const content = details.querySelector(".point-content");
    const figure = content.firstChild;
    assert.equal(figure.tagName, "figure");
    assert.equal(figure.dataset.englishTopic7Visual, `mindmap-${number}`);
    assert.equal(figure.className, "english-topic7-visual english-topic7-visual--mindmap");
    const image = figure.querySelector("img");
    assert.equal(image.src, `../assets/mindmaps/english/topic7/point-7-${number}.svg`);
    assert.match(image.alt, new RegExp(`考点 7-${number}`));
    assert.equal(image.loading, "lazy");
    assert.equal(image.decoding, "async");
  }

  for (let number = 1; number <= 10; number += 1) {
    const article = doc.articles.get(`7-${number}`);
    const feedback = article.children.find((child) => child.className === "answer-feedback");
    const feedbackIndex = article.children.indexOf(feedback);
    const figure = article.children[feedbackIndex + 1];
    assert.equal(figure.tagName, "figure");
    assert.equal(figure.dataset.englishTopic7Visual, `practice-${number}`);
    const image = figure.querySelector("img");
    assert.equal(image.src, `../assets/mindmaps/english/topic7/quiz-7-${number}.svg`);
    assert.match(image.alt, new RegExp(`第 ${number} 题`));
  }

  assert.equal(doc.head.children.length, 1, "样式表只加载一次");
  assert.equal(doc.head.children[0].href, "../assets/js/features/english-topic7-viz.css");
  assert.deepEqual(mountEnglishTopic7Visuals(doc), { mindmaps: 0, practices: 0 });
  assert.equal(doc.head.children.length, 1);
});

test("专题七 25 份本地 SVG 齐全，保留讲义中的具体语境与交叉标注", () => {
  const answers = ["B", "C", "B", "A", "C", "D", "B", "C", "B", "D"];
  const related = [
    "7-2", "7-3", "7-6", "7-6", "7-7",
    "7-5", "7-13", "7-12,4-10", "7-8", "7-13"
  ];

  for (let number = 1; number <= 15; number += 1) {
    const relative = `assets/mindmaps/english/topic7/point-7-${number}.svg`;
    assert.equal(existsSync(path.join(root, relative)), true, `缺少 ${relative}`);
    const svg = read(relative);
    assert.match(svg, new RegExp(`data-point-id="point-7-${number}"`));
    assert.match(svg, /<title id="svg-title">/);
    assert.doesNotMatch(svg, /<script\b|(?:href|src)="https?:\/\//i);
  }

  for (let number = 1; number <= 10; number += 1) {
    const relative = `assets/mindmaps/english/topic7/quiz-7-${number}.svg`;
    assert.equal(existsSync(path.join(root, relative)), true, `缺少 ${relative}`);
    const svg = read(relative);
    assert.match(svg, new RegExp(`data-question="7-${number}"`));
    assert.match(svg, new RegExp(`data-answer="${answers[number - 1]}"`));
    assert.match(svg, new RegExp(`data-related-points="${related[number - 1]}"`));
    assert.doesNotMatch(svg, /<script\b|(?:href|src)="https?:\/\//i);
  }

  const point710 = read("assets/mindmaps/english/topic7/point-7-10.svg");
  assert.match(point710, /抽象 the unknown/);
  assert.match(point710, /不能机械按指一类人套复数/);

  const point711 = read("assets/mindmaps/english/topic7/point-7-11.svg");
  assert.match(point711, /What we need are books/);
  assert.match(point711, /表语 books/);
  assert.match(point711, /为复数的特殊意义一致/);

  const point713 = read("assets/mindmaps/english/topic7/point-7-13.svg");
  assert.match(point713, /One and a half hours have passed/);
  assert.match(point713, /也可用其他整体化结构/);

  const point714 = read("assets/mindmaps/english/topic7/point-7-14.svg");
  assert.match(point714, /None of the students are absent/);
  assert.match(point714, /is 在某些语境也可见/);
  assert.match(point714, /不宜出成无语境唯一答案题/);

  const point72 = read("assets/mindmaps/english/topic7/point-7-2.svg");
  assert.match(point72, /把主语顺序与空格位置画出来/);

  const quiz08 = read("assets/mindmaps/english/topic7/quiz-7-8.svg");
  assert.match(quiz08, /data-related-points="7-12,4-10"/);
  assert.doesNotMatch(quiz08, /href="#point-4|point-4-|english\.attributive/);
  assert.doesNotMatch(quiz08, /point-8-|english\.special/);
});

test("E1 仅补齐 english.agreement.basics 的专题七入口，104 点及其他英语专题保持不变", () => {
  assert.equal(Object.keys(TOPIC_KIT_BY_ID).length, 104);

  const agreement = TOPIC_KIT_BY_ID["english.agreement.basics"];
  assert.equal(agreement.mindmap.href, "yy/mm/mm3.svg");
  assert.equal(agreement.practice.visualHref, "yy/yy5.html#quiz-7");
  assert.equal(agreement.practice.hasLab, false);
  assert.deepEqual(agreement.extraLinks, [
    { label: "本专题逐点导图", href: "yy/yy5.html#points-7" }
  ]);
  assert.equal(agreement.lectureHref, "yy/yy5.html#topic-7");
  assert.equal(agreement.video.href, "yy/yy5/videos/04-agreement.mp4");

  const attributive = TOPIC_KIT_BY_ID["english.attributive.basics"];
  assert.equal(attributive.mindmap.href, "yy/mm/mm2.svg");
  assert.equal(attributive.practice.visualHref, "yy/yy5.html#quiz-4");
  assert.deepEqual(attributive.extraLinks, [
    { label: "本专题逐点导图", href: "yy/yy5.html#points-4" }
  ]);

  const noun = TOPIC_KIT_BY_ID["english.noun.basics"];
  assert.equal(noun.mindmap.href, "yy/mm/mm3.svg");
  assert.equal(noun.practice.visualHref, "yy/yy5.html#quiz-5");
  assert.deepEqual(noun.extraLinks, [
    { label: "本专题逐点导图", href: "yy/yy5.html#points-5" }
  ]);

  const adverbial = TOPIC_KIT_BY_ID["english.adverbial.basics"];
  assert.equal(adverbial.mindmap.href, "yy/mm/mm4.svg");
  assert.equal(adverbial.practice.visualHref, "yy/yy5.html#quiz-6");
  assert.deepEqual(adverbial.extraLinks, [
    { label: "本专题逐点导图", href: "yy/yy5.html#points-6" }
  ]);

  const special = TOPIC_KIT_BY_ID["english.special.basics"];
  assert.equal(special.mindmap.href, "yy/mm/mm4.svg");
  assert.equal(special.practice.visualHref, "yy/yy5.html#quiz-8");
  assert.equal(special.practice.hasLab, false);
  assert.deepEqual(special.extraLinks, [
    { label: "本专题逐点导图", href: "yy/yy5.html#points-8" }
  ]);
});

test("yy5 页尾按专题四至八顺序加载模块，v1 块不变且仍无尾换行", {
  skip: !existsSync(path.join(root, "yy/yy5.html")) && "完整 yy/yy5.html 未包含在离线上下文包中"
}, () => {
  const html = read("yy/yy5.html");
  const scripts = [
    '<script type="module" src="../assets/js/features/english-topic4-viz.js"></script>',
    '<script type="module" src="../assets/js/features/english-topic5-viz.js"></script>',
    '<script type="module" src="../assets/js/features/english-topic6-viz.js"></script>',
    '<script type="module" src="../assets/js/features/english-topic7-viz.js"></script>',
    '<script type="module" src="../assets/js/features/english-topic8-viz.js"></script>'
  ];
  for (const script of scripts) {
    assert.equal(html.split(script).length - 1, 1, `${script} 应恰好存在一次`);
  }
  assert.match(
    html,
    /<script src="\.\.\/assets\/js\/lecture-player\.js" defer><\/script>\n<script type="module" src="\.\.\/assets\/js\/features\/english-topic4-viz\.js"><\/script>\n<script type="module" src="\.\.\/assets\/js\/features\/english-topic5-viz\.js"><\/script>\n<script type="module" src="\.\.\/assets\/js\/features\/english-topic6-viz\.js"><\/script>\n<script type="module" src="\.\.\/assets\/js\/features\/english-topic7-viz\.js"><\/script>\n<script type="module" src="\.\.\/assets\/js\/features\/english-topic8-viz\.js"><\/script>\n<\/body><\/html>$/,
    "专题八脚本必须紧接专题七脚本，保留原无尾换行页尾"
  );
  assert.equal(html.endsWith("\n"), false);
  assert.equal((html.match(/<!-- videos-v1:start -->/g) || []).length, 5);
  assert.equal((html.match(/id="videos-v1-topic-7"/g) || []).length, 1);
});
