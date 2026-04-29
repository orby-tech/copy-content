#!/usr/bin/env python3
"""Generate PNG icons for the Copy Content Chrome extension."""
import struct, zlib, os, math

def pack_chunk(tag, data):
    body = tag + data
    return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)

def make_png(width, height, rgba_rows):
    raw = b''
    for row in rgba_rows:
        raw += b'\x00'  # filter: None
        for r, g, b, a in row:
            raw += bytes([r, g, b, a])
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png  = b'\x89PNG\r\n\x1a\n'
    png += pack_chunk(b'IHDR', ihdr)
    png += pack_chunk(b'IDAT', zlib.compress(raw, 9))
    png += pack_chunk(b'IEND', b'')
    return png

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4))

def draw_icon(size):
    BG   = (26, 115, 232, 255)   # blue
    WHITE = (255, 255, 255, 255)
    TRANS = (0, 0, 0, 0)

    rows = [[TRANS] * size for _ in range(size)]
    cx = cy = (size - 1) / 2
    r  = cx - 0.5

    # Background circle
    for y in range(size):
        for x in range(size):
            d = math.sqrt((x - cx)**2 + (y - cy)**2)
            if d < r - 0.5:
                rows[y][x] = BG
            elif d < r + 0.5:
                t = (d - (r - 0.5))
                rows[y][x] = lerp_color(BG, TRANS, t)

    # Draw two overlapping rectangles (copy icon), white
    m   = max(1, int(size * 0.18))   # margin from edge
    off = max(1, int(size * 0.16))   # offset between rects
    rw  = size - 2*m - off           # rect width/height

    def draw_rect(x1, y1, w, h, fill, border):
        for y in range(y1, y1+h):
            for x in range(x1, x1+w):
                if 0 <= x < size and 0 <= y < size:
                    is_border = (x == x1 or x == x1+w-1 or y == y1 or y == y1+h-1)
                    color = border if is_border else fill
                    if color[3] > 0:
                        rows[y][x] = color

    # Back rect (top-right)
    bx, by = m + off, m
    # Front rect (bottom-left), filled white, blue circle behind it acts as BG
    fx, fy = m, m + off

    draw_rect(bx, by, rw, rw, BG, WHITE)
    draw_rect(fx, fy, rw, rw, WHITE, WHITE)

    return rows

os.makedirs('icons', exist_ok=True)
for size in (16, 48, 128):
    rows = draw_icon(size)
    png  = make_png(size, size, rows)
    path = f'icons/icon{size}.png'
    with open(path, 'wb') as f:
        f.write(png)
    print(f'Created {path}  ({size}×{size},  {len(png)} bytes)')

print('Done.')
