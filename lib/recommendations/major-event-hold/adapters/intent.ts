import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
  RecommendationAvailability,
} from "../types";
import {
  resolveMajorEventHoldBoundary,
  type MajorEventHoldBoundaryDecision,
} from "./shared";

const INTENT_WINDOW_HALF_WIDTH_MS = 30 * 60 * 1000;

export interface IntentForecastBestWindow {
  start: string;
  end: string;
  reason: string;
}

export interface IntentForecastConditions {
  tide: string;
  wind: string;
  swell: string;
}

export interface IntentForecastTopPickIdentity {
  beachId: string;
}

export interface IntentForecastRankedItem<
  TTopPick extends IntentForecastTopPickIdentity,
> {
  candidate: MajorEventHoldCandidate;
  peakTime: string;
  topPick: TTopPick;
}

export interface IntentForecastHoldInput<
  TTopPick extends IntentForecastTopPickIdentity,
> {
  items: readonly IntentForecastRankedItem<TTopPick>[];
  bestWindow: IntentForecastBestWindow | null;
  bestWindowSourceCandidateId: string | null;
  conditions: IntentForecastConditions;
  isTomorrow: boolean;
}

export interface SanitizedIntentForecastResponse<
  TTopPick extends IntentForecastTopPickIdentity,
> {
  bestWindow: IntentForecastBestWindow | null;
  topPicks: TTopPick[];
  conditions: IntentForecastConditions;
  isTomorrow: boolean;
  recommendationAvailability: RecommendationAvailability;
}

interface ValidatedIntentInput<TTopPick extends IntentForecastTopPickIdentity> {
  items: IntentForecastRankedItem<TTopPick>[];
  serializedCandidates: MajorEventHoldCandidate[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function canonicalInstant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) return null;
  return new Date(milliseconds).toISOString() === value ? milliseconds : null;
}

function parseExactCandidate(value: unknown): MajorEventHoldCandidate | null {
  if (!isRecord(value)) return null;
  if (
    !isNonEmptyString(value.candidateId) ||
    !isNonEmptyString(value.beachId) ||
    typeof value.startsAt !== "string" ||
    typeof value.endsAt !== "string"
  ) {
    return null;
  }
  return {
    candidateId: value.candidateId,
    beachId: value.beachId,
    startsAt: value.startsAt,
    endsAt: value.endsAt,
  };
}

function isBestWindow(value: unknown): value is IntentForecastBestWindow {
  return (
    isRecord(value) &&
    typeof value.start === "string" &&
    typeof value.end === "string" &&
    typeof value.reason === "string"
  );
}

function hasValidBestWindowBinding<
  TTopPick extends IntentForecastTopPickIdentity,
>(input: IntentForecastHoldInput<TTopPick>): boolean {
  if (input.bestWindow === null) {
    return input.bestWindowSourceCandidateId === null;
  }
  return (
    isBestWindow(input.bestWindow) &&
    isNonEmptyString(input.bestWindowSourceCandidateId) &&
    input.items.length > 0 &&
    input.bestWindowSourceCandidateId === input.items[0].candidate.candidateId
  );
}

function validateInput<TTopPick extends IntentForecastTopPickIdentity>(
  input: IntentForecastHoldInput<TTopPick>,
): ValidatedIntentInput<TTopPick> | null {
  if (!Array.isArray(input.items)) return null;

  const items: IntentForecastRankedItem<TTopPick>[] = [];
  const serializedCandidates: MajorEventHoldCandidate[] = [];
  const candidateIds = new Set<string>();

  for (const value of input.items as readonly unknown[]) {
    if (!isRecord(value) || !isRecord(value.topPick)) return null;
    const candidate = parseExactCandidate(value.candidate);
    const peakTimeMs = canonicalInstant(value.peakTime);
    if (
      candidate === null ||
      peakTimeMs === null ||
      value.topPick.beachId !== candidate.beachId
    ) {
      return null;
    }

    const expectedStart = new Date(
      peakTimeMs - INTENT_WINDOW_HALF_WIDTH_MS,
    ).toISOString();
    const expectedEnd = new Date(
      peakTimeMs + INTENT_WINDOW_HALF_WIDTH_MS,
    ).toISOString();
    if (
      candidateIds.has(candidate.candidateId) ||
      candidate.startsAt !== expectedStart ||
      candidate.endsAt !== expectedEnd
    ) {
      return null;
    }

    candidateIds.add(candidate.candidateId);
    const item: IntentForecastRankedItem<TTopPick> = {
      candidate,
      peakTime: value.peakTime as string,
      topPick: value.topPick as TTopPick,
    };
    items.push(item);
    serializedCandidates.push(candidate);
  }

  if (!hasValidBestWindowBinding(input)) return null;
  return { items, serializedCandidates };
}

function sameExactCandidate(
  left: MajorEventHoldCandidate,
  right: MajorEventHoldCandidate,
): boolean {
  return (
    left.candidateId === right.candidateId &&
    left.beachId === right.beachId &&
    left.startsAt === right.startsAt &&
    left.endsAt === right.endsAt
  );
}

function serviceCandidatesMatchExactly(
  candidates: readonly unknown[],
  serializedCandidates: readonly MajorEventHoldCandidate[],
): boolean {
  if (candidates.length !== serializedCandidates.length) return false;
  const expectedById = new Map(
    serializedCandidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const seenCandidateIds = new Set<string>();

  for (const value of candidates) {
    const candidate = parseExactCandidate(value);
    const expected = candidate
      ? expectedById.get(candidate.candidateId)
      : undefined;
    if (
      candidate === null ||
      expected === undefined ||
      seenCandidateIds.has(candidate.candidateId) ||
      !sameExactCandidate(candidate, expected)
    ) {
      return false;
    }
    seenCandidateIds.add(candidate.candidateId);
  }

  return seenCandidateIds.size === expectedById.size;
}

function unavailableBoundary(
  candidates: readonly unknown[],
  decisions: readonly MajorEventHoldCandidateDecision[],
): MajorEventHoldBoundaryDecision {
  return resolveMajorEventHoldBoundary(candidates, [], decisions);
}

export function sanitizeIntentForecastForMajorEventHold<
  TTopPick extends IntentForecastTopPickIdentity,
>(
  input: IntentForecastHoldInput<TTopPick>,
  candidates: readonly unknown[],
  decisions: readonly MajorEventHoldCandidateDecision[],
): SanitizedIntentForecastResponse<TTopPick> {
  const validated = validateInput(input);
  const exactCandidateMatch =
    validated !== null &&
    serviceCandidatesMatchExactly(candidates, validated.serializedCandidates);
  const boundary =
    validated !== null && exactCandidateMatch
      ? resolveMajorEventHoldBoundary(
          candidates,
          validated.serializedCandidates,
          decisions,
        )
      : unavailableBoundary(candidates, decisions);
  const holdStateUnavailable =
    boundary.recommendationAvailability.state === "none" &&
    boundary.recommendationAvailability.reasonCode === "hold_state_unavailable";

  if (validated === null || !exactCandidateMatch || holdStateUnavailable) {
    return {
      bestWindow: null,
      topPicks: [],
      conditions: input.conditions,
      isTomorrow: input.isTomorrow,
      recommendationAvailability: boundary.recommendationAvailability,
    };
  }

  const topPicks = validated.items
    .filter(({ candidate }) =>
      boundary.allowedCandidateIds.has(candidate.candidateId),
    )
    .slice(0, 3)
    .map(({ topPick }) => topPick);
  const bestWindow =
    input.bestWindow !== null &&
    input.bestWindowSourceCandidateId !== null &&
    boundary.allowedCandidateIds.has(input.bestWindowSourceCandidateId)
      ? input.bestWindow
      : null;

  return {
    bestWindow,
    topPicks,
    conditions: input.conditions,
    isTomorrow: input.isTomorrow,
    recommendationAvailability: boundary.recommendationAvailability,
  };
}
