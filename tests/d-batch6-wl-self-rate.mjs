import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { normalizePagePayload } from "../assets/js/features/page-attempts.js";

const WL_PAGE_ROWS = [
  { page: "wl/ch1/s11.html", pageKey: "wl-s11", anchor: "s11", topicId: "net.s11" },
  { page: "wl/ch1/s12.html", pageKey: "wl-s12", anchor: "s12", topicId: "net.s12" },
  { page: "wl/ch1/s13.html", pageKey: "wl-s13", anchor: "s13", topicId: "net.s13" },
  { page: "wl/ch1/s14.html", pageKey: "wl-s14", anchor: "s14", topicId: "net.s14" },
  { page: "wl/ch1/s15.html", pageKey: "wl-s15", anchor: "s15", topicId: "net.s15" },
  { page: "wl/ch1/s16.html", pageKey: "wl-s16", anchor: "s16", topicId: "net.s16" },
  { page: "wl/ch2/s21.html", pageKey: "wl-s21", anchor: "s21", topicId: "net.s21" },
  { page: "wl/ch2/s22.html", pageKey: "wl-s22", anchor: "s22", topicId: "net.s22" },
  { page: "wl/ch2/s23.html", pageKey: "wl-s23", anchor: "s23", topicId: "net.s23" },
  { page: "wl/ch2/s24.html", pageKey: "wl-s24", anchor: "s24", topicId: "net.s24" },
  { page: "wl/ch2/s25.html", pageKey: "wl-s25", anchor: "s25", topicId: "net.s25" },
  { page: "wl/ch2/s26.html", pageKey: "wl-s26", anchor: "s26", topicId: "net.s26" },
  { page: "wl/ch2/s27.html", pageKey: "wl-s27", anchor: "s27", topicId: "net.s27" },
  { page: "wl/ch3/s31.html", pageKey: "wl-s31", anchor: "s31", topicId: "net.s31" },
  { page: "wl/ch3/s32.html", pageKey: "wl-s32", anchor: "s32", topicId: "net.s32" },
  { page: "wl/ch3/s33.html", pageKey: "wl-s33", anchor: "s33", topicId: "net.s33" },
  { page: "wl/ch3/s34.html", pageKey: "wl-s34", anchor: "s34", topicId: "net.s34" },
  { page: "wl/ch3/s35.html", pageKey: "wl-s35", anchor: "s35", topicId: "net.s35" },
  { page: "wl/ch3/s36.html", pageKey: "wl-s36", anchor: "s36", topicId: "net.s36" },
  { page: "wl/ch3/s37.html", pageKey: "wl-s37", anchor: "s37", topicId: "net.s37" },
  { page: "wl/ch3/s38.html", pageKey: "wl-s38", anchor: "s38", topicId: "net.s38" },
  { page: "wl/ch3/s39.html", pageKey: "wl-s39", anchor: "s39", topicId: "net.s39" },
  { page: "wl/ch4/s41.html", pageKey: "wl-s41", anchor: "s41", topicId: "net.s41" },
  { page: "wl/ch4/s42.html", pageKey: "wl-s42", anchor: "s42", topicId: "net.s42" },
  { page: "wl/ch4/s43.html", pageKey: "wl-s43", anchor: "s43", topicId: "net.s43" },
  { page: "wl/ch5/s51.html", pageKey: "wl-s51", anchor: "s51", topicId: "net.s51" },
  { page: "wl/ch5/s52.html", pageKey: "wl-s52", anchor: "s52", topicId: "net.s52" },
  { page: "wl/ch5/s53.html", pageKey: "wl-s53", anchor: "s53", topicId: "net.s53" },
  { page: "wl/ch6/s61.html", pageKey: "wl-s61", anchor: "s61", topicId: "net.s61" }
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

function mountWlPage(row) {
  const root = new TestElement("body");
  root.className = "wy-points-page wl-page";
  const article = new TestElement("article");
  article.className = "sh-card wy-sheet";
  const header = new TestElement("header");
  header.className = "wy-point-head";
  const number = new TestElement("span");
  number.className = "wy-point-no";
  number.textContent = row.anchor.slice(1);
  const title = new TestElement("h1");
  title.textContent = `${row.anchor} 标题`;
  const marker = new TestElement("#comment");
  marker.textContent = "videos-v1:start";
  const gallery = new TestElement("details");
  gallery.id = "videos-v1";
  gallery.className = "v1-videos";
  header.appendChild(number);
  header.appendChild(title);
  header.appendChild(marker);
  header.appendChild(gallery);
  article.appendChild(header);
  root.appendChild(article);

  const listeners = new Map();
  const getElementByIdCalls = [];
  const document = {
    currentScript: {
      src: "https://study.test/assets/js/page-study.js",
      dataset: { page: row.pageKey, subject: "network" }
    },
    title: "计算机网络",
    querySelector(selector) {
      if (selector === "h1") return root.querySelector("h1");
      return null;
    },
    querySelectorAll(selector) {
      if (selector === ".wl-page .wy-point-head") return [header];
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
  return { root, article, header, number, title, marker, gallery, calls, getElementByIdCalls };
}

test("page-study.js 为 29 个 wl-sNN pageKey 配置精确 net.sNN 映射", () => {
  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  const map = pageStudy.match(/var WL_TOPIC_IDS_BY_PAGE = \{([\s\S]*?)\n  \};/);
  assert.ok(map, "缺少 29 页网络知识点映射");
  const entries = [...map[1].matchAll(/"(wl-s\d+)": \{ "(s\d+)": "(net\.s\d+)" \}/g)]
    .map((match) => [match[1], match[2], match[3]]);
  assert.deepEqual(entries, WL_PAGE_ROWS.map((row) => [row.pageKey, row.anchor, row.topicId]));
  assert.equal(entries.length, 29);
  assert.match(pageStudy, /TOPIC_IDS_BY_PAGE\[key\] = WL_TOPIC_IDS_BY_PAGE\[key\]/);
  assert.match(pageStudy, /var topicIdsByAnchor = TOPIC_IDS_BY_PAGE\[pageKey\]/);
  assert.match(pageStudy, /document\.querySelectorAll\("\.wl-page \.wy-point-head"\)/);
  assert.match(pageStudy, /networkTitle\.insertAdjacentElement\("afterend", networkGroup\)/);
  assert.match(pageStudy, /anchor: box\.dataset\.zsbPageAnchor \|\| box\.id \|\| anchorOf\(box\)/);
  assert.match(pageStudy, /recordPageAttempt\(input\)/);
});

test("29 个网络页均在 h1 后、原 videos-v1 画廊前注入三档按钮", async () => {
  for (const row of WL_PAGE_ROWS) {
    const mounted = mountWlPage(row);
    const { header, number, title, marker, gallery, calls, getElementByIdCalls } = mounted;
    const group = header.querySelector(".zsb-topic-rate");
    assert.ok(group, `${row.pageKey} 缺少标题打卡`);
    assert.equal(group.dataset.zsbQuestion, row.anchor);
    assert.equal(group.dataset.zsbPageAnchor, row.anchor);
    assert.equal(group.dataset.zsbSubject, "network");
    assert.equal(group.dataset.zsbTopicIds, row.topicId);
    assert.equal(header.children[0], number, `${row.pageKey} 的编号被移动`);
    assert.equal(header.children[header.children.indexOf(title) + 1], group, `${row.pageKey} 的打卡必须紧跟 h1`);
    assert.ok(header.children.indexOf(group) < header.children.indexOf(marker));
    assert.ok(header.children.indexOf(marker) < header.children.indexOf(gallery));
    assert.equal(gallery.id, "videos-v1");
    assert.deepEqual(
      group.querySelectorAll("[data-zsb-rate]").map((button) => button.dataset.zsbRate),
      ["good", "fuzzy", "again"]
    );
    assert.deepEqual(getElementByIdCalls, [], "无 section id 的网络页不应尝试按锚点查找");
    group.querySelectorAll("[data-zsb-rate]")[0].trigger("click");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].questionId, `page:${row.pageKey}:${row.anchor}`);
    assert.equal(calls[0].subjectId, "network");
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

async function submitPageRating({ anchor, topicId, rating }) {
  const row = WL_PAGE_ROWS.find((item) => item.anchor === anchor);
  const pageKey = row.pageKey;
  const payload = normalizePagePayload({
    questionId: `page:${pageKey}:${anchor}`,
    subjectId: "network",
    topicIds: [topicId],
    rating,
    stem: `知识点：${topicId}`,
    page: { url: row.page, title: "计算机网络", anchor }
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

test("网络课「会了」写入同一 attempts，并为新记录安排 7 天巩固", async () => {
  const result = await submitPageRating({ anchor: "s11", topicId: "net.s11", rating: "good" });
  assert.equal(result.attempt.question_id, "page:wl-s11:s11");
  assert.deepEqual(result.attempt.topic_ids, ["net.s11"]);
  assert.equal(result.attempt.subject_id, "network");
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

test("网络课「不会」写入同一 attempts 与 mistake_entries", async () => {
  const result = await submitPageRating({ anchor: "s61", topicId: "net.s61", rating: "again" });
  assert.equal(result.attempt.question_id, "page:wl-s61:s61");
  assert.deepEqual(result.attempt.topic_ids, ["net.s61"]);
  assert.equal(result.attempt.subject_id, "network");
  assert.equal(result.attempt.grading.status, "incorrect");
  assert.equal(result.mistake.category, "wrong");
  const attempts = await getAll("attempts");
  const mistakes = await getAll("mistake_entries");
  assert.ok(attempts.some((item) => item.question_id === "page:wl-s61:s61"));
  assert.ok(mistakes.some((item) => item.question_id === "page:wl-s61:s61" && item.category === "wrong"));
});

test("网络课仍复用 zsb-study v1，不创建第二套数据库或 localStorage 打卡", async () => {
  assert.equal(DB_NAME, "zsb-study");
  assert.equal(DB_VERSION, 1);
  assert.deepEqual(openedDatabases, [{ name: "zsb-study", version: 1 }]);
  const pageStudy = readFileSync(new URL("../assets/js/page-study.js", import.meta.url), "utf8");
  assert.match(pageStudy, /recordPageAttempt\(input\)/);
  assert.doesNotMatch(pageStudy, /localStorage\.setItem/);
});

test("网络课打卡样式只作用于 wl-page 标题，并保留窄屏与焦点样式", () => {
  const css = readFileSync(new URL("../assets/css/wy-points.css", import.meta.url), "utf8");
  assert.match(css, /\.wl-page \.wy-point-head/);
  assert.match(css, /\.wl-page \.wy-point-head > \.zsb-topic-rate/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.wl-page \.wy-point-head > \.zsb-topic-rate/);
  assert.match(css, /:focus-visible/);
  const wlRules = css.slice(css.lastIndexOf("/* 网络课页："));
  assert.doesNotMatch(wlRules, /(^|\n)\.wy-point-head \{/);
});

test("tests/videos-v1.py 为网络页的导图模块脚本精确补齐 expected", () => {
  const source = readFileSync(new URL("./videos-v1.py", import.meta.url), "utf8");
  const block = source.match(/WL_PAGE_STUDY_KEYS = \{([\s\S]*?)\n\}/);
  assert.ok(block, "videos-v1.py 缺少网络页脚本映射表");
  const entries = [...block[1].matchAll(/"([^"]+)": "(wl-s\d+)"/g)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(entries, WL_PAGE_ROWS.map((row) => [row.page, row.pageKey]));
  assert.match(source, /wl_page_key = WL_PAGE_STUDY_KEYS\.get\(page\)/);
  assert.match(source, /network_mindmap_key = WL_PAGE_STUDY_KEYS\.get\(page\)/);
  assert.match(source, /network-mindmaps\.js/);
  assert.match(source, /integration\.BLOCK\.sub\("", html\) == expected/);
});

const WL_PAGE_PATHS = WL_PAGE_ROWS.map((row) => fileURLToPath(new URL(`../${row.page}`, import.meta.url)));
const missingWlPages = WL_PAGE_PATHS.filter((path) => !existsSync(path));
test("真实 29 个网络课页各只在页尾接入打卡与导图脚本并保留 v1 / 既有入口", {
  skip: missingWlPages.length > 0 && `离线上下文包未包含 ${missingWlPages.length} 份完整网络讲义`,
}, () => {
  for (let index = 0; index < WL_PAGE_ROWS.length; index += 1) {
    const row = WL_PAGE_ROWS[index];
    const html = readFileSync(WL_PAGE_PATHS[index], "utf8");
    const script = `<script src="../../assets/js/page-study.js" data-page="${row.pageKey}" data-subject="network"></script>`;
    const mindmapScript = `<script type="module" src="../../assets/js/features/network-mindmaps.js" data-page="${row.pageKey}"></script>`;
    assert.equal(html.split(script).length - 1, 1, `${row.page} 的打卡脚本应恰好存在一次`);
    assert.equal(html.split(mindmapScript).length - 1, 1, `${row.page} 的导图脚本应恰好存在一次`);
    assert.equal((html.match(/<script\b[^>]*page-study\.js\b/g) || []).length, 1);
    assert.equal((html.match(/<script\b[^>]*network-mindmaps\.js\b/g) || []).length, 1);
    const bodyEnd = html.lastIndexOf("</body>");
    const studyStart = html.indexOf(script);
    const mindmapStart = html.indexOf(mindmapScript);
    assert.ok(studyStart > html.lastIndexOf("</dialog>"));
    assert.ok(studyStart + script.length <= mindmapStart);
    assert.ok(mindmapStart + mindmapScript.length <= bodyEnd);
    assert.equal(html.slice(mindmapStart + mindmapScript.length, bodyEnd).trim(), "", "导图模块脚本应紧贴 </body> 前");
    assert.equal((html.match(/<!-- videos-v1:start -->/g) || []).length, 2);
    assert.match(html, /<body[^>]*class="[^"]*wl-page/);
    assert.ok(html.includes('id="videos-v1"'));
    assert.ok(html.includes(`data-video-id="${row.topicId}"`));
  }
  const s61 = readFileSync(WL_PAGE_PATHS[WL_PAGE_ROWS.length - 1], "utf8");
  assert.doesNotMatch(s61, /route-aggregation/);
});
