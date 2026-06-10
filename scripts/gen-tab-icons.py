#!/usr/bin/env python3
"""生成原生 tabBar 图标（81x81 PNG）：首页 / 我的，各含默认态与选中态"""
import math
import os
import struct
import zlib

SIZE = 81
GRAY = (107, 114, 128)
GREEN = (22, 183, 119)
STROKE = 2.6  # 线条半径


def write_png(path, pixels):
    raw = b''
    for row in pixels:
        raw += b'\x00' + b''.join(struct.pack('4B', *px) for px in row)

    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        return c + struct.pack('>I', zlib.crc32(typ + data) & 0xFFFFFFFF)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', SIZE, SIZE, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(raw))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def seg_dist(px, py, x1, y1, x2, y2):
    vx, vy = x2 - x1, y2 - y1
    t = ((px - x1) * vx + (py - y1) * vy) / (vx * vx + vy * vy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (x1 + t * vx), py - (y1 + t * vy))


def home_hit(x, y):
    """房子：屋顶两条斜线 + 左/底/右三条边"""
    segs = [
        (40, 11, 10, 39),
        (40, 11, 70, 39),
        (17, 36, 17, 68),
        (17, 68, 63, 68),
        (63, 36, 63, 68),
    ]
    return any(seg_dist(x, y, *s) <= STROKE for s in segs)


def user_hit(x, y):
    """人物：头部圆环 + 上半身弧线"""
    head = abs(math.hypot(x - 40, y - 26) - 11) <= STROKE
    body = y <= 70 and abs(math.hypot(x - 40, y - 70) - 21) <= STROKE
    return head or body


def render(hit, color):
    pixels = []
    sub = 4  # 4x4 超采样抗锯齿
    for y in range(SIZE):
        row = []
        for x in range(SIZE):
            cnt = sum(
                1
                for i in range(sub)
                for j in range(sub)
                if hit(x + (i + 0.5) / sub, y + (j + 0.5) / sub)
            )
            alpha = round(255 * cnt / (sub * sub))
            row.append((*color, alpha))
        pixels.append(row)
    return pixels


def main():
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'src', 'static', 'tab')
    os.makedirs(out_dir, exist_ok=True)
    icons = {
        'home.png': (home_hit, GRAY),
        'home-active.png': (home_hit, GREEN),
        'mine.png': (user_hit, GRAY),
        'mine-active.png': (user_hit, GREEN),
    }
    for name, (hit, color) in icons.items():
        write_png(os.path.join(out_dir, name), render(hit, color))
        print('generated', name)


if __name__ == '__main__':
    main()
