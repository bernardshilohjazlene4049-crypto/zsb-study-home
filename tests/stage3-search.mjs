import assert from "node:assert/strict";
import test from "node:test";
import { excerptText, groupResults, pageHeading, resultHref, sectionHeading, statusMessage, stripHeadingPrefix } from "../assets/js/site-search-format.js";
import { addAnchors, addSectionContext, visibleHeadingText } from "../.github/scripts/search-anchors.mjs";

test("状态文案与列表口径一致", () => {
  assert.equal(statusMessage(0, 0), "没有找到相关课程");
  assert.equal(statusMessage(4, 4), "找到 4 个匹配页面");
  assert.equal(statusMessage(4, 8), "找到 4 个匹配页面，共 8 条结果");
  assert.equal(statusMessage(1, 3), "找到 1 个匹配页面，共 3 条结果");
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
