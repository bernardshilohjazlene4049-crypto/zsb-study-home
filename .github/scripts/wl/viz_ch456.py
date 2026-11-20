from wl_viz import *

V = {}

# ---- 4-1-1 ----
def hdr(hi=None):
    names = ["标识", "标志", "片偏移"]
    return cd(*[{"x": n, "s": "", "c": "s hi" if hi in (n, "all") else ""} for n in names])
OPT411 = [("A", "头部中与分片相关的字段包括标识、标志和片偏移", "ok", "对"),
          ("B", "分片的最大长度为1024字节", "bad", "错"),
          ("C", "片偏移的值表明了分片在原始包中的相对位置", "ok", "对"),
          ("D", "小于1500B的分组封装成以太网帧的时候无需分片", "ok", "对")]
def opt_frame(k):
    a, t, c, v = OPT411[k]
    cards = [{"x": f"{x}. {tx}", "s": (vv if i == k else ""), "c": (cc if i == k else "dim")} for i, (x, tx, cc, vv) in enumerate(OPT411)]
    blocks = [cd(*cards)]
    if a == "B": blocks.append(ln(("1024 → MTU", "ok hi")))
    return F(blocks, f"{a} {v}", a)
V["4-1-1"] = [
    steps([F(hdr("标识"), "标识"), F(hdr("标志"), "标志"), F(hdr("片偏移"), "片偏移"), F(hdr("all"), "标识、标志、片偏移")]),
    steps([
        F(sc(0, 3000, [seg(0, 1499, "n", "小于 1500B")], tk=[[0, "0"], [1500, "1500B"]], mk=[[1500, "MTU = 1500B", "k"]], lg=False), "小于 1500B：直接通过"),
        F(sc(0, 3000, [seg(0, 1499, "n", "第 1 片"), seg(1500, 2399, "o", "超出部分")], tk=[[0, "0"], [1500, "1500B"]], mk=[[1500, "MTU = 1500B", "k"]], lg=False), "大于 1500B：被切开"),
    ]),
    tabs([opt_frame(k) for k in range(4)], "选项"),
]

# ---- 4-2-1 ----
def bar3820(strip=False):
    segs = [seg(0, 19, "o", "首部 20B（司机）")] if not strip else []
    start = 0 if strip else 20
    segs.append({"a": start, "b": 3820, "c": "n", "x": "数据 3800B（乘客）"})
    return sc(0, 3820, segs, tk=[[0, "0"], [3820, "3820B"]], lg=False)
def cutbar(cut):
    segs = [{"a": 0, "b": 1400, "c": "n", "x": "1400"}, {"a": 1400, "b": 2800, "c": "p" if cut else "n", "x": "1400"}, {"a": 2800, "b": 3800, "c": "h" if cut else "n", "x": "1000"}]
    return sc(0, 3800, segs, tk=[[0, "0"], [1400, "1400"], [2800, "2800"], [3800, "3800"]], lg=False) if cut else \
        sc(0, 3800, [{"a": 0, "b": 3800, "c": "n", "x": "数据 3800B"}], tk=[[0, "0"], [3800, "3800"]], lg=False)
def withhdr():
    segs, o = [], 0
    for d in (1400, 1400, 1000):
        segs += [{"a": o, "b": o + 20, "c": "o", "x": ""}, {"a": o + 20, "b": o + 20 + d, "c": "n", "x": f"{d + 20}B"}]
        o += d + 20
    return sc(0, o, segs, tk=[[0, "0"]], lg=False)
H421 = ["", "数据字段长度", "总长度", "MF", "DF", "片偏移"]
R421 = [["数据报片1", "1400B", "1420B", ["1", "ok"], "0", "0/8=0"], ["数据报片2", "1400B", "1420B", ["1", "ok"], "0", "1400/8=175"], ["数据报片3", "1000B", "1020B", ["0", "mute"], "0", "2800/8=350"]]
V["4-2-1"] = [
    steps([F(bar3820(), "3820B = 20B 首部 + 3800B 数据"), F(bar3820(True), "先剥掉首部：数据部分 3820 − 20 = 3800B")]),
    steps([F(cutbar(False), "3800B 数据"), F(cutbar(True), "按 1400B 切两刀：1400 | 1400 | 1000，起点 0、1400、2800")]),
    steps([F(cutbar(True), "1400 | 1400 | 1000"), F(withhdr(), "每段前面装上 20B 首部：总长度 1420 / 1420 / 1020")]),
    steps([F(tbl(H421, R421[:k], rh=True), r) for k, r in zip((1, 2, 3), ["MF = 1；片偏移 = 起点 ÷ 8 = 0/8 = 0", "MF = 1；片偏移 = 1400/8 = 175", "MF = 0（最后一片）；片偏移 = 2800/8 = 350"])]),
]

# ---- 4-3-1 ----
def v431_0():
    top = sc(0, 4000, [seg(0, 19, "o", "首 20"), {"a": 20, "b": 4000, "c": "n", "x": "数 3980"}], tk=[[0, "0"], [4000, "4000B"]], lg=False)
    low = sc(0, 4000, [seg(0, 19, "o", "首 20"), {"a": 20, "b": 1500, "c": "h", "x": "数 1480"}], tk=[[0, "0"], [1500, "1500B"]], lg=False)
    return [cap("数据报　4000B"), top, cap("数据报片　1500B（每片要带同样 20B 首部）"), low]
def trucks(k):
    items = [("1", "1480"), ("2", "1480"), ("3", "1020")]
    return cd(*[{"x": f"车 {n}", "s": f"{v} 人", "c": "h" if i < k else "dim"} for i, (n, v) in enumerate(items)])
V["4-3-1"] = [
    static(F(v431_0(), "3980 = 4000 − 20　1480 = 1500 − 20")),
    steps([F(trucks(1), "装 1480"), F(trucks(2), "再装 1480"), F(trucks(3), "余下 1020：3980 = 1480 + 1480 + 1020，共 3 辆车")]),
    static(F(sc(0, 4000, [{"a": 0, "b": 1500, "c": "n", "x": "第 1 片"}, {"a": 1500, "b": 4000, "c": "o", "x": "超出部分 → 下一片"}], tk=[[0, "0"], [1500, "1500B"], [4000, "4000B"]], mk=[[1500, "MTU = 1500B", "k"]], lg=False))),
]

# ---- 4-3-2 ----
H432 = ["", "数据字段", "片偏移", "MF"]
R432 = [["数据报片1", "1480B", "0/8 = 0", ["1", "ok"]], ["数据报片2", "1480B", "1480/8 = 185", ["1", "ok"]], ["数据报片3", "1020B", "2960/8 = 370", ["0", "mute"]]]
def bar3980(k):
    cols = ["n", "p", "h"]
    segs = [{"a": a, "b": b, "c": cols[i] + ("" if i < k else " dim"), "x": f"{b - a}"} for i, (a, b) in enumerate([(0, 1480), (1480, 2960), (2960, 3980)])]
    return sc(0, 3980, segs, tk=[[0, "0"], [1480, "1480"], [2960, "2960"], [3980, "3980"]], lg=False)
V["4-3-2"] = [
    steps([F([bar3980(k), tbl(H432, R432[:k])], r) for k, r in zip((1, 2, 3), ["切出 1480：片偏移 0/8 = 0，MF = 1", "再切 1480：片偏移 1480/8 = 185，MF = 1", "余下 1020：片偏移 2960/8 = 370，MF = 0"])]),
    static(F(sc(0, 3980, [{"a": 0, "b": 1480, "c": "n", "x": "1480"}, {"a": 1480, "b": 2960, "c": "p", "x": "1480"}, {"a": 2960, "b": 3980, "c": "h", "x": "1020"}],
                tk=[[0, "0"], [1480, "1480"], [2960, "2960"], [3980, "3980"]], mk=[[0, "偏移 0", "n"], [1480, "偏移 185", "p"], [2960, "偏移 370", "h"]], lg=False))),
    static(F(cd(("片 1", "MF = 1", "ok"), ("片 2", "MF = 1", "ok"), ("片 3", "MF = 0", "g")), "前两片亮 1，末片灭 0")),
]

# ---- 5-x ----
def v6_5(extend):
    return [bits([["", "n"]] * 32, 32, 8, x="IPv4　32 位"), bits([["", "p"]] * (128 if extend else 32), 32, 8, x="IPv6　128 位" if extend else "IPv6　32 位（起点）")]
def feat(k):
    items = [("更大的地址空间", "地址从 IPv4 的 32 位增大到 128 位", "128 位"), ("支持即插即用（即自动配置）", "不需要使用 DHCP", "DHCP"), ("首部改为 8 字节对齐", "首部长度必须是 8 字节的整数倍", "8 字节")]
    return cd(*[{"x": f"{i + 1}. {a}", "s": b, "c": "s hi" if i == k - 1 else ("s" if i < k else "dim")} for i, (a, b, _) in enumerate(items)])
V["5-1-1"] = [
    steps([F(v6_5(False), "IPv4 32 位　IPv6 先与它同长"), F(v6_5(True), "IPv6 拉长到 128 位")]),
    steps([F(feat(1), "128 位"), F(feat(2), "DHCP"), F(feat(3), "8 字节")]),
]
def v6dg(k):
    sg = [{"a": 0, "b": 20, "c": "n" + (" hi" if k == 0 else ""), "x": "基本首部 40B"}]
    if k >= 1:
        sg += [{"a": 20, "b": 45, "c": "s", "x": "扩展首部 1 … 扩展首部 N"}, {"a": 45, "b": 100, "c": "h", "x": "数据部分"}]
    else:
        sg += [{"a": 20, "b": 100, "c": "h", "x": "有效载荷 ≤65535B"}]
    return sc(0, 100, sg, lg=False)
V["5-2-1"] = [
    steps([F(v6dg(0), "基本首部 40B | 有效载荷 ≤65535B"), F(v6dg(1), "有效载荷 = 扩展首部 1 … 扩展首部 N + 数据部分")]),
    steps([F([v6dg(0), ln(("→ 发送方向", ""))], "基本首部发送在前")]),
]
ROWS = [[("版本", 0, 4), ("通信量类", 4, 12), ("流标号", 12, 32)], [("有效载荷长度", 0, 16), ("下一个首部", 16, 24), ("跳数限制", 24, 32)]]
COLS = ["n", "s", "h", "p", "o", "r"]
def ip6_fields():
    fl = [("版本", 4), ("通信量类", 8), ("流标号", 20), ("有效载荷长度", 16), ("下一个首部", 8), ("跳数限制", 8), ("源地址", 128), ("目的地址", 128)]
    return fl
def hdr_blocks(k):
    fl = ip6_fields()
    blocks, idx = [], 0
    rows = [[0, 1, 2], [3, 4, 5], [6], [7]]
    for r in rows:
        segs, off = [], 0
        for i in r:
            name, w = fl[i]
            ww = 32 if w > 32 else w
            segs.append({"a": off, "b": off + ww, "c": (COLS[i % 6] if i < k else "w") + (" hi" if i == k - 1 else ""), "x": f"{name}（{w}位）" if i < k else ""})
            off += ww
        blocks.append(sc(0, 32, segs, tk=[[0, "0"], [4, "4"], [12, "12"], [16, "16"], [24, "24"], [31, "31"]] if r == [0, 1, 2] else None, lg=False))
    return blocks
def bytes_bar(k):
    sg = [{"a": 0, "b": 4, "c": "n" if k >= 1 else "w dim", "x": "4"}, {"a": 4, "b": 8, "c": "s" if k >= 2 else "w dim", "x": "8"},
          {"a": 8, "b": 24, "c": "h" if k >= 3 else "w dim", "x": "源 16"}, {"a": 24, "b": 40, "c": "p" if k >= 4 else "w dim", "x": "目的 16"}]
    return sc(0, 40, sg, tk=[[0, "0"], [4, "4"], [8, "8"], [24, "24"], [40, "40"]], lg=False)
HOP = [("源", 3), ("R1", 2), ("R2", 1), ("R3", 0)]
def hop_frame(k):
    cards = [{"x": n, "s": f"跳数限制 {v}" + ("　丢弃" if v == 0 else ""), "c": ("bad" if v == 0 else "h") + (" hi" if i == k else "") if i <= k else "dim"} for i, (n, v) in enumerate(HOP)]
    return F(cd(*cards), "经过一个路由器，跳数限制减 1" if k else "发出", f"{k}")
V["5-3-1"] = [
    steps([F(hdr_blocks(k), f"{ip6_fields()[k - 1][0]}　{ip6_fields()[k - 1][1]} 位") for k in range(1, 9)]),
    steps([F(bytes_bar(k), "→".join(["4", "8", "24", "40"][:k]) + " 字节") for k in range(1, 5)]),
    steps([hop_frame(k) for k in range(4)]),
]

# ---- 6-1-x ----
def agg_rows(prefix, color=False):
    rows = []
    for k in range(16):
        b = b8(k)
        rows.append([f"{prefix}.{k}", [b[:4], "h" if color else ""], [b[4:], "mute" if color else ""]])
    return tbl(["地址", "第 3 字节前 4 位", "后 4 位"], rows, rh=True)
V["6-1-1"] = [
    steps([F(agg_rows("192.24"), "第 3 字节 0~15 的二进制"), F(agg_rows("192.24", True), "前 4 位 0000 全相同，只有后 4 位在变")]),
    steps([
        F(cd(("16 条路由", "192.24.0 ~ 192.24.15　掩码 255.255.255.0", "s")), "路由表中需要 16 个路由项目"),
        F(cd(("1 条路由", "192.24.0.0/20　掩码 255.255.240.0", "h hi")), "路由表中只需 1 个路由项目"),
    ]),
    steps([F(bits(cells((8, "n"), (24, "w")), 32, 8), "8"), F(bits(cells((16, "n"), (16, "w")), 32, 8), "8 + 8 = 16"), F(bits(cells((16, "n"), (4, "s"), (12, "w")), 32, 8), "8 + 8 + 4 = 20")]),
]
V["6-1-2"] = [
    steps([F(agg_rows("202.196"), "第 3 字节 0~15 的二进制"), F(agg_rows("202.196", True), "前 4 位相同；合并后 202.196.0.0/20")]),
    tabs([
        F(agg_rows("202.196"), "202.196.0 → 202.196.00000000.0 … 202.196.15 → 202.196.00001111.0", "① 写二进制"),
        F(agg_rows("202.196", True), "前 4 位 0000 相同", "② 找相同前缀"),
        F(ln(("202.196.0000 0000.0 /（8+8+4）", "mono"), ("= 202.196.0.0/20", "mono ok hi")), "汇总结果 202.196.0.0/20", "③ 写结果"),
    ], "步骤"),
]
