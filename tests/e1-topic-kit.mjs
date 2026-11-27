import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { TOPIC_KIT_BY_ID } from "../assets/js/features/topic-kit-data.js";
import { describeTopicKitStatus, readTopicKitStates, topicKitStatusDetail } from "../assets/js/features/topic-kit-state.js";
import { foldGsMindmapDirectoryEntries, foldExcelMindmapDirectoryEntry, foldEnglishMindmapDirectoryEntry } from "../assets/js/features/topic-kit-navigation.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const points = Object.values(TOPIC_KIT_BY_ID);

test("E1 齐套数据只覆盖 D1–D7 已打卡的 104 点", () => {
  assert.equal(points.length, 104);
  const counts = Object.groupBy(points, (point) => point.batch);
  assert.deepEqual(Object.fromEntries(Object.entries(counts).map(([key, rows]) => [key, rows.length])), {
    D1: 11, D2: 13, D3: 5, D4: 27, D5: 10, D6: 29, D7: 9
  });
  assert.ok(points.every((point) => point.page && point.anchor && point.pageKey && point.subjectId));
  assert.ok(points.every((point) => point.practice?.status === "有"));
  assert.ok(points.every((point) => point.pageKey !== "jsj-index"));
  for (const point of points.filter((item) => item.batch === "D6" || item.batch === "D7")) {
    assert.equal(point.lectureHref, point.page, `${point.topicId} 不应使用不存在的单点 fragment`);
    assert.equal(point.practice.href, point.page, `${point.topicId} 练习入口不应指向虚构锚点`);
  }
});

test("导图缺口如实标记，不把口诀总表冒充逐点导图，也不编造高数 fragment", () => {
  const cPoints = points.filter((point) => point.batch === "D4");
  const cWithMap = cPoints.filter((point) => point.mindmap.href);
  assert.deepEqual(cWithMap.map((point) => point.anchor), ["point-5", "point-6", "point-27"]);
  assert.ok(cPoints.every((point) => point.extraLinks.some((link) => link.href === "c/notes.html#overview")));
  assert.ok(cPoints.filter((point) => !point.mindmap.href).every((point) => point.mindmap.status === "缺逐点导图"));
  for (const point of points.filter((item) => item.batch === "D1" || item.batch === "D2")) {
    assert.equal(point.mindmap.href, "gs/mindmap.html");
    assert.doesNotMatch(point.mindmap.href, /#point-/);
  }
  for (const point of points.filter((item) => item.batch === "D6")) {
    assert.equal(point.mindmap.status, "仅有科目总图");
    assert.equal(point.mindmap.href, "notes/map.html#network");
    assert.doesNotMatch(point.mindmap.href, /network-map/);
  }
});

test("视频缺口与已有入口按实证呈现", () => {
  assert.equal(TOPIC_KIT_BY_ID["cb.ppt.51"].video.href, null);
  assert.equal(TOPIC_KIT_BY_ID["cb.ppt.52"].video.href, null);
  assert.equal(TOPIC_KIT_BY_ID["cb.ppt.51"].video.status, "缺");
  assert.equal(TOPIC_KIT_BY_ID["cb.ppt.52"].video.status, "缺");
  assert.match(TOPIC_KIT_BY_ID["c.ch1.intro"].video.href, /#videos-v1-point-1$/);
  assert.match(TOPIC_KIT_BY_ID["net.s11"].video.href, /#videos-v1$/);
  assert.equal(TOPIC_KIT_BY_ID["web.s21"].video.href, "wy/ch2/s21.html#video");
  assert.equal(TOPIC_KIT_BY_ID["web.s22"].video.href, "wy/videos/ch2.mp4");
});

const allLessonPagesPresent = points.every((point) => existsSync(path.join(root, point.page)));

test("104 点齐套条的所有已声明资源与 fragment 均存在", { skip: !allLessonPagesPresent }, () => {
  const resources = new Map();
  for (const point of points) {
    const links = [point.mindmap, point.video, point.practice, ...(point.extraLinks || []), { href: point.lectureHref }, { href: point.practice.visualHref }];
    for (const resource of links) if (resource?.href) resources.set(resource.href, true);
  }
  for (const href of resources.keys()) {
    const hashAt = href.indexOf("#");
    const rel = hashAt < 0 ? href : href.slice(0, hashAt);
    const hash = hashAt < 0 ? "" : href.slice(hashAt + 1);
    const target = path.resolve(root, rel);
    assert.equal(existsSync(target), true, `资源不存在：${href}`);
    if (hash) {
      const html = readFileSync(target, "utf8");
      assert.ok(html.includes(`id="${hash}"`) || html.includes(`id='${hash}'`), `fragment 不存在：${href}`);
    }
  }
});

test("readTopicKitStates 默认读库路径不引用未定义的 getAll", async () => {
  const entries = [{ topicId: "math.domain", questionId: "page:gs1:point-1" }];
  let result;
  let failure;
  try {
    // 故意不传 readAll：必须走真实模块的默认 storage.js 懒加载路径。
    result = await readTopicKitStates(entries);
  } catch (error) {
    failure = error;
  }

  assert.ok(
    !(failure instanceof ReferenceError && failure.message === "getAll is not defined"),
    `默认读库路径不能引用未定义的 getAll：${failure?.stack || ""}`
  );
  if (!failure) {
    assert.equal(result.length, 1);
    assert.equal(result[0].topicId, "math.domain");
    assert.equal(result[0].questionId, "page:gs1:point-1");
  }
});

test("齐套条状态只读同一 zsb-study v1 的 progress / attempts", async () => {
  const calls = [];
  const rows = await readTopicKitStates([
    { topicId: "math.domain", questionId: "page:gs1:point-1" },
    { topicId: "math.function_limit", questionId: "page:gs1:point-4" }
  ], {
    learnerId: "local-guest",
    readAll: async (store) => {
      calls.push(store);
      if (store === "user_topic_progress") return [
        { learner_id: "local-guest", topic_id: "math.domain", mastery_state: "mastered", next_review_at: "2026-12-04T10:00:00.000Z" }
      ];
      if (store === "attempts") return [
        { learner_id: "local-guest", question_id: "page:gs1:point-1", submitted_at: "2026-11-27T10:00:00.000Z", response: { rating: "good" } },
        { learner_id: "local-guest", question_id: "page:gs1:point-4", submitted_at: "2026-11-27T11:00:00.000Z", response: { rating: "fuzzy" } }
      ];
      return [];
    }
  });
  assert.deepEqual(calls.sort(), ["attempts", "user_topic_progress"]);
  assert.equal(rows[0].progress.mastery_state, "mastered");
  assert.equal(describeTopicKitStatus(rows[0]), "会了");
  assert.equal(topicKitStatusDetail(rows[0]), "下次复习：2026-12-04");
  assert.equal(describeTopicKitStatus(rows[1]), "模糊");
  assert.equal(describeTopicKitStatus({}), "未打卡");
  assert.equal(describeTopicKitStatus({ latestAttempt: { response: { rating: "again" } } }), "不会");
});

test("page-study 按已有打卡组注入齐套条，不改 104 页 HTML 或 D 写库链", () => {
  const pageStudy = read("assets/js/page-study.js");
  assert.match(pageStudy, /TOPIC_IDS_BY_PAGE\[pageKey\]/);
  assert.match(pageStudy, /\.zsb-topic-rate\[data-zsb-topic-ids\]/);
  assert.match(pageStudy, /topic-kit-data\.js/);
  assert.match(pageStudy, /topic-kit-state\.js/);
  assert.match(pageStudy, /group\.insertAdjacentElement\("afterend", kit\)/);
  assert.match(pageStudy, /recordPageAttempt\(input\)/);
  assert.match(pageStudy, /zsb:attempt-saved/);
  assert.match(pageStudy, /foldGs1MindmapEntry/);
  assert.match(pageStudy, /a\[data-index-point="mindmap"\]\[href="#mindmap"\]/);
  assert.doesNotMatch(pageStudy, /markTopicStudied\(/);
  assert.doesNotMatch(pageStudy, /zsb\.lesson-checklist\.v1/);
});

test("E1 样式有键盘焦点与窄屏布局", () => {
  const css = read("assets/css/topic-kit.css");
  assert.match(css, /\.e1-topic-kit__link:focus-visible/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test("C 语言考前速记口诀表侧栏入口与本体仍保留", { skip: !existsSync(path.join(root, "c/notes.html")) }, () => {
  const html = read("c/notes.html");
  assert.match(html, /href="#overview"[^>]*>[\s\S]{0,120}考前速记口诀表|考前速记口诀表[\s\S]{0,120}href="#overview"/);
  assert.match(html, /id="overview"/);
});

test("网络总图仍使用真实 #network 锚点", {
  skip: !existsSync(path.join(root, "notes/map.html"))
}, () => {
  assert.match(read("notes/map.html"), /id="network"/);
  assert.doesNotMatch(read("notes/map.html"), /id="network-map"/);
});

test("新测试已加入 CI node --test 列表", () => {
  assert.match(read(".github/workflows/check.yml"), /tests\/e1-topic-kit\.mjs/);
});


function extractPageStudyFunction(source, name, endMarker) {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `无法从 page-study.js 提取 ${name}`);
  return source.slice(start, end).trim();
}

class KitFixtureElement {
  constructor(tagName = "div") {
    this.tagName = tagName;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = {};
    this.className = "";
    this.href = "";
    this._textContent = "";
    this.removed = false;
  }
  get classList() {
    const element = this;
    return {
      contains(name) { return element.className.split(/\s+/).includes(name); },
      add(name) {
        const names = new Set(element.className.split(/\s+/).filter(Boolean));
        names.add(name);
        element.className = Array.from(names).join(" ");
      },
      remove(name) {
        element.className = element.className.split(/\s+/).filter((item) => item && item !== name).join(" ");
      },
      toggle(name, force) {
        const shouldAdd = force === undefined ? !this.contains(name) : Boolean(force);
        if (shouldAdd) this.add(name); else this.remove(name);
        return shouldAdd;
      }
    };
  }
  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join("");
  }
  set textContent(value) {
    this._textContent = String(value ?? "");
    this.children.forEach((child) => { child.parentElement = null; });
    this.children = [];
  }
  appendChild(child) {
    if (child.parentElement) child.remove();
    this.children.push(child);
    child.parentElement = this;
    return child;
  }
  append(...children) { children.forEach((child) => this.appendChild(child)); }
  insertAdjacentElement(position, element) {
    assert.equal(position, "afterend");
    if (!this.parentElement) throw new Error("fixture element has no parent");
    if (element.parentElement) element.remove();
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    siblings.splice(index + 1, 0, element);
    element.parentElement = this.parentElement;
    return element;
  }
  get nextElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    return siblings[siblings.indexOf(this) + 1] || null;
  }
  querySelectorAll(selector) {
    const classMatch = selector.match(/\.([A-Za-z0-9_-]+)/);
    const attrMatch = selector.match(/\[data-([a-z0-9-]+)="([^"]+)"\]/i);
    const results = [];
    const visit = (node) => {
      node.children.forEach((child) => {
        const classOk = !classMatch || child.classList.contains(classMatch[1]);
        const attrKey = attrMatch ? attrMatch[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()) : null;
        const attrOk = !attrMatch || child.dataset[attrKey] === attrMatch[2];
        if (classOk && attrOk) results.push(child);
        visit(child);
      });
    };
    visit(this);
    return results;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "href") this.href = String(value);
  }
  remove() {
    if (this.parentElement) {
      const siblings = this.parentElement.children;
      const index = siblings.indexOf(this);
      if (index >= 0) siblings.splice(index, 1);
    }
    this.parentElement = null;
    this.removed = true;
  }
}

function makePageStudyMountHarness(pageKey, topicId) {
  const source = read("assets/js/page-study.js");
  const appendLink = extractPageStudyFunction(source, "appendKitLink", "\n  function createKitItem(");
  const createItem = extractPageStudyFunction(source, "createKitItem", "\n  function foldGs1MindmapEntry(");
  const foldGs1 = extractPageStudyFunction(source, "foldGs1MindmapEntry", "\n\n  function mountTopicKits(");
  let mount = extractPageStudyFunction(source, "mountTopicKits", "\n\n  // 选择题卡片");
  mount = mount
    .replace('import(new URL("assets/js/features/topic-kit-data.js", root).href)', "Promise.resolve(dataModule)")
    .replace('import(new URL("assets/js/features/topic-kit-state.js", root).href)', "Promise.resolve(stateModule)");
  assert.doesNotMatch(mount, /\bimport\s*\(/, "fixture 只替换动态模块加载，保留 mountTopicKits 主体逻辑");

  const group = new KitFixtureElement("div");
  group.className = "zsb-topic-rate";
  group.dataset.zsbTopicIds = topicId;
  const parent = new KitFixtureElement("div");
  parent.appendChild(group);
  const navLink = new KitFixtureElement("a");
  navLink.href = "#mindmap";
  navLink.dataset.indexPoint = "mindmap";

  const doc = {
    createElement(tagName) { return new KitFixtureElement(tagName); },
    querySelectorAll(selector) {
      return selector === ".zsb-topic-rate[data-zsb-topic-ids]" ? [group] : [];
    },
    querySelector(selector) {
      if (selector === 'a[data-index-point="mindmap"][href="#mindmap"]') return navLink;
      if (selector.includes('.e1-topic-kit[data-topic-id="math.domain"]')) {
        const kit = parent.children.find((child) => child.dataset.topicId === "math.domain");
        const item = kit?.children.find((child) => child.dataset.e1KitItem === "mindmap");
        return item?.querySelector(".e1-topic-kit__links") || null;
      }
      return null;
    },
    addEventListener() {}
  };

  const stateModule = {
    async readTopicKitStates(entries) { return entries.map((entry) => ({ topicId: entry.topicId, questionId: entry.questionId })); },
    describeTopicKitStatus() { return "未打卡"; },
    topicKitStatusDetail() { return ""; }
  };
  const factory = new Function(
    "document", "root", "pageKey", "qid", "ensureTopicKitStyles", "dataModule", "stateModule",
    `${appendLink}\n${createItem}\n${foldGs1}\n${mount}\nreturn mountTopicKits;`
  );
  const mountTopicKits = factory(
    doc,
    "https://example.test/",
    pageKey,
    (anchor) => `page:${pageKey}:${anchor}`,
    () => {},
    { TOPIC_KIT_BY_ID },
    stateModule
  );
  return { mountTopicKits, parent, group, navLink };
}

test("page-study 在打卡注入后调用 mountTopicKits，且真实挂载五项与 C 口诀链接", async () => {
  const source = read("assets/js/page-study.js");
  const startup = source.indexOf("  injectTopicRatings();", source.indexOf("// 先按 pageKey"));
  const mountCall = source.indexOf("  mountTopicKits();", startup);
  assert.ok(startup >= 0 && mountCall > startup, "mountTopicKits 必须在 injectTopicRatings 之后调用");
  assert.equal((source.match(/^\s*mountTopicKits\(\);\s*$/gm) || []).length, 1);

  const harness = makePageStudyMountHarness("c-notes", "c.ch1.intro");
  harness.mountTopicKits();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  const kit = harness.parent.children.find((child) => child.classList.contains("e1-topic-kit"));
  assert.ok(kit, "调用 mountTopicKits 后应真实插入 .e1-topic-kit");
  assert.equal(kit.children.filter((child) => child.classList.contains("e1-topic-kit__item")).length, 5);
  const mindmap = kit.children.find((child) => child.dataset.e1KitItem === "mindmap");
  assert.equal(mindmap.querySelector(".e1-topic-kit__value")?.textContent, "缺逐点导图");
  const mnemonic = mindmap.querySelectorAll(".e1-topic-kit__link").find((link) => link.textContent === "速记口诀表");
  assert.ok(mnemonic, "C 点齐套条必须渲染 topic 级 extraLinks");
  assert.equal(mnemonic.href, "https://example.test/c/notes.html#overview");
  assert.equal(kit.querySelector('[data-e1-topic-kit-status="1"]')?.textContent, "未打卡");
});

test("齐套条真实渲染 PPT 5.1 视频缺项，不把缺失伪装成播放器", async () => {
  const harness = makePageStudyMountHarness("ppt5", "cb.ppt.51");
  harness.mountTopicKits();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  const kit = harness.parent.children.find((child) => child.classList.contains("e1-topic-kit"));
  assert.ok(kit);
  const video = kit.children.find((child) => child.dataset.e1KitItem === "video");
  assert.equal(video.querySelector(".e1-topic-kit__value")?.textContent, "缺讲义视频");
  assert.equal(video.querySelectorAll(".e1-topic-kit__link").length, 0);
});

test("GS1 齐套条挂载后会运行时折叠侧栏导图入口，源 HTML 不参与修改", async () => {
  const harness = makePageStudyMountHarness("gs1", "math.domain");
  harness.mountTopicKits();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.navLink.removed, true);
  const kit = harness.parent.children.find((child) => child.dataset.topicId === "math.domain");
  const mindmap = kit.children.find((child) => child.dataset.e1KitItem === "mindmap");
  assert.ok(mindmap.querySelectorAll(".e1-topic-kit__link").some((link) => link.textContent === "本页导图区"));
});

function navLink(href, text) {
  return {
    href,
    textContent: text,
    dataset: {},
    attributes: {},
    classList: { add(name) { this.className = `${this.className || ""} ${name}`.trim(); } },
    removed: false,
    setAttribute(name, value) { this.attributes[name] = String(value); if (name === "href") this.href = String(value); },
    remove() { this.removed = true; }
  };
}

test("高数目录页导图入口折回第一章考点，而不是继续作为独立导图主入口", () => {
  const links = [navLink("mindmap.html", "导图"), navLink("mindmap.html", "导图")];
  assert.equal(foldGsMindmapDirectoryEntries({ querySelectorAll: () => links }), 2);
  for (const link of links) {
    assert.equal(link.href, "gs1.html#point-1");
    assert.equal(link.textContent, "第一章考点");
    assert.equal(link.dataset.e1TopicTarget, "math.domain");
  }
});

test("Excel 导图入口逐一折进 cb.excel.41–47，不给科目页增加打卡", () => {
  const section = { hidden: false, setAttribute(name, value) { this[name] = value; } };
  const excelSection = {};
  const subnav = navLink("#mindmap", "思维导图");
  const bodies = new Map();
  const cards = new Map();
  for (let index = 1; index <= 7; index += 1) {
    const body = {
      children: [],
      querySelector(selector) {
        const match = selector.match(/data-e1-topic-map="([^"]+)"/);
        return match ? this.children.find((child) => child.dataset.e1TopicMap === match[1]) || null : null;
      },
      appendChild(child) { this.children.push(child); return child; }
    };
    bodies.set(index, body);
    cards.set(`video-4-${index}`, { querySelector: (selector) => selector === ".content-card__body" ? body : null });
  }
  const doc = {
    getElementById(id) {
      if (id === "mindmap") return section;
      if (id === "excel") return excelSection;
      return cards.get(id) || null;
    },
    querySelectorAll(selector) { return selector === 'a[href="#mindmap"]' ? [subnav] : []; },
    createElement(tagName) {
      return {
        tagName, dataset: {}, attributes: {}, className: "", href: "", textContent: "",
        setAttribute(name, value) { this.attributes[name] = String(value); if (name === "href") this.href = String(value); }
      };
    }
  };
  assert.equal(foldExcelMindmapDirectoryEntry(doc), 14);
  assert.equal(section.hidden, true);
  assert.equal(section["aria-hidden"], "true");
  assert.equal(subnav.removed, true);
  for (let index = 1; index <= 7; index += 1) {
    const links = bodies.get(index).children;
    assert.equal(links.length, 2);
    assert.ok(links.every((link) => link.tagName === "a"), "只增加导图链接，不生成打卡控件");
    assert.deepEqual(links.map((link) => link.dataset.e1TopicMap), Array(2).fill(`cb.excel.${40 + index}`));
    assert.deepEqual(links.map((link) => link.href), ["mindmap.png", "mm.html"]);
  }
});

test("英语四张导图折回非谓语或 D3 对应知识点，非谓语不编入 yy5", () => {
  const nonfiniteMap = navLink("mm/mm1.svg", "非谓语动词思维导图");
  const section = {
    hidden: false,
    setAttribute(name, value) { this[name] = value; },
    querySelector(selector) { return selector === 'a[href="mm/mm1.svg"]' ? nonfiniteMap : null; }
  };
  const heading = {
    inserted: null,
    insertAdjacentElement(position, element) {
      assert.equal(position, "afterend");
      this.inserted = element;
    }
  };
  const yymapsNav = navLink("#yymaps", "思维导图");
  const doc = {
    getElementById(id) { return id === "yymaps" ? section : id === "_1" ? heading : null; },
    querySelectorAll(selector) { return selector === 'a[href="#yymaps"]' ? [yymapsNav] : []; }
  };
  assert.equal(foldEnglishMindmapDirectoryEntry(doc), true);
  assert.equal(section.hidden, true);
  assert.equal(section["aria-hidden"], "true");
  assert.equal(yymapsNav.removed, true);
  assert.equal(heading.inserted, nonfiniteMap);
  assert.equal(nonfiniteMap.dataset.e1TopicMap, "english.nonfinite");
  assert.equal(nonfiniteMap.href, "mm/mm1.svg");
  assert.equal(TOPIC_KIT_BY_ID["english.attributive.basics"].mindmap.href, "yy/mm/mm2.svg");
  assert.equal(TOPIC_KIT_BY_ID["english.noun.basics"].mindmap.href, "yy/mm/mm3.svg");
  assert.equal(TOPIC_KIT_BY_ID["english.adverbial.basics"].mindmap.href, "yy/mm/mm4.svg");
  assert.equal(Object.keys(TOPIC_KIT_BY_ID).some((id) => id.startsWith("english.nonfinite.")), false);
});

test("四个目录页实际加载运行时折叠模块", () => {
  const pages = ["gs/index.html", "gs/practice.html", "jsj/index.html", "yy/index.html"];
  for (const page of pages) {
    assert.ok(existsSync(path.join(root, page)), `缺少目录页 ${page}`);
    assert.match(read(page), /<script type="module" src="\.\.\/assets\/js\/features\/topic-kit-navigation\.js"><\/script>/, page);
  }
  const jsjHtml = read("jsj/index.html");
  if (jsjHtml.includes('id="video-4-1"')) {
    for (let index = 1; index <= 7; index += 1) assert.match(jsjHtml, new RegExp(`id="video-4-${index}"`));
    assert.match(jsjHtml, /id="mindmap"/);
    assert.match(jsjHtml, /href="mm\.html"/);
    assert.doesNotMatch(jsjHtml, /page-study\.js/, "jsj/index.html 不新增打卡入口");
  }
  const yyHtml = read("yy/index.html");
  if (yyHtml.includes('id="yymaps"')) {
    for (let index = 1; index <= 4; index += 1) assert.match(yyHtml, new RegExp(`href="mm/mm${index}\\.svg"`));
    assert.doesNotMatch(yyHtml, /page-study\.js/);
  }
});
