import type { WaterQualityHoldResolution } from '@/lib/recommendations/major-event-hold/water-quality';

/**
 * A beach's water-quality notice. `/api/surf/call` returns it as `waterQuality`
 * and `/api/forecasts/bulk` returns it per beach, so Beach Detail and the map
 * read one shape from one mapper.
 */
export type SurfCallWaterQuality = {
  status: 'advisory' | 'closure' | 'hold';
  source: 'county' | 'sample' | 'hold' | 'rain';
  countyKind?: 'general' | 'site';
  checkedAt?: string;
  sampleDate?: string;
  rainAdvisory?: { startedAt: string; lastRainAt: string | null; expiresAt: string };
} | null;

export function surfCallWaterQuality(
  resolution: WaterQualityHoldResolution,
  beachId: string,
): SurfCallWaterQuality {
  beachId = beachId.toLowerCase();
  // An unresolved read lists only the holds it already knows (owner holds). The call is
  // never withheld for water quality, so those still show as the notice.
  const held = resolution.heldBeachIds.includes(beachId);
  const notice = resolution.heldBeachIds.includes(beachId) ? undefined : resolution.waterQualityNoticeByBeachId?.[beachId];
  if (!held && !notice) return null;
  const evidence = notice ?? resolution.waterQualityEvidenceByBeachId?.[beachId];
  const status = notice ? 'advisory' : resolution.waterQualityStatusByBeachId[beachId] ?? 'hold';
  if (evidence?.source === 'county') return { status, source: 'county',
    ...(evidence.countyKind ? { countyKind: evidence.countyKind } : {}),
    ...(evidence.countyKind === 'general' && evidence.rainAdvisory ? { rainAdvisory: evidence.rainAdvisory } : {}),
    ...(evidence.checkedAt ? { checkedAt: evidence.checkedAt } : {}) };
  if (evidence?.source === 'rain' && evidence.rainAdvisory) return { status, source: 'rain',
    rainAdvisory: evidence.rainAdvisory };
  if (evidence?.source === 'sample') return { status, source: 'sample',
    ...(evidence.sampleDate ? { sampleDate: evidence.sampleDate } : {}) };
  return { status, source: 'hold' };
}
