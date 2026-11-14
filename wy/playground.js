(function () {
  // 预览 iframe 是 sandbox="allow-scripts"（不开 allow-same-origin），浏览器不给 Web Storage；
  // 这里给预览注入一个只存在于本次运行内存里的 localStorage / sessionStorage，示例代码照常可用，
  // 也不会读写站点真实的存储。
  var STORAGE_SHIM = "<script>(function(){function m(){var d=Object.create(null);return{getItem:function(k){k=String(k);return k in d?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[String(k)]},clear:function(){d=Object.create(null)},key:function(i){var a=Object.keys(d);return i>=0&&i<a.length?a[i]:null},get length(){return Object.keys(d).length}}}[\"localStorage\",\"sessionStorage\"].forEach(function(n){try{window[n].length}catch(e){try{Object.defineProperty(window,n,{value:m(),configurable:true})}catch(_){}}})})();<\/script>";

  function withShim(doc) {
    if (/<head(\s[^>]*)?>/i.test(doc)) return doc.replace(/<head(\s[^>]*)?>/i, function (m) { return m + STORAGE_SHIM; });
    if (/<html(\s[^>]*)?>/i.test(doc)) return doc.replace(/<html(\s[^>]*)?>/i, function (m) { return m + STORAGE_SHIM; });
    return STORAGE_SHIM + doc;
  }

  function wrapHtml(src) {
    var t = String(src || "").trim();
    if (/<!doctype|<html[\s>]/i.test(t)) return withShim(t);
    return "<!doctype html><html><head>" + STORAGE_SHIM + "<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>body{font:14px/1.6 -apple-system,PingFang SC,sans-serif;margin:16px;color:#1D1D1F}h1,h2,h3{line-height:1.25}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 8px}a{color:#0071E3}</style></head><body>" + t + "</body></html>";
  }

  function runOne(box) {
    var ta = box.querySelector(".tryit-code");
    var frame = box.querySelector(".tryit-preview");
    if (!ta || !frame) return;
    frame.srcdoc = wrapHtml(ta.value);
  }

  function initOne(box) {
    if (box.dataset.ready) return;
    box.dataset.ready = "1";
    var ta = box.querySelector(".tryit-code");
    if (ta && !box.dataset.original) box.dataset.original = ta.value;
    if (ta && !ta.hasAttribute("aria-label")) ta.setAttribute("aria-label", "代码");
    var runBtn = box.querySelector(".tryit-run");
    var resetBtn = box.querySelector(".tryit-reset");
    if (runBtn) runBtn.addEventListener("click", function () { runOne(box); });
    if (resetBtn) resetBtn.addEventListener("click", function () {
      if (ta) ta.value = box.dataset.original || "";
      runOne(box);
    });
    if (!document.body.classList.contains("wy-points-page")) runOne(box);
  }

  function initAll(root) {
    (root || document).querySelectorAll(".tryit").forEach(initOne);
  }

  function initQuiz(root) {
    (root || document).querySelectorAll(".quiz").forEach(function (quiz) {
      if (quiz.dataset.ready) return;
      quiz.dataset.ready = "1";
      var check = quiz.querySelector(".quiz-check");
      var reset = quiz.querySelector(".quiz-reset");
      if (check) check.addEventListener("click", function () {
        quiz.querySelectorAll(".qitem").forEach(function (item) {
          var ans = String(item.dataset.answer || "").toUpperCase();
          var picked = item.querySelector("input[type=radio]:checked");
          item.classList.remove("is-right", "is-wrong");
          if (!picked) {
            item.classList.add("is-wrong");
            var fb0 = item.querySelector(".qfb");
            if (fb0) fb0.textContent = "请先选择一个选项。";
            return;
          }
          var val = String(picked.value || "").toUpperCase();
          if (val === ans) {
            item.classList.add("is-right");
            var fb1 = item.querySelector(".qfb");
            if (fb1) fb1.textContent = "正确。" + (item.dataset.explain || "");
          } else {
            item.classList.add("is-wrong");
            var fb2 = item.querySelector(".qfb");
            if (fb2) fb2.textContent = "不对，参考答案是 " + ans + "。" + (item.dataset.explain || "");
          }
        });
      });
      if (reset) reset.addEventListener("click", function () {
        quiz.querySelectorAll(".qitem").forEach(function (item) {
          item.classList.remove("is-right", "is-wrong");
          item.querySelectorAll("input[type=radio]").forEach(function (r) { r.checked = false; });
          var fb = item.querySelector(".qfb");
          if (fb) fb.textContent = "";
        });
      });
    });
  }

  function initTocToggle() {
    var btn = document.querySelector(".mobile-toc-btn");
    var side = document.querySelector(".wy-side");
    if (!btn || !side) return;
    btn.addEventListener("click", function () {
      var open = side.classList.toggle("is-open-mobile");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? "收起目录" : "章节目录";
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initAll(document);
    initQuiz(document);
    // 横向可滚动的代码块需要能用键盘聚焦
    document.querySelectorAll("pre").forEach(function (pre) {
      if (pre.scrollWidth > pre.clientWidth && !pre.hasAttribute("tabindex")) pre.setAttribute("tabindex", "0");
    });
    initTocToggle();
  });
})();
