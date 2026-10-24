#!/usr/bin/env python3
"""Download the full-size image or video from a Pinterest pin link.

Usage: pinterest.py <pin-url> [out-dir]   (default out-dir: ~/Downloads)
Works with pinterest.com/pin/<id>/ and pin.it/<code> short links.
"""
import os, re, subprocess, sys

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

def curl(url, out=None):
    cmd = ["curl", "-sSL", "-A", UA, url]
    if out:
        return subprocess.run(cmd + ["-o", out]).returncode == 0
    return subprocess.run(cmd, capture_output=True, text=True).stdout

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    url = sys.argv[1]
    out_dir = os.path.expanduser(sys.argv[2] if len(sys.argv) > 2 else "~/Downloads")
    os.makedirs(out_dir, exist_ok=True)

    html = curl(url)  # curl -L follows pin.it redirects too

    m = (re.search(r'"seoCanonicalUrl":"/pin/(?:[\w-]*-)?(\d+)/"', html)
         or re.search(r"/pin/(?:[\w-]*-)?(\d+)/?", url))
    pin_id = m.group(1) if m else "unknown"
    name = os.path.join(out_dir, f"pinterest_{pin_id[-6:] if pin_id != 'unknown' else pin_id}")

    video = re.search(r'"videoUrls":\[\s*"([^"]+\.mp4)"', html)
    if video:
        if curl(video.group(1), name + ".mp4"):
            print(name + ".mp4")
            return
        sys.exit("Found a video link but the download failed.")

    image = re.search(r'"images_orig":\{"url":"([^"]+)"', html)
    if image:
        img_url = image.group(1)
    else:
        og = re.search(r'content="([^"]+)"[^>]*property="og:image"', html)
        if not og:
            sys.exit("Could not find an image or video in this pin (deleted, private, or Pinterest changed the page).")
        img_url = re.sub(r"/\d+x\d*/", "/originals/", og.group(1))
    ext = os.path.splitext(img_url.split("?")[0])[1].lower() or ".jpg"
    if curl(img_url, name + ext):
        print(name + ext)
    else:
        sys.exit("Download failed.")

main()
