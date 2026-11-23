/** Visual tokens taken from the supplied study workbench, keyed by repo subject id. */
export const SUBJECT_VISUAL = {
  english: { color: "#60a5fa", tint: "#eff4ff", ico: "文" },
  math: { color: "#2563eb", tint: "#eff4ff", ico: "∑" },
  computer_basics: { color: "#60a5fa", tint: "#eff4ff", ico: "⌘" },
  c_language: { color: "#60a5fa", tint: "#eff4ff", ico: "C" },
  database: { color: "#1d4ed8", tint: "#eff4ff", ico: "DB" },
  web_design: { color: "#dc2626", tint: "#fef2f2", ico: "</>" },
  network: { color: "#2563eb", tint: "#eff4ff", ico: "↗" },
  digital_electronics: { color: "#525a68", tint: "#eff4ff", ico: "电" }
};

export function visualFor(id) {
  return SUBJECT_VISUAL[id] || { color: "#60a5fa", tint: "#eff4ff", ico: "·" };
}
