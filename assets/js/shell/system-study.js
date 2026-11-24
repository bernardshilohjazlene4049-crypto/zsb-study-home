// 全科系统学习引擎：统一知识点卡（结论/必背/讲解/例题/易错/自测/随手备忘）、遮挡背诵、手机/桌面滑卡速刷、
// 随堂闯关测验、讲义分栏专注筛选、专项练习题内提示判分、视频秒级片段直达、交互式思维导图、掌握度热力图与每日目标台。
import { loadModel, resetLearningCache, topicHref, pagePath, anchorOf } from "./model.js";
import { el, icon, bar, statusDot, shortSubjectName, formatDay, STATUS_LABEL, SUBJECT_ICON } from "./ui.js";
import { commitSubmission, ratingOutcome, saveNote } from "../features/records.js";
import { choiceOutcome } from "../features/page-attempts.js";
import { get } from "../core/storage.js";
import { LEARNER_ID } from "../core/schema.js";

const ROOT = new URL("../../../", import.meta.url);
const MODE_KEY = "zsb.system.mode.v1";
const VIEW_KEY = "zsb.system.view.v1";
const GOAL_KEY = "zsb.daily.goal.v1";
let cardsPromise = null;

export function loadTopicCards() {
  if (!cardsPromise) {
    cardsPromise = fetch(new URL("data/topic-cards.json", ROOT))
      .then((res) => (res.ok ? res.json() : { cards: {} }))
      .catch(() => ({ cards: {} }))
      .then((doc) => {
        const cards = doc.cards || {};
        const byUrl = new Map();
        const byPage = new Map();
        const byAnchor = new Map();
        for (const card of Object.values(cards)) {
          if (card.url) {
            byUrl.set(card.url, card);
            const p = pagePath(card.url);
            const a = anchorOf(card.url);
            if (!byPage.has(p)) byPage.set(p, []);
            byPage.get(p).push(card);
            if (a) byAnchor.set(`${p}#${a}`, card);
          }
          if (card.anchor) {
            byAnchor.set(card.anchor, card);
          }
        }
        return { cards, byUrl, byPage, byAnchor };
      });
  }
  return cardsPromise;
}

export function readStudyMode() {
  try {
    return localStorage.getItem(MODE_KEY) === "cloze" ? "cloze" : "study";
  } catch {
    return "study";
  }
}

export function writeStudyMode(mode) {
  try {
    localStorage.setItem(MODE_KEY, mode === "cloze" ? "cloze" : "study");
  } catch {
    // 忽略无存储权限环境
  }
}

// 题干首行为文字说明，其余多行（如 C 语言程序）保留换行与缩进单独成代码块。
export function stemLead(stem) {
  const s = String(stem || "");
  const i = s.indexOf("\n");
  return i < 0 ? s : s.slice(0, i);
}

export function stemCode(stem) {
  const s = String(stem || "");
  const i = s.indexOf("\n");
  if (i < 0) return null;
  const code = s.slice(i + 1).replace(/\s+$/, "");
  return code ? el("pre", { class: "sys-stem-code" }, [el("code", { text: code })]) : null;
}

// 将一句话或必背条目中的关键结论、公式、数字或冒号后完整分句转为可点击揭晓的遮挡块（绝不从中文词语中间截断）
export function buildClozeNodes(text, clozeOn = false) {
  const raw = String(text || "").trim();
  if (!raw) return [raw];
  const pattern = /(【[^】]{1,28}】|“[^”]{1,28}”|"[^"]{1,28}"|[（(]\s*[A-E]{1,5}\s*[）)]|(?:\b\d+(?:\.\d+){1,3}(?:\/\d+|~\d+(?:\.\d+){0,3})?\b)|(?:[0-9A-Za-z_./□]+(?:\s*(?:~|～|–|—|:|÷|\^|→|⇒|=|≠|≥|≤|>|<)\s*[0-9A-Za-z_./□|+-]+)+)|(?:\b\d+\s*(?:位|字节|跳|个|种|层|bit|B|ms|Hz|dB)\b)|(?:点分十进制|子网掩码|网络前缀|直接广播地址|广播地址|网络地址|环回地址|回送地址|最长前缀匹配|距离向量|分组交换|电路交换|报文交换|奇偶校验|循环冗余|曼彻斯特|透明传输|零比特填充|最小帧长|争用期|自学习|不可达|默认路由|交集|并集|定义域|对应法则|等价无穷小|重要极限|高阶无穷小|同阶无穷小|水平渐近线|垂直渐近线|可去间断点|跳跃间断点|无穷间断点|零点定理|偏导数|全微分|先行词|关系代词|关系副词|非限定性|同位语从句|主将从现|就远原则|就近原则|部分倒装|完全倒装|虚拟语气|强调句|工作簿|工作表|单元格|名称框|填充柄|绝对引用|相对引用|混合引用|下划线|关键字|content-box|border-box|margin|padding|border|datalist|optgroup|to be done|having been done|having done|to do|doing|done|whether|that|which|who|whom|whose|where|when|why|what))/g;
  const parts = [];
  let last = 0;
  let count = 0;
  let m;
  while ((m = pattern.exec(raw)) !== null && count < 5) {
    if (m.index > last) parts.push(raw.slice(last, m.index));
    const token = m[0];
    parts.push(makeClozeChip(token, clozeOn));
    last = m.index + token.length;
    count += 1;
  }
  if (count === 0) {
    // 若无特征词，按冒号或分号遮挡完整子句，不从词语中间硬切
    const colonIdx = raw.search(/[：:]/);
    if (colonIdx > 0 && colonIdx < raw.length - 2) {
      const rest = raw.slice(colonIdx + 1).trim();
      const semiIdx = rest.search(/[；;。]/);
      if (semiIdx > 1 && semiIdx < rest.length - 1) {
        return [
          raw.slice(0, colonIdx + 1),
          makeClozeChip(rest.slice(0, semiIdx), clozeOn),
          rest.slice(semiIdx)
        ];
      }
      return [
        raw.slice(0, colonIdx + 1),
        makeClozeChip(rest, clozeOn)
      ];
    }
    const semiIdx = raw.search(/[；;，,]/);
    if (semiIdx > 2 && semiIdx < raw.length - 3) {
      const tail = raw.slice(semiIdx + 1).trim();
      return [
        raw.slice(0, semiIdx + 1),
        makeClozeChip(tail, clozeOn)
      ];
    }
    return [makeClozeChip(raw, clozeOn)];
  }
  if (last < raw.length) parts.push(raw.slice(last));
  return parts;
}

// 将讲义原文中印在题干括号里的答案（如“（ C ）”、“（ ADE ）”）转为可点击揭晓的遮挡块，做题不剧透
export function maskPrintedSourceAnswers(root = document, clozeOn = false) {
  for (const p of root.querySelectorAll(".wy-source-row p")) {
    if (p.dataset.sysAnsMasked) continue;
    const html = p.innerHTML;
    if (!/[（(]\s*[A-E]{1,5}\s*[）)]/.test(html)) continue;
    p.dataset.sysAnsMasked = "1";
    p.innerHTML = html.replace(/([（(]\s*)([A-E]{1,5})(\s*[）)])/g, (_, pre, ans, post) =>
      `${pre}<button type="button" class="sys-cloze${clozeOn ? " is-masked" : " is-revealed"}" aria-pressed="${!clozeOn}" title="点击揭晓原题答案"><span class="sys-cloze__mask" aria-hidden="true">点击看答案</span><span class="sys-cloze__text">${ans}</span></button>${post}`
    );
    for (const btn of p.querySelectorAll(".sys-cloze")) {
      btn.dataset.sysClozeBound = "1";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const nowMasked = btn.classList.contains("is-masked");
        btn.classList.toggle("is-masked", !nowMasked);
        btn.classList.toggle("is-revealed", nowMasked);
        btn.setAttribute("aria-pressed", String(nowMasked));
      });
    }
  }
}

function notifyClozeChanged() {
  try {
    document.dispatchEvent(new CustomEvent("zsb:cloze-changed", { detail: { clozeOn: readStudyMode() === "cloze" } }));
  } catch { /* ignore */ }
}

export function bindStaticClozeButtons(root = document, clozeOn = false) {
  for (const btn of root.querySelectorAll(".sys-cloze")) {
    if (btn.dataset.sysClozeBound) continue;
    btn.dataset.sysClozeBound = "1";
    btn.classList.toggle("is-masked", clozeOn);
    btn.classList.toggle("is-revealed", !clozeOn);
    btn.setAttribute("aria-pressed", String(!clozeOn));
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const nowMasked = btn.classList.contains("is-masked");
      btn.classList.toggle("is-masked", !nowMasked);
      btn.classList.toggle("is-revealed", nowMasked);
      btn.setAttribute("aria-pressed", String(nowMasked));
      notifyClozeChanged();
    });
  }
}

export async function launchCodeLabModal(opts = {}) {
  const mod = await import("../lab/lab-modal.js");
  return mod.openCodeLabModal(opts);
}

export function bindCodeCopyButtons(root = document, base = "../", subjectId = "") {
  for (const btn of (root || document).querySelectorAll(".c-run-btn")) {
    if (btn.dataset.sysRunBound) continue;
    btn.dataset.sysRunBound = "1";
    btn.addEventListener("click", () => {
      let code = btn.closest(".c-code-wrap")?.querySelector("code")?.textContent || "";
      if (!code.trim()) return;
      if (!/\bmain\s*\(/.test(code)) {
        code = `#include <stdio.h>\n\nint main() {\n${code.split("\n").map((l) => "    " + l).join("\n")}\n    return 0;\n}`;
      } else if (!/#include/.test(code)) {
        code = `#include <stdio.h>\n#include <string.h>\n\n${code}`;
      }
      const secTitle = btn.closest(".topic-section")?.querySelector(".topic-title")?.textContent?.trim() || "C 语言讲义随堂试跑";
      void launchCodeLabModal({ lang: "c", code, title: secTitle, base });
    });
  }
  // 给随堂题里的多行 C 代码题干 (.c-stem-code) 补上「▶ 试跑验证」按钮
  for (const pre of (root || document).querySelectorAll(".c-stem-code")) {
    if (pre.dataset.sysStemRunBound) continue;
    pre.dataset.sysStemRunBound = "1";
    const runChip = el("button", {
      type: "button",
      class: "sys-inline-run-btn",
      onclick: () => {
        let code = (pre.textContent || "").trim();
        if (!/\bmain\s*\(/.test(code)) {
          code = `#include <stdio.h>\n\nint main() {\n${code.split("\n").map((l) => "    " + l).join("\n")}\n    return 0;\n}`;
        } else if (!/#include/.test(code)) {
          code = `#include <stdio.h>\n\n${code}`;
        }
        void launchCodeLabModal({ lang: "c", code, title: "随堂题代码试跑验证", base });
      },
      text: "▶ 试跑这段代码"
    });
    pre.after(runChip);
  }
  // 给网页设计 111 页中未带独立运行器的 HTML/CSS/JS 代码示例块补上「▶ 实时预览」
  if (subjectId === "web_design") {
    for (const pre of (root || document).querySelectorAll("main pre")) {
      if (pre.dataset.sysWebRunBound || pre.closest(".tryit, .c-code-wrap, dialog")) continue;
      const raw = (pre.textContent || "").trim();
      if (raw.length < 18 || raw.length > 3500) continue;
      if (!/(<[a-z][\s\S]*>|[{][^}]+:[^}]+[}]|document\.|console\.)/i.test(raw)) continue;
      pre.dataset.sysWebRunBound = "1";
      const previewChip = el("button", {
        type: "button",
        class: "sys-inline-run-btn",
        onclick: () => {
          const wrapped = /<html\b|<!doctype/i.test(raw)
            ? raw
            : (/[{][^}]+:[^}]+[}]/.test(raw) && !/<[a-z]/i.test(raw)
              ? `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;padding:16px;background:#f7f8fa;color:#111318;}\n${raw}\n</style></head><body><div class="box demo container"><h3>CSS 实时效果</h3><p>修改上方样式即可看到变化。</p></div></body></html>`
              : `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;padding:16px;background:#f7f8fa;color:#111318;}</style></head><body>\n${raw}\n</body></html>`);
          void launchCodeLabModal({ lang: "html", code: wrapped, title: "网页代码实时预览", base });
        },
        text: "▶ 实时预览这段代码"
      });
      pre.after(previewChip);
    }
  }
  for (const btn of (root || document).querySelectorAll(".c-copy-btn")) {
    if (btn.dataset.sysCopyBound) continue;
    btn.dataset.sysCopyBound = "1";
    btn.addEventListener("click", async () => {
      const code = btn.closest(".c-code-wrap")?.querySelector("code")?.textContent || "";
      if (!code) return;
      let ok = false;
      try {
        await navigator.clipboard.writeText(code);
        ok = true;
      } catch {
        try {
          const ta = document.createElement("textarea");
          ta.value = code;
          ta.style.cssText = "position:fixed;left:-9999px;opacity:0";
          document.body.append(ta);
          ta.select();
          ok = document.execCommand("copy");
          ta.remove();
        } catch { /* ignore */ }
      }
      const prev = btn.textContent;
      btn.textContent = ok ? "✓ 已复制" : "复制失败";
      btn.classList.toggle("is-copied", ok);
      setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove("is-copied");
      }, 1600);
    });
  }
}

function makeClozeChip(secret, masked) {
  const btn = el("button", {
    type: "button",
    class: `sys-cloze${masked ? " is-masked" : " is-revealed"}`,
    "aria-pressed": String(!masked),
    "data-sys-cloze-bound": "1",
    title: "点击切换遮挡/显示（快捷键 Space）"
  }, [
    el("span", { class: "sys-cloze__mask", "aria-hidden": "true", text: "点击揭晓" }),
    el("span", { class: "sys-cloze__text", text: secret })
  ]);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const nowMasked = btn.classList.contains("is-masked");
    btn.classList.toggle("is-masked", !nowMasked);
    btn.classList.toggle("is-revealed", nowMasked);
    btn.setAttribute("aria-pressed", String(nowMasked));
    notifyClozeChanged();
  });
  return btn;
}

export function setPageClozeMode(root, clozeOn) {
  document.documentElement.classList.toggle("sys-mode-cloze", clozeOn);
  for (const chip of (root || document).querySelectorAll(".sys-cloze")) {
    chip.classList.toggle("is-masked", clozeOn);
    chip.classList.toggle("is-revealed", !clozeOn);
    chip.setAttribute("aria-pressed", String(!clozeOn));
  }
  // 联动页面原有的 answer-chip / meaning-button
  for (const chip of (root || document).querySelectorAll(".answer-chip, .meaning-button")) {
    chip.classList.toggle("is-revealed", !clozeOn);
    chip.setAttribute("aria-pressed", String(!clozeOn));
  }
  // 同步页面上所有遮挡模式切换按钮的视觉状态
  for (const toggle of document.querySelectorAll("[data-sys-cloze-toggle]")) {
    toggle.classList.toggle("is-on", clozeOn);
    toggle.setAttribute("aria-pressed", String(clozeOn));
    toggle.textContent = toggle.dataset.sysClozeShort
      ? (clozeOn ? "🔒 遮挡：开" : "🔓 遮挡背诵")
      : (clozeOn ? "🔒 遮挡背诵：开" : "🔓 遮挡背诵");
  }
  notifyClozeChanged();
}

// 保存作答或自评到 IndexedDB (zsb-study)
export async function saveCardAttempt({ card, model, quizId, stem, answerText, choice, correct, rating, pageUrl }) {
  const realTopicId = resolveCanonicalTopicId(card, model);
  const outcome = rating ? ratingOutcome(rating) : choiceOutcome(choice, correct);
  const qid = quizId || `page:sys-${realTopicId.replace(/[^0-9A-Za-z_.-]/g, "-")}:self`;
  const result = await commitSubmission({
    question: {
      id: qid,
      revision: 1,
      stem: stem || card.summary || card.title,
      answer: { text: answerText || card.summary || "" },
      topic_ids: [realTopicId],
      subject_id: card.subject_id,
      provenance: { kind: "page", verified: true },
      source: "system-study-card"
    },
    response: {
      option_ids: choice ? [choice] : [],
      text: "",
      rating: rating || undefined
    },
    grading: outcome.grading,
    understanding: outcome.understanding,
    helpLevel: rating && rating !== "good" ? "saw_explanation" : "none",
    source: "system-study-card",
    page: {
      url: pageUrl || pagePath(card.url) || "index.html",
      title: card.title,
      anchor: anchorOf(card.url) || card.anchor || ""
    }
  });
  resetLearningCache();
  if (typeof document !== "undefined") {
    document.dispatchEvent(new CustomEvent("zsb:learning-updated", { detail: { topicId: realTopicId } }));
  }
  return result;
}

export function resolveCanonicalTopicId(card, model) {
  if (!card) return "";
  if (model?.topicById?.has(card.id)) return card.id;
  // review:* 卡片映射到对应科目下的 topic
  if (card.id.startsWith("review:")) {
    const anchor = card.anchor || card.id.slice(7);
    const match = model?.site?.topics?.find((t) => (t.source_ref || "").endsWith(`#${anchor}`) || (t.legacy_url || "").endsWith(`#${anchor}`));
    if (match) return match.id;
    const bySubj = model?.topicsOfSubject?.(card.subject_id) || [];
    if (bySubj.length) return bySubj[Math.min(bySubj.length - 1, Math.max(0, (card.order || 1) - 1))].id;
  }
  return card.id;
}

function ensureDialog(id, cls, ariaLabel) {
  let dlg = document.getElementById(id);
  if (dlg) return dlg;
  dlg = el("dialog", { id, class: `sys-dialog ${cls}`, "aria-label": ariaLabel });
  dlg.addEventListener("click", (e) => {
    if (e.target !== dlg) return;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });
  document.body.append(dlg);
  return dlg;
}

function showModalSafe(dlg) {
  if (typeof dlg.showModal === "function") {
    if (!dlg.open) dlg.showModal();
  } else {
    dlg.setAttribute("open", "");
  }
}

// 1. 视频秒级片段直达弹窗（含字幕时间轴点击跳转）
export async function openVideoClipModal(clip, base, allClips = []) {
  const dlg = ensureDialog("sys-video-dialog", "sys-video-dialog", "知识点讲解视频片段");
  const videoUrl = base + clip.url;
  const posterUrl = clip.poster ? base + clip.poster : "";
  const vttUrl = clip.vtt ? base + clip.vtt : "";

  const video = el("video", {
    class: "sys-video-player",
    src: videoUrl,
    poster: posterUrl || null,
    controls: "",
    playsinline: "",
    preload: "metadata"
  });
  if (vttUrl) {
    video.append(el("track", { kind: "captions", srclang: "zh-CN", label: "中文", src: vttUrl, default: "" }));
  }

  const timeTag = el("span", { class: "sys-chip sys-chip--accent", text: `片段 ${clip.label || "00:00"}` });
  const cueList = el("div", { class: "sys-vtt-list", role: "region", "aria-label": "视频字幕时间轴" }, [
    el("p", { class: "sys-vtt-loading", text: "正在加载字幕时间轴…" })
  ]);

  const clipSwitcher = allClips.length > 1
    ? el("div", { class: "sys-clip-tabs", role: "group", "aria-label": "切换本知识点相关视频片段" }, allClips.map((c) => {
        const active = c.url === clip.url && c.start_sec === clip.start_sec;
        const btn = el("button", {
          type: "button",
          class: `sys-clip-tab${active ? " is-on" : ""}`,
          "aria-pressed": String(active),
          text: `▶ ${c.title} (${c.label})`
        });
        btn.addEventListener("click", () => openVideoClipModal(c, base, allClips));
        return btn;
      }))
    : null;

  const closeBtn = el("button", { type: "button", class: "sh-btn sys-dialog__close", "aria-label": "关闭视频" }, [
    icon("close", 16),
    el("span", { text: "关闭" })
  ]);
  closeBtn.addEventListener("click", () => {
    video.pause();
    dlg.close();
  });

  dlg.addEventListener("close", () => video.pause(), { once: true });

  dlg.replaceChildren(
    el("div", { class: "sys-dialog__head" }, [
      el("div", { class: "sys-dialog__titles" }, [
        el("strong", { class: "sys-dialog__title", text: clip.title || "知识点视频精讲" }),
        timeTag
      ]),
      closeBtn
    ]),
    clipSwitcher,
    el("div", { class: "sys-video-body" }, [
      el("div", { class: "sys-video-wrap" }, [video]),
      el("div", { class: "sys-vtt-side" }, [
        el("div", { class: "sys-vtt-head", text: "字幕时间轴（点击任意句跳到对应秒数）" }),
        cueList
      ])
    ])
  );

  showModalSafe(dlg);

  const startSec = Number(clip.start_sec) || 0;
  const seekAndPlay = () => {
    try {
      if (startSec > 0 && Math.abs(video.currentTime - startSec) > 1) {
        video.currentTime = startSec;
      }
      for (const track of video.textTracks || []) {
        track.mode = "showing";
      }
      video.play().catch(() => {});
    } catch {
      // 忽略浏览器自动播放限制
    }
  };
  if (video.readyState >= 1) seekAndPlay();
  else video.addEventListener("loadedmetadata", seekAndPlay, { once: true });

  // 加载并解析 VTT 字幕以供点击跳转
  if (vttUrl) {
    try {
      const res = await fetch(vttUrl);
      if (res.ok) {
        const txt = await res.text();
        const cues = parseVttText(txt);
        if (cues.length) {
          const rows = cues.map((cue) => {
            const inRange = cue.start >= startSec - 2 && (!clip.end_sec || cue.start <= clip.end_sec + 5);
            const row = el("button", {
              type: "button",
              class: `sys-vtt-row${inRange ? " is-range" : ""}`,
              "data-sec": String(cue.start)
            }, [
              el("span", { class: "sys-vtt-row__time", text: formatClock(cue.start) }),
              el("span", { class: "sys-vtt-row__text", text: cue.text })
            ]);
            row.addEventListener("click", () => {
              video.currentTime = cue.start;
              video.play().catch(() => {});
            });
            return row;
          });
          cueList.replaceChildren(...rows);
          const firstInRange = cueList.querySelector(".sys-vtt-row.is-range");
          if (firstInRange) {
            requestAnimationFrame(() => {
              cueList.scrollTop = Math.max(0, firstInRange.offsetTop - 36);
            });
          }
          video.addEventListener("timeupdate", () => {
            const t = video.currentTime;
            for (let i = 0; i < cues.length; i++) {
              const active = t >= cues[i].start && t <= cues[i].end;
              rows[i].classList.toggle("is-active", active);
            }
          });
        } else {
          cueList.replaceChildren(el("p", { class: "sys-vtt-loading", text: "暂无分段字幕文本。" }));
        }
      }
    } catch {
      cueList.replaceChildren(el("p", { class: "sys-vtt-loading", text: "字幕可在播放器右下角开启。" }));
    }
  } else {
    cueList.replaceChildren(el("p", { class: "sys-vtt-loading", text: "当前视频无独立字幕轨。" }));
  }
}

function parseVttText(txt) {
  const cues = [];
  const re = /(\d\d:\d\d:\d\d\.\d+)\s*-->\s*(\d\d:\d\d:\d\d\.\d+)[^\n]*\n([\s\S]*?)(?=\n\n|\Z)/g;
  let m;
  const toSec = (s) => {
    const [h, mi, se] = s.split(":");
    return Number(h) * 3600 + Number(mi) * 60 + Number(se);
  };
  while ((m = re.exec(txt)) !== null) {
    const text = m[3].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text) cues.push({ start: toSec(m[1]), end: toSec(m[2]), text });
  }
  return cues;
}

function formatClock(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// 2. 交互式思维导图 & 站内 SVG/速记图缩放查看器（节点直跳知识点）
export async function openMindmapModal({ card, subjectId, model, cardsDoc, base, initialMediaUrl = "", initialMediaTitle = "" }) {
  const dlg = ensureDialog("sys-mm-dialog", "sys-mm-dialog", "交互式知识导图与速记查看器");
  const subjId = subjectId || card?.subject_id || "network";
  const subject = model.subjectById.get(subjId);
  const chapters = model.chaptersOf(subjId);
  const currentTopicId = resolveCanonicalTopicId(card, model);

  const mediaUrl = initialMediaUrl || (card?.mindmap?.url?.endsWith(".svg") ? base + card.mindmap.url : (card?.illus ? base + card.illus : ""));
  const hasMedia = Boolean(mediaUrl);

  const treePane = el("div", { class: "sys-mm-tree" });
  const mediaPane = el("div", { class: "sys-mm-media", hidden: Boolean(!initialMediaUrl) });

  // 构建章节 -> 知识点交互导图树（每个节点都可点击跳入对应知识点，并显示掌握度与一句话结论）
  const preIds = new Set((model.prereqs(currentTopicId) || []).map((e) => e.prereqId));
  const postIds = new Set((model.successors(currentTopicId) || []).map((e) => e.topicId));

  const treeHeader = el("div", { class: "sys-mm-legend" }, [
    el("span", { class: "sys-mm-legend__title", text: `${shortSubjectName(subject)} · 知识导图树（点击任意节点直达知识点）` }),
    el("div", { class: "sys-mm-legend__items" }, [
      el("span", {}, [statusDot("mastered"), el("span", { text: "已掌握" })]),
      el("span", {}, [statusDot("due"), el("span", { text: "待复习" })]),
      el("span", {}, [statusDot("learning"), el("span", { text: "学习中" })]),
      el("span", {}, [statusDot("none"), el("span", { text: "未学" })])
    ])
  ]);

  const branchNodes = chapters.map((node, cIdx) => {
    const chProgress = model.progressOf(node.topics);
    const topicItems = node.topics.map((t, tIdx) => {
      const tCard = cardsDoc?.cards?.[t.id];
      const st = model.topicStatus(t.id);
      const isCurrent = t.id === currentTopicId;
      const isPre = preIds.has(t.id);
      const isPost = postIds.has(t.id);
      const href = topicHref(t, base) || (tCard?.url ? base + tCard.url : "");

      const relationBadge = isCurrent
        ? el("span", { class: "sys-mm-tag sys-mm-tag--current", text: "当前所在" })
        : isPre
          ? el("span", { class: "sys-mm-tag sys-mm-tag--pre", text: "先修前置" })
          : isPost
            ? el("span", { class: "sys-mm-tag sys-mm-tag--post", text: "后续延伸" })
            : null;

      const link = el(href ? "a" : "div", {
        class: `sys-mm-node${isCurrent ? " is-current" : ""}${isPre ? " is-pre" : ""}${isPost ? " is-post" : ""}`,
        href: href || null,
        "data-topic-id": t.id
      }, [
        el("div", { class: "sys-mm-node__top" }, [
          statusDot(st, STATUS_LABEL[st]),
          el("span", { class: "sys-mm-node__no", text: `${cIdx + 1}.${tIdx + 1}` }),
          el("strong", { class: "sys-mm-node__title", text: t.title }),
          relationBadge,
          tCard?.video_clips?.length ? el("span", { class: "sys-mm-tag", text: "▶ 视频" }) : null
        ]),
        tCard?.summary ? el("p", { class: "sys-mm-node__sum", text: tCard.summary }) : null
      ]);
      if (href) {
        link.addEventListener("click", () => dlg.close());
      }
      return el("li", { class: "sys-mm-leaf" }, [link]);
    });

    const details = el("details", { class: "sys-mm-chapter", open: "" }, [
      el("summary", { class: "sys-mm-chapter__sum" }, [
        el("strong", { text: node.chapter.title }),
        el("span", { class: "sys-mm-chapter__meta", text: `${chProgress.done}/${chProgress.total} 已学 (${chProgress.pct}%)` })
      ]),
      el("ul", { class: "sys-mm-list" }, topicItems)
    ]);
    return details;
  });

  // 对于计算机网络和网页设计，同时挂载课堂复习知识路径节点
  const reviewCards = Object.values(cardsDoc?.cards || {})
    .filter((c) => c.id.startsWith("review:") && c.subject_id === subjId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  if (reviewCards.length) {
    const revDetails = el("details", { class: "sys-mm-chapter", open: "" }, [
      el("summary", { class: "sys-mm-chapter__sum" }, [
        el("strong", { text: `${shortSubjectName(subject)} · 课堂全考点复习主线（${reviewCards.length} 节）` }),
        el("span", { class: "sys-mm-chapter__meta", text: "按知识点顺序直达" })
      ]),
      el("ul", { class: "sys-mm-list" }, reviewCards.map((rc) => {
        const isCurrent = rc.id === card?.id;
        const href = base + rc.url;
        const link = el("a", {
          class: `sys-mm-node${isCurrent ? " is-current" : ""}`,
          href
        }, [
          el("div", { class: "sys-mm-node__top" }, [
            el("span", { class: "sys-mm-node__no", text: String(rc.order).padStart(2, "0") }),
            el("strong", { class: "sys-mm-node__title", text: rc.title }),
            isCurrent ? el("span", { class: "sys-mm-tag sys-mm-tag--current", text: "当前所在" }) : null
          ]),
          rc.summary ? el("p", { class: "sys-mm-node__sum", text: rc.summary }) : null
        ]);
        link.addEventListener("click", () => dlg.close());
        return el("li", { class: "sys-mm-leaf" }, [link]);
      }))
    ]);
    branchNodes.unshift(revDetails);
  }

  treePane.replaceChildren(treeHeader, ...branchNodes);

  // 原版 SVG 思维导图 / 速记图可缩放画布
  let scale = 1;
  const stageInner = el("div", { class: "sys-zoom-stage__inner" });
  const stage = el("div", { class: "sys-zoom-stage" }, [stageInner]);
  const zoomLabel = el("span", { class: "sys-zoom-bar__pct", text: "100%" });
  const applyZoom = (nextScale) => {
    scale = Math.max(0.5, Math.min(3.5, Number(nextScale.toFixed(2))));
    stageInner.style.transform = `scale(${scale})`;
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  };

  if (hasMedia) {
    const zoomIn = el("button", { type: "button", class: "sh-btn", text: "放大 +" });
    const zoomOut = el("button", { type: "button", class: "sh-btn", text: "缩小 −" });
    const zoomReset = el("button", { type: "button", class: "sh-btn", text: "重置 100%" });
    zoomIn.addEventListener("click", () => applyZoom(scale * 1.25));
    zoomOut.addEventListener("click", () => applyZoom(scale / 1.25));
    zoomReset.addEventListener("click", () => {
      applyZoom(1);
      stage.scrollTo(0, 0);
    });

    // 英语 4 张导图快速切换器
    let svgSwitcher = null;
    if (subjId === "english" || mediaUrl.includes("/mm/mm")) {
      const mmList = [
        ["mm1.svg", "导图1：非谓语动词"],
        ["mm2.svg", "导图2：定语从句"],
        ["mm3.svg", "导图3：名词性从句"],
        ["mm4.svg", "导图4：状语从句"]
      ];
      svgSwitcher = el("div", { class: "sys-clip-tabs", role: "group", "aria-label": "英语思维导图切换" }, mmList.map(([file, label]) => {
        const targetUrl = `${base}yy/mm/${file}`;
        const on = mediaUrl.endsWith(file);
        const b = el("button", { type: "button", class: `sys-clip-tab${on ? " is-on" : ""}`, "aria-pressed": String(on), text: label });
        b.addEventListener("click", () => openMindmapModal({ card, subjectId: "english", model, cardsDoc, base, initialMediaUrl: targetUrl, initialMediaTitle: label }));
        return b;
      }));
    }

    const toolbar = el("div", { class: "sys-zoom-bar" }, [
      el("strong", { text: initialMediaTitle || card?.mindmap?.label || "思维导图 / 速记大图（支持缩放与节点点击）" }),
      el("div", { class: "sys-zoom-bar__btns" }, [zoomOut, zoomLabel, zoomIn, zoomReset])
    ]);
    mediaPane.replaceChildren(svgSwitcher, toolbar, stage);

    if (mediaUrl.endsWith(".svg")) {
      stageInner.replaceChildren(el("p", { class: "sys-vtt-loading", text: "正在载入矢量思维导图…" }));
      fetch(mediaUrl)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
        .then((svgText) => {
          const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
          const svgNode = doc.querySelector("svg");
          if (!svgNode) throw new Error("bad-svg");
          svgNode.classList.add("sys-inline-svg");
          const svgDir = new URL(".", new URL(mediaUrl, location.href));
          for (const a of svgNode.querySelectorAll("a[href]")) {
            const rawHref = a.getAttribute("href");
            if (!rawHref) continue;
            const resolved = new URL(rawHref, svgDir).href;
            a.setAttribute("href", resolved);
            a.addEventListener("click", () => dlg.close());
          }
          stageInner.replaceChildren(svgNode);
        })
        .catch(() => {
          stageInner.replaceChildren(el("img", { src: mediaUrl, alt: initialMediaTitle || "思维导图", class: "sys-zoom-img" }));
        });
    } else {
      stageInner.replaceChildren(el("img", { src: mediaUrl, alt: initialMediaTitle || card?.title || "速记图", class: "sys-zoom-img" }));
    }
  }

  // 顶部视图切换（交互导图树 vs 原图/矢量图查看器）
  const treeBtn = el("button", {
    type: "button",
    class: `sys-clip-tab${!initialMediaUrl ? " is-on" : ""}`,
    "aria-pressed": String(!initialMediaUrl),
    text: "🗺️ 交互式知识树（点节点直达）"
  });
  const mediaBtn = hasMedia ? el("button", {
    type: "button",
    class: `sys-clip-tab${initialMediaUrl ? " is-on" : ""}`,
    "aria-pressed": String(Boolean(initialMediaUrl)),
    text: "🔍 速记图 / 矢量导图缩放查看"
  }) : null;

  treeBtn.addEventListener("click", () => {
    treePane.hidden = false;
    mediaPane.hidden = true;
    treeBtn.classList.add("is-on");
    treeBtn.setAttribute("aria-pressed", "true");
    mediaBtn?.classList.remove("is-on");
    mediaBtn?.setAttribute("aria-pressed", "false");
  });
  mediaBtn?.addEventListener("click", () => {
    treePane.hidden = true;
    mediaPane.hidden = false;
    mediaBtn.classList.add("is-on");
    mediaBtn.setAttribute("aria-pressed", "true");
    treeBtn.classList.remove("is-on");
    treeBtn.setAttribute("aria-pressed", "false");
  });
  treePane.hidden = Boolean(initialMediaUrl && hasMedia);

  const closeBtn = el("button", { type: "button", class: "sh-btn sys-dialog__close", "aria-label": "关闭导图" }, [
    icon("close", 16),
    el("span", { text: "返回学习" })
  ]);
  closeBtn.addEventListener("click", () => dlg.close());

  dlg.replaceChildren(
    el("div", { class: "sys-dialog__head" }, [
      el("div", { class: "sys-clip-tabs" }, [treeBtn, mediaBtn]),
      closeBtn
    ]),
    treePane,
    mediaPane
  );

  showModalSafe(dlg);

  const currentNode = treePane.querySelector(".sys-mm-node.is-current");
  if (currentNode && !treePane.hidden) {
    requestAnimationFrame(() => currentNode.scrollIntoView({ block: "center" }));
  }
}

// 3. 手机/桌面沉浸式滑卡复习器（支持左右滑动、遮挡揭晓、自测与 FSRS 三档打卡）
export function openSlideDeckModal({ cards, model, cardsDoc, base, startIndex = 0, title = "知识点滑卡速刷", onUpdated }) {
  if (!cards || !cards.length) return;
  const dlg = ensureDialog("sys-deck-dialog", "sys-deck-dialog", title);
  let list = [...cards];
  let idx = Math.max(0, Math.min(list.length - 1, startIndex));
  let clozeOn = true;
  let filterMode = "all"; // all | unmastered | due

  const progressText = el("span", { class: "sys-deck__count" });
  const stage = el("div", { class: "sys-deck__stage", tabindex: "0" });
  const feedback = el("p", { class: "sys-deck__feedback", role: "status", "aria-live": "polite" });

  const filterBtns = [
    ["all", `全部 (${cards.length})`],
    ["unmastered", "未掌握"],
    ["due", "待复习"]
  ].map(([key, label]) => {
    const b = el("button", {
      type: "button",
      class: `sys-clip-tab${key === filterMode ? " is-on" : ""}`,
      "aria-pressed": String(key === filterMode),
      text: label
    });
    b.addEventListener("click", () => {
      filterMode = key;
      for (const x of filterBtns) {
        const on = x === b;
        x.classList.toggle("is-on", on);
        x.setAttribute("aria-pressed", String(on));
      }
      if (key === "all") list = [...cards];
      else if (key === "unmastered") list = cards.filter((c) => model.topicStatus(resolveCanonicalTopicId(c, model)) !== "mastered");
      else list = cards.filter((c) => model.topicStatus(resolveCanonicalTopicId(c, model)) === "due");
      if (!list.length) list = [...cards];
      idx = 0;
      paintCard();
    });
    return b;
  });

  const clozeBtn = el("button", {
    type: "button",
    class: "sh-btn sys-deck__cloze-btn",
    "aria-pressed": String(clozeOn),
    text: clozeOn ? "🔒 遮挡开启" : "🔓 全部显示"
  });
  clozeBtn.addEventListener("click", () => {
    clozeOn = !clozeOn;
    clozeBtn.setAttribute("aria-pressed", String(clozeOn));
    clozeBtn.textContent = clozeOn ? "🔒 遮挡开启" : "🔓 全部显示";
    setPageClozeMode(stage, clozeOn);
  });

  const closeBtn = el("button", { type: "button", class: "sh-btn sys-dialog__close", "aria-label": "关闭滑卡" }, [
    icon("close", 16),
    el("span", { text: "退出滑卡" })
  ]);
  closeBtn.addEventListener("click", () => dlg.close());

  function step(delta) {
    if (!list.length) return;
    idx = (idx + delta + list.length) % list.length;
    feedback.textContent = "左右滑动或按 ← / → 切卡，按 Space 揭晓遮挡，按 1 / 2 / 3 打卡掌握度。";
    paintCard();
  }

  async function rateCurrent(rating, label) {
    const card = list[idx];
    if (!card) return;
    feedback.textContent = "正在记录掌握度与复习计划…";
    try {
      await saveCardAttempt({ card, model, rating, pageUrl: pagePath(card.url) });
      const freshModel = await loadModel();
      Object.assign(model, freshModel);
      onUpdated?.(freshModel);
      feedback.textContent = `已标记「${label}」· 自动切至下一张`;
      setTimeout(() => {
        if (idx < list.length - 1) step(1);
        else paintCard();
      }, 280);
    } catch {
      feedback.textContent = "保存失败，请检查浏览器存储权限。";
    }
  }

  function paintCard() {
    const card = list[idx];
    if (!card) return;
    const tid = resolveCanonicalTopicId(card, model);
    const st = model.topicStatus(tid);
    progressText.textContent = `${idx + 1} / ${list.length}`;

    const answerBox = el("details", { class: "sys-deck__back" }, [
      el("summary", { class: "sys-deck__flip" }, [
        el("span", { text: "🔄 点击翻转背面：查看直观讲解、易错点与自测解析（或按 Enter）" })
      ]),
      el("div", { class: "sys-deck__back-body" }, [
        card.explain?.intuition ? el("div", { class: "sys-deck__sec" }, [
          el("strong", { text: "💡 直观理解：" }),
          el("p", { text: card.explain.intuition })
        ]) : null,
        card.pitfalls?.length ? el("div", { class: "sys-deck__pitfall" }, [
          el("strong", { text: "⚠️ 易错提醒：" }),
          el("ul", {}, card.pitfalls.map((p) => el("li", { text: p })))
        ]) : null,
        card.example ? el("div", { class: "sys-deck__sec" }, [
          el("strong", { text: `📝 典型例题：${card.example.q}` }),
          el("p", { class: "sys-deck__ans", text: `解析：${card.example.a}` })
        ]) : null
      ])
    ]);

    const href = card.url ? base + card.url : "";
    const cardNode = el("article", { class: "sys-deck-card" }, [
      el("header", { class: "sys-deck-card__head" }, [
        el("div", { class: "sys-deck-card__meta" }, [
          statusDot(st, STATUS_LABEL[st]),
          el("span", { class: "sys-chip", text: card.chapter_title || shortSubjectName(model.subjectById.get(card.subject_id)) }),
          el("span", { class: "sys-chip", text: STATUS_LABEL[st] || "未学" })
        ]),
        href ? el("a", { class: "sys-deck-card__goto", href, onclick: () => dlg.close(), text: "打开完整讲义 →" }) : null
      ]),
      el("h2", { class: "sys-deck-card__title", text: card.title }),
      el("div", { class: "sys-deck-card__l0" }, [
        el("span", { class: "sys-badge-l0", text: "一句话核心结论" }),
        el("p", {}, buildClozeNodes(card.summary, clozeOn))
      ]),
      el("div", { class: "sys-deck-card__l1" }, [
        el("strong", { class: "sys-deck-card__sub", text: "必背要点（点击遮挡处揭晓）" }),
        el("ul", { class: "sys-must-list" }, (card.must_know || []).map((item) => el("li", {}, buildClozeNodes(item, clozeOn))))
      ]),
      el("div", { class: "sys-deck-card__media" }, [
        el("button", {
          type: "button",
          class: "sh-btn sys-btn-media sys-tool-btn--lab",
          onclick: () => void launchCodeLabModal({ card, title: `${card.title} · 随堂实操`, base }),
          text: "💻 动手实操本考点"
        }),
        card.video_clips?.length ? el("button", {
          type: "button",
          class: "sh-btn sys-btn-media",
          onclick: () => openVideoClipModal(card.video_clips[0], base, card.video_clips),
          text: `▶ 观看视频精讲 (${card.video_clips[0].label})`
        }) : null,
        card.illus ? el("button", {
          type: "button",
          class: "sh-btn sys-btn-media",
          onclick: () => openMindmapModal({ card, subjectId: card.subject_id, model, cardsDoc, base, initialMediaUrl: base + card.illus, initialMediaTitle: `${card.title} · 速记图` }),
          text: "🖼️ 查看速记图"
        }) : null
      ]),
      answerBox
    ]);

    stage.replaceChildren(cardNode);
  }

  // 触屏左右滑动支持
  let touchX = null;
  let touchY = null;
  stage.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    }
  }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (touchX === null || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    touchX = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      step(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  const prevBtn = el("button", { type: "button", class: "sh-btn sys-deck__nav", "aria-label": "上一张卡片", onclick: () => step(-1) }, [
    icon("chevronLeft", 16), el("span", { text: "上一张" })
  ]);
  const nextBtn = el("button", { type: "button", class: "sh-btn sys-deck__nav", "aria-label": "下一张卡片", onclick: () => step(1) }, [
    el("span", { text: "下一张" }), icon("chevron", 16)
  ]);
  const btnAgain = el("button", { type: "button", class: "sh-btn sys-rate-btn sys-rate-btn--again", onclick: () => rateCurrent("again", "不会 · 明天复习") }, [
    el("strong", { text: "不会" }), el("small", { text: "明天复习(1)" })
  ]);
  const btnFuzzy = el("button", { type: "button", class: "sh-btn sys-rate-btn sys-rate-btn--fuzzy", onclick: () => rateCurrent("fuzzy", "模糊 · 2天后复习") }, [
    el("strong", { text: "模糊" }), el("small", { text: "2天后复习(2)" })
  ]);
  const btnGood = el("button", { type: "button", class: "sh-btn sys-rate-btn sys-rate-btn--good", onclick: () => rateCurrent("good", "会了 · 独立掌握") }, [
    el("strong", { text: "会了" }), el("small", { text: "已掌握(3)" })
  ]);

  dlg.onkeydown = (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (e.key === "ArrowLeft" || e.key === "k" || e.key === "K") { e.preventDefault(); step(-1); }
    else if (e.key === "ArrowRight" || e.key === "j" || e.key === "J") { e.preventDefault(); step(1); }
    else if (e.key === " ") {
      const nextMask = stage.querySelector(".sys-cloze.is-masked");
      if (nextMask) { e.preventDefault(); nextMask.click(); }
    } else if (e.key === "1") { e.preventDefault(); btnAgain.click(); }
    else if (e.key === "2") { e.preventDefault(); btnFuzzy.click(); }
    else if (e.key === "3") { e.preventDefault(); btnGood.click(); }
  };

  feedback.textContent = "左右滑动或按 ← / → 切卡，点击黄色遮挡块揭晓答案，底部三键记入间隔重复复习。";
  paintCard();

  dlg.replaceChildren(
    el("div", { class: "sys-dialog__head sys-deck__head" }, [
      el("div", { class: "sys-deck__title-wrap" }, [
        el("strong", { class: "sys-dialog__title", text: title }),
        progressText
      ]),
      el("div", { class: "sys-deck__tools" }, [...filterBtns, clozeBtn, closeBtn])
    ]),
    stage,
    feedback,
    el("div", { class: "sys-deck__foot" }, [prevBtn, btnAgain, btnFuzzy, btnGood, nextBtn])
  );

  showModalSafe(dlg);
  stage.focus({ preventScroll: true });
}

// 3.5 本章必背清单弹窗（一页速背 / 全章遮挡 / A4 打印）
export function openChapterSummaryModal({ cards, title = "本章必背清单", model, cardsDoc, base }) {
  if (!cards || !cards.length) return;
  const dlg = ensureDialog("sys-summary-dialog", "sys-summary-dialog", title);
  let clozeOn = readStudyMode() === "cloze";

  const body = el("div", { class: "sys-summary-body" });
  const clozeBtn = el("button", {
    type: "button",
    class: `sh-btn${clozeOn ? " sh-btn--primary" : ""}`,
    "aria-pressed": String(clozeOn),
    text: clozeOn ? "🔒 全章遮挡：开" : "🔓 全章遮挡背诵"
  });
  clozeBtn.addEventListener("click", () => {
    clozeOn = !clozeOn;
    clozeBtn.classList.toggle("sh-btn--primary", clozeOn);
    clozeBtn.setAttribute("aria-pressed", String(clozeOn));
    clozeBtn.textContent = clozeOn ? "🔒 全章遮挡：开" : "🔓 全章遮挡背诵";
    setPageClozeMode(body, clozeOn);
  });

  const printBtn = el("button", {
    type: "button",
    class: "sh-btn",
    onclick: () => window.print(),
    text: "🖨️ 打印 / 存为 PDF"
  });
  const deckBtn = el("button", {
    type: "button",
    class: "sh-btn sh-btn--primary",
    onclick: () => {
      dlg.close();
      openSlideDeckModal({ cards, model, cardsDoc, base, title: `${title} · 滑卡速刷` });
    },
    text: "🗂️ 转入滑卡速刷"
  });
  const closeBtn = el("button", { type: "button", class: "sh-btn sys-dialog__close", "aria-label": "关闭清单", onclick: () => dlg.close() }, [
    icon("close", 16), el("span", { text: "关闭" })
  ]);

  const items = cards.map((c, idx) => {
    const tid = resolveCanonicalTopicId(c, model);
    const st = model.topicStatus(tid);
    const href = c.url ? base + c.url : "";
    return el("article", { class: "sys-summary-item" }, [
      el("header", { class: "sys-summary-item__head" }, [
        el("div", { class: "sys-summary-item__title" }, [
          statusDot(st, STATUS_LABEL[st]),
          el("span", { class: "sys-chip", text: `${idx + 1}` }),
          href
            ? el("a", { href, onclick: () => dlg.close(), text: c.title })
            : el("strong", { text: c.title })
        ]),
        el("span", { class: `sys-status-badge is-${st}`, text: STATUS_LABEL[st] || "未学" })
      ]),
      el("p", { class: "sys-summary-item__l0" }, [
        el("strong", { text: "核心结论：" }),
        ...buildClozeNodes(c.summary, clozeOn)
      ]),
      el("ul", { class: "sys-must-list" }, (c.must_know || []).slice(0, 4).map((m) => el("li", {}, buildClozeNodes(m, clozeOn)))),
      c.pitfalls?.[0] ? el("p", { class: "sys-summary-item__pit", text: `⚠️ 易错：${c.pitfalls[0]}` }) : null
    ]);
  });

  body.replaceChildren(...items);
  dlg.replaceChildren(
    el("div", { class: "sys-dialog__head" }, [
      el("div", { class: "sys-dialog__titles" }, [
        el("strong", { class: "sys-dialog__title", text: `${title}（共 ${cards.length} 节一页速背）` })
      ]),
      el("div", { class: "sys-deck__tools" }, [clozeBtn, deckBtn, printBtn, closeBtn])
    ]),
    body
  );
  showModalSafe(dlg);
}

// 3.8 随堂闯关测验弹窗（对标 Quizlet / LeetCode：连对计分、第一眼破题提示、即时判分入库、错题重闯）
export function openQuizChallengeModal({ cards, model, cardsDoc, base, title = "随堂闯关测验", onUpdated }) {
  const poolCards = (cards && cards.length ? cards : Object.values(cardsDoc?.cards || [])).filter(Boolean);
  const items = [];
  const seenQ = new Set();
  const collectFrom = (list) => {
    for (const c of list) {
      for (const q of c.quizzes || []) {
        if (q.type === "single_choice" && q.options?.length >= 2 && !seenQ.has(q.id)) {
          seenQ.add(q.id);
          items.push({ card: c, quiz: q });
        }
      }
    }
  };
  collectFrom(poolCards);
  if (items.length < 5 && cardsDoc?.cards) {
    const subjId = poolCards[0]?.subject_id;
    const extra = Object.values(cardsDoc.cards).filter((c) => !subjId || c.subject_id === subjId);
    collectFrom(extra);
  }
  if (!items.length) return;

  const dlg = ensureDialog("sys-quiz-dialog", "sys-quiz-dialog", title);
  let activeItems = items.slice(0, 12);
  let qIndex = 0;
  let score = 0;
  let streak = 0;
  let answeredCurrent = false;
  const wrongItems = [];

  const counterEl = el("span", { class: "sys-deck__count" });
  const scoreEl = el("span", { class: "sys-chip sys-chip--accent" });
  const stage = el("div", { class: "sys-challenge__stage" });
  const closeBtn = el("button", { type: "button", class: "sh-btn sys-dialog__close", "aria-label": "关闭测验", onclick: () => dlg.close() }, [
    icon("close", 16), el("span", { text: "退出测验" })
  ]);

  function renderQuestion() {
    if (qIndex >= activeItems.length) {
      renderSummary();
      return;
    }
    answeredCurrent = false;
    const { card, quiz } = activeItems[qIndex];
    counterEl.textContent = `第 ${qIndex + 1} / ${activeItems.length} 题`;
    scoreEl.textContent = `答对 ${score} 题 · 连对 🔥 ${streak}`;

    const hintText = quiz.hint || card.explain?.steps?.[0] || card.summary || "";
    const hintBox = el("p", { class: "sys-challenge__hint", hidden: true, text: `💡 破题提示：${hintText}` });
    const hintBtn = hintText ? el("button", {
      type: "button",
      class: "sh-btn sys-tool-btn",
      onclick: () => { hintBox.hidden = !hintBox.hidden; },
      text: "💡 查看第一眼破题提示"
    }) : null;

    const explainBox = el("div", { class: "sys-challenge__explain", role: "status", "aria-live": "polite", hidden: true });
    const nextBtn = el("button", {
      type: "button",
      class: "sh-btn sh-btn--primary sys-challenge__next",
      hidden: true,
      onclick: () => {
        qIndex += 1;
        renderQuestion();
      },
      text: qIndex + 1 < activeItems.length ? "下一题 (Enter) →" : "查看闯关成绩单 →"
    });

    const optBtns = quiz.options.map((opt, oIdx) => {
      const b = el("button", {
        type: "button",
        class: "sys-quiz__opt sys-challenge__opt",
        "data-opt": opt.id
      }, [
        el("strong", { class: "sys-quiz__opt-id", text: `${opt.id}.` }),
        el("span", { text: opt.text }),
        el("small", { class: "sys-challenge__key", text: String(oIdx + 1) })
      ]);
      b.addEventListener("click", async () => {
        if (answeredCurrent) return;
        answeredCurrent = true;
        const isRight = opt.id === quiz.answer;
        if (isRight) {
          score += 1;
          streak += 1;
        } else {
          streak = 0;
          wrongItems.push({ card, quiz, picked: opt.id });
        }
        scoreEl.textContent = `答对 ${score} 题 · 连对 🔥 ${streak}`;
        for (const x of optBtns) {
          x.disabled = true;
          if (x.dataset.opt === quiz.answer) x.classList.add("is-correct");
        }
        b.classList.add("is-picked", isRight ? "is-correct" : "is-wrong");
        explainBox.hidden = false;
        explainBox.className = `sys-challenge__explain ${isRight ? "is-ok" : "is-bad"}`;
        explainBox.replaceChildren(
          el("strong", { text: isRight ? "✓ 回答正确！掌握度已提升" : `✗ 回答错误，正确答案是 ${quiz.answer}（已自动排入明日间隔复习）` }),
          el("p", { text: quiz.explanation || card.summary || "" })
        );
        nextBtn.hidden = false;
        nextBtn.focus({ preventScroll: true });
        try {
          await saveCardAttempt({
            card,
            model,
            quizId: quiz.id,
            stem: quiz.stem,
            answerText: quiz.explanation || quiz.answer,
            choice: opt.id,
            correct: quiz.answer,
            pageUrl: pagePath(card.url)
          });
          const fresh = await loadModel();
          Object.assign(model, fresh);
          onUpdated?.(fresh);
        } catch {
          // 忽略存储限制
        }
      });
      return b;
    });

    stage.replaceChildren(
      el("div", { class: "sys-challenge__card" }, [
        el("div", { class: "sys-challenge__top" }, [
          el("span", { class: "sys-chip", text: `${card.chapter_title || "核心考点"} · ${card.title}` }),
          hintBtn
        ]),
        hintBox,
        el("h3", { class: "sys-challenge__stem", text: stemLead(quiz.stem) }),
        stemCode(quiz.stem),
        el("div", { class: "sys-challenge__opts" }, optBtns),
        explainBox,
        el("div", { class: "sys-challenge__actions" }, [nextBtn])
      ])
    );
  }

  function renderSummary() {
    const pct = Math.round((score / Math.max(1, activeItems.length)) * 100);
    counterEl.textContent = "闯关完成";
    scoreEl.textContent = `正确率 ${pct}% (${score}/${activeItems.length})`;

    const retryWrongBtn = wrongItems.length ? el("button", {
      type: "button",
      class: "sh-btn sh-btn--primary",
      onclick: () => {
        activeItems = wrongItems.splice(0, wrongItems.length).map((w) => ({ card: w.card, quiz: w.quiz }));
        qIndex = 0;
        score = 0;
        streak = 0;
        renderQuestion();
      },
      text: `🔁 仅重闯本次错题 (${wrongItems.length} 题)`
    }) : null;

    const deckWeakBtn = wrongItems.length ? el("button", {
      type: "button",
      class: "sh-btn",
      onclick: () => {
        const weakCards = [...new Map(wrongItems.map((w) => [w.card.id, w.card])).values()];
        dlg.close();
        openSlideDeckModal({ cards: weakCards, model, cardsDoc, base, title: "错题关联知识点 · 滑卡强化" });
      },
      text: "🗂️ 转入滑卡背诵薄弱点"
    }) : null;

    const restartBtn = el("button", {
      type: "button",
      class: "sh-btn",
      onclick: () => {
        activeItems = items.slice(0, 12);
        wrongItems.length = 0;
        qIndex = 0;
        score = 0;
        streak = 0;
        renderQuestion();
      },
      text: "🔄 重新闯关一轮"
    });

    stage.replaceChildren(
      el("div", { class: "sys-challenge__summary" }, [
        el("h2", { class: "sys-challenge__score-title", text: pct >= 80 ? `🏆 闯关优秀！正确率 ${pct}%` : `💪 闯关完成！正确率 ${pct}%` }),
        el("p", { class: "sys-challenge__score-sub", text: `共完成 ${activeItems.length} 道真题/自测题，答对 ${score} 道，答错 ${wrongItems.length} 道（错题已自动写入错题本与明日 FSRS 复习队列）。` }),
        wrongItems.length ? el("div", { class: "sys-challenge__wrong-list" }, [
          el("strong", { text: "本次需强化的薄弱知识点：" }),
          el("ul", {}, wrongItems.map((w) => el("li", { text: `【${w.card.title}】${w.quiz.stem}（你的选择：${w.picked}，正解：${w.quiz.answer}）` })))
        ]) : el("p", { class: "sys-challenge__perfect", text: "✨ 全部一次做对！对应知识点均已记为「已掌握」。" }),
        el("div", { class: "sys-challenge__sum-btns" }, [retryWrongBtn, deckWeakBtn, restartBtn])
      ])
    );
  }

  dlg.onkeydown = (e) => {
    if (e.target.matches("input, textarea, select")) return;
    if (!answeredCurrent && /^[1-4a-dA-D]$/.test(e.key)) {
      const idx = /^[1-4]$/.test(e.key) ? Number(e.key) - 1 : e.key.toUpperCase().charCodeAt(0) - 65;
      const btns = stage.querySelectorAll(".sys-challenge__opt");
      if (btns[idx]) { e.preventDefault(); btns[idx].click(); }
    } else if (answeredCurrent && (e.key === "Enter" || e.key === " ")) {
      const nextB = stage.querySelector(".sys-challenge__next:not([hidden])");
      if (nextB) { e.preventDefault(); nextB.click(); }
    }
  };

  renderQuestion();
  dlg.replaceChildren(
    el("div", { class: "sys-dialog__head sys-deck__head" }, [
      el("div", { class: "sys-deck__title-wrap" }, [
        el("strong", { class: "sys-dialog__title", text: `🎯 ${title}` }),
        counterEl,
        scoreEl
      ]),
      closeBtn
    ]),
    stage
  );
  showModalSafe(dlg);
}

// 3.9 知识点随手备忘与易错贴（对标 Notion / Obsidian，自动持久化到本机 IndexedDB note_entries）
function renderPersonalNoteBox(card, canonicalId) {
  const localKey = `zsb.note.${canonicalId}`;
  const statusEl = el("span", { class: "sys-note__status", text: "本机自动保存" });
  const input = el("textarea", {
    class: "sys-note__input",
    rows: "2",
    placeholder: `记录你对「${card.title}」的独家口诀、老师强调重点或自己的易错提醒…`
  });

  // 异步读取已存笔记
  try {
    const cached = localStorage.getItem(localKey);
    if (cached) input.value = cached;
  } catch { /* ignore */ }
  get("note_entries", `note:${LEARNER_ID}:${canonicalId}`)
    .then((entry) => {
      if (entry?.body) {
        input.value = entry.body;
        statusEl.textContent = "✓ 已载入本机备忘";
      }
    })
    .catch(() => {});

  const doSave = async () => {
    const body = input.value.trim();
    try { localStorage.setItem(localKey, body); } catch { /* ignore */ }
    statusEl.textContent = "正在保存…";
    try {
      await saveNote({ topicId: canonicalId, title: card.title, body });
      statusEl.textContent = body ? "✓ 已保存到本机学习档案" : "已清空备忘";
    } catch {
      statusEl.textContent = "✓ 已暂存至本地缓存";
    }
  };

  const saveBtn = el("button", {
    type: "button",
    class: "sh-btn sys-note__save",
    onclick: doSave,
    text: "💾 保存备忘"
  });
  input.addEventListener("blur", doSave);

  return el("div", { class: "sys-note-box" }, [
    el("div", { class: "sys-note__head" }, [
      el("strong", { class: "sys-note__title", text: "✏️ 我的随手备忘与易错贴" }),
      el("div", { class: "sys-note__actions" }, [statusEl, saveBtn])
    ]),
    input
  ]);
}

// 4. 统一系统学习知识点卡（L0 一句话结论 -> 双栏紧凑 [L1 必背遮挡 | L2 直观讲解 + L3 例题与易错] -> L4 学完即测与间隔重复）
export function renderKnowledgeCard(card, { model, cardsDoc, base, pageUrl, index = 0, total = 1, deckCards = [], onUpdated, compactForLecture = false }) {
  if (!card) return null;
  let clozeOn = readStudyMode() === "cloze";
  const canonicalId = resolveCanonicalTopicId(card, model);
  const st = model.topicStatus(canonicalId);
  const stats = model.topicStats(canonicalId);

  const preList = (model.prereqs(canonicalId) || []).filter((e) => e.topic);
  const postList = (model.successors(canonicalId) || []).filter((e) => e.topic);

  // 模式与多媒体工具栏
  const clozeToggle = el("button", {
    type: "button",
    class: `sh-btn sys-tool-btn${clozeOn ? " is-on" : ""}`,
    "aria-pressed": String(clozeOn),
    "data-sys-cloze-toggle": "1",
    title: "快捷键 C：切换遮挡背诵，Space 揭晓下一个词",
    text: clozeOn ? "🔒 遮挡背诵：开" : "🔓 遮挡背诵"
  });
  const deckBtn = el("button", {
    type: "button",
    class: "sh-btn sys-tool-btn",
    "data-sys-tool": "deck",
    title: "快捷键 S：打开滑卡速刷",
    text: "🗂️ 滑卡速刷"
  });
  const summaryBtn = el("button", {
    type: "button",
    class: "sh-btn sys-tool-btn",
    "data-sys-tool": "summary",
    title: "快捷键 L：打开本章必背清单（一页速背/打印）",
    text: "📋 本章必背清单"
  });
  const challengeBtn = el("button", {
    type: "button",
    class: "sh-btn sys-tool-btn",
    "data-sys-tool": "challenge",
    title: "快捷键 Q：打开随堂闯关测验（连对计分/错题重练）",
    text: "🎯 随堂闯关"
  });
  const mmBtn = el("button", {
    type: "button",
    class: "sh-btn sys-tool-btn",
    "data-sys-tool": "mindmap",
    title: "快捷键 M：打开交互式思维导图",
    text: "🗺️ 思维导图定位"
  });
  const labLabel = card.subject_id === "c_language"
    ? "💻 本节写代码"
    : card.subject_id === "web_design"
      ? "💻 实时写网页"
      : (card.subject_id === "network" || card.subject_id === "math" || card.subject_id === "computer_basics")
        ? "💻 动手验算"
        : "💻 实操台";
  const labBtn = el("button", {
    type: "button",
    class: "sh-btn sys-tool-btn sys-tool-btn--lab",
    "data-sys-tool": "lab",
    "data-sys-lab-btn": "1",
    title: "快捷键 R：在当前页打开本知识点专属在线代码实操（C / HTML / SQL）",
    text: labLabel
  });
  const videoBtn = card.video_clips?.length ? el("button", {
    type: "button",
    class: "sh-btn sys-tool-btn sys-tool-btn--video",
    text: `▶ 视频片段 (${card.video_clips[0].label})`
  }) : null;
  const illusBtn = card.illus ? el("button", {
    type: "button",
    class: "sh-btn sys-tool-btn",
    text: "🖼️ 速记图放大"
  }) : null;

  const cardRoot = el("section", {
    class: `sh-card sys-card${compactForLecture ? " sys-card--compact" : ""}`,
    "data-sys-topic-id": card.id,
    "aria-label": `${card.title} 系统学习知识卡`
  });

  clozeToggle.addEventListener("click", () => {
    clozeOn = !(readStudyMode() === "cloze");
    writeStudyMode(clozeOn ? "cloze" : "study");
    setPageClozeMode(document, clozeOn);
  });

  deckBtn.addEventListener("click", () => {
    const list = deckCards.length ? deckCards : [card];
    const startIdx = Math.max(0, list.findIndex((c) => c.id === card.id));
    openSlideDeckModal({
      cards: list,
      model,
      cardsDoc,
      base,
      startIndex: startIdx,
      title: `${card.chapter_title || "本章"} · 滑卡速刷`,
      onUpdated
    });
  });

  summaryBtn.addEventListener("click", () => {
    const rawList = deckCards.length ? deckCards : [card];
    const sameChapter = card.chapter_id ? rawList.filter((c) => c.chapter_id === card.chapter_id) : [];
    const list = sameChapter.length >= 2 ? sameChapter : rawList;
    openChapterSummaryModal({
      cards: list,
      title: `${card.chapter_title || "本章"} · 必背清单`,
      model,
      cardsDoc,
      base
    });
  });

  challengeBtn.addEventListener("click", () => {
    const rawList = deckCards.length ? deckCards : [card];
    const sameChapter = card.chapter_id ? rawList.filter((c) => c.chapter_id === card.chapter_id) : [];
    const others = card.chapter_id ? rawList.filter((c) => c.chapter_id !== card.chapter_id) : [];
    const orderedList = sameChapter.length ? [...sameChapter, ...others] : rawList;
    openQuizChallengeModal({
      cards: orderedList,
      model,
      cardsDoc,
      base,
      title: `${card.chapter_title || "本章"} · 随堂闯关测验`,
      onUpdated
    });
  });

  mmBtn.addEventListener("click", () => {
    openMindmapModal({ card, subjectId: card.subject_id, model, cardsDoc, base });
  });

  labBtn.addEventListener("click", () => {
    const activePanel = document.querySelector(".lx-point-panel:not([hidden])") || document.querySelector("main");
    void launchCodeLabModal({ card, title: `${card.title} · 随堂实操`, base, pageRoot: activePanel });
  });

  videoBtn?.addEventListener("click", () => {
    openVideoClipModal(card.video_clips[0], base, card.video_clips);
  });

  illusBtn?.addEventListener("click", () => {
    openMindmapModal({
      card,
      subjectId: card.subject_id,
      model,
      cardsDoc,
      base,
      initialMediaUrl: base + card.illus,
      initialMediaTitle: `${card.title} · 速记讲解图`
    });
  });

  // 先修与后续知识路径条
  const makeRelChip = (edge, isPre) => {
    const t = edge.topic;
    const href = topicHref(t, base);
    const tst = model.topicStatus(t.id);
    return el(href ? "a" : "span", {
      class: `sys-rel-chip${isPre && edge.strength === "hard" ? " is-hard" : ""}`,
      href: href || null,
      title: isPre ? (edge.strength === "hard" ? "建议先学的前置知识点" : "关联前置知识点") : "学完本节后的下一步"
    }, [
      statusDot(tst, STATUS_LABEL[tst]),
      el("span", { text: t.title })
    ]);
  };

  const routeBar = el("div", { class: "sys-card__route", "aria-label": "知识点前后衔接路线" }, [
    el("div", { class: "sys-card__route-group" }, [
      el("span", { class: "sys-card__route-label", text: "先修前置：" }),
      ...(preList.length ? preList.slice(0, 3).map((e) => makeRelChip(e, true)) : [el("span", { class: "sys-card__route-empty", text: "本章起点（可直接学）" })])
    ]),
    el("div", { class: "sys-card__route-group" }, [
      el("span", { class: "sys-card__route-label", text: "后续衔接：" }),
      ...(postList.length ? postList.slice(0, 3).map((e) => makeRelChip(e, false)) : [el("span", { class: "sys-card__route-empty", text: "本章收官节点" })])
    ])
  ]);

  // L0 一句话核心结论（首屏直达）
  const l0Block = el("div", { class: "sys-card__l0" }, [
    el("div", { class: "sys-card__l0-head" }, [
      el("span", { class: "sys-badge-l0", text: "L0 · 30秒核心结论" }),
      el("span", { class: "sys-card__l0-tip", text: "先抓准这句话，再看下方推导与例题" })
    ]),
    el("p", { class: "sys-card__l0-text" }, buildClozeNodes(card.summary, clozeOn))
  ]);

  // L1 必背要点与速记图
  const l1Block = el("div", { class: "sys-card__section sys-card__l1" }, [
    el("div", { class: "sys-card__sec-head" }, [
      el("strong", { class: "sys-card__sec-title", text: "① 必背结论与记忆要点" }),
      el("small", { class: "sys-card__sec-sub", text: "点击高亮词块可单独遮挡/揭晓" })
    ]),
    el("ul", { class: "sys-must-list" }, (card.must_know || [card.summary]).map((item) =>
      el("li", {}, buildClozeNodes(item, clozeOn))
    ))
  ]);

  // L2 直观讲解、步骤与视频秒级直达
  const videoRow = card.video_clips?.length ? el("div", { class: "sys-card__videos" }, [
    el("span", { class: "sys-card__videos-label", text: "🎬 讲解视频直达：" }),
    ...card.video_clips.map((clip) => {
      const b = el("button", {
        type: "button",
        class: "sys-video-chip",
        text: `▶ ${clip.title} (${clip.label})`
      });
      b.addEventListener("click", () => openVideoClipModal(clip, base, card.video_clips));
      return b;
    })
  ]) : null;

  const stepsList = card.explain?.steps?.length
    ? el("ol", { class: "sys-steps-list" }, card.explain.steps.map((s) => el("li", {}, buildClozeNodes(s, clozeOn))))
    : null;

  const l2Block = el("div", { class: "sys-card__section sys-card__l2" }, [
    el("div", { class: "sys-card__sec-head" }, [
      el("strong", { class: "sys-card__sec-title", text: "② 直观理解与做题步骤" }),
      videoRow
    ]),
    card.explain?.intuition && card.explain.intuition !== card.summary
      ? el("p", { class: "sys-card__intuition", text: `直观理解：${card.explain.intuition}` })
      : null,
    stepsList
  ]);

  // L3 易错点与典型例题
  const pitfallBox = card.pitfalls?.length ? el("div", { class: "sys-card__pitfall" }, [
    el("strong", { class: "sys-card__pitfall-title", text: "⚠️ 考试易错点与辨析" }),
    el("ul", {}, card.pitfalls.map((p) => el("li", {}, buildClozeNodes(p, clozeOn))))
  ]) : null;

  const exampleBox = card.example ? el("details", { class: "sys-card__example" }, [
    el("summary", { class: "sys-card__example-sum" }, [
      el("strong", { text: "③ 典型例题推演：" }),
      el("span", { text: card.example.q })
    ]),
    el("div", { class: "sys-card__example-ans" }, [
      card.example.hint ? el("p", { class: "sys-card__example-hint", text: `💡 第一眼破题判断：${card.example.hint}` }) : null,
      el("strong", { text: "分步解析：" }),
      el("span", { text: card.example.a })
    ])
  ]) : null;

  const noteBox = renderPersonalNoteBox(card, canonicalId);

  // L4 学完即测 & 间隔重复三档自评闭环
  const statusBanner = el("span", {
    class: "sys-card__rate-status",
    role: "status",
    "aria-live": "polite",
    text: stats.nextReview
      ? `当前状态：${STATUS_LABEL[st]} · 下次复习 ${formatDay(stats.nextReview)}`
      : (stats.touched ? `当前状态：${STATUS_LABEL[st]} · 已练 ${stats.answered} 题` : "学完后完成下方自测或自评，自动排入间隔重复复习队列")
  });

  const statusBannerCompact = el("span", {
    class: "sys-card__rate-status",
    role: "status",
    "aria-live": "polite",
    text: statusBanner.textContent
  });

  const statusBadge = el("span", { class: `sys-status-badge is-${st}` }, [
    statusDot(st, STATUS_LABEL[st]),
    el("span", { text: STATUS_LABEL[st] || "未学" })
  ]);

  const refreshCardState = async (msg) => {
    const fresh = await loadModel();
    Object.assign(model, fresh);
    const nextSt = fresh.topicStatus(canonicalId);
    const nextStats = fresh.topicStats(canonicalId);
    statusBadge.className = `sys-status-badge is-${nextSt}`;
    statusBadge.replaceChildren(statusDot(nextSt, STATUS_LABEL[nextSt]), el("span", { text: STATUS_LABEL[nextSt] || "未学" }));
    const nextMsg = msg || (nextStats.nextReview
      ? `已记入学习记录（${STATUS_LABEL[nextSt]}）· 下次复习 ${formatDay(nextStats.nextReview)}`
      : `已记入学习记录（${STATUS_LABEL[nextSt]}）`);
    statusBanner.textContent = nextMsg;
    statusBannerCompact.textContent = nextMsg;
    onUpdated?.(fresh);
  };

  const quizNodes = (card.quizzes || []).slice(0, 2).map((q, qIdx) => {
    if (q.type === "single_choice" && q.options?.length) {
      const resultLine = el("p", { class: "sys-quiz__result", role: "status", "aria-live": "polite", hidden: true });
      const hintLine = q.hint ? el("p", { class: "sys-quiz__hint-line", hidden: true, text: `💡 第一眼破题提示：${q.hint}` }) : null;
      const hintToggle = q.hint ? el("button", {
        type: "button",
        class: "sys-quiz__hint-btn",
        onclick: () => { hintLine.hidden = !hintLine.hidden; },
        text: "💡 破题提示"
      }) : null;
      const optBtns = q.options.map((opt) => {
        const b = el("button", {
          type: "button",
          class: "sys-quiz__opt",
          "data-opt": opt.id
        }, [
          el("strong", { class: "sys-quiz__opt-id", text: `${opt.id}.` }),
          el("span", { text: opt.text })
        ]);
        b.addEventListener("click", async () => {
          const isRight = opt.id === q.answer;
          for (const x of optBtns) {
            x.classList.remove("is-picked", "is-correct", "is-wrong");
            if (x.dataset.opt === q.answer) x.classList.add("is-correct");
          }
          b.classList.add("is-picked", isRight ? "is-correct" : "is-wrong");
          resultLine.hidden = false;
          resultLine.className = `sys-quiz__result ${isRight ? "is-ok" : "is-bad"}`;
          resultLine.textContent = isRight
            ? `✓ 回答正确！${q.explanation || ""}`
            : `✗ 正确答案是 ${q.answer}（已自动加入错题与间隔复习队列）。${q.explanation || ""}`;
          try {
            await saveCardAttempt({
              card,
              model,
              quizId: q.id,
              stem: q.stem,
              answerText: q.explanation || q.answer,
              choice: opt.id,
              correct: q.answer,
              pageUrl
            });
            await refreshCardState(isRight ? "✓ 自测做对，已更新掌握进度" : "✗ 自测答错，已自动排入明日到期复习");
          } catch {
            // 忽略存储异常
          }
        });
        return b;
      });
      return el("div", { class: "sys-quiz-box" }, [
        el("p", { class: "sys-quiz__stem" }, [
          el("span", { class: "sys-quiz__tag", text: `即学即测 ${qIdx + 1}` }),
          el("span", { text: stemLead(q.stem) }),
          hintToggle
        ]),
        stemCode(q.stem),
        hintLine,
        el("div", { class: "sys-quiz__opts" }, optBtns),
        resultLine
      ]);
    }

    // 简答/步骤主动回忆题
    return el("details", { class: "sys-quiz-box sys-quiz-box--qa" }, [
      el("summary", { class: "sys-quiz__qa-sum" }, [
        el("span", { class: "sys-quiz__tag", text: `主动回忆自测 ${qIdx + 1}` }),
        el("span", { text: q.stem }),
        el("span", { class: "sys-quiz__qa-hint", text: "先在脑中作答，再点击核对 →" })
      ]),
      el("div", { class: "sys-quiz__qa-ans" }, [
        q.hint ? el("p", { class: "sys-card__example-hint", text: `💡 第一眼破题提示：${q.hint}` }) : null,
        el("p", { text: `参考答案：${q.answer}` })
      ])
    ]);
  });

  const makeRateBtn = (rating, title, sub, cls) => {
    const b = el("button", { type: "button", class: `sh-btn sys-rate-btn ${cls}` }, [
      el("strong", { text: title }),
      el("small", { text: sub })
    ]);
    b.addEventListener("click", async () => {
      b.disabled = true;
      try {
        await saveCardAttempt({ card, model, rating, pageUrl });
        await refreshCardState(
          rating === "good"
            ? "✓ 已标记「会了 · 独立掌握」，复习间隔已延长"
            : rating === "fuzzy"
              ? "已标记「模糊」，已排入 2 天后复习队列"
              : "已标记「不会」，已加入错题本并排入明日到期复习"
        );
      } finally {
        b.disabled = false;
      }
    });
    return b;
  };

  const l4Block = el("div", { class: "sys-card__section sys-card__l4" }, [
    el("div", { class: "sys-card__sec-head" }, [
      el("strong", { class: "sys-card__sec-title", text: "④ 学完即测与间隔重复打卡" }),
      statusBanner
    ]),
    ...quizNodes,
    el("div", { class: "sys-card__rate-bar", role: "group", "aria-label": "本知识点掌握度打卡" }, [
      el("span", { class: "sys-card__rate-prompt", text: "本节掌握度自评：" }),
      makeRateBtn("again", "不会 / 答错", "明天复习", "sys-rate-btn--again"),
      makeRateBtn("fuzzy", "有点模糊", "2天后复习", "sys-rate-btn--fuzzy"),
      makeRateBtn("good", "会了 / 掌握", "记为已掌握", "sys-rate-btn--good")
    ])
  ]);

  // 关联资料与课堂原图入口 + 快捷键提示
  const sourcesRow = el("div", { class: "sys-card__sources" }, [
    ...(card.sources?.length ? [
      el("span", { class: "sys-card__sources-label", text: "📎 关联资料与原图：" }),
      ...card.sources.map((s) => el("a", { class: "sys-source-link", href: base + s.href, text: `${s.label} →` }))
    ] : []),
    el("span", { class: "sys-card__kbd", text: "⌨️ 快捷键：C 遮挡背诵 · Space 逐词揭晓 · R 动手实操 · S 滑卡速刷 · L 本章清单 · Q 随堂闯关 · M 思维导图" })
  ]);

  const compactNoteBox = compactForLecture ? renderPersonalNoteBox(card, canonicalId) : null;
  compactNoteBox?.classList.add("sys-card__compact-note");
  const compactExtras = compactForLecture ? [
    card.explain?.intuition && card.explain.intuition !== card.summary
      ? el("p", { class: "sys-card__intuition sys-card__compact-intuition", text: `💡 直观理解：${card.explain.intuition}` })
      : null,
    el("div", { class: "sys-card__compact-foot" }, [
      el("div", { class: "sys-card__rate-bar", role: "group", "aria-label": "本知识点掌握度打卡" }, [
        el("span", { class: "sys-card__rate-prompt", text: "掌握打卡：" }),
        makeRateBtn("again", "不会", "明天复习", "sys-rate-btn--again"),
        makeRateBtn("fuzzy", "模糊", "2天后", "sys-rate-btn--fuzzy"),
        makeRateBtn("good", "已掌握", "延长间隔", "sys-rate-btn--good")
      ]),
      statusBannerCompact
    ]),
    compactNoteBox
  ] : [];

  const fullDetail = el("div", { class: compactForLecture ? "sys-card__full-detail" : "sys-card__detail-body" }, [
    el("div", { class: "sys-card__grid" }, [
      el("div", { class: "sys-card__left-col" }, [l1Block, noteBox]),
      el("div", { class: "sys-card__right-col" }, [l2Block, pitfallBox, exampleBox])
    ]),
    l4Block
  ]);

  cardRoot.replaceChildren(
    el("header", { class: "sys-card__head" }, [
      el("div", { class: "sys-card__head-left" }, [
        el("span", { class: "sys-card__eyebrow", text: total > 1 ? `系统学习卡 · 第 ${index + 1} / ${total} 节` : "系统学习知识卡" }),
        statusBadge
      ]),
      el("div", { class: "sys-card__tools" }, [clozeToggle, labBtn, deckBtn, summaryBtn, challengeBtn, mmBtn, videoBtn, illusBtn])
    ]),
    routeBar,
    l0Block,
    ...compactExtras,
    fullDetail,
    sourcesRow
  );

  return cardRoot;
}

// 4.8 每日学习目标与 15 分钟智能通关台（对标 Duolingo / LeetCode）
function renderDailyGoalBar({ model, cardsDoc, base, allCards, dueCards, subjectId }) {
  let goalTarget = 5;
  try {
    const saved = Number(localStorage.getItem(GOAL_KEY));
    if (saved === 3 || saved === 5 || saved === 10) goalTarget = saved;
  } catch { /* ignore */ }

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todayTopics = new Set();
  for (const a of model.learning?.attempts || []) {
    if (String(a.submitted_at || "").startsWith(todayPrefix)) {
      for (const tid of a.topic_ids || []) todayTopics.add(tid);
    }
  }
  for (const p of model.learning?.progress || []) {
    if (String(p.updated_at || "").startsWith(todayPrefix)) {
      todayTopics.add(p.topic_id);
    }
  }
  const doneToday = todayTopics.size;
  const pct = Math.min(100, Math.round((doneToday / Math.max(1, goalTarget)) * 100));

  const fillEl = el("div", { class: "sys-goal__fill", style: `width:${pct}%` });
  const textEl = el("strong", { class: "sys-goal__title", text: `🎯 今日学习目标：已学/练 ${doneToday} / ${goalTarget} 节 (${pct}%)` });

  const goalSelect = el("select", { class: "sys-goal__select", "aria-label": "设置每日目标节数" }, [
    [3, "目标 3 节/天（轻松）"],
    [5, "目标 5 节/天（推荐）"],
    [10, "目标 10 节/天（冲刺）"]
  ].map(([val, label]) => el("option", { value: String(val), selected: val === goalTarget ? "" : null, text: label })));

  goalSelect.addEventListener("change", () => {
    goalTarget = Number(goalSelect.value) || 5;
    try { localStorage.setItem(GOAL_KEY, String(goalTarget)); } catch { /* ignore */ }
    const nextPct = Math.min(100, Math.round((doneToday / Math.max(1, goalTarget)) * 100));
    fillEl.style.width = `${nextPct}%`;
    textEl.textContent = `🎯 今日学习目标：已学/练 ${doneToday} / ${goalTarget} 节 (${nextPct}%)`;
  });

  // 智能挑选今日 15 分钟通关队列：优先 due（到期复习）-> learning（学习中）-> none（未学新知）
  const buildSmartQueue = () => {
    const queue = [];
    const seen = new Set();
    const pushCard = (c) => {
      if (c && !seen.has(c.id) && queue.length < goalTarget) {
        seen.add(c.id);
        queue.push(c);
      }
    };
    for (const c of dueCards) pushCard(c);
    for (const c of allCards) {
      if (model.topicStatus(resolveCanonicalTopicId(c, model)) === "learning") pushCard(c);
    }
    for (const c of allCards) pushCard(c);
    return queue.length ? queue : allCards.slice(0, goalTarget);
  };

  return el("div", { class: "sys-goal-bar" }, [
    el("div", { class: "sys-goal__main" }, [
      el("div", { class: "sys-goal__top" }, [
        textEl,
        el("span", { class: "sys-goal__sub", text: dueCards.length ? `今日有 ${dueCards.length} 节到期需优先复习` : "按「先复习到期 → 再攻克薄弱 → 最后推进新考点」智能编排" })
      ]),
      el("div", { class: "sys-goal__track", "aria-hidden": "true" }, [fillEl])
    ]),
    el("div", { class: "sys-goal__actions" }, [
      goalSelect,
      el("button", {
        type: "button",
        class: "sh-btn sh-btn--primary",
        onclick: () => openSlideDeckModal({
          cards: buildSmartQueue(),
          model,
          cardsDoc,
          base,
          title: `⚡ 今日 ${goalTarget} 节智能通关流`
        }),
        text: "⚡ 开始15分钟智能通关"
      }),
      el("button", {
        type: "button",
        class: "sh-btn",
        onclick: () => openQuizChallengeModal({
          cards: allCards,
          model,
          cardsDoc,
          base,
          title: subjectId ? "本科目随堂闯关测验" : "全科随堂闯关测验"
        }),
        text: "🎯 随堂闯关测验"
      })
    ])
  ]);
}

// 5. 掌握度热力图组件（支持全站 6 科总览或单科按章矩阵，点击色块即刻预览结论并直达）
export function renderMasteryHeatmap({ model, cardsDoc, base, subjectId = "" }) {
  const subjects = subjectId
    ? [model.subjectById.get(subjectId)].filter(Boolean)
    : model.subjects.filter((s) => s.status === "live" && s.enabled !== false);

  const allTopics = subjects.flatMap((s) => model.topicsOfSubject(s.id));
  const counts = { mastered: 0, due: 0, learning: 0, none: 0 };
  for (const t of allTopics) {
    const st = model.topicStatus(t.id);
    counts[st] = (counts[st] || 0) + 1;
  }

  const previewBox = el("div", { class: "sys-heat-preview", role: "status", "aria-live": "polite" }, [
    el("span", { text: "点击上方任意知识点色块，可在此预览一句话核心结论并一键跳转或滑卡自测。" })
  ]);

  function selectTopic(topic) {
    const card = cardsDoc?.cards?.[topic.id];
    const st = model.topicStatus(topic.id);
    const stats = model.topicStats(topic.id);
    const href = topicHref(topic, base) || (card?.url ? base + card.url : "");
    previewBox.replaceChildren(
      el("div", { class: "sys-heat-preview__main" }, [
        el("div", { class: "sys-heat-preview__top" }, [
          statusDot(st, STATUS_LABEL[st]),
          el("strong", { text: topic.title }),
          el("span", { class: "sys-chip", text: STATUS_LABEL[st] || "未学" }),
          stats.nextReview ? el("span", { class: "sys-chip", text: `下次复习 ${formatDay(stats.nextReview)}` }) : null
        ]),
        el("p", { class: "sys-heat-preview__sum", text: card?.summary || topic.blurb || topic.title })
      ]),
      el("div", { class: "sys-heat-preview__actions" }, [
        href ? el("a", { class: "sh-btn sh-btn--primary", href, text: "进入该知识点 →" }) : null,
        card ? el("button", {
          type: "button",
          class: "sh-btn",
          onclick: () => openSlideDeckModal({ cards: [card], model, cardsDoc, base, title: `${topic.title} · 速刷卡` }),
          text: "🗂️ 滑卡自测"
        }) : null,
        card ? el("button", {
          type: "button",
          class: "sh-btn sys-tool-btn--lab",
          onclick: () => void launchCodeLabModal({ card, title: `${topic.title} · 随堂实操`, base }),
          text: "💻 动手实操"
        }) : null
      ])
    );
  }

  const groups = subjectId
    ? model.chaptersOf(subjectId).map((node) => ({
        title: node.chapter.title,
        topics: node.topics
      }))
    : subjects.map((s) => ({
        title: shortSubjectName(s),
        homeUrl: s.homeUrl ? base + s.homeUrl : "",
        topics: model.topicsOfSubject(s.id)
      }));

  const rows = groups.filter((g) => g.topics.length).map((g) => {
    const p = model.progressOf(g.topics);
    return el("div", { class: "sys-heat-row" }, [
      el("div", { class: "sys-heat-row__head" }, [
        g.homeUrl
          ? el("a", { class: "sys-heat-row__title", href: g.homeUrl, text: g.title })
          : el("strong", { class: "sys-heat-row__title", text: g.title }),
        el("span", { class: "sys-heat-row__meta", text: `${p.mastered} 掌握 / ${p.done} 已学 / 共 ${p.total}` })
      ]),
      el("div", { class: "sys-heat-cells" }, g.topics.map((t, idx) => {
        const st = model.topicStatus(t.id);
        const cell = el("button", {
          type: "button",
          class: `sys-heat-cell is-${st}`,
          title: `${t.title}（${STATUS_LABEL[st] || "未学"}）`,
          "aria-label": `${t.title}：${STATUS_LABEL[st] || "未学"}`,
          text: String(idx + 1)
        });
        cell.addEventListener("click", () => selectTopic(t));
        return cell;
      }))
    ]);
  });

  const dueCards = model.dueTopics().map((d) => cardsDoc?.cards?.[d.topic.id]).filter(Boolean);
  const allCards = allTopics.map((t) => cardsDoc?.cards?.[t.id]).filter(Boolean);
  const goalBar = renderDailyGoalBar({ model, cardsDoc, base, allCards, dueCards, subjectId });

  return el("section", { class: "sh-card sys-heatmap", "aria-label": "知识点掌握度热力图" }, [
    goalBar,
    el("header", { class: "sh-card__head sys-heatmap__head" }, [
      el("div", {}, [
        el("h2", { class: "sh-card__title" }, [
          icon("chart", 18),
          el("span", { text: subjectId ? "本科目知识点掌握度热力图" : "全科知识点掌握度热力图" })
        ]),
        el("p", { class: "sys-heatmap__sub", text: `共 ${allTopics.length} 个知识点 · 已掌握 ${counts.mastered} · 学习中 ${counts.learning} · 待复习 ${counts.due} · 未学 ${counts.none}` })
      ]),
      el("div", { class: "sys-heatmap__actions" }, [
        dueCards.length ? el("button", {
          type: "button",
          class: "sh-btn sh-btn--primary",
          onclick: () => openSlideDeckModal({ cards: dueCards, model, cardsDoc, base, title: `今日到期复习 (${dueCards.length})` }),
          text: `⚡ 滑卡复习今日到期 (${dueCards.length})`
        }) : null,
        allCards.length ? el("button", {
          type: "button",
          class: "sh-btn",
          onclick: () => openSlideDeckModal({ cards: allCards, model, cardsDoc, base, title: subjectId ? "本科目全考点滑卡速刷" : "全科知识点滑卡速刷" }),
          text: "🗂️ 开启滑卡速刷"
        }) : null
      ])
    ]),
    el("div", { class: "sys-heatmap__legend" }, [
      el("span", { class: "sys-heat-key" }, [el("i", { class: "sys-heat-swatch is-mastered" }), el("span", { text: `已掌握 (${counts.mastered})` })]),
      el("span", { class: "sys-heat-key" }, [el("i", { class: "sys-heat-swatch is-learning" }), el("span", { text: `学习中 (${counts.learning})` })]),
      el("span", { class: "sys-heat-key" }, [el("i", { class: "sys-heat-swatch is-due" }), el("span", { text: `待复习/薄弱 (${counts.due})` })]),
      el("span", { class: "sys-heat-key" }, [el("i", { class: "sys-heat-swatch is-none" }), el("span", { text: `未学 (${counts.none})` })])
    ]),
    el("div", { class: "sys-heatmap__body" }, rows),
    previewBox
  ]);
}

// 6. 科目主页增强：系统学习路线（章 -> 知识点，带前置提示、一句话结论、视频/导图按钮）+ 热力图 + 本页直挂知识卡
const SUBJECT_ARCH_STAGES = {
  web_design: {
    subtitle: "紧扣专升本 HTML + CSS 考纲（已彻底剔除 JavaScript 等非考纲内容）· 6 章 10 模块 74 节",
    stages: [
      { badge: "阶段一 · 骨架筑基", title: "Web 标准与 HTML5 文档结构", focus: "必考：三层分离、!DOCTYPE html、<meta>", chapters: ["web.ch1", "web.ch2"] },
      { badge: "阶段二 · 标签与表单", title: "HTML 核心标签、表格合并与新型表单", focus: "必考：rowspan/colspan、form/input/datalist、语义标签", chapters: ["web.html_core"] },
      { badge: "阶段三 · 样式与布局", title: "CSS 选择器权重、盒模型与浮动定位/Flex", focus: "必考：权重(1000/100/10/1)、LVHA、border-box、子绝父相、Flex", chapters: ["web.css_base", "web.css_layout", "web.css3"] }
    ]
  },
  c_language: {
    subtitle: "从 main 语法根基到三大控制结构，再到数组/函数/指针 8 大公式与综合读程序 · 10 章 28 节",
    stages: [
      { badge: "阶段一 · 语法与 I/O", title: "程序结构、数据类型、运算符与格式化输入输出", focus: "必考：合法标识符、整除取余、逻辑短路、printf/scanf(%lf)", chapters: ["c.ch1", "c.ch2", "c.ch3", "c.ch4"] },
      { badge: "阶段二 · 控制结构", title: "选择分支（if / switch）与循环控制（while / for）", focus: "必考：0<a<2 陷阱、悬空 else、switch 穿透、break/continue", chapters: ["c.ch5", "c.ch6"] },
      { badge: "阶段三 · 数组函数指针", title: "数组字符串、函数 static 生存期、指针与跨章实战", focus: "必考：strlen vs sizeof、static 局部、二维指针 8 公式、指针传参", chapters: ["c.ch7", "c.ch8", "c.ch9", "c.ch10"] }
    ]
  },
  math: {
    subtitle: "按“一元极限连续 → 空间向量几何 → 多元偏导极值与二重积分”递进 · 3 章 8 节 24 考点",
    stages: [
      { badge: "阶段一 · 一元微积分基础", title: "函数定义域性质、两个重要极限与连续间断点", focus: "必考：等价无穷小替换、两个重要极限、第一/二类间断点", chapters: ["math.ch1"] },
      { badge: "阶段二 · 空间解析几何", title: "空间向量点积叉积、平面方程与空间直线方程", focus: "必考：两向量垂直/平行判定、法向量求平面、方向向量求直线", chapters: ["math.ch4"] },
      { badge: "阶段三 · 多元微积分", title: "偏导全微分、多元极值判别（AC−B²）与二重积分换序", focus: "必考：复合函数链式求导、无条件极值、直角坐标二重积分交换次序", chapters: ["math.ch5"] }
    ]
  },
  english: {
    subtitle: "告别零散跳号，重构为“非谓语 → 三大从句 → 一致与特殊句型”三大语法支柱 · 3 板块 6 专题",
    stages: [
      { badge: "阶段一 · 动词非谓语", title: "to do / doing / done 主动被动与时态先后判定", focus: "必考：逻辑主语一致性、只接 doing/to do 动词、独立主格", chapters: ["english.nonfinite"] },
      { badge: "阶段二 · 三大复合从句", title: "定语从句、名词性从句与九大逻辑状语从句", focus: "必考：that vs which、关系代词 vs 关系副词、what vs that", chapters: ["english.clauses"] },
      { badge: "阶段三 · 句法与真题", title: "主谓一致三原则、倒装/强调/虚拟语气与 50 题串讲", focus: "必考：就近 vs 就远原则、部分倒装助动词提前、虚拟语气时态退格", chapters: ["english.syntax"] }
    ]
  },
  computer_basics: {
    subtitle: "理论体系导图 + Excel 数据计算管理 + PPT 版式交互三大应试模块 · 3 模块 7 分节 17 专题",
    stages: [
      { badge: "阶段一 · 系统硬件理论", title: "计算机演进、进制编码、冯·诺依曼体系与五大硬件", focus: "必考：存储程序原理、CPU=运算器+控制器、ROM vs RAM", chapters: ["cb.ch1"] },
      { badge: "阶段二 · Excel 核心操作", title: "单元格格式、公式函数计算、筛选分类汇总与图表", focus: "必考：绝对引用 $A$1、SUMIF/VLOOKUP/IF、分类汇总前必先排序", chapters: ["cb.excel"] },
      { badge: "阶段三 · PPT 演示设计", title: "幻灯片母版统一版式、自定义动画、超链接动作与放映", focus: "必考：幻灯片母版批量修改、切换效果 vs 对象动画、排练计时", chapters: ["cb.ppt"] }
    ]
  },
  network: {
    subtitle: "从 IPv4 分类编址到 CIDR 按位与、VLSM 子网划分、MTU 分片与路由聚合 · 6 章 7 节 29 专题",
    stages: [
      { badge: "阶段一 · 编址与 CIDR", title: "IPv4 五类地址、私有/回送地址与 CIDR 地址块按位与", focus: "必考：A/B/C 范围、三大私有网段、127 回送、IP AND 掩码求网络地址", chapters: ["net.ch1", "net.ch2"] },
      { badge: "阶段二 · 子网与分片", title: "定长/变长 VLSM 子网划分、2^n−2 规则与 MTU 分片计算", focus: "必考：按主机数从大到小分配 VLSM、片偏移 = 数据字节 / 8、MF 标志", chapters: ["net.ch3", "net.ch4"] },
      { badge: "阶段三 · IPv6 与超网", title: "IPv6 零压缩与 40B 基本首部、连续 C 类网络路由聚合", focus: "必考：双冒号 :: 仅用一次、IPv6 固定 40B 首部、最长公共前缀汇总", chapters: ["net.ch5", "net.ch6"] }
    ]
  }
};

function renderSubjectArchitecture({ subjectId, model, base }) {
  const spec = SUBJECT_ARCH_STAGES[subjectId];
  if (!spec) return null;
  const nodes = model.chaptersOf(subjectId);
  const byChId = new Map(nodes.map((n) => [n.chapter.id, n]));

  return el("section", { class: "sh-card sys-arch", "aria-label": "本科目模块化知识架构蓝图" }, [
    el("header", { class: "sys-arch__head" }, [
      el("div", {}, [
        el("span", { class: "sys-arch__eyebrow", text: "模块化重构 · 三阶递进知识体系" }),
        el("h2", { class: "sys-arch__title", text: "🧭 本科知识点架构与进阶路线" }),
        el("p", { class: "sys-arch__sub", text: spec.subtitle })
      ])
    ]),
    el("div", { class: "sys-arch__stages" }, spec.stages.map((stg, sIdx) => {
      const chNodes = stg.chapters.map((cid) => byChId.get(cid)).filter(Boolean);
      const stgTopics = chNodes.flatMap((n) => n.topics);
      const prog = model.progressOf(stgTopics);
      return el("article", { class: "sys-arch__stage" }, [
        el("div", { class: "sys-arch__stage-top" }, [
          el("span", { class: "sys-arch__stage-badge", text: stg.badge }),
          el("span", { class: "sys-arch__stage-count", text: prog.done ? `已学 ${prog.done}/${prog.total}` : `共 ${prog.total} 节` })
        ]),
        el("h3", { class: "sys-arch__stage-title", text: `${sIdx + 1}. ${stg.title}` }),
        el("p", { class: "sys-arch__stage-focus", text: `🔥 ${stg.focus}` }),
        el("div", { class: "sys-arch__chapters" }, chNodes.map((node) => {
          const firstTopic = node.topics.find((t) => topicHref(t, base));
          const chHref = firstTopic ? topicHref(firstTopic, base) : (node.chapter.source_ref ? base + node.chapter.source_ref : "");
          return el("div", { class: "sys-arch__ch" }, [
            chHref
              ? el("a", { class: "sys-arch__ch-title", href: chHref, text: `${node.chapter.title}（${node.topics.length}）→` })
              : el("strong", { class: "sys-arch__ch-title", text: `${node.chapter.title}（${node.topics.length}）` }),
            node.sections?.length
              ? el("div", { class: "sys-arch__secs" }, node.sections.map((sec) => {
                  const secFirst = sec.topics.find((t) => topicHref(t, base));
                  const secHref = secFirst ? topicHref(secFirst, base) : chHref;
                  return el(secHref ? "a" : "span", {
                    class: "sys-arch__sec-chip",
                    href: secHref || null,
                    text: `${sec.chapter.title} · ${sec.topics.length}`
                  });
                }))
              : null
          ]);
        }))
      ]);
    }))
  ]);
}

export async function enhanceSubjectPage({ shell, model, subjectId }) {
  const cardsDoc = await loadTopicCards();
  const base = shell.base;
  const main = document.querySelector("main.site-main") || document.querySelector("main");
  if (!main) return;

  fixResponsiveAndMedia({ base, cardsDoc, model, subjectId });

  const subject = model.subjectById.get(subjectId);
  const allTopics = model.topicsOfSubject(subjectId);
  const subjectCards = allTopics.map((t) => cardsDoc.cards[t.id]).filter(Boolean);
  const reviewCards = Object.values(cardsDoc.cards)
    .filter((c) => c.id.startsWith("review:") && c.subject_id === subjectId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const deckPool = reviewCards.length && subjectId === "network" ? [...reviewCards, ...subjectCards] : subjectCards;

  // 为自带完整系统讲义入口的科目（如 C 语言第 1–9 章）在科目首屏头部注入醒目直达按钮
  if (subjectId === "c_language") {
    const subjHead = main.querySelector(".subj-head:not(.subj-head--compact)");
    if (subjHead && !subjHead.querySelector(".sys-subj-cta")) {
      subjHead.append(el("div", { class: "sys-subj-cta" }, [
        el("a", {
          class: "sh-btn sh-btn--primary sys-subj-cta__main",
          href: `${base}c/notes.html`,
          text: "📖 进入第 1–9 章系统讲义（27 节 + 54 题）→"
        }),
        el("a", {
          class: "sh-btn sys-subj-cta__sub",
          href: `${base}c/notes.html#overview`,
          text: "🗺️ 全书总览与 3 张导图"
        }),
        el("a", {
          class: "sh-btn sys-subj-cta__sub",
          href: `${base}study/lab.html?lang=c`,
          text: "💻 在线运行 C 代码"
        })
      ]));
    }
  }

  // 顶部系统学习知识架构图 + 掌握度热力图
  const archBoard = renderSubjectArchitecture({ subjectId, model, base });
  const heatmap = renderMasteryHeatmap({ model, cardsDoc, base, subjectId });
  const subjShell = main.querySelector(".subj-shell");
  if (subjShell) {
    if (archBoard) {
      subjShell.after(archBoard, heatmap);
    } else {
      subjShell.after(heatmap);
    }
  } else {
    if (archBoard) main.prepend(archBoard, heatmap);
    else main.prepend(heatmap);
  }

  // 在科目页的章节知识点列表中注入前置提示、L0一句话结论预览与视频/导图标签
  for (const link of main.querySelectorAll(".subj-topic")) {
    const titleEl = link.querySelector(".subj-topic__title");
    if (!titleEl || link.dataset.sysEnhanced) continue;
    link.dataset.sysEnhanced = "1";
    const tTitle = titleEl.textContent.trim();
    const topic = allTopics.find((t) => t.title === tTitle);
    const card = topic ? cardsDoc.cards[topic.id] : null;
    if (!card) continue;

    // 若链接指向本页自身且无有效分节跳转（例如 c/index.html 或 yy/index.html#yyvideos），点击直接平滑滚到本页下方的统一知识卡
    const rawHref = link.getAttribute("href") || "";
    if (rawHref) {
      const targetUrl = new URL(rawHref, location.href);
      if (targetUrl.pathname === location.pathname && (!targetUrl.hash || targetUrl.hash === "#yyvideos")) {
        link.setAttribute("href", `#sys-topic-${topic.id.replace(/[^0-9A-Za-z_-]/g, "-")}`);
      }
    }

    const preNames = (model.prereqs(topic.id) || []).map((e) => e.topic?.title).filter(Boolean);
    const metaRow = el("span", { class: "sys-subj-topic__meta" }, [
      preNames.length ? el("span", { class: "sys-subj-topic__pre", text: `先修：${preNames.slice(0, 2).join("、")}` }) : el("span", { class: "sys-subj-topic__pre is-start", text: "起点可直接学" }),
      card.video_clips?.length ? el("span", { class: "sys-subj-topic__badge", text: `▶ 视频 ${card.video_clips[0].label}` }) : null,
      card.quizzes?.length ? el("span", { class: "sys-subj-topic__badge", text: "含自测" }) : null,
      el("span", { class: "sys-subj-topic__sum", text: card.summary })
    ]);
    titleEl.append(metaRow);
  }

  // 对于知识点挂在本科目首页的科目（c/index.html, yy/index.html, jsj/index.html），在页面中直接挂载统一知识卡列表
  const inlineTopics = allTopics.filter((t) => pagePath(t.legacy_url) === shell.rel);
  if (inlineTopics.length && !main.querySelector(".sys-inline-cards")) {
    const inlineHost = el("section", { class: "sys-inline-cards", "aria-label": `${shortSubjectName(subject)}系统学习知识卡` }, [
      el("div", { class: "sys-inline-cards__head" }, [
        el("h2", { class: "subj-section-title", text: `${shortSubjectName(subject)} · 逐节系统学习卡（结论 / 必背 / 视频 / 自测）` }),
        el("div", { class: "sys-inline-cards__actions" }, [
          el("button", {
            type: "button",
            class: "sh-btn sh-btn--primary",
            onclick: () => openSlideDeckModal({ cards: deckPool, model, cardsDoc, base, title: `${shortSubjectName(subject)} · 滑卡速刷` }),
            text: "🗂️ 滑卡速刷全部考点"
          }),
          el("button", {
            type: "button",
            class: "sh-btn",
            onclick: () => openQuizChallengeModal({ cards: deckPool, model, cardsDoc, base, title: `${shortSubjectName(subject)} · 随堂闯关` }),
            text: "🎯 随堂闯关测验"
          }),
          el("button", {
            type: "button",
            class: "sh-btn",
            onclick: () => openMindmapModal({ card: cardsDoc.cards[inlineTopics[0].id], subjectId, model, cardsDoc, base }),
            text: "🗺️ 打开本科知识导图"
          })
        ])
      ]),
      ...inlineTopics.map((t, i) => {
        const c = cardsDoc.cards[t.id];
        if (!c) return null;
        const wrap = el("div", {
          id: `sys-topic-${t.id.replace(/[^0-9A-Za-z_-]/g, "-")}`,
          class: "sys-inline-card-wrap"
        });
        const cardEl = renderKnowledgeCard(c, {
          model,
          cardsDoc,
          base,
          pageUrl: shell.rel,
          index: i,
          total: inlineTopics.length,
          deckCards: deckPool
        });
        if (cardEl) wrap.append(cardEl);
        return wrap;
      })
    ]);
    heatmap.after(inlineHost);
  }
}

// 6.8 吸顶讲义分栏专注工具栏（视图筛选 + 常驻遮挡背诵开关 + 本节填空进度 + 一键重遮）
let viewBarClozeListener = null;
function renderLectureViewFilter(activePanelEl = null) {
  let currentMode = "all";
  try {
    currentMode = sessionStorage.getItem(VIEW_KEY) || "all";
  } catch { /* ignore */ }
  document.body.setAttribute("data-sys-lecture-view", currentMode);

  const modes = [
    ["all", "📑 全部讲义"],
    ["board", "📝 仅看课堂板书"],
    ["core", "🎯 仅看必背与套路"],
    ["practice", "✍️ 仅刷专项练习"],
    ["card-only", "⚡ 极简知识卡"]
  ];

  const btns = modes.map(([key, label]) => {
    const b = el("button", {
      type: "button",
      class: `sys-view-tab${key === currentMode ? " is-on" : ""}`,
      "aria-pressed": String(key === currentMode),
      "data-view-mode": key,
      text: label
    });
    b.addEventListener("click", () => {
      currentMode = key;
      try { sessionStorage.setItem(VIEW_KEY, key); } catch { /* ignore */ }
      document.body.setAttribute("data-sys-lecture-view", key);
      for (const x of btns) {
        const on = x === b;
        x.classList.toggle("is-on", on);
        x.setAttribute("aria-pressed", String(on));
      }
    });
    return b;
  });

  // 滚动常驻遮挡控制与本节填空进度
  let clozeOn = readStudyMode() === "cloze";
  const quickClozeBtn = el("button", {
    type: "button",
    class: `sys-view-tab sys-view-cloze-btn${clozeOn ? " is-on" : ""}`,
    "aria-pressed": String(clozeOn),
    "data-sys-cloze-toggle": "1",
    "data-sys-cloze-short": "1",
    title: "快捷键 C 切换遮挡背诵，Space 逐词揭晓",
    text: clozeOn ? "🔒 遮挡：开" : "🔓 遮挡背诵"
  });
  quickClozeBtn.addEventListener("click", () => {
    clozeOn = !(readStudyMode() === "cloze");
    writeStudyMode(clozeOn ? "cloze" : "study");
    setPageClozeMode(document, clozeOn);
  });

  const progressPill = el("span", { class: "sys-cloze-meter", hidden: true });
  const resetBtn = el("button", {
    type: "button",
    class: "sys-view-tab sys-cloze-reset",
    hidden: true,
    title: "把本节已揭晓的填空全部重新遮挡，开始二刷背诵",
    text: "↺ 重遮本节"
  });

  const getSectionChips = () => {
    const scope = activePanelEl || document.querySelector(".lx-point-panel:not([hidden])") || document.querySelector(".lx-body") || document;
    return [...scope.querySelectorAll(".sys-cloze")];
  };

  resetBtn.addEventListener("click", () => {
    for (const ch of getSectionChips()) {
      ch.classList.add("is-masked");
      ch.classList.remove("is-revealed");
      ch.setAttribute("aria-pressed", "false");
    }
    notifyClozeChanged();
  });

  const syncMeter = () => {
    const isCloze = readStudyMode() === "cloze";
    const chips = getSectionChips();
    const total = chips.length;
    if (!total) {
      progressPill.hidden = true;
      resetBtn.hidden = true;
      return;
    }
    const revealed = chips.filter((c) => !c.classList.contains("is-masked")).length;
    progressPill.hidden = false;
    if (isCloze) {
      const done = revealed === total;
      progressPill.textContent = done ? `✓ 本节 ${total} 处已全揭晓` : `本节背诵 ${revealed}/${total}`;
      progressPill.classList.toggle("is-done", done);
      resetBtn.hidden = revealed === 0;
    } else {
      progressPill.textContent = `本节 ${total} 处填空`;
      progressPill.classList.remove("is-done");
      resetBtn.hidden = true;
    }
  };

  if (viewBarClozeListener) document.removeEventListener("zsb:cloze-changed", viewBarClozeListener);
  viewBarClozeListener = syncMeter;
  document.addEventListener("zsb:cloze-changed", syncMeter);
  syncMeter();

  return el("div", { class: "sys-view-filter", role: "toolbar", "aria-label": "讲义专注视图与遮挡背诵控制" }, [
    el("div", { class: "sys-view-filter__left" }, [
      el("span", { class: "sys-view-filter__label", text: "📖 视图：" }),
      el("div", { class: "sys-view-filter__tabs" }, btns)
    ]),
    el("div", { class: "sys-view-filter__right" }, [quickClozeBtn, progressPill, resetBtn])
  ]);
}

// 6.9 讲义原页专项练习题内「第一眼破题提示 + 选项直点判分 + FSRS 三档自评」增强（对标 Brilliant.org / Khan Academy）
export function enhancePagePracticeCards({ root, cardsDoc, model, pageUrl }) {
  const excludedIds = new Set(["36-7", "38-2", "46-5", "补-5", "-5"]);
  const pageKey = pageUrl.includes("gs45") ? "gs45" : pageUrl.includes("c/notes") ? "c-notes" : "gs1";

  for (const pCard of (root || document).querySelectorAll(".practice-card")) {
    if (pCard.dataset.sysPracticeEnhanced) continue;
    pCard.dataset.sysPracticeEnhanced = "1";

    const pidRaw = pCard.querySelector(".practice-id")?.textContent.trim() || pCard.dataset.question || "";
    if (!pidRaw || excludedIds.has(pidRaw)) continue;

    const topicSec = pCard.closest(".topic-section[id]");
    const ownerCard = (topicSec && cardsDoc?.byAnchor?.get(`${pageUrl}#${topicSec.id}`))
      || (cardsDoc?.byPage?.get(pageUrl)?.[0])
      || null;
    if (!ownerCard) continue;

    const stemEl = pCard.querySelector(".question-stem");
    const detailsEl = pCard.querySelector("details.solution-toggle");
    const firstLookEl = pCard.querySelector(".solution-part--第一眼判断 .solution-part__text");
    const ansEl = pCard.querySelector(".solution-part--答案 .solution-part__text") || pCard.querySelector(".solution-body");

    const stemText = (stemEl?.textContent || "").replace(/^题目\s*/, "").replace(/\s+/g, " ").trim();
    const firstLookText = (firstLookEl?.textContent || "").replace(/\s+/g, " ").trim();
    const ansText = (ansEl?.textContent || "").replace(/^答[：:]\s*/, "").replace(/\s+/g, " ").trim().replace(/[。.]+$/, "");

    // (1) 注入「💡 第一眼破题提示」按钮（不剧透完整答案）
    if (firstLookText && detailsEl) {
      const hintBanner = el("div", { class: "sys-pcard-hint", hidden: true, text: `💡 第一眼破题判断：${firstLookText}` });
      const hintBtn = el("button", {
        type: "button",
        class: "sh-btn sys-pcard-hint-btn",
        onclick: () => { hintBanner.hidden = !hintBanner.hidden; },
        text: "💡 第一眼破题提示"
      });
      detailsEl.before(el("div", { class: "sys-pcard-tools" }, [hintBtn]), hintBanner);
    }

    // (2) 若为 A/B/C/D 选择题，注入可直接点击作答的选项按钮并自动判分记入 FSRS
    const ansMatch = ansText.match(/^(?:选\s*)?([A-D])(?:\b|[\s（(。.,，]|$)/);
    if (ansMatch && stemText.includes("A.") && stemText.includes("B.") && detailsEl) {
      const correctOpt = ansMatch[1];
      const parts = stemText.split(/\s*(?=[A-D]\.\s*)/);
      const parsedOpts = [];
      for (const part of parts.slice(1)) {
        const om = part.trim().match(/^([A-D])\.\s*(.+)$/);
        if (om) parsedOpts.push({ id: om[1], text: om[2].trim() });
      }
      if (parsedOpts.length === 4) {
        const resultMsg = el("p", { class: "sys-quiz__result", role: "status", "aria-live": "polite", hidden: true });
        const optBtns = parsedOpts.map((opt) => {
          const b = el("button", {
            type: "button",
            class: "sys-quiz__opt sys-pcard-opt",
            "data-opt": opt.id
          }, [
            el("strong", { class: "sys-quiz__opt-id", text: `${opt.id}.` }),
            el("span", { text: opt.text })
          ]);
          b.addEventListener("click", async () => {
            const isRight = opt.id === correctOpt;
            for (const x of optBtns) {
              x.classList.remove("is-picked", "is-correct", "is-wrong");
              if (x.dataset.opt === correctOpt) x.classList.add("is-correct");
            }
            b.classList.add("is-picked", isRight ? "is-correct" : "is-wrong");
            resultMsg.hidden = false;
            resultMsg.className = `sys-quiz__result ${isRight ? "is-ok" : "is-bad"}`;
            resultMsg.textContent = isRight
              ? "✓ 答对！已记入本考点掌握进度"
              : `✗ 答错，正确答案是 ${correctOpt}（已自动排入明日 FSRS 复习队列并展开解析）`;
            if (!isRight) detailsEl.open = true;
            try {
              await saveCardAttempt({
                card: ownerCard,
                model,
                quizId: `page:${pageKey}:${pidRaw}`,
                stem: parts[0].trim(),
                answerText: ansText,
                choice: opt.id,
                correct: correctOpt,
                pageUrl
              });
            } catch { /* ignore */ }
          });
          return b;
        });
        detailsEl.before(el("div", { class: "sys-pcard-opts" }, optBtns), resultMsg);
      }
    }

    // (3) 在解答面板底部注入 FSRS 三档自评打卡条（让填空题、计算题也能一键记入间隔复习）
    const answerPanel = pCard.querySelector(".answer-panel");
    if (answerPanel) {
      const rateStatus = el("span", { class: "sys-pcard-rate__msg", text: "做完本题自评：" });
      const rateQuestion = async (rating, label) => {
        rateStatus.textContent = "正在记录…";
        try {
          await saveCardAttempt({
            card: ownerCard,
            model,
            quizId: `page:${pageKey}:${pidRaw}`,
            stem: stemText.slice(0, 180),
            answerText: ansText,
            rating,
            pageUrl
          });
          rateStatus.textContent = `✓ 已记录「${label}」`;
        } catch {
          rateStatus.textContent = "保存失败";
        }
      };
      answerPanel.append(el("div", { class: "sys-pcard-rate" }, [
        rateStatus,
        el("button", { type: "button", class: "sh-btn sys-rate-btn sys-rate-btn--again", onclick: () => rateQuestion("again", "没做出来 · 明天复习"), text: "✗ 没做出来(明天复习)" }),
        el("button", { type: "button", class: "sh-btn sys-rate-btn sys-rate-btn--fuzzy", onclick: () => rateQuestion("fuzzy", "看提示才懂 · 2天后"), text: "〰 看提示才懂(2天后)" }),
        el("button", { type: "button", class: "sh-btn sys-rate-btn sys-rate-btn--good", onclick: () => rateQuestion("good", "独立做对 · 已掌握"), text: "✓ 独立做对(已掌握)" })
      ]));
    }
  }
}

// 7. 讲义 / 知识点详情页增强（挂载当前知识点的统一学习卡，随分节 Tab 切换实时同步）
export async function enhanceLecturePage({ shell, sk, model, subjectId, order, getCurrent, isMultiTab = false }) {
  const cardsDoc = await loadTopicCards();
  const base = shell.base;
  const rel = shell.rel;

  fixResponsiveAndMedia({ base, cardsDoc, model, subjectId });
  enhancePagePracticeCards({ root: sk.body, cardsDoc, model, pageUrl: rel });

  const subjectTopics = model.topicsOfSubject(subjectId);
  const deckCards = (order?.length ? order : subjectTopics)
    .map((t) => cardsDoc.cards[t.id])
    .filter(Boolean);

  const hostSlot = el("div", { class: "sys-lecture-slot" });
  const pointStrip = sk.body.querySelector(".lx-point-switch");
  const hero = sk.body.querySelector(".page-hero, .wy-point-head, .hero-area");
  if (pointStrip) pointStrip.after(hostSlot);
  else if (hero) hero.after(hostSlot);
  else sk.body.prepend(hostSlot);

  function mountCurrentCard() {
    const curId = getCurrent ? getCurrent() : null;
    // 在多标签页（如 gs1.html / gs45.html）切换到非考点标签（如 #flow 总流程、#method-index 方法索引、#mindmap 思维导图）时，展示精简本章全局工具条，不展示过期的旧考点卡
    if (isMultiTab && !curId) {
      document.body.removeAttribute("data-sys-lecture-view");
      const refCard = deckCards[0] || null;
      const chCount = new Set(deckCards.map((c) => c.chapter_id).filter(Boolean)).size;
      const subj = model.subjectById.get(subjectId);
      const scopeLabel = chCount > 1
        ? `${shortSubjectName(subj)}（第 1–${chCount} 章 · ${deckCards.length} 节）`
        : (refCard?.chapter_title || "本章");
      let clozeOn = readStudyMode() === "cloze";
      const bannerClozeBtn = el("button", {
        type: "button",
        class: `sh-btn sys-tool-btn${clozeOn ? " is-on" : ""}`,
        "aria-pressed": String(clozeOn),
        "data-sys-cloze-toggle": "1",
        onclick: () => {
          clozeOn = !(readStudyMode() === "cloze");
          writeStudyMode(clozeOn ? "cloze" : "study");
          setPageClozeMode(document, clozeOn);
        },
        text: clozeOn ? "🔒 遮挡背诵：开" : "🔓 遮挡背诵"
      });
      hostSlot.replaceChildren(
        el("div", { class: "sh-card sys-chapter-banner", role: "region", "aria-label": "全局学习工具栏" }, [
          el("div", { class: "sys-chapter-banner__info" }, [
            el("strong", { text: `${scopeLabel} · 全局速览与闯关工具` }),
            el("span", { text: chCount > 1 ? "点击下方章节卡片或顶部「章节速切」进入各节讲义；按 C 可全局切换遮挡背诵" : "当前处于全局概览/方法/导图标签；点击上方「考点切换」可进入各考点的统一知识卡" })
          ]),
          el("div", { class: "sys-chapter-banner__btns" }, [
            bannerClozeBtn,
            el("button", {
              type: "button",
              class: "sh-btn sh-btn--primary",
              onclick: () => openChapterSummaryModal({ cards: deckCards, title: `${scopeLabel} · 必背清单`, model, cardsDoc, base }),
              text: chCount > 1 ? "📋 全书必背清单" : "📋 本章必背清单"
            }),
            el("button", {
              type: "button",
              class: "sh-btn",
              onclick: () => openSlideDeckModal({ cards: deckCards, model, cardsDoc, base, title: `${scopeLabel} · 滑卡速刷` }),
              text: chCount > 1 ? "🗂️ 滑卡速刷全书" : "🗂️ 滑卡速刷全章"
            }),
            el("button", {
              type: "button",
              class: "sh-btn",
              onclick: () => openQuizChallengeModal({ cards: deckCards, model, cardsDoc, base, title: `${scopeLabel} · 随堂闯关` }),
              text: "🎯 随堂闯关测验"
            }),
            el("button", {
              type: "button",
              class: "sh-btn",
              onclick: () => openMindmapModal({ card: refCard, subjectId, model, cardsDoc, base }),
              text: "🗺️ 交互式知识树"
            }),
            el("button", {
              type: "button",
              class: "sh-btn sys-tool-btn--lab",
              onclick: () => void launchCodeLabModal({ card: refCard, title: `${scopeLabel} · 在线代码实操`, base }),
              text: "💻 在线代码实操"
            })
          ])
        ])
      );
      return;
    }

    let card = curId ? cardsDoc.cards[curId] : null;
    if (!card && location.hash) {
      card = cardsDoc.byAnchor.get(`${rel}${location.hash}`) || cardsDoc.byAnchor.get(location.hash.slice(1)) || null;
    }
    if (!card) {
      const pageCards = cardsDoc.byPage.get(rel) || [];
      card = pageCards[0] || null;
    }
    if (!card) {
      hostSlot.replaceChildren();
      return;
    }
    const idx = Math.max(0, deckCards.findIndex((c) => c.id === card.id));
    const cardNode = renderKnowledgeCard(card, {
      model,
      cardsDoc,
      base,
      pageUrl: rel,
      index: idx,
      total: deckCards.length || 1,
      deckCards,
      compactForLecture: rel === "c/notes.html"
    });
    const activePanelEl = sk.body.querySelector(".lx-point-panel:not([hidden])") || sk.body;
    const viewFilter = renderLectureViewFilter(activePanelEl);
    hostSlot.replaceChildren(cardNode || "", viewFilter);
  }

  mountCurrentCard();
  addEventListener("hashchange", mountCurrentCard);
  addEventListener("popstate", mountCurrentCard);
  return { refreshCard: mountCurrentCard };
}

// 8. 课堂总复习长页（notes/network-review.html & notes/web-review.html）增强
export async function enhanceReviewPage({ shell }) {
  const [model, cardsDoc] = await Promise.all([loadModel(), loadTopicCards()]);
  const base = shell.base;
  const rel = shell.rel;
  const isNet = rel.includes("network-review");
  const subjectId = isNet ? "network" : "web_design";

  fixResponsiveAndMedia({ base, cardsDoc, model, subjectId });

  const reviewCards = Object.values(cardsDoc.cards)
    .filter((c) => c.id.startsWith("review:") && c.subject_id === subjectId)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // 在顶部插入滑卡速刷、遮挡背诵、交互导图控制栏
  const leadSection = document.querySelector(".review-lead") || document.querySelector(".review-content");
  if (leadSection && !document.querySelector(".sys-review-toolbar")) {
    let clozeOn = readStudyMode() === "cloze";
    const clozeBtn = el("button", {
      type: "button",
      class: `sh-btn${clozeOn ? " sh-btn--primary" : ""}`,
      "aria-pressed": String(clozeOn),
      text: clozeOn ? "🔒 遮挡背诵模式：已开启" : "🔓 开启遮挡背诵模式"
    });
    clozeBtn.addEventListener("click", () => {
      clozeOn = !clozeOn;
      writeStudyMode(clozeOn ? "cloze" : "study");
      clozeBtn.classList.toggle("sh-btn--primary", clozeOn);
      clozeBtn.setAttribute("aria-pressed", String(clozeOn));
      clozeBtn.textContent = clozeOn ? "🔒 遮挡背诵模式：已开启" : "🔓 开启遮挡背诵模式";
      setPageClozeMode(document, clozeOn);
    });

    const toolbar = el("div", { class: "sh-card sys-review-toolbar", role: "region", "aria-label": "课堂复习系统学习工具栏" }, [
      el("div", { class: "sys-review-toolbar__info" }, [
        el("strong", { text: `系统学习模式 · 共 ${reviewCards.length} 个核心知识点` }),
        el("span", { text: "支持遮挡背诵、手机滑卡速刷、交互导图与间隔重复自评打卡" })
      ]),
      el("div", { class: "sys-review-toolbar__btns" }, [
        clozeBtn,
        el("button", {
          type: "button",
          class: "sh-btn sh-btn--primary",
          onclick: () => {
            const hashId = location.hash.slice(1);
            const startIdx = Math.max(0, reviewCards.findIndex((c) => c.anchor === hashId));
            openSlideDeckModal({
              cards: reviewCards,
              model,
              cardsDoc,
              base,
              startIndex: startIdx,
              title: isNet ? "计算机网络 22 节滑卡速刷" : "网页制作 14 节滑卡速刷"
            });
          },
          text: `🗂️ 滑卡速刷 (${reviewCards.length} 节)`
        }),
        el("button", {
          type: "button",
          class: "sh-btn",
          onclick: () => openMindmapModal({ card: reviewCards[0], subjectId, model, cardsDoc, base }),
          text: "🗺️ 知识导图树"
        }),
        el("button", {
          type: "button",
          class: "sh-btn sys-tool-btn--lab",
          onclick: () => void launchCodeLabModal({ card: reviewCards[0], title: isNet ? "计算机网络 · 位运算实操" : "网页制作 · 实时预览实操", base }),
          text: "💻 动手实操"
        })
      ])
    ]);
    leadSection.prepend(toolbar);
  }

  // 为每个 .review-topic 注入遮挡背诵支持与三档间隔重复自评栏
  const clozeInit = readStudyMode() === "cloze";
  for (const sec of document.querySelectorAll(".review-topic[id]")) {
    if (sec.dataset.sysEnhanced) continue;
    sec.dataset.sysEnhanced = "1";
    const card = cardsDoc.cards[`review:${sec.id}`];
    if (!card) continue;

    // 把要点 li 升级为支持遮挡背诵的节点
    for (const li of sec.querySelectorAll(".review-points li")) {
      const txt = li.textContent;
      li.replaceChildren(...buildClozeNodes(txt, clozeInit));
    }

    const statusMsg = el("span", { class: "sys-review-rate__msg", role: "status", "aria-live": "polite", text: "学完本节后打卡：" });
    const rateTopic = async (rating, label) => {
      statusMsg.textContent = "正在保存…";
      try {
        await saveCardAttempt({ card, model, rating, pageUrl: rel });
        statusMsg.textContent = `✓ 已记录「${label}」并排入复习队列`;
      } catch {
        statusMsg.textContent = "保存失败";
      }
    };

    const actionBar = el("div", { class: "sys-review-rate", role: "group", "aria-label": `${card.title} 掌握度打卡` }, [
      statusMsg,
      el("button", { type: "button", class: "sh-btn sys-rate-btn sys-rate-btn--again", onclick: () => rateTopic("again", "不会 · 明天复习"), text: "不会(明天复习)" }),
      el("button", { type: "button", class: "sh-btn sys-rate-btn sys-rate-btn--fuzzy", onclick: () => rateTopic("fuzzy", "模糊 · 2天后复习"), text: "模糊(2天后)" }),
      el("button", { type: "button", class: "sh-btn sys-rate-btn sys-rate-btn--good", onclick: () => rateTopic("good", "会了 · 已掌握"), text: "会了(已掌握)" }),
      el("button", {
        type: "button",
        class: "sh-btn",
        onclick: () => openSlideDeckModal({ cards: reviewCards, model, cardsDoc, base, startIndex: Math.max(0, (card.order || 1) - 1), title: card.chapter_title }),
        text: "🗂️ 从本节开始滑卡"
      }),
      el("button", {
        type: "button",
        class: "sh-btn sys-tool-btn--lab",
        onclick: () => void launchCodeLabModal({ card, title: `${card.title} · 随堂实操`, base, pageRoot: sec }),
        text: "💻 本节实操"
      })
    ]);
    sec.append(actionBar);
  }

  // 修复带 hash 进入长页时的锚点定位偏移
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) {
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    }
  }
}

// 9. 首页与学习总览页增强（首屏 6 科全展示 + 全科掌握度热力图 + 滑卡复习入口）
export async function enhanceHomeAndOverview({ shell, model }) {
  const cardsDoc = await loadTopicCards();
  const base = shell.base;

  if (shell.rel === "index.html") {
    // 升级首页 #review-subjects，让全部 6 门已上线科目都在首屏网格展示，解决只展示 2 科的割裂问题
    const notesGrid = document.querySelector("#review-subjects .home-notes-grid");
    const sectionTitle = document.querySelector("#home-notes-title");
    if (sectionTitle) sectionTitle.textContent = "按科目系统学习";
    if (notesGrid && !notesGrid.dataset.sysAllSubjects) {
      notesGrid.dataset.sysAllSubjects = "1";
      const subjectCardsMeta = [
        ["math", "gs/index.html", "sigma", "高等数学", "24 个核心考点 · 函数极限、空间几何、多元微积分（配视频与导图）"],
        ["english", "yy/index.html", "english", "英语", "9 大语法专题 · 非谓语、三大从句、主谓一致、特殊句型（配视频与导图）"],
        ["computer_basics", "jsj/index.html", "monitor", "计算机基础", "17 个专题 · 基础知识导图、Excel 26 题视频、PPT 操作题路径"],
        ["network", "wl/index.html", "network", "计算机网络", "22 节全考点复习 + 29 节 IP/子网/分片/路由精讲与自测"],
        ["web_design", "wy/index.html", "web", "网页设计", "紧扣 HTML + CSS 考纲 · 14 节课堂核心复习 + HTML5 语义表单 / CSS3 盒模型与布局实操"],
        ["c_language", "c/index.html", "code", "C 语言", "第 1–9 章 27 节完整讲义 · 填空遮挡背诵、数组函数指针专题、54 道随堂真题与 5 道图题"]
      ];
      notesGrid.replaceChildren(...subjectCardsMeta.map(([sid, href, icoName, title, desc]) => {
        const p = model.subjectProgress(sid);
        return el("a", { class: `sh-card home-note-card home-note-card--${sid}`, href: base + href }, [
          el("span", { class: "home-note-card__icon" }, [icon(icoName, 22)]),
          el("div", {}, [
            el("h3", { text: title }),
            el("p", { text: desc }),
            p.hasRecords ? el("p", { class: "sys-home-card-pct", text: `已学 ${p.done}/${p.total} (${p.pct}%) · 已掌握 ${p.mastered}` }) : null
          ]),
          el("strong", { text: "系统学习 →" })
        ]);
      }));
    }

    const mapSec = document.getElementById("subjects");
    if (mapSec && !document.querySelector(".sys-home-lab")) {
      const labBanner = el("section", { class: "sh-card sys-home-lab", "aria-label": "专业课在线代码实操台" }, [
        el("div", { class: "sys-home-lab__copy" }, [
          el("span", { class: "sys-home-lab__badge", text: "纯本地零依赖 · 手机/电脑随时可练" }),
          el("h2", { class: "sys-home-lab__title", text: "💻 专业课在线代码实操台" }),
          el("p", { class: "sys-home-lab__desc", text: "无需安装 Dev-C++ / VS Code / SQL Server：支持 C 语言 1–9 章（含指针、数组、递归与 stdin 输入）、HTML + CSS 网页实时沙箱、SQL Server 教务四表联查；每个知识点页内也可随时一键打开随堂实操。" })
        ]),
        el("div", { class: "sys-home-lab__actions" }, [
          el("a", { class: "sh-btn sh-btn--primary sys-home-lab__btn", href: `${base}study/lab.html?lang=c`, text: "⚙️ C 语言（1–9 章）" }),
          el("a", { class: "sh-btn sys-home-lab__btn", href: `${base}study/lab.html?lang=html`, text: "🌐 HTML + CSS 网页" }),
          el("a", { class: "sh-btn sys-home-lab__btn", href: `${base}study/lab.html?lang=sql`, text: "🗄️ SQL 教务四表" })
        ])
      ]);
      mapSec.before(labBanner);
    }
    if (mapSec && !document.querySelector(".sys-heatmap")) {
      mapSec.before(renderMasteryHeatmap({ model, cardsDoc, base }));
    }
  } else if (shell.rel === "study/overview.html") {
    const grid = document.querySelector(".ov-grid");
    if (grid && !document.querySelector(".sys-heatmap")) {
      grid.after(renderMasteryHeatmap({ model, cardsDoc, base }));
    }
  }
}

// 10. 响应式表格防溢出、宽表转手机竖排卡片、裸 SVG 导图与速记大图拦截查看器、原题答案遮挡与全局快捷键
let globalShortcutsBound = false;
export function fixResponsiveAndMedia({ base, cardsDoc, model, subjectId = "" }) {
  const initCloze = readStudyMode() === "cloze";
  maskPrintedSourceAnswers(document, initCloze);
  bindStaticClozeButtons(document, initCloze);
  bindCodeCopyButtons(document, base || "../", subjectId);

  if (!globalShortcutsBound) {
    globalShortcutsBound = true;
    document.addEventListener("keydown", (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = document.activeElement?.tagName || "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || document.activeElement?.isContentEditable) return;
      if (document.querySelector("dialog[open]")) return;
      const card = document.querySelector(".sys-card");
      const clozeBtn = document.querySelector("[data-sys-cloze-toggle]");
      if (e.key === "c" || e.key === "C") {
        if (clozeBtn) {
          e.preventDefault();
          clozeBtn.click();
        }
        return;
      }
      if (e.key === " ") {
        const nextMask = [...document.querySelectorAll(".sys-cloze.is-masked")]
          .find((el) => !el.closest("[hidden]") && el.offsetParent !== null);
        if (nextMask) {
          e.preventDefault();
          nextMask.click();
          nextMask.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        return;
      }
      if (!card) return;
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        card.querySelector('[data-sys-lab-btn="1"]')?.click();
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        card.querySelector('[data-sys-tool="deck"]')?.click();
      } else if (e.key === "l" || e.key === "L") {
        e.preventDefault();
        card.querySelector('[data-sys-tool="summary"]')?.click();
      } else if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        card.querySelector('[data-sys-tool="challenge"]')?.click();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        card.querySelector('[data-sys-tool="mindmap"]')?.click();
      }
    });
  }
  // (a) 拦截裸 SVG 思维导图链接（如 yy/index.html 中的 mm/mm1.svg ~ mm4.svg）与速记大图链接（.wy-illus-link / .gs-illus-link）
  for (const a of document.querySelectorAll('a[href$=".svg"], a.wy-illus-link, a.gs-illus-link')) {
    if (a.dataset.sysViewerBound) continue;
    a.dataset.sysViewerBound = "1";
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      const targetUrl = new URL(a.getAttribute("href"), location.href).href;
      const title = a.querySelector("img")?.getAttribute("alt") || a.textContent.trim() || "思维导图 / 速记图";
      openMindmapModal({
        card: null,
        subjectId: subjectId || "english",
        model,
        cardsDoc,
        base,
        initialMediaUrl: targetUrl,
        initialMediaTitle: title
      });
    });
  }

  // (b) 宽表格自适应容器 + 手机端「切换竖排卡片视图」按钮（彻底解决 jsj/index.html 1010px 表与 yy/index.html 620px 表在 390px 手机上的横向挤压/溢出）
  for (const table of document.querySelectorAll("main table")) {
    if (table.dataset.sysTableEnhanced) continue;
    table.dataset.sysTableEnhanced = "1";

    let wrapper = table.closest(".sys-table-wrap, .table-scroller, .tablewrap, .note-table-wrap, .ref-wrap");
    if (!wrapper) {
      wrapper = el("div", { class: "sys-table-wrap", role: "region", "aria-label": "可横向滚动的数据表格", tabindex: "0" });
      table.parentNode.insertBefore(wrapper, table);
      wrapper.append(table);
    } else {
      wrapper.classList.add("sys-table-wrap");
    }

    const headers = [...table.querySelectorAll("thead th")].map((th) => th.textContent.replace(/\s+/g, " ").trim());
    if (headers.length >= 4) {
      for (const tr of table.querySelectorAll("tbody tr")) {
        [...tr.children].forEach((td, i) => {
          if (headers[i] && !td.hasAttribute("data-col-label")) {
            td.setAttribute("data-col-label", headers[i]);
          }
        });
      }
      const isNarrow = typeof matchMedia === "function" && matchMedia("(max-width: 640px)").matches;
      if (isNarrow) {
        table.classList.add("is-card-view");
      }
      const toggleBtn = el("button", {
        type: "button",
        class: "sh-btn sys-table-card-toggle",
        "aria-pressed": String(isNarrow),
        text: isNarrow ? "📊 切回表格视图" : "📱 手机竖排卡片视图"
      });
      toggleBtn.addEventListener("click", () => {
        const on = !table.classList.contains("is-card-view");
        table.classList.toggle("is-card-view", on);
        toggleBtn.setAttribute("aria-pressed", String(on));
        toggleBtn.textContent = on ? "📊 切回表格视图" : "📱 手机竖排卡片视图";
      });
      wrapper.before(el("div", { class: "sys-table-tools" }, [toggleBtn]));
    }
  }
}
