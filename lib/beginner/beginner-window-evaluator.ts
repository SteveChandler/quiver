export type BeginnerTideStage = "low" | "rising" | "mid" | "falling" | "high";

export type BeginnerWindowRating = "ideal" | "acceptable" | "poor" | "unknown";

export interface BeginnerWindowRange {
  min: number;
  max: number;
}

export interface BeginnerWindowProfile {
  idealWaveHeightFt: BeginnerWindowRange;
  acceptableWaveHeightFt: BeginnerWindowRange;
  preferredTideStages: BeginnerTideStage[];
  preferredTideFt: {
    min: number | null;
    max: number | null;
  };
  avoidHighTideUnderFt: number;
  bestTimeLocal: {
    start: string;
    end: string;
  };
  maxBeginnerWindMph: number;
}

export interface BeginnerBeachMetadata {
  skill_level?: string | null;
  break_type?: string | null;
  features?: string[] | null;
  preference_model?: unknown;
  preferred_tide_ft_min?: number | null;
  preferred_tide_ft_max?: number | null;
}

export interface BeginnerWindowInput {
  beach: BeginnerBeachMetadata;
  waveHeightFtMax: number | null;
  windSpeedMph?: number | null;
  windSpeedKt?: number | null;
  tideStatus?: string | null;
  tideHeightFt?: number | null;
  forecastAt?: string | null;
  timezone?: string | null;
}

export interface BeginnerWindowEvaluation {
  applies: boolean;
  rating: Exclude<BeginnerWindowRating, "unknown"> | "not_applicable";
  labels: {
    wave: string;
    wind: string;
    tide: string;
    time: string;
  };
  statuses: {
    wave: BeginnerWindowRating;
    wind: BeginnerWindowRating;
    tide: BeginnerWindowRating;
    time: BeginnerWindowRating;
  };
  reasons: string[];
  profile: BeginnerWindowProfile | null;
}

const KNOTS_TO_MPH = 1.15078;

export const DEFAULT_SANDY_BEGINNER_WINDOW_PROFILE: BeginnerWindowProfile = {
  idealWaveHeightFt: { min: 1, max: 2 },
  acceptableWaveHeightFt: { min: 0.5, max: 3 },
  preferredTideStages: ["low", "rising", "mid"],
  preferredTideFt: { min: null, max: null },
  avoidHighTideUnderFt: 2,
  bestTimeLocal: { start: "06:00", end: "10:00" },
  maxBeginnerWindMph: 10,
};

export function getSandyBeginnerWindowProfile(
  beach: BeginnerBeachMetadata,
): BeginnerWindowProfile | null {
  const beginnerWindow = readBeginnerWindow(beach.preference_model);
  const beginnerFit = readString(beginnerWindow?.beginner_fit)?.toLowerCase();
  if (beginnerFit === "no") return null;

  if (!beginnerWindow && !isSandyBeginnerBeachMetadata(beach)) return null;

  return {
    idealWaveHeightFt:
      readRange(beginnerWindow?.ideal_wave_height_ft) ??
      DEFAULT_SANDY_BEGINNER_WINDOW_PROFILE.idealWaveHeightFt,
    acceptableWaveHeightFt:
      readRange(beginnerWindow?.acceptable_wave_height_ft) ??
      DEFAULT_SANDY_BEGINNER_WINDOW_PROFILE.acceptableWaveHeightFt,
    preferredTideStages:
      readTideStages(beginnerWindow?.preferred_tide_stage) ??
      DEFAULT_SANDY_BEGINNER_WINDOW_PROFILE.preferredTideStages,
    preferredTideFt: {
      min:
        readNumber(beginnerWindow?.preferred_tide_ft_min) ??
        beach.preferred_tide_ft_min ??
        null,
      max:
        readNumber(beginnerWindow?.preferred_tide_ft_max) ??
        beach.preferred_tide_ft_max ??
        null,
    },
    avoidHighTideUnderFt:
      readNumber(beginnerWindow?.avoid_high_tide_under_ft) ??
      DEFAULT_SANDY_BEGINNER_WINDOW_PROFILE.avoidHighTideUnderFt,
    bestTimeLocal:
      readTimeWindow(beginnerWindow?.best_time_local) ??
      DEFAULT_SANDY_BEGINNER_WINDOW_PROFILE.bestTimeLocal,
    maxBeginnerWindMph:
      readNumber(beginnerWindow?.max_beginner_wind_mph) ??
      DEFAULT_SANDY_BEGINNER_WINDOW_PROFILE.maxBeginnerWindMph,
  };
}

export function isSandyBeginnerBeachMetadata(
  beach: BeginnerBeachMetadata,
): boolean {
  const beginnerWindow = readBeginnerWindow(beach.preference_model);
  if (beginnerWindow) {
    const fit = readString(beginnerWindow.beginner_fit)?.toLowerCase();
    return fit !== "no";
  }

  const skill = beach.skill_level?.toLowerCase() ?? "";
  const breakType = beach.break_type?.toLowerCase() ?? "";
  const features = (beach.features ?? []).join(" ").toLowerCase();

  const beginnerTagged =
    skill.includes("beginner") || features.includes("beginner");
  const sandyBeachbreak =
    breakType.includes("beach") ||
    features.includes("sand") ||
    features.includes("sandy");

  return beginnerTagged && sandyBeachbreak;
}

export function evaluateBeginnerWindow(
  input: BeginnerWindowInput,
): BeginnerWindowEvaluation {
  const profile = getSandyBeginnerWindowProfile(input.beach);
  if (!profile) {
    return {
      applies: false,
      rating: "not_applicable",
      labels: {
        wave: "Not a sandy beginner model",
        wind: "Not a sandy beginner model",
        tide: "Not a sandy beginner model",
        time: "Not a sandy beginner model",
      },
      statuses: {
        wave: "unknown",
        wind: "unknown",
        tide: "unknown",
        time: "unknown",
      },
      reasons: [],
      profile: null,
    };
  }

  const windMph =
    input.windSpeedMph ??
    (input.windSpeedKt != null ? input.windSpeedKt * KNOTS_TO_MPH : null);
  const tideStage = normalizeTideStage(input.tideStatus);
  const localMinutes = getLocalMinutes(input.forecastAt, input.timezone);

  const waveStatus = rateWave(input.waveHeightFtMax, profile);
  const windStatus = rateWind(windMph, profile);
  const tideStatus = rateTide(
    input.waveHeightFtMax ?? null,
    tideStage,
    input.tideHeightFt ?? null,
    profile,
  );
  const timeStatus = rateTime(localMinutes, profile);
  const statuses = {
    wave: waveStatus.status,
    wind: windStatus.status,
    tide: tideStatus.status,
    time: timeStatus.status,
  };
  const knownStatuses = Object.values(statuses).filter((s) => s !== "unknown");
  let rating: BeginnerWindowEvaluation["rating"];
  if (knownStatuses.length === 0 || knownStatuses.includes("poor")) {
    rating = "poor";
  } else if (Object.values(statuses).every((s) => s === "ideal")) {
    rating = "ideal";
  } else {
    rating = "acceptable";
  }

  return {
    applies: true,
    rating,
    labels: {
      wave: waveStatus.label,
      wind: windStatus.label,
      tide: tideStatus.label,
      time: timeStatus.label,
    },
    statuses,
    reasons: [
      waveStatus.reason,
      windStatus.reason,
      tideStatus.reason,
      timeStatus.reason,
    ].filter((reason): reason is string => Boolean(reason)),
    profile,
  };
}

export function normalizeTideStage(
  tideStatus: string | null | undefined,
): BeginnerTideStage | null {
  const value = tideStatus?.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("high")) return "high";
  if (value.includes("low")) return "low";
  if (value.includes("mid")) return "mid";
  if (value.includes("rising") || value.includes("incoming")) return "rising";
  if (value.includes("falling") || value.includes("outgoing")) return "falling";
  return null;
}

function rateWave(
  waveHeightFtMax: number | null,
  profile: BeginnerWindowProfile,
): { status: BeginnerWindowRating; label: string; reason?: string } {
  if (waveHeightFtMax == null || !Number.isFinite(waveHeightFtMax)) {
    return { status: "unknown", label: "Wave height unavailable" };
  }

  if (isInRange(waveHeightFtMax, profile.idealWaveHeightFt)) {
    return {
      status: "ideal",
      label: "Ideal 1-2 ft learner surf",
      reason: "small waves",
    };
  }

  if (isInRange(waveHeightFtMax, profile.acceptableWaveHeightFt)) {
    return {
      status: "acceptable",
      label: "Manageable if the rest lines up",
      reason: "manageable wave height",
    };
  }

  return {
    status: "poor",
    label: "Outside the beginner size window",
    reason: "outside beginner wave range",
  };
}

function rateWind(
  windMph: number | null,
  profile: BeginnerWindowProfile,
): { status: BeginnerWindowRating; label: string; reason?: string } {
  if (windMph == null || !Number.isFinite(windMph)) {
    return { status: "unknown", label: "Wind unavailable" };
  }
  if (windMph <= profile.maxBeginnerWindMph) {
    return { status: "ideal", label: "Light wind", reason: "light wind" };
  }
  if (windMph <= profile.maxBeginnerWindMph + 5) {
    return { status: "acceptable", label: "Some texture" };
  }
  return { status: "poor", label: "Too windy for learning" };
}

function rateTide(
  waveHeightFtMax: number | null,
  tideStage: BeginnerTideStage | null,
  tideHeightFt: number | null,
  profile: BeginnerWindowProfile,
): { status: BeginnerWindowRating; label: string; reason?: string } {
  const smallHighTide =
    tideStage === "high" &&
    waveHeightFtMax != null &&
    waveHeightFtMax <= profile.avoidHighTideUnderFt;

  if (smallHighTide) {
    return {
      status: "poor",
      label: "Tiny high tide may not break cleanly",
      reason: "small high tide",
    };
  }

  if (tideStage && profile.preferredTideStages.includes(tideStage)) {
    return {
      status: "ideal",
      label: "Low-to-mid tide fit",
      reason: "low-to-mid tide",
    };
  }

  if (
    tideHeightFt != null &&
    isWithinPreferredTideHeight(tideHeightFt, profile)
  ) {
    return {
      status: "ideal",
      label: "Tide height in range",
      reason: "tide fit",
    };
  }

  if (!tideStage && tideHeightFt == null) {
    return { status: "unknown", label: "Tide unavailable" };
  }

  return {
    status: "acceptable",
    label: "Check the tide before paddling out",
  };
}

function rateTime(
  localMinutes: number | null,
  profile: BeginnerWindowProfile,
): { status: BeginnerWindowRating; label: string; reason?: string } {
  if (localMinutes == null) {
    return { status: "unknown", label: "Local time unavailable" };
  }

  if (isWithinTimeWindow(localMinutes, profile.bestTimeLocal)) {
    return {
      status: "ideal",
      label: "Best morning glass window",
      reason: "morning window",
    };
  }

  return { status: "acceptable", label: "Outside the best morning window" };
}

function isInRange(value: number, range: BeginnerWindowRange): boolean {
  return value >= range.min && value <= range.max;
}

function isWithinPreferredTideHeight(
  tideHeightFt: number,
  profile: BeginnerWindowProfile,
): boolean {
  const min = profile.preferredTideFt.min;
  const max = profile.preferredTideFt.max;
  if (min != null && tideHeightFt < min) return false;
  if (max != null && tideHeightFt > max) return false;
  return min != null || max != null;
}

function isWithinTimeWindow(
  localMinutes: number,
  window: BeginnerWindowProfile["bestTimeLocal"],
): boolean {
  const start = parseTimeToMinutes(window.start);
  const end = parseTimeToMinutes(window.end);
  if (start == null || end == null) return false;
  if (start <= end) return localMinutes >= start && localMinutes <= end;
  return localMinutes >= start || localMinutes <= end;
}

function getLocalMinutes(
  forecastAt: string | null | undefined,
  timezone: string | null | undefined,
): number | null {
  if (!forecastAt) return null;
  const date = new Date(forecastAt);
  if (Number.isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone ?? "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function readBeginnerWindow(
  preferenceModel: unknown,
): Record<string, unknown> | null {
  const model = readRecord(preferenceModel);
  const beginnerWindow = readRecord(model?.beginner_window);
  if (!beginnerWindow) return null;
  const modelName = readString(beginnerWindow.model)?.toLowerCase();
  if (modelName && !modelName.includes("beginner")) return null;
  return beginnerWindow;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return readRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readRange(value: unknown): BeginnerWindowRange | null {
  const record = readRecord(value);
  const min = readNumber(record?.min);
  const max = readNumber(record?.max);
  if (min == null || max == null) return null;
  return { min, max };
}

function readTideStages(value: unknown): BeginnerTideStage[] | null {
  if (!Array.isArray(value)) return null;
  const stages = value
    .map((item) => normalizeTideStage(String(item)))
    .filter((item): item is BeginnerTideStage => item != null);
  return stages.length > 0 ? stages : null;
}

function readTimeWindow(
  value: unknown,
): BeginnerWindowProfile["bestTimeLocal"] | null {
  const record = readRecord(value);
  const start = readString(record?.start);
  const end = readString(record?.end);
  if (!start || !end) return null;
  if (parseTimeToMinutes(start) == null || parseTimeToMinutes(end) == null) {
    return null;
  }
  return { start, end };
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
