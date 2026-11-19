#!/usr/bin/env python3
"""把高数第一章讲义照片 p01–p07 的逐字原文、Gemini 整理和可视化并进 gs/gs1.html 的各考点。

用法：/workspace/gs1-venv/bin/python .github/scripts/gs/build_gs1.py（需要 latex2mathml、markdown，仅构建时使用）
可重复运行：先清掉上次插入的块，再按讲义转写重新生成。
"""
import hashlib, html, json, re, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import gs1_gemini as G
from gs1_source import POINTS

ROOT = HERE.parents[2]
PAGE = ROOT / "gs/gs1.html"
PHOTOS = json.loads((ROOT / "tests/fixtures/gs1-photos.json").read_text(encoding="utf-8"))
MARK_B, MARK_E = "<!--gs-pt:%d-->", "<!--/gs-pt:%d-->"

def esc(t):
    return html.escape(t, quote=False)

def inline(text):
    """文字里的 $...$ 转 MathML，其余转义。"""
    out, parts = [], re.split(r"\$(.+?)\$", text)
    for i, p in enumerate(parts):
        out.append(G.mathml(p) if i % 2 else esc(p))
    return "".join(out)

HAND_PREFIX = re.compile(r"^手写(（[^）]*）)?：")

def hand(text):
    return '<span class="wy-hand gs-hand">%s</span>' % inline(HAND_PREFIX.sub(lambda m: m.group(1) or "", text))

def row_html(kind, main, note, first):
    if kind == "title":
        if first:
            return '<div class="wy-source-row wy-source-title"><h4>%s</h4></div>' % inline(main)
        return '<h4 class="gs-source-sub">%s</h4>' % inline(main)
    if kind == "tree":
        return tree_html(main)
    if main and note:
        return '<div class="wy-source-row"><p>%s</p>%s</div>' % (inline(main), hand(note))
    if main:
        return '<div class="wy-source-row"><p>%s</p></div>' % inline(main)
    return '<div class="wy-source-row">%s</div>' % hand(note)

def tree_html(text):
    items = []
    for line in text.split("\n"):
        depth = len(line) - len(line.lstrip("-"))
        body = line.lstrip("-")
        main, _, note = body.partition("｜")
        items.append((depth, '<div class="gs-tree-row"><span>%s</span>%s</div>' % (inline(main), hand(note) if note else "")))
    def build(i, depth):
        out, n = ["<ul>"], len(items)
        while i < n and items[i][0] >= depth:
            if items[i][0] == depth:
                out.append("<li>" + items[i][1])
                i += 1
                if i < n and items[i][0] > depth:
                    sub, i = build(i, depth + 1)
                    out.append(sub)
                out.append("</li>")
            else:
                break
        out.append("</ul>")
        return "".join(out), i
    html_, _ = build(0, 0)
    return '<div class="wy-source-row"><div class="gs-tree" style="flex:1;min-width:0">%s</div></div>' % html_.replace("<ul>", '<ul class="gs-tree-ul">', 1)

# ---------- Gemini 整理 ----------
LINES, HEADS = G.split_sections()

def gem(prefix):
    return G.block(LINES, HEADS, prefix, "2. 直观")

def fix_gem(md):
    md = re.sub(r"\\\((.+?)\\\)", lambda m: "$" + m.group(1).replace("\\\\", "\\") + "$", md)
    md = md.replace(r"\lim\limits_{}", r"\lim ")
    return md

def gem_html(md):
    return G.md_to_html(fix_gem(md))

def split_parity(md):
    parts = re.split(r"(?m)^(?=\* \*\*(?:单调性|奇偶性|周期性|有界性)\*\*)", md)
    d = {}
    for p in parts:
        m = re.match(r"\* \*\*(单调性|奇偶性|周期性|有界性)\*\*", p)
        if m:
            d[m.group(1)] = p
    assert set(d) == {"单调性", "奇偶性", "周期性", "有界性"}, d.keys()
    return d

def practice_solution():
    i = next(n for n, l in enumerate(LINES) if l.startswith("**讲义原题**"))
    j = next(n for n in range(i, len(LINES)) if LINES[n].startswith("**自编例题**"))
    seg = LINES[i:j]
    k = next(n for n, l in enumerate(seg) if l.startswith("**完整解答**"))
    body = "\n".join(seg[k + 1:]).strip()
    return body

SUP = {}
g = {n: gem(f"考点{n}：") for n in ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"]}
par = split_parity(g["二"])
SUP["gs1-1-1"] = g["一"]
SUP["gs1-2-1"] = par["单调性"]
SUP["gs1-2-2"] = par["奇偶性"]
SUP["gs1-2-3"] = par["周期性"]
SUP["gs1-2-4"] = par["有界性"]
SUP["gs1-3-2"] = g["三"]
SUP["gs1-4-2"] = g["四"]
SUP["gs1-5-4"] = g["五"]
SUP["gs1-6-1"] = g["六"]
SUP["gs1-6-3"] = g["七"]       # Gemini 把「八个等价替换」单列成考点七，讲义里它属于考点六
SUP["gs1-7-2"] = g["八"]       # Gemini 考点八 = 讲义考点七 两个重要极限
SUP["gs1-8-2"] = g["九"]       # 渐近线
SUP["gs1-9-2"] = g["十"]       # 连续
SUP["gs1-10-2"] = g["十一"]    # 间断点
SUP["gs1-11-3"] = g["十二"]    # 闭区间上连续函数
SUP["gs1-1-2"] = practice_solution()
SUP_TITLE = {"gs1-1-2": "解答"}

VIZ = {  # entry id -> (viz 序号, 标题)
 "gs1-2-2": (1, "奇偶函数图像对称"),
 "gs1-4-2": (2, "函数极限与图像走向"),
 "gs1-6-3": (3, "等价无穷小大小排序"),
 "gs1-7-2": (4, "两个重要极限"),
 "gs1-10-2": (5, "间断点的四种类型"),
 "gs1-11-3": (6, "介值定理和零点定理"),
}

def axis_svg():
    """讲义原题 f(x)=ln|x|/√(1−x²)：三条数轴取交集。"""
    X = lambda v: 40 + (v + 1.5) * 160           # -1.5..1.5 -> 40..520
    def line(y, label, spans, dots):
        s = '<line class="ax-line" x1="30" y1="%d" x2="530" y2="%d"/>' % (y, y)
        for a, b in spans:
            s += '<line class="ax-fill" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (X(a), y, X(b), y)
        for v in (-1, 0, 1):
            s += '<text x="%d" y="%d" text-anchor="middle">%s</text>' % (X(v), y + 20, str(v).replace("-", "−"))
        for v in dots:
            s += '<circle class="ax-dot" cx="%d" cy="%d" r="5"/>' % (X(v), y)
        s += '<text x="30" y="%d">%s</text>' % (y - 12, esc(label))
        return s
    body = (line(34, "ln|x| 的真数：|x|>0，即 x≠0", [(-1.5, 0), (0, 1.5)], [0]) +
            line(96, "分母根号下：1−x²>0，即 −1<x<1", [(-1, 1)], [-1, 1]) +
            line(158, "交集：(−1,0)∪(0,1)", [(-1, 0), (0, 1)], [-1, 0, 1]))
    return ('<figure class="gs-axis"><svg viewBox="0 0 560 190" role="img" aria-label="三条数轴：|x|>0 去掉 0；−1<x<1；取交集得 (−1,0)∪(0,1)">%s</svg></figure>' % body)

def entry_html(pt, e, n_entries):
    rows = []
    first = True
    for kind, main, note in e["rows"]:
        rows.append(row_html(kind, main, note, first and kind == "title"))
        first = False
    photos = ",".join(str(x) for x in e["photos"])
    parts = ['<section class="wy-entry" id="%s"><div class="wy-entry-top"><h3>%s</h3>' % (e["id"], esc(e["title"])),
             '<button class="sh-btn" type="button" data-open-photo data-photos="%s">打开原图</button></div>' % photos,
             '<div class="wy-source wy-paper" data-gs-source>%s</div>' % "".join(rows)]
    if e["id"] in SUP:
        parts.append('<div class="wy-supplement wy-paper"><h4>%s</h4>%s</div>' % (SUP_TITLE.get(e["id"], "整理"), gem_html(SUP[e["id"]])))
    if e["id"] == "gs1-1-2":
        parts.append('<div class="gs-viz-wrap"><h4>可视化：定义域取交集</h4>%s</div>' % axis_svg())
    if e["id"] in VIZ:
        k, title = VIZ[e["id"]]
        parts.append('<div class="gs-viz-wrap"><h4>可视化：%s</h4><div class="gs-viz" data-gs-viz="%d"><div class="gs-demo"></div></div></div>' % (esc(title), k))
    parts.append("</section>")
    return "".join(parts)

def point_block(n):
    ents = POINTS[n]["entries"]
    return MARK_B % n + '<div class="gs-pt" data-gs-pt="%d">%s</div>' % (n, "".join(entry_html(n, e, len(ents)) for e in ents)) + MARK_E % n

def dialog_html():
    tabs = "".join('<button type="button" class="sh-btn" data-photo-number="%d" data-photo="gs1/photos/p0%d.jpg" data-width="%d" data-height="%d">第一章 · 原图 %d</button>'
                   % (i, i, PHOTOS["p0%d" % i]["width"], PHOTOS["p0%d" % i]["height"], i) for i in range(1, 8))
    return ('<!--gs-photo--><dialog class="wy-photo" aria-labelledby="wy-photo-title"><header><strong id="wy-photo-title">第一章 · 原图</strong><div>'
            '<button type="button" class="sh-btn" data-photo-zoom aria-pressed="false">放大</button><button type="button" class="sh-btn" data-photo-close>关闭</button></div></header>'
            '<div class="wy-photo-tabs" aria-label="原图">%s</div><div class="wy-photo-scroll" tabindex="0"><img alt="第一章 · 原图" width="1536" height="2048"></div></dialog><!--/gs-photo-->' % tabs)

def visible(fragment):
    t = re.sub(r"<[^>]+>", "", fragment)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()

def write_fixture():
    orig = subprocess.check_output(["git", "show", "origin/main:gs/gs1.html"], cwd=ROOT)
    entries = []
    for n in range(1, 12):
        for e in POINTS[n]["entries"]:
            rows = "".join(row_html(k, a, b, i == 0 and k == "title") for i, (k, a, b) in enumerate(e["rows"]))
            entries.append({"id": e["id"], "point": n, "title": e["title"], "photos": e["photos"], "text": visible(rows)})
    data = {"note": "由 .github/scripts/gs/build_gs1.py 生成：gs1.html 里各条目「讲义原文」的可见文字，以及合并前 gs/gs1.html（origin/main）的 SHA-256。",
            "original_sha256": hashlib.sha256(orig).hexdigest(), "original_bytes": len(orig), "entries": entries}
    (ROOT / "tests/fixtures/gs1-source.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

def main():
    s = PAGE.read_text(encoding="utf-8")
    # 清掉旧块
    s = re.sub(r"<!--gs-pt:(\d+)-->.*?<!--/gs-pt:\1-->", "", s, flags=re.S)
    s = re.sub(r"<!--gs-photo-->.*?<!--/gs-photo-->\n?", "", s, flags=re.S)
    s = s.replace('\n<link rel="stylesheet" href="../assets/css/wy-points.css"><link rel="stylesheet" href="../assets/css/gs-points.css">', "")
    s = s.replace('\n<script src="../assets/js/wy-points.js" defer></script><script src="../assets/js/gs-viz.js" defer></script>', "")
    s = re.sub(r"<!--gs-photo-->.*?<!--/gs-photo-->\n?", "", s, flags=re.S)
    # 资源
    anchor = '<link rel="stylesheet" href="../assets/css/fn-graph.css">'
    assert anchor in s
    s = s.replace(anchor, anchor + '\n<link rel="stylesheet" href="../assets/css/wy-points.css"><link rel="stylesheet" href="../assets/css/gs-points.css">', 1)
    anchor = '<script src="../assets/js/fn-graph.js" defer></script>'
    assert anchor in s
    s = s.replace(anchor, anchor + '\n<script src="../assets/js/wy-points.js" defer></script><script src="../assets/js/gs-viz.js" defer></script>', 1)
    # 各考点：插在考点视频之后、core-stack 之前
    for n in range(1, 12):
        start = s.index('<section class="topic-section" id="point-%d"' % n)
        core = s.index('<div class="core-stack">', start)
        s = s[:core] + point_block(n) + s[core:]
    s = s.replace("</body>", dialog_html() + "\n</body>", 1)
    PAGE.write_text(s, encoding="utf-8")
    write_fixture()
    print("ok", len(s))

if __name__ == "__main__":
    main()
