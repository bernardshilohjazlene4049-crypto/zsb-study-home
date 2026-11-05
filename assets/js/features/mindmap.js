const SVG_NS = "http://www.w3.org/2000/svg";

function svg(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

export function buildMindmapNodes(catalog, subjectId) {
  const nodes = [];
  for (const chapter of catalog.chapters.filter((item) => item.subject_id === subjectId)) {
    nodes.push({
      id: chapter.id,
      parentId: chapter.parent_id,
      title: chapter.title,
      kind: "chapter",
      order: chapter.order
    });
  }
  for (const topic of catalog.topics.filter((item) => item.subject_id === subjectId)) {
    nodes.push({
      id: topic.id,
      parentId: topic.chapter_id,
      title: topic.title,
      kind: "topic",
      order: topic.order,
      topicId: topic.id
    });
  }
  return nodes;
}

function treeLayout(nodes, collapsed) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const children = new Map();
  const roots = [];
  for (const node of nodes) {
    if (node.parentId && byId.has(node.parentId)) {
      if (!children.has(node.parentId)) children.set(node.parentId, []);
      children.get(node.parentId).push(node);
    } else roots.push(node);
  }
  const sort = (list) => list.sort((a, b) => (a.order || 0) - (b.order || 0) || a.title.localeCompare(b.title, "zh"));
  roots.sort((a, b) => (a.order || 0) - (b.order || 0));
  for (const list of children.values()) sort(list);
  const placed = [];
  let cursor = 0;
  function walk(node, depth) {
    const kids = collapsed.has(node.id) ? [] : (children.get(node.id) || []);
    if (!kids.length) {
      placed.push({ node, depth, y: cursor });
      cursor += 1;
      return;
    }
    kids.forEach((kid) => walk(kid, depth + 1));
    const kidPositions = placed.filter((item) => kids.some((kid) => kid.id === item.node.id));
    const y = (kidPositions[0].y + kidPositions[kidPositions.length - 1].y) / 2;
    placed.push({ node, depth, y });
  }
  roots.forEach((root) => walk(root, 0));
  return { placed, children };
}

export function mountMindmap(container, nodes, activeId) {
  container.replaceChildren();
  if (!nodes.length) {
    container.append(Object.assign(document.createElement("div"), { className: "empty", textContent: "这个科目还没有可展开的导图节点。" }));
    return;
  }
  const collapsed = new Set();
  let scale = 1;
  let originX = 24;
  let originY = 24;
  const canvas = svg("svg", { class: "mindmap", role: "group", "aria-label": "知识点导图" });
  const viewport = svg("g");
  canvas.append(viewport);

  const toolbar = document.createElement("div");
  toolbar.className = "row";
  const buttons = [
    ["放大", () => { scale = Math.min(2.4, scale * 1.15); draw(); }],
    ["缩小", () => { scale = Math.max(0.45, scale / 1.15); draw(); }],
    ["重置", () => { scale = 1; originX = 24; originY = 24; draw(); }],
    ["全部折叠", () => { nodes.forEach((node) => collapsed.add(node.id)); draw(); }],
    ["全部展开", () => { collapsed.clear(); draw(); }]
  ];
  for (const [label, action] of buttons) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = label;
    button.addEventListener("click", action);
    toolbar.append(button);
  }

  function draw() {
    viewport.replaceChildren();
    viewport.setAttribute("transform", `translate(${originX} ${originY}) scale(${scale})`);
    const { placed, children } = treeLayout(nodes, collapsed);
    const pos = new Map(placed.map((item) => [item.node.id, item]));
    for (const item of placed) {
      for (const child of children.get(item.node.id) || []) {
        if (collapsed.has(item.node.id)) continue;
        const from = pos.get(item.node.id);
        const to = pos.get(child.id);
        if (!from || !to) continue;
        viewport.append(svg("line", {
          x1: from.depth * 210 + 96,
          y1: from.y * 62 + 22,
          x2: to.depth * 210,
          y2: to.y * 62 + 22,
          class: "mind-line"
        }));
      }
    }
    for (const item of placed) {
      const width = Math.min(200, Math.max(108, item.node.title.length * 15 + 28));
      const x = item.depth * 210;
      const y = item.y * 62;
      const group = svg("g", {
        tabindex: "0",
        role: "button",
        "aria-label": item.node.title,
        "data-id": item.node.id
      });
      group.classList.add("mind-node");
      if (item.node.id === activeId) group.classList.add("is-active");
      const rect = svg("rect", { x, y, width, height: 44, rx: 12, class: "mind-card" });
      const text = svg("text", { x: x + 12, y: y + 28 });
      text.textContent = item.node.title;
      group.append(rect, text);
      const kids = children.get(item.node.id) || [];
      if (kids.length) {
        const toggle = svg("text", { x: x + width - 18, y: y + 28, class: "mind-toggle" });
        toggle.textContent = collapsed.has(item.node.id) ? "+" : "–";
        group.append(toggle);
      }
      let pressTimer = 0;
      let moved = false;
      let longPressed = false;
      let startX = 0;
      let startY = 0;
      group.addEventListener("pointerdown", (event) => {
        moved = false;
        longPressed = false;
        startX = event.clientX;
        startY = event.clientY;
        pressTimer = window.setTimeout(() => {
          longPressed = true;
          if (kids.length) {
            if (collapsed.has(item.node.id)) collapsed.delete(item.node.id);
            else collapsed.add(item.node.id);
            draw();
          }
        }, 520);
      });
      group.addEventListener("pointermove", (event) => {
        if (Math.hypot(event.clientX - startX, event.clientY - startY) > 8) {
          moved = true;
          window.clearTimeout(pressTimer);
        }
      });
      const finish = (event) => {
        window.clearTimeout(pressTimer);
        if (longPressed || moved) return;
        if (event.type === "keyup" && event.key !== "Enter" && event.key !== " ") return;
        if (item.node.kind === "topic") location.hash = `#/topic/${item.node.topicId}`;
        else if (kids.length) {
          if (collapsed.has(item.node.id)) collapsed.delete(item.node.id);
          else collapsed.add(item.node.id);
          draw();
        }
      };
      group.addEventListener("pointerup", finish);
      group.addEventListener("keyup", finish);
      viewport.append(group);
    }
  }

  let pan = null;
  canvas.addEventListener("pointerdown", (event) => {
    if (event.target !== canvas) return;
    pan = { x: event.clientX, y: event.clientY, originX, originY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!pan) return;
    originX = pan.originX + (event.clientX - pan.x);
    originY = pan.originY + (event.clientY - pan.y);
    viewport.setAttribute("transform", `translate(${originX} ${originY}) scale(${scale})`);
  });
  canvas.addEventListener("pointerup", () => { pan = null; });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    scale = Math.min(2.4, Math.max(0.45, scale * (event.deltaY < 0 ? 1.08 : 0.92)));
    draw();
  }, { passive: false });

  draw();
  const hint = document.createElement("p");
  hint.className = "muted";
  hint.textContent = "点击知识点进入详情。拖动画布移动，滚轮或按钮缩放。长按节点可折叠或展开。";
  container.append(toolbar, canvas, hint);
}
