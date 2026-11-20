import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { directoryTopics, tocChapterIds, chapterPageNeighbors } from "../assets/js/shell/lecture.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = p => readFileSync(resolve(root, p), "utf8");
const json = p => JSON.parse(read(p));
const data = json("tests/fixtures/network-data.json");
const photos = json("tests/fixtures/network-photos.json");
const decode = s => s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|#39);/gi, (_, e) => {
  if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[e];
});
const strip = h => decode(h.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, ""));

// 与生成脚本相同的整理裁剪表（3-9-1 不下定论）
const SUPPLEMENT_CUT = {
  "3-9-1": [
    "（按传统规则，掩码是 240，但选项里没有）",
    "老师最终选 C，即这题按 2^n ≥ 8 算。为什么这里不减 2、与 3-4-2 等题的 2^n − 2 规则不一致，原图没有说明，整理者不补充，请听课或问老师确认。"
  ]
};
const supplementText = e => {
  let t = e["整理"];
  for (const c of SUPPLEMENT_CUT[e["id"]] ?? []) { assert.ok(t.includes(c)); t = t.replace(c, "").trimEnd(); }
  return t.replace(/[ \t]+\n/g, "\n").replace(/\n\n/g, "\n");
};

const chapters = data["章"];
const pointPath = (ci, ki) => `wl/ch${ci}/s${ci}${ki}.html`;
const entries = [];
chapters.forEach((c, ci) => c["知识点"].forEach((k, ki) => k["条目"].forEach(e => entries.push({ e, ci: ci + 1, ki: ki + 1, k, path: pointPath(ci + 1, ki + 1) }))));
const pageOf = {};
const pageHtml = p => (pageOf[p] ??= read(p));

// 取出 id 对应的 section 片段（条目 section 不嵌套，直到下一个 <section 或 </article>）
function entryHtml(path, id) {
  const html = pageHtml(path);
  const start = html.indexOf(`<section class="wy-entry" id="e-${id}">`);
  assert.ok(start >= 0, `${path} 缺少条目 ${id}`);
  const end = html.indexOf("</section>", html.indexOf('<div class="wy-selfcheck">', start));
  return html.slice(start, end + 10);
}
const cls = (html, c) => [...html.matchAll(new RegExp(`<div class="${c}[^"]*"[^>]*>([\\s\\S]*?)</div>(?=<div class="wy-source-row|<div class="wy-supplement|</div><div)`, "g"))];

test("数据：6 章 29 个知识点 47 个条目，可视化方案共 126 项", () => {
  assert.equal(chapters.length, 6);
  assert.equal(chapters.reduce((n, c) => n + c["知识点"].length, 0), 29);
  assert.equal(entries.length, 47);
  assert.equal(entries.reduce((n, x) => n + x.e["可视化"].length, 0), 126);
});

test("页面齐全：29 个知识点页、6 个章首页、科目目录页", () => {
  for (const { path } of entries) assert.ok(existsSync(resolve(root, path)), path);
  for (let i = 1; i <= 6; i++) {
    assert.ok(existsSync(resolve(root, `wl/ch${i}/index.html`)));
    const h = pageHtml(`wl/ch${i}/index.html`);
    assert.ok(h.includes(strip(`<h1>${chapters[i - 1]["章"].replace(/&/g, "&amp;")}</h1>`)) || decode(h).includes(chapters[i - 1]["章"]));
    assert.equal((h.match(/class="wy-chapter-row"/g) || []).length, chapters[i - 1]["知识点"].length);
  }
  assert.ok(existsSync(resolve(root, "wl/index.html")));
});

test("原文逐行、整理逐段、自测逐条原样出现在对应条目里", () => {
  for (const { e, path } of entries) {
    const sec = entryHtml(path, e.id);
    const src = sec.slice(sec.indexOf('<div class="wy-source wy-paper">'), sec.indexOf('<div class="wy-supplement'));
    const rows = [...src.matchAll(/<div class="wy-source-row[^"]*">([\s\S]*?)<\/div>(?=<div class="wy-source-row|$)/g)].map(m => m[1]);
    const lines = e["原文"].split("\n");
    let r = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
        const text = strip(rows[r]);
        for (const c of cells) assert.ok(text.includes(c), `${e.id} 表格单元 ${c}`);
        while (lines[i + 1]?.startsWith("|")) {
          i++;
          const cs = lines[i].trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
          for (const c of cs) assert.ok(text.includes(c), `${e.id} 表格单元 ${c}`);
        }
        r++; continue;
      }
      assert.equal(strip(rows[r]), lines[i], `${e.id} 原文第 ${i + 1} 行`);
      r++;
    }
    assert.equal(r, rows.length, `${e.id} 原文行数`);

    const sup = sec.slice(sec.indexOf('<div class="wy-supplement'), sec.indexOf('<div class="wy-viz'));
    const sl = supplementText(e).split("\n");
    const supText = decode(sup.replace(/<h3>整理<\/h3>/, ""));
    let from = 0;
    for (const ln of sl) {
      if (ln.startsWith("|")) {
        const cs = ln.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
        if (cs.every(c => /^:?-{3,}:?$/.test(c))) continue;
        for (const c of cs) assert.ok(supText.includes(c), `${e.id} 整理表格 ${c}`);
        continue;
      }
      const t = ln.replace(/^- /, "").replace(/^\d+\. /, "");
      const at = supText.indexOf(t, from);
      assert.ok(at >= 0, `${e.id} 整理缺：${t.slice(0, 30)}`);
      from = at + t.length;
    }

    const selfStart = sec.indexOf('<div class="wy-selfcheck">');
    const self = [...sec.slice(selfStart).matchAll(/<li class="sh-card"><span class="rn">(\d+)<\/span><span>([\s\S]*?)<\/span><\/li>/g)].map(m => decode(m[2]));
    assert.deepEqual(self, e["自测"], `${e.id} 自测`);
    // 条目内每条自测恰好出现一次
    for (const n of e["自测"]) assert.equal(sec.split(`<span>${n.replace(/&/g, "&amp;")}</span>`).length - 1, e["自测"].filter(x => x === n).length);
  }
});

test("自测编号在本页内连续，习题区链接逐条指向所属条目", () => {
  const byPage = Object.groupBy(entries, x => x.path);
  for (const [path, list] of Object.entries(byPage)) {
    const html = pageHtml(path);
    const nums = [...html.matchAll(/<span class="rn">(\d+)<\/span>/g)].map(m => Number(m[1]));
    const total = list.reduce((n, x) => n + x.e["自测"].length, 0);
    const sorted = [...nums].sort((a, b) => a - b);
    assert.deepEqual(sorted, Array.from({ length: total }, (_, i) => i + 1), path);
    const links = [...html.matchAll(/<li><a href="#e-([\d-]+)">([\s\S]*?)<\/a><\/li>/g)].map(m => [m[1], decode(m[2])]);
    assert.deepEqual(links, list.flatMap(x => x.e["自测"].map(n => [x.e.id, n])), path);
  }
});

test("原图：只在点击时加载，照片存在且尺寸、sha256 与记录一致，作业题放进习题区", () => {
  const files = readdirSync(resolve(root, "wl/原图")).sort();
  assert.deepEqual(files, Object.keys(photos).sort());
  assert.equal(files.length, 46);
  for (const [name, m] of Object.entries(photos)) {
    const buf = readFileSync(resolve(root, "wl/原图", name));
    assert.equal(createHash("sha256").update(buf).digest("hex"), m.sha256, name);
    assert.equal(buf.length, m.bytes, name);
    assert.equal(buf[0], 0xff); assert.equal(buf[1], 0xd8);
    // JPEG SOF 读取宽高
    let i = 2, w = 0, h = 0;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const mk = buf[i + 1];
      if (mk >= 0xc0 && mk <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(mk)) { h = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); break; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    assert.deepEqual([w, h], [m.width, m.height], name);
    assert.ok(m.width >= m.height, `${name} 方向`);
  }
  assert.ok(!readdirSync(resolve(root, "wl")).some(f => /\.webp$/.test(f)));
  const allImgs = new Set();
  for (const { e, path } of entries) {
    const html = pageHtml(path);
    const withoutIllus = html.replace(/<div class="wy-illus"[\s\S]*?<\/div>/g, "");
    assert.ok(!/<img[^>]*\bsrc=/.test(withoutIllus), `${path} 初始 HTML 不应带课堂原图 src`);
    assert.ok(!/src="[^"]*原图/.test(html));
    const sec = entryHtml(path, e.id);
    const btn = sec.match(/data-open-photo data-photos="(\d+)"/);
    if (e["图片"].length) {
      assert.ok(btn, `${e.id} 缺少打开原图按钮`);
      const tab = html.match(new RegExp(`data-photo-number="${btn[1]}" data-photo="([^"]+)" data-width="(\\d+)" data-height="(\\d+)"`));
      assert.ok(tab, `${e.id} 对应照片`);
      const name = tab[1].replace("../原图/", "");
      assert.ok(photos[name], name);
      assert.deepEqual([Number(tab[2]), Number(tab[3])], [photos[name].width, photos[name].height]);
      assert.equal(photos[name].source, e["图片"][0]);
      allImgs.add(name);
    } else assert.ok(!btn, `${e.id} 不应有打开原图按钮`);
    if (e["图片"].some(p => p.includes("/作业/"))) assert.ok(html.indexOf(`id="e-${e.id}"`) > html.indexOf('id="practice"'), `${e.id} 应在习题区`);
    else assert.ok(html.indexOf(`id="e-${e.id}"`) < html.indexOf('id="practice"'), `${e.id} 不应在习题区`);
  }
  assert.equal(allImgs.size, 46);
});

test("页面没有占位文字、外链资源、版本标签，也没有不下定论之外的结论", () => {
  const pages = ["wl/index.html", ...[1, 2, 3, 4, 5, 6].map(i => `wl/ch${i}/index.html`), ...new Set(entries.map(x => x.path))];
  for (const p of pages) {
    const h = pageHtml(p);
    const t = strip(h);
    for (const bad of ["讲义原图", "待补", "缺失", "即将开放", "答案来源", "待确认", "选项中没有"]) assert.ok(!t.includes(bad), `${p} 含「${bad}」`);
    assert.ok(!/role="tab"/.test(h));
    assert.ok(!/(?:src|href)="https?:\/\//.test(h.replace(/<link rel="canonical"[^>]*>/, "")), `${p} 外链`);
    assert.ok(!/<script[^>]*>[^<]*[\w]/.test(h.replace(/<script[^>]*src=[^>]*><\/script>/g, "")), `${p} 内联脚本`);
  }
  const t391 = strip(entryHtml("wl/ch3/s39.html", "3-9-1"));
  assert.ok(t391.includes("2^n − 2 ≥ 8 ⇒ n = 4") && t391.includes("2^n ≥ 8 ⇒ n = 3"));
  assert.ok(!/请听课或问老师确认|老师最终选 C，即这题/.test(t391));
});

test("可视化：每条目的 figure 数 = 方案项数，配置是合法 JSON 且模式已实现", () => {
  const js = read("assets/js/net-viz.js");
  const modes = new Set(["steps", "tabs", "slider", "static", "checker", "judge"]);
  for (const m of modes) assert.ok(m === "static" || js.includes(`cfg.m === "${m}"`), m);
  let total = 0;
  for (const { e, path } of entries) {
    const sec = entryHtml(path, e.id);
    assert.ok(sec.includes('<div class="wy-viz'), e.id);
    const figs = [...sec.matchAll(/<figure class="nv"[^>]*data-viz="([^"]*)"><\/figure>/g)].map(m => JSON.parse(decode(m[1])));
    assert.equal(figs.length, e["可视化"].length, `${e.id} 可视化数`);
    for (const f of figs) {
      assert.ok(modes.has(f.m), `${e.id} 模式 ${f.m}`);
      if (f.f) { assert.ok(f.f.length >= 1); for (const fr of f.f) assert.ok(Array.isArray(fr.b) && fr.b.length >= 1); }
    }
    total += figs.length;
  }
  assert.equal(total, 126);
});

test("可视化数值抽查：分片 1400/1400/1000 与 0/175/350，1480 与 0/185/370，/20 聚合", () => {
  const f = (path, id) => decode(entryHtml(path, id).match(/<div class="wy-viz[\s\S]*?<div class="wy-selfcheck">/)[0]);
  const a = f("wl/ch4/s42.html", "4-2-1");
  for (const s of ["1400", "175", "350", "2800", "1420"]) assert.ok(a.includes(s), `4-2-1 ${s}`);
  const b = f("wl/ch4/s43.html", "4-3-2");
  for (const s of ["1480", "185", "370", "2960", "1020"]) assert.ok(b.includes(s), `4-3-2 ${s}`);
  const c = f("wl/ch6/s61.html", "6-1-1");
  for (const s of ["192.24.0.0/20", "255.255.240.0", "8 + 8 + 4 = 20"]) assert.ok(c.includes(s), `6-1-1 ${s}`);
  const d = f("wl/ch3/s34.html", "3-4-2");
  assert.ok(d.includes("192.168.25.192") || d.includes('"192"'));
});

test("目录数据：6 章 29 个知识点与 data.json 一一对应，依赖无悬空，旧网络编号并入新编号", () => {
  const topics = json("data/topics.json");
  const ch = topics.chapters.filter(c => c.subject_id === "network");
  assert.deepEqual(ch.map(c => c.id), [1, 2, 3, 4, 5, 6].map(i => `net.ch${i}`));
  chapters.forEach((c, i) => { assert.equal(ch[i].title, c["章"]); assert.equal(ch[i].source_ref, `wl/ch${i + 1}/index.html`); });
  const ts = topics.topics.filter(t => t.subject_id === "network");
  assert.equal(ts.length, 29);
  const ids = new Set(topics.topics.map(t => t.id));
  chapters.forEach((c, ci) => c["知识点"].forEach((k, ki) => {
    const t = ts.find(x => x.id === `net.s${ci + 1}${ki + 1}`);
    assert.ok(t); assert.equal(t.title, `${ci + 1}.${ki + 1} ${k["知识点"]}`); assert.equal(t.legacy_url, pointPath(ci + 1, ki + 1)); assert.equal(t.chapter_id, `net.ch${ci + 1}`);
  }));
  for (const t of topics.topics) for (const p of t.prereq_ids || []) assert.ok(ids.has(p), `${t.id}→${p}`);
  const deps = json("data/dependencies.json");
  for (const d of deps.edges ?? deps) { assert.ok(ids.has(d.topicId), d.topicId); assert.ok(ids.has(d.prerequisiteId), d.prerequisiteId); }
  for (const [from, to] of Object.entries({ "net.ip_basics": "net.s11", "net.cidr": "net.s21", "net.subnet": "net.s31", "net.fragments": "net.s41", "net.ipv6": "net.s51" })) {
    assert.equal(topics.merged_topics[from], to); assert.ok(ids.has(to)); assert.ok(!ids.has(from));
  }
});

test("科目与站点接线：subjects.json、首页、构建目录、搜索、sitemap、a11y 页面", () => {
  const net = json("data/subjects.json").subjects.find(s => s.id === "network");
  assert.equal(net.status, "live"); assert.equal(net.homeUrl, "wl/index.html"); assert.equal(net.legacy_url, "wl/index.html");
  assert.match(read("index.html"), /href="wl\/index\.html" data-subject="network"/);
  assert.match(read(".github/scripts/build-site.sh"), /SITE_DIRS=\([^)]*\bwl\b/);
  assert.match(read(".github/scripts/site-budget.mjs"), /SITE_DIRS = \[[^\]]*"wl"/);
  assert.match(read("pagefind.yml"), /wl\/\*\*\/\*\.html/);
  assert.match(read(".github/workflows/check.yml"), /tests\/stage4-wl-points\.mjs/);
  assert.match(read("assets/js/site-shell.js"), /\(gs\|yy\|jsj\|c\|wy\|wl\)\\\/index/);
  assert.match(read("assets/js/shell/subject.js"), /"wl\/index\.html": "network"/);
  const sitemap = read("sitemap.xml");
  const walk = d => readdirSync(resolve(root, d)).flatMap(f => statSync(resolve(root, d, f)).isDirectory() ? (f === "原图" ? [] : walk(`${d}/${f}`)) : f.endsWith(".html") ? [`${d}/${f}`] : []);
  const wlPages = walk("wl");
  assert.equal(wlPages.length, 36);
  for (const p of wlPages) assert.ok(sitemap.includes(`/zsb-study-home/${p}</loc>`), p);
  const a11y = read(".github/scripts/a11y.mjs");
  for (const p of ["wl/index.html", "wl/ch3/s34.html", "wl/ch6/s61.html"]) assert.ok(a11y.includes(`"${p}"`));
});

test("lecture.js 通用化：网页设计行为不变，计算机网络按 6 章配置", () => {
  assert.deepEqual(tocChapterIds(["web.ch1"], true), ["web.ch1", "web.ch2"]);
  const wl = { chapters: [1, 2, 3, 4, 5, 6].map(i => `net.ch${i}`), index: /^wl\/ch[1-6]\/index\.html$/ };
  assert.deepEqual(tocChapterIds(["net.ch3"], wl), wl.chapters);
  assert.deepEqual(tocChapterIds(["math.ch1"]), ["math.ch1"]);
  const list = [{ id: "a", legacy_url: "wl/ch1/index.html" }, { id: "b", legacy_url: "wl/ch1/s11.html" }, { id: "c", legacy_url: "wl/ch2/index.html" }];
  assert.deepEqual(directoryTopics(list, wl).map(t => t.id), ["b"]);
  assert.equal(directoryTopics(list), list);
  assert.ok(typeof chapterPageNeighbors === "function");
  const src = read("assets/js/shell/lecture.js");
  assert.match(src, /wl\\\/ch\[1-6\]/);
  assert.match(src, /if \(!cfg\.plain\) await enhanceLesson/);
});
