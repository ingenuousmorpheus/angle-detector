import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
Image.MAX_IMAGE_PIXELS = None
src, dst = 'tex0_x.jpeg', 'tex_rebadged.png'
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(np.float32)
CX, CY, R = 555, 1305, 352          # inner navy disc (full-res texture px)
x0, y0, x1, y1 = 170, 960, 940, 1600
reg = a[y0:y1, x0:x1].copy()
yy, xx = np.mgrid[y0:y1, x0:x1]
inside = (xx - CX) ** 2 + (yy - CY) ** 2 < R ** 2
rect = ((xx>=185)&(xx<=870)&(yy>=1180)&(yy<=1362)) | ((xx>=215)&(xx<=810)&(yy>=1410)&(yy<=1530))
mask = inside & rect
known = inside & ~mask
fill = reg.copy()
fill[mask] = reg[known].mean(axis=0)
for _ in range(4000):  # diffusion inpaint
    p = np.pad(fill, ((1, 1), (1, 1), (0, 0)), mode='edge')
    avg = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) / 4
    fill[mask] = avg[mask]
rng = np.random.default_rng(7)
fill[mask] += rng.normal(0, 2.0, (mask.sum(), 1))
a[y0:y1, x0:x1] = fill
out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

# overlay: mark + wordmark + tagline
ov = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
mark = Image.open('mark.png').resize((210, 181), Image.LANCZOS)
ov.alpha_composite(mark, (CX - x0 - 105, 1035 - y0))
d = ImageDraw.Draw(ov)
def centred(text, font, cy, fill):
    l, t, r, b = d.textbbox((0, 0), text, font=font)
    d.text((CX - x0 - (r - l) / 2 - l, cy - y0 - (b - t) / 2 - t), text, font=font, fill=fill)
centred('Angle Lens', ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 128), 1300, (236, 238, 242, 255))
centred('ANGLE FINDER', ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', 58), 1452, (214, 218, 226, 255))
ov = ov.filter(ImageFilter.GaussianBlur(1.1))
out.paste(Image.alpha_composite(out.crop((x0, y0, x1, y1)).convert('RGBA'), ov).convert('RGB'), (x0, y0))
out.save(dst)
out.crop((0, 700, 1100, 1650)).save('badge_new.jpg', quality=90)
