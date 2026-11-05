export const SUBJECT_STATUS = {
  live: "已上线",
  building: "建设中",
  disabled: "未启用"
};

export const CATEGORY_LABEL = {
  wrong: "答错",
  unanswered: "未作答",
  guessed: "猜对",
  not_understood: "答对但不理解"
};

export const GRADING_LABEL = {
  correct: "答对",
  incorrect: "答错",
  unanswered: "未作答",
  pending: "待评阅"
};

export const MASTERY_LABEL = {
  practicing: "已开始练习",
  needs_review: "需要复习",
  independent_once: "有一次独立做对的证据，还不等于熟练",
  prompted_correct: "看过解析后做对"
};

export function formatWhen(iso) {
  if (!iso) return "未安排";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function isSampleQuestion(question) {
  return question?.provenance?.kind === "sample";
}
