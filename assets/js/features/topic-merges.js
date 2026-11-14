// 只在内存中合并旧知识点；不覆盖或删除持久化记录。
export function resolveTopicId(id, merged = {}) {
  const seen = new Set();
  while (merged[id] && !seen.has(id)) { seen.add(id); id = merged[id]; }
  return id;
}

export function mapLearningTopics(learning, merged = {}) {
  const mapRecord = (record) => ({
    ...record,
    ...(record.topic_ids ? { topic_ids: [...new Set(record.topic_ids.map((id) => resolveTopicId(id, merged)))] } : {}),
    ...(record.topic_id ? { topic_id: resolveTopicId(record.topic_id, merged) } : {})
  });
  const result = { ...learning };
  for (const key of ["attempts", "mistakes", "notes", "marks", "reviews"]) {
    if (learning[key]) result[key] = learning[key].map(mapRecord);
  }
  // 多条进度取最新状态，保留全部证据和累计独立答对次数；不受数据库遍历顺序影响。
  const progress = new Map();
  for (const original of learning.progress || []) {
    const next = mapRecord(original);
    const prev = progress.get(next.topic_id);
    if (!prev) { progress.set(next.topic_id, next); continue; }
    const latest = String(prev.updated_at || "") > String(next.updated_at || "") ? prev : next;
    progress.set(next.topic_id, {
      ...latest,
      evidence_attempt_ids: [...new Set([...(prev.evidence_attempt_ids || []), ...(next.evidence_attempt_ids || [])])],
      independent_correct_count: (prev.independent_correct_count || 0) + (next.independent_correct_count || 0)
    });
  }
  result.progress = [...progress.values()];
  return result;
}
