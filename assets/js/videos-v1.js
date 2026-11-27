(() => {
  const script = document.currentScript;
  const site = new URL("../../", script.src);
  const preview = site.origin === location.origin && location.protocol === "http:"
    && location.hostname === "127.0.0.1"
    && new URLSearchParams(location.search).get("videos-preview") === "1";
  let active;
  let recordsPromise;

  function playbackRecords() {
    if (!recordsPromise) {
      recordsPromise = import(new URL("assets/js/features/records.js", site).href).catch(() => null);
    }
    return recordsPromise;
  }

  function openFromHash() {
    const id = location.hash.slice(1);
    if (!id.startsWith("videos-v1")) return;
    const section = document.getElementById(id);
    if (section?.matches(".v1-videos")) section.open = true;
  }

  for (const section of document.querySelectorAll(".v1-videos")) {
    function loadCovers() {
      if (!section.open) return;
      for (const image of section.querySelectorAll("img[data-cover]")) {
        image.src = image.dataset.cover;
        delete image.dataset.cover;
      }
    }
    section.addEventListener("toggle", loadCovers);
    loadCovers();
    if (!preview && section.dataset.release !== "published") continue;
    if (preview) {
      const notice = section.querySelector(".v1-notice");
      if (notice) notice.textContent = "本机预览。正式视频仍待发布。";
    }

    for (const row of section.querySelectorAll("[data-video-id]")) {
      const title = row.querySelector(".v1-title").textContent;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sh-btn";
      button.textContent = preview ? "加载本机视频" : "加载视频";
      button.setAttribute("aria-label", `${button.textContent}：${title}`);
      row.querySelector("div").append(button);

      button.addEventListener("click", () => {
        active?.remove();
        const video = document.createElement("video");
        video.controls = true;
        video.preload = "metadata";
        video.playsInline = true;
        const cover = row.querySelector("img");
        video.poster = cover.src || cover.dataset.cover || "";
        video.setAttribute("aria-label", title);
        const asset = encodeURIComponent(row.dataset.asset);
        video.src = preview
          ? new URL(`__videos_v1_media__/${asset}`, site).href
          : new URL(asset, script.dataset.downloadBase).href;
        const error = document.createElement("span");
        error.setAttribute("role", "status");
        const resourceId = row.dataset.videoId;
        let lastSavedAt = 0;
        const session = { closed: false };

        const savePosition = (force = false) => {
          const currentTime = Number(video.currentTime);
          if (!resourceId || session.closed || !video.isConnected || !Number.isFinite(currentTime) || currentTime < 0) return;
          const now = Date.now();
          if (!force && now - lastSavedAt < 5000) return;
          lastSavedAt = now;
          const playbackRate = Number(video.playbackRate);
          playbackRecords().then((records) => {
            if (!records) return;
            return records.savePlayback(resourceId, currentTime, Number.isFinite(playbackRate) ? playbackRate : 1);
          }).catch(() => {
            // 本地记录不可用时不影响视频播放。
          });
        };

        const restorePosition = async () => {
          if (!resourceId) return;
          try {
            const records = await playbackRecords();
            if (!records || session.closed || !video.isConnected) return;
            const saved = await records.readPlayback(resourceId);
            if (session.closed || !video.isConnected || !saved) return;
            const currentTime = Number(saved.current_time);
            if (Number.isFinite(currentTime) && currentTime >= 0 && currentTime < video.duration) {
              video.currentTime = currentTime;
            }
            const playbackRate = Number(saved.playback_rate);
            if (Number.isFinite(playbackRate) && playbackRate >= 0.5 && playbackRate <= 3) {
              video.playbackRate = playbackRate;
            }
          } catch {
            // IndexedDB 不可用时静默跳过，视频仍可正常播放。
          }
        };

        const onPause = () => savePosition(true);
        const onTimeUpdate = () => savePosition(false);
        video.addEventListener("loadedmetadata", restorePosition, { once: true });
        video.addEventListener("pause", onPause);
        video.addEventListener("timeupdate", onTimeUpdate);
        video.addEventListener("ended", onPause);
        video.addEventListener("error", () => {
          error.textContent = preview ? "本机视频加载失败，请检查预览服务。" : "视频加载失败，请稍后重试。";
        });
        row.append(video, error);
        row.classList.add("v1-open");
        active = {
          remove() {
            savePosition(true);
            session.closed = true;
            video.removeEventListener("pause", onPause);
            video.removeEventListener("timeupdate", onTimeUpdate);
            video.removeEventListener("ended", onPause);
            const player = video.closest(".zlp") || video;
            video.pause();
            video.removeAttribute("src");
            video.load();
            player.remove();
            error.remove();
            row.classList.remove("v1-open");
            active = null;
          }
        };
        video.focus();
      });
    }
    section.addEventListener("toggle", () => {
      if (!section.open && section.querySelector("video")) active?.remove();
    });
  }
  openFromHash();
  window.addEventListener("hashchange", openFromHash);
})();
