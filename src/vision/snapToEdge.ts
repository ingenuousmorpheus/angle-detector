import type { Vec2 } from '../geometry/angle2d';
import { sobelAt, type GrayImage } from './grayImage';

export interface SnapOptions {
  /** Search radius in image pixels. */
  radius?: number;
  /** Minimum Sobel magnitude to count as an edge (0..~1442). */
  minMagnitude?: number;
}

/**
 * Move a point onto the strongest nearby edge (AD-02 "snap to edge").
 * Prefers strong edges, mildly prefers closer ones. Returns null when no edge is
 * strong enough — the caller keeps the operator's placement rather than guessing.
 */
export function snapToEdge(img: GrayImage, p: Vec2, opts: SnapOptions = {}): Vec2 | null {
  const radius = opts.radius ?? 12;
  const minMag = opts.minMagnitude ?? 60;
  const cx = Math.round(p.x), cy = Math.round(p.y);
  let best: Vec2 | null = null;
  let bestScore = 0;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d > radius) continue;
      const { mag } = sobelAt(img, x, y);
      if (mag < minMag) continue;
      const score = mag * (1 - 0.5 * (d / (radius + 1)));
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}
