import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

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
const AMBIGUITY_SCAN_RADIUS_MS = 3 * 60 * 60 * 1000;
const AMBIGUITY_SCAN_STEP_MS = 15 * 60 * 1000;

interface CivilTime {
  canonical: string;
  millisecondsSinceMidnight: number;
}

interface DailyIntelCandidateSource {
  id: string;
  beach_id: string;
  forecast_date: string;
  best_window_start: string | null;
  best_window_end: string | null;
}

interface DailyIntelResponseLike extends DailyIntelCandidateSource {
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

type SanitizedDailyIntelResponse<TIntel extends DailyIntelResponseLike> =
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
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
