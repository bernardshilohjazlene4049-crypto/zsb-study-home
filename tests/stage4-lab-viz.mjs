// 课堂可视化（assets/js/lab-viz.js）接入检查：挂载点、原页面内容不变、课堂原题数据与 calc-net 计算一致。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NC = require("../assets/js/calc-net.js");
const Lab = require("../assets/js/lab-viz.js");
const originals = JSON.parse(read("tests/fixtures/lab-originals.json"));
const sha = (s) => createHash("sha256").update(s).digest("hex");

const strip = (html) => html
  .replace(/<!--lab:[^>]*?-->[\s\S]*?<!--\/lab:[^>]*?-->/g, "")
  .replace(/<link rel="stylesheet" href="[^"]*lab-viz\.css">\n?/g, "")
  .replace(/<script src="[^"]*(?:calc-net|lab-viz)\.js" defer><\/script>\n?/g, "");

const EXPECT = {
  "wl/ch1/s11.html": ["classify", "quiz"], "wl/ch1/s12.html": ["quiz"], "wl/ch1/s16.html": ["quiz"],
  "wl/ch2/s22.html": ["match"], "wl/ch2/s23.html": ["cidr"], "wl/ch2/s25.html": ["cidr"], "wl/ch2/s26.html": ["and"], "wl/ch2/s27.html": ["cidr"],
  "wl/ch3/s31.html": ["subnet"], "wl/ch3/s32.html": ["subnet"], "wl/ch3/s34.html": ["subnet", "subnet", "subnet"], "wl/ch3/s35.html": ["and"], "wl/ch3/s38.html": ["subnet"],
  "wl/ch4/s42.html": ["fragment"], "wl/ch4/s43.html": ["fragment"], "wl/ch5/s53.html": ["ipv6"], "wl/ch6/s61.html": ["aggregate", "aggregate"],
  "wy/ch1/s13.html": ["layers"], "wy/ch2/s21.html": ["htmldemo"], "wy/ch2/s22.html": ["structure"],
  "notes/web.html": ["link", "howto", "text", "selectors", "forms", "widgets"],
  "wy/css/box.html": ["box"], "wy/html/quiz.html": ["htmldemo", "htmldemo", "htmldemo", "htmldemo"]
};

test("23 个页面各自挂载预期的可视化，且样式与脚本按顺序引入", () => {
  let total = 0;
  for (const [file, names] of Object.entries(EXPECT)) {
    const html = read(file);
    const got = [...html.matchAll(/<figure class="lab" data-lab="(\w+)"/g)].map((m) => m[1]);
    assert.deepEqual(got, names, file);
    total += got.length;
    const depth = file.split("/").length - 1;
    const rel = "../".repeat(depth);
    assert.equal(html.split(`${rel}assets/css/lab-viz.css`).length, 2, file);
    assert.equal(html.split(`${rel}assets/js/lab-viz.js`).length, 2, file);
    const net = names.some((n) => ["classify", "quiz", "match", "cidr", "and", "subnet", "fragment", "ipv6", "aggregate"].includes(n));
    const hasCalc = html.includes(`${rel}assets/js/calc-net.js`);
    assert.equal(hasCalc, net, file);
    if (net) assert.ok(html.indexOf("calc-net.js") < html.indexOf("lab-viz.js"), `${file}: calc-net 须先于 lab-viz`);
  }
  assert.equal(total, 35);
});

test("网络页的图放在条目「可视化讲解」区内；网页设计页放在条目内", () => {
  for (const file of Object.keys(EXPECT).filter((f) => f.startsWith("wl/"))) {
    const html = read(file);
    for (const m of html.matchAll(/<figure class="lab"/g)) {
      const head = html.slice(0, m.index);
      assert.ok(head.lastIndexOf('<div class="wy-viz') > head.lastIndexOf('<section class="wy-entry"'), file);
    }
  }
});

test("原页面内容逐字节不变（去掉新增块与引用后，sha256 与接入前一致）", () => {
  for (const [file, expected] of Object.entries(originals)) {
    assert.equal(sha(strip(read(file))), expected, file);
  }
  for (const f of Object.keys(EXPECT)) assert.ok(originals[f], f);
  assert.equal(Object.keys(originals).length, 41);
});

test("课堂原题答案与 calc-net 计算一致", () => {
  const { data } = Lab;
  assert.equal(NC.andNetwork("156.16.32.7", "/20"), "156.16.32.0");
  assert.equal(NC.andNetwork("141.14.72.24", "255.255.192.0"), "141.14.64.0");
  assert.match(data.and[0].answer, /156\.16\.32\.0\/20/); assert.match(data.and[1].answer, /141\.14\.64\.0/);
  for (const e of data.cidr) {
    const [ip, p] = e.values; const b = NC.cidrBlock(ip, Number(p));
    assert.ok(e.answer.includes(`${b.network}–${b.broadcast}`), e.label);
  }
  assert.match(data.cidr[0].answer, /255\.255\.240\.0/); assert.match(data.cidr[0].answer, /4096/);
  assert.match(data.cidr[1].answer, /4094/); assert.match(data.cidr[2].answer, /16382/);
  assert.deepEqual(data.match.options.map((o) => NC.andNetwork(o, 12) === "86.32.0.0"), [true, false, false, false]);
  for (const a of data.aggregate) {
    const r = NC.aggregateConsecutiveC(a.start, 16);
    assert.equal(r.prefix, 20); assert.equal(r.mask, "255.255.240.0"); assert.equal(r.network, a.start);
  }
  const ends = (blocks) => blocks.map((b) => b.network.split(".").pop());
  const s = data.subnet;
  assert.deepEqual(ends(NC.splitSubnets(s[0].ip, s[0].parent, s[0].prefix, s[0].omit)), ["64", "80", "96", "112"]);
  assert.deepEqual(NC.splitSubnets(s[1].ip, s[1].parent, s[1].prefix, s[1].omit).map((b) => b.network.split(".")[2]), ["32", "64", "96", "128", "160", "192"]);
  assert.deepEqual(ends(NC.splitSubnets(s[2].ip, s[2].parent, s[2].prefix, s[2].omit)), ["32", "64", "96", "128", "160", "192"]);
  assert.deepEqual(ends(NC.splitSubnets(s[4].ip, s[4].parent, s[4].prefix, s[4].omit)), ["32", "64", "96", "128", "160", "192"]);
  const b3 = NC.cidrBlock(s[3].ip, s[3].prefix); assert.equal(b3.network, "187.24.80.0"); assert.equal(b3.broadcast, "187.24.95.255"); assert.equal(b3.mask, "255.255.240.0");
  for (const [, , ip, p] of s[5].lans) assert.ok(s[5].answer.includes(`${ip}/${p}`));
  assert.deepEqual(NC.fragmentPlan(4000, 20, 1500).map((f) => [f.dataLength, f.offset, f.MF]), [[1480, 0, 1], [1480, 185, 1], [1020, 370, 0]]);
  assert.deepEqual(NC.fragmentPlan(3820, 20, 1420).map((f) => [f.dataLength, f.totalLength, f.offset, f.MF]), [[1400, 1420, 0, 1], [1400, 1420, 175, 1], [1000, 1020, 350, 0]]);
});

test("自测题答案与课堂题库一致，页面不出现「待确认」类标注", () => {
  const quiz = Lab.data.quiz;
  assert.equal(quiz.length, 13);
  assert.deepEqual(quiz.map((q) => q.answer), ["3", "BC", "ADE", "A", "点分十进制", "128.11", "3.31", "32", "128", "网络号和主机号", "直接广播地址", "网络地址", "环回地址"]);
  const js = read("assets/js/lab-viz.js");
  assert.ok(!js.includes("待确认"));
  for (const file of Object.keys(EXPECT)) {
    const labs = [...read(file).matchAll(/<!--lab:[^>]*?-->([\s\S]*?)<!--\/lab:/g)].map((m) => m[1]).join("");
    assert.ok(!labs.includes("待确认"), file);
  }
  // p96 题干与 p97 板书两处原文并列，不下结论
  const sub = Lab.data.subnet[5];
  assert.match(sub.rule, /p96 题干/); assert.match(sub.rule, /p97 板书/);
  assert.deepEqual(sub.lans.map((l) => l[1]), [150, 91, 15, 3, 3]);
  // 流标号只显示字段名
  assert.equal(Lab.data.ipv6.notes[2], "流标号");
});

test("每个知识点页留一个空的插图位：隐藏、无图、无占位文字", () => {
  const pages = Object.keys(originals).filter((f) => /^(wl\/ch\d|wy\/ch[12])\/s[^/]*\.html$/.test(f));
  assert.equal(pages.length, 38);
  for (const f of pages) {
    const html = read(f);
    const slots = [...html.matchAll(/<div class="wy-illus" data-illus="([^"]+)" hidden><\/div>/g)];
    assert.equal(slots.length, 1, f);
    assert.equal(slots[0][1], f.replace(/\.html$/, "").replaceAll("/", "."), f);
  }
});

test("无外链、无 CDN，相对路径", () => {
  for (const f of ["assets/js/lab-viz.js", "assets/js/calc-net.js", "assets/css/lab-viz.css"]) {
    assert.ok(!/https?:\/\//.test(read(f)), f);
  }
});
