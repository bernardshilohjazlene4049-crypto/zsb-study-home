/* 37-4 平面方程可视化（GPT viz-sample 移植）。复习记录读写 /study 同一 IndexedDB：
   评分按钮由 page-study.js 写库，本脚本只读历史并在 zsb:attempt-saved 后刷新。 */
(function () {
  "use strict";
  var script = document.currentScript;
  var root = new URL("../../", script.src);
  var box = document.getElementById("viz-37-4");
  if (!box) return;
  var $ = function (s) { return box.querySelector(s); };
  var svgNS = "http://www.w3.org/2000/svg", scene = $(".vz-scene");
  var S = function (tag, attrs, text) { var el = document.createElementNS(svgNS, tag); Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, String(attrs[k])); }); if (text !== undefined) el.textContent = text; return el; };
  var add = function (parent, tag, attrs, txt) { var node = S(tag, attrs, txt); parent.appendChild(node); return node; };
  var g = function (a, b, c) { return { x: a, y: b, z: c }; };
  var plus = function (a, b) { return g(a.x + b.x, a.y + b.y, a.z + b.z); };
  var times = function (v, k) { return g(v.x * k, v.y * k, v.z * k); };
  var unit = function (v) { return times(v, 1 / Math.hypot(v.x, v.y, v.z)); };
  var normal = g(3, -2, 1), u = unit(g(2, 3, 0)), v = unit(g(-3, 2, 13));
  var step = 0, yaw = .68, pitch = .38;
  function camera(p) { var xx = p.x * Math.cos(yaw) - p.y * Math.sin(yaw), depth = p.x * Math.sin(yaw) + p.y * Math.cos(yaw), yy = p.z * Math.cos(pitch) - depth * Math.sin(pitch); return { x: 340 + xx * 34, y: 239 - yy * 34, d: depth * Math.cos(pitch) + p.z * Math.sin(pitch) }; }
  function coords(p) { var q = camera(p); return q.x.toFixed(2) + "," + q.y.toFixed(2); }
  function plane(center, amount) { amount = amount || 3.15; return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(function (ab) { return plus(center, plus(times(u, ab[0] * amount), times(v, ab[1] * amount))); }); }
  function draw() {
    scene.replaceChildren();
    var defs = add(scene, "defs");
    var marker = add(defs, "marker", { id: "vz374-head", markerWidth: 9, markerHeight: 9, refX: 7.5, refY: 4.5, orient: "auto", markerUnits: "strokeWidth" });
    add(marker, "path", { d: "M 0 0 L 9 4.5 L 0 9 z", fill: "#344c75" });
    add(scene, "rect", { x: 0, y: 0, width: 680, height: 450, fill: "#fff" });
    var axis = add(scene, "g");
    [["x", g(1, 0, 0)], ["y", g(0, 1, 0)], ["z", g(0, 0, 1)]].forEach(function (row) {
      var a = camera(times(row[1], -5.15)), b = camera(times(row[1], 5.15));
      add(axis, "line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "#d3dae4", "stroke-width": "1.3", "stroke-dasharray": "4 6" });
      add(axis, "text", { x: b.x + 8, y: b.y - 6, "font-style": "italic", fill: "#9aa5b5" }, row[0]);
    });
    var planes = [{ corner: plane(g(0, 0, 0)), fill: "#527ebc", stroke: "#4575b3", opacity: .18, target: false }];
    if (step >= 2) planes.push({ corner: plane(g(1, 2, 3)), fill: "#31a0a6", stroke: "#24979e", opacity: .23, target: true });
    var depthOf = function (pl) { return pl.corner.reduce(function (s, p) { return s + camera(p).d; }, 0); };
    planes.sort(function (a, b) { return depthOf(a) - depthOf(b); });
    planes.forEach(function (pl) {
      var group = add(scene, "g");
      add(group, "polygon", { points: pl.corner.map(coords).join(" "), fill: pl.fill, "fill-opacity": pl.opacity, stroke: pl.stroke, "stroke-width": 2, "stroke-linejoin": "round" });
      var origin = pl.target ? g(1, 2, 3) : g(0, 0, 0);
      var loc = function (aa, bb) { return plus(origin, plus(times(u, aa), times(v, bb))); };
      for (var t = -2; t <= 2; t++) {
        var k = t * .75;
        [[camera(loc(-3.15, k)), camera(loc(3.15, k))], [camera(loc(k, -3.15)), camera(loc(k, 3.15))]].forEach(function (ab) {
          add(group, "line", { x1: ab[0].x, y1: ab[0].y, x2: ab[1].x, y2: ab[1].y, stroke: pl.stroke, "stroke-opacity": .12, "stroke-width": 1 });
        });
      }
      var la = camera(plus(origin, plus(times(u, -1.65), times(v, 2.7))));
      add(group, "text", { x: la.x, y: la.y, fill: pl.target ? "#1d858c" : "#3769ab", "font-weight": 650 }, pl.target ? (step >= 3 ? "3x-2y+z=2" : "") : "3x-2y+z=0");
    });
    if (step >= 1) {
      var a = camera(g(0, 0, 0)), b = camera(times(normal, .85));
      add(scene, "line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "#344c75", "stroke-width": 3.1, "stroke-linecap": "round", "marker-end": "url(#vz374-head)" });
      add(scene, "text", { x: b.x + 11, y: b.y - 12, fill: "#344c75", "font-weight": 670 }, step >= 2 ? "n=(3,-2,1)" : "n");
    }
    if (step >= 2) {
      var p = camera(g(1, 2, 3));
      add(scene, "circle", { cx: p.x, cy: p.y, r: 11, fill: "#e2a253", "fill-opacity": .16 });
      add(scene, "circle", { cx: p.x, cy: p.y, r: 5.2, fill: "#de963b", stroke: "white", "stroke-width": 2.1 });
      add(scene, "text", { x: p.x + 11, y: p.y - 12, fill: "#996321", "font-weight": 640 }, "(1,2,3)");
    }
    scene.setAttribute("aria-label", "可旋转的三维空间图：已知平面" + (step >= 1 ? "、法向量 n" : "") + (step >= 2 ? "、点 (1,2,3)、所求平行平面" : ""));
  }
  function update() {
    box.querySelectorAll(".vz-step").forEach(function (el) { var n = Number(el.dataset.step); el.classList.toggle("visible", n <= step); el.classList.toggle("active", n === step); el.classList.toggle("done", n < step); });
    $(".vz-count").textContent = step + " / 3";
    $("[data-vz=prev]").disabled = step === 0;
    var next = $("[data-vz=next]"); next.disabled = step === 3; next.innerHTML = step === 3 ? "已完成" : '下一步 <span aria-hidden="true">→</span>';
    $("[data-legend=normal]").hidden = step < 1; $("[data-legend=point]").hidden = step < 2; $("[data-legend=target]").hidden = step < 2;
    draw();
  }
  $("[data-vz=next]").addEventListener("click", function () { if (step < 3) { step++; update(); } });
  $("[data-vz=prev]").addEventListener("click", function () { if (step > 0) { step--; update(); } });
  $("[data-vz=left]").addEventListener("click", function () { yaw -= .25; draw(); });
  $("[data-vz=right]").addEventListener("click", function () { yaw += .25; draw(); });
  $("[data-vz=reset]").addEventListener("click", function () { yaw = .68; pitch = .38; draw(); });
  var drag = null;
  scene.addEventListener("pointerdown", function (e) { if (e.button !== 0 && e.pointerType === "mouse") return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; scene.setPointerCapture(e.pointerId); scene.classList.add("dragging"); });
  scene.addEventListener("pointermove", function (e) { if (!drag || drag.id !== e.pointerId) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; yaw += dx * .008; pitch = Math.max(-1.24, Math.min(1.24, pitch + dy * .006)); draw(); });
  function stop(e) { if (drag && e.pointerId === drag.id) { drag = null; scene.classList.remove("dragging"); } }
  scene.addEventListener("pointerup", stop); scene.addEventListener("pointercancel", stop); scene.addEventListener("lostpointercapture", stop);
  scene.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); yaw += e.key === "ArrowLeft" ? -.18 : .18; draw(); }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); pitch = Math.max(-1.24, Math.min(1.24, pitch + (e.key === "ArrowUp" ? .12 : -.12))); draw(); }
  });
  update();

  // 复习记录：只显示真实自评，不生成未来掌握度。
  var QID = "page:gs45:37-4", levels = { again: 0, fuzzy: 1, good: 2 }, names = { again: "不会", fuzzy: "模糊", good: "会" };
  var dayLabel = function (iso) { var d = new Date(iso); return d.getFullYear() + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getDate()).padStart(2, "0"); };
  function plot(entries) {
    var chart = $(".vz-chart svg"); chart.replaceChildren();
    var left = 64, right = 669, top = 22, bottom = 141;
    var yFor = function (r) { return bottom - (levels[r] / 2) * (bottom - top); };
    [["会", top], ["模糊", (top + bottom) / 2], ["不会", bottom]].forEach(function (row) { add(chart, "line", { x1: left, y1: row[1], x2: right, y2: row[1], stroke: "#edf0f5", "stroke-width": 1 }); add(chart, "text", { x: 12, y: row[1] + 4, fill: "#7e8a99" }, row[0]); });
    var pts = entries.slice(-12), at = pts.map(function (e) { return Date.parse(e.at); }), min = at[0], max = at[at.length - 1];
    var X = function (i) { return pts.length === 1 ? (left + right) / 2 : (max === min ? left + (right - left) * i / (pts.length - 1) : left + ((at[i] - min) / (max - min)) * (right - left)); };
    var xy = pts.map(function (e, i) { return [X(i), yFor(e.rating)]; });
    if (xy.length > 1) add(chart, "polyline", { points: xy.map(function (p) { return p.join(","); }).join(" "), fill: "none", stroke: "#4b79b7", "stroke-width": 2.5, "stroke-linecap": "round", "stroke-linejoin": "round" });
    xy.forEach(function (p, i) { add(chart, "circle", { cx: p[0], cy: p[1], r: 5.5, fill: "#4878b5", stroke: "white", "stroke-width": 2 }); if (pts.length <= 6 || i === 0 || i === pts.length - 1) { var d = new Date(at[i]); add(chart, "text", { x: p[0], y: 172, "text-anchor": "middle", fill: "#778398" }, (d.getMonth() + 1) + "/" + d.getDate()); } });
    chart.setAttribute("aria-label", "实际掌握记录，按时间顺序：" + pts.map(function (e) { return dayLabel(e.at) + " " + names[e.rating]; }).join("；"));
  }
  var api = null;
  function refresh() {
    if (!api) api = import(new URL("assets/js/bridge-api.js", root).href);
    return api.then(function (mod) { return mod.pageQuestionHistory(QID); }).then(function (h) {
      var entries = h.attempts.filter(function (a) { return levels.hasOwnProperty(a.response && a.response.rating); }).map(function (a) { return { at: a.submitted_at, rating: a.response.rating }; });
      var hist = $(".vz-history"); hist.hidden = !entries.length; if (!entries.length) return;
      var m = h.mistake, due = m && m.status === "active" && m.next_review_at;
      $("[data-sum=next]").parentElement.hidden = !due; $("[data-sum=gap]").parentElement.hidden = !due;
      if (due) {
        $("[data-sum=next]").textContent = dayLabel(m.next_review_at);
        $("[data-sum=gap]").textContent = Math.max(1, Math.round((Date.parse(m.next_review_at) - Date.parse(m.last_reviewed_at)) / 86400000)) + " 天";
      }
      $("[data-sum=count]").textContent = entries.length + " 次";
      var chips = $(".vz-chips"); chips.replaceChildren();
      entries.slice(-5).reverse().forEach(function (e) { var s = document.createElement("span"); s.textContent = dayLabel(e.at) + " · " + names[e.rating]; chips.appendChild(s); });
      plot(entries);
      $(".vz-err").hidden = true;
    }).catch(function (error) { console.warn(error); var p = $(".vz-err"); p.hidden = false; p.textContent = "本地记录无法读取"; });
  }
  document.addEventListener("zsb:attempt-saved", function (e) { if (e.detail && e.detail.questionId === QID) refresh(); });
  document.addEventListener("zsb:attempt-failed", function (e) { if (e.detail && e.detail.questionId === QID) { var p = $(".vz-err"); p.hidden = false; p.textContent = "本地记录无法保存，请检查浏览器存储权限"; } });
  refresh();
})();
