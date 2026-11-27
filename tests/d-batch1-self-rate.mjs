import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { normalizePagePayload } from "../assets/js/features/page-attempts.js";


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
    if (selector === "[id]") return Boolean(this.id);
    if (selector === ".chapter, .topic-section") return this.className.split(/\s+/).includes("topic-section") || this.className.split(/\s+/).includes("chapter");
    if (selector.startsWith(".")) return this.className.split(/\s+/).includes(selector.slice(1));
    if (selector === "[data-zsb-question]") return this.dataset.zsbQuestion !== undefined;
    if (selector === "[data-zsb-rate]") return this.dataset.zsbRate !== undefined;
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

function mountPageStudy() {
  const sections = [];
  for (let number = 1; number <= 11; number += 1) {
    const section = new TestElement("section");
    section.id = `point-${number}`;
    section.className = "topic-section";
    const header = new TestElement("header");
    header.className = "topic-header";
    const title = new TestElement("h2");
    title.className = "topic-title";
    title.textContent = `考点${number}`;
    header.appendChild(title);
    section.appendChild(header);
    sections.push(section);
  }
  const groups = [];
  const listeners = new Map();
  const document = {
    currentScript: {
      src: "https://study.test/assets/js/page-study.js",
      dataset: { page: "gs1", subject: "math" }
    },
    title: "高等数学",
    querySelector() { return null; },
    querySelectorAll(selector) {
      if (selector === ".quiz-question[data-question][data-correct]" || selector === ".quiz") return [];
      if (selector === "[data-zsb-question]") {
        groups.splice(0, groups.length, ...sections.flatMap((section) => section.querySelectorAll("[data-zsb-question]")));
        return groups;
      }
      return [];
    },
    getElementById(id) { return sections.find((section) => section.id === id) || null; },
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
    location: { pathname: "/gs/gs1.html" },
    document,
    CustomEvent: TestCustomEvent,
    console,
    __apiMock: {
      async recordPageAttempt(input) {
        calls.push(input);
        return { attempt: { id: "test" } };
      }
    }
  });
  return { sections, calls };
}

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
    questionId: `page:gs1:${anchor}`,
    subjectId: "math",
    topicIds: [topicId],
    rating,
    stem: `考点：${topicId}`,
    page: { url: "gs/gs1.html", title: "第一章 函数、极限、连续", anchor }
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

test("gs1 的 11 个知识点在标题区注入三档打卡并显式绑定 topicId", () => {
  const html = readFileSync(new URL("../gs/gs1.html", import.meta.url), "utf8");
  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../assets/css/gs-points.css", import.meta.url), "utf8");

  assert.equal(
    (html.match(/<script src="\.\.\/assets\/js\/page-study\.js" data-page="gs1" data-subject="math"><\/script>/g) || []).length,
    1
  );
  const map = pageStudy.match(/var GS1_TOPIC_IDS = \{([\s\S]*?)\n  \};/);
  assert.ok(map, "缺少 gs1 考点映射");
  const entries = [...map[1].matchAll(/"(point-\d+)": "(math\.[A-Za-z0-9_]+)"/g)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(entries, [
    ["point-1", "math.domain"],
    ["point-2", "math.function_properties"],
    ["point-3", "math.sequence_limit"],
    ["point-4", "math.function_limit"],
    ["point-5", "math.infinitesimal"],
    ["point-6", "math.equivalent"],
    ["point-7", "math.important_limits"],
    ["point-8", "math.asymptote"],
    ["point-9", "math.continuity"],
    ["point-10", "math.discontinuity"],
    ["point-11", "math.continuous_properties"]
  ]);
  assert.match(pageStudy, /group\.dataset\.zsbQuestion = anchor/);
  assert.match(pageStudy, /group\.dataset\.zsbTopicIds = GS1_TOPIC_IDS\[anchor\]/);
  assert.match(pageStudy, /topicIds: box\.dataset\.zsbTopicIds/);
  assert.match(pageStudy, /topicIds: d\.topicIds/);
  assert.match(pageStudy, /recordPageAttempt\(input\)/);
  assert.match(css, /\.zsb-topic-rate/);
  assert.match(css, /:focus-visible/);
});

test("gs1 标题旁按钮点击后提交稳定 questionId、subjectId 与 topicIds", async () => {
  const { sections, calls } = mountPageStudy();
  const group = sections[0].querySelector("[data-zsb-question]");
  assert.ok(group);
  const buttons = group.querySelectorAll("[data-zsb-rate]");
  assert.deepEqual(buttons.map((button) => button.dataset.zsbRate), ["good", "fuzzy", "again"]);
  buttons[0].trigger("click");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].questionId, "page:gs1:point-1");
  assert.equal(calls[0].subjectId, "math");
  assert.deepEqual(Array.from(calls[0].topicIds), ["math.domain"]);
  assert.equal(calls[0].rating, "good");
  assert.equal(calls[0].page.url, "gs/gs1.html");
  assert.equal(calls[0].page.anchor, "point-1");
});

test("「会了」经现有提交链写入 attempts，并为新记录安排 7 天巩固", async () => {
  const result = await submitPageRating({
    anchor: "point-1",
    topicId: "math.domain",
    rating: "good"
  });
  assert.equal(result.attempt.question_id, "page:gs1:point-1");
  assert.deepEqual(result.attempt.topic_ids, ["math.domain"]);
  assert.equal(result.attempt.subject_id, "math");
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

test("「不会」写入同一 attempts 与 mistake_entries，并保留考点归属", async () => {
  const result = await submitPageRating({
    anchor: "point-2",
    topicId: "math.function_properties",
    rating: "again"
  });
  assert.equal(result.attempt.question_id, "page:gs1:point-2");
  assert.deepEqual(result.attempt.topic_ids, ["math.function_properties"]);
  assert.equal(result.attempt.grading.status, "incorrect");
  assert.equal(result.mistake.category, "wrong");

  const attempts = await getAll("attempts");
  const mistakes = await getAll("mistake_entries");
  assert.ok(attempts.some((item) => item.question_id === "page:gs1:point-2"));
  assert.ok(mistakes.some((item) => item.question_id === "page:gs1:point-2" && item.category === "wrong"));
});

test("正文页记录沿用 zsb-study v1，不另建数据库或第二套打卡存储", async () => {
  assert.equal(DB_NAME, "zsb-study");
  assert.equal(DB_VERSION, 1);
  assert.deepEqual(openedDatabases, [{ name: "zsb-study", version: 1 }]);

  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  const bridge = readFileSync(new URL("../assets/js/bridge-api.js", import.meta.url), "utf8");
  assert.match(pageStudy, /assets\/js\/bridge-api\.js/);
  assert.match(pageStudy, /recordPageAttempt\(input\)/);
  assert.match(bridge, /import \{ commitSubmission \} from "\.\/features\/records\.js"/);
  assert.doesNotMatch(pageStudy, /localStorage\.setItem/);
});

test("stage4 原文哈希仍按原规则剥离新增接入脚本", () => {
  const stage4 = readFileSync(new URL("./stage4-gs-points.mjs", import.meta.url), "utf8");
  assert.match(stage4, /page-study\.js.*data-page="gs1".*data-subject="math"/);
  assert.match(stage4, /rest\.split\(legacyDomainVideo\)\.length, 2/);
  assert.match(stage4, /rest\.split\(domainVideoLink\)\.length, 2/);
});
