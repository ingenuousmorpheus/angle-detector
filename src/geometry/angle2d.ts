/**
 * Deterministic 2D angle math (AD-01 / AL-01).
 *
 * Zero dependencies on React, Gemini, camera or AR APIs. Every degree value the app
 * shows as a measurement must come from here (or a future angle3d.ts), never from an AI model.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export const RAD_TO_DEG = 180 / Math.PI;
export const DEG_TO_RAD = Math.PI / 180;

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
/** z component of the 3D cross product. */
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const length = (a: Vec2): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export function normalize(a: Vec2): Vec2 {
  const l = length(a);
  if (l === 0) throw new RangeError('cannot normalize a zero vector');
  return { x: a.x / l, y: a.y / l };
}

/**
 * Unsigned angle between two vectors, degrees in [0, 180].
 * atan2(|u×v|, u·v) stays accurate near 0° and 180°, where acos loses precision.
 */
export function angleBetweenVectors(u: Vec2, v: Vec2): number {
  if (length(u) === 0 || length(v) === 0) throw new RangeError('angle undefined for a zero-length vector');
  return Math.atan2(Math.abs(cross(u, v)), dot(u, v)) * RAD_TO_DEG;
}

/** Interior angle at vertex V formed by A–V–B, degrees in [0, 180]. */
export function angleFromPoints(a: Vec2, vertex: Vec2, b: Vec2): number {
  return angleBetweenVectors(sub(a, vertex), sub(b, vertex));
}

/** Signed angle from u to v, degrees in (-180, 180]. Positive = clockwise on screen (y down). */
export function signedAngle(u: Vec2, v: Vec2): number {
  return Math.atan2(cross(u, v), dot(u, v)) * RAD_TO_DEG;
}

/** Angle between two undirected lines, degrees in [0, 90]. */
export function angleBetweenLines(dirA: Vec2, dirB: Vec2): number {
  const a = angleBetweenVectors(dirA, dirB);
  return a > 90 ? 180 - a : a;
}

export type AngleConvention = 'interior' | 'supplement' | 'exterior';

export const supplement = (deg: number): number => 180 - deg;
/** Reflex / exterior angle around the vertex. */
export const exterior = (deg: number): number => 360 - deg;

/** Convert an interior angle to a named convention. Never applied silently — callers pick. */
export function toConvention(interiorDeg: number, convention: AngleConvention): number {
  switch (convention) {
    case 'interior':
      return interiorDeg;
    case 'supplement':
      return supplement(interiorDeg);
    case 'exterior':
      return exterior(interiorDeg);
  }
}

/**
 * Intersection of two infinite lines given as point + direction.
 * Returns null when the lines are parallel within `epsilonDeg`.
 */
export function lineIntersection(p1: Vec2, d1: Vec2, p2: Vec2, d2: Vec2, epsilonDeg = 1e-6): Vec2 | null {
  const denom = cross(d1, d2);
  const sinTheta = Math.abs(denom) / (length(d1) * length(d2));
  if (!(sinTheta > Math.sin(epsilonDeg * DEG_TO_RAD))) return null;
  const t = cross(sub(p2, p1), d2) / denom;
  return add(p1, scale(d1, t));
}

/** Shortest distance from point P to the infinite line through `p` with direction `d`. */
export function distanceToLine(pt: Vec2, p: Vec2, d: Vec2): number {
  return Math.abs(cross(sub(pt, p), d)) / length(d);
}

/** Normalized [0,1] ↔ pixel coordinates for an image of the given size. */
export const normalizedToPixel = (p: Vec2, width: number, height: number): Vec2 => ({ x: p.x * width, y: p.y * height });
export const pixelToNormalized = (p: Vec2, width: number, height: number): Vec2 => ({ x: p.x / width, y: p.y / height });
