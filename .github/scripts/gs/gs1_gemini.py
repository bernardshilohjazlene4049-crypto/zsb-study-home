"""从 Gemini 精讲稿里取出「直观意思与为什么成立」段，转成 HTML（公式转 MathML）。"""
import re, html
import latex2mathml.converter as l2m
import markdown

GEMINI = "/workspace/shared/gaoshu_ch1_20261119/gemini_讲解.md"

def mathml(latex, display=False):
    t = latex.strip()
    t = t.replace(r"\vert{}", "|").replace(r"\limits", "")
    t = re.sub(r"\\lim_", r"\\lim\\limits_", t)
    t = t.replace(r"\dfrac", r"\frac").replace(r"\underline{\hspace{3cm}}", "＿＿＿＿")
    t = t.replace(r"\implies", r"\Rightarrow")
    out = l2m.convert(t)
    out = out.replace(' xmlns="http://www.w3.org/1998/Math/MathML"', "")
    # 单个希腊字母用直立体：避免浏览器换成数学斜体字符（U+1D6xx）后缺字显示成方框
    out = re.sub(r"<mi>(&#x0*3[0-9A-Fa-f]{2};)</mi>", r'<mi mathvariant="normal">\1</mi>', out)
    out = re.sub(r"<mo>(arc[a-z]+)</mo>", r"<mi>\1</mi>", out)
    out = out.replace('display="inline"', 'display="block"' if display else 'display="inline"')
    return out

def split_sections():
    text = open(GEMINI, encoding="utf-8").read()
    lines = text.split("\n")
    heads = []
    for i, l in enumerate(lines):
        m = re.match(r"^(#{2,4}) \**(.+?)\**\s*$", l)
        if m:
            heads.append((i, len(m.group(1)), m.group(2)))
    return lines, heads

def block(lines, heads, point_title_prefix, sec_prefix):
    """point_title_prefix 例如 '考点二：'；sec_prefix 例如 '2. 直观意思'。"""
    start = None
    for idx, (i, lv, t) in enumerate(heads):
        if t.startswith(point_title_prefix) and start is None and lv in (2, 3):
            start = idx
    assert start is not None, point_title_prefix
    for idx in range(start + 1, len(heads)):
        i, lv, t = heads[idx]
        if t.startswith(sec_prefix):
            end = len(lines)
            for j in range(idx + 1, len(heads)):
                if re.match(r"^\d\.", heads[j][2]) or heads[j][1] <= 3 and not re.match(r"^\d\.", heads[j][2]):
                    end = heads[j][0]
                    break
            return "\n".join(lines[i + 1:end]).strip("\n")
    raise KeyError((point_title_prefix, sec_prefix))

def md_to_html(md):
    store = []
    def keep_block(m):
        store.append(("b", m.group(1)))
        return f"\n\nGSMATH{len(store)-1}GSEND\n\n"
    def keep_inline(m):
        store.append(("i", m.group(1)))
        return f"GSMATH{len(store)-1}GSEND"
    md = re.sub(r"\$\$(.+?)\$\$", keep_block, md, flags=re.S)
    md = re.sub(r"\$(.+?)\$", keep_inline, md)
    # 引用块里的行首「>」去掉，缩进规范成 4 空格一级
    out, stack = [], []
    for l in md.split("\n"):
        l = re.sub(r"^>\s?", "", l)
        m = re.match(r"^( *)([*+-]|\d+\.)\s", l)
        if m:
            n = len(m.group(1))
            while stack and n < stack[-1]:
                stack.pop()
            if not stack or n > stack[-1]:
                stack.append(n)
            l = " " * (4 * (len(stack) - 1)) + l[n:]
        elif not l.strip():
            pass
        elif not l.startswith(" ") and not l.startswith("GSMATH"):
            stack = []
        out.append(l.rstrip() if not l.endswith("  ") else l)
    md = "\n".join(out)
    h = markdown.markdown(md, extensions=["sane_lists"])
    def back(m):
        kind, latex = store[int(m.group(1))]
        m = mathml(latex, kind == "b")
        return ('<div class="gs-mathwrap" tabindex="0" role="region" aria-label="公式">%s</div>' % m) if kind == "b" else m
    h = re.sub(r"GSMATH(\d+)GSEND", back, h)
    h = re.sub(r'<p>(<div class="gs-mathwrap".*?</div>)</p>', r"\1", h, flags=re.S)
    return h
