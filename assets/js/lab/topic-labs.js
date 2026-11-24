// 全站知识点 -> 专属在线实操预设映射（渗透至 C / 网页设计 / 计网 / 高数 / 计基 / 英语全部知识点）
// 同时提供手机端编程快捷符号键盘配置与光标精准插入工具。

export const CODE_SYMBOLS = {
  c: [
    { label: "{ }", insert: "{\n    \n}", cursorBack: 2 },
    { label: "( )", insert: "()", cursorBack: 1 },
    { label: "[ ]", insert: "[]", cursorBack: 1 },
    { label: ";", insert: ";" },
    { label: "*", insert: "*" },
    { label: "&", insert: "&" },
    { label: "\" \"", insert: "\"\"", cursorBack: 1 },
    { label: "' '", insert: "''", cursorBack: 1 },
    { label: "%d", insert: "%d" },
    { label: "\\n", insert: "\\n" },
    { label: "=", insert: " = " },
    { label: "==", insert: " == " },
    { label: "<", insert: "<" },
    { label: ">", insert: ">" },
    { label: "->", insert: "->" },
    { label: "Tab", insert: "    " }
  ],
  html: [
    { label: "< >", insert: "<>", cursorBack: 1 },
    { label: "</>", insert: "</>", cursorBack: 1 },
    { label: "=\"\"", insert: "=\"\"", cursorBack: 1 },
    { label: "{ }", insert: "{\n  \n}", cursorBack: 2 },
    { label: ":", insert: ": " },
    { label: ";", insert: ";" },
    { label: "#", insert: "#" },
    { label: ".", insert: "." },
    { label: "class", insert: "class=\"\"", cursorBack: 1 },
    { label: "div", insert: "<div></div>", cursorBack: 6 },
    { label: "style", insert: "style=\"\"", cursorBack: 1 },
    { label: "Tab", insert: "  " }
  ],
  sql: [
    { label: "SELECT", insert: "SELECT " },
    { label: "FROM", insert: "FROM " },
    { label: "WHERE", insert: "WHERE " },
    { label: "JOIN", insert: "INNER JOIN " },
    { label: "GROUP BY", insert: "GROUP BY " },
    { label: "ORDER BY", insert: "ORDER BY " },
    { label: "DESC", insert: "DESC" },
    { label: "' '", insert: "''", cursorBack: 1 },
    { label: "( )", insert: "()", cursorBack: 1 },
    { label: "*", insert: "*" },
    { label: "=", insert: " = " },
    { label: "%", insert: "%" },
    { label: ";", insert: ";" }
  ]
};

export function insertSymbolAtCursor(textarea, sym) {
  if (!textarea || !sym) return;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const text = sym.insert || "";
  textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
  const caret = start + text.length - (sym.cursorBack || 0);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = Math.max(0, caret);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

// C 语言 29 个知识点（第 1–9 章 27 节 + 标识符专题 + 综合图题）逐节专属可运行实操预设
const C_TOPIC_PRESETS = {
  "c.identifier_sample": {
    code: `#include <stdio.h>

// 标识符只能由字母、数字、下划线组成，不能以数字开头，不能与32个关键字重名
int main() {
    int Int = 100;       // 区分大小写：Int 不是关键字，合法
    int _score_1 = 95;   // 下划线开头合法
    printf("Int = %d, _score_1 = %d\\n", Int, _score_1);
    printf("5 个必背 ASCII: \\\\0=%d, 空格=%d, '0'=%d, 'A'=%d, 'a'=%d\\n",
           '\\0', ' ', '0', 'A', 'a');
    return 0;
}`
  },
  "c.demo_page": {
    code: `#include <stdio.h>

void swapPtr(int *x, int *y) { int t = *x; *x = *y; *y = t; }

int main() {
    int a = 3, b = 5, sum = 0;
    for (int i = 1; i <= 5; i++) sum += i;
    swapPtr(&a, &b);
    printf("1..5 累加=%d | 指针交换后 a=%d, b=%d\\n", sum, a, b);
    return 0;
}`
  },
  "c.ch1.intro": {
    code: `#include <stdio.h>

// 1.1 程序与 C 语言概述：结构化程序设计（顺序/选择/循环）
int main() {
    printf("Hello 专升本 C 语言!\\n");
    printf("C 语言是编译型高级语言，程序永远从 main() 开始执行。\\n");
    return 0;
}`
  },
  "c.ch1.structure": {
    code: `#include <stdio.h>

void greet() {
    /* 多行注释在预处理阶段会被替换为一个空格 */
    printf("我是被 main 调用的子函数\\n");
}

int main() {
    // 1.2 C 程序结构与常识 7 条：有且只有一个 main()
    printf("1. 程序从 main() 启动\\n");
    greet();
    printf("2. 回到 main() 结束\\n");
    return 0;
}`
  },
  "c.ch1.compile": {
    code: `#include <stdio.h>

// 1.3 上机四步：编辑(.c) -> 编译(.obj) -> 链接(.exe) -> 执行
int main() {
    int a = 12, b = 30;
    printf("编辑(.c) -> 编译(.obj) -> 链接(.exe) -> 执行\\n");
    printf("验证运行结果: %d + %d = %d\\n", a, b, a + b);
    return 0;
}`
  },
  "c.ch2.identifier": {
    code: `#include <stdio.h>

int main() {
    int Int = 100;       // 区分大小写，Int 不是关键字，合法！
    int _score_1 = 95;   // 字母/数字/下划线组成，不以数字开头
    printf("Int = %d, _score_1 = %d\\n", Int, _score_1);
    printf("5 个必背 ASCII: \\\\0=%d, 空格=%d, '0'=%d, 'A'=%d, 'a'=%d\\n",
           '\\0', ' ', '0', 'A', 'a');
    return 0;
}`
  },
  "c.ch2.constants": {
    code: `#include <stdio.h>
#define PI 3.14

int main() {
    int dec = 15, oct = 017, hex = 0xF;
    printf("十进制=%d, 八进制017=%d, 十六进制0xF=%d\\n", dec, oct, hex);
    printf("指数常量 1.2e3 = %.1f, 宏常量 PI = %.2f\\n", 1.2e3, PI);
    printf("字符 'A'+32 = '%c' (%d)\\n", 'A' + 32, 'A' + 32);
    return 0;
}`
  },
  "c.ch2.datatypes": {
    code: `#include <stdio.h>

int main() {
    printf("char=%dB, short=%dB, int=%dB, long=%dB, long long=%dB\\n",
           sizeof(char), sizeof(short), sizeof(int), sizeof(long), sizeof(long long));
    printf("float=%dB, double=%dB\\n", sizeof(float), sizeof(double));
    return 0;
}`
  },
  "c.ch3.priority": {
    code: `#include <stdio.h>

// 3.1 优先级口诀：括号 > 单目 > 算术 > 关系 > 逻辑 > 条件 > 赋值 > 逗号
int main() {
    int a = 5, b = 5;
    int r1 = a++; // 后置：先用原值 5，再自增为 6
    int r2 = ++b; // 前置：先自增为 6，再用 6
    printf("后置 r1=%d (a=%d) | 前置 r2=%d (b=%d)\\n", r1, a, r2, b);
    printf("类型强转 (int)3.9 = %d, (double)7/2 = %.2f\\n", (int)3.9, (double)7 / 2);
    return 0;
}`
  },
  "c.ch3.arith_logic": {
    code: `#include <stdio.h>

// 3.2 整除、负数取余与逻辑短路求值
int main() {
    printf("整除截断: 7/2 = %d, 7.0/2 = %.2f\\n", 7 / 2, 7.0 / 2);
    printf("负数取余符号跟左操作数: -7%%3 = %d, 7%%-3 = %d\\n", -7 % 3, 7 % -3);
    int x = 0, y = 1;
    int r = x && (++y); // 短路：左边为 0，右边 ++y 不执行！
    printf("逻辑短路: r=%d, y=%d (仍是 1!)\\n", r, y);
    return 0;
}`
  },
  "c.ch3.assign_comma": {
    code: `#include <stdio.h>

// 3.3 条件运算符、复合赋值右边加括号、逗号表达式取最后一个值
int main() {
    int a = 5;
    a *= 2 + 3; // 等价 a = a * (2 + 3) = 25
    int max = a > 20 ? a : 20;
    int c = (a = 3, a + 5, a * 10);
    printf("复合赋值后 max = %d, 逗号表达式 c = %d\\n", max, c);
    return 0;
}`
  },
  "c.ch4.io_concept": {
    code: `#include <stdio.h>

// 4.1 C 语言本身不提供 I/O 语句，输入输出全部通过标准库函数完成
int main() {
    int x = 2026;
    printf("必须包含 #include <stdio.h> 才能使用 printf / scanf\\n");
    printf("当前备考年份：%d\\n", x);
    return 0;
}`
  },
  "c.ch4.printf": {
    code: `#include <stdio.h>

int main() {
    double x = 3.14159;
    int n = 42;
    printf("默认右对齐:[%8.2f]\\n", x);
    printf("减号左对齐:[%-8.2f]\\n", x);
    printf("补零域宽:  [%06d]\\n", n);
    printf("八/十六进制: %o / %x / %X\\n", n, n, n);
    return 0;
}`
  },
  "c.ch4.scanf_char_str": {
    stdin: "18 92.5 C",
    code: `#include <stdio.h>

int main() {
    int age;
    double score;
    char grade;
    // double 输入必须用 %lf，输出用 %f！
    scanf("%d %lf %c", &age, &score, &grade);
    printf("年龄=%d, 成绩=%.1f, 等级=%c\\n", age, score, grade);
    putchar('O');
    putchar('K');
    putchar('\\n');
    return 0;
}`
  },
  "c.ch5.truth_if": {
    stdin: "86",
    code: `#include <stdio.h>

int main() {
    int a = 5;
    // 真题经典陷阱：0 < a < 2 先算 (0 < 5)=1，再算 (1 < 2)=1（永真！）
    printf("陷阱 0<5<2 = %d | 正确 (a>0 && a<2) = %d\\n", 0 < a < 2, a > 0 && a < 2);
    int score;
    scanf("%d", &score);
    if (score >= 90) printf("成绩 %d -> 优秀\\n", score);
    else if (score >= 80) printf("成绩 %d -> 良好\\n", score);
    else if (score >= 60) printf("成绩 %d -> 及格\\n", score);
    else printf("成绩 %d -> 加油复盘\\n", score);
    return 0;
}`
  },
  "c.ch5.nested_ternary": {
    code: `#include <stdio.h>

int main() {
    // 悬空 else 永远与最近未匹配的 if 配对（看语法不看缩进！）
    int x = -1, y = 0;
    if (x > 0)
        if (x > 5) y = 1;
    else
        y = 2;
    printf("悬空 else 验证: y = %d (不是2，因为else跟了内层if!)\\n", y);
    int m = 12, n = 25;
    printf("三目等价求较大值: %d\\n", m > n ? m : n);
    return 0;
}`
  },
  "c.ch5.switch": {
    stdin: "2",
    code: `#include <stdio.h>

int main() {
    int n, sum = 0;
    scanf("%d", &n);
    // 演示穿透现象：case 2 没有 break 会继续执行 case 3
    switch (n) {
        case 1: sum += 10; break;
        case 2: sum += 20;
        case 3: sum += 30; break;
        default: sum = -1;
    }
    printf("n=%d -> sum=%d\\n", n, sum);
    return 0;
}`
  },
  "c.ch6.while_dowhile": {
    code: `#include <stdio.h>

int main() {
    int i = 1, sum = 0;
    while (i <= 100) {
        sum += i;
        i++;
    }
    printf("1+2+...+100 = %d\\n", sum);

    // do-while 至少执行一次，且末尾必须有分号 ;
    int k = 10;
    do {
        printf("do-while 即使条件为假也执行一次: k=%d\\n", k);
    } while (k < 5);
    return 0;
}`
  },
  "c.ch6.for_loop": {
    code: `#include <stdio.h>

int main() {
    printf("100~999 水仙花数: ");
    for (int n = 100; n <= 999; n++) {
        int a = n / 100, b = n / 10 % 10, c = n % 10;
        if (a*a*a + b*b*b + c*c*c == n) printf("%d ", n);
    }
    printf("\\n");
    return 0;
}`
  },
  "c.ch6.control_coding": {
    code: `#include <stdio.h>

int main() {
    printf("continue 跳过偶数，break 提前结束: ");
    for (int i = 1; i <= 10; i++) {
        if (i % 2 == 0) continue;
        if (i > 7) break; // 遇到 9 直接跳出整层循环
        printf("%d ", i);
    }
    printf("\\n");
    return 0;
}`
  },
  "c.ch7.array1d": {
    code: `#include <stdio.h>

int main() {
    int a[6] = {12, 45, 7, 89, 23}; // 第 6 个元素自动补 0
    int n = sizeof(a) / sizeof(a[0]);
    int max = a[0], sum = 0;
    for (int i = 0; i < n; i++) {
        sum += a[i];
        if (a[i] > max) max = a[i];
    }
    printf("元素个数=%d, 总字节=%dB, max=%d, avg=%.2f\\n",
           n, sizeof(a), max, sum * 1.0 / n);
    return 0;
}`
  },
  "c.ch7.array2d": {
    code: `#include <stdio.h>

int main() {
    int a[3][3] = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}};
    int mainDiag = 0, subDiag = 0;
    for (int i = 0; i < 3; i++) {
        mainDiag += a[i][i];      // 主对角线 i == j
        subDiag += a[i][2 - i];   // 副对角线 i + j == n - 1
    }
    printf("主对角线和=%d, 副对角线和=%d, sizeof(a)=%dB\\n",
           mainDiag, subDiag, sizeof(a));
    return 0;
}`
  },
  "c.ch7.char_array": {
    code: `#include <stdio.h>
#include <string.h>

int main() {
    char s[20] = "C_Lang";
    printf("初始: %s | strlen=%d | sizeof=%d\\n", s, strlen(s), sizeof(s));
    strcat(s, "_2026");
    printf("strcat后: %s | strlen=%d\\n", s, strlen(s));
    s[6] = '\\0';
    printf("插入 \\\\0 后: %s | strlen=%d\\n", s, strlen(s));
    return 0;
}`
  },
  "c.ch8.def_call": {
    code: `#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

int fact(int n) {
    if (n <= 1) return 1;
    return n * fact(n - 1);
}

int main() {
    printf("add(15, 27) = %d\\n", add(15, 27));
    printf("递归 5! = %d\\n", fact(5));
    return 0;
}`
  },
  "c.ch8.decl_pass": {
    code: `#include <stdio.h>

void swapVal(int x, int y);   // 向前声明（可省略参数名）
void swapPtr(int *x, int *y);

int main() {
    int a = 3, b = 5;
    swapVal(a, b);
    printf("值传递后: a=%d, b=%d (不变)\\n", a, b);
    swapPtr(&a, &b);
    printf("指针传递后: a=%d, b=%d (交换成功)\\n", a, b);
    return 0;
}

void swapVal(int x, int y) { int t = x; x = y; y = t; }
void swapPtr(int *x, int *y) { int t = *x; *x = *y; *y = t; }`
  },
  "c.ch8.scope_static": {
    code: `#include <stdio.h>

int g; // 全局变量默认初值为 0

int counter() {
    static int s = 2; // 静态局部初始化只执行 1 次
    int local = 1;    // 普通局部每次重来
    s += 2;
    local += 2;
    return s + local;
}

int main() {
    int r1 = counter();
    int r2 = counter();
    printf("全局默认 g=%d | 第1次=%d, 第2次=%d\\n", g, r1, r2);
    return 0;
}`
  },
  "c.ch9.ptr_basics": {
    code: `#include <stdio.h>

int main() {
    int a = 10;
    double d = 3.14;
    int *p1 = &a;
    double *p2 = &d;
    void *vp = &a;

    *(int *)vp = 30; // void* 必须先强转再 * 取内容
    printf("修改后 a = %d (*p1=%d)\\n", a, *p1);
    printf("32位下任何指针都是4B: sizeof(p1)=%d, sizeof(p2)=%d\\n",
           sizeof(p1), sizeof(p2));
    return 0;
}`
  },
  "c.ch9.ptr_array1d": {
    code: `#include <stdio.h>

int main() {
    int a[5] = {10, 20, 30, 40, 50};
    int *p = a;
    printf("*(a+3) = %d, p[3] = %d\\n", *(a + 3), p[3]);
    printf("sizeof(a) = %dB (整数组) vs sizeof(p) = %dB (指针)\\n",
           sizeof(a), sizeof(p));
    p++; // 指针变量可以 p++，数组名 a 不能 a++
    printf("p++ 后 *p = %d\\n", *p);
    return 0;
}`
  },
  "c.ch9.ptr_array2d_param": {
    code: `#include <stdio.h>

void inc(int *x) { (*x)++; }

int main() {
    int a[3][4] = {{1,2,3,4},{5,6,7,8},{9,10,11,12}};
    printf("*(*(a+1)+2) = %d (a[1][2])\\n", *(*(a + 1) + 2));
    printf("**a         = %d (a[0][0])\\n", **a);
    printf("*(*a+2)     = %d (a[0][2])\\n", *(*a + 2));
    int v = 20;
    inc(&v);
    printf("inc(&v) 后 v = %d\\n", v);
    return 0;
}`
  }
};

function wrapHtmlSnippet(raw, title = "网页设计随堂实操") {
  const s = String(raw || "").trim();
  if (/<html\b|<!doctype/i.test(s)) return s;
  if (/^[\s\S]*\{[\s\S]*:[\s\S]*\}/.test(s) && !/<[a-z][\s\S]*>/i.test(s)) {
    // 纯 CSS 片段：套上演示 HTML 结构
    return `<!doctype html>\n<html lang="zh-CN">\n<head>\n  <meta charset="utf-8">\n  <style>\n    body { font-family: system-ui, sans-serif; padding: 18px; background: #f7f8fa; color: #111318; }\n${s}\n  </style>\n</head>\n<body>\n  <div class="box demo container card">\n    <h3>${title}</h3>\n    <p>修改上方 CSS 属性，右侧立即看到排版变化。</p>\n    <div class="item">项目 A</div>\n    <div class="item">项目 B</div>\n    <div class="item">项目 C</div>\n  </div>\n</body>\n</html>`;
  }
  return `<!doctype html>\n<html lang="zh-CN">\n<head>\n  <meta charset="utf-8">\n  <style>\n    body { font-family: system-ui, "PingFang SC", sans-serif; padding: 18px; background: #f7f8fa; color: #111318; line-height: 1.7; }\n    table { border-collapse: collapse; background: #ffffff; }\n    th, td { border: 1px solid #bfc7d4; padding: 8px 12px; }\n  </style>\n</head>\n<body>\n${s}\n</body>\n</html>`;
}

function buildWebPreset(card, pageRoot) {
  // 1. 优先抓取当前网页设计页面里真实的代码示例块
  if (pageRoot && typeof pageRoot.querySelector === "function") {
    const pre = pageRoot.querySelector("pre code, .code-block, .wy-code pre, textarea.tryit-code");
    const txt = pre ? (pre.value || pre.textContent || "").trim() : "";
    if (txt.length >= 16 && txt.length <= 4000) {
      return { lang: "html", code: wrapHtmlSnippet(txt, card?.title), stdin: "" };
    }
  }
  const title = card?.title || "网页设计实操";
  const low = `${card?.id || ""} ${title}`.toLowerCase();
  if (/flex|弹性/.test(low)) {
    return {
      lang: "html",
      stdin: "",
      code: `<!doctype html>
<html lang="zh-CN">
<head><meta charset="utf-8"><style>
  body { font-family: system-ui, sans-serif; padding: 18px; background: #f7f8fa; }
  .wrap { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding: 14px; background: #ffffff; border: 1px solid #d8dee6; border-radius: 12px; }
  .item { flex: 1 1 90px; text-align: center; padding: 14px; border-radius: 8px; background: #eff4ff; color: #1e3a8a; font-weight: 700; }
</style></head>
<body>
  <div class="wrap">
    <div class="item">Flex 1</div>
    <div class="item">Flex 2</div>
    <div class="item">Flex 3</div>
  </div>
</body></html>`
    };
  }
  if (/table|表格/.test(low)) {
    return {
      lang: "html",
      stdin: "",
      code: wrapHtmlSnippet(`<table>\n  <tr><th>学号</th><th>姓名</th><th>成绩</th></tr>\n  <tr><td>202401</td><td>李明</td><td>92</td></tr>\n  <tr><td colspan="2">平均分</td><td>92</td></tr>\n</table>`, title)
    };
  }
  if (/form|表单|input/.test(low)) {
    return {
      lang: "html",
      stdin: "",
      code: wrapHtmlSnippet(`<form action="#" method="post">\n  <p><label>学号：<input type="text" name="sno" required placeholder="输入学号"></label></p>\n  <p><label>邮箱：<input type="email" name="mail" placeholder="name@example.com"></label></p>\n  <p><button type="submit">提交表单</button> <button type="reset">重置</button></p>\n</form>`, title)
    };
  }
  if (/box|盒|margin|padding|border/.test(low)) {
    return {
      lang: "html",
      stdin: "",
      code: `<!doctype html>\n<html lang="zh-CN">\n<head><meta charset="utf-8"><style>\n  body { font-family: system-ui, sans-serif; padding: 18px; background: #f7f8fa; }\n  .box { box-sizing: border-box; width: 260px; padding: 18px; border: 3px solid #1d4ed8; margin: 12px auto; border-radius: 12px; background: #eff4ff; color: #1e3a8a; font-weight: 700; text-align: center; }\n</style></head>\n<body>\n  <div class="box">border-box 总宽固定 260px</div>\n</body></html>`
    };
  }
  const safeTitle = title.replace(/['"<>&]/g, "");
  return {
    lang: "html",
    stdin: "",
    code: wrapHtmlSnippet(`<h2>${safeTitle}</h2>\n<p>${(card?.summary || "在这里修改 HTML 与 CSS 代码，右侧实时预览排版效果。").replace(/[<>]/g, "")}</p>`, safeTitle)
  };
}

function buildNetworkPreset(card) {
  const t = card?.title || "IP 与子网掩码";
  if (/分片|mtu/i.test(t)) {
    return {
      lang: "c",
      stdin: "",
      code: `#include <stdio.h>

// 计算机网络「${t}」IP 分片自动验算工具
int main() {
    int totalLen = 3820, hdr = 20, mtu = 1420;
    int dataLen = totalLen - hdr;
    int maxSlice = ((mtu - hdr) / 8) * 8; // 必须是 8 字节整数倍
    int offset = 0, idx = 1;
    printf("总数据=%dB, 每片最大数据=%dB (MTU=%d)\\n", dataLen, maxSlice, mtu);
    while (offset < dataLen) {
        int cur = (dataLen - offset > maxSlice) ? maxSlice : (dataLen - offset);
        int mf = (offset + cur < dataLen) ? 1 : 0;
        printf("第 %d 片: 数据=%4dB | MF=%d | 片偏移=%d\\n", idx++, cur, mf, offset / 8);
        offset += cur;
    }
    return 0;
}`
    };
  }
  return {
    lang: "c",
    stdin: "",
    code: `#include <stdio.h>

// 计算机网络「${t}」位运算验算工具
// 修改下方 IP 与掩码八位组即可即时计算网络地址！
int main() {
    int ip[4]   = {192, 168, 25, 130};
    int mask[4] = {255, 255, 255, 224}; // /27 掩码
    int net[4];
    for (int i = 0; i < 4; i++) {
        net[i] = ip[i] & mask[i];
    }
    printf("主机 IP  : %d.%d.%d.%d\\n", ip[0], ip[1], ip[2], ip[3]);
    printf("子网掩码 : %d.%d.%d.%d\\n", mask[0], mask[1], mask[2], mask[3]);
    printf("网络地址 : %d.%d.%d.%d (按位与 AND)\\n", net[0], net[1], net[2], net[3]);
    return 0;
}`
  };
}

function buildMathPreset(card) {
  const t = card?.title || "重要极限数值验算";
  if (/向量|平面|直线|空间/.test(t)) {
    return {
      lang: "c",
      stdin: "",
      code: `#include <stdio.h>
#include <math.h>

// 高等数学「${t}」空间向量点积与叉积验算
int main() {
    double a[3] = {1, 2, 3}, b[3] = {4, -5, 6};
    double dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    double cx = a[1]*b[2] - a[2]*b[1];
    double cy = a[2]*b[0] - a[0]*b[2];
    double cz = a[0]*b[1] - a[1]*b[0];
    printf("点积 a·b = %.2f\\n", dot);
    printf("叉积 a×b = (%.1f, %.1f, %.1f)\\n", cx, cy, cz);
    return 0;
}`
    };
  }
  if (/积分|二重/.test(t)) {
    return {
      lang: "c",
      stdin: "",
      code: `#include <stdio.h>

// 高等数学「${t}」定积分梯形法数值验算 ∫[0,1] x^2 dx = 1/3
int main() {
    int n = 1000;
    double h = 1.0 / n, sum = 0.0;
    for (int i = 1; i < n; i++) {
        double x = i * h;
        sum += x * x;
    }
    double area = h * (0.5 * (0.0 + 1.0) + sum);
    printf("梯形法近似 ∫[0,1] x^2 dx = %.6f (理论值 0.333333)\\n", area);
    return 0;
}`
    };
  }
  return {
    lang: "c",
    stdin: "",
    code: `#include <stdio.h>
#include <math.h>

// 高等数学「${t}」直观数值验算
int main() {
    printf("1) 第一重要极限 lim(x->0) sin(x)/x：\\n");
    double x = 0.1;
    for (int i = 0; i < 4; i++) {
        printf("   x=%.4f -> sin(x)/x = %.6f\\n", x, sin(x) / x);
        x /= 10.0;
    }
    printf("2) 第二重要极限 lim(n->∞) (1+1/n)^n -> e：\\n");
    double n = 10;
    for (int i = 0; i < 4; i++) {
        printf("   n=%6.0f -> %.6f\\n", n, pow(1.0 + 1.0 / n, n));
        n *= 10;
    }
    return 0;
}`
  };
}

function buildBasicsPreset(card) {
  const isSqlLike = /excel|表|筛选|汇总|数据/i.test(card?.title || "");
  if (isSqlLike) {
    return {
      lang: "sql",
      stdin: "",
      code: `-- 计算机基础「${card?.title}」联动 SQL 数据表筛选与汇总实操
SELECT Sdept AS 院系, COUNT(*) AS 人数, AVG(Sage) AS 平均年龄
FROM Student
GROUP BY Sdept
ORDER BY 人数 DESC;`
    };
  }
  return {
    lang: "c",
    stdin: "",
    code: `#include <stdio.h>

// 计算机基础「${card?.title || "进制与编码"}」即时验算
int main() {
    int num = 255;
    printf("十进制=%d | 八进制=%o | 十六进制=%X\\n", num, num, num);
    printf("ASCII 速查: '0'=%d, 'A'=%d, 'a'=%d (相差 %d)\\n",
           '0', 'A', 'a', 'a' - 'A');
    return 0;
}`
  };
}

export function getTopicLabPreset(card, pageRoot = null) {
  const sid = card?.subject_id || "";
  if (sid === "c_language") {
    const preset = C_TOPIC_PRESETS[card?.id];
    if (preset) return { lang: "c", code: preset.code, stdin: preset.stdin || "" };
    // 若该 C 节页面正文有完整带 main 的代码块，优先提取
    const codeEl = pageRoot?.querySelector(".c-code-wrap code");
    if (codeEl?.textContent && /\bmain\s*\(/.test(codeEl.textContent)) {
      return { lang: "c", code: codeEl.textContent.trim(), stdin: "" };
    }
    return { lang: "c", code: C_TOPIC_PRESETS["c.ch1.intro"].code, stdin: "" };
  }
  if (sid === "web_design") return buildWebPreset(card, pageRoot);
  if (sid === "network") return buildNetworkPreset(card);
  if (sid === "math") return buildMathPreset(card);
  if (sid === "computer_basics") return buildBasicsPreset(card);
  // 英语 / 数据库 / 其他知识点默认提供 SQL 教务库练习（且弹窗顶部可随时切 C / HTML / SQL）
  return {
    lang: "sql",
    stdin: "",
    code: `-- 随时切换上方 C / HTML / SQL 标签练习专业课上机题！
SELECT S.Sno AS 学号, S.Sname AS 姓名, C.Cname AS 课程名, SC.Grade AS 成绩
FROM Student S
INNER JOIN SC ON S.Sno = SC.Sno
INNER JOIN Course C ON SC.Cno = C.Cno
WHERE SC.Grade >= 85
ORDER BY SC.Grade DESC;`
  };
}
