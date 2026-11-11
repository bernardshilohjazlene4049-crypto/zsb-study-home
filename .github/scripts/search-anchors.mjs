// 发布前给“带 id 的 section 里第一个没有 id 的标题”补一个锚点（id = section id + "-h"），
// 让 Pagefind 的子结果能直接跳到对应考点。只改 _site/ 里的副本，不改仓库源文件，不改文字。
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

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== "pagefind") walk(p, files); }
    else if (name.endsWith(".html")) files.push(p);
  }
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.argv[2] || "_site";
  let total = 0;
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    const { html, added } = addAnchors(src);
    if (added) { writeFileSync(file, html); total += added; }
  }
  console.log(`补充搜索锚点 ${total} 个`);
}
