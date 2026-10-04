import { angleFromPoints, distance, toConvention, type AngleConvention, type Vec2 } from '../geometry/angle2d';
import type { AngleMeasurement, MeasurementSource } from './measurementTypes';

export interface MeasureFromPointsOptions {
  convention?: AngleConvention;
  source?: MeasurementSource;
  /** Frame size in pixels. Normalized space is anisotropic for non-square frames, so the angle is computed in pixels. */
  frameWidth: number;
  frameHeight: number;
  /** Arms shorter than this (pixels) are refused. */
  minArmPx?: number;
}

/**
 * Deterministic measurement from three normalized points [A, vertex, B].
 * Fails closed on degenerate input instead of returning a number.
 */
export function measureFromPoints(a: Vec2, vertex: Vec2, b: Vec2, opts: MeasureFromPointsOptions): AngleMeasurement {
  const convention = opts.convention ?? 'interior';
  const minArm = opts.minArmPx ?? 12;
  const toPx = (p: Vec2) => ({ x: p.x * opts.frameWidth, y: p.y * opts.frameHeight });
  const armA = distance(toPx(a), toPx(vertex));
  const armB = distance(toPx(b), toPx(vertex));
  const base = {
    convention,
    stability: 1,
    mode: 'apparent-2d' as const,
    source: opts.source ?? ('manual' as const),
    vertex2D: vertex,
    edgeA2D: [vertex, a] as [Vec2, Vec2],
    edgeB2D: [vertex, b] as [Vec2, Vec2],
  };
  if (armA < Math.max(minArm, 1e-9) || armB < Math.max(minArm, 1e-9)) {
    return {
      ...base,
      found: false,
      angleDeg: null,
      supplementDeg: null,
      displayDeg: null,
      confidence: 0,
      reason: 'Arm too short — move the handle further from the vertex',
    };
  }
  const angleDeg = angleFromPoints(toPx(a), toPx(vertex), toPx(b));
  return {
    ...base,
    found: true,
    angleDeg,
    supplementDeg: 180 - angleDeg,
    displayDeg: toConvention(angleDeg, convention),
    // Manual placement: the operator is the edge detector, so confidence reflects arm length
    // only (a 1 px placement error moves the angle ≈1.4° on a 40 px arm, ≈0.3° on a 200 px arm).
    confidence: Math.min(1, Math.min(armA, armB) / 200),
  };
}
