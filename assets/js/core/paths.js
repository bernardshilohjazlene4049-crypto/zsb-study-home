/** Resolve a repo-relative path without hard-coding the site root. */
export function siteUrl(repoRelative) {
  const rel = String(repoRelative || "").replace(/^\/+/, "");
  const root = new URL("../../../", import.meta.url);
  return new URL(rel, root).href;
}

export function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}
