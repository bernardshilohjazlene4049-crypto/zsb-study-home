// 全站动效总控：整合 Motion (01)、Anime.js (02)、Ola (03)、Shifty (04)、TweenJS (05)、Lottie Web (06) 与 Proton (09)
// 严格遵守：无外部 CDN、尊重 prefers-reduced-motion、绝不降低文字透明度以免影响 WCAG AA 对比度。
import { animate, stagger, inView } from "../vendor/motion.min.js";
import { animate as animeAnimate, svg as animeSvg } from "../vendor/anime.min.js";
import { Ola, shiftyTween, Tween, TweenGroup, Easing } from "../vendor/tween-suite.min.js";

const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const ROOT = new URL("../../../", import.meta.url);
const tweenGroup = new TweenGroup();
let rafRunning = false;

function ensureTweenLoop() {
  if (rafRunning || REDUCED) return;
  rafRunning = true;
  const tick = (t) => {
    tweenGroup.update(t);
    if (tweenGroup.getAll().length > 0) requestAnimationFrame(tick);
    else rafRunning = false;
  };
  requestAnimationFrame(tick);
}

// 01 Motion: 卡片入场微位移（仅变换 transform，保持 opacity=1 确保任何时刻对比度 100% 达标）与按钮弹性按压反馈
function mountMotionInteractions() {
  if (REDUCED) return;
  const cards = [...document.querySelectorAll(".home-note-card, .home-subject, .sys-arch__stage, .tw-subject-card, .notes-hub-card")];
  if (cards.length) {
    inView(cards, (target) => {
      animate(
        target,
        { transform: ["translateY(10px) scale(0.99)", "translateY(0px) scale(1)"] },
        { duration: 0.42, easing: [0.22, 1, 0.36, 1] }
      );
    }, { margin: "0px 0px -24px 0px" });
  }

  // 架构分阶卡片组序列顺滑编排
  const archStages = [...document.querySelectorAll(".sys-arch__stage")];
  if (archStages.length > 1) {
    animate(
      archStages,
      { transform: ["translateY(8px)", "translateY(0px)"] },
      { delay: stagger(0.06), duration: 0.38, easing: [0.22, 1, 0.36, 1] }
    );
  }

  // 全局主操作按钮与胶囊弹性微反馈（事件委托，覆盖动态生成的卡片按钮）
  document.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest?.(".sh-btn, .tw-enter, .sys-cloze, .home-note-card");
    if (!btn) return;
    animate(btn, { transform: "scale(0.97)" }, { duration: 0.1 });
  }, { passive: true });

  const release = (e) => {
    const btn = e.target.closest?.(".sh-btn, .tw-enter, .sys-cloze, .home-note-card");
    if (!btn) return;
    animate(btn, { transform: "scale(1)" }, { duration: 0.22, easing: [0.22, 1, 0.36, 1] });
  };
  document.addEventListener("pointerup", release, { passive: true });
  document.addEventListener("pointercancel", release, { passive: true });
}

// 02 Anime.js: 首页 Hero 折射信号流线绘制 & 关系图 SVG 连线描绘
export function animateSvgPaths(container = document) {
  if (REDUCED) return;
  const paths = [...container.querySelectorAll("svg.g-edges path, svg.lg-hero-wave path")];
  if (!paths.length) return;
  try {
    const drawables = animeSvg.createDrawable(paths);
    animeAnimate(drawables, {
      draw: ["0 0", "0 1"],
      duration: 720,
      delay: (_, i) => i * 70,
      ease: "outCubic"
    });
  } catch {
    // 兼容极简 SVG 环境
  }
}

function mountHeroWaveSvg() {
  const hero = document.querySelector(".home-hero");
  if (!hero || hero.querySelector(".lg-hero-wave")) return;
  const ns = "http://www.w3.org/2000/svg";
  const svgEl = document.createElementNS(ns, "svg");
  svgEl.setAttribute("class", "lg-hero-wave");
  svgEl.setAttribute("viewBox", "0 0 600 180");
  svgEl.setAttribute("preserveAspectRatio", "none");
  svgEl.setAttribute("aria-hidden", "true");
  svgEl.innerHTML =
    '<path d="M12 148 C 130 96, 210 162, 332 88 S 496 30, 588 52" fill="none" stroke="rgba(96,165,250,0.42)" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M36 164 C 168 128, 264 146, 386 104 S 516 74, 592 84" fill="none" stroke="rgba(248,113,113,0.36)" stroke-width="1.6" stroke-linecap="round"/>';
  hero.appendChild(svgEl);
  animateSvgPaths(hero);
}

// 03 Ola + 04 Shifty + 05 TweenJS: 平滑光标高光跟随、百分比数值滚动与遮挡揭晓连贯动作
function mountNumericAndFollowerTweens() {
  if (REDUCED) return;
  const hero = document.querySelector(".home-hero");
  if (hero) {
    const pos = Ola({ x: 78, y: 26 }, 180);
    let rafId = 0;
    const syncGlow = () => {
      hero.style.setProperty("--hero-mx", `${pos.x.toFixed(1)}%`);
      hero.style.setProperty("--hero-my", `${pos.y.toFixed(1)}%`);
      rafId = 0;
    };
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      if (!r.width || !r.height) return;
      pos.set({
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top) / r.height) * 100
      });
      if (!rafId) rafId = requestAnimationFrame(syncGlow);
    }, { passive: true });
  }

  // Shifty 定制缓动：为页面内首次出现的百分比徽标做柔和计数过渡
  const pctNodes = [...document.querySelectorAll(".sh-pct, .sys-arch__stage-count")].slice(0, 12);
  for (const node of pctNodes) {
    if (node.dataset.shiftyDone) continue;
    const raw = node.textContent || "";
    const m = /^(\d+)(%|\s*个知识点)$/.exec(raw.trim());
    if (!m) continue;
    const targetNum = Number(m[1]);
    const suffix = m[2];
    if (!targetNum) continue;
    node.dataset.shiftyDone = "1";
    shiftyTween({
      from: { v: 0 },
      to: { v: targetNum },
      duration: 620,
      easing: "easeOutQuart",
      render: (state) => {
        node.textContent = `${Math.round(state.v)}${suffix}`;
      }
    }).catch(() => {
      node.textContent = raw;
    });
  }

  // TweenJS 串联动作：当点击揭晓遮挡块（.sys-cloze）时执行微抬升→回弹连续动作
  document.addEventListener("click", (e) => {
    const cloze = e.target.closest?.(".sys-cloze");
    if (!cloze) return;
    const state = { s: 0.94, y: -2 };
    const apply = () => {
      cloze.style.transform = `translateY(${state.y.toFixed(2)}px) scale(${state.s.toFixed(3)})`;
    };
    const up = new Tween(state, tweenGroup)
      .to({ s: 1.05, y: -3 }, 110)
      .easing(Easing.Quadratic.Out)
      .onUpdate(apply);
    const settle = new Tween(state, tweenGroup)
      .to({ s: 1, y: 0 }, 160)
      .easing(Easing.Back.Out)
      .onUpdate(apply)
      .onComplete(() => { cloze.style.transform = ""; });
    up.chain(settle);
    up.start();
    ensureTweenLoop();
  });
}

// 06 Lottie Web: 挂载首页脉冲星标与答题正确动态勾选图标
let lottiePromise = null;
function getLottie() {
  if (!lottiePromise) {
    lottiePromise = import("../vendor/lottie-light.min.js").then((m) => m.default || m);
  }
  return lottiePromise;
}

async function mountHeroLottieBadge() {
  const card = document.querySelector(".home-hero__example");
  if (!card || card.querySelector(".lg-lottie-beacon")) return;
  const holder = document.createElement("span");
  holder.className = "lg-lottie-beacon";
  holder.setAttribute("aria-hidden", "true");
  card.prepend(holder);
  try {
    const [lottie, animData] = await Promise.all([
      getLottie(),
      fetch(new URL("assets/lottie/pulse-beacon.json", ROOT)).then((r) => r.json())
    ]);
    lottie.loadAnimation({
      container: holder,
      renderer: "svg",
      loop: !REDUCED,
      autoplay: !REDUCED,
      animationData: animData
    });
  } catch {
    holder.remove();
  }
}

export async function playCheckLottie(anchorEl) {
  if (!anchorEl) return;
  const badge = document.createElement("span");
  badge.className = "lg-lottie-check";
  badge.setAttribute("aria-hidden", "true");
  anchorEl.appendChild(badge);
  try {
    const [lottie, animData] = await Promise.all([
      getLottie(),
      fetch(new URL("assets/lottie/celebrate-check.json", ROOT)).then((r) => r.json())
    ]);
    const inst = lottie.loadAnimation({
      container: badge,
      renderer: "svg",
      loop: false,
      autoplay: true,
      animationData: animData
    });
    setTimeout(() => {
      inst.destroy();
      badge.remove();
    }, 1500);
  } catch {
    badge.remove();
  }
}

// 09 Proton: 答对题目 / 闯关完成时触发红·蓝·冰白双色庆贺粒子簇
let protonPromise = null;
export async function burstParticlesAt(targetEl) {
  if (REDUCED || !targetEl) return;
  try {
    if (!protonPromise) {
      protonPromise = import("../vendor/proton.min.js").then((m) => m.default || m);
    }
    const Proton = await protonPromise;
    const rect = targetEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const canvas = document.createElement("canvas");
    canvas.className = "lg-proton-canvas";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);

    const proton = new Proton();
    const emitter = new Proton.Emitter();
    emitter.rate = new Proton.Rate(new Proton.Span(22, 30), new Proton.Span(0.01));
    emitter.addInitialize(new Proton.Mass(1));
    emitter.addInitialize(new Proton.Radius(2.5, 5.5));
    emitter.addInitialize(new Proton.Life(0.55, 1.05));
    emitter.addInitialize(new Proton.Velocity(new Proton.Span(2.4, 5.8), new Proton.Span(0, 360), "polar"));
    emitter.addBehaviour(new Proton.Alpha(1, 0));
    emitter.addBehaviour(new Proton.Scale(1.1, 0.25));
    emitter.addBehaviour(new Proton.Gravity(1.6));
    emitter.addBehaviour(new Proton.Color(["#1d4ed8", "#3b82f6", "#dc2626", "#ef4444", "#93c5fd"]));
    emitter.p.x = cx;
    emitter.p.y = cy;
    emitter.emit("once", true);
    proton.addEmitter(emitter);

    const renderer = new Proton.CanvasRenderer(canvas);
    proton.addRenderer(renderer);

    const start = performance.now();
    const loop = (now) => {
      proton.update();
      if (now - start < 1250) {
        requestAnimationFrame(loop);
      } else {
        proton.destroy();
        canvas.remove();
      }
    };
    requestAnimationFrame(loop);
  } catch {
    // 粒子为纯增强视觉，异常时静默降级
  }
}

function bindQuizCelebrations() {
  // 监听全站知识卡自测、闯关与课页选择题答对反馈
  document.addEventListener("click", (e) => {
    const opt = e.target.closest?.(".sys-quiz__opt, .sys-challenge__opt, .quiz-check, .sys-rate-btn--good");
    if (!opt) return;
    setTimeout(() => {
      if (
        opt.classList.contains("is-correct") ||
        opt.classList.contains("sys-rate-btn--good") ||
        (opt.classList.contains("quiz-check") && document.querySelector(".qfb"))
      ) {
        void burstParticlesAt(opt);
        if (opt.classList.contains("is-correct")) void playCheckLottie(opt);
      }
    }, 40);
  });
}

export function initSiteMotion() {
  mountMotionInteractions();
  mountHeroWaveSvg();
  mountNumericAndFollowerTweens();
  void mountHeroLottieBadge();
  bindQuizCelebrations();
}
