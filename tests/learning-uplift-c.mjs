import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

function section(html, marker) {
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `Missing section marker: ${marker}`);
  const end = html.indexOf("</section>", start);
  assert.notEqual(end, -1, `Unclosed section: ${marker}`);
  return html.slice(start, end + "</section>".length);
}

test("calculus subject gallery links each first-chapter video to its first relevant point", () => {
  const html = read("gs/index.html");
  const first = section(html, 'aria-labelledby="video-one-title"');
  const expected = [
    ["gs1.html#point-1", "函数：定义域与基本性质"],
    ["gs1.html#point-3", "极限基础：存在条件、未定式、抓大头与化简"],
    ["gs1.html#point-5", "无穷小、无穷大与等价替换"],
    ["gs1.html#point-7", "两个重要极限、洛必达衔接与渐近线"],
    ["gs1.html#point-9", "连续：定义、间断点与连续函数性质"]
  ];
  assert.equal((first.match(/<a class="content-card video-card"/g) || []).length, 5);
  assert.doesNotMatch(first, /<video\b|data-video-src=/);
  for (const [href, title] of expected) {
    assert.ok(first.includes(`href="${href}"`), `Missing gallery link ${href}`);
    assert.ok(first.includes(title), `Missing title ${title}`);
  }
});

test("calculus chapters 4–5 gallery links to the first matching point and keeps chapter players", () => {
  const html = read("gs/index.html");
  const gallery = section(html, 'aria-labelledby="video-fortyfive-title"');
  const lecture = read("gs/gs45.html");
  const expected = [
    ["gs45.html#point-37", "平面与直线", "point-37"],
    ["gs45.html#point-40", "偏导与全微分", "point-40"],
    ["gs45.html#point-43", "极值", "point-43"],
    ["gs45.html#point-47", "二重积分", "point-47"]
  ];
  assert.equal((gallery.match(/<a class="content-card video-card"/g) || []).length, 4);
  assert.doesNotMatch(gallery, /<video\b|data-video-src=/);
  for (const [href, title, anchor] of expected) {
    assert.ok(gallery.includes(`href="${href}"`), `Missing gallery link ${href}`);
    assert.ok(gallery.includes(title), `Missing title ${title}`);
    assert.ok(lecture.includes(`id="${anchor}"`), `Target anchor ${anchor} is missing`);
  }
  for (const id of ["video-plane-line", "video-partial-dz", "video-extremum", "video-double-integral"]) {
    assert.ok(lecture.includes(`id="${id}"`), `Chapter player #${id} must remain available`);
  }
});

test("English episodes 5–6 link to their yy5 topics while episodes 1–4 remain playable", () => {
  const html = read("yy/index.html");
  const gallery = section(html, 'id="yyvideos"');
  const yy5 = read("yy/yy5.html");
  const cards = read("data/topic-cards.json");
  assert.equal((gallery.match(/<video\b/g) || []).length, 4, "Episodes 1–4 should retain their subject-page players");
  assert.ok(gallery.includes('href="yy5.html#topic-5"'), "Episode 5 should link to the noun-clause topic");
  assert.ok(gallery.includes('href="yy5.html#topic-6"'), "Episode 6 should link to the adverbial-clause topic");
  assert.doesNotMatch(gallery, /src="videos\/(?:5|6)\.mp4/);
  assert.ok(yy5.includes('id="topic-5"'));
  assert.ok(yy5.includes('id="topic-6"'));

  const topicCards = JSON.parse(cards).cards;
  assert.equal(topicCards["english.noun.basics"].url, "yy/yy5.html#topic-5");
  assert.equal(topicCards["english.adverbial.basics"].url, "yy/yy5.html#topic-6");
  assert.match(cards, /"url": "yy\/videos\/5\.mp4"/);
  assert.match(cards, /"url": "yy\/videos\/6\.mp4"/);
});

test("computer-basics Excel topic entry points retain all seven subject-page players", () => {
  const html = read("jsj/index.html");
  const gallery = section(html, 'id="videos"');
  assert.equal((gallery.match(/<video\b/g) || []).length, 7);
  for (const id of ["video-4-1", "video-4-2", "video-4-3", "video-4-4", "video-4-5", "video-4-6", "video-4-7"]) {
    assert.ok(gallery.includes(`id="${id}"`), `Excel player ${id} must remain available`);
  }
});
