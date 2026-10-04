import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  angleBetweenLines,
  angleBetweenVectors,
  angleFromPoints,
  distanceToLine,
  exterior,
  lineIntersection,
  normalizedToPixel,
  pixelToNormalized,
  signedAngle,
  supplement,
  toConvention,
} from '../src/geometry/angle2d';
import { fitLine } from '../src/geometry/lineFit';
import { coverCrop, displayNormToVideo, videoToDisplayNorm } from '../src/camera/cameraTransform';
import { measureFromPoints } from '../src/measurement/measureFromPoints';
import { STANDARD_FIXTURE_ANGLES, standardFixtureSet } from '../src/fixtures/syntheticAngle';

const rad = (d: number) => (d * Math.PI) / 180;
const dir = (d: number) => ({ x: Math.cos(rad(d)), y: Math.sin(rad(d)) });

describe('angle2d (AD-01)', () => {
  it.each(STANDARD_FIXTURE_ANGLES)('three-point angle reproduces %d° at many rotations and scales', (deg) => {
    for (const rot of [0, 13, 90, 181, 270, 359]) {
      for (const len of [0.01, 1, 1000]) {
        const v = { x: 3.5, y: -7 };
        const a = { x: v.x + dir(rot).x * len, y: v.y + dir(rot).y * len };
        const b = { x: v.x + dir(rot + deg).x * len * 2.3, y: v.y + dir(rot + deg).y * len * 2.3 };
        expect(angleFromPoints(a, v, b)).toBeCloseTo(deg, 9);
      }
    }
  });

  it('is accurate near 0° and 180° (atan2, not acos)', () => {
    expect(angleBetweenVectors({ x: 1, y: 0 }, dir(1e-7))).toBeCloseTo(1e-7, 12);
    expect(angleBetweenVectors({ x: 1, y: 0 }, dir(180 - 1e-7))).toBeCloseTo(180 - 1e-7, 9);
    expect(angleBetweenVectors({ x: 1, y: 0 }, { x: -1, y: 0 })).toBe(180);
  });

  it('refuses zero-length vectors', () => {
    expect(() => angleBetweenVectors({ x: 0, y: 0 }, { x: 1, y: 0 })).toThrow(RangeError);
  });

  it('signed angle and line angle', () => {
    expect(signedAngle({ x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
    expect(signedAngle({ x: 1, y: 0 }, { x: 0, y: -1 })).toBeCloseTo(-90);
    expect(angleBetweenLines(dir(0), dir(150))).toBeCloseTo(30);
  });

  it('conventions are explicit and reversible', () => {
    expect(supplement(47.1)).toBeCloseTo(132.9);
    expect(exterior(47.1)).toBeCloseTo(312.9);
    expect(toConvention(47.1, 'interior')).toBe(47.1);
    expect(toConvention(47.1, 'supplement')).toBeCloseTo(132.9);
    expect(toConvention(47.1, 'exterior')).toBeCloseTo(312.9);
  });

  it('line intersection', () => {
    const p = lineIntersection({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 4, y: 0 }, { x: -1, y: 1 });
    expect(p!.x).toBeCloseTo(2);
    expect(p!.y).toBeCloseTo(2);
    expect(lineIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 0 })).toBeNull();
    expect(distanceToLine({ x: 0, y: 5 }, { x: -3, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(5);
  });

  it('normalized ↔ pixel round-trips', () => {
    const p = { x: 0.31, y: 0.77 };
    const q = pixelToNormalized(normalizedToPixel(p, 1280, 720), 1280, 720);
    expect(q.x).toBeCloseTo(p.x, 12);
    expect(q.y).toBeCloseTo(p.y, 12);
  });
});

describe('lineFit (AD-01)', () => {
  it.each([0, 30, 89.9, 90, 135, 179])('fits a %d° line exactly, including vertical', (deg) => {
    const pts = Array.from({ length: 50 }, (_, i) => ({ x: 10 + dir(deg).x * i, y: 20 + dir(deg).y * i }));
    const f = fitLine(pts)!;
    expect(angleBetweenLines(f.direction, dir(deg))).toBeLessThan(1e-6);
    expect(f.maxResidual).toBeLessThan(1e-9);
    expect(f.span).toBeCloseTo(49);
  });

  it('reports residuals for noisy points', () => {
    const pts = Array.from({ length: 200 }, (_, i) => ({ x: i, y: (i % 2 ? 1 : -1) }));
    const f = fitLine(pts)!;
    expect(angleBetweenLines(f.direction, { x: 1, y: 0 })).toBeLessThan(0.01);
    expect(f.rmsResidual).toBeCloseTo(1, 2);
  });

  it('returns null for degenerate input', () => {
    expect(fitLine([{ x: 1, y: 1 }])).toBeNull();
    expect(fitLine([{ x: 1, y: 1 }, { x: 1, y: 1 }])).toBeNull();
  });
});

describe('cameraTransform (AD-01)', () => {
  it('matches the object-cover crop the app already uses', () => {
    // 1280x720 video in a 4:3 box → sides cropped
    expect(coverCrop(1280, 720, 800, 600)).toEqual({ sx: 160, sy: 0, sw: 960, sh: 720 });
    // 720x1280 portrait video in a 16:9 box → top/bottom cropped
    const c = coverCrop(720, 1280, 1600, 900);
    expect(c.sx).toBe(0);
    expect(c.sw).toBe(720);
    expect(c.sh).toBeCloseTo(405);
  });

  it('round-trips display ↔ video coordinates', () => {
    const crop = coverCrop(1920, 1080, 390, 844);
    const p = { x: 0.2, y: 0.9 };
    const q = videoToDisplayNorm(displayNormToVideo(p, crop), crop);
    expect(q.x).toBeCloseTo(p.x, 12);
    expect(q.y).toBeCloseTo(p.y, 12);
  });
});

describe('measureFromPoints (AD-01)', () => {
  it('measures every synthetic fixture exactly from its truth points', () => {
    for (const f of standardFixtureSet({ width: 320, height: 180 })) {
      const { width, height } = f.image;
      const [a, v, b] = f.truth.points.map((p) => pixelToNormalized(p, width, height));
      const m = measureFromPoints(a, v, b, { frameWidth: width, frameHeight: height });
      expect(m.found).toBe(true);
      expect(m.angleDeg!).toBeCloseTo(f.truth.angleDeg, 9);
      expect(m.mode).toBe('apparent-2d');
    }
  });

  it('computes in pixel space so a non-square frame does not skew the angle', () => {
    // 45° in pixels on a 1280x720 frame; in normalized units it would read ~29.4°
    const m = measureFromPoints({ x: 0.75, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.75, y: 0.5 - 320 / 720 }, { frameWidth: 1280, frameHeight: 720 });
    expect(m.angleDeg!).toBeCloseTo(45, 9);
  });

  it('applies the selected convention without touching angleDeg', () => {
    const m = measureFromPoints({ x: 0.9, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.1 }, { frameWidth: 1000, frameHeight: 1000, convention: 'supplement' });
    expect(m.angleDeg!).toBeCloseTo(90);
    expect(m.displayDeg!).toBeCloseTo(90);
    expect(m.convention).toBe('supplement');
  });

  it('fails closed on a too-short arm', () => {
    const m = measureFromPoints({ x: 0.501, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.1 }, { frameWidth: 1000, frameHeight: 1000 });
    expect(m.found).toBe(false);
    expect(m.angleDeg).toBeNull();
    expect(m.reason).toMatch(/short/);
  });

  it('reproduces the Mitutoyo fixture blade angle from its truth points', () => {
    const t = JSON.parse(readFileSync('fixtures/mitutoyo-digital-protractor/truth.json', 'utf8'));
    const [a, v, b] = t.points.map((p: { x: number; y: number }) => pixelToNormalized(p, t.width, t.height));
    const m = measureFromPoints(a, v, b, { frameWidth: t.width, frameHeight: t.height });
    expect(m.angleDeg!).toBeCloseTo(t.includedAngleDeg, 2);
    expect(m.supplementDeg!).toBeCloseTo(t.supplementDeg, 2);
  });
});
