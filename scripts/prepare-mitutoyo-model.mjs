// Prepare the Hi3D Mitutoyo digital protractor scan for the AR overlay.
//
//   node scripts/prepare-mitutoyo-model.mjs "<source .glb>"
//
// The source is one fused ~2M-triangle mesh. This script:
//   1. simplifies it to a phone-friendly size,
//   2. splits the long blade off the body so the blade can swing about the pivot,
//   3. fits the short arm and the blade centrelines (PCA) and intersects them -> pivot,
//   4. writes public/models/mitutoyo-protractor.glb and src/ar/mitutoyoRig.json.
// Presentation only: nothing here feeds the measurement maths.
import { NodeIO } from '@gltf-transform/core';
import { weld, simplify, prune, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src) throw new Error('usage: node scripts/prepare-mitutoyo-model.mjs <source.glb>');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const outGlb = path.join(root, 'public/models/mitutoyo-protractor.glb');
const outRig = path.join(root, 'src/ar/mitutoyoRig.json');

await MeshoptSimplifier.ready;
const io = new NodeIO();
const doc = await io.read(src);
// Classify on the full-resolution mesh (small triangles), simplify each part afterwards.

const docRoot = doc.getRoot();
const mesh = docRoot.listMeshes()[0];
const prim = mesh.listPrimitives()[0];
const pos = prim.getAttribute('POSITION').getArray();
const idx = prim.getIndices().getArray();
const triCount = idx.length / 3;
console.log('source triangles:', triCount, 'vertices:', pos.length / 3);

const cen = new Float32Array(triCount * 3);
const area = new Float32Array(triCount);
for (let t = 0; t < triCount; t++) {
  const a = idx[3 * t] * 3, b = idx[3 * t + 1] * 3, c = idx[3 * t + 2] * 3;
  for (let k = 0; k < 3; k++) cen[3 * t + k] = (pos[a + k] + pos[b + k] + pos[c + k]) / 3;
  const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
  const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
  area[t] = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

/** Area-weighted PCA line fit of triangle centroids (x, y). */
function fitLine(sel) {
  let w = 0, mx = 0, my = 0;
  for (const t of sel) { w += area[t]; mx += area[t] * cen[3 * t]; my += area[t] * cen[3 * t + 1]; }
  mx /= w; my /= w;
  let sxx = 0, sxy = 0, syy = 0;
  for (const t of sel) {
    const dx = cen[3 * t] - mx, dy = cen[3 * t + 1] - my;
    sxx += area[t] * dx * dx; sxy += area[t] * dx * dy; syy += area[t] * dy * dy;
  }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { p: { x: mx, y: my }, d: { x: Math.cos(ang), y: Math.sin(ang) } };
}
const perp = (L, x, y) => (x - L.p.x) * -L.d.y + (y - L.p.y) * L.d.x;
const along = (L, x, y) => (x - L.p.x) * L.d.x + (y - L.p.y) * L.d.y;
const all = [...Array(triCount).keys()];

/**
 * Centreline of a straight strip from its outer silhouette: slice along a rough axis,
 * take the min/max offset of the selected triangles in each slice, fit a line through
 * the slice midpoints. Robust to uneven triangle density (unlike PCA on centroids).
 */
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
  // least squares v = c + m u, then back to model xy
  const k = mids.length, su = mids.reduce((s, m) => s + m[0], 0), sv = mids.reduce((s, m) => s + m[1], 0);
  const suu = mids.reduce((s, m) => s + m[0] * m[0], 0), suv = mids.reduce((s, m) => s + m[0] * m[1], 0);
  const m = (k * suv - su * sv) / (k * suu - su * su), c = (sv - m * su) / k;
  const nx = -L.d.y, ny = L.d.x; // perp direction used by perp()
  const p = { x: L.p.x + c * nx, y: L.p.y + c * ny };
  const dl = Math.hypot(1, m);
  const d = { x: (L.d.x + m * nx) / dl, y: (L.d.y + m * ny) / dl };
  return { line: { p, d }, half, slices: k };
}

// --- blade -------------------------------------------------------------------------
const DISK = { x: -0.065, y: -0.14, r: 0.22 };
const roughBlade = { p: { x: -0.4, y: -0.0025 }, d: { x: 0.881, y: 0.199 } };
// Right of the dial (x > 0.2) the only part is the blade, bevelled edges included.
const farBlade = all.filter((t) => cen[3 * t] > 0.2 && Math.abs(perp({ p: roughBlade.p, d: { x: 0.9754, y: 0.2203 } }, cen[3 * t], cen[3 * t + 1])) < 0.1);
const bladeFit = stripCentreline(farBlade, roughBlade, 0.6, 0.9);
let blade = bladeFit.line;
const halfWidth = bladeFit.half + 0.012; // centroids sit inside the silhouette; edge triangles reach further
const bladeZMax = farBlade.reduce((m, t) => Math.max(m, cen[3 * t + 2]), -Infinity);
const outsideDisk = (t) => Math.hypot(cen[3 * t] - DISK.x, cen[3 * t + 1] - DISK.y) > DISK.r;
const isBlade = new Uint8Array(triCount);
for (const t of all) {
  const x = cen[3 * t], y = cen[3 * t + 1], z = cen[3 * t + 2];
  // the generated blade bends slightly left of the dial: allow a wider band there
  if (Math.abs(perp(blade, x, y)) > halfWidth + (x < -0.22 ? 0.025 : 0)) continue;
  if (!outsideDisk(t)) continue;
  if (z > bladeZMax + 0.004) continue; // knob, arm and body sit in front of the blade
  isBlade[t] = 1;
}

// --- short arm: upper-left strip, above the blade -----------------------------------
const roughArm = { p: { x: -0.4875, y: 0.304 }, d: { x: 0.425, y: -0.225 } };
const roughArmN = { p: roughArm.p, d: { x: 0.8838, y: -0.4679 } };
const armSel = all.filter((t) => {
  const x = cen[3 * t], y = cen[3 * t + 1];
  return x < -0.2 && !isBlade[t] && outsideDisk(t) && perp(blade, x, y) > halfWidth && Math.abs(perp(roughArmN, x, y)) < 0.08;
});
const armFit = stripCentreline(armSel, roughArm, 0.0, 0.28);
const arm = armFit.line;
console.log('fit slices: blade', bladeFit.slices, 'arm', armFit.slices, 'arm half-width', armFit.half.toFixed(4));
// orient: blade points to +x (right tip), arm points to its far (upper-left) end
if (blade.d.x < 0) blade.d = { x: -blade.d.x, y: -blade.d.y };
if (arm.d.x > 0) arm.d = { x: -arm.d.x, y: -arm.d.y };

// pivot = intersection of the two centrelines
const den = blade.d.x * arm.d.y - blade.d.y * arm.d.x;
const s = ((arm.p.x - blade.p.x) * arm.d.y - (arm.p.y - blade.p.y) * arm.d.x) / den;
const pivot = { x: blade.p.x + s * blade.d.x, y: blade.p.y + s * blade.d.y };

let armLen = 0, bladeLen = 0;
for (const t of armSel) armLen = Math.max(armLen, along({ p: pivot, d: arm.d }, cen[3 * t], cen[3 * t + 1]));
for (const t of all) if (isBlade[t]) bladeLen = Math.max(bladeLen, along({ p: pivot, d: blade.d }, cen[3 * t], cen[3 * t + 1]));

// --- LCD window (from the front render), z = front surface ---------------------
const lcd = { x0: -0.185, x1: -0.032, y0: -0.258, y1: -0.157 };
let lcdZ = -Infinity;
for (let v = 0; v < pos.length; v += 3) {
  if (pos[v] > lcd.x0 + 0.02 && pos[v] < lcd.x1 - 0.02 && pos[v + 1] > lcd.y0 + 0.02 && pos[v + 1] < lcd.y1 - 0.02) lcdZ = Math.max(lcdZ, pos[v + 2]);
}

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
  lcd: { ...lcd, z: lcdZ },
  note: 'Model units, front view (+z toward viewer). Generated by scripts/prepare-mitutoyo-model.mjs; presentation only.',
};
console.log(JSON.stringify(rig, null, 2));
console.log('blade triangles:', isBlade.reduce((a, b) => a + b, 0), 'of', triCount);

// --- split into body + blade parts, each with its own compacted vertices ---------
const uv = prim.getAttribute('TEXCOORD_0').getArray();
const buffer = docRoot.listBuffers()[0];
const material = prim.getMaterial();
material.setMetallicRoughnessTexture(null); // rendered unlit: the scan's lighting is baked into the base colour
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
const top = doc.createNode('mitutoyo').addChild(makePart('body', 0)).addChild(makePart('blade', 1));
scene.addChild(top);
await doc.transform(prune(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: 0.1, error: 0.0006 }), prune(), dedup());
for (const m of docRoot.listMeshes()) console.log('part', m.getName(), m.listPrimitives()[0].getIndices().getCount() / 3, 'triangles');

fs.mkdirSync(path.dirname(outGlb), { recursive: true });
fs.mkdirSync(path.dirname(outRig), { recursive: true });
await io.write(outGlb, doc);
fs.writeFileSync(outRig, JSON.stringify(rig, null, 2) + '\n');
console.log('wrote', outGlb, (fs.statSync(outGlb).size / 1e6).toFixed(2), 'MB');
