/* 课堂可视化（计算与演示）：纯原生、无依赖、无外链。
 * 用法：<figure class="lab" data-lab="名称" [data-ex="0,2"] [data-q="1,2"] [data-demo="single"] [data-src="出处"]></figure>
 * 计算函数来自 calc-net.js（window.NetCalc）。默认例题均为课堂原题数据。 */
(() => {
  "use strict";
  const NC = typeof window !== "undefined" ? window.NetCalc : require("./calc-net.js");
  let seq = 0;

  /* ---------- 课堂原题数据（与笔记原图一致） ---------- */
  const DATA = {
    and: [
      { label: "p87 · 156.16.32.7/20", values: ["156.16.32.7", "/20"], answer: "p87：156.16.32.0/20，掩码 255.255.240.0，主机号 12 位。" },
      { label: "p69 · 141.14.72.24 AND 255.255.192.0", values: ["141.14.72.24", "255.255.192.0"], answer: "p69：141.14.64.0。第三字节 01001000 AND 11000000 → 01000000。" }
    ],
    cidr: [
      { label: "p94 · 140.120.84.24/20", values: ["140.120.84.24", "20"], answer: "p94：140.120.80.0–140.120.95.255；掩码 255.255.240.0；4096 个地址，合 16 个 C 类网络。" },
      { label: "p84 · 156.16.32.0/20", values: ["156.16.32.0", "20"], answer: "p84：156.16.32.0–156.16.47.255；4096 个地址，可指派 4094 个。" },
      { label: "p88 · 156.47.40.4/18", values: ["156.47.40.4", "18"], answer: "p88：156.47.0.0–156.47.63.255；掩码 255.255.192.0；可用 16382。" }
    ],
    match: { options: ["86.33.224.123", "86.79.65.216", "86.58.119.74", "86.68.206.154"], answer: "课堂答案 (1) 86.33.224.123。" },
    aggregate: [
      { label: "p90 · 192.24.0–15", start: "192.24.0.0" },
      { label: "p91 · 202.196.0–15", start: "202.196.0.0" }
    ],
    subnet: [
      { label: "136.23.12.64/26 等分 4 个", ip: "136.23.12.64", parent: 26, prefix: 28, rule: "p98：原块 2^6 = 64 个地址，等分 4 块。每块 /28，2^4 = 16 个地址。", answer: "A–D 网地末段：64、80、96、112。主机末段：65–78、81–94、97–110、113–126。", labels: ["A", "B", "C", "D"], hosts: true },
      { label: "130.53 与 255.255.224.0", ip: "130.53.0.0", parent: 16, prefix: 19, omit: true, rule: "p76：网络号 16 位，主机号 13 位，子网号 3 位。2^3 − 2 = 6，2^13 − 2 = 8190。", answer: "可用子网 6 个，每子网主机 8190 台。网地第三段：32、64、96、128、160、192，第四段均为 0。" },
      { label: "192.168.25.0 分 6 个", ip: "192.168.25.0", parent: 24, prefix: 27, omit: true, rule: "p77：2^n − 2 ≥ 6，取 n = 3，主机号 5 位。", answer: "掩码 255.255.255.224。六块网地末段：32、64、96、128、160、192。主机末段：33–62、65–94、97–126、129–158、161–190、193–222。", hosts: true },
      { label: "187.24.0.0 分 12 个系", ip: "187.24.83.29", prefix: 20, rule: "p73：B 类默认掩码 255.255.0.0。2^n − 2 ≥ 12，取 n = 4。网络号 16 位、子网号 4 位、主机号 12 位。", answer: "掩码 255.255.240.0，网络地址 187.24.80.0，广播地址 187.24.95.255。" },
      { label: "198.117.32.0 六部门", ip: "198.117.32.0", parent: 24, prefix: 27, omit: true, rule: "p78：2^n − 2 ≥ 6，取 n = 3；2^m − 2 ≥ 25，取 m = 5。", answer: "掩码 255.255.255.224。技术、设计、市场、财务、后勤、办公室对应网地末段 .32、.64、.96、.128、.160、.192。", labels: ["技术部", "设计部", "市场部", "财务部", "后勤部", "办公室"] },
      { label: "30.138.118/23 课堂分法", lans: [["LAN3", 150, "30.138.118.0", 24], ["LAN2", 91, "30.138.119.0", 25], ["LAN5", 15, "30.138.119.128", 26], ["LAN1", 3, "30.138.119.192", 27], ["LAN4", 3, "30.138.119.224", 27]], rule: "p96–97：原块 30.138.118.0/23，2^9 = 512 个地址。下表左侧取 p96 题干，地址块取 p97 板书。", answer: "课堂给出的一种分法：按 LAN3、LAN2、LAN5、LAN1、LAN4 依次为 30.138.118.0/24、30.138.119.0/25、30.138.119.128/26、30.138.119.192/27、30.138.119.224/27。" }
    ],
    fragment: [
      { label: "p48 · 4000 / 20 / 1500", total: 4000, header: 20, mtu: 1500, answer: "p48：数据 1480 / 1480 / 1020，偏移 0 / 185 / 370，MF 1 / 1 / 0。" },
      { label: "p47 · 3820 / 20 / 1420", total: 3820, header: 20, mtu: 1420, df: true, answer: "p47：数据 1400 / 1400 / 1000，总长 1420 / 1420 / 1020，偏移 0 / 175 / 350，MF 1 / 1 / 0，DF 均为 0。" }
    ],
    classify: ["10.2.3.4", "126.16.1.1", "128.11.3.31", "202.38.214.2", "192.168.214.2", "224.38.214.2", "10.33.42.255", "172.15.44.255", "172.32.100.255", "192.168.7.255"],
    ipv6: {
      fields: [["版本", 49, 0, 0, 34], ["通信量类", 98, 49, 0, 34], ["流标号", 245, 147, 0, 34], ["有效载荷长度", 196, 0, 34, 34], ["下一个首部", 98, 196, 34, 34], ["跳数限制", 98, 294, 34, 34], ["源地址（128 位）", 392, 0, 68, 88], ["目的地址（128 位）", 392, 0, 156, 88]],
      notes: ["版本", "通信量类", "流标号", "有效载荷长度 · 笔记中有效载荷（扩展首部／数据）至 64 KB。", "下一个首部", "跳数限制 · 笔记手写提示为最多经过路由器数、生存时间。", "源地址 · 128 位", "目的地址 · 128 位"]
    },
    quiz: [
      { q: "常用的 IP 地址分类有几类？", text: "类数", answer: "3", explain: "常用 A、B、C，共 3 类。" },
      { q: "哪些属于 C 类？（多选）", multi: ["10.2.3.4", "202.38.214.2", "192.168.214.2", "224.38.214.2"], answer: "BC", explain: "C 类首段为 192–223。" },
      { q: "哪些是私有地址？（多选，原题 D、E 重复）", multi: ["10.33.42.255", "172.15.44.255", "172.32.100.255", "192.168.7.255", "192.168.7.255"], answer: "ADE", explain: "私有范围看 10、172.16–172.31、192.168。" },
      { q: "126.16.1.1 属于哪一类？", text: "填写类别字母", answer: "A" },
      { q: "IP 通常采用什么表示？", text: "填写表示方法", answer: "点分十进制" },
      { q: "128.11.3.31 的网络标识是？", text: "填写网络号", answer: "128.11" },
      { q: "128.11.3.31 的主机标识是？", text: "填写主机号", answer: "3.31" },
      { q: "IPv4 为多少比特？", text: "填写位数", answer: "32" },
      { q: "IPv6 为多少比特？", text: "填写位数", answer: "128" },
      { q: "IP 地址分哪两部分？", text: "用“和”连接", answer: "网络号和主机号" },
      { q: "主机部分全 1 表示什么地址？", text: "填写地址名称", answer: "直接广播地址" },
      { q: "主机部分全 0 表示什么地址？", text: "填写地址名称", answer: "网络地址" },
      { q: "127.0.0.1 称为什么地址？", text: "也可填“回送地址”", answer: "环回地址", alias: "回送地址" }
    ],
    sources: {
      and: "笔记 p87、p69 AND 运算", cidr: "笔记 p84、p88、p93、p94 CIDR", match: "笔记 p93 CIDR", aggregate: "笔记 p90–91 路由聚合",
      subnet: "笔记 p73、p76–78、p95–98 与作业解析 01–03", fragment: "笔记 p47–49 IPv4 分片", classify: "笔记 p4–9 分类与私有地址、p68、p83",
      quiz: "笔记 p4–9", ipv6: "笔记 01 · p107 IPv6 基本首部",
      layers: "第 1 章 1.3", structure: "第 2 章 2.2", howto: "wy/css/howto.html · 课堂 web-n01/n03/n04", box: "wy/css/box.html · 盒子模型",
      link: "课堂 web-n02 · wy/css/link.html", text: "课堂 web-n05/n06/n09/n10", selectors: "课堂 web-n07/n08", forms: "课堂 web-n11/n12 · 表单关联",
      widgets: "课堂 web-n13/n14 · datalist 与 range", htmldemo: "wy/html/quiz.html"
    }
  };

  /* ---------- 小工具 ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function table(headers, rows) {
    return '<div class="lab-table" tabindex="0" role="region" aria-label="表格"><table><thead><tr>' + headers.map((h) => '<th scope="col">' + h + "</th>").join("") +
      "</tr></thead><tbody>" + rows.map((r) => "<tr>" + r.map((c) => "<td>" + c + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  }
  function bits(ip, prefix = 32) {
    const bin = NC.ipv4ToInt(ip).toString(2).padStart(32, "0");
    const bytes = [0, 8, 16, 24].map((s) => '<span class="lab-byte">' + [...bin.slice(s, s + 8)].map((b, i) => '<span class="' + (s + i < prefix ? "lab-pre" : "lab-host") + '">' + b + "</span>").join("") + "</span>");
    return '<code class="lab-bits">' + bytes.join(" ") + "</code>";
  }
  const bitTable = (rows, prefix) => table(["字段", "二进制", "点分十进制"], rows.map(([l, ip]) => [l, bits(ip, prefix), ip]));
  function diagram(labels, active, sizes = labels.map(() => 1)) {
    const scale = 320 / sizes.reduce((a, b) => a + b, 0);
    let left = 0;
    return '<svg class="lab-diagram" viewBox="0 0 320 44" aria-hidden="true">' + labels.map((l, i) => {
      const w = sizes[i] * scale, x = left; left += w;
      return '<rect x="' + (x + 1) + '" y="2" width="' + Math.max(0, w - 2) + '" height="39" rx="5"' + (i === active ? ' class="on"' : "") + '/><text x="' + (x + w / 2) + '" y="26" text-anchor="middle"' + (i === active ? ' class="on"' : "") + ">" + l + "</text>";
    }).join("") + "</svg>";
  }
  function andRows(ip, mask, network) {
    const first = NC.ipv4ToInt(mask).toString(2).padStart(32, "0").indexOf("0");
    return bitTable([["IP", NC.intToIpv4(NC.ipv4ToInt(ip))], ["AND 掩码", mask], ["网络地址", network]], first === -1 ? 32 : first);
  }
  const subset = (all, attr) => {
    const idx = attr ? attr.split(",").map(Number) : all.map((_, i) => i);
    return idx.map((i) => [i, all[i]]);
  };
  const frame = (root, title, body) => { root.innerHTML = body; root.setAttribute("role", "group"); root.setAttribute("aria-label", title); };
  const srcLine = (root, key) => '<p class="lab-src">出处：' + esc(root.dataset.src || DATA.sources[key] || "") + "</p>";
  const pick = (id, label, options) => '<label class="lab-field">' + label + '<select data-r="' + id + '">' + options.map(([v, t]) => '<option value="' + esc(v) + '">' + esc(t) + "</option>").join("") + "</select></label>";
  const q = (root, id) => root.querySelector('[data-r="' + id + '"]');
  const showError = (box, msg) => { box.replaceChildren(); const p = document.createElement("p"); p.className = "lab-error"; p.textContent = msg; box.append(p); };

  /* ---------- 计算类：example + 两个输入 ---------- */
  function calcWithInputs(root, key, labels, examples, render) {
    const id = "lab" + ++seq;
    frame(root, "可视化讲解 · " + labels.title,
      pick("example", "课堂例题", examples.map(([i, e]) => [i, e.label])) +
      '<div class="lab-fields">' + labels.fields.map((f, k) => '<label class="lab-field">' + f + '<input type="text" spellcheck="false" autocomplete="off" data-r="in' + k + '"></label>').join("") + "</div>" +
      '<h4 class="lab-h" data-r="title">课堂原题演算</h4><div data-r="result" aria-live="polite"></div>' +
      '<h4 class="lab-h">课堂原题标准答案</h4><p data-r="answer"></p>' + srcLine(root, key));
    const sel = q(root, "example"), fields = [0, 1].map((k) => q(root, "in" + k));
    const ex = () => DATA[key][Number(sel.value)];
    function update() {
      const e = ex(), vals = fields.map((f) => f.value.trim());
      q(root, "answer").textContent = e.answer;
      q(root, "title").textContent = e.values.every((v, i) => v === vals[i]) ? "课堂原题演算" : "当前输入的推演";
      const box = q(root, "result");
      try {
        if (vals.some((v) => !v)) throw new RangeError("请填写所有输入。");
        box.innerHTML = render(vals);
      } catch (err) { showError(box, err.message); }
    }
    sel.addEventListener("change", () => { fields.forEach((f, i) => { f.value = ex().values[i]; }); update(); });
    root.addEventListener("input", (ev) => { if (ev.target !== sel) update(); });
    fields.forEach((f, i) => { f.value = ex().values[i]; });
    update();
  }

  const M = {};

  M.and = (root) => calcWithInputs(root, "and", { title: "AND 运算求网络地址", fields: ["IPv4 地址", "掩码或前缀"] }, subset(DATA.and, root.dataset.ex), ([ip, input]) => {
    const prefix = /^\/?\d+$/.test(input);
    const mask = prefix ? NC.cidrBlock(ip, Number(input.replace(/^\//, ""))).mask : NC.intToIpv4(NC.ipv4ToInt(input));
    if (!/^1*0*$/.test(NC.ipv4ToInt(mask).toString(2).padStart(32, "0"))) throw new RangeError("掩码需要由连续的 1 和随后的 0 组成。");
    return andRows(ip, mask, NC.andNetwork(ip, mask));
  });

  M.cidr = (root) => calcWithInputs(root, "cidr", { title: "CIDR 地址块", fields: ["IPv4 地址", "前缀位数"] }, subset(DATA.cidr, root.dataset.ex), ([ip, input]) => {
    const prefix = Number(input);
    const b = NC.cidrBlock(ip, prefix);
    return bitTable([["IP", NC.intToIpv4(NC.ipv4ToInt(ip))], ["掩码", b.mask], ["最小", b.network], ["最大", b.broadcast]], prefix) +
      "<p>主机位：32 − " + prefix + " = " + (32 - prefix) + "。地址数：2^" + (32 - prefix) + " = " + b.addressCount + "。" +
      (prefix <= 30 ? "可指派：" + b.usableCount + "。" : "") + (prefix <= 24 ? "相当于 " + b.addressCount / 256 + " 个 C 类网络。" : "") + "</p>";
  });

  M.match = (root) => {
    frame(root, "可视化讲解 · 与 86.32/12 匹配",
      pick("match", "比较选项", DATA.match.options.map((o, i) => [o, "(" + (i + 1) + ") " + o])) +
      '<div data-r="result" aria-live="polite"></div><p><strong>' + esc(DATA.match.answer) + "</strong></p>" + srcLine(root, "match"));
    const sel = q(root, "match");
    const update = () => {
      const mask = "255.240.0.0", net = NC.andNetwork(sel.value, mask);
      q(root, "result").innerHTML = andRows(sel.value, mask, net) + "<p>与 86.32.0.0 比较：" + (net === "86.32.0.0" ? "匹配" : "不匹配") + "</p>";
    };
    sel.addEventListener("change", update); update();
  };

  M.aggregate = (root) => {
    const list = subset(DATA.aggregate, root.dataset.ex);
    frame(root, "可视化讲解 · 路由聚合",
      pick("example", "汇总原题", list.map(([i, e]) => [i, e.label])) + '<h4 class="lab-h" data-r="title">课堂原题演算</h4><div data-r="result" aria-live="polite"></div>' +
      '<h4 class="lab-h">课堂原题标准答案</h4><p data-r="answer"></p>' + srcLine(root, "aggregate"));
    const sel = q(root, "example");
    const update = () => {
      const start = DATA.aggregate[Number(sel.value)].start, r = NC.aggregateConsecutiveC(start, 16), base = start.split(".").slice(0, 2).join(".");
      const routes = Array.from({ length: 16 }, (_, i) => {
        const bin = i.toString(2).padStart(8, "0");
        return [base + "." + i + ".0/24", '<code><span class="lab-pre">' + bin.slice(0, 4) + '</span><span class="lab-host">' + bin.slice(4) + "</span></code>"];
      });
      q(root, "answer").textContent = base + ".0.0/20，掩码 255.255.240.0，16 个路由项目合成 1 个。";
      q(root, "result").innerHTML = diagram(["16 个 /24", "1 个 /20"], 1) + "<p>共同前缀 8 + 8 + 4 = 20 位 → <strong>" + r.network + "/" + r.prefix +
        "</strong>。原掩码 255.255.255.0，汇总掩码 " + r.mask + "。</p>" + table(["原路由项目", "第三字节"], routes);
    };
    sel.addEventListener("change", update); update();
  };

  M.subnet = (root) => {
    const list = subset(DATA.subnet, root.dataset.ex);
    frame(root, "可视化讲解 · 子网划分",
      pick("example", "原题", list.map(([i, e]) => [i, e.label])) + '<p data-r="rule" aria-live="polite"></p>' +
      '<h4 class="lab-h">课堂演算</h4><div data-r="result" aria-live="polite"></div><h4 class="lab-h">课堂原题标准答案</h4><p data-r="answer"></p>' + srcLine(root, "subnet"));
    const sel = q(root, "example");
    const update = () => {
      const t = DATA.subnet[Number(sel.value)], out = q(root, "result");
      q(root, "rule").textContent = t.rule; q(root, "answer").textContent = t.answer;
      if (t.lans) {
        out.innerHTML = diagram(t.lans.map(([l]) => l)) + table(["局域网", "题干主机数", "板书地址块", "掩码（二进制）"],
          t.lans.map(([l, h, ip, p]) => [l, h, ip + "/" + p, bits(NC.cidrBlock(ip, p).mask, p)]));
        return;
      }
      const b = NC.cidrBlock(t.ip, t.prefix);
      let html = andRows(t.ip, b.mask, b.network);
      if (t.parent === undefined) html += bitTable([["广播地址", b.broadcast]], t.prefix);
      else {
        const blocks = NC.splitSubnets(t.ip, t.parent, t.prefix, t.omit), heads = ["子网", "子网号", "网络地址"];
        if (t.hosts) heads.push("最小主机", "最大主机");
        html += table(heads, blocks.map((s, i) => {
          const row = [t.labels && t.labels[i] != null ? t.labels[i] : i + 1, s.index.toString(2).padStart(t.prefix - t.parent, "0"), s.network + "/" + t.prefix];
          if (t.hosts) row.push(s.firstHost, s.lastHost);
          return row;
        }));
      }
      out.innerHTML = html;
    };
    sel.addEventListener("change", update); update();
  };

  M.fragment = (root) => {
    const list = subset(DATA.fragment, root.dataset.ex);
    frame(root, "可视化讲解 · IPv4 数据报分片",
      pick("example", "总长 / 首部 / MTU", list.map(([i, e]) => [i, e.label])) + '<p data-r="process"></p>' +
      '<label class="lab-field">查看分片<select data-r="piece"></select></label><div data-r="piece-view" aria-live="polite"></div>' +
      '<h4 class="lab-h">课堂原题演算</h4><div data-r="result"></div><h4 class="lab-h">课堂原题标准答案</h4><p data-r="answer"></p>' + srcLine(root, "fragment"));
    const sel = q(root, "example"), piece = q(root, "piece");
    let frags = [];
    const view = () => {
      const i = Number(piece.value), f = frags[i];
      q(root, "piece-view").innerHTML = diagram(frags.map((_, k) => "片 " + (k + 1)), i, frags.map((p) => p.dataLength)) +
        "<p>片 " + (i + 1) + " 的偏移：" + f.offset * 8 + " ÷ 8 = " + f.offset + "。MF = " + f.MF + "，片偏移二进制 <code>" + f.offset.toString(2) + "</code>。</p>";
    };
    const update = () => {
      const e = DATA.fragment[Number(sel.value)];
      frags = NC.fragmentPlan(e.total, e.header, e.mtu);
      q(root, "answer").textContent = e.answer;
      q(root, "process").textContent = "数据总长 " + e.total + " − " + e.header + " = " + (e.total - e.header) + " B；每片最多 " + e.mtu + " − " + e.header + " = " + (e.mtu - e.header) + " B 数据。";
      piece.replaceChildren(...frags.map((_, i) => { const o = document.createElement("option"); o.value = i; o.textContent = "片 " + (i + 1); return o; }));
      view();
      const heads = ["片", "数据（B）", "总长（B）", "片偏移", "MF"]; if (e.df) heads.push("DF");
      q(root, "result").innerHTML = table(heads, frags.map((p, i) => { const r = [i + 1, p.dataLength, p.totalLength, p.offset * 8 + " ÷ 8 = " + p.offset, p.MF]; if (e.df) r.push(0); return r; }));
    };
    sel.addEventListener("change", update); piece.addEventListener("change", view); update();
  };

  M.classify = (root) => {
    frame(root, "可视化讲解 · 地址分类与私有地址",
      pick("example", "IPv4 地址", DATA.classify.map((v) => [v, v])) + '<div data-r="result" aria-live="polite"></div><p class="lab-note">私有范围：10、172.16–172.31、192.168</p>' + srcLine(root, "classify"));
    const sel = q(root, "example");
    const update = () => {
      const ip = sel.value, [a, b, c, d] = ip.split(".").map(Number), kind = a <= 126 ? "A" : a <= 191 ? "B" : a <= 223 ? "C" : "D";
      const cut = { A: 1, B: 2, C: 3 }[kind], priv = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168), addr = [a, b, c, d];
      q(root, "result").innerHTML = "<p><strong>" + kind + " 类</strong> · " + (priv ? "在课堂私有地址范围内" : "不在课堂私有地址范围内") + "</p>" + bits(ip, (cut || 4) * 8) +
        (cut ? "<p>网络号 " + addr.slice(0, cut).join(".") + "；主机号 " + addr.slice(cut).join(".") + "。</p>" : "");
    };
    sel.addEventListener("change", update); update();
  };

  M.quiz = (root) => {
    const id = "lab" + ++seq, items = subset(DATA.quiz, root.dataset.q);
    let html = "";
    items.forEach(([n, it]) => {
      html += '<fieldset class="lab-q" data-answer="' + esc(it.answer) + '"' + (it.alias ? ' data-alias="' + esc(it.alias) + '"' : "") + (it.explain ? ' data-explain="' + esc(it.explain) + '"' : "") + "><legend>" + (n + 1) + ". " + esc(it.q) + "</legend>";
      if (it.multi) html += it.multi.map((o, k) => '<label class="lab-opt"><input type="checkbox" value="' + "ABCDE"[k] + '"> ' + "ABCDE"[k] + ". " + esc(o) + "</label>").join("");
      else html += '<label class="lab-opt">' + esc(it.text) + ' <input class="lab-text" type="text" size="14" autocomplete="off"></label>';
      html += '<p class="lab-fb" aria-live="polite"></p></fieldset>';
    });
    frame(root, "可视化讲解 · 原题自测", '<form class="lab-quiz">' + html + '<div class="lab-actions"><button type="submit">核对答案</button><button type="reset">重做</button></div><p class="lab-score" aria-live="polite"></p></form>' + srcLine(root, "quiz"));
    const form = root.querySelector("form");
    form.addEventListener("submit", (ev) => {
      ev.preventDefault();
      let score = 0;
      const qs = form.querySelectorAll(".lab-q");
      qs.forEach((qn) => {
        const t = qn.querySelector(".lab-text");
        const got = t ? t.value.trim() : [...qn.querySelectorAll("input:checked")].map((i) => i.value).join("");
        const ok = got === qn.dataset.answer || got === qn.dataset.alias;
        score += Number(ok);
        qn.querySelector(".lab-fb").textContent = (ok ? "正确。" : got ? "再对照原题。" : "尚未作答。") + "答案 " + qn.dataset.answer + "。" + (qn.dataset.explain || "");
      });
      form.querySelector(".lab-score").textContent = "答对 " + score + " / " + qs.length + " 题";
    });
    form.addEventListener("reset", () => form.querySelectorAll(".lab-fb, .lab-score").forEach((o) => { o.textContent = ""; }));
  };

  M.ipv6 = (root) => {
    const f = DATA.ipv6;
    const svg = '<svg class="lab-diagram lab-ipv6" viewBox="-1 -1 394 246" role="img" aria-label="IPv6 基本首部结构图，从版本到目的地址，共 40 字节">' +
      f.fields.map(([name, w, x, y, h], i) => '<rect data-f="' + i + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/><text data-f="' + i + '" x="' + (x + w / 2) + '" y="' + (y + h / 2 + 4) + '" text-anchor="middle">' + name + "</text>").join("") + "</svg>";
    frame(root, "可视化讲解 · IPv6 基本首部（40 字节）",
      pick("field", "高亮字段", f.fields.map(([n], i) => [i, n.replace("（128 位）", "")])) + svg + '<p data-r="result" aria-live="polite"></p>' + srcLine(root, "ipv6"));
    const sel = q(root, "field");
    const update = () => {
      const i = Number(sel.value);
      root.querySelectorAll("[data-f]").forEach((n) => n.classList.toggle("on", Number(n.dataset.f) === i));
      q(root, "result").textContent = f.notes[i];
    };
    sel.addEventListener("change", update); update();
  };

  /* ---------- 网页设计类 ---------- */
  const toggles = (root, id, render) => {
    const bs = [...q(root, id).querySelectorAll("button")];
    const run = () => render(new Set(bs.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.value)));
    bs.forEach((b) => b.addEventListener("click", () => { b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true")); run(); }));
    run();
  };
  const switches = (root, id, initial, render) => {
    const bs = [...q(root, id).querySelectorAll("button")];
    const set = (v) => { bs.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === v))); render(v); };
    bs.forEach((b) => b.addEventListener("click", () => set(b.dataset.value)));
    set(initial);
  };
  const btns = (id, items) => '<div class="lab-actions" data-r="' + id + '">' + items.map(([v, t]) => '<button type="button" data-value="' + v + '" aria-pressed="false">' + t + "</button>").join("") + "</div>";

  M.layers = (root) => {
    frame(root, "可视化讲解 · 网页三层结构",
      btns("layers", [["style", "CSS 样式层"], ["behavior", "JavaScript 行为层"]]) + '<div data-r="diagram"></div><div class="lab-sample" data-r="sample"><h5>HTML 结构层</h5><p data-r="text" aria-live="polite">中国，你好！</p><button type="button" data-r="act" hidden>切换文字颜色</button></div>' + srcLine(root, "layers"));
    toggles(root, "layers", (on) => {
      q(root, "diagram").innerHTML = diagram(["HTML", "CSS", "JavaScript"], on.has("behavior") ? 2 : on.has("style") ? 1 : 0);
      q(root, "sample").classList.toggle("lab-styled", on.has("style"));
      q(root, "act").hidden = !on.has("behavior");
      if (!on.has("behavior")) q(root, "text").style.color = "";
    });
    q(root, "act").addEventListener("click", () => { const t = q(root, "text"); t.style.color = t.style.color ? "" : "#1e3a8a"; });
  };

  M.structure = (root) => {
    const L = (part, t) => '<span class="lab-line" data-part="' + part + '">' + esc(t) + "</span>";
    frame(root, "可视化讲解 · HTML5 文档结构",
      btns("structure", [["doctype", "声明"], ["html", "根标签"], ["head", "头部／标签栏"], ["body", "主体／主窗口"]]) +
      '<div class="lab-two"><pre><code>' + L("doctype", "<!doctype html>") + L("html", "<html>") + L("head", "  <head>") + L("head", '    <meta charset="utf-8">') + L("head", "    <title>myweb</title>") + L("head", "  </head>") + L("body", "  <body>中国，你好！</body>") + L("html", "</html>") +
      '</code></pre><div class="lab-sample"><div class="lab-line" data-part="head">标签栏 · myweb</div><div class="lab-line" data-part="body">主窗口 · 中国，你好！</div><p data-r="result" aria-live="polite"></p></div></div>' + srcLine(root, "structure"));
    switches(root, "structure", "head", (v) => {
      root.querySelectorAll("[data-part]").forEach((p) => p.classList.toggle("on", p.dataset.part === v));
      q(root, "result").textContent = { doctype: "文档类型声明告诉浏览器采用 HTML5 标准。", html: "根标签包裹文档头部与主体。", head: "head 存放编码、标题和元数据，title 对应标签栏。", body: "body 对应浏览器主窗口中的可见内容。" }[v];
    });
  };

  M.howto = (root) => {
    frame(root, "可视化讲解 · CSS 三种引入方式",
      btns("howto", [["external", "外部 CSS"], ["internal", "内部 CSS"], ["inline", "行内 CSS"]]) + '<p class="lab-howto" data-r="sample">同一段示例文字</p><p data-r="result" aria-live="polite"></p>' +
      '<pre><code>&lt;link rel="stylesheet" href="css/c1.css"&gt;\n&lt;style&gt;.wy-internal { color: purple; }&lt;/style&gt;\n&lt;p style="color: #b91c1c"&gt;同一段示例文字&lt;/p&gt;</code></pre>' + srcLine(root, "howto"));
    toggles(root, "howto", (on) => {
      const s = q(root, "sample");
      s.classList.toggle("ext", on.has("external")); s.classList.toggle("int", on.has("internal"));
      s.style.color = on.has("inline") ? "#b91c1c" : "";
      q(root, "result").textContent = "当前颜色：" + (on.has("inline") ? "行内样式" : on.has("internal") ? "内部样式（本示例选择器权重更高）" : on.has("external") ? "外部样式" : "页面默认颜色");
    });
  };

  M.box = (root) => {
    const id = "lab" + ++seq;
    const rng = (k, label, min, max, val) => '<label class="lab-field"><span>' + label + ' <output data-r="' + k + '-v" for="' + id + k + '">' + val + '</output> px</span><input id="' + id + k + '" data-r="' + k + '" type="range" min="' + min + '" max="' + max + '" value="' + val + '"></label>';
    const bx = (m) => '<div class="lab-track"><div class="lab-box" data-r="' + m + '" style="box-sizing:' + m + '"><div>内容</div></div></div>';
    frame(root, "可视化讲解 · CSS 盒子模型",
      '<div class="lab-fields">' + rng("width", "width", 100, 300, 200) + rng("padding", "padding", 0, 32, 20) + rng("border", "border", 0, 12, 4) + "</div>" +
      '<p><strong>content-box</strong> · <output data-r="content-box-v"></output></p>' + bx("content-box") + '<p><strong>border-box</strong> · <output data-r="border-box-v"></output></p>' + bx("border-box") + srcLine(root, "box"));
    const upd = () => {
      ["width", "padding", "border"].forEach((k) => { q(root, k + "-v").value = q(root, k).value; });
      ["content-box", "border-box"].forEach((m) => {
        const b = q(root, m);
        b.style.width = q(root, "width").value + "px"; b.style.padding = q(root, "padding").value + "px"; b.style.borderWidth = q(root, "border").value + "px";
        q(root, m + "-v").value = b.offsetWidth + " px";
      });
    };
    root.addEventListener("input", upd); upd();
  };

  M.link = (root) => {
    const tid = "lab" + ++seq;
    frame(root, "可视化讲解 · 链接四态",
      '<div class="lab-linkstage"><a class="lab-link" data-r="link" href="#' + tid + '">链接示例</a></div>' + btns("ctl", [["normal", "浏览器原生"], ["hover", "模拟悬停"], ["active", "模拟按下"]]) +
      '<p data-r="status" aria-live="polite"></p><p id="' + tid + '">链接跳转目标。已访问样式由浏览器历史和隐私规则决定。</p>' +
      '<pre><code>a:link { color: red; }\na:visited { color: green; }\na:hover { color: yellow; font: 30px "楷体"; }\na:active { color: blue; }</code></pre>' + srcLine(root, "link"));
    switches(root, "ctl", "normal", (v) => {
      const l = q(root, "link");
      l.classList.toggle("hov", v === "hover"); l.classList.toggle("act", v === "active");
      q(root, "status").textContent = { normal: "浏览器原生状态。", hover: "模拟 :hover · 黄色、30px 楷体。", active: "模拟 :active · 蓝色。" }[v];
    });
  };

  M.text = (root) => {
    const opts = (arr) => arr.map((v) => [v, v]);
    frame(root, "可视化讲解 · CSS 文本属性",
      "<h4 class=\"lab-h\">text-overflow</h4>" + pick("overflow", "显示方式", opts(["clip", "ellipsis"])) + '<p class="lab-text-s lab-ovf" data-r="ovf-s">这是一行用来查看裁切与省略号的示例文字。</p>' +
      '<h4 class="lab-h">text-shadow</h4><label class="lab-opt"><input type="checkbox" data-r="shadow" checked> 启用课堂双阴影</label><p class="lab-text-s" data-r="shadow-s">文字阴影</p><pre><code>text-shadow: 3px 3px 0 #dbeafe, 7px 7px 10px #bfc7d4;</code></pre>' +
      '<h4 class="lab-h">text-indent</h4>' + pick("indent", "首行缩进", opts(["0", "2em", "20%"])) + '<p class="lab-text-s" data-r="indent-s">这是首行缩进的示例。文字换行后可以对比首行与后续行。</p>' +
      '<h4 class="lab-h">white-space</h4>' + pick("space", "空白处理", opts(["normal", "pre", "nowrap", "pre-wrap", "pre-line"])) + '<p class="lab-text-s lab-spc" data-r="space-s">甲    乙    丙\n这一行文字用来观察自动换行和空白折叠。</p><p data-r="space-n" aria-live="polite"></p>' + srcLine(root, "text"));
    q(root, "overflow").addEventListener("change", (e) => { q(root, "ovf-s").style.textOverflow = e.target.value; });
    q(root, "indent").addEventListener("change", (e) => { q(root, "indent-s").style.textIndent = e.target.value; });
    const sh = () => { q(root, "shadow-s").style.textShadow = q(root, "shadow").checked ? "3px 3px 0 #dbeafe, 7px 7px 10px #bfc7d4" : ""; };
    q(root, "shadow").addEventListener("change", sh); sh();
    const sp = () => {
      const v = q(root, "space").value; q(root, "space-s").style.whiteSpace = v;
      q(root, "space-n").textContent = { normal: "折叠连续空白，自动换行。", pre: "保留空白，按原样换行。", nowrap: "折叠空白，关闭自动换行。", "pre-wrap": "保留空白，自动换行。", "pre-line": "折叠部分空白，保留原有换行。" }[v];
    };
    q(root, "space").addEventListener("change", sp); sp();
  };

  M.selectors = (root) => {
    frame(root, "可视化讲解 · 选择器 :root 与 :not()",
      btns("sel", [["root", ":root"], ["negation", ":not(.tip)"]]) + '<p data-r="note" aria-live="polite"></p><div class="lab-sample"><code>&lt;html&gt;</code> 根元素示意<div class="lab-selector" data-r="prev"><p>&lt;p&gt; 普通段落</p><p class="tip">&lt;p class="tip"&gt; 提示段落</p><div>&lt;div&gt; 普通容器</div></div></div>' + srcLine(root, "selectors"));
    switches(root, "sel", "root", (v) => {
      const p = q(root, "prev");
      p.classList.toggle("is-root", v === "root"); p.classList.toggle("is-not", v === "negation");
      q(root, "note").textContent = v === "root" ? "匹配根元素 html，常用于声明全局自定义属性。" : "普通段落和容器匹配，提示段落仍然显示。";
    });
  };

  M.forms = (root) => {
    const id = "lab" + ++seq, A = id + "a", B = id + "b";
    frame(root, "可视化讲解 · 表单与 form 属性",
      '<div class="lab-two"><form id="' + A + '" class="lab-formbox"><p>表单 A</p><button>提交 A</button></form><form id="' + B + '" class="lab-formbox"><p>表单 B</p><button>提交 B</button></form></div>' +
      '<label class="lab-field">表外输入 <input data-r="outside" name="外部字段" form="' + A + '" value="课堂示例"></label>' + pick("owner", "关联 id", [[A, "form-a"], [B, "form-b"]]) +
      '<pre><code data-r="code"></code></pre><p data-r="result" aria-live="polite"></p>' +
      '<h4 class="lab-h">课堂表述与现行 HTML</h4><p>课堂第 12 张写有“一个控件可从属多个表单”。仓库整理页注明现行 HTML 的 form 属性是一个 ID 引用，本页按单个 id 演示。</p>' + srcLine(root, "forms"));
    const out = q(root, "outside"), name = (v) => (v === A ? "form-a" : "form-b");
    const upd = () => {
      out.setAttribute("form", q(root, "owner").value);
      q(root, "code").textContent = '<input name="外部字段" form="' + name(q(root, "owner").value) + '">';
      q(root, "result").textContent = "当前所属：" + name(out.form.id) + "。";
    };
    q(root, "owner").addEventListener("change", upd); upd();
    [A, B].forEach((fid) => {
      const f = root.querySelector("#" + fid);
      f.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const d = new FormData(f);
        q(root, "result").textContent = name(fid) + " 的提交结果：" + (d.has("外部字段") ? "外部字段 = " + JSON.stringify(d.get("外部字段")) : "无外部字段。");
      });
    });
  };

  M.widgets = (root) => {
    const id = "lab" + ++seq, dl = id + "dl";
    frame(root, "可视化讲解 · datalist 与 range",
      '<h4 class="lab-h">datalist</h4><label class="lab-field">学校 <input data-r="school" list="' + dl + '" autocomplete="off"></label><datalist id="' + dl + '"><option value="学校 A"><option value="学校 B"></datalist>' +
      '<pre><code>&lt;input list="schools"&gt;\n&lt;datalist id="schools"&gt;…&lt;/datalist&gt;</code></pre><p data-r="school-s" aria-live="polite"></p>' +
      '<h4 class="lab-h">range</h4>' + pick("step", "步长", [["1", "1"], ["5", "5"], ["10", "10"]]) + '<label class="lab-field">值 <input type="range" data-r="range" min="0" max="100" step="1" value="50"></label><p data-r="range-c" aria-live="polite"></p>' + srcLine(root, "widgets"));
    const sch = q(root, "school"), rg = q(root, "range");
    sch.addEventListener("input", () => {
      const listed = [...sch.list.options].some((o) => o.value === sch.value);
      q(root, "school-s").textContent = sch.value ? (listed ? "已填写列表中的值。" : "已填写列表外的值。") : "";
    });
    const show = () => { q(root, "range-c").textContent = "min=" + rg.min + " · max=" + rg.max + " · step=" + rg.step + " · value=" + rg.value; };
    q(root, "step").addEventListener("change", (e) => { rg.step = e.target.value; show(); });
    rg.addEventListener("input", show); show();
  };

  M.htmldemo = (root) => {
    const d = root.dataset.demo, href = root.dataset.href || "../ch2/s22.html";
    const demos = {
      single: ["单标签", "<pre><code>上方文字&lt;br&gt;下方文字&lt;hr&gt;</code></pre><p>上方文字<br>下方文字</p><hr>"],
      title: ["title 与标签栏", "<pre><code>&lt;head&gt;&lt;title&gt;myweb&lt;/title&gt;&lt;/head&gt;</code></pre><p>标签栏示意 · myweb</p>"],
      target: ["target=\"_blank\"", '<pre><code>&lt;a href="' + href + '" target="_blank"&gt;在新标签页打开&lt;/a&gt;</code></pre><a href="' + href + '" target="_blank" rel="noopener">在新标签页打开</a>'],
      entity: ["字符实体", "<pre><code>&amp;lt;</code></pre><p>渲染结果 · &lt;</p>"],
      extcss: ["外链 CSS", '<pre><code>&lt;link rel="stylesheet" href="../shared.css"&gt;</code></pre><p class="lab-ext">这行文字的颜色来自本地外部样式表。</p>']
    };
    frame(root, "可视化讲解 · " + demos[d][0], "<h4 class=\"lab-h\">" + demos[d][0] + "</h4>" + demos[d][1] + srcLine(root, "htmldemo"));
  };

  function mount(page) {
    (page || document).querySelectorAll("figure.lab[data-lab]").forEach((root) => {
      if (root.dataset.labReady) return;
      const fn = M[root.dataset.lab];
      if (!fn) return;
      root.dataset.labReady = "1";
      fn(root);
    });
  }

  const api = { data: DATA, mount };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") {
    window.LabViz = api;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mount());
    else mount();
  }
})();
