#!/usr/bin/env python3
"""Download full-size images, GIFs and videos from a Tumblr post.

Usage: tumblr-dl.py <post-url> [out-dir]   (default out-dir: ~/Downloads)
"""
import json, os, re, subprocess, sys

# Tumblr's fake extensions -> (real extension, Accept header)
FORMATS = {".gifv": (".gif", "image/gif"), ".pnj": (".png", "image/png"), ".mp4": (".mp4", "*/*")}

def parse(url):
    m = re.search(r"([\w-]+)\.tumblr\.com/post/(\d+)", url) \
        or re.search(r"tumblr\.com/(?:blog/view/)?([\w-]+)/(\d+)", url) \
        or re.search(r"//([\w.-]+)/post/(\d+)", url)  # custom domain
    if not m:
        sys.exit(f"Not a Tumblr post URL: {url}")
    return m.group(1), m.group(2)

def curl(url, accept, out=None):
    cmd = ["curl", "-sSL", "-A", "Mozilla/5.0", "-H", f"Accept: {accept}", url]
    if out:
        return subprocess.run(cmd + ["-o", out]).returncode == 0
    return subprocess.run(cmd, capture_output=True, text=True).stdout

def real_ext(path, ext):
    """Tumblr sometimes sends a JPEG for a PNG link; trust the file bytes."""
    with open(path, "rb") as f:
        head = f.read(12)
    for magic, real in ((b"\xff\xd8", ".jpg"), (b"\x89PNG", ".png"), (b"GIF8", ".gif")):
        if head.startswith(magic):
            return real
    if head[8:12] == b"WEBP":
        return ".webp"
    return ext

def find_media(node, found, external):
    """Collect the biggest URL of every image/video block (post + reblog trail)."""
    if isinstance(node, list):
        for v in node:
            find_media(v, found, external)
    elif isinstance(node, dict):
        kind = node.get("type")
        if kind == "image" and isinstance(node.get("media"), list):
            best = max(node["media"], key=lambda m: m.get("width", 0))
            found.append(best["url"])
            return
        if kind == "video":
            media = node.get("media")
            if isinstance(media, dict) and media.get("url"):
                found.append(media["url"])
            elif node.get("url"):
                external.append(node["url"])  # YouTube etc.
            return
        for v in node.values():
            find_media(v, found, external)

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    blog, post = parse(sys.argv[1])
    out_dir = os.path.expanduser(sys.argv[2] if len(sys.argv) > 2 else "~/Downloads")
    os.makedirs(out_dir, exist_ok=True)

    # Normal post pages show a bot check to curl; the embed page does not.
    page = curl(f"https://embed.tumblr.com/embed/post/{blog}/{post}", "text/html")
    m = re.search(r'id="___INITIAL_STATE___">(.*?)</script>', page, re.S)
    if not m:
        sys.exit("Could not read the post (deleted, private, or Tumblr changed the page).")
    state = json.loads(m.group(1))
    posts = [q["state"]["data"]["timeline"]["elements"][0]
             for q in state.get("queries", {}).get("queries", [])
             if q.get("state", {}).get("data", {}).get("timeline", {}).get("elements")]

    found, external = [], []
    for p in posts[:1]:
        find_media([p.get("trail", []), p.get("content", [])], found, external)
    found = list(dict.fromkeys(found))
    for url in external:
        print(f"External video (use yt-dlp): {url}")
    if not found:
        sys.exit(0 if external else "No images or videos found in this post.")

    for i, url in enumerate(found, 1):
        ext = os.path.splitext(url.split("?")[0])[1].lower() or ".jpg"
        ext, accept = FORMATS.get(ext, (ext, "image/*"))
        suffix = f"_{i}" if len(found) > 1 else ""
        name = os.path.join(out_dir, f"tumblr_{post[-6:]}{suffix}")
        if curl(url, accept, name + ext):
            fixed = real_ext(name + ext, ext)
            if fixed != ext:
                os.replace(name + ext, name + fixed)
            print(name + fixed)

main()
