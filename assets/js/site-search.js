// 站内搜索：目录里的知识点、章节（data/topics.json）+ Pagefind 全文（讲义 / 资料），按科目分组。
import { excerptText, groupResults, pageHeading, resultHref, sectionHeading } from "./site-search-format.js";
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
const clearBtn = document.querySelector("#srch-clear");
const params = new URLSearchParams(location.search);
input.value = params.get("q") || "";
hydrateIcons();

const TYPES = [["topic", "知识点", "list"], ["chapter", "章节", "book"], ["doc", "讲义 / 资料", "file"]];
const SUBJECT_BY_DIR = { gs: "math", yy: "english", jsj: "computer_basics", c: "c_language", wy: "web_design" };
const state = { items: [], subject: "", types: new Set(TYPES.map((t) => t[0])), subjects: new Set(), expanded: new Set() };
let pagefind, serial = 0, model = null;

async function getModel() {
  if (!model) model = buildModel(await loadSite(), { ok: true, attempts: [], mistakes: [], progress: [] });
  return model;
}

async function loadIndex() {
  if (!pagefind) {
    pagefind = await import("../../pagefind/pagefind.js");
    await pagefind.options({ baseUrl: new URL("../../", import.meta.url).pathname });
    await pagefind.init();
  }
  return pagefind;
}

function subjectForUrl(url) {
  const root = new URL("../../", import.meta.url).pathname;
  const path = new URL(url, location.href).pathname;
  const rel = path.startsWith(root) ? path.slice(root.length) : path.replace(/^\//, "");
  return SUBJECT_BY_DIR[rel.split("/")[0]] || "";
}

function catalogItems(m, q) {
  const needle = q.toLowerCase();
  const hit = (s) => String(s || "").toLowerCase().includes(needle);
  const out = [];
  for (const subject of m.subjects) {
    for (const node of m.chaptersOf(subject.id)) {
      const first = node.topics.map((t) => topicHref(t, "")).find(Boolean);
      if (hit(node.chapter.title) && first) out.push({ type: "chapter", subject: subject.id, title: node.chapter.title, meta: shortSubjectName(subject), href: first, score: 2 });
      for (const t of node.topics) {
        if (!(hit(t.title) || (t.aliases || []).some(hit))) continue;
        const href = topicHref(t, "");
        if (!href) continue;
        const sec = m.sectionOf(t);
        out.push({ type: "topic", subject: subject.id, title: t.title, meta: [node.chapter.title, sec?.title].filter(Boolean).join(" · "), href, score: hit(t.title) ? 3 : 2.5 });
      }
    }
  }
  return out;
}

async function docItems(q) {
  const engine = await loadIndex();
  const result = await engine.search(q);
  const raw = await Promise.all(result.results.slice(0, 30).map((r) => r.data()));
  const out = [];
  for (const group of groupResults(raw, 4)) {
    const page = pageHeading(group.entry);
    for (const part of group.parts) {
      const url = resultHref(part?.url || group.entry.url);
      out.push({ type: "doc", subject: subjectForUrl(url), title: sectionHeading(part, group.entry) || page || "讲义", meta: page, excerpt: excerptText(part, group.entry), href: url, score: 1 });
    }
  }
  return out;
}

function counts(items, key) {
  const map = new Map();
  for (const it of items) map.set(it[key], (map.get(it[key]) || 0) + 1);
  return map;
}

function visible() {
  return state.items.filter((it) => state.types.has(it.type)
    && (!state.subject || it.subject === state.subject)
    && (!state.subjects.size || state.subjects.has(it.subject)));
}

function subjectName(id) {
  const s = model?.subjectById.get(id);
  return s ? shortSubjectName(s) : "其他";
}

function renderTabs() {
  const bySubject = counts(state.items.filter((it) => state.types.has(it.type)), "subject");
  const entries = [["", "全部", [...bySubject.values()].reduce((a, b) => a + b, 0)], ...model.subjects.filter((s) => bySubject.get(s.id)).map((s) => [s.id, shortSubjectName(s), bySubject.get(s.id)])];
  if (bySubject.get("")) entries.push(["__other", "其他", bySubject.get("")]);
  tabs.replaceChildren(...entries.map(([id, label, n]) => {
    const on = (state.subject || "") === (id === "__other" ? "" : id) && (id !== "__other");
    const b = el("button", { type: "button", role: "tab", class: `srch-tab${on ? " is-on" : ""}`, "aria-selected": String(on) }, [label, el("span", { class: "srch-tab__n", text: `（${n}）` })]);
    b.addEventListener("click", () => { state.subject = id === "__other" ? "" : id; state.subjects.clear(); paint(); });
    return b;
  }));
  tabs.hidden = !state.items.length;
}

function checkbox(label, n, checked, onChange) {
  const box = el("input", { type: "checkbox" });
  box.checked = checked;
  box.addEventListener("change", () => onChange(box.checked));
  return el("label", { class: "srch-check" }, [box, el("span", { text: label }), el("span", { class: "srch-check__n", text: `（${n}）` })]);
}

function renderFilters() {
  const byType = counts(state.items.filter((it) => !state.subject || it.subject === state.subject), "type");
  const bySubject = counts(state.items.filter((it) => state.types.has(it.type)), "subject");
  const head = el("div", { class: "srch-filters__head" }, [el("h2", { text: "筛选" }), el("button", { type: "button", class: "lx-toc__close srch-filters__close", "aria-label": "关闭筛选" }, [icon("close", 18)])]);
  head.querySelector("button").addEventListener("click", closeFilters);
  const typeGroup = el("fieldset", { class: "srch-fieldset" }, [el("legend", { text: "结果类型" }), ...TYPES.map(([id, label]) => checkbox(label, byType.get(id) || 0, state.types.has(id), (on) => { if (on) state.types.add(id); else state.types.delete(id); paint(); }))]);
  const subjectGroup = el("fieldset", { class: "srch-fieldset" }, [el("legend", { text: "所属科目" }), ...model.subjects.filter((s) => bySubject.get(s.id)).map((s) => checkbox(shortSubjectName(s), bySubject.get(s.id), state.subjects.has(s.id), (on) => { if (on) state.subjects.add(s.id); else state.subjects.delete(s.id); state.subject = ""; paint(); }))]);
  const reset = el("button", { type: "button", class: "sh-btn", text: "重置" });
  reset.addEventListener("click", () => { state.types = new Set(TYPES.map((t) => t[0])); state.subjects.clear(); state.subject = ""; paint(); });
  const apply = el("button", { type: "button", class: "sh-btn sh-btn--primary", text: "应用" });
  apply.addEventListener("click", closeFilters);
  filters.replaceChildren(head, typeGroup, subjectGroup, el("div", { class: "srch-filters__foot" }, [reset, apply]));
  filters.hidden = !state.items.length;
  filterBtn.hidden = !state.items.length;
}

function openFilters() { filters.classList.add("is-open"); document.documentElement.classList.add("lx-lock"); filters.querySelector("button")?.focus(); }
function closeFilters() { if (!filters.classList.contains("is-open")) return; filters.classList.remove("is-open"); document.documentElement.classList.remove("lx-lock"); filterBtn.focus(); }
filterBtn.addEventListener("click", openFilters);

function itemNode(it) {
  const ico = it.type === "topic" ? "list" : it.type === "chapter" ? "book" : "file";
  return el("a", { class: "srch-item", href: it.href }, [
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
  const order = [...model.subjects.map((s) => s.id), ""];
  list.replaceChildren(...order.filter((id) => groups.get(id)).map((id) => {
    const rows = groups.get(id).sort((a, b) => b.score - a.score);
    const open = state.expanded.has(id);
    const shown = open ? rows : rows.slice(0, 5);
    const more = rows.length > 5 ? el("button", { type: "button", class: "srch-more", text: open ? "收起" : `查看全部 ${rows.length} 条` }) : null;
    more?.addEventListener("click", () => { if (open) state.expanded.delete(id); else state.expanded.add(id); paint(); });
    return el("section", { class: "srch-group sh-card", "aria-label": subjectName(id) }, [
      el("h2", { class: "srch-group__title" }, [el("span", { class: "srch-group__icon" }, [icon(SUBJECT_ICON[id] || "file", 17)]), el("span", { text: subjectName(id) }), el("small", { text: `· ${rows.length} 条` })]),
      el("div", { class: "srch-group__items" }, shown.map(itemNode)),
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
  tabs.hidden = true; filters.hidden = true; filterBtn.hidden = true;
  const query = q.trim();
  if (!query) { status.textContent = ""; return; }
  status.textContent = "搜索中…";
  const m = await getModel();
  const cat = catalogItems(m, query);
  let docs = [], docError = false;
  try { docs = await docItems(query); } catch (error) { docError = true; console.warn("Pagefind search failed", error); }
  if (ticket !== serial) return;
  const topicHrefs = new Set(cat.filter((c) => c.type === "topic").map((c) => c.href));
  state.items = [...cat, ...docs.filter((d) => !topicHrefs.has(d.href))];
  if (!state.items.length) {
    status.textContent = docError ? "全文搜索暂不可用，请稍后重试" : "没有找到相关内容";
    list.replaceChildren(el("div", { class: "sh-card" }, [el("div", { class: "sh-empty" }, [icon("search", 22), el("p", { class: "sh-empty__title", text: docError ? "全文搜索暂不可用" : "没有找到相关内容" })])]));
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
