import { parseMajorEventHoldCandidate } from "../evaluator";
import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
  RecommendationAvailability,
} from "../types";

const UNAVAILABLE_HOLD_EPOCH = "hold-state-unavailable";
const ABSOLUTE_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;

export interface MajorEventHoldBoundaryDecision {
  recommendationAvailability: RecommendationAvailability;
  allowedCandidateIds: ReadonlySet<string>;
  blockedCandidateIds: ReadonlySet<string>;
}

interface ParsedDecision {
  candidateId: string;
  state: "available" | "blocked" | "unavailable";
  reasonCode?: "major_event_hold" | "water_quality_hold";
  holdEpoch: string;
  expiresAt?: string;
  expiresAtMs?: number;
  resolutionAsOf?: string;
}

function parseAbsoluteInstant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = ABSOLUTE_INSTANT_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[7] === "Z" ? 0 : Number(match[8]);
  const offsetMinute = match[7] === "Z" ? 0 : Number(match[9]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function unavailableBoundary(
  decisions: readonly MajorEventHoldCandidateDecision[],
): MajorEventHoldBoundaryDecision {
  const epochs = decisions.flatMap((decision) => {
    const availability = decision?.recommendationAvailability;
    return availability &&
      typeof availability.holdEpoch === "string" &&
      availability.holdEpoch.length > 0
      ? [availability.holdEpoch]
      : [];
  });
  const holdEpoch =
    epochs.length > 0 && epochs.every((epoch) => epoch === epochs[0])
      ? epochs[0]
      : UNAVAILABLE_HOLD_EPOCH;
  const resolutionSnapshots = decisions.flatMap((decision) => {
    const value = decision?.recommendationAvailability?.resolutionAsOf;
    return parseAbsoluteInstant(value) === null || value === undefined
      ? []
      : [value];
  });
  const resolutionAsOf =
    decisions.length > 0 &&
    resolutionSnapshots.length === decisions.length &&
    resolutionSnapshots.every((value) => value === resolutionSnapshots[0])
      ? resolutionSnapshots[0]
      : undefined;
  return {
    recommendationAvailability: {
      state: "none",
      reasonCode: "hold_state_unavailable",
      holdEpoch,
      ...(resolutionAsOf ? { resolutionAsOf } : {}),
    },
    allowedCandidateIds: new Set(),
    blockedCandidateIds: new Set(),
  };
}

function parseDecision(
  value: MajorEventHoldCandidateDecision,
): ParsedDecision | null {
  if (!value || typeof value !== "object") return null;
  const { candidateId, evaluation, recommendationAvailability } = value;
  if (typeof candidateId !== "string" || candidateId.length === 0) return null;
  if (!evaluation || typeof evaluation !== "object") return null;
  if (
    !recommendationAvailability ||
    typeof recommendationAvailability !== "object"
  ) {
    return null;
  }
  if (
    typeof evaluation.holdEpoch !== "string" ||
    evaluation.holdEpoch.length === 0 ||
    recommendationAvailability.holdEpoch !== evaluation.holdEpoch ||
    !Array.isArray(evaluation.holdIds) ||
    !evaluation.holdIds.every(
      (holdId) => typeof holdId === "string" && holdId.length > 0,
    )
  ) {
    return null;
  }

  const evaluationExpiryMs =
    evaluation.expiresAt === undefined
      ? undefined
      : parseAbsoluteInstant(evaluation.expiresAt);
  const availabilityExpiryMs =
    recommendationAvailability.expiresAt === undefined
      ? undefined
      : parseAbsoluteInstant(recommendationAvailability.expiresAt);
  const resolutionAsOfMs =
    recommendationAvailability.resolutionAsOf === undefined
      ? undefined
      : parseAbsoluteInstant(recommendationAvailability.resolutionAsOf);
  if (
    evaluationExpiryMs === null ||
    availabilityExpiryMs === null ||
    resolutionAsOfMs === null
  ) {
    return null;
  }
  const uniqueHoldIds =
    new Set(evaluation.holdIds).size === evaluation.holdIds.length;
  if (!uniqueHoldIds) return null;

  if (evaluation.outcome === "allow") {
    const isOrdinaryAllow =
      evaluation.holdIds.length === 0 && evaluationExpiryMs === undefined;
    const isShadowWouldBlock =
      evaluation.holdIds.length > 0 && evaluationExpiryMs !== undefined;
    if (
      recommendationAvailability.state !== "available" ||
      evaluation.reasonCode !== undefined ||
      recommendationAvailability.reasonCode !== undefined ||
      recommendationAvailability.expiresAt !== undefined ||
      (!isOrdinaryAllow && !isShadowWouldBlock)
    ) {
      return null;
    }
    return {
      candidateId,
      state: "available",
      holdEpoch: evaluation.holdEpoch,
      resolutionAsOf: recommendationAvailability.resolutionAsOf,
    };
  }

  if (
    evaluation.outcome !== "explicit_none" ||
    recommendationAvailability.state !== "none" ||
    evaluation.reasonCode !== recommendationAvailability.reasonCode ||
    !["major_event_hold", "water_quality_hold", "hold_state_unavailable"].includes(
      evaluation.reasonCode ?? "",
    ) ||
    evaluation.expiresAt !== recommendationAvailability.expiresAt
  ) {
    return null;
  }

  if (
    evaluation.reasonCode === "major_event_hold" ||
    evaluation.reasonCode === "water_quality_hold"
  ) {
    if (
      evaluation.holdIds.length === 0 ||
      (evaluation.reasonCode === "major_event_hold" &&
        (evaluationExpiryMs === undefined ||
          availabilityExpiryMs === undefined)) ||
      (evaluation.reasonCode === "water_quality_hold" &&
        (evaluationExpiryMs !== undefined || availabilityExpiryMs !== undefined))
    ) {
      return null;
    }
  } else if (
    evaluation.holdIds.length !== 0 ||
    evaluationExpiryMs !== undefined ||
    availabilityExpiryMs !== undefined
  ) {
    return null;
  }

  return {
    candidateId,
    state:
      evaluation.reasonCode === "hold_state_unavailable"
        ? "unavailable"
        : "blocked",
    ...(evaluation.reasonCode === "major_event_hold" ||
    evaluation.reasonCode === "water_quality_hold"
      ? { reasonCode: evaluation.reasonCode }
      : {}),
    holdEpoch: evaluation.holdEpoch,
    expiresAt: evaluation.expiresAt,
    expiresAtMs: evaluationExpiryMs,
    resolutionAsOf: recommendationAvailability.resolutionAsOf,
  };
}

function sameCandidateIdentity(
  left: MajorEventHoldCandidate,
  right: MajorEventHoldCandidate,
): boolean {
  return (
    left.candidateId === right.candidateId &&
    left.beachId === right.beachId &&
    Date.parse(left.startsAt) === Date.parse(right.startsAt) &&
    Date.parse(left.endsAt) === Date.parse(right.endsAt)
  );
}

function candidateMap(
  candidates: readonly unknown[],
  allowConsistentRepresentations: boolean,
): Map<string, MajorEventHoldCandidate> | null {
  const byId = new Map<string, MajorEventHoldCandidate>();
  for (const candidate of candidates) {
    const parsed = parseMajorEventHoldCandidate(candidate);
    if (parsed === null) return null;
    const existing = byId.get(parsed.candidateId);
    if (existing) {
      if (
        !allowConsistentRepresentations ||
        !sameCandidateIdentity(existing, parsed)
      ) {
        return null;
      }
      continue;
    }
    byId.set(parsed.candidateId, parsed);
  }
  return byId;
}

export function resolveMajorEventHoldBoundary(
  candidates: readonly unknown[],
  serializedCandidates: readonly unknown[],
  decisions: readonly MajorEventHoldCandidateDecision[],
): MajorEventHoldBoundaryDecision {
  const candidateById = candidateMap(candidates, false);
  const serializedById = candidateMap(serializedCandidates, true);
  if (
    candidateById === null ||
    serializedById === null ||
    candidateById.size === 0 ||
    candidateById.size !== candidates.length ||
    candidateById.size !== serializedById.size ||
    [...candidateById].some(([candidateId, candidate]) => {
      const serialized = serializedById.get(candidateId);
      return (
        serialized === undefined ||
        !sameCandidateIdentity(candidate, serialized)
      );
    }) ||
    decisions.length !== candidateById.size
  ) {
    return unavailableBoundary(decisions);
  }

  const parsed = decisions.map(parseDecision);
  if (parsed.some((item) => item === null)) {
    return unavailableBoundary(decisions);
  }
  const validDecisions = parsed as ParsedDecision[];
  const decisionIds = new Set(
    validDecisions.map(({ candidateId }) => candidateId),
  );
  const holdEpoch = validDecisions[0].holdEpoch;
  const resolutionAsOf = validDecisions[0].resolutionAsOf;
  if (
    decisionIds.size !== validDecisions.length ||
    decisionIds.size !== candidateById.size ||
    [...candidateById].some(([candidateId]) => !decisionIds.has(candidateId)) ||
    validDecisions.some((decision) => decision.holdEpoch !== holdEpoch) ||
    validDecisions.some(
      (decision) => decision.resolutionAsOf !== resolutionAsOf,
    ) ||
    validDecisions.some((decision) => decision.state === "unavailable")
  ) {
    return unavailableBoundary(decisions);
  }

  const allowedCandidateIds = new Set(
    validDecisions
      .filter(({ state }) => state === "available")
      .map(({ candidateId }) => candidateId),
  );
  const blocked = validDecisions.filter(({ state }) => state === "blocked");
  const blockedCandidateIds = new Set(
    blocked.map(({ candidateId }) => candidateId),
  );
  if (allowedCandidateIds.size > 0) {
    return {
      recommendationAvailability: {
        state: "available",
        holdEpoch,
        ...(resolutionAsOf ? { resolutionAsOf } : {}),
      },
      allowedCandidateIds,
      blockedCandidateIds,
    };
  }

  const latestExpiry = blocked.reduce<ParsedDecision | null>(
    (latest, decision) => {
      if (decision.expiresAtMs === undefined) return latest;
      if (latest?.expiresAtMs === undefined) return decision;
      return decision.expiresAtMs > latest.expiresAtMs ? decision : latest;
    },
    null,
  );
  return {
    recommendationAvailability: {
      state: "none",
      reasonCode: blocked.some(
        ({ reasonCode }) => reasonCode === "major_event_hold",
      )
        ? "major_event_hold"
        : "water_quality_hold",
      ...(latestExpiry?.expiresAt ? { expiresAt: latestExpiry.expiresAt } : {}),
      holdEpoch,
      ...(resolutionAsOf ? { resolutionAsOf } : {}),
    },
    allowedCandidateIds,
    blockedCandidateIds,
  };
}
