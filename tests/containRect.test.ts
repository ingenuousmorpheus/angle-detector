/**
 * containRect.test.ts — P1 regression: frozen-frame aspect-ratio safety.
 *
 * Codex FAIL: the frozen image stretched when the container aspect changed
 * (portrait 3:4 ↔ landscape 16:9) after freezing, while points stayed in
 * container-normalized coordinates and the geometry used original image
 * dimensions — a 45° bend no longer measured 45°.
 *
 * These tests prove the fix: points are image-normalized, the image is
 * letterboxed (never stretched), and the measured angle is invariant under
 * container rotation. Includes the 45° fixture Codex asked for, plus points
 * placed before AND after a rotation.
 */
import { describe, expect, it } from 'vitest';
import { containRect, toContainerPx, toImageNorm } from '../src/render/containRect';
import { renderAngleFixture } from '../src/fixtures/syntheticAngle';
import { measureFromPoints } from '../src/measurement/measureFromPoints';
import type { Vec2 } from '../src/geometry/angle2d';

describe('containRect', () => {
  it('fills when aspects match (portrait 3:4 image in 3:4 container)', () => {
    const r = containRect(390, 520, 480, 640);
    expect(r.x).toBeCloseTo(0, 6);
    expect(r.y).toBeCloseTo(0, 6);
    expect(r.w).toBeCloseTo(390, 6);
    expect(r.h).toBeCloseTo(520, 6);
  });

  it('letterboxes a portrait image in a landscape container (no stretch)', () => {
    const r = containRect(693, 390, 480, 640);
    // scale = min(693/480, 390/640) = min(1.444, 0.609) = 0.609
    expect(r.h).toBeCloseTo(390, 6);
    expect(r.w).toBeCloseTo(480 * (390 / 640), 6);
    expect(r.x).toBeCloseTo((693 - r.w) / 2, 6);
    expect(r.y).toBeCloseTo(0, 6);
    // aspect preserved
    expect(r.w / r.h).toBeCloseTo(480 / 640, 9);
  });

  it('returns zeros for degenerate inputs', () => {
    expect(containRect(0, 520, 480, 640)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(containRect(390, 520, 0, 640)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe('coordinate round-trip', () => {
  it('toImageNorm ∘ toContainerPx is identity inside the image', () => {
    const imgRect = containRect(693, 390, 480, 640);
    const p: Vec2 = { x: 0.25, y: 0.75 };
    const c = toContainerPx(p, imgRect);
    const back = toImageNorm(c.x, c.y, 0, 0, imgRect);
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
  });

  it('taps on the letterbox bars clamp to the image edge', () => {
    const imgRect = containRect(693, 390, 480, 640);
    // far left of the image (in the letterbox bar)
    const p = toImageNorm(10, 195, 0, 0, imgRect);
    expect(p.x).toBe(0);
    expect(p.y).toBeCloseTo(0.5, 6);
  });
});

describe('P1 regression: 45° fixture across rotation', () => {
  // 45° bend, 3:4 image — the geometry Codex asked for.
  const fx = renderAngleFixture({ angleDeg: 45, width: 480, height: 640, seed: 11 });
  const truth = fx.truth.points; // [edgeA, vertex, edgeB] in image pixels
  const truthNorm: [Vec2, Vec2, Vec2] = [
    { x: truth[0].x / 480, y: truth[0].y / 640 },
    { x: truth[1].x / 480, y: truth[1].y / 640 },
    { x: truth[2].x / 480, y: truth[2].y / 640 },
  ];
  const angleOf = (pts: [Vec2, Vec2, Vec2]) =>
    measureFromPoints(pts[0], pts[1], pts[2], {
      frameWidth: 480,
      frameHeight: 640,
      convention: 'interior',
    }).displayDeg ?? NaN;

  it('measures 45° in portrait', () => {
    expect(angleOf(truthNorm)).toBeCloseTo(45, 1);
  });

  it('same normalized points still measure 45° after rotation to landscape', () => {
    // Rotation only re-letterboxes; image-normalized points are untouched.
    const portraitRect = containRect(390, 520, 480, 640);
    const landscapeRect = containRect(693, 390, 480, 640);
    // Where the truth points appear on screen in each orientation:
    const portraitPx = truthNorm.map((p) => toContainerPx(p, portraitRect));
    const landscapePx = truthNorm.map((p) => toContainerPx(p, landscapeRect));
    // They move on screen (different letterbox), but normalize back identically:
    for (let i = 0; i < 3; i++) {
      const back = toImageNorm(landscapePx[i].x, landscapePx[i].y, 0, 0, landscapeRect);
      expect(back.x).toBeCloseTo(truthNorm[i].x, 9);
      expect(back.y).toBeCloseTo(truthNorm[i].y, 9);
    }
    expect(portraitPx[0].x).not.toBeCloseTo(landscapePx[0].x, 0); // sanity: layout changed
    expect(angleOf(truthNorm)).toBeCloseTo(45, 1);
  });

  it('a point placed AFTER rotation maps to the correct image location', () => {
    const landscapeRect = containRect(693, 390, 480, 640);
    // Operator taps the on-screen location of the vertex (after rotation).
    const tapPx = toContainerPx(truthNorm[1], landscapeRect);
    const placed = toImageNorm(tapPx.x, tapPx.y, 0, 0, landscapeRect);
    expect(placed.x).toBeCloseTo(truthNorm[1].x, 9);
    expect(placed.y).toBeCloseTo(truthNorm[1].y, 9);
    // Full triple placed post-rotation still measures 45°.
    const placedTriple = truthNorm.map((p) => {
      const c = toContainerPx(p, landscapeRect);
      return toImageNorm(c.x, c.y, 0, 0, landscapeRect);
    }) as [Vec2, Vec2, Vec2];
    expect(angleOf(placedTriple)).toBeCloseTo(45, 1);
  });

  it('the old stretch behavior would have broken the 45° (fix matters)', () => {
    // OLD (buggy): image stretched to fill landscape container; points placed
    // in container-normalized coords; geometry uses original image dims.
    const landscapeRect = containRect(693, 390, 480, 640);
    const tapPx = toContainerPx(truthNorm[0], landscapeRect); // where edgeA appears
    // Buggy mapping: container-normalized (stretch), as the old toNorm did:
    const buggyNorm: Vec2 = { x: tapPx.x / 693, y: tapPx.y / 390 };
    // Correct mapping:
    const fixedNorm = toImageNorm(tapPx.x, tapPx.y, 0, 0, landscapeRect);
    // They differ — the old code placed the point at the wrong image location:
    expect(Math.abs(buggyNorm.x - fixedNorm.x)).toBeGreaterThan(0.05);
  });

  it('portrait → landscape → portrait is stable', () => {
    const r1 = containRect(390, 520, 480, 640);
    const r2 = containRect(693, 390, 480, 640);
    const r3 = containRect(390, 520, 480, 640);
    expect(r3).toEqual(r1);
    const p2 = toImageNorm(
      toContainerPx(truthNorm[0], r2).x,
      toContainerPx(truthNorm[0], r2).y,
      0, 0, r2,
    );
    const p3 = toImageNorm(
      toContainerPx(p2, r3).x,
      toContainerPx(p2, r3).y,
      0, 0, r3,
    );
    expect(p3.x).toBeCloseTo(truthNorm[0].x, 9);
    expect(p3.y).toBeCloseTo(truthNorm[0].y, 9);
  });
});