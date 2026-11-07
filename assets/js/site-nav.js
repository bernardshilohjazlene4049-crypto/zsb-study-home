(function () {
  var script = document.currentScript;
  if (!script || document.documentElement.hasAttribute("data-site-nav")) return;
  document.documentElement.setAttribute("data-site-nav", "");
  var base = script.getAttribute("data-base") || "";
  var path = location.pathname;
  var navIcons = {
    "首页": '<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
    "科目索引": '<path d="m3 6 9-3 9 3v13l-9-3-9 3z"/><path d="M12 3v13"/>',
    "学习工作台": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
    "学习指挥塔": '<path d="M4 21h16M6 21V7l6-4 6 4v14M9 12h6M9 16h6"/>'
  };

  function navIcon(label) {
    var wrap = document.createElement("span");
    wrap.className = "site-nav__icon";
    wrap.setAttribute("aria-hidden", "true");
    var el = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    el.setAttribute("viewBox", "0 0 24 24");
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", "currentColor");
    el.setAttribute("stroke-width", "1.8");
    el.innerHTML = navIcons[label];
    wrap.appendChild(el);
    return wrap;
  }

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
    nav.className = "site-nav site-nav--compact";
    nav.setAttribute("aria-label", "全站导航");
    main.forEach(function (item) {
      var link = document.createElement("a");
      link.className = "site-nav__link";
      link.href = base + item[1];
      link.setAttribute("aria-label", item[0]);
      var label = document.createElement("span");
      label.className = "site-nav__label";
      label.textContent = item[0];
      link.append(navIcon(item[0]), label);
      mark(link, item[2]);
      nav.appendChild(link);
    });
    inner.append(brand, nav);
    header.appendChild(inner);
    return header;
  }

  if (!document.querySelector(".site-header")) {
    var header = buildHeader();
    var old = document.querySelector("header.topbar");
    var shell = document.querySelector(".site-shell");
    if (old) old.replaceWith(header);
    else if (shell) shell.insertBefore(header, shell.firstChild);
    else document.body.insertBefore(header, document.body.firstChild);
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
