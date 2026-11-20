import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, statSync } from "node:fs";
import test from "node:test";

const page = readFileSync("gs/gs1.html", "utf8");
const source = JSON.parse(readFileSync("tests/fixtures/gs1-source.json", "utf8"));
const photos = JSON.parse(readFileSync("tests/fixtures/gs1-photos.json", "utf8"));
const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");
const visible = (fragment) => fragment.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const blocks = [...page.matchAll(/<!--gs-pt:(\d+)-->([\s\S]*?)<!--\/gs-pt:\1-->/g)];

test("11 个考点各有一个原文块，原有页面内容一字不少", () => {
  assert.deepEqual(blocks.map((m) => Number(m[1])), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  let rest = page.replace(/<!--gs-pt:(\d+)-->[\s\S]*?<!--\/gs-pt:\1-->/g, "").replace(/<!--gs-photo-->[\s\S]*?<!--\/gs-photo-->\n?/, "");
  rest = rest.replace('\n<link rel="stylesheet" href="../assets/css/wy-points.css"><link rel="stylesheet" href="../assets/css/gs-points.css">', "")
    .replace('\n<script src="../assets/js/wy-points.js" defer></script><script src="../assets/js/gs-viz.js" defer></script>', "");
  assert.equal(sha(Buffer.from(rest, "utf8")), source.original_sha256);
});

test("每个条目只出现一次，原文逐字等于转写，打开原图按钮指向存在的照片", () => {
  const ids = [...page.matchAll(/<section class="wy-entry" id="(gs1-\d+-\d+)">/g)].map((m) => m[1]);
  assert.deepEqual(ids, source.entries.map((e) => e.id));
  assert.equal(new Set(ids).size, ids.length);
  const tabs = new Set([...page.matchAll(/data-photo-number="(\d+)"/g)].map((m) => Number(m[1])));
  for (const entry of source.entries) {
    const start = page.indexOf(`<section class="wy-entry" id="${entry.id}">`);
    const end = page.indexOf("</section>", start);
    const section = page.slice(start, end);
    const a = section.indexOf("<div class=\"wy-source wy-paper\" data-gs-source>");
    assert.ok(a > 0, entry.id);
    let b = [section.indexOf('<div class="wy-supplement', a), section.indexOf('<div class="gs-viz-wrap', a)].filter((x) => x > 0).sort((x, y) => x - y)[0] ?? section.length;
    assert.equal(visible(section.slice(a, b)), entry.text, entry.id);
    const button = section.match(/data-open-photo data-photos="([\d,]+)"/);
    assert.ok(button, `${entry.id} 缺少打开原图`);
    assert.deepEqual(button[1].split(",").map(Number), entry.photos);
    for (const number of entry.photos) assert.ok(tabs.has(number), `${entry.id} 的原图 ${number} 不在弹窗里`);
  }
});

test("照片：7 张存在、尺寸与 SHA-256 与登记一致，p07 已转正，弹窗里初始没有 src", () => {
  assert.deepEqual(Object.keys(photos), ["p01", "p02", "p03", "p04", "p05", "p06", "p07"]);
  for (const [key, info] of Object.entries(photos)) {
    assert.ok(existsSync(info.file), key);
    const buffer = readFileSync(info.file);
    assert.equal(sha(buffer), info.sha256, key);
    assert.equal(buffer.length, info.bytes);
    assert.equal(buffer[0], 0xff); assert.equal(buffer[1], 0xd8);
    // 读取 JPEG SOF 段里的真实尺寸，并确认没有 EXIF 方向标记
    let i = 2, size;
    while (i < buffer.length) {
      assert.equal(buffer[i], 0xff);
      const marker = buffer[i + 1], length = buffer.readUInt16BE(i + 2);
      assert.notEqual(marker, 0xe1, `${key} 带 EXIF`);
      if (marker >= 0xc0 && marker <= 0xc2) { size = [buffer.readUInt16BE(i + 7), buffer.readUInt16BE(i + 5)]; break; }
      i += 2 + length;
    }
    assert.deepEqual(size, [info.width, info.height], key);
    assert.ok(buffer.length < 400 * 1024, `${key} 体积 ${buffer.length}`);
  }
  assert.ok(photos.p07.width > photos.p07.height && photos.p01.width < photos.p01.height);
  const dialog = page.match(/<dialog class="wy-photo"[\s\S]*?<\/dialog>/)[0];
  assert.equal((dialog.match(/data-photo="gs1\/photos\/p0[1-7]\.jpg"/g) || []).length, 7);
  assert.doesNotMatch(dialog, /<img[^>]* src=/);
  assert.equal((page.match(/<dialog class="wy-photo"/g) || []).length, 1);
});

test("可视化：六个组件各挂一次，脚本无外链，页面没有速记、讲义原图区或外部资源", () => {
  const added = blocks.map((m) => m[2]).join("");
  assert.deepEqual([...added.matchAll(/data-gs-viz="(\d)"/g)].map((m) => m[1]).sort(), ["1", "2", "3", "4", "5", "6"]);
  assert.ok(existsSync("assets/js/gs-viz.js") && existsSync("assets/css/gs-points.css"));
  const script = readFileSync("assets/js/gs-viz.js", "utf8");
  assert.doesNotMatch(script, /https?:\/\//);
  assert.doesNotMatch(added, /https?:\/\/|速记|讲义原图|待确认|待补/);
  assert.doesNotMatch(readFileSync("assets/css/gs-points.css", "utf8"), /https?:\/\/|@import/);
  assert.match(page, /<script src="\.\.\/assets\/js\/gs-viz\.js" defer>/);
});

test("每个手写看不清的位置都保留【看不清】，原文的错字和讲义编号原样保留", () => {
  const text = source.entries.map((e) => e.text).join("\n");
  assert.ok((text.match(/【看不清】/g) || []).length >= 8);
  assert.match(text, /考点七：两个重要极限/);
  assert.match(text, /若不需要判断类型/);
  assert.match(text, /每个极限都存在（能算出数），才可以分开算/);
  assert.match(text, /lim x→−∞ f\(x\)=lim x→\+∞ f\(x\)|−∞/);
  assert.ok(source.entries.find((e) => e.id === "gs1-8-2").text.includes("单独的"));
});

test("讲解图：11 个考点槽位加考点六的等价无穷小替换图均已接入，文件存在、alt 非空、未隐藏", () => {
  const expected = [
    ["1", "gs1/illus/k01-domain.webp"],
    ["2", "gs1/illus/k02-properties.webp"],
    ["3", "gs1/illus/k03-sequence.webp"],
    ["4", "gs1/illus/k04-function-limit.webp"],
    ["5", "gs1/illus/k05-infinitesimal.webp"],
    ["6", "gs1/illus/k06-compare.webp"],
    ["6-eq", "gs1/illus/k07-equivalent.webp"],
    ["7", "gs1/illus/k08-important-limits.webp"],
    ["8", "gs1/illus/k09-asymptote.webp"],
    ["9", "gs1/illus/k10-continuity.webp"],
    ["10", "gs1/illus/k11-discontinuity.webp"],
    ["11", "gs1/illus/k12-closed-interval.webp"],
  ];
  const slots = [...page.matchAll(/<div class="gs-illus" data-gs-illus="([^"]+)">([\s\S]*?)<\/div>/g)];
  assert.deepEqual(slots.map((m) => m[1]), expected.map((e) => e[0]));
  assert.equal(page.includes('data-gs-illus="6" hidden'), false);
  for (const [key, src] of expected) {
    const block = slots.find((m) => m[1] === key);
    assert.ok(block, key);
    assert.ok(block[2].includes(`src="${src}"`), `${key} src`);
    const alt = block[2].match(/alt="([^"]+)"/);
    assert.ok(alt && alt[1], `${key} alt`);
    assert.match(alt[1], /讲解图$/);
    assert.match(block[2], /loading="lazy"/);
    assert.match(block[2], /decoding="async"/);
    assert.match(block[2], /width="\d+"/);
    assert.match(block[2], /height="\d+"/);
    const file = "gs/" + src;
    assert.ok(existsSync(file), file);
    assert.ok(statSync(file).size < 300 * 1024, `${file} 体积`);
    assert.doesNotMatch(block[2], /hidden|待确认|本次用|讲义原图/);
  }
  const pt6 = page.match(/<!--gs-pt:6-->([\s\S]*?)<!--\/gs-pt:6-->/)[1];
  const eqPos = pt6.indexOf('data-gs-illus="6-eq"');
  const e63 = pt6.indexOf('id="gs1-6-3"');
  const e63end = pt6.indexOf("</section>", e63);
  assert.ok(eqPos > e63end, "等价无穷小替换图应在考点六「八个等价替换 / 等价无穷小大小数轴」条目之后");
});
