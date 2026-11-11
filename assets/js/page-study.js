/* 正文页作答 → /study 同一 IndexedDB（zsb-study）。
   页面写法：<script src="…/study-bridge.js"></script>
             <script src="…/assets/js/page-study.js" data-page="yy5" data-subject="english"></script>
   约定：每次作答派发 zsb:attempt 事件；本脚本统一写库。数据库不可用时静默跳过，不影响页面。 */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script) return;
  var root = new URL("../../", script.src);
  var pageKey = script.dataset.page || "";
  var subjectId = script.dataset.subject || null;
  var pageUrl = decodeURI(location.pathname).indexOf(decodeURI(root.pathname)) === 0
    ? decodeURI(location.pathname).slice(decodeURI(root.pathname).length)
    : "";
  var pageTitle = (document.querySelector("h1") || {}).textContent || document.title;
  pageTitle = String(pageTitle).replace(/\s+/g, " ").trim();
  var apiPromise = null;

  function api() {
    if (!apiPromise) apiPromise = import(new URL("assets/js/bridge-api.js", root).href);
    return apiPromise;
  }
  function helpers() {
    return import(new URL("assets/js/features/page-attempts.js", root).href);
  }
  function text(node) {
    return node ? String(node.textContent || "").replace(/\s+/g, " ").trim() : "";
  }
  function anchorOf(node) {
    var el = node && node.closest("[id]");
    return el ? el.id : "";
  }
  function sectionOf(node) {
    var chapter = node && node.closest(".chapter");
    return chapter ? text(chapter.querySelector(".chapter-title")) : "";
  }
  function emit(detail) {
    document.dispatchEvent(new CustomEvent("zsb:attempt", { bubbles: true, detail: detail }));
  }

  var queue = Promise.resolve();
  document.addEventListener("zsb:attempt", function (event) {
    var d = event.detail || {};
    if (!d.questionId) return;
    var input = {
      questionId: d.questionId,
      subjectId: d.subjectId || subjectId,
      stem: d.stem || "",
      page: { url: pageUrl, title: d.section || pageTitle, anchor: d.anchor || "" }
    };
    if (d.rating) input.rating = d.rating;
    else { input.choice = d.choice; input.correct = d.correct; }
    queue = queue.then(function () {
      return api().then(function (mod) { return mod.recordPageAttempt(input); });
    }).catch(function (error) { console.warn("学习记录未写入", error); });
  });

  function qid(item) {
    return "page:" + pageKey + ":" + String(item).replace(/[^0-9A-Za-z_.\-]/g, "-");
  }

  // 选择题卡片：.quiz-question[data-question][data-correct] 内的 .choice[data-choice]（yy5）。
  var cards = Array.prototype.slice.call(document.querySelectorAll(".quiz-question[data-question][data-correct]"));
  cards.forEach(function (card) {
    card.querySelectorAll(".choice[data-choice]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        emit({
          questionId: qid(card.dataset.question),
          choice: btn.dataset.choice,
          correct: card.dataset.correct,
          stem: text(card.querySelector(".question-prompt")),
          anchor: anchorOf(card),
          section: sectionOf(card)
        });
      });
    });
  });

  // 小测验：.quiz .qitem[data-answer] + 单选 + .quiz-check（网页设计）。同一题选项未变时不重复记录。
  document.querySelectorAll(".quiz").forEach(function (quiz) {
    var check = quiz.querySelector(".quiz-check");
    if (!check) return;
    var last = {};
    check.addEventListener("click", function () {
      quiz.querySelectorAll(".qitem[data-answer]").forEach(function (item, index) {
        var picked = item.querySelector("input[type=radio]:checked");
        if (!picked) return;
        var key = String(index + 1);
        var value = String(picked.value || "").toUpperCase();
        if (last[key] === value) return;
        last[key] = value;
        emit({
          questionId: qid(key),
          choice: value,
          correct: String(item.dataset.answer || "").toUpperCase(),
          stem: text(item.querySelector("h3")),
          anchor: anchorOf(item)
        });
      });
    });
    var reset = quiz.querySelector(".quiz-reset");
    if (reset) reset.addEventListener("click", function () { last = {}; });
  });

  // 看完解答后自评：[data-zsb-question] 内的 [data-zsb-rate="good|fuzzy|again"]。
  document.querySelectorAll("[data-zsb-question]").forEach(function (box) {
    box.querySelectorAll("[data-zsb-rate]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        emit({
          questionId: qid(box.dataset.zsbQuestion),
          subjectId: box.dataset.zsbSubject || subjectId,
          rating: btn.dataset.zsbRate,
          stem: box.dataset.zsbStem || text(box.querySelector("[data-zsb-stem]")),
          anchor: box.id || anchorOf(box)
        });
      });
    });
  });

  // 迁移旧 localStorage 选择题记录（只读不删，幂等）。
  var legacyKey = script.dataset.legacyChoices;
  if (legacyKey && cards.length) {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(legacyKey) || "null"); } catch (e) { saved = null; }
    if (saved && typeof saved === "object" && Object.keys(saved).length) {
      Promise.all([api(), helpers()]).then(function (mods) {
        return mods[0].migrationDone(legacyKey).then(function (done) {
          if (done) return null;
          var questions = cards.map(function (card) {
            return {
              itemKey: card.dataset.question,
              questionId: qid(card.dataset.question),
              subjectId: subjectId,
              correct: card.dataset.correct,
              stem: text(card.querySelector(".question-prompt")),
              page: { url: pageUrl, title: sectionOf(card) || pageTitle, anchor: anchorOf(card) }
            };
          });
          return mods[0].migratePageRecords(legacyKey, mods[1].migrateChoiceMap(legacyKey, saved, questions));
        });
      }).catch(function (error) { console.warn("旧记录未迁移", error); });
    }
  }
})();
