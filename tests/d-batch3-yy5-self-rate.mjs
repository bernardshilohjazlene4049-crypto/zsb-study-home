import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { normalizePagePayload } from "../assets/js/features/page-attempts.js";

const YY5_TOPIC_IDS = {
  "topic-4": "english.attributive.basics",
  "topic-5": "english.noun.basics",
  "topic-6": "english.adverbial.basics",
  "topic-7": "english.agreement.basics",
  "topic-8": "english.special.basics"
};

class TestElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = new Map();
    this.parentNode = null;
    this.textContent = "";
    this.id = "";
    this.className = "";
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  addEventListener(name, callback) {
    const list = this.listeners.get(name) || [];
    list.push(callback);
    this.listeners.set(name, list);
  }
  trigger(name) {
    for (const callback of this.listeners.get(name) || []) callback({ type: name, target: this });
  }
  matches(selector) {
    if (selector.includes(",")) {
      return selector.split(",").some((part) => this.matches(part.trim()));
    }
    if (selector === "[id]") return Boolean(this.id);
    if (selector === ".chapter, .topic-section") {
      const classes = this.className.split(/\s+/);
      return classes.includes("chapter") || classes.includes("topic-section");
    }
    if (selector === ".quiz-question[data-question][data-correct]") {
      return this.className.split(/\s+/).includes("quiz-question")
        && this.dataset.question !== undefined
        && this.dataset.correct !== undefined;
    }
    if (selector === ".choice[data-choice]") {
      return this.className.split(/\s+/).includes("choice") && this.dataset.choice !== undefined;
    }
    if (selector === "[data-zsb-question]") return this.dataset.zsbQuestion !== undefined;
    if (selector === "[data-zsb-rate]") return this.dataset.zsbRate !== undefined;
    if (selector.startsWith(".")) return this.className.split(/\s+/).includes(selector.slice(1));
    return false;
  }
  closest(selector) {
    for (let node = this; node; node = node.parentNode) {
      if (node.matches(selector)) return node;
    }
    return null;
  }
  querySelectorAll(selector) {
    const found = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.matches(selector)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

class TestCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
    this.bubbles = Boolean(options.bubbles);
  }
}

function mountYY5Page() {
  const root = new TestElement("body");
  const sections = [];
  for (let number = 4; number <= 8; number += 1) {
    const section = new TestElement("section");
    section.id = `topic-${number}`;
    section.className = "chapter section";
    const heading = new TestElement("div");
    heading.className = "chapter-heading";
    const main = new TestElement("div");
    main.className = "chapter-heading__main";
    const kicker = new TestElement("span");
    kicker.className = "chapter-kicker";
    kicker.textContent = `专题 0${number}`;
    const title = new TestElement("h2");
    title.id = `chapter-title-${number}`;
    title.className = "chapter-title";
    title.textContent = Object.keys(YY5_TOPIC_IDS).includes(`topic-${number}`)
      ? `专题标题${number}`
      : "";
    const stats = new TestElement("div");
    stats.className = "chapter-stats";
    stats.textContent = "10 道练习";
    main.appendChild(kicker);
    main.appendChild(title);
    main.appendChild(stats);
    const jumps = new TestElement("div");
    jumps.className = "chapter-jumps";
    for (const [label, href] of [["考点", `#points-${number}`], ["单词表", `#words-${number}`], ["练习题", `#quiz-${number}`]]) {
      const link = new TestElement("a");
      link.textContent = label;
      link.setAttribute("href", href);
      jumps.appendChild(link);
    }
    heading.appendChild(main);
    heading.appendChild(jumps);
    section.appendChild(heading);

    const video = new TestElement("div");
    video.id = `video-${number}`;
    video.className = "chapter-video";
    if (number === 4) {
      const facade = new TestElement("div");
      facade.className = "zsb-video";
      facade.setAttribute("data-video-src", "./yy5/videos/01-attributive.mp4");
      video.appendChild(facade);
    } else {
      const gallery = new TestElement("details");
      gallery.id = `videos-v1-topic-${number}`;
      gallery.className = "v1-videos";
      video.appendChild(gallery);
    }
    section.appendChild(video);

    root.appendChild(section);
    sections.push(section);
  }

  const excludedSections = [];
  for (const id of ["directory", "comparison", "uncertain"]) {
    const section = new TestElement("section");
    section.id = id;
    section.className = "chapter section";
    const heading = new TestElement("div");
    heading.className = "chapter-heading";
    const title = new TestElement("h2");
    title.className = "chapter-title";
    title.textContent = id;
    heading.appendChild(title);
    section.appendChild(heading);
    root.appendChild(section);
    excludedSections.push(section);
  }

  const listeners = new Map();
  const document = {
    currentScript: {
      src: "https://study.test/assets/js/page-study.js",
      dataset: {
        page: "yy5",
        subject: "english",
        legacyChoices: "liaoning.yy5.quiz.2026"
      }
    },
    title: "英语五专题",
    querySelector() { return null; },
    querySelectorAll(selector) { return root.querySelectorAll(selector); },
    getElementById(id) { return root.querySelectorAll("[id]").find((node) => node.id === id) || null; },
    createElement(tag) { return new TestElement(tag); },
    addEventListener(name, callback) {
      const list = listeners.get(name) || [];
      list.push(callback);
      listeners.set(name, list);
    },
    dispatchEvent(event) {
      for (const callback of listeners.get(event.type) || []) callback(event);
      return true;
    }
  };

  const calls = [];
  const source = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  const executable = source.replace(
    'import(new URL("assets/js/bridge-api.js", root).href)',
    "Promise.resolve(globalThis.__apiMock)"
  );
  runInNewContext(executable, {
    URL,
    location: { pathname: "/yy/yy5.html" },
    document,
    CustomEvent: TestCustomEvent,
    localStorage: { getItem() { return null; } },
    console,
    __apiMock: {
      async recordPageAttempt(input) {
        calls.push(input);
        return { attempt: { id: "test" } };
      }
    }
  });
  return { sections, excludedSections, calls };
}

test("pageKey=yy5 只为 topic-4…8 注入三档打卡并使用指定英语 topicIds", () => {
  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  const map = pageStudy.match(/var YY5_TOPIC_IDS = \{([\s\S]*?)\n  \};/);
  assert.ok(map, "缺少 yy5 专题映射");
  const entries = [...map[1].matchAll(/"(topic-\d+)": "(english\.[A-Za-z0-9_.]+)"/g)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(entries, Object.entries(YY5_TOPIC_IDS));
  assert.match(pageStudy, /var TOPIC_IDS_BY_PAGE = \{[\s\S]*?gs1:\s*GS1_TOPIC_IDS,[\s\S]*?gs45:\s*GS45_TOPIC_IDS,[\s\S]*?yy5:\s*YY5_TOPIC_IDS/);
  assert.match(pageStudy, /var topicIdsByAnchor = TOPIC_IDS_BY_PAGE\[pageKey\]/);
  assert.match(pageStudy, /section\.querySelector\("\.topic-header"\) \|\| section\.querySelector\("\.chapter-heading"\)/);
  assert.match(pageStudy, /header\.querySelector\("\.topic-title"\) \|\| header\.querySelector\("\.chapter-title"\)/);
  assert.match(pageStudy, /group\.dataset\.zsbTopicIds = topicIdsByAnchor\[anchor\]/);

  const { sections, excludedSections } = mountYY5Page();
  for (let number = 4; number <= 8; number += 1) {
    const section = sections[number - 4];
    const heading = section.querySelector(".chapter-heading");
    const group = heading.querySelector(".zsb-topic-rate");
    assert.ok(group, `topic-${number} 缺少标题打卡`);
    assert.equal(group.dataset.zsbQuestion, `topic-${number}`);
    assert.equal(group.dataset.zsbSubject, "english");
    assert.equal(group.dataset.zsbTopicIds, YY5_TOPIC_IDS[`topic-${number}`]);
    assert.deepEqual(
      group.querySelectorAll("[data-zsb-rate]").map((button) => button.dataset.zsbRate),
      ["good", "fuzzy", "again"]
    );
    assert.ok(heading.querySelector(".chapter-heading__main"), `topic-${number} 的标题主区被移除`);
    assert.ok(heading.querySelector(".chapter-kicker"), `topic-${number} 的 kicker 被移除`);
    assert.ok(heading.querySelector(".chapter-stats"), `topic-${number} 的 stats 被移除`);
    assert.ok(heading.querySelector(".chapter-jumps"), `topic-${number} 的 jumps 被移除`);
    assert.ok(heading.children.includes(group), `topic-${number} 的打卡没有放在 chapter-heading 内`);
  }
  for (const section of excludedSections) {
    assert.equal(section.querySelector(".zsb-topic-rate"), null, `${section.id} 不应出现打卡`);
  }
});

test("yy5 按钮提交 page:yy5:topic-N、subjectId=english 和显式 topicIds，习题仍绑定", async () => {
  const { sections, calls } = mountYY5Page();
  for (let number = 4; number <= 8; number += 1) {
    const group = sections[number - 4].querySelector(".zsb-topic-rate");
    group.querySelectorAll("[data-zsb-rate]")[0].trigger("click");
  }
  sections[2].querySelector(".zsb-topic-rate").querySelectorAll("[data-zsb-rate]")[1].trigger("click");
  sections[4].querySelector(".zsb-topic-rate").querySelectorAll("[data-zsb-rate]")[2].trigger("click");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.length, 7);
  for (let number = 4; number <= 8; number += 1) {
    const input = calls[number - 4];
    assert.equal(input.questionId, `page:yy5:topic-${number}`);
    assert.equal(input.subjectId, "english");
    assert.deepEqual(Array.from(input.topicIds), [YY5_TOPIC_IDS[`topic-${number}`]]);
    assert.equal(input.rating, "good");
    assert.equal(input.page.url, "yy/yy5.html");
    assert.equal(input.page.anchor, `topic-${number}`);
  }
  assert.equal(calls[5].questionId, "page:yy5:topic-6");
  assert.equal(calls[5].rating, "fuzzy");
  assert.deepEqual(Array.from(calls[5].topicIds), ["english.adverbial.basics"]);
  assert.equal(calls[6].questionId, "page:yy5:topic-8");
  assert.equal(calls[6].rating, "again");
  assert.deepEqual(Array.from(calls[6].topicIds), ["english.special.basics"]);
});

const yy5Path = fileURLToPath(new URL("../yy/yy5.html", import.meta.url));
test("真实 yy5 讲义保留唯一脚本、五专题、原有视频入口与 50 道习题", {
  skip: !existsSync(yy5Path) && "完整 yy/yy5.html 未包含在离线上下文包中"
}, () => {
  const html = readFileSync(yy5Path, "utf8");
  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  const script = '<script src="../assets/js/page-study.js" data-page="yy5" data-subject="english" data-legacy-choices="liaoning.yy5.quiz.2026"></script>';
  assert.equal(html.split(script).length - 1, 1, "page-study.js 脚本（含 data-legacy-choices）应恰好存在一次");
  assert.equal((html.match(/<script\b[^>]*page-study\.js\b/g) || []).length, 1, "不应重复添加 page-study.js");
  for (let number = 4; number <= 8; number += 1) {
    assert.ok(html.includes(`id="topic-${number}"`), `缺少 topic-${number}`);
    assert.ok(html.includes(`id="chapter-title-${number}"`), `缺少 chapter-title-${number}`);
    assert.ok(html.includes(`href="#points-${number}"`), `topic-${number} 缺少考点跳转`);
    assert.ok(html.includes(`href="#words-${number}"`), `topic-${number} 缺少单词表跳转`);
    assert.ok(html.includes(`href="#quiz-${number}"`), `topic-${number} 缺少练习题跳转`);
  }
  assert.match(html, /id="video-4"[\s\S]*?class="zsb-video"[\s\S]*?data-video-src="\.\/yy5\/videos\/01-attributive\.mp4"/);
  assert.doesNotMatch(html, /id="videos-v1-topic-4"/);
  for (let number = 5; number <= 8; number += 1) {
    assert.ok(html.includes(`id="video-${number}"`), `缺少 video-${number}`);
    assert.ok(html.includes(`id="videos-v1-topic-${number}"`), `缺少 videos-v1-topic-${number}`);
  }
  assert.equal((html.match(/<!-- videos-v1:start -->/g) || []).length, 5, "videos-v1:start 应保留原有 5 处");
  const quizQuestions = html.match(/<[^>]*class="[^"]*\bquiz-question\b[^"]*"(?=[^>]*\bdata-question=)(?=[^>]*\bdata-correct=)[^>]*>/g) || [];
  assert.equal(quizQuestions.length, 50, "yy5 应保留原有 50 道可绑定习题");
  assert.match(pageStudy, /document\.querySelectorAll\("\.quiz-question\[data-question\]\[data-correct\]"\)/, "原有 quiz-question 绑定选择器应保留");
  assert.doesNotMatch(html, /data-zsb-question=/, "讲义不应写入静态打卡控件");
});

test("yy5 打卡样式只依赖已引入的 overlay，并保留窄屏、焦点规则", () => {
  const css = readFileSync(new URL("../yy/yy5-overlay.css", import.meta.url), "utf8");
  assert.match(css, /\.chapter-heading > \.zsb-topic-rate/);
  assert.match(css, /\.chapter-heading > \.zsb-topic-rate \.sys-rate-btn:focus-visible/);
  assert.match(css, /@media \(max-width: 1023px\)[\s\S]*?\.chapter-heading \{\s*flex-wrap: wrap;/);
  assert.match(css, /\.chapter-heading > \.chapter-jumps,[\s\S]*?\.chapter-heading > \.zsb-topic-rate/);
  assert.match(css, /min-width: 0/);
});

const openedDatabases = [];

function createMemoryIndexedDB() {
  const databases = new Map();
  return {
    open(name, version) {
      openedDatabases.push({ name, version });
      const request = {};
      queueMicrotask(() => {
        let db = databases.get(name);
        if (!db) {
          db = createDatabase();
          databases.set(name, db);
          request.result = db;
          request.onupgradeneeded?.();
        } else {
          request.result = db;
        }
        request.onsuccess?.();
      });
      return request;
    }
  };
}

function createDatabase() {
  const stores = new Map();
  return {
    objectStoreNames: {
      contains(name) { return stores.has(name); }
    },
    createObjectStore(name, options = {}) {
      const rows = new Map();
      stores.set(name, { rows, keyPath: options.keyPath || "id" });
      return { createIndex() {} };
    },
    transaction(storeNames) {
      const tx = {
        error: null,
        objectStore(name) {
          const definition = stores.get(name);
          if (!definition) throw new Error(`Unknown object store: ${name}`);
          const { rows, keyPath } = definition;
          const requestFor = (operation) => {
            const request = { result: undefined, error: null };
            queueMicrotask(() => {
              try {
                request.result = operation();
                request.onsuccess?.({ target: request });
                tx.oncomplete?.();
              } catch (error) {
                request.error = error;
                tx.error = error;
                request.onerror?.({ target: request });
                tx.onerror?.({ target: tx });
              }
            });
            return request;
          };
          return {
            get(key) { return requestFor(() => rows.get(key) ?? undefined); },
            getAll() { return requestFor(() => [...rows.values()]); },
            put(value) {
              return requestFor(() => {
                const copy = structuredClone(value);
                rows.set(copy[keyPath], copy);
                return copy[keyPath];
              });
            },
            delete(key) { return requestFor(() => rows.delete(key)); },
            clear() { return requestFor(() => rows.clear()); }
          };
        }
      };
      return tx;
    }
  };
}

globalThis.indexedDB = createMemoryIndexedDB();
const { DB_NAME, DB_VERSION } = await import("../assets/js/core/schema.js");
const { getAll } = await import("../assets/js/core/storage.js");
const { commitSubmission } = await import("../assets/js/features/records.js");

async function submitPageRating({ anchor, topicId, rating }) {
  const payload = normalizePagePayload({
    questionId: `page:yy5:${anchor}`,
    subjectId: "english",
    topicIds: [topicId],
    rating,
    stem: `专题：${topicId}`,
    page: { url: "yy/yy5.html", title: "英语五专题", anchor }
  });
  return commitSubmission({
    question: {
      id: payload.questionId,
      revision: 1,
      subject_id: payload.subjectId,
      topic_ids: payload.topicIds,
      type: payload.type,
      stem: payload.stem,
      answer: payload.answer,
      provenance: { kind: "page", verified: true },
      source: "page-study"
    },
    response: payload.response,
    grading: payload.grading,
    understanding: payload.understanding,
    source: "study-bridge",
    page: payload.page
  });
}

test("yy5「会了」写入 attempts，并为新记录安排 7 天巩固", async () => {
  const result = await submitPageRating({
    anchor: "topic-4",
    topicId: "english.attributive.basics",
    rating: "good"
  });
  assert.equal(result.attempt.question_id, "page:yy5:topic-4");
  assert.deepEqual(result.attempt.topic_ids, ["english.attributive.basics"]);
  assert.equal(result.attempt.subject_id, "english");
  assert.equal(result.attempt.grading.status, "correct");
  assert.equal(result.attempt.understanding, "mastered");
  assert.equal(result.decision.schedule.interval_days, 7);
  assert.equal(result.mistake.category, "consolidate");
  assert.equal(
    Date.parse(result.mistake.next_review_at) - Date.parse(result.attempt.submitted_at),
    7 * 24 * 60 * 60 * 1000
  );
  const attempts = await getAll("attempts");
  assert.ok(attempts.some((item) => item.id === result.attempt.id));
});

test("yy5「不会」写入同一 attempts 与 mistake_entries，并保留 english.special.basics 归属", async () => {
  const result = await submitPageRating({
    anchor: "topic-8",
    topicId: "english.special.basics",
    rating: "again"
  });
  assert.equal(result.attempt.question_id, "page:yy5:topic-8");
  assert.deepEqual(result.attempt.topic_ids, ["english.special.basics"]);
  assert.equal(result.attempt.grading.status, "incorrect");
  assert.equal(result.mistake.category, "wrong");
  const attempts = await getAll("attempts");
  const mistakes = await getAll("mistake_entries");
  assert.ok(attempts.some((item) => item.question_id === "page:yy5:topic-8"));
  assert.ok(mistakes.some((item) => item.question_id === "page:yy5:topic-8" && item.category === "wrong"));
});

test("yy5 复用 zsb-study v1，不创建第二套数据库或 localStorage 打卡", async () => {
  assert.equal(DB_NAME, "zsb-study");
  assert.equal(DB_VERSION, 1);
  assert.deepEqual(openedDatabases, [{ name: "zsb-study", version: 1 }]);
  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  const bridge = readFileSync(new URL("../assets/js/bridge-api.js", import.meta.url), "utf8");
  assert.match(pageStudy, /recordPageAttempt\(input\)/);
  assert.match(bridge, /import \{ commitSubmission \} from "\.\/features\/records\.js"/);
  assert.doesNotMatch(pageStudy, /localStorage\.setItem/);
});
