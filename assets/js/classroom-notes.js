(function () {
  "use strict";

  const body = document.body;
  const sourcesPath = body.dataset.noteSources || "";
  const noteSubject = body.dataset.noteSubject || "";
  const dialog = document.querySelector("[data-note-dialog]");
  const dialogImage = dialog?.querySelector("img");
  const dialogTitle = dialog?.querySelector("[data-dialog-title]");
  const closeButton = dialog?.querySelector("[data-dialog-close]");
  const toc = document.querySelector(".notes-toc");
  const tocToggle = document.querySelector("[data-toc-toggle]");
  const tocClose = document.querySelector("[data-toc-close]");
  let sourceItems = [];
  let dialogTrigger = null;

  const SUBJECTS = {
    network: "计算机网络",
    web_design: "网页制作基础"
  };
  const TOPIC_LINKS = {
    network: {
      "ip-basics": "network.html#ip-basics",
      cidr: "network.html#cidr",
      subnet: "network.html#subnet",
      fragments: "network.html#fragments",
      ipv6: "network.html#ipv6",
      overview: "network.html#source-index"
    },
    web_design: {
      "css-pseudo": "web.html#css-pseudo",
      text: "web.html#text",
      selectors: "web.html#selectors",
      forms: "web.html#forms",
      widgets: "web.html#widgets",
      sketches: "web.html#source-index"
    }
  };
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

  function displayName(item) {
    return item.file.replace(/\.(png|jpe?g|webp)$/i, "");
  }

  function sourceThumb(item) {
    if (!item.readable) return item.src;
    const parts = item.src.split("/");
    const subject = parts[1];
    const stem = item.file.replace(/\.[^.]+$/, "");
    return `assets/thumbs/${subject}/${stem}.webp`;
  }

  function openSourceDialog(item, trigger) {
    if (!dialog || !dialogImage || !dialogTitle) return;
    dialogTrigger = trigger || null;
    dialogImage.src = new URL(item.src, location.href).href;
    dialogImage.alt = `${item.file}${item.note ? ` · ${item.note}` : ""}`;
    dialogTitle.textContent = `${item.file}${item.note ? ` · ${item.note}` : ""}`;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function sourceCard(item) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `source-card${item.readable ? "" : " is-low"}`;
    button.dataset.sourceId = item.id;
    const image = document.createElement("img");
    image.src = new URL(sourceThumb(item), location.href).href;
    image.alt = `${item.file} 缩略图`;
    image.loading = "lazy";
    image.decoding = "async";
    const label = document.createElement("span");
    label.className = "source-card__label";
    const text = document.createElement("span");
    text.textContent = displayName(item);
    const state = document.createElement("span");
    state.className = "source-card__state";
    state.textContent = item.readable ? "高清资料" : "待补高清";
    label.append(text, state);
    button.append(image, label);
    button.addEventListener("click", () => openSourceDialog(item, button));
    return button;
  }

  function paintGalleries() {
    for (const host of document.querySelectorAll("[data-source-group]")) {
      const items = sourceItems.filter((item) => item.group === host.dataset.sourceGroup);
      if (items.length) {
        host.replaceChildren(...items.map(sourceCard));
        const summary = host.closest("details")?.querySelector("summary");
        if (summary) summary.textContent = `查看本章课堂资料（${items.length} 张）`;
      } else {
        const message = document.createElement("p");
        message.className = "source-empty";
        message.textContent = "这一页暂无课堂资料。";
        host.replaceChildren(message);
      }
    }
  }

  async function readJson(path) {
    const response = await fetch(new URL(path, location.href));
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return response.json();
  }

  async function loadSources() {
    if (!sourcesPath) return;
    try {
      const data = await readJson(sourcesPath);
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
    dialogTrigger?.focus();
    dialogTrigger = null;
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

  function setToc(open, returnFocus) {
    if (!toc || !tocToggle) return;
    toc.classList.toggle("is-open", open);
    tocToggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("notes-toc-open", open);
    if (open) tocClose?.focus();
    else if (returnFocus) tocToggle.focus();
  }
  tocToggle?.addEventListener("click", () => setToc(!toc?.classList.contains("is-open"), true));
  tocClose?.addEventListener("click", () => setToc(false, true));
  toc?.addEventListener("click", (event) => {
    if (event.target.closest('a[href^="#"]') && matchMedia("(max-width: 900px)").matches) setToc(false);
  });
  document.addEventListener("click", (event) => {
    if (!toc?.classList.contains("is-open")) return;
    if (toc.contains(event.target) || tocToggle?.contains(event.target)) return;
    setToc(false, true);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toc?.classList.contains("is-open")) setToc(false, true);
  });

  function createLink(href, text, className = "") {
    const link = document.createElement("a");
    link.href = href;
    if (className) link.className = className;
    link.textContent = text;
    return link;
  }

  async function mountLearningContext() {
    if (!noteSubject) return;
    const layout = document.querySelector(".notes-layout");
    if (!layout) return;
    const pageName = decodeURIComponent(location.pathname.split("/").pop());
    let topicData;
    let dependencyData;
    try {
      [topicData, dependencyData] = await Promise.all([readJson("../data/topics.json"), readJson("../data/dependencies.json")]);
    } catch (error) {
      console.warn("学习关系加载失败", error);
      return;
    }
    const topics = topicData.topics
      .filter((topic) => topic.subject_id === noteSubject && (topic.source_ref || "").split("#")[0].split("/").pop() === pageName)
      .sort((a, b) => a.order - b.order);
    const topicById = new Map(topics.map((topic) => [topic.id, topic]));
    const sectionTopic = new Map(topics.map((topic) => [(topic.source_ref || "").split("#")[1], topic]));
    const edges = dependencyData.edges;

    const rail = document.createElement("aside");
    rail.className = "notes-rail";
    rail.setAttribute("aria-label", "学习路径与资料");
    const pathCard = document.createElement("section");
    pathCard.className = "notes-rail__card";
    pathCard.innerHTML = '<h2>本课学习路径</h2>';
    const path = document.createElement("ol");
    path.className = "notes-rail__path";
    for (const topic of topics) {
      const item = document.createElement("li");
      const link = createLink(`#${(topic.source_ref || "").split("#")[1]}`, "");
      const no = document.createElement("span");
      no.textContent = String(topic.order).padStart(2, "0");
      link.append(no, document.createTextNode(topic.title));
      item.append(link);
      path.append(item);
    }
    pathCard.append(path);
    const sourceTotal = sourceItems.length;
    const lowTotal = sourceItems.filter((item) => !item.readable).length;
    const stat = document.createElement("div");
    stat.className = "notes-rail__stat";
    stat.innerHTML = `<span>课堂资料 ${sourceTotal} 张</span><strong>${lowTotal ? `${lowTotal} 张待补` : "全部高清"}</strong>`;
    pathCard.append(stat);
    if (noteSubject) {
      pathCard.append(createLink(`sources.html?subject=${encodeURIComponent(noteSubject)}`, "打开本科原图总库 →", "notes-rail__action"));
    }
    const methodCard = document.createElement("section");
    methodCard.className = "notes-rail__card";
    methodCard.innerHTML = '<h2>阅读顺序</h2><p class="question__source">先看核心结论，再核对原图，最后展开例题。需要跨章比较时直接使用上方知识地图。</p>';
    methodCard.append(createLink("map.html", "查看知识关系图 →", "notes-rail__action"));
    rail.append(pathCard, methodCard);
    layout.append(rail);

    for (const [anchor, topic] of sectionTopic) {
      const section = document.getElementById(anchor);
      if (!section) continue;
      const group = section.querySelector("[data-source-group]")?.dataset.sourceGroup;
      const count = group ? sourceItems.filter((item) => item.group === group).length : 0;
      const questions = section.querySelectorAll(".question").length;
      const prerequisites = edges
        .filter((edge) => edge.topicId === topic.id && topicById.has(edge.prerequisiteId))
        .map((edge) => ({ topic: topicById.get(edge.prerequisiteId), strength: edge.strength }));
      const next = topics.find((candidate) => candidate.order === topic.order + 1);
      const relations = document.createElement("div");
      relations.className = "note-section__relations";
      const before = document.createElement("div");
      before.className = "note-relation";
      before.append(Object.assign(document.createElement("span"), { textContent: "先学 / 起点" }));
      if (prerequisites.length) {
        before.append(...prerequisites.map((edge, index) => createLink(
          `#${(edge.topic.source_ref || "").split("#")[1]}`,
          `${edge.strength === "hard" ? "必需" : "建议"}：${edge.topic.title}${index < prerequisites.length - 1 ? "；" : ""}`
        )));
      } else {
        before.append(Object.assign(document.createElement("strong"), { textContent: "本课程起点" }));
      }
      const after = document.createElement("div");
      after.className = "note-relation";
      after.append(Object.assign(document.createElement("span"), { textContent: "下一步" }));
      if (next) after.append(createLink(`#${(next.source_ref || "").split("#")[1]}`, next.title));
      else after.append(Object.assign(document.createElement("strong"), { textContent: "本页最后一个知识点" }));
      const refs = document.createElement("div");
      refs.className = "note-relation";
      refs.append(Object.assign(document.createElement("span"), { textContent: "本页关联" }));
      const summary = `${count} 张资料 · ${questions} 道例题与自测`;
      if (group) {
        refs.append(createLink(`sources.html?subject=${encodeURIComponent(noteSubject)}&group=${encodeURIComponent(group)}`, `${summary} →`));
      } else {
        refs.append(Object.assign(document.createElement("strong"), { textContent: summary }));
      }
      relations.append(before, after, refs);
      section.querySelector(".source-drawer")?.before(relations);
    }

    const links = [...document.querySelectorAll('.notes-toc a[href^="#"], .notes-rail__path a[href^="#"]')];
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
  }

  function sourceTopicLink(item) {
    const href = TOPIC_LINKS[item.subject]?.[item.group];
    return href ? new URL(href, location.href).href : "";
  }

  async function mountSourceLibrary() {
    if (!body.hasAttribute("data-note-library")) return;
    const grid = document.querySelector("[data-source-library-grid]");
    const empty = document.querySelector("[data-source-library-empty]");
    const summary = document.querySelector("[data-source-summary]");
    const subjectFilter = document.querySelector("#source-subject");
    const groupFilter = document.querySelector("#source-group");
    const statusFilter = document.querySelector("#source-status");
    const searchFilter = document.querySelector("#source-search");
    if (!grid || !summary) return;
    try {
      const [network, web] = await Promise.all([readJson("data/network-sources.json"), readJson("data/web-sources.json")]);
      const allItems = [...network.items, ...web.items];
      const params = new URLSearchParams(location.search);
      const groupLabels = {
        "ip-basics": "IPv4 基础",
        cidr: "CIDR 与地址块",
        subnet: "子网划分",
        fragments: "IPv4 分片",
        ipv6: "IPv6",
        overview: "网络总览与待补",
        "css-pseudo": "CSS 与链接",
        text: "文本属性",
        selectors: "选择器",
        forms: "表单结构",
        widgets: "原生控件",
        sketches: "网页手绘与待补"
      };
      const rebuildGroups = (preferred = "") => {
        if (!groupFilter) return;
        const subject = subjectFilter?.value || "";
        groupFilter.replaceChildren(Object.assign(document.createElement("option"), { value: "", textContent: "全部主题" }));
        const groups = [...new Set(allItems.filter((item) => !subject || item.subject === subject).map((item) => item.group))];
        for (const group of groups) {
          groupFilter.append(Object.assign(document.createElement("option"), { value: group, textContent: groupLabels[group] || group }));
        }
        if (preferred && groups.includes(preferred)) groupFilter.value = preferred;
      };
      const initialSubject = params.get("subject");
      if (initialSubject && subjectFilter?.querySelector(`option[value="${initialSubject}"]`)) subjectFilter.value = initialSubject;
      const initialGroup = params.get("group");
      rebuildGroups(initialGroup || "");
      const paint = () => {
        const subject = subjectFilter?.value || "";
        const group = groupFilter?.value || "";
        const status = statusFilter?.value || "";
        const query = (searchFilter?.value || "").trim().toLowerCase();
        const items = allItems.filter((item) => (!subject || item.subject === subject)
          && (!group || item.group === group)
          && (!status || (status === "readable" ? item.readable : !item.readable))
          && (!query || `${item.file} ${item.kind} ${item.group}`.toLowerCase().includes(query)));
        summary.textContent = `当前 ${items.length} 张 · 高清 ${items.filter((item) => item.readable).length} 张 · 待补 ${items.filter((item) => !item.readable).length} 张`;
        grid.replaceChildren(...items.map((item) => {
          const card = document.createElement("article");
          card.className = "source-library-card";
          const preview = document.createElement("button");
          preview.type = "button";
          preview.className = `source-library-card__preview${item.readable ? "" : " is-low"}`;
          const image = document.createElement("img");
          image.src = new URL(sourceThumb(item), location.href).href;
          image.alt = `${item.file} 缩略图`;
          image.loading = "lazy";
          image.decoding = "async";
          const label = document.createElement("span");
          label.textContent = displayName(item);
          const state = document.createElement("small");
          state.textContent = `${SUBJECTS[item.subject]} · ${item.kind} · ${item.readable ? "高清资料" : "待补高清原图"}`;
          label.append(state);
          preview.append(image, label);
          preview.addEventListener("click", () => openSourceDialog(item, preview));
          const links = document.createElement("div");
          links.className = "source-library-card__links";
          links.append(Object.assign(document.createElement("span"), { textContent: item.id }));
          const topicHref = sourceTopicLink(item);
          if (topicHref) links.append(createLink(topicHref, "对应知识点 →"));
          card.append(preview, links);
          return card;
        }));
        if (empty) empty.hidden = items.length > 0;
      };
      subjectFilter?.addEventListener("change", () => {
        rebuildGroups();
        paint();
      });
      groupFilter?.addEventListener("change", paint);
      statusFilter?.addEventListener("change", paint);
      searchFilter?.addEventListener("input", paint);
      document.querySelector(".source-library-filters")?.addEventListener("reset", () => setTimeout(() => {
        rebuildGroups();
        paint();
      }, 0));
      paint();
    } catch (error) {
      console.warn("原图总库加载失败", error);
      summary.textContent = "原图清单暂时没有载入，请刷新页面重试。";
    }
  }

  const range = document.querySelector("#web-range");
  const rangeOutput = document.querySelector("[data-range-output]");
  const paintRange = () => {
    if (rangeOutput) rangeOutput.textContent = range?.value || "";
  };
  range?.addEventListener("input", paintRange);
  paintRange();

  loadSources().then(mountLearningContext);
  mountSourceLibrary();
})();
