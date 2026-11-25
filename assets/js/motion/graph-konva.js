// 08 Konva 交互式知识点关系白板：支持自由拖拽节点、滚轮缩放、画布平移与双击直达讲义
export async function mountKonvaGraph({ container, topic, pre, post, base, colored, getStatus }) {
  const { Konva, Rect, Circle, Text, Arrow } = await import("../vendor/konva.min.js");

  container.replaceChildren();
  const toolbar = document.createElement("div");
  toolbar.className = "gk-toolbar";
  toolbar.innerHTML =
    '<span class="gk-hint">🖐️ 拖拽任意知识点卡片调整布局 · 滚轮缩放 · 双击节点打开讲义</span>' +
    '<button type="button" class="sh-btn gk-reset">重置排布</button>';
  const stageHost = document.createElement("div");
  stageHost.className = "gk-stage-host";
  container.append(toolbar, stageHost);

  const width = Math.max(320, stageHost.clientWidth || container.clientWidth || 720);
  const height = 420;
  const stage = new Konva.Stage({ container: stageHost, width, height, draggable: true });
  const edgeLayer = new Konva.Layer();
  const nodeLayer = new Konva.Layer();
  stage.add(edgeLayer);
  stage.add(nodeLayer);

  const PALETTE = {
    current: { fill: "#1d4ed8", stroke: "#1e3a8a", text: "#ffffff", sub: "#dbeafe" },
    hard: { fill: "#fef2f2", stroke: "#dc2626", text: "#0f172a", sub: "#b91c1c" },
    soft: { fill: "#eff6ff", stroke: "#2563eb", text: "#0f172a", sub: "#1d4ed8" },
    post: { fill: "#ffffff", stroke: "#0f172a", text: "#0f172a", sub: "#475569" }
  };

  const STATUS_DOT = {
    mastered: "#1d4ed8",
    learning: "#3b82f6",
    due: "#dc2626",
    none: "#94a3b8"
  };

  const nodesMeta = [];
  const edgesMeta = [];

  function makeCardNode({ item, x, y, kind, strength, tagText, href }) {
    const pal = kind === "current" ? PALETTE.current : kind === "pre" ? (strength === "hard" ? PALETTE.hard : PALETTE.soft) : PALETTE.post;
    const w = 188, h = 64;
    const grp = new Konva.Group({ x: x - w / 2, y: y - h / 2, draggable: true });
    const bg = new Rect({
      width: w,
      height: h,
      cornerRadius: 14,
      fill: pal.fill,
      stroke: pal.stroke,
      strokeWidth: kind === "current" ? 2.4 : 1.8,
      shadowColor: "rgba(15,23,42,0.14)",
      shadowBlur: 14,
      shadowOffsetY: 5
    });
    const dot = new Circle({
      x: 16,
      y: 22,
      radius: 5,
      fill: kind === "current" ? "#ffffff" : (colored ? STATUS_DOT[getStatus(item.id)] || "#94a3b8" : pal.stroke)
    });
    const titleStr = item.title.length > 13 ? item.title.slice(0, 13) + "…" : item.title;
    const title = new Text({
      x: 28,
      y: 13,
      width: w - 36,
      text: titleStr,
      fontSize: 13,
      fontStyle: "bold",
      fontFamily: "'Microsoft YaHei', system-ui, sans-serif",
      fill: pal.text
    });
    const sub = new Text({
      x: 28,
      y: 37,
      width: w - 36,
      text: tagText,
      fontSize: 11,
      fontFamily: "'Microsoft YaHei', system-ui, sans-serif",
      fill: pal.sub
    });
    grp.add(bg, dot, title, sub);
    grp.on("mouseenter", () => { stageHost.style.cursor = "grab"; });
    grp.on("mouseleave", () => { stageHost.style.cursor = "default"; });
    grp.on("dragmove", updateArrows);
    if (href) {
      grp.on("dblclick dbltap", () => { location.href = href; });
    }
    nodeLayer.add(grp);
    const meta = { grp, w, h, initX: x - w / 2, initY: y - h / 2 };
    nodesMeta.push(meta);
    return meta;
  }

  function buildInitialLayout() {
    nodeLayer.destroyChildren();
    edgeLayer.destroyChildren();
    nodesMeta.length = 0;
    edgesMeta.length = 0;

    const w = stage.width();
    const center = makeCardNode({
      item: topic,
      x: w / 2,
      y: 210,
      kind: "current",
      strength: "hard",
      tagText: "当前知识点（双击进讲义）",
      href: topic.legacy_url ? base + topic.legacy_url : ""
    });

    pre.forEach((e, idx) => {
      const span = Math.min(w - 160, Math.max(220, pre.length * 210));
      const x = pre.length === 1 ? w / 2 : (w - span) / 2 + (idx / (pre.length - 1)) * span;
      const m = makeCardNode({
        item: e.topic,
        x,
        y: 74,
        kind: "pre",
        strength: e.strength,
        tagText: e.strength === "hard" ? "硬先修 · 必先掌握" : "软先修 · 建议先学",
        href: `?topic=${encodeURIComponent(e.topic.id)}`
      });
      const arr = new Arrow({
        points: [0, 0, 0, 0],
        pointerLength: 8,
        pointerWidth: 8,
        fill: e.strength === "hard" ? "#dc2626" : "#2563eb",
        stroke: e.strength === "hard" ? "#dc2626" : "#2563eb",
        strokeWidth: 2.2,
        dash: e.strength === "soft" ? [6, 4] : []
      });
      edgeLayer.add(arr);
      edgesMeta.push({ from: m, to: center, arr });
    });

    post.forEach((e, idx) => {
      const span = Math.min(w - 160, Math.max(220, post.length * 210));
      const x = post.length === 1 ? w / 2 : (w - span) / 2 + (idx / (post.length - 1)) * span;
      const m = makeCardNode({
        item: e.topic,
        x,
        y: 346,
        kind: "post",
        strength: e.strength,
        tagText: "后续进阶知识点",
        href: `?topic=${encodeURIComponent(e.topic.id)}`
      });
      const arr = new Arrow({
        points: [0, 0, 0, 0],
        pointerLength: 8,
        pointerWidth: 8,
        fill: "#1d4ed8",
        stroke: "#1d4ed8",
        strokeWidth: 2.2
      });
      edgeLayer.add(arr);
      edgesMeta.push({ from: center, to: m, arr });
    });

    updateArrows();
    nodeLayer.draw();
  }

  function updateArrows() {
    for (const { from, to, arr } of edgesMeta) {
      const fx = from.grp.x() + from.w / 2;
      const fy = from.grp.y() + from.h;
      const tx = to.grp.x() + to.w / 2;
      const ty = to.grp.y() - 4;
      arr.points([fx, fy, tx, ty]);
    }
    edgeLayer.batchDraw();
  }

  stage.on("wheel", (e) => {
    e.evt.preventDefault();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    const scaleBy = 1.06;
    const newScale = Math.max(0.6, Math.min(1.8, e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy));
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale
    };
    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    });
  });

  toolbar.querySelector(".gk-reset")?.addEventListener("click", () => {
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    for (const m of nodesMeta) m.grp.position({ x: m.initX, y: m.initY });
    updateArrows();
    nodeLayer.batchDraw();
  });

  buildInitialLayout();
  const ro = new ResizeObserver(() => {
    const nw = stageHost.clientWidth;
    if (nw > 120) stage.width(nw);
  });
  ro.observe(stageHost);

  return { destroy: () => { ro.disconnect(); stage.destroy(); } };
}
