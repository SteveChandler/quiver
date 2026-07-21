import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
  RecommendationAvailability,
} from "../types";
import {
  resolveMajorEventHoldBoundary,
  type MajorEventHoldBoundaryDecision,
} from "./shared";

const SCORED_SLOT_DURATION_MS = 3 * 60 * 60 * 1000;

export interface BulkForecastCandidateBinding {
  beachId: string;
  candidate: MajorEventHoldCandidate;
}

export interface BulkForecastResponseLike {
  conditionScores: Readonly<Record<string, number | undefined>>;
  conditionSummaries: Readonly<Record<string, string | undefined>>;
}

export type SanitizedBulkForecastResponse<
  TResponse extends BulkForecastResponseLike,
> = Omit<TResponse, "conditionScores" | "conditionSummaries"> & {
  conditionScores: Record<string, number | undefined>;
  conditionSummaries: Record<string, string | undefined>;
  recommendationAvailability: RecommendationAvailability;
};

export interface ScoredForecastSlotBinding {
  forecastAt: string;
  candidate: MajorEventHoldCandidate;
}

export interface ScoredForecastGoldenWindowBinding {
  startTime: string;
  endTime: string;
  candidate: MajorEventHoldCandidate;
}

export interface ScoredForecastSlotLike {
  forecastAt: string;
  compositeScore: number;
}

export interface ScoredForecastGoldenWindowLike {
  startTime: string;
  endTime: string;
}

export interface ScoredForecastResponseLike {
  timeSlots: readonly ScoredForecastSlotLike[];
  goldenWindows: readonly ScoredForecastGoldenWindowLike[];
}

type SanitizedScoredForecastSlot<TSlot extends ScoredForecastSlotLike> = Omit<
  TSlot,
  "compositeScore"
> & {
  compositeScore: number | null;
};

export type SanitizedScoredForecastResponse<
  TResponse extends ScoredForecastResponseLike,
> = Omit<TResponse, "timeSlots" | "goldenWindows"> & {
  timeSlots: Array<SanitizedScoredForecastSlot<TResponse["timeSlots"][number]>>;
  goldenWindows: Array<TResponse["goldenWindows"][number]>;
  recommendationAvailability: RecommendationAvailability;
};

interface ValidatedBindings {
  serializedCandidates: MajorEventHoldCandidate[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function uniqueStrings(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function sameStringSet(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): boolean {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}

function instant(value: string): number | null {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function unavailableBoundary(
  candidates: readonly unknown[],
  decisions: readonly MajorEventHoldCandidateDecision[],
): MajorEventHoldBoundaryDecision {
  return resolveMajorEventHoldBoundary(candidates, [], decisions);
}

function validateBulkBindings(
  response: BulkForecastResponseLike,
  bindings: readonly BulkForecastCandidateBinding[],
): ValidatedBindings | null {
  const positiveConditionKeys = new Set<string>();
  for (const [beachId, score] of Object.entries(response.conditionScores)) {
    if (typeof score === "number" && Number.isFinite(score)) {
      positiveConditionKeys.add(beachId);
    }
  }
  for (const [beachId, summary] of Object.entries(
    response.conditionSummaries,
  )) {
    if (summary !== undefined && summary !== "UNKNOWN") {
      positiveConditionKeys.add(beachId);
    }
  }
  const bindingKeys = bindings.map((binding) => binding?.beachId);
  const candidateIds = bindings.map(
    (binding) => binding?.candidate?.candidateId,
  );
  if (
    bindingKeys.some((key) => !isNonEmptyString(key)) ||
    candidateIds.some((candidateId) => !isNonEmptyString(candidateId)) ||
    !uniqueStrings(bindingKeys) ||
    !uniqueStrings(candidateIds) ||
    !sameStringSet(positiveConditionKeys, new Set(bindingKeys)) ||
    bindings.some((binding) => binding.beachId !== binding.candidate.beachId)
  ) {
    return null;
  }

  return {
    serializedCandidates: bindings.map(({ candidate }) => candidate),
  };
}

export function sanitizeBulkForecastForMajorEventHold<
  TResponse extends BulkForecastResponseLike,
>(
  response: TResponse,
  bindings: readonly BulkForecastCandidateBinding[],
  candidates: readonly unknown[],
  decisions: readonly MajorEventHoldCandidateDecision[],
): SanitizedBulkForecastResponse<TResponse> {
  const validated = validateBulkBindings(response, bindings);
  const boundary = validated
    ? resolveMajorEventHoldBoundary(
        candidates,
        validated.serializedCandidates,
        decisions,
      )
    : unavailableBoundary(candidates, decisions);
  const conditionScores = { ...response.conditionScores };
  const conditionSummaries = { ...response.conditionSummaries };
  const clearWholeBoundary =
    boundary.recommendationAvailability.state === "none" &&
    boundary.recommendationAvailability.reasonCode === "hold_state_unavailable";

  if (clearWholeBoundary || validated === null) {
    for (const beachId of Object.keys(response.conditionScores)) {
      delete conditionScores[beachId];
      conditionSummaries[beachId] = "UNKNOWN";
    }
    for (const beachId of Object.keys(response.conditionSummaries)) {
      conditionSummaries[beachId] = "UNKNOWN";
    }

    return {
      ...response,
      conditionScores,
      conditionSummaries,
      recommendationAvailability: boundary.recommendationAvailability,
    };
  }

  for (const binding of bindings) {
    const shouldClear = boundary.blockedCandidateIds.has(
      binding.candidate.candidateId,
    );
    if (!shouldClear) continue;
    delete conditionScores[binding.beachId];
    if (
      Object.prototype.hasOwnProperty.call(
        response.conditionSummaries,
        binding.beachId,
      ) ||
      Object.prototype.hasOwnProperty.call(
        response.conditionScores,
        binding.beachId,
      )
    ) {
      conditionSummaries[binding.beachId] = "UNKNOWN";
    }
  }

  return {
    ...response,
    conditionScores,
    conditionSummaries,
    recommendationAvailability: boundary.recommendationAvailability,
  };
}

function goldenKey(startTime: string, endTime: string): string {
  return `${startTime}\u0000${endTime}`;
}

function validateScoredBindings(
  response: ScoredForecastResponseLike,
  beachId: string,
  slotBindings: readonly ScoredForecastSlotBinding[],
  goldenBindings: readonly ScoredForecastGoldenWindowBinding[],
): ValidatedBindings | null {
  if (
    !isNonEmptyString(beachId) ||
    slotBindings.some(
      (binding) => binding === null || typeof binding !== "object",
    ) ||
    goldenBindings.some(
      (binding) => binding === null || typeof binding !== "object",
    )
  ) {
    return null;
  }

  const slotKeys = response.timeSlots.map(({ forecastAt }) => forecastAt);
  const boundSlotKeys = slotBindings.map(({ forecastAt }) => forecastAt);
  const goldenKeys = response.goldenWindows.map(({ startTime, endTime }) =>
    goldenKey(startTime, endTime),
  );
  const boundGoldenKeys = goldenBindings.map(({ startTime, endTime }) =>
    goldenKey(startTime, endTime),
  );
  if (
    slotBindings.length !== response.timeSlots.length ||
    goldenBindings.length !== response.goldenWindows.length ||
    !uniqueStrings(slotKeys) ||
    !uniqueStrings(boundSlotKeys) ||
    !uniqueStrings(goldenKeys) ||
    !uniqueStrings(boundGoldenKeys) ||
    !sameStringSet(new Set(slotKeys), new Set(boundSlotKeys)) ||
    !sameStringSet(new Set(goldenKeys), new Set(boundGoldenKeys))
  ) {
    return null;
  }

  const slotByForecastAt = new Map(
    response.timeSlots.map((slot) => [slot.forecastAt, slot]),
  );
  for (const binding of slotBindings) {
    const slot = slotByForecastAt.get(binding.forecastAt);
    const startsAtMs = instant(binding.candidate?.startsAt);
    const endsAtMs = instant(binding.candidate?.endsAt);
    const expectedEnd =
      startsAtMs === null
        ? null
        : new Date(startsAtMs + SCORED_SLOT_DURATION_MS).toISOString();
    if (
      !slot ||
      !isNonEmptyString(binding.candidate?.candidateId) ||
      binding.candidate.beachId !== beachId ||
      binding.candidate.startsAt !== slot.forecastAt ||
      startsAtMs === null ||
      endsAtMs !== startsAtMs + SCORED_SLOT_DURATION_MS ||
      binding.candidate.endsAt !== expectedEnd
    ) {
      return null;
    }
  }

  const goldenByKey = new Map(
    response.goldenWindows.map((window) => [
      goldenKey(window.startTime, window.endTime),
      window,
    ]),
  );
  for (const binding of goldenBindings) {
    const window = goldenByKey.get(
      goldenKey(binding.startTime, binding.endTime),
    );
    if (
      !window ||
      !isNonEmptyString(binding.candidate?.candidateId) ||
      binding.candidate.beachId !== beachId ||
      binding.startTime !== window.startTime ||
      binding.endTime !== window.endTime ||
      binding.candidate.startsAt !== window.startTime ||
      binding.candidate.endsAt !== window.endTime
    ) {
      return null;
    }
  }

  const allBindings = [...slotBindings, ...goldenBindings];
  const candidateIds = allBindings.map(
    ({ candidate }) => candidate.candidateId,
  );
  if (!uniqueStrings(candidateIds)) return null;

  return {
    serializedCandidates: allBindings.map(({ candidate }) => candidate),
  };
}

function intervalsOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
): boolean {
  const leftStartMs = instant(leftStart);
  const leftEndMs = instant(leftEnd);
  const rightStartMs = instant(rightStart);
  const rightEndMs = instant(rightEnd);
  if (
    leftStartMs === null ||
    leftEndMs === null ||
    rightStartMs === null ||
    rightEndMs === null
  ) {
    return true;
  }
  return leftStartMs < rightEndMs && rightStartMs < leftEndMs;
}

export function sanitizeScoredForecastForMajorEventHold<
  TResponse extends ScoredForecastResponseLike,
>(
  response: TResponse,
  beachId: string,
  slotBindings: readonly ScoredForecastSlotBinding[],
  goldenBindings: readonly ScoredForecastGoldenWindowBinding[],
  candidates: readonly unknown[],
  decisions: readonly MajorEventHoldCandidateDecision[],
): SanitizedScoredForecastResponse<TResponse> {
  const validated = validateScoredBindings(
    response,
    beachId,
    slotBindings,
    goldenBindings,
  );
  const boundary = validated
    ? resolveMajorEventHoldBoundary(
        candidates,
        validated.serializedCandidates,
        decisions,
      )
    : unavailableBoundary(candidates, decisions);
  const clearWholeBoundary =
    boundary.recommendationAvailability.state === "none" &&
    boundary.recommendationAvailability.reasonCode === "hold_state_unavailable";

  if (clearWholeBoundary || validated === null) {
    return {
      ...response,
      timeSlots: response.timeSlots.map((slot) => ({
        ...slot,
        compositeScore: null,
      })) as Array<SanitizedScoredForecastSlot<TResponse["timeSlots"][number]>>,
      goldenWindows: [],
      recommendationAvailability: boundary.recommendationAvailability,
    };
  }

  const slotBindingByForecastAt = new Map(
    slotBindings.map((binding) => [binding.forecastAt, binding]),
  );
  const blockedSlotBindings = slotBindings.filter(({ candidate }) =>
    boundary.blockedCandidateIds.has(candidate.candidateId),
  );
  const timeSlots = response.timeSlots.map((slot) => {
    const binding = slotBindingByForecastAt.get(slot.forecastAt);
    const shouldClear =
      binding === undefined ||
      boundary.blockedCandidateIds.has(binding.candidate.candidateId);
    return {
      ...slot,
      compositeScore: shouldClear ? null : slot.compositeScore,
    } as SanitizedScoredForecastSlot<TResponse["timeSlots"][number]>;
  });
  const goldenBindingByKey = new Map(
    goldenBindings.map((binding) => [
      goldenKey(binding.startTime, binding.endTime),
      binding,
    ]),
  );
  const goldenWindows: Array<TResponse["goldenWindows"][number]> =
    response.goldenWindows.filter((window) => {
      const binding = goldenBindingByKey.get(
        goldenKey(window.startTime, window.endTime),
      );
      if (
        !binding ||
        boundary.blockedCandidateIds.has(binding.candidate.candidateId)
      ) {
        return false;
      }
      return !blockedSlotBindings.some(({ candidate }) =>
        intervalsOverlap(
          window.startTime,
          window.endTime,
          candidate.startsAt,
          candidate.endsAt,
        ),
      );
    }) as Array<TResponse["goldenWindows"][number]>;

  return {
    ...response,
    timeSlots,
    goldenWindows,
    recommendationAvailability: boundary.recommendationAvailability,
  };
}
