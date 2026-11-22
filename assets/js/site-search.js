// 先匹配结构化知识点与课程目录，再补充全文、例题与原图结果。
import { createSearchMatcher, excerptText, groupResults, knowledgeScore, pageHeading, resultHref, sectionHeading } from "./site-search-format.js";
import { findReviewTopics, mergeSearchResults } from "./site-search-topics.js";
import { loadSite, buildModel, topicHref } from "./shell/model.js";
import { el, icon, SUBJECT_ICON, shortSubjectName } from "./shell/ui.js";
import { hydrateIcons } from "./shell/common.js";

const input = document.querySelector("#zsb-search");
const form = document.querySelector("#zsb-search-form");
const status = document.querySelector("#zsb-search-status");
const list = document.querySelector("#zsb-search-results");
const tabs = document.querySelector("#srch-tabs");
const filters = document.querySelector("#srch-filters");
const filterBtn = document.querySelector("#srch-filter-btn");
const mobileFilters = matchMedia("(max-width: 820px)");
const clearBtn = document.querySelector("#srch-clear");
const params = new URLSearchParams(location.search);
input.value = params.get("q") || "";
hydrateIcons();

const TYPES = [["topic", "知识点", "list"], ["chapter", "章节", "book"], ["source", "课堂原图", "file"], ["example", "例题 / 自测", "list"], ["doc", "讲义 / 资料", "file"]];
const SUBJECT_BY_DIR = { gs: "math", yy: "english", jsj: "computer_basics", c: "c_language", wy: "web_design", wl: "network" };
const ROOT = new URL("../../", import.meta.url);
const OTHER_SUBJECT = "__other";
const state = { items: [], subject: "", types: new Set(TYPES.map((t) => t[0])), subjects: new Set(), expanded: new Set() };
let pagefind, serial = 0, model = null, noteSupportPromise = null;

function sourceTitle(file) {
  const stem = String(file || "").replace(/\.(png|jpe?g|webp)$/i, "");
  const match = stem.match(/^\d+_(?:p\d+_)?(.+)$/);
  return (match?.[1] || stem).replaceAll("_", " ");
}

async function getModel() {
  if (!model) model = buildModel(await loadSite(), { ok: true, attempts: [], mistakes: [], progress: [] });
  return model;
}

async function loadIndex() {
  if (!pagefind) {
    pagefind = await import("../../pagefind/pagefind.js");
    await pagefind.options({ baseUrl: ROOT.pathname });
    await pagefind.init();
  }
  return pagefind;
}

function subjectForUrl(url) {
  const root = ROOT.pathname;
  const path = new URL(url, location.href).pathname;
  const rel = path.startsWith(root) ? path.slice(root.length) : path.replace(/^\//, "");
  if (rel === "notes/network.html" || rel === "notes/network-review.html") return "network";
  if (rel === "notes/web.html" || rel === "notes/web-review.html") return "web_design";
  if (rel === "notes/index.html") return "";
  return SUBJECT_BY_DIR[rel.split("/")[0]] || "";
}

function catalogItems(m, matcher) {
  const out = [];
  for (const subject of m.subjects) {
    for (const node of m.chaptersOf(subject.id)) {
      const first = node.topics.map((t) => topicHref(t, "")).find(Boolean);
      if (matcher(node.chapter.title) && first) out.push({ type: "chapter", subject: subject.id, title: node.chapter.title, meta: shortSubjectName(subject), href: first, score: 32 });
      for (const t of node.topics) {
        const score = knowledgeScore(t.title, t.aliases || [], matcher);
        if (!score) continue;
        const href = topicHref(t, "");
        if (!href) continue;
        const sec = m.sectionOf(t);
        out.push({ type: "topic", subject: subject.id, title: t.title, meta: [node.chapter.title, sec?.title].filter(Boolean).join(" · "), href, score });
      }
    }
  }
  return out;
}

async function docItems(q) {
  const engine = await loadIndex();
  const result = await engine.search(q.normalize("NFKC"));
  const raw = await Promise.all(result.results.slice(0, 30).map((r) => r.data()));
  const out = [];
  for (const group of groupResults(raw, 4)) {
    const page = pageHeading(group.entry);
    for (const part of group.parts) {
      const url = resultHref(part?.url || group.entry.url);
      out.push({ type: "doc", subject: subjectForUrl(url), title: sectionHeading(part, group.entry) || page || "讲义", meta: page, excerpt: excerptText(part, group.entry), href: url, score: 10 });
    }
  }
  return out;
}

function supportItems(matcher) {
  if (!noteSupportPromise) {
    noteSupportPromise = Promise.all([
      fetch(new URL("notes/data/topic-links.json", ROOT)).then((r) => r.json()),
      fetch(new URL("notes/data/network-sources.json", ROOT)).then((r) => r.json()),
      fetch(new URL("notes/data/web-sources.json", ROOT)).then((r) => r.json())
    ]).then(([links, network, web]) => ({ links, sources: [...network.items, ...web.items] }));
  }
  return noteSupportPromise.then(({ links, sources }) => {
    const sourceItems = sources
      .filter((item) => matcher(`${item.id} ${item.file} ${sourceTitle(item.file)} ${item.kind} ${item.readable ? "高清资料" : "待补高清原图"} ${item.note || ""}`))
      .map((item) => ({
        type: "source",
        subject: item.subject,
        title: sourceTitle(item.file),
        meta: `${item.subject === "network" ? "计算机网络" : "网页制作基础"} · ${item.kind}${item.readable ? "" : " · 待补高清"}`,
        excerpt: item.note,
        href: `notes/sources.html?subject=${encodeURIComponent(item.subject)}&source=${encodeURIComponent(item.id)}#source-${item.id}`,
        score: item.readable ? 22 : 20
      }));
    const exampleItems = links.examples
      .filter((item) => matcher(`${item.title} ${item.id}`))
      .map((item) => ({
        type: "example",
        subject: item.subjectId,
        title: item.title,
        meta: `${item.subjectId === "network" ? "计算机网络" : "网页制作基础"} · 关联 ${item.sourceIds.length} 张依据资料`,
        href: `notes/${item.href}`,
        score: 34
      }));
    return [...exampleItems, ...sourceItems];
  });
}

function counts(items, key) {
  const map = new Map();
  for (const it of items) map.set(it[key], (map.get(it[key]) || 0) + 1);
  return map;
}

function matchesSubject(it) {
  return !state.subject || it.subject === (state.subject === OTHER_SUBJECT ? "" : state.subject);
}

function visible() {
  return state.items.filter((it) => state.types.has(it.type)
    && matchesSubject(it)
    && (!state.subjects.size || state.subjects.has(it.subject)));
}

function subjectName(id) {
  const s = model?.subjectById.get(id);
  return s ? shortSubjectName(s) : "其他";
}

function renderTabs() {
  const bySubject = counts(state.items.filter((it) => state.types.has(it.type)), "subject");
  const entries = [["", "全部", [...bySubject.values()].reduce((a, b) => a + b, 0)], ...model.subjects.filter((s) => bySubject.get(s.id)).map((s) => [s.id, shortSubjectName(s), bySubject.get(s.id)])];
  if (bySubject.get("")) entries.push([OTHER_SUBJECT, "其他", bySubject.get("")]);
  tabs.replaceChildren(...entries.map(([id, label, n]) => {
    const on = state.subject === id;
    const b = el("button", { type: "button", role: "tab", class: `srch-tab${on ? " is-on" : ""}`, "aria-selected": String(on) }, [label, el("span", { class: "srch-tab__n", text: `（${n}）` })]);
    b.addEventListener("click", () => { state.subject = id; state.subjects.clear(); paint(); tabs.querySelector('[aria-selected="true"]')?.focus(); });
    return b;
  }));
  tabs.hidden = !state.items.length;
}

function checkbox(id, label, n, checked, onChange) {
  const box = el("input", { id, type: "checkbox" });
  box.checked = checked;
  box.addEventListener("change", () => onChange(box.checked));
  return el("label", { class: "srch-check" }, [box, el("span", { text: label }), el("span", { class: "srch-check__n", text: `（${n}）` })]);
}

function renderFilters() {
  const activeId = filters.contains(document.activeElement) ? document.activeElement.id : "";
  const byType = counts(state.items.filter(matchesSubject), "type");
  const bySubject = counts(state.items.filter((it) => state.types.has(it.type)), "subject");
  const head = el("div", { class: "srch-filters__head" }, [el("h2", { text: "筛选" }), el("button", { id: "srch-filter-close", type: "button", class: "lx-toc__close srch-filters__close", "aria-label": "关闭筛选" }, [icon("close", 18)])]);
  head.querySelector("button").addEventListener("click", closeFilters);
  const typeGroup = el("fieldset", { class: "srch-fieldset" }, [el("legend", { text: "结果类型" }), ...TYPES.map(([id, label]) => checkbox(`srch-type-${id}`, label, byType.get(id) || 0, state.types.has(id), (on) => { if (on) state.types.add(id); else state.types.delete(id); paint(); }))]);
  const subjectGroup = el("fieldset", { class: "srch-fieldset" }, [el("legend", { text: "所属科目" }), ...model.subjects.filter((s) => bySubject.get(s.id)).map((s) => checkbox(`srch-subject-${s.id}`, shortSubjectName(s), bySubject.get(s.id), state.subjects.has(s.id), (on) => { if (on) state.subjects.add(s.id); else state.subjects.delete(s.id); state.subject = ""; paint(); }))]);
  const reset = el("button", { id: "srch-filter-reset", type: "button", class: "sh-btn", text: "重置" });
  reset.addEventListener("click", () => { state.types = new Set(TYPES.map((t) => t[0])); state.subjects.clear(); state.subject = ""; paint(); });
  const apply = el("button", { type: "button", class: "sh-btn sh-btn--primary", text: "应用" });
  apply.addEventListener("click", closeFilters);
  filters.replaceChildren(head, typeGroup, subjectGroup, el("div", { class: "srch-filters__foot" }, [reset, apply]));
  filters.hidden = !state.items.length;
  filterBtn.hidden = !state.items.length;
  if (activeId) document.getElementById(activeId)?.focus();
}

function syncFilterPanel() {
  const open = mobileFilters.matches && filters.classList.contains("is-open");
  filters.inert = mobileFilters.matches && !open;
  filterBtn.setAttribute("aria-expanded", String(open));
  document.documentElement.classList.toggle("lx-lock", open);
  if (open) {
    filters.setAttribute("role", "dialog");
    filters.setAttribute("aria-modal", "true");
  } else {
    filters.removeAttribute("role");
    filters.removeAttribute("aria-modal");
  }
}

function openFilters() {
  if (!mobileFilters.matches) return;
  filters.classList.add("is-open");
  syncFilterPanel();
  filters.querySelector("button")?.focus();
}

function closeFilters() {
  if (!filters.classList.contains("is-open")) return;
  filters.classList.remove("is-open");
  syncFilterPanel();
  if (mobileFilters.matches) filterBtn.focus();
}

filterBtn.addEventListener("click", openFilters);
mobileFilters.addEventListener("change", () => { filters.classList.remove("is-open"); syncFilterPanel(); });
filters.addEventListener("keydown", (event) => {
  if (event.key !== "Tab" || !filters.classList.contains("is-open")) return;
  const controls = [...filters.querySelectorAll("button, input")];
  const first = controls[0];
  const last = controls.at(-1);
  if (event.shiftKey ? document.activeElement === first : document.activeElement === last) {
    event.preventDefault();
    (event.shiftKey ? last : first)?.focus();
  }
});
syncFilterPanel();

function itemNode(it, best = false) {
  const ico = it.type === "topic" || it.type === "example" ? "list" : it.type === "chapter" ? "book" : "file";
  return el("a", { class: best ? "srch-item srch-item--best" : "srch-item", href: it.href }, [
    el("span", { class: "srch-item__icon" }, [icon(ico, 16)]),
    el("span", { class: "srch-item__body" }, [
      el("strong", { text: it.title }),
      el("small", { text: [TYPES.find((t) => t[0] === it.type)[1], it.meta].filter(Boolean).join(" · ") }),
      it.excerpt ? el("span", { class: "srch-item__excerpt", text: it.excerpt }) : null
    ]),
    icon("chevron", 16, "srch-item__chev")
  ]);
}

function paint() {
  renderTabs();
  renderFilters();
  const items = visible();
  const groups = new Map();
  for (const it of items) (groups.get(it.subject) || groups.set(it.subject, []).get(it.subject)).push(it);
  const best = items.find((item) => item.type === "topic");
  list.replaceChildren(...[...groups].map(([id, rows]) => {
    const open = state.expanded.has(id);
    const shown = open ? rows : rows.slice(0, 5);
    const more = rows.length > 5 ? el("button", { type: "button", class: "srch-more", text: open ? "收起" : `查看全部 ${rows.length} 条` }) : null;
    more?.addEventListener("click", () => { if (open) state.expanded.delete(id); else state.expanded.add(id); paint(); });
    return el("section", { class: "srch-group sh-card", "aria-label": subjectName(id) }, [
      el("h2", { class: "srch-group__title" }, [el("span", { class: "srch-group__icon" }, [icon(SUBJECT_ICON[id] || "file", 17)]), el("span", { text: subjectName(id) }), el("small", { text: `· ${rows.length} 条` })]),
      el("div", { class: "srch-group__items" }, shown.map((item) => itemNode(item, item === best))),
      more
    ]);
  }));
  if (state.items.length) status.textContent = items.length ? `共 ${items.length} 条结果` : "没有符合筛选条件的结果";
}

async function search(q) {
  const ticket = ++serial;
  const u = new URL(location.href);
  if (q) u.searchParams.set("q", q); else u.searchParams.delete("q");
  history.replaceState(null, "", u);
  clearBtn.hidden = !q;
  state.items = []; state.subject = ""; state.subjects.clear(); state.expanded.clear();
  list.replaceChildren();
  closeFilters();
  tabs.hidden = true; filters.hidden = true; filterBtn.hidden = true;
  const query = q.trim();
  const matcher = createSearchMatcher(query);
  if (!matcher) { status.textContent = ""; return; }
  status.textContent = "搜索中…";
  const m = await getModel();
  if (ticket !== serial) return;
  const review = findReviewTopics(query).map((topic) => ({ ...topic, type: "topic", review: true, meta: `${subjectName(topic.subject)} · 课堂复习` }));
  const catalog = [...review, ...catalogItems(m, matcher)];
  state.items = mergeSearchResults(catalog, ROOT);
  if (state.items.length) paint();
  let docs = [], support = [], docError = false;
  const [docsResult, supportResult] = await Promise.allSettled([docItems(query), supportItems(matcher)]);
  if (docsResult.status === "fulfilled") docs = docsResult.value;
  else {
    docError = true;
    console.warn("Pagefind search failed", docsResult.reason);
  }
  if (supportResult.status === "fulfilled") support = supportResult.value;
  else console.warn("课堂笔记资料搜索失败", supportResult.reason);
  if (ticket !== serial) return;
  state.items = mergeSearchResults([...catalog, ...support, ...docs], ROOT);
  if (!state.items.length) {
    status.textContent = docError ? "全文搜索暂不可用，请稍后重试" : "没有找到相关内容";
    const suggestions = el("div", { class: "srch-suggestions", "aria-label": "推荐搜索词" },
      ["CIDR", "HTML 表单", "数组", "等价无穷小"].map((word) => el("a", {
        href: `?q=${encodeURIComponent(word)}`,
        text: word
      }))
    );
    list.replaceChildren(el("div", { class: "sh-card" }, [
      el("div", { class: "sh-empty" }, [
        icon("search", 22),
        el("p", { class: "sh-empty__title", text: docError ? "全文搜索暂不可用" : "没有找到相关内容" }),
        el("p", { class: "sh-empty__hint", text: "可以换一个更短的关键词，或试试下面的高频主题。" }),
        suggestions
      ])
    ]));
    return;
  }
  paint();
}

form.addEventListener("submit", (e) => { e.preventDefault(); input.blur(); search(input.value); });
clearBtn.addEventListener("click", () => { input.value = ""; search(""); input.focus(); });
input.addEventListener("input", () => { clearBtn.hidden = !input.value; });
if (input.value) search(input.value);
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !e.altKey && !e.ctrlKey && !e.metaKey && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
    e.preventDefault();
    input.focus();
  }
  if (e.key === "Escape") { if (filters.classList.contains("is-open")) closeFilters(); else if (document.activeElement === input) input.blur(); }
});
