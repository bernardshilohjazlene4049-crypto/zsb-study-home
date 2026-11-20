#!/usr/bin/env python3
"""把课堂讲解图挂到对应页面或条目（幂等：重复运行结果相同）。

页面级图填入 mount_lab.py 留下的 <!--lab:illus--> 槽位并去掉 hidden；
条目级、笔记题级图用 <!--lab:illus-键--> 包裹，插在整理/可视化之后。
可单独运行，也可由 mount_lab.py 在末尾调用。
"""
import os
import re
import sys
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[3]

# (页面, 方式, 锚点, 图相对仓库根路径, alt)
# 方式：page=填该页已有 wy-illus 槽；entry=插入 wy-entry 内；after-lab=插在对应 lab 块之后
PLACEMENTS = [
    ("wl/ch2/s26.html", "page", None, "wl/illus/net-01-and.webp", "AND运算求网络地址讲解图"),
    ("wl/ch3/s35.html", "entry", "e-3-5-3", "wl/illus/net-01-and.webp", "AND运算求网络地址讲解图"),
    ("wl/ch2/s22.html", "page", None, "wl/illus/net-02-cidr.webp", "CIDR地址块讲解图"),
    ("wl/ch2/s23.html", "page", None, "wl/illus/net-02-cidr.webp", "CIDR地址块讲解图"),
    ("wl/ch2/s25.html", "page", None, "wl/illus/net-02-cidr.webp", "CIDR地址块讲解图"),
    ("wl/ch6/s61.html", "page", None, "wl/illus/net-03-aggregate.webp", "路由聚合讲解图"),
    ("wl/ch3/s31.html", "page", None, "wl/illus/net-04-subnet.webp", "子网划分讲解图"),
    ("wl/ch4/s43.html", "page", None, "wl/illus/net-05-fragment.webp", "IPv4数据报分片讲解图"),
    ("wl/ch1/s11.html", "page", None, "wl/illus/net-06-classify.webp", "IPv4分类与私有地址讲解图"),
    ("wl/ch1/s12.html", "page", None, "wl/illus/net-06-classify.webp", "IPv4分类与私有地址讲解图"),
    ("wl/ch5/s53.html", "page", None, "wl/illus/net-07-ipv6.webp", "IPv6基本首部讲解图"),
    ("wl/ch3/s39.html", "entry", "e-3-9-1", "wl/illus/net-opt-s1-c8.webp", "C类分成8个子网原题讲解图"),
    ("wl/ch3/s38.html", "entry", "e-3-8-2", "wl/illus/net-opt-s2-187.webp", "187.24.0.0划分12个系原题讲解图"),
    ("wl/ch3/s34.html", "entry", "e-3-4-1", "wl/illus/net-opt-s3-130.webp", "B类130.53划分子网原题讲解图"),
    ("wl/ch3/s34.html", "entry", "e-3-4-2", "wl/illus/net-opt-s4-192.webp", "C类192.168.25.0划分6个子网原题讲解图"),
    ("wl/ch3/s34.html", "entry", "e-3-4-3", "wl/illus/net-opt-s5-198.webp", "198.117.32.0六部门规划原题讲解图"),
    ("wl/ch3/s32.html", "entry", "e-3-2-2", "wl/illus/net-opt-s6-30.webp", "30.138.118/23五个局域网原题讲解图"),
    ("wl/ch4/s43.html", "entry", "e-4-3-2", "wl/illus/net-opt-f1-4000.webp", "4000字节数据报分片原题讲解图"),
    ("wl/ch4/s42.html", "entry", "e-4-2-1", "wl/illus/net-opt-f2-3820.webp", "3820字节分片原题讲解图"),
    ("wy/ch1/s13.html", "page", None, "wy/illus/web-01-layers.webp", "网页三层结构讲解图"),
    ("wy/ch2/s22.html", "page", None, "wy/illus/web-02-structure.webp", "HTML5文档结构讲解图"),
    ("notes/web.html", "after-lab", "eg-css-2", "wy/illus/web-03-css-include.webp", "CSS三种引入方式讲解图"),
    ("wy/css/box.html", "after-lab", "before", "wy/illus/web-04-box.webp", "CSS盒子模型讲解图"),
    ("notes/web.html", "after-lab", "eg-css-1", "wy/illus/web-05-link.webp", "链接伪类四态讲解图"),
    ("notes/web.html", "after-lab", "eg-text-2", "wy/illus/web-06-text.webp", "文本样式讲解图"),
    ("notes/web.html", "after-lab", "eg-selectors-1", "wy/illus/web-07-pseudo.webp", ":root与:not伪类讲解图"),
    ("notes/web.html", "after-lab", "eg-forms-1", "wy/illus/web-08-form.webp", "表单与form属性讲解图"),
    ("notes/web.html", "after-lab", "eg-widgets-1", "wy/illus/web-09-datalist.webp", "datalist与range讲解图"),
    ("wy/html/quiz.html", "after-lab", "before", "wy/illus/web-10-quiz.webp", "HTML自测题讲解图"),
]

PAGE_RE = re.compile(r"<!--lab:illus-->.*?<!--/lab:illus-->", re.S)
OTHER_RE = re.compile(r"<!--lab:illus-[^>]*-->.*?<!--/lab:illus-[^>]*-->", re.S)


def relpath(page, asset):
    start = PurePosixPath(page).parent
    return PurePosixPath(os.path.relpath(asset, start)).as_posix()


def dims(asset):
    try:
        from PIL import Image
        with Image.open(ROOT / asset) as im:
            return im.size
    except Exception:
        return (1086, 1448)


def mk(key, html):
    return f"<!--lab:{key}-->{html}<!--/lab:{key}-->"


def figure(page, key, asset, alt):
    src = relpath(page, asset)
    w, h = dims(asset)
    esc_alt = (alt.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))
    inner = (
        f'<div class="wy-illus" data-illus="{key}">'
        f'<a class="wy-illus-link" href="{src}" target="_blank" rel="noopener">'
        f'<img src="{src}" alt="{esc_alt}" width="{w}" height="{h}" loading="lazy" decoding="async">'
        f"</a></div>"
    )
    return mk("illus" if key == "page" else f"illus-{key}", inner)


def fill_page_slot(text, page, asset, alt):
    key = page.removesuffix(".html").replace("/", ".")
    src = relpath(page, asset)
    w, h = dims(asset)
    esc_alt = (alt.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))
    block = mk(
        "illus",
        f'<div class="wy-illus" data-illus="{key}">'
        f'<a class="wy-illus-link" href="{src}" target="_blank" rel="noopener">'
        f'<img src="{src}" alt="{esc_alt}" width="{w}" height="{h}" loading="lazy" decoding="async">'
        f"</a></div>",
    )
    if not PAGE_RE.search(text):
        sys.exit(f"{page}: 找不到页面插图槽")
    return PAGE_RE.sub(block, text, count=1)


def insert_in_entry(text, page, entry, asset, alt):
    html = figure(page, entry, asset, alt)
    m = re.search(rf'<section class="wy-entry" id="{re.escape(entry)}">', text)
    if not m:
        sys.exit(f"{page}: 找不到条目 {entry}")
    end = text.index("</section>", m.end())
    seg = text[m.end():end]
    if '<div class="wy-selfcheck">' in seg:
        pos = seg.index('<div class="wy-selfcheck">')
    else:
        pos = len(seg)
    return text[:m.end()] + seg[:pos] + html + seg[pos:] + text[end:]


def insert_after_lab(text, page, anchor, asset, alt):
    html = figure(page, anchor, asset, alt)
    marker = f"<!--/lab:{anchor}-->"
    i = text.find(marker)
    if i < 0:
        sys.exit(f"{page}: 找不到 lab 块 {anchor}")
    i += len(marker)
    return text[:i] + html + text[i:]


def process(rel):
    path = ROOT / rel
    text = OTHER_RE.sub("", path.read_text(encoding="utf-8"))
    items = [p for p in PLACEMENTS if p[0] == rel]
    for page, kind, anchor, asset, alt in items:
        if kind == "page":
            text = fill_page_slot(text, page, asset, alt)
        elif kind == "entry":
            text = insert_in_entry(text, page, anchor, asset, alt)
        elif kind == "after-lab":
            text = insert_after_lab(text, page, anchor, asset, alt)
        else:
            sys.exit(f"未知方式 {kind}")
    path.write_text(text, encoding="utf-8")


def apply():
    pages = sorted({p[0] for p in PLACEMENTS})
    for rel in pages:
        process(rel)
    print(f"已挂载讲解图：{len(PLACEMENTS)} 处，{len(pages)} 个页面")


if __name__ == "__main__":
    apply()
