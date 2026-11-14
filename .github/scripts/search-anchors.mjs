// 发布前处理 _site/ 副本，不改仓库源文件，不改可见文字：
// 1. 给“带 id 的 section 里第一个没有 id 的标题”补一个锚点（id = section id + "-h"），
//    让 Pagefind 的子结果能直接跳到对应考点。
// 2. 像「练习」这种通用小节名，把父级标题（页面原文）以隐藏文字写入标题，
//    便于搜索结果区分是哪一个考点的练习。屏幕上看起来仍是「练习」。
// 3. 给按钮、工具栏等非学习文字加上 data-pagefind-ignore，避免搜索摘要里出现
//    「全部展开」「全部折叠」「查看原图」等控件上的字。正文仍会进入索引。
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

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


// 工具栏、操作按钮等非学习文字。只给这些控件加属性，不改标签里的字。
const UI_CONTAINERS = [
  "map-actions",
  "wy-photo",
  "wy-mm-controls",
  "block-controls",
  "tryit-actions",
  "example-actions",
  "quiz-actions",
  "stage-controls",
  "sim-actions",
  "mm-toolbar",
  "map-toolbar__actions",
  "vz-controls",
  "chapter-card__action",
  "meaning-reveal",
  "answer-mask",
  "zsb-video",
  "method-tabs",
  "video-jump",
  "pvideo",
];

const UI_TEXT = new Set([
  "全部展开",
  "全部折叠",
  "全部收起",
  "查看原图",
  "打开原图",
  "跳到讲解视频",
  "运行",
  "重置",
  "章节目录",
  "隐藏中文",
  "重新练习",
  "核对答案",
  "重做",
  "加入错题本",
  "模拟操作",
  "上一步",
  "下一步",
  "关闭",
  "放大",
  "重置视图",
  "全部揭晓",
  "减少动画",
  "搜索",
  "点击查看",
  "点击揭晓",
  "点击展开解答",
  "查看逐步解答",
  "点击查看解答",
  "查看答案与解析",
  "进入→",
  "进入",
  "方法 1",
  "方法 2",
  "方法 3",
  "方法一",
  "方法二",
  "方法三",
  "−",
  "＋",
  "↶",
  "↷",
  "返回目录 →",
  "返回目录",
  "科目首页",
  "返回首页",
]);

function escapeClass(name) {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasIgnore(openOrAttrs) {
  return /\sdata-pagefind-ignore(?:\s|=\s*["'][^"']*["'])?(?=\s|\/?>|$)/.test(openOrAttrs);
}

function withIgnore(openTag) {
  if (hasIgnore(openTag)) return openTag;
  return openTag.replace(/(\s*\/?)>$/, " data-pagefind-ignore$1>");
}

function uiVisibleText(inner) {
  return String(inner || "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function ignoreUi(html) {
  let added = 0;
  const classAlt = UI_CONTAINERS.slice().sort((a, b) => b.length - a.length).map(escapeClass).join("|");
  const classRe = new RegExp(
    `<(a|article|aside|button|dialog|div|footer|header|menu|nav|ol|p|section|span|ul)\\b[^>]*\\bclass\\s*=\\s*["'][^"']*\\b(?:${classAlt})\\b[^"']*["'][^>]*>`,
    "gi"
  );
  let out = html.replace(classRe, (tag) => {
    const next = withIgnore(tag);
    if (next !== tag) added += 1;
    return next;
  });
  out = out.replace(/<(a|button|summary)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (all, name, attrs, inner) => {
    if (hasIgnore(attrs)) return all;
    if (!UI_TEXT.has(uiVisibleText(inner))) return all;
    added += 1;
    return `${withIgnore(`<${name}${attrs}>`)}${inner}</${name}>`;
  });
  return { html: out, added };
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

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = process.argv[2] || "_site";
  let anchors = 0;
  let contexts = 0;
  let ignored = 0;
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    const stepped = addAnchors(src);
    const done = addSectionContext(stepped.html);
    const ui = ignoreUi(done.html);
    if (stepped.added || done.added || ui.added) writeFileSync(file, ui.html);
    anchors += stepped.added;
    contexts += done.added;
    ignored += ui.added;
  }
  console.log(`补充搜索锚点 ${anchors} 个，练习标题补上所属考点 ${contexts} 处，给非学习控件补上忽略标记 ${ignored} 处`);
}
