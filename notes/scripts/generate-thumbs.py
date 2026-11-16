from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[2]
NOTES = ROOT / "notes"
MANIFESTS = [
    (NOTES / "data" / "network-sources.json", NOTES / "assets" / "thumbs" / "network"),
    (NOTES / "data" / "web-sources.json", NOTES / "assets" / "thumbs" / "web"),
]


def make_thumb(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        if image.mode not in ("RGB", "L"):
            background = Image.new("RGB", image.size, "white")
            if "A" in image.getbands():
                background.paste(image, mask=image.getchannel("A"))
                image = background
            else:
                image = image.convert("RGB")
        image.thumbnail((420, 280), Image.Resampling.LANCZOS)
        image.save(target, "WEBP", quality=76, method=6)


def main() -> None:
    generated = 0
    for manifest_path, output_dir in MANIFESTS:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        for item in manifest["items"]:
            if not item["readable"]:
                continue
            source = NOTES / item["src"]
            target = output_dir / f"{source.stem}.webp"
            make_thumb(source, target)
            generated += 1
            print(f"{source.relative_to(ROOT)} -> {target.relative_to(ROOT)}")
    print(f"generated {generated} classroom thumbnails")


if __name__ == "__main__":
    main()
