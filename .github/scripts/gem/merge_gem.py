#!/usr/bin/env python3
"""把 Gemini 文字讲解并进计算机网络（wl/）与网页设计（wy/ch1–2）对应条目。幂等。

规则：每个知识点只出现一次；不改动、不删除页面已有内容（原文、整理、自测、可视化原样保留）；
只取讲解性文字（直观意思 / 为什么 / 解答步骤）；不取材料原文复述、可视化方案、ASCII 图、自编举例；
讲解稿里写错的地方以课堂原图和页面原文为准（见 WEB_FIX）。
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gem_common import ROOT, clean_page, gem_block, insert_before, insert_in_entry, pick

SRC = Path("/workspace/shared/wl_wy_gemini")
NETL = (SRC / "计算机网络_gemini讲解.md").read_text(encoding="utf-8").split("\n")
WEBL = (SRC / "网页设计_gemini讲解.md").read_text(encoding="utf-8").split("\n")

# ---------------- 计算机网络：条目 id -> [(小标题, [行区间…])] ----------------
NET = {
    "2-4-1": [(None, [(122, 128), (131, 132)])],
    "2-5-1": [(None, [(161, 184)])],
    "2-6-1": [(None, [(197, 201)])],
    "2-7-1": [(None, [(236, 239)])],
    "6-1-1": [(None, [(283, 288)])],
    "3-6-2": [(None, [(329, 332)])],
    "3-6-1": [(None, [(388, 389)])],
    "3-9-1": [(None, [(408, 411)])],
    "3-9-2": [(None, [(402, 403)])],
    "3-7-1": [(None, [(640, 644)])],
    "3-7-2": [(None, [(689, 695)])],
    "3-7-3": [(None, [(740, 747)])],
    "3-8-1": [(None, [(809, 816)])],
    "3-8-4": [(None, [(874, 877)])],
    "1-6-1": [(None, [(926, 936)]), ("特殊 IP 地址", [(947, 948), (954, 954)])],
    "1-5-1": [(None, [(949, 950), (955, 956)])],
    "3-5-1": [(None, [(1070, 1079)])],
    "3-5-2": [(None, [(1087, 1097)])],
    "3-5-3": [(None, [(1105, 1116)])],
    "4-3-2": [(None, [(1170, 1180)])],
    "2-1-1": [(None, [(1338, 1339), (1353, 1354)])],
    "2-3-1": [(None, [(1358, 1359)])],
    "3-1-1": [(None, [(1418, 1419)])],
    "3-2-1": [(None, [(1425, 1426)])],
    "1-2-1": [(None, [(1258, 1259), (1286, 1289)])],
    "1-1-1": [(None, [(1270, 1275)])],
    "3-3-1": [(None, [(1294, 1295), (1585, 1585)])],
    "5-2-1": [(None, [(1577, 1578)])],
    "5-1-1": [(None, [(1584, 1584)])],
}

# ---------------- 网页设计 ----------------
# 讲解稿小节起始行 -> 取哪些顶层项目
HEAD = re.compile(r"^(#{1,4}) \**(.+?)\**\s*$")


def web_blocks():
    bl, cur = [], None
    for i, l in enumerate(WEBL):
        m = HEAD.match(l)
        if m and 33 <= i < 1047:
            cur = {"ln": i + 1, "h": m.group(2), "lines": []}
            bl.append(cur)
        elif cur is not None and i < 1047:
            cur["lines"].append((i + 1, l))
    return {b["ln"]: b for b in bl}


def web_text(b, want):
    """want: 顶层项目名关键词元组；取该顶层项目（含其缩进子项）。围栏代码块整体跳过。"""
    out, mode = [], None
    for n, l in b["lines"]:
        m = re.match(r"^\* \*\*(.+?)\*\*", l)
        if m:
            mode = m.group(1)
        if mode and any(k in mode for k in want):
            out.append(l)
    return out


# 小节行号 -> (条目键, 取什么, 小标题)
K = ("直观意思", "为什么", "「补充」")
Q = ("分步解析",)
WEB = [
    (38, "wy/ch1/s11.html", "s11-entry-1", K, None), (45, "wy/ch1/s11.html", "s11-entry-2", K, None),
    (52, "wy/ch1/s11.html", "s11-entry-3", K, None), (64, "wy/ch1/s11.html", "s11-entry-4", K, None),
    (75, "wy/ch1/s11.html", "s11-entry-5", K, None), (86, "wy/ch1/s11.html", "s11-entry-6", K, None),
    (93, "wy/ch1/s11.html", "s11-entry-7", K, None), (104, "wy/ch1/s11.html", "s11-entry-8", K, None),
    (125, "wy/ch1/s11.html", "s11-entry-9", K, None), (132, "wy/ch1/s11.html", "s11-entry-10", K, None),
    (149, "wy/ch1/s12.html", "s12-entry-1", K, None), (156, "wy/ch1/s12.html", "s12-entry-2", K, None),
    (163, "wy/ch1/s12.html", "s12-entry-3", K, None), (170, "wy/ch1/s12.html", "s12-entry-4", K, None),
    (177, "wy/ch1/s12.html", "s12-entry-5", K, None),
    (186, "wy/ch1/s13.html", "s13-entry-1", K, None), (193, "wy/ch1/s13.html", "s13-entry-2", K, None),
    (204, "wy/ch1/s13.html", "s13-entry-3", K, None),
    (215, "wy/ch1/s-extra.html", "s-extra-entry-1", K, None),
    (227, "wy/ch1/s11.html", "s11-entry-7", Q, "自测要点解答"), (255, "wy/ch1/s11.html", "s11-entry-3", Q, "自测要点解答"),
    (282, "wy/ch1/s11.html", "s11-entry-4", Q, "自测要点解答"), (307, "wy/ch1/s11.html", "s11-entry-5", Q, "自测要点解答"),
    (330, "wy/ch1/s11.html", "s11-entry-8", Q, "自测要点解答"), (362, "wy/ch1/s11.html", "s11-entry-10", Q, "自测要点解答"),
    (387, "wy/ch1/s12.html", "s12-entry-5", Q, "自测要点解答"), (411, "wy/ch1/s13.html", "s13-entry-3", Q, "自测要点解答"),
    (452, "wy/ch2/s21.html", "s21-entry-1", K, None), (462, "wy/ch2/s21.html", "s21-entry-2", K, None),
    (477, "wy/ch2/s21.html", "s21-entry-4", K, None),
    (494, "wy/ch2/s22.html", "s22-entry-1", K, None), (515, "wy/ch2/s22.html", "s22-entry-3", K, None),
    (542, "wy/ch2/s22.html", ("before", "ext-html5-intro"), K, None),
    (557, "wy/ch2/s22b.html", "s22b-entry-1", K, None), (578, "wy/ch2/s22b.html", "s22b-entry-2", K, None),
    (595, "wy/ch2/s22b.html", "s22b-entry-6", K, None),
    (612, "wy/ch2/s23.html", "s23-entry-1", K, None), (639, "wy/ch2/s23.html", "s23-entry-4", K, None),
    (652, "wy/ch2/s23.html", "s23-entry-5", K, None), (670, "wy/ch2/s23.html", ("before", "ext-html-head"), K, None),
    (686, "wy/ch2/s24.html", "s24-entry-1", K, None), (699, "wy/ch2/s24.html", "s24-entry-1", K, None),
    (717, "wy/ch2/s24.html", "s24-entry-1", K, None),
    (736, "wy/ch2/s21.html", "s21-entry-1", Q, "自测要点解答"), (769, "wy/ch2/s21.html", "s21-entry-3", Q, "自测要点解答"),
    (798, "wy/ch2/s22.html", "s22-entry-1", Q, "自测要点解答"), (833, "wy/ch2/s22.html", "s22-entry-3", Q, "自测要点解答"),
    (860, "wy/ch2/s22b.html", "s22b-entry-7", Q, "自测要点解答"), (897, "wy/ch2/s23.html", "s23-entry-5", Q, "自测要点解答"),
    (934, "wy/ch2/s24.html", "s24-entry-1", Q, "自测要点解答"), (976, "wy/ch2/s22b.html", "s22b-entry-6", Q, "自测要点解答"),
    (996, "wy/ch2/s21.html", ("before", "ext-html-attributes"), None, "实操题解答"),
    (1023, "wy/ch2/s22b.html", ("before", "ext-html-elements"), None, "实操题解答"),
]
# 讲解稿写错的地方（以照片/页面原文为准）：(行号, 原文, 改为)
BG_NOTE = "手写批注：bgcolor 旁为“同时设置背景【看不清】和图像”，background 旁为“显示背景图像”。"
WEB_FIX = [
    # 第 2 章题 7：把背景色和背景图写成「冲突规则」，课堂照片并无此说；改为照片上的两句手写批注
    (r"(?m)^( *)\* 冲突规则：同时设置时，显示\*\*背景图像\*\*。 *$", r"\1* " + BG_NOTE),
    # 知识点 14：同上
    (r"如果两者同时写了，页面最终优先显示的是\*\*背景图像\*\*。", BG_NOTE),
]


def net_pages():
    plan = {}
    for eid, parts in NET.items():
        ch, k, _ = eid.split("-")
        f = f"wl/ch{ch}/s{ch}{k}.html"
        plan.setdefault(f, []).append((eid, "e-" + eid, parts))
    return plan


def web_plan():
    blocks = web_blocks()
    plan = {}
    for ln, f, target, want, title in WEB:
        b = blocks[ln]
        lines = web_text(b, want or Q)
        md = pick(lines, [(1, len(lines))], code=True)
        for pat, new in WEB_FIX:
            md = re.sub(pat, new, md)
        plan.setdefault(f, {}).setdefault(target if isinstance(target, str) else target[1], {"t": target, "parts": []})["parts"].append((title, md))
    return plan


def main():
    files = {}
    for f, items in net_pages().items():
        t = clean_page((ROOT / f).read_text(encoding="utf-8"))
        for key, entry, parts in items:
            ps = [(title, pick(NETL, rngs)) for title, rngs in parts]
            t = insert_in_entry(t, entry, gem_block(key, ps))
        files[f] = t
    for f, items in web_plan().items():
        t = files.get(f) or clean_page((ROOT / f).read_text(encoding="utf-8"))
        for key, it in items.items():
            blk = gem_block(key, it["parts"])
            tg = it["t"]
            t = insert_before(t, f'<div class="wy-ext-block" id="{tg[1]}">', blk) if isinstance(tg, tuple) else insert_in_entry(t, tg, blk)
        files[f] = t
    for f, t in files.items():
        p = ROOT / f
        if p.read_text(encoding="utf-8") != t:
            p.write_text(t, encoding="utf-8")
    print(len(files), "pages")


if __name__ == "__main__":
    main()
