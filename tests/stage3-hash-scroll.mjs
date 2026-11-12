import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = "assets/js/hash-scroll.js";

function read(rel) {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

test("锚点校正脚本没有外部资源，并会临时取消 content-visibility、在布局稳定后再滚一次", () => {
  const src = read(SCRIPT);
  assert.doesNotMatch(src, /https?:\/\//);
  assert.match(src, /content-visibility/);
  assert.match(src, /contentVisibility|"visible"/);
  assert.match(src, /scrollIntoView/);
  assert.match(src, /ResizeObserver/);
  assert.match(src, /touchmove/);
  assert.match(src, /fonts\.ready/);
  assert.match(src, /userScrolled/);
  assert.match(src, /contain-intrinsic-size/);
});

test("gs1、gs45 和英语页引入锚点校正脚本", () => {
  const pages = {
    "gs/gs1.html": "../assets/js/hash-scroll.js",
    "gs/gs45.html": "../assets/js/hash-scroll.js",
    "yy/index.html": "../assets/js/hash-scroll.js",
  };
  for (const [path, rel] of Object.entries(pages)) {
    const html = read(path);
    assert.match(html, new RegExp(`src="${rel.replaceAll(".", "\\.")}"`), `${path} 应引入 hash-scroll.js`);
    assert.match(html, /hash-scroll\.js" defer/);
  }
});

test("hashId 能解码锚点，无锚点时不处理", async () => {
  const href = pathToFileURL(join(ROOT, SCRIPT)).href;
  const api = (await import(href)).default;
  const prev = globalThis.location;
  globalThis.location = { hash: "#point-6" };
  assert.equal(api.hashId(), "point-6");
  globalThis.location = { hash: "#_1" };
  assert.equal(api.hashId(), "_1");
  globalThis.location = { hash: "" };
  assert.equal(api.hashId(), "");
  globalThis.location = prev;
});
