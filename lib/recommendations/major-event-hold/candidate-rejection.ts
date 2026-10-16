import type { CandidateRejection } from '@/types/personalization';
import type { WaterQualityHoldResolution } from './water-quality';

export function waterQualityCandidateRejection(
  resolution: WaterQualityHoldResolution | null,
  beachId: string,
): CandidateRejection | null {
  if (resolution?.state !== 'resolved') return null;
  if (!resolution.heldBeachIds.some((id) => id.toLowerCase() === beachId.toLowerCase())) return null;
  const status = resolution.waterQualityStatusByBeachId[beachId.toLowerCase()];
  if (status !== 'advisory' && status !== 'closure') return null;
  return { gate: 'water_quality_hold', observed: { status }, allowed: { status: 'open' } };
}
