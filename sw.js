/* 离线缓存。
 * - 页面、脚本、样式、数据：网络优先，联网时总是取最新版本（向服务器重新校验），断网时用缓存。
 * - 图片与字体：先用缓存，后台更新。
 * - 视频（mp4/webm）与分段请求：不经过缓存。
 * VERSION 与 PRECACHE 由 .github/scripts/sw-build.mjs 在构建时写入（版本号 = commit SHA）。
 */
const VERSION = "dev";
const PRECACHE = [];
const CACHE = "zsb-" + VERSION;
const FRESH = /\.(html?|js|mjs|css|json|vtt|webmanifest|pf_[a-z]+)$|\/$/i;
const MEDIA = /\.(mp4|webm|m4v|mov|mp3|m4a)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" }))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("zsb-") && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (response.ok && response.type === "basic") cache.put(request, response.clone());
    return response;
  } catch (error) {
    const url = new URL(request.url);
    const hit = await cache.match(request, { ignoreSearch: true })
      || (url.pathname.endsWith("/") && await cache.match(url.pathname + "index.html", { ignoreSearch: true }));
    if (hit) return hit;
    if (request.mode === "navigate") {
      const offline = await cache.match("offline.html");
      if (offline) return offline;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  const update = fetch(request).then((response) => {
    if (response.ok && response.type === "basic") cache.put(request, response.clone());
    return response;
  });
  if (hit) { update.catch(() => {}); return hit; }
  return update;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || MEDIA.test(url.pathname)) return;
  if (request.mode === "navigate" || FRESH.test(url.pathname)) event.respondWith(networkFirst(request));
  else event.respondWith(cacheFirst(request));
});
