import type { AlertConditions } from "./types";

export interface AlertConditionValidationResult {
  ok: boolean;
  conditions?: AlertConditions;
  message?: string;
}

const CONDITION_KEYS = new Set<keyof AlertConditions>([
  "watched_call",
  "swell_height_min",
  "swell_height_max",
  "swell_direction_min_deg",
  "swell_direction_max_deg",
  "swell_period_min",
  "wind_direction",
  "wind_speed_max_kt",
  "tide_height_min_ft",
  "tide_height_max_ft",
  "tide_direction",
  "avoid_tide_statuses",
  "local_time_start",
  "local_time_end",
  "days_of_week",
  "board_id",
  "board_label",
  "max_frequency_per_week",
  "quiet_hours_start",
  "quiet_hours_end",
  "beginner_sandy_window",
  "beginner_window_confirmed",
]);

const MEANINGFUL_KEYS = new Set<keyof AlertConditions>([
  "watched_call",
  "swell_height_min",
  "swell_height_max",
  "swell_direction_min_deg",
  "swell_direction_max_deg",
  "swell_period_min",
  "wind_direction",
  "wind_speed_max_kt",
  "tide_height_min_ft",
  "tide_height_max_ft",
  "tide_direction",
  "avoid_tide_statuses",
  "local_time_start",
  "local_time_end",
  "days_of_week",
  "board_id",
  "max_frequency_per_week",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match !== null;
}

function isHour(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 23;
}

const WATCHED_CALL_KEYS = new Set([
  "version", "recommendationId", "sourceSurface", "mode", "beachId",
  "windowStart", "windowEnd", "forecastAt", "recommendationState",
  "conditionScore", "personalMatchScore", "overallScore", "reasonType",
  "dedupeKey",
]);

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isScore(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 100;
}

function isWatchedCall(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (Object.keys(value).some((key) => !WATCHED_CALL_KEYS.has(key))) return false;
  return value.version === 1
    && isBoundedString(value.recommendationId, 256)
    && ["home_hero", "home_also_worth_it", "explore_for_you", "beach_detail", "surf_window_adjacent"]
      .includes(String(value.sourceSurface))
    && ["now", "best", "my-spots", "beach-detail"].includes(String(value.mode))
    && isBoundedString(value.beachId, 128)
    && isIsoDate(value.windowStart)
    && isIsoDate(value.windowEnd)
    && Date.parse(value.windowEnd) > Date.parse(value.windowStart)
    && (value.forecastAt === null || isIsoDate(value.forecastAt))
    && isBoundedString(value.recommendationState, 64)
    && isScore(value.conditionScore)
    && isScore(value.personalMatchScore)
    && isScore(value.overallScore)
    && isBoundedString(value.reasonType, 128)
    && isBoundedString(value.dedupeKey, 1024)
    && value.dedupeKey.startsWith("watched-call.v1:");
}

function validateNumber(
  value: unknown,
  key: keyof AlertConditions,
  min: number,
  max: number,
): string | null {
  if (value == null) return null;
  if (!isFiniteNumber(value) || value < min || value > max) {
    return `${String(key)} must be between ${min} and ${max}.`;
  }
  return null;
}

function copyDefined<T extends keyof AlertConditions>(
  output: AlertConditions,
  input: Record<string, unknown>,
  key: T,
): void {
  if (input[key] !== undefined) {
    output[key] = input[key] as AlertConditions[T];
  }
}

export function validateConditionAlertInput(args: {
  presetType: string | null;
  conditions: unknown;
  notifyEmail: unknown;
  notifyPush: unknown;
}): AlertConditionValidationResult {
  const presetType = args.presetType;
  const isSimilarity = presetType === "similarity_match";
  const notifyEmail = args.notifyEmail === true;
  const notifyPush = args.notifyPush === true;

  if (!notifyEmail && !notifyPush) {
    return { ok: false, message: "Choose at least one delivery channel." };
  }

  if (!isRecord(args.conditions)) {
    return { ok: false, message: "conditions must be an object." };
  }

  const input = args.conditions;

  if (presetType === "watched_call" && !isWatchedCall(input.watched_call)) {
    return { ok: false, message: "watched_call requires a valid bounded identity." };
  }

  if (isSimilarity) {
    const unsupported = Object.keys(input).filter((key) =>
      CONDITION_KEYS.has(key as keyof AlertConditions),
    );
    if (unsupported.length > 0) {
      return {
        ok: false,
        message: "similarity_match alerts cannot include condition alert filters.",
      };
    }
    return { ok: true, conditions: input as AlertConditions };
  }

  if (input.similarity_threshold !== undefined) {
    return {
      ok: false,
      message: "Condition alerts cannot include similarity_match filters.",
    };
  }

  const unsupported = Object.keys(input).filter(
    (key) => !CONDITION_KEYS.has(key as keyof AlertConditions),
  );
  if (unsupported.length > 0) {
    return {
      ok: false,
      message: `Unsupported alert condition: ${unsupported[0]}.`,
    };
  }

  const hasMeaningfulCondition = Array.from(MEANINGFUL_KEYS).some((key) => {
    const value = input[key];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim().length > 0;
    return value !== undefined && value !== null;
  });
  if (!hasMeaningfulCondition) {
    return {
      ok: false,
      message: "Add at least one condition so the alert cannot match every forecast.",
    };
  }

  for (const [key, min, max] of [
    ["swell_height_min", 0, 60],
    ["swell_height_max", 0, 60],
    ["swell_direction_min_deg", 0, 359],
    ["swell_direction_max_deg", 0, 359],
    ["swell_period_min", 0, 30],
    ["wind_speed_max_kt", 0, 80],
    ["tide_height_min_ft", -20, 20],
    ["tide_height_max_ft", -20, 20],
  ] as Array<[keyof AlertConditions, number, number]>) {
    const message = validateNumber(input[key], key, min, max);
    if (message) return { ok: false, message };
  }

  if (
    isFiniteNumber(input.swell_height_min) &&
    isFiniteNumber(input.swell_height_max) &&
    input.swell_height_min > input.swell_height_max
  ) {
    return { ok: false, message: "Minimum wave height must be below the maximum." };
  }

  if (
    isFiniteNumber(input.tide_height_min_ft) &&
    isFiniteNumber(input.tide_height_max_ft) &&
    input.tide_height_min_ft > input.tide_height_max_ft
  ) {
    return { ok: false, message: "Minimum tide height must be below the maximum." };
  }

  if (
    (input.swell_direction_min_deg == null) !==
    (input.swell_direction_max_deg == null)
  ) {
    return { ok: false, message: "Swell direction needs both min and max degrees." };
  }

  if (
    input.wind_direction !== undefined &&
    !["offshore", "onshore", "cross-shore"].includes(String(input.wind_direction))
  ) {
    return { ok: false, message: "wind_direction is not supported." };
  }

  if (
    input.tide_direction !== undefined &&
    !["rising", "falling", "high", "low"].includes(String(input.tide_direction))
  ) {
    return { ok: false, message: "tide_direction is not supported." };
  }

  if (input.local_time_start !== undefined || input.local_time_end !== undefined) {
    if (!isTime(input.local_time_start) || !isTime(input.local_time_end)) {
      return {
        ok: false,
        message: "local_time_start and local_time_end must be HH:mm values.",
      };
    }
    if (input.local_time_start === input.local_time_end) {
      return { ok: false, message: "Local time window cannot be empty." };
    }
  }

  if (input.days_of_week !== undefined) {
    if (
      !Array.isArray(input.days_of_week) ||
      input.days_of_week.length === 0 ||
      input.days_of_week.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
    ) {
      return { ok: false, message: "days_of_week must use numbers from 0 to 6." };
    }
  }

  if (
    input.max_frequency_per_week !== undefined &&
    (typeof input.max_frequency_per_week !== "number" ||
      !Number.isInteger(input.max_frequency_per_week) ||
      input.max_frequency_per_week < 1 ||
      input.max_frequency_per_week > 14)
  ) {
    return { ok: false, message: "max_frequency_per_week must be between 1 and 14." };
  }

  if (
    input.quiet_hours_start !== undefined ||
    input.quiet_hours_end !== undefined
  ) {
    if (!isHour(input.quiet_hours_start) || !isHour(input.quiet_hours_end)) {
      return { ok: false, message: "Quiet hours must use whole hours from 0 to 23." };
    }
    if (input.quiet_hours_start === input.quiet_hours_end) {
      return { ok: false, message: "Quiet hours cannot cover the full day." };
    }
  }

  if (
    input.beginner_window_confirmed !== undefined &&
    typeof input.beginner_window_confirmed !== "boolean"
  ) {
    return { ok: false, message: "beginner_window_confirmed must be true or false." };
  }

  const output: AlertConditions = {};
  for (const key of CONDITION_KEYS) {
    copyDefined(output, input, key);
  }

  return { ok: true, conditions: output };
}
