import { SCHEMA_VERSION } from "./schema.js";
import { clearAllStores, dumpStores, getAll, put } from "./storage.js";
import { mergeMistake } from "../features/mistake-rules.js";

export function validateBundle(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("备份不是 JSON 对象。");
  }
  if (typeof data.schema_version !== "number") {
    throw new Error("备份缺少 schema_version，已拒绝导入。");
  }
  if (data.schema_version > SCHEMA_VERSION) {
    throw new Error("备份来自更新的数据版本，当前页面不能安全导入。");
  }
  if (!data.stores || typeof data.stores !== "object") {
    throw new Error("备份缺少 stores。");
  }
  return true;
}

export function partitionById(existingIds, records) {
  const seen = new Set(existingIds);
  const accept = [];
  const skip = [];
  for (const record of records || []) {
    if (!record || typeof record !== "object" || !record.id) {
      skip.push({ reason: "missing_id" });
      continue;
    }
    if (seen.has(record.id)) {
      skip.push({ id: record.id, reason: "duplicate" });
      continue;
    }
    seen.add(record.id);
    accept.push(record);
  }
  return { accept, skip };
}

function newer(a, b) {
  return String(a || "") >= String(b || "") ? a : b;
}

export async function exportBundle() {
  const stores = await dumpStores();
  return {
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    app: "zsb-study",
    learner_id: "local-guest",
    stores
  };
}

export async function importBundle(data) {
  validateBundle(data);
  const report = { added: {}, skipped: {}, mergedMistakes: 0 };
  const incoming = data.stores || {};

  const simpleStores = ["attempts", "review_events", "note_entries", "imported_questions"];
  for (const name of simpleStores) {
    const existing = await getAll(name);
    const { accept, skip } = partitionById(existing.map((item) => item.id), incoming[name] || []);
    for (const record of accept) await put(name, record);
    report.added[name] = accept.length;
    report.skipped[name] = skip.length;
  }

  const existingMistakes = await getAll("mistake_entries");
  const byPair = new Map(existingMistakes.map((item) => [`${item.learner_id}::${item.question_id}`, item]));
  const seenIds = new Set(existingMistakes.map((item) => item.id));
  let merged = 0;
  let addedMistakes = 0;
  let skippedMistakes = 0;
  for (const record of incoming.mistake_entries || []) {
    if (!record?.id || !record.question_id || !record.learner_id) {
      skippedMistakes += 1;
      continue;
    }
    const pairKey = `${record.learner_id}::${record.question_id}`;
    const pair = byPair.get(pairKey);
    if (pair) {
      if (pair.deleted_at && !record.deleted_at) {
        skippedMistakes += 1;
        continue;
      }
      const next = mergeMistake(pair, record);
      await put("mistake_entries", next);
      byPair.set(pairKey, next);
      seenIds.add(record.id);
      merged += 1;
      continue;
    }
    if (seenIds.has(record.id)) {
      skippedMistakes += 1;
      continue;
    }
    await put("mistake_entries", record);
    byPair.set(pairKey, record);
    seenIds.add(record.id);
    addedMistakes += 1;
  }
  report.added.mistake_entries = addedMistakes;
  report.skipped.mistake_entries = skippedMistakes;
  report.mergedMistakes = merged;

  const progressExisting = await getAll("user_topic_progress");
  const progressIds = new Set(progressExisting.map((item) => item.id));
  let progressAdded = 0;
  let progressSkipped = 0;
  for (const record of incoming.user_topic_progress || []) {
    if (!record?.id) {
      progressSkipped += 1;
      continue;
    }
    const current = progressExisting.find((item) => item.id === record.id);
    if (!current) {
      if (progressIds.has(record.id)) {
        progressSkipped += 1;
        continue;
      }
      await put("user_topic_progress", record);
      progressIds.add(record.id);
      progressAdded += 1;
      continue;
    }
    const evidence = [...new Set([...(current.evidence_attempt_ids || []), ...(record.evidence_attempt_ids || [])])];
    const keepCurrent = newer(current.updated_at, record.updated_at) === current.updated_at;
    const base = keepCurrent ? current : record;
    await put("user_topic_progress", {
      ...base,
      id: current.id,
      created_at: current.created_at || record.created_at,
      evidence_attempt_ids: evidence,
      independent_correct_count: Math.max(current.independent_correct_count || 0, record.independent_correct_count || 0)
    });
    progressSkipped += 1;
  }
  report.added.user_topic_progress = progressAdded;
  report.skipped.user_topic_progress = progressSkipped;

  for (const name of ["drafts", "playback", "marks"]) {
    const existing = await getAll(name);
    const map = new Map(existing.map((item) => [item.id, item]));
    let addCount = 0;
    let skipCount = 0;
    for (const record of incoming[name] || []) {
      if (!record?.id) {
        skipCount += 1;
        continue;
      }
      const current = map.get(record.id);
      if (!current) {
        await put(name, record);
        map.set(record.id, record);
        addCount += 1;
        continue;
      }
      const winner = newer(current.updated_at, record.updated_at) === record.updated_at ? record : current;
      if (winner !== current) await put(name, winner);
      skipCount += 1;
    }
    report.added[name] = addCount;
    report.skipped[name] = skipCount;
  }

  return report;
}

export async function wipeLocalLearningData() {
  await clearAllStores();
}
