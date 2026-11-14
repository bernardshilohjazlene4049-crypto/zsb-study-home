import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { pinCues } = require("../assets/js/caption-position.js");

test("把 cue 放到顶部，不改字幕文字", () => {
  const cue = { line: "auto", text: "第五章考点四十：偏导数" };
  pinCues({ cues: [cue] });
  assert.equal(cue.line, 0);
  assert.equal(cue.text, "第五章考点四十：偏导数");
});

test("空轨道或没有 cues 时不抛错", () => {
  pinCues(null);
  pinCues({});
  pinCues({ cues: [] });
});

test("带静态字幕轨的页面引入定位脚本，动态播放器会加载它", () => {
  for (const path of ["jsj/index.html", "wy/ch2/s21.html", "yy/index.html"]) {
    const html = readFileSync(path, "utf8");
    assert.match(html, /assets\/js\/caption-position\.js/, `${path} 应引入 caption-position.js`);
  }
  for (const path of ["assets/js/video-facade.js", "assets/js/pvideo-captions.js"]) {
    const src = readFileSync(path, "utf8");
    assert.match(src, /caption-position\.js/, `${path} 应加载 caption-position.js`);
  }
});
