import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  resolveCanonicalTopicId,
  openQuizChallengeModal,
  enhancePagePracticeCards,
  stemLead,
  bindCodeCopyButtons
} from "../assets/js/shell/system-study.js";

const root = path.resolve(import.meta.dirname, "..");
const readJson = (rel) => JSON.parse(readFileSync(path.join(root, rel), "utf8"));

test("全科 183 个考纲知识点与 36 个课堂复习专题均具备完整统一知识卡，且不含非考纲 JS 条目", () => {
  const topicsDoc = readJson("data/topics.json");
  const cardsDoc = readJson("data/topic-cards.json");
  const cards = cardsDoc.cards || {};

  assert.equal(topicsDoc.topics.some((t) => t.id.startsWith("web.js.")), false);
  assert.equal(Object.keys(cards).length, 219);
  for (const t of topicsDoc.topics) {
    const card = cards[t.id];
    assert.ok(card, `缺少知识点卡 ${t.id}`);
    assert.equal(card.subject_id, t.subject_id, `${t.id} subject_id`);
    assert.equal(typeof card.summary, "string", `${t.id} summary`);
    assert.ok(card.summary.length > 0, `${t.id} summary 不能为空`);
    assert.ok(Array.isArray(card.must_know) && card.must_know.length > 0, `${t.id} must_know 不能为空`);
    assert.ok(card.explain && Array.isArray(card.explain.steps) && card.explain.steps.length > 0, `${t.id} explain.steps 不能为空`);
    assert.ok(Array.isArray(card.pitfalls) && card.pitfalls.length > 0, `${t.id} pitfalls 不能为空`);
    assert.ok(Array.isArray(card.quizzes) && card.quizzes.length > 0, `${t.id} quizzes 不能为空`);
    assert.ok(card.mindmap && typeof card.mindmap.url === "string", `${t.id} mindmap`);
  }
});

test("知识卡的视频秒级片段、字幕轨与速记图路径均真实存在", () => {
  const cardsDoc = readJson("data/topic-cards.json");
  let clipCount = 0;
  for (const card of Object.values(cardsDoc.cards)) {
    if (card.illus) {
      assert.equal(existsSync(path.join(root, card.illus)), true, `${card.id} 速记图不存在: ${card.illus}`);
    }
    for (const clip of card.video_clips || []) {
      clipCount += 1;
      assert.equal(typeof clip.url, "string");
      assert.equal(clip.url.startsWith("/"), false);
      if (clip.poster) {
        assert.equal(existsSync(path.join(root, clip.poster)), true, `${card.id} 视频封面不存在: ${clip.poster}`);
      }
      if (clip.vtt) {
        assert.equal(existsSync(path.join(root, clip.vtt)), true, `${card.id} 字幕不存在: ${clip.vtt}`);
      }
      assert.equal(Number.isFinite(clip.start_sec) && clip.start_sec >= 0, true, `${card.id} start_sec`);
      assert.equal(Number.isFinite(clip.end_sec) && clip.end_sec > clip.start_sec, true, `${card.id} end_sec`);
    }
  }
  assert.ok(clipCount >= 80, `视频秒级片段数量应充足: ${clipCount}`);
});

test("课堂复习节点可正确映射回科目标准知识点 ID", () => {
  const topicsDoc = readJson("data/topics.json");
  const cardsDoc = readJson("data/topic-cards.json");
  const fakeModel = {
    topicById: new Map(topicsDoc.topics.map((t) => [t.id, t])),
    site: topicsDoc,
    topicsOfSubject: (sid) => topicsDoc.topics.filter((t) => t.subject_id === sid)
  };
  assert.equal(resolveCanonicalTopicId(cardsDoc.cards["math.domain"], fakeModel), "math.domain");
  const ripId = resolveCanonicalTopicId(cardsDoc.cards["review:n11-rip-distance-vector"], fakeModel);
  assert.equal(fakeModel.topicById.has(ripId), true);
});

test("高数与网络知识卡包含提纯后的直观理解、课堂真题与四选一自测，且闯关与题内判分接口导出完整", () => {
  const cardsDoc = readJson("data/topic-cards.json");
  const dom = cardsDoc.cards["math.domain"];
  assert.ok(dom.explain.intuition.includes("加工机器"), "高数定义域应包含直观通俗解释");
  assert.ok(dom.must_know[0].includes("1/□"), "分式符号 1/□ 应完整保留");
  assert.equal(dom.quizzes[0].type, "single_choice");
  assert.equal(dom.quizzes[0].options.length, 4);

  const fl = cardsDoc.cards["math.function_limit"];
  assert.equal(fl.quizzes[0].type, "single_choice");
  assert.ok(fl.quizzes[0].hint.length > 0, "真题自测应带第一眼破题提示");

  assert.equal(typeof openQuizChallengeModal, "function");
  assert.equal(typeof enhancePagePracticeCards, "function");
});

test("C 语言第 1–9 章 27 节讲义锚点、遮挡填空、矢量导图与随堂选择题完整入库", () => {
  const cardsDoc = readJson("data/topic-cards.json");
  const cHtml = readFileSync(path.join(root, "c/notes.html"), "utf8");
  const cPoints = Object.values(cardsDoc.cards).filter((c) => c.id.startsWith("c.ch"));
  assert.equal(cPoints.length, 27);
  assert.match(cHtml, /id="overview"/);
  for (let i = 1; i <= 27; i++) {
    assert.match(cHtml, new RegExp(`id="point-${i}"`), `c/notes.html 缺少 #point-${i}`);
  }
  assert.equal(cHtml.includes("[["), false, "c/notes.html 不应残留未解析的 [[ 标记");
  assert.equal(cHtml.includes("]]"), false, "c/notes.html 不应残留未解析的 ]] 标记");
  assert.equal((cHtml.match(/<svg\s/g) || []).length, 3, "c/notes.html 应内嵌 3 张矢量思维导图");
  assert.ok((cHtml.match(/class="sys-cloze is-revealed"/g) || []).length >= 500, "讲义填空遮挡芯片应完整覆盖");
  assert.ok((cHtml.match(/class="c-copy-btn"/g) || []).length >= 10, "C 代码示例应配备一键复制按钮");
  assert.ok((cHtml.match(/class="c-stem-code"/g) || []).length >= 6, "多行代码题干应保留缩进独立成代码块");
  assert.ok((cHtml.match(/class="c-ov-card"/g) || []).length === 9, "总览页应展示全部 9 章直达卡片");
  assert.ok((cHtml.match(/class="ck"/g) || []).length >= 50, "C 代码块应启用语法着色");
  assert.equal(stemLead("首行题干\nint a = 1;"), "首行题干");
  assert.equal(typeof bindCodeCopyButtons, "function");
  for (const cp of cPoints) {
    assert.equal(cp.quizzes.length, 2, `${cp.id} 应含 2 道四选一随堂题`);
    assert.equal(cp.quizzes[0].type, "single_choice");
    assert.equal(cp.quizzes[0].options.length, 4, `${cp.id} 第 1 题应含 4 个选项`);
    assert.equal(cp.quizzes[1].options.length, 4, `${cp.id} 第 2 题应含 4 个选项`);
  }
});
