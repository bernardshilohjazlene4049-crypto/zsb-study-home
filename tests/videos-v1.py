"""Integration checks against the batch inputs and the checked-out Git base."""
from collections import Counter
from io import BytesIO
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
BATCH = Path(sys.argv[1])
MANIFEST = BATCH / "integration_manifest.json"


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "tools" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


integration = load("integrate-videos")
preview = load("preview-videos")
doc = json.loads(MANIFEST.read_text())
rows = doc["videos"]
base = doc["main_sha"]
subprocess.run([sys.executable, str(ROOT / "tools/integrate-videos.py"),
                str(MANIFEST), str(BATCH / "posters.zip"), "--check", "--markup-published"], check=True)


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT).decode()


pages = git("ls-files", "--", "*.html").splitlines()
counts = Counter()
video_detail_count = 0
legacy_card = (ROOT / "tests/fixtures/math-domain-legacy-entry.txt").read_text().strip()
WL_PAGE_STUDY_KEYS = {
    "wl/ch1/s11.html": "wl-s11",
    "wl/ch1/s12.html": "wl-s12",
    "wl/ch1/s13.html": "wl-s13",
    "wl/ch1/s14.html": "wl-s14",
    "wl/ch1/s15.html": "wl-s15",
    "wl/ch1/s16.html": "wl-s16",
    "wl/ch2/s21.html": "wl-s21",
    "wl/ch2/s22.html": "wl-s22",
    "wl/ch2/s23.html": "wl-s23",
    "wl/ch2/s24.html": "wl-s24",
    "wl/ch2/s25.html": "wl-s25",
    "wl/ch2/s26.html": "wl-s26",
    "wl/ch2/s27.html": "wl-s27",
    "wl/ch3/s31.html": "wl-s31",
    "wl/ch3/s32.html": "wl-s32",
    "wl/ch3/s33.html": "wl-s33",
    "wl/ch3/s34.html": "wl-s34",
    "wl/ch3/s35.html": "wl-s35",
    "wl/ch3/s36.html": "wl-s36",
    "wl/ch3/s37.html": "wl-s37",
    "wl/ch3/s38.html": "wl-s38",
    "wl/ch3/s39.html": "wl-s39",
    "wl/ch4/s41.html": "wl-s41",
    "wl/ch4/s42.html": "wl-s42",
    "wl/ch4/s43.html": "wl-s43",
    "wl/ch5/s51.html": "wl-s51",
    "wl/ch5/s52.html": "wl-s52",
    "wl/ch5/s53.html": "wl-s53",
    "wl/ch6/s61.html": "wl-s61",
}
WY_PAGE_STUDY_KEYS = {
    "wy/ch1/s11.html": "wy-s11",
    "wy/ch1/s12.html": "wy-s12",
    "wy/ch1/s13.html": "wy-s13",
    "wy/ch1/s-extra.html": "wy-s-extra",
}
for page in pages:
    html = (ROOT / page).read_bytes().decode("utf-8")
    blocks = integration.BLOCK.findall(html)
    if not blocks:
        continue
    release_base = f'https://github.com/{doc["repository"]}/releases/download/videos-v1/'
    assert html.count(f'data-download-base="{release_base}"') == 1, page
    for block in blocks:
        assert not re.search(r'<(?:video|source|iframe)\b|\bautoplay\b|\bhref="https?://', block)
        assert not re.search(r"<img[^>]*\bsrc=", block)
        details = re.findall(r'<details class="v1-videos"(?=[\s>]).*?</details>', block, re.S)
        for detail in details:
            video_detail_count += 1
            assert 'data-release="published"' in detail
            assert " · 待发布" not in detail
            assert '<p class="v1-notice">' not in detail
        counts.update(re.findall(r'\bdata-video-id="([^"]+)"', block))
    expected = git("show", f"{base}:{page}")
    if page == "gs/gs1.html":
        link = '<a class="sh-btn" href="#videos-v1-gs1-1-2">定义域讲解视频</a>'
        clean = integration.BLOCK.sub("", html)
        assert expected.count(legacy_card) == clean.count(legacy_card) == 1
        assert clean.count(link) == 1
        point_start = clean.index('<section class="topic-section" id="point-1"')
        header_end = clean.index("</header>", point_start) + len("</header>")
        assert clean[header_end:].startswith(legacy_card + link + "<!--gs-pt:1-->")
        expected = expected.replace(legacy_card, legacy_card + link, 1)
        expected = expected.replace("</body>", '<script src="../assets/js/page-study.js" data-page="gs1" data-subject="math"></script>\n</body>', 1)
    if page == "c/notes.html":
        expected = expected.replace("</body>", '<script src="../assets/js/page-study.js" data-page="c-notes" data-subject="c_language"></script>\n</body>', 1)
        expected = expected.replace("</body>", '<script type="module" src="../assets/js/features/c-mindmaps.js" data-page="c-notes"></script>\n</body>', 1)
    if page == "jsj/jsj1.html":
        expected = expected.replace("</body>", '<script src="../assets/js/page-study.js" data-page="jsj1" data-subject="computer_basics"></script>\n</body>', 1)
    if page == "jsj/ppt5.html":
        expected = expected.replace("</body>", '<script src="../assets/js/page-study.js" data-page="ppt5" data-subject="computer_basics"></script>\n</body>', 1)
    wl_page_key = WL_PAGE_STUDY_KEYS.get(page)
    if wl_page_key:
        expected = expected.replace("</body>", f'<script src="../../assets/js/page-study.js" data-page="{wl_page_key}" data-subject="network"></script>\n</body>', 1)
    network_mindmap_key = WL_PAGE_STUDY_KEYS.get(page)
    if network_mindmap_key:
        expected = expected.replace("</body>", f'<script type="module" src="../../assets/js/features/network-mindmaps.js" data-page="{network_mindmap_key}"></script>\n</body>', 1)
    wy_page_key = WY_PAGE_STUDY_KEYS.get(page)
    if wy_page_key:
        expected = expected.replace("</body>", f'<script src="../../assets/js/page-study.js" data-page="{wy_page_key}" data-subject="web_design"></script>\n</body>', 1)
    assert integration.BLOCK.sub("", html) == expected, page

assert video_detail_count == 182
assert counts == Counter(row["card_id"] for row in rows)
for path in git("diff", "--name-only", "--no-renames", "-z", base).split("\0"):
    suffix = Path(path).suffix.lower()
    assert suffix not in {".mp4", ".vtt", ".srt"}, path
    if suffix in {".webp", ".jpg"}:
        assert path.startswith("assets/videos-v1/posters/"), path
cards = json.loads((ROOT / "data/topic-cards.json").read_text())
original = json.loads(git("show", f"{base}:data/topic-cards.json"))
domain = original["cards"]["math.domain"]
domain["video_section"] = "gs/gs1.html#videos-v1-gs1-1-2"
domain["video_clips"] = [
    {
        "title": "考点精讲：定义域",
        "url": "gs/gs1/kdvideos/kd1-domain.mp4",
        "poster": "gs/gs1/kdposters/kd1.jpg",
        "vtt": "gs/gs1/kdvideos/kd1-domain.vtt",
        "start_sec": 0,
        "end_sec": 177,
        "label": "00:00–02:57",
    },
    {
        "title": "第一步",
        "url": "gs/gs1/kdvideos/kd1-domain.mp4",
        "poster": "gs/gs1/kdposters/kd1.jpg",
        "vtt": "gs/gs1/kdvideos/kd1-domain.vtt",
        "start_sec": 71,
        "end_sec": 177,
        "label": "01:11–02:57",
    },
    {
        "title": "第1集 00:31–01:56 定义域判断与例题",
        "url": "gs/videos/1.mp4",
        "poster": "gs/posters/1.jpg",
        "vtt": "gs/videos/1.vtt",
        "start_sec": 31,
        "end_sec": 116,
        "label": "00:31–01:56",
    },
]
assert cards["cards"]["math.domain"]["video_section"] == domain["video_section"]
assert cards["cards"]["math.domain"]["video_clips"] == domain["video_clips"]
guide = original["cards"]["english.yy5.guide"]
guide["video_sections"] = [
    {"title": title, "url": f"yy/yy5.html#videos-v1-topic-{topic}"}
    for topic, title in enumerate(("名词性从句", "状语从句", "主谓一致", "特殊句型"), 5)
]
original["cards"]["english.noun.basics"]["url"] = "yy/yy5.html#topic-5"
original["cards"]["english.adverbial.basics"]["url"] = "yy/yy5.html#topic-6"
assert original == cards
english = [row for row in rows if row["page_path"] == "yy/yy5.html"]
assert Counter(row["anchor"] for row in english) == {"topic-5": 7, "topic-6": 9, "topic-7": 5, "topic-8": 7}

markup = integration.render([{**rows[0], "title": '<x>&"\''}], "", True)
assert "&lt;x&gt;&amp;&quot;&#x27;" in markup and "<x>" not in markup
assert 'data-release="draft"' in markup and " · 待发布" in markup
published_markup = integration.render([{**rows[0], "title": '<x>&"\''}], "", False)
assert 'data-release="published"' in published_markup
assert " · 待发布" not in published_markup and 'class="v1-notice"' not in published_markup
print("Mapping, escaping, published page markup, draft Release state and legacy content passed")

mapping = preview.media_paths(MANIFEST)
assert len(mapping) == 227
for row in rows:
    assert mapping[row["release_asset_name"]].stat().st_size == row["size_bytes"]
class MemoryRequest:
    def __init__(self, data):
        self.reader = BytesIO(data)
        self.writer = BytesIO()

    def makefile(self, mode, *_):
        return self.reader if mode == "rb" else self.writer

    def sendall(self, data):
        self.writer.write(data)


def request(path, headers=None, method="GET"):
    fields = {"Host": "127.0.0.1:8765", **(headers or {})}
    header_lines = "".join(f"{key}: {value}\r\n" for key, value in fields.items())
    stream = MemoryRequest(f"{method} {path} HTTP/1.1\r\n{header_lines}\r\n".encode())
    server = SimpleNamespace(server_port=8765, media=mapping)
    preview.PreviewHandler(stream, ("127.0.0.1", 12345), server)
    head, body = stream.writer.getvalue().split(b"\r\n\r\n", 1)
    status, *response_headers = head.decode().split("\r\n")
    return int(status.split()[1]), dict(line.split(": ", 1) for line in response_headers), body


math = mapping["math.domain.mp4"]
path = f"/{preview.MEDIA}/math.domain.mp4"
status, headers, body = request(path, {"Range": "bytes=32-63"})
with math.open("rb") as video:
    video.seek(32)
    assert body == video.read(32)
assert status == 206 and headers["Content-Type"] == "video/mp4"
assert headers["Content-Range"] == f"bytes 32-63/{math.stat().st_size}"
assert headers["Accept-Ranges"] == "bytes"
assert request(path, {"Range": "bytes=-64"}, "HEAD")[1]["Content-Length"] == "64"
assert request(path, {"Range": "bytes=10-"}, "HEAD")[1]["Content-Length"] == str(math.stat().st_size - 10)
assert request(path, {"Range": "bytes=9999999999-"})[0] == 416
assert request(path, {"Range": "bytes=0-0,2-2"})[0] == 416
assert request(path, {"Host": "external.example"})[0] == 403
assert request(path, {"Sec-Fetch-Site": "cross-site"})[0] == 403
assert request(path, method="PUT")[0] == 501
assert request(f"/{preview.MEDIA}/unknown.mp4")[0] == 404
assert request(f"/{preview.MEDIA}/%2e%2e/style.css")[0] == 404
assert request("/%2egit/config")[0] == 404
assert request("/tools/preview-videos.py")[0] == 404
assert request("/gs/gs1.html?videos-preview=1", method="HEAD")[0] == 200
print("In-memory HTTP handler, Range and allowlist checks passed")
