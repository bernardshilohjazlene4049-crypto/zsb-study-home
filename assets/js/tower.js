import { siteUrl } from "./core/paths.js";

const VISUAL = [
  { no: "01F", glyph: "↗", color: "#6fae9e", ids: ["network"], label: "计算机网络", mobile: "网络" },
  { no: "02F", glyph: "</>", color: "#c39a72", ids: ["web_design"], label: "网页设计", mobile: "网页" },
  { no: "03F", glyph: "DB", color: "#9c91c9", ids: ["database"], label: "数据库", mobile: "数据库" },
  { no: "04F", glyph: "C", color: "#85a7d1", ids: ["c_language"], label: "C 语言", mobile: "C语言" },
  { no: "05F", glyph: "⌘", color: "#7f9fc4", ids: ["computer_basics"], label: "计算机基础", mobile: "计算机" },
  { no: "06F", glyph: "∑", color: "#79aaa7", ids: ["english", "math"], name: "英语 / 高等数学", sub: "公共课 · 语言与数学", label: "公共课", mobile: "公共课" },
  { no: "07F", glyph: "◎", color: "#a7b9d4", ids: [], name: "学习总控", sub: "计划 · 错题 · 本机记录", overview: true, label: "学习总控", mobile: "总控" }
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
let actualScale = 1;
let labelWidth = 90;
let lastPaint = 0;
const TOWER_METRICS = { floorHeight: 43, roofTop: 7 * 43, deckThickness: 7, isoX: 112, isoY: 47 };

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
      topics = ["错题与复习", "设置与数据", "七科目录"];
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
      sub: live || visual.overview ? "" : "即将开放",
      desc: "",
      topics: topics.length ? topics : ["还没有章节"],
      subjectIds: visual.ids
    };
  });
}

function drawFloorLists() {
  const markup = floors.slice().reverse().map((floor, index) => {
    const floorIndex = floors.length - 1 - index;
    return `<button class="floor-btn ${floorIndex === selected ? "active" : ""}" type="button" data-floor="${floorIndex}"><span class="floor-no">${esc(floor.no)}</span><span><span class="floor-name">${esc(floor.name)}</span>${floor.sub ? `<span class="floor-sub">${esc(floor.sub)}</span>` : ""}</span></button>`;
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
  el("detailPanel").innerHTML = `<div class="detail-top"><span>当前楼层</span><span class="floor-badge">${esc(floor.no)}</span></div>
    <div class="detail-grid"><div class="detail-icon" style="color:${floor.color};border-color:${floor.color}33;background:${floor.color}15">${esc(floor.glyph)}</div><div><h2>${esc(floor.name)}</h2>${floor.sub ? `<p class="detail-desc">${esc(floor.sub)}</p>` : ""}</div></div>
    <div class="detail-section"><h3>学习内容</h3>${floor.topics.map((topic) => `<div class="detail-item"><i class="item-dot" style="background:${floor.color}"></i><span>${esc(topic)}</span></div>`).join("")}</div>
    <div class="floor-link-group">${links}</div>`;
}

function setupCanvas() {
  canvas = el("towerCanvas");
  try {
    ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
  } catch {
    ctx = null;
  }
  if (!ctx) {
    canvas.style.display = "none";
    const fallback = document.createElement("div");
    fallback.style.cssText = "position:absolute;inset:34% 12% auto;text-align:center;line-height:1.9;color:#d4e5f7;font-size:12px";
    fallback.textContent = "请用下方列表选择科目。";
    canvas.parentElement.appendChild(fallback);
    const mode = el("renderMode");
    if (mode) mode.textContent = "";
    return false;
  }
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, lowMode ? 1 : 1.65);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
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
  return {
    x: centerX + (x - y) * TOWER_METRICS.isoX * actualScale,
    y: centerY + (x + y) * TOWER_METRICS.isoY * actualScale - z * actualScale
  };
}

function pathPoly(points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
  ctx.closePath();
}

function rgba(hex, alpha) {
  const value = hex.replace("#", "");
  return `rgba(${parseInt(value.slice(0, 2), 16)},${parseInt(value.slice(2, 4), 16)},${parseInt(value.slice(4, 6), 16)},${alpha})`;
}

function poly(points, fill, stroke = "rgba(185,215,243,.20)", lineWidth = 1) {
  pathPoly(points);
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
  const bob = lowMode ? 0 : Math.sin(frame * 0.042 + phase) * 1.4;
  const figure = Math.max(0.65, Math.min(1, actualScale));
  ctx.save();
  ctx.translate(point.x, point.y + bob);
  ctx.scale(figure, figure);
  ctx.fillStyle = "rgba(4,15,27,.39)";
  ctx.beginPath();
  ctx.ellipse(0, 8, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  roundRect(-5.5, -1, 11, 9, 3.8, "rgba(113,156,192,.88)", "rgba(205,231,250,.42)");
  roundRect(-7, -12, 14, 12, 5, color, "rgba(239,248,255,.72)");
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.beginPath();
  ctx.arc(-3, -7, 1.05, 0, Math.PI * 2);
  ctx.arc(3, -7, 1.05, 0, Math.PI * 2);
  ctx.fill();
  line({ x: -3, y: 5 }, { x: -4.5, y: 8 }, "rgba(218,238,252,.83)", 2);
  line({ x: 3, y: 5 }, { x: 4.5, y: 8 }, "rgba(218,238,252,.83)", 2);
  ctx.restore();
}

function drawDesk(x, y, z) {
  const point = project(x, y, z);
  const monitor = project(x + 0.12, y - 0.05, z + 8);
  roundRect(point.x - 11 * actualScale, point.y - 4 * actualScale, 24 * actualScale, 7 * actualScale, 2, "rgba(16,37,56,.76)", "rgba(183,215,239,.43)");
  line({ x: point.x - 8 * actualScale, y: point.y + 3 * actualScale }, { x: point.x - 8 * actualScale, y: point.y + 10 * actualScale }, "rgba(136,184,217,.65)", 1.2);
  line({ x: point.x + 8 * actualScale, y: point.y + 3 * actualScale }, { x: point.x + 8 * actualScale, y: point.y + 10 * actualScale }, "rgba(136,184,217,.65)", 1.2);
  roundRect(monitor.x - 6 * actualScale, monitor.y - 5 * actualScale, 12 * actualScale, 8 * actualScale, 1.5, "rgba(29,79,103,.90)", "rgba(144,231,244,.60)");
}

function drawFloorDeck(index, baseZ, color, selectedFloor) {
  const depth = TOWER_METRICS.deckThickness;
  const p00 = project(-1, -1, baseZ);
  const p10 = project(1, -1, baseZ);
  const p11 = project(1, 1, baseZ);
  const p01 = project(-1, 1, baseZ);
  const b10 = project(1, -1, baseZ - depth);
  const b11 = project(1, 1, baseZ - depth);
  const b01 = project(-1, 1, baseZ - depth);
  const eastSide = ctx.createLinearGradient(p10.x, p10.y, b11.x, b11.y);
  eastSide.addColorStop(0, "rgba(95,149,199,.78)");
  eastSide.addColorStop(0.45, rgba(color, selectedFloor ? 0.75 : 0.54));
  eastSide.addColorStop(1, "rgba(19,54,89,.88)");
  poly([p10, p11, b11, b10], eastSide, selectedFloor ? "rgba(196,233,255,.90)" : "rgba(142,205,240,.67)", selectedFloor ? 2 : 1.15);
  const southSide = ctx.createLinearGradient(p01.x, p01.y, b11.x, b11.y);
  southSide.addColorStop(0, "rgba(67,120,162,.78)");
  southSide.addColorStop(0.65, rgba(color, selectedFloor ? 0.70 : 0.51));
  southSide.addColorStop(1, "rgba(14,38,65,.91)");
  poly([p01, p11, b11, b01], southSide, selectedFloor ? "rgba(184,226,252,.93)" : "rgba(124,187,232,.65)", selectedFloor ? 2 : 1.15);
  const glass = ctx.createLinearGradient(p00.x, p00.y, p11.x, p11.y);
  glass.addColorStop(0, rgba(color, selectedFloor ? 0.47 : 0.30));
  glass.addColorStop(0.44, selectedFloor ? "rgba(87,150,199,.52)" : "rgba(58,112,157,.45)");
  glass.addColorStop(1, selectedFloor ? "rgba(107,170,213,.69)" : "rgba(83,144,192,.59)");
  poly([p00, p10, p11, p01], glass, selectedFloor ? "rgba(220,245,255,.86)" : "rgba(155,211,244,.57)", selectedFloor ? 1.8 : 1.05);
  if (!lowMode) {
    ctx.save();
    pathPoly([p00, p10, p11, p01]);
    ctx.clip();
    for (const value of [-0.47, 0.05, 0.52]) {
      line(project(value, -0.94, baseZ + 0.22), project(value, 0.94, baseZ + 0.22), selectedFloor ? "rgba(202,231,247,.20)" : "rgba(189,223,246,.13)", 0.8);
      line(project(-0.94, value, baseZ + 0.22), project(0.94, value, baseZ + 0.22), selectedFloor ? "rgba(202,231,247,.17)" : "rgba(181,217,240,.11)", 0.8);
    }
    ctx.restore();
  }
  line(p01, p11, selectedFloor ? "rgba(225,246,255,.98)" : "rgba(157,213,250,.83)", selectedFloor ? 2.3 : 1.45);
  line(p11, p10, selectedFloor ? "rgba(225,246,255,.98)" : "rgba(162,218,249,.83)", selectedFloor ? 2.3 : 1.45);
  line(p00, p10, selectedFloor ? "rgba(173,222,246,.64)" : "rgba(149,205,239,.35)", 0.95);
  line(p00, p01, selectedFloor ? "rgba(173,222,246,.64)" : "rgba(149,205,239,.35)", 0.95);
  if (selectedFloor && !lowMode) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.shadowColor = rgba(color, 0.85);
    ctx.shadowBlur = 13;
    line(p01, p11, rgba(color, 0.85), 1.7);
    line(p11, p10, rgba(color, 0.85), 1.7);
    ctx.restore();
  }
}

function drawLevelLabel(index, p10, p11, color, isSelected, width) {
  const floor = floors[index];
  const mobile = width < 560;
  const box = mobile ? 73 : 100;
  const labelX = p10.x + 9 * actualScale + 4;
  const labelY = (p10.y + p11.y) / 2 - 12;
  const displayName = mobile ? floor.mobile : floor.label;
  const lineY = labelY + 12;
  line({ x: p10.x + 2, y: lineY }, { x: labelX - 3, y: lineY }, isSelected ? "rgba(198,230,254,.89)" : "rgba(143,195,231,.60)", 1.15);
  if (isSelected && !lowMode) {
    ctx.save();
    ctx.shadowColor = rgba(color, 0.65);
    ctx.shadowBlur = 13;
    roundRect(labelX, labelY, box, 25, 7, "rgba(16,38,65,.97)", rgba(color, 0.92));
    ctx.restore();
  } else {
    roundRect(labelX, labelY, box, 25, 7, "rgba(9,27,48,.94)", isSelected ? "rgba(185,231,255,.85)" : "rgba(135,188,230,.44)");
  }
  ctx.fillStyle = color;
  ctx.fillRect(labelX + 1.5, labelY + 5, 2.5, 15);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = isSelected ? "#f6fbff" : "#d5e5f5";
  ctx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(floor.no, labelX + 9, labelY + 12.5);
  ctx.fillStyle = isSelected ? "#eaf4ff" : "#a5bdd5";
  ctx.font = `${isSelected ? "650" : "500"} ${mobile ? 8.5 : 9}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillText(displayName, labelX + (mobile ? 34 : 37), labelY + 12.5, mobile ? 37 : 59);
  hitboxes.push({ i: index, x: labelX - 5, y: labelY - 5, w: box + 10, h: 35 });
}

function drawTower() {
  if (!ctx) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  ctx.clearRect(0, 0, w, h);
  labelWidth = w < 560 ? 73 : 100;
  const metric = TOWER_METRICS;
  const fullHeight = metric.roofTop + metric.isoY * 4;
  const topSafe = w < 560 ? 81 : 94;
  const bottomSafe = w < 560 ? 40 : 52;
  const maxScaleWidth = (w - labelWidth - 40) / (metric.isoX * 4);
  const maxScaleHeight = (h - topSafe - bottomSafe) / fullHeight;
  renderScale = Math.max(0.38, Math.min(1.28, maxScaleWidth, maxScaleHeight));
  actualScale = renderScale * zoom;
  const totalWidth = metric.isoX * 4 * actualScale + labelWidth + 14 * actualScale + 17;
  centerX = (w - totalWidth) / 2 + metric.isoX * 2 * actualScale + 3;
  const projectedTop = (metric.roofTop + metric.isoY * 2) * actualScale;
  const projectedBottom = metric.isoY * 2 * actualScale;
  const towerHeight = projectedTop + projectedBottom;
  centerY = topSafe + (h - topSafe - bottomSafe - towerHeight) / 2 + projectedTop;
  const glow = ctx.createRadialGradient(centerX, centerY - 105 * actualScale, 14, centerX, centerY - 105 * actualScale, 260 * actualScale);
  glow.addColorStop(0, "rgba(88,143,189,.19)");
  glow.addColorStop(0.55, "rgba(44,91,142,.075)");
  glow.addColorStop(1, "rgba(14,28,45,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(centerX, centerY + 16 * actualScale);
  ctx.scale(1, 0.38);
  ctx.beginPath();
  ctx.ellipse(0, 0, 252 * actualScale, 166 * actualScale, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(63,121,175,.16)";
  ctx.fill();
  ctx.strokeStyle = "rgba(136,190,235,.19)";
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.restore();
  hitboxes = [];
  for (let index = 0; index < floors.length; index += 1) {
    const floor = floors[index];
    const active = index === selected;
    const z = index * metric.floorHeight;
    const p00 = project(-1, -1, z);
    const p10 = project(1, -1, z);
    const p11 = project(1, 1, z);
    const p01 = project(-1, 1, z);
    const q00 = project(-1, -1, z + metric.floorHeight);
    const q10 = project(1, -1, z + metric.floorHeight);
    const q11 = project(1, 1, z + metric.floorHeight);
    const q01 = project(-1, 1, z + metric.floorHeight);
    poly([p00, p10, q10, q00], active ? "rgba(113,164,210,.11)" : "rgba(117,169,206,.065)", "rgba(148,198,236,.22)", 1);
    poly([p00, p01, q01, q00], active ? "rgba(82,139,185,.105)" : "rgba(91,150,194,.05)", "rgba(141,192,230,.17)", 0.95);
    drawFloorDeck(index, z, floor.color, active);
    drawDesk(-0.45, -0.22, z + 4);
    drawRobot(0.23, -0.10, z + 9, floor.color, index * 1.3);
    if (!lowMode) drawRobot(0.0, 0.48, z + 8, "#9bbad6", index * 0.9 + 1.1);
    poly([p10, p11, q11, q10], active ? "rgba(125,177,219,.12)" : "rgba(103,167,214,.055)", "rgba(145,196,236,.30)", 0.9);
    poly([p01, p11, q11, q01], active ? "rgba(122,176,211,.11)" : "rgba(101,161,199,.048)", "rgba(144,196,235,.24)", 0.9);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([x, y]) => line(project(x, y, z), project(x, y, z + metric.floorHeight), active ? "rgba(195,228,251,.66)" : "rgba(130,190,227,.40)", active ? 1.55 : 1.05));
    line(p01, p11, active ? "rgba(218,246,255,.98)" : "rgba(157,211,246,.88)", active ? 2.5 : 1.55);
    line(p11, p10, active ? "rgba(218,246,255,.98)" : "rgba(157,211,246,.88)", active ? 2.5 : 1.55);
    hitboxes.push({ i: index, poly: [p00, p10, p11, p01] }, { i: index, poly: [p10, p11, q11, q10] }, { i: index, poly: [p01, p11, q11, q01] });
    drawLevelLabel(index, p10, p11, floor.color, active, w);
  }
  const roofZ = metric.roofTop;
  const roof = [project(-1, -1, roofZ), project(1, -1, roofZ), project(1, 1, roofZ), project(-1, 1, roofZ)];
  const roofGrad = ctx.createLinearGradient(roof[0].x, roof[0].y, roof[2].x, roof[2].y);
  roofGrad.addColorStop(0, "rgba(139,191,233,.25)");
  roofGrad.addColorStop(1, "rgba(93,163,216,.43)");
  poly(roof, roofGrad, "rgba(178,222,251,.72)", 1.5);
  const roofHub = project(0, 0, roofZ);
  const antenna = project(0, 0, roofZ + 16);
  line(roofHub, antenna, "rgba(182,230,255,.76)", 1.4);
  ctx.beginPath();
  ctx.arc(antenna.x, antenna.y, 2.7, 0, Math.PI * 2);
  ctx.fillStyle = "#b2e0fd";
  ctx.fill();
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
  if (mode) mode.textContent = "";
  if (toggle) {
    toggle.textContent = reduced ? "已跟随系统减少动画" : `减少动画：${lowMode ? "开" : "关"}`;
    toggle.disabled = Boolean(reduced);
    toggle.title = reduced ? "已跟随系统减少动画" : "开关楼层动画";
  }
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  drawTower();
  if (!lowMode && ctx) {
    const animate = (timestamp) => {
      if (document.hidden) {
        raf = 0;
        return;
      }
      if (timestamp - lastPaint > 40) {
        frame += 1;
        drawTower();
        lastPaint = timestamp;
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
  }
}

function bindControls() {
  el("performanceToggle").addEventListener("click", () => {
    if (reduced) return;
    lowMode = !lowMode;
    setRenderMode();
  });
  el("zoomIn").addEventListener("click", () => {
    zoom = Math.min(1.18, zoom + 0.08);
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
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else if (ctx) setRenderMode();
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
