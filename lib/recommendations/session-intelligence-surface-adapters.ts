import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";
import type {
  SurfWindowBestForTag,
  SurfWindowConfidenceLevel,
  SurfWindowRecommendation,
  SurfWindowVerdict,
  SurfWindowWindQuality,
} from "@/types/session-intelligence";
import { buildSurfWindowLinks } from "@/lib/recommendations/surf-window-links";
import {
  buildSurfWindowDataNotes,
  buildSurfWindowSourceFlags,
  type SurfWindowSourceSupportHints,
} from "@/lib/recommendations/surf-window-source-flags";
import {
  buildBeachSurfWindowRecommendations,
  buildSurfWindowRecommendations,
  type BuildSurfWindowRecommendationsOptions,
  type SurfWindowForecastGroup,
} from "@/lib/recommendations/surf-window-recommendations";

const DEFAULT_MAX_RECOMMENDATIONS = 3;
const REGIONAL_MAX_RECOMMENDATIONS = 5;
const HOMEPAGE_MAX_RECOMMENDATIONS = 5;

function recommendationWindowIdentity(
  recommendation: SurfDiscoveryRecommendation
): string {
  return recommendation.kind === "custom_spot" && recommendation.customSpotId
    ? `custom:${recommendation.customSpotId}`
    : recommendation.beach.id;
}

export interface BuildSpotSurfWindowRecommendationsInput
  extends Pick<
    BuildSurfWindowRecommendationsOptions,
    "now" | "baseUrl" | "userPrefs" | "userSkill" | "boardTypes" | "sourceHints"
  > {
  beach: Beach;
  forecasts: EnhancedForecastEntity[];
  maxRecommendations?: number;
}

export interface BuildRegionalSurfWindowRecommendationsInput
  extends Pick<
    BuildSurfWindowRecommendationsOptions,
    "now" | "baseUrl" | "userPrefs" | "userSkill" | "boardTypes" | "sourceHints"
  > {
  groups: SurfWindowForecastGroup[];
  maxRecommendations?: number;
}

export interface BuildHomepageSurfWindowRecommendationsInput {
  recommendations: SurfDiscoveryRecommendation[];
  now?: Date;
  baseUrl?: string;
  maxRecommendations?: number;
  sourceHints?: SurfWindowSourceSupportHints;
}

function normalizeMaxRecommendations(
  maxRecommendations: number | undefined,
  defaultValue = DEFAULT_MAX_RECOMMENDATIONS,
  limit = defaultValue
): number {
  const candidate = maxRecommendations ?? defaultValue;
  if (!Number.isFinite(candidate)) return defaultValue;

  return Math.max(
    0,
    Math.min(
      limit,
      Math.floor(candidate)
    )
  );
}

export function buildSpotSurfWindowRecommendations({
  beach,
  forecasts,
  maxRecommendations,
  ...options
}: BuildSpotSurfWindowRecommendationsInput): SurfWindowRecommendation[] {
  return buildBeachSurfWindowRecommendations(beach, forecasts, {
    ...options,
    maxRecommendations: normalizeMaxRecommendations(maxRecommendations),
  }).recommendations;
}

export function buildRegionalSurfWindowRecommendations({
  groups,
  maxRecommendations,
  ...options
}: BuildRegionalSurfWindowRecommendationsInput): SurfWindowRecommendation[] {
  return buildSurfWindowRecommendations(groups, {
    ...options,
    maxRecommendations: normalizeMaxRecommendations(
      maxRecommendations,
      DEFAULT_MAX_RECOMMENDATIONS,
      REGIONAL_MAX_RECOMMENDATIONS
    ),
    maxWindowsPerBeach: 1,
  }).recommendations;
}

function clampScore(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function confidenceLevel(score: number): SurfWindowConfidenceLevel {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function verdictForScore(score: number): SurfWindowVerdict {
  if (score >= 70) return "Worth it";
  if (score >= 40) return "Maybe";
  return "Skip";
}

const VERDICT_SEVERITY: Record<SurfWindowVerdict, number> = {
  Skip: 0,
  Maybe: 1,
  "Worth it": 2,
};

// One-system rule: the verdict always derives from the displayed score band so a
// 92 can never render beside a "Maybe" badge. The upstream recommendationLabel
// gate encodes condition character (rough/mixed/weak), not personalization — when
// it disagrees downward, that nuance moves into a watchout instead of the badge.
function verdictForRecommendation(
  recommendation: SurfDiscoveryRecommendation
): SurfWindowVerdict {
  return verdictForScore(clampScore(recommendation.score));
}

function gateCapWatchout(
  recommendation: SurfDiscoveryRecommendation,
  verdict: SurfWindowVerdict
): string | null {
  const label = recommendation.recommendationLabel;
  if (!label || VERDICT_SEVERITY[label] >= VERDICT_SEVERITY[verdict]) return null;
  const characterLabel = recommendation.character?.label;
  if (characterLabel) {
    return `Conditions read ${characterLabel.toLowerCase()} despite the high score`;
  }
  return "High score but mixed conditions — double-check this window before trusting it.";
}

function localTimeLabel(
  start: Date,
  end: Date,
  timezone: string
): string {
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
  if (
    startSuffix &&
    endSuffix &&
    startSuffix.toUpperCase() === endSuffix.toUpperCase()
  ) {
    return `${startLabel.replace(/\s?(AM|PM)$/i, "")}-${endLabel}`;
  }
  return `${startLabel}-${endLabel}`;
}

function buildWindowId(beachId: string, startIso: string): string {
  return `${beachId}-${startIso}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function windQuality(wind: string): SurfWindowWindQuality {
  const normalized = wind.toLowerCase();
  if (normalized.includes("offshore")) return "offshore";
  if (normalized.includes("cross")) return "cross-shore";
  if (normalized.includes("onshore")) return "onshore";
  if (normalized.trim().length > 0) return "variable";
  return "unknown";
}

function toValidDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function bestForTags(
  recommendation: SurfDiscoveryRecommendation,
  start: Date
): SurfWindowBestForTag[] {
  const tags = new Set<SurfWindowBestForTag>();
  const boardType = recommendation.boardPick?.boardType?.toLowerCase();
  if (boardType === "longboard" || boardType === "shortboard" || boardType === "fish") {
    tags.add(boardType);
  }
  if (boardType === "mid-length" || boardType === "midlength") {
    tags.add("mid-length");
  }
  if (boardType === "foamie" || boardType === "soft-top") {
    tags.add("foamie");
  }
  if (start.getHours() < 10) {
    tags.add("dawn-patrol");
  }
  if (recommendation.score >= 75) tags.add("intermediate");
  if (tags.size === 0) tags.add("intermediate");
  return [...tags].slice(0, 4);
}

function homepageRecommendation(
  recommendation: SurfDiscoveryRecommendation,
  index: number,
  baseUrl: string | undefined,
  sourceHints: SurfWindowSourceSupportHints | undefined
): SurfWindowRecommendation {
  const start = toValidDate(recommendation.window.start) ?? new Date(0);
  const end = toValidDate(recommendation.window.end) ?? start;
  const peak = toValidDate(recommendation.window.peakTime) ?? start;
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const peakIso = peak.toISOString();
  const windowId = buildWindowId(recommendationWindowIdentity(recommendation), startIso);
  const score = clampScore(recommendation.score);
  const confidenceScore = clampScore(recommendation.window.confidence);
  const confidence = confidenceLevel(confidenceScore);
  const verdict = verdictForRecommendation(recommendation);
  const capWatchout = gateCapWatchout(recommendation, verdict);
  const sources = buildSurfWindowSourceFlags({
    forecast: recommendation.forecast,
    beach: recommendation.beach,
    hints: sourceHints,
  });
  const links = buildSurfWindowLinks({
    beach: recommendation.beach,
    windowId,
    baseUrl,
  });
  const timeLabel = localTimeLabel(
    start,
    end,
    recommendation.window.timezone
  );

  return {
    windowId,
    rank: index + 1,
    beach: {
      id: recommendation.beach.id,
      name: recommendation.beach.name,
      slug: recommendation.beach.slug ?? null,
      city: recommendation.beach.city ?? null,
      state: recommendation.beach.state ?? null,
      country: recommendation.beach.country ?? null,
      region: recommendation.beach.region ?? null,
      lat: recommendation.beach.lat ?? null,
      lon: recommendation.beach.lon ?? null,
      photoUrl: recommendation.beach.photo_url ?? null,
    },
    startIso,
    endIso,
    peakIso,
    timezone: recommendation.window.timezone,
    forecastAt: recommendation.forecast.forecast_at,
    localTimeLabel: timeLabel,
    score,
    verdict,
    headline: `${timeLabel} at ${recommendation.beach.name} looks ${verdict.toLowerCase()}`,
    wave: {
      height: recommendation.window.waveHeight,
      period: recommendation.window.wavePeriod,
      direction: recommendation.forecast.wave_direction ?? null,
      summary: [recommendation.window.waveHeight, recommendation.window.wavePeriod]
        .filter(Boolean)
        .join(" at "),
    },
    wind: {
      speed: recommendation.forecast.wind_speed ?? null,
      direction: recommendation.forecast.wind_direction ?? null,
      quality: windQuality(recommendation.window.wind),
      summary: recommendation.window.wind || "Wind data is sparse",
    },
    tide: {
      status: recommendation.forecast.tide_status ?? recommendation.window.tide ?? null,
      height: recommendation.forecast.tide_height ?? null,
      nextTideAt:
        recommendation.forecast.next_tide_at ??
        recommendation.forecast.next_tide_time ??
        null,
      trend: "unknown",
      summary: recommendation.window.tide || "Tide data is unavailable",
    },
    bestFor: bestForTags(recommendation, start),
    positives: recommendation.reasons.slice(0, 3),
    watchouts: [
      ...(capWatchout ? [capWatchout] : []),
      ...recommendation.warnings,
    ].slice(0, 3),
    dataNotes: buildSurfWindowDataNotes({
      forecast: recommendation.forecast,
      beach: recommendation.beach,
      hints: sourceHints,
      confidenceScore,
    }),
    confidence: {
      level: confidence,
      score: confidenceScore,
      summary: `${confidence} confidence`,
      reasons: [
        sources.forecastModel ? "Forecast model row is present" : null,
        sources.tide ? "Tide data is present" : null,
        sources.buoy ? "Buoy source evidence is present" : null,
      ].filter((reason): reason is string => Boolean(reason)),
    },
    sources,
    ...links,
  };
}

export function buildHomepageSurfWindowRecommendations({
  recommendations,
  maxRecommendations,
  baseUrl,
  sourceHints,
}: BuildHomepageSurfWindowRecommendationsInput): SurfWindowRecommendation[] {
  return recommendations
    .slice(
      0,
      normalizeMaxRecommendations(
        maxRecommendations,
        HOMEPAGE_MAX_RECOMMENDATIONS,
        HOMEPAGE_MAX_RECOMMENDATIONS
      )
    )
    .map((recommendation, index) =>
      homepageRecommendation(recommendation, index, baseUrl, sourceHints)
    );
}
