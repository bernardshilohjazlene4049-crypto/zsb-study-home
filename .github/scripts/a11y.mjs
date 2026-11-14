// 可访问性检查：用 axe-core 扫描关键页面，把结果写进 CI 摘要。
// A11Y_FAIL=1 时出现 serious/critical 问题即失败（CI 已开启）。
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { appendFileSync } from "node:fs";

const BASE = process.env.SITE_BASE || "http://127.0.0.1:8080/";
const PAGES = [
  "index.html", "gs/index.html", "gs/gs1.html", "gs/gs45.html", "yy/index.html", "yy/yy5.html",
  "c/index.html", "jsj/index.html", "wy/index.html", "wy/html5/webstorage.html", "wy/html/quiz.html",
  "wy/ch1/index.html", "wy/ch2/index.html", "wy/ch1/s11.html", "wy/ch2/s21.html", "wy/ch2/s24.html",
  "study/index.html", "study/overview.html", "search.html",
  "study/graph.html", "study/index.html#/mistakes", "tower/index.html", "search.html?q=极限"
];
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const rows = [];
let serious = 0;
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  for (const p of PAGES) {
    const page = await ctx.newPage();
    await page.goto(BASE + p, { waitUntil: "load" });
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    for (const v of r.violations) {
      if (v.impact === "serious" || v.impact === "critical") serious += v.nodes.length;
      rows.push(`| ${w} | ${p} | ${v.impact} | ${v.id} | ${v.nodes.length} |`);
    }
    await page.close();
  }
  await ctx.close();
}
await browser.close();
const text = [
  "## 可访问性抽查（axe-core，WCAG 2.1 A/AA）", "",
  `- 页面：${PAGES.length} 个 × 2 种宽度`, `- 问题条目：${rows.length}`, `- serious/critical 节点数：${serious}`, "",
  rows.length ? "| 宽度 | 页面 | 级别 | 规则 | 节点数 |\n|---|---|---|---|---|\n" + rows.join("\n") : "未发现问题。", ""
].join("\n");
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n");
process.exit(process.env.A11Y_FAIL === "1" && serious ? 1 : 0);
