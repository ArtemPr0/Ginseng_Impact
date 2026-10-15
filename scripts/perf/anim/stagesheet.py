import json, sys, glob
from PIL import Image, ImageDraw, ImageFont
prefix, out = sys.argv[1], sys.argv[2]
labels = json.load(open(prefix + '.json')); files = sorted(glob.glob(prefix + '-*.jpg'))
try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 14)
except Exception: font = None
T = 220; cols = int(__import__('os').environ.get('COLS', '5')); rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * T, rows * (T + 18)), (12, 12, 12)); d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).resize((T, T)); x = (i % cols) * T; y = (i // cols) * (T + 18)
    sheet.paste(im, (x, y)); d.text((x + 3, y + T + 1), labels[i], fill=(255, 255, 120), font=font)
sheet.save(out); print(out, sheet.size)
