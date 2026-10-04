import type { Vec2 } from '../geometry/angle2d';
import type { AngleMeasurement } from '../measurement/measurementTypes';
import { formatAngle, conventionLabel } from './format';

/**
 * Composite the frozen frame + measured geometry + label into a PNG data URL
 * (AD-02 "save annotated photo"). Points are normalized display-frame coordinates.
 */
export function exportAnnotated(frame: HTMLCanvasElement, points: [Vec2, Vec2, Vec2], m: AngleMeasurement): string {
  const out = document.createElement('canvas');
  out.width = frame.width;
  out.height = frame.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(frame, 0, 0);
  const s = out.width / 1000;
  const px = (p: Vec2) => ({ x: p.x * out.width, y: p.y * out.height });
  const [a, v, b] = points.map(px);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(34,211,238,0.9)';
  ctx.shadowBlur = 10 * s;
  ctx.strokeStyle = '#67e8f9';
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(v.x, v.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(v.x, v.y, 6 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  const label = `${formatAngle(m.displayDeg)}  ${conventionLabel(m.convention)} · 2D apparent · ${m.source}`;
  ctx.font = `bold ${Math.round(28 * s)}px ui-monospace, monospace`;
  const pad = 12 * s;
  const w = ctx.measureText(label).width + pad * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(pad, out.height - 52 * s - pad, w, 52 * s);
  ctx.fillStyle = '#fef08a';
  ctx.fillText(label, pad * 2, out.height - pad - 16 * s);
  return out.toDataURL('image/png');
}
