// 学习总览：继续学习、今日到期复习、各科进度、薄弱点、学习节奏。全部来自本机记录；没有记录显示空状态。
import { loadModel, topicHref } from "./model.js";
import { localDay } from "../features/page-attempts.js";
import { el, icon, bar, SUBJECT_ICON, shortSubjectName } from "./ui.js";
import { hydrateIcons } from "./common.js";

const RANGES = [["week", "本周"], ["month", "本月"], ["all", "全部"]];
const RANGE_KEY = "zsb.ui.overviewRange";

function slot(name) { return document.querySelector(`[data-slot="${name}"]`); }

function topicRow(row, base, right) {
  const href = topicHref(row.topic, base);
  return el("li", {}, [el(href ? "a" : "span", { class: "ov-row", href: href || null }, [
    el("span", { class: "ov-row__icon" }, [icon(SUBJECT_ICON[row.subject?.id] || "book", 15)]),
    el("span", { class: "ov-row__text" }, [el("strong", { text: row.topic.title }), el("small", { text: [shortSubjectName(row.subject), row.chapter?.title].filter(Boolean).join(" · ") })]),
    right ? el("span", { class: "ov-row__right", text: right }) : null,
    icon("chevron", 15, "ov-row__chev")
  ])]);
}

function rhythm(model, range) {
  const days = new Map();
  for (const a of model.learning.attempts) {
    if (a.migrated_from) continue;
    const d = localDay(a.submitted_at);
    days.set(d, (days.get(d) || 0) + 1);
  }
  if (!days.size) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monday = (d) => { const x = new Date(d); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return x; };
  let start;
  if (range === "week") start = monday(today);
  else if (range === "month") start = monday(new Date(today.getFullYear(), today.getMonth(), 1));
  else { const first = [...days.keys()].sort()[0]; start = monday(new Date(first + "T00:00:00")); const cap = new Date(today); cap.setDate(cap.getDate() - 7 * 25); if (start < cap) start = monday(cap); }
  const cells = [];
  const max = Math.max(...days.values());
  let total = 0, active = 0;
  for (let d = new Date(start); d <= today || (d.getDay() + 6) % 7 !== 0; d.setDate(d.getDate() + 1)) {
    const key = localDay(d);
    const n = d <= today ? (days.get(key) || 0) : -1;
    if (n > 0) { total += n; active += 1; }
    const level = n <= 0 ? 0 : Math.max(1, Math.ceil((n / max) * 4));
    cells.push(el("span", { class: `ov-heat__cell l${n < 0 ? "x" : level}`, title: n >= 0 ? `${d.getMonth() + 1} 月 ${d.getDate()} 日：${n} 次作答` : "" }));
    if (cells.length > 7 * 27) break;
  }
  const head = el("div", { class: "ov-heat__head", "aria-hidden": "true" }, ["一", "二", "三", "四", "五", "六", "日"].map((t) => el("span", { text: t })));
  return el("div", { class: "ov-heat" }, [
    head,
    el("div", { class: "ov-heat__grid", role: "img", "aria-label": `学习 ${active} 天，共 ${total} 次作答` }, cells),
    el("p", { class: "ov-heat__foot", text: `学习 ${active} 天 · 共 ${total} 次作答` })
  ]);
}

export async function mount(shell) {
  hydrateIcons();
  const base = shell.base;
  const model = await loadModel();
  let range = "week";
  try { range = localStorage.getItem(RANGE_KEY) || "week"; } catch { /* ignore */ }
  if (!RANGES.some((r) => r[0] === range)) range = "week";

  const rangeBox = slot("range");
  const paintRhythm = () => {
    const node = rhythm(model, range);
    slot("rhythm").replaceChildren(node || el("p", { class: "sh-empty-line", text: "还没有学习记录。" }));
  };
  rangeBox.replaceChildren(...RANGES.map(([id, label]) => {
    const b = el("button", { type: "button", class: `ov-range__btn${id === range ? " is-on" : ""}`, "aria-pressed": String(id === range), text: label });
    b.addEventListener("click", () => {
      range = id;
      try { localStorage.setItem(RANGE_KEY, id); } catch { /* ignore */ }
      for (const x of rangeBox.children) { const on = x === b; x.classList.toggle("is-on", on); x.setAttribute("aria-pressed", String(on)); }
      paintRhythm();
    });
    return b;
  }));
  rangeBox.hidden = !model.hasRecords;

  const cont = model.continueItem();
  if (cont) {
    const href = topicHref(cont.topic, base);
    const pct = cont.progress?.pct ?? 0;
    slot("continue").replaceChildren(el(href ? "a" : "div", { class: "home-continue__item", href: href || null }, [
      el("span", { class: "home-continue__art" }, [icon("book", 24)]),
      el("span", { class: "home-continue__text" }, [
        el("strong", { text: shortSubjectName(cont.subject) }),
        el("span", { class: "home-continue__where", text: [cont.chapter?.title, cont.topic.title].filter(Boolean).join(" · ") }),
        el("span", { class: "home-continue__progress" }, [bar(pct, "本章进度"), el("span", { class: "sh-pct", text: `${pct}%` })])
      ]),
      el("span", { class: "home-continue__play" }, [icon("play", 16)])
    ]));
  }

  const subjects = model.subjects.filter((s) => s.enabled !== false).sort((a, b) => (a.status === "live" ? 0 : 1) - (b.status === "live" ? 0 : 1) || a.order - b.order);
  slot("subjects").replaceChildren(el("ul", { class: "ov-subjects" }, subjects.map((s) => {
    const p = model.subjectProgress(s.id);
    const live = s.status === "live";
    return el("li", { class: `ov-subject${live ? "" : " is-closed"}` }, [
      el("span", { class: "ov-row__icon" }, [icon(SUBJECT_ICON[s.id] || "book", 15)]),
      live && s.homeUrl ? el("a", { class: "ov-subject__name", href: base + s.homeUrl, text: shortSubjectName(s) }) : el("span", { class: "ov-subject__name", text: shortSubjectName(s) }),
      !live ? el("span", { class: "ov-subject__soon", text: "即将开放" })
        : p.hasRecords ? el("span", { class: "ov-subject__bar" }, [bar(p.pct, `${shortSubjectName(s)}进度`), el("span", { class: "sh-pct", text: `${p.pct}%` })])
        : el("span", { class: "ov-subject__soon", text: "未开始" })
    ]);
  })));

  const due = model.dueTopics();
  if (due.length) {
    slot("due-count").textContent = `${due.length} 个知识点`;
    slot("due").replaceChildren(el("ul", { class: "ov-list" }, due.slice(0, 6).map((row) => topicRow(row, base, `${row.count} 题`))));
  }
  const weak = model.weakTopics();
  if (weak.length) slot("weak").replaceChildren(el("ul", { class: "ov-list" }, weak.slice(0, 5).map((row) => topicRow(row, base, `错题 ${row.count}`))));
  paintRhythm();
}
