// 发布前给“带 id 的 section 里第一个没有 id 的标题”补一个锚点（id = section id + "-h"），
// 让 Pagefind 的子结果能直接跳到对应考点。只改 _site/ 里的副本，不改仓库源文件，不改文字。
// 另外：像「练习」这种通用小节名，把父级标题（页面原文）以隐藏文字写入标题，
// 便于搜索结果区分是哪一个考点的练习。屏幕上看起来仍是「练习」。
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function addAnchors(html) {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  let added = 0;
  const out = html.replace(/(<section\b[^>]*\sid="([^"]+)"[^>]*>)([\s\S]*?)(<h([1-6])\b)([^>]*>)/g, (all, open, id, between, hOpen, level, rest) => {
    if (/<section\b/.test(between) || /\sid="/.test(rest)) return all;
    const anchor = `${id}-h`;
    if (ids.has(anchor)) return all;
    ids.add(anchor);
    added += 1;
    return `${open}${between}${hOpen} id="${anchor}"${rest}`;
  });
  return { html: out, added };
}

export function visibleHeadingText(inner) {
  return String(inner || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<span\b[^>]*class="[^"]*zsb-search-context[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_SECTION = /^(练习)$/;
const CONTEXT_STYLE = "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";

function escapeText(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function addSectionContext(html) {
  const headingRe = /<h([1-6])(\b[^>]*)>([\s\S]*?)<\/h\1>/gi;
  const headings = [];
  let m;
  while ((m = headingRe.exec(html))) {
    headings.push({
      level: Number(m[1]),
      inner: m[3],
      vis: visibleHeadingText(m[3]),
      start: m.index,
      end: m.index + m[0].length,
      open: m[0].slice(0, m[0].indexOf(">") + 1),
      close: `</h${m[1]}>`,
    });
  }
  let added = 0;
  const pieces = [];
  let cursor = html.length;
  for (let i = headings.length - 1; i >= 0; i--) {
    const h = headings[i];
    if (!GENERIC_SECTION.test(h.vis) || /zsb-search-context/.test(h.inner)) continue;
    let parent = "";
    for (let j = i - 1; j >= 0; j--) {
      if (headings[j].level < h.level && headings[j].vis) {
        parent = headings[j].vis;
        break;
      }
    }
    if (!parent || parent === h.vis) continue;
    const hidden = `<span class="zsb-search-context" style="${CONTEXT_STYLE}">${escapeText(parent)} · </span>`;
    pieces.push(html.slice(h.end, cursor));
    pieces.push(`${h.open}${hidden}${h.inner}${h.close}`);
    cursor = h.start;
    added += 1;
  }
  if (!added) return { html, added: 0 };
  pieces.push(html.slice(0, cursor));
  return { html: pieces.reverse().join(""), added };
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== "pagefind") walk(p, files);
    } else if (name.endsWith(".html")) files.push(p);
  }
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] || "_site";
  let anchors = 0;
  let contexts = 0;
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    const stepped = addAnchors(src);
    const done = addSectionContext(stepped.html);
    if (stepped.added || done.added) writeFileSync(file, done.html);
    anchors += stepped.added;
    contexts += done.added;
  }
  console.log(`补充搜索锚点 ${anchors} 个，练习标题补上所属考点 ${contexts} 处`);
}
