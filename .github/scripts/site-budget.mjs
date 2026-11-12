// 站点体积回归检查（基线 + 回归预算）与本地资源检查。不依赖 npm 包。
//
// 不对页面设一刀切的大小上限：长讲义本来就大。每个已发布的 HTML/CSS/JS/JSON 文件
// 和 .github/size-baseline.json 里记录的基线比较，超出「基线 × 1.10」且多出 20 KB 以上才算回归。
// 有意增大时，在同一个 PR 里运行 `node .github/scripts/site-budget.mjs --update` 更新基线。
//
// 失败：文件体积回归；单个文件超过 GitHub 的 100 MB 硬限制（按 95 MB 检查）；
//       发布总量超过 950 MB（GitHub Pages 上限 1 GB）；页面引用外部域名资源（无 CDN 原则）；
//       poster / data-src / data-poster 指向不存在的本地文件。
// 只警告：<video preload="metadata">（打开页面就会预下载视频数据）。
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, statSync, existsSync, appendFileSync } from "node:fs";
import { dirname, join, normalize, extname } from "node:path";

const KB = 1024, MB = 1024 * KB;
const BASELINE = ".github/size-baseline.json";
const RATIO = 1.10, SLACK = 20 * KB;
const FILE_HARD = 95 * MB, TOTAL_WARN = 800 * MB, TOTAL_FAIL = 950 * MB;
const ROOT_FILES = new Set(["index.html", "404.html", "style.css", "study-bridge.js"]);
const SITE_DIRS = ["assets", "c", "config", "data", "gs", "jsj", "study", "tower", "wy", "yy"];
const TRACKED_EXT = new Set([".html", ".css", ".js", ".mjs", ".json"]);
const CATEGORY = (f) => {
  const e = extname(f).toLowerCase();
  if (e === ".html") return "html";
  if ([".css", ".js", ".mjs"].includes(e)) return "css/js";
  if (e === ".json") return "json";
  if ([".mp4", ".webm", ".mov", ".m4a", ".mp3", ".wav"].includes(e)) return "音视频";
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".ico"].includes(e)) return "图片";
  return "其他";
};

const published = execSync("git ls-files -z", { encoding: "utf8" }).split("\0").filter(Boolean)
  .filter((f) => ROOT_FILES.has(f) || SITE_DIRS.some((d) => f.startsWith(d + "/")))
  .filter((f) => existsSync(f));

const sizes = {}, cats = {};
let total = 0;
for (const f of published) {
  const s = statSync(f).size;
  total += s;
  const c = CATEGORY(f);
  cats[c] = (cats[c] || 0) + s;
  if (TRACKED_EXT.has(extname(f).toLowerCase())) sizes[f] = s;
}

if (process.argv.includes("--update")) {
  const data = { note: "由 .github/scripts/site-budget.mjs --update 生成；单位为字节。", files: Object.fromEntries(Object.entries(sizes).sort()), categories: cats, total };
  writeFileSync(BASELINE, JSON.stringify(data, null, 1) + "\n");
  console.log(`已写入 ${BASELINE}：${Object.keys(sizes).length} 个文件，发布总量 ${(total / MB).toFixed(1)} MB`);
  process.exit(0);
}

const errors = [], warnings = [], notes = [];
const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : null;
if (!base) warnings.push(`没有找到 ${BASELINE}，只做资源检查`);

const fmt = (n) => (n >= MB ? `${(n / MB).toFixed(1)} MB` : `${(n / KB).toFixed(1)} KB`);
if (base) {
  for (const [f, s] of Object.entries(sizes)) {
    const b = base.files[f];
    if (b === undefined) { notes.push(`新文件 ${f}：${fmt(s)}`); continue; }
    if (s > b * RATIO && s - b > SLACK) errors.push(`${f}：${fmt(b)} → ${fmt(s)}（+${fmt(s - b)}，超过回归预算）`);
    else if (s < b - SLACK) notes.push(`${f}：${fmt(b)} → ${fmt(s)}（减少 ${fmt(b - s)}）`);
  }
}
for (const f of published) {
  const s = statSync(f).size;
  if (s > FILE_HARD) errors.push(`${f}：${fmt(s)}，接近 GitHub 单文件 100 MB 限制`);
}
if (total > TOTAL_FAIL) errors.push(`发布总量 ${fmt(total)} > ${fmt(TOTAL_FAIL)}`);
else if (total > TOTAL_WARN) warnings.push(`发布总量 ${fmt(total)}，已超过 ${fmt(TOTAL_WARN)}（Pages 上限 1 GB）`);

// 去掉代码示例区域，避免把教学用的示例代码当成真实引用。
const strip = (s) => s
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<(textarea|pre|code)\b[\s\S]*?<\/\1>/gi, "")
  .replace(/<script\b[^>]*type=["']text\/plain["'][^>]*>[\s\S]*?<\/script>/gi, "");
const lineOf = (s, i) => s.slice(0, i).split("\n").length;

for (const f of published.filter((x) => x.endsWith(".html"))) {
  if (f === "404.html") continue; // 404 页用 <base> 固定发布前缀
  const raw = readFileSync(f, "utf8");
  const s = strip(raw);
  const tagRe = /<(?!a\b)([a-z0-9-]+)\b([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(s))) {
    const attrRe = /\s(src|href|poster|data-src|data-poster)\s*=\s*["']([^"']+)["']/gi;
    let a;
    while ((a = attrRe.exec(m[2]))) {
      const v = a[2].trim();
      if (/^(https?:)?\/\//i.test(v)) {
        if (m[1].toLowerCase() === "link" && /rel=["'](canonical|alternate)/i.test(m[2])) continue;
        errors.push(`${f}：<${m[1]} ${a[1]}="${v}"> 引用了外部资源`);
      } else if (/^(poster|data-src|data-poster)$/i.test(a[1]) && !/^(data:|blob:|\$\{)/.test(v)) {
        const target = normalize(join(dirname(f), decodeURIComponent(v.split(/[?#]/)[0])));
        if (!existsSync(target)) errors.push(`${f}：${a[1]}="${v}" 指向的文件不存在`);
      }
    }
  }
  const pre = /<video\b[^>]*preload=["']metadata["'][^>]*>/gi;
  let p, count = 0, first = 0;
  while ((p = pre.exec(raw))) { if (!count) first = lineOf(raw, p.index); count++; }
  if (count) warnings.push(`${f}:${first}：${count} 个 <video preload="metadata">，打开页面就会预下载视频数据`);
}

const catRows = Object.keys({ ...cats, ...(base?.categories || {}) }).sort().map((c) => {
  const now = cats[c] || 0, was = base?.categories?.[c] ?? null;
  const d = was === null ? "" : now - was;
  return `| ${c} | ${was === null ? "—" : fmt(was)} | ${fmt(now)} | ${d === "" ? "" : (d >= 0 ? "+" : "−") + fmt(Math.abs(d))} |`;
});
const out = [
  "## 站点体积（基线 + 回归预算）与本地资源检查", "",
  `- 发布文件：${published.length} 个，总量 ${fmt(total)}${base ? `（基线 ${fmt(base.total)}）` : ""}`,
  `- 回归预算：单文件超过基线 ×${RATIO} 且多出 ${fmt(SLACK)} 以上`,
  `- 错误 ${errors.length} · 警告 ${warnings.length} · 变化 ${notes.length}`, "",
  "| 类别 | 基线 | 当前 | 变化 |", "|---|---|---|---|", ...catRows, ""
];
if (errors.length) out.push("### 错误", ...errors.map((e) => `- ${e}`), "");
if (warnings.length) out.push("### 警告", ...warnings.map((w) => `- ${w}`), "");
if (notes.length) out.push("### 变化", ...notes.slice(0, 200).map((n) => `- ${n}`), "");
const text = out.join("\n");
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
if (process.env.GITHUB_ACTIONS) {
  for (const w of warnings) console.log(`::warning::${w}`);
  for (const e of errors) console.log(`::error::${e}`);
}
process.exit(errors.length ? 1 : 0);
