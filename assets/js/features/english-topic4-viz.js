const POINT_COUNT = 13;
const QUIZ_COUNT = 10;

function ensureStylesheet(doc) {
  if (doc.querySelector('link[data-english-topic4-style="true"]')) return;
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = "../assets/css/english-topic4-viz.css";
  link.setAttribute("data-english-topic4-style", "true");
  doc.head.appendChild(link);
}

function makeFigure(doc, { kind, id, src, caption, alt }) {
  const figure = doc.createElement("figure");
  figure.className = `english-topic4-visual english-topic4-visual--${kind}`;
  figure.setAttribute("data-english-topic4-visual", `${kind}-${id}`);

  const figcaption = doc.createElement("figcaption");
  figcaption.className = "english-topic4-visual__caption";
  figcaption.textContent = caption;

  const image = doc.createElement("img");
  image.src = src;
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";

  figure.appendChild(figcaption);
  figure.appendChild(image);
  return figure;
}

export function mountEnglishTopic4Visuals(doc = document) {
  ensureStylesheet(doc);
  let mindmaps = 0;
  let practices = 0;

  for (let number = 1; number <= POINT_COUNT; number += 1) {
    const anchor = `point-4-${number}`;
    const card = doc.getElementById(anchor);
    const content = card?.querySelector(".point-content");
    if (!content || content.querySelector(`[data-english-topic4-visual="mindmap-${number}"]`)) continue;

    const figure = makeFigure(doc, {
      kind: "mindmap",
      id: number,
      src: `../assets/mindmaps/english/topic4/point-4-${number}.svg`,
      caption: `考点 4-${number} · 思维导图`,
      alt: `考点 4-${number} 定语从句逐点思维导图`
    });
    content.insertBefore(figure, content.firstChild || null);
    mindmaps += 1;
  }

  for (let number = 1; number <= QUIZ_COUNT; number += 1) {
    const questionId = `4-${number}`;
    const article = doc.querySelector(`article.quiz-question[data-question="${questionId}"]`);
    const feedback = article?.querySelector(".answer-feedback");
    if (!article || !feedback || article.querySelector(`[data-english-topic4-visual="practice-${number}"]`)) continue;

    const figure = makeFigure(doc, {
      kind: "practice",
      id: number,
      src: `../assets/mindmaps/english/topic4/quiz-4-${number}.svg`,
      caption: `专题四 · 练习 ${String(number).padStart(2, "0")} · 可视化讲解`,
      alt: `专题四第 ${number} 题的定语从句判定流程图`
    });
    feedback.insertAdjacentElement("afterend", figure);
    practices += 1;
  }

  return { mindmaps, practices };
}

if (typeof document !== "undefined") {
  mountEnglishTopic4Visuals(document);
}
