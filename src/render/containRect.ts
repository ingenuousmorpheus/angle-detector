/**
 * containRect.ts — aspect-ratio-safe coordinate transforms (AD-03 P1 fix).
 *
 * Root cause of the Codex FAIL: the frozen frame was rendered with
 * `w-full h-full`, stretching the image when the container aspect changed
 * (portrait 3:4 ↔ landscape 16:9) after freezing, while point placement used
 * container-normalized coordinates and the geometry engine used the original
 * image dimensions. A 45° bend no longer measured 45°.
 *
 * Fix: the image is rendered with its intrinsic aspect preserved
 * (object-contain semantics, computed explicitly so the transform is exact),
 * and ALL coordinate conversions go through the contain rect:
 * - Points are stored NORMALIZED IN IMAGE COORDS [0,1] (not container coords).
 * - toImageNorm: container client coords → image-normalized (for taps/drags).
 * - toContainerPx: image-normalized → container coords (for SVG overlay).
 *
 * Because points are image-relative, rotating the device (which only changes
 * the container aspect and thus the letterbox) cannot move a point relative
 * to the image. The geometry engine and PNG export both consume
 * image-normalized points × original image dimensions, so they are invariant
 * under rotation.
 */

import type { Vec2 } from '../geometry/angle2d';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Largest rect with the image's aspect ratio that fits inside the container
 * (CSS `object-contain` semantics). Returns zeros when inputs are degenerate.
 */
export function containRect(
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number,
): Rect {
  if (containerW <= 0 || containerH <= 0 || imageW <= 0 || imageH <= 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  const scale = Math.min(containerW / imageW, containerH / imageH);
  const w = imageW * scale;
  const h = imageH * scale;
  return { x: (containerW - w) / 2, y: (containerH - h) / 2, w, h };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Pointer/touch client coordinates → image-normalized [0,1].
 * `containerLeft`/`containerTop` are the container's bounding-client-rect origin.
 * Points outside the letterboxed image clamp to the image edge.
 */
export function toImageNorm(
  clientX: number,
  clientY: number,
  containerLeft: number,
  containerTop: number,
  imgRect: Rect,
): Vec2 {
  if (imgRect.w <= 0 || imgRect.h <= 0) return { x: 0, y: 0 };
  return {
    x: clamp01((clientX - containerLeft - imgRect.x) / imgRect.w),
    y: clamp01((clientY - containerTop - imgRect.y) / imgRect.h),
  };
}

/** Image-normalized [0,1] → container coordinates (for the SVG overlay). */
export function toContainerPx(p: Vec2, imgRect: Rect): Vec2 {
  return { x: p.x * imgRect.w + imgRect.x, y: p.y * imgRect.h + imgRect.y };
}