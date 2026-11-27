"""Generate or check the videos-v1 blocks from the batch manifest and poster archive."""
import argparse
from collections import defaultdict
from html import escape
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
BLOCK = re.compile(r"\n<!-- videos-v1:start -->\n.*?<!-- videos-v1:end -->\n", re.S)
LAB_HEAD_TAIL = re.compile(
    r'(?m)^(?:[ \t]*(?:<link rel="stylesheet" href="[^"]*lab-viz\.css">'
    r'|<script src="[^"]*(?:calc-net|lab-viz)\.js" defer></script>)\s*)+\Z'
)


class Locations(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.offsets = [0, *(m.end() for m in re.finditer("\n", source))]
        self.ids = defaultdict(list)
        self.headings = defaultdict(list)
        self.heading = None
        self.feed(source)

    def position(self):
        line, column = self.getpos()
        return self.offsets[line - 1] + column

    def handle_starttag(self, tag, attrs):
        identifier = dict(attrs).get("id")
        if identifier:
            self.ids[identifier].append(self.position() + len(self.get_starttag_text()))
        if tag in ("h1", "h2"):
            self.heading = (tag, identifier, [])

    def handle_data(self, data):
        if self.heading:
            self.heading[2].append(data)

    def handle_endtag(self, tag):
        if self.heading and self.heading[0] == tag:
            _, identifier, parts = self.heading
            end = self.position() + len(tag) + 3
            if tag == "h1":
                self.headings[" ".join("".join(parts).split())].append(end)
            if identifier:
                self.ids[identifier][-1] = end
            self.heading = None


def block(content):
    return f"\n<!-- videos-v1:start -->\n{content}\n<!-- videos-v1:end -->\n"


def render(rows, prefix, draft):
    anchor = rows[0]["anchor"]
    fragment = "videos-v1" + (f"-{anchor}" if anchor else "")
    title = "分段讲解视频" if len(rows) > 1 else "知识点讲解视频"
    state = "draft" if draft else "published"
    badge = " · 待发布" if draft else ""
    items = []
    for row in rows:
        asset = row["release_asset_name"]
        poster = prefix + "assets/videos-v1/posters/" + Path(row["poster_path"]).name
        minutes, seconds = divmod(round(row["duration_s"]), 60)
        items.append(
            f'<li data-video-id="{escape(row["card_id"])}" data-asset="{escape(asset)}" '
            f'data-duration="{row["duration_s"]}" '
            f'data-bytes="{row["size_bytes"]}" data-sha256="{escape(row["sha256"])}">'
            f'<img data-cover="{escape(poster)}" alt="" width="640" height="360" loading="lazy" decoding="async">'
            f'<div><span class="v1-title">{escape(row["title"])}</span> '
            f'<span class="v1-time">{minutes}:{seconds:02d}</span></div></li>'
        )
    notice = '<p class="v1-notice">视频待发布，发布后可在此播放。</p>' if draft else ""
    return block(
        f'<details class="v1-videos" id="{escape(fragment)}" data-release="{state}" data-pagefind-ignore>'
        f'<summary>{title}（{len(rows)}）{badge}</summary>\n{notice}\n<ul>\n'
        + "\n".join(items) + "\n</ul>\n</details>"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("posters", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    rows = manifest["videos"]
    assert len(rows) == manifest["video_count"] == 227
    for field in ("card_id", "release_asset_name", "sha256"):
        assert len({row[field] for row in rows}) == len(rows), field
    assert manifest["release"]["tag"] == "videos-v1"
    assert re.fullmatch(r"[\w-]+/[\w-]+", manifest["repository"])
    grouped = defaultdict(lambda: defaultdict(list))
    files = {}
    with ZipFile(args.posters) as zip_file:
        for row in rows:
            asset = row["release_asset_name"]
            assert re.fullmatch(r"[\w.-]+\.mp4", asset, re.ASCII), asset
            assert re.fullmatch(r"[a-f0-9]{64}", row["sha256"]), asset
            assert row["size_bytes"] > 0 and row["duration_s"] > 0, asset
            assert row["release_is_draft"] == manifest["release"]["draft"], asset
            page = Path(row["page_path"])
            assert not page.is_absolute() and ".." not in page.parts and page.suffix == ".html", page
            poster = Path(row["poster_path"]).name
            assert poster == asset.removesuffix(".mp4") + ".webp", asset
            image = zip_file.read(poster)
            assert len(image) == row["poster_size_bytes"] and image[8:12] == b"WEBP", poster
            files[ROOT / "assets/videos-v1/posters" / poster] = image
            grouped[page][row["anchor"]].append(row)

    for page, groups in grouped.items():
        path = ROOT / page
        source = BLOCK.sub("", path.read_bytes().decode("utf-8"))
        locations = Locations(source)
        prefix = os.path.relpath(ROOT, path.parent) + "/"
        edits = []
        for anchor, group in groups.items():
            locators = [row["locator"] for row in group]
            if anchor:
                assert all(loc["kind"] == "id" and loc["value"] == anchor for loc in locators), (page, anchor)
                offsets = locations.ids[anchor]
                if page.as_posix() == "c/index.html":
                    assert len(offsets) == 1 and source.startswith("</div>", offsets[0]), (page, anchor)
                    offsets = [offsets[0] + len("</div>")]
                # Put the segment list after the chapter heading and before the older overview player.
                if page.as_posix() == "yy/yy5.html":
                    assert len(offsets) == 1, (page, anchor)
                    offsets = locations.ids[f'video-{anchor.removeprefix("topic-")}']
            else:
                assert all(loc == locators[0] and loc["kind"] == "page-heading" for loc in locators), page
                offsets = locations.headings[locators[0]["heading_text"]]
            assert len(offsets) == 1, (page, anchor)
            edits.append((offsets[0], render(group, prefix, manifest["release"]["draft"])))
        assert source.count("</head>") == 1, page
        head_end = source.index("</head>")
        # Keep the references managed by mount_lab.py at the end of the head.
        lab_tail = LAB_HEAD_TAIL.search(source, 0, head_end)
        release_base = f'https://github.com/{manifest["repository"]}/releases/download/{manifest["release"]["tag"]}/'
        edits.append((lab_tail.start() if lab_tail else head_end, block(
            f'<link rel="stylesheet" href="{prefix}assets/css/videos-v1.css">\n'
            f'<script defer src="{prefix}assets/js/videos-v1.js" data-download-base="{escape(release_base)}"></script>'
        )))
        for offset, addition in sorted(edits, reverse=True):
            source = source[:offset] + addition + source[offset:]
        files[path] = source.encode("utf-8")

    for path, content in files.items():
        if args.check:
            assert path.read_bytes() == content, path
        elif not path.exists() or path.read_bytes() != content:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
    print(f"{'Checked' if args.check else 'Generated'} {len(rows)} videos across {len(grouped)} pages")


if __name__ == "__main__":
    main()
