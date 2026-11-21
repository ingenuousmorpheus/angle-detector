// Prepare the Hi3D "Golden Angle Finder Pro" model (Angle Lens's own design) for the AR overlay.
//
//   node scripts/prepare-angle-finder-model.mjs <source.glb> <baseColor.jpg> <metalRough.jpg>
//
// The two images are the source textures downscaled for phones (see
// scripts/model-texture/README.md). The source is one fused ~2M-triangle mesh with
// a ruler arm (upper left), a long blade (right) and a dial below. This script:
//   1. splits the blade off the body so it can swing about the pivot,
//   2. fits the arm and blade centrelines and intersects them -> pivot,
//   3. simplifies each part to a phone-friendly size,
//   4. writes public/models/angle-finder.glb and src/ar/angleFinderRig.json.
// Presentation only: nothing here feeds the measurement maths.
import { NodeIO } from '@gltf-transform/core';
import { weld, simplify, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

const [src, baseImg, mrImg] = process.argv.slice(2);
if (!src || !baseImg || !mrImg) throw new Error('usage: node scripts/prepare-angle-finder-model.mjs <source.glb> <base.jpg> <mr.jpg>');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const outGlb = path.join(root, 'public/models/angle-finder.glb');
const outRig = path.join(root, 'src/ar/angleFinderRig.json');

await MeshoptSimplifier.ready;
const io = new NodeIO();
const doc = await io.read(src);
const docRoot = doc.getRoot();
const prim = docRoot.listMeshes()[0].listPrimitives()[0];
const pos = prim.getAttribute('POSITION').getArray();
const idx = prim.getIndices().getArray();
const triCount = idx.length / 3;
console.log('source triangles:', triCount);

const cen = new Float32Array(triCount * 3);
for (let t = 0; t < triCount; t++) {
  const a = idx[3 * t] * 3, b = idx[3 * t + 1] * 3, c = idx[3 * t + 2] * 3;
  for (let k = 0; k < 3; k++) cen[3 * t + k] = (pos[a + k] + pos[b + k] + pos[c + k]) / 3;
}
const all = [...Array(triCount).keys()];
const perp = (L, x, y) => (x - L.p.x) * -L.d.y + (y - L.p.y) * L.d.x;
const along = (L, x, y) => (x - L.p.x) * L.d.x + (y - L.p.y) * L.d.y;

/** Centreline of a straight strip from its outer silhouette (slice midpoints, least squares). */
function stripCentreline(sel, rough, u0, u1, step = 0.02) {
  const n = Math.hypot(rough.d.x, rough.d.y);
  const L = { p: rough.p, d: { x: rough.d.x / n, y: rough.d.y / n } };
  const mids = [];
  let half = 0;
  for (let u = u0; u < u1; u += step) {
    let lo = Infinity, hi = -Infinity;
    for (const t of sel) {
      const x = cen[3 * t], y = cen[3 * t + 1], a = along(L, x, y);
      if (a < u || a >= u + step) continue;
      const v = perp(L, x, y);
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    if (hi > lo) { mids.push([u + step / 2, (lo + hi) / 2]); half = Math.max(half, (hi - lo) / 2); }
  }
  const k = mids.length, su = mids.reduce((s, m) => s + m[0], 0), sv = mids.reduce((s, m) => s + m[1], 0);
  const suu = mids.reduce((s, m) => s + m[0] * m[0], 0), suv = mids.reduce((s, m) => s + m[0] * m[1], 0);
  const m = (k * suv - su * sv) / (k * suu - su * su), c = (sv - m * su) / k;
  const nx = -L.d.y, ny = L.d.x;
  const p = { x: L.p.x + c * nx, y: L.p.y + c * ny };
  const dl = Math.hypot(1, m);
  return { line: { p, d: { x: (L.d.x + m * nx) / dl, y: (L.d.y + m * ny) / dl } }, half, slices: k };
}

// --- blade: the long bar to the right. It sits behind the dial and the arm, in a
// depth band of its own (z about -0.045 .. -0.015); the short stub to the left of
// the hub is a separate, deeper piece and stays with the body.
const BLADE_Z = { min: -0.0475, max: -0.003 };
const roughBlade = { p: { x: 0.25, y: 0.1855 }, d: { x: 0.97, y: 0.243 } };
const farBlade = all.filter((t) => cen[3 * t] > 0.25 && cen[3 * t + 1] > 0.05);
const bladeFit = stripCentreline(farBlade, roughBlade, 0.0, 0.24);
const blade = bladeFit.line;
if (blade.d.x < 0) blade.d = { x: -blade.d.x, y: -blade.d.y };
const halfWidth = bladeFit.half + 0.01;

// --- arm: the ruler to the upper left, in front of everything but the hub.
const roughArm = { p: { x: -0.47, y: 0.35 }, d: { x: 0.826, y: -0.563 } };
const armSel = all.filter((t) => {
  const x = cen[3 * t], y = cen[3 * t + 1];
  return x < -0.22 && y > 0.12 && Math.abs(perp(roughArm, x, y)) < 0.09;
});
const armFit = stripCentreline(armSel, roughArm, 0.02, 0.22);
const arm = armFit.line;
if (arm.d.x > 0) arm.d = { x: -arm.d.x, y: -arm.d.y };
console.log('fit slices: blade', bladeFit.slices, 'arm', armFit.slices);

const den = blade.d.x * arm.d.y - blade.d.y * arm.d.x;
const s = ((arm.p.x - blade.p.x) * arm.d.y - (arm.p.y - blade.p.y) * arm.d.x) / den;
const pivot = { x: blade.p.x + s * blade.d.x, y: blade.p.y + s * blade.d.y };
const bladeFromPivot = { p: pivot, d: blade.d };

const isBlade = new Uint8Array(triCount);
for (const t of all) {
  const x = cen[3 * t], y = cen[3 * t + 1], z = cen[3 * t + 2];
  if (z < BLADE_Z.min || z > BLADE_Z.max) continue;
  // the blade flares where it meets the hub: allow a wider band there
  // (upper edge only: below it the dial rim sits in the same depth band)
  const pb = perp(blade, x, y);
  if (Math.abs(pb) > halfWidth + (pb > 0 && along(bladeFromPivot, x, y) < 0.35 ? 0.035 : 0)) continue;
  if (along(bladeFromPivot, x, y) < 0) continue; // the left stub is body
  isBlade[t] = 1;
}

let armLen = 0, bladeLen = 0;
for (const t of armSel) armLen = Math.max(armLen, along({ p: pivot, d: arm.d }, cen[3 * t], cen[3 * t + 1]));
for (const t of all) if (isBlade[t]) bladeLen = Math.max(bladeLen, along(bladeFromPivot, cen[3 * t], cen[3 * t + 1]));

// --- LCD: the large hexagonal display in the lower dial (glass at z ~ 0.025),
// measured from the dark front-facing texels and checked against renders.
const lcd = { cx: -0.003, cy: -0.203, w: 0.22, h: 0.1, angleDeg: 0, z: 0.032 };

const deg = (d) => (Math.atan2(d.y, d.x) * 180) / Math.PI;
const rig = {
  source: path.basename(src),
  pivot,
  armDirDeg: deg(arm.d),
  bladeDirDeg: deg(blade.d),
  includedDeg: ((deg(arm.d) - deg(blade.d)) % 360 + 360) % 360,
  armLength: armLen,
  bladeLength: bladeLen,
  bladeHalfWidth: halfWidth,
  lcd,
  note: 'Model units, front view (+z toward viewer). Generated by scripts/prepare-angle-finder-model.mjs; presentation only.',
};
console.log(JSON.stringify(rig, null, 2));
console.log('blade triangles:', isBlade.reduce((a, b) => a + b, 0), 'of', triCount);

// --- split into body + blade parts ----------------------------------------------
const uv = prim.getAttribute('TEXCOORD_0').getArray();
const buffer = docRoot.listBuffers()[0];
const material = prim.getMaterial();
material.getBaseColorTexture().setImage(new Uint8Array(fs.readFileSync(baseImg))).setMimeType('image/jpeg');
material.getMetallicRoughnessTexture().setImage(new Uint8Array(fs.readFileSync(mrImg))).setMimeType('image/jpeg');
const makePart = (name, want) => {
  const remap = new Int32Array(pos.length / 3).fill(-1);
  const p = [], u = [], ix = [];
  for (let t = 0; t < triCount; t++) {
    if (isBlade[t] !== want) continue;
    for (let k = 0; k < 3; k++) {
      const v = idx[3 * t + k];
      if (remap[v] < 0) { remap[v] = p.length / 3; p.push(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]); u.push(uv[2 * v], uv[2 * v + 1]); }
      ix.push(remap[v]);
    }
  }
  const prim2 = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor(name + '_pos').setType('VEC3').setArray(new Float32Array(p)).setBuffer(buffer))
    .setAttribute('TEXCOORD_0', doc.createAccessor(name + '_uv').setType('VEC2').setArray(new Float32Array(u)).setBuffer(buffer))
    .setIndices(doc.createAccessor(name + '_idx').setType('SCALAR').setArray(new Uint32Array(ix)).setBuffer(buffer))
    .setMaterial(material);
  return doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim2));
};
const scene = docRoot.listScenes()[0];
for (const n of scene.listChildren()) scene.removeChild(n);
scene.addChild(doc.createNode('angle-finder').addChild(makePart('body', 0)).addChild(makePart('blade', 1)));
await doc.transform(prune(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.08, error: 0.0005 }), prune(), dedup());
for (const m of docRoot.listMeshes()) console.log('part', m.getName(), m.listPrimitives()[0].getIndices().getCount() / 3, 'triangles');

fs.mkdirSync(path.dirname(outGlb), { recursive: true });
await io.write(outGlb, doc);
fs.writeFileSync(outRig, JSON.stringify(rig, null, 2) + '\n');
console.log('wrote', outGlb, (fs.statSync(outGlb).size / 1e6).toFixed(2), 'MB');
