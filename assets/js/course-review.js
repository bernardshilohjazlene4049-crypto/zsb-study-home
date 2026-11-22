import { findReviewTopics } from "./site-search-topics.js";

function mount() {
  const main = document.querySelector(".course-review main");
  const navigation = main?.querySelector(".review-navigation");
  if (!navigation) return;

  const toggle = navigation.querySelector(".review-toc-toggle");
  const toc = navigation.querySelector(".notes-toc");
  if (!toggle || !toc) return;

  const list = toc.querySelector(".notes-toc__list");
  const links = list.querySelectorAll('a[href^="#"]');
  const filter = toc.querySelector(".review-toc-filter");
  const empty = toc.querySelector(".review-toc-empty");
  const subject = document.querySelector('link[rel="canonical"]')?.href.endsWith("/network-review.html") ? "network" : "web_design";
  const mobile = matchMedia("(max-width: 900px)");
  const isOpen = () => mobile.matches && toggle.getAttribute("aria-expanded") === "true";

  function setOpen(open) {
    toggle.setAttribute("aria-expanded", String(open));
    if (!open) return;
    const current = list.querySelector('[aria-current="location"]');
    if (!current?.getClientRects().length) return;
    const row = current.getBoundingClientRect();
    const viewport = list.getBoundingClientRect();
    if (row.top < viewport.top || row.bottom > viewport.bottom) {
      list.scrollTop += row.top - viewport.top - (viewport.height - row.height) / 2;
    }
  }

  function markCurrent() {
    for (const link of links) {
      if (link.hash === location.hash || link.hash + "-title" === location.hash) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  }

  filter.addEventListener("input", () => {
    const results = new Set(findReviewTopics(filter.value, subject).map((topic) => "#"+topic.href.split("#")[1]));
    for (const link of links) link.closest("li").hidden = !results.has(link.hash);
    empty.hidden = results.size > 0;
  });

  const dateTopics = new Map();
  for (const topic of main.querySelectorAll(".review-topic[id]")) {
    const dates = new Set(Array.from(topic.querySelectorAll('.question__source a[href^="#date-"]'), (link) => link.hash));
    for (const date of dates) {
      if (!dateTopics.has(date)) dateTopics.set(date, []);
      dateTopics.get(date).push(topic);
    }
  }
  for (const [hash, topics] of dateTopics) {
    const date = document.getElementById(hash.slice(1));
    if (!date) continue;
    const row = document.createElement("div");
    row.className = "review-date-topics";
    for (const topic of topics) {
      const link = document.createElement("a");
      link.href = "#" + topic.id;
      const directoryLink = Array.from(links).find((entry) => entry.hash === link.getAttribute("href"));
      link.textContent = directoryLink?.lastChild.textContent.trim() || topic.querySelector("h3").textContent;
      row.append(link);
    }
    date.append(row);
  }

  toggle.addEventListener("click", () => setOpen(!isOpen()));
  mobile.addEventListener("change", () => setOpen(false));
  window.addEventListener("hashchange", markCurrent);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isOpen()) return;
    event.preventDefault();
    setOpen(false);
    toggle.focus();
  });

  document.addEventListener("click", (event) => {
    if (isOpen() && !navigation.contains(event.target)) setOpen(false);
  });

  main.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="#"]');
    if (!link?.hash) return;

    const target = document.getElementById(link.hash.slice(1));
    if (!target || !main.contains(target)) return;
    const headingId = target.getAttribute("aria-labelledby");
    const focusTarget = (headingId && document.getElementById(headingId)) || target;
    setOpen(false);
    requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
  });

  toggle.hidden = false;
  filter.hidden = false;
  navigation.dataset.enhanced = "";
  markCurrent();
}

mount();
