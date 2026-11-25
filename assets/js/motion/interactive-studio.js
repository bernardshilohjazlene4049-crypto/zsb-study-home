// 动态原理图解与知识讲解工作台：
// Tab 1: Two.js 实时二维几何与盒模型矢量图解 (07)
// Tab 2: Motion Canvas / Remotion 风格分镜同步时间轴讲解器 + gifenc 浏览器实时导出 GIF (10/11/13)
// Tab 3: Python Manim 理工科公式/位运算/指针精渲动图展映 (12)
import { el } from "../shell/ui.js";

const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const TWO_SCENES = [
  {
    id: "math-riemann",
    subject: "math",
    badge: "高等数学",
    title: "导数切线斜率与定积分黎曼矩形逼近",
    desc: "调节分割区间数 n 与切点位置 x₀，直观观察黎曼和如何逼近曲边梯形面积，以及导数作为切线斜率的几何意义。",
    sliderA: { label: "矩形分割数 n", min: 4, max: 24, value: 10, step: 2 },
    sliderB: { label: "切点横坐标 x₀ (%)", min: 15, max: 85, value: 55, step: 5 },
    href: "gs/gs1.html"
  },
  {
    id: "web-box",
    subject: "web_design",
    badge: "网页设计",
    title: "CSS 盒模型：content-box 与 border-box 实时对比",
    desc: "同样声明 width: 180px，拖动内边距 padding 与边框 border，直观对比标准盒（外扩）与怪异/IE 盒（内缩保持总宽不变）。",
    sliderA: { label: "内边距 padding (px)", min: 4, max: 32, value: 18, step: 2 },
    sliderB: { label: "边框 border (px)", min: 2, max: 14, value: 6, step: 2 },
    href: "wy/css/box.html"
  },
  {
    id: "net-mtu",
    subject: "network",
    badge: "计算机网络",
    title: "IPv4 数据报 MTU 分片切割与片偏移（÷8B）",
    desc: "原始总长 3820B（首部 20B + 数据 3800B），调节链路 MTU，实时计算每片数据载荷（8 字节整数倍）、MF 标志与片偏移。",
    sliderA: { label: "链路 MTU (字节)", min: 620, max: 1500, value: 1420, step: 80 },
    sliderB: { label: "原始数据长度 (字节)", min: 1800, max: 4200, value: 3800, step: 200 },
    href: "wl/ch4/s42.html"
  }
];

const EXPLAINER_CLIPS = [
  {
    id: "ptr-swap",
    subject: "c_language",
    title: "C 语言 · 指针传参 swap(&a, &b) 栈帧解引用全过程",
    steps: [
      { t: 0.25, sub: "① 主函数栈帧：变量 a = 3 (0x100)、b = 8 (0x104)，调用 swap(&a, &b) 传入地址。" },
      { t: 0.55, sub: "② 形参指针 px = 0x100、py = 0x104 指向主调函数原内存单元，执行 temp = *px = 3。" },
      { t: 0.80, sub: "③ 解引用回写：*px = *py 将 8 写入 0x100；*py = temp 将 3 写入 0x104。" },
      { t: 1.00, sub: "④ swap 栈帧销毁返回，主函数原变量成功完成交换：a = 8, b = 3！" }
    ]
  },
  {
    id: "route-lpm",
    subject: "network",
    title: "计算机网络 · 路由器最长前缀匹配（LPM）逐项比对",
    steps: [
      { t: 0.25, sub: "① 收到目的 IP = 192.168.35.9 的分组，依次与路由表掩码做按位与（AND）。" },
      { t: 0.55, sub: "② 条目 A：192.168.32.0/19（匹配前 19 位 ✓）；条目 B：192.168.35.0/24（匹配前 24 位 ✓）。" },
      { t: 0.80, sub: "③ 多条同时命中时按「最长前缀匹配」原则：/24 > /19，优选更精确的条目 B！" },
      { t: 1.00, sub: "④ 分组从接口 E1 转发至下一跳，TTL 减 1 并重算首部检验和。" }
    ]
  },
  {
    id: "css-pos",
    subject: "web_design",
    title: "网页设计 · 子绝父相（relative + absolute）坐标基准",
    steps: [
      { t: 0.25, sub: "① 父容器设置 position: relative：保留文档流原占空间，同时建立包含块原点 (0,0)。" },
      { t: 0.55, sub: "② 子徽标设置 position: absolute：脱离正常文档流，不再挤压兄弟文本。" },
      { t: 0.80, sub: "③ 设置 top: 10px; right: 12px：向上查找最近的非 static 祖先（即父容器）精准锚定。" },
      { t: 1.00, sub: "④ 若父级漏写 relative，绝对定位会一路回退到初始包含块视口导致错位！" }
    ]
  }
];

const MANIM_GALLERY = [
  {
    subject: "math",
    badge: "Manim 数学动画",
    title: "重要极限 sin(x)/x → 1 夹逼准则直观",
    formula: "cos(x) < sin(x)/x < 1  (x → 0)",
    src: "assets/manim/limit-squeeze.gif",
    href: "gs/gs1.html#point-4"
  },
  {
    subject: "network",
    badge: "Manim 网络位运算",
    title: "CIDR /20 掩码按位与（AND）提取网络号",
    formula: "156.16.32.7 ∧ 255.255.240.0 = 156.16.32.0",
    src: "assets/manim/cidr-mask.gif",
    href: "wl/ch2/s26.html"
  },
  {
    subject: "c_language",
    badge: "Manim 内存寻址",
    title: "二维数组 int a[3][4] 行指针两步解引用",
    formula: "*(*(a + 1) + 2) ≡ *(a[1] + 2) ≡ a[1][2]",
    src: "assets/manim/pointer-2d.gif",
    href: "c/notes.html#sec-8-4"
  }
];

function drawExplainerFrame(ctx, w, h, clipId, progress) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, w, h);

  // 顶部进度细条
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(24, 18, w - 48, 5);
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(24, 18, (w - 48) * progress, 5);

  ctx.font = "600 13px 'Microsoft YaHei', system-ui, sans-serif";
  if (clipId === "ptr-swap") {
    const step = progress < 0.25 ? 0 : progress < 0.55 ? 1 : progress < 0.8 ? 2 : 3;
    const valA = step >= 2 ? 8 : 3;
    const valB = step >= 2 ? 3 : 8;
    // main 栈帧
    roundBox(ctx, 36, 46, 220, 152, "#eff6ff", "#1d4ed8", 2);
    ctx.fillStyle = "#0f172a";
    ctx.fillText("main() 栈帧", 50, 68);
    roundBox(ctx, 54, 82, 82, 52, step === 2 ? "#fee2e2" : "#ffffff", "#1d4ed8", 1.8);
    ctx.fillStyle = "#1e3a8a";
    ctx.fillText(`a = ${valA}`, 72, 108);
    ctx.fillStyle = "#475569";
    ctx.fillText("0x100", 72, 126);

    roundBox(ctx, 154, 82, 82, 52, step === 2 ? "#fee2e2" : "#ffffff", "#1d4ed8", 1.8);
    ctx.fillStyle = "#1e3a8a";
    ctx.fillText(`b = ${valB}`, 172, 108);
    ctx.fillStyle = "#475569";
    ctx.fillText("0x104", 172, 126);

    if (step < 3) {
      roundBox(ctx, 310, 46, 250, 152, "#fef2f2", "#dc2626", 2);
      ctx.fillStyle = "#991b1b";
      ctx.fillText("swap(int *px, int *py)", 326, 68);
      roundBox(ctx, 328, 84, 100, 44, "#ffffff", "#dc2626", 1.5);
      ctx.fillStyle = "#0f172a";
      ctx.fillText("px = 0x100", 340, 111);
      roundBox(ctx, 442, 84, 100, 44, "#ffffff", "#dc2626", 1.5);
      ctx.fillText("py = 0x104", 454, 111);
      if (step >= 1) {
        ctx.fillStyle = "#b91c1c";
        ctx.fillText("temp = *px = 3", 332, 154);
        drawArrow(ctx, 328, 104, 138, 104, "#dc2626");
        drawArrow(ctx, 442, 118, 238, 118, "#1d4ed8");
      }
    } else {
      roundBox(ctx, 310, 74, 250, 92, "#eff6ff", "#1d4ed8", 2);
      ctx.fillStyle = "#1d4ed8";
      ctx.fillText("✓ swap 栈帧已弹出销毁", 336, 112);
      ctx.fillStyle = "#0f172a";
      ctx.fillText("实参结果：a = 8 , b = 3", 336, 138);
    }
  } else if (clipId === "route-lpm") {
    const rows = [
      ["192.168.0.0 / 16", "E0", "命中 16 位", progress >= 0.25, false],
      ["192.168.32.0 / 19", "E0", "命中 19 位", progress >= 0.45, false],
      ["192.168.35.0 / 24", "E1", "命中 24 位（最长!）", progress >= 0.65, progress >= 0.75]
    ];
    roundBox(ctx, 32, 42, 536, 38, "#0f172a", "#0f172a", 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("目的 IP 分组：192.168.35.9   →   逐行掩码 AND 比对前缀长度", 48, 66);
    rows.forEach(([prefix, iface, note, active, best], i) => {
      const y = 94 + i * 38;
      roundBox(ctx, 32, y, 536, 32, best ? "#fee2e2" : (active ? "#dbeafe" : "#ffffff"), best ? "#dc2626" : "#94a3b8", best ? 2.2 : 1.2);
      ctx.fillStyle = "#0f172a";
      ctx.fillText(prefix, 48, y + 21);
      ctx.fillText(`出接口 ${iface}`, 248, y + 21);
      ctx.fillStyle = best ? "#b91c1c" : "#1d4ed8";
      if (active) ctx.fillText(note, 376, y + 21);
    });
  } else {
    // CSS 子绝父相
    const hasRel = progress < 0.85;
    roundBox(ctx, 44, 42, 512, 162, "#f1f5f9", "#64748b", 1.4);
    ctx.fillStyle = "#475569";
    ctx.fillText("视口初始包含块 (viewport)", 58, 62);
    roundBox(ctx, 136, 76, 320, 112, "#eff6ff", "#1d4ed8", 2.2);
    ctx.fillStyle = "#1e3a8a";
    ctx.fillText(hasRel ? ".card { position: relative; }" : ".card { position: static; /* 漏写! */ }", 152, 102);
    ctx.fillStyle = "#334155";
    ctx.fillText("正常流正文内容保持原位不塌陷", 152, 136);
    const bx = hasRel ? 366 : 462;
    const by = hasRel ? 84 : 48;
    roundBox(ctx, bx, by, 80, 28, "#dc2626", "#991b1b", 1.5);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("角标 top:8", bx + 8, by + 19);
  }
}

function roundBox(ctx, x, y, w, h, fill, stroke, lw) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 8);
  else ctx.rect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawArrow(ctx, x1, y1, x2, y2, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 8 * Math.cos(ang - 0.4), y2 - 8 * Math.sin(ang - 0.4));
  ctx.lineTo(x2 - 8 * Math.cos(ang + 0.4), y2 - 8 * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function renderMotionStudio({ base = "", subjectId = "" } = {}) {
  const pickIdx = subjectId ? Math.max(0, TWO_SCENES.findIndex((s) => s.subject === subjectId)) : 0;
  let activeTab = 0;
  let sceneIdx = pickIdx;
  let clipIdx = subjectId ? Math.max(0, EXPLAINER_CLIPS.findIndex((c) => c.subject === subjectId)) : 0;

  const panelTwo = el("div", { class: "ms-pane" });
  const panelExp = el("div", { class: "ms-pane", hidden: true });
  const panelManim = el("div", { class: "ms-pane", hidden: true });

  // --- Tab 1: Two.js 实时矢量图解 ---
  const twoStageHost = el("div", { class: "ms-two-stage", role: "img", "aria-label": "Two.js 动态几何与盒模型矢量画布" });
  const twoReadout = el("div", { class: "ms-readout", "aria-live": "polite" });
  const sliderALabel = el("span", { class: "ms-slider__lbl" });
  const sliderAInput = el("input", { type: "range", class: "ms-range" });
  const sliderBLabel = el("span", { class: "ms-slider__lbl" });
  const sliderBInput = el("input", { type: "range", class: "ms-range" });
  const sceneLink = el("a", { class: "sh-btn ms-go-link", href: base + TWO_SCENES[sceneIdx].href, text: "进入对应考点精讲 →" });
  const sceneDesc = el("p", { class: "ms-scene-desc", text: TWO_SCENES[sceneIdx].desc });

  const scenePills = TWO_SCENES.map((sc, idx) =>
    el("button", {
      type: "button",
      class: "ms-pill",
      "aria-pressed": String(idx === sceneIdx),
      onclick: () => {
        sceneIdx = idx;
        scenePills.forEach((b, i) => b.setAttribute("aria-pressed", String(i === idx)));
        syncTwoControls();
        paintTwoScene();
      },
      text: `${sc.badge} · ${sc.title.split("：")[0].slice(0, 10)}`
    })
  );

  function syncTwoControls() {
    const sc = TWO_SCENES[sceneIdx];
    sceneDesc.textContent = sc.desc;
    sceneLink.href = base + sc.href;
    Object.assign(sliderAInput, { min: sc.sliderA.min, max: sc.sliderA.max, step: sc.sliderA.step, value: sc.sliderA.value });
    Object.assign(sliderBInput, { min: sc.sliderB.min, max: sc.sliderB.max, step: sc.sliderB.step, value: sc.sliderB.value });
    sliderALabel.textContent = `${sc.sliderA.label}：${sliderAInput.value}`;
    sliderBLabel.textContent = `${sc.sliderB.label}：${sliderBInput.value}`;
  }

  let twoInstance = null;
  let TwoMod = null;
  async function paintTwoScene() {
    const sc = TWO_SCENES[sceneIdx];
    const a = Number(sliderAInput.value);
    const b = Number(sliderBInput.value);
    sliderALabel.textContent = `${sc.sliderA.label}：${a}`;
    sliderBLabel.textContent = `${sc.sliderB.label}：${b}`;

    if (!TwoMod) {
      try {
        const m = await import("../vendor/two.min.js");
        TwoMod = m.default || m;
      } catch {
        twoReadout.textContent = "矢量引擎加载失败";
        return;
      }
    }
    const w = 580, h = 210;
    if (!twoInstance) {
      twoStageHost.replaceChildren();
      twoInstance = new TwoMod({ type: TwoMod.Types.svg, width: w, height: h }).appendTo(twoStageHost);
      const svgEl = twoStageHost.querySelector("svg");
      if (svgEl) {
        svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
        svgEl.style.width = "100%";
        svgEl.style.height = "auto";
      }
    }
    twoInstance.clear();

    if (sc.id === "math-riemann") {
      const n = a;
      const x0Ratio = b / 100;
      const ox = 48, oy = 178, pw = 490, ph = 138;
      const fn = (t) => 0.16 + 0.72 * Math.sin(t * Math.PI * 0.85) * (0.65 + 0.35 * t);
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const tMid = (i + 0.5) / n;
        const val = fn(tMid);
        sum += val * (1 / n);
        const rw = pw / n - 1.5;
        const rh = val * ph;
        const rx = ox + (i / n) * pw + rw / 2;
        const ry = oy - rh / 2;
        const rect = twoInstance.makeRectangle(rx, ry, Math.max(2, rw), rh);
        rect.fill = "rgba(37, 99, 235, 0.22)";
        rect.stroke = "#1d4ed8";
        rect.linewidth = 1.2;
      }
      const pts = [];
      for (let k = 0; k <= 48; k++) {
        const t = k / 48;
        pts.push(new TwoMod.Anchor(ox + t * pw, oy - fn(t) * ph));
      }
      const curve = twoInstance.makeCurve(pts, true);
      curve.noFill();
      curve.stroke = "#0f172a";
      curve.linewidth = 2.6;

      // 切线
      const eps = 0.005;
      const slope = (fn(x0Ratio + eps) - fn(x0Ratio - eps)) / (2 * eps);
      const tx = ox + x0Ratio * pw;
      const ty = oy - fn(x0Ratio) * ph;
      const dx = 72;
      const dy = -slope * (dx / pw) * ph;
      const tanLine = twoInstance.makeLine(tx - dx, ty - dy, tx + dx, ty + dy);
      tanLine.stroke = "#dc2626";
      tanLine.linewidth = 2.6;
      const dot = twoInstance.makeCircle(tx, ty, 5.5);
      dot.fill = "#dc2626";
      dot.stroke = "#ffffff";
      dot.linewidth = 2;

      const axisX = twoInstance.makeLine(ox - 10, oy, ox + pw + 14, oy);
      const axisY = twoInstance.makeLine(ox, oy + 10, ox, oy - ph - 12);
      axisX.stroke = axisY.stroke = "#475569";
      axisX.linewidth = axisY.linewidth = 1.6;
      twoReadout.textContent = `黎曼和近似面积 S_${n} ≈ ${sum.toFixed(4)}  |  切点 x₀=${x0Ratio.toFixed(2)} 处导数斜率 f'(x₀) ≈ ${slope.toFixed(3)}`;
    } else if (sc.id === "web-box") {
      const pad = a, bd = b;
      const contentW = 140, contentH = 68;
      // 左：content-box 外扩
      const cbOuterW = contentW + pad * 2 + bd * 2;
      const cbOuterH = contentH + pad * 2 + bd * 2;
      const r1 = twoInstance.makeRectangle(155, 105, cbOuterW, cbOuterH);
      r1.fill = "rgba(220, 38, 38, 0.14)";
      r1.stroke = "#dc2626";
      r1.linewidth = Math.max(2, bd / 2);
      const r1In = twoInstance.makeRectangle(155, 105, contentW, contentH);
      r1In.fill = "#dbeafe";
      r1In.stroke = "#1d4ed8";
      r1In.linewidth = 1.5;

      // 右：border-box 锁死总宽
      const bbInnerW = Math.max(36, 180 - pad * 2 - bd * 2);
      const bbInnerH = Math.max(24, 108 - pad * 2 - bd * 2);
      const r2 = twoInstance.makeRectangle(435, 105, 180, 108);
      r2.fill = "rgba(37, 99, 235, 0.16)";
      r2.stroke = "#1d4ed8";
      r2.linewidth = Math.max(2, bd / 2);
      const r2In = twoInstance.makeRectangle(435, 105, bbInnerW, bbInnerH);
      r2In.fill = "#ffffff";
      r2In.stroke = "#0f172a";
      r2In.linewidth = 1.5;
      twoReadout.textContent = `content-box 实际总宽 = 180 + 2×${pad} + 2×${bd} = ${180 + 2 * pad + 2 * bd}px（向外撑大）  |  border-box 实际总宽恒为 180px（内容区压缩为 ${bbInnerW}px）`;
    } else {
      // 网络 MTU 分片
      const mtu = a, totalData = b;
      const maxPayload = Math.floor((mtu - 20) / 8) * 8;
      const frags = [];
      let rem = totalData, offsetBytes = 0;
      while (rem > 0) {
        const take = Math.min(rem, maxPayload);
        frags.push({ len: take + 20, data: take, offset: offsetBytes / 8, mf: rem > take ? 1 : 0 });
        rem -= take;
        offsetBytes += take;
      }
      const barW = 500;
      let curX = 40;
      frags.forEach((f, idx) => {
        const wSeg = Math.max(42, (f.data / totalData) * barW - 6);
        const cx = curX + wSeg / 2;
        const rect = twoInstance.makeRectangle(cx, 105, wSeg, 64);
        rect.fill = f.mf ? "#dbeafe" : "#fee2e2";
        rect.stroke = f.mf ? "#1d4ed8" : "#dc2626";
        rect.linewidth = 2;
        const headStrip = twoInstance.makeRectangle(curX + 7, 105, 14, 64);
        headStrip.fill = "#0f172a";
        headStrip.noStroke();
        curX += wSeg + 6;
        void idx;
      });
      twoReadout.textContent = `共切分为 ${frags.length} 个分片（每片最大数据 ${maxPayload}B）：` +
        frags.map((f, i) => `片${i + 1}[总长${f.len}B, MF=${f.mf}, 片偏移=${f.offset}]`).join(" · ");
    }
    twoInstance.update();
  }

  sliderAInput.addEventListener("input", () => void paintTwoScene());
  sliderBInput.addEventListener("input", () => void paintTwoScene());
  syncTwoControls();

  panelTwo.append(
    el("div", { class: "ms-pills", role: "group", "aria-label": "选择动态图解主题" }, scenePills),
    sceneDesc,
    twoStageHost,
    twoReadout,
    el("div", { class: "ms-sliders" }, [
      el("label", { class: "ms-slider" }, [sliderALabel, sliderAInput]),
      el("label", { class: "ms-slider" }, [sliderBLabel, sliderBInput]),
      sceneLink
    ])
  );

  // --- Tab 2: 分镜时间轴同步讲解器 + gifenc 一键导出 GIF ---
  const expCanvas = el("canvas", { class: "ms-exp-canvas", width: "600", height: "216", "aria-label": "分镜同步代码原理画布" });
  const expSub = el("div", { class: "ms-exp-sub", "aria-live": "polite" });
  const expScrub = el("input", { type: "range", class: "ms-range ms-exp-scrub", min: "0", max: "100", value: "35", "aria-label": "讲解时间轴进度" });
  let playing = false;
  let playRaf = 0;

  const playBtn = el("button", { type: "button", class: "sh-btn sh-btn--primary", text: "▶ 播放分镜" });
  const exportBtn = el("button", { type: "button", class: "sh-btn", text: "📤 用 gifenc 导出 GIF 动图" });
  const exportStatus = el("span", { class: "ms-export-msg", role: "status", "aria-live": "polite" });

  const clipPills = EXPLAINER_CLIPS.map((cl, idx) =>
    el("button", {
      type: "button",
      class: "ms-pill",
      "aria-pressed": String(idx === clipIdx),
      onclick: () => {
        clipIdx = idx;
        clipPills.forEach((b, i) => b.setAttribute("aria-pressed", String(i === idx)));
        paintExplainer(Number(expScrub.value) / 100);
      },
      text: cl.title.split("·")[1]?.trim() || cl.title
    })
  );

  function paintExplainer(p) {
    const clip = EXPLAINER_CLIPS[clipIdx];
    const ctx = expCanvas.getContext("2d");
    if (ctx) drawExplainerFrame(ctx, 600, 216, clip.id, p);
    const hit = clip.steps.find((s) => p <= s.t) || clip.steps[clip.steps.length - 1];
    expSub.textContent = hit.sub;
  }

  playBtn.addEventListener("click", () => {
    playing = !playing;
    playBtn.textContent = playing ? "⏸ 暂停分镜" : "▶ 播放分镜";
    if (!playing) {
      cancelAnimationFrame(playRaf);
      return;
    }
    let cur = Number(expScrub.value);
    if (cur >= 99) cur = 0;
    let last = performance.now();
    const step = (now) => {
      if (!playing) return;
      const dt = (now - last) / 1000;
      last = now;
      cur += dt * 18;
      if (cur >= 100) {
        cur = 100;
        playing = false;
        playBtn.textContent = "▶ 重播分镜";
      }
      expScrub.value = String(Math.round(cur));
      paintExplainer(cur / 100);
      if (playing) playRaf = requestAnimationFrame(step);
    };
    playRaf = requestAnimationFrame(step);
  });

  expScrub.addEventListener("input", () => paintExplainer(Number(expScrub.value) / 100));

  exportBtn.addEventListener("click", async () => {
    exportBtn.disabled = true;
    exportStatus.textContent = "正在编码 20 帧 GIF…";
    try {
      const { GIFEncoder, quantize, applyPalette } = await import("../vendor/gifenc.min.js");
      const clip = EXPLAINER_CLIPS[clipIdx];
      const off = document.createElement("canvas");
      off.width = 600;
      off.height = 216;
      const octx = off.getContext("2d", { willReadFrequently: true });
      const gif = GIFEncoder();
      const totalFrames = 20;
      for (let i = 0; i < totalFrames; i++) {
        const p = i / (totalFrames - 1);
        drawExplainerFrame(octx, 600, 216, clip.id, p);
        const { data } = octx.getImageData(0, 0, 600, 216);
        const palette = quantize(data, 64);
        const index = applyPalette(data, palette);
        gif.writeFrame(index, 600, 216, { palette, delay: i === totalFrames - 1 ? 650 : 180 });
      }
      gif.finish();
      const bytes = gif.bytes();
      const blob = new Blob([bytes], { type: "image/gif" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zsb-${clip.id}.gif`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      exportStatus.textContent = `✓ 已导出 ${(bytes.length / 1024).toFixed(1)} KB GIF`;
    } catch {
      exportStatus.textContent = "导出失败";
    } finally {
      exportBtn.disabled = false;
    }
  });

  panelExp.append(
    el("div", { class: "ms-pills", role: "group", "aria-label": "选择同步分镜课题" }, clipPills),
    expCanvas,
    expSub,
    el("div", { class: "ms-exp-controls" }, [playBtn, expScrub, exportBtn, exportStatus])
  );

  // --- Tab 3: Python Manim 精渲动图库 ---
  panelManim.append(
    el("div", { class: "ms-manim-grid" }, MANIM_GALLERY.map((item) =>
      el("article", { class: "ms-manim-card" }, [
        el("span", { class: "ms-manim-badge", text: item.badge }),
        el("img", {
          class: "ms-manim-img",
          src: base + item.src,
          alt: item.title,
          width: "640",
          height: "360",
          loading: "lazy",
          decoding: "async"
        }),
        el("h3", { class: "ms-manim-title", text: item.title }),
        el("code", { class: "ms-manim-eq", text: item.formula }),
        el("a", { class: "sh-btn ms-manim-go", href: base + item.href, text: "对照原课讲义与真题 →" })
      ])
    ))
  );

  const tabDefs = [
    ["📐 Two.js 实时矢量图解", panelTwo, () => void paintTwoScene()],
    ["🎬 分镜同步讲解 · GIF 导出", panelExp, () => paintExplainer(Number(expScrub.value) / 100)],
    ["🧮 Manim 理工精渲动图", panelManim, () => {}]
  ];

  const tabBtns = tabDefs.map(([label, , onEnter], idx) =>
    el("button", {
      type: "button",
      class: "ms-tab",
      "aria-pressed": String(idx === activeTab),
      onclick: () => {
        activeTab = idx;
        tabBtns.forEach((b, i) => b.setAttribute("aria-pressed", String(i === idx)));
        tabDefs.forEach(([, pane], i) => { pane.hidden = i !== idx; });
        onEnter();
      },
      text: label
    })
  );

  const card = el("section", { class: "sh-card sys-motion-studio", "aria-label": "交互式动态原理图解工作台" }, [
    el("header", { class: "ms-head" }, [
      el("div", {}, [
        el("span", { class: "ms-eyebrow", text: "纯本地零外链 · Two.js + 分镜时间轴 + Manim + gifenc" }),
        el("h2", { class: "ms-title", text: "✨ 动态原理图解与分镜可视化实验室" })
      ]),
      el("div", { class: "ms-tabs", role: "group", "aria-label": "可视化实验室模式切换" }, tabBtns)
    ]),
    panelTwo,
    panelExp,
    panelManim
  ]);

  if (!REDUCED) {
    requestAnimationFrame(() => void paintTwoScene());
  } else {
    void paintTwoScene();
  }
  return card;
}
