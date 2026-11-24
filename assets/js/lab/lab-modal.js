// 任意知识点页内嵌「随堂在线实操弹窗/手机底部抽屉」（按需懒加载，零首屏开销）
// 复用 c-runner.js / sql-runner.js / HTML 安全沙箱，电脑端左右分屏、手机端自动切换为底部抽屉 + 写代码/看结果双页签 + 快捷符号键盘。
import { runC } from "./c-runner.js";
import { SqlEngine } from "./sql-runner.js";
import { CODE_SYMBOLS, insertSymbolAtCursor, getTopicLabPreset } from "./topic-labs.js";

const HANDOFF_KEY = "zsb.codelab.handoff";

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "text") node.textContent = v;
    else if (k === "class") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined) node.append(typeof c === "string" ? document.createTextNode(c) : c);
  return node;
}

const DEFAULT_SNIPPETS = {
  c: `#include <stdio.h>\n\nint main() {\n    printf("Hello C 语言实操!\\n");\n    return 0;\n}`,
  html: `<!doctype html>\n<html lang="zh-CN">\n<head><meta charset="utf-8"><style>body{font-family:system-ui,sans-serif;padding:16px;background:#f7f8fa;color:#111318;}</style></head>\n<body>\n  <h3>HTML 实时预览</h3>\n  <p>在这里修改代码，立即查看网页渲染效果。</p>\n</body></html>`,
  sql: `SELECT S.Sno AS 学号, S.Sname AS 姓名, C.Cname AS 课程名, SC.Grade AS 成绩\nFROM Student S\nINNER JOIN SC ON S.Sno = SC.Sno\nINNER JOIN Course C ON SC.Cno = C.Cno\nWHERE SC.Grade >= 85\nORDER BY SC.Grade DESC;`
};

let activeMsgHandler = null;

export function openCodeLabModal({ lang, code, stdin = "", title = "随堂在线代码实操", base = "../", card = null, pageRoot = null } = {}) {
  let dlg = document.getElementById("sys-lab-dialog");
  if (!dlg) {
    dlg = el("dialog", { id: "sys-lab-dialog", class: "sys-dialog sys-lab-dialog", "aria-label": "随堂在线代码实操台" });
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg) dlg.close();
    });
    document.body.append(dlg);
  }

  // 若未显式传入代码，则按知识点自动匹配专属实操预设
  const preset = (!code && card) ? getTopicLabPreset(card, pageRoot) : null;
  let activeLang = ["c", "html", "sql"].includes(lang) ? lang : (preset?.lang || "c");
  const buffers = {
    c: { code: activeLang === "c" ? (code || preset?.code || DEFAULT_SNIPPETS.c) : DEFAULT_SNIPPETS.c, stdin: activeLang === "c" ? (stdin || preset?.stdin || "") : "" },
    html: { code: activeLang === "html" ? (code || preset?.code || DEFAULT_SNIPPETS.html) : DEFAULT_SNIPPETS.html },
    sql: { code: activeLang === "sql" ? (code || preset?.code || DEFAULT_SNIPPETS.sql) : DEFAULT_SNIPPETS.sql }
  };
  const initialBuf = { c: { ...buffers.c }, html: { ...buffers.html }, sql: { ...buffers.sql } };

  const sqlEngine = new SqlEngine();
  let mobilePane = "code"; // 手机端双页签："code" | "output"

  const langBtns = [
    ["c", "C 语言"],
    ["html", "HTML"],
    ["sql", "SQL"]
  ].map(([k, label]) => el("button", {
    type: "button",
    class: `sys-lab-lang-btn${k === activeLang ? " is-on" : ""}`,
    "data-lang": k,
    text: label
  }));

  const mobileTabCode = el("button", { type: "button", class: "sys-lab-mtab is-on", text: "✏️ 写代码" });
  const mobileTabOut = el("button", { type: "button", class: "sys-lab-mtab", text: "▶ 看结果" });

  const symBar = el("div", { class: "lab-sym-bar", role: "toolbar", "aria-label": "快捷编程符号输入条" });
  const editor = el("textarea", {
    class: "sys-lab-editor",
    spellcheck: "false",
    autocomplete: "off",
    autocapitalize: "off",
    "aria-label": "实操代码编辑区"
  });
  const stdinInput = el("input", {
    type: "text",
    class: "sys-lab-stdin",
    placeholder: "标准输入 stdin（供 scanf 读取，如：12 3.14 A）",
    "aria-label": "C 语言标准输入"
  });
  const stdinRow = el("div", { class: "sys-lab-stdin-row" }, [
    el("span", { class: "sys-lab-stdin-label", text: "输入(stdin):" }),
    stdinInput
  ]);
  const sqlStrip = el("div", { class: "sys-lab-sql-strip", hidden: true });
  const outBody = el("div", { class: "sys-lab-out-body" });
  const statusBar = el("div", { class: "sys-lab-status", role: "status", "aria-live": "polite", text: "就绪" });

  const bodyGrid = el("div", { class: "sys-lab-grid", "data-mobile-pane": "code" });
  const codePane = el("div", { class: "sys-lab-pane sys-lab-pane--code" }, [symBar, editor, stdinRow]);
  const outPane = el("div", { class: "sys-lab-pane sys-lab-pane--out" }, [
    el("div", { class: "sys-lab-out-head" }, [
      el("span", { class: "sys-lab-out-title", text: "运行结果" }),
      el("button", {
        type: "button",
        class: "sh-btn sys-lab-back-btn",
        onclick: () => setMobilePane("code"),
        text: "← 返回改代码"
      })
    ]),
    outBody,
    statusBar
  ]);
  bodyGrid.append(codePane, outPane);

  function setMobilePane(pane) {
    mobilePane = pane;
    bodyGrid.setAttribute("data-mobile-pane", pane);
    mobileTabCode.classList.toggle("is-on", pane === "code");
    mobileTabOut.classList.toggle("is-on", pane === "output");
  }

  mobileTabCode.addEventListener("click", () => setMobilePane("code"));
  mobileTabOut.addEventListener("click", () => setMobilePane("output"));

  function renderSymBar() {
    const syms = CODE_SYMBOLS[activeLang] || CODE_SYMBOLS.c;
    symBar.replaceChildren(...syms.map((s) => el("button", {
      type: "button",
      class: "lab-sym-btn",
      onclick: () => insertSymbolAtCursor(editor, s),
      text: s.label
    })));
  }

  function renderSqlStrip() {
    if (activeLang !== "sql") { sqlStrip.hidden = true; return; }
    sqlStrip.hidden = false;
    const schema = sqlEngine.schema();
    sqlStrip.replaceChildren(
      el("span", { class: "sys-lab-sql-label", text: "教务表：" }),
      ...schema.map((t) => el("button", {
        type: "button",
        class: "lab-schema-chip",
        title: t.columns.map((c) => `${c.name} ${c.type}`).join(" · "),
        onclick: () => {
          editor.value = `SELECT * FROM ${t.name};`;
          buffers.sql.code = editor.value;
          runNow(true);
        },
        text: t.rowCount !== null ? `${t.name}(${t.rowCount})` : `👁 ${t.name}`
      }))
    );
  }

  function runHtml() {
    const src = editor.value;
    const fid = "mlab-" + Math.random().toString(36).slice(2, 8);
    const bridge = `<script>(function(){const send=(kind,a)=>parent.postMessage({__zsbLab:"${fid}",kind,text:a.map(x=>{try{return typeof x==="object"?JSON.stringify(x):String(x)}catch{return String(x)}}).join(" ")},"*");["log","warn","error"].forEach(k=>{const o=console[k];console[k]=function(...a){send(k,a);o&&o.apply(console,a);};});window.addEventListener("error",e=>send("error",[e.message]));})();<\/script>`;
    const injected = /<head\b[^>]*>/i.test(src) ? src.replace(/<head\b[^>]*>/i, (m) => m + bridge) : bridge + src;
    const frame = el("iframe", { class: "sys-lab-iframe", sandbox: "allow-scripts allow-forms allow-modals", title: "HTML 随堂预览" });
    frame.srcdoc = injected;
    const cList = el("div", { class: "sys-lab-console", hidden: true });
    if (activeMsgHandler) window.removeEventListener("message", activeMsgHandler);
    activeMsgHandler = (ev) => {
      if (ev.source !== frame.contentWindow || ev.data?.__zsbLab !== fid) return;
      cList.hidden = false;
      cList.append(el("div", { class: `lab-console-line is-${ev.data.kind || "log"}`, text: `[${ev.data.kind}] ${ev.data.text}` }));
    };
    window.addEventListener("message", activeMsgHandler);
    outBody.replaceChildren(frame, cList);
    statusBar.textContent = "✓ HTML + CSS 已在安全沙箱实时渲染";
  }

  function runNow(switchOnMobile = false) {
    const src = editor.value;
    buffers[activeLang].code = src;
    if (activeLang === "c") {
      buffers.c.stdin = stdinInput.value;
      const res = runC(src, buffers.c.stdin);
      const nodes = [];
      if (res.output) nodes.push(el("pre", { class: "sys-lab-pre", text: res.output }));
      else if (res.ok) nodes.push(el("p", { class: "sys-lab-empty", text: "（程序已运行结束，无标准输出）" }));
      if (!res.ok) {
        nodes.push(el("div", { class: "sys-lab-err", text: `✗ ${res.error}` }));
        statusBar.textContent = `✗ 执行报错 · ${res.ms} ms`;
      } else {
        statusBar.textContent = `✓ 运行成功 · 返回 ${res.exitCode} · ${res.ms} ms`;
      }
      outBody.replaceChildren(...nodes);
    } else if (activeLang === "html") {
      runHtml();
    } else {
      const res = sqlEngine.execute(src);
      renderSqlStrip();
      if (!res.ok) {
        outBody.replaceChildren(el("div", { class: "sys-lab-err", text: `✗ ${res.error}` }));
        statusBar.textContent = `✗ SQL 报错 · ${res.ms} ms`;
      } else {
        const blocks = res.results.map((r, i) => {
          if (r.kind === "message") return el("div", { class: "sys-lab-ok", text: `✓ 语句 ${i + 1}：${r.message}` });
          return el("div", { class: "sys-lab-sql-res" }, [
            el("div", { class: "sys-lab-sql-meta", text: `结果集 ${i + 1} · ${r.message}` }),
            el("div", { class: "sys-table-wrap" }, [
              el("table", { class: "sys-lab-table" }, [
                el("thead", {}, [el("tr", {}, r.columns.map((c) => el("th", { text: c })))]),
                el("tbody", {}, r.rows.length
                  ? r.rows.map((row) => el("tr", {}, row.map((cell) => el("td", {
                      class: cell === null || cell === undefined ? "is-null" : null,
                      text: cell === null || cell === undefined ? "NULL" : String(cell)
                    }))))
                  : [el("tr", {}, [el("td", { colspan: Math.max(1, r.columns.length), class: "is-null", text: "（0 行）" })])])
              ])
            ])
          ]);
        });
        outBody.replaceChildren(...(blocks.length ? blocks : [el("p", { class: "sys-lab-empty", text: "请输入 SQL 语句后运行" })]));
        statusBar.textContent = `✓ 执行完成 · ${res.results.length} 条语句 · ${res.ms} ms`;
      }
    }
    if (switchOnMobile && typeof matchMedia === "function" && matchMedia("(max-width: 760px)").matches) {
      setMobilePane("output");
    }
  }

  function switchLang(nextLang) {
    buffers[activeLang].code = editor.value;
    if (activeLang === "c") buffers.c.stdin = stdinInput.value;
    activeLang = nextLang;
    for (const b of langBtns) b.classList.toggle("is-on", b.dataset.lang === nextLang);
    editor.value = buffers[nextLang].code;
    stdinRow.hidden = nextLang !== "c";
    if (nextLang === "c") stdinInput.value = buffers.c.stdin || "";
    renderSymBar();
    renderSqlStrip();
    runNow(false);
  }

  for (const b of langBtns) b.addEventListener("click", () => switchLang(b.dataset.lang));

  editor.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runNow(true); }
    else if (e.key === "Tab") { e.preventDefault(); insertSymbolAtCursor(editor, { insert: "    " }); }
  });

  const runBtn = el("button", { type: "button", class: "sh-btn sh-btn--primary sys-lab-run-btn", onclick: () => runNow(true), text: "▶ 运行" });
  const resetBtn = el("button", {
    type: "button",
    class: "sh-btn sys-lab-mini",
    onclick: () => {
      buffers[activeLang] = { ...initialBuf[activeLang] };
      editor.value = buffers[activeLang].code;
      if (activeLang === "c") stdinInput.value = buffers.c.stdin || "";
      if (activeLang === "sql") sqlEngine.reset();
      renderSqlStrip();
      runNow(false);
    },
    text: "↺ 重置"
  });
  const popoutBtn = el("button", {
    type: "button",
    class: "sh-btn sys-lab-mini",
    onclick: () => {
      try {
        sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({
          lang: activeLang,
          code: editor.value,
          stdin: activeLang === "c" ? stdinInput.value : ""
        }));
      } catch { /* ignore */ }
      location.href = `${base}study/lab.html?lang=${activeLang}&autorun=1`;
    },
    text: "↗ 大屏实操台"
  });
  const closeBtn = el("button", { type: "button", class: "sh-btn sys-lab-mini", onclick: () => dlg.close(), text: "✕ 关闭" });

  dlg.replaceChildren(
    el("div", { class: "sys-lab-head" }, [
      el("div", { class: "sys-lab-head__left" }, [
        el("strong", { class: "sys-lab-title", text: `💻 ${title}` }),
        el("div", { class: "sys-lab-lang-group", role: "tablist" }, langBtns)
      ]),
      el("div", { class: "sys-lab-head__right" }, [runBtn, resetBtn, popoutBtn, closeBtn])
    ]),
    sqlStrip,
    el("div", { class: "sys-lab-mtabs", role: "tablist", "aria-label": "手机端编辑与结果切换" }, [mobileTabCode, mobileTabOut]),
    bodyGrid
  );

  // 初始化当前语言并立即运行一次，让用户点开就能直接看到代码与运行结果
  editor.value = buffers[activeLang].code;
  stdinRow.hidden = activeLang !== "c";
  if (activeLang === "c") stdinInput.value = buffers.c.stdin || "";
  renderSymBar();
  renderSqlStrip();
  setMobilePane("code");

  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "");
  runNow(false);
}
