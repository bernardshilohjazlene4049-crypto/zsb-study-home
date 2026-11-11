// 学习总览数据源：读取 /study 的同一 IndexedDB（zsb-study），不另建数据库。
import { ensureSchema, getAll } from "./core/storage.js";
import { buildOverviewSnapshot } from "./features/page-attempts.js";

async function json(path) {
  const res = await fetch(new URL(path, import.meta.url));
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

window.ZSBStudyAdapter = {
  async getSnapshot() {
    const schema = await ensureSchema();
    if (!schema.ok) throw new Error(schema.message || "本机数据库不可用");
    const [attempts, mistakes, registry, subjects] = await Promise.all([
      getAll("attempts"),
      getAll("mistake_entries"),
      json("../../data/page-questions.json"),
      json("../../data/subjects.json")
    ]);
    return buildOverviewSnapshot({
      attempts,
      mistakes,
      registry,
      subjects: Array.isArray(subjects) ? subjects : subjects.subjects || [],
      base: "../"
    });
  }
};
