/* 锚点跳转：先让前面的 .topic-section 临时取消 content-visibility，再滚到目标；
 * 等图片和字体落定后短窗口内再校正一次；还原时记下实测高度，以免占位高度缩回去把目标卷出视野。用户自己滚动则停止。不改版式。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.zsbHashScroll = api;
  if (typeof document !== "undefined") api.install();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const AFTER_LOAD_MS = 2000;
  const MAX_MS = 4000;
  const KEYS = new Set([" ", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

  let installed = false;
  let navigator = null;
  let active = false;
  let userScrolled = false;
  let revealed = [];
  let observer = null;
  let endTimer = null;
  let loadTimer = null;
  const cleanups = [];

  function hashId() {
    const raw = location.hash.slice(1);
    if (!raw) return "";
    try { return decodeURIComponent(raw); } catch { return raw; }
  }

  function targetEl() {
    const id = hashId();
    if (!id) return null;
    const byId = document.getElementById(id);
    if (byId) return byId;
    try {
      return document.querySelector("[name=" + CSS.escape(id) + "]");
    } catch {
      return null;
    }
  }

  function revealFor(el) {
    const sections = document.querySelectorAll(".topic-section");
    if (!sections.length) return;
    let passed = false;
    for (const section of sections) {
      if (passed) break;
      if (el && (section === el || section.contains(el))) passed = true;
      if (section.style.contentVisibility === "visible") continue;
      section.style.setProperty("content-visibility", "visible");
      revealed.push(section);
    }
  }

  function restore() {
    for (const section of revealed) {
      const height = section.getBoundingClientRect().height;
      if (height > 0) {
        section.style.setProperty("contain-intrinsic-size", Math.ceil(height) + "px");
      }
      section.style.removeProperty("content-visibility");
    }
    revealed = [];
  }

  function align() {
    const el = targetEl();
    if (!el || userScrolled) return;
    void el.getBoundingClientRect();
    el.scrollIntoView({ block: "start", behavior: "auto" });
  }

  function scrollToHash() {
    const el = targetEl();
    if (!el || userScrolled) return null;
    revealFor(el);
    void el.getBoundingClientRect();
    el.scrollIntoView({ block: "start", behavior: "auto" });
    return el;
  }

  function unbindTemporary() {
    while (cleanups.length) {
      const fn = cleanups.pop();
      try { fn(); } catch { /* ignore */ }
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (endTimer) { clearTimeout(endTimer); endTimer = null; }
    if (loadTimer) { clearTimeout(loadTimer); loadTimer = null; }
  }

  function finish() {
    if (!active) return;
    if (!userScrolled) scrollToHash();
    restore();
    if (!userScrolled) align();
    active = false;
    unbindTemporary();
  }

  function cancelByUser() {
    if (!active) return;
    userScrolled = true;
    finish();
  }

  function onKey(e) {
    if (KEYS.has(e.key)) cancelByUser();
  }

  function begin() {
    if (navigator) { navigator(); return; }
    if (!hashId()) return;
    userScrolled = false;
    unbindTemporary();
    restore();
    active = true;
    scrollToHash();

    const onLayout = function () { if (active && !userScrolled) scrollToHash(); };
    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(onLayout);
      observer.observe(document.documentElement);
      if (document.body) observer.observe(document.body);
    }

    window.addEventListener("wheel", cancelByUser, { passive: true, capture: true });
    window.addEventListener("touchmove", cancelByUser, { passive: true, capture: true });
    window.addEventListener("keydown", onKey, { capture: true });
    cleanups.push(function () {
      window.removeEventListener("wheel", cancelByUser, { capture: true });
      window.removeEventListener("touchmove", cancelByUser, { capture: true });
      window.removeEventListener("keydown", onKey, { capture: true });
    });

    const el = targetEl();
    const images = el
      ? Array.prototype.filter.call(document.images, function (img) {
        return !!(img.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
      })
      : [];
    images.forEach(function (img) {
      if (img.complete) return;
      img.addEventListener("load", onLayout, { once: true });
      img.addEventListener("error", onLayout, { once: true });
      cleanups.push(function () {
        img.removeEventListener("load", onLayout);
        img.removeEventListener("error", onLayout);
      });
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(onLayout);
    }

    const onLoad = function () {
      onLayout();
      if (loadTimer) clearTimeout(loadTimer);
      loadTimer = setTimeout(finish, AFTER_LOAD_MS);
    };
    if (document.readyState === "complete") onLoad();
    else {
      window.addEventListener("load", onLoad, { once: true });
      cleanups.push(function () { window.removeEventListener("load", onLoad); });
    }
    endTimer = setTimeout(finish, MAX_MS);
  }

  function onHashChange() {
    begin();
  }

  function install() {
    if (installed) return;
    installed = true;
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("pageshow", function (e) {
      if (e.persisted && hashId()) begin();
    });
    if (hashId()) {
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", begin, { once: true });
      else begin();
    }
  }

  return {
    install,
    // 分区式讲义接管定位；先终止原长页的图片/字体校正窗口。
    setNavigator(callback) {
      active = false;
      unbindTemporary();
      restore();
      navigator = callback;
    },
    begin,
    scrollToHash,
    hashId,
    targetEl,
    AFTER_LOAD_MS,
    MAX_MS
  };
});
