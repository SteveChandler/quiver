import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { getUserSurfPreferences } from "@/lib/services/preference-learning-service";
import {
  selectBestWindows,
  scoreWindowWithComposite,
  getDirectionDegrees,
} from "@/lib/services/discovery/window-selector";
import { scoreNativeForecastSlot } from "@/lib/scoring/native-condition-score";
import { buildSurfWindowLinks } from "@/lib/recommendations/surf-window-links";
import {
  buildSurfWindowDataNotes,
  buildSurfWindowSourceFlags,
  type SurfWindowSourceSupportHints,
} from "@/lib/recommendations/surf-window-source-flags";
import type {
  SurfWindowBestForTag,
  SurfWindowConfidenceLevel,
  SurfWindowRecommendation,
  SurfWindowRecommendationResult,
  SurfWindowSourceFlags,
  SurfWindowTideTrend,
  SurfWindowVerdict,
  SurfWindowWindQuality,
} from "@/types/session-intelligence";

export interface SurfWindowForecastGroup {
  beach: Beach;
  forecasts: EnhancedForecastEntity[];
  sourceHints?: SurfWindowSourceSupportHints;
}

export interface BuildSurfWindowRecommendationsOptions {
  now?: Date;
  baseUrl?: string;
  maxRecommendations?: number;
  maxWindowsPerBeach?: number;
  userPrefs?: Awaited<ReturnType<typeof getUserSurfPreferences>> | null;
  userSkill?: string | null;
  boardTypes?: string[];
  sourceHints?: SurfWindowSourceSupportHints;
}

const DEFAULT_MAX_RECOMMENDATIONS = 3;
const LOW_CONFIDENCE_THRESHOLD = 50;
const HIGH_CONFIDENCE_THRESHOLD = 75;

function parseForecastAt(row: EnhancedForecastEntity): Date | null {
  const date = new Date(row.forecast_at);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validFutureForecastRows(
  rows: EnhancedForecastEntity[],
  now: Date
): EnhancedForecastEntity[] {
  return rows.filter((row) => {
    const forecastAt = parseForecastAt(row);
    return forecastAt ? forecastAt.getTime() > now.getTime() : false;
  });
}

function resolveHorizonDays(
  groups: SurfWindowForecastGroup[],
  now: Date
): 7 | 14 {
  const dayMs = 24 * 60 * 60 * 1000;
  const daySeven = now.getTime() + 7 * dayMs;
  const dayFourteen = now.getTime() + 14 * dayMs;

  const hasSecondWeekRows = groups.some((group) =>
    validFutureForecastRows(group.forecasts, now).some((row) => {
      const forecastAt = parseForecastAt(row);
      if (!forecastAt) return false;
      const time = forecastAt.getTime();
      return time > daySeven && time <= dayFourteen;
    })
  );

  return hasSecondWeekRows ? 14 : 7;
}

function normalizeGroups(
  input: SurfWindowForecastGroup | SurfWindowForecastGroup[]
): SurfWindowForecastGroup[] {
  return Array.isArray(input) ? input : [input];
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function confidenceLevel(score: number): SurfWindowConfidenceLevel {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) return "high";
  if (score >= LOW_CONFIDENCE_THRESHOLD) return "medium";
  return "low";
}

function verdictForScore(score: number): SurfWindowVerdict {
  if (score >= 70) return "Worth it";
  if (score >= 40) return "Maybe";
  return "Skip";
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatLocalTimeLabel(start: Date, end: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const startLabel = formatter.format(start);
  const endLabel = formatter.format(end);
  const startSuffix = startLabel.match(/\b(AM|PM)$/i)?.[1];
  const endSuffix = endLabel.match(/\b(AM|PM)$/i)?.[1];
  if (startSuffix && endSuffix && startSuffix.toUpperCase() === endSuffix.toUpperCase()) {
    return `${startLabel.replace(/\s?(AM|PM)$/i, "")}-${endLabel}`;
  }
  return `${startLabel}-${endLabel}`;
}

function localHour(date: Date, timezone: string): number | null {
  try {
    const value = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(date);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function buildWindowId(beachId: string, startIso: string): string {
  return `${beachId}-${startIso}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function tideTrend(row: EnhancedForecastEntity): SurfWindowTideTrend {
  const status = row.tide_status?.toLowerCase() ?? "";
  if (status.includes("rising") || status.includes("incoming")) return "rising";
  if (status.includes("falling") || status.includes("outgoing")) return "falling";
  if (status.includes("high")) return "high";
  if (status.includes("low")) return "low";
  return "unknown";
}

function windQuality(row: EnhancedForecastEntity, beach: Beach): SurfWindowWindQuality {
  const speed = parseNumber(row.wind_speed);
  const direction = getDirectionDegrees(row.wind_direction_deg, row.wind_direction);
  if (direction == null) return speed != null && speed <= 8 ? "variable" : "unknown";
  if (beach.wind_offshore_deg == null) return speed != null && speed <= 8 ? "variable" : "unknown";

  const tolerance = beach.wind_offshore_tol_deg ?? 35;
  const diff = Math.min(
    Math.abs(direction - beach.wind_offshore_deg),
    360 - Math.abs(direction - beach.wind_offshore_deg)
  );
  if (diff <= tolerance) return "offshore";
  if (diff <= 90) return "cross-shore";
  return "onshore";
}

function waveSummary(row: EnhancedForecastEntity): SurfWindowRecommendation["wave"] {
  const height = row.wave_height ?? null;
  const period = row.wave_period ?? row.swell_1_period ?? null;
  const direction = row.wave_direction ?? row.swell_1_direction ?? null;
  const pieces = [
    height ? `${height} ft` : null,
    period ? `at ${period}` : null,
    direction ? `from ${direction}` : null,
  ].filter(Boolean);

  return {
    height,
    period,
    direction,
    summary: pieces.length > 0 ? pieces.join(" ") : "Wave data is sparse",
  };
}

function windSummary(
  row: EnhancedForecastEntity,
  quality: SurfWindowWindQuality
): SurfWindowRecommendation["wind"] {
  const speed = row.wind_speed ?? null;
  const direction = row.wind_direction ?? null;
  const summary =
    speed || direction
      ? `${[speed, direction].filter(Boolean).join(" ")} (${quality})`
      : "Wind data is sparse";

  return {
    speed,
    direction,
    quality,
    summary,
  };
}

function tideSummary(
  row: EnhancedForecastEntity,
  trend: SurfWindowTideTrend
): SurfWindowRecommendation["tide"] {
  const status = row.tide_status ?? null;
  const height = row.tide_height ?? null;
  const nextTideAt = row.next_tide_at ?? row.next_tide_time ?? null;
  const summary =
    status || height
      ? `${[status, height ? `${height} ft` : null].filter(Boolean).join(", ")}`
      : "Tide data is unavailable";

  return {
    status,
    height,
    nextTideAt,
    trend,
    summary,
  };
}

function bestForTags(
  row: EnhancedForecastEntity,
  start: Date,
  timezone: string,
  options: BuildSurfWindowRecommendationsOptions
): SurfWindowBestForTag[] {
  const tags = new Set<SurfWindowBestForTag>();
  const waveHeight = parseNumber(row.wave_height);
  if (waveHeight != null) {
    if (waveHeight <= 3) {
      tags.add("beginner");
      tags.add("foamie");
      tags.add("longboard");
    } else if (waveHeight <= 6) {
      tags.add("intermediate");
      tags.add("longboard");
    } else {
      tags.add("advanced");
      tags.add("shortboard");
    }
  }

  const skill = options.userSkill?.toLowerCase();
  if (skill === "beginner" || skill === "intermediate" || skill === "advanced") {
    tags.add(skill);
  }

  for (const boardType of options.boardTypes ?? []) {
    const normalized = boardType.toLowerCase();
    if (normalized === "longboard" || normalized === "shortboard" || normalized === "fish") {
      tags.add(normalized);
    }
    if (normalized === "mid-length" || normalized === "midlength") {
      tags.add("mid-length");
    }
    if (normalized === "foamie" || normalized === "soft-top") {
      tags.add("foamie");
    }
  }

  const hour = localHour(start, timezone);
  if (hour != null && hour < 10) tags.add("dawn-patrol");
  if (hour != null && hour >= 16) tags.add("sunset-session");

  if (tags.size === 0) tags.add("intermediate");
  return [...tags].slice(0, 4);
}

function confidenceReasons(
  score: number,
  sources: SurfWindowSourceFlags
): string[] {
  const reasons: string[] = [];
  if (sources.forecastModel) reasons.push("Forecast model row is present");
  if (sources.tide) reasons.push("Tide data is present");
  if (sources.buoy) reasons.push("Buoy source evidence is present");
  if (score < LOW_CONFIDENCE_THRESHOLD) reasons.push("Forecast confidence is low");
  return reasons;
}

function headline(
  verdict: SurfWindowVerdict,
  beachName: string,
  localTimeLabel: string
): string {
  if (verdict === "Worth it") return `${localTimeLabel} looks worth it at ${beachName}`;
  if (verdict === "Maybe") return `${localTimeLabel} is a maybe at ${beachName}`;
  return `${localTimeLabel} is probably a skip at ${beachName}`;
}

function compareRecommendations(
  a: SurfWindowRecommendation,
  b: SurfWindowRecommendation
): number {
  const scoreDelta = b.score - a.score;
  if (scoreDelta !== 0) return scoreDelta;

  const confidenceDelta = b.confidence.score - a.confidence.score;
  if (confidenceDelta !== 0) return confidenceDelta;

  const startDelta = new Date(a.startIso).getTime() - new Date(b.startIso).getTime();
  if (startDelta !== 0) return startDelta;

  const beachDelta = a.beach.id.localeCompare(b.beach.id);
  if (beachDelta !== 0) return beachDelta;

  return a.windowId.localeCompare(b.windowId);
}

function buildRecommendation(
  group: SurfWindowForecastGroup,
  row: EnhancedForecastEntity,
  window: ReturnType<typeof selectBestWindows>[number],
  options: BuildSurfWindowRecommendationsOptions,
  baseUrl: string | undefined
): SurfWindowRecommendation {
  const composite = scoreWindowWithComposite(row, group.beach);
  const score = clampScore(
    window.score ?? scoreNativeForecastSlot(row, options.userSkill)
  );
  const forecastConfidence = clampScore(row.confidence_score ?? composite.confidence);
  const confidenceScore = Math.round((forecastConfidence + clampScore(composite.confidence)) / 2);
  const verdict = verdictForScore(score);
  const localTimeLabel = formatLocalTimeLabel(window.start, window.end, window.timezone);
  const startIso = window.start.toISOString();
  const endIso = window.end.toISOString();
  const peakIso = (window.peakTime ?? window.start).toISOString();
  const windowId = buildWindowId(group.beach.id, startIso);
  const sourceHints = {
    ...options.sourceHints,
    ...group.sourceHints,
  };
  const sources = buildSurfWindowSourceFlags({
    forecast: row,
    beach: group.beach,
    hints: sourceHints,
  });
  const links = buildSurfWindowLinks({
    beach: group.beach,
    windowId,
    forecastAt: startIso,
    baseUrl,
  });
  const tide = tideTrend(row);
  const wind = windQuality(row, group.beach);
  const positives = composite.reasons.length > 0
    ? [...composite.reasons].slice(0, 3)
    : ["Conditions line up with this spot"];
  const watchouts = composite.warnings.length > 0
    ? [...composite.warnings].slice(0, 3)
    : [];

  return {
    recommendationId: `beach:${group.beach.id}:${startIso}`,
    windowId,
    rank: 0,
    beach: {
      id: group.beach.id,
      name: group.beach.name,
      slug: group.beach.slug ?? null,
      city: group.beach.city ?? null,
      state: group.beach.state ?? null,
      country: group.beach.country ?? null,
      region: group.beach.region ?? null,
      lat: group.beach.lat ?? null,
      lon: group.beach.lon ?? null,
      photoUrl:
        (group.beach as Beach & { photo_url?: string | null }).photo_url ??
        null,
    },
    startIso,
    endIso,
    peakIso,
    timezone: window.timezone,
    forecastAt: row.forecast_at,
    localTimeLabel,
    score,
    verdict,
    headline: headline(verdict, group.beach.name, localTimeLabel),
    wave: waveSummary(row),
    wind: windSummary(row, wind),
    tide: tideSummary(row, tide),
    bestFor: bestForTags(row, window.start, window.timezone, options),
    positives,
    watchouts,
    dataNotes: buildSurfWindowDataNotes({
      forecast: row,
      beach: group.beach,
      hints: sourceHints,
      confidenceScore,
    }),
    confidence: {
      level: confidenceLevel(confidenceScore),
      score: confidenceScore,
      summary: `${confidenceLevel(confidenceScore)} confidence`,
      reasons: confidenceReasons(confidenceScore, sources),
    },
    sources,
    ...links,
  };
}

export function buildSurfWindowRecommendations(
  input: SurfWindowForecastGroup | SurfWindowForecastGroup[],
  options: BuildSurfWindowRecommendationsOptions = {}
): SurfWindowRecommendationResult {
  const now = options.now ?? new Date();
  const groups = normalizeGroups(input);
  const horizonDays = resolveHorizonDays(groups, now);
  const maxRecommendations = Math.max(
    0,
    Math.floor(options.maxRecommendations ?? DEFAULT_MAX_RECOMMENDATIONS)
  );
  const baseUrl = options.baseUrl;

  if (maxRecommendations === 0 || groups.length === 0) {
    return {
      generatedAt: now.toISOString(),
      horizonDays,
      recommendations: [],
    };
  }

  const candidates = groups.flatMap((group) => {
    const validRows = validFutureForecastRows(group.forecasts, now);
    if (validRows.length === 0) return [];

    const selectedWindows = selectBestWindows({
      forecasts: validRows,
      beach: group.beach,
      userPrefs: options.userPrefs ?? null,
      userSkillLevel: options.userSkill ?? null,
      horizonHours: horizonDays * 24,
      now,
      maxWindows: options.maxWindowsPerBeach ?? maxRecommendations,
    });

    return selectedWindows.flatMap((window) => {
      const row = window.sourceForecast;
      if (!row) return [];
      return [buildRecommendation(group, row, window, options, baseUrl)];
    });
  });

  const recommendations = candidates
    .sort(compareRecommendations)
    .slice(0, maxRecommendations)
    .map((recommendation, index) => ({
      ...recommendation,
      rank: index + 1,
    }));

  return {
    generatedAt: now.toISOString(),
    horizonDays,
    recommendations,
  };
}

export function buildBeachSurfWindowRecommendations(
  beach: Beach,
  forecasts: EnhancedForecastEntity[],
  options: BuildSurfWindowRecommendationsOptions = {}
): SurfWindowRecommendationResult {
  return buildSurfWindowRecommendations({ beach, forecasts }, options);
}
