import type { Beach } from "@/types/database";

export const MAX_TIMELINE_FIELD_BEACHES = 8;

interface TimelineBeachCandidate {
  beach: Beach;
  lat: number;
  lon: number;
}

function distanceSquared(
  left: Pick<TimelineBeachCandidate, "lat" | "lon">,
  right: Pick<TimelineBeachCandidate, "lat" | "lon">,
  longitudeScale: number,
): number {
  const latitudeDelta = left.lat - right.lat;
  const longitudeDelta = (left.lon - right.lon) * longitudeScale;
  return latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta;
}

export function selectTimelineFieldBeachIds(
  beaches: readonly Beach[],
  center: { lat: number; lon: number },
  limit = MAX_TIMELINE_FIELD_BEACHES,
  preferredBeachId?: string | null,
): string[] {
  const cappedLimit = Math.max(0, Math.floor(limit));
  if (cappedLimit === 0) return [];

  const seenBeachIds = new Set<string>();
  const uniqueBeaches = beaches.filter((beach) => {
    if (!beach.id || seenBeachIds.has(beach.id)) return false;
    seenBeachIds.add(beach.id);
    return true;
  });
  if (uniqueBeaches.length <= cappedLimit) {
    return uniqueBeaches.map((beach) => beach.id);
  }

  const candidates = uniqueBeaches.flatMap<TimelineBeachCandidate>((beach) => {
    if (!Number.isFinite(beach.lat) || !Number.isFinite(beach.lon)) return [];
    return [{ beach, lat: beach.lat!, lon: beach.lon! }];
  });
  if (candidates.length === 0) {
    return uniqueBeaches.slice(0, cappedLimit).map((beach) => beach.id);
  }

  const longitudeScale = Math.max(
    0.1,
    Math.cos((center.lat * Math.PI) / 180),
  );
  const centerPoint = { lat: center.lat, lon: center.lon };
  const nearestToCenter = candidates.reduce((nearest, candidate) => {
    const nearestDistance = distanceSquared(nearest, centerPoint, longitudeScale);
    const candidateDistance = distanceSquared(candidate, centerPoint, longitudeScale);
    if (candidateDistance !== nearestDistance) {
      return candidateDistance < nearestDistance ? candidate : nearest;
    }
    return candidate.beach.id.localeCompare(nearest.beach.id) < 0
      ? candidate
      : nearest;
  });
  const first = candidates.find(({ beach }) => beach.id === preferredBeachId)
    ?? nearestToCenter;
  const selected = [first];
  const selectedIds = new Set([first.beach.id]);

  while (selected.length < Math.min(cappedLimit, candidates.length)) {
    let next: TimelineBeachCandidate | null = null;
    let nextDistance = -1;

    for (const candidate of candidates) {
      if (selectedIds.has(candidate.beach.id)) continue;
      const candidateDistance = Math.min(
        ...selected.map((selectedBeach) =>
          distanceSquared(candidate, selectedBeach, longitudeScale),
        ),
      );
      if (
        candidateDistance > nextDistance
        || (
          candidateDistance === nextDistance
          && candidate.beach.id.localeCompare(next?.beach.id ?? "") < 0
        )
      ) {
        next = candidate;
        nextDistance = candidateDistance;
      }
    }

    if (!next) break;
    selected.push(next);
    selectedIds.add(next.beach.id);
  }

  const selectedBeachIds = selected.map(({ beach }) => beach.id);
  for (const beach of uniqueBeaches) {
    if (selectedBeachIds.length >= cappedLimit) break;
    if (selectedIds.has(beach.id)) continue;
    selectedBeachIds.push(beach.id);
    selectedIds.add(beach.id);
  }

  return selectedBeachIds;
}
