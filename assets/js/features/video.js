import { h } from "../core/dom.js";
import { siteUrl, isHttpUrl } from "../core/paths.js";
import { readPlayback, savePlayback } from "./records.js";

function formatClock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

export function mountVideo(container, { resource, anchor, dbOk, onPlay }) {
  container.replaceChildren();
  if (!resource?.url) {
    container.append(h("div", { class: "empty" }, [
      h("strong", {}, "待添加")
    ]));
    return;
  }

  const located = anchor?.located === true && Number.isFinite(anchor.start_sec);
  const src = isHttpUrl(resource.url) ? resource.url : siteUrl(resource.url);
  const video = h("video", { controls: true, playsinline: true, preload: "metadata" });
  video.src = src;
  if (resource.poster) {
    video.poster = isHttpUrl(resource.poster) ? resource.poster : siteUrl(resource.poster);
  }
  const status = h("p", { class: "notice" }, located
    ? `从 ${formatClock(anchor.start_sec)} 开始。`
    : "暂无定位。");

  video.addEventListener("error", () => {
    status.textContent = "视频文件没有加载成功。可以改打开原页面。";
  });
  video.addEventListener("play", () => onPlay?.());

  if (located) {
    video.addEventListener("loadedmetadata", () => {
      try { video.currentTime = anchor.start_sec; } catch { /* ignore */ }
    }, { once: true });
  } else if (dbOk && resource.id) {
    readPlayback(resource.id).then((saved) => {
      if (!saved || !Number.isFinite(saved.current_time)) return;
      video.addEventListener("loadedmetadata", () => {
        if (saved.current_time < (video.duration || Infinity)) video.currentTime = saved.current_time;
      }, { once: true });
    }).catch(() => {});
    let savedAt = 0;
    const persist = () => {
      savePlayback(resource.id, video.currentTime || 0, video.playbackRate || 1).catch(() => {});
    };
    video.addEventListener("pause", persist);
    video.addEventListener("timeupdate", () => {
      const now = Date.now();
      if (now - savedAt < 5000) return;
      savedAt = now;
      persist();
    });
  }

  const actions = [];
  if (resource.page_url) {
    actions.push(h("a", { class: "btn", href: siteUrl(resource.page_url) }, "打开原页面"));
  }
  if (resource.duration_label) {
    actions.push(h("span", { class: "badge" }, `原页时长标记 ${resource.duration_label}`));
  }

  container.append(h("section", { class: "panel" }, [
    h("h2", {}, "讲解视频"),
    h("p", { class: "muted" }, resource.title),
    status,
    h("div", { class: "video-frame" }, [video]),
    h("div", { class: "row" }, actions)
  ]));
}
