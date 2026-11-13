import type { Vec2 } from '../geometry/angle2d';

/**
 * Where to draw the 3D Mitutoyo protractor so it sits on a measured angle.
 * Presentation only: it never produces the reading, it only poses the model on
 * points the measurement already uses.
 */
export interface ProtractorRig {
  /** Model-space pivot (where the short arm's and blade's centrelines meet). */
  pivot: { x: number; y: number };
  /** Direction of the short arm from the pivot, model space, degrees CCW (+y up). */
  armDirDeg: number;
  /** Direction of the blade from the pivot in the unrotated model, degrees CCW. */
  bladeDirDeg: number;
}

export interface ProtractorPose {
  /** Rotation of the whole model about the pivot, degrees CCW (screen y-up). */
  bodyRotationDeg: number;
  /** Extra rotation of the blade about the pivot, degrees CCW. */
  bladeRotationDeg: number;
  /** Angle the blade is opened to from the arm (interior, 0..180). */
  openingDeg: number;
  /** true when the arm lies along edge B and the blade along edge A. */
  swapped: boolean;
  /**
   * Draw the model mirrored left-right (scale x = -1 about the pivot). Chosen when
   * it keeps the dial and LCD closer to upright. Rotations above are then applied
   * inside the mirrored frame, as three.js does with a negative scale.
   */
  mirrored: boolean;
}

const wrap180 = (d: number) => {
  let x = ((d + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
};
const dirDeg = (from: Vec2, to: Vec2) => (Math.atan2(-(to.y - from.y), to.x - from.x) * 180) / Math.PI; // screen y-down -> y-up

/**
 * Pose for screen-space points (y down). Unmirrored, the model's blade opens
 * clockwise from its arm; mirrored, counter-clockwise. For each handedness the
 * arm goes on the edge that makes the other edge open the right way (so the dial
 * stays outside the angle), and of the two the pose with the dial nearer upright
 * is used, so the LCD stays readable.
 */
export function protractorPose(vertex: Vec2, edgeA: Vec2, edgeB: Vec2, rig: ProtractorRig): ProtractorPose {
  const phiA = dirDeg(vertex, edgeA);
  const phiB = dirDeg(vertex, edgeB);
  const delta = wrap180(phiB - phiA); // CCW from A to B
  const opening = Math.abs(delta);
  // Blade rotation inside the model frame is the same for both handedness (see test).
  const bladeRotationDeg = wrap180(rig.armDirDeg - opening - rig.bladeDirDeg);

  // Unmirrored: blade must be clockwise of the arm.
  const swappedN = delta > 0;
  const bodyN = wrap180((swappedN ? phiB : phiA) - rig.armDirDeg);
  // Mirrored: arm appears at 180 - armDir, blade counter-clockwise of the arm.
  const swappedM = delta < 0;
  const bodyM = wrap180((swappedM ? phiB : phiA) - (180 - rig.armDirDeg));

  const mirrored = Math.abs(bodyM) < Math.abs(bodyN) - 1e-9;
  return {
    bodyRotationDeg: mirrored ? bodyM : bodyN,
    bladeRotationDeg,
    openingDeg: opening,
    swapped: mirrored ? swappedM : swappedN,
    mirrored,
  };
}

/** Shortest-path angle smoothing for animation (degrees). */
export function approachAngle(current: number, target: number, t: number): number {
  return current + wrap180(target - current) * t;
}
