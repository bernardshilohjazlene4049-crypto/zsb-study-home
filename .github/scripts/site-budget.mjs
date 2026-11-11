// 站点体积与本地资源检查：不依赖任何 npm 包，只用 Node 内置模块。
// 失败条件：单页 HTML 过大、单个媒体文件过大、发布总量接近 GitHub Pages 1 GB 上限、
// 页面引用外部域名资源（无 CDN 原则）、视频/海报 data-src / poster 指向不存在的本地文件。
// 只警告：<video preload="metadata">（打开页面就会预下载视频数据）。
import { execSync } from "node:child_process";
import { readFileSync, statSync, existsSync, appendFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const KB = 1024, MB = 1024 * KB;
const LIMITS = { html: 600 * KB, media: 50 * MB, totalWarn: 800 * MB, totalFail: 950 * MB };
const files = execSync("git ls-files -z", { encoding: "utf8" }).split("\0").filter(Boolean);
const errors = [], warnings = [];
let total = 0;

const mediaExt = /\.(mp4|webm|mov|m4a|mp3|wav)$/i;
for (const f of files) {
  if (!existsSync(f)) continue;
  const size = statSync(f).size;
  total += size;
  if (f.endsWith(".html") && size > LIMITS.html) errors.push(`${f}: HTML ${(size / KB).toFixed(0)} KB > ${LIMITS.html / KB} KB`);
  if (mediaExt.test(f) && size > LIMITS.media) errors.push(`${f}: 媒体文件 ${(size / MB).toFixed(1)} MB > ${LIMITS.media / MB} MB`);
}
if (total > LIMITS.totalFail) errors.push(`发布总量 ${(total / MB).toFixed(0)} MB > ${LIMITS.totalFail / MB} MB`);
else if (total > LIMITS.totalWarn) warnings.push(`发布总量 ${(total / MB).toFixed(0)} MB，已超过 ${LIMITS.totalWarn / MB} MB`);

// 去掉代码示例区域，避免把教学用的示例代码当成真实引用。
const strip = (s) => s
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<(textarea|pre|code)\b[\s\S]*?<\/\1>/gi, "")
  .replace(/<script\b[^>]*type=["']text\/plain["'][^>]*>[\s\S]*?<\/script>/gi, "");
const lineOf = (s, i) => s.slice(0, i).split("\n").length;

for (const f of files.filter((x) => x.endsWith(".html"))) {
  if (f === "404.html") continue; // 404 页只能用站点根的绝对路径
  const raw = readFileSync(f, "utf8");
  const s = strip(raw);
  // 外部资源：除 <a href> 之外的 src / href / poster / data-src / data-poster
  const tagRe = /<(?!a\b)([a-z0-9-]+)\b([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(s))) {
    const attrRe = /\s(src|href|poster|data-src|data-poster)\s*=\s*["']([^"']+)["']/gi;
    let a;
    while ((a = attrRe.exec(m[2]))) {
      const v = a[2].trim();
      if (/^(https?:)?\/\//i.test(v)) {
        if (m[1].toLowerCase() === "link" && /rel=["'](canonical|alternate)/i.test(m[2])) continue;
        errors.push(`${f}: <${m[1]} ${a[1]}="${v}"> 引用了外部资源`);
      } else if (/^(poster|data-src|data-poster)$/i.test(a[1]) && !/^(data:|blob:|\$\{)/.test(v)) {
        const target = normalize(join(dirname(f), decodeURIComponent(v.split(/[?#]/)[0])));
        if (!existsSync(target)) errors.push(`${f}: ${a[1]}="${v}" 指向的文件不存在`);
      }
    }
  }
  const pre = /<video\b[^>]*preload=["']metadata["'][^>]*>/gi;
  let p, count = 0, first = 0;
  while ((p = pre.exec(raw))) { if (!count) first = lineOf(raw, p.index); count++; }
  if (count) warnings.push(`${f}:${first}: ${count} 个 <video preload="metadata">，打开页面就会预下载视频数据`);
}

const out = [];
out.push(`## 站点体积与本地资源检查`, ``, `- 文件数：${files.length}`, `- 发布总量：${(total / MB).toFixed(1)} MB`, `- 错误：${errors.length}`, `- 警告：${warnings.length}`, ``);
if (errors.length) out.push("### 错误", ...errors.map((e) => `- ${e}`), "");
if (warnings.length) out.push("### 警告", ...warnings.map((w) => `- ${w}`), "");
const text = out.join("\n");
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
if (process.env.GITHUB_ACTIONS) {
  for (const w of warnings) console.log(`::warning::${w}`);
  for (const e of errors) console.log(`::error::${e}`);
}
process.exit(errors.length ? 1 : 0);
