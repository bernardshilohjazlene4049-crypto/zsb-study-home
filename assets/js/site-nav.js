(function () {
  var script = document.currentScript;
  if (!script || document.documentElement.hasAttribute("data-site-nav")) return;
  document.documentElement.setAttribute("data-site-nav", "");
  var base = script.getAttribute("data-base") || "";
  var tone = script.getAttribute("data-tone") || "";
  var path = location.pathname;
  function inFolder(name) {
    return path.indexOf("/" + name + "/") !== -1;
  }
  var items = [
    ["首页", "index.html", !inFolder("gs") && !inFolder("jsj") && !inFolder("c") && !inFolder("yy") && !inFolder("wy") && !inFolder("study") && !inFolder("tower")],
    ["学习工作台", "study/index.html", inFolder("study")],
    ["学习指挥塔", "tower/index.html", inFolder("tower")],
    ["高等数学", "gs/index.html", inFolder("gs")],
    ["计算机基础", "jsj/index.html", inFolder("jsj")],
    ["C语言", "c/index.html", inFolder("c")],
    ["英语", "yy/index.html", inFolder("yy")],
    ["网页设计", "wy/index.html", inFolder("wy")]
  ];
  if (!document.querySelector('link[href$="assets/css/site-nav.css"]')) {
    var css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = base + "assets/css/site-nav.css";
    document.head.appendChild(css);
  }
  function fill(nav) {
    items.forEach(function (item) {
      var link = document.createElement("a");
      link.href = base + item[1];
      link.textContent = item[0];
      if (item[2]) link.setAttribute("aria-current", "page");
      nav.appendChild(link);
    });
    return nav;
  }
  var subnav = document.querySelector(".subnav");
  if (subnav) {
    items.slice(1, 3).forEach(function (item) {
      var present = false;
      subnav.querySelectorAll("a").forEach(function (link) {
        if (link.textContent.replace(/\s/g, "") === item[0]) present = true;
      });
      if (!present) {
        var link = document.createElement("a");
        link.href = base + item[1];
        link.textContent = item[0];
        if (item[2]) link.setAttribute("aria-current", "page");
        subnav.appendChild(link);
      }
    });
  }
  if (!document.querySelector(".nav-links") && !document.querySelector(".site-links-bar")) {
    var bar = fill(document.createElement("nav"));
    bar.className = "site-links site-links-bar" + (subnav ? "" : " site-links-show") + (tone === "dark" ? " site-links-dark" : "");
    bar.setAttribute("aria-label", "站点导航");
    var header = document.querySelector("header.topbar");
    if (header) header.after(bar);
    else document.body.insertBefore(bar, document.body.firstChild);
    var floating = document.querySelector('body > a[href="index.html"]');
    if (floating && getComputedStyle(floating).position === "fixed") {
      floating.style.top = "auto";
      floating.style.bottom = "calc(12px + env(safe-area-inset-bottom))";
    }
  }
  var footer = document.querySelector("footer");
  if (footer && !footer.querySelector(".site-links-foot")) {
    var foot = fill(document.createElement("nav"));
    foot.className = "site-links site-links-foot site-links-show" + (tone === "dark" ? " site-links-dark" : "");
    foot.setAttribute("aria-label", "页脚导航");
    footer.appendChild(foot);
  }
})();
