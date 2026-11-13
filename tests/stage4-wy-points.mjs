import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { directoryTopics, lectureChapterIds } from "../assets/js/shell/lecture.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const json = path => JSON.parse(read(path));
const ids = ["s11", "s12", "s13", "s-extra", "s21", "s22", "s22b", "s23", "s24"];
const topicIds = ["web.concepts", "web.process", "web.layers", "web.tools", "web.s21", "web.s22", "web.s22b", "web.s23", "web.s24"];
const pathFor = id => `wy/ch${ids.indexOf(id) < 4 ? 1 : 2}/${id}.html`;
const pages = ids.map(pathFor).concat(["wy/ch1/index.html", "wy/ch2/index.html"]);
const norm = s => s.replace(/\s+/g, " ").trim();
const decode = s => s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
  if (entity[0] === "#") return String.fromCodePoint(entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)));
  return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[entity];
});
const text = html => norm(decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "")));

test("基线第1/2章、16条自测和视频文字逐块保留（209条）", () => {
  const fixture = json("tests/fixtures/wy-ch12-legacy-text.json");
  assert.equal(fixture.baseline, "511d360f0514ba8f1b721643837b663dd6cf7078");
  assert.equal(fixture.blocks.length, 209);
  const all = pages.map(p => text(read(p))).join(" ");
  const missing = fixture.blocks.filter(s => !all.includes(s));
  assert.deepEqual(missing, [], `缺失旧文字：\n${missing.join("\n")}`);
});

test("照片应显示的正文与手写批注逐字出现在对应讲义原文中（122条）", () => {
  const fixture = json("tests/fixtures/wy-ch12-transcript-text.json");
  assert.equal(Object.values(fixture).flat().length, 122);
  const missing = [];
  for (const [id, blocks] of Object.entries(fixture)) {
    const html = read(pathFor(id));
    const source = text(html.slice(html.indexOf('<div class="wy-paper">'), html.indexOf('<section class="wy-organized"')));
    for (const block of blocks) if (!source.includes(block)) missing.push(`${id}: ${block}`);
  }
  assert.deepEqual(missing, [], `缺失照片转写：\n${missing.join("\n")}`);
});

test("九张导图的节点与原始子树逐字相同，无添加或遗漏", () => {
  const fixture = json("tests/fixtures/wy-ch12-mindmap-text.json");
  for (const id of ids) {
    const source = read(pathFor(id)).match(/<ul class="wy-mm-src">([\s\S]*?)<\/div><\/div>/)[1];
    const nodes = [...source.matchAll(/<li><span(?: class="wy-mm-hand")?>([\s\S]*?)<\/span>/g)].map(m => text(m[1]));
    assert.deepEqual(nodes, fixture[id].map(norm), id);
  }
});

test("九页结构、标签、标题元信息、按需原图与全部相对资源", () => {
  const { topics } = json("data/topics.json");
  for (const [i, id] of ids.entries()) {
    const path = pathFor(id), html = read(path);
    const topic = topics.find(t => t.id === topicIds[i]);
    assert.equal(topic.legacy_url, path);
    assert.equal(topic.source_ref, path);
    assert.equal(decode(html.match(/<title>([\s\S]*?)<\/title>/)[1]), `${topic.title} · 网页设计 · 辽宁专升本`);
    assert.equal(decode(html.match(/<meta name="description" content="([^"]*)"/)[1]), `网页设计 · ${topic.title}`);
    for (const name of ["lecture", "mindmap", ...(id === "s-extra" ? [] : ["practice"])]) {
      assert.match(html, new RegExp(`role="tab" id="tab-${name}" aria-controls="${name}"`));
      assert.match(html, new RegExp(`id="${name}"[^>]*role="tabpanel" aria-labelledby="tab-${name}"`));
    }
    assert.equal((html.match(/role="tab"/g) || []).length, id === "s-extra" ? 2 : 3);
    for (const label of ["讲义原文", "整理", "打开原图"]) assert.ok(html.includes(label));
    assert.match(html, /<ul class="wy-mm-src">/);
    assert.match(html, /<dialog class="wy-photo"/);
    assert.match(html, /data-open-photo/);
    const photos = [...html.matchAll(/data-photo="([^"]+)" data-width="(\d+)" data-height="(\d+)"/g)];
    const photoNames = ["01M6NNTT6F0QBEKT0V5WBJHHEM", "01M6NNTW88HTX0V24269WR4D6T", "01M6NNV0RP1JNNW98MZ1VKE1NW", "01M6NNXP4W98VHZ3243W11M55Z", "01M6NNXVKR97GSZJ4XDP4AVTX0", "01M6NNXYHM4CKVKAXYFBAB9367", "01M6NNY28N880ZDJ4CV661VSQC", "01M6NP1DJPVH3E0P1HHABH7S8E"];
    const mapping = [[0,1], [1], [1,2], [2], [3], [3,4], [5], [6,7], [7]];
    assert.deepEqual(photos.map(m => m[1]), mapping[i].map(n => `../原图/${photoNames[n]}.jpg`));
    const image = html.match(/<img alt="讲义原图" width="(\d+)" height="(\d+)"/);
    assert.ok(image, "原图 img 应有显式尺寸");
    assert.deepEqual(image.slice(1), photos[0].slice(2));
    for (const [,photo,w,h] of photos) {
      assert.ok(existsSync(resolve(root, dirname(path), photo)));
      assert.ok(Number(w) >= 1536 && Number(h) >= 2048);
    }
    assert.doesNotMatch(html, /<img[^>]+src=["'][^"']*原图\//);
    assert.doesNotMatch(html, /<pre(?![^>]*tabindex="0")[^>]*>/);
  }
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /href="\.\.\/\.\.\/assets\/css\/site-shell.css"/);
    assert.match(html, /<script src="\.\.\/\.\.\/assets\/js\/site-shell.js"><\/script>/);
    for (const match of html.matchAll(/<(?:script|link|img|video|track)\b[^>]*\s(?:src|href|poster)="([^"]+)"/g)) {
      assert.doesNotMatch(match[1], /^(https?:|\/)/);
      assert.ok(existsSync(resolve(root, dirname(page), decode(match[1]).split(/[?#]/)[0])), `${page}: ${match[1]}`);
    }
  }
});

test("章节列表分别4/5项；章级视频入口保留、两个迁移入口及依赖边已移除", () => {
  const { topics, chapters } = json("data/topics.json");
  for (const ch of [1, 2]) {
    const page = `wy/ch${ch}/index.html`, html = read(page);
    const expected = topics.filter(t => t.chapter_id === `web.ch${ch}` && t.legacy_url !== page);
    assert.equal(expected.length, ch === 1 ? 4 : 5);
    assert.equal((html.match(/class="wy-chapter-row"/g) || []).length, expected.length);
    assert.ok(html.includes(`${expected.length} 个知识点`));
    assert.equal(chapters.find(c => c.id === `web.ch${ch}`).source_ref, page);
    for (const t of expected) assert.ok(html.includes(`href="${t.legacy_url.split("/").at(-1)}"`));
  }
  const overview = topics.find(t => t.id === "web.html5_structure");
  assert.equal(overview.legacy_url, "wy/ch2/index.html");
  assert.equal(overview.source_ref, overview.legacy_url);
  assert.ok(existsSync(resolve(root, overview.legacy_url)));
  assert.ok(!topics.some(t => ["web.quiz_points", "web.figs"].includes(t.id)));
  assert.doesNotMatch(read("data/dependencies.json"), /web\.(quiz_points|figs)/);
  const home = read("wy/index.html");
  for (const id of ids.concat(["ch2", "s-quiz", "s-figs"])) assert.ok(home.includes(`id="${id}"`), id);
  assert.match(home, /location\.replace\(target\)/);
  for (const id of ids) assert.ok(home.includes(`${id}:"ch${ids.indexOf(id) < 4 ? 1 : 2}/${id}.html"`) || home.includes(`"${id}":"ch1/${id}.html"`));
  assert.doesNotMatch(home, /<video|<img[^>]*原图/);
});

test("习题16条按原编号分配，补充工具页无习题", () => {
  const numbers = [[1,2,3,4,5,6],[7],[8],[],[1,2],[3,4],[5,8],[6],[7]];
  for (const [i,id] of ids.entries()) {
    const practice = read(pathFor(id)).match(/<div id="practice"[\s\S]*?<\/ol>/)?.[0] || "";
    assert.deepEqual([...practice.matchAll(/class="rn">(\d+)</g)].map(m=>Number(m[1])), numbers[i]);
    assert.doesNotMatch(practice, /<details|答案/);
  }
});

function jpegInfo(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8);
  let pos = 2, width, height, orientation = null;
  while (pos + 4 < bytes.length) {
    if (bytes[pos++] !== 0xff) throw new Error("JPEG 标记错误");
    while (bytes[pos] === 0xff) pos++;
    const marker = bytes[pos++];
    if (marker === 0xda || marker === 0xd9) break;
    const length = bytes.readUInt16BE(pos);
    if ([0xc0,0xc1,0xc2].includes(marker)) {
      height = bytes.readUInt16BE(pos + 3); width = bytes.readUInt16BE(pos + 5);
    }
    if (marker === 0xe1 && bytes.toString("ascii", pos+2, pos+8) === "Exif\0\0") {
      const t = pos + 8, le = bytes.toString("ascii",t,t+2) === "II";
      const u16 = offset => le ? bytes.readUInt16LE(offset) : bytes.readUInt16BE(offset);
      const u32 = offset => le ? bytes.readUInt32LE(offset) : bytes.readUInt32BE(offset);
      const ifd = t + u32(t+4);
      for (let i=0;i<u16(ifd);i++) {
        const entry = ifd+2+12*i;
        if (u16(entry) === 0x112) orientation = u16(entry+8);
      }
    }
    pos += length;
  }
  return { width, height, orientation };
}

test("三张替换 JPEG 尺寸与 EXIF 方向正确，SHA256 与输入校验值相同", async () => {
  const { createHash } = await import("node:crypto");
  const photos = [
    ["01M6NNXVKR97GSZJ4XDP4AVTX0",4096,3072,"24c0b2da0dd45dcef474c6dba028cfb864eb0c20f3c7ac2e89a97691ba459195"],
    ["01M6NNY28N880ZDJ4CV661VSQC",4096,3072,"ce6f7fbdc1e9cad3af9ad8aed601a8db577a2f246db6fc353e37967010622c9c"],
    ["01M6NP1DJPVH3E0P1HHABH7S8E",3072,4096,"27eea978d79dbe8077277f387e8173efc40a255e588e64cc21f9af183f726452"]
  ];
  for (const [id,w,h,sha] of photos) {
    const bytes = readFileSync(resolve(root, `wy/原图/${id}.jpg`));
    const info = jpegInfo(bytes);
    assert.equal(info.width,w); assert.equal(info.height,h);
    assert.ok(info.orientation === null || info.orientation === 1);
    assert.equal(createHash("sha256").update(bytes).digest("hex"),sha);
  }
});

test("外壳章节显式选择只作用于新页；其他讲义沿用原推断与原目录", () => {
  const { topics, chapters } = json("data/topics.json");
  const model = { topLevel: id => chapters.find(c=>c.id===id) };
  const all = topics.filter(t=>t.subject_id === "web_design");
  assert.deepEqual(lectureChapterIds(model, [], all, "web.ch1"), ["web.ch1"]);
  assert.deepEqual(lectureChapterIds(model, [], all, "web.ch2"), ["web.ch2"]);
  assert.deepEqual(lectureChapterIds(model, [], all, "missing"), ["web.ch1"]);
  assert.deepEqual(lectureChapterIds(model, all.filter(t=>t.id==="web.s24"), all), ["web.ch2"]);
  for (const ch of [1,2]) assert.equal(directoryTopics(all.filter(t=>t.chapter_id===`web.ch${ch}`), true).length, ch===1?4:5);
  assert.equal(directoryTopics(all), all);
  const shell = read("assets/js/site-shell.js");
  assert.ok(shell.includes('^wy\\/ch[12]\\/[^/]+\\.html$'));
  for (const legacy of ["gs/gs1.html", "gs/gs45.html", "yy/yy5.html", "jsj/jsj1.html", "jsj/ppt5.html"]) {
    assert.ok(read("assets/js/shell/lecture.js").includes(`"${legacy}"`));
  }
});
