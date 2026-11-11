// 搜索结果的标题、分组和状态文案。标题只取页面原文（Pagefind 的 meta.title / 小节 title）。

export function pageHeading(data) {
  return String(data?.meta?.title || "").trim();
}

export function sectionHeading(part, data) {
  const section = String(part?.title || "").trim();
  const page = pageHeading(data);
  if (!section || section === page) return "";
  return section;
}

export function stripHeadingPrefix(excerpt, title) {
  const text = String(excerpt || "").trim();
  const heading = String(title || "").trim();
  if (!text || !heading) return text;
  if (text.startsWith(heading)) {
    return text.slice(heading.length).replace(/^[.。、·\s]+/, "").trim();
  }
  // Pagefind 有时会从标题中间截断摘要；只在后面紧跟分隔符时去掉标题尾巴，避免误伤正文。
  for (let i = 1; i < heading.length; i++) {
    const tail = heading.slice(i);
    if (text.startsWith(tail) && /[.。、\s]/.test(text.charAt(tail.length) || "")) {
      return text.slice(tail.length).replace(/^[.。、·\s]+/, "").trim();
    }
  }
  return text;
}

export function excerptText(part, data) {
  const raw = String(part?.excerpt || data?.plain_excerpt || "").replace(/<[^>]*>/g, "").trim();
  return stripHeadingPrefix(raw, part?.title || "");
}

export function pickSubResults(entry, limit = 3) {
  const subs = [...(entry?.sub_results || [])].sort(
    (a, b) =>
      (b.weighted_locations?.length || b.locations?.length || 0) -
      (a.weighted_locations?.length || a.locations?.length || 0)
  );
  return (subs.length ? subs : [null]).slice(0, limit);
}

export function groupResults(entries, limit = 3) {
  return (entries || []).map((entry) => {
    const parts = pickSubResults(entry, limit);
    return { entry, parts, pageTitle: pageHeading(entry) };
  });
}

export function statusMessage(pageCount, itemCount) {
  if (!itemCount) return "没有找到相关课程";
  if (pageCount === itemCount) return `找到 ${pageCount} 个匹配页面`;
  return `找到 ${pageCount} 个匹配页面，共 ${itemCount} 条结果`;
}

export function resultHref(url) {
  // 构建时补的 “<section id>-h” 标题锚点 → 跳到 section 本身（页面目录用的同一锚点，带顶栏留白）。
  return String(url || "").replace(/#([^#]+)-h$/, "#$1");
}
