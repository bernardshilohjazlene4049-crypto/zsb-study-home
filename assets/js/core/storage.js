import { DB_NAME, DB_VERSION, SCHEMA_VERSION, STORE_DEFS } from "./schema.js";

let dbPromise = null;

function describeError(error) {
  const name = error?.name || "";
  if (name === "QuotaExceededError") return "存储空间不足。请先导出备份，再清理一部分记录。";
  if (name === "SecurityError" || name === "InvalidStateError") {
    return "浏览器不允许保存。目录仍可浏览，学习记录无法保存。";
  }
  if (!("indexedDB" in globalThis)) return "当前浏览器无法保存学习记录。";
  return "记录暂时打不开。目录仍可浏览。";
}

function createDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(Object.assign(new Error(describeError()), { code: "no-idb" }));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [name, def] of Object.entries(STORE_DEFS)) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, { keyPath: def.keyPath });
        for (const [indexName, keyPath, options] of def.indexes || []) {
          store.createIndex(indexName, keyPath, options);
        }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => {
      reject(Object.assign(new Error(describeError(request.error)), {
        code: request.error?.name || "idb-error",
        cause: request.error
      }));
    };
    request.onblocked = () => {
      reject(Object.assign(new Error("数据库被其他学习页占用。请关掉其他标签后刷新。"), { code: "blocked" }));
    };
  });
}

export function openDatabase() {
  if (!dbPromise) {
    dbPromise = createDatabase().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

function runRequest(storeNames, mode, makeRequest) {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let request;
    try {
      const store = Array.isArray(storeNames) ? null : tx.objectStore(storeNames);
      request = makeRequest(store, tx);
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(request ? request.result : undefined);
    tx.onerror = () => reject(tx.error || request?.error || new Error("事务失败"));
    tx.onabort = () => reject(tx.error || request?.error || new Error("事务已中止"));
  }));
}

export function get(storeName, key) {
  return runRequest(storeName, "readonly", (store) => store.get(key)).then((value) => value ?? null);
}

export function getAll(storeName) {
  return runRequest(storeName, "readonly", (store) => store.getAll()).then((value) => value || []);
}

export function put(storeName, value) {
  return runRequest(storeName, "readwrite", (store) => store.put(value)).then(() => value);
}

export function add(storeName, value) {
  return runRequest(storeName, "readwrite", (store) => store.add(value)).then(() => value);
}

export function remove(storeName, key) {
  return runRequest(storeName, "readwrite", (store) => store.delete(key)).then(() => undefined);
}

export async function clearAllStores() {
  const db = await openDatabase();
  const names = [...db.objectStoreNames];
  await new Promise((resolve, reject) => {
    const tx = db.transaction(names, "readwrite");
    for (const name of names) tx.objectStore(name).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("清空失败"));
    tx.onabort = () => reject(tx.error || new Error("清空已中止"));
  });
  await put("meta", {
    key: "schema",
    schema_version: SCHEMA_VERSION,
    created_at: new Date().toISOString(),
    note: "cleared"
  });
}

export async function ensureSchema() {
  const current = await get("meta", "schema");
  if (!current) {
    await put("meta", {
      key: "schema",
      schema_version: SCHEMA_VERSION,
      created_at: new Date().toISOString()
    });
    return { ok: true, schema_version: SCHEMA_VERSION, readOnly: false };
  }
  if (current.schema_version > SCHEMA_VERSION) {
    return {
      ok: false,
      schema_version: current.schema_version,
      readOnly: true,
      message: "这台设备上的记录比当前页面新，已暂停保存。请先导出备份。"
    };
  }
  return { ok: true, schema_version: current.schema_version, readOnly: false };
}

export async function dumpStores() {
  const stores = {};
  for (const name of Object.keys(STORE_DEFS)) stores[name] = await getAll(name);
  return stores;
}
