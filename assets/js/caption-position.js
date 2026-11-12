/* 把 VTT 字幕放到画面顶部，避免和视频里烧录的字幕叠在一起。不改字幕文字。默认仍关闭。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.zsbCaptionPosition = api;
  if (typeof document !== "undefined") {
    const start = function () { api.watchVideos(document); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function pinCues(track) {
    const cues = track && track.cues;
    if (!cues) return;
    for (let i = 0; i < cues.length; i++) cues[i].line = 0;
  }

  function hookTrack(trackEl) {
    if (!trackEl || trackEl.dataset.zsbCaptionTop === "1") return;
    trackEl.dataset.zsbCaptionTop = "1";
    const textTrack = trackEl.track;
    if (!textTrack) return;

    const apply = function () { pinCues(textTrack); };
    const wasDisabled = textTrack.mode === "disabled";
    if (wasDisabled) textTrack.mode = "hidden";

    const finish = function () {
      apply();
      if (wasDisabled && textTrack.mode === "hidden") textTrack.mode = "disabled";
    };

    if (trackEl.readyState === 2) finish();
    else trackEl.addEventListener("load", finish, { once: true });

    textTrack.addEventListener("cuechange", apply);
  }

  function pinVideoCaptions(video) {
    if (!video || !video.querySelectorAll) return;
    video.querySelectorAll("track").forEach(hookTrack);
    if (video.textTracks && video.dataset.zsbCaptionListHooked !== "1") {
      video.dataset.zsbCaptionListHooked = "1";
      video.textTracks.addEventListener("change", function () {
        for (let i = 0; i < video.textTracks.length; i++) pinCues(video.textTracks[i]);
      });
    }
  }

  function watchVideos(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll("video").forEach(pinVideoCaptions);
    if (typeof MutationObserver === "undefined") return;
    const target = scope.documentElement || scope.body || scope;
    if (!target || !target.nodeType) return;
    new MutationObserver(function (records) {
      for (let r = 0; r < records.length; r++) {
        const added = records[r].addedNodes;
        for (let i = 0; i < added.length; i++) {
          const node = added[i];
          if (!node || node.nodeType !== 1) continue;
          if (node.tagName === "VIDEO") pinVideoCaptions(node);
          else if (node.tagName === "TRACK") {
            const video = node.closest && node.closest("video");
            if (video) pinVideoCaptions(video);
          } else if (node.querySelectorAll) {
            node.querySelectorAll("video").forEach(pinVideoCaptions);
          }
        }
      }
    }).observe(target, { childList: true, subtree: true });
  }

  return { pinCues: pinCues, pinVideoCaptions: pinVideoCaptions, watchVideos: watchVideos };
});
