import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

function idsIn(html) {
  return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
}

function resolveTarget(fromRel, href) {
  const hashAt = href.indexOf("#");
  const pathPart = hashAt === 0 ? "" : hashAt < 0 ? href : href.slice(0, hashAt);
  const hash = hashAt < 0 ? "" : href.slice(hashAt + 1);
  const dest = pathPart
    ? resolve(dirname(resolve(ROOT, fromRel)), pathPart)
    : resolve(ROOT, fromRel);
  return { dest, hash };
}

function collectMindmapHrefs() {
  const out = [];

  const mm = read("gs/mindmap.html");
  const treeBlock = mm.slice(mm.indexOf("const trees ="), mm.indexOf("function nodeLabel"));
  for (const m of treeBlock.matchAll(/"href": "([^"]+)"/g)) {
    out.push({ from: "gs/mindmap.html", href: m[1], via: "trees" });
  }

  const gs1 = read("gs/gs1.html");
  const fallback = gs1.slice(gs1.indexOf('id="mindmapFallback"'), gs1.indexOf('id="mindmapZoom"'));
  for (const m of fallback.matchAll(/<a class="tree-node[^"]*" href="([^"]+)"/g)) {
    out.push({ from: "gs/gs1.html", href: m[1], via: "gs1-tree" });
  }

  const gs45 = read("gs/gs45.html");
  for (const m of gs45.matchAll(/<a class="map-leaf" href="([^"]+)"/g)) {
    out.push({ from: "gs/gs45.html", href: m[1], via: "gs45-leaf" });
  }

  for (const name of ["mm1.svg", "mm2.svg", "mm3.svg", "mm4.svg"]) {
    const svg = read(`yy/mm/${name}`);
    for (const m of svg.matchAll(/<a href="([^"]+)"/g)) {
      out.push({ from: `yy/mm/${name}`, href: m[1], via: "yy-svg" });
    }
  }

  const jsjmm = read("jsj/mm.html");
  const main = jsjmm.slice(jsjmm.indexOf("<div class=\"wrap\">"), jsjmm.indexOf("</main>"));
  for (const m of main.matchAll(/<a href="([^"]+)"/g)) {
    out.push({ from: "jsj/mm.html", href: m[1], via: "jsj-mm" });
  }

  return out;
}

test("导图里的每一条跳转，目标页和锚点都在源文件里", () => {
  const links = collectMindmapHrefs();
  assert.ok(links.length >= 200, `收集到的导图链接过少：${links.length}`);
  const missing = [];
  for (const link of links) {
    const { dest, hash } = resolveTarget(link.from, link.href);
    if (!existsSync(dest)) {
      missing.push(`${link.from} → ${link.href}（找不到文件 ${dest}）`);
      continue;
    }
    if (!hash) continue;
    const ids = idsIn(readFileSync(dest, "utf8"));
    if (!ids.has(hash)) {
      missing.push(`${link.from} → ${link.href}（没有 id="${hash}"）`);
    }
  }
  assert.deepEqual(missing, []);
});

test("导图链接不用构建时才写入的 -h 锚点", () => {
  const bad = collectMindmapHrefs().filter((l) => /#[^"' ]+-h$/.test(l.href) || l.href.endsWith("-h"));
  assert.deepEqual(bad, []);
});

test("高数导图页的考点节点会生成可聚焦的链接", () => {
  const html = read("gs/mindmap.html");
  assert.match(html, /"href": "gs1\.html#point-1"/);
  assert.match(html, /"href": "gs45\.html#point-36"/);
  assert.match(html, /a\.className = 'tree-node'/);
  assert.match(html, /a\.href = node\.href/);
});
