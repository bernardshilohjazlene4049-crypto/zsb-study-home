import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { normalizePagePayload } from "../assets/js/features/page-attempts.js";

const GS45_TOPIC_IDS = Object.fromEntries(
  Array.from({ length: 13 }, (_, index) => [`point-${index + 36}`, `math.p${index + 36}`])
);

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
    if (selector === ".chapter, .topic-section") {
      const classes = this.className.split(/\s+/);
      return classes.includes("topic-section") || classes.includes("chapter");
    }
    if (selector === ".chapter-title, .topic-title") {
      const classes = this.className.split(/\s+/);
      return classes.includes("chapter-title") || classes.includes("topic-title");
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

function mountGs45Page() {
  const sections = [];
  const links = new Map();
  let existingExercise = null;
  for (let number = 36; number <= 48; number += 1) {
    const section = new TestElement("section");
    section.id = `point-${number}`;
    section.className = "section topic-section";
    const header = new TestElement("div");
    header.className = "topic-header";
    const title = new TestElement("h2");
    title.className = "topic-title";
    title.textContent = `考点${number}`;
    header.appendChild(title);
    section.appendChild(header);
    if ([38, 40, 44, 45, 48].includes(number)) {
      const link = new TestElement("a");
      link.className = "video-jump";
      link.setAttribute("href", `#video-${number}`);
      link.textContent = "跳到讲解视频";
      header.appendChild(link);
      links.set(number, link);
    }
    if (number === 37) {
      existingExercise = new TestElement("div");
      existingExercise.dataset.zsbQuestion = "viz-37-4";
      existingExercise.dataset.zsbSubject = "math";
      existingExercise.dataset.zsbTopicIds = "math.p37";
      existingExercise.dataset.zsbStem = "已有可视化习题";
      const existingRate = new TestElement("button");
      existingRate.dataset.zsbRate = "good";
      existingExercise.appendChild(existingRate);
      section.appendChild(existingExercise);
    }
    sections.push(section);
  }

  const listeners = new Map();
  const document = {
    currentScript: {
      src: "https://study.test/assets/js/page-study.js",
      dataset: { page: "gs45", subject: "math" }
    },
    title: "高等数学",
    querySelector() { return null; },
    querySelectorAll(selector) {
      if (selector === ".quiz-question[data-question][data-correct]" || selector === ".quiz") return [];
      if (selector === "[data-zsb-question]") {
        return sections.flatMap((section) => section.querySelectorAll("[data-zsb-question]"));
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
    location: { pathname: "/gs/gs45.html" },
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
  return { sections, links, existingExercise, calls };
}

test("pageKey=gs45 按表为 13 个考点注入三档打卡并显式绑定 topicIds", () => {
  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  const map = pageStudy.match(/var GS45_TOPIC_IDS = \{([\s\S]*?)\n  \};/);
  assert.ok(map, "缺少 gs45 考点映射");
  const entries = [...map[1].matchAll(/"(point-\d+)": "(math\.p\d+)"/g)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(entries, Object.entries(GS45_TOPIC_IDS));
  assert.match(pageStudy, /var TOPIC_IDS_BY_PAGE = \{[\s\S]*?gs1:\s*GS1_TOPIC_IDS,[\s\S]*?gs45:\s*GS45_TOPIC_IDS/);
  assert.match(pageStudy, /var topicIdsByAnchor = TOPIC_IDS_BY_PAGE\[pageKey\]/);
  assert.match(pageStudy, /group\.dataset\.zsbTopicIds = topicIdsByAnchor\[anchor\]/);

  const { sections, links, existingExercise } = mountGs45Page();
  for (let number = 36; number <= 48; number += 1) {
    const section = sections[number - 36];
    const group = section.querySelector(".zsb-topic-rate");
    assert.ok(group, `point-${number} 缺少标题打卡`);
    assert.equal(group.dataset.zsbQuestion, `point-${number}`);
    assert.equal(group.dataset.zsbSubject, "math");
    assert.equal(group.dataset.zsbTopicIds, `math.p${number}`);
    assert.deepEqual(
      group.querySelectorAll("[data-zsb-rate]").map((button) => button.dataset.zsbRate),
      ["good", "fuzzy", "again"]
    );
  }
  for (const number of [38, 40, 44, 45, 48]) {
    const header = sections[number - 36].querySelector(".topic-header");
    const link = links.get(number);
    const group = header.querySelector(".zsb-topic-rate");
    assert.ok(header.children.includes(link), `point-${number} 的视频跳转链接被移除`);
    assert.ok(header.children.indexOf(link) < header.children.indexOf(group), `point-${number} 的视频跳转链接顺序被改变`);
  }
  assert.ok(sections[1].children.includes(existingExercise), "已有 viz-37-4 习题组被移除");
});

test("gs45 的按钮提交稳定 questionId、subjectId、topicIds 和页面锚点", async () => {
  const { sections, existingExercise, calls } = mountGs45Page();
  for (let number = 36; number <= 48; number += 1) {
    sections[number - 36].querySelector(".zsb-topic-rate")
      .querySelectorAll("[data-zsb-rate]")[0].trigger("click");
  }
  existingExercise.querySelector("[data-zsb-rate]").trigger("click");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.length, 14);
  for (let number = 36; number <= 48; number += 1) {
    const input = calls[number - 36];
    assert.equal(input.questionId, `page:gs45:point-${number}`);
    assert.equal(input.subjectId, "math");
    assert.deepEqual(Array.from(input.topicIds), [`math.p${number}`]);
    assert.equal(input.rating, "good");
    assert.equal(input.page.url, "gs/gs45.html");
    assert.equal(input.page.anchor, `point-${number}`);
  }
  assert.equal(calls[13].questionId, "page:gs45:viz-37-4");
  assert.equal(calls[13].subjectId, "math");
  assert.deepEqual(Array.from(calls[13].topicIds), ["math.p37"]);
});

const gs45Path = fileURLToPath(new URL("../gs/gs45.html", import.meta.url));
test("真实 gs45 讲义保留唯一接入脚本、13 个标题、视频跳转与既有习题", {
  skip: !existsSync(gs45Path) && "完整 gs/gs45.html 未包含在离线上下文包中"
}, () => {
  const html = readFileSync(gs45Path, "utf8");
  const script = '<script src="../assets/js/page-study.js" data-page="gs45" data-subject="math"></script>';
  assert.equal(html.split(script).length - 1, 1, "page-study.js 脚本应恰好存在一次");
  for (let number = 36; number <= 48; number += 1) {
    const start = html.indexOf(`id="point-${number}"`);
    assert.notEqual(start, -1, `缺少 point-${number}`);
    const next = number < 48 ? html.indexOf(`id="point-${number + 1}"`, start + 1) : html.length;
    const fragment = html.slice(start, next === -1 ? html.length : next);
    assert.match(fragment, /<div class="topic-header">[\s\S]*?<h2 class="topic-title">/, `point-${number} 标题结构不符`);
  }
  for (const anchor of ["video-plane-line", "video-partial-dz", "video-extremum", "video-double-integral"]) {
    assert.ok(html.includes(`href="#${anchor}"`), `缺少已有视频跳转 ${anchor}`);
  }
  assert.ok(html.includes("viz-37-4"), "缺少已有 viz-37-4 习题");
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
    questionId: `page:gs45:${anchor}`,
    subjectId: "math",
    topicIds: [topicId],
    rating,
    stem: `考点：${topicId}`,
    page: { url: "gs/gs45.html", title: "高等数学", anchor }
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

test("gs45「会了」写入 attempts，并为新记录安排 7 天巩固", async () => {
  const result = await submitPageRating({
    anchor: "point-36",
    topicId: "math.p36",
    rating: "good"
  });
  assert.equal(result.attempt.question_id, "page:gs45:point-36");
  assert.deepEqual(result.attempt.topic_ids, ["math.p36"]);
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

test("gs45「不会」写入同一 attempts 与 mistake_entries，并保留 math.p37 归属", async () => {
  const result = await submitPageRating({
    anchor: "point-37",
    topicId: "math.p37",
    rating: "again"
  });
  assert.equal(result.attempt.question_id, "page:gs45:point-37");
  assert.deepEqual(result.attempt.topic_ids, ["math.p37"]);
  assert.equal(result.attempt.grading.status, "incorrect");
  assert.equal(result.mistake.category, "wrong");
  const attempts = await getAll("attempts");
  const mistakes = await getAll("mistake_entries");
  assert.ok(attempts.some((item) => item.question_id === "page:gs45:point-37"));
  assert.ok(mistakes.some((item) => item.question_id === "page:gs45:point-37" && item.category === "wrong"));
});

test("gs45 复用 zsb-study v1，不创建第二套数据库或 localStorage 打卡", async () => {
  assert.equal(DB_NAME, "zsb-study");
  assert.equal(DB_VERSION, 1);
  assert.deepEqual(openedDatabases, [{ name: "zsb-study", version: 1 }]);
  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  const bridge = readFileSync(new URL("../assets/js/bridge-api.js", import.meta.url), "utf8");
  assert.match(pageStudy, /recordPageAttempt\(input\)/);
  assert.match(bridge, /import \{ commitSubmission \} from "\.\/features\/records\.js"/);
  assert.doesNotMatch(pageStudy, /localStorage\.setItem/);
});
