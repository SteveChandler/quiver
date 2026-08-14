import {
  COUNTY_ADVISORY_TYPES,
  COUNTY_FEED_SOURCE_IDENTIFIER,
  COUNTY_FEED_SOURCE_NAME,
  COUNTY_FEED_SOURCE_URL,
  COUNTY_MAX_MATCH_DISTANCE_METERS,
  type CountyAdvisoryRecord,
  type CountyBeachCandidate,
  type CountyMatchSummary,
  type CountyNotificationResponse,
} from "./types";

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) *
      Math.cos(toRadians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestBeach(
  site: { latitude: number; longitude: number },
  beaches: readonly CountyBeachCandidate[],
): { beachId: string; distanceMeters: number } | null {
  let nearest: { beachId: string; distanceMeters: number } | null = null;
  for (const beach of beaches) {
    if (beach.lat === null || beach.lon === null) continue;
    const distance = distanceMeters(site.latitude, site.longitude, beach.lat, beach.lon);
    if (nearest === null || distance < nearest.distanceMeters) {
      nearest = { beachId: beach.id, distanceMeters: distance };
    }
  }
  if (nearest === null || nearest.distanceMeters > COUNTY_MAX_MATCH_DISTANCE_METERS) {
    return null;
  }
  return nearest;
}

export function normalizeCountyNotifications(
  responses: readonly CountyNotificationResponse[],
  beaches: readonly CountyBeachCandidate[],
  fetchedAt: string,
): CountyMatchSummary {
  const records: CountyAdvisoryRecord[] = [];
  const matchedSiteIdentifiers = new Set<string>();
  const allSiteIdentifiers = new Set<string>();
  const countsByType: Record<(typeof COUNTY_ADVISORY_TYPES)[number], number> = {
    advisory: 0,
    closure: 0,
    warning: 0,
  };

  for (const response of responses) {
    countsByType[response.advisoryType] += response.sites.length;
    for (const site of response.sites) {
      allSiteIdentifiers.add(site.sourceSiteIdentifier);
      const match = nearestBeach(site, beaches);
      if (match !== null) matchedSiteIdentifiers.add(site.sourceSiteIdentifier);
      records.push({
        sourceIdentifier: COUNTY_FEED_SOURCE_IDENTIFIER,
        sourceName: COUNTY_FEED_SOURCE_NAME,
        sourceUrl: COUNTY_FEED_SOURCE_URL,
        sourceSiteIdentifier: site.sourceSiteIdentifier,
        advisoryType: response.advisoryType,
        beachId: match?.beachId ?? null,
        countyLatitude: site.latitude,
        countyLongitude: site.longitude,
        matchDistanceMeters: match?.distanceMeters ?? null,
        // The screen service returns the current active set, not validity dates.
        validFrom: null,
        validUntil: null,
        rawPayload: response.rawPayload,
        rawPayloadHash: response.rawPayloadHash,
        fetchedAt,
      });
    }
  }

  const totalSites = allSiteIdentifiers.size;
  const matchedSites = matchedSiteIdentifiers.size;
  const unmatchedSites = totalSites - matchedSites;
  return {
    records,
    totalSites,
    matchedSites,
    unmatchedSites,
    matchRate: totalSites === 0 ? null : matchedSites / totalSites,
    countsByType,
  };
}
