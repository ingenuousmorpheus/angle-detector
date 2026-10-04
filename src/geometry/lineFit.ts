import type { Vec2 } from './angle2d';

export interface LineFit {
  /** Centroid of the points — a point on the line. */
  point: Vec2;
  /** Unit direction (principal axis). */
  direction: Vec2;
  /** RMS perpendicular distance of the points from the line. */
  rmsResidual: number;
  /** Largest perpendicular distance. */
  maxResidual: number;
  /** Extent of the points along the direction (projected length). */
  span: number;
  count: number;
}

/**
 * Total-least-squares line fit (principal axis of the point cloud).
 * Unlike y = mx + b this treats x and y symmetrically, so vertical edges fit as well as horizontal ones.
 * Optional per-point weights (e.g. edge gradient magnitude).
 */
export function fitLine(points: readonly Vec2[], weights?: readonly number[]): LineFit | null {
  const n = points.length;
  if (n < 2) return null;
  let sw = 0, mx = 0, my = 0;
  for (let i = 0; i < n; i++) {
    const w = weights ? weights[i] : 1;
    sw += w; mx += w * points[i].x; my += w * points[i].y;
  }
  if (sw <= 0) return null;
  mx /= sw; my /= sw;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const w = weights ? weights[i] : 1;
    const dx = points[i].x - mx, dy = points[i].y - my;
    sxx += w * dx * dx; syy += w * dy * dy; sxy += w * dx * dy;
  }
  if (sxx + syy === 0) return null; // all points identical
  // Orientation of the major axis of the 2x2 covariance matrix.
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const direction = { x: Math.cos(theta), y: Math.sin(theta) };
  let sumSq = 0, maxR = 0, tMin = Infinity, tMax = -Infinity;
  for (const p of points) {
    const dx = p.x - mx, dy = p.y - my;
    const r = Math.abs(dx * direction.y - dy * direction.x);
    sumSq += r * r;
    if (r > maxR) maxR = r;
    const t = dx * direction.x + dy * direction.y;
    if (t < tMin) tMin = t;
    if (t > tMax) tMax = t;
  }
  return {
    point: { x: mx, y: my },
    direction,
    rmsResidual: Math.sqrt(sumSq / n),
    maxResidual: maxR,
    span: tMax - tMin,
    count: n,
  };
}
