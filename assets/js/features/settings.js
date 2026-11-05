import { h } from "../core/dom.js";
import { SCHEMA_VERSION, UI_KEYS } from "../core/schema.js";
import { exportBundle, importBundle, wipeLocalLearningData } from "../core/backup.js";
import { getAll, put } from "../core/storage.js";
import { validateImportedQuestion } from "./catalog.js";
import { getAiStatus, getLabsStatus, getOcrStatus, getSyncStatus } from "../adapters/status.js";

export function renderSettings(ctx) {
  const report = h("div", { class: "notice", role: "status" });
  const optional = h("input", { type: "checkbox" });
  optional.checked = ctx.optionalOn;
  optional.addEventListener("change", () => {
    try { localStorage.setItem(UI_KEYS.optionalSubject, optional.checked ? "1" : "0"); } catch { /* ignore */ }
    ctx.render();
  });
  return h("div", { class: "stack" }, [
    h("header", { class: "page-head" }, [
      h("h1", {}, "资料与设置"),
      h("p", { class: "muted" }, `数据版本 ${SCHEMA_VERSION}。学习记录在本机 IndexedDB，这里的开关只放在 localStorage。`)
    ]),
    report,
    h("section", { class: "panel stack" }, [
      h("h2", {}, "可选科目"),
      h("label", { class: "choice" }, [optional, h("span", {}, "显示数字电子技术（不计入七科，也不改已有记录）")])
    ]),
    h("section", { class: "panel stack" }, [
      h("h2", {}, "导出与恢复"),
      h("p", { class: "muted" }, "导出文件含 schema_version。导入时按编号去重；作答记录不会被同编号覆盖，同一题的错题档案会合并并保留首次错误。"),
      h("div", { class: "row" }, [
        h("button", { class: "btn btn-primary", type: "button", onclick: () => downloadBackup(ctx, report) }, "导出 JSON"),
        h("label", { class: "btn" }, ["导入学习备份", h("input", { class: "file-input", type: "file", accept: "application/json", onchange: (event) => importLearning(ctx, event, report) })])
      ])
    ]),
    h("section", { class: "panel stack" }, [
      h("h2", {}, "导入题目"),
      h("p", { class: "muted" }, "每题必须有 provenance.kind。缺字段的题目会被拒绝。示例题仍然不进真实统计。"),
      h("label", { class: "btn" }, ["选择题目 JSON", h("input", { class: "file-input", type: "file", accept: "application/json", onchange: (event) => importQuestions(ctx, event, report) })])
    ]),
    h("section", { class: "panel stack" }, [
      h("h2", {}, "服务状态"),
      h("ul", { class: "stack" }, [
        h("li", {}, getAiStatus().message),
        h("li", {}, getOcrStatus().message),
        h("li", {}, getSyncStatus().message),
        h("li", {}, getLabsStatus().message)
      ]),
      serviceField("辅导地址（不含密钥）", UI_KEYS.tutorApiBase),
      serviceField("识题地址（不含密钥）", UI_KEYS.ocrApiBase),
      serviceField("同步地址（不含密钥）", UI_KEYS.syncApiBase)
    ]),
    h("section", { class: "panel stack" }, [
      h("h2", {}, "清空本机学习记录"),
      h("p", { class: "muted" }, "只清空这台浏览器里的记录和导入题，不会删除仓库中的示例题文件。"),
      h("button", {
        class: "btn",
        type: "button",
        onclick: async (event) => {
          const button = event.currentTarget;
          if (button.dataset.armed !== "yes") {
            button.dataset.armed = "yes";
            button.textContent = "再次点击确认清空";
            return;
          }
          if (!ctx.dbOk) {
            report.textContent = "数据库不可用，没有可清空的内容。";
            return;
          }
          await wipeLocalLearningData();
          await ctx.reload();
          ctx.setNotice("本机学习记录已清空。仓库里的示例题文件还在。");
          ctx.render();
        }
      }, "清空本机学习记录")
    ])
  ]);
}

function serviceField(label, key) {
  let current = "";
  try { current = localStorage.getItem(key) || ""; } catch { /* ignore */ }
  const input = h("input", { type: "url", value: current, placeholder: "https://example.com", autocomplete: "off" });
  return h("label", { class: "stack" }, [
    label,
    input,
    h("button", {
      class: "btn",
      type: "button",
      onclick: () => {
        try { localStorage.setItem(key, input.value.trim()); } catch { /* ignore */ }
      }
    }, "保存地址")
  ]);
}

async function downloadBackup(ctx, report) {
  if (!ctx.dbOk) {
    report.textContent = "数据库不可用，无法导出。";
    return;
  }
  const bundle = await exportBundle();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = h("a", { href: url, download: "zsb-study-backup.json" });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  try { localStorage.setItem(UI_KEYS.lastExportAt, bundle.exported_at); } catch { /* ignore */ }
  report.textContent = `已导出。作答 ${bundle.stores.attempts?.length || 0} 条，错题档案 ${bundle.stores.mistake_entries?.length || 0} 条。`;
}

async function importLearning(ctx, event, report) {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = "";
  if (!file || !ctx.dbOk || ctx.readOnly) {
    report.textContent = "现在不能导入。";
    return;
  }
  try {
    const data = JSON.parse(await file.text());
    const result = await importBundle(data);
    await ctx.reload();
    ctx.setNotice(`导入完成。新增作答 ${result.added.attempts || 0} 条，跳过重复作答 ${result.skipped.attempts || 0} 条，合并错题档案 ${result.mergedMistakes} 份。`);
    ctx.render();
  } catch (error) {
    report.textContent = error.message || "导入失败，本机记录没有按这份文件改写。";
  }
}

async function importQuestions(ctx, event, report) {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = "";
  if (!file || !ctx.dbOk || ctx.readOnly) {
    report.textContent = "现在不能导入题目。";
    return;
  }
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : data.questions;
    if (!Array.isArray(list)) throw new Error("题目文件里没有 questions 数组。");
    const existing = new Set((await getAll("imported_questions")).map((item) => item.id));
    let added = 0;
    let skipped = 0;
    const problems = [];
    for (const question of list) {
      const errors = validateImportedQuestion(question);
      if (errors.length) {
        problems.push(`${question?.id || "（无 id）"}：${errors.join("、")}`);
        skipped += 1;
        continue;
      }
      if (existing.has(question.id) || ctx.catalog.question(question.id)) {
        skipped += 1;
        continue;
      }
      await put("imported_questions", { ...question, schema_version: question.schema_version || SCHEMA_VERSION });
      existing.add(question.id);
      added += 1;
    }
    await ctx.reload();
    ctx.setNotice(`题目导入 ${added} 道，跳过 ${skipped} 道。${problems.slice(0, 3).join(" ")}`);
    ctx.render();
  } catch (error) {
    report.textContent = error.message || "题目文件无法解析。";
  }
}
