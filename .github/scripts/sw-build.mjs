// 构建时给 _site/sw.js 写入版本号（commit SHA）与预缓存清单（页面、脚本、样式、数据、图标；不含视频与图片素材）。
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";

const out = process.argv[2] || "_site";
const sha = (process.env.GITHUB_SHA || execSync("git rev-parse HEAD").toString().trim()).slice(0, 12);
const keep = /\.(html|js|css|json|webmanifest|svg)$/i;
const skip = /^(pagefind\/|sw\.js$|404\.html$)/;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else {
      const rel = relative(out, full).split("\\").join("/");
      if (keep.test(rel) && !skip.test(rel)) files.push(rel);
    }
  }
})(out);
files.sort();
const precache = ["./", ...files.filter((f) => f !== "index.html"), "index.html"];
const swPath = join(out, "sw.js");
let sw = readFileSync(swPath, "utf8");
sw = sw.replace('const VERSION = "dev";', `const VERSION = ${JSON.stringify(sha)};`)
       .replace("const PRECACHE = [];", `const PRECACHE = ${JSON.stringify(precache)};`);
if (!sw.includes(sha)) throw new Error("sw.js 版本号写入失败");
writeFileSync(swPath, sw);
const bytes = files.reduce((sum, f) => sum + statSync(join(out, f)).size, 0);
console.log(`sw.js：版本 ${sha}，预缓存 ${precache.length} 个文件，约 ${(bytes / 1048576).toFixed(1)} MB`);
