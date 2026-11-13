import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLAYER = "assets/js/lecture-player.js";
const STORAGE = "zsb-lecture-rate-v1";
const VIDEO_PAGES = [
  "gs/gs1.html",
  "gs/gs45.html",
  "gs/index.html",
  "yy/index.html",
  "yy/yy5.html",
  "jsj/index.html",
  "wy/index.html",
  "study/index.html"
];

function loadPlayer(initial) {
  const store = { ...(initial || {}) };
  const localStorage = {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; }
  };
  const document = {
    nodeType: 9,
    readyState: "complete",
    documentElement: { nodeType: 1 },
    body: { nodeType: 1 },
    querySelectorAll() { return []; },
    querySelector() { return null },
    addEventListener() {},
    matches() { return false }
  };
  class MutationObserver {
    observe() {}
  }
  const window = {};
  const ctx = createContext({
    localStorage,
    document,
    window,
    MutationObserver,
    Number,
    String,
    Math,
    console,
    setTimeout,
    clearTimeout
  });
  ctx.globalThis = ctx;
  runInContext(readFileSync(join(root, PLAYER), "utf8"), ctx, { filename: PLAYER });
  return { api: ctx.window.zsbLecturePlayer, store, localStorage };
}

test("讲解视频页引入共享播放器，教学示例页不引入", () => {
  for (const path of VIDEO_PAGES) {
    const html = readFileSync(join(root, path), "utf8");
    assert.match(html, /assets\/css\/lecture-player\.css/, `${path} 应引入 lecture-player.css`);
    assert.match(html, /assets\/js\/lecture-player\.js/, `${path} 应引入 lecture-player.js`);
    const css = html.match(/href="([^"]*lecture-player\.css)"/)[1];
    const js = html.match(/src="([^"]*lecture-player\.js)"/)[1];
    assert.match(css, /^\.\.?\/assets\//, `${path} CSS 须用相对路径`);
    assert.match(js, /^\.\.?\/assets\//, `${path} JS 须用相对路径`);
    assert.doesNotMatch(css, /https?:|cdn\./i, `${path} CSS 不能用 CDN 或绝对网址`);
    assert.doesNotMatch(js, /https?:|cdn\./i, `${path} JS 不能用 CDN 或绝对网址`);
  }
  const demo = readFileSync(join(root, "wy/html5/video.html"), "utf8");
  assert.doesNotMatch(demo, /lecture-player/, "wy/html5/video.html 不应引入共享播放器");
  assert.match(demo, /controls：显示播放控件/, "教学示例仍应讲解原生 controls");
  assert.match(demo, /&lt;video[^&]*controls/, "示例代码仍含原生 controls");
});

test("工作台不再自带倍速下拉", () => {
  const src = readFileSync(join(root, "assets/js/features/video.js"), "utf8");
  assert.doesNotMatch(src, /播放倍速/);
  assert.doesNotMatch(src, /\[0\.75, 1, 1\.25, 1\.5\]/);
  assert.match(src, /const actions = \[\];/);
  assert.doesNotMatch(src, /saved\.playback_rate/);
  assert.match(src, /savePlayback/);
});

test("共享脚本没有外部资源，并用全站键记住倍速", () => {
  const js = readFileSync(join(root, PLAYER), "utf8");
  const css = readFileSync(join(root, "assets/css/lecture-player.css"), "utf8");
  assert.doesNotMatch(js, /https?:\/\//);
  assert.doesNotMatch(css, /https?:\/\//);
  assert.match(js, /zsb-lecture-rate-v1/);
  assert.match(js, /n>=\.5&&n<=3/);
});

test("全站倍速写入 0.5–3.0，越界不保存，下次读取沿用上次", () => {
  const first = loadPlayer();
  first.api.setGlobalRate(1.8);
  assert.equal(first.store[STORAGE], "1.8");
  first.api.setGlobalRate(0.4);
  assert.equal(first.store[STORAGE], "1.8");
  first.api.setGlobalRate(3.1);
  assert.equal(first.store[STORAGE], "1.8");
  first.api.setGlobalRate("abc");
  assert.equal(first.store[STORAGE], "1.8");
  first.api.setGlobalRate(0.5);
  assert.equal(first.store[STORAGE], "0.5");
  first.api.setGlobalRate(3);
  assert.equal(first.store[STORAGE], "3");

  const second = loadPlayer({ [STORAGE]: "1.8" });
  second.api.setGlobalRate(1.8);
  assert.equal(second.store[STORAGE], "1.8");

  const invalid = loadPlayer({ [STORAGE]: "9" });
  invalid.api.setGlobalRate(1);
  assert.equal(invalid.store[STORAGE], "1");
});
test("控件显示时时长标签不再压住全屏按钮", () => {
  const css = readFileSync(join(root, "assets/css/lecture-player.css"), "utf8");
  // 共享样式：控件条可见（.zlp--show / 倍速菜单 / 键盘聚焦）时隐藏封面右下角的 .dur，
  // 控件隐藏时标签照旧显示，避免标签盖住控件条最右侧的 .zlp__full。
  assert.match(
    css,
    /:is\(\.vthumb,\.media-frame,\.video-frame\):has\(\.zlp--show,\.zlp--menu,\.zlp--keyboard:focus-within\)>\.dur\{display:none\}/,
    "CSS 需要在控件可见时隐藏容器里的 .dur"
  );
  // 隐藏规则作用于播放器容器的直接子节点，页面结构必须保持这样。
  const pages = [["wy/index.html", "vthumb"], ["yy/index.html", "media-frame"]];
  for (const [path, container] of pages) {
    const html = readFileSync(join(root, path), "utf8");
    const open = `<div class="${container}">`;
    const marks = [...html.matchAll(/<span class="dur">[\d:]+<\/span>/g)];
    assert.ok(marks.length > 0, `${path} 应有时长标签`);
    for (const m of marks) {
      const start = html.lastIndexOf(open, m.index);
      assert.ok(start >= 0 && start < m.index, `${path} 时长标签应在 .${container} 内`);
      const between = html.slice(start + open.length, m.index);
      assert.doesNotMatch(between, /<\/div>/, `${path} 时长标签应是 .${container} 的直接子节点`);
      assert.match(between, /<\/video>/, `${path} 时长标签应紧跟播放器`);
    }
  }
});

test("科目主页视频实现按需加载封面与播放时取字幕", () => {
  const pages = ["jsj/index.html", "yy/index.html", "gs/index.html"];
  for (const path of pages) {
    const html = readFileSync(join(root, path), "utf8");
    assert.doesNotMatch(html, /<video[^>]*\b(?<!data-)poster\s*=/i, `${path} 初始 HTML 不应含有 poster 属性`);
    assert.doesNotMatch(html, /<track[^>]*\b(?<!data-)src\s*=/i, `${path} 初始 HTML 不应含有 track src 属性`);
    if (path === "gs/index.html") {
      assert.match(html, /<img\s+data-src="[^"]+"[^>]*width="\d+"[^>]*height="\d+"/i, `${path} 封面图应使用 data-src 并带有 width/height`);
    } else {
      assert.match(html, /<video[^>]*data-poster="[^"]+"[^>]*width="\d+"[^>]*height="\d+"/i, `${path} 视频应使用 data-poster 并带有 width/height`);
      assert.match(html, /<track[^>]*data-src="[^"]+"/i, `${path} 字幕轨应使用 data-src`);
    }
  }
  const facadeJs = readFileSync(join(root, "assets/js/video-facade.js"), "utf8");
  const playerJs = readFileSync(join(root, "assets/js/lecture-player.js"), "utf8");
  assert.ok(facadeJs.includes("IntersectionObserver") || playerJs.includes("IntersectionObserver"), "共享脚本应包含 IntersectionObserver 逻辑");
  assert.ok(playerJs.includes("data-src") || facadeJs.includes("data-src"), "共享脚本应在播放时加载字幕轨 src");
});
