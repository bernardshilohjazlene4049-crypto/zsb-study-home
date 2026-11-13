// 指挥塔的只读投影。计数复用 shell/model.js 的状态、进度、到期与错题口径。
export const TOWER_FLOORS = Object.freeze([
  { no: "07F", ids: [], name: "学习总控", icon: "layers", overview: true },
  { no: "06F", ids: ["english", "math"], icon: "book" },
  { no: "05F", ids: ["computer_basics"], icon: "monitor" },
  { no: "04F", ids: ["c_language"], icon: "code" },
  { no: "03F", ids: ["database"], icon: "db" },
  { no: "02F", ids: ["web_design"], icon: "web" },
  { no: "01F", ids: ["network"], icon: "network" }
]);

const shortName = (subject) => subject.name.replace(/（.*?）/g, "");
const empty = () => ({ hasRecords: false, total: null, mastered: null, learning: null, done: null, pct: null, due: null, mistakes: null, next: null });

export function buildTowerStats(model) {
  const subjects = model.subjects.filter((s) => s.enabled !== false);
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const due = model.dueTopics(); // 已按本地当天结束时间过滤；每行代表一个到期知识点。
  const weak = model.weakTopics();
  const continuation = model.continueItem();
  const allTopics = model.site.topics;

  function subjectStats(subject) {
    const open = subject.status === "live";
    const base = { id: subject.id, name: shortName(subject), open, homeUrl: open ? subject.homeUrl : null };
    if (!open) return { ...base, ...empty(), state: "即将开放" };
    const topics = allTopics.filter((t) => t.subject_id === subject.id);
    const states = topics.map((t) => model.topicStatus(t.id));
    const done = states.filter((s) => s !== "none").length;
    const hasRecords = done > 0;
    const continued = topics.find((t) => t.id === continuation?.topic?.id);
    return {
      ...base, hasRecords, total: topics.length, done,
      mastered: states.filter((s) => s === "mastered").length,
      learning: states.filter((s) => s === "learning" || s === "due").length,
      pct: hasRecords ? model.subjectProgress(subject.id).pct : null,
      due: due.filter((row) => row.topic.subject_id === subject.id).length,
      mistakes: weak.filter((row) => row.topic.subject_id === subject.id).reduce((sum, row) => sum + row.count, 0),
      next: continued || topics.find((t) => model.topicStatus(t.id) === "none") || null,
      state: hasRecords ? "学习中" : "未开始"
    };
  }

  const entries = new Map(subjects.map((s) => [s.id, subjectStats(s)]));
  function combine(items) {
    const live = items.filter((s) => s.open);
    if (!live.length) return { ...empty(), open: false, state: "即将开放" };
    const sum = (key) => live.reduce((n, s) => n + s[key], 0);
    const total = sum("total"), done = sum("done");
    const hasRecords = live.some((s) => s.hasRecords);
    return {
      open: true, hasRecords, total, done, mastered: sum("mastered"), learning: sum("learning"),
      pct: hasRecords ? (total ? Math.round(done / total * 100) : 0) : null,
      due: sum("due"), mistakes: sum("mistakes"),
      next: live.find((s) => s.next?.id === continuation?.topic?.id)?.next || live.find((s) => s.next)?.next || null,
      state: hasRecords ? "学习中" : "未开始"
    };
  }

  const floors = TOWER_FLOORS.map((visual) => {
    const items = visual.overview
      ? [...entries.values()].filter((s) => s.open)
      : visual.ids.map((id) => entries.get(id)).filter(Boolean);
    const stats = !visual.overview && items.length === 1 ? items[0] : combine(items);
    const name = visual.name || visual.ids.map((id) => byId.get(id)).filter(Boolean).map(shortName).join(" / ");
    const floor = { ...stats, ...visual, name, subjects: items };
    if (visual.overview) {
      const liveIds = new Set(items.map((s) => s.id));
      floor.homeUrl = "study/index.html";
      const continued = continuation?.topic;
      floor.next = (continued && liveIds.has(continued.subject_id) ? allTopics.find((t) => t.id === continued.id) : null)
        || due.find((row) => liveIds.has(row.topic.subject_id))?.topic || null;
    }
    return floor;
  });
  // 07F 是汇总，不重复算作一个有记录楼层；06F 任一科有记录计一层。
  return { floors, activeFloors: floors.filter((f) => !f.overview && f.hasRecords).length, floorCount: floors.length };
}
