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

  var JSJ1_TOPIC_IDS = {
    "mind-1.1": "cb.ch1.11",
    "mind-1.2": "cb.ch1.12",
    "mind-1.3": "cb.ch1.13",
    "mind-1.4": "cb.ch1.14"
  };

  var PPT5_TOPIC_IDS = {
    "chapter-5.1": "cb.ppt.51",
    "chapter-5.2": "cb.ppt.52",
    "chapter-5.3": "cb.ppt.53",
    "chapter-5.4": "cb.ppt.54",
    "chapter-5.5": "cb.ppt.55",
    "chapter-5.6": "cb.ppt.56"
  };

  var WL_TOPIC_IDS_BY_PAGE = {
    "wl-s11": { "s11": "net.s11" },
    "wl-s12": { "s12": "net.s12" },
    "wl-s13": { "s13": "net.s13" },
    "wl-s14": { "s14": "net.s14" },
    "wl-s15": { "s15": "net.s15" },
    "wl-s16": { "s16": "net.s16" },
    "wl-s21": { "s21": "net.s21" },
    "wl-s22": { "s22": "net.s22" },
    "wl-s23": { "s23": "net.s23" },
    "wl-s24": { "s24": "net.s24" },
    "wl-s25": { "s25": "net.s25" },
    "wl-s26": { "s26": "net.s26" },
    "wl-s27": { "s27": "net.s27" },
    "wl-s31": { "s31": "net.s31" },
    "wl-s32": { "s32": "net.s32" },
    "wl-s33": { "s33": "net.s33" },
    "wl-s34": { "s34": "net.s34" },
    "wl-s35": { "s35": "net.s35" },
    "wl-s36": { "s36": "net.s36" },
    "wl-s37": { "s37": "net.s37" },
    "wl-s38": { "s38": "net.s38" },
    "wl-s39": { "s39": "net.s39" },
    "wl-s41": { "s41": "net.s41" },
    "wl-s42": { "s42": "net.s42" },
    "wl-s43": { "s43": "net.s43" },
    "wl-s51": { "s51": "net.s51" },
    "wl-s52": { "s52": "net.s52" },
    "wl-s53": { "s53": "net.s53" },
    "wl-s61": { "s61": "net.s61" }
  };

  var TOPIC_IDS_BY_PAGE = {
    gs1: GS1_TOPIC_IDS,
    gs45: GS45_TOPIC_IDS,
    yy5: YY5_TOPIC_IDS,
    "c-notes": C_NOTES_TOPIC_IDS,
    jsj1: JSJ1_TOPIC_IDS,
    ppt5: PPT5_TOPIC_IDS
  };
  Object.keys(WL_TOPIC_IDS_BY_PAGE).forEach(function (key) {
    TOPIC_IDS_BY_PAGE[key] = WL_TOPIC_IDS_BY_PAGE[key];
  });

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

  function createTopicRateGroup(anchor, topicIdsByAnchor, title, logicalPageAnchor) {
    var group = document.createElement("div");
    group.className = "zsb-topic-rate";
    group.dataset.zsbQuestion = anchor;
    group.dataset.zsbSubject = subjectId || "math";
    group.dataset.zsbTopicIds = topicIdsByAnchor[anchor];
    group.dataset.zsbStem = text(title);
    if (logicalPageAnchor) group.dataset.zsbPageAnchor = anchor;
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "考点掌握度打卡：" + text(title));
    group.appendChild(makeTopicRateButton("good", "会了", "新记录 7 天后复习"));
    group.appendChild(makeTopicRateButton("fuzzy", "模糊", "进入复习队列"));
    group.appendChild(makeTopicRateButton("again", "不会", "加入错题本"));
    return group;
  }

  function injectTopicRatings() {
    var topicIdsByAnchor = TOPIC_IDS_BY_PAGE[pageKey];
    if (!topicIdsByAnchor) return;

    // Network lesson pages have no section id: bind the single configured topic
    // to the unique .wl-page heading, keeping the group immediately after h1
    // and before the existing videos-v1 marker/gallery.
    if (/^wl-s\d+$/.test(pageKey)) {
      var headers = document.querySelectorAll(".wl-page .wy-point-head");
      var anchors = Object.keys(topicIdsByAnchor);
      if (headers.length !== 1 || anchors.length !== 1) return;
      var networkHeader = headers[0];
      var networkTitle = networkHeader.querySelector("h1");
      var networkGallery = networkHeader.querySelector("#videos-v1");
      var networkAnchor = anchors[0];
      if (!networkTitle || !networkGallery || networkHeader.querySelector("[data-zsb-question]")) return;
      var networkGroup = createTopicRateGroup(networkAnchor, topicIdsByAnchor, networkTitle, true);
      networkTitle.insertAdjacentElement("afterend", networkGroup);
      return;
    }

    Object.keys(topicIdsByAnchor).forEach(function (anchor) {
      var section = document.getElementById(anchor);
      var header = section && (section.querySelector(".topic-header") || section.querySelector(".chapter-heading") || section.querySelector(".mind-head") || section.querySelector(".chapter-top"));
      var title = header && (header.querySelector(".topic-title") || header.querySelector(".chapter-title") || header.querySelector("h2"));
      if (!section || !header || !title || header.querySelector("[data-zsb-question]")) return;

      var group = createTopicRateGroup(anchor, topicIdsByAnchor, title, false);
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
          anchor: box.dataset.zsbPageAnchor || box.id || anchorOf(box),
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
