// 在线代码实操台控制器：支持 C 语言 / HTML(+CSS+JS) / SQL 语句三环境独立编辑与即时运行
import { runC } from "./c-runner.js";
import { SqlEngine } from "./sql-runner.js";
import { CODE_SYMBOLS, insertSymbolAtCursor } from "./topic-labs.js";

const STORAGE_PREFIX = "zsb.codelab.v1.";
const HANDOFF_KEY = "zsb.codelab.handoff";

export const TEMPLATES = {
  c: [
    {
      id: "c-ptr2d",
      name: "二维数组与指针 8 大等价公式（第9章）",
      stdin: "",
      code: `#include <stdio.h>

int main() {
    int a[3][4] = {
        {1, 2, 3, 4},
        {5, 6, 7, 8},
        {9, 10, 11, 12}
    };
    int *p = a[0];

    printf("a[1][2]        = %d\\n", a[1][2]);
    printf("*(*(a+1)+2)    = %d\\n", *(*(a + 1) + 2));
    printf("**a            = %d\\n", **a);
    printf("*(*a+3)        = %d\\n", *(*a + 3));
    printf("sizeof(a)      = %d B\\n", sizeof(a));
    printf("sizeof(a[0])   = %d B\\n", sizeof(a[0]));
    printf("sizeof(p)      = %d B (32位指针恒为4B)\\n", sizeof(p));
    return 0;
}`
    },
    {
      id: "c-static",
      name: "static 静态局部变量与作用域（第8章）",
      stdin: "",
      code: `#include <stdio.h>

int f() {
    static int a = 2;   // 仅第 1 次调用初始化，保留上次值
    int b = 1;          // 普通局部变量每次调用重置为 1
    a += 2;
    b += 2;
    return a + b;
}

int main() {
    int r1 = f();
    int r2 = f();
    int r3 = f();
    printf("第1次=%d, 第2次=%d, 第3次=%d\\n", r1, r2, r3);
    return 0;
}`
    },
    {
      id: "c-pass",
      name: "函数值传递 vs 指针传递 (*x)++（第8章）",
      stdin: "",
      code: `#include <stdio.h>

void swapVal(int x, int y) {
    int t = x; x = y; y = t;   // 值传递：绝不能修改实参
}

void swapPtr(int *x, int *y) {
    int t = *x; *x = *y; *y = t; // 指针传递：通过 * 修改实参
}

void inc(int *p) {
    (*p)++;                    // 注意括号 (*p)++ 不可省！
}

int main() {
    int a = 3, b = 5;
    swapVal(a, b);
    printf("值传递后: a=%d, b=%d\\n", a, b);

    swapPtr(&a, &b);
    printf("指针交换后: a=%d, b=%d\\n", a, b);

    inc(&a);
    printf("inc(&a) 后: a=%d\\n", a);
    return 0;
}`
    },
    {
      id: "c-scanf",
      name: "scanf 输入 + printf 对齐与精度（第4章）",
      stdin: "12 3.14159 A",
      code: `#include <stdio.h>

int main() {
    int n;
    double x;
    char ch;
    scanf("%d %lf %c", &n, &x, &ch);
    printf("整数=%d，八进制=%o，十六进制=%x\\n", n, n, n);
    printf("右对齐[%8.2f] | 左对齐[%-8.2f]\\n", x, x);
    printf("字符 '%c' 的 ASCII=%d，小写='%c'\\n", ch, ch, ch + 32);
    return 0;
}`
    },
    {
      id: "c-diag",
      name: "方阵主对角线与副对角线求和（第7章）",
      stdin: "",
      code: `#include <stdio.h>

int main() {
    int a[3][3] = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}};
    int i, mainSum = 0, subSum = 0;
    for (i = 0; i < 3; i++) {
        mainSum += a[i][i];       // 主对角线：i == j
        subSum += a[i][2 - i];    // 副对角线：i + j == n - 1
    }
    printf("主对角线和 = %d\\n", mainSum);
    printf("副对角线和 = %d\\n", subSum);
    return 0;
}`
    },
    {
      id: "c-str",
      name: "字符数组、strlen 与 sizeof 辨析（第7章）",
      stdin: "",
      code: `#include <stdio.h>
#include <string.h>

int main() {
    char s[20] = "Hello";
    printf("初始: %s | strlen=%d | sizeof=%d\\n", s, strlen(s), sizeof(s));
    strcat(s, " C!");
    printf("拼接后: %s | strlen=%d\\n", s, strlen(s));
    s[5] = '\\0';
    printf("写入 \\\\0 截断后: %s | strlen=%d\\n", s, strlen(s));
    return 0;
}`
    },
    {
      id: "c-loop",
      name: "100–999 水仙花数与九九乘法表（第6章）",
      stdin: "",
      code: `#include <stdio.h>

int main() {
    int n, a, b, c;
    printf("水仙花数：");
    for (n = 100; n <= 999; n++) {
        a = n / 100;
        b = n / 10 % 10;
        c = n % 10;
        if (a*a*a + b*b*b + c*c*c == n) {
            printf("%d ", n);
        }
    }
    printf("\\n\\n九九乘法表（前5行）：\\n");
    for (int i = 1; i <= 5; i++) {
        for (int j = 1; j <= i; j++) {
            printf("%dx%d=%-2d ", j, i, i * j);
        }
        printf("\\n");
    }
    return 0;
}`
    }
  ],
  html: [
    {
      id: "html-card",
      name: "HTML5 语义布局 + Flexbox 卡片",
      code: `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: system-ui, "PingFang SC", "Microsoft YaHei", sans-serif;
      background: #f7f8fa;
      color: #111318;
    }
    .nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #d8dee6;
      margin-bottom: 16px;
    }
    .nav a {
      color: #1d4ed8;
      text-decoration: none;
      font-weight: 600;
      margin-left: 12px;
    }
    .grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .card {
      flex: 1 1 180px;
      padding: 16px;
      border-radius: 12px;
      background: #ffffff;
      border: 1px solid #d8dee6;
      border-top: 3px solid #1d4ed8;
    }
    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: #fef2f2;
      color: #991b1b;
      font-size: 12px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <header class="nav">
    <strong>专升本 · 网页设计实操</strong>
    <nav>
      <a href="#html">HTML5</a>
      <a href="#css">Flexbox</a>
      <a href="#js">DOM</a>
    </nav>
  </header>
  <main class="grid">
    <article class="card">
      <span class="tag">考点 1</span>
      <h3>语义化标签</h3>
      <p>header、nav、main、article 让页面结构更清晰。</p>
    </article>
    <article class="card">
      <span class="tag">考点 2</span>
      <h3>弹性盒布局</h3>
      <p>display: flex 搭配 flex-wrap 轻松实现响应式排版。</p>
    </article>
  </main>
</body>
</html>`
    },
    {
      id: "html-form",
      name: "HTML5 表单元素与 JS 校验",
      code: `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, sans-serif; padding: 20px; background: #f7f8fa; color: #111318; }
    form { max-width: 380px; padding: 18px; border-radius: 12px; background: #ffffff; border: 1px solid #d8dee6; display: grid; gap: 10px; }
    label { font-size: 13px; font-weight: 600; display: grid; gap: 4px; }
    input, select { padding: 8px 10px; border: 1px solid #bfc7d4; border-radius: 8px; font: inherit; }
    button { padding: 9px 14px; border: 0; border-radius: 8px; background: #1d4ed8; color: #fff; font-weight: 600; cursor: pointer; }
    #msg { margin: 0; font-size: 13px; color: #991b1b; }
  </style>
</head>
<body>
  <form id="regForm">
    <h3 style="margin:0">考生信息登记</h3>
    <label>姓名：<input id="name" placeholder="请输入姓名" required></label>
    <label>报考科目：
      <select id="subj">
        <option value="C语言">C 语言</option>
        <option value="数据库">数据库 (SQL Server)</option>
        <option value="网页设计">网页设计</option>
      </select>
    </label>
    <button type="submit">提交登记</button>
    <p id="msg"></p>
  </form>
  <script>
    document.getElementById("regForm").addEventListener("submit", function (e) {
      e.preventDefault();
      const name = document.getElementById("name").value.trim();
      const subj = document.getElementById("subj").value;
      document.getElementById("msg").textContent = "登记成功：" + name + " — " + subj;
      console.log("提交数据:", { name, subj });
    });
  </script>
</body>
</html>`
    },
    {
      id: "html-table",
      name: "跨行跨列表格 (rowspan / colspan)",
      code: `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, sans-serif; padding: 20px; background: #f7f8fa; color: #111318; }
    table { width: 100%; border-collapse: collapse; background: #ffffff; }
    th, td { border: 1px solid #bfc7d4; padding: 10px; text-align: center; }
    thead th { background: #eff4ff; color: #1e3a8a; }
    caption { font-weight: 700; margin-bottom: 10px; }
  </style>
</head>
<body>
  <table>
    <caption>专升本复习课表（演示 colspan 与 rowspan）</caption>
    <thead>
      <tr><th>时段</th><th>周一</th><th>周二</th><th>周三</th></tr>
    </thead>
    <tbody>
      <tr><th rowspan="2">上午</th><td>高等数学</td><td>C 语言</td><td>英语</td></tr>
      <tr><td colspan="2">计算机网络 · 子网划分专项</td><td>网页设计</td></tr>
      <tr><th>下午</th><td colspan="3">数据库 SQL Server 上机实操</td></tr>
    </tbody>
  </table>
</body>
</html>`
    },
    {
      id: "html-selector-pos",
      name: "CSS 选择器权重与定位（position / 伪类）",
      code: `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: system-ui, sans-serif; padding: 22px; background: #f7f8fa; color: #111318; }
    .card { position: relative; max-width: 360px; margin: 0 auto; padding: 22px 20px; border-radius: 14px; background: #ffffff; border: 1px solid #bfdbfe; }
    .badge { position: absolute; top: -10px; right: 16px; padding: 3px 10px; border-radius: 999px; background: #b91c1c; color: #ffffff; font-size: 12px; font-weight: 700; }
    ul { margin: 12px 0 0; padding-left: 18px; line-height: 1.8; }
    li:nth-child(odd) { color: #1e3a8a; font-weight: 600; }
    a:link, a:visited { color: #1d4ed8; text-decoration: none; }
    a:hover { color: #b91c1c; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">子绝父相</span>
    <h3 style="margin:0">CSS 定位与伪类顺序（LVHA）</h3>
    <ul>
      <li>1. 行内样式(1000) &gt; ID(100) &gt; 类/伪类(10) &gt; 标签(1)</li>
      <li>2. 链接伪类必背顺序：<a href="#demo">a:link → :visited → :hover → :active</a></li>
      <li>3. 绝对定位元素相对于最近非 static 祖先定位</li>
    </ul>
  </div>
</body>
</html>`
    }
  ],
  sql: [
    {
      id: "sql-overview",
      name: "查看教务四表（Student / Course / SC / Dept）",
      code: `-- 点击运行可同时查看多条 SELECT 结果表
SELECT * FROM Student;
SELECT * FROM Course;
SELECT TOP 6 * FROM SC ORDER BY Grade DESC;`
    },
    {
      id: "sql-where",
      name: "条件查询：WHERE / BETWEEN / IN / LIKE / IS NULL",
      code: `-- 1. 查找 CS 或 SE 系、年龄在 19~20 岁的学生
SELECT Sno AS 学号, Sname AS 姓名, Sage AS 年龄, Sdept AS 院系
FROM Student
WHERE Sdept IN ('CS', 'SE') AND Sage BETWEEN 19 AND 20
ORDER BY Sage ASC, Sno ASC;

-- 2. 模糊查询姓“李”或姓“林”的学生（SQL Server 字符集写法）
SELECT Sno, Sname, Sdept FROM Student WHERE Sname LIKE '[李林]%';

-- 3. 查找缺考（成绩为空 NULL）的选课记录
SELECT Sno, Cno, Grade FROM SC WHERE Grade IS NULL;`
    },
    {
      id: "sql-join",
      name: "多表连接：INNER JOIN 与自连接查先修课",
      code: `-- 1. 查询每个学生所选课程名称与成绩（三表连接）
SELECT S.Sno AS 学号, S.Sname AS 姓名, C.Cname AS 课程名, SC.Grade AS 成绩
FROM Student S
INNER JOIN SC ON S.Sno = SC.Sno
INNER JOIN Course C ON SC.Cno = C.Cno
WHERE SC.Grade >= 85
ORDER BY SC.Grade DESC;

-- 2. 自连接：查询每门课及其先修课名称（LEFT JOIN 保留无先修课课程）
SELECT C1.Cno AS 课程号, C1.Cname AS 课程名, ISNULL(C2.Cname, '无先修课') AS 先修课
FROM Course C1
LEFT JOIN Course C2 ON C1.Cpno = C2.Cno;`
    },
    {
      id: "sql-group",
      name: "分组聚合：GROUP BY + HAVING + COUNT/AVG/MAX",
      code: `-- 1. 统计各门课程选课人数、实考人数、平均分与最高分（注意 COUNT(*) vs COUNT(Grade)）
SELECT C.Cno AS 课程号, C.Cname AS 课程名,
       COUNT(*) AS 选课人数,
       COUNT(SC.Grade) AS 实考人数,
       AVG(SC.Grade) AS 平均分,
       MAX(SC.Grade) AS 最高分
FROM Course C
INNER JOIN SC ON C.Cno = SC.Cno
GROUP BY C.Cno, C.Cname
HAVING COUNT(*) >= 2
ORDER BY 平均分 DESC;`
    },
    {
      id: "sql-subquery",
      name: "嵌套子查询：高于平均分 / IN / EXISTS",
      code: `-- 1. 查询 C01 课程成绩高于该课平均分的学生学号、姓名和成绩
SELECT S.Sno AS 学号, S.Sname AS 姓名, SC.Grade AS 成绩
FROM Student S
INNER JOIN SC ON S.Sno = SC.Sno
WHERE SC.Cno = 'C01'
  AND SC.Grade > (SELECT AVG(Grade) FROM SC WHERE Cno = 'C01')
ORDER BY SC.Grade DESC;

-- 2. 查询选修了“数据库原理(SQL Server)”的学生名单（IN 子查询）
SELECT Sno, Sname, Sdept
FROM Student
WHERE Sno IN (
    SELECT Sno FROM SC
    WHERE Cno = (SELECT Cno FROM Course WHERE Cname LIKE '数据库%')
);`
    },
    {
      id: "sql-dml",
      name: "建表 / 插入 / 修改 / 删除 + 视图完整演练",
      code: `-- 1. 新建一张“错题本”练习表（DDL）
DROP TABLE IF EXISTS StudyLog;
CREATE TABLE StudyLog (
    LogId INT PRIMARY KEY,
    Subject VARCHAR(20) NOT NULL,
    Score INT DEFAULT 0
);

-- 2. 插入、更新与删除数据（DML）
INSERT INTO StudyLog (LogId, Subject, Score) VALUES
    (1, 'C语言', 88),
    (2, '数据库(SQL)', 92),
    (3, '网页设计', 79);

UPDATE StudyLog SET Score = Score + 5 WHERE Subject = '网页设计';
DELETE FROM StudyLog WHERE LogId = 1;

-- 3. 创建视图并查询
CREATE VIEW V_HighScore AS
SELECT S.Sname, SC.Cno, SC.Grade
FROM Student S JOIN SC ON S.Sno = SC.Sno
WHERE SC.Grade >= 90;

SELECT * FROM StudyLog;
SELECT * FROM V_HighScore ORDER BY Grade DESC;`
    }
  ]
};

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

export function mountCodeLab() {
  const root = document.getElementById("lab-app");
  if (!root) return;

  const params = new URLSearchParams(location.search);
  let activeLang = ["c", "html", "sql"].includes((params.get("lang") || "").toLowerCase())
    ? params.get("lang").toLowerCase()
    : "c";

  const sqlEngine = new SqlEngine();
  const state = {
    c: { code: TEMPLATES.c[0].code, stdin: TEMPLATES.c[0].stdin || "", tplId: TEMPLATES.c[0].id },
    html: { code: TEMPLATES.html[0].code, tplId: TEMPLATES.html[0].id, live: true, mobilePreview: false },
    sql: { code: TEMPLATES.sql[0].code, tplId: TEMPLATES.sql[0].id }
  };

  // 恢复本地保存的草稿
  for (const lang of ["c", "html", "sql"]) {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + lang);
      if (saved) state[lang].code = saved;
      if (lang === "c") {
        const savedIn = localStorage.getItem(STORAGE_PREFIX + "c_stdin");
        if (savedIn !== null) state.c.stdin = savedIn;
      }
    } catch { /* ignore */ }
  }

  // 检查是否从讲义页「▶ 在线运行」带代码跳转过来
  let autoRun = params.get("autorun") === "1";
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (raw) {
      const payload = JSON.parse(raw);
      sessionStorage.removeItem(HANDOFF_KEY);
      if (payload?.code && ["c", "html", "sql"].includes(payload.lang)) {
        activeLang = payload.lang;
        state[activeLang].code = payload.code;
        if (payload.lang === "c" && typeof payload.stdin === "string") state.c.stdin = payload.stdin;
        autoRun = true;
      }
    }
  } catch { /* ignore */ }

  // DOM 节点引用
  const langTabs = [...root.querySelectorAll("[data-lab-lang]")];
  const tplSelect = document.getElementById("lab-template");
  const runBtn = document.getElementById("lab-run");
  const resetBtn = document.getElementById("lab-reset");
  const copyBtn = document.getElementById("lab-copy");
  const editor = document.getElementById("lab-editor");
  const gutter = document.getElementById("lab-gutter");
  const statusEl = document.getElementById("lab-status");
  const stdinWrap = document.getElementById("lab-stdin-wrap");
  const stdinInput = document.getElementById("lab-stdin");
  const outHeadTitle = document.getElementById("lab-out-title");
  const outTools = document.getElementById("lab-out-tools");
  const outBody = document.getElementById("lab-out-body");
  const sqlSchemaWrap = document.getElementById("lab-sql-schema");
  const langHint = document.getElementById("lab-lang-hint");
  const symBar = document.getElementById("lab-sym-bar");
  const labGrid = document.getElementById("lab-grid");
  const mobileTabCode = document.getElementById("lab-mtab-code");
  const mobileTabOut = document.getElementById("lab-mtab-out");
  const backToCodeBtn = document.getElementById("lab-back-code");

  function setMobilePane(pane) {
    if (!labGrid) return;
    labGrid.setAttribute("data-mobile-pane", pane);
    mobileTabCode?.classList.toggle("is-on", pane === "code");
    mobileTabCode?.setAttribute("aria-selected", String(pane === "code"));
    mobileTabOut?.classList.toggle("is-on", pane === "output");
    mobileTabOut?.setAttribute("aria-selected", String(pane === "output"));
  }
  mobileTabCode?.addEventListener("click", () => setMobilePane("code"));
  mobileTabOut?.addEventListener("click", () => setMobilePane("output"));
  backToCodeBtn?.addEventListener("click", () => setMobilePane("code"));

  function renderSymBar() {
    if (!symBar) return;
    const syms = CODE_SYMBOLS[activeLang] || CODE_SYMBOLS.c;
    symBar.replaceChildren(...syms.map((s) => el("button", {
      type: "button",
      class: "lab-sym-btn",
      onclick: () => {
        insertSymbolAtCursor(editor, s);
        syncGutter();
      },
      text: s.label
    })));
  }

  function syncGutter() {
    const count = Math.max(1, editor.value.split("\n").length);
    let lines = "";
    for (let i = 1; i <= count; i++) lines += i + "\n";
    gutter.textContent = lines;
    gutter.scrollTop = editor.scrollTop;
  }

  function populateTemplates() {
    const list = TEMPLATES[activeLang];
    tplSelect.replaceChildren(
      ...list.map((t) => el("option", { value: t.id, text: t.name }))
    );
    tplSelect.value = state[activeLang].tplId || list[0].id;
  }

  function renderSqlSchema() {
    if (activeLang !== "sql") {
      sqlSchemaWrap.hidden = true;
      return;
    }
    sqlSchemaWrap.hidden = false;
    const schema = sqlEngine.schema();
    const chips = schema.map((item) => {
      const btn = el("button", {
        type: "button",
        class: "lab-schema-chip",
        title: item.columns.length ? item.columns.map((c) => `${c.name} ${c.type}${c.pk ? " (PK)" : ""}`).join(" · ") : "点击查询视图"
      }, [
        el("strong", { text: item.kind === "view" ? `👁 ${item.name}` : item.name }),
        item.rowCount !== null ? el("span", { text: `${item.rowCount} 行` }) : el("span", { text: "视图" })
      ]);
      btn.addEventListener("click", () => {
        editor.value = `SELECT * FROM ${item.name};`;
        state.sql.code = editor.value;
        syncGutter();
        runActive();
      });
      return btn;
    });
    const resetDbBtn = el("button", {
      type: "button",
      class: "sh-btn lab-mini-btn",
      onclick: () => {
        sqlEngine.reset();
        renderSqlSchema();
        statusEl.textContent = "✓ 已重置为初始教务四表（Dept / Student / Course / SC）";
      },
      text: "↺ 重置示例库"
    });
    sqlSchemaWrap.replaceChildren(
      el("div", { class: "lab-schema-head" }, [
        el("span", { class: "lab-schema-label", text: "当前数据库表（点击表名查看全表，悬停看字段）：" }),
        resetDbBtn
      ]),
      el("div", { class: "lab-schema-list" }, chips)
    );
  }

  let htmlMsgHandler = null;
  function runHtmlPreview() {
    const code = editor.value;
    const frameId = "lab-html-" + Math.random().toString(36).slice(2, 8);
    // 在沙箱 iframe 内拦截 console 与错误并回传父页
    const bridge = `<script>(function(){const send=(kind,args)=>parent.postMessage({__zsbLab:"${frameId}",kind,text:args.map(a=>{try{return typeof a==="object"?JSON.stringify(a):String(a)}catch{return String(a)}}).join(" ")},"*");["log","warn","error"].forEach(k=>{const orig=console[k];console[k]=function(...a){send(k,a);orig&&orig.apply(console,a);};});window.addEventListener("error",e=>send("error",[e.message+(e.lineno?" (行 "+e.lineno+")":"")]));})();<\/script>`;
    const injected = /<head\b[^>]*>/i.test(code)
      ? code.replace(/<head\b[^>]*>/i, (m) => m + bridge)
      : bridge + code;

    const frame = el("iframe", {
      class: `lab-html-frame${state.html.mobilePreview ? " is-mobile" : ""}`,
      sandbox: "allow-scripts allow-forms allow-modals",
      title: "HTML 实时渲染预览"
    });
    frame.srcdoc = injected;

    const consoleBox = el("div", { class: "lab-html-console", hidden: true });
    const consoleList = el("div", { class: "lab-html-console__list" });
    consoleBox.append(el("div", { class: "lab-html-console__head", text: "Console 输出" }), consoleList);

    if (htmlMsgHandler) window.removeEventListener("message", htmlMsgHandler);
    htmlMsgHandler = (ev) => {
      if (ev.source !== frame.contentWindow || ev.data?.__zsbLab !== frameId) return;
      consoleBox.hidden = false;
      consoleList.append(el("div", {
        class: `lab-console-line is-${ev.data.kind || "log"}`,
        text: `[${ev.data.kind || "log"}] ${ev.data.text || ""}`
      }));
    };
    window.addEventListener("message", htmlMsgHandler);

    outBody.replaceChildren(
      el("div", { class: "lab-html-stage" }, [frame]),
      consoleBox
    );
    statusEl.textContent = "✓ HTML / CSS / JS 已在安全沙箱中渲染";
  }

  function runActive() {
    const code = editor.value;
    try { localStorage.setItem(STORAGE_PREFIX + activeLang, code); } catch { /* ignore */ }

    if (activeLang === "c") {
      state.c.stdin = stdinInput.value;
      try { localStorage.setItem(STORAGE_PREFIX + "c_stdin", state.c.stdin); } catch { /* ignore */ }
      const res = runC(code, state.c.stdin);
      const nodes = [];
      if (res.output) {
        nodes.push(el("pre", { class: "lab-c-out", text: res.output }));
      } else if (res.ok) {
        nodes.push(el("p", { class: "lab-empty-note", text: "（程序已运行结束，无标准输出内容）" }));
      }
      if (!res.ok) {
        nodes.push(el("div", { class: "lab-err-box" }, [
          el("strong", { text: "编译 / 运行报错" }),
          el("p", { text: res.error })
        ]));
        statusEl.textContent = `✗ 执行中止 · ${res.ms} ms`;
      } else {
        statusEl.textContent = `✓ 运行成功 · 返回值 ${res.exitCode} · ${res.steps} 步 · ${res.ms} ms`;
      }
      outBody.replaceChildren(...nodes);
      return;
    }

    if (activeLang === "html") {
      runHtmlPreview();
      return;
    }

    if (activeLang === "sql") {
      const res = sqlEngine.execute(code);
      renderSqlSchema();
      if (!res.ok) {
        outBody.replaceChildren(el("div", { class: "lab-err-box" }, [
          el("strong", { text: "SQL 执行报错" }),
          el("p", { text: res.error })
        ]));
        statusEl.textContent = `✗ SQL 执行失败 · ${res.ms} ms`;
        return;
      }
      if (!res.results.length) {
        outBody.replaceChildren(el("p", { class: "lab-empty-note", text: "未检测到可执行的 SQL 语句，请输入 SELECT / CREATE / INSERT / UPDATE / DELETE。" }));
        statusEl.textContent = "就绪";
        return;
      }
      const blocks = res.results.map((r, idx) => {
        if (r.kind === "message") {
          return el("div", { class: "lab-sql-msg", text: `✓ 语句 ${idx + 1}：${r.message}` });
        }
        const table = el("table", { class: "lab-sql-table" }, [
          el("thead", {}, [el("tr", {}, r.columns.map((c) => el("th", { text: c })))]),
          el("tbody", {}, r.rows.length
            ? r.rows.map((row) => el("tr", {}, row.map((cell) => el("td", {
                class: cell === null || cell === undefined ? "is-null" : null,
                text: cell === null || cell === undefined ? "NULL" : String(cell)
              }))))
            : [el("tr", {}, [el("td", { colspan: Math.max(1, r.columns.length), class: "is-null", text: "（结果集为空，0 行）" })])])
        ]);
        return el("div", { class: "lab-sql-result" }, [
          el("div", { class: "lab-sql-result__meta", text: `结果集 ${idx + 1} · ${r.message}` }),
          el("div", { class: "sys-table-wrap" }, [table])
        ]);
      });
      outBody.replaceChildren(...blocks);
      statusEl.textContent = `✓ 执行完成（共 ${res.results.length} 条语句 · ${res.ms} ms）`;
    }
  }

  function renderOutTools() {
    if (activeLang === "html") {
      const liveBtn = el("button", {
        type: "button",
        class: `sh-btn lab-mini-btn${state.html.live ? " is-on" : ""}`,
        onclick: () => {
          state.html.live = !state.html.live;
          renderOutTools();
        },
        text: state.html.live ? "⚡ 实时预览：开" : "⚡ 实时预览：关"
      });
      const vpBtn = el("button", {
        type: "button",
        class: `sh-btn lab-mini-btn${state.html.mobilePreview ? " is-on" : ""}`,
        onclick: () => {
          state.html.mobilePreview = !state.html.mobilePreview;
          renderOutTools();
          runHtmlPreview();
        },
        text: state.html.mobilePreview ? "📱 手机 390px" : "💻 桌面宽屏"
      });
      outTools.replaceChildren(liveBtn, vpBtn);
    } else if (activeLang === "c") {
      outTools.replaceChildren(el("span", { class: "lab-out-badge", text: "纯本地解释执行 · 离线可用" }));
    } else {
      outTools.replaceChildren(el("span", { class: "lab-out-badge", text: "兼容 SQL Server 语法 · 教务四表" }));
    }
  }

  function switchLang(lang, runNow = true) {
    // 切换前保存当前内容
    state[activeLang].code = editor.value;
    if (activeLang === "c") state.c.stdin = stdinInput.value;

    activeLang = lang;
    for (const tab of langTabs) {
      const on = tab.dataset.labLang === lang;
      tab.classList.toggle("is-on", on);
      tab.setAttribute("aria-selected", String(on));
    }
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    url.searchParams.delete("autorun");
    history.replaceState(null, "", url.pathname + url.search);

    populateTemplates();
    editor.value = state[lang].code;
    syncGutter();
    stdinWrap.hidden = lang !== "c";
    if (lang === "c") stdinInput.value = state.c.stdin;

    outHeadTitle.textContent = lang === "c" ? "控制台输出（stdout）" : lang === "html" ? "网页实时预览" : "SQL 查询结果集";
    langHint.textContent = lang === "c"
      ? "支持 C 第 1–9 章全语法：#define、printf/scanf、一维/二维数组、函数递归、static、指针与二维数组 8 大公式（Ctrl+Enter 运行）"
      : lang === "html"
        ? "紧扣专升本网页设计考纲：支持 HTML5 标签、表单表格与 CSS3 盒模型/选择器/浮动定位/Flex 实时预览（Ctrl+Enter 刷新）"
        : "内置 Student / Course / SC / Dept 教务四表，支持 SELECT/TOP/JOIN/GROUP BY/HAVING/子查询/LIKE/建表增删改/视图（Ctrl+Enter 运行）";

    renderOutTools();
    renderSqlSchema();
    renderSymBar();
    setMobilePane("code");
    if (runNow) runActive();
  }

  // 事件绑定
  for (const tab of langTabs) {
    tab.addEventListener("click", () => switchLang(tab.dataset.labLang, true));
  }

  tplSelect.addEventListener("change", () => {
    const tpl = TEMPLATES[activeLang].find((t) => t.id === tplSelect.value);
    if (!tpl) return;
    state[activeLang].tplId = tpl.id;
    state[activeLang].code = tpl.code;
    editor.value = tpl.code;
    if (activeLang === "c") {
      state.c.stdin = tpl.stdin || "";
      stdinInput.value = state.c.stdin;
    }
    syncGutter();
    runActive();
  });

  runBtn.addEventListener("click", () => {
    runActive();
    if (typeof matchMedia === "function" && matchMedia("(max-width: 760px)").matches) {
      setMobilePane("output");
    }
  });

  resetBtn.addEventListener("click", () => {
    const tpl = TEMPLATES[activeLang].find((t) => t.id === tplSelect.value) || TEMPLATES[activeLang][0];
    editor.value = tpl.code;
    state[activeLang].code = tpl.code;
    if (activeLang === "c") {
      state.c.stdin = tpl.stdin || "";
      stdinInput.value = state.c.stdin;
    }
    try { localStorage.removeItem(STORAGE_PREFIX + activeLang); } catch { /* ignore */ }
    syncGutter();
    runActive();
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(editor.value);
      const prev = copyBtn.textContent;
      copyBtn.textContent = "✓ 已复制";
      setTimeout(() => { copyBtn.textContent = prev; }, 1400);
    } catch { /* ignore */ }
  });

  let liveTimer = 0;
  editor.addEventListener("input", () => {
    syncGutter();
    state[activeLang].code = editor.value;
    if (activeLang === "html" && state.html.live) {
      clearTimeout(liveTimer);
      liveTimer = setTimeout(runHtmlPreview, 240);
    }
  });

  editor.addEventListener("scroll", () => { gutter.scrollTop = editor.scrollTop; });

  editor.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runActive();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const s = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.slice(0, s) + "    " + editor.value.slice(end);
      editor.selectionStart = editor.selectionEnd = s + 4;
      syncGutter();
    }
  });

  switchLang(activeLang, true);
  if (autoRun) statusEl.textContent += "（已自动载入讲义代码）";
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountCodeLab);
  else mountCodeLab();
}
