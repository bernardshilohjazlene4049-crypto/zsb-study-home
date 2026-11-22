import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createSearchMatcher, excerptText, groupResults, knowledgeScore, pageHeading, resultHref, sectionHeading, statusMessage, stripHeadingPrefix } from "../assets/js/site-search-format.js";
import { findReviewTopics, mergeSearchResults, reviewTopics } from "../assets/js/site-search-topics.js";
import { addAnchors, addSectionContext, ignoreUi, visibleHeadingText } from "../.github/scripts/search-anchors.mjs";

test("状态文案与列表口径一致", () => {
  assert.equal(statusMessage(0, 0), "没有找到相关课程");
  assert.equal(statusMessage(4, 4), "找到 4 个匹配页面");
  assert.equal(statusMessage(4, 8), "找到 4 个匹配页面，共 8 条结果");
  assert.equal(statusMessage(1, 3), "找到 1 个匹配页面，共 3 条结果");
});

test("36 个知识点按页面阅读顺序精确指向存在的章节容器", () => {
  const subjects = [["network", "network", 22], ["web_design", "web", 14]];
  assert.equal(reviewTopics.length, 36);
  assert.equal(new Set(reviewTopics.map(({ href }) => href)).size, 36);
  for (const [subject, file, expected] of subjects) {
    const html = readFileSync(new URL(`../notes/${file}-review.html`, import.meta.url), "utf8");
    const ids = [...html.matchAll(/<section\s+class="review-topic"\s+id="([^"]+)"/g)].map(([, id]) => id);
    const result = findReviewTopics("", subject);
    assert.equal(ids.length, expected);
    assert.deepEqual(result.map(({ href }) => href), ids.map((id) => `notes/${file}-review.html#${id}`));
    assert.deepEqual(result.map(({ order }) => order), ids.map((_, index) => index + 1));
    assert.ok(result.every(({ chapter }) => chapter), subject);
  }
});

test("真实查询优先匹配课堂知识点的精确链接", () => {
  const expectations = {
    "RIP": "n11-rip-distance-vector",
    "ＲＩＰ 路由表更新": "n11-rip-distance-vector",
    "ＣＳＭＡ ／ ＣＤ": "n08-ethernet-csma-frame",
    "CRC": "n07-parity-crc",
    "ARP": "n11-arp-forwarding",
    "曼彻斯特编码": "n05-line-coding-media",
    "CIDR 地址块": "n09-subnet-cidr",
    "meta 刷新": "html-meta-refresh",
    "表单归属": "form-structure-ownership",
    "datalist": "form-input-controls",
    "HTML表单": "form-structure-ownership",
    "：ｎｏｔ": "css-pseudo-classes"
  };
  for (const [query, expected] of Object.entries(expectations)) {
    assert.equal(findReviewTopics(query)[0]?.href.split("#")[1], expected, query);
  }
  assert.deepEqual(findReviewTopics("RIP", "web_design"), []);
  assert.equal(findReviewTopics("RIP")[0].chapter, "路由与转发");
  assert.equal(findReviewTopics("表单归属")[0].chapter, "HTML 表单");
});

test("英文缩写匹配词边界，旧中文词、别名与有意义的符号继续检索", () => {
  assert.equal(createSearchMatcher("RIP")("JavaScript"), 0);
  assert.ok(createSearchMatcher("等价无穷小")("无穷小与等价无穷小代换"));
  assert.ok(createSearchMatcher("数组")("二维数组"));
  assert.ok(createSearchMatcher("Ａ／Ｂ／Ｃ 类")("IP 地址的分类与 A/B/C 类范围"));
  assert.ok(createSearchMatcher("/31")("/31 点对点网络"));
  assert.equal(createSearchMatcher("CSS")("CSS3"), 0);
  assert.equal(createSearchMatcher("C++")("C 语言"), 0);
  assert.ok(knowledgeScore("HTML 表单", [], createSearchMatcher("html表单")) > 0);
  assert.ok(knowledgeScore("冒泡排序", ["交换排序"], createSearchMatcher("交换排序")) > 0);
});

test("正文标题和章节容器去重，旧讲义及原图保留为独立资料", () => {
  const base = new URL("https://example.test/zsb-study-home/");
  const [topic] = findReviewTopics("CIDR 地址块");
  const legacyHref = "notes/network.html#cidr";
  const canonicalHref = topic.href;
  const sourceHref = "notes/sources.html?subject=network&source=net-n07#source-net-n07";
  const legacy = { type: "topic", score: 100, href: legacyHref, title: "CIDR、掩码与地址块" };
  const leaf = { type: "topic", score: 100, href: "wl/ch2/s27.html", title: "已知 CIDR 地址求掩码" };
  const review = { ...topic, review: true, type: "topic" };
  const doc = { type: "doc", score: 10, href: `${base.pathname}${canonicalHref}-title`, title: "标题" };
  const source = { type: "source", score: 22, href: sourceHref, title: "原图" };
  const items = mergeSearchResults([legacy, leaf, review, doc, source, { ...doc, href: legacyHref }], base);
  assert.deepEqual(items.map(({ href, type }) => [href, type]), [
    [canonicalHref, "topic"], [leaf.href, "topic"], [sourceHref, "source"], [legacyHref, "doc"]
  ]);
  assert.equal(mergeSearchResults([doc], base)[0].href, canonicalHref);
  const shared = { type: "topic", score: 60, href: "yy/index.html#yyvideos", title: "非谓语动词基础" };
  assert.equal(mergeSearchResults([shared, { ...shared, title: "定语从句" }], base).length, 2);
});

test("每条结果使用页面原文标题，小节与页面相同时不再重复", () => {
  const entry = { meta: { title: "第一章 · 函数、极限、连续" }, url: "/gs/gs1.html", plain_excerpt: "函数极限" };
  assert.equal(pageHeading(entry), "第一章 · 函数、极限、连续");
  assert.equal(sectionHeading({ title: "练习" }, entry), "练习");
  assert.equal(sectionHeading({ title: "第一章 · 函数、极限、连续" }, entry), "");
  assert.equal(excerptText({ excerpt: "<mark>极限</mark>存在" }, entry), "极限存在");
  assert.equal(resultHref("/gs/gs1.html#point-3-h"), "/gs/gs1.html#point-3");
});

test("同一页的多条子结果归为一组，计数按组与条目", () => {
  const entries = [
    {
      meta: { title: "第一章 · 函数、极限、连续" },
      url: "/gs/gs1.html",
      sub_results: [
        { title: "练习", url: "/gs/gs1.html#practice-4", weighted_locations: new Array(74) },
        { title: "做极限题的总流程", url: "/gs/gs1.html#flow-title", weighted_locations: new Array(2) },
        { title: "练习", url: "/gs/gs1.html#practice-6", weighted_locations: new Array(22) },
        { title: "练习", url: "/gs/gs1.html#practice-7", weighted_locations: new Array(12) }
      ]
    },
    { meta: { title: "高等数学" }, url: "/gs/", sub_results: [{ title: "章节", url: "/gs/#chapters-title", weighted_locations: [1] }] }
  ];
  const groups = groupResults(entries);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].parts.map((p) => p.url), ["/gs/gs1.html#practice-4", "/gs/gs1.html#practice-6", "/gs/gs1.html#practice-7"]);
  assert.equal(groups[1].parts.length, 1);
  const itemCount = groups.reduce((n, g) => n + g.parts.length, 0);
  assert.equal(statusMessage(groups.length, itemCount), "找到 2 个匹配页面，共 4 条结果");
});

test("练习标题补上所属考点的原文，画面文字仍是练习", () => {
  const src = `<h1>第一章 · 函数、极限、连续</h1>
<section id="point-4"><h2 id="point-4-h">考点四：函数极限</h2>
<section class="practice-section"><h3 class="subsection-heading" id="practice-4">练习</h3></section>
</section>`;
  const { html, added } = addSectionContext(src);
  assert.equal(added, 1);
  assert.match(html, /class="zsb-search-context"[^>]*>考点四：函数极限 · <\/span>练习/);
  assert.equal(visibleHeadingText(html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)[1]), "练习");
  const again = addSectionContext(html);
  assert.equal(again.added, 0);
});

test("摘要开头若是被截断的小节标题则去掉，不误伤正文", () => {
  assert.equal(stripHeadingPrefix("考点四：函数极限 · 练习. 19 题", "考点四：函数极限 · 练习"), "19 题");
  assert.equal(stripHeadingPrefix("四：函数极限 · 练习. 19 题", "考点四：函数极限 · 练习"), "19 题");
  assert.equal(stripHeadingPrefix("极限存在时可以分成两项", "考点四：函数极限 · 练习"), "极限存在时可以分成两项");
});

test("补充锚点仍只给 section 里第一个无 id 的标题加 id", () => {
  const src = `<section id="point-3"><p>x</p><h2>考点三：数列极限</h2></section>`;
  const { html, added } = addAnchors(src);
  assert.equal(added, 1);
  assert.match(html, /<h2 id="point-3-h">考点三：数列极限<\/h2>/);
});

test("按钮和工具栏的非学习文字加上忽略标记，正文和学习释义仍可检索", () => {
  const src = `<h1>思维导图</h1>
<div class="map-toolbar">
  <div class="map-subtabs" role="tablist">
    <button class="btn btn--sm" type="button" role="tab" data-first-tab="tree-limit">极限</button>
  </div>
  <div class="map-actions">
    <button class="btn" type="button">全部展开</button>
    <button class="btn" type="button">全部折叠</button>
  </div>
</div>
<p>极限存在时可以分成两项。</p>
<div class="content-card__footer">
  <a class="btn btn--sm" href="gs1/mindmap.jpg">查看原图</a>
</div>
<div class="tryit">
  <div class="tryit-bar"><strong>试一试</strong>
    <div class="tryit-actions">
      <button type="button" class="btn tryit-run">运行</button>
      <button type="button" class="btn tryit-reset">重置</button>
    </div>
  </div>
</div>
<button class="meaning-button" type="button"><span class="sr-only">antecedent：</span><span class="meaning-text">先行词</span><span class="meaning-reveal">点击查看</span></button>
<button type="button" class="mobile-toc-btn">章节目录</button>
<details class="solution-toggle"><summary>查看逐步解答</summary><div class="answer-panel">答：C。极限存在。</div></details>
<button aria-label="点击揭晓答案" class="answer-chip" type="button"><span class="answer-mask">点击揭晓</span><span class="answer-text">数值计算</span></button>
<a class="video-jump" href="#video-partial-dz">跳到讲解视频</a>
<div class="pvideo"><a class="pvideo-open" href="x.mp4"><span>考点讲解</span><span class="pvideo-dur">2:32</span></a></div>
<p>核心公式与求导规则。</p>`;
  const { html, added } = ignoreUi(src);
  assert.ok(added > 0);
  assert.match(html, /class="map-actions" data-pagefind-ignore>/);
  assert.match(html, /href="gs1\/mindmap.jpg" data-pagefind-ignore>查看原图<\/a>/);
  assert.match(html, /class="tryit-actions" data-pagefind-ignore>/);
  assert.match(html, /class="meaning-reveal" data-pagefind-ignore>点击查看<\/span>/);
  assert.match(html, /class="mobile-toc-btn" data-pagefind-ignore>章节目录<\/button>/);
  assert.match(html, /<summary data-pagefind-ignore>查看逐步解答<\/summary>/);
  assert.match(html, /class="answer-mask" data-pagefind-ignore>点击揭晓<\/span>/);
  assert.match(html, /<p>极限存在时可以分成两项。<\/p>/);
  assert.match(html, /<strong>试一试<\/strong>/);
  assert.match(html, /<span class="meaning-text">先行词<\/span>/);
  assert.match(html, /data-first-tab="tree-limit">极限<\/button>/);
  assert.doesNotMatch(html, /data-first-tab="tree-limit"[^>]*data-pagefind-ignore/);
  assert.match(html, /<div class="answer-panel">答：C。极限存在。<\/div>/);
  assert.doesNotMatch(html, /class="answer-panel"[^>]*data-pagefind-ignore/);
  assert.match(html, /<span class="answer-text">数值计算<\/span>/);
  assert.doesNotMatch(html, /class="meaning-button"[^>]*data-pagefind-ignore/);
  assert.match(html, /class="video-jump"[^>]*data-pagefind-ignore>跳到讲解视频<\/a>/);
  assert.match(html, /class="pvideo" data-pagefind-ignore>/);
  assert.match(html, /<p>核心公式与求导规则。<\/p>/);
  assert.equal(ignoreUi(html).added, 0);
  assert.equal(html, ignoreUi(html).html);
});
