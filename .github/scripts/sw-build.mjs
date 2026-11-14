// 构建时给 _site/sw.js 写入版本号（commit SHA）与预缓存清单（首页外壳所需的最小文件集）。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const out = process.argv[2] || "_site";
const sha = (process.env.GITHUB_SHA || execSync("git rev-parse HEAD").toString().trim()).slice(0, 12);

// 预缓存清单：仅保留离线启动首页所需的最小外壳。
// 讲义页、科目主页、工作台等不预缓存；访问后会通过运行时 networkFirst 写入缓存。
const SHELL = [
  "./",
  "index.html",
  "offline.html",
  "manifest.webmanifest",
  "assets/css/site-unify.css",
  "assets/css/site-shell.css",
  "assets/js/site-shell.js",
  "assets/js/sw-register.js",
  // 首页动态 import 的模块树（home.js → model.js → ui.js / common.js → features / core）
  "assets/js/shell/home.js",
  "assets/js/shell/model.js",
  "assets/js/shell/ui.js",
  "assets/js/shell/common.js",
  "assets/js/core/storage.js",
  "assets/js/core/paths.js",
  "assets/js/core/schema.js",
  "assets/js/core/ids.js",
  "assets/js/core/events.js",
  "assets/js/features/records.js",
  "assets/js/features/mistake-rules.js",
  "assets/js/features/fsrs.js",
  "assets/js/features/review-config.js",
  "assets/js/features/topic-index.js",
  "assets/js/features/topic-merges.js",
  // 首页渲染「继续学习 / 科目进度」所需的数据
  "data/subjects.json",
  "data/topics.json",
  "data/dependencies.json",
  "data/resources.json",
  "data/page-questions.json",
];

// 验证所有条目（除 "./"）都存在于发布目录
const missing = SHELL.filter((p) => p !== "./" && !existsSync(join(out, p)));
if (missing.length) throw new Error(`预缓存清单中以下文件在发布目录中不存在：\n${missing.join("\n")}`);

const swPath = join(out, "sw.js");
let sw = readFileSync(swPath, "utf8");
sw = sw.replace('const VERSION = "dev";', `const VERSION = ${JSON.stringify(sha)};`)
       .replace("const PRECACHE = [];", `const PRECACHE = ${JSON.stringify(SHELL)};`);
if (!sw.includes(sha)) throw new Error("sw.js 版本号写入失败");
writeFileSync(swPath, sw);

const bytes = SHELL.filter((p) => p !== "./").reduce((sum, f) => {
  try { return sum + readFileSync(join(out, f)).length; } catch { return sum; }
}, 0);
console.log(`sw.js：版本 ${sha}，预缓存 ${SHELL.length} 个条目，约 ${(bytes / 1048576).toFixed(2)} MB`);
