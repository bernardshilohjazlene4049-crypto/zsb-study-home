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
      h("strong", {}, "待添加"),
      h("p", {}, "这个知识点还没有登记视频，页面不会编造播放地址。")
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
  const rate = h("select", { "aria-label": "播放倍速" });
  for (const value of [0.75, 1, 1.25, 1.5]) {
    const option = h("option", { value: String(value) }, `${value} 倍`);
    if (value === 1) option.selected = true;
    rate.append(option);
  }
  rate.addEventListener("change", () => {
    video.playbackRate = Number(rate.value) || 1;
  });

  const status = h("p", { class: "notice" }, located
    ? `从已核验位置 ${formatClock(anchor.start_sec)} 开始。`
    : "暂无定位。下面播放的是已经登记的整段资源，不会跳到编造的秒数。");

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
        if (saved.playback_rate) {
          video.playbackRate = saved.playback_rate;
          rate.value = String(saved.playback_rate);
        }
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

  const actions = [h("label", { class: "inline-field" }, ["倍速", rate])];
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
