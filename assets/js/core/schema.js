export const SCHEMA_VERSION = 1;
export const DB_NAME = "zsb-study";
export const DB_VERSION = 1;
export const LEARNER_ID = "local-guest";

export const STORE_DEFS = {
  meta: { keyPath: "key" },
  attempts: {
    keyPath: "id",
    indexes: [
      ["question_id", "question_id", { unique: false }],
      ["learner_id", "learner_id", { unique: false }],
      ["submitted_at", "submitted_at", { unique: false }]
    ]
  },
  mistake_entries: {
    keyPath: "id",
    indexes: [
      ["question_id", "question_id", { unique: false }],
      ["learner_question", ["learner_id", "question_id"], { unique: false }]
    ]
  },
  review_events: {
    keyPath: "id",
    indexes: [["mistake_id", "mistake_id", { unique: false }]]
  },
  note_entries: {
    keyPath: "id",
    indexes: [["updated_at", "updated_at", { unique: false }]]
  },
  user_topic_progress: {
    keyPath: "id",
    indexes: [["topic_id", "topic_id", { unique: false }]]
  },
  drafts: { keyPath: "id" },
  playback: { keyPath: "id" },
  marks: { keyPath: "id" },
  imported_questions: { keyPath: "id" }
};

export const UI_KEYS = {
  optionalSubject: "zsb.ui.optional.digital_electronics",
  lastTopic: "zsb.ui.lastTopic",
  lastExportAt: "zsb.ui.lastExportAt",
  tutorApiBase: "zsb.ui.tutorApiBase",
  ocrApiBase: "zsb.ui.ocrApiBase",
  syncApiBase: "zsb.ui.syncApiBase"
};
