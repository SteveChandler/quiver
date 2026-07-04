export const GARMIN_BEACH_CUTOFF_METERS = 10_000;

export type GarminNormalizedActivity = {
  activityId: string;
  activityType: string;
  activityName?: string;
  startTime: string;
  durationSeconds: number;
  startLat?: number;
  startLon?: number;
};

export type GarminActivityTier = "silent" | "confirm" | "ignore";

export type GarminNearbyBeach = {
  id: string;
  distance_meters: number;
};

export type GarminSessionSkeleton = {
  startedAt: string;
  durationSeconds: number;
  beachId: string;
  garminActivityId: string;
};

export function normalizeGarminActivityComparison(value: string): string {
  return value.trim().toLowerCase();
}

export function decideTier(
  activity: GarminNormalizedActivity,
  designatedTypes: readonly string[],
): GarminActivityTier {
  const activityType = normalizeGarminActivityComparison(activity.activityType);

  if (activityType === "surfing") {
    return "silent";
  }

  const designated = new Set(
    designatedTypes.map((value: string) =>
      normalizeGarminActivityComparison(value),
    ),
  );

  if (designated.has(activityType)) {
    return "confirm";
  }

  if (!activity.activityName) {
    return "ignore";
  }

  const activityName = normalizeGarminActivityComparison(activity.activityName);

  if (activityName && designated.has(activityName)) {
    return "confirm";
  }

  return "ignore";
}

export function buildSkeleton(
  activity: GarminNormalizedActivity,
  beachId: string,
): GarminSessionSkeleton {
  return {
    startedAt: activity.startTime,
    durationSeconds: activity.durationSeconds,
    beachId,
    garminActivityId: activity.activityId,
  };
}

export function resolveBeach(
  nearby: readonly GarminNearbyBeach[],
  cutoffMeters: number = GARMIN_BEACH_CUTOFF_METERS,
): GarminNearbyBeach | null {
  const nearest = nearby.reduce<GarminNearbyBeach | null>(
    (best: GarminNearbyBeach | null, candidate: GarminNearbyBeach) => {
      if (!best) {
        return candidate;
      }

      return candidate.distance_meters < best.distance_meters ? candidate : best;
    },
    null,
  );

  if (!nearest || nearest.distance_meters > cutoffMeters) {
    return null;
  }

  return nearest;
}
