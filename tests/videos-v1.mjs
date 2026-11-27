import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../assets/js/videos-v1.js", import.meta.url), "utf8");

function mount({ url, release = "draft" }) {
  const location = new URL(url);
  const src = "https://github.com/example/repo/releases/download/videos-v1/lesson.mp4";
  const made = [];

  function element(tag) {
    const events = {};
    const classes = new Set();
    return {
      tag,
      children: [],
      classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        contains(name) { return classes.has(name); }
      },
      closest() { return null; },
      append(...children) { this.children.push(...children); },
      addEventListener(name, cb) { events[name] = cb; },
      trigger(name) { events[name]?.(); },
      remove() { this.removed = true; },
      focus() { this.focused = true; },
      load() {},
      setAttribute(name, value) { this[name] = value; },
      removeAttribute(name) { delete this[name]; }
    };
  }

  const image = { dataset: { cover: "/poster.webp" } };
  const notice = {};
  const controls = element("div");
  const row = Object.assign(element("li"), {
    dataset: { asset: "lesson.mp4" },
    querySelector: (selector) => ({
      ".v1-title": { textContent: "<导学 & 例题>" },
      div: controls,
      img: image
    })[selector]
  });
  const section = Object.assign(element("details"), {
    open: false,
    dataset: { release },
    matches: (selector) => selector === ".v1-videos",
    querySelectorAll: (selector) => selector === "img[data-cover]" ? (image.dataset.cover ? [image] : []) : [row],
    querySelector: (selector) => selector === ".v1-notice" ? notice : row.children.find((child) => child.tag === "video" && !child.removed)
  });
  runInNewContext(script, {
    URL, URLSearchParams, location, window: element("window"),
    document: {
      currentScript: {
        src: new URL("/assets/js/videos-v1.js", url).href,
        dataset: { downloadBase: src.replace("lesson.mp4", "") }
      },
      querySelectorAll: () => [section],
      getElementById: (id) => id === "videos-v1-lesson" ? section : null,
      createElement: (tag) => {
        const node = element(tag);
        made.push(node);
        return node;
      }
    }
  });
  return { section, image, notice, controls, row, made, src };
}

test("draft site and ordinary localhost offer no playback, even with a public preview query", () => {
  for (const url of [
    "https://example.com/lesson?videos-preview=1",
    "http://localhost:8765/lesson?videos-preview=1",
    "http://127.0.0.1:8765/lesson"
  ]) {
    const { section, image, made } = mount({ url });
    assert.equal(image.src, undefined);
    section.open = true;
    section.trigger("toggle");
    assert.equal(image.src, "/poster.webp");
    assert.equal(made.length, 0);
  }
});

test("loopback preview and published playback load only the selected video, with no autoplay", () => {
  for (const config of [
    { url: "http://127.0.0.1:8765/lesson?videos-preview=1#videos-v1-lesson", release: "draft" },
    { url: "https://example.com/lesson#videos-v1-lesson", release: "published" }
  ]) {
    const { section, controls, row, made, src } = mount(config);
    assert.equal(section.open, true);
    assert.deepEqual(made.map((node) => node.tag), ["button"]);
    const [button] = controls.children;
    assert.match(button["aria-label"], /<导学 & 例题>/);
    button.trigger("click");
    assert.equal(row.classList.contains("v1-open"), true);
    const [video] = row.children;
    assert.equal(video.src, config.release === "draft"
      ? "http://127.0.0.1:8765/__videos_v1_media__/lesson.mp4" : src);
    assert.equal(video.controls, true);
    assert.equal(video.preload, "metadata");
    assert.equal(video.autoplay, undefined);
    assert.equal(video.focused, true);
    section.open = false;
    section.trigger("toggle");
    assert.equal(row.classList.contains("v1-open"), false);
    assert.equal(video.removed, true);
    assert.equal(video.src, undefined);
  }
});

test("video styles include the layout selectors and span the player across the grid", () => {
  const css = readFileSync(new URL("../assets/css/videos-v1.css", import.meta.url), "utf8");
  for (const selector of [
    ".chapter-video:has(> .v1-videos)",
    ".wy-point-head:has(> .v1-videos)",
    ".v1-open > img"
  ]) {
    assert.ok(css.includes(selector), `Missing selector: ${selector}`);
  }
  assert.match(css, /\.zlp\b(?![\w-])[^{}]*\{[^{}]*\bgrid-column: 1 \/ -1\s*[;}]/);
});
