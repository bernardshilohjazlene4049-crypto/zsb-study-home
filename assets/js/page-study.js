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
    var chapter = node && node.closest(".chapter, .topic-section");
    return chapter ? text(chapter.querySelector(".chapter-title, .topic-title")) : "";
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
      topicIds: d.topicIds || undefined,
      stem: d.stem || "",
      page: { url: pageUrl, title: d.section || pageTitle, anchor: d.anchor || "" }
    };
    if (d.rating) input.rating = d.rating;
    else { input.choice = d.choice; input.correct = d.correct; }
    queue = queue.then(function () {
      return api().then(function (mod) { return mod.recordPageAttempt(input); });
    }).then(function () {
      document.dispatchEvent(new CustomEvent("zsb:attempt-saved", { detail: { questionId: d.questionId } }));
    }).catch(function (error) {
      console.warn("学习记录未写入", error);
      document.dispatchEvent(new CustomEvent("zsb:attempt-failed", { detail: { questionId: d.questionId } }));
    });
  });

  function qid(item) {
    return "page:" + pageKey + ":" + String(item).replace(/[^0-9A-Za-z_.\-]/g, "-");
  }

  // 正文页知识点映射：按 script[data-page] 的 pageKey 选择，不在注入逻辑中绑定具体页面。
  // topicIds 显式传给现有 recordPageAttempt → commitSubmission 链路，确保归属到正确考点。
  var GS1_TOPIC_IDS = {
    "point-1": "math.domain",
    "point-2": "math.function_properties",
    "point-3": "math.sequence_limit",
    "point-4": "math.function_limit",
    "point-5": "math.infinitesimal",
    "point-6": "math.equivalent",
    "point-7": "math.important_limits",
    "point-8": "math.asymptote",
    "point-9": "math.continuity",
    "point-10": "math.discontinuity",
    "point-11": "math.continuous_properties"
  };

  var GS45_TOPIC_IDS = {
    "point-36": "math.p36",
    "point-37": "math.p37",
    "point-38": "math.p38",
    "point-39": "math.p39",
    "point-40": "math.p40",
    "point-41": "math.p41",
    "point-42": "math.p42",
    "point-43": "math.p43",
    "point-44": "math.p44",
    "point-45": "math.p45",
    "point-46": "math.p46",
    "point-47": "math.p47",
    "point-48": "math.p48"
  };

  var YY5_TOPIC_IDS = {
    "topic-4": "english.attributive.basics",
    "topic-5": "english.noun.basics",
    "topic-6": "english.adverbial.basics",
    "topic-7": "english.agreement.basics",
    "topic-8": "english.special.basics"
  };

  var C_NOTES_TOPIC_IDS = {
    "point-1": "c.ch1.intro",
    "point-2": "c.ch1.structure",
    "point-3": "c.ch1.compile",
    "point-4": "c.ch2.identifier",
    "point-5": "c.ch2.constants",
    "point-6": "c.ch2.datatypes",
    "point-7": "c.ch3.priority",
    "point-8": "c.ch3.arith_logic",
    "point-9": "c.ch3.assign_comma",
    "point-10": "c.ch4.io_concept",
    "point-11": "c.ch4.printf",
    "point-12": "c.ch4.scanf_char_str",
    "point-13": "c.ch5.truth_if",
    "point-14": "c.ch5.nested_ternary",
    "point-15": "c.ch5.switch",
    "point-16": "c.ch6.while_dowhile",
    "point-17": "c.ch6.for_loop",
    "point-18": "c.ch6.control_coding",
    "point-19": "c.ch7.array1d",
    "point-20": "c.ch7.array2d",
    "point-21": "c.ch7.char_array",
    "point-22": "c.ch8.def_call",
    "point-23": "c.ch8.decl_pass",
    "point-24": "c.ch8.scope_static",
    "point-25": "c.ch9.ptr_basics",
    "point-26": "c.ch9.ptr_array1d",
    "point-27": "c.ch9.ptr_array2d_param"
  };

  var TOPIC_IDS_BY_PAGE = {
    gs1: GS1_TOPIC_IDS,
    gs45: GS45_TOPIC_IDS,
    yy5: YY5_TOPIC_IDS,
    "c-notes": C_NOTES_TOPIC_IDS
  };

  function makeTopicRateButton(rating, label, hint) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "sh-btn sys-rate-btn sys-rate-btn--" + rating;
    button.dataset.zsbRate = rating;
    button.setAttribute("aria-label", label + "；" + hint);
    var strong = document.createElement("strong");
    strong.textContent = label;
    var small = document.createElement("small");
    small.textContent = hint;
    button.appendChild(strong);
    button.appendChild(small);
    return button;
  }

  function injectTopicRatings() {
    var topicIdsByAnchor = TOPIC_IDS_BY_PAGE[pageKey];
    if (!topicIdsByAnchor) return;
    Object.keys(topicIdsByAnchor).forEach(function (anchor) {
      var section = document.getElementById(anchor);
      var header = section && (section.querySelector(".topic-header") || section.querySelector(".chapter-heading"));
      var title = header && (header.querySelector(".topic-title") || header.querySelector(".chapter-title"));
      if (!section || !header || !title || header.querySelector("[data-zsb-question]")) return;

      var group = document.createElement("div");
      group.className = "zsb-topic-rate";
      group.dataset.zsbQuestion = anchor;
      group.dataset.zsbSubject = subjectId || "math";
      group.dataset.zsbTopicIds = topicIdsByAnchor[anchor];
      group.dataset.zsbStem = text(title);
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", "考点掌握度打卡：" + text(title));
      group.appendChild(makeTopicRateButton("good", "会了", "新记录 7 天后复习"));
      group.appendChild(makeTopicRateButton("fuzzy", "模糊", "进入复习队列"));
      group.appendChild(makeTopicRateButton("again", "不会", "加入错题本"));
      header.appendChild(group);
    });
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

  // 先按 pageKey 注入已配置页面的知识点打卡，再统一绑定已有正文页自评约定。
  injectTopicRatings();

  // 看完解答后自评：[data-zsb-question] 内的 [data-zsb-rate="good|fuzzy|again"]。
  document.querySelectorAll("[data-zsb-question]").forEach(function (box) {
    box.querySelectorAll("[data-zsb-rate]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        emit({
          questionId: qid(box.dataset.zsbQuestion),
          subjectId: box.dataset.zsbSubject || subjectId,
          rating: btn.dataset.zsbRate,
          topicIds: box.dataset.zsbTopicIds
            ? box.dataset.zsbTopicIds.split(",").map(function (id) { return id.trim(); }).filter(Boolean)
            : undefined,
          stem: box.dataset.zsbStem || text(box.querySelector("[data-zsb-stem]")),
          anchor: box.id || anchorOf(box),
          section: sectionOf(box)
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
