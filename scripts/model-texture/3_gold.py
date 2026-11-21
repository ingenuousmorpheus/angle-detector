import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
im = Image.open('tex_lcd.png').convert('RGB')
A = np.asarray(im).copy()
H = A.shape[0]
# metallic gold gradient map: luminance -> colour
stops = np.array([0, 70, 140, 200, 245, 255], np.float32)
cols = np.array([[40,26,6],[105,72,18],[176,132,40],[222,182,82],[250,226,150],[255,244,200]], np.float32)
CX, CY, RB = 555, 1305, 368   # protect the Angle Lens badge
for y0 in range(0, H, 512):
    blk = A[y0:y0+512].astype(np.float32)
    lum = blk @ np.array([0.299,0.587,0.114], np.float32)
    sat = blk.max(2) - blk.min(2)
    greenish = blk[...,1] - (blk[...,0]+blk[...,2])/2
    w = np.clip((28 - sat)/10, 0, 1) * np.clip((lum - 55)/35, 0, 1) * np.clip((5 - greenish)/3, 0, 1)
    yy, xx = np.mgrid[y0:y0+blk.shape[0], 0:blk.shape[1]]
    w[(xx-CX)**2 + (yy-CY)**2 < RB**2] = 0
    lc = np.clip((lum - 165) * 2.1 + 165, 0, 255)
    gold = np.stack([np.interp(lc, stops, cols[:,c]) for c in range(3)], -1)
    A[y0:y0+512] = np.clip(blk*(1-w[...,None]) + gold*w[...,None], 0, 255).astype(np.uint8)
out = Image.fromarray(A)
out.save('tex_final.jpg', quality=92)
out.resize((1600,1600)).save('final_small.jpg', quality=85)
out.crop((0,700,1100,1650)).save('badge_gold.jpg', quality=88)
out.crop((3400,3050,4700,3900)).save('lcd_gold.jpg', quality=88)
