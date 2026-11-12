import { siteUrl } from "../core/paths.js";
import { mergePrereqIds, topicIdsForQuestionId, isExcludedQuestionId } from "./topic-index.js";

async function readJson(path) {
  const response = await fetch(siteUrl(path));
  if (!response.ok) throw new Error("目录没有载入。");
  return response.json();
}

export async function loadRawCatalog() {
  const [subjectsDoc, topicsDoc, resourcesDoc, anchorsDoc, questionsDoc, dependenciesDoc] = await Promise.all([
    readJson("data/subjects.json"),
    readJson("data/topics.json"),
    readJson("data/resources.json"),
    readJson("data/video-anchors.json"),
    readJson("data/questions/sample.json"),
    readJson("data/dependencies.json")
  ]);
  return { subjectsDoc, topicsDoc, resourcesDoc, anchorsDoc, questionsDoc, dependenciesDoc };
}

export function publicAnchor(anchor) {
  if (!anchor) return null;
  const located = anchor.verified === true && Number.isFinite(anchor.start_sec);
  return {
    id: anchor.id,
    resource_id: anchor.resource_id,
    topic_id: anchor.topic_id,
    verified: anchor.verified === true,
    located,
    start_sec: located ? anchor.start_sec : null,
    end_sec: located && Number.isFinite(anchor.end_sec) ? anchor.end_sec : null,
    note: anchor.note || "暂无定位",
    match_method: anchor.match_method || ""
  };
}

function indexBy(list, key, warnings, label) {
  const map = new Map();
  for (const item of list) {
    if (!item?.[key]) {
      warnings.push(`${label} 缺少 ${key}`);
      continue;
    }
    if (map.has(item[key])) {
      warnings.push(`${label} 重复 ${item[key]}，已保留先出现的一条`);
      continue;
    }
    map.set(item[key], item);
  }
  return map;
}

export function createCatalog(raw, importedQuestions = []) {
  const warnings = [];
  const subjects = [...(raw.subjectsDoc?.subjects || [])].sort((a, b) => a.order - b.order);
  const chapters = [...(raw.topicsDoc?.chapters || [])].sort((a, b) => a.order - b.order);
  const topics = [...(raw.topicsDoc?.topics || [])].sort((a, b) => a.order - b.order);
  const resources = [...(raw.resourcesDoc?.resources || [])];
  const anchors = (raw.anchorsDoc?.anchors || []).map(publicAnchor);
  const questions = [];
  const bundled = raw.questionsDoc?.questions || [];
  for (const question of [...bundled, ...importedQuestions]) {
    if (!question?.id || !question.type || !question.stem || !question.provenance?.kind) {
      warnings.push(`题目 ${question?.id || "（无 id）"} 缺少必要字段，已跳过`);
      continue;
    }
    if (questions.some((item) => item.id === question.id)) {
      warnings.push(`题目 ${question.id} 重复，已跳过`);
      continue;
    }
    questions.push(question);
  }
  const subjectMap = indexBy(subjects, "id", warnings, "科目");
  const chapterMap = indexBy(chapters, "id", warnings, "章节");
  const topicMap = indexBy(topics, "id", warnings, "知识点");
  const resourceMap = indexBy(resources, "id", warnings, "资源");
  const questionMap = indexBy(questions, "id", warnings, "题目");
  const edges = (raw.dependenciesDoc?.edges || []).filter((edge) => {
    if (!edge?.topicId || !edge?.prerequisiteId) {
      warnings.push("先修边缺少 topicId 或 prerequisiteId");
      return false;
    }
    if (!topicMap.has(edge.topicId) || !topicMap.has(edge.prerequisiteId)) {
      warnings.push(`先修边 ${edge.topicId} ← ${edge.prerequisiteId} 指向不存在的知识点，已跳过`);
      return false;
    }
    return true;
  });
  const prereqMap = mergePrereqIds(topics, edges);

  return {
    edges,
    disclaimer: raw.topicsDoc?.disclaimer || raw.subjectsDoc?.disclaimer || "",
    warnings,
    subjects,
    chapters,
    topics,
    resources,
    anchors,
    questions,
    subject: (id) => subjectMap.get(id) || null,
    chapter: (id) => chapterMap.get(id) || null,
    topic: (id) => topicMap.get(id) || null,
    resource: (id) => resourceMap.get(id) || null,
    question: (id) => questionMap.get(id) || null,
    visibleSubjects(optionalOn) {
      return subjects.filter((subject) => subject.optional ? Boolean(optionalOn) : true);
    },
    childChapters(parentId, subjectId) {
      return chapters.filter((chapter) => chapter.subject_id === subjectId && chapter.parent_id === parentId);
    },
    topicsOf(chapterId) {
      return topics.filter((topic) => topic.chapter_id === chapterId);
    },
    resourcesForTopic(topicId) {
      return resources.filter((resource) => (resource.topic_ids || []).includes(topicId));
    },
    videosForTopic(topicId) {
      return this.resourcesForTopic(topicId).filter((resource) => resource.kind === "video" && resource.url);
    },
    anchorsForTopic(topicId) {
      return anchors.filter((anchor) => anchor.topic_id === topicId);
    },
    questionsForTopic(topicId) {
      return questions.filter((question) => (question.topic_ids || []).includes(topicId) && !isExcludedQuestionId(question.id));
    },
    prereqIds(topicId) {
      return prereqMap.get(topicId) || [];
    },
    prerequisites(topicId) {
      return this.prereqIds(topicId).map((id) => topicMap.get(id)).filter(Boolean);
    },
    dependents(topicId) {
      return topics.filter((item) => this.prereqIds(item.id).includes(topicId));
    },
    topicIdsForQuestion(questionId) {
      const known = questionMap.get(questionId);
      if (known?.topic_ids?.length) return [...known.topic_ids];
      return topicIdsForQuestionId(questionId);
    },
    primaryVideo(topicId) {
      const videos = this.videosForTopic(topicId);
      if (!videos.length) return { resource: null, anchor: null };
      const anchor = this.anchorsForTopic(topicId).find((item) => item.resource_id === videos[0].id) || null;
      return { resource: videos[0], anchor };
    }
  };
}

export function searchCatalog(catalog, query, notes = [], optionalOn = false) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const hit = (...values) => values.some((value) => String(value || "").toLowerCase().includes(q));
  const hiddenSubject = (subjectId) => {
    const subject = catalog.subject(subjectId);
    return Boolean(subject?.optional && !optionalOn);
  };
  const results = [];
  for (const subject of catalog.subjects) {
    if (subject.optional && !optionalOn) continue;
    if (hit(subject.name, subject.summary, subject.id)) {
      results.push({ type: "科目", title: subject.name, href: `#/subject/${subject.id}`, source: subject.group || "" });
    }
  }
  for (const chapter of catalog.chapters) {
    if (hiddenSubject(chapter.subject_id)) continue;
    if (hit(chapter.title)) {
      results.push({ type: "章节", title: chapter.title, href: `#/subject/${chapter.subject_id}`, source: catalog.subject(chapter.subject_id)?.name || "" });
    }
  }
  for (const topic of catalog.topics) {
    if (hiddenSubject(topic.subject_id)) continue;
    if (hit(topic.title, ...(topic.aliases || []), topic.blurb)) {
      results.push({ type: "知识点", title: topic.title, href: `#/topic/${topic.id}`, source: catalog.subject(topic.subject_id)?.name || "" });
    }
  }
  for (const resource of catalog.resources) {
    if ((resource.topic_ids || []).some((topicId) => hiddenSubject(catalog.topic(topicId)?.subject_id))) continue;
    if (hit(resource.title)) {
      const topicId = resource.topic_ids?.[0];
      const topic = topicId ? catalog.topic(topicId) : null;
      results.push({
        type: resource.kind === "video" ? "视频" : "资料",
        title: resource.title,
        href: topicId ? `#/topic/${topicId}` : "#/subjects",
        source: topic?.title || ""
      });
    }
  }
  for (const question of catalog.questions) {
    if (hiddenSubject(question.subject_id)) continue;
    if (hit(question.stem)) {
      const sample = question.provenance?.kind === "sample";
      results.push({
        type: sample ? "示例" : "题目",
        title: question.stem.slice(0, 42),
        href: `#/quiz/${question.id}`,
        source: sample ? "示例" : "题目"
      });
    }
  }
  for (const note of notes) {
    if (hit(note.title, note.body)) {
      const topicId = note.topic_ids?.[0];
      results.push({ type: "笔记", title: note.title || "笔记", href: topicId ? `#/topic/${topicId}` : "#/notes", source: "本机笔记" });
    }
  }
  return results.slice(0, 40);
}

export function validateImportedQuestion(question) {
  const errors = [];
  if (!question || typeof question !== "object") return ["不是题目对象"];
  if (!question.id) errors.push("题目不完整");
  if (!question.type) errors.push("题目不完整");
  if (!question.stem) errors.push("题目不完整");
  if (!question.subject_id) errors.push("题目不完整");
  if (!Array.isArray(question.topic_ids)) errors.push("题目不完整");
  if (!question.provenance || question.provenance.kind == null) errors.push("题目不完整");
  if (question.revision == null) errors.push("题目不完整");
  return errors;
}
