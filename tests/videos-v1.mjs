import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const script = readFileSync(new URL("../assets/js/videos-v1.js", import.meta.url), "utf8");

function mount({ url, release = "draft", records = null, readyStateOnSrc = 0 }) {
  const location = new URL(url);
  const src = "https://github.com/example/repo/releases/download/videos-v1/lesson.mp4";
  const made = [];

  function element(tag) {
    const events = new Map();
    const classes = new Set();
    return {
      tag,
      children: [],
      isConnected: true,
      duration: 300,
      readyState: 0,
      currentTime: 0,
      playbackRate: 1,
      get src() { return this._src; },
      set src(value) {
        this._src = value;
        if (tag === "video") this.readyState = readyStateOnSrc;
      },
      classList: {
        add(name) { classes.add(name); },
        remove(name) { classes.delete(name); },
        contains(name) { return classes.has(name); }
      },
      closest() { return null; },
      append(...children) {
        for (const child of children) {
          child.parentNode = this;
          child.isConnected = this.isConnected;
        }
        this.children.push(...children);
      },
      addEventListener(name, cb, options = {}) {
        const listeners = events.get(name) || [];
        listeners.push({ cb, once: Boolean(options.once) });
        events.set(name, listeners);
      },
      removeEventListener(name, cb) {
        events.set(name, (events.get(name) || []).filter((listener) => listener.cb !== cb));
      },
      trigger(name) {
        const listeners = [...(events.get(name) || [])];
        for (const listener of listeners) {
          listener.cb();
          if (listener.once) this.removeEventListener(name, listener.cb);
        }
      },
      remove() { this.removed = true; this.isConnected = false; },
      focus() { this.focused = true; },
      load() { this.loaded = true; },
      pause() { this.paused = true; this.trigger("pause"); },
      play() { this.playCalled = true; this.paused = false; return Promise.resolve(); },
      setAttribute(name, value) { this[name] = value; },
      removeAttribute(name) { delete this[name]; }
    };
  }

  const image = { dataset: { cover: "/poster.webp" } };
  const notice = {};
  const controls = element("div");
  const row = Object.assign(element("li"), {
    dataset: { asset: "lesson.mp4", videoId: "stable-lesson-1" },
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

  // Replace only the module loader in the VM harness; the production file still uses native import().
  const executable = script.replace(
    'import(new URL("assets/js/features/records.js", site).href)',
    "Promise.resolve(globalThis.__recordsMock)"
  );
  runInNewContext(executable, {
    URL, URLSearchParams, location, window: element("window"),
    __recordsMock: records,
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

test("playback persistence uses a lazy dynamic import of the shared records module", () => {
  assert.match(script, /import\(new URL\("assets\/js\/features\/records\.js", site\)\.href\)\.catch\(\(\) => null\)/);
});

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
    assert.equal(video.playCalled, undefined);
    assert.equal(video.focused, true);
    section.open = false;
    section.trigger("toggle");
    assert.equal(row.classList.contains("v1-open"), false);
    assert.equal(video.removed, true);
    assert.equal(video.src, undefined);
  }
});

test("published playback restores saved position and rate, saves on pause, and never autoplays", async () => {
  const calls = { reads: [], saves: [] };
  const records = {
    async readPlayback(resourceId) {
      calls.reads.push(resourceId);
      return { current_time: 42, playback_rate: 1.25 };
    },
    async savePlayback(resourceId, currentTime, playbackRate) {
      calls.saves.push([resourceId, currentTime, playbackRate]);
    }
  };
  const { controls, row, made } = mount({
    url: "https://example.com/lesson#videos-v1-lesson",
    release: "published",
    records
  });
  const [button] = controls.children;
  button.trigger("click");
  assert.deepEqual(made.map((node) => node.tag), ["button", "video", "span"]);
  const video = row.children.find((child) => child.tag === "video");
  assert.ok(video);
  assert.equal(video.autoplay, undefined);
  assert.equal(video.playCalled, undefined);

  video.trigger("loadedmetadata");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.reads, ["stable-lesson-1"]);
  assert.equal(video.currentTime, 42);
  assert.equal(video.playbackRate, 1.25);
  assert.equal(video.playCalled, undefined);

  video.currentTime = 51;
  video.playbackRate = 1.5;
  video.trigger("timeupdate");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.saves, [["stable-lesson-1", 51, 1.5]]);

  video.currentTime = 60;
  video.trigger("timeupdate");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.saves.length, 1, "timeupdate writes should be throttled to at least five seconds");

  video.currentTime = 61;
  video.trigger("pause");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.saves[1], ["stable-lesson-1", 61, 1.5]);
  assert.equal(video.playCalled, undefined);
});

test("published playback restores when metadata is already ready after src assignment, without a loadedmetadata event", async () => {
  const calls = { reads: [] };
  const records = {
    async readPlayback(resourceId) {
      calls.reads.push(resourceId);
      return { current_time: 84, playback_rate: 1.25 };
    },
    async savePlayback() {}
  };
  assert.ok(
    script.indexOf('video.addEventListener("loadedmetadata", restorePosition') < script.indexOf("video.src = preview"),
    "loadedmetadata must be bound before assigning video.src"
  );
  const { controls, row } = mount({
    url: "https://example.com/lesson",
    release: "published",
    records,
    readyStateOnSrc: 1
  });
  controls.children[0].trigger("click");
  const video = row.children.find((child) => child.tag === "video");
  assert.ok(video);
  assert.equal(video.readyState, 1);
  assert.equal(video.duration, 300);
  assert.equal(video.currentTime, 0);
  assert.equal(video.playCalled, undefined);

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.reads, ["stable-lesson-1"]);
  assert.equal(video.currentTime, 84);
  assert.equal(video.playCalled, undefined);

  video.trigger("loadedmetadata");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.reads, ["stable-lesson-1"], "the saved position must only be restored once");
  assert.equal(video.currentTime, 84);
  assert.equal(video.playCalled, undefined);
});

test("saved positions at or beyond duration are not restored", async () => {
  const records = {
    async readPlayback() { return { current_time: 300, playback_rate: 1 }; },
    async savePlayback() {}
  };
  const { controls, row } = mount({
    url: "https://example.com/lesson",
    release: "published",
    records
  });
  controls.children[0].trigger("click");
  const video = row.children.find((child) => child.tag === "video");
  video.duration = 300;
  video.currentTime = 7;
  video.trigger("loadedmetadata");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(video.currentTime, 7);
  assert.equal(video.playCalled, undefined);
});

test("an unavailable records module does not prevent published playback", async () => {
  const { controls, row } = mount({
    url: "https://example.com/lesson",
    release: "published",
    records: null
  });
  controls.children[0].trigger("click");
  const video = row.children.find((child) => child.tag === "video");
  assert.ok(video);
  video.trigger("loadedmetadata");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(video.src, "https://github.com/example/repo/releases/download/videos-v1/lesson.mp4");
  assert.equal(video.playCalled, undefined);
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
