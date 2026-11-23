// 纯前端零依赖 SQL（兼容 SQL Server / 标准 SQL）教学数据库引擎
// 内置辽宁专升本高频「教务四表」(Dept / Student / Course / SC)，支持 DDL / DML / 多表连接 / 分组聚合 / 子查询 / 视图 / TOP / LIKE / CASE WHEN。

export function createDefaultDatabase() {
  return {
    tables: {
      dept: {
        name: "Dept",
        columns: [
          { name: "Dno", type: "CHAR(4)", pk: true },
          { name: "Dname", type: "VARCHAR(30)" },
          { name: "Office", type: "VARCHAR(20)" }
        ],
        rows: [
          { Dno: "CS", Dname: "计算机科学系", Office: "信息楼 301" },
          { Dno: "SE", Dname: "软件工程系", Office: "信息楼 405" },
          { Dno: "IS", Dname: "信息管理系", Office: "经管楼 208" }
        ]
      },
      student: {
        name: "Student",
        columns: [
          { name: "Sno", type: "CHAR(6)", pk: true },
          { name: "Sname", type: "VARCHAR(20)" },
          { name: "Ssex", type: "CHAR(2)" },
          { name: "Sage", type: "INT" },
          { name: "Sdept", type: "CHAR(4)" }
        ],
        rows: [
          { Sno: "202401", Sname: "李明", Ssex: "男", Sage: 20, Sdept: "CS" },
          { Sno: "202402", Sname: "王芳", Ssex: "女", Sage: 19, Sdept: "CS" },
          { Sno: "202403", Sname: "张伟", Ssex: "男", Sage: 21, Sdept: "SE" },
          { Sno: "202404", Sname: "刘洋", Ssex: "女", Sage: 20, Sdept: "SE" },
          { Sno: "202405", Sname: "陈晨", Ssex: "男", Sage: 22, Sdept: "CS" },
          { Sno: "202406", Sname: "赵敏", Ssex: "女", Sage: 19, Sdept: "IS" },
          { Sno: "202407", Sname: "周杰", Ssex: "男", Sage: 20, Sdept: "IS" },
          { Sno: "202408", Sname: "林雪", Ssex: "女", Sage: 21, Sdept: "SE" }
        ]
      },
      course: {
        name: "Course",
        columns: [
          { name: "Cno", type: "CHAR(3)", pk: true },
          { name: "Cname", type: "VARCHAR(30)" },
          { name: "Cpno", type: "CHAR(3)" },
          { name: "Ccredit", type: "INT" }
        ],
        rows: [
          { Cno: "C01", Cname: "C语言程序设计", Cpno: null, Ccredit: 4 },
          { Cno: "C02", Cname: "高等数学", Cpno: null, Ccredit: 5 },
          { Cno: "C03", Cname: "数据库原理(SQL Server)", Cpno: "C01", Ccredit: 4 },
          { Cno: "C04", Cname: "计算机网络", Cpno: "C01", Ccredit: 3 },
          { Cno: "C05", Cname: "网页设计与制作", Cpno: null, Ccredit: 3 },
          { Cno: "C06", Cname: "数据结构", Cpno: "C01", Ccredit: 4 }
        ]
      },
      sc: {
        name: "SC",
        columns: [
          { name: "Sno", type: "CHAR(6)", pk: true },
          { name: "Cno", type: "CHAR(3)", pk: true },
          { name: "Grade", type: "INT" }
        ],
        rows: [
          { Sno: "202401", Cno: "C01", Grade: 92 },
          { Sno: "202401", Cno: "C03", Grade: 88 },
          { Sno: "202401", Cno: "C04", Grade: 85 },
          { Sno: "202402", Cno: "C01", Grade: 96 },
          { Sno: "202402", Cno: "C03", Grade: 91 },
          { Sno: "202402", Cno: "C05", Grade: 94 },
          { Sno: "202403", Cno: "C01", Grade: 74 },
          { Sno: "202403", Cno: "C03", Grade: 81 },
          { Sno: "202403", Cno: "C05", Grade: 78 },
          { Sno: "202404", Cno: "C01", Grade: 86 },
          { Sno: "202404", Cno: "C04", Grade: 90 },
          { Sno: "202405", Cno: "C01", Grade: 65 },
          { Sno: "202405", Cno: "C03", Grade: null },
          { Sno: "202406", Cno: "C02", Grade: 89 },
          { Sno: "202406", Cno: "C05", Grade: 92 },
          { Sno: "202407", Cno: "C03", Grade: 77 }
        ]
      }
    },
    views: {}
  };
}

const SQL_KW = new Set([
  "SELECT", "DISTINCT", "TOP", "FROM", "WHERE", "AS", "AND", "OR", "NOT", "IN", "BETWEEN", "LIKE", "IS", "NULL",
  "EXISTS", "JOIN", "INNER", "LEFT", "RIGHT", "OUTER", "CROSS", "ON", "GROUP", "BY", "HAVING", "ORDER", "ASC", "DESC",
  "LIMIT", "OFFSET", "UNION", "ALL", "CASE", "WHEN", "THEN", "ELSE", "END", "CAST",
  "CREATE", "TABLE", "VIEW", "DROP", "IF", "ALTER", "ADD", "COLUMN", "TRUNCATE",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "PRIMARY", "KEY", "UNIQUE", "DEFAULT", "CHECK", "FOREIGN", "REFERENCES", "IDENTITY", "GO"
]);

const AGG_FUNCS = new Set(["COUNT", "SUM", "AVG", "MAX", "MIN"]);

// 1. 词法分析器
function tokenizeSql(sql) {
  const tokens = [];
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    if (/\s/.test(c)) { i++; continue; }
    // 单行注释 --
    if (c === "-" && sql[i + 1] === "-") {
      i += 2;
      while (i < n && sql[i] !== "\n") i++;
      continue;
    }
    // 多行注释 /* ... */
    if (c === "/" && sql[i + 1] === "*") {
      i += 2;
      while (i < n && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    // 单引号字符串（含 '' 转义，兼容 SQL Server N'...'）
    if (c === "'" || ((c === "N" || c === "n") && sql[i + 1] === "'")) {
      if (c !== "'") i++;
      i++;
      let val = "";
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") { val += "'"; i += 2; continue; }
        if (sql[i] === "'") { i++; break; }
        val += sql[i++];
      }
      tokens.push({ type: "str", value: val });
      continue;
    }
    // 方括号/反引号/双引号标识符
    if (c === "[" || c === "`" || c === '"') {
      const end = c === "[" ? "]" : c;
      i++;
      let val = "";
      while (i < n && sql[i] !== end) val += sql[i++];
      if (sql[i] === end) i++;
      tokens.push({ type: "id", value: val });
      continue;
    }
    // 数字
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(sql[i + 1] || ""))) {
      let j = i;
      while (j < n && /[0-9]/.test(sql[j])) j++;
      if (sql[j] === ".") { j++; while (j < n && /[0-9]/.test(sql[j])) j++; }
      tokens.push({ type: "num", value: parseFloat(sql.slice(i, j)) });
      i = j;
      continue;
    }
    // 标识符或关键字（支持中文列名/别名）
    if (/[A-Za-z_\u4e00-\u9fff]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_\u4e00-\u9fff]/.test(sql[j])) j++;
      const word = sql.slice(i, j);
      const up = word.toUpperCase();
      tokens.push({ type: SQL_KW.has(up) ? "kw" : "id", value: SQL_KW.has(up) ? up : word, raw: word });
      i = j;
      continue;
    }
    // 多字符运算符
    const two = sql.slice(i, i + 2);
    if (["<>", "!=", "<=", ">=", "||"].includes(two)) {
      tokens.push({ type: "op", value: two });
      i += 2;
      continue;
    }
    if ("(),.;=<>+-*/%".includes(c)) {
      tokens.push({ type: "op", value: c });
      i++;
      continue;
    }
    throw new Error(`SQL 语法错误：无法识别的字符「${c}」`);
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

// 2. LIKE 模式匹配（支持 %、_ 及 SQL Server [a-z]/[^a-z] 字符集）
function matchLike(val, pattern) {
  if (val === null || val === undefined || pattern === null || pattern === undefined) return false;
  const s = String(val);
  const p = String(pattern);
  let rx = "^";
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === "%") rx += "[\\s\\S]*";
    else if (ch === "_") rx += ".";
    else if (ch === "[") {
      const close = p.indexOf("]", i + 1);
      if (close > i) {
        rx += p.slice(i, close + 1);
        i = close;
      } else {
        rx += "\\[";
      }
    } else if (".+*?^${}()|\\".includes(ch)) {
      rx += "\\" + ch;
    } else {
      rx += ch;
    }
  }
  rx += "$";
  return new RegExp(rx, "i").test(s);
}

// 3. 解析器 + 执行器
export class SqlEngine {
  constructor(initialDb = null) {
    this.db = initialDb ? structuredClone(initialDb) : createDefaultDatabase();
  }

  reset() {
    this.db = createDefaultDatabase();
  }

  schema() {
    const tables = Object.values(this.db.tables).map((t) => ({
      kind: "table",
      name: t.name,
      columns: t.columns.map((c) => ({ ...c })),
      rowCount: t.rows.length
    }));
    const views = Object.values(this.db.views).map((v) => ({
      kind: "view",
      name: v.name,
      columns: [],
      rowCount: null
    }));
    return [...tables, ...views];
  }

  getTable(name) {
    const key = String(name || "").toLowerCase();
    return this.db.tables[key] || null;
  }

  getView(name) {
    const key = String(name || "").toLowerCase();
    return this.db.views[key] || null;
  }

  execute(sqlText) {
    const started = typeof performance !== "undefined" ? performance.now() : Date.now();
    try {
      const tokens = tokenizeSql(sqlText);
      const results = [];
      let pos = 0;
      const peek = (k = 0) => tokens[Math.min(pos + k, tokens.length - 1)];
      const next = () => tokens[pos++];
      const isKw = (w, off = 0) => peek(off).type === "kw" && peek(off).value === w;
      const isOp = (v, off = 0) => peek(off).type === "op" && peek(off).value === v;
      const eatKw = (w) => {
        if (!isKw(w)) throw new Error(`期望关键字 ${w}，实际遇到「${peek().raw || peek().value || "结尾"}」`);
        return next();
      };
      const eatOp = (v) => {
        if (!isOp(v)) throw new Error(`期望符号「${v}」，实际遇到「${peek().raw || peek().value || "结尾"}」`);
        return next();
      };
      const eatIdent = () => {
        const t = peek();
        if (t.type === "id" || t.type === "kw") return next().raw || t.value;
        throw new Error(`期望表名或列名，实际遇到「${t.value || "结尾"}」`);
      };

      const parseExpr = () => parseOr();
      const parseOr = () => {
        let left = parseAnd();
        while (isKw("OR")) { next(); left = { kind: "bin", op: "OR", left, right: parseAnd() }; }
        return left;
      };
      const parseAnd = () => {
        let left = parseNot();
        while (isKw("AND")) { next(); left = { kind: "bin", op: "AND", left, right: parseNot() }; }
        return left;
      };
      const parseNot = () => {
        if (isKw("NOT")) { next(); return { kind: "not", arg: parseNot() }; }
        return parseCompare();
      };
      const parseCompare = () => {
        if (isKw("EXISTS")) {
          next();
          eatOp("(");
          const sub = parseSelectUnion();
          eatOp(")");
          return { kind: "exists", sub };
        }
        let left = parseAdd();
        // IS [NOT] NULL
        if (isKw("IS")) {
          next();
          const neg = isKw("NOT") ? (next(), true) : false;
          eatKw("NULL");
          return { kind: "isNull", arg: left, neg };
        }
        // [NOT] IN / BETWEEN / LIKE
        let neg = false;
        if (isKw("NOT") && (isKw("IN", 1) || isKw("BETWEEN", 1) || isKw("LIKE", 1))) {
          next();
          neg = true;
        }
        if (isKw("IN")) {
          next();
          eatOp("(");
          if (isKw("SELECT")) {
            const sub = parseSelectUnion();
            eatOp(")");
            return { kind: "inSub", arg: left, sub, neg };
          }
          const list = [];
          while (!isOp(")") && peek().type !== "eof") {
            list.push(parseExpr());
            if (isOp(",")) next();
            else break;
          }
          eatOp(")");
          return { kind: "inList", arg: left, list, neg };
        }
        if (isKw("BETWEEN")) {
          next();
          const lo = parseAdd();
          eatKw("AND");
          const hi = parseAdd();
          return { kind: "between", arg: left, lo, hi, neg };
        }
        if (isKw("LIKE")) {
          next();
          const pat = parseAdd();
          return { kind: "like", arg: left, pat, neg };
        }
        if (peek().type === "op" && ["=", "!=", "<>", "<", "<=", ">", ">="].includes(peek().value)) {
          const op = next().value;
          const right = parseAdd();
          return { kind: "cmp", op, left, right };
        }
        return left;
      };
      const parseAdd = () => {
        let left = parseMul();
        while (peek().type === "op" && ["+", "-", "||"].includes(peek().value)) {
          const op = next().value;
          left = { kind: "arith", op, left, right: parseMul() };
        }
        return left;
      };
      const parseMul = () => {
        let left = parsePrimary();
        while (peek().type === "op" && ["*", "/", "%"].includes(peek().value)) {
          const op = next().value;
          left = { kind: "arith", op, left, right: parsePrimary() };
        }
        return left;
      };
      const parsePrimary = () => {
        const t = peek();
        if (isOp("-")) { next(); return { kind: "neg", arg: parsePrimary() }; }
        if (isOp("+")) { next(); return parsePrimary(); }
        if (t.type === "num") { next(); return { kind: "lit", value: t.value }; }
        if (t.type === "str") { next(); return { kind: "lit", value: t.value }; }
        if (isKw("NULL")) { next(); return { kind: "lit", value: null }; }
        if (isOp("*")) { next(); return { kind: "star" }; }
        if (isKw("CASE")) {
          next();
          const base = !isKw("WHEN") ? parseExpr() : null;
          const whens = [];
          while (isKw("WHEN")) {
            next();
            const cond = parseExpr();
            eatKw("THEN");
            const val = parseExpr();
            whens.push({ cond, val });
          }
          const els = isKw("ELSE") ? (next(), parseExpr()) : { kind: "lit", value: null };
          eatKw("END");
          return { kind: "case", base, whens, els };
        }
        if (isKw("CAST")) {
          next();
          eatOp("(");
          const expr = parseExpr();
          eatKw("AS");
          const target = eatIdent().toUpperCase();
          if (isOp("(")) {
            next();
            while (!isOp(")") && peek().type !== "eof") next();
            eatOp(")");
          }
          eatOp(")");
          return { kind: "func", name: "CAST", args: [expr, { kind: "lit", value: target }], distinct: false };
        }
        if (isOp("(")) {
          next();
          if (isKw("SELECT")) {
            const sub = parseSelectUnion();
            eatOp(")");
            return { kind: "scalarSub", sub };
          }
          const e = parseExpr();
          eatOp(")");
          return e;
        }
        if (t.type === "id" || t.type === "kw") {
          const name = next();
          const rawName = name.raw || name.value;
          // 函数调用
          if (isOp("(")) {
            next();
            const distinct = isKw("DISTINCT") ? (next(), true) : false;
            const args = [];
            if (!isOp(")")) {
              while (!isOp(")") && peek().type !== "eof") {
                args.push(parseExpr());
                if (isOp(",")) next();
                else break;
              }
            }
            eatOp(")");
            return { kind: "func", name: rawName.toUpperCase(), args, distinct };
          }
          // table.col 或 table.*
          if (isOp(".")) {
            next();
            if (isOp("*")) { next(); return { kind: "tableStar", table: rawName }; }
            const col = eatIdent();
            return { kind: "col", table: rawName, col };
          }
          return { kind: "col", table: null, col: rawName };
        }
        throw new Error(`SQL 表达式错误：意外遇到「${t.raw || t.value || "结尾"}」`);
      };

      const parseSelect = () => {
        eatKw("SELECT");
        const distinct = isKw("DISTINCT") ? (next(), true) : false;
        let topN = null;
        if (isKw("TOP")) {
          next();
          if (isOp("(")) { next(); topN = next().value; eatOp(")"); }
          else topN = next().value;
        }
        const items = [];
        while (peek().type !== "eof") {
          const expr = parseExpr();
          let alias = null;
          if (isKw("AS")) { next(); alias = eatIdent(); }
          else if (peek().type === "id") { alias = next().value; }
          items.push({ expr, alias });
          if (isOp(",")) next();
          else break;
        }

        const from = [];
        if (isKw("FROM")) {
          next();
          const parseSource = () => {
            if (isOp("(")) {
              next();
              const sub = parseSelectUnion();
              eatOp(")");
              if (isKw("AS")) next();
              const alias = eatIdent();
              return { kind: "sub", sub, alias };
            }
            const name = eatIdent();
            let alias = name;
            if (isKw("AS")) { next(); alias = eatIdent(); }
            else if (peek().type === "id") { alias = next().value; }
            return { kind: "table", name, alias };
          };
          from.push({ join: "BASE", source: parseSource(), on: null });
          while (true) {
            if (isOp(",")) {
              next();
              from.push({ join: "CROSS", source: parseSource(), on: null });
            } else if (isKw("JOIN") || isKw("INNER") || isKw("LEFT") || isKw("RIGHT") || isKw("CROSS")) {
              let jt = "INNER";
              if (isKw("LEFT")) { next(); if (isKw("OUTER")) next(); jt = "LEFT"; }
              else if (isKw("RIGHT")) { next(); if (isKw("OUTER")) next(); jt = "RIGHT"; }
              else if (isKw("CROSS")) { next(); jt = "CROSS"; }
              else if (isKw("INNER")) { next(); jt = "INNER"; }
              eatKw("JOIN");
              const src = parseSource();
              let on = null;
              if (isKw("ON")) { next(); on = parseExpr(); }
              from.push({ join: jt, source: src, on });
            } else break;
          }
        }

        const where = isKw("WHERE") ? (next(), parseExpr()) : null;
        const groupBy = [];
        if (isKw("GROUP")) {
          next(); eatKw("BY");
          while (true) {
            groupBy.push(parseExpr());
            if (isOp(",")) next(); else break;
          }
        }
        const having = isKw("HAVING") ? (next(), parseExpr()) : null;
        const orderBy = [];
        if (isKw("ORDER")) {
          next(); eatKw("BY");
          while (true) {
            const expr = parseExpr();
            let dir = "ASC";
            if (isKw("ASC")) { next(); dir = "ASC"; }
            else if (isKw("DESC")) { next(); dir = "DESC"; }
            orderBy.push({ expr, dir });
            if (isOp(",")) next(); else break;
          }
        }
        let limit = topN;
        let offset = 0;
        if (isKw("LIMIT")) {
          next();
          limit = next().value;
          if (isKw("OFFSET")) { next(); offset = next().value; }
        }
        return { kind: "select", distinct, items, from, where, groupBy, having, orderBy, limit, offset };
      };

      const parseSelectUnion = () => {
        let left = parseSelect();
        while (isKw("UNION")) {
          next();
          const all = isKw("ALL") ? (next(), true) : false;
          const right = parseSelect();
          left = { kind: "union", all, left, right };
        }
        return left;
      };

      const parseStatement = () => {
        if (isKw("SELECT")) return parseSelectUnion();
        if (isKw("CREATE")) {
          next();
          if (isKw("VIEW")) {
            next();
            const name = eatIdent();
            eatKw("AS");
            const query = parseSelectUnion();
            return { kind: "createView", name, query };
          }
          eatKw("TABLE");
          const name = eatIdent();
          eatOp("(");
          const cols = [];
          while (!isOp(")") && peek().type !== "eof") {
            if (isKw("PRIMARY") || isKw("FOREIGN") || isKw("UNIQUE") || isKw("CHECK")) {
              // 跳过表级约束
              let depth = 0;
              while (peek().type !== "eof") {
                if (isOp("(")) depth++;
                else if (isOp(")")) { if (depth === 0) break; depth--; }
                else if (isOp(",") && depth === 0) break;
                next();
              }
            } else {
              const cname = eatIdent();
              let ctype = eatIdent().toUpperCase();
              if (isOp("(")) {
                next();
                let args = "";
                while (!isOp(")") && peek().type !== "eof") { args += next().value; }
                eatOp(")");
                ctype += `(${args})`;
              }
              let pk = false;
              let defVal = null;
              while (!isOp(",") && !isOp(")") && peek().type !== "eof") {
                if (isKw("PRIMARY")) { next(); if (isKw("KEY")) next(); pk = true; }
                else if (isKw("DEFAULT")) { next(); defVal = parsePrimary().value ?? null; }
                else if (isOp("(")) {
                  let d = 1; next();
                  while (d > 0 && peek().type !== "eof") { if (isOp("(")) d++; else if (isOp(")")) d--; next(); }
                } else next();
              }
              cols.push({ name: cname, type: ctype, pk, default: defVal });
            }
            if (isOp(",")) next();
          }
          eatOp(")");
          return { kind: "createTable", name, columns: cols };
        }
        if (isKw("DROP")) {
          next();
          const obj = isKw("VIEW") ? (next(), "VIEW") : (eatKw("TABLE"), "TABLE");
          let ifExists = false;
          if (isKw("IF")) { next(); eatKw("EXISTS"); ifExists = true; }
          const name = eatIdent();
          return { kind: "drop", obj, name, ifExists };
        }
        if (isKw("TRUNCATE")) {
          next(); eatKw("TABLE");
          return { kind: "truncate", name: eatIdent() };
        }
        if (isKw("ALTER")) {
          next(); eatKw("TABLE");
          const name = eatIdent();
          if (isKw("ADD")) {
            next();
            if (isKw("COLUMN")) next();
            const col = eatIdent();
            let ctype = eatIdent().toUpperCase();
            if (isOp("(")) {
              next(); let a = ""; while (!isOp(")") && peek().type !== "eof") a += next().value; eatOp(")");
              ctype += `(${a})`;
            }
            return { kind: "alterAdd", name, col, ctype };
          }
          if (isKw("DROP")) {
            next();
            if (isKw("COLUMN")) next();
            return { kind: "alterDrop", name, col: eatIdent() };
          }
          throw new Error("ALTER TABLE 当前支持 ADD 列名 类型 与 DROP COLUMN 列名");
        }
        if (isKw("INSERT")) {
          next();
          if (isKw("INTO")) next();
          const name = eatIdent();
          let cols = null;
          if (isOp("(")) {
            next();
            cols = [];
            while (!isOp(")") && peek().type !== "eof") {
              cols.push(eatIdent());
              if (isOp(",")) next(); else break;
            }
            eatOp(")");
          }
          if (isKw("SELECT")) {
            return { kind: "insertSelect", name, cols, query: parseSelectUnion() };
          }
          eatKw("VALUES");
          const rows = [];
          while (true) {
            eatOp("(");
            const vals = [];
            while (!isOp(")") && peek().type !== "eof") {
              vals.push(parseExpr());
              if (isOp(",")) next(); else break;
            }
            eatOp(")");
            rows.push(vals);
            if (isOp(",")) next(); else break;
          }
          return { kind: "insert", name, cols, rows };
        }
        if (isKw("UPDATE")) {
          next();
          const name = eatIdent();
          eatKw("SET");
          const assigns = [];
          while (true) {
            const col = eatIdent();
            eatOp("=");
            const expr = parseExpr();
            assigns.push({ col, expr });
            if (isOp(",")) next(); else break;
          }
          const where = isKw("WHERE") ? (next(), parseExpr()) : null;
          return { kind: "update", name, assigns, where };
        }
        if (isKw("DELETE")) {
          next();
          if (isKw("FROM")) next();
          const name = eatIdent();
          const where = isKw("WHERE") ? (next(), parseExpr()) : null;
          return { kind: "delete", name, where };
        }
        throw new Error(`不支持的 SQL 语句开头「${peek().raw || peek().value}」`);
      };

      while (peek().type !== "eof") {
        if (isOp(";") || isKw("GO")) { next(); continue; }
        const stmt = parseStatement();
        if (isOp(";")) next();
        results.push(this.runStmt(stmt));
      }

      const ms = Math.max(1, Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - started));
      return { ok: true, results, schema: this.schema(), ms };
    } catch (err) {
      const ms = Math.max(1, Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - started));
      return { ok: false, error: err?.message || String(err), results: [], schema: this.schema(), ms };
    }
  }

  runStmt(stmt) {
    if (stmt.kind === "select" || stmt.kind === "union") {
      const out = this.evalQuery(stmt, null);
      return { kind: "table", columns: out.columns, rows: out.rows, message: `查询返回 ${out.rows.length} 行` };
    }
    if (stmt.kind === "createTable") {
      const key = stmt.name.toLowerCase();
      if (this.db.tables[key]) throw new Error(`表「${stmt.name}」已存在`);
      this.db.tables[key] = { name: stmt.name, columns: stmt.columns, rows: [] };
      return { kind: "message", message: `已创建表 ${stmt.name}（${stmt.columns.length} 列）` };
    }
    if (stmt.kind === "createView") {
      const key = stmt.name.toLowerCase();
      this.db.views[key] = { name: stmt.name, query: stmt.query };
      return { kind: "message", message: `已创建视图 ${stmt.name}` };
    }
    if (stmt.kind === "drop") {
      const key = stmt.name.toLowerCase();
      if (stmt.obj === "VIEW") {
        if (!this.db.views[key] && !stmt.ifExists) throw new Error(`视图「${stmt.name}」不存在`);
        delete this.db.views[key];
        return { kind: "message", message: `已删除视图 ${stmt.name}` };
      }
      if (!this.db.tables[key] && !stmt.ifExists) throw new Error(`表「${stmt.name}」不存在`);
      delete this.db.tables[key];
      return { kind: "message", message: `已删除表 ${stmt.name}` };
    }
    if (stmt.kind === "truncate") {
      const tbl = this.getTable(stmt.name);
      if (!tbl) throw new Error(`表「${stmt.name}」不存在`);
      const cnt = tbl.rows.length;
      tbl.rows = [];
      return { kind: "message", message: `已清空表 ${tbl.name}（共清空 ${cnt} 行）` };
    }
    if (stmt.kind === "alterAdd") {
      const tbl = this.getTable(stmt.name);
      if (!tbl) throw new Error(`表「${stmt.name}」不存在`);
      tbl.columns.push({ name: stmt.col, type: stmt.ctype });
      for (const r of tbl.rows) r[stmt.col] = null;
      return { kind: "message", message: `已向表 ${tbl.name} 新增列 ${stmt.col} (${stmt.ctype})` };
    }
    if (stmt.kind === "alterDrop") {
      const tbl = this.getTable(stmt.name);
      if (!tbl) throw new Error(`表「${stmt.name}」不存在`);
      const lc = stmt.col.toLowerCase();
      tbl.columns = tbl.columns.filter((c) => c.name.toLowerCase() !== lc);
      for (const r of tbl.rows) {
        for (const k of Object.keys(r)) if (k.toLowerCase() === lc) delete r[k];
      }
      return { kind: "message", message: `已从表 ${tbl.name} 删除列 ${stmt.col}` };
    }
    if (stmt.kind === "insert") {
      const tbl = this.getTable(stmt.name);
      if (!tbl) throw new Error(`表「${stmt.name}」不存在`);
      const targetCols = stmt.cols || tbl.columns.map((c) => c.name);
      let added = 0;
      for (const exprs of stmt.rows) {
        if (exprs.length !== targetCols.length) {
          throw new Error(`INSERT 列数（${targetCols.length}）与值个数（${exprs.length}）不匹配`);
        }
        const row = {};
        for (const c of tbl.columns) row[c.name] = c.default ?? null;
        for (let i = 0; i < targetCols.length; i++) {
          const matchedCol = tbl.columns.find((c) => c.name.toLowerCase() === targetCols[i].toLowerCase());
          const colName = matchedCol ? matchedCol.name : targetCols[i];
          row[colName] = this.evalExpr(exprs[i], { aliases: {} }, null);
        }
        tbl.rows.push(row);
        added++;
      }
      return { kind: "message", message: `已向表 ${tbl.name} 插入 ${added} 行记录` };
    }
    if (stmt.kind === "insertSelect") {
      const tbl = this.getTable(stmt.name);
      if (!tbl) throw new Error(`表「${stmt.name}」不存在`);
      const res = this.evalQuery(stmt.query, null);
      const targetCols = stmt.cols || tbl.columns.map((c) => c.name);
      for (const vals of res.rows) {
        const row = {};
        for (const c of tbl.columns) row[c.name] = c.default ?? null;
        for (let i = 0; i < targetCols.length && i < vals.length; i++) {
          const matchedCol = tbl.columns.find((c) => c.name.toLowerCase() === targetCols[i].toLowerCase());
          row[matchedCol ? matchedCol.name : targetCols[i]] = vals[i];
        }
        tbl.rows.push(row);
      }
      return { kind: "message", message: `已向表 ${tbl.name} 插入 ${res.rows.length} 行记录` };
    }
    if (stmt.kind === "update") {
      const tbl = this.getTable(stmt.name);
      if (!tbl) throw new Error(`表「${stmt.name}」不存在`);
      let count = 0;
      for (const row of tbl.rows) {
        const ctx = { aliases: { [tbl.name.toLowerCase()]: row } };
        if (!stmt.where || this.evalExpr(stmt.where, ctx, null)) {
          for (const a of stmt.assigns) {
            const matchedCol = tbl.columns.find((c) => c.name.toLowerCase() === a.col.toLowerCase());
            const colName = matchedCol ? matchedCol.name : a.col;
            row[colName] = this.evalExpr(a.expr, ctx, null);
          }
          count++;
        }
      }
      return { kind: "message", message: `已更新表 ${tbl.name} 中 ${count} 行记录` };
    }
    if (stmt.kind === "delete") {
      const tbl = this.getTable(stmt.name);
      if (!tbl) throw new Error(`表「${stmt.name}」不存在`);
      const before = tbl.rows.length;
      tbl.rows = tbl.rows.filter((row) => {
        const ctx = { aliases: { [tbl.name.toLowerCase()]: row } };
        return stmt.where ? !this.evalExpr(stmt.where, ctx, null) : false;
      });
      const removed = before - tbl.rows.length;
      return { kind: "message", message: `已从表 ${tbl.name} 删除 ${removed} 行记录` };
    }
    throw new Error("未支持的 SQL 操作");
  }

  loadSourceRows(source, outerCtx) {
    if (source.kind === "sub") {
      const res = this.evalQuery(source.sub, outerCtx);
      const rows = res.rows.map((arr) => {
        const obj = {};
        res.columns.forEach((c, i) => { obj[c] = arr[i]; });
        return obj;
      });
      return { alias: source.alias, columns: res.columns, rows };
    }
    const tbl = this.getTable(source.name);
    if (tbl) {
      return { alias: source.alias, columns: tbl.columns.map((c) => c.name), rows: tbl.rows.map((r) => ({ ...r })) };
    }
    const vw = this.getView(source.name);
    if (vw) {
      const res = this.evalQuery(vw.query, outerCtx);
      const rows = res.rows.map((arr) => {
        const obj = {};
        res.columns.forEach((c, i) => { obj[c] = arr[i]; });
        return obj;
      });
      return { alias: source.alias, columns: res.columns, rows };
    }
    throw new Error(`找不到表或视图「${source.name}」`);
  }

  evalQuery(node, outerCtx) {
    if (node.kind === "union") {
      const l = this.evalQuery(node.left, outerCtx);
      const r = this.evalQuery(node.right, outerCtx);
      let combined = [...l.rows, ...r.rows];
      if (!node.all) {
        const seen = new Set();
        combined = combined.filter((row) => {
          const k = JSON.stringify(row);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      }
      return { columns: l.columns, rows: combined };
    }

    // 1. FROM & JOIN 构建工作集
    let work = [{ aliases: {}, order: [] }];
    const sourceSchemas = new Map(); // aliasLower -> { alias, columns }

    if (node.from.length) {
      const first = this.loadSourceRows(node.from[0].source, outerCtx);
      const a0 = first.alias.toLowerCase();
      sourceSchemas.set(a0, first);
      work = first.rows.map((r) => ({ aliases: { [a0]: r }, order: [a0] }));

      for (let i = 1; i < node.from.length; i++) {
        const step = node.from[i];
        const right = this.loadSourceRows(step.source, outerCtx);
        const ar = right.alias.toLowerCase();
        sourceSchemas.set(ar, right);
        const nullRight = Object.fromEntries(right.columns.map((c) => [c, null]));
        const nextWork = [];

        if (step.join === "RIGHT") {
          const leftAliases = work[0]?.order || [...sourceSchemas.keys()].filter((k) => k !== ar);
          const nullLeftAliases = {};
          for (const la of leftAliases) {
            nullLeftAliases[la] = Object.fromEntries((sourceSchemas.get(la)?.columns || []).map((c) => [c, null]));
          }
          for (const rr of right.rows) {
            let matched = false;
            for (const lw of work) {
              const cand = { aliases: { ...lw.aliases, [ar]: rr }, order: [...lw.order, ar] };
              if (!step.on || this.evalExpr(step.on, cand, outerCtx)) {
                nextWork.push(cand);
                matched = true;
              }
            }
            if (!matched) {
              nextWork.push({ aliases: { ...nullLeftAliases, [ar]: rr }, order: [...leftAliases, ar] });
            }
          }
        } else {
          for (const lw of work) {
            let matched = false;
            for (const rr of right.rows) {
              const cand = { aliases: { ...lw.aliases, [ar]: rr }, order: [...lw.order, ar] };
              if (step.join === "CROSS" || !step.on || this.evalExpr(step.on, cand, outerCtx)) {
                nextWork.push(cand);
                matched = true;
              }
            }
            if (!matched && step.join === "LEFT") {
              nextWork.push({ aliases: { ...lw.aliases, [ar]: nullRight }, order: [...lw.order, ar] });
            }
          }
        }
        work = nextWork;
      }
    }

    // 2. WHERE 过滤
    if (node.where) {
      work = work.filter((row) => Boolean(this.evalExpr(node.where, row, outerCtx)));
    }

    // 3. GROUP BY 与聚合判定
    const hasAgg = node.groupBy.length > 0 || node.items.some((it) => this.containsAgg(it.expr)) || (node.having && this.containsAgg(node.having));
    let groups;
    if (hasAgg) {
      if (node.groupBy.length === 0) {
        groups = work.length || node.from.length ? [work] : [[]];
      } else {
        const map = new Map();
        for (const row of work) {
          const key = JSON.stringify(node.groupBy.map((g) => this.evalExpr(g, row, outerCtx)));
          if (!map.has(key)) map.set(key, []);
          map.get(key).push(row);
        }
        groups = [...map.values()];
      }
      if (node.having) {
        groups = groups.filter((g) => Boolean(this.evalExpr(node.having, g[0] || { aliases: {} }, outerCtx, g)));
      }
    } else {
      groups = work.map((r) => [r]);
    }

    // 4. 展开 SELECT 列表
    const expanded = [];
    for (const it of node.items) {
      if (it.expr.kind === "star") {
        for (const [ak, sch] of sourceSchemas.entries()) {
          for (const c of sch.columns) {
            expanded.push({ expr: { kind: "col", table: ak, col: c }, label: c });
          }
        }
      } else if (it.expr.kind === "tableStar") {
        const ak = it.expr.table.toLowerCase();
        const sch = sourceSchemas.get(ak);
        if (!sch) throw new Error(`找不到表别名「${it.expr.table}」`);
        for (const c of sch.columns) {
          expanded.push({ expr: { kind: "col", table: ak, col: c }, label: c });
        }
      } else {
        expanded.push({ expr: it.expr, label: it.alias || this.exprLabel(it.expr) });
      }
    }

    // 5. 计算投影与 ORDER BY 键
    let projected = groups.map((g) => {
      const sample = g[0] || { aliases: {} };
      const vals = expanded.map((item) => this.evalExpr(item.expr, sample, outerCtx, hasAgg ? g : null));
      const aliasRow = {};
      expanded.forEach((item, idx) => { aliasRow[item.label.toLowerCase()] = vals[idx]; });
      const sortKeys = node.orderBy.map((o) => {
        if (o.expr.kind === "col" && !o.expr.table && (o.expr.col.toLowerCase() in aliasRow)) {
          return aliasRow[o.expr.col.toLowerCase()];
        }
        return this.evalExpr(o.expr, sample, outerCtx, hasAgg ? g : null);
      });
      return { vals, sortKeys };
    });

    // 6. DISTINCT
    if (node.distinct) {
      const seen = new Set();
      projected = projected.filter((p) => {
        const k = JSON.stringify(p.vals);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }

    // 7. ORDER BY
    if (node.orderBy.length) {
      projected.sort((a, b) => {
        for (let i = 0; i < node.orderBy.length; i++) {
          const av = a.sortKeys[i], bv = b.sortKeys[i];
          if (av === bv) continue;
          const dir = node.orderBy[i].dir === "DESC" ? -1 : 1;
          if (av === null || av === undefined) return -1 * dir;
          if (bv === null || bv === undefined) return 1 * dir;
          if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
          return String(av).localeCompare(String(bv), "zh-CN") * dir;
        }
        return 0;
      });
    }

    // 8. OFFSET / LIMIT / TOP
    if (node.offset) projected = projected.slice(node.offset);
    if (node.limit !== null && node.limit !== undefined) projected = projected.slice(0, node.limit);

    return { columns: expanded.map((e) => e.label), rows: projected.map((p) => p.vals) };
  }

  containsAgg(expr) {
    if (!expr) return false;
    if (expr.kind === "func" && AGG_FUNCS.has(expr.name)) return true;
    return Boolean(
      this.containsAgg(expr.left) || this.containsAgg(expr.right) || this.containsAgg(expr.arg)
      || (expr.args && expr.args.some((a) => this.containsAgg(a)))
      || (expr.whens && expr.whens.some((w) => this.containsAgg(w.cond) || this.containsAgg(w.val)))
      || this.containsAgg(expr.els)
    );
  }

  exprLabel(expr) {
    if (expr.kind === "col") return expr.col;
    if (expr.kind === "func") return `${expr.name}(${expr.args.map((a) => (a.kind === "star" ? "*" : this.exprLabel(a))).join(",")})`;
    return "结果";
  }

  resolveCol(table, col, ctx, outerCtx) {
    const colLow = col.toLowerCase();
    const search = (c) => {
      if (!c) return { found: false };
      if (table) {
        const rec = c.aliases[table.toLowerCase()];
        if (rec) {
          for (const k of Object.keys(rec)) if (k.toLowerCase() === colLow) return { found: true, val: rec[k] };
        }
        return { found: false };
      }
      for (const rec of Object.values(c.aliases)) {
        for (const k of Object.keys(rec)) if (k.toLowerCase() === colLow) return { found: true, val: rec[k] };
      }
      return { found: false };
    };
    const r1 = search(ctx);
    if (r1.found) return r1.val;
    const r2 = search(outerCtx);
    if (r2.found) return r2.val;
    throw new Error(`找不到列「${table ? `${table}.${col}` : col}」`);
  }

  evalExpr(expr, ctx, outerCtx, groupRows = null) {
    if (!expr) return null;
    switch (expr.kind) {
      case "lit": return expr.value;
      case "col": return this.resolveCol(expr.table, expr.col, ctx, outerCtx);
      case "neg": {
        const v = this.evalExpr(expr.arg, ctx, outerCtx, groupRows);
        return v === null ? null : -Number(v);
      }
      case "not": {
        const v = this.evalExpr(expr.arg, ctx, outerCtx, groupRows);
        return v === null ? false : !v;
      }
      case "isNull": {
        const v = this.evalExpr(expr.arg, ctx, outerCtx, groupRows);
        return expr.neg ? v !== null && v !== undefined : v === null || v === undefined;
      }
      case "bin": {
        const l = Boolean(this.evalExpr(expr.left, ctx, outerCtx, groupRows));
        if (expr.op === "AND") return l && Boolean(this.evalExpr(expr.right, ctx, outerCtx, groupRows));
        return l || Boolean(this.evalExpr(expr.right, ctx, outerCtx, groupRows));
      }
      case "cmp": {
        const l = this.evalExpr(expr.left, ctx, outerCtx, groupRows);
        const r = this.evalExpr(expr.right, ctx, outerCtx, groupRows);
        if (l === null || r === null || l === undefined || r === undefined) return false;
        const a = typeof l === "number" && typeof r === "number" ? l : String(l);
        const b = typeof l === "number" && typeof r === "number" ? r : String(r);
        if (expr.op === "=") return a === b;
        if (expr.op === "!=" || expr.op === "<>") return a !== b;
        if (expr.op === "<") return a < b;
        if (expr.op === "<=") return a <= b;
        if (expr.op === ">") return a > b;
        if (expr.op === ">=") return a >= b;
        return false;
      }
      case "arith": {
        const l = this.evalExpr(expr.left, ctx, outerCtx, groupRows);
        const r = this.evalExpr(expr.right, ctx, outerCtx, groupRows);
        if (l === null || r === null) return null;
        if (expr.op === "||" || (expr.op === "+" && (typeof l === "string" || typeof r === "string"))) {
          return String(l) + String(r);
        }
        const a = Number(l), b = Number(r);
        if (expr.op === "+") return a + b;
        if (expr.op === "-") return a - b;
        if (expr.op === "*") return a * b;
        if (expr.op === "/") return b === 0 ? null : a / b;
        if (expr.op === "%") return b === 0 ? null : a % b;
        return null;
      }
      case "between": {
        const v = this.evalExpr(expr.arg, ctx, outerCtx, groupRows);
        const lo = this.evalExpr(expr.lo, ctx, outerCtx, groupRows);
        const hi = this.evalExpr(expr.hi, ctx, outerCtx, groupRows);
        if (v === null || lo === null || hi === null) return false;
        const ok = v >= lo && v <= hi;
        return expr.neg ? !ok : ok;
      }
      case "like": {
        const v = this.evalExpr(expr.arg, ctx, outerCtx, groupRows);
        const p = this.evalExpr(expr.pat, ctx, outerCtx, groupRows);
        const ok = matchLike(v, p);
        return expr.neg ? !ok : ok;
      }
      case "inList": {
        const v = this.evalExpr(expr.arg, ctx, outerCtx, groupRows);
        if (v === null) return false;
        const vals = expr.list.map((x) => this.evalExpr(x, ctx, outerCtx, groupRows));
        const ok = vals.some((x) => x !== null && String(x) === String(v));
        return expr.neg ? !ok : ok;
      }
      case "inSub": {
        const v = this.evalExpr(expr.arg, ctx, outerCtx, groupRows);
        if (v === null) return false;
        const res = this.evalQuery(expr.sub, ctx);
        const ok = res.rows.some((r) => r[0] !== null && String(r[0]) === String(v));
        return expr.neg ? !ok : ok;
      }
      case "exists": {
        const res = this.evalQuery(expr.sub, ctx);
        return res.rows.length > 0;
      }
      case "scalarSub": {
        const res = this.evalQuery(expr.sub, ctx);
        return res.rows[0]?.[0] ?? null;
      }
      case "case": {
        const base = expr.base ? this.evalExpr(expr.base, ctx, outerCtx, groupRows) : null;
        for (const w of expr.whens) {
          const cond = this.evalExpr(w.cond, ctx, outerCtx, groupRows);
          if (expr.base ? cond === base : Boolean(cond)) {
            return this.evalExpr(w.val, ctx, outerCtx, groupRows);
          }
        }
        return this.evalExpr(expr.els, ctx, outerCtx, groupRows);
      }
      case "func": {
        const fn = expr.name;
        if (AGG_FUNCS.has(fn)) {
          const rows = groupRows || [ctx];
          if (fn === "COUNT" && expr.args[0]?.kind === "star") return rows.length;
          let vals = rows
            .map((r) => this.evalExpr(expr.args[0], r, outerCtx, null))
            .filter((v) => v !== null && v !== undefined);
          if (expr.distinct) vals = [...new Set(vals.map((v) => (typeof v === "number" ? v : String(v))))];
          if (fn === "COUNT") return vals.length;
          if (!vals.length) return null;
          if (fn === "SUM") return vals.reduce((s, x) => s + Number(x), 0);
          if (fn === "AVG") return Number((vals.reduce((s, x) => s + Number(x), 0) / vals.length).toFixed(2));
          if (fn === "MAX") return vals.reduce((a, b) => (a > b ? a : b));
          if (fn === "MIN") return vals.reduce((a, b) => (a < b ? a : b));
        }
        const a = expr.args.map((x) => this.evalExpr(x, ctx, outerCtx, groupRows));
        switch (fn) {
          case "LEN": case "LENGTH": return a[0] === null ? null : String(a[0]).length;
          case "UPPER": return a[0] === null ? null : String(a[0]).toUpperCase();
          case "LOWER": return a[0] === null ? null : String(a[0]).toLowerCase();
          case "LEFT": return a[0] === null ? null : String(a[0]).slice(0, Number(a[1]) || 0);
          case "RIGHT": return a[0] === null ? null : String(a[0]).slice(-(Number(a[1]) || 0));
          case "SUBSTRING": case "SUBSTR": {
            if (a[0] === null) return null;
            const start = Math.max(0, (Number(a[1]) || 1) - 1);
            const len = a[2] !== undefined ? Number(a[2]) : undefined;
            return len !== undefined ? String(a[0]).slice(start, start + len) : String(a[0]).slice(start);
          }
          case "LTRIM": return a[0] === null ? null : String(a[0]).trimStart();
          case "RTRIM": return a[0] === null ? null : String(a[0]).trimEnd();
          case "TRIM": return a[0] === null ? null : String(a[0]).trim();
          case "ROUND": return a[0] === null ? null : Number(Number(a[0]).toFixed(Number(a[1]) || 0));
          case "ABS": return a[0] === null ? null : Math.abs(Number(a[0]));
          case "ISNULL": return a[0] !== null && a[0] !== undefined ? a[0] : a[1];
          case "COALESCE": return a.find((x) => x !== null && x !== undefined) ?? null;
          case "GETDATE": return new Date().toISOString().slice(0, 10);
          case "YEAR": return a[0] ? new Date(a[0]).getFullYear() : new Date().getFullYear();
          case "CAST": {
            const target = String(a[1] || "");
            if (a[0] === null) return null;
            if (/INT|DECIMAL|FLOAT|NUMERIC/.test(target)) return Number(a[0]);
            return String(a[0]);
          }
          default:
            throw new Error(`不支持的 SQL 函数「${fn}」`);
        }
      }
      default:
        return null;
    }
  }
}
