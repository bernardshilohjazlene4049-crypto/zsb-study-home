"""Integration checks for the C language batch and its coexistence with videos-v1."""
from collections import Counter
from html import escape
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
V1_MANIFEST = BATCH.parent / "integration_manifest.json"


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "tools" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT).decode("utf-8")


integration = load("integrate-c-v2-videos")
v1 = load("integrate-videos")
preview = load("preview-videos")
doc = json.loads(MANIFEST.read_text(encoding="utf-8"))
rows = doc["videos"]
base = doc["main_sha"]
page = "c/notes.html"
subprocess.run([sys.executable, str(ROOT / "tools/integrate-c-v2-videos.py"),
                str(MANIFEST), str(BATCH / "posters.zip"), "--check"], check=True)

html = (ROOT / page).read_bytes().decode("utf-8")
original = git("show", f"{base}:{page}")
blocks = integration.BLOCK.findall(html)
anchors = Counter(row["anchor"] for row in rows)
release_base = escape(f'https://github.com/{doc["repository"]}/releases/download/videos-c-v2/')
assert doc["release"]["draft"] is True
assert len(blocks) == len(anchors)
assert len(blocks) == html.count("<!-- videos-c-v2:start -->") == html.count("<!-- videos-c-v2:end -->")
counts = Counter()
block_anchors = Counter()
for block in blocks:
    match = re.search(r'<details class="v1-videos v1-c2" id="videos-c-v2-(point-\d+)"', block)
    assert match, block
    anchor = match[1]
    block_anchors[anchor] += 1
    assert 'data-release="draft"' in block
    assert f'data-download-base="{release_base}"' in block
    assert f'<summary>零基础讲解视频（{anchors[anchor]}） · 待发布</summary>' in block
    assert '<p class="v1-notice">视频待发布，发布后可在此播放。</p>' in block
    assert not re.search(r'<(?:video|source|iframe)\b|\bautoplay\b', block, re.I)
    assert not re.search(r'''\bhref\s*=\s*["']?(?:https?:)?//''', block, re.I)
    assert not re.search(r'<img[^>]*\bsrc\s*=', block, re.I)
    ids = re.findall(r'\bdata-video-id="([^"]+)"', block)
    assert ids == [row["card_id"] for row in rows if row["anchor"] == anchor], anchor
    counts.update(ids)
assert block_anchors == Counter({anchor: 1 for anchor in anchors})
assert counts == Counter(row["card_id"] for row in rows)
assert sum(counts.values()) == doc["video_count"]

# Both marker types are independently removable, and the existing blocks stay byte-for-byte intact.
assert v1.BLOCK.sub("", integration.BLOCK.sub("", html)) == v1.BLOCK.sub("", original)
assert v1.BLOCK.findall(html) == v1.BLOCK.findall(original)
assert integration.BLOCK.sub("", html) == original
locations = integration.Locations(html)
assert set(anchors) == {anchor for anchor in locations.sections if re.fullmatch(r"point-\d+", anchor)}
for anchor in anchors:
    offsets = locations.sections[anchor]
    assert len(offsets) == 1, anchor
    old = v1.BLOCK.match(html, offsets[0])
    assert old is not None, anchor
    new = integration.BLOCK.match(html, old.end())
    assert new is not None and f'id="videos-c-v2-{anchor}"' in new[0], anchor
    # The new block must be before the card's header, not in the next section.
    assert re.match(r'\s*<header class="topic-header">', html[new.end():]), anchor

changed = set(git("diff", "--name-only", "--no-renames", "-z", base).split("\0"))
changed.update(git("ls-files", "--others", "--exclude-standard", "-z").split("\0"))
for path in changed - {""}:
    suffix = Path(path).suffix.lower()
    assert suffix not in {".mp4", ".srt", ".vtt"}, path
    if suffix in {".webp", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".avif", ".ico", ".bmp", ".tif", ".tiff"}:
        assert path.startswith("assets/videos-c-v2/posters/"), path
print("C v2 draft markup, placement, original content and changed files passed")

# Published rendering and escaping can be tested without changing the draft manifest or files.
markup = integration.render([{**rows[0], "title": '<x>&"\''}], release_base, False)
assert 'data-release="published"' in markup
assert "待发布" not in markup and "v1-notice" not in markup
assert "&lt;x&gt;&amp;&quot;&#x27;" in markup and "<x>" not in markup

mapping = preview.merge_media_paths([V1_MANIFEST, MANIFEST])
old_mapping = preview.media_paths(V1_MANIFEST)
new_mapping = preview.media_paths(MANIFEST)
assert mapping == {**old_mapping, **new_mapping}
assert len(mapping) == len(old_mapping) + len(new_mapping)
try:
    preview.merge_media_paths([MANIFEST, MANIFEST])
except ValueError:
    pass
else:
    raise AssertionError("Duplicate preview assets were accepted")


class MemoryRequest:
    def __init__(self, data):
        self.reader = BytesIO(data)
        self.writer = BytesIO()

    def makefile(self, mode, *_):
        return self.reader if mode == "rb" else self.writer

    def sendall(self, data):
        self.writer.write(data)


asset = rows[0]["release_asset_name"]
video = mapping[asset]
assert video == new_mapping[asset] and asset.startswith("c2.")
assert video.stat().st_size == rows[0]["size_bytes"]
stream = MemoryRequest(
    f"GET /{preview.MEDIA}/{asset} HTTP/1.1\r\n"
    "Host: 127.0.0.1:8765\r\nRange: bytes=0-31\r\n\r\n".encode()
)
server = SimpleNamespace(server_port=8765, media=mapping)
preview.PreviewHandler(stream, ("127.0.0.1", 12345), server)
head, body = stream.writer.getvalue().split(b"\r\n\r\n", 1)
status, *header_lines = head.decode().split("\r\n")
headers = dict(line.split(": ", 1) for line in header_lines)
assert int(status.split()[1]) == 206
assert headers["Content-Type"] == "video/mp4"
assert headers["Content-Range"] == f"bytes 0-31/{video.stat().st_size}"
assert headers["Content-Length"] == "32" and headers["Accept-Ranges"] == "bytes"
with video.open("rb") as source:
    assert body == source.read(32) and len(body) == 32
print("Merged preview mappings, duplicate rejection and C v2 Range request passed")
