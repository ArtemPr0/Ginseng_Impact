# python3 lineupsheet.py <prefix> <out.png> [ids,...]: one row per model (its frames from lineup.mjs), up to 10 rows a sheet.
import json, sys, glob, os
from PIL import Image, ImageDraw, ImageFont
prefix, out = sys.argv[1], sys.argv[2]
ids = sys.argv[3].split(',') if len(sys.argv) > 3 else sorted({os.path.basename(f)[len(os.path.basename(prefix)) + 1:-5] for f in glob.glob(prefix + '-*.json')})
try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 12)
except Exception: font = None
T = 150; COLS = 11
rows = []
for mid in ids:
    try: meta = json.load(open(f'{prefix}-{mid}.json'))
    except Exception: continue
    files = sorted(glob.glob(f'{prefix}-{mid}-[0-9][0-9].jpg'))
    rows.append((mid, meta['labels'], files))
sheet = Image.new('RGB', (110 + COLS * T, len(rows) * (T + 14)), (14, 14, 18)); d = ImageDraw.Draw(sheet)
for r, (mid, labels, files) in enumerate(rows):
    y = r * (T + 14); d.text((4, y + T // 2), mid, fill=(255, 255, 255), font=font)
    for i, f in enumerate(files[:COLS]):
        im = Image.open(f).resize((T, T)); x = 110 + i * T
        sheet.paste(im, (x, y)); d.text((x + 2, y + T), labels[i] if i < len(labels) else '', fill=(255, 230, 120), font=font)
sheet.save(out); print(out, sheet.size, len(rows))
