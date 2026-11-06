(function () {
  var script = document.currentScript;
  if (!script || document.documentElement.hasAttribute("data-site-nav")) return;
  document.documentElement.setAttribute("data-site-nav", "");
  var base = script.getAttribute("data-base") || "";
  var path = location.pathname;

  function inFolder(name) {
    return path.indexOf("/" + name + "/") !== -1;
  }

  if (!document.querySelector('link[href$="site-unify.css"]')) {
    var css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = base + "assets/css/site-unify.css";
    document.head.appendChild(css);
  }

  var onHome = !inFolder("gs") && !inFolder("jsj") && !inFolder("c") && !inFolder("yy") && !inFolder("wy") && !inFolder("study") && !inFolder("tower");
  var main = [
    ["首页", "index.html", onHome],
    ["科目索引", "index.html#subjects", false],
    ["学习工作台", "study/index.html", inFolder("study")],
    ["学习指挥塔", "tower/index.html", inFolder("tower")]
  ];
  var subjects = [
    ["英语", "yy/index.html", inFolder("yy"), true],
    ["高等数学", "gs/index.html", inFolder("gs"), true],
    ["计算机基础", "jsj/index.html", inFolder("jsj"), true],
    ["C 语言", "c/index.html", inFolder("c"), true],
    ["数据库", "", false, false],
    ["网页设计", "wy/index.html", inFolder("wy"), true],
    ["计算机网络", "", false, false]
  ];

  function mark(node, on) {
    if (!on) return;
    node.classList.add("is-active");
    node.setAttribute("aria-current", "page");
  }

  function buildHeader() {
    var header = document.createElement("header");
    header.className = "site-header";
    var inner = document.createElement("div");
    inner.className = "site-header__inner";
    var brand = document.createElement("a");
    brand.className = "site-brand";
    brand.href = base + "index.html";
    var markNode = document.createElement("span");
    markNode.className = "site-brand__mark";
    markNode.setAttribute("aria-hidden", "true");
    markNode.textContent = "书";
    var name = document.createElement("span");
    name.className = "site-brand__name";
    name.textContent = "辽宁专升本 · 计算机类";
    brand.append(markNode, name);
    var nav = document.createElement("nav");
    nav.className = "site-nav";
    nav.setAttribute("aria-label", "主导航");
    main.forEach(function (item) {
      var link = document.createElement("a");
      link.className = "site-nav__link";
      link.href = base + item[1];
      link.textContent = item[0];
      mark(link, item[2]);
      nav.appendChild(link);
    });
    inner.append(brand, nav);
    header.appendChild(inner);
    return header;
  }

  function buildSubnav() {
    var nav = document.createElement("nav");
    nav.className = "site-subnav";
    nav.setAttribute("aria-label", "科目导航");
    var inner = document.createElement("div");
    inner.className = "site-subnav__inner";
    subjects.forEach(function (item) {
      if (item[3]) {
        var link = document.createElement("a");
        link.className = "site-subnav__link";
        link.href = base + item[1];
        link.textContent = item[0];
        mark(link, item[2]);
        inner.appendChild(link);
        return;
      }
      var span = document.createElement("span");
      span.className = "site-subnav__link";
      span.setAttribute("aria-disabled", "true");
      span.textContent = item[0];
      var badge = document.createElement("span");
      badge.className = "badge badge--warning";
      badge.textContent = "即将开放";
      badge.style.marginLeft = "6px";
      span.appendChild(badge);
      inner.appendChild(span);
    });
    nav.appendChild(inner);
    return nav;
  }

  if (!document.querySelector(".site-header")) {
    var header = buildHeader();
    var subnav = buildSubnav();
    var old = document.querySelector("header.topbar");
    if (old) old.replaceWith(header, subnav);
    else {
      document.body.insertBefore(subnav, document.body.firstChild);
      document.body.insertBefore(header, subnav);
    }
  }

  var footer = document.querySelector("footer");
  if (footer && !footer.querySelector(".site-footer__inner")) {
    footer.classList.add("site-footer");
    var foot = document.createElement("div");
    foot.className = "site-footer__inner";
    var label = document.createElement("span");
    label.textContent = "辽宁专升本 · 计算机类学习站";
    var links = document.createElement("nav");
    links.className = "site-footer__links";
    links.setAttribute("aria-label", "页脚导航");
    [["首页", "index.html"], ["学习工作台", "study/index.html"], ["学习指挥塔", "tower/index.html"]].forEach(function (item) {
      var link = document.createElement("a");
      link.href = base + item[1];
      link.textContent = item[0];
      links.appendChild(link);
    });
    foot.append(label, links);
    footer.replaceChildren(foot);
  }

  function add(selector, names) {
    document.querySelectorAll(selector).forEach(function (el) {
      names.split(/\s+/).forEach(function (name) {
        if (name) el.classList.add(name);
      });
    });
  }

  add("main > .shell", "site-container site-main");
  add("section.hero", "page-hero");
  add("section.hero > h1, section.page-hero > h1", "page-title");
  add("p.lead", "page-subtitle");
  add(".chips", "page-meta");
  add("section.block", "section");
  add(".sec-head h2", "section-title");
  add(".vcard", "content-card video-card");
  add(".vthumb", "media-frame");
  add(".vbody", "content-card__body");
  add(".vbody h3", "content-card__title");
  add(".qcard", "question-card");
  add(".qcard .stem", "question-stem");
  add("details.ans", "answer-panel");
  add("pre", "code-block");
  add(".map-card, .link-card", "content-card");
  add(".grid.g3", "card-grid");
  add(".grid.g2", "card-grid card-grid--2");
  add(".tag", "badge");
})();
