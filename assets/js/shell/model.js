// 外壳共用的数据层：目录（subjects / topics / dependencies）+ 本机学习记录（IndexedDB zsb-study，只读）。
// 进度与状态只来自本机记录；没有记录时一律返回空，不生成任何示例数字。
import { mapLearningTopics, resolveTopicId } from "../features/topic-merges.js";
import { getAll } from "../core/storage.js";
import { withResolvedTopics } from "../features/records.js";
import { isExcludedQuestionId, topicIdsForQuestionId } from "../features/topic-index.js";
import { isMistakeRecord } from "../features/mistake-rules.js";

const ROOT = new URL("../../../", import.meta.url);
// 已由高数助手逐条核对过的先修边所属科目；其它科目的边仍是草稿。
export const REVIEWED_EDGE_SUBJECTS = Object.freeze(["math"]);

let sitePromise = null;
let learningPromise = null;

async function readJson(path) {
  const res = await fetch(new URL(path, ROOT));
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

export function siteHref(path, base) {
  if (!path) return "";
  return `${base || ""}${String(path).replace(/^\/+/, "")}`;
}

export function loadSite() {
  if (!sitePromise) {
    sitePromise = Promise.all([
      readJson("data/subjects.json"),
      readJson("data/topics.json"),
      readJson("data/dependencies.json"),
      readJson("data/page-questions.json").catch(() => ({ subjects: [] })),
      readJson("data/resources.json")
    ]).then(([subjectsDoc, topicsDoc, depsDoc, registry, resourcesDoc]) => ({
      subjects: [...(subjectsDoc.subjects || [])].sort((a, b) => a.order - b.order),
      chapters: [...(topicsDoc.chapters || [])],
      topics: [...(topicsDoc.topics || [])],
      merged_topics: { ...(topicsDoc.merged_topics || {}) },
      edges: [...(depsDoc.edges || [])],
      resources: [...(resourcesDoc.resources || [])],
      registry
    }));
  }
  return sitePromise;
}

function realRecord(r) {
  return r && r.counts_toward_real_stats !== false && r.provenance?.kind !== "sample" && !r.deleted_at;
}

export function loadLearning() {
  if (!learningPromise) {
    learningPromise = (async () => {
      try {
        if (!("indexedDB" in globalThis)) throw new Error("no-idb");
        const [attempts, mistakes, progress] = await Promise.all([
          getAll("attempts"), getAll("mistake_entries"), getAll("user_topic_progress")
        ]);
        const site = await loadSite();
        const resolved = withResolvedTopics({ attempts, mistakes, progress }, site.merged_topics);
        return {
          ok: true,
          attempts: resolved.attempts.filter((a) => realRecord(a) && !isExcludedQuestionId(a.question_id)),
          mistakes: resolved.mistakes.filter((m) => realRecord(m) && !isExcludedQuestionId(m.question_id)),
          progress: resolved.progress.filter((p) => p.counts_toward_real_stats !== false)
        };
      } catch (error) {
        return { ok: false, attempts: [], mistakes: [], progress: [], error };
      }
    })();
  }
  return learningPromise;
}

function endOfToday(now) {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

const CN_NUM = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
export function cnNumber(n) {
  if (n <= 10) return CN_NUM[n];
  if (n < 20) return "十" + CN_NUM[n - 10];
  const t = Math.floor(n / 10), r = n % 10;
  return CN_NUM[t] + "十" + (r ? CN_NUM[r] : "");
}

export function buildModel(site, learning, now = Date.now()) {
  learning = mapLearningTopics(learning, site.merged_topics);
  const topicById = new Map(site.topics.map((t) => [t.id, t]));
  const chapterById = new Map(site.chapters.map((c) => [c.id, c]));
  const subjectById = new Map(site.subjects.map((s) => [s.id, s]));
  const topLevel = (chapterId) => {
    let c = chapterById.get(chapterId);
    while (c && c.parent_id) c = chapterById.get(c.parent_id);
    return c || null;
  };

  // 科目 → 章（顶层）→ 节 → 知识点，按 order 排序。
  const subjectTree = new Map();
  for (const s of site.subjects) subjectTree.set(s.id, []);
  const chapterNodes = new Map();
  for (const c of [...site.chapters].sort((a, b) => a.order - b.order)) {
    if (c.parent_id) continue;
    const node = { chapter: c, sections: [], topics: [] };
    chapterNodes.set(c.id, node);
    if (!subjectTree.has(c.subject_id)) subjectTree.set(c.subject_id, []);
    subjectTree.get(c.subject_id).push(node);
  }
  const sectionNodes = new Map();
  for (const c of [...site.chapters].sort((a, b) => a.order - b.order)) {
    if (!c.parent_id) continue;
    const parent = chapterNodes.get(topLevel(c.id)?.id);
    if (!parent) continue;
    const node = { chapter: c, topics: [] };
    sectionNodes.set(c.id, node);
    parent.sections.push(node);
  }
  for (const t of [...site.topics].sort((a, b) => a.order - b.order)) {
    const top = chapterNodes.get(topLevel(t.chapter_id)?.id);
    if (!top) continue;
    top.topics.push(t);
    const sec = sectionNodes.get(t.chapter_id);
    if (sec) sec.topics.push(t);
  }
  // 章节内顺序：先按节，再按 order。
  for (const node of chapterNodes.values()) {
    if (node.sections.length) node.topics = node.sections.flatMap((s) => s.topics).concat(node.topics.filter((t) => !sectionNodes.has(t.chapter_id)));
  }

  // 先修边（去重），按边的科目判断是否已核对。
  const prereqMap = new Map();
  const succMap = new Map();
  const seen = new Set();
  const pushEdge = (topicId, prereqId, strength) => {
    const key = `${topicId}<${prereqId}`;
    if (seen.has(key) || !topicById.has(topicId) || !topicById.has(prereqId)) return;
    seen.add(key);
    const subject = topicById.get(topicId).subject_id;
    const edge = { topicId, prereqId, strength: strength === "hard" ? "hard" : "soft", reviewed: REVIEWED_EDGE_SUBJECTS.includes(subject) };
    (prereqMap.get(topicId) || prereqMap.set(topicId, []).get(topicId)).push(edge);
    (succMap.get(prereqId) || succMap.set(prereqId, []).get(prereqId)).push(edge);
  };
  for (const e of site.edges) pushEdge(e.topicId, e.prerequisiteId, e.strength);
  for (const t of site.topics) for (const p of t.prereq_ids || []) pushEdge(t.id, p, "soft");

  // 题目总数（正文题登记表），按知识点。
  const questionTotals = new Map();
  for (const group of site.registry?.subjects || []) {
    for (const q of group.questions || []) {
      if (isExcludedQuestionId(q)) continue;
      for (const oldId of topicIdsForQuestionId(q)) {
        const id = resolveTopicId(oldId, site.merged_topics);
        questionTotals.set(id, (questionTotals.get(id) || 0) + 1);
      }
    }
  }

  const statsByTopic = new Map();
  const stat = (id) => {
    if (!statsByTopic.has(id)) statsByTopic.set(id, { attempts: 0, questions: new Map(), mistakes: [], reviews: [], due: [], progress: null, last: "" });
    return statsByTopic.get(id);
  };
  const today = endOfToday(now);
  for (const a of learning.attempts) {
    for (const id of a.topic_ids || []) {
      const s = stat(id);
      s.attempts += 1;
      const prev = s.questions.get(a.question_id);
      if (!prev || String(prev.submitted_at) < String(a.submitted_at)) s.questions.set(a.question_id, a);
      if (String(a.submitted_at) > s.last) s.last = String(a.submitted_at);
    }
  }
  for (const m of learning.mistakes) {
    if (m.status && m.status !== "active") continue;
    for (const id of m.topic_ids || []) {
      const s = stat(id);
      s.reviews.push(m);
      if (isMistakeRecord(m)) s.mistakes.push(m);
      const due = m.next_review_at ? new Date(m.next_review_at).getTime() : NaN;
      if (Number.isFinite(due) && due <= today) s.due.push(m);
    }
  }
  for (const p of learning.progress) {
    if (!p.topic_id) continue;
    const s = stat(p.topic_id);
    if (!s.progress || String(p.updated_at || "") >= String(s.progress.updated_at || "")) s.progress = p;
    if (String(p.updated_at || "") > s.last) s.last = String(p.updated_at || "");
  }

  function topicStats(id) {
    const s = statsByTopic.get(id);
    const total = questionTotals.get(id) || 0;
    if (!s) return { touched: false, attempts: 0, correct: 0, answered: 0, total, mistakes: 0, reviews: 0, due: 0, mastery: "", nextReview: null };
    const latest = [...s.questions.values()];
    const nextReview = s.reviews.map((m) => m.next_review_at).filter(Boolean).sort()[0] || null;
    return {
      touched: s.attempts > 0 || Boolean(s.progress),
      attempts: s.attempts,
      answered: latest.length,
      correct: latest.filter((a) => a.grading?.status === "correct").length,
      total,
      mistakes: s.mistakes.length,
      reviews: s.reviews.length,
      due: s.due.length,
      mastery: s.progress?.mastery_state || "",
      nextReview,
      last: s.last
    };
  }

  // 节点状态：mastered 已掌握 / due 不稳或到期 / learning 学习中 / none 未学（无记录）
  function topicStatus(id) {
    const s = topicStats(id);
    if (!s.touched && !s.reviews) return "none";
    if (s.due || s.mastery === "needs_review") return "due";
    if (s.mastery === "independent_once" && !s.mistakes) return "mastered";
    return "learning";
  }

  function progressOf(topics) {
    const total = topics.length;
    const done = topics.filter((t) => topicStatus(t.id) !== "none").length;
    const mastered = topics.filter((t) => topicStatus(t.id) === "mastered").length;
    return { total, done, mastered, pct: total ? Math.round((done / total) * 100) : 0, hasRecords: done > 0 };
  }

  const hasRecords = learning.attempts.length > 0 || learning.progress.length > 0 || learning.mistakes.length > 0;

  function dueTopics() {
    const rows = [];
    for (const [id, s] of statsByTopic) {
      const t = topicById.get(id);
      if (!t || !s.due.length) continue;
      rows.push({ topic: t, count: s.due.length, subject: subjectById.get(t.subject_id), chapter: topLevel(t.chapter_id), at: s.due.map((m) => m.next_review_at).sort()[0] });
    }
    return rows.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  }

  function weakTopics() {
    const rows = [];
    for (const [id, s] of statsByTopic) {
      const t = topicById.get(id);
      if (!t || !s.mistakes.length) continue;
      rows.push({ topic: t, count: s.mistakes.length, subject: subjectById.get(t.subject_id), chapter: topLevel(t.chapter_id) });
    }
    return rows.sort((a, b) => b.count - a.count);
  }

  function continueItem() {
    let best = null;
    for (const [id, s] of statsByTopic) {
      const t = topicById.get(id);
      if (!t || !s.last) continue;
      if (!best || s.last > best.last) best = { topic: t, last: s.last };
    }
    if (!best) return null;
    const chapter = topLevel(best.topic.chapter_id);
    const node = chapter ? chapterNodes.get(chapter.id) : null;
    return { topic: best.topic, subject: subjectById.get(best.topic.subject_id), chapter, progress: node ? progressOf(node.topics) : null };
  }

  return {
    site, learning, hasRecords, dbOk: learning.ok,
    subjects: site.subjects,
    topicById, chapterById, subjectById,
    topLevel,
    chaptersOf: (subjectId) => subjectTree.get(subjectId) || [],
    chapterNode: (id) => chapterNodes.get(id) || null,
    sectionOf: (topic) => sectionNodes.get(topic.chapter_id)?.chapter || null,
    topicsOfSubject: (subjectId) => (subjectTree.get(subjectId) || []).flatMap((n) => n.topics),
    prereqs: (id) => (prereqMap.get(id) || []).map((e) => ({ ...e, topic: topicById.get(e.prereqId) })),
    successors: (id) => (succMap.get(id) || []).map((e) => ({ ...e, topic: topicById.get(e.topicId) })),
    topicStats, topicStatus, progressOf,
    subjectProgress: (subjectId) => progressOf((subjectTree.get(subjectId) || []).flatMap((n) => n.topics)),
    dueTopics, weakTopics, continueItem
  };
}

export async function loadModel() {
  const [site, learning] = await Promise.all([loadSite(), loadLearning()]);
  return buildModel(site, learning);
}

// 知识点在站内的落点（讲义锚点）。非 html 的来源（例如题库 json）不生成链接。
export function topicHref(topic, base) {
  const url = topic?.legacy_url || topic?.source_ref || "";
  if (!/\.html(#|$)/.test(url)) return "";
  return siteHref(url, base);
}

export function pagePath(url) {
  return String(url || "").split("#")[0];
}

export function anchorOf(url) {
  const i = String(url || "").indexOf("#");
  return i === -1 ? "" : String(url).slice(i + 1);
}
