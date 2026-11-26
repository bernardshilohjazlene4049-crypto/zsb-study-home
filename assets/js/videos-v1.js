(() => {
  const script = document.currentScript;
  const site = new URL("../../", script.src);
  const preview = site.origin === location.origin && location.protocol === "http:"
    && location.hostname === "127.0.0.1"
    && new URLSearchParams(location.search).get("videos-preview") === "1";
  let active;

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
        video.poster = row.querySelector("img").src;
        video.setAttribute("aria-label", title);
        const asset = encodeURIComponent(row.dataset.asset);
        video.src = preview
          ? new URL(`__videos_v1_media__/${asset}`, site).href
          : new URL(asset, script.dataset.downloadBase).href;
        const error = document.createElement("span");
        error.setAttribute("role", "status");
        video.addEventListener("error", () => {
          error.textContent = preview ? "本机视频加载失败，请检查预览服务。" : "视频加载失败，请稍后重试。";
        });
        row.append(video, error);
        active = {
          remove() {
            video.removeAttribute("src");
            video.load();
            video.remove();
            error.remove();
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
