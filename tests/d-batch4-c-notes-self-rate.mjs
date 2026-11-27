import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { normalizePagePayload } from "../assets/js/features/page-attempts.js";

const C_NOTES_TOPIC_IDS = {
  "point-1": "c.ch1.intro",
  "point-2": "c.ch1.structure",
  "point-3": "c.ch1.compile",
  "point-4": "c.ch2.identifier",
  "point-5": "c.ch2.constants",
  "point-6": "c.ch2.datatypes",
  "point-7": "c.ch3.priority",
  "point-8": "c.ch3.arith_logic",
  "point-9": "c.ch3.assign_comma",
  "point-10": "c.ch4.io_concept",
  "point-11": "c.ch4.printf",
  "point-12": "c.ch4.scanf_char_str",
  "point-13": "c.ch5.truth_if",
  "point-14": "c.ch5.nested_ternary",
  "point-15": "c.ch5.switch",
  "point-16": "c.ch6.while_dowhile",
  "point-17": "c.ch6.for_loop",
  "point-18": "c.ch6.control_coding",
  "point-19": "c.ch7.array1d",
  "point-20": "c.ch7.array2d",
  "point-21": "c.ch7.char_array",
  "point-22": "c.ch8.def_call",
  "point-23": "c.ch8.decl_pass",
  "point-24": "c.ch8.scope_static",
  "point-25": "c.ch9.ptr_basics",
  "point-26": "c.ch9.ptr_array1d",
  "point-27": "c.ch9.ptr_array2d_param"
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

function mountCNotesPage() {
  const root = new TestElement("body");
  const aside = new TestElement("aside");
  aside.className = "study-index";
  const indexLink = new TestElement("a");
  indexLink.setAttribute("href", "#overview");
  indexLink.textContent = "考前速记口诀表";
  aside.appendChild(indexLink);
  root.appendChild(aside);

  const overview = new TestElement("section");
  overview.id = "overview";
  overview.className = "topic-section";
  const overviewHeader = new TestElement("header");
  overviewHeader.className = "topic-header";
  const overviewTitle = new TestElement("h2");
  overviewTitle.className = "topic-title";
  overviewTitle.textContent = "全 9 章直达导航与考前必背口诀总表";
  overviewHeader.appendChild(overviewTitle);
  overview.appendChild(overviewHeader);
  root.appendChild(overview);

  const sections = [];
  for (let number = 1; number <= 27; number += 1) {
    const section = new TestElement("section");
    section.id = `point-${number}`;
    section.className = "topic-section";

    // The existing videos-v1 gallery stays before the title header.
    const gallery = new TestElement("details");
    gallery.id = `videos-v1-point-${number}`;
    gallery.className = "v1-videos";
    section.appendChild(gallery);

    const header = new TestElement("header");
    header.className = "topic-header";
    const numberLabel = new TestElement("span");
    numberLabel.className = "topic-number";
    numberLabel.textContent = String(number).padStart(2, "0");
    const chapterTag = new TestElement("p");
    chapterTag.className = "topic-chapter-tag";
    chapterTag.textContent = "C 语言章节标签";
    const title = new TestElement("h2");
    title.className = "topic-title";
    title.textContent = `C 语言知识点 ${number}`;
    header.appendChild(numberLabel);
    header.appendChild(chapterTag);
    header.appendChild(title);
    section.appendChild(header);

    root.appendChild(section);
    sections.push(section);
  }

  const listeners = new Map();
  const document = {
    currentScript: {
      src: "https://study.test/assets/js/page-study.js",
      dataset: { page: "c-notes", subject: "c_language" }
    },
    title: "C 语言讲义",
    querySelector() { return null; },
    querySelectorAll(selector) { return root.querySelectorAll(selector); },
    getElementById(id) {
      return root.querySelectorAll("[id]").find((node) => node.id === id) || null;
    },
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
    location: { pathname: "/c/notes.html" },
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
  return { aside, indexLink, overview, sections, calls };
}

test("pageKey=c-notes 只为 point-1…27 注入三档打卡并显式绑定 27 个 C 语言 topicIds", () => {
  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  const map = pageStudy.match(/var C_NOTES_TOPIC_IDS = \{([\s\S]*?)\n  \};/);
  assert.ok(map, "缺少 c-notes 27 点映射");
  const entries = [...map[1].matchAll(/"(point-\d+)": "(c\.[A-Za-z0-9_.]+)"/g)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(entries, Object.entries(C_NOTES_TOPIC_IDS));
  assert.equal(entries.length, 27);
  assert.match(pageStudy, /var TOPIC_IDS_BY_PAGE = \{[\s\S]*?gs1:\s*GS1_TOPIC_IDS,[\s\S]*?gs45:\s*GS45_TOPIC_IDS,[\s\S]*?yy5:\s*YY5_TOPIC_IDS,[\s\S]*?"c-notes":\s*C_NOTES_TOPIC_IDS/);
  assert.match(pageStudy, /var topicIdsByAnchor = TOPIC_IDS_BY_PAGE\[pageKey\]/);
  assert.match(pageStudy, /group\.dataset\.zsbQuestion = anchor/);
  assert.match(pageStudy, /group\.dataset\.zsbTopicIds = topicIdsByAnchor\[anchor\]/);

  const { aside, indexLink, overview, sections } = mountCNotesPage();
  assert.equal(overview.querySelector(".zsb-topic-rate"), null, "#overview 不应出现打卡");
  assert.equal(aside.querySelector(".zsb-topic-rate"), null, "侧栏不应出现打卡");
  assert.equal(indexLink.attributes.href, "#overview");

  for (let number = 1; number <= 27; number += 1) {
    const section = sections[number - 1];
    const header = section.querySelector(".topic-header");
    const group = header.querySelector(".zsb-topic-rate");
    assert.ok(group, `point-${number} 缺少标题打卡`);
    assert.equal(group.dataset.zsbQuestion, `point-${number}`);
    assert.equal(group.dataset.zsbSubject, "c_language");
    assert.equal(group.dataset.zsbTopicIds, C_NOTES_TOPIC_IDS[`point-${number}`]);
    assert.deepEqual(
      group.querySelectorAll("[data-zsb-rate]").map((button) => button.dataset.zsbRate),
      ["good", "fuzzy", "again"]
    );
    assert.equal(section.children[0].id, `videos-v1-point-${number}`, `point-${number} 的 v1 块必须仍在标题前`);
    assert.ok(section.children.indexOf(header) > 0, `point-${number} 的标题不能移到 v1 块之前`);
    assert.ok(header.querySelector(".topic-number"), `point-${number} 的编号被移除`);
    assert.ok(header.querySelector(".topic-chapter-tag"), `point-${number} 的章节标签被移除`);
    assert.ok(header.querySelector(".topic-title"), `point-${number} 的标题被移除`);
    assert.ok(header.children.includes(group), `point-${number} 的打卡必须追加在原 header 内`);
  }
});

test("C 语言三档按钮提交 page:c-notes:point-N、subjectId=c_language 和显式 topicIds", async () => {
  const { sections, calls } = mountCNotesPage();
  for (let number = 1; number <= 27; number += 1) {
    sections[number - 1].querySelector(".zsb-topic-rate").querySelectorAll("[data-zsb-rate]")[0].trigger("click");
  }
  sections[13].querySelector(".zsb-topic-rate").querySelectorAll("[data-zsb-rate]")[1].trigger("click");
  sections[26].querySelector(".zsb-topic-rate").querySelectorAll("[data-zsb-rate]")[2].trigger("click");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.length, 29);
  for (let number = 1; number <= 27; number += 1) {
    const input = calls[number - 1];
    assert.equal(input.questionId, `page:c-notes:point-${number}`);
    assert.equal(input.subjectId, "c_language");
    assert.deepEqual(Array.from(input.topicIds), [C_NOTES_TOPIC_IDS[`point-${number}`]]);
    assert.equal(input.rating, "good");
    assert.equal(input.page.url, "c/notes.html");
    assert.equal(input.page.anchor, `point-${number}`);
  }
  assert.equal(calls[27].questionId, "page:c-notes:point-14");
  assert.equal(calls[27].rating, "fuzzy");
  assert.deepEqual(Array.from(calls[27].topicIds), ["c.ch5.nested_ternary"]);
  assert.equal(calls[28].questionId, "page:c-notes:point-27");
  assert.equal(calls[28].rating, "again");
  assert.deepEqual(Array.from(calls[28].topicIds), ["c.ch9.ptr_array2d_param"]);
});

const cNotesPath = fileURLToPath(new URL("../c/notes.html", import.meta.url));
test("真实 c/notes.html 只增加一行接入脚本，并保留 27 个 v1 块、口诀侧栏与 54 道习题", {
  skip: !existsSync(cNotesPath) && "完整 c/notes.html 未包含在离线上下文包中"
}, () => {
  const html = readFileSync(cNotesPath, "utf8");
  const script = '<script src="../assets/js/page-study.js" data-page="c-notes" data-subject="c_language"></script>';
  assert.equal(html.split(script).length - 1, 1, "page-study.js 接入脚本应恰好存在一次");
  assert.equal((html.match(/<script\b[^>]*page-study\.js\b/g) || []).length, 1, "不应重复添加 page-study.js");
  const bodyEnd = html.lastIndexOf("</body>");
  const scriptEnd = html.indexOf(script) + script.length;
  assert.ok(scriptEnd <= bodyEnd, "接入脚本必须位于 </body> 前");
  assert.equal(html.slice(scriptEnd, bodyEnd).trim(), "", "接入脚本应紧贴 </body> 前，不改 footer 文案");
  assert.equal((html.match(/<!-- videos-v1:start -->/g) || []).length, 28, "应保留 head 资源块和 27 个专题画廊");
  assert.equal((html.match(/<details class="v1-videos"[^>]*id="videos-v1-point-\d+"[^>]*data-release="published"/g) || []).length, 27);

  for (let number = 1; number <= 27; number += 1) {
    const sectionStart = html.indexOf(`<section class="topic-section" id="point-${number}"`);
    assert.notEqual(sectionStart, -1, `缺少 point-${number}`);
    const videoStart = html.indexOf(`id="videos-v1-point-${number}"`, sectionStart);
    const headerStart = html.indexOf('<header class="topic-header">', sectionStart);
    assert.ok(videoStart > sectionStart && headerStart > videoStart, `point-${number} 的 v1 块必须保留在标题之前`);
  }

  const sidebar = html.match(/<aside class="study-index"[\s\S]*?<\/aside>/);
  assert.ok(sidebar, "考点侧栏必须保留");
  assert.ok(sidebar[0].includes('href="#overview"'));
  assert.ok(sidebar[0].includes("考前速记口诀表"));
  assert.ok(html.includes('id="overview"'));
  assert.ok(html.includes("全 9 章直达导航与考前必背口诀总表"));
  assert.doesNotMatch(html, /data-zsb-question=/, "打卡控件由 page-study.js 注入，不写入讲义正文");
  assert.doesNotMatch(html, /gs-points\.css/, "c/notes.html 不应额外引入 gs-points.css");
  const questionCards = html.match(/<[^>]*class="[^"]*\b(?:question-card|practice-card)\b[^"]*"(?=[^>]*\bdata-question=)[^>]*>/g) || [];
  assert.equal(questionCards.length, 54, "应保留原有 54 道随堂题");
});

test("C 语言打卡布局加在已引入的 site-shell.css，保留窄屏和可见焦点", () => {
  const css = readFileSync(new URL("../assets/css/site-shell.css", import.meta.url), "utf8");
  assert.match(css, /\.topic-section\[id\^="point-"\] \.topic-header > \.zsb-topic-rate/);
  assert.match(css, /\.topic-header > \.zsb-topic-rate \.sys-rate-btn:focus-visible/);
  assert.match(css, /@media \(max-width: 850px\)[\s\S]*?\.topic-header \{ flex-wrap: wrap; \}/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*?min-width: 0/);
  assert.match(css, /margin-left: 47px/);
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
    questionId: `page:c-notes:${anchor}`,
    subjectId: "c_language",
    topicIds: [topicId],
    rating,
    stem: `知识点：${topicId}`,
    page: { url: "c/notes.html", title: "C 语言讲义", anchor }
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

test("C 语言「会了」写入 attempts，并为新记录安排 7 天巩固", async () => {
  const result = await submitPageRating({
    anchor: "point-1",
    topicId: "c.ch1.intro",
    rating: "good"
  });
  assert.equal(result.attempt.question_id, "page:c-notes:point-1");
  assert.deepEqual(result.attempt.topic_ids, ["c.ch1.intro"]);
  assert.equal(result.attempt.subject_id, "c_language");
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

test("C 语言「不会」写入同一 attempts 与 mistake_entries，并保留 c.ch9.ptr_array2d_param 归属", async () => {
  const result = await submitPageRating({
    anchor: "point-27",
    topicId: "c.ch9.ptr_array2d_param",
    rating: "again"
  });
  assert.equal(result.attempt.question_id, "page:c-notes:point-27");
  assert.deepEqual(result.attempt.topic_ids, ["c.ch9.ptr_array2d_param"]);
  assert.equal(result.attempt.grading.status, "incorrect");
  assert.equal(result.mistake.category, "wrong");
  const attempts = await getAll("attempts");
  const mistakes = await getAll("mistake_entries");
  assert.ok(attempts.some((item) => item.question_id === "page:c-notes:point-27"));
  assert.ok(mistakes.some((item) => item.question_id === "page:c-notes:point-27" && item.category === "wrong"));
});

test("C 语言正文页复用 zsb-study v1，不创建第二套数据库或 localStorage 打卡", async () => {
  assert.equal(DB_NAME, "zsb-study");
  assert.equal(DB_VERSION, 1);
  assert.deepEqual(openedDatabases, [{ name: "zsb-study", version: 1 }]);
  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  const bridge = readFileSync(new URL("../assets/js/bridge-api.js", import.meta.url), "utf8");
  assert.match(pageStudy, /recordPageAttempt\(input\)/);
  assert.match(bridge, /import \{ commitSubmission \} from "\.\/features\/records\.js"/);
  assert.doesNotMatch(pageStudy, /localStorage\.setItem/);
});
