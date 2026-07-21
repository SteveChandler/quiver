import { resolveMajorEventHoldBoundary } from "@/lib/recommendations/major-event-hold/adapters/shared";
import { parseMajorEventHoldCandidate } from "@/lib/recommendations/major-event-hold/evaluator";
import type { EvaluateMajorEventHoldCandidatesInput } from "@/lib/recommendations/major-event-hold/service";
import type { MajorEventHoldCandidateDecision } from "@/lib/recommendations/major-event-hold/types";

type ConditionSegment = string | number | null | undefined;

export interface ForecastWindowShareMetadataInput {
  slug: string;
  window: string | string[] | null | undefined;
  beachName?: string | null;
  locationLabel?: string | null;
  timezone?: string | null;
  waveHeight?: string | number | null;
  conditionSegments?: ConditionSegment[];
  windowLabel?: string | string[] | null;
  conditions?: string | string[] | null;
}

export interface ForecastWindowShareMetadata {
  title: string;
  description: string;
  beachName: string;
  slug: string;
  forecastAt: string | null;
  windowLabel: string | null;
  waveHeight: string;
  conditionRow: string;
  locationLabel: string | null;
  ogImagePath: string;
  appSpotPath: string;
  isFallback: boolean;
}

interface ForecastWindowOgPathInput {
  slug: string;
  window: string;
  windowLabel?: string | null;
  conditions?: string | null;
}

interface ForecastWindowBeach {
  id: string;
  name: string;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  timezone?: string | null;
}

interface ForecastWindowShareDependencies {
  loadBeach?: (slug: string) => Promise<ForecastWindowBeach | null>;
  loadForecast?: (
    beachId: string,
    forecastAt: string,
  ) => Promise<Record<string, unknown> | null>;
  evaluateHoldCandidates?: (
    input: EvaluateMajorEventHoldCandidatesInput,
  ) => Promise<MajorEventHoldCandidateDecision[]>;
}

const DEFAULT_TIMEZONE = "America/Los_Angeles";
const FALLBACK_TITLE = "Open Quiver Surf Window";
const FALLBACK_DESCRIPTION = "Open this surf window in Quiver.";
const NEUTRAL_DESCRIPTION =
  "Wave, wind, and tide conditions can change quickly. Check the latest forecast and official advisories.";
const FORECAST_SLOT_DURATION_MS = 60 * 60 * 1000;
const ABSOLUTE_INSTANT_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;

function firstSearchValue(
  value: string | string[] | null | undefined,
): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return trimmed.length > 0 ? trimmed : null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeSlug(slug: string): string {
  return safeDecode(slug).trim().toLowerCase();
}

function titleCaseSlug(slug: string): string {
  return safeDecode(slug)
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function normalizeForecastWindowParam(
  value: string | string[] | null | undefined,
): string | null {
  const text = cleanText(firstSearchValue(value));
  if (!text) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}T/.test(text) ||
    !ABSOLUTE_INSTANT_SUFFIX_PATTERN.test(text)
  ) {
    return null;
  }
  return Number.isNaN(Date.parse(text)) ? null : text;
}

export function formatForecastWindowLabel(
  forecastAt: string,
  timezone: string | null | undefined = DEFAULT_TIMEZONE,
): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone || DEFAULT_TIMEZONE,
  }).format(new Date(forecastAt));
}

function buildConditionRow(segments: ConditionSegment[] | undefined): string {
  return (segments ?? [])
    .map((segment) => cleanText(segment) ?? "")
    .filter(Boolean)
    .join(" · ");
}

function formatWaveHeight(value: string | number | null | undefined): string {
  const clean = cleanText(value);
  if (!clean) return "Forecast window";
  if (/ft\b/i.test(clean)) return clean;
  return `${clean} ft`;
}

export function buildForecastWindowOgImagePath({
  slug,
  window,
}: ForecastWindowOgPathInput): string {
  const searchParams = new URLSearchParams();
  searchParams.set("slug", normalizeSlug(slug));
  searchParams.set("window", window);
  return `/api/og/forecast-window?${searchParams.toString()}`;
}

function buildAppSpotPath(slug: string, forecastAt: string | null): string {
  const path = `/app/spot/${encodeURIComponent(normalizeSlug(slug))}`;
  if (!forecastAt) return path;
  const searchParams = new URLSearchParams({ window: forecastAt });
  return `${path}?${searchParams.toString()}`;
}

export function buildForecastWindowShareMetadata(
  input: ForecastWindowShareMetadataInput,
): ForecastWindowShareMetadata {
  const slug = normalizeSlug(input.slug);
  const requestedForecastAt = normalizeForecastWindowParam(input.window);
  const beachName = cleanText(titleCaseSlug(slug)) ?? "This spot";

  return {
    title: FALLBACK_TITLE,
    description: FALLBACK_DESCRIPTION,
    beachName,
    slug,
    forecastAt: null,
    windowLabel: null,
    waveHeight: "Forecast window",
    conditionRow: "",
    locationLabel: null,
    ogImagePath: buildForecastWindowOgImagePath({
      slug,
      window: requestedForecastAt ?? "fallback",
    }),
    appSpotPath: buildAppSpotPath(slug, requestedForecastAt),
    isFallback: true,
  };
}

function buildResolvedForecastWindowShareMetadata(input: {
  slug: string;
  forecastAt: string;
  beachName: string;
  locationLabel: string | null;
  timezone: string | null | undefined;
  waveHeight: string | number | null | undefined;
  conditionSegments: ConditionSegment[];
  recommendationAllowed: boolean;
}): ForecastWindowShareMetadata {
  const slug = normalizeSlug(input.slug);
  const beachName = cleanText(input.beachName) ?? "This spot";
  const waveHeight = formatWaveHeight(input.waveHeight);
  const conditionRow = buildConditionRow(input.conditionSegments);
  const appSpotPath = buildAppSpotPath(slug, input.forecastAt);
  const ogImagePath = buildForecastWindowOgImagePath({
    slug,
    window: input.forecastAt,
  });

  if (!input.recommendationAllowed) {
    return {
      title: `Current surf conditions at ${beachName}`,
      description: NEUTRAL_DESCRIPTION,
      beachName,
      slug,
      forecastAt: input.forecastAt,
      windowLabel: null,
      waveHeight,
      conditionRow,
      locationLabel: cleanText(input.locationLabel),
      ogImagePath,
      appSpotPath,
      isFallback: true,
    };
  }

  const windowLabel = formatForecastWindowLabel(
    input.forecastAt,
    input.timezone,
  );
  const title = `${beachName} ${windowLabel} is lining up`;
  const conditions = [waveHeight, conditionRow].filter(
    (value) => value && value !== "Forecast window",
  );
  const conditionSentence =
    conditions.length > 0 ? `: ${conditions.join(" · ")}` : "";

  return {
    title,
    description: `${title}${conditionSentence}. Check it on Quiver.`,
    beachName,
    slug,
    forecastAt: input.forecastAt,
    windowLabel,
    waveHeight,
    conditionRow,
    locationLabel: cleanText(input.locationLabel),
    ogImagePath,
    appSpotPath,
    isFallback: false,
  };
}

function locationFromBeach(beach: ForecastWindowBeach): string | null {
  return (
    [beach.city, beach.state ?? beach.country].filter(Boolean).join(", ") ||
    null
  );
}

function forecastConditionSegments(
  forecast: Record<string, unknown>,
): ConditionSegment[] {
  const period = cleanText(forecast.swell_1_period);
  const direction = cleanText(
    forecast.swell_1_direction ?? forecast.wave_direction,
  );
  const windSpeed = cleanText(forecast.wind_speed);
  const windDirection = cleanText(forecast.wind_direction);
  const tideHeight = cleanText(forecast.tide_height);
  const tideStatus = cleanText(forecast.tide_status)?.toLowerCase();

  return [
    period
      ? `${period.replace(/\s*s$/i, "")}s${direction ? ` ${direction}` : ""}`
      : null,
    windSpeed
      ? `${windSpeed}${/mph/i.test(windSpeed) ? "" : " mph"}${windDirection ? ` ${windDirection}` : ""}`
      : null,
    tideHeight ? `${tideHeight}${tideStatus ? ` ${tideStatus}` : ""}` : null,
  ];
}

async function defaultLoadBeach(
  slug: string,
): Promise<ForecastWindowBeach | null> {
  const { getBeachBySlugOrId } = await import("@/lib/utils/beach-lookup-utils");
  return getBeachBySlugOrId(slug);
}

async function defaultLoadForecast(
  beachId: string,
  forecastAt: string,
): Promise<Record<string, unknown> | null> {
  const { createSupabaseServiceRoleClient } =
    await import("@/lib/supabase/server");
  const supabase = await createSupabaseServiceRoleClient();
  const result = await supabase
    .from("enhanced_forecasts")
    .select(
      "beach_id,forecast_at,wave_height,wave_height_om,swell_1_period,swell_1_direction,wave_direction,wind_speed,wind_direction,tide_height,tide_status",
    )
    .eq("beach_id", beachId)
    .eq("forecast_at", forecastAt)
    .limit(1)
    .maybeSingle();

  if (result.error || !result.data) return null;
  return {
    beach_id: result.data.beach_id,
    forecast_at: result.data.forecast_at,
    wave_height: result.data.wave_height,
    wave_height_om: result.data.wave_height_om,
    swell_1_period: result.data.swell_1_period,
    swell_1_direction: result.data.swell_1_direction,
    wave_direction: result.data.wave_direction,
    wind_speed: result.data.wind_speed,
    wind_direction: result.data.wind_direction,
    tide_height: result.data.tide_height,
    tide_status: result.data.tide_status,
  };
}

async function defaultEvaluateHoldCandidates(
  input: EvaluateMajorEventHoldCandidatesInput,
): Promise<MajorEventHoldCandidateDecision[]> {
  const { evaluateMajorEventHoldCandidates } =
    await import("@/lib/recommendations/major-event-hold/service");
  return evaluateMajorEventHoldCandidates(input);
}

export async function loadForecastWindowShareMetadata(
  {
    slug,
    window,
  }: {
    slug: string;
    window: string | string[] | null | undefined;
    windowLabel?: string | string[] | null;
    conditions?: string | string[] | null;
  },
  dependencies: ForecastWindowShareDependencies = {},
): Promise<ForecastWindowShareMetadata> {
  const fallback = buildForecastWindowShareMetadata({ slug, window });
  const requestedForecastAt = normalizeForecastWindowParam(window);
  if (!requestedForecastAt || !fallback.slug) return fallback;

  const loadBeach = dependencies.loadBeach ?? defaultLoadBeach;
  const loadForecast = dependencies.loadForecast ?? defaultLoadForecast;
  const evaluateHoldCandidates =
    dependencies.evaluateHoldCandidates ?? defaultEvaluateHoldCandidates;

  try {
    const beach = await loadBeach(fallback.slug);
    if (!beach) return fallback;

    const forecast = await loadForecast(beach.id, requestedForecastAt);
    const rowForecastAt = cleanText(forecast?.forecast_at);
    const rowBeachId = cleanText(forecast?.beach_id);
    if (
      !forecast ||
      !rowForecastAt ||
      rowBeachId !== beach.id ||
      Date.parse(rowForecastAt) !== Date.parse(requestedForecastAt)
    ) {
      return fallback;
    }

    const forecastAt = new Date(rowForecastAt).toISOString();
    const candidate = parseMajorEventHoldCandidate({
      candidateId: `forecast-window-share:${beach.id}:${forecastAt}`,
      beachId: beach.id,
      startsAt: forecastAt,
      endsAt: new Date(
        Date.parse(forecastAt) + FORECAST_SLOT_DURATION_MS,
      ).toISOString(),
    });
    if (!candidate) return fallback;

    let recommendationAllowed = false;
    try {
      const decisions = await evaluateHoldCandidates({
        candidates: [candidate],
        profileExperience: null,
      });
      const boundary = resolveMajorEventHoldBoundary(
        [candidate],
        [candidate],
        decisions,
      );
      recommendationAllowed =
        boundary.recommendationAvailability.state === "available" &&
        boundary.allowedCandidateIds.has(candidate.candidateId) &&
        isValidTimeZone(beach.timezone);
    } catch {
      recommendationAllowed = false;
    }

    return buildResolvedForecastWindowShareMetadata({
      slug: beach.slug ?? fallback.slug,
      forecastAt,
      beachName: beach.name,
      locationLabel: locationFromBeach(beach),
      timezone: beach.timezone,
      waveHeight: cleanText(forecast.wave_height ?? forecast.wave_height_om),
      conditionSegments: forecastConditionSegments(forecast),
      recommendationAllowed,
    });
  } catch {
    return fallback;
  }
}
