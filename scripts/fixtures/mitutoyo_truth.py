"""Derive ground truth for the Mitutoyo digital-protractor fixture from mesh geometry.

The model (anglefinder1.glb, a generated scan-style mesh) is NOT committed (62 MB).
Ground truth comes from the blade *silhouettes* in an orthographic front render,
never from the LCD texture: the texture is generated and does not have to agree
with the geometry (it reads 101.5 deg; the blades are ~134.6 deg apart).

Usage (Blender 4.x/5.x):
  blender -b --python scripts/fixtures/mitutoyo_truth.py -- <model.glb> <out_dir>

Writes <out_dir>/silhouette.png, truth.json and mitutoyo_center.jpg (1280x720,
centred on the blade pivot so the vertex sits under the app's center target).
"""
import bpy, json, math, os, sys
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
MODEL, OUT = argv[0], os.path.abspath(argv[1])
os.makedirs(OUT, exist_ok=True)

MASK_W, MASK_H, MASK_ORTHO = 4000, 3000, 1.05
FIX_W, FIX_H, FIX_ORTHO = 1280, 720, 1.2


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=MODEL)
    sc = bpy.context.scene
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'
    co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
    co.rotation_euler = (math.pi / 2, 0, 0)  # look along +Y (glTF front)
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.view_settings.view_transform = 'Standard'
    return sc, co, cam


def runs(col):
    idx = np.flatnonzero(col)
    if len(idx) == 0:
        return []
    br = np.flatnonzero(np.diff(idx) > 1)
    return list(zip(np.r_[idx[0], idx[br + 1]], np.r_[idx[br], idx[-1]]))


def fit(pts):
    p = np.array(pts, float)
    m, b = np.polyfit(p[:, 0], p[:, 1], 1)
    res = np.abs(p[:, 1] - (m * p[:, 0] + b)).max()
    return m, b, res


sc, co, cam = setup()

# 1. silhouette mask
sc.render.film_transparent = True
sc.render.resolution_x, sc.render.resolution_y = MASK_W, MASK_H
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.display.shading.light = 'FLAT'
cam.ortho_scale = MASK_ORTHO; co.location = (0, -3, 0)
sc.render.filepath = os.path.join(OUT, 'silhouette.png')
bpy.ops.render.render(write_still=True)
img = bpy.data.images.load(sc.render.filepath)
alpha = np.array(img.pixels[:]).reshape(MASK_H, MASK_W, 4)[::-1, :, 3] > 0.5  # top row first

# 2. fit blade edges in regions where only one blade is present
#    long blade, right of the dial: x 2700..3700; short blade upper-left: top edge x 400..1700, bottom edge x 400..960
L_top, L_bot, S_top, S_bot = [], [], [], []
for x in range(2700, 3700, 4):
    r = runs(alpha[:, x]); L_top.append((x, r[0][0])); L_bot.append((x, r[0][1]))
for x in range(400, 1700, 4):
    S_top.append((x, runs(alpha[:, x])[0][0]))
for x in range(400, 960, 4):
    S_bot.append((x, runs(alpha[:, x])[0][1]))
edges = {k: fit(v) for k, v in dict(long_top=L_top, long_bottom=L_bot, short_top=S_top, short_bottom=S_bot).items()}
for k, (m, b, res) in edges.items():
    print(f'{k}: {math.degrees(math.atan(-m)):.3f} deg, max residual {res:.1f}px')

Lm = (edges['long_top'][0] + edges['long_bottom'][0]) / 2; Lb = (edges['long_top'][1] + edges['long_bottom'][1]) / 2
Sm = (edges['short_top'][0] + edges['short_bottom'][0]) / 2; Sb = (edges['short_top'][1] + edges['short_bottom'][1]) / 2
xv = (Sb - Lb) / (Lm - Sm); yv = Lm * xv + Lb
dL = np.array([1, Lm]); dL /= np.linalg.norm(dL)    # long blade arm, toward +x (image coords, y down)
dS = -np.array([1, Sm]); dS /= np.linalg.norm(dS)   # short blade arm, toward upper-left
included = math.degrees(math.acos(float(dL @ dS)))
# edge-pair spread = honest uncertainty from the generated mesh (blades taper slightly)
a = {k: math.degrees(math.atan(-v[0])) for k, v in edges.items()}
top_pair = 180 + a['short_top'] - a['long_top']
bot_pair = 180 + a['short_bottom'] - a['long_bottom']
s = MASK_W / MASK_ORTHO
vx, vz = (xv - MASK_W / 2) / s, -(yv - MASK_H / 2) / s

# 3. fixture render centred on the pivot
sc.render.film_transparent = False
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
sc.display.shading.background_type = 'VIEWPORT'; sc.display.shading.background_color = (0.08, 0.09, 0.1)
sc.render.resolution_x, sc.render.resolution_y = FIX_W, FIX_H
sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.color_mode = 'RGB'; sc.render.image_settings.quality = 90
cam.ortho_scale = FIX_ORTHO; co.location = (vx, -3, vz)
sc.render.filepath = os.path.join(OUT, 'mitutoyo_center.jpg')
bpy.ops.render.render(write_still=True)

c = np.array([FIX_W / 2, FIX_H / 2])
truth = {
    'source': 'anglefinder1.glb (generated Mitutoyo digital protractor mesh), orthographic front view',
    'image': 'mitutoyo_center.jpg',
    'width': FIX_W, 'height': FIX_H,
    'includedAngleDeg': round(included, 3),
    'supplementDeg': round(180 - included, 3),
    'uncertaintyDeg': round(abs(top_pair - bot_pair) / 2, 3),
    'edgePairAnglesDeg': {'topEdges': round(top_pair, 3), 'bottomEdges': round(bot_pair, 3)},
    'lcdTextureReadingDeg': 101.5,
    'note': 'LCD value is part of the generated texture and disagrees with the blade geometry; '
            'blade geometry is the ground truth for this fixture.',
    # pixel coords (y down) in the fixture image: [arm A point, vertex, arm B point]
    'points': [
        {'x': float(c[0] + dS[0] * 400), 'y': float(c[1] + dS[1] * 400)},
        {'x': float(c[0]), 'y': float(c[1])},
        {'x': float(c[0] + dL[0] * 500), 'y': float(c[1] + dL[1] * 500)},
    ],
    'vertexWorld': {'x': vx, 'z': vz},
}
json.dump(truth, open(os.path.join(OUT, 'truth.json'), 'w'), indent=2)
print(json.dumps(truth, indent=2))
