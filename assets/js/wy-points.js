/* 静态正文渐进增强：标签、可选择文字的导图与按需原图。 */
(() => {
  "use strict";
  const tabs = [...document.querySelectorAll('.wy-tabs [role="tab"]')];
  const mapPanel = document.getElementById("mindmap");
  const frame = document.querySelector(".wy-mm-frame");
  const space = document.querySelector(".wy-mm-space");
  const tree = document.querySelector(".wy-mm-src");
  const mobile = matchMedia("(max-width: 760px)");
  let zoom = 1, fitScale = 1, fitRequest = 0, frameWidth = 0;

  function layoutMap(reset = false) {
    if (!frame || mapPanel.hidden) return;
    if (reset) zoom = 1;
    frame.classList.add("wy-mm-ready");
    tree.style.transform = "none";
    space.style.width = "";
    space.style.height = "";
    tree.style.position = "";
    frame.style.height = "";
    if (mobile.matches) {
      fitScale = 1;
      frame.style.setProperty("--wy-mm-font", zoom);
      frame.dataset.scale = String(zoom);
      return;
    }
    const width = tree.scrollWidth;
    const height = tree.scrollHeight;
    const availableWidth = frame.clientWidth - 26;
    const availableHeight = Math.max(256, innerHeight * .75 - 26);
    fitScale = Math.min(1, availableWidth / width, availableHeight / height);
    const scale = fitScale * zoom;
    const scaledWidth = Math.ceil(width * scale);
    const scaledHeight = Math.ceil(height * scale);
    space.style.width = `${scaledWidth}px`;
    space.style.height = `${scaledHeight}px`;
    tree.style.position = "absolute";
    tree.style.transform = `scale(${scale})`;
    frame.style.height = `${Math.min(innerHeight * .75, Math.max(280, scaledHeight + 26))}px`;
    frame.dataset.scale = String(scale);
    if (reset) { frame.scrollLeft = 0; frame.scrollTop = 0; }
  }
  function scheduleFit() {
    cancelAnimationFrame(fitRequest);
    fitRequest = requestAnimationFrame(() => layoutMap(true));
  }
  function activate(id, { updateHash = false, focus = false } = {}) {
    const active = tabs.find(t => t.getAttribute("aria-controls") === id) || tabs[0];
    if (!active) return;
    for (const tab of tabs) {
      const on = tab === active;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden = !on;
    }
    if (updateHash) history.replaceState(null, "", `#${active.getAttribute("aria-controls")}`);
    if (focus) active.focus({ preventScroll: true });
    if (!mapPanel.hidden) scheduleFit();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => activate(tab.getAttribute("aria-controls"), { updateHash: true }));
    tab.addEventListener("keydown", event => {
      let next;
      if (event.key === "ArrowRight") next = (i + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(tabs[next].getAttribute("aria-controls"), { updateHash: true, focus: true });
    });
  });
  const fromHash = () => activate(location.hash.slice(1) || "lecture");
  addEventListener("hashchange", fromHash);
  fromHash();
  if (frame) {
    new ResizeObserver(() => {
      if (Math.abs(frame.clientWidth - frameWidth) < 1) return;
      frameWidth = frame.clientWidth;
      scheduleFit();
    }).observe(frame);
    addEventListener("resize", scheduleFit);
    document.fonts?.ready.then(scheduleFit);
    document.querySelectorAll("[data-mm-zoom]").forEach(button => button.addEventListener("click", () => {
      const action = button.dataset.mmZoom;
      if (action === "reset") layoutMap(true);
      else {
        zoom = Math.min(mobile.matches ? 2 : 8, Math.max(mobile.matches ? .64 : .25, zoom * (action === "in" ? 1.25 : 1 / 1.25)));
        layoutMap();
      }
    }));
    // 鼠标中键/节点以外的空白区域支持拖动；节点文字保留原生选择能力。
    let drag = null;
    frame.addEventListener("pointerdown", event => {
      if (mobile.matches || event.pointerType !== "mouse" || event.button > 1 || (event.button === 0 && event.target.closest("li > span"))) return;
      drag = { x: event.clientX, y: event.clientY, left: frame.scrollLeft, top: frame.scrollTop };
      frame.setPointerCapture(event.pointerId);
      frame.classList.add("is-dragging");
      event.preventDefault();
    });
    frame.addEventListener("pointermove", event => {
      if (!drag) return;
      frame.scrollLeft = drag.left + drag.x - event.clientX;
      frame.scrollTop = drag.top + drag.y - event.clientY;
    });
    const endDrag = () => { drag = null; frame.classList.remove("is-dragging"); };
    frame.addEventListener("pointerup", endDrag);
    frame.addEventListener("pointercancel", endDrag);
  }

  const dialog = document.querySelector(".wy-photo");
  const opener = document.querySelector("[data-open-photo]");
  if (!dialog || !opener) return;
  const image = dialog.querySelector("img");
  const photos = [...dialog.querySelectorAll("[data-photo]")];
  const zoomButton = dialog.querySelector("[data-photo-zoom]");
  function photoZoom(enlarged) {
    dialog.classList.toggle("is-enlarged", enlarged);
    zoomButton.setAttribute("aria-pressed", String(enlarged));
  }
  function selectPhoto(button) {
    for (const item of photos) item.setAttribute("aria-pressed", String(item === button));
    image.width = Number(button.dataset.width);
    image.height = Number(button.dataset.height);
    image.alt = button.textContent;
    // 唯一下载入口：页内 dialog 打开之后或在 dialog 内切图。
    image.src = button.dataset.photo;
    photoZoom(false);
    dialog.querySelector(".wy-photo-scroll").scrollTo(0, 0);
  }
  opener.addEventListener("click", () => {
    dialog.showModal();
    selectPhoto(photos[0]);
  });
  for (const button of photos) button.addEventListener("click", () => selectPhoto(button));
  dialog.querySelector("[data-photo-close]").addEventListener("click", () => dialog.close());
  zoomButton.addEventListener("click", () => photoZoom(!dialog.classList.contains("is-enlarged")));
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => opener.focus({ preventScroll: true }));
})();
