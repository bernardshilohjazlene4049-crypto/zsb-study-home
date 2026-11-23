// 纯前端零依赖 C 语言教学解释执行引擎（覆盖辽宁专升本 C 语言第 1–9 章核心语法）
// 支持：#define 宏、基本类型与强制转换、完整运算符优先级、if/switch/for/while/do-while、
// 一维/二维数组与字符数组、函数与递归、全局/局部/static 静态变量、真实线性虚拟内存指针（&/*/+1/二维数组8公式/void*）、
// stdio.h (printf/scanf/gets/puts/getchar/putchar)、string.h (strlen/strcpy/strncpy/strcat/strcmp)、math.h。

const MAX_STEPS = 120000;
const MAX_CALL_DEPTH = 200;

const KEYWORDS = new Set([
  "int", "char", "short", "long", "unsigned", "signed", "float", "double", "void",
  "const", "static", "extern", "auto", "register",
  "if", "else", "switch", "case", "default", "for", "while", "do",
  "break", "continue", "return", "sizeof"
]);

const TYPE_STARTERS = new Set([
  "int", "char", "short", "long", "unsigned", "signed", "float", "double", "void",
  "const", "static", "extern", "auto", "register"
]);

function primType(base) {
  const sizes = {
    void: 0, char: 1, "unsigned char": 1, "signed char": 1,
    short: 2, "unsigned short": 2,
    int: 4, "unsigned int": 4, long: 4, "unsigned long": 4,
    "long long": 8, "unsigned long long": 8,
    float: 4, double: 8
  };
  return { kind: "prim", base, size: sizes[base] ?? 4 };
}

function ptrType(to) {
  return { kind: "ptr", to, size: 4 };
}

function arrType(elem, len) {
  return { kind: "arr", elem, len, size: elem.size * len };
}

function isFloatType(t) {
  return t?.kind === "prim" && (t.base === "float" || t.base === "double");
}

function isIntType(t) {
  return t?.kind === "prim" && t.base !== "float" && t.base !== "double" && t.base !== "void";
}

function scalarSlots(t) {
  if (!t) return 1;
  if (t.kind === "arr") return t.len * scalarSlots(t.elem);
  return 1;
}

function coerceToType(val, type) {
  if (!type) return val;
  if (type.kind === "ptr") return Math.trunc(Number(val) || 0);
  if (type.kind === "prim") {
    const n = Number(val) || 0;
    if (type.base === "float" || type.base === "double") return n;
    if (type.base === "char") {
      let c = Math.trunc(n) & 0xff;
      return c >= 128 ? c - 256 : c;
    }
    if (type.base === "unsigned char") return Math.trunc(n) & 0xff;
    if (type.base === "unsigned int" || type.base === "unsigned long") return Math.trunc(n) >>> 0;
    return Math.trunc(n);
  }
  return val;
}

// 1. 预处理（去注释、处理 #include 与 #define 常量宏，保留行号对齐）
function preprocess(src) {
  let clean = src.replace(/\r\n?/g, "\n");
  // 先在保留字符串/字符字面量的前提下去注释
  let noComments = "";
  let i = 0;
  const n = clean.length;
  while (i < n) {
    const c = clean[i];
    const next = clean[i + 1];
    if (c === '"' || c === "'") {
      const q = c;
      noComments += c;
      i++;
      while (i < n) {
        const ch = clean[i];
        noComments += ch;
        if (ch === "\\" && i + 1 < n) {
          noComments += clean[i + 1];
          i += 2;
          continue;
        }
        i++;
        if (ch === q) break;
      }
      continue;
    }
    if (c === "/" && next === "/") {
      i += 2;
      while (i < n && clean[i] !== "\n") i++;
      noComments += " ";
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(clean[i] === "*" && clean[i + 1] === "/")) {
        if (clean[i] === "\n") noComments += "\n";
        i++;
      }
      i += 2;
      noComments += " ";
      continue;
    }
    noComments += c;
    i++;
  }

  const macros = new Map([["NULL", "0"]]);
  const lines = noComments.split("\n");
  const outLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      const dm = trimmed.match(/^#\s*define\s+([A-Za-z_]\w*)\s+(.+)$/);
      if (dm) macros.set(dm[1], dm[2].trim());
      outLines.push("");
    } else {
      outLines.push(line);
    }
  }

  // 安全宏替换（只替换字符串/字符字面量之外的独立标识符）
  const body = outLines.join("\n");
  if (macros.size === 0) return body;
  let result = "";
  i = 0;
  const len = body.length;
  while (i < len) {
    const c = body[i];
    if (c === '"' || c === "'") {
      const q = c;
      result += c;
      i++;
      while (i < len) {
        const ch = body[i];
        result += ch;
        if (ch === "\\" && i + 1 < len) {
          result += body[i + 1];
          i += 2;
          continue;
        }
        i++;
        if (ch === q) break;
      }
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < len && /[A-Za-z0-9_]/.test(body[j])) j++;
      const word = body.slice(i, j);
      result += macros.has(word) ? macros.get(word) : word;
      i = j;
      continue;
    }
    result += c;
    i++;
  }
  return result;
}

function parseEscape(src, pos) {
  const c = src[pos];
  const map = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", '"': '"', a: "\x07", b: "\b", f: "\f", v: "\v" };
  if (c in map) return { ch: map[c], next: pos + 1 };
  if (c === "x" || c === "X") {
    let j = pos + 1;
    while (j < src.length && /[0-9a-fA-F]/.test(src[j]) && j < pos + 3) j++;
    const code = parseInt(src.slice(pos + 1, j) || "0", 16);
    return { ch: String.fromCharCode(code & 0xff), next: j };
  }
  if (/[0-7]/.test(c)) {
    let j = pos;
    while (j < src.length && /[0-7]/.test(src[j]) && j < pos + 3) j++;
    const code = parseInt(src.slice(pos, j), 8);
    return { ch: String.fromCharCode(code & 0xff), next: j };
  }
  return { ch: c, next: pos + 1 };
}

// 2. 词法分析器
function tokenize(src) {
  const tokens = [];
  let i = 0;
  let line = 1;
  const n = src.length;
  const multiOps = ["<<=", ">>=", "++", "--", "==", "!=", "<=", ">=", "&&", "||", "+=", "-=", "*=", "/=", "%=", "<<", ">>", "->"];

  while (i < n) {
    const c = src[i];
    if (c === "\n") { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }

    // 字符串常量
    if (c === '"') {
      i++;
      let val = "";
      while (i < n && src[i] !== '"') {
        if (src[i] === "\\") {
          const esc = parseEscape(src, i + 1);
          val += esc.ch;
          i = esc.next;
        } else {
          if (src[i] === "\n") throw new Error(`第 ${line} 行：字符串缺少右双引号 "`);
          val += src[i++];
        }
      }
      if (src[i] !== '"') throw new Error(`第 ${line} 行：字符串未闭合`);
      i++;
      // 相邻字符串自动拼接（标准 C 行为）
      if (tokens.length && tokens[tokens.length - 1].type === "str") {
        tokens[tokens.length - 1].value += val;
      } else {
        tokens.push({ type: "str", value: val, line });
      }
      continue;
    }

    // 字符常量
    if (c === "'") {
      i++;
      let val = "";
      if (src[i] === "\\") {
        const esc = parseEscape(src, i + 1);
        val = esc.ch;
        i = esc.next;
      } else {
        val = src[i++] || "";
      }
      if (src[i] !== "'") throw new Error(`第 ${line} 行：字符常量语法错误（单引号内只能含 1 个字符）`);
      i++;
      tokens.push({ type: "char", value: val.charCodeAt(0) || 0, line });
      continue;
    }

    // 数字常量（十进制/八进制/十六进制/浮点/指数）
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] || ""))) {
      let j = i;
      let isFloat = false;
      if (c === "0" && (src[i + 1] === "x" || src[i + 1] === "X")) {
        j += 2;
        while (j < n && /[0-9a-fA-F]/.test(src[j])) j++;
        while (j < n && /[uUlL]/.test(src[j])) j++;
        const raw = src.slice(i, j).replace(/[uUlL]+$/, "");
        tokens.push({ type: "num", value: parseInt(raw, 16), isFloat: false, line });
        i = j;
        continue;
      }
      while (j < n && /[0-9]/.test(src[j])) j++;
      if (src[j] === ".") {
        isFloat = true;
        j++;
        while (j < n && /[0-9]/.test(src[j])) j++;
      }
      if (src[j] === "e" || src[j] === "E") {
        isFloat = true;
        j++;
        if (src[j] === "+" || src[j] === "-") j++;
        while (j < n && /[0-9]/.test(src[j])) j++;
      }
      let suffix = "";
      while (j < n && /[fFlLuU]/.test(src[j])) suffix += src[j++];
      const raw = src.slice(i, j - suffix.length);
      let val;
      if (!isFloat && raw.length > 1 && raw[0] === "0") {
        if (/[89]/.test(raw)) throw new Error(`第 ${line} 行：八进制常量 ${raw} 不能出现数字 8 或 9`);
        val = parseInt(raw, 8);
      } else {
        val = isFloat ? parseFloat(raw) : parseInt(raw, 10);
      }
      tokens.push({ type: "num", value: val, isFloat: isFloat || /[fF]/.test(suffix), line });
      i = j;
      continue;
    }

    // 标识符与关键字
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      tokens.push({ type: KEYWORDS.has(word) ? "kw" : "id", value: word, line });
      i = j;
      continue;
    }

    // 多字符运算符
    const hit = multiOps.find((op) => src.startsWith(op, i));
    if (hit) {
      tokens.push({ type: "op", value: hit, line });
      i += hit.length;
      continue;
    }

    // 单字符标点/运算符
    if ("+-*/%<>=!&|^~?:.,;()[]{}".includes(c)) {
      tokens.push({ type: "op", value: c, line });
      i++;
      continue;
    }

    throw new Error(`第 ${line} 行：无法识别的字符「${c}」`);
  }
  tokens.push({ type: "eof", value: "", line });
  return tokens;
}

// 3. 递归下降语法分析器 (AST)
function parse(tokens) {
  let pos = 0;
  let uid = 1;
  const peek = (k = 0) => tokens[Math.min(pos + k, tokens.length - 1)];
  const next = () => tokens[pos++];
  const is = (type, value) => {
    const t = peek();
    return t.type === type && (value === undefined || t.value === value);
  };
  const eat = (type, value) => {
    const t = peek();
    if (!is(type, value)) {
      throw new Error(`第 ${t.line} 行：语法错误，期望「${value ?? type}」，实际遇到「${t.value || "文件结尾"}」`);
    }
    return next();
  };

  function isTypeStart(offset = 0) {
    const t = peek(offset);
    return t.type === "kw" && TYPE_STARTERS.has(t.value);
  }

  function parseBaseType() {
    let isStatic = false;
    let isExtern = false;
    let isConst = false;
    let unsigned = false;
    let signed = false;
    let longs = 0;
    let base = "";

    while (isTypeStart()) {
      const w = next().value;
      if (w === "static") isStatic = true;
      else if (w === "extern") isExtern = true;
      else if (w === "const") isConst = true;
      else if (w === "auto" || w === "register") { /* ignore */ }
      else if (w === "unsigned") unsigned = true;
      else if (w === "signed") signed = true;
      else if (w === "long") longs++;
      else base = w;
    }
    if (!base) {
      if (longs >= 2) base = unsigned ? "unsigned long long" : "long long";
      else if (longs === 1) base = unsigned ? "unsigned long" : "long";
      else base = unsigned ? "unsigned int" : "int";
    } else if (unsigned && (base === "int" || base === "char" || base === "short")) {
      base = `unsigned ${base}`;
    } else if (signed && base === "char") {
      base = "signed char";
    }
    return { baseType: primType(base), isStatic, isExtern, isConst };
  }

  function parseDeclarator(baseType) {
    let type = baseType;
    while (is("op", "*")) {
      next();
      while (is("kw", "const")) next();
      type = ptrType(type);
    }
    // 支持括号指针声明如 int (*p)[4]
    let name = null;
    let dims = [];
    if (is("op", "(") && peek(1).value === "*") {
      next(); // (
      next(); // *
      if (is("id")) name = next().value;
      eat("op", ")");
      while (is("op", "[")) {
        next();
        const lenExpr = is("op", "]") ? null : parseExpr();
        eat("op", "]");
        dims.push(lenExpr);
      }
      // 指向数组的指针：int (*p)[4]
      let inner = baseType;
      for (let k = dims.length - 1; k >= 0; k--) {
        inner = arrType(inner, dims[k] ? evalConstExpr(dims[k]) : 0);
      }
      return { name, type: ptrType(inner), dims: [] };
    }
    if (is("id")) name = next().value;
    while (is("op", "[")) {
      next();
      const lenExpr = is("op", "]") ? null : parseExpr();
      eat("op", "]");
      dims.push(lenExpr);
    }
    return { name, type, dims };
  }

  function evalConstExpr(node) {
    if (!node) return 0;
    if (node.kind === "num" || node.kind === "char") return Math.trunc(node.value);
    if (node.kind === "unary") {
      const v = evalConstExpr(node.arg);
      if (node.op === "-") return -v;
      if (node.op === "+") return v;
      if (node.op === "!") return v ? 0 : 1;
    }
    if (node.kind === "binary") {
      const l = evalConstExpr(node.left), r = evalConstExpr(node.right);
      if (node.op === "+") return l + r;
      if (node.op === "-") return l - r;
      if (node.op === "*") return l * r;
      if (node.op === "/") return r ? Math.trunc(l / r) : 0;
      if (node.op === "%") return r ? l % r : 0;
    }
    throw new Error(`第 ${node.line || 1} 行：数组长度必须是常量表达式`);
  }

  function parseInitializer() {
    if (is("op", "{")) {
      const line = next().line;
      const items = [];
      while (!is("op", "}") && !is("eof")) {
        items.push(parseInitializer());
        if (is("op", ",")) next();
        else break;
      }
      eat("op", "}");
      return { kind: "initList", items, line };
    }
    return parseAssign();
  }

  function parseTopLevel() {
    const decls = [];
    while (!is("eof")) {
      if (is("op", ";")) { next(); continue; }
      const line = peek().line;
      const { baseType, isStatic, isExtern } = parseBaseType();
      const first = parseDeclarator(baseType);

      // 函数声明或定义
      if (is("op", "(")) {
        next();
        const params = [];
        if (!is("op", ")")) {
          if (is("kw", "void") && peek(1).value === ")") {
            next();
          } else {
            while (!is("op", ")") && !is("eof")) {
              const pt = parseBaseType().baseType;
              const pd = parseDeclarator(pt);
              // 形参数组退化为指针：int a[] -> int *a；int a[][4] -> int (*a)[4]
              let pType = pd.type;
              if (pd.dims.length >= 1) {
                let sub = pd.type;
                for (let k = pd.dims.length - 1; k >= 1; k--) {
                  sub = arrType(sub, pd.dims[k] ? evalConstExpr(pd.dims[k]) : 1);
                }
                pType = ptrType(sub);
              }
              params.push({ name: pd.name || `_p${params.length}`, type: pType });
              if (is("op", ",")) next();
              else break;
            }
          }
        }
        eat("op", ")");
        if (is("op", ";")) {
          next();
          decls.push({ kind: "funcDecl", name: first.name, retType: first.type, params, line });
        } else {
          const body = parseBlock();
          decls.push({ kind: "funcDef", name: first.name, retType: first.type, params, body, line });
        }
        continue;
      }

      // 全局变量声明列表
      const items = [];
      let cur = first;
      while (true) {
        let init = null;
        if (is("op", "=")) {
          next();
          init = parseInitializer();
        }
        items.push({ name: cur.name, type: cur.type, dims: cur.dims.map((d) => (d ? evalConstExpr(d) : null)), init, isStatic, isExtern, id: uid++ });
        if (is("op", ",")) {
          next();
          cur = parseDeclarator(baseType);
        } else break;
      }
      eat("op", ";");
      decls.push({ kind: "varDecl", items, line });
    }
    return decls;
  }

  function parseBlock() {
    const line = eat("op", "{").line;
    const stmts = [];
    while (!is("op", "}") && !is("eof")) {
      stmts.push(parseStmt());
    }
    eat("op", "}");
    return { kind: "block", stmts, line };
  }

  function parseVarDeclStmt(eatSemi = true) {
    const line = peek().line;
    const { baseType, isStatic, isExtern } = parseBaseType();
    const items = [];
    while (true) {
      const d = parseDeclarator(baseType);
      let init = null;
      if (is("op", "=")) {
        next();
        init = parseInitializer();
      }
      items.push({ name: d.name, type: d.type, dims: d.dims.map((x) => (x ? evalConstExpr(x) : null)), init, isStatic, isExtern, id: uid++ });
      if (is("op", ",")) next();
      else break;
    }
    if (eatSemi) eat("op", ";");
    return { kind: "varDecl", items, line };
  }

  function parseStmt() {
    const t = peek();
    if (is("op", ";")) { next(); return { kind: "empty", line: t.line }; }
    if (is("op", "{")) return parseBlock();
    if (isTypeStart()) return parseVarDeclStmt(true);
    if (is("kw", "if")) {
      next();
      eat("op", "(");
      const test = parseExpr();
      eat("op", ")");
      const cons = parseStmt();
      let alt = null;
      if (is("kw", "else")) { next(); alt = parseStmt(); }
      return { kind: "if", test, cons, alt, line: t.line };
    }
    if (is("kw", "while")) {
      next();
      eat("op", "(");
      const test = parseExpr();
      eat("op", ")");
      const body = parseStmt();
      return { kind: "while", test, body, line: t.line };
    }
    if (is("kw", "do")) {
      next();
      const body = parseStmt();
      eat("kw", "while");
      eat("op", "(");
      const test = parseExpr();
      eat("op", ")");
      eat("op", ";");
      return { kind: "doWhile", body, test, line: t.line };
    }
    if (is("kw", "for")) {
      next();
      eat("op", "(");
      let init = null;
      if (!is("op", ";")) {
        init = isTypeStart() ? parseVarDeclStmt(false) : parseExpr();
      }
      eat("op", ";");
      let test = null;
      if (!is("op", ";")) test = parseExpr();
      eat("op", ";");
      let step = null;
      if (!is("op", ")")) step = parseExpr();
      eat("op", ")");
      const body = parseStmt();
      return { kind: "for", init, test, step, body, line: t.line };
    }
    if (is("kw", "switch")) {
      next();
      eat("op", "(");
      const disc = parseExpr();
      eat("op", ")");
      eat("op", "{");
      const cases = [];
      while (!is("op", "}") && !is("eof")) {
        if (is("kw", "case")) {
          const cl = next().line;
          const expr = parseConditional();
          eat("op", ":");
          const stmts = [];
          while (!is("kw", "case") && !is("kw", "default") && !is("op", "}") && !is("eof")) {
            stmts.push(parseStmt());
          }
          cases.push({ test: expr, stmts, line: cl });
        } else if (is("kw", "default")) {
          const cl = next().line;
          eat("op", ":");
          const stmts = [];
          while (!is("kw", "case") && !is("kw", "default") && !is("op", "}") && !is("eof")) {
            stmts.push(parseStmt());
          }
          cases.push({ test: null, stmts, line: cl });
        } else {
          throw new Error(`第 ${peek().line} 行：switch 内缺少 case 或 default`);
        }
      }
      eat("op", "}");
      return { kind: "switch", disc, cases, line: t.line };
    }
    if (is("kw", "break")) { next(); eat("op", ";"); return { kind: "break", line: t.line }; }
    if (is("kw", "continue")) { next(); eat("op", ";"); return { kind: "continue", line: t.line }; }
    if (is("kw", "return")) {
      next();
      const arg = is("op", ";") ? null : parseExpr();
      eat("op", ";");
      return { kind: "return", arg, line: t.line };
    }
    const expr = parseExpr();
    eat("op", ";");
    return { kind: "exprStmt", expr, line: t.line };
  }

  function parseExpr() {
    let left = parseAssign();
    while (is("op", ",")) {
      const op = next();
      const right = parseAssign();
      left = { kind: "comma", left, right, line: op.line };
    }
    return left;
  }

  function parseAssign() {
    const left = parseConditional();
    const ops = ["=", "+=", "-=", "*=", "/=", "%=", "<<=", ">>="];
    if (peek().type === "op" && ops.includes(peek().value)) {
      const op = next();
      const right = parseAssign();
      return { kind: "assign", op: op.value, left, right, line: op.line };
    }
    return left;
  }

  function parseConditional() {
    const test = parseLogicalOr();
    if (is("op", "?")) {
      const op = next();
      const cons = parseExpr();
      eat("op", ":");
      const alt = parseConditional();
      return { kind: "cond", test, cons, alt, line: op.line };
    }
    return test;
  }

  function parseBin(sub, ops) {
    let left = sub();
    while (peek().type === "op" && ops.includes(peek().value)) {
      const op = next();
      const right = sub();
      left = { kind: "binary", op: op.value, left, right, line: op.line };
    }
    return left;
  }

  const parseLogicalOr = () => parseBin(parseLogicalAnd, ["||"]);
  const parseLogicalAnd = () => parseBin(parseBitOr, ["&&"]);
  const parseBitOr = () => parseBin(parseBitXor, ["|"]);
  const parseBitXor = () => parseBin(parseBitAnd, ["^"]);
  const parseBitAnd = () => parseBin(parseEq, ["&"]);
  const parseEq = () => parseBin(parseRel, ["==", "!="]);
  const parseRel = () => parseBin(parseShift, ["<", "<=", ">", ">="]);
  const parseShift = () => parseBin(parseAdd, ["<<", ">>"]);
  const parseAdd = () => parseBin(parseMul, ["+", "-"]);
  const parseMul = () => parseBin(parseUnary, ["*", "/", "%"]);

  function parseTypeName() {
    const { baseType } = parseBaseType();
    let t = baseType;
    while (is("op", "*")) { next(); t = ptrType(t); }
    return t;
  }

  function parseUnary() {
    const t = peek();
    if (is("kw", "sizeof")) {
      next();
      if (is("op", "(") && isTypeStart(1)) {
        next();
        const tp = parseTypeName();
        eat("op", ")");
        return { kind: "sizeofType", type: tp, line: t.line };
      }
      const arg = parseUnary();
      return { kind: "sizeofExpr", arg, line: t.line };
    }
    // 强制类型转换 (int *)expr / (double)expr
    if (is("op", "(") && isTypeStart(1)) {
      next();
      const tp = parseTypeName();
      eat("op", ")");
      const arg = parseUnary();
      return { kind: "cast", type: tp, arg, line: t.line };
    }
    if (t.type === "op" && ["++", "--", "+", "-", "!", "~", "*", "&"].includes(t.value)) {
      next();
      const arg = parseUnary();
      return { kind: "unary", op: t.value, arg, line: t.line };
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let expr = parsePrimary();
    while (true) {
      if (is("op", "[")) {
        const op = next();
        const index = parseExpr();
        eat("op", "]");
        expr = { kind: "index", target: expr, index, line: op.line };
      } else if (is("op", "(")) {
        const op = next();
        const args = [];
        if (!is("op", ")")) {
          while (!is("op", ")") && !is("eof")) {
            args.push(parseAssign());
            if (is("op", ",")) next();
            else break;
          }
        }
        eat("op", ")");
        expr = { kind: "call", callee: expr, args, line: op.line };
      } else if (is("op", "++") || is("op", "--")) {
        const op = next();
        expr = { kind: "postfix", op: op.value, arg: expr, line: op.line };
      } else {
        break;
      }
    }
    return expr;
  }

  function parsePrimary() {
    const t = peek();
    if (t.type === "num") { next(); return { kind: "num", value: t.value, isFloat: t.isFloat, line: t.line }; }
    if (t.type === "char") { next(); return { kind: "char", value: t.value, line: t.line }; }
    if (t.type === "str") { next(); return { kind: "str", value: t.value, line: t.line }; }
    if (t.type === "id") { next(); return { kind: "id", name: t.value, line: t.line }; }
    if (is("op", "(")) {
      next();
      const inner = parseExpr();
      eat("op", ")");
      return inner;
    }
    throw new Error(`第 ${t.line} 行：表达式语法错误，意外遇到「${t.value || "文件结尾"}」`);
  }

  return parseTopLevel();
}

// 4. 运行时虚拟内存与解释执行器
const BREAK_SIG = { sig: "break" };
const CONT_SIG = { sig: "continue" };

export function runC(source, stdinText = "") {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  let output = "";
  let steps = 0;

  try {
    const pre = preprocess(source);
    const tokens = tokenize(pre);
    const ast = parse(tokens);

    // 虚拟线性内存：地址 1000 起步，0 保留给 NULL
    const mem = new Array(1000).fill(0);
    const allocMeta = new Map(); // addr -> type
    const stringPool = new Map();
    const funcs = new Map();
    const staticVars = new Map(); // uniqueId -> { addr, type }
    const globalEnv = { vars: new Map(), parent: null };

    // stdin 流读取器
    const input = String(stdinText || "").replace(/\r\n?/g, "\n");
    let inPos = 0;

    function tick(line) {
      if (++steps > MAX_STEPS) {
        throw new Error(`执行步数超过上限（${MAX_STEPS} 步，可能存在死循环，请检查第 ${line || "?"} 行附近的循环条件）`);
      }
    }

    function alloc(type, zeroInit = true) {
      const addr = mem.length;
      const slots = scalarSlots(type);
      for (let k = 0; k < slots; k++) mem.push(zeroInit ? 0 : 0);
      allocMeta.set(addr, type);
      return addr;
    }

    function internString(str) {
      if (stringPool.has(str)) return stringPool.get(str);
      const t = arrType(primType("char"), str.length + 1);
      const addr = alloc(t, true);
      for (let k = 0; k < str.length; k++) mem[addr + k] = str.charCodeAt(k);
      mem[addr + str.length] = 0;
      stringPool.set(str, addr);
      return addr;
    }

    function readCString(addr) {
      if (!addr || addr < 1000 || addr >= mem.length) return "";
      let s = "";
      for (let k = 0; k < 4096 && addr + k < mem.length; k++) {
        const ch = mem[addr + k];
        if (!ch) break;
        s += String.fromCharCode(ch & 0xff);
      }
      return s;
    }

    function writeCString(addr, str) {
      for (let k = 0; k < str.length; k++) mem[addr + k] = str.charCodeAt(k);
      mem[addr + str.length] = 0;
    }

    function decay(rv) {
      if (rv.type?.kind === "arr") {
        return { val: rv.addr, type: ptrType(rv.type.elem), isArrayDecay: true };
      }
      return rv;
    }

    function lookup(env, name) {
      for (let e = env; e; e = e.parent) {
        if (e.vars.has(name)) return e.vars.get(name);
      }
      return null;
    }

    function resolveArrayType(baseType, dims, init) {
      if (!dims.length) return baseType;
      const resolved = [...dims];
      if (resolved[0] == null) {
        if (init?.kind === "str" && dims.length === 1) {
          resolved[0] = init.value.length + 1;
        } else if (init?.kind === "initList") {
          if (dims.length === 1) {
            resolved[0] = init.items.length || 1;
          } else {
            const cols = resolved.slice(1).reduce((a, b) => a * (b || 1), 1);
            const hasNested = init.items.some((it) => it.kind === "initList");
            resolved[0] = hasNested ? init.items.length : Math.max(1, Math.ceil(init.items.length / cols));
          }
        } else {
          resolved[0] = 1;
        }
      }
      let t = baseType;
      for (let k = resolved.length - 1; k >= 0; k--) {
        t = arrType(t, resolved[k] || 1);
      }
      return t;
    }

    function fillInit(addr, type, init, env) {
      if (!init) return;
      if (type.kind === "arr" && type.elem.kind === "prim" && type.elem.base === "char" && init.kind === "str") {
        for (let k = 0; k < type.len; k++) {
          mem[addr + k] = k < init.value.length ? init.value.charCodeAt(k) : 0;
        }
        return;
      }
      if (type.kind === "arr" && init.kind === "initList") {
        const subSlots = scalarSlots(type.elem);
        if (type.elem.kind === "arr") {
          // 二维数组支持分行 {{1,2},{3,4}} 或连续 {1,2,3,4} 初始化
          let flatIdx = 0;
          for (let r = 0; r < init.items.length && r < type.len; r++) {
            const item = init.items[r];
            if (item.kind === "initList" || item.kind === "str") {
              fillInit(addr + r * subSlots, type.elem, item, env);
              flatIdx = (r + 1) * subSlots;
            } else {
              const v = evalRval(item, env);
              if (flatIdx < scalarSlots(type)) {
                mem[addr + flatIdx] = coerceToType(v.val, primType(findLeafBase(type)));
              }
              flatIdx++;
            }
          }
        } else {
          for (let k = 0; k < init.items.length && k < type.len; k++) {
            const v = evalRval(init.items[k], env);
            mem[addr + k] = coerceToType(v.val, type.elem);
          }
        }
        return;
      }
      const v = evalRval(init, env);
      mem[addr] = coerceToType(v.val, type);
    }

    function findLeafBase(t) {
      let cur = t;
      while (cur.kind === "arr") cur = cur.elem;
      return cur.base || "int";
    }

    function evalLval(node, env) {
      tick(node.line);
      if (node.kind === "id") {
        const v = lookup(env, node.name);
        if (!v) throw new Error(`第 ${node.line} 行：未声明的变量「${node.name}」`);
        return { addr: v.addr, type: v.type, isArrayName: v.type.kind === "arr" };
      }
      if (node.kind === "unary" && node.op === "*") {
        const rv = decay(evalRval(node.arg, env));
        if (rv.type?.kind !== "ptr") throw new Error(`第 ${node.line} 行：只能对指针执行 * 取内容操作`);
        if (rv.type.to?.base === "void") throw new Error(`第 ${node.line} 行：void* 万能指针未强制类型转换前禁止 * 取内容`);
        if (!rv.val || rv.val < 1000) throw new Error(`第 ${node.line} 行：试图解引用空指针 NULL 或非法地址`);
        return { addr: rv.val, type: rv.type.to, isArrayName: false };
      }
      if (node.kind === "index") {
        const base = decay(evalRval(node.target, env));
        const idx = evalRval(node.index, env);
        let ptr, offset;
        if (base.type?.kind === "ptr") { ptr = base; offset = Math.trunc(idx.val); }
        else if (idx.type?.kind === "ptr") { ptr = idx; offset = Math.trunc(base.val); }
        else throw new Error(`第 ${node.line} 行：下标 [] 必须用于数组或指针`);
        const stride = scalarSlots(ptr.type.to);
        return { addr: ptr.val + offset * stride, type: ptr.type.to, isArrayName: false };
      }
      throw new Error(`第 ${node.line} 行：表达式不是可修改的左值`);
    }

    function evalRval(node, env) {
      tick(node.line);
      switch (node.kind) {
        case "num":
          return { val: node.value, type: primType(node.isFloat ? "double" : "int") };
        case "char":
          return { val: node.value, type: primType("char") };
        case "str": {
          const addr = internString(node.value);
          return { val: addr, addr, type: arrType(primType("char"), node.value.length + 1) };
        }
        case "id": {
          const v = lookup(env, node.name);
          if (!v) throw new Error(`第 ${node.line} 行：未声明的标识符「${node.name}」`);
          if (v.type.kind === "arr") return { val: v.addr, addr: v.addr, type: v.type };
          return { val: mem[v.addr], addr: v.addr, type: v.type };
        }
        case "sizeofType":
          return { val: node.type.size, type: primType("int") };
        case "sizeofExpr": {
          const rv = evalRval(node.arg, env);
          return { val: rv.type?.size ?? 4, type: primType("int") };
        }
        case "cast": {
          const rv = decay(evalRval(node.arg, env));
          return { val: coerceToType(rv.val, node.type), type: node.type };
        }
        case "unary": {
          if (node.op === "&") {
            const lv = evalLval(node.arg, env);
            return { val: lv.addr, type: ptrType(lv.type) };
          }
          if (node.op === "*") {
            const lv = evalLval(node, env);
            if (lv.type.kind === "arr") return { val: lv.addr, addr: lv.addr, type: lv.type };
            return { val: mem[lv.addr], addr: lv.addr, type: lv.type };
          }
          if (node.op === "++" || node.op === "--") {
            const lv = evalLval(node.arg, env);
            if (lv.isArrayName) throw new Error(`第 ${node.line} 行：数组名是地址常量，禁止执行 ${node.op}`);
            const delta = node.op === "++" ? 1 : -1;
            const stride = lv.type.kind === "ptr"
              ? (lv.type.to.base === "void" ? (() => { throw new Error(`第 ${node.line} 行：void* 未强转前禁止 ${node.op}`); })() : scalarSlots(lv.type.to))
              : 1;
            mem[lv.addr] = coerceToType(mem[lv.addr] + delta * stride, lv.type);
            return { val: mem[lv.addr], type: lv.type };
          }
          const rv = decay(evalRval(node.arg, env));
          if (node.op === "+") return { val: +rv.val, type: rv.type };
          if (node.op === "-") return { val: -rv.val, type: rv.type };
          if (node.op === "!") return { val: rv.val ? 0 : 1, type: primType("int") };
          if (node.op === "~") return { val: ~Math.trunc(rv.val), type: primType("int") };
          throw new Error(`第 ${node.line} 行：不支持的一元运算符 ${node.op}`);
        }
        case "postfix": {
          const lv = evalLval(node.arg, env);
          if (lv.isArrayName) throw new Error(`第 ${node.line} 行：数组名是地址常量，禁止执行 ${node.op}`);
          const oldVal = mem[lv.addr];
          const delta = node.op === "++" ? 1 : -1;
          const stride = lv.type.kind === "ptr"
            ? (lv.type.to.base === "void" ? (() => { throw new Error(`第 ${node.line} 行：void* 未强转前禁止 ${node.op}`); })() : scalarSlots(lv.type.to))
            : 1;
          mem[lv.addr] = coerceToType(oldVal + delta * stride, lv.type);
          return { val: oldVal, type: lv.type };
        }
        case "index": {
          const lv = evalLval(node, env);
          if (lv.type.kind === "arr") return { val: lv.addr, addr: lv.addr, type: lv.type };
          return { val: mem[lv.addr], addr: lv.addr, type: lv.type };
        }
        case "assign": {
          const lv = evalLval(node.left, env);
          if (lv.isArrayName) throw new Error(`第 ${node.line} 行：数组名是地址常量，不能被重新赋值`);
          const rv = decay(evalRval(node.right, env));
          let res;
          if (node.op === "=") {
            res = rv.val;
          } else {
            const cur = mem[lv.addr];
            const bOp = node.op.slice(0, -1);
            res = computeBinary(bOp, { val: cur, type: lv.type }, rv, node.line).val;
          }
          mem[lv.addr] = coerceToType(res, lv.type);
          return { val: mem[lv.addr], type: lv.type };
        }
        case "comma": {
          evalRval(node.left, env);
          return evalRval(node.right, env);
        }
        case "cond": {
          const c = decay(evalRval(node.test, env));
          return c.val ? evalRval(node.cons, env) : evalRval(node.alt, env);
        }
        case "binary": {
          if (node.op === "&&") {
            const l = decay(evalRval(node.left, env));
            if (!l.val) return { val: 0, type: primType("int") };
            const r = decay(evalRval(node.right, env));
            return { val: r.val ? 1 : 0, type: primType("int") };
          }
          if (node.op === "||") {
            const l = decay(evalRval(node.left, env));
            if (l.val) return { val: 1, type: primType("int") };
            const r = decay(evalRval(node.right, env));
            return { val: r.val ? 1 : 0, type: primType("int") };
          }
          const l = decay(evalRval(node.left, env));
          const r = decay(evalRval(node.right, env));
          return computeBinary(node.op, l, r, node.line);
        }
        case "call": {
          const fnName = node.callee.kind === "id" ? node.callee.name : "";
          if (!fnName) throw new Error(`第 ${node.line} 行：无效的函数调用目标`);
          const args = node.args.map((a) => decay(evalRval(a, env)));
          return callFunction(fnName, args, node.line, 0);
        }
        default:
          throw new Error(`第 ${node.line || 1} 行：未支持的表达式类型 ${node.kind}`);
      }
    }

    function computeBinary(op, l, r, line) {
      // 指针加减偏移
      if (op === "+" && l.type?.kind === "ptr") {
        if (l.type.to.base === "void") throw new Error(`第 ${line} 行：void* 未强转前不能做算术偏移`);
        return { val: l.val + Math.trunc(r.val) * scalarSlots(l.type.to), type: l.type };
      }
      if (op === "+" && r.type?.kind === "ptr") {
        if (r.type.to.base === "void") throw new Error(`第 ${line} 行：void* 未强转前不能做算术偏移`);
        return { val: r.val + Math.trunc(l.val) * scalarSlots(r.type.to), type: r.type };
      }
      if (op === "-" && l.type?.kind === "ptr" && r.type?.kind === "ptr") {
        const stride = scalarSlots(l.type.to);
        return { val: Math.trunc((l.val - r.val) / stride), type: primType("int") };
      }
      if (op === "-" && l.type?.kind === "ptr") {
        if (l.type.to.base === "void") throw new Error(`第 ${line} 行：void* 未强转前不能做算术偏移`);
        return { val: l.val - Math.trunc(r.val) * scalarSlots(l.type.to), type: l.type };
      }

      const bothInt = isIntType(l.type) && isIntType(r.type);
      const resType = bothInt ? primType("int") : primType("double");
      const a = Number(l.val), b = Number(r.val);

      switch (op) {
        case "+": return { val: bothInt ? Math.trunc(a + b) : a + b, type: resType };
        case "-": return { val: bothInt ? Math.trunc(a - b) : a - b, type: resType };
        case "*": return { val: bothInt ? Math.trunc(a * b) : a * b, type: resType };
        case "/":
          if (b === 0) throw new Error(`第 ${line} 行：运行错误（除数不能为 0）`);
          return { val: bothInt ? Math.trunc(a / b) : a / b, type: resType };
        case "%":
          if (!bothInt) throw new Error(`第 ${line} 行：取余运算符 % 两侧必须都是整数`);
          if (b === 0) throw new Error(`第 ${line} 行：运行错误（取余除数不能为 0）`);
          return { val: Math.trunc(a) % Math.trunc(b), type: primType("int") };
        case "<": return { val: a < b ? 1 : 0, type: primType("int") };
        case "<=": return { val: a <= b ? 1 : 0, type: primType("int") };
        case ">": return { val: a > b ? 1 : 0, type: primType("int") };
        case ">=": return { val: a >= b ? 1 : 0, type: primType("int") };
        case "==": return { val: a === b ? 1 : 0, type: primType("int") };
        case "!=": return { val: a !== b ? 1 : 0, type: primType("int") };
        case "&": return { val: Math.trunc(a) & Math.trunc(b), type: primType("int") };
        case "|": return { val: Math.trunc(a) | Math.trunc(b), type: primType("int") };
        case "^": return { val: Math.trunc(a) ^ Math.trunc(b), type: primType("int") };
        case "<<": return { val: Math.trunc(a) << Math.trunc(b), type: primType("int") };
        case ">>": return { val: Math.trunc(a) >> Math.trunc(b), type: primType("int") };
        default: throw new Error(`第 ${line} 行：不支持的二元运算符 ${op}`);
      }
    }

    // 标准库函数：printf / scanf / getchar / putchar / gets / puts / string.h / math.h
    function formatPrintf(fmt, args) {
      let out = "";
      let argIdx = 0;
      let k = 0;
      while (k < fmt.length) {
        if (fmt[k] !== "%") { out += fmt[k++]; continue; }
        if (fmt[k + 1] === "%") { out += "%"; k += 2; continue; }
        const m = fmt.slice(k).match(/^%([-+ 0]*)(\d*)(?:\.(\d+))?(hh|h|ll|l)?([diuoxXfFeEcsp])/);
        if (!m) { out += fmt[k++]; continue; }
        const [, flags, widthStr, precStr, , spec] = m;
        k += m[0].length;
        const arg = args[argIdx++] || { val: 0 };
        const width = widthStr ? parseInt(widthStr, 10) : 0;
        const leftAlign = flags.includes("-");
        const zeroPad = flags.includes("0") && !leftAlign;
        let text = "";
        if (spec === "d" || spec === "i") text = String(Math.trunc(Number(arg.val) || 0));
        else if (spec === "u") text = String((Math.trunc(Number(arg.val) || 0)) >>> 0);
        else if (spec === "o") text = ((Math.trunc(Number(arg.val) || 0)) >>> 0).toString(8);
        else if (spec === "x") text = ((Math.trunc(Number(arg.val) || 0)) >>> 0).toString(16);
        else if (spec === "X") text = ((Math.trunc(Number(arg.val) || 0)) >>> 0).toString(16).toUpperCase();
        else if (spec === "p") text = "0x" + ((Math.trunc(Number(arg.val) || 0)) >>> 0).toString(16);
        else if (spec === "f" || spec === "F") {
          const prec = precStr !== undefined ? parseInt(precStr, 10) : 6;
          text = (Number(arg.val) || 0).toFixed(prec);
        } else if (spec === "e" || spec === "E") {
          const prec = precStr !== undefined ? parseInt(precStr, 10) : 6;
          text = (Number(arg.val) || 0).toExponential(prec);
          if (spec === "E") text = text.toUpperCase();
        } else if (spec === "c") {
          text = String.fromCharCode((Math.trunc(Number(arg.val) || 0)) & 0xff);
        } else if (spec === "s") {
          text = readCString(arg.val);
          if (precStr !== undefined) text = text.slice(0, parseInt(precStr, 10));
        }
        if (width > text.length) {
          const pad = (zeroPad ? "0" : " ").repeat(width - text.length);
          text = leftAlign ? text + pad : pad + text;
        }
        out += text;
      }
      return out;
    }

    function execScanf(fmt, args) {
      let matched = 0;
      let argIdx = 0;
      let k = 0;
      const skipWs = () => { while (inPos < input.length && /\s/.test(input[inPos])) inPos++; };

      while (k < fmt.length) {
        if (/\s/.test(fmt[k])) { skipWs(); k++; continue; }
        if (fmt[k] !== "%") {
          if (input[inPos] === fmt[k]) inPos++;
          k++;
          continue;
        }
        const m = fmt.slice(k).match(/^%(\d*)(hh|h|ll|l)?([diuoxXfFeEcs])/);
        if (!m) { k++; continue; }
        const [, widthStr, , spec] = m;
        k += m[0].length;
        const maxW = widthStr ? parseInt(widthStr, 10) : Infinity;
        const target = args[argIdx++];
        if (!target) break;

        if (spec === "c") {
          if (inPos >= input.length) break;
          mem[target.val] = input.charCodeAt(inPos++);
          matched++;
        } else if (spec === "s") {
          skipWs();
          let s = "";
          while (inPos < input.length && !/\s/.test(input[inPos]) && s.length < maxW) s += input[inPos++];
          if (!s) break;
          writeCString(target.val, s);
          matched++;
        } else if ("diuoxX".includes(spec)) {
          skipWs();
          const slice = input.slice(inPos, maxW === Infinity ? undefined : inPos + maxW);
          const rx = spec === "o" ? /^[+-]?[0-7]+/ : (spec === "x" || spec === "X") ? /^[+-]?(?:0[xX])?[0-9a-fA-F]+/ : /^[+-]?\d+/;
          const nm = slice.match(rx);
          if (!nm) break;
          inPos += nm[0].length;
          const radix = spec === "o" ? 8 : (spec === "x" || spec === "X") ? 16 : 10;
          mem[target.val] = parseInt(nm[0], radix);
          matched++;
        } else if ("fFeE".includes(spec)) {
          skipWs();
          const slice = input.slice(inPos, maxW === Infinity ? undefined : inPos + maxW);
          const nm = slice.match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
          if (!nm) break;
          inPos += nm[0].length;
          mem[target.val] = parseFloat(nm[0]);
          matched++;
        }
      }
      return matched;
    }

    let callDepth = 0;
    function callFunction(name, args, line) {
      // 标准库函数分派
      if (name === "printf") {
        const fmt = readCString(args[0]?.val || 0);
        const printed = formatPrintf(fmt, args.slice(1));
        output += printed;
        return { val: printed.length, type: primType("int") };
      }
      if (name === "scanf") {
        const fmt = readCString(args[0]?.val || 0);
        return { val: execScanf(fmt, args.slice(1)), type: primType("int") };
      }
      if (name === "putchar") {
        const code = (Math.trunc(args[0]?.val || 0)) & 0xff;
        output += String.fromCharCode(code);
        return { val: code, type: primType("int") };
      }
      if (name === "getchar") {
        if (inPos >= input.length) return { val: -1, type: primType("int") };
        return { val: input.charCodeAt(inPos++), type: primType("int") };
      }
      if (name === "puts") {
        output += readCString(args[0]?.val || 0) + "\n";
        return { val: 0, type: primType("int") };
      }
      if (name === "gets") {
        const addr = args[0]?.val || 0;
        let s = "";
        while (inPos < input.length && input[inPos] !== "\n") s += input[inPos++];
        if (input[inPos] === "\n") inPos++;
        writeCString(addr, s);
        return { val: addr, type: ptrType(primType("char")) };
      }
      if (name === "strlen") return { val: readCString(args[0]?.val || 0).length, type: primType("int") };
      if (name === "strcpy") {
        const dst = args[0]?.val || 0, s = readCString(args[1]?.val || 0);
        writeCString(dst, s);
        return { val: dst, type: ptrType(primType("char")) };
      }
      if (name === "strncpy") {
        const dst = args[0]?.val || 0, s = readCString(args[1]?.val || 0), cnt = Math.trunc(args[2]?.val || 0);
        for (let k = 0; k < cnt; k++) mem[dst + k] = k < s.length ? s.charCodeAt(k) : 0;
        return { val: dst, type: ptrType(primType("char")) };
      }
      if (name === "strcat") {
        const dst = args[0]?.val || 0;
        const a = readCString(dst), b = readCString(args[1]?.val || 0);
        writeCString(dst, a + b);
        return { val: dst, type: ptrType(primType("char")) };
      }
      if (name === "strcmp") {
        const a = readCString(args[0]?.val || 0), b = readCString(args[1]?.val || 0);
        const cmp = a < b ? -1 : a > b ? 1 : 0;
        return { val: cmp, type: primType("int") };
      }
      if (name === "abs" || name === "fabs") return { val: Math.abs(args[0]?.val || 0), type: name === "abs" ? primType("int") : primType("double") };
      if (name === "sqrt") return { val: Math.sqrt(args[0]?.val || 0), type: primType("double") };
      if (name === "pow") return { val: Math.pow(args[0]?.val || 0, args[1]?.val || 0), type: primType("double") };
      if (name === "floor") return { val: Math.floor(args[0]?.val || 0), type: primType("double") };
      if (name === "ceil") return { val: Math.ceil(args[0]?.val || 0), type: primType("double") };
      if (name === "sin") return { val: Math.sin(args[0]?.val || 0), type: primType("double") };
      if (name === "cos") return { val: Math.cos(args[0]?.val || 0), type: primType("double") };

      const fn = funcs.get(name);
      if (!fn) throw new Error(`第 ${line} 行：调用了未定义的函数「${name}」`);
      if (++callDepth > MAX_CALL_DEPTH) throw new Error(`第 ${line} 行：递归调用层级过深（超过 ${MAX_CALL_DEPTH} 层）`);

      const fnEnv = { vars: new Map(), parent: globalEnv };
      for (let idx = 0; idx < fn.params.length; idx++) {
        const p = fn.params[idx];
        const addr = alloc(p.type, true);
        const val = idx < args.length ? args[idx].val : 0;
        mem[addr] = coerceToType(val, p.type);
        fnEnv.vars.set(p.name, { addr, type: p.type });
      }
      const sig = execBlock(fn.body, fnEnv);
      callDepth--;
      if (sig && sig.sig === "return") {
        if (fn.retType.base === "void") return { val: 0, type: primType("void") };
        return { val: coerceToType(sig.val, fn.retType), type: fn.retType };
      }
      return { val: 0, type: fn.retType };
    }

    function execVarDecl(node, env, isGlobal = false) {
      for (const it of node.items) {
        if (it.isExtern && !isGlobal) continue;
        if (it.isStatic && !isGlobal) {
          if (staticVars.has(it.id)) {
            env.vars.set(it.name, staticVars.get(it.id));
            continue;
          }
          const fullType = resolveArrayType(it.type, it.dims, it.init);
          const addr = alloc(fullType, true);
          if (it.init) fillInit(addr, fullType, it.init, env);
          const entry = { addr, type: fullType };
          staticVars.set(it.id, entry);
          env.vars.set(it.name, entry);
          continue;
        }
        const fullType = resolveArrayType(it.type, it.dims, it.init);
        const addr = alloc(fullType, true);
        if (it.init) fillInit(addr, fullType, it.init, env);
        env.vars.set(it.name, { addr, type: fullType });
      }
    }

    function execBlock(block, parentEnv) {
      const env = { vars: new Map(), parent: parentEnv };
      for (const st of block.stmts) {
        const sig = execStmt(st, env);
        if (sig) return sig;
      }
      return null;
    }

    function execStmt(stmt, env) {
      tick(stmt.line);
      switch (stmt.kind) {
        case "empty": return null;
        case "block": return execBlock(stmt, env);
        case "varDecl": execVarDecl(stmt, env, false); return null;
        case "exprStmt": evalRval(stmt.expr, env); return null;
        case "if": {
          const cond = decay(evalRval(stmt.test, env)).val;
          if (cond) return execStmt(stmt.cons, env);
          if (stmt.alt) return execStmt(stmt.alt, env);
          return null;
        }
        case "while": {
          while (decay(evalRval(stmt.test, env)).val) {
            tick(stmt.line);
            const sig = execStmt(stmt.body, env);
            if (sig === BREAK_SIG) break;
            if (sig === CONT_SIG) continue;
            if (sig) return sig;
          }
          return null;
        }
        case "doWhile": {
          do {
            tick(stmt.line);
            const sig = execStmt(stmt.body, env);
            if (sig === BREAK_SIG) break;
            if (sig === CONT_SIG) continue;
            if (sig) return sig;
          } while (decay(evalRval(stmt.test, env)).val);
          return null;
        }
        case "for": {
          const loopEnv = { vars: new Map(), parent: env };
          if (stmt.init) {
            if (stmt.init.kind === "varDecl") execVarDecl(stmt.init, loopEnv, false);
            else evalRval(stmt.init, loopEnv);
          }
          while (!stmt.test || decay(evalRval(stmt.test, loopEnv)).val) {
            tick(stmt.line);
            const sig = execStmt(stmt.body, loopEnv);
            if (sig === BREAK_SIG) break;
            if (sig && sig !== CONT_SIG) return sig;
            if (stmt.step) evalRval(stmt.step, loopEnv);
          }
          return null;
        }
        case "switch": {
          const val = Math.trunc(decay(evalRval(stmt.disc, env)).val);
          let matchedIdx = -1;
          let defaultIdx = -1;
          for (let idx = 0; idx < stmt.cases.length; idx++) {
            const c = stmt.cases[idx];
            if (c.test === null) defaultIdx = idx;
            else if (Math.trunc(decay(evalRval(c.test, env)).val) === val) { matchedIdx = idx; break; }
          }
          const startIdx = matchedIdx !== -1 ? matchedIdx : defaultIdx;
          if (startIdx !== -1) {
            for (let idx = startIdx; idx < stmt.cases.length; idx++) {
              for (const s of stmt.cases[idx].stmts) {
                const sig = execStmt(s, env);
                if (sig === BREAK_SIG) return null;
                if (sig) return sig;
              }
            }
          }
          return null;
        }
        case "break": return BREAK_SIG;
        case "continue": return CONT_SIG;
        case "return": {
          const v = stmt.arg ? decay(evalRval(stmt.arg, env)).val : 0;
          return { sig: "return", val: v };
        }
        default:
          return null;
      }
    }

    // 装载全局声明与函数定义
    for (const d of ast) {
      if (d.kind === "funcDef") funcs.set(d.name, d);
    }
    for (const d of ast) {
      if (d.kind === "varDecl") execVarDecl(d, globalEnv, true);
    }

    if (!funcs.has("main")) {
      throw new Error("缺少程序入口函数 main()，请编写 int main() { ... }");
    }
    const ret = callFunction("main", [], 1);
    const ms = Math.max(1, Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - started));
    return { ok: true, output, exitCode: Math.trunc(ret.val || 0), steps, ms };
  } catch (err) {
    const ms = Math.max(1, Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - started));
    return { ok: false, output, error: err?.message || String(err), steps, ms };
  }
}
