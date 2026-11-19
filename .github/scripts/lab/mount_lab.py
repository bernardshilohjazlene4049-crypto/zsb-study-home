#!/usr/bin/env python3
"""把课堂可视化挂到各课页（幂等：重复运行结果相同）。

挂载点用 <!--lab:键-->…<!--/lab:键--> 标记；脚本先清掉旧标记再重新插入。
计算机网络页在条目的「可视化讲解」区末尾追加；网页设计页没有该区时新建一个。
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def fig(name, **attrs):
    extra = "".join(f' data-{k}="{v}"' for k, v in attrs.items())
    return f'<figure class="lab" data-lab="{name}"{extra}></figure>'


# (文件, 条目 id 或 ('after', 锚点 id) 或 ('before', 文本), [图])
ENTRY = {
    "wl/ch1/s11.html": [("e-1-1-1", [fig("classify"), fig("quiz", q="0,1,3")])],
    "wl/ch1/s12.html": [("e-1-2-1", [fig("quiz", q="2,4")])],
    "wl/ch1/s16.html": [("e-1-6-1", [fig("quiz", q="5,6,7,8,9,10,11,12")])],
    "wl/ch2/s22.html": [("e-2-2-1", [fig("match")])],
    "wl/ch2/s23.html": [("e-2-3-1", [fig("cidr", ex="0")])],
    "wl/ch2/s25.html": [("e-2-5-1", [fig("cidr", ex="1")])],
    "wl/ch2/s26.html": [("e-2-6-1", [fig("and", ex="0")])],
    "wl/ch2/s27.html": [("e-2-7-1", [fig("cidr", ex="2")])],
    "wl/ch3/s31.html": [("e-3-1-1", [fig("subnet", ex="0")])],
    "wl/ch3/s32.html": [("e-3-2-2", [fig("subnet", ex="5")])],
    "wl/ch3/s34.html": [("e-3-4-1", [fig("subnet", ex="1")]), ("e-3-4-2", [fig("subnet", ex="2")]), ("e-3-4-3", [fig("subnet", ex="4")])],
    "wl/ch3/s35.html": [("e-3-5-3", [fig("and", ex="1")])],
    "wl/ch3/s38.html": [("e-3-8-2", [fig("subnet", ex="3")])],
    "wl/ch4/s42.html": [("e-4-2-1", [fig("fragment", ex="1")])],
    "wl/ch4/s43.html": [("e-4-3-2", [fig("fragment", ex="0")])],
    "wl/ch5/s53.html": [("e-5-3-1", [fig("ipv6")])],
    "wl/ch6/s61.html": [("e-6-1-1", [fig("aggregate", ex="0")]), ("e-6-1-2", [fig("aggregate", ex="1")])],
    "wy/ch1/s13.html": [("s13-entry-1", [fig("layers")])],
    "wy/ch2/s21.html": [("s21-entry-3", [fig("htmldemo", demo="single")])],
    "wy/ch2/s22.html": [("s22-entry-2", [fig("structure")])],
}
AFTER = {
    "notes/web.html": [
        ("eg-css-1", [fig("link")]), ("eg-css-2", [fig("howto")]), ("eg-text-2", [fig("text")]),
        ("eg-selectors-1", [fig("selectors")]), ("eg-forms-1", [fig("forms")]), ("eg-widgets-1", [fig("widgets")]),
    ],
}
BEFORE = {
    "wy/css/box.html": [("<h2>考试提醒</h2>", [fig("box")])],
    "wy/html/quiz.html": [('<div class="wy-pager">', [fig("htmldemo", demo=d, href="../ch2/s22.html") for d in ("title", "target", "entity", "extcss")])],
}
def slot_pages():
    """每个知识点页（计算机网络 wl/ch*/s*.html、网页设计 wy/ch1–2/s*.html）都留一个空的插图位。"""
    pages = sorted(p.relative_to(ROOT).as_posix() for p in ROOT.glob("wl/ch*/s*.html"))
    pages += sorted(p.relative_to(ROOT).as_posix() for p in ROOT.glob("wy/ch[12]/s*.html"))
    return pages


NET = {"classify", "quiz", "match", "cidr", "and", "subnet", "fragment", "ipv6", "aggregate"}


def block(figs, new_wrapper):
    inner = "".join(figs)
    if new_wrapper:
        return f'<div class="wy-viz wy-paper" data-pagefind-ignore><h3>可视化讲解</h3>{inner}</div>'
    return inner


def clean(text):
    text = re.sub(r"<!--lab:[^>]*?-->.*?<!--/lab:[^>]*?-->", "", text, flags=re.S)
    # 清掉我们新建的整块（含自带标题）
    text = re.sub(r'<div class="wy-viz wy-paper" data-pagefind-ignore data-lab-block="1">.*?</div><!--/lab-block-->', "", text, flags=re.S)
    return text


def mk(key, html):
    return f"<!--lab:{key}-->{html}<!--/lab:{key}-->"


def head(text, rel, need_calc):
    text = re.sub(r'<link rel="stylesheet" href="[^"]*lab-viz\.css">\n?', "", text)
    text = re.sub(r'<script src="[^"]*(?:calc-net|lab-viz)\.js" defer></script>\n?', "", text)
    tags = f'<link rel="stylesheet" href="{rel}assets/css/lab-viz.css">'
    if need_calc:
        tags += f'\n<script src="{rel}assets/js/calc-net.js" defer></script>'
    tags += f'\n<script src="{rel}assets/js/lab-viz.js" defer></script>'
    return text.replace("</head>", tags + "\n</head>", 1)


def process(rel_path):
    path = ROOT / rel_path
    text = clean(path.read_text(encoding="utf-8"))
    depth = rel_path.count("/")
    rel = "../" * depth
    used = set()
    for entry, figs in ENTRY.get(rel_path, []):
        m = re.search(rf'<section class="wy-entry" id="{re.escape(entry)}">', text)
        if not m:
            sys.exit(f"{rel_path}: 找不到条目 {entry}")
        end = text.index("</section>", m.end())
        seg = text[m.end():end]
        key = f"{entry}"
        used.update(re.findall(r'data-lab="(\w+)"', "".join(figs)))
        if '<div class="wy-viz' in seg:
            pos = seg.index('<div class="wy-selfcheck">') if '<div class="wy-selfcheck">' in seg else len(seg)
            # 在 wy-viz 结束的 </div> 之前插入
            viz_end = seg.rindex("</div>", 0, pos)
            seg2 = seg[:viz_end] + mk(key, block(figs, False)) + seg[viz_end:]
        else:
            html = mk(key, '<div class="wy-viz wy-paper" data-pagefind-ignore data-lab-block="1"><h3>可视化讲解</h3>' + "".join(figs) + "</div><!--/lab-block-->")
            pos = seg.index('<div class="wy-selfcheck">') if '<div class="wy-selfcheck">' in seg else len(seg)
            seg2 = seg[:pos] + html + seg[pos:]
        text = text[:m.end()] + seg2 + text[end:]
    for anchor, figs in AFTER.get(rel_path, []):
        m = re.search(rf'<details class="question" id="{re.escape(anchor)}">.*?</details>', text, flags=re.S)
        if not m:
            sys.exit(f"{rel_path}: 找不到 {anchor}")
        used.update(re.findall(r'data-lab="(\w+)"', "".join(figs)))
        html = mk(anchor, '<div class="wy-viz" data-pagefind-ignore><h3>可视化讲解</h3>' + "".join(figs) + "</div>")
        text = text[:m.end()] + html + text[m.end():]
    for needle, figs in BEFORE.get(rel_path, []):
        i = text.index(needle)
        used.update(re.findall(r'data-lab="(\w+)"', "".join(figs)))
        html = mk("before", '<div class="wy-viz" data-pagefind-ignore><h3>可视化讲解</h3>' + "".join(figs) + "</div>")
        text = text[:i] + html + text[i:]
    if rel_path in slot_pages():
        key = rel_path.removesuffix(".html").replace("/", ".")
        m = re.search(r'<header class="wy-point-head">.*?</header>', text, flags=re.S)
        if not m:
            sys.exit(f"{rel_path}: 找不到知识点标题")
        text = text[:m.end()] + mk("illus", f'<div class="wy-illus" data-illus="{key}" hidden></div>') + text[m.end():]
    if used or "data-lab=" in text:
        text = head(text, rel, bool(used & NET))
    else:
        text = re.sub(r'<link rel="stylesheet" href="[^"]*lab-viz\.css">\n?', "", text)
        text = re.sub(r'<script src="[^"]*(?:calc-net|lab-viz)\.js" defer></script>\n?', "", text)
    path.write_text(text, encoding="utf-8")
    return len(used)


def main():
    files = sorted(set(ENTRY) | set(AFTER) | set(BEFORE) | set(slot_pages()))
    for f in files:
        process(f)
    print(f"已处理 {len(files)} 个页面")


if __name__ == "__main__":
    main()
