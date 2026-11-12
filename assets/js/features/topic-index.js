// 正文题与知识点 id 的对应，以及不得进入目录 / 先修 / 复习 / 错题汇总的存疑题。
// 纯函数，浏览器与 node 测试共用。

const SAFE = /[^0-9A-Za-z_.\-]/g;

// 第四、五章存疑题：36-7、38-2、46-5、补-5（补-5 规范化后可能是 -5）。
// 第一章的补-5（page:gs1:…）不在此列。
export const EXCLUDED_QUESTION_IDS = Object.freeze([
  "page:gs45:36-7",
  "page:gs45:38-2",
  "page:gs45:46-5",
  "page:gs45:补-5",
  "page:gs45:-5"
]);

const EXCLUDED = new Set(EXCLUDED_QUESTION_IDS);

const YY5_TOPIC = Object.freeze({
  4: "english.attributive.basics",
  5: "english.noun.basics",
  6: "english.adverbial.basics",
  7: "english.agreement.basics",
  8: "english.special.basics"
});

const GS1_TOPIC = Object.freeze({
  1: "math.domain",
  2: "math.function_properties",
  3: "math.sequence_limit",
  4: "math.function_limit",
  5: "math.infinitesimal",
  6: "math.equivalent",
  7: "math.important_limits",
  8: "math.asymptote",
  9: "math.continuity",
  10: "math.discontinuity",
  11: "math.continuous_properties"
});

export function sanitizeItemKey(itemKey) {
  return String(itemKey || "").replace(SAFE, "-");
}

export function isExcludedQuestionId(questionId) {
  const id = String(questionId || "");
  if (EXCLUDED.has(id)) return true;
  // 兼容尚未规范化或其它分隔符的写法
  return /^page:gs45:(36-7|38-2|46-5|补-5|-5)$/.test(id);
}

export function topicIdsForQuestionId(questionId) {
  const id = String(questionId || "");
  if (!id || isExcludedQuestionId(id)) return [];
  let m = /^page:yy5:(\d+)-/.exec(id);
  if (m && YY5_TOPIC[m[1]]) return [YY5_TOPIC[m[1]]];
  m = /^page:gs45:(\d+)-/.exec(id);
  if (m) return [`math.p${m[1]}`];
  m = /^page:gs1:(\d+)-/.exec(id);
  if (m && GS1_TOPIC[m[1]]) return [GS1_TOPIC[m[1]]];
  if (id.startsWith("page:wy-html-quiz:")) return ["web.html.quiz"];
  return [];
}

export function enrichTopicIds(record) {
  if (!record) return record;
  const questionId = record.question_id || record.questionId;
  const excluded = isExcludedQuestionId(questionId);
  const existing = Array.isArray(record.topic_ids) ? record.topic_ids.filter(Boolean) : [];
  const topic_ids = existing.length ? existing : topicIdsForQuestionId(questionId);
  if (excluded === Boolean(record.excluded) && arraysEqual(topic_ids, record.topic_ids || [])) return record;
  return { ...record, topic_ids, excluded };
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function mergePrereqIds(topics = [], edges = []) {
  const fromEdges = new Map();
  for (const edge of edges) {
    if (!edge?.topicId || !edge?.prerequisiteId) continue;
    const list = fromEdges.get(edge.topicId) || [];
    if (!list.includes(edge.prerequisiteId)) list.push(edge.prerequisiteId);
    fromEdges.set(edge.topicId, list);
  }
  const merged = new Map();
  for (const topic of topics) {
    const ids = [];
    for (const id of [...(fromEdges.get(topic.id) || []), ...(topic.prereq_ids || [])]) {
      if (id && !ids.includes(id)) ids.push(id);
    }
    merged.set(topic.id, ids);
  }
  return merged;
}
