(function () {
  function wrapHtml(src) {
    var t = String(src || "").trim();
    if (/<!doctype|<html[\s>]/i.test(t)) return t;
    return "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>body{font:14px/1.6 system-ui,sans-serif;margin:16px;color:#1d2925}h1,h2,h3{line-height:1.25}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 8px}a{color:#245444}</style></head><body>" + t + "</body></html>";
  }

  function runOne(box) {
    var ta = box.querySelector(".tryit-code");
    var frame = box.querySelector(".tryit-preview");
    if (!ta || !frame) return;
    var doc = frame.contentDocument || frame.contentWindow.document;
    doc.open();
    doc.write(wrapHtml(ta.value));
    doc.close();
  }

  function initOne(box) {
    if (box.dataset.ready) return;
    box.dataset.ready = "1";
    var ta = box.querySelector(".tryit-code");
    if (ta && !box.dataset.original) box.dataset.original = ta.value;
    var runBtn = box.querySelector(".tryit-run");
    var resetBtn = box.querySelector(".tryit-reset");
    if (runBtn) runBtn.addEventListener("click", function () { runOne(box); });
    if (resetBtn) resetBtn.addEventListener("click", function () {
      if (ta) ta.value = box.dataset.original || "";
      runOne(box);
    });
    runOne(box);
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
    initTocToggle();
  });
})();
