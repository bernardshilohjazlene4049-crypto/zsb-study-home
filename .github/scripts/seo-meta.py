#!/usr/bin/env python3
"""生成每页 meta description / Open Graph 标签与 sitemap.xml。
描述只取页面已有文字：首段（优先 .lead）或各级小标题；已手写 description 的页面保持不变。
用法：python3 .github/scripts/seo-meta.py        # 改写 HTML 并重写 sitemap.xml
"""
import re, subprocess, html, os
from html.parser import HTMLParser

ROOT = subprocess.check_output(["git", "rev-parse", "--show-toplevel"]).decode().strip()
BASE = "https://bernardshilohjazlene4049-crypto.github.io/zsb-study-home/"
COVER = BASE + "assets/og/cover.png"
NOT_IN_SITEMAP = re.compile(r"^(404\.html|search\.html|study/|tower/)")
SKIP_TAGS = {"script", "style", "noscript", "template", "svg", "header", "nav", "footer", "aside", "button"}
UI_WORDS = re.compile(r"点击揭晓|即将开放")

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0; self.title = ""; self.in_title = False; self.h1 = ""; self.in_h1 = False
        self.paras = []; self.leads = []; self.heads = []; self.cur = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in SKIP_TAGS: self.skip += 1
        if tag == "title": self.in_title = True
        if self.skip: return
        if tag == "h1": self.in_h1 = True
        if self.cur is None and tag in ("p", "li", "h2", "h3"):
            cls = (a.get("class") or "").split()
            self.cur = [tag, "", "lead" in cls, any("crumb" in c or "context" in c for c in cls)]
    def handle_endtag(self, tag):
        if tag in SKIP_TAGS: self.skip = max(0, self.skip - 1)
        if tag == "title": self.in_title = False
        if tag == "h1": self.in_h1 = False
        if self.cur and tag == self.cur[0]:
            text = re.sub(r"\s+", " ", UI_WORDS.sub("", self.cur[1])).strip()
            if text:
                if self.cur[3]: pass
                elif tag in ("h2", "h3"): self.heads.append(text); self.paras.append(("h", text))
                elif self.cur[2]: self.leads.append(text)
                else: self.paras.append((tag, text))
            self.cur = None
    def handle_data(self, data):
        if self.in_title: self.title += data
        if self.skip: return
        if self.in_h1: self.h1 += data
        if self.cur is not None: self.cur[1] += data

def clip(text, n=110):
    if len(text) <= n: return text
    cut = text[:n]
    m = max(cut.rfind(c) for c in "。；！？")
    return cut[: m + 1] if m >= 40 else cut.rstrip("，、；：,; ") + "…"

def usable(text):
    return len(text) >= 12 and not text.startswith("*") and "（）" not in text

def first_block(blocks):
    """首个够长的段落；若先出现列表，把相邻几条列表项连成一句。"""
    i = 0
    while i < len(blocks):
        tag, text = blocks[i]
        if tag == "li":
            run = []
            while i < len(blocks) and blocks[i][0] == "li":
                run.append(blocks[i][1]); i += 1
            picked = []
            for t in run:
                picked.append(t.rstrip("。；;，, "))
                if sum(map(len, picked)) >= 30: break
            joined = "；".join(picked)
            if usable(joined) and all("（）" not in t for t in picked): return joined
            continue
        if tag == "p" and usable(text): return text
        i += 1
    return ""

def describe(page):
    head = re.sub(r"\s+", " ", page.h1).strip() or re.split(r" · |｜", page.title.strip())[0]
    body = next((t for t in page.leads if len(t) >= 12), "") or first_block(page.paras)
    if not body:
        heads = [h for h in page.heads if h != head and h not in ("章节",)]
        body = "、".join(dict.fromkeys(heads))
    if not body: return clip(head)
    body = body.rstrip("：:")
    return clip(body if body.startswith(head) else f"{head}：{body}")

def tags(path, title, desc, existing):
    url = BASE + ("" if path == "index.html" else path)
    esc = lambda s: html.escape(s, quote=True)
    out = [] if existing else [f'<meta name="description" content="{esc(desc)}">']
    out += [
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="辽宁专升本">',
        f'<meta property="og:title" content="{esc(title)}">',
        f'<meta property="og:description" content="{esc(existing or desc)}">',
        f'<meta property="og:url" content="{esc(url)}">',
        f'<meta property="og:image" content="{COVER}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        '<meta name="twitter:card" content="summary_large_image">',
    ]
    return out

def main():
    files = subprocess.check_output(["git", "-C", ROOT, "ls-files", "*.html"]).decode().split()
    urls = []
    for path in files:
        full = os.path.join(ROOT, path); src = open(full, encoding="utf-8").read()
        if 'property="og:title"' in src: pass
        else:
            page = Page(); page.feed(src)
            m = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', src, re.S)
            existing = html.unescape(re.sub(r"\s+", " ", m.group(1)).strip()) if m else ""
            title = re.sub(r"\s+", " ", page.title).strip()
            block = "\n  ".join(tags(path, title, describe(page), existing))
            src = re.sub(r"(<title>[\s\S]*?</title>)", lambda t: t.group(1) + "\n  " + block, src, count=1)
            open(full, "w", encoding="utf-8").write(src)
        if not NOT_IN_SITEMAP.match(path):
            urls.append(BASE + ("" if path == "index.html" else path))
    xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    xml += [f"  <url><loc>{html.escape(u)}</loc></url>" for u in urls]
    xml.append("</urlset>")
    open(os.path.join(ROOT, "sitemap.xml"), "w").write("\n".join(xml) + "\n")
    print(f"{len(files)} 个页面，sitemap {len(urls)} 条")

if __name__ == "__main__":
    main()
