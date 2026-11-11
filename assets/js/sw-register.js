/* 注册离线缓存；不弹安装提示。 */
(function () {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  window.addEventListener("beforeinstallprompt", function (event) { event.preventDefault(); });
  var script = document.currentScript;
  var root = new URL("../../", script ? script.src : location.href);
  window.addEventListener("load", function () {
    navigator.serviceWorker.register(new URL("sw.js", root).href, { scope: root.pathname }).catch(function () {});
  });
})();
