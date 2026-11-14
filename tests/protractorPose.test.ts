import { describe, expect, it } from 'vitest';
import { approachAngle, protractorPose, type ProtractorRig } from '../src/ar/protractorPose';
import rigJson from '../src/ar/mitutoyoRig.json';

const rig: ProtractorRig = { pivot: { x: 0, y: 0 }, armDirDeg: 150, bladeDirDeg: 15 };
const v = { x: 100, y: 100 };
const at = (deg: number, r = 50) => ({ x: v.x + r * Math.cos((deg * Math.PI) / 180), y: v.y - r * Math.sin((deg * Math.PI) / 180) });

/** Final on-screen directions (y-up degrees) of the arm and blade for a pose. */
const norm = (d: number) => ((d % 360) + 360) % 360;
/** Mirroring maps a model direction d to 180 - d before the body rotation (as three.js scale.x = -1 does). */
const finalDirs = (p: ReturnType<typeof protractorPose>, r: ProtractorRig) => {
  const m = (d: number) => (p.mirrored ? 180 - d : d);
  return {
    arm: norm(m(r.armDirDeg) + p.bodyRotationDeg),
    blade: norm(m(r.bladeDirDeg + p.bladeRotationDeg) + p.bodyRotationDeg),
  };
};

describe('protractorPose', () => {
  it('opens the blade to the interior angle between the edges', () => {
    for (const [a, b] of [[0, 90], [180, 45], [200, 330], [10, 170], [270, 300]]) {
      const p = protractorPose(v, at(a), at(b), rig);
      const expected = Math.abs((((b - a + 180) % 360) + 360) % 360 - 180);
      expect(p.openingDeg).toBeCloseTo(expected, 6);
    }
  });

  it('lays the arm and blade exactly along the two edges', () => {
    for (const [a, b] of [[0, 90], [180, 45], [200, 330], [123, 17], [180, -30], [-30, 180], [90, 270.5]]) {
      const p = protractorPose(v, at(a), at(b), rig);
      const d = finalDirs(p, rig);
      const [armEdge, bladeEdge] = p.swapped ? [b, a] : [a, b];
      expect(Math.abs((((d.arm - armEdge + 180) % 360) + 360) % 360 - 180)).toBeLessThan(1e-6);
      expect(Math.abs((((d.blade - bladeEdge + 180) % 360) + 360) % 360 - 180)).toBeLessThan(1e-6);
    }
  });

  it('mirrors when that makes the dial more upright', () => {
    // edge A to the right, edge B straight up: unmirrored needs ~-150 deg body rotation
    const p = protractorPose(v, at(0), at(90), rig);
    expect(p.mirrored).toBe(true);
    expect(Math.abs(p.bodyRotationDeg)).toBeLessThan(90);
  });

  it('leaves the generated model unrotated at its own included angle', () => {
    const r = rigJson as ProtractorRig;
    const included = r.armDirDeg - r.bladeDirDeg;
    const p = protractorPose(v, at(r.armDirDeg), at(r.armDirDeg - included), r);
    expect(p.bodyRotationDeg).toBeCloseTo(0, 6);
    expect(p.bladeRotationDeg).toBeCloseTo(0, 6);
  });

  it('smooths angles along the shortest path', () => {
    expect(approachAngle(170, -170, 0.5)).toBeCloseTo(180, 6);
    expect(approachAngle(10, 30, 0.25)).toBeCloseTo(15, 6);
  });
});
