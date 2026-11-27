import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { normalizePagePayload } from "../assets/js/features/page-attempts.js";

const WY_PAGE_ROWS = [
  { page: "wy/ch1/s11.html", pageKey: "wy-s11", anchor: "s11", topicId: "web.concepts", videosV1: true },
  { page: "wy/ch1/s12.html", pageKey: "wy-s12", anchor: "s12", topicId: "web.process", videosV1: true },
  { page: "wy/ch1/s13.html", pageKey: "wy-s13", anchor: "s13", topicId: "web.layers", videosV1: true },
  { page: "wy/ch1/s-extra.html", pageKey: "wy-s-extra", anchor: "s-extra", topicId: "web.tools", videosV1: true },
  { page: "wy/ch2/s21.html", pageKey: "wy-s21", anchor: "s21", topicId: "web.s21", videosV1: false },
  { page: "wy/ch2/s22.html", pageKey: "wy-s22", anchor: "s22", topicId: "web.s22", videosV1: false },
  { page: "wy/ch2/s22b.html", pageKey: "wy-s22b", anchor: "s22b", topicId: "web.s22b", videosV1: false },
  { page: "wy/ch2/s23.html", pageKey: "wy-s23", anchor: "s23", topicId: "web.s23", videosV1: false },
  { page: "wy/ch2/s24.html", pageKey: "wy-s24", anchor: "s24", topicId: "web.s24", videosV1: false }
];

class TestElement {
  constructor(tagName) {
    this.tagName = String(tagName).toLowerCase();
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
  insertAdjacentElement(position, element) {
    if (position !== "afterend" || !this.parentNode) throw new Error("unsupported insertAdjacentElement");
    const index = this.parentNode.children.indexOf(this);
    this.parentNode.children.splice(index + 1, 0, element);
    element.parentNode = this.parentNode;
    return element;
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
    if (selector.includes(",")) return selector.split(",").some((part) => this.matches(part.trim()));
    if (selector === "[id]") return Boolean(this.id);
    if (selector === "h1") return this.tagName === "h1";
    if (selector === "#videos-v1") return this.id === "videos-v1";
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

function mountWyPage(row) {
  const root = new TestElement("body");
  root.className = "wy-points-page";
  const article = new TestElement("article");
  article.className = "sh-card wy-sheet";
  const header = new TestElement("header");
  header.className = "wy-point-head";
  const number = new TestElement("span");
  number.className = "wy-point-no";
  number.textContent = row.anchor;
  const title = new TestElement("h1");
  title.textContent = `${row.anchor} 标题`;
  header.appendChild(number);
  header.appendChild(title);
  let marker = null;
  let gallery = null;
  if (row.videosV1) {
    marker = new TestElement("#comment");
    marker.textContent = "videos-v1:start";
    gallery = new TestElement("details");
    gallery.id = "videos-v1";
    gallery.className = "v1-videos";
    header.appendChild(marker);
    header.appendChild(gallery);
  }
  article.appendChild(header);
  root.appendChild(article);

  const listeners = new Map();
  const selectors = [];
  const getElementByIdCalls = [];
  const document = {
    currentScript: {
      src: "https://study.test/assets/js/page-study.js",
      dataset: { page: row.pageKey, subject: "web_design" }
    },
    title: "网页设计",
    querySelector(selector) {
      if (selector === "h1") return root.querySelector("h1");
      return null;
    },
    querySelectorAll(selector) {
      selectors.push(selector);
      if (selector === ".wy-points-page:not(.wl-page) .wy-point-head") return [header];
      if (selector === ".wl-page .wy-point-head") return [];
      if (selector === ".quiz-question[data-question][data-correct]" || selector === ".quiz") return [];
      if (selector === "[data-zsb-question]") return root.querySelectorAll(selector);
      return [];
    },
    getElementById(id) {
      getElementByIdCalls.push(id);
      return null;
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
    location: { pathname: `/${row.page}` },
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
  return { root, header, number, title, marker, gallery, calls, selectors, getElementByIdCalls };
}

test("page-study.js 为 9 个 wy- pageKey 配置精确网页设计 topic 映射", () => {
  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  const map = pageStudy.match(/var WY_TOPIC_IDS_BY_PAGE = \{([\s\S]*?)\n  \};/);
  assert.ok(map, "缺少网页设计 9 页知识点映射");
  const entries = [...map[1].matchAll(/"([^\"]+)": \{ "([^\"]+)": "([^\"]+)" \}/g)]
    .map((match) => [match[1], match[2], match[3]]);
  assert.deepEqual(entries, WY_PAGE_ROWS.map((row) => [row.pageKey, row.anchor, row.topicId]));
  assert.equal(entries.length, 9);
  assert.match(pageStudy, /Object\.keys\(WY_TOPIC_IDS_BY_PAGE\)\.forEach\(function \(key\)/);
  assert.match(pageStudy, /Object\.prototype\.hasOwnProperty\.call\(WY_TOPIC_IDS_BY_PAGE, pageKey\)/);
  assert.match(pageStudy, /document\.querySelectorAll\("\.wy-points-page:not\(\.wl-page\) \.wy-point-head"\)/);
  assert.match(pageStudy, /webTitle\.insertAdjacentElement\("afterend", webGroup\)/);
  assert.match(pageStudy, /anchor: box\.dataset\.zsbPageAnchor \|\| box\.id \|\| anchorOf\(box\)/);
  assert.match(pageStudy, /recordPageAttempt\(input\)/);
  assert.doesNotMatch(pageStudy, /\/\^wy-s\\d\+\$/);
  assert.match(pageStudy, /\/\^wl-s\\d\+\$/);
});

test("9 个网页设计页均在 h1 后注入三档按钮；第 2 章不依赖 videos-v1", async () => {
  for (const row of WY_PAGE_ROWS) {
    const mounted = mountWyPage(row);
    const { root, header, number, title, marker, gallery, calls, selectors, getElementByIdCalls } = mounted;
    const group = header.querySelector(".zsb-topic-rate");
    assert.ok(group, `${row.pageKey} 缺少标题打卡`);
    assert.equal(root.className, "wy-points-page", "网页设计页不能误落到 wl-page");
    assert.equal(group.dataset.zsbQuestion, row.anchor);
    assert.equal(group.dataset.zsbPageAnchor, row.anchor);
    assert.equal(group.dataset.zsbSubject, "web_design");
    assert.equal(group.dataset.zsbTopicIds, row.topicId);
    assert.equal(header.children[0], number, `${row.pageKey} 的编号被移动`);
    assert.equal(header.children[header.children.indexOf(title) + 1], group, `${row.pageKey} 的打卡必须紧跟 h1`);
    assert.deepEqual(
      group.querySelectorAll("[data-zsb-rate]").map((button) => button.dataset.zsbRate),
      ["good", "fuzzy", "again"]
    );
    assert.deepEqual(getElementByIdCalls, [], "无 section id 的网页设计页不应按锚点查找");
    assert.ok(selectors.includes(".wy-points-page:not(.wl-page) .wy-point-head"));
    assert.ok(!selectors.includes(".wl-page .wy-point-head"), "wy-* 分支不能进入 D6 网络页分支");
    if (row.videosV1) {
      assert.ok(header.children.indexOf(group) < header.children.indexOf(marker));
      assert.ok(header.children.indexOf(marker) < header.children.indexOf(gallery));
      assert.equal(gallery.id, "videos-v1");
    } else {
      assert.equal(gallery, null, `${row.pageKey} 不应被测试环境补做 v1 画廊`);
      assert.equal(header.children.length, 3, "无 v1 的第 2 章只增加打卡，不增加播放器节点");
    }
    group.querySelectorAll("[data-zsb-rate]")[0].trigger("click");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].questionId, `page:${row.pageKey}:${row.anchor}`);
    assert.equal(calls[0].subjectId, "web_design");
    assert.deepEqual(Array.from(calls[0].topicIds), [row.topicId]);
    assert.equal(calls[0].rating, "good");
    assert.equal(calls[0].page.url, row.page);
    assert.equal(calls[0].page.anchor, row.anchor);
  }
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
    objectStoreNames: { contains(name) { return stores.has(name); } },
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

async function submitPageRating({ pageKey, anchor, topicId, rating, page }) {
  const payload = normalizePagePayload({
    questionId: `page:${pageKey}:${anchor}`,
    subjectId: "web_design",
    topicIds: [topicId],
    rating,
    stem: `知识点：${topicId}`,
    page: { url: page, title: "网页设计", anchor }
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

test("网页设计「会了」写入同一 attempts / user_topic_progress，新记录 7 天后复习", async () => {
  const row = WY_PAGE_ROWS[0];
  const result = await submitPageRating({ ...row, rating: "good" });
  assert.equal(result.attempt.question_id, "page:wy-s11:s11");
  assert.deepEqual(result.attempt.topic_ids, ["web.concepts"]);
  assert.equal(result.attempt.subject_id, "web_design");
  assert.equal(result.attempt.grading.status, "correct");
  assert.equal(result.attempt.understanding, "mastered");
  assert.equal(result.decision.schedule.interval_days, 7);
  assert.equal(result.mistake.category, "consolidate");
  assert.equal(
    Date.parse(result.mistake.next_review_at) - Date.parse(result.attempt.submitted_at),
    7 * 24 * 60 * 60 * 1000
  );
  const attempts = await getAll("attempts");
  const progress = await getAll("user_topic_progress");
  assert.ok(attempts.some((item) => item.id === result.attempt.id));
  assert.ok(progress.some((item) => item.topic_id === "web.concepts"));
});

test("网页设计「不会」写入同一 attempts 与 mistake_entries", async () => {
  const row = WY_PAGE_ROWS[3];
  const result = await submitPageRating({ ...row, rating: "again" });
  assert.equal(result.attempt.question_id, "page:wy-s-extra:s-extra");
  assert.deepEqual(result.attempt.topic_ids, ["web.tools"]);
  assert.equal(result.attempt.subject_id, "web_design");
  assert.equal(result.attempt.grading.status, "incorrect");
  assert.equal(result.mistake.category, "wrong");
  const attempts = await getAll("attempts");
  const mistakes = await getAll("mistake_entries");
  assert.ok(attempts.some((item) => item.question_id === "page:wy-s-extra:s-extra"));
  assert.ok(mistakes.some((item) => item.question_id === "page:wy-s-extra:s-extra" && item.category === "wrong"));
});

test("网页设计仍复用 zsb-study v1，不创建第二套数据库或 localStorage 打卡", async () => {
  assert.equal(DB_NAME, "zsb-study");
  assert.equal(DB_VERSION, 1);
  assert.deepEqual(openedDatabases, [{ name: "zsb-study", version: 1 }]);
  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  assert.match(pageStudy, /recordPageAttempt\(input\)/);
  assert.doesNotMatch(pageStudy, /localStorage\.setItem/);
});

test("网页设计打卡样式限定非 wl-page，并保留窄屏与可见焦点", () => {
  const css = readFileSync(new URL("../assets/css/wy-points.css", import.meta.url), "utf8");
  assert.match(css, /\.wy-points-page:not\(\.wl-page\) \.wy-point-head/);
  assert.match(css, /\.wy-points-page:not\(\.wl-page\) \.wy-point-head > \.zsb-topic-rate/);
  assert.match(css, /\.wy-points-page:not\(\.wl-page\) \.wy-point-head > #videos-v1/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.wy-points-page:not\(\.wl-page\) \.wy-point-head > \.zsb-topic-rate/);
  assert.match(css, /\.wy-points-page:not\(\.wl-page\) \.wy-point-head > \.zsb-topic-rate \.sys-rate-btn:focus-visible/);
});

test("stage4-lab-viz 仅剥离本批 9 个精确 wy pageKey，保留 D6 network 规则", () => {
  const source = readFileSync(new URL("./stage4-lab-viz.mjs", import.meta.url), "utf8");
  assert.match(source, /data-page="wl-s\\d\+" data-subject="network"/);
  assert.match(source, /data-page="\(\?:wy-s11\|wy-s12\|wy-s13\|wy-s-extra\|wy-s21\|wy-s22\|wy-s22b\|wy-s23\|wy-s24\)" data-subject="web_design"/);
  assert.doesNotMatch(source, /data-page="[^\"]*" data-subject="web_design"[^\n]*page-study\\\.js/);
  const wyRule = /<script src="\.\.\/\.\.\/assets\/js\/page-study\.js" data-page="(?:wy-s11|wy-s12|wy-s13|wy-s-extra|wy-s21|wy-s22|wy-s22b|wy-s23|wy-s24)" data-subject="web_design"><\/script>\n?/g;
  for (const row of WY_PAGE_ROWS) {
    const line = `<script src="../../assets/js/page-study.js" data-page="${row.pageKey}" data-subject="web_design"></script>`;
    assert.equal(line.replace(wyRule, ""), "", `${row.pageKey} 应被 strip 精确剥离`);
  }
  const quizLine = '<script src="../../assets/js/page-study.js" data-page="wy-html-quiz" data-subject="web_design"></script>';
  assert.equal(quizLine.replace(wyRule, ""), quizLine, "wy-html-quiz 必须保留在 originals 哈希中");
  const networkLine = '<script src="../../assets/js/page-study.js" data-page="wl-s11" data-subject="network"></script>';
  assert.equal(networkLine.replace(wyRule, ""), networkLine, "D6 network 行不能被本批规则剥离");
});

test("tests/videos-v1.py 只为第 1 章 4 个有 v1 的页面补充 expected 脚本", () => {
  const source = readFileSync(new URL("./videos-v1.py", import.meta.url), "utf8");
  const block = source.match(/WY_PAGE_STUDY_KEYS = \{([\s\S]*?)\n\}/);
  assert.ok(block, "videos-v1.py 缺少第 1 章网页设计脚本映射表");
  const entries = [...block[1].matchAll(/"([^\"]+)": "([^\"]+)"/g)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(entries, WY_PAGE_ROWS.filter((row) => row.videosV1).map((row) => [row.page, row.pageKey]));
  assert.match(source, /wy_page_key = WY_PAGE_STUDY_KEYS\.get\(page\)/);
  assert.match(source, /data-page="\{wy_page_key\}" data-subject="web_design"/);
  assert.match(source, /integration\.BLOCK\.sub\("", html\) == expected/);
});

const WY_PAGE_PATHS = WY_PAGE_ROWS.map((row) => fileURLToPath(new URL(`../${row.page}`, import.meta.url)));
const incompleteWyPages = WY_PAGE_PATHS.filter((path) => !existsSync(path) || !/<body\b/.test(readFileSync(path, "utf8")));
test("真实 9 个网页设计小节页各只在页尾接入一行脚本并保留原入口", {
  skip: incompleteWyPages.length > 0 && `离线上下文包未包含 ${incompleteWyPages.length} 份完整网页设计讲义`
}, () => {
  for (let index = 0; index < WY_PAGE_ROWS.length; index += 1) {
    const row = WY_PAGE_ROWS[index];
    const html = readFileSync(WY_PAGE_PATHS[index], "utf8");
    const script = `<script src="../../assets/js/page-study.js" data-page="${row.pageKey}" data-subject="web_design"></script>`;
    assert.equal(html.split(script).length - 1, 1, `${row.page} 的脚本应恰好存在一次`);
    assert.equal((html.match(/<script\b[^>]*page-study\.js\b/g) || []).length, 1);
    const bodyEnd = html.lastIndexOf("</body>");
    const dialogEnd = html.lastIndexOf("</dialog>");
    const scriptStart = html.indexOf(script);
    assert.ok(scriptStart > dialogEnd, `${row.page} 的脚本必须位于原图 dialog 之后`);
    assert.ok(scriptStart + script.length <= bodyEnd, `${row.page} 的脚本必须位于 </body> 之前`);
    assert.equal(html.slice(scriptStart + script.length, bodyEnd).trim(), "", "脚本应紧贴 </body> 前");
    assert.match(html, /<body[^>]*class="[^"]*wy-points-page/);
    assert.doesNotMatch(html.match(/<body[^>]*>/)?.[0] || "", /\bwl-page\b/);
    assert.match(html, /<header class="wy-point-head">[\s\S]*?<h1>/);
    if (row.videosV1) {
      assert.equal((html.match(/<!-- videos-v1:start -->/g) || []).length, 2, row.page);
      assert.ok(html.includes('id="videos-v1"'), row.page);
      assert.ok(html.indexOf('id="videos-v1"') < dialogEnd, row.page);
    } else {
      assert.equal((html.match(/<!-- videos-v1:start -->/g) || []).length, 0, row.page);
      assert.doesNotMatch(html, /<details class="v1-videos"/);
    }
  }
  const s21 = readFileSync(WY_PAGE_PATHS[4], "utf8");
  assert.match(s21, /<section id="video"/);
  assert.match(s21, /<video\b/);
});
