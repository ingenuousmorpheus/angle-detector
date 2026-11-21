import numpy as np
from PIL import Image
from scipy import ndimage as nd
Image.MAX_IMAGE_PIXELS = None
im = Image.open('tex_rebadged.png').convert('RGB')
A = np.asarray(im).astype(np.float32).copy()
boxes = [(3400,3050,4700,3900),(2900,5300,3500,5900),(1300,7400,2300,8192),(7200,4700,8192,5200)]
prev = []
rng = np.random.default_rng(3)
for (x0,y0,x1,y1) in boxes:
    reg = A[y0:y1, x0:x1].copy()
    R,G,B = reg[...,0],reg[...,1],reg[...,2]; lum = reg.mean(2)
    glass = (G-(R+B)/2 >= 5) & (lum>95) & (lum<200)
    glass = nd.binary_opening(glass, iterations=2)
    region = nd.binary_fill_holes(nd.binary_closing(glass, structure=np.ones((3,3)), iterations=30))
    region = nd.binary_erosion(region, iterations=6)   # stay off the bezel
    dark = nd.binary_dilation(lum < 115, iterations=10)
    mask = region & dark
    known = region & ~mask
    if not known.any() or not mask.any(): continue
    f = reg.copy(); f[mask] = reg[known].mean(0)
    for _ in range(2500):
        p = np.pad(f, ((1,1),(1,1),(0,0)), mode='edge')
        av = (p[:-2,1:-1]+p[2:,1:-1]+p[1:-1,:-2]+p[1:-1,2:])/4
        f[mask] = av[mask]
    f[mask] += rng.normal(0,1.5,(mask.sum(),1))
    A[y0:y1, x0:x1] = f
    vis = reg.copy(); vis[mask] = [255,0,0]
    prev.append((Image.fromarray(np.clip(vis,0,255).astype(np.uint8)), Image.fromarray(np.clip(f,0,255).astype(np.uint8))))
Image.fromarray(np.clip(A,0,255).astype(np.uint8)).save('tex_lcd.png')
row = []
for v,f in prev:
    s = 360/max(v.size); sz=(int(v.size[0]*s),int(v.size[1]*s))
    c = Image.new('RGB',(sz[0],sz[1]*2+6),'white'); c.paste(v.resize(sz),(0,0)); c.paste(f.resize(sz),(0,sz[1]+6)); row.append(c)
W=sum(c.size[0]+8 for c in row); H=max(c.size[1] for c in row); o=Image.new('RGB',(W,H),'white'); x=0
for c in row: o.paste(c,(x,0)); x+=c.size[0]+8
o.save('lcd_preview.jpg',quality=85)
