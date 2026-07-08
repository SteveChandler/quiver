import {
  EARTH_RADIUS_KM,
  EARTH_RADIUS_MI,
  haversineDistance,
} from "@/lib/utils/geo-utils";

export type CustomSpotAnchorAuditStatus = "pass" | "watch" | "critical";

export type CustomSpotAnchorAuditReasonCode =
  | "missing_anchor"
  | "anchor_missing_or_deleted"
  | "anchor_too_far"
  | "closer_anchor_available"
  | "forecast_missing"
  | "forecast_stale";

export type CustomSpotAnchorAuditConfig = {
  maxAnchorDistanceMi: number;
  closerAnchorMinDeltaMi: number;
  closerAnchorMaxDistanceMi: number;
  forecastFreshnessHours: number;
  now: Date;
};

export type CustomSpotAnchorAuditCustomSpot = {
  id: string;
  userId: string;
  name: string;
  lat: number;
  lon: number;
  nearestBeachId: string | null;
  nearestBeachDistanceMi?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  excluded?: boolean;
  exclusionReason?: string | null;
};

export type CustomSpotAnchorAuditBeach = {
  id: string;
  name: string;
  slug?: string | null;
  lat: number;
  lon: number;
  deletedAt?: string | null;
};

export type CustomSpotAnchorAuditForecast = {
  beachId: string;
  updatedAt: string | null;
  dataSource?: string | null;
};

export type CustomSpotAnchorAuditReason = {
  code: CustomSpotAnchorAuditReasonCode;
  status: Exclude<CustomSpotAnchorAuditStatus, "pass">;
  detail: string;
};

export type CustomSpotAnchorAuditBeachMatch = {
  id: string;
  name: string;
  slug?: string | null;
  distanceMi: number;
};

export type CustomSpotAnchorAuditForecastSummary = {
  updatedAt: string | null;
  ageHours: number | null;
  dataSource?: string | null;
};

export type CustomSpotAnchorAuditEvaluation = {
  spotId: string;
  spotName: string;
  userId: string;
  status: CustomSpotAnchorAuditStatus;
  reasons: CustomSpotAnchorAuditReason[];
  currentAnchor: CustomSpotAnchorAuditBeachMatch | null;
  closestAnchor: CustomSpotAnchorAuditBeachMatch | null;
  storedNearestBeachDistanceMi: number | null;
  forecast: CustomSpotAnchorAuditForecastSummary | null;
};

export type CustomSpotAnchorAuditSummary = {
  totalCustomSpots: number;
  auditedCustomSpots: number;
  excludedCustomSpots: number;
  pass: number;
  watch: number;
  critical: number;
  maxAnchorDistanceMi: number;
  forecastFreshnessHours: number;
};

export type CustomSpotAnchorAuditResult = {
  generatedAt: string;
  summary: CustomSpotAnchorAuditSummary;
  evaluations: CustomSpotAnchorAuditEvaluation[];
};

export const DEFAULT_CUSTOM_SPOT_ANCHOR_AUDIT_CONFIG: Omit<
  CustomSpotAnchorAuditConfig,
  "now"
> = {
  maxAnchorDistanceMi: 30,
  closerAnchorMinDeltaMi: 10,
  closerAnchorMaxDistanceMi: 20,
  forecastFreshnessHours: 24,
};

type BuildCustomSpotAnchorAuditArgs = {
  customSpots: CustomSpotAnchorAuditCustomSpot[];
  beaches: CustomSpotAnchorAuditBeach[];
  forecasts: CustomSpotAnchorAuditForecast[];
  config?: Partial<CustomSpotAnchorAuditConfig>;
};

type FormatCustomSpotAnchorAuditOptions = {
  limit?: number;
};

const STATUS_RANK: Record<CustomSpotAnchorAuditStatus, number> = {
  pass: 0,
  watch: 1,
  critical: 2,
};

function toMiles(kilometers: number): number {
  return kilometers * (EARTH_RADIUS_MI / EARTH_RADIUS_KM);
}

function isFiniteCoordinate(value: number): boolean {
  return Number.isFinite(value);
}

function distanceMi(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return toMiles(haversineDistance(lat1, lon1, lat2, lon2));
}

function roundDistance(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatBeachMatch(
  spot: CustomSpotAnchorAuditCustomSpot,
  beach: CustomSpotAnchorAuditBeach
): CustomSpotAnchorAuditBeachMatch {
  return {
    id: beach.id,
    name: beach.name,
    slug: beach.slug,
    distanceMi: roundDistance(distanceMi(spot.lat, spot.lon, beach.lat, beach.lon)),
  };
}

function findClosestBeach(
  spot: CustomSpotAnchorAuditCustomSpot,
  beaches: CustomSpotAnchorAuditBeach[]
): CustomSpotAnchorAuditBeachMatch | null {
  let closest: CustomSpotAnchorAuditBeachMatch | null = null;

  for (const beach of beaches) {
    const match = formatBeachMatch(spot, beach);
    if (!closest || match.distanceMi < closest.distanceMi) {
      closest = match;
    }
  }

  return closest;
}

function getStatus(
  reasons: CustomSpotAnchorAuditReason[]
): CustomSpotAnchorAuditStatus {
  if (reasons.length === 0) return "pass";

  return reasons.some((reason) => reason.status === "critical")
    ? "critical"
    : "watch";
}

function formatForecastSummary(
  forecast: CustomSpotAnchorAuditForecast | undefined,
  now: Date
): CustomSpotAnchorAuditForecastSummary | null {
  if (!forecast?.updatedAt) return null;

  const updatedAtMs = new Date(forecast.updatedAt).getTime();
  if (!Number.isFinite(updatedAtMs)) return null;

  return {
    updatedAt: forecast.updatedAt,
    ageHours: roundHours((now.getTime() - updatedAtMs) / (1000 * 60 * 60)),
    dataSource: forecast.dataSource,
  };
}

function sortEvaluations(
  left: CustomSpotAnchorAuditEvaluation,
  right: CustomSpotAnchorAuditEvaluation
): number {
  const statusDelta = STATUS_RANK[right.status] - STATUS_RANK[left.status];
  if (statusDelta !== 0) return statusDelta;

  return (
    (right.currentAnchor?.distanceMi ?? 0) -
    (left.currentAnchor?.distanceMi ?? 0)
  );
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function formatAnchor(match: CustomSpotAnchorAuditBeachMatch | null): string {
  if (!match) return "none";
  return `${match.name} (${match.distanceMi.toFixed(1)} mi)`;
}

function formatForecast(
  forecast: CustomSpotAnchorAuditForecastSummary | null
): string {
  if (!forecast) return "none";

  const source = forecast.dataSource ? `, ${forecast.dataSource}` : "";
  const age =
    forecast.ageHours === null
      ? "unknown age"
      : `${forecast.ageHours.toFixed(1)}h old`;

  return `${age}${source}`;
}

export function buildCustomSpotAnchorAudit({
  customSpots,
  beaches,
  forecasts,
  config,
}: BuildCustomSpotAnchorAuditArgs): CustomSpotAnchorAuditResult {
  const mergedConfig: CustomSpotAnchorAuditConfig = {
    ...DEFAULT_CUSTOM_SPOT_ANCHOR_AUDIT_CONFIG,
    now: new Date(),
    ...config,
  };

  const activeBeaches = beaches.filter(
    (beach) =>
      !beach.deletedAt &&
      isFiniteCoordinate(beach.lat) &&
      isFiniteCoordinate(beach.lon)
  );
  const beachById = new Map(activeBeaches.map((beach) => [beach.id, beach]));
  const forecastByBeachId = new Map(
    forecasts.map((forecast) => [forecast.beachId, forecast])
  );

  let excludedCustomSpots = 0;
  const evaluations: CustomSpotAnchorAuditEvaluation[] = [];

  for (const spot of customSpots) {
    if (spot.excluded) {
      excludedCustomSpots += 1;
      continue;
    }

    const currentBeach = spot.nearestBeachId
      ? beachById.get(spot.nearestBeachId)
      : undefined;
    const currentAnchor = currentBeach
      ? formatBeachMatch(spot, currentBeach)
      : null;
    const closestAnchor = findClosestBeach(spot, activeBeaches);
    const forecast = currentBeach
      ? formatForecastSummary(
          forecastByBeachId.get(currentBeach.id),
          mergedConfig.now
        )
      : null;
    const reasons: CustomSpotAnchorAuditReason[] = [];

    if (!spot.nearestBeachId) {
      reasons.push({
        code: "missing_anchor",
        status: "critical",
        detail: "custom spot has no nearest_beach_id",
      });
    } else if (!currentBeach) {
      reasons.push({
        code: "anchor_missing_or_deleted",
        status: "critical",
        detail: "nearest_beach_id does not point to an active beach",
      });
    }

    if (
      currentAnchor &&
      currentAnchor.distanceMi > mergedConfig.maxAnchorDistanceMi
    ) {
      reasons.push({
        code: "anchor_too_far",
        status: "critical",
        detail: `current anchor is ${currentAnchor.distanceMi.toFixed(
          1
        )} mi away`,
      });
    }

    if (
      currentAnchor &&
      closestAnchor &&
      closestAnchor.id !== currentAnchor.id
    ) {
      const improvementMi = currentAnchor.distanceMi - closestAnchor.distanceMi;
      if (
        improvementMi >= mergedConfig.closerAnchorMinDeltaMi &&
        closestAnchor.distanceMi <= mergedConfig.closerAnchorMaxDistanceMi
      ) {
        reasons.push({
          code: "closer_anchor_available",
          status: "watch",
          detail: `${closestAnchor.name} is ${improvementMi.toFixed(
            1
          )} mi closer than the current anchor`,
        });
      }
    }

    if (currentBeach && !forecast) {
      reasons.push({
        code: "forecast_missing",
        status: "critical",
        detail: "current anchor has no latest enhanced forecast row",
      });
    } else if (
      forecast?.ageHours !== null &&
      forecast?.ageHours !== undefined &&
      forecast.ageHours > mergedConfig.forecastFreshnessHours
    ) {
      reasons.push({
        code: "forecast_stale",
        status: "critical",
        detail: `current anchor forecast is ${forecast.ageHours.toFixed(
          1
        )}h old`,
      });
    }

    evaluations.push({
      spotId: spot.id,
      spotName: spot.name,
      userId: spot.userId,
      status: getStatus(reasons),
      reasons,
      currentAnchor,
      closestAnchor,
      storedNearestBeachDistanceMi: spot.nearestBeachDistanceMi ?? null,
      forecast,
    });
  }

  const sortedEvaluations = evaluations.sort(sortEvaluations);
  const summary: CustomSpotAnchorAuditSummary = {
    totalCustomSpots: customSpots.length,
    auditedCustomSpots: evaluations.length,
    excludedCustomSpots,
    pass: sortedEvaluations.filter((evaluation) => evaluation.status === "pass")
      .length,
    watch: sortedEvaluations.filter((evaluation) => evaluation.status === "watch")
      .length,
    critical: sortedEvaluations.filter(
      (evaluation) => evaluation.status === "critical"
    ).length,
    maxAnchorDistanceMi: mergedConfig.maxAnchorDistanceMi,
    forecastFreshnessHours: mergedConfig.forecastFreshnessHours,
  };

  return {
    generatedAt: mergedConfig.now.toISOString(),
    summary,
    evaluations: sortedEvaluations,
  };
}

export function formatCustomSpotAnchorAuditMarkdown(
  result: CustomSpotAnchorAuditResult,
  options: FormatCustomSpotAnchorAuditOptions = {}
): string {
  const limit = options.limit ?? 25;
  const issueRows = result.evaluations.filter(
    (evaluation) => evaluation.status !== "pass"
  );
  const visibleRows = issueRows.slice(0, limit);
  const lines: string[] = [
    "Custom spot forecast-anchor audit",
    `Generated: ${result.generatedAt}`,
    "Mode: read-only",
    `Summary: ${result.summary.critical} critical, ${result.summary.watch} watch, ${result.summary.pass} pass, ${result.summary.excludedCustomSpots} excluded, ${result.summary.auditedCustomSpots} audited`,
    `Thresholds: anchor <= ${result.summary.maxAnchorDistanceMi.toFixed(
      1
    )} mi, forecast <= ${result.summary.forecastFreshnessHours.toFixed(1)}h old`,
    "",
  ];

  if (issueRows.length === 0) {
    lines.push("No custom-spot anchor coverage issues found.");
    return lines.join("\n");
  }

  lines.push(`Issues shown: ${visibleRows.length} of ${issueRows.length}`);

  for (const evaluation of visibleRows) {
    const reasons = evaluation.reasons
      .map((reason) => `${reason.code}: ${reason.detail}`)
      .join("; ");
    lines.push(
      `- ${evaluation.status.toUpperCase()} ${evaluation.spotName} (${shortId(
        evaluation.spotId
      )}, user ${shortId(evaluation.userId)}): current ${formatAnchor(
        evaluation.currentAnchor
      )}; closest ${formatAnchor(evaluation.closestAnchor)}; forecast ${formatForecast(
        evaluation.forecast
      )}; ${reasons}`
    );
  }

  return lines.join("\n");
}
