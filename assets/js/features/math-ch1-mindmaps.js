import { TOPIC_KIT_BY_ID } from "./topic-kit-data.js";

const SITE_ROOT = new URL("../../../", import.meta.url);
const MINDMAP_ENTRIES = Object.entries(TOPIC_KIT_BY_ID)
  .filter(([, config]) =>
    config.batch === "D1" &&
    config.pageKey === "gs1" &&
    config.subjectId === "math" &&
    config.mindmap?.href?.startsWith("assets/mindmaps/math/ch1/")
  )
  .sort(([, left], [, right]) =>
    Number(left.anchor.slice("point-".length)) - Number(right.anchor.slice("point-".length))
  );

export function mountMathCh1Mindmaps(doc = typeof document === "undefined" ? null : document) {
  if (!doc) return 0;

  if (!doc.querySelector('link[data-math-ch1-mindmap-style="true"]') && doc.head) {
    const stylesheet = doc.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = new URL("assets/css/math-ch1-mindmaps.css", SITE_ROOT).href;
    stylesheet.dataset.mathCh1MindmapStyle = "true";
    doc.head.appendChild(stylesheet);
  }

  let mounted = 0;
  for (const [topicId, config] of MINDMAP_ENTRIES) {
    const section = doc.getElementById(config.anchor);
    if (!section || section.querySelector(".math-ch1-mindmap")) continue;

    const header = section.querySelector(":scope > header") || section.querySelector("header");
    if (!header) continue;

    const figure = doc.createElement("figure");
    figure.className = "math-ch1-mindmap";
    figure.dataset.mathCh1MindmapTopicId = topicId;

    const caption = doc.createElement("figcaption");
    caption.className = "math-ch1-mindmap__caption";
    caption.textContent = `本点思维导图 · ${config.anchor}`;

    const link = doc.createElement("a");
    link.className = "math-ch1-mindmap__open";
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
    section.insertBefore(figure, header.nextSibling);
    mounted += 1;
  }
  return mounted;
}
