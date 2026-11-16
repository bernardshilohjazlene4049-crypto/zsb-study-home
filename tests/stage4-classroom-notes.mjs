import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { calculateCidr, planIpv4Fragments } from "../assets/js/network-lab.js";

const root = path.resolve(import.meta.dirname, "..");
const notesRoot = path.join(root, "notes");
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
const readText = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const manifests = [
  ["network", "notes/data/network-sources.json", "notes/network.html", 50, 4],
  ["web", "notes/data/web-sources.json", "notes/web.html", 17, 3]
];

function unique(values) {
  return new Set(values);
}

test("课堂原图清单完整、路径可发布且低清资料被明确标注", () => {
  for (const [label, manifestPath, , expectedCount, expectedLowCount] of manifests) {
    const manifest = readJson(manifestPath);
    assert.equal(manifest.items.length, expectedCount, `${label} 图片数量`);
    assert.equal(unique(manifest.items.map((item) => item.id)).size, expectedCount, `${label} 图片 id 应唯一`);

    let lowCount = 0;
    for (const item of manifest.items) {
      assert.equal(item.subject, manifest.subject, `${item.id} 科目`);
      assert.equal(typeof item.group, "string", `${item.id} 分组`);
      assert.equal(item.group.length > 0, true, `${item.id} 分组不能为空`);
      assert.equal(typeof item.file, "string", `${item.id} 文件名`);
      assert.equal(typeof item.src, "string", `${item.id} 路径`);
      assert.equal(item.src.includes(".."), false, `${item.id} 路径不能跳出 notes 目录`);

      const absolute = path.resolve(notesRoot, item.src);
      assert.equal(absolute.startsWith(notesRoot + path.sep), true, `${item.id} 路径越界`);
      assert.equal(fs.existsSync(absolute), true, `${item.id} 缺少文件 ${item.src}`);
      assert.equal(fs.statSync(absolute).size > 0, true, `${item.id} 文件为空`);
      if (item.readable) {
        const stem = item.file.replace(/\.[^.]+$/, "");
        const thumb = path.join(notesRoot, "assets", "thumbs", item.subject === "network" ? "network" : "web", `${stem}.webp`);
        assert.equal(fs.existsSync(thumb), true, `${item.id} 缺少课堂缩略图`);
        assert.equal(fs.statSync(thumb).size > 0, true, `${item.id} 课堂缩略图为空`);
      }

      if (!item.readable) {
        lowCount += 1;
        assert.match(item.note, /待补高清原图/, `${item.id} 应标注待补高清原图`);
      }
    }
    assert.equal(lowCount, expectedLowCount, `${label} 低清图片数量`);
  }
});

test("课堂笔记主题覆盖原图分组，所有页内锚点真实存在", () => {
  for (const [label, manifestPath, htmlPath] of manifests) {
    const manifest = readJson(manifestPath);
    const html = readText(htmlPath);
    const ids = unique([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
    const sourceGroups = [...html.matchAll(/\bdata-source-group=["']([^"']+)["']/g)].map((match) => match[1]);
    const manifestGroups = unique(manifest.items.map((item) => item.group));

    assert.equal(unique(sourceGroups).size, sourceGroups.length, `${label} 每个原图分组只应有一个画廊`);
    assert.deepEqual([...unique(sourceGroups)].sort(), [...manifestGroups].sort(), `${label} 原图分组未完整覆盖`);

    for (const match of html.matchAll(/\bhref=["']#([^"']+)["']/g)) {
      assert.equal(ids.has(match[1]), true, `${htmlPath} 缺少锚点 #${match[1]}`);
    }
    assert.match(html, /不代表|不是官方/, `${htmlPath} 应说明资料边界`);
  }
});

test("课堂笔记入口与科目映射完整", () => {
  const hub = readText("notes/index.html");
  for (const href of ["network.html", "web.html", "map.html", "sources.html"]) {
    assert.equal(hub.includes(`href="${href}"`), true, `课堂笔记入口缺少 ${href}`);
  }
  assert.equal(fs.existsSync(path.join(root, "notes/map.html")), true);
  assert.equal(fs.existsSync(path.join(root, "notes/sources.html")), true);

  const search = readText("assets/js/site-search.js");
  assert.match(search, /notes\/network\.html[\s\S]*return "network"/);
  assert.match(search, /notes\/web\.html[\s\S]*return "web_design"/);
});

test("课堂学习页声明科目关系并接入交互组件", () => {
  const network = readText("notes/network.html");
  const web = readText("notes/web.html");
  assert.match(network, /data-note-subject="network"/);
  assert.match(web, /data-note-subject="web_design"/);
  assert.match(network, /data-cidr-calculator/);
  assert.match(network, /data-fragment-calculator/);
  assert.match(web, /data-range-output/);
  assert.match(readText("assets/js/classroom-notes.js"), /mountLearningContext/);
  assert.equal((network.match(/class="question"/g) || []).length, 8);
  assert.equal((web.match(/class="question"/g) || []).length, 7);
  assert.match(readText("notes/index.html"), /<strong>15<\/strong> 道例题与自测/);
});

test("学习地图的所有课程节点都指向真实章节", () => {
  const map = readText("notes/map.html");
  for (const match of map.matchAll(/href="((?:network|web)\.html#[^"]+)"/g)) {
    const [file, hash] = match[1].split("#");
    assert.equal(fs.existsSync(path.join(root, "notes", file)), true, file);
    assert.equal(new Set([...readText(`notes/${file}`).matchAll(/\bid=["']([^"']+)["']/g)].map((item) => item[1])).has(hash), true, `${file}#${hash}`);
  }
});

test("CIDR 与 IPv4 分片计算覆盖课堂例题和边界", () => {
  assert.deepEqual(calculateCidr("140.120.84.24", 20), {
    address: "140.120.84.24",
    prefix: 20,
    mask: "255.255.240.0",
    network: "140.120.80.0",
    broadcast: "140.120.95.255",
    hostBits: 12,
    addressCount: 4096,
    conventionalUsable: 4094,
    binary: "10001100011110000101010000011000"
  });
  assert.equal(calculateCidr("192.168.1.10", 31).conventionalUsable, null);
  assert.throws(() => calculateCidr("192.168.1.999", 24), /0–255/);
  assert.throws(() => calculateCidr("192.168.1.1", 33), /0–32/);

  const fragments = planIpv4Fragments(4000, 20, 1500);
  assert.equal(fragments.payload, 3980);
  assert.equal(fragments.maxDataLength, 1480);
  assert.deepEqual(fragments.fragments, [
    { number: 1, dataLength: 1480, totalLength: 1500, offset: 0, moreFragments: true },
    { number: 2, dataLength: 1480, totalLength: 1500, offset: 185, moreFragments: true },
    { number: 3, dataLength: 1020, totalLength: 1040, offset: 370, moreFragments: false }
  ]);
  assert.throws(() => planIpv4Fragments(4000, 22, 1500), /4 的倍数/);
  assert.throws(() => planIpv4Fragments(4000, 20, 27), /MTU/);
});
