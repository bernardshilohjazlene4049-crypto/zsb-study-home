#!/usr/bin/env python3
"""由 tests/fixtures/network-data.json 生成「计算机网络」(wl/) 全部页面与目录数据。

用法（仓库根目录）：
  python3 .github/scripts/wl/build_wl.py                 # 重建页面与目录数据（幂等）
  python3 .github/scripts/wl/build_wl.py --photos DIR    # 先由原图目录（含 笔记/ 作业/）重新压缩原图，再重建
内容只来自 data.json：原文、整理、自测逐字输出，不手写任何讲义文字。
"""
import hashlib, html, json, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
ROOT = HERE.parents[2]
DATA = ROOT / "tests/fixtures/network-data.json"
PHOTOS = ROOT / "tests/fixtures/network-photos.json"
SITE = "https://bernardshilohjazlene4049-crypto.github.io/zsb-study-home/"

# 整理中的一处不下定论：3-9-1 老师同一题写了两种算法，原图没有解释；整理里去掉对此下结论、比较选项和提示确认的句子，
# 两种算法在原文里逐字保留。键为条目 id，值为要从整理中去掉的结尾片段（测试按同一表对比）。
SUPPLEMENT_CUT = {
    "3-9-1": [
        "（按传统规则，掩码是 240，但选项里没有）",
        "老师最终选 C，即这题按 2^n ≥ 8 算。为什么这里不减 2、与 3-4-2 等题的 2^n − 2 规则不一致，原图没有说明，整理者不补充，请听课或问老师确认。",
    ],
}

def esc(s):
    return html.escape(s, quote=True)

def photo_name(path):
    m = re.match(r"images/(笔记|作业)/(\d+)_", path)
    kind = "n" if m.group(1) == "笔记" else "h"
    return f"{kind}{m.group(2)}.jpg", f"原图 · {m.group(1)} {m.group(2)}"

def process_photos(src):
    from PIL import Image
    data = json.loads(DATA.read_text(encoding="utf-8"))
    out = ROOT / "wl/原图"
    out.mkdir(parents=True, exist_ok=True)
    paths = []
    for c in data["章"]:
        for k in c["知识点"]:
            for e in k["条目"]:
                for p in e["图片"]:
                    if p not in paths: paths.append(p)
    meta = {}
    for p in paths:
        name, label = photo_name(p)
        im = Image.open(Path(src) / p.replace("images/", "", 1))
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.getchannel("A"))
            im = bg
        else:
            im = im.convert("RGB")
        im.save(out / name, "JPEG", quality=82, optimize=True, progressive=True)
        raw = (out / name).read_bytes()
        w, h = Image.open(out / name).size
        meta[name] = {"source": p, "label": label, "width": w, "height": h, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    PHOTOS.write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("原图", len(meta), "张，合计", sum(m["bytes"] for m in meta.values()) // 1024, "KB")

# ---------- 文字渲染 ----------
def render_source(text):
    """原文：逐行输出；以 | 开头的连续行是表格；【老师手写】之后的行用手写样式。"""
    lines = text.split("\n")
    out, i, hand = [], 0, False
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            out.append('<div class="wy-source-row wl-source-table">' + table_html(rows, header=True) + "</div>")
            continue
        if ln in ("【印刷】", "【老师手写】"):
            hand = ln == "【老师手写】"
            out.append(f'<div class="wy-source-row wl-source-mark"><p>{esc(ln)}</p></div>')
        elif hand:
            out.append(f'<div class="wy-source-row wl-source-hand"><span class="wy-hand">{esc(ln)}</span></div>')
        else:
            out.append(f'<div class="wy-source-row"><p>{esc(ln)}</p></div>')
        i += 1
    return "".join(out)

def table_html(rows, header):
    h = ['<div class="tablewrap" tabindex="0" role="region" aria-label="表格"><table>']
    start = 0
    if header:
        h.append("<thead><tr>" + "".join(f'<th scope="col">{esc(c)}</th>' if c else "<td></td>" for c in rows[0]) + "</tr></thead>")
        start = 1
    h.append("<tbody>")
    for r in rows[start:]:
        h.append("<tr>" + "".join((f'<th scope="row">{esc(c)}</th>' if j == 0 else f"<td>{esc(c)}</td>") if (c or j) else "<td></td>" for j, c in enumerate(r)) + "</tr>")
    h.append("</tbody></table></div>")
    return "".join(h)

def render_supplement(text):
    lines = text.split("\n")
    out, i = [], 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{3,}:?", c) for c in cells): rows.append(cells)
                i += 1
            out.append(table_html(rows, header=True))
            continue
        if re.match(r"^- ", ln):
            items = []
            while i < len(lines) and lines[i].startswith("- "):
                items.append(lines[i][2:]); i += 1
            out.append("<ul>" + "".join(f"<li>{esc(x)}</li>" for x in items) + "</ul>")
            continue
        if re.match(r"^\d+\. ", ln):
            items = []
            while i < len(lines) and re.match(r"^\d+\. ", lines[i]):
                items.append(re.sub(r"^\d+\. ", "", lines[i], count=1)); i += 1
            out.append("<ol>" + "".join(f"<li>{esc(x)}</li>" for x in items) + "</ol>")
            continue
        out.append(f"<p>{esc(ln)}</p>")
        i += 1
    return "".join(out)

def supplement_text(e):
    t = e["整理"]
    for cut in SUPPLEMENT_CUT.get(e["id"], []):
        assert cut in t
        t = t.replace(cut, "").rstrip()
        t = re.sub(r"[ \t]+\n", "\n", t).replace("\n\n", "\n")
    return t

# ---------- 页面 ----------
HEAD_CSS = '''<link rel="icon" href="{up}assets/icons/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="{up}assets/css/site-unify.css">
<link rel="stylesheet" href="{up}assets/css/site-shell.css">
<script src="{up}assets/js/site-shell.js"></script>
<link rel="stylesheet" href="{up}assets/css/wy-points.css">
<link rel="stylesheet" href="{up}assets/css/net-viz.css">
<script src="{up}assets/js/wy-points.js" defer></script>
<script src="{up}assets/js/net-viz.js" defer></script>
'''
HEADER = '<header class="site-header"><div class="site-header__inner"><a class="site-brand" href="{up}index.html">辽宁专升本</a><nav class="site-nav" aria-label="全站导航"><a href="{up}search.html">搜索</a></nav></div></header>'

def page(title, desc, rel, up, body, extra_body=""):
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{esc(title)} · 计算机网络 · 辽宁专升本</title>
<meta name="description" content="{esc(desc)}">
{HEAD_CSS.format(up=up)}  <link rel="canonical" href="{SITE}{rel}">
  <meta name="zsb-module" content="network">
  <meta name="zsb-status" content="ready">
</head>
<body class="wy-points-page wl-page">
{HEADER.format(up=up)}
<main class="site-main"><div class="site-container">
{body}
</div></main>
{extra_body}</body></html>
'''

def entry_html(e, photo_no, vizcfg):
    from wl_viz import figure_html
    top = f'<div class="wy-entry-top"><h2>{esc(e["标题"])}</h2>'
    if photo_no:
        top += f'<button class="sh-btn" type="button" data-open-photo data-photos="{photo_no}">打开原图</button>'
    top += "</div>"
    viz = '<div class="wy-viz wy-paper" data-pagefind-ignore><h3>可视化讲解</h3>' + "".join(figure_html(c, e["id"], i) for i, c in enumerate(vizcfg)) + "</div>"
    return top, viz

def build():
    from wl_viz import VIZ
    data = json.loads(DATA.read_text(encoding="utf-8"))
    photos = json.loads(PHOTOS.read_text(encoding="utf-8"))
    out = {}   # rel -> html
    topics, chapters, edges = [], [], []
    prev_topic = None
    for ci, ch in enumerate(data["章"], 1):
        cid = f"net.ch{ci}"
        chapters.append({"id": cid, "subject_id": "network", "parent_id": None, "title": ch["章"], "order": ci,
                         "source_ref": f"wl/ch{ci}/index.html", "verified": False})
        rows = []
        for ki, kp in enumerate(ch["知识点"], 1):
            tid = f"net.s{ci}{ki}"
            no = f"{ci}.{ki}"
            title = f"{no} {kp['知识点']}"
            rel = f"wl/ch{ci}/s{ci}{ki}.html"
            topics.append({"id": tid, "subject_id": "network", "chapter_id": cid, "title": title, "order": ki, "aliases": [],
                           "prereq_ids": [prev_topic] if prev_topic else [], "source_ref": rel, "legacy_url": rel, "verified": False})
            if prev_topic:
                edges.append({"topicId": tid, "prerequisiteId": prev_topic, "strength": "soft", "reason": "按目录顺序，先学习前一个知识点。"})
            prev_topic = tid
            rows.append(f'<li><a class="wy-chapter-row" href="s{ci}{ki}.html"><span class="wy-chapter-dot" aria-hidden="true"></span><span class="wy-point-no">{no}</span><span class="wy-chapter-label">{esc(kp["知识点"])}</span><span aria-hidden="true">→</span></a></li>')
            # --- 知识点页 ---
            tabs, tab_no, tab_labels = [], {}, []
            for e in kp["条目"]:
                for p in e["图片"]:
                    name, label = photo_name(p)
                    if name not in tab_no:
                        tab_no[name] = len(tab_no) + 1
                        tab_labels.append(label)
                        m = photos[name]
                        tabs.append(f'<button type="button" class="sh-btn" data-photo-number="{tab_no[name]}" data-photo="../原图/{name}" data-width="{m["width"]}" data-height="{m["height"]}">{esc(label)}</button>')
            sections, practice_entries, rn = [], [], 0
            for e in kp["条目"]:
                vz = VIZ[e["id"]]
                assert len(vz) == len(e["可视化"]), (e["id"], len(vz), len(e["可视化"]))
                pno = tab_no[photo_name(e["图片"][0])[0]] if e["图片"] else 0
                top, viz = entry_html(e, pno, vz)
                st = []
                for n in e["自测"]:
                    rn += 1
                    st.append(f'<li class="sh-card"><span class="rn">{rn}</span><span>{esc(n)}</span></li>')
                sec = (f'<section class="wy-entry" id="e-{e["id"]}">{top}'
                       f'<div class="wy-source wy-paper">{render_source(e["原文"])}</div>'
                       f'<div class="wy-supplement wy-paper"><h3>整理</h3>{render_supplement(supplement_text(e))}</div>'
                       f'{viz}'
                       f'<div class="wy-selfcheck"><h3>自测要点</h3><ol class="wy-practice">{"".join(st)}</ol></div></section>')
                (practice_entries if any("/作业/" in p for p in e["图片"]) else sections).append((e, sec))
            links = []
            for e in kp["条目"]:
                for n in e["自测"]:
                    links.append(f'<li><a href="#e-{e["id"]}">{esc(n)}</a></li>')
            practice = ('<section id="practice" class="wy-unit"><h2>习题</h2>' + "".join(s for _, s in practice_entries)
                        + f'<ul class="wy-practice-links">{"".join(links)}</ul></section>')
            dialog = (f'<dialog class="wy-photo" aria-labelledby="wy-photo-title"><header><strong id="wy-photo-title">{esc(tab_labels[0] if tab_labels else "")}</strong>'
                      '<div><button type="button" class="sh-btn" data-photo-zoom aria-pressed="false">放大</button><button type="button" class="sh-btn" data-photo-close>关闭</button></div></header>'
                      f'<div class="wy-photo-tabs" aria-label="原图">{"".join(tabs)}</div><div class="wy-photo-scroll" tabindex="0"><img alt="" width="1920" height="1080"></div></dialog>\n')
            body = (f'<div class="wy-layout" data-chapter="{cid}">\n<article class="sh-card wy-sheet"><header class="wy-point-head"><span class="wy-point-no">{no}</span><h1>{esc(title)}</h1></header>\n'
                    + "\n".join(s for _, s in sections) + (practice if True else "") + "</article>\n</div>")
            out[rel] = page(title, f"计算机网络 · {title}", rel, "../../", body, dialog)
        body = (f'<div class="wy-layout" data-chapter="{cid}">\n<header class="sh-card wy-chapter-head"><h1>{esc(ch["章"])}</h1><p>{len(ch["知识点"])} 个知识点</p></header>'
                f'<section class="sh-card wy-chapter-list"><ol>{"".join(rows)}</ol></section></div>')
        out[f"wl/ch{ci}/index.html"] = page(ch["章"], f"计算机网络 · {ch['章']}", f"wl/ch{ci}/index.html", "../../", body)
    footer = ('<footer class="site-footer"><div class="site-footer__inner"><nav class="site-footer__links" aria-label="页脚导航"><a href="../index.html">首页</a>'
              '<a href="../jsj/index.html">计算机基础</a><a href="../gs/index.html">高等数学</a><a href="../c/index.html">C语言</a><a href="../yy/index.html">英语</a>'
              '<a href="../wy/index.html">网页设计</a><a href="../wl/index.html" aria-current="page">计算机网络</a></nav></div></footer>')
    out["wl/index.html"] = f'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<link rel="icon" href="../assets/icons/favicon.svg" type="image/svg+xml">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#f8f9fb">
<title>计算机网络 · 辽宁专升本</title>
<meta name="description" content="计算机网络：IP 地址、CIDR、子网划分、IPv4 分片、IPv6 与路由聚合，按章节知识点学习。">
<meta property="og:type" content="website">
<meta property="og:site_name" content="辽宁专升本">
<meta property="og:title" content="计算机网络 · 辽宁专升本">
<meta property="og:description" content="计算机网络：IP 地址、CIDR、子网划分、IPv4 分片、IPv6 与路由聚合，按章节知识点学习。">
<meta property="og:url" content="{SITE}wl/index.html">
<meta property="og:image" content="{SITE}assets/og/cover.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../assets/css/site-unify.css">
<link rel="stylesheet" href="../assets/css/site-topbar.css">
<link rel="manifest" href="../manifest.webmanifest"><script src="../assets/js/sw-register.js" defer></script>
<link rel="stylesheet" href="../assets/css/site-shell.css"><script src="../assets/js/site-shell.js"></script>
  <link rel="canonical" href="{SITE}wl/index.html">
  <meta name="zsb-module" content="network">
  <meta name="zsb-status" content="ready">
</head>
<body class="wy-catalog-page wl-page">
<div class="site-shell">
<header class="site-header"><div class="site-header__inner"><a class="site-brand" href="../index.html"><span class="site-brand__name">辽宁专升本</span></a><nav class="site-nav" aria-label="科目导航"><a class="site-nav__link" href="../search.html">搜索</a></nav></div></header>
<main class="site-main">
  <div class="site-container">
    <section class="page-hero page-hero--compact" aria-labelledby="page-title">
      <h1 class="page-title" id="page-title">计算机网络</h1>
    </section>
  </div>
</main>
{footer}
</div>
</body>
</html>
'''
    for rel, content in out.items():
        p = ROOT / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    write_catalog(topics, chapters, edges)
    print("页面", len(out), "个；章", len(chapters), "；知识点", len(topics))

OLD_NET_TOPICS = {"net.ip_basics": "net.s11", "net.cidr": "net.s21", "net.subnet": "net.s31", "net.fragments": "net.s41", "net.ipv6": "net.s51"}

def write_catalog(topics, chapters, edges):
    tp = ROOT / "data/topics.json"
    t = json.loads(tp.read_text(encoding="utf-8"))
    # 旧的课堂笔记 5 章 5 个知识点换成统一目录；旧编号通过 merged_topics 映射，学习记录不丢。
    def is_net(x): return x["subject_id"] == "network"
    ci = next(i for i, x in enumerate(t["chapters"]) if is_net(x))
    ti = next(i for i, x in enumerate(t["topics"]) if is_net(x))
    t["chapters"] = [x for x in t["chapters"] if not is_net(x)]
    t["topics"] = [x for x in t["topics"] if not is_net(x)]
    t["chapters"][ci:ci] = chapters
    t["topics"][ti:ti] = topics
    t["merged_topics"].update(OLD_NET_TOPICS)
    tp.write_text(json.dumps(t, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    dp = ROOT / "data/dependencies.json"
    d = json.loads(dp.read_text(encoding="utf-8"))
    keep = [e for e in d["edges"] if not (e["topicId"].startswith("net.") or e["prerequisiteId"].startswith("net."))]
    first_net = next((i for i, e in enumerate(d["edges"]) if e["topicId"].startswith("net.")), len(keep))
    d["edges"] = keep[:first_net] + edges + keep[first_net:]
    dp.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    if "--photos" in sys.argv:
        process_photos(sys.argv[sys.argv.index("--photos") + 1])
    build()
