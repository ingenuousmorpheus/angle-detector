import type { Point } from '../../types';

/**
 * Synthetic angle fixtures with exactly known geometry (AD-00).
 *
 * Renders two flat "sheet metal" bars meeting at a vertex — the 2D profile of a
 * brake-formed bend — into a grayscale buffer. Ground truth comes from construction,
 * not from any measurement code, so these fixtures can grade both Gemini and the
 * deterministic geometry/CV paths.
 */

export interface GrayImage {
  width: number;
  height: number;
  /** One byte per pixel, row-major, 0 = black. */
  data: Uint8ClampedArray;
}

export interface AngleFixtureOptions {
  /** Included angle between the two bars, degrees (0, 180]. */
  angleDeg: number;
  width?: number;
  height?: number;
  /** Direction of arm A, degrees, image coordinates (0 = +x, 90 = +y / down). */
  rotationDeg?: number;
  /** Vertex in pixels; defaults to the image center (the app's target). */
  vertex?: Point;
  armLength?: number;
  thickness?: number;
  background?: number;
  foreground?: number;
  /** Std-dev of additive gaussian noise, 0–255 scale. */
  noise?: number;
  seed?: number;
}

export interface AngleFixture {
  name: string;
  image: GrayImage;
  truth: {
    angleDeg: number;
    vertex: Point;
    /** Unit vectors along each arm, image coordinates. */
    dirA: Point;
    dirB: Point;
    /** [point on arm A, vertex, point on arm B], pixels. */
    points: [Point, Point, Point];
  };
}

/** Angles named in the session roadmap (AD-00 ∪ AL-00). */
export const STANDARD_FIXTURE_ANGLES = [15, 30, 45, 60, 75, 90, 105, 120, 135, 150] as const;

/** Small deterministic PRNG (mulberry32) so fixtures are byte-identical across runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax, vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  const dx = px - (ax + t * vx), dy = py - (ay + t * vy);
  return Math.hypot(dx, dy);
}

export function renderAngleFixture(opts: AngleFixtureOptions): AngleFixture {
  const width = opts.width ?? 640;
  const height = opts.height ?? 360;
  const rotationDeg = opts.rotationDeg ?? 0;
  const vertex = opts.vertex ?? { x: width / 2, y: height / 2 };
  const armLength = opts.armLength ?? Math.min(width, height) * 0.42;
  const thickness = opts.thickness ?? 10;
  const bg = opts.background ?? 40;
  const fg = opts.foreground ?? 200;
  const noise = opts.noise ?? 0;
  const rand = mulberry32(opts.seed ?? 1);

  const ra = (rotationDeg * Math.PI) / 180;
  const rb = ((rotationDeg + opts.angleDeg) * Math.PI) / 180;
  const dirA = { x: Math.cos(ra), y: Math.sin(ra) };
  const dirB = { x: Math.cos(rb), y: Math.sin(rb) };
  const endA = { x: vertex.x + dirA.x * armLength, y: vertex.y + dirA.y * armLength };
  const endB = { x: vertex.x + dirB.x * armLength, y: vertex.y + dirB.y * armLength };

  const data = new Uint8ClampedArray(width * height);
  const half = thickness / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5, py = y + 0.5;
      const d = Math.min(
        distToSegment(px, py, vertex.x, vertex.y, endA.x, endA.y),
        distToSegment(px, py, vertex.x, vertex.y, endB.x, endB.y),
      );
      // 1px anti-aliased edge
      const cover = Math.max(0, Math.min(1, half + 0.5 - d));
      let v = bg + (fg - bg) * cover;
      if (noise > 0) {
        // Box–Muller
        const u1 = Math.max(rand(), 1e-12), u2 = rand();
        v += noise * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      }
      data[y * width + x] = v;
    }
  }

  const probe = armLength * 0.8;
  return {
    name: `synthetic-${opts.angleDeg}deg-rot${rotationDeg}${noise ? `-noise${noise}` : ''}`,
    image: { width, height, data },
    truth: {
      angleDeg: opts.angleDeg,
      vertex,
      dirA,
      dirB,
      points: [
        { x: vertex.x + dirA.x * probe, y: vertex.y + dirA.y * probe },
        vertex,
        { x: vertex.x + dirB.x * probe, y: vertex.y + dirB.y * probe },
      ],
    },
  };
}

/** The standard regression set: every roadmap angle at a few orientations. */
export function standardFixtureSet(opts: Partial<AngleFixtureOptions> = {}): AngleFixture[] {
  const out: AngleFixture[] = [];
  for (const angleDeg of STANDARD_FIXTURE_ANGLES) {
    for (const rotationDeg of [0, 37, 200]) {
      out.push(renderAngleFixture({ ...opts, angleDeg, rotationDeg, seed: angleDeg * 1000 + rotationDeg }));
    }
  }
  return out;
}
