import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { SYSTEM_VOICE_LABEL } from "./system-card-config";
import type { SystemCardClass } from "./system-card-types";

export interface SystemForecastSnapshot {
  forecastAt: string;
  waveHeightFt: number | null;
  wavePeriodSeconds: number | null;
  windSpeedKnots: number | null;
  windDirection: string | null;
  tideHeightFt: number | null;
  tideStatus: string | null;
  waterTempF: number | null;
}

export interface SystemCardObservation {
  observedAt: string;
  waveHeightFt: number | null;
  waveQuality: number | null;
}

export interface SystemCardCandidate {
  id: string;
  name: string;
  lat: number;
  lon: number;
  marketKey: string;
  allocationTier: "proven" | "adjacent" | "exploration";
  trafficWeight: number;
  materialTransition?: boolean;
}

export interface SystemCardCopy {
  title: string;
  description: string;
  contentClass: SystemCardClass;
  semanticClaim: string;
  prompt: boolean;
  surfConditions: Record<string, unknown>;
}

export async function fetchLatestSystemForecast(
  supabase: SupabaseClient<Database>,
  beachId: string,
): Promise<SystemForecastSnapshot | null> {
  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select(
      "forecast_at, wave_height, wave_period, wind_speed, wind_direction, tide_height, tide_status, water_temp",
    )
    .eq("beach_id", beachId)
    .order("forecast_at", { ascending: false })
    .limit(1);

  if (error || !data?.[0]) return null;
  const row = data[0];
  const snapshot: SystemForecastSnapshot = {
    forecastAt: row.forecast_at,
    waveHeightFt: toFiniteNumber(row.wave_height),
    wavePeriodSeconds: toFiniteNumber(row.wave_period),
    windSpeedKnots: toFiniteNumber(row.wind_speed),
    windDirection: typeof row.wind_direction === "string" ? row.wind_direction : null,
    tideHeightFt: toFiniteNumber(row.tide_height),
    tideStatus: typeof row.tide_status === "string" ? row.tide_status : null,
    waterTempF: parseTemperature(row.water_temp),
  };

  return hasForecastFact(snapshot) ? snapshot : null;
}

export function buildSystemCardCopy(args: {
  candidate: Pick<SystemCardCandidate, "id" | "name" | "marketKey" | "allocationTier">;
  forecast: SystemForecastSnapshot;
  contentClass: SystemCardClass;
  observation?: SystemCardObservation | null;
}): SystemCardCopy {
  const facts = describeForecastFacts(args.forecast);
  const timestamp = formatTimestamp(args.forecast.forecastAt);
  const prompt =
    args.contentClass === "prompt" ||
    args.contentClass === "correction_request" ||
    args.contentClass === "forecast_vs_observation";

  let title: string;
  let description: string;
  switch (args.contentClass) {
    case "wind_read":
      title = `Wind read · ${args.candidate.name}`;
      description = `Updated ${timestamp}. ${facts.wind || "Wind data is not available in this forecast."}`;
      break;
    case "water_temperature":
      title = `Water temperature · ${args.candidate.name}`;
      description = `Updated ${timestamp}. ${facts.water || "Water-temperature data is not available in this forecast."}`;
      break;
    case "prompt":
      title = `Surf-window check · ${args.candidate.name}`;
      description = `Updated ${timestamp}. ${facts.summary} Did the forecast hold? Mark better, as expected, or worse.`;
      break;
    case "correction_request":
      title = `Forecast correction · ${args.candidate.name}`;
      description = `Updated ${timestamp}. ${facts.summary} If this missed the window, record the correction so the next call can improve.`;
      break;
    case "forecast_vs_observation":
      title = `Forecast vs observation · ${args.candidate.name}`;
      description = buildComparisonDescription(timestamp, facts.summary, args.observation);
      break;
    case "forecast_summary":
    default:
      title = `Forecast summary · ${args.candidate.name}`;
      description = `Updated ${timestamp}. ${facts.summary}`;
      break;
  }

  const semanticClaim = buildSemanticClaim(args.forecast, args.contentClass, args.observation);
  return {
    title,
    description,
    contentClass: args.contentClass,
    semanticClaim,
    prompt,
    surfConditions: {
      system_card: true,
      voice: SYSTEM_VOICE_LABEL,
      content_class: args.contentClass,
      semantic_claim: semanticClaim,
      prompt,
      market_key: args.candidate.marketKey,
      allocation_tier: args.candidate.allocationTier,
      forecast_at: args.forecast.forecastAt,
    },
  };
}

function buildComparisonDescription(
  timestamp: string,
  summary: string,
  observation: SystemCardObservation | null | undefined,
): string {
  if (!observation) {
    return `Updated ${timestamp}. ${summary} Record whether the observed window was better, as expected, or worse.`;
  }
  const observed = observation.waveHeightFt === null
    ? "the logged session has no wave-height value"
    : `the logged session recorded ${observation.waveHeightFt.toFixed(1)}ft waves`;
  return `Updated ${timestamp}. ${summary}; ${observed} at ${formatTimestamp(observation.observedAt)}.`;
}

function describeForecastFacts(forecast: SystemForecastSnapshot): {
  summary: string;
  wind: string | null;
  water: string | null;
} {
  const values: string[] = [];
  if (forecast.waveHeightFt !== null) values.push(`wave height ${formatNumber(forecast.waveHeightFt)}ft`);
  if (forecast.wavePeriodSeconds !== null) values.push(`period ${formatNumber(forecast.wavePeriodSeconds)}s`);
  if (forecast.windSpeedKnots !== null) {
    const direction = forecast.windDirection ? ` ${forecast.windDirection.toUpperCase()}` : "";
    values.push(`wind ${formatNumber(forecast.windSpeedKnots)}kt${direction}`);
  }
  if (forecast.tideHeightFt !== null) {
    const status = forecast.tideStatus ? `, ${forecast.tideStatus}` : "";
    values.push(`tide ${formatNumber(forecast.tideHeightFt)}ft${status}`);
  }
  if (forecast.waterTempF !== null) values.push(`water ${formatNumber(forecast.waterTempF)}°F`);

  const wind = forecast.windSpeedKnots === null
    ? null
    : `Wind is ${formatNumber(forecast.windSpeedKnots)}kt${forecast.windDirection ? ` ${forecast.windDirection.toUpperCase()}` : ""}.`;
  const water = forecast.waterTempF === null
    ? null
    : `Water temperature is ${formatNumber(forecast.waterTempF)}°F.`;
  return {
    summary: values.join("; ") || "No forecast measurements are available.",
    wind,
    water,
  };
}

function buildSemanticClaim(
  forecast: SystemForecastSnapshot,
  contentClass: SystemCardClass,
  observation?: SystemCardObservation | null,
): string {
  return [
    contentClass,
    forecast.forecastAt,
    forecast.waveHeightFt,
    forecast.wavePeriodSeconds,
    forecast.windSpeedKnots,
    forecast.windDirection,
    forecast.tideHeightFt,
    forecast.tideStatus,
    forecast.waterTempF,
    observation?.observedAt ?? "",
    observation?.waveHeightFt ?? "",
  ].join("|");
}

function hasForecastFact(forecast: SystemForecastSnapshot): boolean {
  return Object.entries(forecast).some(([key, value]) => key !== "forecastAt" && value !== null);
}

function parseTemperature(value: unknown): number | null {
  if (typeof value === "number") return toFiniteNumber(value);
  if (typeof value !== "string") return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? toFiniteNumber(Number(match[0])) : null;
}

function toFiniteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toISOString().replace("T", " ").replace(".000Z", " UTC")
    : value;
}
