// E1：把独立的导图入口折回对应知识点；仅处理目录页导航，不创建打卡或新知识点。
export function foldGsMindmapDirectoryEntries(doc) {
  if (!doc || typeof doc.querySelectorAll !== "function") return 0;
  var links = Array.prototype.slice.call(doc.querySelectorAll('a[href="mindmap.html"]'));
  var changed = 0;
  links.forEach(function (link) {
    if (!String(link.textContent || "").includes("导图")) return;
    link.setAttribute("href", "gs1.html#point-1");
    link.textContent = "第一章考点";
    link.setAttribute("aria-label", "进入高等数学第一章第一个考点");
    link.dataset.e1TopicTarget = "math.domain";
    changed += 1;
  });
  return changed;
}

export function foldExcelMindmapDirectoryEntry(doc) {
  if (!doc || typeof doc.getElementById !== "function") return 0;
  var mapSection = doc.getElementById("mindmap");
  var excelSection = doc.getElementById("excel");
  if (!mapSection || !excelSection) return 0;

  Array.prototype.slice.call(doc.querySelectorAll('a[href="#mindmap"]')).forEach(function (link) {
    link.remove();
  });

  var added = 0;
  for (var index = 1; index <= 7; index += 1) {
    var topicId = "cb.excel." + (40 + index);
    var card = doc.getElementById("video-4-" + index);
    if (!card) continue;
    var body = card.querySelector(".content-card__body") || card;
    if (body.querySelector('[data-e1-topic-map="' + topicId + '"]')) continue;

    [
      { kind: "image", href: "mindmap.png", label: "静态导图" },
      { kind: "interactive", href: "mm.html", label: "交互导图" }
    ].forEach(function (resource) {
      var link = doc.createElement("a");
      link.className = "resource-link e1-topic-map-link";
      link.href = resource.href;
      link.dataset.e1TopicMap = topicId;
      link.dataset.e1TopicMapKind = resource.kind;
      link.textContent = "4." + index + " " + resource.label;
      link.setAttribute("aria-label", topicId + " " + resource.label);
      body.appendChild(link);
      added += 1;
    });
  }

  mapSection.hidden = true;
  mapSection.setAttribute("aria-hidden", "true");
  return added;
}

export function foldEnglishMindmapDirectoryEntry(doc) {
  if (!doc || typeof doc.getElementById !== "function") return false;
  var mapSection = doc.getElementById("yymaps");
  if (!mapSection) return false;

  var nonfiniteHeading = doc.getElementById("_1");
  var nonfiniteMap = mapSection.querySelector('a[href="mm/mm1.svg"]');
  if (nonfiniteMap && nonfiniteHeading && nonfiniteMap.dataset.e1TopicMap !== "english.nonfinite") {
    nonfiniteMap.dataset.e1TopicMap = "english.nonfinite";
    nonfiniteMap.classList.add("e1-topic-map-link");
    nonfiniteHeading.insertAdjacentElement("afterend", nonfiniteMap);
  }

  Array.prototype.slice.call(doc.querySelectorAll('a[href="#yymaps"]')).forEach(function (link) {
    link.remove();
  });
  // mm2–mm4 已由 yy5 对应知识点的 E1 齐套条提供入口；mm1 则保留在本页非谓语章节。
  mapSection.hidden = true;
  mapSection.setAttribute("aria-hidden", "true");
  return Boolean(nonfiniteMap && nonfiniteHeading);
}

export function initE1TopicMapNavigation(doc) {
  return {
    gs: foldGsMindmapDirectoryEntries(doc),
    excel: foldExcelMindmapDirectoryEntry(doc),
    english: foldEnglishMindmapDirectoryEntry(doc)
  };
}

if (typeof document !== "undefined") initE1TopicMapNavigation(document);
