from wl_viz import *

# ---- 共用：0~255 数轴（A/B/C/D·E 段，127 单独留空） ----
def class_scale(pins=None, hi=None):
    sg = [seg(1, 126, "n", "A 1~126"), seg(128, 191, "h", "B 128~191"), seg(192, 223, "o", "C 192~223"), seg(224, 255, "g", "D/E")]
    if hi is not None:
        for s in sg:
            if s["a"] <= hi < s["b"]: s["c"] += " hi"
    mk = [[v, t, c] for v, t, c in (pins or [])]
    return sc(0, 256, sg, tk=[[0, "0"], [255, "255"]], mk=mk, lg=False)

# ---- 共用：三个私有区 ----
ZONES = [("10.x.x.x", "A 类 10 开头"), ("172.16~31.x.x", "B 类 172.16~172.31"), ("192.168.x.x", "C 类 192.168 开头")]
def zones(ok=None, bad=False):
    items = []
    for i, (x, s) in enumerate(ZONES):
        items.append({"x": x, "s": s, "c": "ok" if ok == i else ("dim" if bad else "")})
    return cd(*items)

def b172(second, lo=16, hi=31, label=None):
    pin = [(second + 0.5, str(second), "r" if not lo <= second <= hi else "h")]
    return sc(14, 34, [seg(14, lo - 1, "g"), seg(lo, hi, "h", f"{lo}~{hi}"), seg(hi + 1, 33, "g")],
              tk=[[lo, str(lo)], [hi + 1, str(hi)]], mk=pin, lg=False)

V = {}

V["1-1-1"] = [
    static(F(class_scale(pins=[(127.5, "127", "k")]))),
    steps([
        F(class_scale(pins=[(10.5, "10", "n")], hi=10), "A 选项 10.2.3.4：第 1 个数 10 → A 类"),
        F(class_scale(pins=[(202.5, "202", "o")], hi=202), "B 选项 202.38.214.2：第 1 个数 202 → C 类"),
        F(class_scale(pins=[(192.5, "192", "o")], hi=192), "C 选项 192.168.214.2：第 1 个数 192 → C 类"),
        F(class_scale(pins=[(224.5, "224", "g")], hi=224), "D 选项 224.38.214.2：第 1 个数 224 → D 类"),
    ]),
    tabs([
        F([bits(cells((8, "n"), (24, "h")), lg=[["n", "网络号 1 字节"], ["h", "主机号 3 字节"]])], "A 类　1~126　1:3", "A 类"),
        F([bits(cells((16, "n"), (16, "h")), lg=[["n", "网络号 2 字节"], ["h", "主机号 2 字节"]])], "B 类　128~191　2:2", "B 类"),
        F([bits(cells((24, "n"), (8, "h")), lg=[["n", "网络号 3 字节"], ["h", "主机号 1 字节"]])], "C 类　192~223　3:1", "C 类"),
    ], "地址类"),
]

def host_count_frames():
    fr = []
    for k in range(1, 17):
        c = cells((16, "n")) + [["", "h" + (" hi" if j < k else "")] for j in range(16)]
        fr.append(F(bits(c, lg=[["n", "网络号 16 位"], ["h", "主机号 16 位"]]), f"{k} / 16", f"{k}"))
    return fr

V["1-1-2"] = [
    slider(host_count_frames(), "数到第几位"),
    tabs([
        F(bits(cells((8, "n"), (24, "h")), lg=[["n", "网络号 8 位"], ["h", "主机号 24 位"]]), "A 类：主机号 24 位", "A 类"),
        F(bits(cells((16, "n"), (16, "h")), lg=[["n", "网络号 16 位"], ["h", "主机号 16 位"]]), "B 类：主机号 16 位", "B 类"),
        F(bits(cells((24, "n"), (8, "h")), lg=[["n", "网络号 24 位"], ["h", "主机号 8 位"]]), "C 类：主机号 8 位", "C 类"),
    ], "地址类", 1),
]

V["1-2-1"] = [
    static(F(zones())),
    steps([
        F([zones(0)], "A 10.33.42.255 ✔　10 在 10.x.x.x"),
        F([zones(bad=True), b172(15)], "B 172.15.44.255 ✘　15 不在 16~31"),
        F([zones(bad=True), b172(32)], "C 172.32.100.255 ✘　32 不在 16~31"),
        F([zones(2)], "D 192.168.7.255 ✔　E 192.168.7.255 ✔"),
    ]),
    steps([
        F(bits(cells((ipbin(10, 33, 42, 255), "w"))), "32 位二进制：00001010 00100001 00101010 11111111"),
        F([bits(cells((ipbin(10, 33, 42, 255), "w"))), ln("00001010 → 10", "00100001 → 33", "00101010 → 42", "11111111 → 255")], "每 8 位一组换成十进制"),
        F([ln(("10 . 33 . 42 . 255", "hi mono"))], "用点连起来：10.33.42.255"),
    ]),
]

def check_frame_data():
    return None

V["1-3-1"] = [
    checker(["333.24.45.56"]),
    checker(["100.78.65.3", "128.0.1.1", "192.234.111.123", "333.24.45.56"]),
]

def pnode(*p): return list(p)
DP_NODES = [["S", 40, 85, "S", "n"], ["A", 130, 30, "R1"], ["B", 130, 140, "R2"], ["C", 220, 85, "R3"], ["D", 290, 85, "D", "h"]]
DP_EDGES = [["S", "A"], ["S", "B"], ["A", "C"], ["B", "C"], ["C", "D"], ["A", "D"]]
def net1(paths, hl_cap):
    return tp(DP_NODES, DP_EDGES, paths)
V["1-4-1"] = [
    steps([
        F([cap("数据报　IP / Internet"), tp(DP_NODES, DP_EDGES, []), cap("虚电路"), tp(DP_NODES, DP_EDGES, [])],
          "数据报：各分组各走不同路径，到达顺序可能打乱　虚电路：先建一条连接，分组沿同一路径按序走"),
        F([cap("数据报　IP / Internet"), tp(DP_NODES, DP_EDGES, [0, 2, 4]), cap("虚电路"), tp(DP_NODES, DP_EDGES, [1, 3, 4])], "分组 1：数据报走 S–R1–R3–D　虚电路先建立 S–R2–R3–D 这条连接"),
        F([cap("数据报　IP / Internet"), tp(DP_NODES, DP_EDGES, [1, 3, 4]), cap("虚电路"), tp(DP_NODES, DP_EDGES, [1, 3, 4])], "分组 2：数据报改走 S–R2–R3–D　虚电路沿同一路径"),
        F([cap("数据报　IP / Internet"), tp(DP_NODES, DP_EDGES, [0, 5]), cap("虚电路"), tp(DP_NODES, DP_EDGES, [1, 3, 4])], "分组 3：数据报走 S–R1–D　虚电路沿同一路径按序到达"),
    ])
]

V["1-5-1"] = [
    steps([
        F([zones(bad=True)], "A 100.0.0.0　不在三段内 ✘"),
        F([zones(bad=True), b172(15)], "B 172.15.0.0　15 不在 16~31 ✘"),
        F([zones(2)], "C 192.168.0.0　属于 192.168.x.x ✔"),
        F([zones(bad=True)], "D 244.0.0.0　不在三段内 ✘"),
    ]),
    static(F(class_scale(pins=[(127.5, "127.0.0.1 回送", "k")]))),
    static(F(cd(("P97~98 第17~23题", "作业", "o"), ("分片原型题", "笔+作", "o")))),
]

def v6_cells(k):
    return [["", "h" if i >= 32 - 0 else "n"] for i in range(128)]
def ones_host(n_ones, total=16):
    return "".join("1" if i >= total - n_ones else "0" for i in range(total))

def host_slider():
    fr = []
    for k, (lab, r) in enumerate([("0 个 1", "主机号全 0 → 网络地址"), ("4 个 1", "普通主机"), ("8 个 1", "普通主机"), ("12 个 1", "普通主机"), ("16 个 1", "主机号全 1 → 直接广播地址")]):
        ones = [0, 4, 8, 12, 16][k]
        hb = ones_host(ones)
        c = [["", "n"] for _ in range(16)] + [[ch, "h"] for ch in hb]
        fr.append(F(bits(c, lg=[["n", "网络号"], ["h", "主机号"]]), r, lab))
    return fr

V["1-6-1"] = [
    static(F([bits([["", "n"] for _ in range(32)], x="IPv4 32 比特"), bits([["", "p"] for _ in range(128)], cols=32, nc=16, by=32, x="IPv6 128 比特")])),
    slider(host_slider(), "主机号"),
    steps([
        F(cd(("128", "", ""), ("11", "", ""), ("3", "", ""), ("31", "", ""))),
        F([cd(("128", "128~191 → B 类", "hi"), ("11", "", ""), ("3", "", ""), ("31", "", ""))], "128 在 128~191 → B 类（2:2）"),
        F([cd(("128", "", "n"), ("11", "", "n"), ("3", "", "h"), ("31", "", "h")), ln(("netid = 128.11", "n"), ("hostid = 3.31", "h"))], "128.11 | 3.31"),
    ]),
]
