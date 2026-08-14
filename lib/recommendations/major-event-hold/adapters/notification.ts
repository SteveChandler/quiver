import { createHash } from "node:crypto";

import { MAJOR_EVENT_HOLD_MODE } from "../config";
import { parseMajorEventHoldCandidate } from "../evaluator";
import { evaluateMajorEventHoldCandidates } from "../service";
import type { EvaluateMajorEventHoldCandidatesInput } from "../service";
import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
  MajorEventHoldMode,
  RecommendationHoldReasonCode,
} from "../types";
import { resolveMajorEventHoldBoundary } from "./shared";
import { canonicalSessionDecisionSchema } from "@/lib/recommendations/canonical-decision/contract";
import { parseSkillLevel } from "@/lib/domains/user-preferences/skill-level";

const POSITIVE_NOTIFICATION_TYPES = new Set([
  "forecast_alert",
  "similarity_match",
  "home_morning_call",
  "weekend_window",
]);
// A water-quality alert is an explicit safety warning for the beach the user
// configured, not a Quiver recommendation. Naming that beach is intentional.
const USER_CONFIGURED_SAFETY_NOTIFICATION_TYPES = new Set(["water_quality"]);
const FORECAST_SLOT_DURATION_MS = 60 * 60 * 1000;
const AUDIT_CODE = "major_event_hold" as const;
const MAX_CANDIDATE_ID_LENGTH = 160;
const HASHED_CANDIDATE_PREFIX = "notification:sha256:";
const HASH_DOMAIN = "quiver:notification-candidate:v1\0";

export interface PositiveRecommendationPolicyContext {
  kind: "positive_session_recommendation";
  beach_id: string;
  starts_at: string;
  ends_at: string;
}

export interface ResolveNotificationMajorEventHoldInput {
  eventId: string;
  type: string;
  payload: unknown;
  profileExperience: unknown;
  asOf?: Date;
  mode?: MajorEventHoldMode;
}

export type NotificationMajorEventHoldEvaluator = (
  input: EvaluateMajorEventHoldCandidatesInput,
) => Promise<MajorEventHoldCandidateDecision[]>;

export interface NotificationMajorEventHoldDependencies {
  evaluateCandidates?: NotificationMajorEventHoldEvaluator;
}

export type NotificationMajorEventHoldResult =
  | { status: "not_applicable" }
  | { status: "allowed"; candidate: MajorEventHoldCandidate | null }
  | {
      status: "suppressed";
      reasonCode: RecommendationHoldReasonCode;
      auditCode: typeof AUDIT_CODE;
      candidate: MajorEventHoldCandidate | null;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositivePolicyContext(
  value: unknown,
): value is PositiveRecommendationPolicyContext {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  if (
    keys.join(",") !== "beach_id,ends_at,kind,starts_at" ||
    value.kind !== "positive_session_recommendation" ||
    typeof value.beach_id !== "string" ||
    typeof value.starts_at !== "string" ||
    typeof value.ends_at !== "string"
  ) {
    return false;
  }

  return true;
}

function isPositiveNotification(type: string, payload: unknown): boolean {
  if (type === "home_morning_call") {
    return !isRecord(payload) || payload.verdict !== "NO";
  }
  if (POSITIVE_NOTIFICATION_TYPES.has(type)) return true;
  if (
    isRecord(payload) &&
    isPositivePolicyContext(payload.policy_context)
  ) {
    return true;
  }
  if (type !== "log_session_nudge" || !isRecord(payload)) return false;

  return (
    payload.cohort === "free_home_firing" ||
    (isRecord(payload.policy_context) &&
      payload.policy_context.kind === "positive_session_recommendation")
  );
}

function isNamedNotification(type: string, payload: unknown): boolean {
  if (USER_CONFIGURED_SAFETY_NOTIFICATION_TYPES.has(type)) return true;
  if (isPositiveNotification(type, payload)) return true;
  if (type !== "forecast_feedback_nudge" || !isRecord(payload)) return false;
  return typeof payload.beach_id === "string";
}

function configuredBeachIdsForNotification(
  type: string,
  payload: unknown,
): string[] {
  if (
    (type !== "forecast_alert" && type !== "similarity_match") ||
    !isRecord(payload) ||
    typeof payload.configured_beach_id !== "string"
  ) {
    return [];
  }
  return [payload.configured_beach_id];
}

function hashedCandidateId(value: string): string {
  const digest = createHash("sha256")
    .update(HASH_DOMAIN)
    .update(value)
    .digest("hex");
  return `${HASHED_CANDIDATE_PREFIX}${digest}`;
}

function boundedCandidateId(value: string): string {
  return value.length <= MAX_CANDIDATE_ID_LENGTH &&
    !value.startsWith(HASHED_CANDIDATE_PREFIX)
    ? value
    : hashedCandidateId(value);
}

function candidateIdFor(eventId: unknown): string | null {
  if (typeof eventId !== "string" || eventId.trim().length === 0) return null;
  return boundedCandidateId(`notification:${eventId}`);
}

function candidateFromPolicyContext(
  candidateId: string,
  value: unknown,
): MajorEventHoldCandidate | null {
  if (!isPositivePolicyContext(value)) return null;
  return parseMajorEventHoldCandidate({
    candidateId,
    beachId: value.beach_id,
    startsAt: value.starts_at,
    endsAt: value.ends_at,
  });
}

function candidateFromForecastAt(
  candidateId: string,
  payload: Record<string, unknown>,
): MajorEventHoldCandidate | null {
  if (
    typeof payload.beach_id !== "string" ||
    typeof payload.forecast_at !== "string"
  ) {
    return null;
  }
  const startsAtMs = Date.parse(payload.forecast_at);
  if (!Number.isFinite(startsAtMs)) return null;

  return parseMajorEventHoldCandidate({
    candidateId,
    beachId: payload.beach_id,
    startsAt: payload.forecast_at,
    endsAt: new Date(startsAtMs + FORECAST_SLOT_DURATION_MS).toISOString(),
  });
}

function candidateFromBeachId(
  candidateId: string,
  payload: Record<string, unknown>,
): MajorEventHoldCandidate | null {
  if (typeof payload.beach_id !== "string") return null;
  return parseMajorEventHoldCandidate({
    candidateId,
    beachId: payload.beach_id,
    startsAt: "1970-01-01T00:00:00.000Z",
    endsAt: "1970-01-01T01:00:00.000Z",
  });
}

function candidateFromForecastMatch(
  candidateId: string,
  payload: Record<string, unknown>,
): MajorEventHoldCandidate | null {
  if (
    !Array.isArray(payload.matches) ||
    typeof payload.beach_id !== "string" ||
    typeof payload.forecast_at !== "string"
  ) {
    return null;
  }
  const forecastAtMs = Date.parse(payload.forecast_at);
  if (!Number.isFinite(forecastAtMs)) return null;

  const matches = payload.matches.filter((value) => {
    if (!isRecord(value) || value.beach_id !== payload.beach_id) return false;
    if (
      typeof value.window_start !== "string" ||
      typeof value.window_end !== "string"
    ) {
      return false;
    }
    const startsAtMs = Date.parse(value.window_start);
    const endsAtMs = Date.parse(value.window_end);
    if (
      !Number.isFinite(startsAtMs) ||
      !Number.isFinite(endsAtMs) ||
      endsAtMs <= startsAtMs
    ) {
      return false;
    }
    return (
      value.best_hour === payload.forecast_at ||
      (forecastAtMs >= startsAtMs && forecastAtMs < endsAtMs)
    );
  });
  if (matches.length !== 1) return null;
  const match = matches[0] as Record<string, unknown>;

  return parseMajorEventHoldCandidate({
    candidateId,
    beachId: payload.beach_id,
    startsAt: match.window_start,
    endsAt: match.window_end,
  });
}

function candidatesFromForecastMatches(
  candidateId: string,
  payload: Record<string, unknown>,
): Array<MajorEventHoldCandidate | null> {
  if (!Array.isArray(payload.matches) || payload.matches.length === 0) {
    return [null];
  }

  return payload.matches.map((value, index) => {
    if (!isRecord(value)) return null;
    if (
      typeof value.beach_id !== "string" ||
      typeof value.window_start !== "string" ||
      typeof value.window_end !== "string"
    ) {
      return null;
    }
    const matchCandidateId =
      index === 0
        ? candidateId
        : boundedCandidateId(`${candidateId}:match:${index}`);

    return parseMajorEventHoldCandidate({
      candidateId: matchCandidateId,
      beachId: value.beach_id,
      startsAt: value.window_start,
      endsAt: value.window_end,
    });
  });
}

function policyContextMatchesPayload(
  type: string,
  candidate: MajorEventHoldCandidate,
  payload: Record<string, unknown>,
): boolean {
  if (
    typeof payload.beach_id !== "string" ||
    candidate.beachId !== payload.beach_id.toLowerCase() ||
    typeof payload.forecast_at !== "string"
  ) {
    return false;
  }
  const forecastAtMs = Date.parse(payload.forecast_at);
  const startsAtMs = Date.parse(candidate.startsAt);
  const endsAtMs = Date.parse(candidate.endsAt);
  if (!Number.isFinite(forecastAtMs)) return false;

  if (type !== "forecast_alert") return forecastAtMs === startsAtMs;
  if (Array.isArray(payload.matches)) {
    const matched = candidateFromForecastMatch(candidate.candidateId, payload);
    return (
      matched !== null &&
      Date.parse(matched.startsAt) === startsAtMs &&
      Date.parse(matched.endsAt) === endsAtMs
    );
  }
  return forecastAtMs >= startsAtMs && forecastAtMs < endsAtMs;
}

export function buildNotificationMajorEventHoldCandidate(
  input: Pick<
    ResolveNotificationMajorEventHoldInput,
    "eventId" | "type" | "payload"
  >,
): MajorEventHoldCandidate | null {
  const candidateId = candidateIdFor(input.eventId);
  if (candidateId === null || !isRecord(input.payload)) return null;

  if (input.type === "water_quality") {
    return candidateFromBeachId(candidateId, input.payload);
  }

  if (input.type === "log_session_nudge") {
    return candidateFromPolicyContext(
      candidateId,
      input.payload.policy_context,
    ) ?? candidateFromBeachId(candidateId, input.payload);
  }
  if (
    !POSITIVE_NOTIFICATION_TYPES.has(input.type) &&
    isPositivePolicyContext(input.payload.policy_context)
  ) {
    const candidate = candidateFromPolicyContext(
      candidateId,
      input.payload.policy_context,
    );
    if (
      candidate === null ||
      !policyContextMatchesPayload(input.type, candidate, input.payload)
    ) {
      return null;
    }
    return candidate;
  }
  if (POSITIVE_NOTIFICATION_TYPES.has(input.type)) {
    if (Object.prototype.hasOwnProperty.call(input.payload, "policy_context")) {
      const candidate = candidateFromPolicyContext(
        candidateId,
        input.payload.policy_context,
      );
      if (
        candidate === null ||
        !policyContextMatchesPayload(input.type, candidate, input.payload)
      ) {
        return null;
      }
      return candidate;
    }
    if (
      input.type === "forecast_alert" &&
      Array.isArray(input.payload.matches)
    ) {
      return candidateFromForecastMatch(candidateId, input.payload);
    }
    return (
      candidateFromForecastAt(candidateId, input.payload) ??
      candidateFromBeachId(candidateId, input.payload)
    );
  }
  if (input.type === "forecast_feedback_nudge") {
    return (
      candidateFromForecastAt(candidateId, input.payload) ??
      candidateFromBeachId(candidateId, input.payload)
    );
  }
  return null;
}

function buildNotificationMajorEventHoldCandidates(
  input: Pick<
    ResolveNotificationMajorEventHoldInput,
    "eventId" | "type" | "payload"
  >,
): Array<MajorEventHoldCandidate | null> {
  const primaryCandidate = buildNotificationMajorEventHoldCandidate(input);
  if (
    input.type !== "forecast_alert" ||
    !isRecord(input.payload) ||
    !Array.isArray(input.payload.matches)
  ) {
    return [primaryCandidate];
  }
  if (primaryCandidate === null) return [null];

  const matchCandidates = candidatesFromForecastMatches(
    primaryCandidate.candidateId,
    input.payload,
  );
  return matchCandidates.some((candidate) => candidate === null)
    ? [null]
    : matchCandidates;
}

function suppressed(
  reasonCode: RecommendationHoldReasonCode,
  candidate: MajorEventHoldCandidate | null,
): NotificationMajorEventHoldResult {
  return {
    status: "suppressed",
    reasonCode,
    auditCode: AUDIT_CODE,
    candidate,
  };
}

function unavailableForMode(
  mode: MajorEventHoldMode,
  candidate: MajorEventHoldCandidate | null,
): NotificationMajorEventHoldResult {
  return mode === "enforce"
    ? suppressed("hold_state_unavailable", candidate)
    : { status: "allowed", candidate };
}

function hasFreshCanonicalPositiveDecision(args: {
  type: string;
  payload: unknown;
  candidate: MajorEventHoldCandidate | null;
  profileExperience: unknown;
  asOf: Date;
}): boolean {
  if (!isRecord(args.payload) || args.candidate === null) return false;
  const parsed = canonicalSessionDecisionSchema.safeParse(
    args.payload.session_decision,
  );
  if (!parsed.success) return false;
  const decision = parsed.data;
  const selection = decision.selection;
  const expectedSkill = parseSkillLevel(
    typeof args.profileExperience === "string"
      ? args.profileExperience
      : null,
  ) ?? "unknown";
  const expectedVerdict =
    decision.verdict === "go"
      ? "YES"
      : decision.verdict === "maybe"
        ? "MAYBE"
        : "NO";
  const verdictMatches =
    args.type !== "home_morning_call" ||
    args.payload.verdict === expectedVerdict;

  return (
    decision.verdict !== "no"
    && selection !== null
    && Date.parse(decision.expiresAt) > args.asOf.getTime()
    && Date.parse(decision.createdAt) <= args.asOf.getTime() + 5 * 60 * 1000
    && decision.skillEligibility.skill === expectedSkill
    && verdictMatches
    && selection.beachId === args.candidate.beachId
    && selection.windowStart === args.candidate.startsAt
    && selection.windowEnd === args.candidate.endsAt
    && selection.forecastRef.forecastAt === args.payload.forecast_at
  );
}

export async function resolveNotificationMajorEventHold(
  input: ResolveNotificationMajorEventHoldInput,
  dependencies: NotificationMajorEventHoldDependencies = {},
): Promise<NotificationMajorEventHoldResult> {
  if (!isNamedNotification(input.type, input.payload)) {
    return { status: "not_applicable" };
  }

  if (USER_CONFIGURED_SAFETY_NOTIFICATION_TYPES.has(input.type)) {
    // Water-quality notifications exist to identify the affected beach. They
    // are deliberately exempt from recommendation-hold suppression.
    return {
      status: "allowed",
      candidate: buildNotificationMajorEventHoldCandidate(input),
    };
  }

  const mode = input.mode ?? MAJOR_EVENT_HOLD_MODE;
  const candidate = buildNotificationMajorEventHoldCandidate(input);
  const candidates = buildNotificationMajorEventHoldCandidates(input);
  const hasFreshWeekendSnapshot =
    input.type === "weekend_window" &&
    candidate !== null &&
    isRecord(input.payload) &&
    isPositivePolicyContext(input.payload.policy_context) &&
    policyContextMatchesPayload(input.type, candidate, input.payload);
  if (
    mode === "enforce"
    && POSITIVE_NOTIFICATION_TYPES.has(input.type)
    && input.type !== "forecast_alert"
    && !hasFreshWeekendSnapshot
    && !hasFreshCanonicalPositiveDecision({
      type: input.type,
      payload: input.payload,
      candidate,
      profileExperience: input.profileExperience,
      asOf: input.asOf ?? new Date(),
    })
  ) {
    return suppressed("hold_state_unavailable", candidate);
  }
  const evaluateCandidates =
    dependencies.evaluateCandidates ?? evaluateMajorEventHoldCandidates;
  let decisions: MajorEventHoldCandidateDecision[];
  try {
    decisions = await evaluateCandidates({
      candidates,
      profileExperience: input.profileExperience,
      mode,
      asOf: input.asOf,
      applyWaterQualityHolds: true,
      waterQualityExemptBeachIds: configuredBeachIdsForNotification(
        input.type,
        input.payload,
      ),
    });
  } catch {
    return unavailableForMode(mode, candidate);
  }

  if (candidates.some((value) => value === null)) {
    const availability = decisions[0]?.recommendationAvailability;
    if (
      decisions.length === candidates.length &&
      decisions.every(
        (decision) => decision.recommendationAvailability?.state === "available",
      ) &&
      mode !== "enforce"
    ) {
      return { status: "allowed", candidate };
    }
    return suppressed(
      availability?.reasonCode === "major_event_hold" ||
        availability?.reasonCode === "water_quality_hold"
        ? availability.reasonCode
        : "hold_state_unavailable",
      candidate,
    );
  }

  const validCandidates = candidates as MajorEventHoldCandidate[];
  const boundary = resolveMajorEventHoldBoundary(
    validCandidates,
    validCandidates,
    decisions,
  );
  if (boundary.blockedCandidateIds.size > 0 && mode === "enforce") {
    const blockedCandidate = validCandidates.find((value) =>
      boundary.blockedCandidateIds.has(value.candidateId),
    );
    const blockedDecision = decisions.find(
      (decision) => decision.candidateId === blockedCandidate?.candidateId,
    );
    return suppressed(
      blockedDecision?.evaluation.reasonCode === "water_quality_hold"
        ? "water_quality_hold"
        : "major_event_hold",
      blockedCandidate ?? candidate,
    );
  }
  if (boundary.allowedCandidateIds.size === validCandidates.length) {
    return { status: "allowed", candidate };
  }
  if (mode !== "enforce") return { status: "allowed", candidate };

  return suppressed(
    boundary.recommendationAvailability.reasonCode === "major_event_hold" ||
      boundary.recommendationAvailability.reasonCode === "water_quality_hold"
      ? boundary.recommendationAvailability.reasonCode
      : "hold_state_unavailable",
    candidate,
  );
}
