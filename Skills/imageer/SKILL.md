---
name: imageer
description: Download best quality media from a post link (Tumblr), and upscale images 4x with Real-ESRGAN.
---

# Imageer

Downloads the best quality media from a post link. Each site has its own script in `sites/`.

| Site | Script |
|------|--------|
| Tumblr | `sites/tumblr.py` |

If the site is not in the table, say so. Do not guess.

## Enhance

Upscale images 4x with Real-ESRGAN (runs on the GPU, about 20 s per image):

```
<this-skill-dir>/enhance.sh [--anime] <image>...
```

- Saves `<name>_x4.png` next to the original. The original stays.
- Use `--anime` for drawings, anime and cartoons. Use the default for photos.
- Only jpg, png and webp. It skips GIFs and videos.
- Only enhance when the user asks. Do not enhance every download.

## Tumblr

Run with the post link:

```
python3 <this-skill-dir>/sites/tumblr.py "<post-url>" [out-dir]
```

- Default out-dir: `~/Downloads`.
- Files are named `tumblr_<last 6 digits of post id>` (plus `_1`, `_2`… for many). It prints the path of each saved file. Tell the user the path and the size (`file <path>`).
- Works with `www.tumblr.com/<blog>/<id>`, `<blog>.tumblr.com/post/<id>` and custom-domain `/post/<id>` links.
- Gets every image, GIF and Tumblr video in the post (and its reblog trail).
- YouTube or other outside videos: the script prints the link. Use `yt-dlp` for those.

### How it works (if the script fails)

- Normal post pages show a "Checking your browser" bot page to curl. Use the embed page instead: `https://embed.tumblr.com/embed/post/<blog>/<id>`.
- The post data is JSON in `<script id="___INITIAL_STATE___">`. Look for content blocks:
  - `"type":"image"`: `media` is a list of sizes. Take the one with the biggest `width`.
  - `"type":"video"`: `media.url` is the full mp4 on `va.media.tumblr.com`.
- Each size has its own hash, so you cannot just change `s640x960` in a URL.
- Fake extensions: `.gifv` = GIF (send `Accept: image/gif`), `.pnj` = PNG. Without the right Accept header Tumblr may send WebP or HTML.
- Tumblr sometimes sends a JPEG for a `.pnj` link. The script checks the file bytes and fixes the extension.
