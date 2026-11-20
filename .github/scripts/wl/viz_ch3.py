from wl_viz import *

V = {}
SUBCOL = ["n", "h", "s", "p", "o", "r"]

# ---- 3-1-1 ----
def tree311(d):
    leaf = lambda x: {"x": x, "s": "/28　16 个", "c": "h"}
    root = {"x": "/26　136.23.12.64", "s": "2^(32−26) = 64 个", "c": "n", "k": [
        {"x": "0", "s": "/27　32 个", "c": "s", "k": [leaf("A"), leaf("B")]},
        {"x": "1", "s": "/27　32 个", "c": "s", "k": [leaf("C"), leaf("D")]}]}
    return tr(root, d)
SUB311 = {"A": 64, "B": 80, "C": 96, "D": 112}
def row311(name):
    base = SUB311[name]
    sub = format(["A", "B", "C", "D"].index(name), "02b")
    c = cells(("01", "r"), (sub, "n"), ("0000", "k"))
    return c
def sc311(sel=None):
    sg = []
    for i, name in enumerate("ABCD"):
        b = 64 + 16 * i
        dim = "" if sel in (None, name) else " dim"
        sg += [{"a": b, "b": b + 1, "c": "g" + dim, "x": ""}, {"a": b + 1, "b": b + 15, "c": "h" + dim, "x": name}, {"a": b + 15, "b": b + 16, "c": "g" + dim, "x": ""}]
    mk = []
    if sel:
        b = 64 + 16 * "ABCD".index(sel)
        mk = [[b + 1.5, f".{b + 1}", "h"], [b + 14, f".{b + 14}", "h"]]
    return sc(64, 128, sg, tk=[[64, ".64"], [128, ".127"]], mk=mk, lg=False)
V["3-1-1"] = [
    steps([F(tree311(0), "2^(32−26) = 64 个"), F(tree311(1), "/27 分 0、1：各 32 个"), F(tree311(2), "/28 分出 A B C D：各 16 个")]),
    tabs([F(bits(row311(n), 8, 8, lg=[["r", "原前缀 01"], ["n", "子网号"], ["k", "主机号"]]),
            f"{n}: 136.23.12.01{format('ABCD'.index(n), '02b')}0000 = 136.23.12.{SUB311[n]}/28", n) for n in "ABCD"], "子网"),
    tabs([F(sc311(), "第 4 字节 .64 ~ .127 切成 4 段", "全部")] + [
        F(sc311(n), f"{n}：136.23.12.{SUB311[n]}/28　最小主机地址 .{SUB311[n] + 1}　最大主机地址 .{SUB311[n] + 14}", n) for n in "ABCD"], "子网"),
]

# ---- 3-2-1 ----
def cake(d):
    n = {"x": "512", "k": [
        {"x": "0 · 256", "w": 1},
        {"x": "1 · 256", "w": 1, "dir": "col", "k": [
            {"x": "0 · 128"},
            {"x": "1 · 128", "dir": "row", "k": [
                {"x": "0 · 64"},
                {"x": "1 · 64", "dir": "col", "k": [{"x": "0 · 32"}, {"x": "1 · 32"}]}]}]}]}
    n["dir"] = "row"
    return sp(n, d)
LANS = [["L3", 80, 70, "LAN3", "p", 38, "151"], ["L2", 200, 55, "LAN2", "h", 28, "92"], ["L5", 270, 100, "LAN5", "o", 18, "16"], ["L4", 60, 140, "LAN4", "n", 13, "4"], ["L1", 150, 135, "LAN1", "s", 12, "3"]]
V["3-2-1"] = [
    steps([F(cake(0), "/23：2^(32−23) = 2^9 = 512 个"), F(cake(1), "第 24 位取 0 / 1：各 256 个"), F(cake(2), "右块再按第 25 位切：各 128 个"), F(cake(3), "继续切 64"), F(cake(4), "继续切 32")]),
    static(F(bits(cells(("0111011", "r"), ("0", "p")) + cells((1, "h")) + cells((7, "w")), 16, 16, by=8,
                  lg=[["r", "前 7 位：属于 /23 的 23 位"], ["p", "第 24 位"], ["h", "第 25 位"]]),
             "118 = 0111011|0：第 3 字节的前 7 位 + 第 24 位；第 4 字节最高位是第 25 位")),
    static(F(tp([[a, b, c, d, e, f, g] for a, b, c, d, e, f, g in LANS], []), "LAN2 92　LAN3 151　LAN4 4　LAN5 16　LAN1 3")),
]

# ---- 3-2-2 ----
LANTREE = {"x": "/23　30.138.0111011", "s": "512 个", "c": "r", "k": [
    {"x": "0 /24　LAN3", "s": "256 个", "c": "p"},
    {"x": "1", "s": "256 个", "c": "p", "k": [
        {"x": "0 /25　LAN2", "s": "128 个", "c": "h"},
        {"x": "1", "s": "128 个", "c": "h", "k": [
            {"x": "0 /26　LAN5", "s": "64 个", "c": "n"},
            {"x": "1", "s": "64 个", "c": "n", "k": [
                {"x": "0 /27　LAN1", "s": "32 个", "c": "s"},
                {"x": "1 /27　LAN4", "s": "32 个", "c": "s"}]}]}]}]}
LANROWS = [("LAN3", 118, 0, 24), ("LAN2", 119, 0, 25), ("LAN5", 119, 128, 26), ("LAN1", 119, 192, 27), ("LAN4", 119, 224, 27)]
def lanbits(third, fourth, plen):
    bs = ipbin(30, 138, third, fourth)
    lv = ["r", "p", "h", "n", "s"]
    c = []
    for i, ch in enumerate(bs):
        if i < 23: k = "r"
        elif i < plen: k = lv[min(i - 22, 4)]
        else: k = "k"
        c.append([ch, k])
    return c
def lan_frames():
    fr = []
    for k in range(1, 6):
        blocks = [bits(lanbits(t, f, p), 32, 16, x=f"{n}　30.138.{t}.{f}/{p}") for n, t, f, p in LANROWS[:k]]
        blocks.append(bits([["", "r"]], 1, 1, lg=[["r", "公共 23 位前缀"], ["p", "/24"], ["h", "/25"], ["n", "/26"], ["s", "/27"], ["k", "主机号"]]))
        fr.append(F(blocks, "", LANROWS[k - 1][0]))
    return fr
def lan_scale(sel=None):
    cols = ["p", "h", "n", "s", "o"]
    segs = []
    off = 0
    sizes = [256, 128, 64, 32, 32]
    for i, (n, t, f, p) in enumerate(LANROWS):
        dim = "" if sel in (None, n) else " dim"
        segs.append({"a": off, "b": off + sizes[i], "c": cols[i] + dim + (" hi" if sel == n else ""), "x": n})
        off += sizes[i]
    return sc(0, 512, segs, tk=[[0, "30.138.118.0"], [512, "30.138.119.255"]], lg=False)
NEED = {"LAN3": 151, "LAN2": 92, "LAN5": 16, "LAN1": 3, "LAN4": 4}
V["3-2-2"] = [
    steps([F(tr(LANTREE, d), r) for d, r in enumerate(["/23 → 2^(32−23) = 512 个", "/24 → 0 分支：3（即 LAN3），256 个", "/25 → 0 分支：2（LAN2），128 个", "/26 → 0 分支：5（LAN5），64 个", "/27 → 0 分支：1（LAN1），1 分支：4（LAN4），32 个"])]),
    steps(lan_frames()),
    tabs([F(lan_scale(), "30.138.118.0 ~ 30.138.119.255", "全部")] + [
        F(lan_scale(n), f"{n}　30.138.{t}.{f}/{p}　需要 {NEED[n]}　地址数 {sz}", n)
        for (n, t, f, p), sz in zip(LANROWS, [256, 128, 64, 32, 32])], "局域网"),
]

# ---- 3-3-1 ----
TRI = [["R1", 160, 30, "R1", "n"], ["R2", 60, 135, "R2", "n"], ["R3", 260, 135, "R3", "n"]]
TRIE = [["R1", "R2"], ["R2", "R3"], ["R1", "R3"]]
def tri(hl, labs):
    e = [[a, b, labs.get(i, "")] for i, (a, b) in enumerate(TRIE)]
    return tp(TRI, e, hl)
def lastbit_frame(bit):
    bs = ipbin(1, 1, 1, 24)[:31] + bit
    return F(bits([[ch, "n" if i < 31 else "h"] for i, ch in enumerate(bs)], lg=[["n", "前 31 位"], ["h", "最后 1 位：主机号"]]),
             f"1.1.1.24/31　主机号 {bit} → 1.1.1.{24 + int(bit)}", bit)
V["3-3-1"] = [
    steps([
        F(tri([], {}), "R1、R2、R3"),
        F(tri([0], {0: "N1"}), "N1 1.1.1.24/31：1.1.1.24、1.1.1.25"),
        F(tri([1], {1: "N2"}), "N2 1.1.1.26/31：1.1.1.26、1.1.1.27"),
        F(tri([2], {2: "N3"}), "N3 1.1.1.28/31：1.1.1.28、1.1.1.29"),
    ]),
    tabs([lastbit_frame("0"), lastbit_frame("1")], "最后 1 位"),
    static(F([bits([[ch, "n" if i < 29 else "h"] for i, ch in enumerate(ipbin(1, 1, 1, 16))], x="/29　LAN3 1.1.1.16/29", lg=[["n", "前 29 位"], ["h", "主机号 3 位"]]),
              bits([[ch, "n" if i < 31 else "h"] for i, ch in enumerate(ipbin(1, 1, 1, 24))], x="/31　N1 1.1.1.24/31", lg=[["n", "前 31 位"], ["h", "主机号 1 位"]])],
             "LAN：2^3 = 8 个地址　链路：2^1 = 2 个地址")),
]

# ---- 3-4-1 ----
S341 = bits(cells(("1000001000110101", "r"), ("001", "n"), ("00000", "k"), ("00000000", "k")), 32, 8,
            lg=[["r", "网络号 130.53（16 位）"], ["n", "子网号（3 位）"], ["k", "主机号（13 位）"]])
def sub_slider(prefix_bits, hostn, base_label, third_idx):
    pass
def s341_frames():
    fr = []
    for k in range(8):
        sb = format(k, "03b")
        bad = k in (0, 7)
        c = cells(("1000001000110101", "r"), (sb, "g x" if bad else "n"), ("0" * 13, "k"))
        addr = f"130.53.{k * 32}.0"
        r = f"{sb} 不可用 ×" if bad else f"{sb} → 130.53.{sb}00000.0 = {addr}"
        fr.append(F(bits(c, 32, 8, lg=[["r", "网络号"], ["n", "子网号"], ["k", "主机号"]]), r, sb))
    return fr
def sc341():
    sg = [{"a": 0, "b": 32, "c": "g", "x": "0"}]
    for k in range(1, 7): sg.append({"a": 32 * k, "b": 32 * k + 32, "c": SUBCOL[k - 1], "x": str(32 * k)})
    sg.append({"a": 224, "b": 256, "c": "g", "x": "224"})
    return sc(0, 256, sg, tk=[[32 * i, str(32 * i)] for i in range(0, 9, 2)], lg=False)
V["3-4-1"] = [static(F(S341)), slider(s341_frames(), "子网号"), static(F(sc341(), "第 3 字节：0 段和 224 段不可用"))]

# ---- 3-4-2 ----
def subnets_scale(upto, base="192.168.25", dept=None):
    sg = []
    for k in range(1, 7):
        o = 32 * k
        dim = "" if k <= upto else " dim"
        lab = dept[k - 1] if dept else str(o)
        sg += [{"a": o, "b": o + 1, "c": "g" + dim, "x": ""}, {"a": o + 1, "b": o + 31, "c": "h" + dim, "x": lab}, {"a": o + 31, "b": o + 32, "c": "g" + dim, "x": ""}]
    return sc(0, 256, sg, tk=[[32 * i, str(32 * i)] for i in range(0, 9, 2)], lg=False)
def s342_frames():
    fr = []
    for k in range(1, 7):
        o = 32 * k
        fr.append(F(subnets_scale(k), f"子网 {k}：192.168.25.{o}　主机 .{o + 1} ~ .{o + 30}", f"{k}"))
    return fr
V["3-4-2"] = [
    static(F([bits(cells(("001", "n"), ("00000", "k")), 8, 8, x="第 4 字节", lg=[["n", "子网号 3 位"], ["k", "主机号 5 位"]]),
              bits([["1", "n"]] * 3 + [["0", "g"]] * 5, 8, 8, x="掩码行")], "11100000 → 224")),
    steps([
        F(ln(("n = 1：2^1 − 2 = 0", "bad")), "0"),
        F(ln(("n = 1：2^1 − 2 = 0", "g"), ("n = 2：2^2 − 2 = 2", "bad")), "2"),
        F(ln(("n = 1：2^1 − 2 = 0", "g"), ("n = 2：2^2 − 2 = 2", "g"), ("n = 3：2^3 − 2 = 6 ≥ 6 ✔", "ok hi")), "6"),
    ]),
    steps(s342_frames()),
]

# ---- 3-4-3 ----
def dual_frames():
    fr = []
    for n in range(1, 8):
        m = 8 - n
        a, b = 2 ** n - 2, 2 ** m - 2
        oka, okb = a >= 6, b >= 25
        both = oka and okb
        fr.append(F([bits(cells(("0" * n, "s"), ("0" * m, "h")) if False else [["", "s"]] * n + [["", "h"]] * m, 8, 8, lg=[["s", f"子网号 n = {n}"], ["h", f"主机号 m = {m}"]]),
                     ln((f"2^{n} − 2 = {a}　{'≥ 6 ✔' if oka else '< 6 ✘'}", "ok" if oka else "bad"), (f"2^{m} − 2 = {b}　{'≥ 25 ✔' if okb else '< 25 ✘'}", "ok" if okb else "bad"))],
                    "n = 3、m = 5：两边都满足" if both else "", f"n = {n}"))
    return fr
DEPTS = ["技术部", "设计部", "市场部", "财务部", "后勤部", "办公室"]
def dept_frames():
    fr = []
    for k in range(1, 7):
        cards = [{"x": DEPTS[i], "s": f"198.117.32.{32 * (i + 1)}", "c": SUBCOL[i]} for i in range(k)]
        fr.append(F(cd(*cards), f"{DEPTS[k - 1]} 198.117.32.{format(k, '03b')} 00000 = 198.117.32.{32 * k}", f"{k}"))
    return fr
V["3-4-3"] = [
    slider(dual_frames(), "子网号位数"),
    steps(dept_frames()),
    static(F(sc(0, 256, [{"a": 0, "b": 32, "c": "g", "x": ""}] + [{"a": 32 * (k + 1), "b": 32 * (k + 2), "c": SUBCOL[k], "x": DEPTS[k]} for k in range(6)] + [{"a": 224, "b": 256, "c": "g", "x": ""}],
                tk=[[0, "198.117.32.0"], [256, "198.117.32.255"]], lg=False))),
]

# ---- 3-5-1 ----
def three(nn, ss, hh):
    return bits(cells((nn, "n"), (ss, "s"), (hh, "h")), 32, 8, lg=[["n", "网络号"], ["s", "子网号"], ["h", "主机号"]])
def maskrow(nn, ss, hh):
    return bits([["1", "n"]] * nn + [["1", "s"]] * ss + [["0", "h"]] * hh, 32, 8, x="子网掩码")
def s351_frames():
    fr = []
    for s in range(0, 17):
        hh = 16 - s
        fr.append(F([three(16, s, hh), maskrow(16, s, hh)], f"子网号位数 = 32 − 16 − {hh} = {s}", f"{s}"))
    return fr
def cls_frame(label, n, r):
    return F([bits(cells((n, "n"), (32 - n, "w")), 32, 8, lg=[["n", f"网络号 {n} 位"]])], r, label)
V["3-5-1"] = [
    static(F([three(16, 8, 8), maskrow(16, 8, 8)], "网络号全 1、子网号全 1、主机号全 0")),
    slider(s351_frames(), "子网号位数"),
    tabs([cls_frame("A 类", 8, "A 类：网络号 8 位（1:3）"), cls_frame("B 类", 16, "B 类：网络号 16 位（2:2）"), cls_frame("C 类", 24, "C 类：网络号 24 位（3:1）")], "地址类", 1),
]

# ---- 3-5-2 ----
def card4(a, b, c, d, cc, dd=None):
    return cd((a, "", "n"), (b, "", "n"), (c, "", cc), (d, "", "h"))
V["3-5-2"] = [
    static(F([cap("两级　net-id｜host-id"), card4("145", "13", "3", "10", "h"), cap("三级　net-id｜subnet-id｜host-id"), card4("145", "13", "3", "10", "s")])),
    static(F([maskrow(16, 8, 8)], "255.255.255.0")),
    steps([
        F([cd(("145", "", "n"), ("13", "", "n"), ("3", "", "s"), ("10", "", "h")), bits(cells(("00001010", "h")), 8, 8, x="主机号 10")], "145.13.3.10"),
        F([cd(("145", "", "n"), ("13", "", "n"), ("3", "", "s"), ("0", "", "h")), bits(cells(("00000000", "h")), 8, 8, x="主机号清零")], "10 → 0：子网的网络地址 145.13.3.0"),
    ]),
]

# ---- 3-5-3 ----
f353 = and_frames("72", b8(72), "192", b8(192), "结果", 1, "w", rs=[""] * 7 + ["01000000 = 64"])
f353b = and_frames("141.14.72.24", ipbin(141, 14, 72, 24), "255.255.192.0", ipbin(255, 255, 192, 0), "AND 结果", 8, "w",
                   rs=["141 AND 255 = 141：原样通过", "14 AND 255 = 14：原样通过", "72 AND 192 = 64：只保留前 2 位", "24 AND 0 = 0：全清零，结果 141.14.64.0"])
V["3-5-3"] = [
    steps(f353[0]),
    static(F(ln(("0 AND 1 = 0", "mono"), ("1 AND 1 = 1", "mono")))),
    steps(f353b[0]),
]

# ---- 3-6-1 / 3-6-2 ----
S7 = ["① 确定需要的子网个数", "② 确定从主机号字段借用的比特数", "③ 确定一个子网内可能的最多主机数", "④ 确定主机号字段需要保留的比特数", "⑤ 创建一个子网掩码", "⑥ 确定有效子网地址", "⑦ 确定每个子网的IP地址有效范围"]
MAP7 = ["子网个数 6 → 借用子网号位数 n（2^n − 2 ≥ 6，n = 3）", "子网个数 6 → 借用子网号位数 n（2^n − 2 ≥ 6，n = 3）", "每个子网最多主机数 → 主机号保留 5 位（2^5 − 2 = 30）",
        "每个子网最多主机数 → 主机号保留 5 位（2^5 − 2 = 30）", "子网掩码 255.255.255.224", "子网地址 .32 / .64 / … / .192", "每个子网主机范围（最小 = 网络地址 + 1，最大 = 网络地址 + 30）"]
def s7(k): return cd(*[{"x": t, "s": "", "c": "hi" if i == k else ("g" if i > k else "")} for i, t in enumerate(S7)])
EX = ["n = 3", "主机号 5 位", "掩码 255.255.255.224", "6 个子网", "子网地址 .32 / .64 / … / .192　最小 = 网络地址 + 1，最大 = 网络地址 + 30"]
V["3-6-1"] = [
    steps([F(s7(k), MAP7[k]) for k in range(7)]),
    steps([F(ln(*[(EX[i], "hi" if i == k else ("" if i < k else "g")) for i in range(5)]), "", f"{k + 1}") for k in range(5)]),
]
C4 = ["① 确定需要的子网个数", "② 确定一个子网内可能的最多主机数", "③ 确定网络前缀的位数", "④ 确定地址块"]
def two_cols(match=False):
    left = [{"x": t, "s": "", "c": "o" if match and i in (0, 2) else ""} for i, t in enumerate(S7)]
    right = [{"x": t, "s": "", "c": "o" if match and i in (0, 1) else ""} for i, t in enumerate(C4)]
    return [cap("划分子网的步骤"), cd(*left), cap("划分子网的步骤——超网CIDR　/数字"), cd(*right)]
V["3-6-2"] = [
    steps([F(two_cols(False), ""), F(two_cols(True), "相同环节：确定需要的子网个数；确定一个子网内可能的最多主机数")]),
    static(F([cd({"x": "④ 确定地址块", "s": "", "c": "hi"}), tr(LANTREE)], "30.138.118/23 分给 5 个局域网")),
]

# ---- 3-7-x ----
V["3-7-1"] = [
    static(F(bits(cells(("110000111010100100010100", "n"), ("0001", "s"), ("1001", "h")), 32, 8, lg=[["n", "网络号 195.169.20（24 位）"], ["s", "子网号 0001（4 位）"], ["h", "主机号 1001（4 位）"]]), "195 . 169 . 20 . 0001｜1001")),
    tabs([
        F([bits(cells(("0001", "s hi"), ("1001", "h")), 8, 8), bits(cells(("0001", "s"), ("0000", "w")), 8, 8, x="子网号补零")], "子网号：0001 → 00010000 = 16", "子网号"),
        F([bits(cells(("0001", "s"), ("1001", "h hi")), 8, 8), bits(cells(("0000", "w"), ("1001", "h")), 8, 8, x="主机号补零")], "主机号：1001 → 00001001 = 9", "主机号"),
    ], "取哪一段"),
    static(F([bits([["1", "n"]] * 4 + [["0", "g"]] * 4, 8, 8, x="掩码 240"), bits(cells(("0001", "s"), ("1001", "h")), 8, 8, x="地址 25"), ],
             "掩码的 1111 对应子网号 0001；0000 对应主机号 1001", )),
]
V["3-7-2"] = [
    static(F([bits(cells(("1010110000010000", "n"), ("00000001", "s"), ("000", "s"), ("11110", "h")), 32, 8,
                   lg=[["n", "网络号 16 位"], ["s", "子网号 11 位（8 + 3）"], ["h", "主机号 5 位"]]),
              bits(cells(("000", "s"), ("11110", "h")), 8, 8, x="第 4 字节 30 = 000｜11110")])),
    tabs([
        F([bits(cells(("1010110000010000", "n"), ("0000000100000", "s"), ("00000", "h hi")), 32, 8), ], "子网地址：主机号清零 → 172.16.1.0", "求子网地址"),
        F([bits(cells(("0" * 27, "w"), ("11110", "h hi")), 32, 8)], "主机地址：网络号和子网号清零 → 0.0.0.30", "求主机地址"),
    ], "求"),
]
B177 = ipbin(177, 65, 37, 8)
def f373(label, bs, r):
    return F(bits([[ch, "n" if i < 16 else ("s" if i < 20 else "h")] for i, ch in enumerate(bs)], 32, 8, lg=[["n", "177.65（16 位）"], ["s", "子网号 0010（4 位）"], ["h", "主机号 0101 + 00001000（12 位）"]]), r, label)
net_bs = B177[:20] + "0" * 12
bc_bs = B177[:20] + "1" * 12
sp_bs = "0" * 20 + B177[20:]
V["3-7-3"] = [
    tabs([
        F(bits([[ch, "n" if i < 16 else ("s" if i < 20 else "h hi")] for i, ch in enumerate(net_bs)], 32, 8), "主机号清 0：177.65.0010 0000.0 = 177.65.32.0", "网络地址"),
        F(bits([[ch, "n" if i < 16 else ("s" if i < 20 else "h hi")] for i, ch in enumerate(bc_bs)], 32, 8), "主机号置 1：177.65.0010 1111.255 = 177.65.47.255", "直接广播"),
        F(bits([[ch, "g" if i < 20 else "h hi"] for i, ch in enumerate(sp_bs)], 32, 8), "网络号和子网号清 0：0.0.0000 0101.8 = 0.0.5.8", "特定主机"),
    ], "按钮"),
    static(F(cd(("网络地址", "177.65.32.0", "n"), ("直接广播地址", "177.65.47.255", "s"), ("特定主机地址", "0.0.5.8", "h")))),
    static(F(cd(*[{"x": format(k, "04b"), "s": "", "c": "g" if k in (0, 15) else "s"} for k in range(16)]), "16 种取值，全 0 和全 1 划掉，剩 14 个 = 2^4 − 2")),
]

# ---- 3-8-1 ----
def need_frames():
    return [F([bits(cells(("0" * 3, "s")) + cells((5, "w")), 8, 8, lg=[["s", "子网号 n"]]), ln(("子网数 4：2^n − 2 ≥ 4 ⇒ n = 3", "hi"))], "n = 3", "子网数 4"),
            F([bits(cells((3, "s"), ("0" * 5, "h")), 8, 8, lg=[["s", "子网号 n = 3"], ["h", "主机号 m"]]), ln(("子网数 4：2^n − 2 ≥ 4 ⇒ n = 3", ""), ("每子网主机数 25：2^m − 2 ≥ 25 ⇒ m = 5", "hi"))], "m = 5", "每子网 25 台"),
            F([bits(cells((3, "s"), (5, "h")), 8, 8, lg=[["s", "子网号 3 位"], ["h", "主机号 5 位"]]), ln(("n + m = 3 + 5 = 8：填满第 4 字节", "ok hi"))], "n + m = 8", "合计")]
def s381_frames():
    fr = []
    for k in range(1, 7):
        fr.append(F([bits(cells((format(k, "03b"), "s hi"), (5, "h")), 8, 8, lg=[["s", "子网号"], ["h", "主机号"]]), ln((f"208.50.18.{format(k, '03b')} 00000 = 208.50.18.{32 * k}", "hi"))], f".{32 * k}", format(k, "03b")))
    return fr
V["3-8-1"] = [
    steps(need_frames()),
    steps(s381_frames()),
    static(F(sc(0, 256, [{"a": 0, "b": 32, "c": "g", "x": "000"}] + [{"a": 32 * k, "b": 32 * k + 32, "c": SUBCOL[k - 1], "x": format(k, "03b")} for k in range(1, 7)] + [{"a": 224, "b": 256, "c": "g", "x": "111"}],
                tk=[[32 * i, str(32 * i)] for i in range(0, 9, 2)], lg=False))),
]

# ---- 3-8-2 ----
B187 = ipbin(187, 24, 83, 29)
V["3-8-2"] = [
    static(F([bits([[ch, "n" if i < 16 else ("s" if i < 20 else "h")] for i, ch in enumerate(B187)], 32, 8, lg=[["n", "187.24（16 位）"], ["s", "子网号 0101（4 位）"], ["h", "主机号 0011 + 00011101（12 位）"]]),
              bits(cells(("0101", "s hi"), ("0011", "h")), 8, 8, x="83 = 0101｜0011")])),
    steps([
        F([cap("方法 1：网络地址 = IP AND 掩码")] + and_frames("IP 187.24.83.29", B187, "掩码 255.255.240.0", ipbin(255, 255, 240, 0), "AND 结果", 32)[0][-1]["b"], "187.24.83.29 AND 255.255.240.0 = 187.24.80.0"),
        F([cap("方法 2：主机号清零"), bits([[ch, "n" if i < 16 else ("s" if i < 20 else "h hi")] for i, ch in enumerate(B187[:20] + "0" * 12)], 32, 8)], "187.24.0101 0000.00000000 = 187.24.80.0"),
    ]),
    tabs([
        F(sc(0, 256, [{"a": 80, "b": 96, "c": "s", "x": "80.0 ~ 95.255"}], tk=[[0, "0"], [80, "80"], [96, "95"], [256, "255"]], lg=False), "网络地址 187.24.80.0：第 3 字节 80 ~ 95 共 16 个值", "网络地址"),
        F([bits([[ch, "n" if i < 16 else ("s" if i < 20 else "h hi")] for i, ch in enumerate(B187[:20] + "1" * 12)], 32, 8),
           sc(0, 256, [{"a": 80, "b": 96, "c": "s hi", "x": "80.0 ~ 95.255"}], tk=[[0, "0"], [80, "80"], [96, "95"], [256, "255"]], lg=False)], "主机号全 1：187.24.0101 1111.11111111 = 187.24.95.255", "主机号全 1"),
    ], "按钮"),
]

# ---- 3-8-3 ----
def try_n_frames():
    fr = []
    rows = []
    for n in range(1, 5):
        v = 2 ** n - 2
        ok = v >= 12
        rows.append((f"n = {n}：2^{n} − 2 = {v}" + ("　≥ 12 ✔" if ok else ""), "ok hi" if ok else ""))
        fr.append(F(ln(*rows), f"n = {n}" + ("：第一个 ≥ 12 的 n" if ok else ""), f"{n}"))
    return fr
V["3-8-3"] = [steps(try_n_frames())]

# ---- 3-8-4 ----
def sub_pick(k):
    return F([bits(cells((format(k, "03b"), "s"), ("00000", "h")), 8, 8, lg=[["s", "子网号"], ["h", "主机号 5 位"]]),
              sc(0, 256, [{"a": 32 * k, "b": 32 * k + 32, "c": "p hi", "x": f"{32 * k}"}], tk=[[32 * k, str(32 * k)], [32 * k + 32, str(32 * k + 32)]], lg=False)],
             f"192.168.25.{format(k, '03b')} 00000 = 192.168.25.{32 * k}　这个子网共 32 个地址", f"{k}")
def sub_range(k):
    o = 32 * k
    sg = [{"a": 32 * i, "b": 32 * i + 32, "c": SUBCOL[i - 1] + ("" if i == k else " dim"), "x": str(32 * i)} for i in range(1, 7)]
    return F(sc(0, 256, sg, tk=[[32 * i, str(32 * i)] for i in range(0, 9, 2)], mk=[[o + 1.5, f".{o + 1}", "h"], [o + 30, f".{o + 30}", "h"]], lg=False),
             f"[网络地址 + 1, 网络地址 + 30] = [192.168.25.{o + 1}, 192.168.25.{o + 30}]", f"{k}")
V["3-8-4"] = [
    tabs([sub_pick(k) for k in range(1, 7)], "子网"),
    steps([
        F(bits(cells(("00001", "h hi")), 5, 5, x="最小主机号 00001"), "最小主机 IP：192.168.25.00100001 = 192.168.25.33（+1）"),
        F(bits(cells(("11110", "h hi")), 5, 5, x="最大主机号 11110"), "最大主机 IP：192.168.25.00111110 = 192.168.25.62（+30）"),
        F(ln(("11111 = 2^5 − 1 = 31", "mono"), ("11110 = 31 − 1 = 30", "mono")), "11111 = 31　11110 = 30"),
    ]),
    tabs([sub_range(k) for k in range(1, 7)], "子网"),
]
V["3-8-5"] = [static(F(S341))]

# ---- 3-9-1 ----
OPT391 = [("A", "255.255.255.255"), ("B", "255.255.255.0"), ("C", "255.255.255.224"), ("D", "255.255.255.192")]
def opts391(circle=False):
    return cd(*[{"x": f"{a}.{v}", "s": "", "c": "ok" if (circle and a == "C") else ""} for a, v in OPT391])
V["3-9-1"] = [
    steps([
        F([ln(("红：2^n − 2 ≥ 8 ⇒ n = 4", "r"))], ""),
        F([ln(("红：2^n − 2 ≥ 8 ⇒ n = 4", "r"), ("紫：2^n ≥ 8 ⇒ n = 3", "p"))], ""),
        F([ln(("红：2^n − 2 ≥ 8 ⇒ n = 4", "r"), ("紫：2^n ≥ 8 ⇒ n = 3", "p")), opts391(True)], "选项 C 的“224”圈出"),
    ]),
    steps([
        F(ln("主机 1：IP AND 掩码 = 网络地址"), ""),
        F(ln("主机 1：IP AND 掩码 = 网络地址", "主机 2：IP AND 掩码 = 网络地址"), ""),
        F(ln("主机 1：IP AND 掩码 = 网络地址", "主机 2：IP AND 掩码 = 网络地址", ("两个结果相同", "ok hi")), "网络地址相同，选 C"),
    ]),
]

# ---- 3-9-2 ----
f392 = and_frames("139", b8(139), "240", b8(240), "结果", 4, "w", rs=["", "139 AND 240 = 1000 0000 = 128"])
V["3-9-2"] = [
    steps(f392[0]),
    steps([
        F(tbl(["十进制", "二进制"], [["10", "1010"], [["11", "hi"], ["1011", "hi"]]], rh=False), "主机号 1011 = 11 → 0.0.0.11"),
        F([bits(cells(("1000", "s"), ("1111", "h")), 8, 8, lg=[["s", "子网号 1000"], ["h", "主机号全 1"]])], "全 1 → 1111 → 1000 1111 = 143"),
    ]),
    static(F(sc(128, 144, [{"a": 128, "b": 129, "c": "g", "x": ""}, {"a": 129, "b": 143, "c": "h", "x": ""}, {"a": 143, "b": 144, "c": "g", "x": ""}],
                tk=[[128, "128"], [144, "143"]], mk=[[128.5, "网络地址 128", "g"], [139.5, "主机 139", "n"], [143.5, "广播地址 143", "g"]], lg=False))),
]
