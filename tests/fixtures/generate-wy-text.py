"""从指定基线和只读照片转写生成文字证据；不读取新页面。
运行：python tests/fixtures/generate-wy-text.py --notes <照片转写目录>
"""
import argparse
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess

BASE = '511d360f0514ba8f1b721643837b663dd6cf7078'
ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
IDS = ['s11', 's12', 's13', 's-extra', 's21', 's22', 's22b', 's23', 's24']
PHOTOS = ['01M6NNTT6F0QBEKT0V5WBJHHEM', '01M6NNTW88HTX0V24269WR4D6T', '01M6NNV0RP1JNNW98MZ1VKE1NW', '01M6NNXP4W98VHZ3243W11M55Z', '01M6NNXVKR97GSZJ4XDP4AVTX0', '01M6NNXYHM4CKVKAXYFBAB9367', '01M6NNY28N880ZDJ4CV661VSQC', '01M6NP1DJPVH3E0P1HHABH7S8E']

def norm(s):
    return re.sub(r'\s+', ' ', s).strip()

class Blocks(HTMLParser):
    """收集最小文字块，也保留有嵌套块的 li 直接文字，避免漏掉代码后的说明。"""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.blocks = []
    def handle_starttag(self, tag, attrs):
        if tag in {'br', 'img', 'meta', 'link', 'source', 'track', 'input', 'hr'}:
            return
        self.stack.append({'tag': tag, 'attrs': dict(attrs), 'text': '', 'child': False})
    def handle_data(self, data):
        for node in self.stack:
            node['text'] += data
    def handle_endtag(self, tag):
        if not any(n['tag'] == tag for n in self.stack):
            return
        while self.stack:
            node = self.stack.pop()
            target = node['tag'] in {'p', 'li', 'td', 'th', 'h2', 'h3', 'pre', 'span'}
            if target and not node['child'] and norm(node['text']):
                self.blocks.append(norm(node['text']))
                for parent in self.stack:
                    parent['child'] = True
            elif node['tag'] == 'li' and norm(node['text']):
                self.blocks.append(norm(node['text']))
            if node['tag'] == tag:
                break

def legacy_source():
    return subprocess.check_output(['git', 'show', f'{BASE}:wy/index.html'], cwd=ROOT).decode('utf-8')

def split_transcripts(notes):
    raw = [(notes / (p + '.md')).read_text(encoding='utf-8') for p in PHOTOS]
    # 范围由 mapping.md 指定；明确截断转写者的跨页说明。
    def cut(s, start, end=None):
        s = s[s.index(start):]
        return s[:s.index(end)] if end else s
    return {
        's11': cut(raw[0], '## 1.1', '（本页到此结束') + '\n' + cut(raw[1], '(4)浏览器', '## 1.2'),
        's12': cut(raw[1], '## 1.2', '## 1.3'),
        's13': cut(raw[1], '## 1.3', '（本页到此结束') + '\n' + cut(raw[2], '3. 行为层', '〔手写（页面左侧'),
        's-extra': '〔手写：网页制作开发工具\n记事本、HBuilder、vscode〕',
        's21': cut(raw[3], '## 2.1', '## 2.2'),
        's22': cut(raw[3], '## 2.2', '（本页到此结束') + '\n' + cut(raw[4], '2. 结构说明：'),
        's22b': cut(raw[5], '## 2.2'),
        's23': cut(raw[6], '## 2.3', '页码：8') + '\n' + cut(raw[7], '3. 设置网页作者', '## 2.4'),
        's24': cut(raw[7], '## 2.4')
    }

HAND = re.compile(r'〔手写(?:（[^〕]*?）)?：([\s\S]*?)〕')

def hand_value(value):
    if value == '在“一”上方写“多”，“多”的一笔斜穿“一”':
        return '多'
    return value.strip()

def transcript_blocks(source):
    # 与网页渲染分开，直接由源转写提取期望正文/批注。
    result = [norm(hand_value(m[1]).replace('`', '')) for m in HAND.finditer(source)
              if '红色大括号把下面 6 条括在一起' not in m[1]]
    source = HAND.sub('', source)
    for line in source.splitlines():
        line = line.strip()
        if not line or line.startswith(('（画线：', '〔手写标记：', '```', '|---')):
            continue
        if '红色大括号把下面 6 条括在一起' in line:
            continue
        if line.startswith('〔截图：'):
            result.extend(['myweb', '127.0.0.1:8848/网页教材示...', '中国，你好！'])
            continue
        line = re.sub(r'^#{1,6}\s+', '', line)
        line = re.sub(r'^- ', '', line)
        line = line.replace('`', '')
        if line.startswith('URL 组成：'):
            line = line.replace('*', '')
        if line.startswith('|'):
            result.extend(norm(c) for c in line.strip('|').split('|') if norm(c))
        else:
            result.append(norm(line))
    return result

def main():
    args = argparse.ArgumentParser()
    args.add_argument('--notes', type=Path, required=True)
    notes = args.parse_args().notes
    old = legacy_source()
    sections = re.findall(r'<article class="panel md">([\s\S]*?)</article>', old)
    quiz = re.search(r'<section class="block" id="s-quiz">([\s\S]*?)</section>', old)[1]
    video = re.search(r'<div class="card-grid card-grid--2 video-grid">[\s\S]*?</article></div>', old)[0]
    parser = Blocks()
    parser.feed('\n'.join(sections + [quiz, video]))
    legacy = {'baseline': BASE, 'blocks': list(dict.fromkeys(parser.blocks))}
    transcript = {k: transcript_blocks(v) for k, v in split_transcripts(notes).items()}
    mindmap = {}
    current = None
    for line in (notes / 'mindmap.md').read_text(encoding='utf-8').splitlines():
        match = re.match(r'^( +)- (.+)$', line)
        if not match:
            continue
        if len(match[1]) == 2:
            current = IDS[len(mindmap)]
            mindmap[current] = []
        mindmap[current].append(match[2].replace('`', ''))
    for name, data in [('wy-ch12-legacy-text.json', legacy), ('wy-ch12-transcript-text.json', transcript), ('wy-ch12-mindmap-text.json', mindmap)]:
        (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('legacy:', len(legacy['blocks']), 'transcript:', sum(map(len, transcript.values())))

if __name__ == '__main__':
    main()
