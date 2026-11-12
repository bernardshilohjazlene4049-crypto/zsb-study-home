import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

test("sw-build：写入 12 位版本号与预缓存清单，不含视频、搜索索引和 404 页", () => {
  const out = mkdtempSync(join(tmpdir(), "zsb-sw-"));
  try {
    copyFileSync(join(root, "sw.js"), join(out, "sw.js"));
    for (const f of ["index.html", "404.html", "a/b.css", "a/c.js", "v/x.mp4", "pagefind/pagefind.js", "manifest.webmanifest"]) {
      mkdirSync(join(out, f, ".."), { recursive: true });
      writeFileSync(join(out, f), "x");
    }
    execFileSync(process.execPath, [join(root, ".github/scripts/sw-build.mjs"), out], { env: { ...process.env, GITHUB_SHA: "0123456789abcdef0123" }, stdio: "pipe" });
    const sw = readFileSync(join(out, "sw.js"), "utf8");
    assert.match(sw, /const VERSION = "0123456789ab";/);
    const list = JSON.parse(sw.match(/const PRECACHE = (\[.*?\]);/)[1]);
    assert.equal(list[0], "./");
    assert.equal(list.at(-1), "index.html");
    assert.ok(list.includes("a/b.css") && list.includes("a/c.js") && list.includes("manifest.webmanifest"));
    assert.ok(!list.some((f) => /\.mp4$|^pagefind\/|^404\.html$|^sw\.js$/.test(f)));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("sw.js：只清理本站旧版本缓存，视频不进缓存", () => {
  const sw = readFileSync(join(root, "sw.js"), "utf8");
  assert.match(sw, /const VERSION = "dev";/);
  assert.match(sw, /key\.startsWith\("zsb-"\) && key !== CACHE/);
  assert.match(sw, /skipWaiting\(\)/);
  assert.match(sw, /clients\.claim\(\)/);
  assert.match(sw, /mp4\|webm/);
});

test("manifest：图标文件都存在，start_url 与 scope 用相对路径", () => {
  const m = JSON.parse(readFileSync(join(root, "manifest.webmanifest"), "utf8"));
  assert.ok(!/^(https?:)?\/\//.test(m.start_url) && !m.start_url.startsWith("/"));
  assert.ok(!m.scope.startsWith("/"));
  for (const icon of m.icons) assert.ok(existsSync(join(root, icon.src)), icon.src);
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
});

test("发布白名单里的根目录文件都存在", () => {
  const sh = readFileSync(join(root, ".github/scripts/build-site.sh"), "utf8");
  const files = sh.match(/ROOT_FILES=\(([^)]*)\)/)[1].trim().split(/\s+/);
  for (const f of files) assert.ok(existsSync(join(root, f)), f);
});
