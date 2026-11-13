import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { DB_NAME, DB_VERSION, SCHEMA_VERSION, STORE_DEFS } from "../assets/js/core/schema.js";
import { validateBundle } from "../assets/js/core/backup.js";
import { initialMistake, mergeMistake, scheduleReview } from "../assets/js/features/mistake-rules.js";
import { buildOverviewSnapshot, migrateChoiceMap } from "../assets/js/features/page-attempts.js";
import { withResolvedTopics } from "../assets/js/features/records.js";
import { buildModel } from "../assets/js/shell/model.js";

// 样本均由对应提交的真实页面按钮生成。来源 SHA、操作、原始 localStorage 字符串、
// 浏览器导出的 IDB 结构与记录都在 JSON 内；不把伪造的旧版本/字段当兼容需求。
const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const legacy = readJson("./fixtures/legacy-yy5-4a0f33b.json");
const beforeFsrs = readJson("./fixtures/legacy-idb-66b5078.json");
const beforeShell = readJson("./fixtures/legacy-idb-47c8ab8.json");
const key = "liaoning.yy5.quiz.2026";
const site = {
  ...readJson("../data/subjects.json"),
  ...readJson("../data/topics.json"),
  edges: readJson("../data/dependencies.json").edges,
  registry: readJson("../data/page-questions.json")
};

function schemaDefinition() {
  return Object.fromEntries(Object.entries(STORE_DEFS).map(([name, def]) => [name, {
    keyPath: def.keyPath,
    indexes: (def.indexes || []).map(([name, keyPath, options]) => ({ name, keyPath, unique: options.unique }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }]));
}

for (const fixture of [beforeFsrs, beforeShell]) {
  const ref = fixture.provenance.commit.slice(0, 7);
  test(`${ref}：历史数据库版本、store、索引与当前兼容，旧备份可读取`, () => {
    assert.match(fixture.provenance.commit, /^[0-9a-f]{40}$/);
    assert.ok(fixture.provenance.operations.length);
    assert.equal(fixture.database.name, DB_NAME);
    assert.equal(fixture.database.version, DB_VERSION);
    assert.deepEqual(fixture.database.stores, schemaDefinition());
    const meta = fixture.stores.meta.find((m) => m.key === "schema");
    assert.equal(meta.schema_version, SCHEMA_VERSION);
    assert.equal(validateBundle({ schema_version: meta.schema_version, stores: fixture.stores }), true);
    for (const [name, records] of Object.entries(fixture.stores)) {
      const keyPath = STORE_DEFS[name].keyPath;
      assert.equal(new Set(records.map((r) => r[keyPath])).size, records.length, `${name} has unique keys`);
      for (const row of records) if (row.schema_version !== undefined) assert.equal(row.schema_version, 1);
    }
    const attempts = new Set(fixture.stores.attempts.map((a) => a.id));
    for (const mistake of fixture.stores.mistake_entries) {
      assert.ok(attempts.has(mistake.first_attempt_id));
      assert.ok(attempts.has(mistake.last_attempt_id));
      assert.ok(mistake.attempt_ids.every((id) => attempts.has(id)));
    }
  });

  test(`${ref}：总览读取真实旧记录，补出知识点但不改写样本`, () => {
    const original = structuredClone(fixture);
    const { attempts, mistake_entries: mistakes, user_topic_progress: progress } = fixture.stores;
    const snap = buildOverviewSnapshot({ attempts, mistakes, ...site,
      now: new Date(attempts[0].submitted_at) });
    const migrated = attempts.filter((a) => a.migrated_from);
    assert.equal(snap.hasRecords, true);
    assert.equal(snap.reviews.length, mistakes.length);
    assert.equal(snap.activity.reduce((n, d) => n + d.count, 0), attempts.length - migrated.length);
    assert.equal(snap.subjects.find((s) => s.id === "english").completed, 1);
    assert.ok(snap.topics.some((t) => t.id === "math.p37"));
    assert.ok(snap.topics.some((t) => t.id === "english.attributive.basics"));
    assert.ok(snap.reviews.every((r) => r.topicId && /\.html#/.test(r.url)));
    const lastLive = attempts.filter((a) => !a.migrated_from)
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))[0];
    assert.equal(snap.lastVisited.url, `../${lastLive.page.url}#${lastLive.page.anchor}`);

    const resolved = withResolvedTopics({ attempts, mistakes, progress });
    const model = buildModel(site, { ok: true, ...resolved }, Date.parse(lastLive.submitted_at));
    assert.equal(model.hasRecords, true);
    assert.equal(model.learning.attempts.length, attempts.length);
    assert.equal(model.weakTopics().reduce((n, row) => n + row.count, 0), mistakes.length);
    assert.equal(model.topicStats("math.p37").attempts, attempts.filter((a) => a.subject_id === "math").length);
    assert.equal(model.subjectProgress("english").hasRecords, true);
    assert.equal(model.subjectProgress("math").hasRecords, true);
    assert.ok(model.continueItem());
    assert.deepEqual(fixture, original, "deriving a model must not rewrite historical data");
  });
}

test("4a0f33b：原始选择题字符串迁移成与 66b5078 真实写入相同的幂等 ID", () => {
  assert.equal(legacy.provenance.commit, "4a0f33b6fd9f0052120e3795ebba55ccad2df4f4");
  assert.equal(legacy.database, null, "the old English page did not create IDB");
  const original = structuredClone(legacy);
  const first = migrateChoiceMap(key, JSON.parse(legacy.localStorage[key]), legacy.questions);
  assert.equal(first.length, legacy.questions.length);
  assert.deepEqual(migrateChoiceMap(key, JSON.parse(legacy.localStorage[key]), legacy.questions), first);
  const actual = beforeFsrs.stores.attempts.filter((a) => a.migrated_from === key);
  assert.deepEqual(first.map((p) => p.attemptId).sort(), actual.map((a) => a.id).sort());
  for (const payload of first) {
    const recorded = actual.find((a) => a.id === payload.attemptId);
    assert.deepEqual(payload.response, recorded.response);
    assert.deepEqual(payload.grading, recorded.grading);
    assert.equal(payload.stem, recorded.stem_snapshot);
    assert.deepEqual(payload.page, recorded.page);
  }
  assert.deepEqual(legacy, original);
});

test("66b5078：没有 fsrs、没有知识点的旧错题可以直接按当前 FSRS 排期", () => {
  for (const old of beforeFsrs.stores.mistake_entries) {
    assert.equal(old.interval_rule, "heuristic_1_3_7_14");
    assert.equal(Object.hasOwn(old, "fsrs"), false);
    assert.deepEqual(old.topic_ids, []);
    const attempt = beforeFsrs.stores.attempts.find((a) => a.id === old.last_attempt_id);
    const now = Date.parse(old.next_review_at);
    const next = scheduleReview({ grading: attempt.grading, understanding: attempt.understanding,
      previous: old, previousStep: old.interval_step, now });
    assert.equal(next.rule, "fsrs_5");
    assert.equal(next.fsrs.reps, 1);
    assert.ok(next.fsrs.stability > 0);
    assert.equal(Date.parse(next.next_review_at), now + next.interval_days * 86400000);
    assert.ok(Date.parse(next.next_review_at) > now);
    assert.equal(Object.hasOwn(old, "fsrs"), false);
  }
});

test("66b5078 → 47c8ab8：合并真实后续作答，保留首次档案和全部旧字段", () => {
  const old = beforeFsrs.stores.mistake_entries.find((m) => m.subject_id === "math");
  const actual = beforeShell.stores.mistake_entries.find((m) => m.id === old.id);
  const attempt = beforeShell.stores.attempts.find((a) => a.id === actual.last_attempt_id);
  const now = attempt.submitted_at;
  const schedule = scheduleReview({ grading: attempt.grading, understanding: attempt.understanding,
    previous: old, previousStep: old.interval_step, now: Date.parse(now) });
  const patch = initialMistake(attempt, { entersReview: true, category: null }, schedule, old.id, now);
  const merged = mergeMistake(old, patch);
  // 当前算法应重现历史版本升级时真实产生的档案，而不只验证几个挑选的字段。
  assert.deepEqual(merged, actual);
  const mutable = new Set(["category", "status", "last_attempt_id", "attempt_ids", "next_review_at",
    "interval_step", "interval_rule", "last_reviewed_at", "updated_at", "alias_ids"]);
  for (const [name, value] of Object.entries(old)) {
    if (!mutable.has(name)) assert.deepEqual(merged[name], value, `preserve ${name}`);
  }
  assert.deepEqual(merged.attempt_ids, [...old.attempt_ids, attempt.id]);
  assert.equal(merged.fsrs.reps, 1);
  assert.deepEqual(mergeMistake(merged, patch), merged, "merging the same history twice is idempotent");
  assert.deepEqual(mergeMistake(actual, old).fsrs, actual.fsrs, "an old patch without fsrs retains the state");
});

test("47c8ab8：混存的旧规则与已有 FSRS 状态都可继续排期", () => {
  const rules = new Set(beforeShell.stores.mistake_entries.map((m) => m.interval_rule));
  assert.deepEqual([...rules].sort(), ["fsrs_5", "heuristic_1_3_7_14"]);
  for (const old of beforeShell.stores.mistake_entries) {
    const attempt = beforeShell.stores.attempts.find((a) => a.id === old.last_attempt_id);
    const next = scheduleReview({ grading: attempt.grading, understanding: attempt.understanding,
      previous: old, previousStep: old.interval_step, now: Date.parse(old.next_review_at) });
    assert.equal(next.rule, "fsrs_5");
    assert.equal(next.fsrs.reps, (old.fsrs?.reps || 0) + 1);
    assert.ok(Date.parse(next.next_review_at) > Date.parse(old.next_review_at));
  }
});

test("迁移 API：真实旧 payload 重复运行及中断后重试均不重复写作答、错题、复习和进度", () => {
  // 独立进程只替换持久层边界为内存 Map，运行真实 bridge-api / records / 调度。
  // IndexedDB 的打开和旧 schema 已在 Playwright 中由真实浏览器验证。
  // registerHooks 由 CI 使用的 Node 22（22.15+）与本地 Node 24 提供，无 npm 依赖。
  const result = spawnSync(process.execPath, ["--input-type=module"], {
    cwd: new URL("../", import.meta.url), encoding: "utf8", timeout: 20000,
    input: `
      import assert from 'node:assert/strict';
      import { registerHooks } from 'node:module';
      import { readFileSync } from 'node:fs';
      import { pathToFileURL } from 'node:url';
      const root = pathToFileURL(process.cwd() + '/');
      const read = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
      const legacy = read('tests/fixtures/legacy-yy5-4a0f33b.json');
      const historical = read('tests/fixtures/legacy-idb-66b5078.json');
      const storageUrl = new URL('assets/js/core/storage.js', root).href;
      globalThis.__stores = new Map();
      registerHooks({ load(url, context, nextLoad) {
        if (url !== storageUrl) return nextLoad(url, context);
        return { format: 'module', shortCircuit: true, source: \`
          const stores = globalThis.__stores;
          const store = n => { if (!stores.has(n)) stores.set(n, new Map()); return stores.get(n); };
          export const get = async (n, k) => structuredClone(store(n).get(k) ?? null);
          export const getAll = async n => structuredClone([...store(n).values()]);
          export const put = async (n, v) => { store(n).set(n === 'meta' ? v.key : v.id, structuredClone(v)); return v; };
          export const remove = async (n, k) => { store(n).delete(k); };
          export const ensureSchema = async () => ({ ok: true, schema_version: 1, readOnly: false });
        \` };
      } });
      globalThis.fetch = async path => ({ ok: true, json: async () => read(String(path).replace(/^\\.\\//, '')) });
      const api = await import(new URL('assets/js/bridge-api.js', root));
      const { migrateChoiceMap } = await import(new URL('assets/js/features/page-attempts.js', root));
      const key = 'liaoning.yy5.quiz.2026';
      const original = JSON.stringify(legacy);
      const payloads = migrateChoiceMap(key, JSON.parse(legacy.localStorage[key]), legacy.questions);
      const snapshot = () => Object.fromEntries([...globalThis.__stores].filter(([n]) => n !== 'meta').map(([n,s]) => [n,[...s.values()]]));
      assert.equal(await api.migrationDone(key), false);
      assert.deepEqual(await api.migratePageRecords(key, payloads), { written: 3, skipped: 0 });
      assert.equal(await api.migrationDone(key), true);
      const once = structuredClone(snapshot());
      assert.equal(once.attempts.length, 3);
      assert.equal(once.mistake_entries.length, 3); // 当前规则含一条答对后的 consolidate。
      assert.equal(once.review_events.length, 3);
      assert.equal(once.user_topic_progress.length, 2);
      assert.deepEqual(await api.migratePageRecords(key, payloads), { written: 0, skipped: 3 });
      assert.deepEqual(snapshot(), once);
      assert.equal(globalThis.__stores.get('meta').get('migration:' + key).value.written, 3);
      // 使用历史真实中间结果（只有第一条记录已写、尚无迁移标记）模拟中断后重试。
      globalThis.__stores.clear();
      const firstId = payloads[0].attemptId;
      for (const [name, rows] of Object.entries(historical.stores)) {
        const selected = rows.filter(r => r.id === firstId || r.first_attempt_id === firstId || r.attempt_id === firstId || r.key === 'schema');
        globalThis.__stores.set(name, new Map(selected.map(r => [name === 'meta' ? r.key : r.id, structuredClone(r)])));
      }
      assert.equal(await api.migrationDone(key), false);
      assert.deepEqual(await api.migratePageRecords(key, payloads), { written: 2, skipped: 1 });
      const resumed = structuredClone(snapshot());
      assert.equal(resumed.attempts.length, 3);
      assert.equal(resumed.mistake_entries.length, 3);
      assert.equal(resumed.review_events.length, 3);
      assert.deepEqual(await api.migratePageRecords(key, payloads), { written: 0, skipped: 3 });
      assert.deepEqual(snapshot(), resumed);
      assert.equal(JSON.stringify(legacy), original);
      console.log('migration and retry passed');
    `
  });
  assert.equal(result.status, 0, `${result.error || ""}\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /migration and retry passed/);
});
