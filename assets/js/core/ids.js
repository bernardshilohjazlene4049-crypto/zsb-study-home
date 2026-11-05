export function createId(prefix = "id") {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}_${uuid}`;
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex}`;
}

export function mistakeId(learnerId, questionId) {
  return `mst:${learnerId}:${questionId}`;
}

export function progressId(learnerId, topicId) {
  return `prog:${learnerId}:${topicId}`;
}

export function draftId(learnerId, questionId) {
  return `draft:${learnerId}:${questionId}`;
}

export function playbackId(learnerId, resourceId) {
  return `play:${learnerId}:${resourceId}`;
}

export function markId(learnerId, questionId) {
  return `mark:${learnerId}:${questionId}`;
}
