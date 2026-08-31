import type {
  WeekScoutDayResponse,
  WeekScoutResponse,
  WeekScoutWindowResponse,
} from "@/lib/services/discovery/week-scout";
import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
  RecommendationAvailability,
} from "../types";
import { resolveMajorEventHoldBoundary } from "./shared";

export type MajorEventHoldWeekScoutWindow = Omit<
  WeekScoutWindowResponse,
  "conditionScore" | "rankingScore" | "verdict" | "rideable" | "safe"
> & {
  conditionScore: number | null;
  rankingScore: number | null;
  verdict: WeekScoutWindowResponse["verdict"] | null;
  rideable: boolean | null;
  safe: boolean | null;
};

export type MajorEventHoldWeekScoutDay = Omit<
  WeekScoutDayResponse,
  "windows"
> & {
  windows: MajorEventHoldWeekScoutWindow[];
};

export type MajorEventHoldWeekScoutResponse = Omit<
  WeekScoutResponse,
  "days"
> & {
  days: MajorEventHoldWeekScoutDay[];
  recommendationAvailability: RecommendationAvailability;
};

function hasConsistentSecondaryMappings(response: WeekScoutResponse): boolean {
  return response.days.every((day) => {
    const ids = new Set(day.windows.map(({ id }) => id));
    if (day.bestWindowId !== null && !ids.has(day.bestWindowId)) return false;
    return day.windows.every((window) =>
      window.rankedSpots.every(
        (spot) =>
          day.windows.filter(
            (candidate) =>
              candidate.bucket === window.bucket &&
              candidate.beachId === spot.beachId,
          ).length === 1,
      ),
    );
  });
}

export function sanitizeWeekScoutForMajorEventHold(
  response: Readonly<WeekScoutResponse>,
  candidates: readonly MajorEventHoldCandidate[],
  decisions: readonly MajorEventHoldCandidateDecision[],
): MajorEventHoldWeekScoutResponse {
  const serializedCandidates: unknown[] = response.days.flatMap((day) =>
    day.windows.map((window) => ({
      candidateId: window.id,
      beachId: window.beachId,
      startsAt: window.start,
      endsAt: window.end,
    })),
  );
  const serializedIds = response.days.flatMap((day) =>
    day.windows.map(({ id }) => id),
  );
  if (
    new Set(serializedIds).size !== serializedIds.length ||
    !hasConsistentSecondaryMappings(response)
  ) {
    serializedCandidates.push(null);
  }
  const boundary = resolveMajorEventHoldBoundary(
    candidates,
    serializedCandidates,
    decisions,
  );
  const days = response.days.map((day): MajorEventHoldWeekScoutDay => {
    const isEligible = (window: WeekScoutWindowResponse): boolean =>
      boundary.allowedCandidateIds.has(window.id) &&
      window.safe &&
      window.rideable &&
      window.verdict !== "skip";
    const originalBestWindow = day.windows.find(
      (window) => window.id === day.bestWindowId,
    );
    const bestAllowedWindow = originalBestWindow && isEligible(originalBestWindow)
      ? originalBestWindow
      : day.windows
        .filter(isEligible)
        .reduce<WeekScoutWindowResponse | null>(
          (current, candidate) =>
            !current || candidate.rankingScore > current.rankingScore
              ? candidate
              : current,
          null,
        );
    const idByBucketAndBeach = new Map(
      day.windows.map((window) => [
        `${window.bucket}:${window.beachId}`,
        window.id,
      ]),
    );
    const windows = day.windows.map((window): MajorEventHoldWeekScoutWindow => {
      const allowed = boundary.allowedCandidateIds.has(window.id);
      if (!allowed) {
        return {
          ...window,
          conditionScore: null,
          rankingScore: null,
          verdict: null,
          rideable: null,
          safe: null,
          takeaway: null,
          rankedSpots: [],
        };
      }

      return {
        ...window,
        rankedSpots: window.rankedSpots.filter((spot) => {
          const candidateId = idByBucketAndBeach.get(
            `${window.bucket}:${spot.beachId}`,
          );
          return (
            candidateId !== undefined &&
            boundary.allowedCandidateIds.has(candidateId)
          );
        }),
      };
    });
    return {
      ...day,
      windows,
      bestWindowId: bestAllowedWindow?.id ?? null,
      exclusionReasons:
        boundary.recommendationAvailability.state === "available" &&
        day.bestWindowId === null
          ? day.exclusionReasons
          : boundary.recommendationAvailability.state === "available" &&
              bestAllowedWindow === null &&
              day.bestWindowId !== null &&
              !boundary.allowedCandidateIds.has(day.bestWindowId)
            ? ["major_event_hold"]
          : [],
    };
  });

  return {
    ...response,
    days,
    recommendationAvailability: boundary.recommendationAvailability,
  };
}
