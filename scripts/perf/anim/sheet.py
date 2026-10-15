import json, sys, glob
from PIL import Image, ImageDraw, ImageFont
prefix = sys.argv[1]; out = sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
files = sorted(glob.glob(prefix + '-*.jpg')); log = json.load(open(prefix + '.json'))
try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 15)
except Exception: font = None
tw, th = 480, 270
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 20)), (15, 15, 15))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).resize((tw, th)); x = (i % cols) * tw; y = (i // cols) * (th + 20)
    sheet.paste(im, (x, y)); d.text((x + 4, y + th + 2), f'{i}: ' + (log[i] if i < len(log) else ''), fill=(255, 255, 120), font=font)
sheet.save(out); print(out, sheet.size)
