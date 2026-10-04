import type { AngleConvention } from '../geometry/angle2d';

/**
 * One decimal place: presentation only. Accuracy is not claimed beyond what the
 * AD-07 validation report supports (anglelensession §12).
 */
export const formatAngle = (deg: number | null): string => (deg === null ? '—' : `${deg.toFixed(1)}°`);

export const conventionLabel = (c: AngleConvention): string =>
  c === 'interior' ? 'interior' : c === 'supplement' ? 'supplement' : 'exterior';

export const NEXT_CONVENTION: Record<AngleConvention, AngleConvention> = {
  interior: 'supplement',
  supplement: 'exterior',
  exterior: 'interior',
};
