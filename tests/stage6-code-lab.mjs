import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { runC } from "../assets/js/lab/c-runner.js";
import { SqlEngine } from "../assets/js/lab/sql-runner.js";
import { TEMPLATES } from "../assets/js/lab/lab-ui.js";
import { CODE_SYMBOLS, getTopicLabPreset } from "../assets/js/lab/topic-labs.js";
import { launchCodeLabModal } from "../assets/js/shell/system-study.js";

const root = path.resolve(import.meta.dirname, "..");

test("C 运行引擎：全部内置高频示例模板均可 0 报错运行并输出预期结果", () => {
  assert.ok(TEMPLATES.c.length >= 6);
  for (const tpl of TEMPLATES.c) {
    const res = runC(tpl.code, tpl.stdin || "");
    assert.equal(res.ok, true, `模板 ${tpl.id} 运行失败: ${res.error}`);
    assert.ok(res.output.length > 0, `模板 ${tpl.id} 应产生输出`);
  }
});

test("C 运行引擎：精准验证二维数组指针 8 公式、sizeof(a) vs sizeof(p)、static 与指针传参", () => {
  const r1 = runC(`
    #include <stdio.h>
    int f() { static int a = 2; int b = 1; a += 2; b += 2; return a + b; }
    void swapVal(int x, int y) { int t = x; x = y; y = t; }
    void inc(int *x) { (*x)++; }
    int main() {
      int a[3][4] = {{1,2,3,4},{5,6,7,8},{9,10,11,12}};
      int *p = a[0];
      int m = 3, n = 5;
      swapVal(m, n);
      inc(&m);
      int f1 = f(), f2 = f();
      printf("%d,%d,%d,%d|%d,%d|%d,%d|%d,%d",
        *(*(a+1)+2), **a, *(*a+3), *(a[2]+1),
        sizeof(a), sizeof(p),
        m, n,
        f1, f2);
      return 0;
    }
  `);
  assert.equal(r1.ok, true, r1.error);
  assert.equal(r1.output, "7,1,4,10|48,4|4,5|7,9");
});

test("C 运行引擎：精准验证 printf 格式对齐、scanf 读取、负数取余、#define 与 string.h", () => {
  const r = runC(`
    #include <stdio.h>
    #include <string.h>
    #define BASE 10
    int main() {
      int x; double d; char s[20];
      scanf("%d %lf %s", &x, &d, s);
      printf("[%5d][%-5d][%.2f][%d][%d]", x + BASE, -7 % 3, d, strlen(s), sizeof(s));
      return 0;
    }
  `, "5 3.14159 hello");
  assert.equal(r.ok, true, r.error);
  assert.equal(r.output, "[   15][-1   ][3.14][5][20]");
});

test("C 运行引擎：安全防护（死循环超时保护、void* 未强转禁止解引用、数组名禁止自增）", () => {
  const loopRes = runC("int main() { while (1) {} return 0; }");
  assert.equal(loopRes.ok, false);
  assert.match(loopRes.error, /死循环|上限/);

  const voidRes = runC("int main() { int a = 1; void *p = &a; return *p; }");
  assert.equal(voidRes.ok, false);
  assert.match(voidRes.error, /void\*/);

  const arrIncRes = runC("int main() { int a[5] = {0}; a++; return 0; }");
  assert.equal(arrIncRes.ok, false);
  assert.match(arrIncRes.error, /地址常量/);
});

test("SQL 引擎：全部内置专升本教务示例模板均可 0 报错执行", () => {
  assert.ok(TEMPLATES.sql.length >= 6);
  for (const tpl of TEMPLATES.sql) {
    const db = new SqlEngine();
    const res = db.execute(tpl.code);
    assert.equal(res.ok, true, `SQL 模板 ${tpl.id} 失败: ${res.error}`);
    assert.ok(res.results.length > 0);
  }
});

test("SQL 引擎：精准验证 JOIN、GROUP BY + HAVING、子查询、TOP、LIKE、NULL 与 DDL/DML", () => {
  const db = new SqlEngine();

  // COUNT(*) vs COUNT(Grade)（SC 表中 C03 有 1 条 NULL 缺考）
  const rAgg = db.execute(`
    SELECT Cno, COUNT(*) AS all_cnt, COUNT(Grade) AS valid_cnt
    FROM SC WHERE Cno = 'C03' GROUP BY Cno;
  `);
  assert.equal(rAgg.ok, true, rAgg.error);
  assert.deepEqual(rAgg.results[0].rows, [["C03", 5, 4]]);

  // SQL Server TOP + LIKE 字符集 + 子查询
  const rTop = db.execute(`
    SELECT TOP 2 S.Sname, SC.Grade
    FROM Student S INNER JOIN SC ON S.Sno = SC.Sno
    WHERE SC.Cno = 'C01' AND SC.Grade > (SELECT AVG(Grade) FROM SC WHERE Cno = 'C01')
    ORDER BY SC.Grade DESC;
  `);
  assert.equal(rTop.ok, true, rTop.error);
  assert.equal(rTop.results[0].rows.length, 2);
  assert.equal(rTop.results[0].rows[0][0], "王芳");
  assert.equal(rTop.results[0].rows[0][1], 96);

  // DDL + DML + VIEW
  const rDml = db.execute(`
    CREATE TABLE Demo (Id INT PRIMARY KEY, Name VARCHAR(20), Score INT);
    INSERT INTO Demo VALUES (1, 'A', 60), (2, 'B', 90);
    UPDATE Demo SET Score = Score + 10 WHERE Id = 1;
    DELETE FROM Demo WHERE Id = 2;
    CREATE VIEW V_Demo AS SELECT Name, Score FROM Demo;
    SELECT * FROM V_Demo;
  `);
  assert.equal(rDml.ok, true, rDml.error);
  const last = rDml.results.at(-1);
  assert.deepEqual(last.rows, [["A", 70]]);
});

test("在线代码实操页 study/lab.html 结构、手机双页签/符号栏与全站接线", () => {
  const labHtml = readFileSync(path.join(root, "study/lab.html"), "utf8");
  const shellJs = readFileSync(path.join(root, "assets/js/site-shell.js"), "utf8");
  const shellCss = readFileSync(path.join(root, "assets/css/site-shell.css"), "utf8");
  const studyJs = readFileSync(path.join(root, "assets/js/shell/system-study.js"), "utf8");
  const cNotesHtml = readFileSync(path.join(root, "c/notes.html"), "utf8");

  assert.match(labHtml, /data-lab-lang="c"/);
  assert.match(labHtml, /data-lab-lang="html"/);
  assert.match(labHtml, /data-lab-lang="sql"/);
  assert.match(labHtml, /id="lab-sym-bar"/);
  assert.match(labHtml, /id="lab-mtab-code"/);
  assert.match(labHtml, /id="lab-mtab-out"/);
  assert.match(labHtml, /id="lab-back-code"/);
  assert.match(labHtml, /data-mobile-pane="code"/);
  assert.match(labHtml, /assets\/js\/lab\/lab-ui\.js/);

  assert.match(shellJs, /study\/lab\.html/);
  assert.match(shellCss, /repeat\(5, 1fr\)/);
  assert.match(shellCss, /\.sys-lab-dialog/);
  assert.match(shellCss, /\.sys-lab-mtabs/);
  assert.match(shellCss, /\.sys-home-lab/);
  assert.match(shellCss, /\.sys-inline-run-btn/);

  assert.equal(typeof launchCodeLabModal, "function");
  assert.match(studyJs, /data-sys-lab-btn/);
  assert.match(studyJs, /sys-home-lab/);
  assert.match(studyJs, /data-sys-tool="deck"/);
  assert.ok((cNotesHtml.match(/class="c-run-btn"/g) || []).length >= 10, "C 讲义代码块应包含一键在线运行按钮");
});

test("全站 251 张知识点卡渗透：每张卡均生成可运行专属实操代码，手机符号栏完备", () => {
  for (const lang of ["c", "html", "sql"]) {
    assert.ok(Array.isArray(CODE_SYMBOLS[lang]) && CODE_SYMBOLS[lang].length >= 10, `缺少 ${lang} 快捷符号键盘`);
  }

  const cardsDoc = JSON.parse(readFileSync(path.join(root, "data/topic-cards.json"), "utf8"));
  const cards = Object.values(cardsDoc.cards);
  assert.ok(cards.length >= 250, `应覆盖全站 251 张知识卡，当前 ${cards.length}`);

  let cCount = 0;
  let htmlCount = 0;
  let sqlCount = 0;
  const seenCCodes = new Set();

  for (const card of cards) {
    const preset = getTopicLabPreset(card, null);
    assert.ok(["c", "html", "sql"].includes(preset.lang), `${card.id} 语言非法: ${preset.lang}`);
    assert.ok(preset.code && preset.code.trim().length > 20, `${card.id} 预设代码为空`);

    if (preset.lang === "c") {
      cCount += 1;
      if (card.subject_id === "c_language") seenCCodes.add(preset.code);
      const res = runC(preset.code, preset.stdin || "");
      assert.equal(res.ok, true, `知识点 ${card.id} C 预设运行失败: ${res.error}`);
      assert.ok(res.output.length > 0, `知识点 ${card.id} C 预设应有输出`);
    } else if (preset.lang === "sql") {
      sqlCount += 1;
      const db = new SqlEngine();
      const res = db.execute(preset.code);
      assert.equal(res.ok, true, `知识点 ${card.id} SQL 预设失败: ${res.error}`);
      assert.ok(res.results.length > 0);
    } else {
      htmlCount += 1;
      assert.match(preset.code, /<!doctype html|<html/i, `知识点 ${card.id} HTML 预设应为完整文档`);
    }
  }

  assert.ok(cCount >= 90 && htmlCount >= 120 && sqlCount >= 9, `分布异常: C=${cCount}, HTML=${htmlCount}, SQL=${sqlCount}`);
  assert.ok(seenCCodes.size >= 27, `C 语言 29 张知识卡应具备逐节差异化实操代码，当前去重 ${seenCCodes.size}`);
});
