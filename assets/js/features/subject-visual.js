/** Visual tokens taken from the supplied study workbench, keyed by repo subject id. */
export const SUBJECT_VISUAL = {
  english: { color: "#6c91c8", tint: "#edf3fb", ico: "文" },
  math: { color: "#5d8d9c", tint: "#eaf3f5", ico: "∑" },
  computer_basics: { color: "#6d91bd", tint: "#edf3fa", ico: "⌘" },
  c_language: { color: "#7894b8", tint: "#eff3f8", ico: "C" },
  database: { color: "#6a65a4", tint: "#f1eff9", ico: "DB" },
  web_design: { color: "#bf956e", tint: "#f8f1ea", ico: "</>" },
  network: { color: "#6d9f91", tint: "#edf6f2", ico: "↗" },
  digital_electronics: { color: "#8d93a3", tint: "#f2f3f6", ico: "电" }
};

export function visualFor(id) {
  return SUBJECT_VISUAL[id] || { color: "#89a4d8", tint: "#edf3fb", ico: "·" };
}
