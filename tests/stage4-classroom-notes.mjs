import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

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
  for (const href of ["network.html", "web.html"]) {
    assert.equal(hub.includes(`href="${href}"`), true, `课堂笔记入口缺少 ${href}`);
  }

  const search = readText("assets/js/site-search.js");
  assert.match(search, /notes\/network\.html[\s\S]*return "network"/);
  assert.match(search, /notes\/web\.html[\s\S]*return "web_design"/);
});
