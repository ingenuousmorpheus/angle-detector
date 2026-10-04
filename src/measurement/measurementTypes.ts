import type { AngleConvention, Vec2 } from '../geometry/angle2d';

export type MeasurementMode = 'apparent-2d' | 'plane-corrected' | 'ar-3d';

/** Where the geometry came from. The degree value is always computed, never taken from the source. */
export type MeasurementSource = 'manual' | 'edge-detector' | 'ai-hint';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Measurement result that survives the move from browser camera to AR (anglelensession §9).
 * 2D coordinates are normalized [0,1] in the displayed (object-cover) frame.
 */
export interface AngleMeasurement {
  found: boolean;
  /** Interior (included) angle at the vertex, degrees [0,180]. */
  angleDeg: number | null;
  supplementDeg: number | null;
  /** Value in the convention the user selected. */
  displayDeg: number | null;
  convention: AngleConvention;

  vertex2D?: Vec2;
  /** [vertex, point along the edge] for each arm. */
  edgeA2D?: [Vec2, Vec2];
  edgeB2D?: [Vec2, Vec2];

  /** 0..1, from geometric evidence only. */
  confidence: number;
  /** 0..1, temporal stability (1 for a single frozen frame). */
  stability: number;
  mode: MeasurementMode;
  source: MeasurementSource;

  reason?: string;

  vertex3D?: Vec3;
  normalA?: Vec3;
  normalB?: Vec3;
}
