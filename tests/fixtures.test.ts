import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderAngleFixture, standardFixtureSet, STANDARD_FIXTURE_ANGLES } from '../src/fixtures/syntheticAngle';

const px = (img: { width: number; data: Uint8ClampedArray }, x: number, y: number) =>
  img.data[Math.round(y) * img.width + Math.round(x)];

describe('synthetic angle fixtures (AD-00)', () => {
  it('covers every roadmap angle', () => {
    expect([...STANDARD_FIXTURE_ANGLES]).toEqual([15, 30, 45, 60, 75, 90, 105, 120, 135, 150]);
    expect(standardFixtureSet({ width: 160, height: 90 })).toHaveLength(30);
  });

  it.each(STANDARD_FIXTURE_ANGLES)('%d° truth directions are exactly the requested angle apart', (angleDeg) => {
    const f = renderAngleFixture({ angleDeg, rotationDeg: 37, width: 200, height: 120 });
    const { dirA, dirB } = f.truth;
    const between = (Math.acos(dirA.x * dirB.x + dirA.y * dirB.y) * 180) / Math.PI;
    expect(between).toBeCloseTo(angleDeg, 9);
  });

  it('draws the bars where the truth says they are', () => {
    const f = renderAngleFixture({ angleDeg: 60, rotationDeg: 10, width: 320, height: 180, thickness: 8 });
    const [a, v, b] = f.truth.points;
    expect(px(f.image, v.x, v.y)).toBe(200);
    expect(px(f.image, a.x, a.y)).toBe(200);
    expect(px(f.image, b.x, b.y)).toBe(200);
    // bisector, far from both bars → background
    const bis = { x: f.truth.dirA.x + f.truth.dirB.x, y: f.truth.dirA.y + f.truth.dirB.y };
    const n = Math.hypot(bis.x, bis.y);
    expect(px(f.image, v.x + (bis.x / n) * 50, v.y + (bis.y / n) * 50)).toBe(40);
  });

  it('is deterministic, including noise', () => {
    const a = renderAngleFixture({ angleDeg: 45, noise: 12, seed: 7, width: 64, height: 64 });
    const b = renderAngleFixture({ angleDeg: 45, noise: 12, seed: 7, width: 64, height: 64 });
    expect(Buffer.from(a.image.data).equals(Buffer.from(b.image.data))).toBe(true);
  });
});

describe('Mitutoyo digital protractor fixture (AD-00)', () => {
  const truth = JSON.parse(readFileSync('fixtures/mitutoyo-digital-protractor/truth.json', 'utf8'));

  it('stores blade geometry as ground truth, separate from the LCD texture', () => {
    expect(truth.includedAngleDeg).toBeCloseTo(134.646, 2);
    expect(truth.includedAngleDeg + truth.supplementDeg).toBeCloseTo(180, 6);
    expect(truth.lcdTextureReadingDeg).toBe(101.5);
    // the generated LCD number is far outside the geometric uncertainty — never use it as truth
    expect(Math.abs(truth.includedAngleDeg - truth.lcdTextureReadingDeg)).toBeGreaterThan(10 * truth.uncertaintyDeg);
  });

  it('places the vertex under the center target', () => {
    expect(truth.points[1]).toEqual({ x: truth.width / 2, y: truth.height / 2 });
  });
});
