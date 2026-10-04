import type { Vec2 } from '../geometry/angle2d';

/**
 * The visible region of a video frame shown with CSS `object-fit: cover`.
 * One canonical contract: measurements live in normalized *displayed-frame* coordinates
 * (what the user sees), and these helpers map them to/from source video pixels.
 */
export interface CoverCrop {
  /** Source rectangle in video pixels. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export function coverCrop(videoWidth: number, videoHeight: number, displayWidth: number, displayHeight: number): CoverCrop {
  const videoRatio = videoWidth / videoHeight;
  const displayRatio = displayWidth / displayHeight;
  if (videoRatio > displayRatio) {
    // video wider than display: crop the sides
    const sh = videoHeight;
    const sw = sh * displayRatio;
    return { sx: (videoWidth - sw) / 2, sy: 0, sw, sh };
  }
  // video taller than display: crop top/bottom
  const sw = videoWidth;
  const sh = sw / displayRatio;
  return { sx: 0, sy: (videoHeight - sh) / 2, sw, sh };
}

/** Normalized displayed-frame point → source video pixel. */
export function displayNormToVideo(p: Vec2, crop: CoverCrop): Vec2 {
  return { x: crop.sx + p.x * crop.sw, y: crop.sy + p.y * crop.sh };
}

/** Source video pixel → normalized displayed-frame point. */
export function videoToDisplayNorm(p: Vec2, crop: CoverCrop): Vec2 {
  return { x: (p.x - crop.sx) / crop.sw, y: (p.y - crop.sy) / crop.sh };
}
