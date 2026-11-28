import { TOPIC_KIT_BY_ID } from "./topic-kit-data.js";

const SITE_ROOT = new URL("../../../", import.meta.url);
const MINDMAP_ENTRIES = Object.entries(TOPIC_KIT_BY_ID)
  .filter(([, config]) =>
    config.batch === "D4" &&
    config.pageKey === "c-notes" &&
    config.subjectId === "c_language" &&
    config.mindmap?.href?.startsWith("assets/mindmaps/c/")
  )
  .sort(([, left], [, right]) => Number(left.anchor.slice("point-".length)) - Number(right.anchor.slice("point-".length)));

export function mountCMindmaps(doc = typeof document === "undefined" ? null : document) {
  if (!doc) return 0;
  const script = doc.querySelector('script[type="module"][data-page="c-notes"][src*="c-mindmaps.js"]');
  if (!script) return 0;

  if (!doc.querySelector('link[data-c-mindmap-style="true"]') && doc.head) {
    const stylesheet = doc.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = new URL("assets/css/c-mindmaps.css", SITE_ROOT).href;
    stylesheet.dataset.cMindmapStyle = "true";
    doc.head.appendChild(stylesheet);
  }

  let mounted = 0;
  for (const [topicId, config] of MINDMAP_ENTRIES) {
    const section = doc.getElementById(config.anchor);
    if (!section || section.querySelector(".c-mindmap-embed")) continue;

    const lecture = section.querySelector(".gs-pt");
    const target = section.querySelector(".core-stack") ||
      section.querySelector(`#memory-${config.anchor.slice("point-".length)}`);
    if (!lecture || !target?.parentNode) continue;

    const figure = doc.createElement("figure");
    figure.className = "c-mindmap-embed";
    figure.dataset.cMindmapTopicId = topicId;

    const caption = doc.createElement("figcaption");
    caption.className = "c-mindmap-embed__caption";
    caption.textContent = `本点思维导图 · ${config.anchor}`;

    const link = doc.createElement("a");
    link.className = "c-mindmap-embed__open";
    link.href = new URL(config.mindmap.href, SITE_ROOT).href;
    link.setAttribute("aria-label", `单独打开 ${config.anchor} 思维导图`);

    const image = doc.createElement("img");
    image.src = link.href;
    image.alt = `${config.anchor} 思维导图`;
    image.loading = "lazy";
    image.decoding = "async";

    link.appendChild(image);
    figure.appendChild(caption);
    figure.appendChild(link);
    target.parentNode.insertBefore(figure, target);
    mounted += 1;
  }
  return mounted;
}

if (typeof document !== "undefined") mountCMindmaps(document);
