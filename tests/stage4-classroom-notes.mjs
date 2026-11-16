import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { calculateCidr, planIpv4Fragments } from "../assets/js/network-lab.js";
import { markTopicStudied, scheduleTopicReview } from "../assets/js/features/topic-progress.js";

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

test("原图、知识点与例题形成可校验的双向映射", () => {
  const links = readJson("notes/data/topic-links.json");
  const network = readJson("notes/data/network-sources.json");
  const web = readJson("notes/data/web-sources.json");
  const sources = [...network.items, ...web.items];
  const sourceIds = new Set(sources.map((item) => item.id));
  const mappedSources = Object.values(links.topics).flatMap((topic) => topic.sourceIds);
  assert.equal(new Set(mappedSources).size, mappedSources.length, "一张原图只能在主映射中归属一个知识点");
  assert.deepEqual(mappedSources.filter((id) => !sourceIds.has(id)), [], "映射包含未知原图");
  for (const item of sources.filter((source) => source.readable)) {
    assert.equal(mappedSources.includes(item.id), true, `高清原图 ${item.id} 未关联知识点`);
  }

  const allHtml = `${readText("notes/network.html")}\n${readText("notes/web.html")}`;
  for (const example of links.examples) {
    assert.equal(new Set([...allHtml.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1])).has(example.id), true, `缺少例题 ${example.id}`);
    assert.equal(links.topics[example.topicId].exampleIds.includes(example.id), true, `${example.id} 未反向登记到知识点`);
    assert.equal(example.sourceIds.length > 0, true, `${example.id} 缺少依据原图`);
    for (const sourceId of example.sourceIds) assert.equal(sourceIds.has(sourceId), true, `${example.id} 引用未知原图 ${sourceId}`);
  }
  assert.equal(links.examples.length, 15);
});

test("课堂笔记手动学习状态复用现有进度结构并支持复习", () => {
  const args = { topicId: "net.cidr", learnerId: "local-guest", now: "2026-11-16T00:00:00.000Z" };
  const previous = {
    id: "prog:local-guest:net.cidr",
    topic_id: "net.cidr",
    learner_id: "local-guest",
    mastery_state: "independent_once",
    independent_correct_count: 1,
    evidence_attempt_ids: ["att-1"],
    created_at: "2026-11-01T00:00:00.000Z"
  };
  const studied = markTopicStudied(previous, args);
  assert.equal(studied.mastery_state, "independent_once");
  assert.equal(studied.independent_correct_count, 1);
  assert.deepEqual(studied.evidence_attempt_ids, ["att-1"]);
  assert.equal(studied.counts_toward_real_stats, true);
  const reviewed = scheduleTopicReview(studied, { ...args, days: 3 });
  assert.equal(reviewed.next_review_at, "2026-11-19T00:00:00.000Z");
  assert.equal(reviewed.mastery_state, "independent_once");
  assert.throws(() => scheduleTopicReview(null, { ...args, days: 0 }), /1–30/);
});

test("全站搜索登记课堂原图与例题类型", () => {
  const search = readText("assets/js/site-search.js");
  assert.match(search, /\["source", "课堂原图"/);
  assert.match(search, /\["example", "例题 \/ 自测"/);
  assert.match(search, /notes\/sources\.html\?subject=/);
});

test("课堂笔记与首页新增静态链接均可解析", () => {
  const pages = ["index.html", "notes/index.html", "notes/network.html", "notes/web.html", "notes/map.html", "notes/sources.html"];
  const cache = new Map();
  const idsFor = (file) => {
    if (!cache.has(file)) {
      const html = readText(path.relative(root, file)).replace(/<(pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
      cache.set(file, new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1])));
    }
    return cache.get(file);
  };
  for (const page of pages) {
    const file = path.join(root, page);
    const html = readText(page).replace(/<(pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
    for (const match of html.matchAll(/\bhref=["']([^"']+)["']/g)) {
      const href = match[1];
      if (/^(?:https?:|mailto:|tel:|javascript:)/i.test(href)) continue;
      const url = new URL(href, `https://local/${page}`);
      const target = path.join(root, decodeURIComponent(url.pathname).replace(/^\/+/, ""));
      assert.equal(fs.existsSync(target), true, `${page} 缺少链接目标 ${href}`);
      if (url.hash && !url.hash.startsWith("#/") && target.endsWith(".html")) {
        assert.equal(idsFor(target).has(decodeURIComponent(url.hash.slice(1))), true, `${page} 缺少锚点 ${href}`);
      }
    }
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
