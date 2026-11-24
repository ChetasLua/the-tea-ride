#!/usr/bin/env python3
"""grid.py out.jpg cols width img1 img2 ...   tile images into one sheet"""
import sys; from PIL import Image
out, cols, tw = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); ims = [Image.open(f).convert('RGB') for f in sys.argv[4:]]
th = int(tw * ims[0].height / ims[0].width); rows = (len(ims) + cols - 1) // cols; s = Image.new('RGB', (cols * tw, rows * th))
for i, im in enumerate(ims): s.paste(im.resize((tw, th), Image.LANCZOS), ((i % cols) * tw, (i // cols) * th))
s.save(out, quality=88); print(out, s.size)
