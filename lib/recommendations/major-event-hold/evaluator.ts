import type {
  MajorEventHoldCandidate,
  MajorEventHoldEvaluation,
  MajorEventHoldMode,
  ResolvedMajorEventHold,
  SafetyCohort,
} from "./types";

export const P0_PROTECTED_ALTERNATIVE_POLICY_VERSION =
  "protected-alternative-explicit-none-v1" as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_INSTANT_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseInstant(value: unknown): number | null {
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value))
    return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

export function parseMajorEventHoldCandidate(
  candidate: unknown,
): MajorEventHoldCandidate | null {
  if (!isRecord(candidate)) return null;
  if (
    typeof candidate.candidateId !== "string" ||
    candidate.candidateId.trim().length === 0 ||
    candidate.candidateId.length > 160 ||
    typeof candidate.beachId !== "string" ||
    !UUID_PATTERN.test(candidate.beachId)
  ) {
    return null;
  }

  const startsAt = parseInstant(candidate.startsAt);
  const endsAt = parseInstant(candidate.endsAt);
  if (startsAt === null || endsAt === null || endsAt <= startsAt) return null;

  return {
    candidateId: candidate.candidateId,
    beachId: candidate.beachId.toLowerCase(),
    startsAt: candidate.startsAt as string,
    endsAt: candidate.endsAt as string,
  };
}

function latestVersions(
  holds: readonly ResolvedMajorEventHold[],
): ResolvedMajorEventHold[] {
  const latestByHoldId = new Map<string, ResolvedMajorEventHold>();
  for (const hold of holds) {
    const current = latestByHoldId.get(hold.holdId);
    if (!current || hold.version > current.version) {
      latestByHoldId.set(hold.holdId, hold);
    }
  }
  return [...latestByHoldId.values()];
}

function matchingHolds(
  holds: readonly ResolvedMajorEventHold[],
  cohort: SafetyCohort,
  candidate: MajorEventHoldCandidate,
): ResolvedMajorEventHold[] {
  const candidateStart = Date.parse(candidate.startsAt);
  const candidateEnd = Date.parse(candidate.endsAt);

  return latestVersions(holds)
    .filter((hold) => hold.status === "active")
    .filter((hold) => hold.scopeBeachIds.includes(candidate.beachId))
    .filter((hold) => hold.affectedCohorts.includes(cohort))
    .filter(
      (hold) =>
        Date.parse(hold.validFrom) < candidateEnd &&
        Date.parse(hold.validUntil) > candidateStart,
    )
    .sort((left, right) => left.holdId.localeCompare(right.holdId));
}

export interface EvaluateMajorEventHoldInput {
  mode: MajorEventHoldMode;
  resolutionState: "resolved" | "unresolved";
  holds: readonly ResolvedMajorEventHold[];
  cohort: SafetyCohort;
  candidate: unknown;
  holdEpoch?: string;
}

export function evaluateMajorEventHold({
  mode,
  resolutionState,
  holds,
  cohort,
  candidate,
  holdEpoch = `${mode}:${resolutionState}`,
}: EvaluateMajorEventHoldInput): MajorEventHoldEvaluation {
  if (mode === "off") {
    return { outcome: "allow", holdIds: [], holdEpoch };
  }

  const parsedCandidate = parseMajorEventHoldCandidate(candidate);
  if (resolutionState === "unresolved" || parsedCandidate === null) {
    if (mode === "shadow") {
      return { outcome: "allow", holdIds: [], holdEpoch };
    }
    return {
      outcome: "explicit_none",
      reasonCode: "hold_state_unavailable",
      holdIds: [],
      holdEpoch,
    };
  }

  const matches = matchingHolds(holds, cohort, parsedCandidate);
  if (matches.length === 0) {
    return { outcome: "allow", holdIds: [], holdEpoch };
  }

  const holdIds = matches.map((hold) => hold.holdId);
  const expiresAt = matches
    .map((hold) => hold.expiresAt)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];

  if (mode === "shadow") {
    return { outcome: "allow", holdIds, expiresAt, holdEpoch };
  }

  return {
    outcome: "explicit_none",
    reasonCode: "major_event_hold",
    holdIds,
    expiresAt,
    holdEpoch,
  };
}

export function evaluateMajorEventHoldCandidateBatch(
  inputs: readonly EvaluateMajorEventHoldInput[],
): MajorEventHoldEvaluation[] {
  return inputs.map(evaluateMajorEventHold);
}
