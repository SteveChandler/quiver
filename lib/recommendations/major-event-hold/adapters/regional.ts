import type {
  DaySummary,
  RegionalForecastSummary,
} from "@/lib/utils/regional-forecast-utils";
import { parseMajorEventHoldCandidate } from "../evaluator";
import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
  RecommendationAvailability,
} from "../types";
import { resolveMajorEventHoldBoundary } from "./shared";

const DEFAULT_DAY_BEACH_LIMIT = 5;
const DEFAULT_SURF_WINDOW_LIMIT = 5;

export type MajorEventHoldRegionalForecastSummary =
  RegionalForecastSummary & {
    recommendationAvailability: RecommendationAvailability;
  };

function dayCandidateId(dateString: string, beachId: string): string {
  return `regional-day:${dateString}:${beachId}`;
}

function surfWindowCandidateId(windowId: string): string {
  return `regional-window:${windowId}`;
}

function currentCandidateId(beachId: string): string {
  return `regional-current:${beachId}`;
}

function serializedCandidates(summary: RegionalForecastSummary): unknown[] {
  return [
    ...summary.days.flatMap((day) =>
      day.topBeaches.map((beach) => ({
        candidateId: dayCandidateId(day.dateString, beach.id),
        beachId: beach.id,
        startsAt: beach.windowStart,
        endsAt: beach.windowEnd,
      })),
    ),
    ...(summary.bestSurfWindows ?? []).map((window) => ({
      candidateId: surfWindowCandidateId(window.windowId),
      beachId: window.beach.id,
      startsAt: window.startIso,
      endsAt: window.endIso,
    })),
    ...summary.beachConditions.map((beach) => ({
      candidateId: currentCandidateId(beach.beachId),
      beachId: beach.beachId,
      startsAt: beach.currentWindowStart,
      endsAt: beach.currentWindowEnd,
    })),
  ];
}

export function buildRegionalMajorEventHoldCandidates(
  summary: RegionalForecastSummary,
): MajorEventHoldCandidate[] {
  const candidates = serializedCandidates(summary).map(
    parseMajorEventHoldCandidate,
  );
  if (candidates.some((candidate) => candidate === null)) return [];
  return candidates as MajorEventHoldCandidate[];
}

function sanitizeDay(
  day: DaySummary,
  allowedCandidateIds: ReadonlySet<string>,
  displayLimit: number,
): DaySummary {
  const allowedPool = day.topBeaches.filter((beach) =>
    allowedCandidateIds.has(dayCandidateId(day.dateString, beach.id)),
  );
  const score =
    allowedPool.length > 0
      ? Math.round(
          allowedPool.reduce((sum, beach) => sum + beach.score, 0) /
            allowedPool.length,
        )
      : 0;

  return {
    ...day,
    score,
    topBeaches: allowedPool.slice(0, displayLimit),
    beachesWithGoodConditions: allowedPool.filter(({ score }) => score > 60)
      .length,
  };
}

function neutralAvailability(
  availability: RecommendationAvailability,
): RecommendationAvailability {
  return {
    state: "none",
    reasonCode: "hold_state_unavailable",
    holdEpoch: availability.holdEpoch,
    ...(availability.resolutionAsOf
      ? { resolutionAsOf: availability.resolutionAsOf }
      : {}),
  };
}

function unboundRollbackAvailability(
  candidates: readonly MajorEventHoldCandidate[],
  serialized: readonly unknown[],
  decisions: readonly MajorEventHoldCandidateDecision[],
): RecommendationAvailability | null {
  if (
    candidates.length !== 0 ||
    serialized.length === 0 ||
    decisions.length !== 1
  ) {
    return null;
  }
  const decision = decisions[0];
  const { evaluation, recommendationAvailability } = decision;
  if (
    decision.candidateId !== null ||
    evaluation.outcome !== "allow" ||
    evaluation.reasonCode !== undefined ||
    evaluation.holdIds.length !== 0 ||
    evaluation.expiresAt !== undefined ||
    recommendationAvailability.state !== "available" ||
    recommendationAvailability.reasonCode !== undefined ||
    recommendationAvailability.expiresAt !== undefined ||
    recommendationAvailability.holdEpoch !== evaluation.holdEpoch
  ) {
    return null;
  }
  return recommendationAvailability;
}

function preserveLegacyRegionalRecommendations(
  summary: Readonly<RegionalForecastSummary>,
  recommendationAvailability: RecommendationAvailability,
  dayBeachLimit: number,
  surfWindowLimit: number,
): MajorEventHoldRegionalForecastSummary {
  const days = summary.days.map((day) => ({
    ...day,
    topBeaches: day.topBeaches.slice(0, dayBeachLimit),
  }));
  const bestDay =
    days.find(({ dateString }) => dateString === summary.bestDay.dateString) ??
    days[0] ??
    summary.bestDay;
  return {
    ...summary,
    days,
    bestDay,
    bestSurfWindows: (summary.bestSurfWindows ?? []).slice(
      0,
      surfWindowLimit,
    ),
    beachConditions: [...summary.beachConditions],
    recommendationAvailability,
  };
}

export function sanitizeRegionalForecastForMajorEventHold(
  summary: Readonly<RegionalForecastSummary>,
  candidates: readonly MajorEventHoldCandidate[],
  decisions: readonly MajorEventHoldCandidateDecision[],
  options: {
    dayBeachLimit?: number;
    surfWindowLimit?: number;
  } = {},
): MajorEventHoldRegionalForecastSummary {
  const serialized = serializedCandidates(summary as RegionalForecastSummary);
  const dayBeachLimit = Math.max(
    0,
    options.dayBeachLimit ?? DEFAULT_DAY_BEACH_LIMIT,
  );
  const surfWindowLimit = Math.max(
    0,
    options.surfWindowLimit ?? DEFAULT_SURF_WINDOW_LIMIT,
  );
  const rollbackAvailability = unboundRollbackAvailability(
    candidates,
    serialized,
    decisions,
  );
  if (rollbackAvailability) {
    return preserveLegacyRegionalRecommendations(
      summary,
      rollbackAvailability,
      dayBeachLimit,
      surfWindowLimit,
    );
  }

  const boundary = resolveMajorEventHoldBoundary(
    candidates,
    serialized,
    decisions,
  );
  const days = summary.days.map((day) =>
    sanitizeDay(day, boundary.allowedCandidateIds, dayBeachLimit),
  );
  const bestSurfWindows = (summary.bestSurfWindows ?? [])
    .filter(
      (window) =>
        boundary.allowedCandidateIds.has(
          surfWindowCandidateId(window.windowId),
        ),
    )
    .slice(0, surfWindowLimit)
    .map((window, index) => ({ ...window, rank: index + 1 }));
  const beachConditions = summary.beachConditions.filter((beach) =>
    boundary.allowedCandidateIds.has(currentCandidateId(beach.beachId)),
  );
  const bestDay = days.reduce(
    (best, day) => (day.score > best.score ? day : best),
    days[0] ?? sanitizeDay(summary.bestDay, new Set(), dayBeachLimit),
  );
  const hasPositiveRecommendation =
    days.some((day) => day.topBeaches.length > 0) ||
    bestSurfWindows.length > 0 ||
    beachConditions.length > 0;
  const recommendationAvailability = hasPositiveRecommendation
    ? boundary.recommendationAvailability
    : boundary.recommendationAvailability.state === "none"
      ? boundary.recommendationAvailability
      : neutralAvailability(boundary.recommendationAvailability);

  return {
    ...summary,
    days,
    bestDay,
    bestSurfWindows,
    beachConditions,
    recommendationAvailability,
    stats: {
      ...summary.stats,
      avgRegionScore:
        days.length > 0
          ? Math.round(
              days.reduce((sum, day) => sum + day.score, 0) / days.length,
            )
          : 0,
    },
  };
}
