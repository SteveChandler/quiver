import { randomUUID } from "node:crypto";

import { verifySwellWatchPolicy, type SwellWatchPolicy } from "./policy";
import type { SwellWatchImpactResult } from "./impact-evaluator";

export type EvaluationIdentity =
  | { kind: "genuine_completed" | "synthetic_fixture"; id: string }
  | { kind: "immutable_issuance_unavailable"; id: null };
export interface RegionalSwellEvaluation {
  regionKey: string;
  identity: EvaluationIdentity;
  impact: SwellWatchImpactResult | Pick<
    Extract<SwellWatchImpactResult, { kind: "candidate" }>,
    "kind" | "partition" | "arrivalAt" | "policyHash"
  >;
  peakAt: string;
  persistedRegionalEventId?: string | null;
}
interface PersistedRegionalSwellEvent {
  regionalEventId: string;
  regionKey: string;
  aliases: readonly string[];
  reference: RegionalSwellEvaluation;
}
export interface MatchedRegionalEvent {
  regionalEventId: string | null;
  regionKey: string;
  evaluationIds: string[];
  status: "candidate" | "stable" | "suppressed";
  reason?:
    | "missing_immutable_issuance"
    | "incoherent_evaluation"
    | "continuity_broken"
    | "ambiguous_persisted_event"
    | "insufficient_distinct_evaluations";
  aliases?: string[];
}

function eligible(
  identity: EvaluationIdentity,
  fixture: boolean,
): identity is Exclude<
  EvaluationIdentity,
  { kind: "immutable_issuance_unavailable" }
> {
  return (
    identity.kind === "genuine_completed" ||
    (fixture && identity.kind === "synthetic_fixture")
  );
}

function difference(
  left: RegionalSwellEvaluation,
  right: RegionalSwellEvaluation,
  policy: SwellWatchPolicy,
): number {
  if (left.impact.kind !== "candidate" || right.impact.kind !== "candidate")
    return Infinity;
  if (
    left.impact.policyHash !== policy.value_hash ||
    right.impact.policyHash !== policy.value_hash
  )
    return Infinity;
  const {
    maximum_arrival_delta_hours: maxHours,
    maximum_direction_delta_deg: maxDirection,
    maximum_period_delta_s: maxPeriod,
  } = policy.policy_values.partition_matching;
  const l = left.impact.partition;
  const r = right.impact.partition;
  const rawDirection = Math.abs(l.directionDeg - r.directionDeg) % 360;
  const direction = Math.min(rawDirection, 360 - rawDirection);
  const arrival =
    Math.abs(
      Date.parse(left.impact.arrivalAt) - Date.parse(right.impact.arrivalAt),
    ) / 3_600_000;
  const peak =
    Math.abs(Date.parse(left.peakAt) - Date.parse(right.peakAt)) / 3_600_000;
  if (!Number.isFinite(arrival) || !Number.isFinite(peak)
    || left.regionKey !== right.regionKey || l.provider !== r.provider) return Infinity;
  return Math.max(Math.abs(l.periodS - r.periodS) / maxPeriod, direction / maxDirection,
    arrival / maxHours, peak / maxHours);
}

function coherent(left: RegionalSwellEvaluation, right: RegionalSwellEvaluation, policy: SwellWatchPolicy): boolean {
  return difference(left, right, policy) <= 1;
}

export function calculateSwellWatchConsistency(
  prior: RegionalSwellEvaluation, current: RegionalSwellEvaluation, policy: SwellWatchPolicy,
): number | null {
  if (!verifySwellWatchPolicy(policy) || prior.identity.kind !== "genuine_completed"
    || current.identity.kind !== "genuine_completed" || prior.identity.id === current.identity.id
    || prior.impact.kind !== "candidate" || current.impact.kind !== "candidate"
    || prior.impact.partition.evaluationId !== prior.identity.id
    || current.impact.partition.evaluationId !== current.identity.id) return null;
  const delta = difference(prior, current, policy);
  return Number.isFinite(delta) && delta <= 1 ? 1 - delta : null;
}

function resolveRegionalEventId(
  current: RegionalSwellEvaluation,
  policy: SwellWatchPolicy,
  persistedEvents: readonly PersistedRegionalSwellEvent[],
  allocateId: () => string,
): { regionalEventId: string; aliases: string[] } | null {
  const matches = persistedEvents.filter(
    (event) =>
      event.regionKey === current.regionKey &&
      coherent(event.reference, current, policy),
  );
  if (new Set(matches.map((event) => event.regionalEventId)).size > 1) return null;
  const match = matches[0];
  if (match) {
    return {
      regionalEventId: match.regionalEventId,
      aliases: [match.regionalEventId],
    };
  }
  const supplied = current.persistedRegionalEventId;
  const suppliedEvent = persistedEvents.find(
    (event) => event.regionalEventId === supplied,
  );
  return {
    regionalEventId:
      supplied !== null && supplied !== undefined && suppliedEvent === undefined
        ? supplied
        : allocateId(),
    aliases: [],
  };
}

export function matchRegionalSwellEvent(
  evaluations: readonly RegionalSwellEvaluation[],
  policy: SwellWatchPolicy,
  options: {
    allowSyntheticFixture?: boolean;
    persistedEvents?: readonly PersistedRegionalSwellEvent[];
    allocateId?: () => string;
  } = {},
): MatchedRegionalEvent {
  const current = evaluations.at(-1);
  if (!current || !verifySwellWatchPolicy(policy))
    return {
      regionalEventId: null,
      regionKey: current?.regionKey ?? "unknown",
      evaluationIds: [],
      status: "suppressed",
      reason: "incoherent_evaluation",
    };
  if (!eligible(current.identity, options.allowSyntheticFixture === true))
    return {
      regionalEventId: null,
      regionKey: current.regionKey,
      evaluationIds: [],
      status: "suppressed",
      reason: "missing_immutable_issuance",
    };
  if (
    current.impact.kind !== "candidate" ||
    current.impact.policyHash !== policy.value_hash
  )
    return {
      regionalEventId: current.persistedRegionalEventId ?? null,
      regionKey: current.regionKey,
      evaluationIds: [],
      status: "suppressed",
      reason: "continuity_broken",
    };
  const contiguous: RegionalSwellEvaluation[] = [current];
  for (let i = evaluations.length - 2; i >= 0; i -= 1) {
    const prior = evaluations[i];
    if (
      !eligible(prior.identity, options.allowSyntheticFixture === true) ||
      !coherent(prior, contiguous[0], policy)
    )
      break;
    contiguous.unshift(prior);
  }
  const evaluationIds = [
    ...new Set(
      contiguous
        .map((item) => item.identity.id)
        .filter((id): id is string => id !== null),
    ),
  ].sort();
  const resolved = resolveRegionalEventId(
    current,
    policy,
    options.persistedEvents ?? [],
    options.allocateId ?? randomUUID,
  );
  if (resolved === null) return {
    regionalEventId: null,
    regionKey: current.regionKey,
    evaluationIds: [],
    status: "suppressed",
    reason: "ambiguous_persisted_event",
  };
  const regionalEventId = resolved.regionalEventId;
  const aliases = [regionalEventId];
  if (
    evaluationIds.length <
    policy.policy_values.stability.minimum_genuine_evaluations
  )
    return {
      regionalEventId,
      regionKey: current.regionKey,
      evaluationIds,
      status: "candidate",
      reason: "insufficient_distinct_evaluations",
      aliases,
    };
  return {
    regionalEventId,
    regionKey: current.regionKey,
    evaluationIds,
    status: "stable",
    aliases,
  };
}
