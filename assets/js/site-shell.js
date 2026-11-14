/* 全站外壳：统一顶栏（桌面）/ 底部标签栏（手机），并按页面类型挂载首页、科目入口、讲义三栏等模块。
 * 只改外壳、导航和布局；讲义正文不改动。页面在 <head> 同步引入本文件。 */
(function () {
  "use strict";
  var d = document;
  var script = d.currentScript;
  if (!script || d.documentElement.hasAttribute("data-shell")) return;
  d.documentElement.setAttribute("data-shell", "");
  d.documentElement.classList.add("shell-js");

  var ROOT = new URL("../../", script.src);
  var here = new URL(location.href);
  var rel = decodeURIComponent(here.pathname).slice(decodeURIComponent(ROOT.pathname).length);
  if (rel === "" || /\/$/.test(rel)) rel += "index.html";

  var ICONS = {
    home: '<path d="M3.5 10.2 12 3.8l8.5 6.4V20a1 1 0 0 1-1 1h-5v-6.2h-5V21h-5a1 1 0 0 1-1-1z"/>',
    layers: '<path d="m12 3.5 8.5 4.6L12 12.7 3.5 8.1z"/><path d="m3.5 12 8.5 4.6 8.5-4.6"/><path d="m3.5 15.9 8.5 4.6 8.5-4.6"/>',
    tower: '<circle cx="12" cy="12" r="2.2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
    chart: '<path d="M4 20h16"/><path d="M7 16v-4M12 16V7M17 16v-6"/>',
    book: '<path d="M12 6.5C10.3 5.2 7.9 4.6 4 4.8v13.5c3.9-.2 6.3.4 8 1.7 1.7-1.3 4.1-1.9 8-1.7V4.8c-3.9-.2-6.3.4-8 1.7z"/><path d="M12 6.5V20"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.6 15.6 4.9 4.9"/>'
  };
  function svg(name, size) {
    return '<svg width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONS[name] + "</svg>";
  }

  var NAV = [
    { key: "home", label: "首页", short: "首页", href: "index.html", icon: "home" },
    { key: "study", label: "学习工作台", short: "工作台", href: "study/index.html", icon: "layers" },
    { key: "tower", label: "指挥塔", short: "指挥塔", href: "tower/index.html", icon: "tower" },
    { key: "overview", label: "学习总览", short: "总览", href: "study/overview.html", icon: "chart" },
    { key: "mistakes", label: "错题与复习", short: "错题复习", href: "study/index.html#/mistakes", icon: "book" },
    { key: "search", label: "搜索", short: "搜索", href: "search.html", icon: "search", desktopOnly: true }
  ];

  function activeKey() {
    if (rel === "index.html") return "home";
    if (rel === "search.html") return "search";
    if (rel.indexOf("tower/") === 0) return "tower";
    if (rel === "study/overview.html") return "overview";
    if (rel === "study/index.html") return /^#\/mistakes/.test(location.hash) ? "mistakes" : "study";
    return "";
  }

  function link(item, cls, withShort) {
    return '<a class="' + cls + '" data-shell-nav="' + item.key + '" href="' + new URL(item.href, ROOT).href.replace(ROOT.href, base()) + '">' +
      '<span class="' + cls + '__icon">' + svg(item.icon) + "</span>" +
      '<span class="' + cls + '__label">' + (withShort ? item.short : item.label) + "</span></a>";
  }

  // 站点根的相对路径（例如 "../"），保证本地和 /zsb-study-home/ 下都能用。
  function base() {
    var depth = rel.split("/").length - 1;
    var out = "";
    for (var i = 0; i < depth; i++) out += "../";
    return out;
  }

  function markActive() {
    var key = activeKey();
    var nodes = d.querySelectorAll("[data-shell-nav]");
    for (var i = 0; i < nodes.length; i++) {
      var on = nodes[i].getAttribute("data-shell-nav") === key;
      nodes[i].classList.toggle("is-active", on);
      if (on) nodes[i].setAttribute("aria-current", "page");
      else nodes[i].removeAttribute("aria-current");
    }
  }

  function buildHeader() {
    var header = d.createElement("header");
    header.className = "site-header shell-header";
    header.innerHTML =
      '<div class="shell-header__inner">' +
        '<a class="shell-brand" href="' + base() + 'index.html">' +
          '<span class="shell-brand__mark" aria-hidden="true"></span>' +
          '<span class="shell-brand__name">辽宁专升本 · 计算机类学习站</span>' +
        "</a>" +
        '<nav class="shell-nav" aria-label="全站导航">' + NAV.map(function (n) { return link(n, "shell-nav__link"); }).join("") + "</nav>" +
        '<a class="shell-header__search" data-shell-nav="search" href="' + base() + 'search.html" aria-label="搜索">' + svg("search", 20) + "</a>" +
      "</div>";
    return header;
  }

  function buildTabbar() {
    var nav = d.createElement("nav");
    nav.className = "shell-tabbar";
    nav.setAttribute("aria-label", "全站导航（底部）");
    nav.innerHTML = NAV.filter(function (n) { return !n.desktopOnly; }).map(function (n) { return link(n, "shell-tab", true); }).join("");
    return nav;
  }

  function mountChrome() {
    var old = d.querySelector(".site-header:not(.shell-header)") || d.querySelector("header.topbar");
    var header = buildHeader();
    if (old) {
      // 顶栏里的阅读进度条等非导航部件保留下来。
      var keep = old.querySelectorAll(":scope > .reading-progress");
      for (var i = 0; i < keep.length; i++) header.appendChild(keep[i]);
      old.replaceWith(header);
    } else {
      var shell = d.querySelector(".site-shell");
      (shell || d.body).insertBefore(header, (shell || d.body).firstChild);
    }
    var extra = d.querySelectorAll(".site-header:not(.shell-header)");
    for (var j = 0; j < extra.length; j++) extra[j].remove();
    d.body.appendChild(buildTabbar());
    var footer = d.querySelector("footer.site-footer");
    if (footer && !footer.textContent.trim()) {
      footer.innerHTML = '<div class="site-footer__inner"><span>辽宁专升本 · 计算机类学习站</span></div>';
    }
    markActive();
    window.addEventListener("hashchange", markActive);
  }

  var KIND = (function () {
    if (rel === "index.html") return "home";
    if (/^(gs|yy|jsj|c|wy)\/index\.html$/.test(rel)) return "subject";
    if (/^(gs\/gs1|gs\/gs45|yy\/yy5|jsj\/jsj1|jsj\/ppt5)\.html$/.test(rel)) return "lecture";
    if (/^wy\/(html|html5|css|js)\/[^/]+\.html$/.test(rel) && !/\/index\.html$/.test(rel)) return "lecture";
    if (/^wy\/ch[12]\/[^/]+\.html$/.test(rel)) return "lecture";
    if (/^wy\/(html|html5|css|js|examples|reference)\/index\.html$/.test(rel)) return "lecture";
    if (rel === "study/graph.html") return "graph";
    if (rel === "study/overview.html") return "overview";
    return "";
  })();
  d.documentElement.setAttribute("data-shell-kind", KIND || "plain");

  window.ZSBShell = { root: ROOT.href, rel: rel, base: base(), kind: KIND, svg: svg };

  function start() {
    mountChrome();
    if (!KIND) return;
    import(new URL("assets/js/shell/" + KIND + ".js", ROOT).href)
      .then(function (m) { return m.mount(window.ZSBShell); })
      .catch(function (error) {
        d.documentElement.classList.add("shell-failed");
        if (window.console) console.warn("外壳模块加载失败", error);
      });
  }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", start);
  else start();
})();
