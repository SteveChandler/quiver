import 'server-only';

import type { Beach } from '@/types/database';
import type { SkillLevel } from '@/lib/domains/user-preferences';
import type {
  SurfDiscoveryEntitlement,
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
} from '@/types/personalization';
import { discoverSurfSpots } from '@/lib/services/surf-discovery-service';
import { gateSurfDiscoveryResponse } from '@/lib/services/discovery/surf-discovery-gating';
import { sanitizeSurfDiscoveryForSerializationMajorEventHold } from '@/lib/services/discovery/major-event-hold';

/**
 * The beach's "now" call for `/api/surf/call?includeNow=1`.
 *
 * Native Home labels every ranked spot from `/api/surf/discover?mode=now`.
 * Beach Detail grades "now" from the surf call. Running the same now-mode
 * discovery here, scoped to one beach, gives both screens one producer for the
 * same window, so a spot cannot read GOOD on Home and FAIR on its own page.
 */

function windowMs(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * The requested beach's now-mode recommendation, or null when there is no
 * positive call to hand over: the discovery is held or unresolved, the beach
 * is missing from the gated results, or its window is not open right now.
 */
function selectNowRecommendation(
  discovery: SurfDiscoveryResponse | null | undefined,
  beachId: string,
  nowMs: number,
): SurfDiscoveryRecommendation | null {
  if (!discovery) return null;
  if (discovery.recommendationAvailability?.state === 'none') return null;
  const recommendation = [
    ...discovery.recommendations,
    ...(discovery.includedRecommendations ?? []),
  ].find(
    (candidate) => candidate.beach.id === beachId && candidate.kind !== 'custom_spot',
  );
  if (!recommendation) return null;
  const startMs = windowMs(recommendation.window.start);
  const endMs = windowMs(recommendation.window.end);
  if (startMs == null || endMs == null) return null;
  if (startMs > nowMs || nowMs > endMs) return null;
  return recommendation;
}

/**
 * Run the same now-mode discovery Home runs, scoped to one beach. Any failure
 * reads as "no now call": the surf call must never fail because of it.
 */
export async function loadNowRecommendation(args: {
  userId: string;
  beach: Beach;
  isPro: boolean;
  profileExperience: SkillLevel | null;
  now: Date;
}): Promise<SurfDiscoveryRecommendation | null> {
  const { userId, beach, isPro, profileExperience, now } = args;
  try {
    const discovery = await discoverSurfSpots(userId, {
      userLocation:
        beach.lat !== null && beach.lon !== null
          ? { lat: beach.lat, lon: beach.lon }
          : undefined,
      horizonHours: 24,
      candidatePoolLimit: 1,
      maxResults: 1,
      includeBeachIds: [beach.id],
      allowRecommendationIneligibleIncludes: false,
      discoveryMode: 'now',
      isPro,
      throwOnFailure: true,
    });
    const sanitized = await sanitizeSurfDiscoveryForSerializationMajorEventHold(
      discovery,
      profileExperience,
    );
    const entitlement: SurfDiscoveryEntitlement = {
      tier: isPro ? 'premium' : 'free',
      hasPaidAccess: isPro,
      canSeeBestSpot: isPro,
    };
    return selectNowRecommendation(
      gateSurfDiscoveryResponse(sanitized, entitlement),
      beach.id,
      now.getTime(),
    );
  } catch {
    return null;
  }
}
