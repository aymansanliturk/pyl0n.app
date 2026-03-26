#!/usr/bin/env python3
"""
PYL0N Icon Generator
Generates build/icon.png (512), build/icon.ico (Windows), build/icon.icns (macOS)
from the favicon.svg geometry using only Python built-ins.

Run: python3 scripts/generate-icons.py
"""

import struct
import zlib
import math
import os

# ---------------------------------------------------------------------------
# Colours (RGBA)
# ---------------------------------------------------------------------------
BG   = (0x1e, 0x3a, 0x5f, 0xff)   # Navy background
FG   = (0xff, 0xff, 0xff, 0xff)   # White full opacity
FG40 = (0xff, 0xff, 0xff, 0x66)   # White 40% opacity (bottom-right)
CLEAR= (0x00, 0x00, 0x00, 0x00)   # Transparent

# ---------------------------------------------------------------------------
# Pure-Python PNG encoder
# ---------------------------------------------------------------------------

def _png_chunk(tag: bytes, data: bytes) -> bytes:
    c = zlib.crc32(tag + data) & 0xffffffff
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', c)

def encode_png(pixels: list, width: int, height: int) -> bytes:
    """pixels: flat list of (r,g,b,a) tuples, row-major."""
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = _png_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter type None
        for x in range(width):
            r, g, b, a = pixels[y * width + x]
            raw += bytes([r, g, b, a])
    idat = _png_chunk(b'IDAT', zlib.compress(raw, 9))
    iend = _png_chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

# ---------------------------------------------------------------------------
# Drawing helpers
# ---------------------------------------------------------------------------

def make_canvas(w: int, h: int, fill=(0,0,0,0)) -> list:
    return [fill] * (w * h)

def blend(dst, src):
    """Alpha-composite src over dst."""
    sr, sg, sb, sa = src
    dr, dg, db, da = dst
    if sa == 255:
        return src
    if sa == 0:
        return dst
    a = sa / 255.0
    da_out = 255  # treat result as fully opaque
    return (
        max(0, min(255, int(dr * (1 - a) + sr * a))),
        max(0, min(255, int(dg * (1 - a) + sg * a))),
        max(0, min(255, int(db * (1 - a) + sb * a))),
        da_out,
    )

def in_rounded_rect(px, py, x, y, w, h, rx):
    """Returns True if pixel (px,py) is inside rounded rect."""
    # Check bounding box
    if px < x or px >= x + w or py < y or py >= y + h:
        return False
    # Corner regions — check circle
    corners = [
        (x + rx,     y + rx),
        (x + w - rx, y + rx),
        (x + rx,     y + h - rx),
        (x + w - rx, y + h - rx),
    ]
    # Top-left corner region
    if px < x + rx and py < y + rx:
        return math.hypot(px - (x + rx), py - (y + rx)) <= rx
    # Top-right corner region
    if px >= x + w - rx and py < y + rx:
        return math.hypot(px - (x + w - rx), py - (y + rx)) <= rx
    # Bottom-left corner region
    if px < x + rx and py >= y + h - rx:
        return math.hypot(px - (x + rx), py - (y + h - rx)) <= rx
    # Bottom-right corner region
    if px >= x + w - rx and py >= y + h - rx:
        return math.hypot(px - (x + w - rx), py - (y + h - rx)) <= rx
    return True

def draw_rounded_rect(canvas, cw, x, y, w, h, rx, color):
    ix = max(0, int(x))
    iy = max(0, int(y))
    ex = min(cw, int(x + w + 1))
    ey = min(len(canvas) // cw, int(y + h + 1))
    for py in range(iy, ey):
        for px in range(ix, ex):
            if in_rounded_rect(px + 0.5, py + 0.5, x, y, w, h, rx):
                canvas[py * cw + px] = blend(canvas[py * cw + px], color)

# ---------------------------------------------------------------------------
# Render PYL0N icon at any size
# ---------------------------------------------------------------------------

def render_pyl0n(size: int) -> list:
    """
    Renders the PYL0N 4-square logo at given size.
    Geometry is based on the 32x32 SVG, scaled proportionally.
    """
    s = size / 32.0

    canvas = make_canvas(size, size)

    # Background rounded rect (full canvas, rx = 7/32 * size)
    bg_rx = 7 * s
    draw_rounded_rect(canvas, size, 0, 0, size, size, bg_rx, BG)

    # Four squares: each 11×11 at positions (4,4), (17,4), (4,17), (17,17) in 32px coords
    sq_x = [4, 17, 4,  17]
    sq_y = [4, 4,  17, 17]
    sq_c = [FG, FG, FG, FG40]
    sq_rx = 2 * s
    sq_w = 11 * s
    sq_h = 11 * s

    for i in range(4):
        draw_rounded_rect(canvas, size,
                          sq_x[i] * s, sq_y[i] * s,
                          sq_w, sq_h, sq_rx, sq_c[i])

    return canvas

# ---------------------------------------------------------------------------
# ICO file writer (supports multiple sizes, PNG data payload)
# ---------------------------------------------------------------------------

def encode_ico(size_list: list) -> bytes:
    """
    size_list: list of (size, png_bytes) tuples
    Creates a Windows .ico with each size embedded as PNG.
    """
    n = len(size_list)
    # ICO header: 2 reserved, 2 type=1, 2 count
    header = struct.pack('<HHH', 0, 1, n)

    # Each ICONDIRENTRY: 16 bytes
    # width(1), height(1), colorcount(1), reserved(1), planes(2), bitcount(2),
    # bytesinres(4), imageoffset(4)
    dir_entries = b''
    data_blob   = b''
    offset = 6 + n * 16

    for sz, png_bytes in size_list:
        w = sz if sz < 256 else 0   # 0 means 256
        h = sz if sz < 256 else 0
        entry = struct.pack('<BBBBHHII',
                            w, h,       # width, height (0 = 256)
                            0,          # colour count (0 = more than 256)
                            0,          # reserved
                            1,          # colour planes
                            32,         # bits per pixel
                            len(png_bytes),
                            offset)
        dir_entries += entry
        data_blob   += png_bytes
        offset      += len(png_bytes)

    return header + dir_entries + data_blob

# ---------------------------------------------------------------------------
# ICNS file writer (uses PNG payloads)
# ---------------------------------------------------------------------------
# OSType codes for PNG icons in ICNS
ICNS_TYPES = {
    16:  b'icp4',
    32:  b'icp5',
    64:  b'icp6',
    128: b'ic07',
    256: b'ic08',
    512: b'ic09',
}

def encode_icns(size_list: list) -> bytes:
    """size_list: list of (size, png_bytes)"""
    body = b''
    for sz, png_bytes in size_list:
        ostype = ICNS_TYPES.get(sz)
        if ostype is None:
            continue
        chunk_size = 8 + len(png_bytes)
        body += ostype + struct.pack('>I', chunk_size) + png_bytes
    magic = b'icns'
    total = 8 + len(body)
    return magic + struct.pack('>I', total) + body

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'build')
    os.makedirs(out_dir, exist_ok=True)

    sizes = [16, 32, 64, 128, 256, 512]
    pngs  = {}

    print("Rendering icon sizes...")
    for sz in sizes:
        print(f"  {sz}×{sz}...")
        canvas = render_pyl0n(sz)
        pngs[sz] = encode_png(canvas, sz, sz)

    # Write 512×512 PNG (primary)
    png_path = os.path.join(out_dir, 'icon.png')
    with open(png_path, 'wb') as f:
        f.write(pngs[512])
    print(f"Written: {png_path} ({len(pngs[512])} bytes)")

    # Write .ico — embed 16, 32, 48, 64, 128, 256 sizes
    ico_sizes = [(sz, pngs[sz]) for sz in [16, 32, 64, 128, 256]]
    ico_bytes = encode_ico(ico_sizes)
    ico_path  = os.path.join(out_dir, 'icon.ico')
    with open(ico_path, 'wb') as f:
        f.write(ico_bytes)
    print(f"Written: {ico_path} ({len(ico_bytes)} bytes)")

    # Write .icns — embed 16, 32, 64, 128, 256, 512
    icns_sizes = [(sz, pngs[sz]) for sz in sizes]
    icns_bytes = encode_icns(icns_sizes)
    icns_path  = os.path.join(out_dir, 'icon.icns')
    with open(icns_path, 'wb') as f:
        f.write(icns_bytes)
    print(f"Written: {icns_path} ({len(icns_bytes)} bytes)")

    print("\nDone! Icon assets are ready in build/")
    print("  build/icon.png   — Linux AppImage, 512×512")
    print("  build/icon.ico   — Windows NSIS installer")
    print("  build/icon.icns  — macOS .dmg")

if __name__ == '__main__':
    main()
