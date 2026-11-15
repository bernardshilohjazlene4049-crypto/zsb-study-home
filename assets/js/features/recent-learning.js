import { UI_KEYS } from "../core/schema.js";
import { get, put } from "../core/storage.js";

export const RECENT_TOPIC_META_KEY = "recent_topic";
const LEGACY_OPENED_AT = "1970-01-01T00:00:00.000Z";

function localRecentTopic() {
  try {
    const topicId = localStorage.getItem(UI_KEYS.lastTopic) || "";
    if (!topicId) return null;
    return {
      key: RECENT_TOPIC_META_KEY,
      topic_id: topicId,
      opened_at: localStorage.getItem(UI_KEYS.lastTopicAt) || LEGACY_OPENED_AT,
      source: "localStorage"
    };
  } catch {
    return null;
  }
}

function openedTime(record) {
  const value = Date.parse(record?.opened_at || "");
  return Number.isFinite(value) ? value : 0;
}

// 最近学习记录独立于“已掌握/进度”。只打开讲义不应虚增完成率，但应能成为继续学习入口。
export async function readRecentTopic() {
  const local = localRecentTopic();
  let stored = null;
  try {
    stored = await get("meta", RECENT_TOPIC_META_KEY);
  } catch {
    // IndexedDB 不可用时，旧版 localStorage 仍可作为只读回退。
  }
  if (!local) return stored;
  if (!stored || openedTime(local) > openedTime(stored)) {
    const migrated = {
      ...local,
      key: RECENT_TOPIC_META_KEY,
      schema_version: 1,
      source: "localStorage"
    };
    try {
      await put("meta", migrated);
    } catch {
      // 读取回退仍可用，下次打开页面会再尝试同步到 IndexedDB。
    }
    return migrated;
  }
  return stored;
}

export async function saveRecentTopic({ topicId, pageUrl = "", anchor = "", title = "", now = new Date().toISOString() } = {}) {
  if (!topicId) throw new Error("保存最近学习记录需要 topicId。");
  const record = {
    key: RECENT_TOPIC_META_KEY,
    schema_version: 1,
    topic_id: topicId,
    title,
    page_url: pageUrl,
    anchor,
    opened_at: now,
    source: "local"
  };

  // 同步写一份轻量回退，确保页面快速跳转时工作台也能立即读到。
  try {
    localStorage.setItem(UI_KEYS.lastTopic, topicId);
    localStorage.setItem(UI_KEYS.lastTopicAt, now);
  } catch {
    // 是否仍能持久化由 IndexedDB 写入结果决定。
  }
  await put("meta", record);
  return record;
}
