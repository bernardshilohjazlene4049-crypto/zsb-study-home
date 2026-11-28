const POINT_COUNT = 19;
const QUIZ_COUNT = 10;

function ensureStylesheet(doc) {
  if (doc.querySelector('link[data-english-topic8-style="true"]')) return;
  const link = doc.createElement("link");
  link.rel = "stylesheet";
  link.href = "../assets/js/features/english-topic8-viz.css";
  link.setAttribute("data-english-topic8-style", "true");
  doc.head.appendChild(link);
}

function makeFigure(doc, { kind, id, src, caption, alt }) {
  const figure = doc.createElement("figure");
  figure.className = `english-topic8-visual english-topic8-visual--${kind}`;
  figure.setAttribute("data-english-topic8-visual", `${kind}-${id}`);

  const figcaption = doc.createElement("figcaption");
  figcaption.className = "english-topic8-visual__caption";
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

export function mountEnglishTopic8Visuals(doc = document) {
  ensureStylesheet(doc);
  let mindmaps = 0;
  let practices = 0;

  for (let number = 1; number <= POINT_COUNT; number += 1) {
    const anchor = `point-8-${number}`;
    const card = doc.getElementById(anchor);
    const content = card?.querySelector(".point-content");
    if (!content || content.querySelector(`[data-english-topic8-visual="mindmap-${number}"]`)) continue;

    const figure = makeFigure(doc, {
      kind: "mindmap",
      id: number,
      src: `../assets/mindmaps/english/topic8/point-8-${number}.svg`,
      caption: `考点 8-${number} · 思维导图`,
      alt: `考点 8-${number} 特殊句型逐点思维导图`
    });
    content.insertBefore(figure, content.firstChild || null);
    mindmaps += 1;
  }

  for (let number = 1; number <= QUIZ_COUNT; number += 1) {
    const questionId = `8-${number}`;
    const article = doc.querySelector(`article.quiz-question[data-question="${questionId}"]`);
    const feedback = article?.querySelector(".answer-feedback");
    if (!article || !feedback || article.querySelector(`[data-english-topic8-visual="practice-${number}"]`)) continue;

    const figure = makeFigure(doc, {
      kind: "practice",
      id: number,
      src: `../assets/mindmaps/english/topic8/quiz-8-${number}.svg`,
      caption: `专题八 · 练习 ${String(number).padStart(2, "0")} · 可视化讲解`,
      alt: `专题八第 ${number} 题的特殊句型判定流程图`
    });
    feedback.insertAdjacentElement("afterend", figure);
    practices += 1;
  }

  return { mindmaps, practices };
}

if (typeof document !== "undefined") {
  mountEnglishTopic8Visuals(document);
}
