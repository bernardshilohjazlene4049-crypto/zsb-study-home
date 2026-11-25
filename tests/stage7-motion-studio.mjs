// 第七阶段验收：全站本地动效引擎（Motion / Anime.js / Ola / Shifty / TweenJS / Lottie / Two.js / Konva / Proton / gifenc / Three.js / Manim）
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const VENDORS = [
  "assets/js/vendor/motion.min.js",
  "assets/js/vendor/anime.min.js",
  "assets/js/vendor/tween-suite.min.js",
  "assets/js/vendor/lottie-light.min.js",
  "assets/js/vendor/two.min.js",
  "assets/js/vendor/konva.min.js",
  "assets/js/vendor/proton.min.js",
  "assets/js/vendor/gifenc.min.js",
  "assets/js/vendor/three.min.js"
];

const MOTION_MODULES = [
  "assets/js/motion/site-motion.js",
  "assets/js/motion/interactive-studio.js",
  "assets/js/motion/graph-konva.js",
  "assets/js/motion/scenes-3d.js",
  "assets/css/motion-studio.css"
];

const MANIM_GIFS = [
  "assets/manim/limit-squeeze.gif",
  "assets/manim/cidr-mask.gif",
  "assets/manim/pointer-2d.gif"
];

const LOTTIES = [
  "assets/lottie/pulse-beacon.json",
  "assets/lottie/celebrate-check.json"
];

test("全部 9 个本地打包动效与图形引擎库真实存在、体积受控且不含外部脚本加载", () => {
  for (const v of VENDORS) {
    const full = join(root, v);
    assert.ok(existsSync(full), `缺少本地引擎包 ${v}`);
    const sz = statSync(full).size;
    assert.ok(sz > 1024 && sz < 900 * 1024, `${v} 体积异常: ${sz}`);
  }
  for (const m of MOTION_MODULES) {
    const full = join(root, m);
    assert.ok(existsSync(full), `缺少动效业务模块 ${m}`);
    const cleaned = read(m).replaceAll("http://www.w3.org/2000/svg", "");
    assert.doesNotMatch(cleaned, /https?:\/\//i, `${m} 不得引用外部 CDN`);
  }
});

test("Python Manim 精渲 GIF 动图（GIF89a 头）与 Lottie 矢量动画 JSON 合法且轻量", () => {
  for (const g of MANIM_GIFS) {
    const full = join(root, g);
    assert.ok(existsSync(full), `缺少 Manim 动图 ${g}`);
    const buf = readFileSync(full);
    assert.equal(buf.subarray(0, 6).toString("ascii"), "GIF89a", `${g} 应为合法 GIF89a`);
    assert.ok(buf.length < 300 * 1024, `${g} 应压缩至 300KB 内，当前 ${buf.length}`);
  }
  for (const l of LOTTIES) {
    const doc = JSON.parse(read(l));
    assert.ok(Array.isArray(doc.layers) && doc.layers.length >= 2, `${l} 图层有效`);
  }
});

test("gifenc 编码器可在 Node / 浏览器无依赖生成合法 GIF 字节流", async () => {
  const { GIFEncoder, quantize, applyPalette } = await import("../assets/js/vendor/gifenc.min.js");
  const w = 16, h = 16;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = i % 2 ? 29 : 220;
    rgba[i * 4 + 1] = i % 2 ? 78 : 38;
    rgba[i * 4 + 2] = i % 2 ? 216 : 38;
    rgba[i * 4 + 3] = 255;
  }
  const gif = GIFEncoder();
  const palette = quantize(rgba, 16);
  const index = applyPalette(rgba, palette);
  gif.writeFrame(index, w, h, { palette, delay: 100 });
  gif.finish();
  const out = gif.bytes();
  assert.equal(Buffer.from(out.subarray(0, 6)).toString("ascii"), "GIF89a");
});

test("全站外壳、关系图白板与指挥塔 3D 空间已按需动态接线", () => {
  assert.match(read("assets/js/site-shell.js"), /motion-studio\.css/);
  assert.match(read("assets/js/site-shell.js"), /assets\/js\/motion\/site-motion\.js/);
  assert.match(read("assets/js/site-shell.js"), /assets\/js\/motion\/scenes-3d\.js/);
  assert.match(read("assets/js/shell/graph.js"), /交互白板画布/);
  assert.match(read("assets/js/shell/graph.js"), /graph-konva\.js/);
  assert.match(read("assets/js/tower.js"), /mountTower3D/);
  assert.match(read("assets/js/shell/system-study.js"), /renderMotionStudio/);
});
