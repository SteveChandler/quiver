import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import type { RecommendationsResponse } from "@/types/api/recommendations";

import type {
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
  RecommendationAvailability,
} from "../types";
import {
  resolveMajorEventHoldBoundary,
  type MajorEventHoldBoundaryDecision,
} from "./shared";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const POSTGRES_TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/;
const ABSOLUTE_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-](\d{2}):(\d{2}))$/;
const AMBIGUITY_SCAN_RADIUS_MS = 3 * 60 * 60 * 1000;
const AMBIGUITY_SCAN_STEP_MS = 15 * 60 * 1000;
const CLIENT_SAFE_UNAVAILABLE_EPOCH = "hold-state-unavailable";
const COACH_PICK_CANDIDATE_DURATION_MS = 1;

interface CivilTime {
  canonical: string;
  millisecondsSinceMidnight: number;
}

export interface DailyIntelCandidateSource {
  id: string;
  beach_id: string;
  forecast_date: string;
  best_window_start: string | null;
  best_window_end: string | null;
}

export interface DailyIntelResponseLike extends DailyIntelCandidateSource {
  conditions_score: number | null;
  confidence: string | null;
  recommendation: string | null;
  best_window_description: string | null;
  raw_intel_data: unknown;
  best_window_height_label?: string | null;
  best_window_wave_height_label?: string | null;
}

type DailyIntelPositiveField =
  | "conditions_score"
  | "confidence"
  | "recommendation"
  | "best_window_start"
  | "best_window_end"
  | "best_window_description"
  | "best_window_height_label"
  | "best_window_wave_height_label"
  | "raw_intel_data";

export type SanitizedDailyIntelResponse<TIntel extends DailyIntelResponseLike> =
  Omit<TIntel, DailyIntelPositiveField> & {
    conditions_score: TIntel["conditions_score"] | null;
    confidence: TIntel["confidence"] | null;
    recommendation: TIntel["recommendation"] | null;
    best_window_start: TIntel["best_window_start"] | null;
    best_window_end: TIntel["best_window_end"] | null;
    best_window_description: TIntel["best_window_description"] | null;
    best_window_height_label?: TIntel["best_window_height_label"] | null;
    best_window_wave_height_label?:
      | TIntel["best_window_wave_height_label"]
      | null;
    raw_intel_data: unknown;
    recommendationAvailability: RecommendationAvailability;
  };

export type SanitizedLegacyV1RecommendationsResponse =
  RecommendationsResponse & {
    recommendationAvailability: RecommendationAvailability;
  };

export interface CoachPicksResponseLike<TPick = unknown> {
  picks: readonly TPick[];
}

export type SanitizedCoachPicksResponse<
  TResponse extends CoachPicksResponseLike,
> = Omit<TResponse, "picks"> & {
  picks: Array<TResponse["picks"][number]>;
  recommendationAvailability: RecommendationAvailability;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function uniqueStrings(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function unavailableBoundary(
  candidates: readonly unknown[],
  decisions: readonly MajorEventHoldCandidateDecision[],
): MajorEventHoldBoundaryDecision {
  return resolveMajorEventHoldBoundary(candidates, [], decisions);
}

function parseCivilDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = CIVIL_DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

function parseStrictAbsoluteInstant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = ABSOLUTE_INSTANT_PATTERN.exec(value);
  if (!match) return null;
  if (parseCivilDate(`${match[1]}-${match[2]}-${match[3]}`) === null) {
    return null;
  }
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] === "Z" ? 0 : Number(match[9]);
  const offsetMinute = match[8] === "Z" ? 0 : Number(match[10]);
  if (
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

function nextCivilDate(value: string): string | null {
  const parsed = parseCivilDate(value);
  if (parsed === null) return null;
  const [year, month, day] = parsed.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function parsePostgresTime(value: unknown): CivilTime | null {
  if (typeof value !== "string") return null;
  const match = POSTGRES_TIME_PATTERN.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? 0 : Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) return null;
  const millisecond = Number(`${match[4] ?? ""}000`.slice(0, 3));
  return {
    canonical: `${String(hour).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0",
    )}:${String(second).padStart(2, "0")}.${String(millisecond).padStart(
      3,
      "0",
    )}`,
    millisecondsSinceMidnight:
      ((hour * 60 + minute) * 60 + second) * 1000 + millisecond,
  };
}

function isValidTimeZone(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 100 ||
    value.trim() !== value
  ) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function localCivilToUtc(
  date: string,
  time: CivilTime,
  timeZone: string,
): Date | null {
  const localCivil = `${date}T${time.canonical}`;
  try {
    const instant = fromZonedTime(localCivil, timeZone);
    if (!Number.isFinite(instant.getTime())) return null;
    const matchingInstants = new Set<number>();
    for (
      let offset = -AMBIGUITY_SCAN_RADIUS_MS;
      offset <= AMBIGUITY_SCAN_RADIUS_MS;
      offset += AMBIGUITY_SCAN_STEP_MS
    ) {
      const candidateMs = instant.getTime() + offset;
      const roundTrip = formatInTimeZone(
        candidateMs,
        timeZone,
        "yyyy-MM-dd'T'HH:mm:ss.SSS",
      );
      if (roundTrip === localCivil) matchingInstants.add(candidateMs);
    }
    return matchingInstants.size === 1 ? instant : null;
  } catch {
    return null;
  }
}

export function buildDailyIntelMajorEventHoldCandidate(
  intel: DailyIntelCandidateSource,
  beachTimeZone: string,
): MajorEventHoldCandidate | null {
  if (
    !intel ||
    typeof intel !== "object" ||
    !isNonEmptyString(intel.id) ||
    !isNonEmptyString(intel.beach_id) ||
    !UUID_PATTERN.test(intel.beach_id) ||
    !isValidTimeZone(beachTimeZone)
  ) {
    return null;
  }
  const candidateId = `daily-intel:${intel.id}`;
  if (candidateId.length > 160) return null;

  const startDate = parseCivilDate(intel.forecast_date);
  const startTime = parsePostgresTime(intel.best_window_start);
  const endTime = parsePostgresTime(intel.best_window_end);
  if (startDate === null || startTime === null || endTime === null) return null;
  if (
    endTime.millisecondsSinceMidnight === startTime.millisecondsSinceMidnight
  ) {
    return null;
  }
  const endDate =
    endTime.millisecondsSinceMidnight < startTime.millisecondsSinceMidnight
      ? nextCivilDate(startDate)
      : startDate;
  if (endDate === null) return null;

  const startsAt = localCivilToUtc(startDate, startTime, beachTimeZone);
  const endsAt = localCivilToUtc(endDate, endTime, beachTimeZone);
  if (
    startsAt === null ||
    endsAt === null ||
    endsAt.getTime() <= startsAt.getTime()
  ) {
    return null;
  }
  return {
    candidateId,
    beachId: intel.beach_id,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

function exactCandidateList(
  candidates: readonly unknown[],
  expectedCandidates: readonly MajorEventHoldCandidate[],
): boolean {
  if (candidates.length !== expectedCandidates.length) return false;
  const expectedById = new Map(
    expectedCandidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  if (expectedById.size !== expectedCandidates.length) return false;
  const seen = new Set<string>();
  for (const value of candidates) {
    if (!isRecord(value)) return false;
    const candidateId = value.candidateId;
    if (!isNonEmptyString(candidateId) || seen.has(candidateId)) return false;
    const expected = expectedById.get(candidateId);
    if (
      expected === undefined ||
      value.beachId !== expected.beachId ||
      value.startsAt !== expected.startsAt ||
      value.endsAt !== expected.endsAt
    ) {
      return false;
    }
    seen.add(candidateId);
  }
  return seen.size === expectedCandidates.length;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function copyString(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  key: string,
): void {
  if (typeof source[key] === "string") target[key] = source[key];
}

function copyNullableString(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  key: string,
): void {
  if (source[key] === null || typeof source[key] === "string") {
    target[key] = source[key];
  }
}

function copyNumber(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  key: string,
): void {
  if (isFiniteNumber(source[key])) target[key] = source[key];
}

function copyNullableNumber(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  key: string,
): void {
  if (source[key] === null || isFiniteNumber(source[key])) {
    target[key] = source[key];
  }
}

function nonEmptyRecord(
  value: Record<string, unknown>,
): Record<string, unknown> | null {
  return Object.keys(value).length > 0 ? value : null;
}

function physicalSurf(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const surf: Record<string, unknown> = {};
  copyNumber(value, surf, "min");
  copyNumber(value, surf, "max");
  copyString(value, surf, "dominant");
  return nonEmptyRecord(surf);
}

function physicalTideEvent(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  if (
    !["HIGH", "LOW"].includes(String(value.type)) ||
    !isFiniteNumber(value.height) ||
    typeof value.time !== "string"
  ) {
    return null;
  }
  return { type: value.type, height: value.height, time: value.time };
}

function physicalTide(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const tide: Record<string, unknown> = {};
  copyNumber(value, tide, "height");
  if (["rising", "falling", "slack"].includes(String(value.direction))) {
    tide.direction = value.direction;
  }
  if (value.nextEvent === null) {
    tide.nextEvent = null;
  } else {
    const nextEvent = physicalTideEvent(value.nextEvent);
    if (nextEvent !== null) tide.nextEvent = nextEvent;
  }
  return nonEmptyRecord(tide);
}

function physicalWind(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const wind: Record<string, unknown> = {};
  copyNumber(value, wind, "speed");
  copyNumber(value, wind, "direction");
  copyString(value, wind, "cardinal");
  if (typeof value.offshore === "boolean") wind.offshore = value.offshore;
  copyString(value, wind, "description");
  return nonEmptyRecord(wind);
}

function physicalSwellComponent(
  value: unknown,
): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  if (
    !isFiniteNumber(value.height) ||
    !isFiniteNumber(value.period) ||
    !isFiniteNumber(value.direction) ||
    typeof value.cardinal !== "string"
  ) {
    return null;
  }
  return {
    height: value.height,
    period: value.period,
    direction: value.direction,
    cardinal: value.cardinal,
  };
}

function physicalSwells(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const swells: Record<string, unknown> = {};
  for (const key of ["primary", "secondary"] as const) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    swells[key] =
      value[key] === null ? null : physicalSwellComponent(value[key]);
  }
  return nonEmptyRecord(swells);
}

function physicalSources(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const sources: Record<string, unknown> = {};
  for (const key of ["wave", "tide", "wind", "swell"] as const) {
    if (typeof value[key] === "boolean") sources[key] = value[key];
  }
  return nonEmptyRecord(sources);
}

function physicalWaterQuality(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  if (
    !["good", "advisory", "closure", "unknown"].includes(
      String(value.status),
    ) ||
    !(
      value.latestSampleDate === null ||
      typeof value.latestSampleDate === "string"
    )
  ) {
    return null;
  }
  return {
    status: value.status,
    latestSampleDate: value.latestSampleDate,
  };
}

function physicalBeachMetadata(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const beach: Record<string, unknown> = {};
  for (const key of ["name", "skillLevel", "hazards", "breakType"] as const) {
    if (key === "hazards") {
      if (
        value[key] === null ||
        (Array.isArray(value[key]) &&
          value[key].every((item) => typeof item === "string"))
      ) {
        beach[key] = value[key];
      }
      continue;
    }
    copyNullableString(value, beach, key);
  }
  for (const key of [
    "swellWindowMin",
    "swellWindowMax",
    "windOffshoreDeg",
    "windOffshoreTol",
    "tideMinFt",
    "tideMaxFt",
    "aspectDeg",
    "windOffshoreDegUsed",
  ] as const) {
    copyNullableNumber(value, beach, key);
  }
  if (
    value.windOffshoreDegSource === null ||
    ["db", "computed_from_aspect", "db_overridden_with_aspect"].includes(
      String(value.windOffshoreDegSource),
    )
  ) {
    beach.windOffshoreDegSource = value.windOffshoreDegSource;
  }
  return nonEmptyRecord(beach);
}

function allowlistedDailyIntelRawRecord(
  value: Record<string, unknown>,
  includePayload: boolean,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const key of [
    "kind",
    "generatedAt",
    "date",
    "time",
    "spotName",
  ] as const) {
    copyString(value, sanitized, key);
  }
  const nestedFields = [
    ["surf", physicalSurf],
    ["tide", physicalTide],
    ["wind", physicalWind],
    ["swells", physicalSwells],
    ["sources", physicalSources],
    ["waterQuality", physicalWaterQuality],
    ["beach", physicalBeachMetadata],
    ["beachPreferences", physicalBeachMetadata],
  ] as const;
  for (const [key, sanitize] of nestedFields) {
    const nested = sanitize(value[key]);
    if (nested !== null) sanitized[key] = nested;
  }
  copyNumber(value, sanitized, "dataCompleteness");
  if (includePayload && isRecord(value.payload)) {
    sanitized.payload = allowlistedDailyIntelRawRecord(value.payload, false);
  }
  return sanitized;
}

function stripDailyIntelPositiveRawFields(value: unknown): unknown {
  return isRecord(value) ? allowlistedDailyIntelRawRecord(value, true) : null;
}

export function sanitizeDailyIntelForMajorEventHold<
  TIntel extends DailyIntelResponseLike,
>(
  intel: TIntel,
  beachTimeZone: string,
  candidates: readonly unknown[],
  decisions: readonly MajorEventHoldCandidateDecision[],
): SanitizedDailyIntelResponse<TIntel> {
  const expectedCandidate = buildDailyIntelMajorEventHoldCandidate(
    intel,
    beachTimeZone,
  );
  const validBinding =
    expectedCandidate !== null &&
    exactCandidateList(candidates, [expectedCandidate]);
  const boundary = validBinding
    ? resolveMajorEventHoldBoundary(candidates, [expectedCandidate], decisions)
    : unavailableBoundary(candidates, decisions);
  const shouldClear = boundary.recommendationAvailability.state === "none";

  if (!shouldClear) {
    return {
      ...intel,
      recommendationAvailability: boundary.recommendationAvailability,
    } as SanitizedDailyIntelResponse<TIntel>;
  }

  return {
    ...intel,
    conditions_score: null,
    confidence: null,
    recommendation: null,
    best_window_start: null,
    best_window_end: null,
    best_window_description: null,
    ...(Object.prototype.hasOwnProperty.call(intel, "best_window_height_label")
      ? { best_window_height_label: null }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(
      intel,
      "best_window_wave_height_label",
    )
      ? { best_window_wave_height_label: null }
      : {}),
    raw_intel_data: stripDailyIntelPositiveRawFields(intel.raw_intel_data),
    recommendationAvailability: boundary.recommendationAvailability,
  } as SanitizedDailyIntelResponse<TIntel>;
}

function expectedLegacyCandidates(
  response: RecommendationsResponse,
): MajorEventHoldCandidate[] | null {
  if (
    !Array.isArray(response.recommendations) ||
    !Array.isArray(response.top_picks) ||
    !response.metadata ||
    !isNonEmptyString(response.metadata.query_time)
  ) {
    return null;
  }
  const queryTimeMs = parseStrictAbsoluteInstant(response.metadata.query_time);
  if (queryTimeMs === null) return null;
  const endsAt = new Date(queryTimeMs + 1);
  if (!Number.isFinite(endsAt.getTime())) return null;

  const spotIds = response.recommendations.map(({ spotId }) => spotId);
  if (
    spotIds.some((spotId) => !isNonEmptyString(spotId)) ||
    !uniqueStrings(spotIds)
  ) {
    return null;
  }
  const recommendationIds = new Set(spotIds);
  const topPickIds = response.top_picks.map(({ spotId }) => spotId);
  if (
    topPickIds.some((spotId) => !isNonEmptyString(spotId)) ||
    !uniqueStrings(topPickIds) ||
    response.top_picks.some(
      (topPick) =>
        !recommendationIds.has(topPick.spotId) ||
        !topPick.snapshot ||
        topPick.snapshot.timestamp !== response.metadata.query_time,
    )
  ) {
    return null;
  }

  return spotIds.map((spotId) => ({
    candidateId: `legacy-v1:${spotId}:${response.metadata.query_time}`,
    beachId: spotId,
    startsAt: response.metadata.query_time,
    endsAt: endsAt.toISOString(),
  }));
}

export function sanitizeLegacyV1RecommendationsForMajorEventHold(
  response: RecommendationsResponse,
  candidates: readonly unknown[],
  decisions: readonly MajorEventHoldCandidateDecision[],
): SanitizedLegacyV1RecommendationsResponse {
  const expectedCandidates = expectedLegacyCandidates(response);
  const validBinding =
    expectedCandidates !== null &&
    exactCandidateList(candidates, expectedCandidates);
  const boundary = validBinding
    ? resolveMajorEventHoldBoundary(candidates, expectedCandidates, decisions)
    : unavailableBoundary(candidates, decisions);
  const clearWholeBoundary =
    !validBinding ||
    (boundary.recommendationAvailability.state === "none" &&
      boundary.recommendationAvailability.reasonCode ===
        "hold_state_unavailable");

  if (clearWholeBoundary) {
    return {
      ...response,
      recommendations: [],
      top_picks: [],
      recommendationAvailability: boundary.recommendationAvailability,
    };
  }

  const candidateIdForSpot = (spotId: string): string =>
    `legacy-v1:${spotId}:${response.metadata.query_time}`;
  return {
    ...response,
    recommendations: response.recommendations.filter(
      ({ spotId }) =>
        !boundary.blockedCandidateIds.has(candidateIdForSpot(spotId)),
    ),
    top_picks: response.top_picks
      .filter(
        ({ spotId }) =>
          !boundary.blockedCandidateIds.has(candidateIdForSpot(spotId)),
      )
      .slice(0, 3)
      .map((topPick, index) => ({ ...topPick, rank: index + 1 })),
    recommendationAvailability: boundary.recommendationAvailability,
  };
}

interface ValidCoachDecision {
  allow: boolean;
  recommendationAvailability: RecommendationAvailability;
}

export function buildCoachPicksMajorEventHoldCandidates(
  picks: readonly unknown[],
  asOf: Date,
): Array<MajorEventHoldCandidate | null> {
  const startsAtMs = asOf instanceof Date ? asOf.getTime() : NaN;
  const endsAtMs = startsAtMs + COACH_PICK_CANDIDATE_DURATION_MS;
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs)) {
    return picks.map(() => null);
  }

  const startsAt = new Date(startsAtMs).toISOString();
  const endsAt = new Date(endsAtMs).toISOString();
  return picks.map((pick) => {
    if (!isRecord(pick) || !isNonEmptyString(pick.beach_id)) return null;
    const beachId = pick.beach_id.toLowerCase();
    if (!UUID_PATTERN.test(beachId)) return null;
    return {
      candidateId: `coach-pick:${beachId}:${startsAt}`,
      beachId,
      startsAt,
      endsAt,
    };
  });
}

function expectedCoachCandidates(
  response: CoachPicksResponseLike,
  candidates: readonly unknown[],
): MajorEventHoldCandidate[] | null {
  if (response.picks.length === 0) {
    return candidates.length === 0 ? [] : null;
  }
  const firstCandidate = candidates[0];
  if (!isRecord(firstCandidate)) return null;
  const startsAtMs = parseStrictAbsoluteInstant(firstCandidate.startsAt);
  if (startsAtMs === null) return null;
  const expected = buildCoachPicksMajorEventHoldCandidates(
    response.picks,
    new Date(startsAtMs),
  );
  if (expected.some((candidate) => candidate === null)) return null;
  return expected as MajorEventHoldCandidate[];
}

function validCoachDecision(
  decisions: readonly MajorEventHoldCandidateDecision[],
): ValidCoachDecision | null {
  if (!Array.isArray(decisions) || decisions.length !== 1) return null;
  const decision = decisions[0];
  if (!isRecord(decision) || decision.candidateId !== null) return null;
  const evaluation = decision.evaluation;
  const availability = decision.recommendationAvailability;
  if (!isRecord(evaluation) || !isRecord(availability)) return null;
  if (
    !isNonEmptyString(evaluation.holdEpoch) ||
    availability.holdEpoch !== evaluation.holdEpoch ||
    !Array.isArray(evaluation.holdIds) ||
    evaluation.holdIds.length !== 0 ||
    evaluation.expiresAt !== undefined ||
    availability.expiresAt !== undefined
  ) {
    return null;
  }

  if (
    evaluation.outcome === "allow" &&
    evaluation.reasonCode === undefined &&
    availability.state === "available" &&
    availability.reasonCode === undefined
  ) {
    return {
      allow: true,
      recommendationAvailability: {
        state: "available",
        holdEpoch: evaluation.holdEpoch,
      },
    };
  }

  if (
    evaluation.outcome === "explicit_none" &&
    evaluation.reasonCode === "hold_state_unavailable" &&
    availability.state === "none" &&
    availability.reasonCode === "hold_state_unavailable"
  ) {
    return {
      allow: false,
      recommendationAvailability: {
        state: "none",
        reasonCode: "hold_state_unavailable",
        holdEpoch: evaluation.holdEpoch,
      },
    };
  }

  return null;
}

export function sanitizeCoachPicksForMajorEventHold<
  TResponse extends CoachPicksResponseLike,
>(
  response: TResponse,
  candidatesOrDecisions: readonly unknown[],
  boundDecisions?: readonly MajorEventHoldCandidateDecision[],
): SanitizedCoachPicksResponse<TResponse> {
  if (boundDecisions === undefined) {
    const validated = validCoachDecision(
      candidatesOrDecisions as readonly MajorEventHoldCandidateDecision[],
    );
    if (validated === null) {
      return {
        ...response,
        picks: [],
        recommendationAvailability: {
          state: "none",
          reasonCode: "hold_state_unavailable",
          holdEpoch: CLIENT_SAFE_UNAVAILABLE_EPOCH,
        },
      };
    }

    return {
      ...response,
      picks: validated.allow ? [...response.picks] : [],
      recommendationAvailability: validated.recommendationAvailability,
    };
  }

  const expectedCandidates = expectedCoachCandidates(
    response,
    candidatesOrDecisions,
  );
  const validBinding =
    expectedCandidates !== null &&
    exactCandidateList(candidatesOrDecisions, expectedCandidates);
  const boundary = validBinding
    ? resolveMajorEventHoldBoundary(
        candidatesOrDecisions,
        expectedCandidates,
        boundDecisions,
      )
    : unavailableBoundary(candidatesOrDecisions, boundDecisions);

  return {
    ...response,
    picks:
      validBinding && expectedCandidates
        ? response.picks.filter((_, index) =>
            boundary.allowedCandidateIds.has(
              expectedCandidates[index].candidateId,
            ),
          )
        : [],
    recommendationAvailability: boundary.recommendationAvailability,
  };
}
