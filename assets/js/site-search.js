import { excerptText, groupResults, pageHeading, resultHref, sectionHeading, statusMessage } from "./site-search-format.js";

const input = document.querySelector("#zsb-search");
const form = document.querySelector("#zsb-search-form");
const status = document.querySelector("#zsb-search-status");
const list = document.querySelector("#zsb-search-results");
let pagefind, serial = 0;
const params = new URLSearchParams(location.search);
input.value = params.get("q") || "";

async function loadIndex() {
  if (!pagefind) {
    pagefind = await import("../../pagefind/pagefind.js");
    await pagefind.options({ baseUrl: new URL("../../", import.meta.url).pathname });
    await pagefind.init();
  }
  return pagefind;
}

function itemLink(url) {
  const a = document.createElement("a");
  a.className = "zsb-result";
  a.href = resultHref(url);
  return a;
}

function addGroup(entry, parts) {
  const group = document.createElement("section");
  group.className = "zsb-result-group";
  const title = document.createElement("h2");
  title.className = "zsb-result-group__title";
  title.textContent = pageHeading(entry) || "课程";
  const items = document.createElement("div");
  items.className = "zsb-result-group__items";
  for (const part of parts) {
    const a = itemLink(part?.url || entry.url);
    const section = sectionHeading(part, entry);
    if (section) {
      const h = document.createElement("h3");
      h.className = "zsb-result__section";
      h.textContent = section;
      a.append(h);
    }
    const p = document.createElement("p");
    p.className = "zsb-result__excerpt";
    p.textContent = excerptText(part, entry);
    a.append(p);
    items.append(a);
  }
  group.append(title, items);
  list.append(group);
}

async function search(q) {
  const ticket = ++serial;
  list.replaceChildren();
  const u = new URL(location.href);
  if (q) u.searchParams.set("q", q);
  else u.searchParams.delete("q");
  history.replaceState(null, "", u);
  if (!q.trim()) {
    status.textContent = "";
    return;
  }
  status.textContent = "搜索中…";
  try {
    const engine = await loadIndex();
    const result = await engine.search(q.trim());
    const raw = await Promise.all(result.results.slice(0, 25).map((r) => r.data()));
    if (ticket !== serial) return;
    const groups = groupResults(raw);
    let itemCount = 0;
    for (const group of groups) {
      addGroup(group.entry, group.parts);
      itemCount += group.parts.length;
    }
    status.textContent = statusMessage(groups.length, itemCount);
  } catch (error) {
    if (ticket === serial) status.textContent = "搜索暂不可用，请稍后重试";
    console.error("Pagefind search failed", error);
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  search(input.value);
});
if (input.value) search(input.value);
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) &&
    !document.activeElement.isContentEditable
  ) {
    e.preventDefault();
    input.focus();
  }
  if (e.key === "Escape" && document.activeElement === input) input.blur();
});
