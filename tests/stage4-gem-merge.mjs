import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const pages = [];
for (const d of readdirSync(new URL("../wl", import.meta.url))) if (/^ch\d$/.test(d)) for (const f of readdirSync(new URL("../wl/" + d, import.meta.url))) if (/^s\d+\.html$/.test(f)) pages.push(`wl/${d}/${f}`);
for (const d of ["ch1", "ch2"]) for (const f of readdirSync(new URL("../wy/" + d, import.meta.url))) if (/^s.*\.html$/.test(f)) pages.push(`wy/${d}/${f}`);

const blocks = [];
for (const p of pages) {
  const t = read(p);
  const re = /<!--gem:([^>]*?)-->([\s\S]*?)<!--\/gem:\1-->/g;
  let m;
  while ((m = re.exec(t))) blocks.push({ p, key: m[1], html: m[2], page: t });
}
const text = (h) => h.replace(/<math[\s\S]*?<\/math>/g, "◇").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

test("讲解块：计算机网络 29 个条目、网页设计 37 处，各页内键不重复", () => {
  assert.equal(blocks.filter((b) => b.p.startsWith("wl/")).length, 29);
  assert.equal(blocks.filter((b) => b.p.startsWith("wy/")).length, 37);
  const seen = new Set();
  for (const b of blocks) { const k = b.p + "#" + b.key; assert.ok(!seen.has(k), k); seen.add(k); }
});

test("每个块都在对应条目里（计算机网络在整理之后、可视化之前）", () => {
  for (const b of blocks.filter((x) => x.p.startsWith("wl/"))) {
    const i = b.page.indexOf(`id="e-${b.key}"`);
    const end = b.page.indexOf("</section>", i);
    const g = b.page.indexOf(`<!--gem:${b.key}-->`);
    assert.ok(i > 0 && g > i && g < end, b.p + b.key);
    const sup = b.page.indexOf('<div class="wy-supplement wy-paper"><h3>整理</h3>', i);
    assert.ok(sup > 0 && sup < g, "整理 在讲解之前 " + b.key);
  }
});

test("不含版本标签、提示/待确认文字、讲解稿里的方案与 ASCII、备考口径", () => {
  const bad = /Gemini|Neon|GPT|本次用|待确认|「补充」|可视化方案|Plaintext|辽宁专升本|专升本|考场|必背|factNote|改写批注|\*\*|<!doctype \*|冲突规则/;
  for (const b of blocks) assert.ok(!bad.test(text(b.html)) && !bad.test(b.html.replace(/<pre[\s\S]*?<\/pre>/g, "")), b.p + "#" + b.key);
  for (const b of blocks) assert.ok(!/[─│┌┐└┘├┤┬┴┼+\-]{6,}/.test(text(b.html)), "无 ASCII 图 " + b.key);
});

test("网页设计第 2 章题 7：不把背景色和背景图写成冲突规则，改为照片上的两句手写批注", () => {
  const b = blocks.filter((x) => x.p === "wy/ch2/s24.html");
  assert.equal(b.length, 1);
  const t = text(b[0].html);
  assert.ok(t.includes("同时设置背景【看不清】和图像") && t.includes("显示背景图像"));
  assert.ok(!t.includes("冲突") && !t.includes("优先显示"));
});

test("doctype 声明照抄合法：讲解块里的 <!doctype html> 不带星号", () => {
  for (const b of blocks) {
    for (const m of b.html.matchAll(/&lt;!doctype[^&]*&gt;/gi)) assert.equal(m[0], "&lt;!doctype html&gt;");
  }
});

test("讲解块里的公式是静态 MathML，保留【看不清】原样", () => {
  assert.ok(blocks.some((b) => b.html.includes("<math")));
  assert.ok(blocks.some((b) => b.html.includes("【看不清】")));
});

test("同一段讲解文字全站只出现一次（每个知识点只出现一次）", () => {
  const seen = new Map();
  for (const b of blocks)
    for (const m of b.html.matchAll(/<(?:p|li)>((?:(?!<\/?(?:p|li|ul|ol)>)[\s\S])+)<\/(?:p|li)>/g)) {
      const t = text(m[1]).trim();
      if (t.length < 25) continue;
      assert.ok(!seen.has(t), `重复：${t.slice(0, 30)} @ ${b.p}#${b.key} / ${seen.get(t)}`);
      seen.set(t, b.p + "#" + b.key);
    }
});
