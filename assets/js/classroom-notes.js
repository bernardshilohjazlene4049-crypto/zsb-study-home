(function () {
  "use strict";
  const body = document.body;
  const sourcesPath = body.dataset.noteSources || "";
  const dialog = document.querySelector("[data-note-dialog]");
  const dialogImage = dialog?.querySelector("img");
  const dialogTitle = dialog?.querySelector("[data-dialog-title]");
  const closeButton = dialog?.querySelector("[data-dialog-close]");
  let sourceItems = [];

  const scrollRegionLabels = {
    "class-axis": "可横向滚动的地址分类图",
    bits: "可横向滚动的地址位图",
    "note-table-wrap": "可横向滚动的笔记表格",
    "code-block": "可横向滚动的代码示例"
  };
  for (const [className, label] of Object.entries(scrollRegionLabels)) {
    for (const node of document.querySelectorAll(`.${className}`)) {
      node.tabIndex = 0;
      if (!node.hasAttribute("aria-label")) node.setAttribute("aria-label", label);
    }
  }

  function sourceCard(item) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `source-card${item.readable ? "" : " is-low"}`;
    button.dataset.sourceId = item.id;
    const image = document.createElement("img");
    image.src = new URL(item.src, location.href).href;
    image.alt = `${item.file} 缩略图`;
    image.loading = "lazy";
    image.decoding = "async";
    const label = document.createElement("span");
    label.className = "source-card__label";
    const text = document.createElement("span");
    text.textContent = item.file.replace(/\.(png|jpe?g|webp)$/i, "");
    const state = document.createElement("span");
    state.className = "source-card__state";
    state.textContent = item.readable ? "原图" : "低清预览";
    label.append(text, state);
    button.append(image, label);
    button.addEventListener("click", () => {
      if (!dialog || !dialogImage || !dialogTitle) return;
      dialogImage.src = new URL(item.src, location.href).href;
      dialogImage.alt = `${item.file}${item.note ? ` · ${item.note}` : ""}`;
      dialogTitle.textContent = `${item.file}${item.note ? ` · ${item.note}` : ""}`;
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });
    return button;
  }

  function paintGalleries() {
    for (const host of document.querySelectorAll("[data-source-group]")) {
      const items = sourceItems.filter((item) => item.group === host.dataset.sourceGroup);
      if (items.length) {
        host.replaceChildren(...items.map(sourceCard));
        const summary = host.closest("details")?.querySelector("summary");
        if (summary) summary.textContent = `查看本章原始截图（${items.length} 张）`;
      } else {
        const message = document.createElement("p");
        message.className = "source-empty";
        message.textContent = "这一页暂无原始截图。";
        host.replaceChildren(message);
      }
    }
  }

  async function loadSources() {
    if (!sourcesPath) return;
    try {
      const response = await fetch(new URL(sourcesPath, location.href));
      if (!response.ok) throw new Error(`sources ${response.status}`);
      const data = await response.json();
      sourceItems = Array.isArray(data.items) ? data.items : [];
      paintGalleries();
    } catch (error) {
      console.warn("课堂原图清单加载失败", error);
      for (const host of document.querySelectorAll("[data-source-group]")) {
        const message = document.createElement("p");
        message.className = "source-empty";
        message.textContent = "原图清单暂时没有载入，请刷新页面重试。";
        host.replaceChildren(message);
      }
    }
  }

  function closeDialog() {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  closeButton?.addEventListener("click", closeDialog);
  dialog?.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog();
  });
  dialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });

  const links = [...document.querySelectorAll('.notes-toc a[href^="#"]')];
  const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      for (const link of links) {
        link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`);
      }
    }, { rootMargin: "-18% 0px -70% 0px", threshold: [0, 1] });
    sections.forEach((section) => observer.observe(section));
  }

  loadSources();
})();
