import { siteUrl } from "./core/paths.js";

const VISUAL = [
  { no: "01F", glyph: "↗", color: "#6fae9e", ids: ["network"] },
  { no: "02F", glyph: "</>", color: "#c39a72", ids: ["web_design"] },
  { no: "03F", glyph: "DB", color: "#9c91c9", ids: ["database"] },
  { no: "04F", glyph: "C", color: "#85a7d1", ids: ["c_language"] },
  { no: "05F", glyph: "⌘", color: "#7f9fc4", ids: ["computer_basics"] },
  { no: "06F", glyph: "∑", color: "#79aaa7", ids: ["english", "math"], name: "英语 / 高等数学", sub: "公共课 · 语言与数学" },
  { no: "07F", glyph: "◎", color: "#a7b9d4", ids: [], name: "学习总控", sub: "计划 · 错题 · 本机记录", overview: true }
];

const el = (id) => document.getElementById(id);
let floors = [];
let selected = 3;
let zoom = 1;
let lowMode = false;
let frame = 0;
let raf = 0;
let hitboxes = [];
let canvas;
let ctx;
let centerX = 0;
let centerY = 0;
let renderScale = 1;

const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const lowHardware = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
  || (navigator.deviceMemory && navigator.deviceMemory <= 4);
lowMode = Boolean(reduced || lowHardware || window.innerWidth < 600);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function studyHref(hash) {
  return `../study/index.html${hash}`;
}

function topicTitles(topicsDoc, subjectId) {
  return (topicsDoc.topics || [])
    .filter((topic) => topic.subject_id === subjectId)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .slice(0, 6)
    .map((topic) => topic.title);
}

function buildFloors(subjectsDoc, topicsDoc) {
  const byId = new Map((subjectsDoc.subjects || []).map((subject) => [subject.id, subject]));
  return VISUAL.map((visual) => {
    const linked = visual.ids.map((id) => byId.get(id)).filter(Boolean);
    const first = linked[0];
    const live = linked.length > 0 && linked.every((subject) => subject.status === "live" && subject.homeUrl);
    let topics = [];
    if (visual.overview) {
      topics = ["错题与复习", "设置与数据备份", "七科目录", "任务服务尚未实现"];
    } else {
      topics = linked.flatMap((subject) => {
        const titles = topicTitles(topicsDoc, subject.id);
        if (!titles.length) return [`${subject.name}：还没有章节`];
        return visual.ids.length > 1 ? titles.map((title) => `${subject.name}：${title}`) : titles;
      }).slice(0, 6);
    }
    return {
      ...visual,
      name: visual.name || first?.name || visual.ids[0] || "科目",
      sub: visual.sub || `${first?.group || "科目"} · ${live ? "已有科目页面" : "建设中"}`,
      desc: visual.overview
        ? "这一层只打开学习工作台。任务服务尚未实现，没有机器人在运行。"
        : (linked.map((subject) => subject.summary).filter(Boolean).join(" ") || "目录来自 data/subjects.json。"),
      topics: topics.length ? topics : ["还没有章节"],
      subjectIds: visual.ids
    };
  });
}

function drawFloorLists() {
  const markup = floors.slice().reverse().map((floor, index) => {
    const floorIndex = floors.length - 1 - index;
    return `<button class="floor-btn ${floorIndex === selected ? "active" : ""}" type="button" data-floor="${floorIndex}"><span class="floor-no">${esc(floor.no)}</span><span><span class="floor-name">${esc(floor.name)}</span><span class="floor-sub">${esc(floor.sub)}</span></span></button>`;
  }).join("");
  el("floorList").innerHTML = markup;
  el("mobileFloors").innerHTML = markup;
  document.querySelectorAll("[data-floor]").forEach((button) => {
    button.addEventListener("click", () => selectFloor(Number(button.dataset.floor)));
  });
}

function selectFloor(index) {
  selected = Math.max(0, Math.min(floors.length - 1, index));
  drawFloorLists();
  drawDetail();
  drawTower();
}

function drawDetail() {
  const floor = floors[selected];
  const links = floor.overview
    ? `<a class="detail-action" href="${studyHref("#/home")}">打开学习工作台 ↗</a>`
    : floor.subjectIds.map((id) => {
      const name = floors.flatMap((item) => item.subjectIds.includes(id) ? [item] : []).length
        ? (id === "english" ? "英语" : id === "math" ? "高等数学" : floor.name)
        : floor.name;
      const label = floor.subjectIds.length > 1 ? `打开${name}学习入口 ↗` : "查看该科目学习入口 ↗";
      return `<a class="detail-action" href="${studyHref(`#/subjects/${encodeURIComponent(id)}`)}">${esc(label)}</a>`;
    }).join("");
  el("detailPanel").innerHTML = `<div class="detail-top"><span>FLOOR DETAIL</span><span class="floor-badge">${esc(floor.no)}</span></div>
    <div class="detail-grid"><div class="detail-icon" style="color:${floor.color};border-color:${floor.color}33;background:${floor.color}15">${esc(floor.glyph)}</div><div><h2>${esc(floor.name)}</h2><p class="detail-desc">${esc(floor.desc)}</p></div></div>
    <div class="detail-section"><h3>学习内容</h3>${floor.topics.map((topic) => `<div class="detail-item"><i class="item-dot" style="background:${floor.color}"></i><span>${esc(topic)}</span></div>`).join("")}</div>
    <div class="detail-section"><h3>当前状态</h3>
      <div class="robot-card"><div class="robot-avatar">—</div><div><strong>没有机器人</strong><small>任务服务尚未实现</small></div><span class="state-label">未连接</span></div>
      <div class="detail-item"><i class="item-dot"></i><span>本地楼层可以点选。没有机器人在运行，也不会显示伪造的学习进度。</span></div>
    </div>
    <div class="floor-link-group">${links}</div>`;
}

function setupCanvas() {
  canvas = el("towerCanvas");
  ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!ctx) {
    el("renderMode").textContent = "渲染模式：楼层列表（Canvas 不可用）";
    return false;
  }
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, lowMode ? 1 : 1.5);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTower();
  };
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener("resize", resize);
  resize();
  canvas.style.cursor = "pointer";
  canvas.addEventListener("click", onCanvasClick);
  return true;
}

function project(x, y, z) {
  const scale = zoom * renderScale;
  return { x: centerX + (x - y) * 112 * scale, y: centerY + (x + y) * 42 * scale - z * 39 * scale };
}

function poly(points, fill, stroke = "rgba(185,215,243,.20)", lineWidth = 1) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function line(a, b, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function roundRect(x, y, w, h, radius, fill, stroke) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, radius);
  else ctx.rect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawRobot(x, y, z, color, phase = 0) {
  const point = project(x, y, z);
  const bob = lowMode ? 0 : Math.sin(frame * 0.035 + phase) * 2;
  ctx.save();
  ctx.translate(point.x, point.y + bob);
  ctx.fillStyle = "rgba(0,0,0,.24)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  roundRect(-6, -1, 12, 10, 4, "rgba(117,158,198,.9)", "rgba(222,239,255,.35)");
  roundRect(-7, -11, 14, 12, 5, color, "rgba(237,247,255,.58)");
  ctx.fillStyle = "rgba(244,250,255,.9)";
  ctx.beginPath();
  ctx.arc(-3, -6, 1.1, 0, Math.PI * 2);
  ctx.arc(3, -6, 1.1, 0, Math.PI * 2);
  ctx.fill();
  line({ x: -3, y: 1 }, { x: -5, y: 6 }, "rgba(216,232,248,.65)", 1.8);
  line({ x: 3, y: 1 }, { x: 5, y: 6 }, "rgba(216,232,248,.65)", 1.8);
  ctx.restore();
}

function drawTower() {
  if (!ctx) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 2 || h < 2) return;
  ctx.clearRect(0, 0, w, h);
  renderScale = Math.min(1, Math.max(0.42, (w - 88) / (448 * 1.12)));
  const scale = zoom * renderScale;
  const towerWidth = 448 * scale + 62;
  centerX = (w - towerWidth) / 2 + 224 * scale;
  centerY = h * 0.67;
  const grad = ctx.createRadialGradient(w * 0.48, h * 0.47, 10, w * 0.48, h * 0.47, Math.max(w, h) * 0.62);
  grad.addColorStop(0, "rgba(75,116,162,.17)");
  grad.addColorStop(1, "rgba(8,17,30,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const starCount = lowMode ? 12 : 36;
  for (let index = 0; index < starCount; index += 1) {
    const x = (index * 97) % Math.max(1, w);
    const y = (index * 53) % Math.max(1, h);
    ctx.fillStyle = `rgba(190,215,241,${0.07 + (index % 4) * 0.02})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.save();
  ctx.translate(centerX, centerY + 18);
  ctx.scale(1, 0.38);
  ctx.beginPath();
  ctx.ellipse(0, 0, 245 * scale, 160 * scale, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(51,83,119,.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(125,167,210,.10)";
  ctx.stroke();
  ctx.restore();
  hitboxes = [];
  const height = 39;
  for (let index = 0; index < floors.length; index += 1) {
    const z = index * height;
    const active = index === selected;
    const floor = floors[index];
    const p00 = project(-1, -1, z);
    const p10 = project(1, -1, z);
    const p11 = project(1, 1, z);
    const p01 = project(-1, 1, z);
    const q00 = project(-1, -1, z + height);
    const q10 = project(1, -1, z + height);
    const q11 = project(1, 1, z + height);
    const q01 = project(-1, 1, z + height);
    poly([p00, p10, q10, q00], active ? "rgba(112,163,213,.17)" : "rgba(112,158,198,.075)", "rgba(179,213,242,.20)", 1);
    poly([p00, p01, q01, q00], active ? "rgba(100,151,197,.15)" : "rgba(112,158,198,.055)", "rgba(179,213,242,.16)", 1);
    poly([p00, p10, p11, p01], active ? "rgba(128,172,214,.20)" : "rgba(117,154,190,.085)", active ? "rgba(184,218,248,.62)" : "rgba(168,201,230,.23)", active ? 1.5 : 1);
    poly([p10, p11, q11, q10], active ? "rgba(114,166,212,.10)" : "rgba(114,163,204,.045)", "rgba(182,214,242,.18)", 1);
    poly([p01, p11, q11, q01], active ? "rgba(114,166,212,.09)" : "rgba(114,163,204,.035)", "rgba(182,214,242,.15)", 1);
    hitboxes.push({ i: index, poly: [p00, p10, p11, p01] }, { i: index, poly: [p10, p11, q11, q10] }, { i: index, poly: [p01, p11, q11, q01] });
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([x, y]) => line(project(x, y, z), project(x, y, z + height), active ? "rgba(196,224,249,.72)" : "rgba(165,201,232,.33)", active ? 2 : 1.2));
    const desk = project(-0.28, 0.12, z + 5);
    roundRect(desk.x - 11, desk.y - 3, 23, 7, 2, "rgba(165,190,214,.24)", "rgba(220,237,251,.2)");
    line({ x: desk.x - 7, y: desk.y + 4 }, { x: desk.x - 7, y: desk.y + 9 }, "rgba(194,216,236,.35)", 1);
    line({ x: desk.x + 7, y: desk.y + 4 }, { x: desk.x + 7, y: desk.y + 9 }, "rgba(194,216,236,.35)", 1);
    const monitor = project(-0.2, 0.1, z + 13);
    roundRect(monitor.x - 5, monitor.y - 5, 10, 7, 1, "rgba(93,135,180,.65)", "rgba(211,232,251,.35)");
    if (!lowMode || active) drawRobot(0.35, 0.12, z + 10, floor.color, index * 0.8);
    const labelX = p10.x + 14;
    const labelY = (p10.y + p11.y) / 2 - 8;
    roundRect(labelX, labelY, 48, 18, 6, active ? "rgba(118,165,213,.30)" : "rgba(14,29,47,.82)", active ? "rgba(174,211,245,.55)" : "rgba(157,193,224,.25)");
    ctx.fillStyle = active ? "#e6f3ff" : "#a7bad0";
    ctx.font = '600 9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(floor.no, labelX + 24, labelY + 9);
    hitboxes.push({ i: index, x: labelX - 3, y: labelY - 4, w: 55, h: 26 });
  }
  const roofZ = floors.length * height;
  poly([project(-1, -1, roofZ), project(1, -1, roofZ), project(1, 1, roofZ), project(-1, 1, roofZ)], "rgba(153,194,230,.15)", "rgba(207,231,250,.45)", 1.4);
  const top = project(0, 0, roofZ + 25);
  line(project(0, 0, roofZ), top, "rgba(185,219,246,.45)", 1.2);
  ctx.beginPath();
  ctx.arc(top.x, top.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#9bc5e9";
  ctx.fill();
  ctx.strokeStyle = "rgba(173,211,242,.09)";
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + 8, 240 * scale, 95 * scale, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const a = points[index];
    const b = points[previous];
    const crosses = ((a.y > y) !== (b.y > y)) && (x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y + 1e-9) + a.x);
    if (crosses) inside = !inside;
  }
  return inside;
}

function onCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  for (let index = hitboxes.length - 1; index >= 0; index -= 1) {
    const hit = hitboxes[index];
    const matched = hit.poly ? pointInPolygon(x, y, hit.poly) : (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h);
    if (matched) {
      selectFloor(hit.i);
      return;
    }
  }
}

function setRenderMode() {
  const mode = el("renderMode");
  const toggle = el("performanceToggle");
  if (mode) mode.textContent = `渲染模式：${lowMode ? "节能静态" : "动态 Canvas"}`;
  if (toggle) {
    toggle.textContent = reduced ? "动态效果：按系统设置关闭" : `节能渲染：${lowMode ? "开启" : "关闭"}`;
    toggle.disabled = Boolean(reduced);
    toggle.title = reduced ? "系统已启用减少动态效果，保持静态渲染。" : "切换动态与节能渲染";
  }
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  drawTower();
  if (!lowMode && ctx) {
    const loop = () => {
      frame += 1;
      drawTower();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }
}

function bindControls() {
  el("performanceToggle").addEventListener("click", () => {
    if (reduced) return;
    lowMode = !lowMode;
    setRenderMode();
  });
  el("zoomIn").addEventListener("click", () => {
    zoom = Math.min(1.12, zoom + 0.08);
    drawTower();
  });
  el("zoomOut").addEventListener("click", () => {
    zoom = Math.max(0.72, zoom - 0.08);
    drawTower();
  });
  el("resetView").addEventListener("click", () => {
    zoom = 1;
    selectFloor(3);
  });
}

async function loadJson(path) {
  const response = await fetch(siteUrl(path));
  if (!response.ok) throw new Error(`无法读取 ${path}`);
  return response.json();
}

async function init() {
  try {
    const [subjectsDoc, topicsDoc] = await Promise.all([
      loadJson("data/subjects.json"),
      loadJson("data/topics.json")
    ]);
    floors = buildFloors(subjectsDoc, topicsDoc);
  } catch (error) {
    floors = buildFloors({ subjects: VISUAL.filter((item) => item.ids.length === 1).map((item) => ({ id: item.ids[0], name: item.ids[0], group: "科目", status: "building", summary: "目录暂时没有载入。" })) }, { topics: [] });
    const mode = el("renderMode");
    if (mode) mode.textContent = error.message || "目录没有载入";
  }
  bindControls();
  drawFloorLists();
  drawDetail();
  const ready = setupCanvas();
  if (ready) setRenderMode();
}

init();
