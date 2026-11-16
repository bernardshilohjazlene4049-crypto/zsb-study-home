(function () {
  // 预览 iframe 是 sandbox="allow-scripts"（不开 allow-same-origin），浏览器不给 Web Storage；
  // 这里给预览注入一个只存在于本次运行内存里的 localStorage / sessionStorage，示例代码照常可用，
  // 也不会读写站点真实的存储。
  var STORAGE_SHIM = "<script>(function(){function m(){var d=Object.create(null);return{getItem:function(k){k=String(k);return k in d?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[String(k)]},clear:function(){d=Object.create(null)},key:function(i){var a=Object.keys(d);return i>=0&&i<a.length?a[i]:null},get length(){return Object.keys(d).length}}}[\"localStorage\",\"sessionStorage\"].forEach(function(n){try{window[n].length}catch(e){try{Object.defineProperty(window,n,{value:m(),configurable:true})}catch(_){}}})})();<\/script>";
  var runSerial = 0;

  function consoleBridge(runId) {
    return "<script>(function(){var id=" + JSON.stringify(runId) + ";function text(v){if(typeof v==='string')return v;try{return JSON.stringify(v)}catch(e){return String(v)}}function send(level,args){try{parent.postMessage({source:'zsb-playground',runId:id,type:'console',level:level,text:Array.prototype.map.call(args,text).join(' ')},'*')}catch(e){}}['log','info','warn','error'].forEach(function(level){var original=console[level];console[level]=function(){send(level,arguments);if(original)original.apply(console,arguments)}});window.addEventListener('error',function(e){send('error',[e.message||'脚本运行错误'+(e.lineno?'（第 '+e.lineno+' 行）':'')])});window.addEventListener('unhandledrejection',function(e){send('error',['未处理的 Promise 错误：'+text(e.reason)])});window.addEventListener('load',function(){send('done',['运行完成'])});})();<\/script>";
  }

  function withShim(doc, runId) {
    var injected = STORAGE_SHIM + consoleBridge(runId);
    if (/<head(\s[^>]*)?>/i.test(doc)) return doc.replace(/<head(\s[^>]*)?>/i, function (m) { return m + injected; });
    if (/<html(\s[^>]*)?>/i.test(doc)) return doc.replace(/<html(\s[^>]*)?>/i, function (m) { return m + injected; });
    return injected + doc;
  }

  function wrapHtml(src, runId) {
    var t = String(src || "").trim();
    if (/<!doctype|<html[\s>]/i.test(t)) return withShim(t, runId);
    return "<!doctype html><html><head>" + STORAGE_SHIM + consoleBridge(runId) + "<meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>body{font:14px/1.6 -apple-system,PingFang SC,sans-serif;margin:16px;color:#1D1D1F}h1,h2,h3{line-height:1.25}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 8px}a{color:#0071E3}</style></head><body>" + t + "</body></html>";
  }

  function consoleFor(box) {
    var panel = box.querySelector(".tryit-console");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.className = "tryit-console";
    panel.setAttribute("aria-label", "示例运行输出");
    panel.setAttribute("aria-live", "polite");
    var head = document.createElement("div");
    head.className = "tryit-console__head";
    head.textContent = "运行输出";
    var body = document.createElement("div");
    body.className = "tryit-console__body";
    panel.append(head, body);
    box.append(panel);
    return panel;
  }

  function writeConsole(box, text, level) {
    var body = consoleFor(box).querySelector(".tryit-console__body");
    if (level === "clear") {
      body.replaceChildren();
      return;
    }
    var line = document.createElement("p");
    line.className = "tryit-console__line is-" + (level || "info");
    line.textContent = text;
    body.append(line);
  }

  function copyCode(box) {
    var ta = box.querySelector(".tryit-code");
    if (!ta) return;
    var write = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(ta.value)
      : Promise.reject(new Error("clipboard unavailable"));
    write.then(function () {
      writeConsole(box, "代码已复制。", "info");
    }).catch(function () {
      ta.focus();
      ta.select();
      try { document.execCommand("copy"); writeConsole(box, "代码已复制。", "info"); }
      catch (e) { writeConsole(box, "复制失败，请手动选择代码。", "error"); }
    });
  }

  function runOne(box) {
    var ta = box.querySelector(".tryit-code");
    var frame = box.querySelector(".tryit-preview");
    if (!ta || !frame) return;
    var runId = "run-" + (++runSerial);
    frame.dataset.runId = runId;
    consoleFor(box).dataset.state = "running";
    writeConsole(box, "", "clear");
    writeConsole(box, "正在运行示例…", "info");
    frame.srcdoc = wrapHtml(ta.value, runId);
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
      writeConsole(box, "", "clear");
      runOne(box);
    });
    var actions = box.querySelector(".tryit-actions");
    if (actions && !actions.querySelector(".tryit-copy")) {
      var copy = document.createElement("button");
      copy.type = "button";
      copy.className = "btn btn-secondary tryit-copy";
      copy.textContent = "复制代码";
      copy.addEventListener("click", function () { copyCode(box); });
      actions.append(copy);
    }
    consoleFor(box);
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
    window.addEventListener("message", function (event) {
      var data = event.data || {};
      if (data.source !== "zsb-playground" || !data.runId) return;
      var frame = document.querySelector('.tryit-preview[data-run-id="' + String(data.runId).replace(/"/g, '\\"') + '"]');
      var box = frame && frame.closest(".tryit");
      if (!box || event.source !== frame.contentWindow) return;
      if (data.type === "done") {
        var panel = consoleFor(box);
        panel.dataset.state = "done";
        var body = panel.querySelector(".tryit-console__body");
        if (body.children.length === 1 && body.firstElementChild.textContent === "正在运行示例…") {
          body.firstElementChild.textContent = "运行完成，没有控制台输出。";
        }
        return;
      }
      if (data.type === "console") {
        var current = consoleFor(box).querySelector(".tryit-console__body");
        if (current.children.length === 1 && current.firstElementChild.textContent === "正在运行示例…") current.replaceChildren();
        writeConsole(box, String(data.text || ""), data.level || "info");
      }
    });
    initAll(document);
    initQuiz(document);
    // 横向可滚动的代码块需要能用键盘聚焦
    document.querySelectorAll("pre").forEach(function (pre) {
      if (pre.scrollWidth > pre.clientWidth && !pre.hasAttribute("tabindex")) pre.setAttribute("tabindex", "0");
    });
    initTocToggle();
  });
})();
