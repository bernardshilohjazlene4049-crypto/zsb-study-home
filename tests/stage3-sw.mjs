// 真实样本来源：f2ad82862776 中的站点文件与 SW 构建脚本；构建测试读取当前检出版本。
// 不生成讲义、题目或学习记录。SHA 使用真实 git HEAD，CI 浅克隆同样可运行。
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);

// 精简预缓存清单中所有非 "./" 的条目（与 sw-build.mjs 保持一致）。
const PRECACHE_SHELL = [
  "index.html",
  "offline.html",
  "manifest.webmanifest",
  "assets/css/site-unify.css",
  "assets/css/site-shell.css",
  "assets/js/site-shell.js",
  "assets/js/sw-register.js",
  "assets/js/shell/home.js",
  "assets/js/shell/model.js",
  "assets/js/shell/ui.js",
  "assets/js/shell/common.js",
  "assets/js/core/storage.js",
  "assets/js/core/schema.js",
  "assets/js/core/ids.js",
  "assets/js/core/events.js",
  "assets/js/features/records.js",
  "assets/js/features/mistake-rules.js",
  "assets/js/features/fsrs.js",
  "assets/js/features/review-config.js",
  "assets/js/features/topic-index.js",
  "data/subjects.json",
  "data/topics.json",
  "data/dependencies.json",
  "data/page-questions.json",
];

// 明确不得出现在预缓存清单中的讲义和未引用 CSS
const MUST_EXCLUDE = [
  "gs/gs1.html",
  "gs/gs45.html",
  "yy/yy5.html",
  "jsj/jsj1.html",
  "style.css",
  "assets/css/tokens.css",
  "jsj/learn.css",
];

// 预缓存条目数上限（精简后应远小于旧的 ~204 项）
const PRECACHE_MAX = 40;

function shellArray(source, name) {
  const groups = [...source.matchAll(new RegExp(`^${name}(?:\\+)?=\\(([^)]*)\\)`, "gm"))];
  assert.ok(groups.length, `${name} 白名单应存在`);
  return groups.flatMap((match) => match[1].trim().split(/\s+/)).filter(Boolean);
}

function fixture(t) {
  // 本地可指定仓库外 tools 目录并保留产物，CI 使用系统临时目录并在测试后清理。
  const dir = mkdtempSync(join(process.env.SW_TEST_ARTIFACTS || tmpdir(), "zsb-sw-"));
  if (!process.env.SW_TEST_ARTIFACTS) t.after(() => rmSync(dir, { recursive: true, force: true }));

  // 收集 fixture 所需文件：根目录白名单 + 精简预缓存清单所有文件（确保 sw-build.mjs 存在性校验通过）
  const paths = new Set([
    ...shellArray(read(".github/scripts/build-site.sh"), "ROOT_FILES"),
    ...PRECACHE_SHELL,
  ]);
  // 覆盖不应预缓存的媒体/位图/字幕扩展名（用于验证排除逻辑）
  for (const extension of ["mp4", "webm", "png", "jpg", "vtt"]) {
    const files = tracked.filter((path) => path.endsWith("." + extension) && existsSync(join(root, path)));
    files.sort((a, b) => statSync(join(root, a)).size - statSync(join(root, b)).size);
    if (files[0]) paths.add(files[0]);
  }
  for (const path of paths) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    copyFileSync(join(root, path), join(dir, path));
  }
  return { dir, paths: [...paths] };
}

function build(dir, githubSha) {
  const env = { ...process.env };
  delete env.GITHUB_SHA;
  if (githubSha) env.GITHUB_SHA = githubSha;
  execFileSync(process.execPath, [join(root, ".github/scripts/sw-build.mjs"), dir], { cwd: root, env, encoding: "utf8" });
  const sw = readFileSync(join(dir, "sw.js"), "utf8");
  return {
    version: JSON.parse(sw.match(/^const VERSION = ("[^"]+");/m)?.[1] || "null"),
    precache: JSON.parse(sw.match(/^const PRECACHE = (\[[^\n]+\]);/m)?.[1] || "null")
  };
}

test("发布根目录白名单文件均存在且被 git 追踪", () => {
  const files = shellArray(read(".github/scripts/build-site.sh"), "ROOT_FILES");
  assert.equal(files.length, new Set(files).size, "白名单不可重复");
  for (const file of files) {
    assert.ok(tracked.includes(file), `${file} 应被追踪`);
    assert.ok(statSync(join(root, file)).isFile(), `${file} 应是实际文件`);
  }
  assert.ok(files.includes("sw.js"));
  assert.ok(files.includes("manifest.webmanifest"));
});

test("sw-build 写入 git HEAD 前 12 位，预缓存清单相对、去重、无禁止项", (t) => {
  const { dir } = fixture(t);
  const result = build(dir);
  assert.equal(result.version, sha.slice(0, 12));
  assert.match(result.version, /^[a-f0-9]{12}$/);
  // 去重
  assert.equal(result.precache.length, new Set(result.precache).size, "预缓存清单不可含重复项");
  // 相对路径、无禁止项
  for (const path of result.precache) {
    assert.doesNotMatch(path, /^(?:\/|[a-z]+:)|\\|\.\./i, `${path} 应为站点内相对路径`);
    assert.doesNotMatch(path, /\.(?:mp4|webm|m4v|mov|mp3|m4a)$/i, `${path} 音视频不应进入预缓存`);
    assert.ok(!["sw.js", "404.html"].includes(path), `${path} 不应进入预缓存`);
    assert.ok(!path.startsWith("pagefind/"), `${path} pagefind/ 不应进入预缓存`);
    // 未引用的 CSS 和讲义页不应出现
    for (const ex of MUST_EXCLUDE) {
      assert.ok(path !== ex, `${ex} 不应出现在预缓存清单中`);
    }
  }
});

test("预缓存清单必须包含首页、离线页和外壳 CSS/JS", (t) => {
  const { dir } = fixture(t);
  const { precache } = build(dir);
  const required = [
    "index.html",
    "offline.html",
    "manifest.webmanifest",
    "assets/css/site-unify.css",
    "assets/css/site-shell.css",
    "assets/js/site-shell.js",
    "assets/js/sw-register.js",
    "data/subjects.json",
    "data/topics.json",
    "data/dependencies.json",
  ];
  for (const path of required) {
    assert.ok(precache.includes(path), `预缓存清单应包含 ${path}`);
  }
});

test("预缓存清单规模有上限且不含讲义页", (t) => {
  const { dir } = fixture(t);
  const { precache } = build(dir);
  assert.ok(
    precache.length <= PRECACHE_MAX,
    `预缓存清单条目数 ${precache.length} 超过上限 ${PRECACHE_MAX}`
  );
  for (const ex of MUST_EXCLUDE) {
    assert.ok(!precache.includes(ex), `预缓存清单不得包含 ${ex}`);
  }
});

test("sw-build 优先采用真实 GITHUB_SHA 的前 12 位", (t) => {
  const { dir } = fixture(t);
  const historicalSha = "f2ad82862776bd3b5522d43f5c6bb5c45727890d";
  assert.equal(build(dir, historicalSha).version, historicalSha.slice(0, 12));
});

test("搜索索引目录中的真实站点脚本也不进入预缓存", (t) => {
  const { dir } = fixture(t);
  // pagefind/ 是 f2ad828 的发布脚本定义的真实索引目录；只复制其历史中已有的 JS 内容测试目录排除。
  const source = "assets/js/site-search.js";
  const indexDir = join(dir, "pagefind");
  mkdirSync(indexDir);
  copyFileSync(join(root, source), join(indexDir, "site-search.js"));
  assert.ok(readdirSync(indexDir).length);
  assert.ok(build(dir).precache.every((path) => !path.startsWith("pagefind/")));
});

test("manifest 的启动地址、作用域和全部图标均在站内，尺寸与 PNG 文件一致", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.start_url, "./index.html");
  assert.ok(existsSync(join(root, manifest.start_url)));
  assert.ok(manifest.icons.length > 0);
  for (const icon of manifest.icons) {
    assert.doesNotMatch(icon.src, /^(?:\/|[a-z]+:)|\\|\.\./i);
    const path = join(root, icon.src);
    assert.ok(tracked.includes(relative(root, path).split("\\").join("/")));
    const bytes = readFileSync(path);
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(icon.type, "image/png");
    assert.equal(icon.sizes, `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`);
  }
});
