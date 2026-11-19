"""把 Gemini 讲解稿里的「直观意思 / 为什么 / 解答」转成 HTML 并幂等地插进页面。

只取讲解性文字；不取：材料原文（页面已有逐字原文）、可视化方案与 ASCII 图、
与课堂原图无关的出题/做题建议。公式（${…}$）在构建时转成静态 MathML。
"""
import html
import re
from pathlib import Path

import latex2mathml.converter as l2m
import markdown

ROOT = Path(__file__).resolve().parents[3]

# 整行丢弃：Gemini 自己加的备考口径、考场技巧、自编举例
DROP = re.compile(r"专升本|考场|必背|时钟周期|按课堂口径选|考试作答时建议|做题按|factNote|改写批注|仓库校注|秒杀技巧|考试排序题|考试只认|常见干扰项|定位考点|常把 Markup|审清映射方向|教材/自测口径|分步解析\*\*[：:]\s*$")
# 句内裁掉
CUT = [
    (r" ?注意原文正文的正确示例里.*$", ""),
    (r"注意 HTML 本身不区分大小写，但考试里常把“区分大小写”设为错误干扰项。", "HTML 本身不区分大小写。"),
    (r"（必考改错）|（★常考）", ""),
    (r"（与材料“整理”区一致）", ""),
    (r"手写批注里“超【看不清】 标记 语言”按上文全称对照，【看不清】处对应“文本”二字；", ""),
    (r" ?结合上下两行手写批注“同时设置背景【看不清】和图像”与“显示背景图像”，【看不清】处按语义对应“颜色”或“色”字。", ""),
    (r"，考试中两种写法都要认得", ""),
    (r"记牢材料里的必考代表", "两类各举代表"),
    (r"（高频考场防坑）[：:]?", ""),
    (r"（考试核心易错点）", ""),
    (r"「补充」\*\*辽宁专升本做题策略\*\*[：:].*$", ""),
    (r"，辽宁专升本默认按此标准出题，除非题目明确说明“允许使用全 0 和全 1 子网”", ""),
    (r"[；。] ?如果遇到不能被 8 整除的 MTU（例如 MTU=800[^）]*）[^。！]*[。！]", "。"),
    (r"，\*\*一次逐位 AND 运算在硬件电路里只需一个时钟周期就能完成\*\*（「补充」），这就是路由器能高速查表转发的数学基础。", "。"),
]


def mathml(latex, display=False):
    t = latex.strip()
    t = t.replace(r"\vert{}", "|").replace(r"\limits", "")
    t = t.replace(r"\dfrac", r"\frac").replace(r"\implies", r"\Rightarrow")
    out = l2m.convert(t)
    out = out.replace(' xmlns="http://www.w3.org/1998/Math/MathML"', "")
    out = re.sub(r"<mi>(&#x0*3[0-9A-Fa-f]{2};)</mi>", r'<mi mathvariant="normal">\1</mi>', out)
    out = re.sub(r"<mo>(arc[a-z]+)</mo>", r"<mi>\1</mi>", out)
    return out.replace('display="inline"', 'display="block"' if display else 'display="inline"')


def clean_line(l):
    for pat, rep in CUT:
        l = re.sub(pat, rep, l)
    l = re.sub(r"\*\*「补充」\*\*[：:]\s*", "", l)
    l = re.sub(r"「补充」[：:]\s*", "", l)
    l = l.replace("（「补充」）", "").replace("「补充」", "").replace("****", "")
    return l


def esc_outside_code(s):
    parts = re.split(r"(`[^`]*`)", s)
    return "".join(p if p.startswith("`") else p.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") for p in parts)


def md_to_html(md):
    store = []

    def keep(m):
        store.append(m.group(1))
        return f"GEMMATH{len(store)-1}GEMEND"

    codes = []

    def keep_code(m):
        codes.append(m.group(2))
        return f"\n\nGEMCODE{len(codes)-1}GEMEND\n\n"

    md = re.sub(r"^```(\w*)\n(.*?)\n```[ \t]*$", keep_code, md, flags=re.S | re.M)
    md = re.sub(r"\$(.+?)\$", keep, md)
    out, stack = [], []
    for l in md.split("\n"):
        l = re.sub(r"^>\s?", "", l)
        l = esc_outside_code(l)
        m = re.match(r"^( *)([*+-]|\d+\.)\s", l)
        if m:
            n = len(m.group(1))
            while stack and n < stack[-1]:
                stack.pop()
            if not stack or n > stack[-1]:
                stack.append(n)
            l = " " * (4 * (len(stack) - 1)) + l[n:]
        elif l.strip() and not l.startswith(" "):
            stack = []
        out.append(l.rstrip() if not l.endswith("  ") else l)
    h = markdown.markdown("\n".join(out), extensions=["sane_lists"])
    h = re.sub(r"GEMMATH(\d+)GEMEND", lambda m: mathml(store[int(m.group(1))]), h)
    h = re.sub(
        r"<p>GEMCODE(\d+)GEMEND</p>",
        lambda m: '<pre tabindex="0"><code>%s</code></pre>' % html.escape(codes[int(m.group(1))]),
        h,
    )
    return h


def pick(lines, ranges, code=False):
    """lines: 稿件全部行（0 起）；ranges: [(起, 止)] 1 起闭区间；跳过 Plaintext/围栏代码块。"""
    out, fence, plain, keepfence = [], False, False, False
    for a, b in ranges:
        for i in range(a - 1, b):
            l = lines[i]
            if l.strip().startswith("```"):
                fence = not fence
                if code and fence and re.match(r"```(html|css|js|javascript)?\s*$", l.strip()):
                    keepfence = True
                elif code and keepfence and not fence:
                    keepfence = False
                    out.append("```")
                    continue
                else:
                    keepfence = False
                if keepfence:
                    out.append("```")
                continue
            if fence:
                if keepfence:
                    out.append(l.rstrip())
                continue
            if l.strip() == "Plaintext":
                plain = True
                continue
            if plain:
                if l.strip() == "":
                    plain = False
                continue
            if not l.strip() or l.startswith("#"):
                continue
            l = clean_line(l)
            if DROP.search(l):
                continue
            out.append(l)
    return "\n".join(out)


def gem_block(key, parts):
    """parts: [(小标题或 None, markdown)]"""
    inner = ""
    for title, md in parts:
        if title:
            inner += f"<h4>{html.escape(title)}</h4>"
        inner += md_to_html(md)
    return f'<!--gem:{key}--><div class="wy-supplement wy-paper wy-gem"><h3>讲解</h3>{inner}</div><!--/gem:{key}-->'


def clean_page(text):
    text = re.sub(r"<!--gem:[^>]*?-->.*?<!--/gem:[^>]*?-->", "", text, flags=re.S)
    return text


def insert_in_entry(text, entry_id, block):
    m = re.search(r'<section class="wy-entry"[^>]*id="%s"' % re.escape(entry_id), text)
    assert m, entry_id
    end = text.index("</section>", m.end())
    seg = text[m.end():end]
    cand = [seg.find(t) for t in ('<!--lab:', '<div class="wy-viz', '<div class="wy-selfcheck')]
    cand = [c for c in cand if c >= 0]
    pos = m.end() + (min(cand) if cand else len(seg))
    return text[:pos] + block + text[pos:]


def insert_before(text, anchor, block):
    assert text.count(anchor) == 1, anchor
    i = text.index(anchor)
    return text[:i] + block + text[i:]
