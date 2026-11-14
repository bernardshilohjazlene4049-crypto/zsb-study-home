"""从固定基线 HTML 原始片段生成统一条目；python tests/fixtures/build-wy-entries.py。
仅使用标准库；输入为 git 97695f0（九页）/722ce58（六课页），不手写学习内容。
分组中的 source 为原文顶层块下标，supplement 为整理顶层块下标；均从 0 开始。
列表型整理按原 ol 的直接 li 分组，保留每个 li 的原始 HTML。
"""
from html.parser import HTMLParser
from html import escape, unescape
from pathlib import Path
import subprocess, re, json

ROOT = Path(__file__).resolve().parents[2]
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())
class Node:
    def __init__(self, doc, tag='', attrs=(), start=0, inner=0):
        self.doc, self.tag, self.attrs, self.start, self.inner = doc, tag, dict(attrs), start, inner
        self.end, self.stop, self.children = len(doc), len(doc), []
    def has(self, cls): return cls in (self.attrs.get('class') or '').split()
    def all(self, predicate):
        return [n for c in self.children for n in ([c] if predicate(c) else []) + c.all(predicate)]
    def one(self, predicate): return self.all(predicate)[0]
    @property
    def raw(self): return self.doc[self.start:self.end]
    @property
    def body(self): return self.doc[self.inner:self.stop]
class Parser(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.doc=text; self.lines=[0]
        self.lines += [m.end() for m in re.finditer('\n',text)]
        self.root=Node(text); self.stack=[self.root]; self.feed(text)
    def pos(self):
        line,col=self.getpos(); return self.lines[line-1]+col
    def handle_starttag(self,tag,attrs):
        start=self.pos(); n=Node(self.doc,tag,attrs,start,start+len(self.get_starttag_text()))
        self.stack[-1].children.append(n)
        if tag not in VOID: self.stack.append(n)
        else: n.end=n.stop=n.inner
    def handle_startendtag(self,tag,attrs):
        self.handle_starttag(tag,attrs)
        if tag not in VOID:
            n=self.stack.pop(); n.end=n.stop=n.inner
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag:
                n=self.stack[i]; n.stop=self.pos(); n.end=self.doc.index('>',n.stop)+1
                self.stack=self.stack[:i]; break

def tree(s): return Parser(s).root
def plain(s):
    return re.sub(r'\s+',' ',unescape(re.sub('<[^>]+>','',s))).strip()
def original(path,rev='97695f0'):
    return subprocess.check_output(['git','show',f'{rev}:{path}'],cwd=ROOT).decode('utf-8')
def save(path,s):
    (ROOT/path).write_text(s,encoding='utf-8',newline='\n')
def take(rows,indices): return ''.join(rows[i].raw for i in indices)
def seq(a,b): return list(range(a,b))

# (标题, 原文块下标, 整理块下标, 自测原编号, 照片原编号)。标题来自 CSV/已有整理标题。
GROUPS={
's11':[
('1. 网站',[0,1],[0,1],[],[1]),('2. 网页',[2],[2,3],[],[1]),
('3. URL',[3,4,5],seq(4,10),[2],[1]),('4. DNS',[6],seq(10,14),[3],[1]),
('5. 首页',[7],[14,15],[4],[1]),('6. 互联网（Internet）',[8],[16,17],[],[1]),
('7. 网站，网页，互联网三者的联系',[9,10],seq(18,21),[1],[1]),
('8. 浏览器/服务器交互过程',seq(11,19),[21,22],[5],[1,2]),
('9. HTTP 协议',[19],[23,24],[],[2]),('10. 静态网页和动态网页',seq(20,23),[25,26],[6],[2])],
's12':[(f'{i+1}. {title}' if i<4 else '发布（原文无编号）',[0,1] if i==0 else [i+1],[i],[7] if i==4 else [],[2]) for i,title in enumerate(['分析','设计','制作','测试','发布'])]+[('记忆口诀',[],[5],[],[])],
's13': [('1. 结构层',[0,1],[0,1],[],[2]),('2. 样式层',[2],[2,3],[],[2]),('3. 行为层',[3],seq(4,8),[8],[3])],
's-extra':[('〔手写〕网页制作开发工具',[0],[0],[],[3])],
's21':[('引言：HTML 全称',[0,1,2],[0,1],[1],[1]),('1、双标签（成对出现）',[3],[],[],[1]),('2. 单标签（自闭合标签）',[4],[2,3],[2],[1]),('HTML 属性（无编号段）',[5,6],seq(4,8),[],[1])],
's22':[('引言：四部分组成',[0,1],[0],[3],[1]),('最小完整示例',[],[1,2,3],[],[]),('2. 结构说明',[2,3,4,5],[4,5],[4],[2])],
's22b':[('1. 不能交叉嵌套',seq(0,6),[0],[],[3]),('2. 不区分大小写',[6],[1],[],[3]),('3. 属性值双引号',[7],[2],[],[3]),('4. 缩进书写',[8],[3],[],[3]),('5. 英文标点',[9],[4],[],[3]),('6. 属性值省略',[10,11],[5],[8],[3]),('7. 注释',[12],[6],[5],[3])],
's23':[('引言（整理独有：meta 定义元数据）',[],[0],[],[]),('1. 关键字',seq(0,5),[1],[],[4]),('2. 描述',[5,6],[2],[],[4]),('3. 作者',[7,8],[3],[],[5]),('4. 字符集',[9,10],[4],[],[5]),('5. 自动刷新与跳转',[11,12],[5],[6],[5])],
's24':[('1. 常用 body 属性说明',[0,1,2],[0,1],[7],[5])]
}

EXTENSIONS=[('wy/html/intro.html','s21','ext-html-intro'),('wy/html/attributes.html','s21','ext-html-attributes'),('wy/html/basic.html','s22','ext-html-basic'),('wy/html5/intro.html','s22','ext-html5-intro'),('wy/html/elements.html','s22b','ext-html-elements'),('wy/html/head.html','s23','ext-html-head')]

def extension(path,eid):
    doc=original(path,'722ce58'); article=tree(doc).one(lambda n:n.has('wy-article'))
    excluded=article.all(lambda n:n.has('wy-context-link') or n.has('callout') or n.has('wy-pager'))
    body=article.body
    for n in reversed(excluded): body=body[:n.start-article.inner]+body[n.end-article.inner:]
    # 改标题层级，不改其文字；保留 lead/代码/试一试原始片段。
    body=re.sub(r'<h1[^>]*>(.*?)</h1>',r'<h3>\1</h3>',body,flags=re.S)
    body=re.sub(r'<h2([^>]*)>(.*?)</h2>',r'<h4\1>\2</h4>',body,flags=re.S)
    body=body.replace('<pre>','<pre tabindex="0">')
    # 加现有控件名作无障碍名称。
    body=body.replace('class="tryit-code"','aria-label="试一试" class="tryit-code"')
    # 删除已搬走提示块留下的空白行；代码/textarea 的字符原样保留。
    protected = []
    def protect(match):
        protected.append(match.group(0))
        return f'WY_PROTECTED_{len(protected)-1}_END'
    body=re.sub(r'<(?:pre|textarea)\b[\s\S]*?</(?:pre|textarea)>',protect,body)
    body=re.sub(r'(?m)^[ \t]+$','',body)
    for i, raw in enumerate(protected): body=body.replace(f'WY_PROTECTED_{i}_END',raw)
    return body.strip()

def video_row(href,poster):
    return f'<a class="chapter-video" href="{href}"><img src="{poster}" loading="lazy" width="160" height="90" alt=""><strong>第2章 HTML5 文档结构</strong><span>6:51</span></a>'

def main():
    topics=json.loads((ROOT/'data/topics.json').read_text(encoding='utf-8'))['topics']
    ext_by={}; ext_fixture=[]
    for path,pid,eid in EXTENSIONS:
        body=extension(path,eid)
        if eid=='ext-html-elements':
            parsed=tree(body); lead=parsed.one(lambda n:n.has('lead')); title=parsed.one(lambda n:n.tag=='h3')
            ext_by.setdefault('s21',[]).append(f'<div id="ext-html-elements-lead">{title.raw}{lead.raw}</div>')
            # 其余嵌套规则及试一试放 2.2 注意事项。
            hero=parsed.one(lambda n:n.has('page-hero'))
            body=body[hero.end:]
        ext_by.setdefault(pid,[]).append(f'<div class="wy-ext-block" id="{eid}">{body}</div>')
        ext_fixture.append({'path':path,'target':pid,'id':eid,'html':body,'text':plain(body)})
    evidence={}
    for pid,groups in GROUPS.items():
        chapter=1 if pid in ['s11','s12','s13','s-extra'] else 2
        path=f'wy/ch{chapter}/{pid}.html'; doc=original(path); root=tree(doc)
        source=root.one(lambda n:n.attrs.get('id')=='lecture').one(lambda n:n.has('wy-paper')).children
        org=root.one(lambda n:n.has('wy-organized')).one(lambda n:n.has('wy-paper')).children
        # 按语义拆分列表整理，但其所有顶层 li 原片段仍各恰好搬运一次。
        supp=[]
        for n in org: supp.extend(n.children if n.tag=='ol' and pid in ('s12','s22b','s23') else [n])
        checks={int(n.one(lambda x:x.has('rn')).body):n for n in root.all(lambda n:n.tag=='li' and n.has('sh-card'))}
        if '--inspect' in __import__('sys').argv:
            print(pid,'SOURCE',[(i,plain(n.raw)[:40]) for i,n in enumerate(source)],'SUPPLEMENT',[(i,plain(n.raw)[:40]) for i,n in enumerate(supp)])
            continue
        # 确认表中每一个片段均只使用一次（缺失/重复都会中止）。
        for key,rows,part in [('source',source,1),('supplement',supp,2)]:
            used=[i for g in groups for i in g[part]]
            assert sorted(used)==list(range(len(rows))),(pid,key,used,len(rows))
        used=[v for g in groups for v in g[3]]
        assert sorted(used)==sorted(checks),(pid,used,checks.keys())
        photo_nodes=root.all(lambda n:n.tag=='button' and 'data-photo' in n.attrs)
        photos={int(re.search(r'(\d+)$',plain(n.body))[1]):n for n in photo_nodes}
        entries=[]; practice=[]; manifest=[]
        for index,(title,src,orgnums,nums,ps) in enumerate(groups,1):
            eid=f'{pid}-entry-{index}'
            btn=f'<button class="sh-btn" type="button" data-open-photo data-photos="{",".join(map(str,ps))}">打开原图</button>' if ps else ''
            s=take(source,src)
            sup=''.join(f'<ol start="{i+1}">{supp[i].raw}</ol>' if supp[i].tag=='li' else supp[i].raw for i in orgnums)
            selfcheck=''.join(checks[i].raw for i in nums)
            entries.append(f'<section class="wy-entry" id="{eid}"><div class="wy-entry-top"><h2>{escape(title)}</h2>{btn}</div>'+(f'<div class="wy-source wy-paper">{s}</div>' if s else '')+(f'<div class="wy-supplement wy-paper"><h3>整理</h3>{sup}</div>' if sup else '')+(f'<div class="wy-selfcheck"><h3>自测要点</h3><ol class="wy-practice">{selfcheck}</ol></div>' if selfcheck else '')+'</section>')
            for num in nums:
                check=checks[num]; spans=check.children
                # 习题只留文字相同的锚点入口；编号仅在自测正文出现一次。
                practice.append(f'<li><a href="#{eid}">{spans[-1].body}</a></li>')
            manifest.append({'id':eid,'title':title,'photos':ps,'checks':nums,'source':[n.raw for i,n in enumerate(source) if i in src],'supplement':[n.raw for i,n in enumerate(supp) if i in orgnums]})
        # s24 标题行上的 meta 手写注释按任务要求搬到 s23 最后一个条目。
        # 该批注原片段不改字，表体及小节标题仍原样保留。
        if pid=='s24':
            hand=source[0].one(lambda n:n.has('wy-hand')).raw
            entries[0]=entries[0].replace(hand,'')
        mind=root.one(lambda n:n.attrs.get('id')=='mindmap').raw
        mind=re.sub(r'<div id="mindmap"[^>]*>', '<div id="mindmap" class="wy-unit">', mind,count=1)
        ext='<section id="extension" class="wy-unit wy-extension"><h2>延伸</h2>'+''.join(ext_by[pid])+'</section>' if pid in ext_by else ''
        v=''
        if chapter==2:
            if pid=='s21':
                video=tree(original('wy/ch2/index.html')).one(lambda n:n.has('video-grid')).raw
                # 播放器沿用完整原片段，标题/描述也都保留。
                v='<section id="video" class="wy-unit"><h2>视频</h2><h3>第2章 HTML5 文档结构</h3>'+video+'</section>'
            else: v='<section id="video" class="wy-unit"><h2>视频</h2>'+video_row('s21.html#video','../posters/ch2.jpg')+'</section>'
        practice_html='<section id="practice" class="wy-unit"><h2>习题</h2><ul class="wy-practice-links">'+''.join(practice)+'</ul></section>' if practice else ''
        start=doc[:doc.index('<div class="wy-tabs"')]
        if ext:
            start=start.replace('</head>','<script src="../playground.js" defer></script>\n</head>')
        if pid=='s21':
            start=start.replace('</head>','<link rel="stylesheet" href="../../assets/css/lecture-player.css">\n<script src="../../assets/js/caption-position.js" defer></script>\n<script src="../../assets/js/lecture-player.js" defer></script>\n</head>')
        dialog=root.one(lambda n:n.has('wy-photo')).raw
        dialog=dialog.replace('aria-label="讲义原图"','aria-labelledby="wy-photo-title"').replace('<strong>讲义原图</strong>',f'<strong id="wy-photo-title">第{chapter}章 · 原图 {next(iter(photos))}</strong>')
        dialog=dialog.replace('alt="讲义原图"',f'alt="第{chapter}章 · 原图 {next(iter(photos))}"')
        for number,n in photos.items():
            dialog=dialog.replace(n.raw,n.raw.replace('data-photo=',f'data-photo-number="{number}" data-photo=').replace(n.body,f'第{chapter}章 · 原图 {number}'))
        save(path,start+'\n'.join(entries)+ext+mind+v+practice_html+'</article>\n</div></div></main>\n'+dialog+'\n</body></html>\n')
        evidence[pid]=manifest
    if '--inspect' in __import__('sys').argv: return
    # 从原 s24 挪批注到 meta 自动刷新条目。
    old=tree(original('wy/ch2/s24.html')).one(lambda n:n.has('wy-source-title')).one(lambda n:n.has('wy-hand')).raw
    path='wy/ch2/s23.html'; doc=(ROOT/path).read_text(encoding='utf-8')
    marker='<section class="wy-entry" id="s23-entry-6">'; p=doc.index('<div class="wy-source wy-paper">',doc.index(marker))+len('<div class="wy-source wy-paper">')
    save(path,doc[:p]+old+doc[p:])
    # 原课页相对重定向，保留目标锚点，搜索忽略整页。
    for path,pid,eid in EXTENSIONS:
        target=f'../ch2/{pid}.html#{eid}'
        title=next(t['title'] for t in topics if t['legacy_url']==f'wy/ch2/{pid}.html')
        save(path,f'<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url={target}"><link rel="canonical" href="{target}"><meta name="robots" content="noindex"><title>{escape(title)}</title></head><body data-pagefind-ignore><a href="{target}">{escape(title)}</a><script>location.replace({json.dumps(target)});</script></body></html>\n')
    # 章首页沿用现有外壳，仅显示章节块和章首视频入口。
    for chapter in [1,2]:
        path=f'wy/ch{chapter}/index.html'; doc=original(path)
        start=doc[:doc.index('<header class="sh-card wy-chapter-head"')]
        start=re.sub(r'<(?:script[^>]+(?:caption-position|lecture-player)[^>]*></script>|link[^>]+lecture-player[^>]*>)\s*','',start)
        items=sorted([t for t in topics if t['chapter_id']==f'web.ch{chapter}' and t['id']!='web.html5_structure'],key=lambda t:t['order'])
        heading=f'第{chapter}章 '+('网页基本概念' if chapter==1 else 'HTML5 文档结构')
        rows=[]
        for t in items:
            parts=t['title'].split(' ',1); no=parts[0] if re.match(r'\d',parts[0]) else '补充'
            label=parts[1] if re.match(r'\d',parts[0]) else t['title']
            rows.append(f'<li><a class="wy-chapter-row" href="{Path(t["legacy_url"]).name}"><span class="wy-chapter-dot" aria-hidden="true"></span><span class="wy-point-no">{escape(no)}</span><span class="wy-chapter-label">{escape(label)}</span><span aria-hidden="true">→</span></a></li>')
        head=f'<header class="sh-card wy-chapter-head"><h1>{heading}</h1><p>{len(items)} 个知识点</p></header>'
        vr=video_row('s21.html#video','../posters/ch2.jpg') if chapter==2 else ''
        save(path,start+head+'<section class="sh-card wy-chapter-list">'+vr+'<ol>'+''.join(rows)+'</ol></section></div></div></main></body></html>\n')
    save('tests/fixtures/wy-entry-manifest.json',json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
    save('tests/fixtures/wy-extension-text.json',json.dumps({'baseline':'722ce58','blocks':ext_fixture},ensure_ascii=False,indent=2)+'\n')
    print('已生成 9 个知识点页、6 个跳转页及原片段证据。')

if __name__=='__main__': main()
