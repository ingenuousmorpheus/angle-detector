import { describe, expect, it } from 'vitest';
import { renderAngleFixture } from '../src/fixtures/syntheticAngle';
import { snapToEdge } from '../src/vision/snapToEdge';
import { rgbaToGray, sobelAt } from '../src/vision/grayImage';

describe('snapToEdge (AD-02)', () => {
  const f = renderAngleFixture({ angleDeg: 90, rotationDeg: 0, width: 200, height: 200, thickness: 10 });
  // arm A runs along +x from (100,100): bar occupies y ∈ [95,105]

  it('moves a point near a bar onto its edge', () => {
    const s = snapToEdge(f.image, { x: 150, y: 89 }, { radius: 10 })!;
    expect(s).not.toBeNull();
    expect(Math.abs(s.y - 95)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(s.x - 150)).toBeLessThanOrEqual(10);
  });

  it('refuses to snap when there is no edge nearby', () => {
    expect(snapToEdge(f.image, { x: 30, y: 30 }, { radius: 10 })).toBeNull();
  });

  it('sobel is zero on flat regions and strong across the bar edge', () => {
    expect(sobelAt(f.image, 30, 30).mag).toBe(0);
    expect(sobelAt(f.image, 150, 95).mag).toBeGreaterThan(200);
  });

  it('rgbaToGray uses Rec.601 luma', () => {
    const g = rgbaToGray(new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]), 3, 1);
    expect([...g.data]).toEqual([76, 150, 29]) // Uint8ClampedArray rounds;
  });
});
