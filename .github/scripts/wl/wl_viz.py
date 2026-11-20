"""可视化讲解配置的辅助函数与总表。每个条目的配置按 data.json 的「可视化」数组顺序一一对应。
配置里的数字、标签只来自该条目的原文、整理或可视化方案。"""
import html, json

# ---------- 输出 ----------
def figure_html(cfg, eid, i):
    raw = json.dumps(cfg, ensure_ascii=False, separators=(",", ":"))
    return f'<figure class="nv" role="group" aria-label="可视化讲解 {i + 1}" data-viz="{html.escape(raw, quote=True)}"></figure>'

# ---------- 帧与模式 ----------
def F(blocks, r="", l=""):
    return {"l": l, "r": r, "b": blocks if isinstance(blocks, list) else [blocks]}

def steps(frames): return {"m": "steps", "f": frames}
def tabs(frames, sl="切换", i0=0): return {"m": "tabs", "f": frames, "sl": sl, "i0": i0}
def slider(frames, sl): return {"m": "slider", "f": frames, "sl": sl}
def static(frame): return {"m": "static", "f": [frame]}
def checker(pre): return {"m": "checker", "pre": pre, "sl": "地址"}
def judge(pre): return {"m": "judge", "pre": pre, "sl": "地址/前缀长度"}

# ---------- 块 ----------
def cells(*segs):
    """(n, cls) 画 n 个空格；(bitstring, cls) 逐位；cls 可带 hi/x。返回 [[字符, cls], ...]"""
    out = []
    for s, c in segs:
        out += [["", c] for _ in range(s)] if isinstance(s, int) else [[ch, c] for ch in s]
    return out

def bits(c, cols=32, nc=8, lg=None, x=None, by=8):
    b = {"t": "bits", "c": c, "cols": cols, "nc": nc, "by": by}
    if lg: b["lg"] = lg
    if x: b["x"] = x
    return b

def tbl(h, r, rh=True):
    return {"t": "tbl", "h": h, "r": r, "rh": rh}

def ln(*items):
    return {"t": "ln", "i": [list(i) if isinstance(i, (tuple, list)) else [i, ""] for i in items]}

def cap(x): return {"t": "cap", "x": x}

def cd(*items):
    out = []
    for it in items:
        if isinstance(it, dict): out.append(it)
        else:
            x, s, c = (list(it) + ["", ""])[:3]
            out.append({"x": x, "s": s, "c": c})
    return {"t": "cd", "i": out}

def seg(a, b_incl, c, x=""):
    """整数区间 [a, b_incl] 的一段（含两端）"""
    return {"a": a, "b": b_incl + 1, "c": c, "x": x}

def sc(min_, max_, sg, tk=None, mk=None, lg=None):
    b = {"t": "sc", "min": min_, "max": max_, "sg": sg}
    if tk: b["tk"] = tk
    if mk: b["mk"] = mk
    if lg is False: b["lg"] = 0
    return b

def tr(n, d=None):
    b = {"t": "tr", "n": n}
    if d is not None: b["d"] = d
    return b

def sp(n, d=None):
    b = {"t": "sp", "n": n}
    if d is not None: b["d"] = d
    return b

def tp(nodes, edges, hl=None):
    return {"t": "tp", "n": nodes, "e": edges, "hl": hl or []}

# ---------- 数值工具 ----------
def b8(n): return format(n, "08b")
def ipbin(*o): return "".join(b8(x) for x in o)
def dotted(bs): return ".".join(str(int(bs[i:i + 8], 2)) for i in range(0, 32, 8))
def bitcells(bs, n, cn="n", ch="h"):
    """32 位串 bs，前 n 位用 cn，其余用 ch"""
    return [[c, cn if i < n else ch] for i, c in enumerate(bs)]

def and_frames(top_label, top_bits, mask_label, mask_bits, res_label, per=8, cls_top="", total=None, final_r="", rs=None):
    """逐位（每 per 位一帧）落下的 AND 动画：上行、掩码行、结果行。位串长度任意。"""
    n = len(top_bits)
    res = "".join("1" if a == "1" and b == "1" else "0" for a, b in zip(top_bits, mask_bits))
    frames = []
    for k in range(per, n + per, per):
        k = min(k, n)
        t = [[c, cls_top + (" hi" if i >= k - per else "")] for i, c in enumerate(top_bits[:k])]
        m = [[c, "k" + (" hi" if i >= k - per else "")] for i, c in enumerate(mask_bits[:k])]
        r = [[c, ("n" if c == "1" else "g") + (" hi" if i >= k - per else "")] for i, c in enumerate(res[:k])]
        cols = n
        frames.append(F([bits(t, cols, 8, x=top_label), bits(m, cols, 8, x=mask_label), bits(r, cols, 8, x=res_label)],
                        (rs[len(frames)] if rs else (final_r if k == n else ""))))
        if k == n: break
    return frames, res

def pow_label(n): return f"2^{n}"

# ---- 总表 ----
def _all():
    import viz_ch1, viz_ch2, viz_ch3, viz_ch456
    out = {}
    for m in (viz_ch1, viz_ch2, viz_ch3, viz_ch456):
        out.update(m.V)
    return out

VIZ = _all()
