#!/usr/bin/env python3
"""
Cover-fit an arbitrary Gemini output to an EXACT target pixel size, then
compress. Deterministic locally rather than trusting the API's aspect-ratio
param (which has documented reliability issues on newer image models) — this
guarantees the shipped asset is exactly the spec'd size regardless of what
the model actually returned.

Usage: process-art.py <in> <out> <width> <height> <palette|jpeg>
"""
import sys
from PIL import Image

def cover_fit(img, target_w, target_h):
    src_w, src_h = img.size
    scale = max(target_w / src_w, target_h / src_h)
    new_w, new_h = round(src_w * scale), round(src_h * scale)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return img.crop((left, top, left + target_w, top + target_h))

def main():
    in_path, out_path, width, height, mode = sys.argv[1:6]
    width, height = int(width), int(height)

    img = Image.open(in_path).convert('RGB')
    img = cover_fit(img, width, height)

    if mode == 'palette':
        # Flat-color illustration (poster ink, gouache) — 256-color palette
        # compresses hard with no visible banding on these styles.
        img.quantize(colors=256, method=Image.FASTOCTREE).save(out_path, optimize=True)
    else:
        # Photography — palette quantization bands gradients; JPEG holds
        # detail at a fraction of the PNG size instead.
        img.save(out_path, 'JPEG', quality=82, optimize=True)

    print(f'{out_path} {width}x{height}')

if __name__ == '__main__':
    main()
