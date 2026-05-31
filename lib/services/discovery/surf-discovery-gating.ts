import type {
  LockedBestSpotTeaser,
  SurfDiscoveryEntitlement,
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
} from "@/types/personalization";

const IMPLICIT_ONLY_REASON_PATTERNS: RegExp[] = [
  /surfing patterns/i,
  /engagement/i,
  /implicit/i,
];

const BEST_SPOT_GATE_FLAG = "SURF_DISCOVERY_BEST_SPOT_GATE";

function isBestSpotGateEnabled(): boolean {
  return process.env[BEST_SPOT_GATE_FLAG] === "1";
}

function formatApproximateTime(rec: SurfDiscoveryRecommendation): string {
  const start = rec.window?.start instanceof Date
    ? rec.window.start
    : new Date(rec.window?.start ?? "");

  if (Number.isNaN(start.getTime())) {
    return "Best window timing available";
  }

  let hour = start.getUTCHours();
  try {
    const localHour = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: rec.window.timezone,
    }).formatToParts(start).find((part) => part.type === "hour")?.value;
    hour = localHour ? Number.parseInt(localHour, 10) : hour;
  } catch {
    hour = start.getUTCHours();
  }

  if (hour < 9) return "early morning";
  if (hour < 12) return "late morning";
  if (hour < 15) return "midday";
  if (hour < 18) return "afternoon";
  return "evening";
}

function formatApproximateArea(rec: SurfDiscoveryRecommendation): string {
  const beach = rec.beach as SurfDiscoveryRecommendation["beach"] & {
    region?: string | null;
    city?: string | null;
    state?: string | null;
  };
  const area = beach.region ?? beach.city;
  if (area && beach.state) return `${area} area, ${beach.state}`;
  if (area) return `${area} area`;
  if (typeof rec.distanceMiles === "number") {
    const roundedDistance = Math.max(5, Math.round(rec.distanceMiles / 5) * 5);
    return `within about ${roundedDistance} miles`;
  }
  return "near your search area";
}

function formatScoreBand(score: number): string {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const lower = Math.floor(clamped / 10) * 10;
  const upper = Math.min(100, lower + 9);
  if (lower >= 100) return "100";
  return `${lower}-${upper}`;
}

function buildConditionSummary(rec: SurfDiscoveryRecommendation): string {
  const badgeLabels = rec.conditionBadges?.map((badge) => badge.label).filter(Boolean) ?? [];
  if (badgeLabels.length > 0) {
    return badgeLabels.slice(0, 2).join(" + ");
  }
  if (rec.waveHeightBadge) {
    return `${rec.waveHeightBadge} surf window`;
  }
  return "Promising surf window";
}

function isConservativePersonalReason(reason: string): boolean {
  if (!reason.trim()) return false;
  return !IMPLICIT_ONLY_REASON_PATTERNS.some((pattern) => pattern.test(reason));
}

export function buildPersonalExplanation(
  rec: SurfDiscoveryRecommendation
): string {
  const reasonParts = rec.reasons.filter(isConservativePersonalReason);
  const similarityReason = rec.similarity?.state === "ready"
    ? rec.similarity.reason
    : null;
  const boardPick = rec.boardPick;
  const boardReason = boardPick?.reason
    ? `Board fit: ${boardPick.reason}`
    : null;
  const conditionReason = rec.conditionBadges && rec.conditionBadges.length > 0
    ? `Conditions line up: ${rec.conditionBadges
        .slice(0, 2)
        .map((badge) => badge.label)
        .join(", ")}`
    : null;

  const parts = [
    ...reasonParts,
    similarityReason,
    boardReason,
    conditionReason,
  ].filter((part): part is string => Boolean(part));

  if (parts.length === 0) {
    return "This window lines up with your profile and the current surf setup.";
  }

  return parts.slice(0, 3).join(". ");
}

export function buildLockedBestSpotTeaser(
  rec: SurfDiscoveryRecommendation | undefined
): LockedBestSpotTeaser | null {
  if (!rec) return null;
  const approximateTime = formatApproximateTime(rec);
  const approximateArea = formatApproximateArea(rec);

  return {
    title: "Best spot nearby is lining up",
    subtitle: `Best window ${approximateTime} around ${approximateArea}. Unlock Pro to see the spot, exact timing, and why.`,
    approximateTime,
    approximateArea,
    confidence: rec.window?.confidence ?? Math.round(rec.score),
    scoreBand: formatScoreBand(rec.score),
    conditionSummary: buildConditionSummary(rec),
  };
}

export function gateSurfDiscoveryResponse(
  discovery: SurfDiscoveryResponse,
  entitlement: SurfDiscoveryEntitlement
): SurfDiscoveryResponse {
  if (!entitlement.hasPaidAccess && isBestSpotGateEnabled()) {
    return {
      ...discovery,
      entitlement,
      lockedBestSpotTeaser: buildLockedBestSpotTeaser(discovery.recommendations[0]),
      recommendations: [],
      recommendationsV2: undefined,
      includedRecommendations: [],
    };
  }

  return {
    ...discovery,
    entitlement,
    lockedBestSpotTeaser: null,
    recommendations: entitlement.hasPaidAccess
      ? discovery.recommendations.map((rec) => ({
          ...rec,
          personalExplanation: buildPersonalExplanation(rec),
        }))
      : discovery.recommendations,
    includedRecommendations: entitlement.hasPaidAccess
      ? discovery.includedRecommendations?.map((rec) => ({
          ...rec,
          personalExplanation: buildPersonalExplanation(rec),
        }))
      : discovery.includedRecommendations,
  };
}
