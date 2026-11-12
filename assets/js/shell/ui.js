// 外壳 UI 小工具：元素构造、图标、进度条、状态标记。
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

const PATHS = {
  home: '<path d="M3.5 10.2 12 3.8l8.5 6.4V20a1 1 0 0 1-1 1h-5v-6.2h-5V21h-5a1 1 0 0 1-1-1z"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  playCircle: '<circle cx="12" cy="12" r="9"/><path d="M10 8.6v6.8l5.4-3.4z" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  layers: '<path d="m12 3.5 8.5 4.6L12 12.7 3.5 8.1z"/><path d="m3.5 12 8.5 4.6 8.5-4.6"/><path d="m3.5 15.9 8.5 4.6 8.5-4.6"/>',
  chevron: '<path d="m9.5 6 6 6-6 6"/>',
  chevronLeft: '<path d="m14.5 6-6 6 6 6"/>',
  chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
  check: '<path d="m6 12.5 4 4 8-9"/>',
  map: '<path d="m3.5 6.5 5.5-2.5 6 2.5 5.5-2.5v13.5L15 20l-6-2.5-5.5 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  pencil: '<path d="m4.5 19.5 4-1 10.5-10.5a2 2 0 0 0-3-3L5.5 15.5z"/><path d="m14 7 3 3"/>',
  book: '<path d="M12 6.5C10.3 5.2 7.9 4.6 4 4.8v13.5c3.9-.2 6.3.4 8 1.7 1.7-1.3 4.1-1.9 8-1.7V4.8c-3.9-.2-6.3.4-8 1.7z"/><path d="M12 6.5V20"/>',
  folder: '<path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v9.3a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
  graph: '<circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="12" cy="18" r="2.4"/><path d="M7.6 7.8 10.6 16M16.4 7.8 13.4 16"/>',
  chart: '<path d="M4 20h16"/><path d="M7 16v-4M12 16V7M17 16v-6"/>',
  alert: '<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.2M12 17h.01"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6z"/><path d="M12 8.5v4.5M12 16h.01"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r=".9"/><circle cx="4.8" cy="12" r=".9"/><circle cx="4.8" cy="17.5" r=".9"/>',
  arrowRight: '<path d="M5 12h14m-5.5-5.5L19 12l-5.5 5.5"/>',
  arrowUp: '<path d="M12 19V5m-5.5 5.5L12 5l5.5 5.5"/>',
  arrowDown: '<path d="M12 5v14m-5.5-5.5L12 19l5.5-5.5"/>',
  expand: '<path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15"/>',
  legend: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h.01M11 9h5M8 12.5h.01M11 12.5h5M8 16h.01M11 16h5"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.6 15.6 4.9 4.9"/>',
  close: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  file: '<path d="M6.5 3.5h7l4 4v13h-11z"/><path d="M13.5 3.5v4h4M9 12h6M9 15.5h6"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3.5v3M16 3.5v3M4 10h16"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  db: '<ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6"/>',
  network: '<circle cx="12" cy="5.5" r="2.2"/><circle cx="5.5" cy="18" r="2.2"/><circle cx="18.5" cy="18" r="2.2"/><path d="m10.9 7.4-4.3 8.7M13.1 7.4l4.3 8.7M7.7 18h8.6"/>',
  monitor: '<rect x="3.5" y="4.5" width="17" height="11.5" rx="1.5"/><path d="M9 20h6M12 16v4"/>',
  code: '<path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13"/>',
  web: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9h17M7 6.8h.01M9.5 6.8h.01"/>',
  sigma: '<path d="M17.5 5h-11l6 7-6 7h11"/>',
  english: '<path d="M4 5.5h7.5V19H4z"/><path d="M12.5 5.5H20V19h-7.5z"/><path d="M6.5 9h3M6.5 12h3M15 9h2.5M15 12h2.5"/>'
};

export function icon(name, size = 18, cls = "") {
  const span = document.createElement("span");
  span.className = `sh-ico${cls ? " " + cls : ""}`;
  span.setAttribute("aria-hidden", "true");
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false">${PATHS[name] || PATHS.book}</svg>`;
  return span;
}

export const SUBJECT_ICON = {
  english: "book", math: "sigma", computer_basics: "monitor", c_language: "code",
  database: "db", web_design: "web", network: "network", digital_electronics: "layers"
};

export function shortSubjectName(subject) {
  return String(subject?.name || "").replace(/（.*?）/g, "");
}

export function bar(pct, label) {
  const wrap = el("span", { class: "sh-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(pct), "aria-label": label || "进度" });
  wrap.append(el("i", { style: `width:${Math.max(0, Math.min(100, pct))}%` }));
  return wrap;
}

export const STATUS_LABEL = { mastered: "已掌握", learning: "学习中", due: "不稳 / 到期复习", none: "未学" };

export function statusDot(status, title) {
  const s = el("span", { class: `sh-dot sh-dot--${status}`, title: title || STATUS_LABEL[status] || "" });
  if (status === "mastered") s.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 8.2 2.4 2.4 4.6-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  else if (status === "learning") s.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.4 5.2v5.6L10.8 8z" fill="currentColor"/></svg>';
  else if (status === "due") s.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 4.6v4.2M8 11.2h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  return s;
}

export function emptyState(iconName, title, action) {
  return el("div", { class: "sh-empty" }, [icon(iconName, 22), el("p", { class: "sh-empty__title", text: title }), action || null]);
}

export function card(title, iconName, children = [], extra = null, attrs = {}) {
  return el("section", { class: `sh-card ${attrs.class || ""}`.trim(), "aria-label": title, id: attrs.id || null }, [
    el("header", { class: "sh-card__head" }, [
      el("h2", { class: "sh-card__title" }, [iconName ? icon(iconName, 18) : null, el("span", { text: title })]),
      extra
    ]),
    ...[].concat(children)
  ]);
}

export function formatDay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}
