import { loadModel, topicHref } from "./shell/model.js";
import { el, icon, bar } from "./shell/ui.js";
import { buildTowerStats } from "./tower-stats.js";

const get = (id) => document.getElementById(id);
const base = "../";
const mistakesHref = "../study/index.html#/mistakes";
const mobile = matchMedia("(max-width: 760px)");
let floors = [];
let selected = "07F";

const count = (floor, key, unit = "个") => floor.hasRecords || key === "total" ? `${floor[key]} ${unit}` : "—";
const pct = (floor) => floor.pct === null ? "—" : `${floor.pct}%`;
const badge = (floor) => el("span", { class: "tw-floor-no", text: floor.no });

function floorButton(floor, className, children) {
  return el("button", {
    type: "button", class: className, "data-floor": floor.no,
    "aria-pressed": String(floor.no === selected), "aria-controls": "detailPanel", tabindex: floor.no === selected ? "0" : "-1",
    onclick: () => selectFloor(floor.no)
  }, children);
}

function drawList() {
  get("floorList").replaceChildren(...floors.map((floor) => floorButton(floor, "tw-floor", [
    badge(floor), el("span", { class: "tw-floor__name", text: floor.name }),
    !floor.open ? el("small", { class: "tw-floor__soon", text: "即将开放" }) : icon("chevron", 14, "tw-floor__arrow")
  ])));
}

function drawGlass() {
  // SVG 仅负责玻璃装饰，七个原生按钮提供独立于绘图的键盘与触摸交互。
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 440 550");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "tw-glass__art");
  svg.innerHTML = `<defs>
    <linearGradient id="glassTop" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="var(--sh-accent-soft)" stop-opacity=".75"/><stop offset="1" stop-color="var(--sh-accent-fill)" stop-opacity=".08"/></linearGradient>
    <linearGradient id="glassSide" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--sh-accent-fill)" stop-opacity=".08"/><stop offset="1" stop-color="var(--sh-accent)" stop-opacity=".2"/></linearGradient>
    <linearGradient id="glassActive" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="var(--sh-accent-fill)" stop-opacity=".16"/><stop offset="1" stop-color="var(--sh-accent-fill)" stop-opacity=".4"/></linearGradient>
  </defs><ellipse cx="220" cy="469" rx="211" ry="57" fill="var(--sh-accent-soft)" opacity=".6"/>
  ${floors.map((floor, i) => `<g class="tw-glass__floor" data-glass-floor="${floor.no}" transform="translate(0 ${i * 54})">
    <path class="tw-glass__side" d="M8 84 220 164 432 84V98L220 178 8 98Z"/>
    <path class="tw-glass__top" d="M220 4 432 84Q435 87 430 89L220 168 10 89Q5 87 8 84Z"/>
    <path class="tw-glass__edge" d="M8 86 220 168 432 86M220 168V178"/>
  </g>`).reverse().join("")}`;
  svg.addEventListener("click", (event) => {
    const floor = event.target.closest("[data-glass-floor]");
    if (floor) selectFloor(floor.dataset.glassFloor);
  });
  const buttons = el("div", { class: "tw-decks", role: "group", "aria-label": "七层学习空间" }, floors.map((floor) =>
    floorButton(floor, "tw-deck", [el("span", { class: "tw-deck__label" }, [badge(floor), el("span", { text: floor.name })])])
  ));
  get("glassTower").replaceChildren(svg, buttons);
}

function progress(floor) {
  return el("div", { class: "tw-progress" }, [
    el("div", { class: "tw-progress__row" }, [el("span", { text: "学习进度" }), el("span", { text: pct(floor) })]),
    bar(floor.pct ?? 0, `${floor.name}学习进度`)
  ]);
}

function emptyState() {
  return el("span", { class: "tw-empty" }, [icon("folder", 32), el("span", { text: "即将开放" })]);
}

function detailRow(label, value, iconName, href) {
  return el(href ? "a" : "div", { class: "tw-detail-row", href: href || null }, [
    icon(iconName, 18), el("span", { class: "tw-detail-row__label", text: label }),
    el("span", { class: "tw-detail-row__value", text: value, title: value }), href ? icon("chevron", 14) : null
  ]);
}

function drawDetail() {
  const floor = floors.find((f) => f.no === selected);
  const nextHref = topicHref(floor.next, base) || (floor.next ? `../study/index.html#/topic/${encodeURIComponent(floor.next.id)}` : "");
  const actions = floor.overview ? [{ name: floor.name, homeUrl: floor.homeUrl }]
    : floor.subjects.filter((s) => s.open && s.homeUrl);
  get("detailPanel").replaceChildren(
    el("div", { class: "tw-detail-top" }, [el("span", { text: "当前楼层" }), badge(floor)]),
    el("div", { class: "tw-detail-title" }, [el("span", { class: "tw-detail-icon" }, [icon(floor.icon, 27)]), el("h2", { text: floor.name })]),
    ...(!floor.open ? [emptyState()] : [
      progress(floor),
      el("dl", { class: "tw-stat-grid" }, [["已掌握", "mastered", "check"], ["学习中", "learning", "clock"], ["共计", "total", "list"]].map(([label, key, ico]) =>
        el("div", {}, [icon(ico, 18), el("dt", { text: label }), el("dd", { text: count(floor, key) })])
      )),
      el("div", { class: "tw-detail-rows" }, [
        detailRow("今日到期复习", count(floor, "due"), "calendar", mistakesHref),
        detailRow("错题", count(floor, "mistakes", "道"), "alert", mistakesHref),
        detailRow("下一步学习", floor.next?.title || "无学习记录", "play", nextHref)
      ]),
      el("div", { class: "tw-actions" }, actions.map((action) => el("a", {
        class: "tw-enter", href: base + action.homeUrl, "aria-label": `进入该科目 ${action.name}`
      }, [actions.length > 1 ? el("span", { class: "tw-enter__subject", text: action.name }) : null, el("span", { text: "进入该科目" }), icon("arrowRight", 17)])))
    ])
  );
}

function cardRow(label, value) {
  return el("span", { class: "tw-card-row" }, [el("span", { text: label }), el("span", { text: value, title: value })]);
}

function drawCards() {
  get("subjectCards").replaceChildren(...floors.map((floor) => floorButton(floor, "tw-subject-card", [
    el("span", { class: "tw-subject-card__head" }, [el("span", { class: "tw-subject-icon" }, [icon(floor.icon, 22)]),
      el("span", { class: "tw-subject-card__title" }, [el("strong", { text: floor.name }), el("span", { class: `tw-status${floor.open ? "" : " tw-status--closed"}`, text: floor.state })])]),
    ...(!floor.open ? [emptyState()] : [el("span", { class: "tw-card-rows" }, [
      cardRow("掌握情况", pct(floor)), cardRow("今日到期复习", count(floor, "due")),
      cardRow("错题数量", count(floor, "mistakes", "道")), cardRow("下一步学习", floor.next?.title || "无学习记录")
    ])])
  ])));
}

function selectFloor(no) {
  selected = no;
  // 保留按钮 DOM，确保切换时键盘焦点不丢失。
  for (const group of document.querySelectorAll(".tw-main [role=group]")) {
    for (const button of group.querySelectorAll("button[data-floor]")) {
      const active = button.dataset.floor === no;
      button.setAttribute("aria-pressed", String(active));
      button.tabIndex = active ? 0 : -1;
    }
  }
  for (const glass of document.querySelectorAll("[data-glass-floor]")) glass.classList.toggle("is-active", glass.dataset.glassFloor === no);
  drawDetail();
}

function bindKeyboard() {
  for (const group of document.querySelectorAll(".tw-main [role=group]")) {
    group.addEventListener("keydown", (event) => {
      const button = event.target.closest("button[data-floor]");
      if (!button) return;
      const horizontal = group.id === "subjectCards" || (group.id === "floorList" && mobile.matches);
      const keys = horizontal ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
      let direction = keys.indexOf(event.key);
      if (group.id === "subjectCards" && direction < 0) direction = ["ArrowUp", "ArrowDown"].indexOf(event.key);
      if (direction < 0 && event.key !== "Home" && event.key !== "End") return;
      event.preventDefault();
      const buttons = [...group.querySelectorAll("button[data-floor]")];
      let index = buttons.indexOf(button);
      index = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (direction ? 1 : -1) + buttons.length) % buttons.length;
      const next = buttons[index];
      selectFloor(next.dataset.floor);
      next.focus({ preventScroll: true });
      if (horizontal) next.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
}

async function init() {
  get("towerIcon").append(icon("layers", 27));
  try {
    const model = await loadModel();
    const stats = buildTowerStats(model);
    floors = stats.floors;
    get("floorProgress").replaceChildren(
      el("div", { class: "tw-progress__row" }, [el("span", { text: "学习进度" }), el("span", { text: `${stats.activeFloors} / ${stats.floorCount}` })]),
      bar(stats.activeFloors / stats.floorCount * 100, "学习进度")
    );
    drawList();
    drawGlass();
    drawCards();
    selectFloor(selected);
    bindKeyboard();
  } catch (error) {
    get("detailPanel").replaceChildren(el("p", { class: "tw-load-empty", text: "无学习记录" }),
      el("a", { class: "tw-enter", href: "../study/index.html", text: "学习总控" }));
    console.warn("指挥塔", error);
  }
}

init();
