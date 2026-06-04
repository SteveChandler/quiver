type ConditionSegment = string | number | null | undefined;

export interface ForecastWindowShareMetadataInput {
  slug: string;
  window: string | string[] | null | undefined;
  beachName?: string | null;
  locationLabel?: string | null;
  timezone?: string | null;
  waveHeight?: string | number | null;
  conditionSegments?: ConditionSegment[];
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
}

const DEFAULT_TIMEZONE = "America/Los_Angeles";
const FALLBACK_TITLE = "Open Quiver Surf Window";
const FALLBACK_DESCRIPTION = "Open this surf window in Quiver.";

function firstSearchValue(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).trim();
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

export function normalizeForecastWindowParam(
  value: string | string[] | null | undefined,
): string | null {
  const text = cleanText(firstSearchValue(value));
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text)) return null;
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
  const forecastAt = normalizeForecastWindowParam(input.window);
  const beachName = cleanText(input.beachName) ?? cleanText(titleCaseSlug(slug)) ?? "This spot";
  const windowLabel = forecastAt
    ? formatForecastWindowLabel(forecastAt, input.timezone)
    : null;
  const waveHeight = formatWaveHeight(input.waveHeight);
  const conditionRow = buildConditionRow(input.conditionSegments);
  const locationLabel = cleanText(input.locationLabel);
  const appSpotPath = buildAppSpotPath(slug, forecastAt);

  if (!forecastAt) {
    return {
      title: FALLBACK_TITLE,
      description: FALLBACK_DESCRIPTION,
      beachName,
      slug,
      forecastAt: null,
      windowLabel: null,
      waveHeight,
      conditionRow,
      locationLabel,
      ogImagePath: buildForecastWindowOgImagePath({
        slug,
        window: "fallback",
      }),
      appSpotPath,
      isFallback: true,
    };
  }

  const title = `${beachName} ${windowLabel} is lining up`;
  const conditions = [waveHeight, conditionRow].filter((value) => value && value !== "Forecast window");
  const conditionSentence = conditions.length > 0 ? `: ${conditions.join(" · ")}` : "";

  return {
    title,
    description: `${title}${conditionSentence}. Check it on Quiver.`,
    beachName,
    slug,
    forecastAt,
    windowLabel,
    waveHeight,
    conditionRow,
    locationLabel,
    ogImagePath: buildForecastWindowOgImagePath({ slug, window: forecastAt }),
    appSpotPath,
    isFallback: conditions.length === 0,
  };
}

function locationFromBeach(beach: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
} | null): string | null {
  if (!beach) return null;
  return [beach.city, beach.state ?? beach.country].filter(Boolean).join(", ") || null;
}

function forecastConditionSegments(forecast: Record<string, any> | null): ConditionSegment[] {
  if (!forecast) return [];
  const period = cleanText(forecast.swell_1_period);
  const direction = cleanText(forecast.swell_1_direction ?? forecast.swell_direction);
  const windSpeed = cleanText(forecast.wind_speed);
  const windDirection = cleanText(forecast.wind_direction);
  const tideHeight = cleanText(forecast.tide_height);
  const tideStatus = cleanText(forecast.tide_status)?.toLowerCase();

  return [
    period ? `${period.replace(/\s*s$/i, "")}s${direction ? ` ${direction}` : ""}` : null,
    windSpeed ? `${windSpeed}${/mph/i.test(windSpeed) ? "" : " mph"}${windDirection ? ` ${windDirection}` : ""}` : null,
    tideHeight ? `${tideHeight}${tideStatus ? ` ${tideStatus}` : ""}` : null,
  ];
}

export async function loadForecastWindowShareMetadata({
  slug,
  window,
}: {
  slug: string;
  window: string | string[] | null | undefined;
}): Promise<ForecastWindowShareMetadata> {
  const fallback = buildForecastWindowShareMetadata({ slug, window });
  if (!fallback.forecastAt || !fallback.slug) return fallback;
  if (process.env.JEST_WORKER_ID) return fallback;

  try {
    const { getBeachBySlugOrId } = await import("@/lib/utils/beach-lookup-utils");
    const beach = await getBeachBySlugOrId(fallback.slug);

    if (!beach) return fallback;

    let forecast: Record<string, any> | null = null;
    try {
      const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServiceRoleClient();
      const result = await (supabase as any)
        .from("enhanced_forecasts")
        .select(
          "forecast_at,wave_height,wave_height_om,swell_1_period,swell_1_direction,swell_direction,wind_speed,wind_direction,tide_height,tide_status",
        )
        .eq("beach_id", beach.id)
        .eq("forecast_at", fallback.forecastAt)
        .limit(1)
        .maybeSingle();

      forecast = result.error ? null : result.data ?? null;
    } catch {
      forecast = null;
    }

    return buildForecastWindowShareMetadata({
      slug: beach.slug ?? fallback.slug,
      window: fallback.forecastAt,
      beachName: beach.name,
      locationLabel: locationFromBeach(beach),
      timezone: beach.timezone,
      waveHeight: forecast?.wave_height ?? forecast?.wave_height_om ?? null,
      conditionSegments: forecastConditionSegments(forecast),
    });
  } catch {
    return fallback;
  }
}
