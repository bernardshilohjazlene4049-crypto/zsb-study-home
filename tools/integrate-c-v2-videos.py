"""Generate or check videos-c-v2 blocks and posters for c/notes.html."""
import argparse
from collections import defaultdict
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
PAGE = "c/notes.html"
BLOCK = re.compile(r"\n<!-- videos-c-v2:start -->\n.*?<!-- videos-c-v2:end -->\n", re.S)
V1_BLOCK = re.compile(r"\n<!-- videos-v1:start -->\n.*?<!-- videos-v1:end -->\n", re.S)


class Locations(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.offsets = [0, *(m.end() for m in re.finditer("\n", source))]
        self.sections = defaultdict(list)
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        identifier = dict(attrs).get("id")
        if tag == "section" and identifier:
            line, column = self.getpos()
            end = self.offsets[line - 1] + column + len(self.get_starttag_text())
            self.sections[identifier].append(end)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def render(rows, release_base, draft):
    anchor = rows[0]["anchor"]
    state = "draft" if draft else "published"
    badge = " · 待发布" if draft else ""
    notice = '<p class="v1-notice">视频待发布，发布后可在此播放。</p>\n' if draft else ""
    items = []
    for row in rows:
        poster = f'../assets/videos-c-v2/posters/{row["card_id"]}.webp'
        minutes, seconds = divmod(round(row["duration_s"]), 60)
        items.append(
            f'<li data-video-id="{escape(row["card_id"])}" data-asset="{escape(row["release_asset_name"])}" '
            f'data-duration="{escape(str(row["duration_s"]))}" '
            f'data-bytes="{escape(str(row["size_bytes"]))}" data-sha256="{escape(row["sha256"])}">'
            f'<img data-cover="{escape(poster)}" alt="" width="640" height="360" loading="lazy" decoding="async">'
            f'<div><span class="v1-title">{escape(row["title"])}</span> '
            f'<span class="v1-time">{minutes}:{seconds:02d}</span></div></li>'
        )
    return (
        '\n<!-- videos-c-v2:start -->\n'
        f'<details class="v1-videos v1-c2" id="videos-c-v2-{escape(anchor)}" data-release="{state}" '
        f'data-download-base="{escape(release_base)}" data-pagefind-ignore>'
        f'<summary>零基础讲解视频（{len(rows)}）{badge}</summary>\n{notice}<ul>\n'
        + "\n".join(items) + "\n</ul>\n</details>\n<!-- videos-c-v2:end -->\n"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("posters", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    rows = manifest["videos"]
    require(manifest["video_count"] == len(rows), "video_count mismatch")
    for field in ("card_id", "release_asset_name", "sha256"):
        require(len({row[field] for row in rows}) == len(rows), f"Duplicate {field}")
    require(manifest["release"]["tag"] == "videos-c-v2", "Invalid release tag")
    draft = manifest["release"]["draft"]
    require(isinstance(draft, bool), "Invalid release.draft")
    require(re.fullmatch(r"[\w-]+/[\w-]+", manifest["repository"], re.ASCII), "Invalid repository")
    release_base = f'https://github.com/{manifest["repository"]}/releases/download/videos-c-v2/'
    grouped = defaultdict(list)
    files = {}
    with ZipFile(args.posters) as zip_file:
        for row in rows:
            asset = row["release_asset_name"]
            require(re.fullmatch(r"c2\.[\w.-]+\.mp4", asset, re.ASCII), f"Invalid asset: {asset}")
            require(row["card_id"] + ".mp4" == asset, f"card_id/asset mismatch: {asset}")
            require(re.fullmatch(r"[a-f0-9]{64}", row["sha256"]), f"Invalid SHA256: {asset}")
            require(row["size_bytes"] > 0 and row["duration_s"] > 0, f"Invalid size/duration: {asset}")
            require(row["page_path"] == PAGE, f"Invalid page: {asset}")
            anchor = row["anchor"]
            require(re.fullmatch(r"point-\d+", anchor, re.ASCII), f"Invalid anchor: {anchor}")
            poster = row["card_id"] + ".webp"
            image = zip_file.read(poster)
            require(len(image) >= 12 and image[:4] == b"RIFF" and image[8:12] == b"WEBP"
                    and len(image) == row["poster_size_bytes"], f"Invalid poster: {poster}")
            files[ROOT / "assets/videos-c-v2/posters" / poster] = image
            grouped[anchor].append(row)

    path = ROOT / PAGE
    source = BLOCK.sub("", path.read_bytes().decode("utf-8"))
    locations = Locations(source)
    edits = []
    for anchor, group in grouped.items():
        offsets = locations.sections[anchor]
        require(len(offsets) == 1, f"Expected exactly one section: {anchor}")
        offset = offsets[0]
        old = V1_BLOCK.match(source, offset)
        if old:
            offset = old.end()
        # Keep both blocks' boundary newlines: either BLOCK can be removed independently.
        edits.append((offset, render(group, release_base, draft)))
    for offset, addition in sorted(edits, reverse=True):
        source = source[:offset] + addition + source[offset:]
    files[path] = source.encode("utf-8")

    for path, content in files.items():
        if args.check:
            require(path.is_file() and path.read_bytes() == content, f"Out of date: {path}")
        elif not path.exists() or path.read_bytes() != content:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
    print(f"{'Checked' if args.check else 'Generated'} {len(rows)} videos across {len(grouped)} sections")


if __name__ == "__main__":
    main()
