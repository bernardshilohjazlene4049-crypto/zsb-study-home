import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const siteBase = "https://bernardshilohjazlene4049-crypto.github.io/zsb-study-home/";

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "_site", "node_modules"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(full);
  }
  return files;
}

const pages = walk(root).sort();
const rel = (file) => path.relative(root, file).replaceAll("\\", "/");
const read = (file) => readFileSync(file, "utf8");
const head = (html) => (html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i) || [])[1] || "";
const redirectPages = new Set([
  "wy/html/attributes.html",
  "wy/html/basic.html",
  "wy/html/elements.html",
  "wy/html/head.html",
  "wy/html/intro.html",
  "wy/html5/intro.html"
]);

test("136 个页面均有绝对 canonical、模块和状态元信息", () => {
  assert.equal(pages.length, 136);
  for (const file of pages) {
    const name = rel(file);
    const h = head(read(file));
    const canonical = h.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1] || "";
    assert.equal(canonical.startsWith(siteBase), true, `${name} canonical 应为绝对站内 URL`);
    assert.doesNotMatch(canonical, /#/, `${name} canonical 不应保留片段`);
    assert.match(h, /<meta\s+name=["']zsb-module["']\s+content=["'][^"']+["']/i, `${name} 缺少 zsb-module`);
    assert.match(h, /<meta\s+name=["']zsb-status["']\s+content=["'](?:ready|staging|redirect|error)["']/i, `${name} 缺少合法 zsb-status`);
    assert.doesNotMatch((read(file).match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "", /<[^>]+>/, `${name} title 不应含 HTML 标签`);
  }
});

test("重定向页与完整内容页状态正确，旧 URL 保留", () => {
  for (const name of redirectPages) {
    const html = read(path.join(root, name));
    assert.match(head(html), /http-equiv=["']refresh["']/i, `${name} 应保留 meta refresh`);
    assert.match(head(html), /name=["']zsb-status["'] content=["']redirect["']/i, `${name} 状态应为 redirect`);
    assert.match(head(html), /name=["']robots["'] content=["']noindex,\s*follow["']/i, `${name} 应 noindex,follow`);
    assert.match(html, /location\.replace\(/i, `${name} 应保留脚本兜底`);
  }
  const s23 = read(path.join(root, "wy/ch2/s23.html"));
  assert.match(head(s23), /name=["']zsb-status["'] content=["']ready["']/i);
  assert.doesNotMatch(head(s23), /name=["']robots["'][^>]*noindex/i);
  assert.match(s23, /2\.3[\s\S]*meta/i);
});

test("111 个网页设计页面均有逐页学习配置", () => {
  const guides = JSON.parse(read(path.join(root, "data/lesson-guides.json")));
  const webPages = pages.map(rel).filter((name) => name.startsWith("wy/"));
  assert.equal(webPages.length, 111);
  assert.equal(Object.keys(guides.pages).length, 111);
  for (const name of webPages) {
    const guide = guides.pages[name];
    assert.ok(guide, `${name} 缺少学习配置`);
    assert.equal(typeof guide.focus, "string", `${name} focus`);
    assert.equal(guide.focus.length > 0, true, `${name} focus 不能为空`);
    assert.equal(guide.objectives.length, 3, `${name} objectives`);
    assert.equal(guide.checks.length, 3, `${name} checks`);
  }
});

test("统一课页层和共有运行器已接入", () => {
  const shell = read(path.join(root, "assets/js/site-shell.js"));
  const lecture = read(path.join(root, "assets/js/shell/lecture.js"));
  const upgrade = read(path.join(root, "assets/js/shell/lesson-upgrade.js"));
  const runner = read(path.join(root, "wy/playground.js"));
  assert.match(shell, /mountLessonStyles/);
  assert.match(shell, /assets\/css\/lesson-upgrade\.css/);
  assert.match(lecture, /enhanceLesson/);
  for (const token of ["lesson-brief", "lesson-review", "lesson-side-card", "factNote", "data-reference-filter", "data-example-filter"]) {
    assert.match(upgrade, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const token of ["unhandledrejection", "tryit-copy", "event.source !== frame.contentWindow", "tryit-console"]) {
    assert.match(runner, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("网页设计课页只保留当前分册静态目录，不重复全站导航", () => {
  for (const file of pages) {
    const html = read(file);
    const side = html.match(/<aside class="wy-side"[^>]*>([\s\S]*?)<\/aside>/i)?.[1];
    if (!side) continue;
    const links = (side.match(/<a\b/gi) || []).length;
    assert.equal(links <= 40, true, `${rel(file)} 静态侧栏仍有 ${links} 个链接`);
    const groups = (side.match(/<details class="wy-group"/g) || []).length;
    assert.equal(groups <= 1, true, `${rel(file)} 静态侧栏仍包含多个分册`);
  }
});

test("重点标签、404、搜索空状态和弹性盒先修关系已修正", () => {
  for (const file of pages) {
    const html = read(file);
    assert.doesNotMatch(html, /class="wy-note">常考<\/span>/, `${rel(file)} 仍有未声明依据的侧栏常考标签`);
    assert.doesNotMatch(html, /class="wy-context-link">常考<\/[^>]+>/, `${rel(file)} 仍有未声明依据的页首常考标签`);
  }
  const notFound = read(path.join(root, "404.html"));
  assert.match(notFound, /name="zsb-status" content="error"/);
  assert.match(notFound, /notes\/index\.html/);
  assert.match(notFound, /wy\/reference\/index\.html/);
  assert.match(read(path.join(root, "assets/js/site-search.js")), /srch-suggestions/);

  const topics = JSON.parse(read(path.join(root, "data/topics.json")));
  const flex = topics.topics.find((topic) => topic.id === "web.css.flexbox");
  assert.deepEqual(flex.prereq_ids, ["web.css.layout"]);
  const deps = JSON.parse(read(path.join(root, "data/dependencies.json")));
  const edge = deps.edges.find((item) => item.topicId === "web.css.flexbox");
  assert.equal(edge.prerequisiteId, "web.css.layout");
});

test("新课程层依赖进入 PWA 预缓存清单", () => {
  const workflowBuild = read(path.join(root, ".github/scripts/sw-build.mjs"));
  const testBuild = read(path.join(root, "tests/stage3-sw.mjs"));
  for (const file of ["assets/css/lesson-upgrade.css", "assets/js/shell/lesson-upgrade.js", "data/lesson-guides.json"]) {
    assert.match(workflowBuild, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(testBuild, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
