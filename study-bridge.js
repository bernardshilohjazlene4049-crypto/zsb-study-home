(function () {
  var script = document.currentScript;
  var root = new URL("./", script ? script.src : location.href);

  function studyHref(params) {
    var url = new URL("study/index.html", root);
    Object.keys(params || {}).forEach(function (key) {
      if (params[key] != null && params[key] !== "") url.searchParams.set(key, params[key]);
    });
    return url.href;
  }

  function openQuestion(questionId) {
    if (!questionId) throw new Error("openQuestion 需要 questionId。");
    location.assign(studyHref({ question: questionId }));
  }

  function markNotUnderstood(questionId) {
    if (!questionId) throw new Error("markNotUnderstood 需要 questionId。");
    location.assign(studyHref({ question: questionId, action: "not-understood" }));
  }

  function recordAttempt(payload) {
    return import(new URL("assets/js/bridge-api.js", root)).then(function (mod) {
      return mod.recordExternalAttempt(payload || {});
    });
  }

  var api = {
    openQuestion: openQuestion,
    recordAttempt: recordAttempt,
    markNotUnderstood: markNotUnderstood,
    studyHref: studyHref
  };
  globalThis.ZsbStudyBridge = api;
})();
