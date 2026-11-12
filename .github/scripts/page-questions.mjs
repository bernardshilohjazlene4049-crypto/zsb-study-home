// 从正文页生成可作答题目清单 data/page-questions.json（学习总览的“各科进度”分母）。
// 用法：node .github/scripts/page-questions.mjs [--write]
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { isExcludedQuestionId } from "../../assets/js/features/topic-index.js";

const SAFE = /[^0-9A-Za-z_.\-]/g;

export function scanPage(file, html) {
  const tag = html.match(/<script[^>]*page-study\.js[^>]*>/);
  if (!tag) return null;
  const attr = (name) => (tag[0].match(new RegExp(`data-${name}="([^"]*)"`)) || [])[1] || "";
  const page = attr("page");
  const subject = attr("subject");
  if (!page || !subject) return null;
  const items = [];
  for (const m of html.matchAll(/class="[^"]*\bquiz-question\b[^"]*"[^>]*data-question="([^"]+)"/g)) items.push(m[1]);
  let n = 0;
  for (const _ of html.matchAll(/class="qitem"[^>]*data-answer=/g)) items.push(String(++n));
  for (const m of html.matchAll(/data-zsb-question="([^"]+)"/g)) items.push(m[1]);
  const questions = [...new Set(items)].map((item) => `page:${page}:${item.replace(SAFE, "-")}`).filter((id) => !isExcludedQuestionId(id));
  return { subject, url: file, questions };
}

export function buildRegistry(files, read = (f) => readFileSync(f, "utf8")) {
  const bySubject = new Map();
  for (const file of [...files].sort()) {
    const row = scanPage(file, read(file));
    if (!row || !row.questions.length) continue;
    const group = bySubject.get(row.subject) || { id: row.subject, url: row.url, pages: [], questions: [] };
    group.pages.push(row.url);
    group.questions.push(...row.questions);
    bySubject.set(row.subject, group);
  }
  return { schema_version: 1, subjects: [...bySubject.values()] };
}

export function listHtml() {
  return execFileSync("git", ["ls-files", "*.html"], { encoding: "utf8" }).split("\n").filter(Boolean);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const json = JSON.stringify(buildRegistry(listHtml()), null, 2) + "\n";
  if (process.argv.includes("--write")) writeFileSync("data/page-questions.json", json);
  else process.stdout.write(json);
}
