// Mount the delivered per-topic network mindmap on each D6 lesson page.
const PAGE_SUFFIX_BY_KEY = Object.freeze({
  "wl-s11": "s11",
  "wl-s12": "s12",
  "wl-s13": "s13",
  "wl-s14": "s14",
  "wl-s15": "s15",
  "wl-s16": "s16",
  "wl-s21": "s21",
  "wl-s22": "s22",
  "wl-s23": "s23",
  "wl-s24": "s24",
  "wl-s25": "s25",
  "wl-s26": "s26",
  "wl-s27": "s27",
  "wl-s31": "s31",
  "wl-s32": "s32",
  "wl-s33": "s33",
  "wl-s34": "s34",
  "wl-s35": "s35",
  "wl-s36": "s36",
  "wl-s37": "s37",
  "wl-s38": "s38",
  "wl-s39": "s39",
  "wl-s41": "s41",
  "wl-s42": "s42",
  "wl-s43": "s43",
  "wl-s51": "s51",
  "wl-s52": "s52",
  "wl-s53": "s53",
  "wl-s61": "s61",
});

function ensureStylesheet(doc) {
  if (doc.querySelector('link[data-network-mindmap-style="true"]') || !doc.head) return;
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("../../css/network-mindmaps.css", import.meta.url).href;
  link.dataset.networkMindmapStyle = "true";
  doc.head.append(link);
}

export function mountNetworkMindmap(doc = globalThis.document) {
  if (!doc) return null;
  const script = doc.querySelector('script[src*="network-mindmaps.js"][data-page]');
  const pageKey = script?.dataset?.page;
  const suffix = PAGE_SUFFIX_BY_KEY[pageKey];
  if (!suffix) return null;

  const heading = doc.querySelector(".wl-page .wy-point-head");
  if (!heading) return null;

  const figureId = `network-mindmap-net-${suffix}`;
  const existing = doc.getElementById(figureId);
  if (existing) return existing;

  ensureStylesheet(doc);
  const title = heading.querySelector("h1")?.textContent?.trim() || `net.${suffix}`;
  const figure = doc.createElement("figure");
  figure.className = "network-mindmap";
  figure.id = figureId;
  figure.dataset.topicId = `net.${suffix}`;
  figure.setAttribute("aria-label", `${title} · 本点思维导图`);

  const caption = doc.createElement("figcaption");
  caption.className = "network-mindmap__caption";
  caption.textContent = "本点思维导图";

  const image = doc.createElement("img");
  image.className = "network-mindmap__image";
  image.src = new URL(`../../mindmaps/network/net-${suffix}.svg`, import.meta.url).href;
  image.alt = `${title} · 思维导图`;
  image.loading = "lazy";
  image.decoding = "async";

  figure.append(caption, image);
  heading.insertAdjacentElement("afterend", figure);
  return figure;
}

if (typeof document !== "undefined") mountNetworkMindmap(document);
