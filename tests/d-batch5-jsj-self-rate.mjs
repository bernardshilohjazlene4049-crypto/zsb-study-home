import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { normalizePagePayload } from "../assets/js/features/page-attempts.js";

const JSJ1_TOPIC_IDS = {
  "mind-1.1": "cb.ch1.11",
  "mind-1.2": "cb.ch1.12",
  "mind-1.3": "cb.ch1.13",
  "mind-1.4": "cb.ch1.14"
};

const PPT5_TOPIC_IDS = {
  "chapter-5.1": "cb.ppt.51",
  "chapter-5.2": "cb.ppt.52",
  "chapter-5.3": "cb.ppt.53",
  "chapter-5.4": "cb.ppt.54",
  "chapter-5.5": "cb.ppt.55",
  "chapter-5.6": "cb.ppt.56"
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
    if (selector === "h2") return this.tagName === "h2";
    if (selector === ".chapter, .topic-section") {
      const classes = this.className.split(/\s+/);
      return classes.includes("topic-section") || classes.includes("chapter");
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

function mountPageStudy(pageKey) {
  const root = new TestElement("body");
  const sections = [];
  const topicIds = pageKey === "jsj1" ? JSJ1_TOPIC_IDS : PPT5_TOPIC_IDS;
  const isMind = pageKey === "jsj1";

  if (isMind) {
    const aside = new TestElement("aside");
    aside.className = "map-index";
    const indexItem = new TestElement("button");
    indexItem.className = "map-index__item";
    indexItem.textContent = "第一章";
    aside.appendChild(indexItem);
    root.appendChild(aside);
  } else {
    const rail = new TestElement("nav");
    rail.className = "chapter-rail";
    const jump = new TestElement("a");
    jump.setAttribute("href", "#chapter-5.1");
    jump.textContent = "5.1";
    rail.appendChild(jump);
    root.appendChild(rail);
  }

  for (const [anchor, topicId] of Object.entries(topicIds)) {
    const section = new TestElement("article");
    section.id = anchor;
    section.className = isMind ? "mind-section glass-panel" : "lesson-card content-card";

    const hasVideo = isMind || Number(anchor.slice(-1)) >= 3;
    if (hasVideo) {
      const gallery = new TestElement("details");
      gallery.id = `videos-v1-${anchor}`;
      gallery.className = "v1-videos";
      section.appendChild(gallery);
    }

    const header = new TestElement(isMind ? "header" : "div");
    header.className = isMind ? "mind-head" : "chapter-top";
    const number = new TestElement("span");
    number.className = isMind ? "mind-head__number" : "chapter-index";
    number.textContent = isMind ? anchor.slice(-3) : anchor.slice(-3);
    const title = new TestElement("h2");
    title.textContent = `${anchor} 标题`;
    header.appendChild(number);
    header.appendChild(title);
    section.appendChild(header);

    if (isMind && anchor === "mind-1.2") {
      const answer = new TestElement("span");
      answer.className = "answer-chip";
      answer.textContent = "答案";
      section.appendChild(answer);
      const pending = new TestElement("span");
      pending.className = "pending-blank";
      pending.textContent = "待补";
      section.appendChild(pending);
    }
    root.appendChild(section);
    sections.push({ section, header, title, anchor, topicId, hasVideo });
  }

  const listeners = new Map();
  const document = {
    currentScript: {
      src: "https://study.test/assets/js/page-study.js",
      dataset: { page: pageKey, subject: "computer_basics" }
    },
    title: "计算机基础",
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
    location: { pathname: pageKey === "jsj1" ? "/jsj/jsj1.html" : "/jsj/ppt5.html" },
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
  return { root, sections, calls };
}

test("pageKey=jsj1 仅为 mind-1.1…mind-1.4 注入三档打卡，按点号锚点显式绑定 topicIds", () => {
  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  const map = pageStudy.match(/var JSJ1_TOPIC_IDS = \{([\s\S]*?)\n  \};/);
  assert.ok(map, "缺少 jsj1 四点映射");
  const entries = [...map[1].matchAll(/"([^"]+)": "(cb\.[A-Za-z0-9_.]+)"/g)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(entries, Object.entries(JSJ1_TOPIC_IDS));
  assert.match(pageStudy, /jsj1:\s*JSJ1_TOPIC_IDS,[\s\S]*?ppt5:\s*PPT5_TOPIC_IDS/);
  assert.match(pageStudy, /document\.getElementById\(anchor\)/);
  assert.doesNotMatch(pageStudy, /querySelector\(["'`]#(?:mind-1|chapter-5)/);

  const { root, sections } = mountPageStudy("jsj1");
  assert.ok(root.querySelector(".map-index"), "左侧 map-index 必须保留");
  assert.equal(sections.length, 4);
  for (const { section, header, title, anchor, topicId, hasVideo } of sections) {
    const group = header.querySelector(".zsb-topic-rate");
    assert.ok(group, `${anchor} 缺少标题打卡`);
    assert.equal(group.dataset.zsbQuestion, anchor);
    assert.equal(group.dataset.zsbSubject, "computer_basics");
    assert.equal(group.dataset.zsbTopicIds, topicId);
    assert.deepEqual(
      group.querySelectorAll("[data-zsb-rate]").map((button) => button.dataset.zsbRate),
      ["good", "fuzzy", "again"]
    );
    assert.ok(header.children.includes(title), `${anchor} 的原 h2 必须保留`);
    assert.ok(header.children.includes(group), `${anchor} 的打卡必须追加在 mind-head 内`);
    assert.equal(section.children[0].id, `videos-v1-${anchor}`, `${anchor} 的 v1 块必须仍在标题前`);
    assert.equal(hasVideo, true);
  }
  assert.ok(sections[1].section.querySelector(".answer-chip"), "揭晓答案入口必须保留");
  assert.ok(sections[1].section.querySelector(".pending-blank"), "待补空缺必须保留");
});

test("pageKey=ppt5 仅为 chapter-5.1…5.6 注入打卡，5.1/5.2 不补播放器", () => {
  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  const map = pageStudy.match(/var PPT5_TOPIC_IDS = \{([\s\S]*?)\n  \};/);
  assert.ok(map, "缺少 ppt5 六点映射");
  const entries = [...map[1].matchAll(/"([^"]+)": "(cb\.[A-Za-z0-9_.]+)"/g)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(entries, Object.entries(PPT5_TOPIC_IDS));

  const { root, sections } = mountPageStudy("ppt5");
  assert.ok(root.querySelector(".chapter-rail"), "chapter-rail 必须保留");
  assert.equal(sections.length, 6);
  for (const { section, header, title, anchor, topicId, hasVideo } of sections) {
    const group = header.querySelector(".zsb-topic-rate");
    assert.ok(group, `${anchor} 缺少标题打卡`);
    assert.equal(group.dataset.zsbQuestion, anchor);
    assert.equal(group.dataset.zsbSubject, "computer_basics");
    assert.equal(group.dataset.zsbTopicIds, topicId);
    assert.deepEqual(
      group.querySelectorAll("[data-zsb-rate]").map((button) => button.dataset.zsbRate),
      ["good", "fuzzy", "again"]
    );
    assert.ok(header.children.includes(title), `${anchor} 的原 h2 必须保留`);
    assert.ok(header.children.includes(group), `${anchor} 的打卡必须追加在 chapter-top 内`);
    if (hasVideo) {
      assert.equal(section.children[0].id, `videos-v1-${anchor}`, `${anchor} 的 v1 块必须仍在标题前`);
    } else {
      assert.equal(section.children[0], header, `${anchor} 不应补做播放器`);
    }
  }
});

test("jsj1 / ppt5 按钮提交稳定 questionId、subjectId 与显式 topicIds", async () => {
  const jsj1 = mountPageStudy("jsj1");
  const ppt5 = mountPageStudy("ppt5");

  for (const { header } of jsj1.sections) {
    header.querySelector(".zsb-topic-rate").querySelectorAll("[data-zsb-rate]")[0].trigger("click");
  }
  ppt5.sections[1].header.querySelector(".zsb-topic-rate").querySelectorAll("[data-zsb-rate]")[1].trigger("click");
  ppt5.sections[5].header.querySelector(".zsb-topic-rate").querySelectorAll("[data-zsb-rate]")[2].trigger("click");
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(jsj1.calls.length, 4);
  for (let index = 0; index < jsj1.sections.length; index += 1) {
    const { anchor, topicId } = jsj1.sections[index];
    const input = jsj1.calls[index];
    assert.equal(input.questionId, `page:jsj1:${anchor}`);
    assert.equal(input.subjectId, "computer_basics");
    assert.deepEqual(Array.from(input.topicIds), [topicId]);
    assert.equal(input.rating, "good");
    assert.equal(input.page.url, "jsj/jsj1.html");
    assert.equal(input.page.anchor, anchor);
  }
  assert.equal(ppt5.calls.length, 2);
  assert.equal(ppt5.calls[0].questionId, "page:ppt5:chapter-5.2");
  assert.equal(ppt5.calls[0].subjectId, "computer_basics");
  assert.deepEqual(Array.from(ppt5.calls[0].topicIds), ["cb.ppt.52"]);
  assert.equal(ppt5.calls[0].rating, "fuzzy");
  assert.equal(ppt5.calls[1].questionId, "page:ppt5:chapter-5.6");
  assert.deepEqual(Array.from(ppt5.calls[1].topicIds), ["cb.ppt.56"]);
  assert.equal(ppt5.calls[1].rating, "again");
});

const jsj1Path = fileURLToPath(new URL("../jsj/jsj1.html", import.meta.url));
const ppt5Path = fileURLToPath(new URL("../jsj/ppt5.html", import.meta.url));
test("真实 jsj1 / ppt5 仅在页尾接入一行脚本并保留原播放器与页面结构", {
  skip: (!existsSync(jsj1Path) || !existsSync(ppt5Path))
    && "离线上下文包未包含完整 jsj1.html / ppt5.html"
}, () => {
  const cases = [
    {
      path: jsj1Path,
      script: '<script src="../assets/js/page-study.js" data-page="jsj1" data-subject="computer_basics"></script>',
      markers: 5
    },
    {
      path: ppt5Path,
      script: '<script src="../assets/js/page-study.js" data-page="ppt5" data-subject="computer_basics"></script>',
      markers: 5
    }
  ];
  for (const item of cases) {
    const html = readFileSync(item.path, "utf8");
    assert.equal(html.split(item.script).length - 1, 1, "page-study.js 接入脚本应恰好存在一次");
    assert.equal((html.match(/<script\b[^>]*page-study\.js\b/g) || []).length, 1);
    const bodyEnd = html.lastIndexOf("</body>");
    const scriptStart = html.indexOf(item.script);
    const scriptEnd = scriptStart + item.script.length;
    assert.ok(scriptEnd <= bodyEnd);
    assert.equal(html.slice(scriptEnd, bodyEnd).trim(), "", "新增脚本应紧贴 </body> 前");
    assert.ok(html.slice(0, scriptStart).trimEnd().endsWith("</script>"), "新增脚本应位于原页内脚本之后");
    assert.equal((html.match(/<!-- videos-v1:start -->/g) || []).length, item.markers);
  }

  const jsj1 = readFileSync(jsj1Path, "utf8");
  for (const anchor of Object.keys(JSJ1_TOPIC_IDS)) {
    const sectionStart = jsj1.indexOf(`id="${anchor}"`);
    const videoStart = jsj1.indexOf(`id="videos-v1-${anchor}"`, sectionStart);
    const headerStart = jsj1.indexOf('<header class="mind-head">', sectionStart);
    assert.ok(sectionStart >= 0 && videoStart > sectionStart && headerStart > videoStart, `${anchor} 的 v1 块必须在 mind-head 前`);
  }
  assert.ok(jsj1.includes('class="map-index'));
  assert.ok(jsj1.includes('class="answer-chip'));
  assert.ok(jsj1.includes('class="pending-blank'));
  assert.ok(jsj1.includes("branch-toggle"));

  const ppt5 = readFileSync(ppt5Path, "utf8");
  for (const anchor of Object.keys(PPT5_TOPIC_IDS)) {
    const sectionStart = ppt5.indexOf(`id="${anchor}"`);
    const headerStart = ppt5.indexOf('<div class="chapter-top">', sectionStart);
    assert.ok(sectionStart >= 0 && headerStart > sectionStart, `${anchor} 缺少 chapter-top`);
    if (anchor.endsWith(".1") || anchor.endsWith(".2")) {
      assert.ok(!ppt5.slice(sectionStart, headerStart).includes("videos-v1"), `${anchor} 不应补做播放器`);
    } else {
      const videoStart = ppt5.indexOf(`id="videos-v1-${anchor}"`, sectionStart);
      assert.ok(videoStart > sectionStart && videoStart < headerStart, `${anchor} 的 v1 块必须保留在 chapter-top 前`);
    }
  }
  assert.ok(ppt5.includes('class="chapter-rail'));
  assert.ok(ppt5.includes("refreshMistakes"));
});

test("jsj-notes.css 为两种标题容器提供换行布局与可见键盘焦点", () => {
  const css = readFileSync(new URL("../assets/css/jsj-notes.css", import.meta.url), "utf8");
  assert.match(css, /\.mind-head>\.zsb-topic-rate/);
  assert.match(css, /\.chapter-top>\.zsb-topic-rate/);
  assert.match(css, /@media\(max-width:767px\)[\s\S]*?\.chapter-top>\.zsb-topic-rate/);
  assert.match(css, /:focus-visible\{outline:2px solid var\(--sg-accent\)/);
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

async function submitPageRating({ pageKey, anchor, topicId, rating, url }) {
  const payload = normalizePagePayload({
    questionId: `page:${pageKey}:${anchor}`,
    subjectId: "computer_basics",
    topicIds: [topicId],
    rating,
    stem: `知识点：${topicId}`,
    page: { url, title: "计算机基础", anchor }
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

test("计算机基础「会了」写入同一 attempts，并为新记录安排 7 天巩固", async () => {
  const result = await submitPageRating({
    pageKey: "jsj1",
    anchor: "mind-1.1",
    topicId: "cb.ch1.11",
    rating: "good",
    url: "jsj/jsj1.html"
  });
  assert.equal(result.attempt.question_id, "page:jsj1:mind-1.1");
  assert.deepEqual(result.attempt.topic_ids, ["cb.ch1.11"]);
  assert.equal(result.attempt.subject_id, "computer_basics");
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

test("计算机基础「不会」写入同一 attempts 与 mistake_entries", async () => {
  const result = await submitPageRating({
    pageKey: "ppt5",
    anchor: "chapter-5.6",
    topicId: "cb.ppt.56",
    rating: "again",
    url: "jsj/ppt5.html"
  });
  assert.equal(result.attempt.question_id, "page:ppt5:chapter-5.6");
  assert.deepEqual(result.attempt.topic_ids, ["cb.ppt.56"]);
  assert.equal(result.attempt.subject_id, "computer_basics");
  assert.equal(result.attempt.grading.status, "incorrect");
  assert.equal(result.mistake.category, "wrong");
  const attempts = await getAll("attempts");
  const mistakes = await getAll("mistake_entries");
  assert.ok(attempts.some((item) => item.question_id === "page:ppt5:chapter-5.6"));
  assert.ok(mistakes.some((item) => item.question_id === "page:ppt5:chapter-5.6" && item.category === "wrong"));
});

test("计算机基础正文页复用 zsb-study v1，不创建第二套数据库或 localStorage 打卡", async () => {
  assert.equal(DB_NAME, "zsb-study");
  assert.equal(DB_VERSION, 1);
  assert.deepEqual(openedDatabases, [{ name: "zsb-study", version: 1 }]);
  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  const bridge = readFileSync(new URL("../assets/js/bridge-api.js", import.meta.url), "utf8");
  assert.match(pageStudy, /recordPageAttempt\(input\)/);
  assert.match(bridge, /import \{ commitSubmission \} from "\.\/features\/records\.js"/);
  assert.doesNotMatch(pageStudy, /localStorage\.setItem/);
});
