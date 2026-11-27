"""Serve public site files and manifest-listed MP4s for loopback-only preview."""
import argparse
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE_DIRS = frozenset("assets c config data gs jsj notes study tower wl wy yy".split())
ROOT_FILES = frozenset(
    "index.html 404.html search.html robots.txt sitemap.xml style.css "
    "study-bridge.js sw.js manifest.webmanifest offline.html".split()
)
MEDIA = "__videos_v1_media__"


def media_paths(manifest):
    root = manifest.resolve().parent
    result = {}
    for row in json.loads(manifest.read_text())["videos"]:
        asset = row["release_asset_name"]
        source = Path(row["local_mp4"]).resolve()
        if (not re.fullmatch(r"[\w.-]+\.mp4", asset, re.ASCII)
                or asset in result or source.suffix != ".mp4" or not source.is_relative_to(root)):
            raise ValueError(f"Invalid preview mapping for {asset!r}")
        result[asset] = source
    return result


def merge_media_paths(manifests):
    result = {}
    for manifest in manifests:
        mapping = media_paths(manifest)
        duplicate = result.keys() & mapping.keys()
        if duplicate:
            raise ValueError(f"Duplicate preview asset: {sorted(duplicate)[0]}")
        result.update(mapping)
    return result


def byte_range(header, size):
    match = re.fullmatch(r"bytes=([0-9]{0,20})-([0-9]{0,20})", header)
    if not match or not size:
        raise ValueError
    first, last = match.groups()
    if not first:
        count = int(last or 0)
        if not count:
            raise ValueError
        return max(size - count, 0), size - 1
    start = int(first)
    end = min(int(last), size - 1) if last else size - 1
    if start > end:
        raise ValueError
    return start, end


class PreviewHandler(BaseHTTPRequestHandler):
    def do_HEAD(self):
        self.serve(False)

    def do_GET(self):
        self.serve(True)

    def lookup(self):
        url = urlsplit(self.path)
        path = unquote(url.path, errors="strict")
        parts = path.strip("/").split("/") if path.strip("/") else ["index.html"]
        if (url.scheme or url.netloc or not path.startswith("/")
                or any(not part or part.startswith(".") or "\\" in part or "\0" in part for part in parts)):
            return None
        if parts[0] == MEDIA:
            return self.server.media.get(parts[1]) if len(parts) == 2 and not path.endswith("/") else None
        if parts[0] not in SITE_DIRS and not (len(parts) == 1 and parts[0] in ROOT_FILES):
            return None
        if path.endswith("/") and parts != ["index.html"]:
            parts.append("index.html")
        public_root = ROOT / parts[0] if parts[0] in SITE_DIRS else ROOT
        target = ROOT.joinpath(*parts)
        if target.resolve() != target or not target.is_relative_to(public_root):
            return None
        if target.suffix in {".md", ".py", ".txt"} and parts[0] in SITE_DIRS:
            return None
        return target

    def serve(self, body):
        if (self.headers.get("Host") != f"127.0.0.1:{self.server.server_port}"
                or self.headers.get("Sec-Fetch-Site") in {"cross-site", "same-site"}):
            self.send_error(HTTPStatus.FORBIDDEN)
            return
        try:
            path = self.lookup()
            if path is None or path.resolve() != path or not path.is_file():
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            stream = path.open("rb")
        except (OSError, ValueError):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        with stream:
            size = stream.seek(0, 2)
            start, end = 0, size - 1
            header = self.headers.get("Range")
            if header is not None:
                try:
                    start, end = byte_range(header, size)
                except ValueError:
                    self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
            self.send_response(HTTPStatus.PARTIAL_CONTENT if header else HTTPStatus.OK)
            self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            # Keep preview off the site's offline cache and isolate media from other origins.
            self.send_header("Cross-Origin-Resource-Policy", "same-origin")
            self.send_header("Content-Security-Policy", "worker-src 'none'")
            if header:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            remaining = end - start + 1
            self.send_header("Content-Length", str(remaining))
            self.end_headers()
            if body:
                stream.seek(start)
                try:
                    while remaining and (chunk := stream.read(min(remaining, 64 * 1024))):
                        self.wfile.write(chunk)
                        remaining -= len(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path, nargs="+")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    mapping = merge_media_paths(args.manifest)
    with ThreadingHTTPServer(("127.0.0.1", args.port), PreviewHandler) as server:
        server.media = mapping
        print(f"http://127.0.0.1:{server.server_port}/", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
