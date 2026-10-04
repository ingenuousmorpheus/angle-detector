import type { GrayImage } from '../fixtures/syntheticAngle';

export type { GrayImage };

/** RGBA (canvas ImageData layout) → luma (Rec. 601). */
export function rgbaToGray(rgba: Uint8ClampedArray, width: number, height: number): GrayImage {
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; j < data.length; i += 4, j++) {
    data[j] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
  }
  return { width, height, data };
}

/** Sobel gradient at an interior pixel. Returns zeros on the border. */
export function sobelAt(img: GrayImage, x: number, y: number): { gx: number; gy: number; mag: number } {
  const { width: w, height: h, data: d } = img;
  if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) return { gx: 0, gy: 0, mag: 0 };
  const i = y * w + x;
  const tl = d[i - w - 1], t = d[i - w], tr = d[i - w + 1];
  const l = d[i - 1], r = d[i + 1];
  const bl = d[i + w - 1], b = d[i + w], br = d[i + w + 1];
  const gx = tr + 2 * r + br - (tl + 2 * l + bl);
  const gy = bl + 2 * b + br - (tl + 2 * t + tr);
  return { gx, gy, mag: Math.hypot(gx, gy) };
}
