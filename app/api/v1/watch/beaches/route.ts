import type { User } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { z } from "zod";
import { bulkForecastHandler } from "@/app/api/forecasts/bulk/route";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { degreesToCompass } from "@/lib/domains/conditions/map-forecast";
import { withNoStore, withRateLimit, validateOrError } from "@/lib/middleware/api-wrappers";
import { getCachedNearbyBeachesFromDb } from "@/lib/services/nearby-beach-service";
import { formatTimeWindowCompact } from "@/lib/utils/date-time";
import { haversineDistance } from "@/lib/utils/geo-utils";
import { retryAfterSeconds } from "@/lib/utils/retry-after";
import { loadWatchSpots, type WatchSpot } from "@/lib/watch/saved-spots";
import { withWatchAuth } from "@/lib/watch/with-watch-auth";

export const runtime = "nodejs";
export const maxDuration = 20;

const QuerySchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90).optional(),
  lon: z.coerce.number().finite().min(-180).max(180).optional(),
}).refine((query) => (query.lat === undefined) === (query.lon === undefined), {
  message: "lat and lon go together",
});

type Position = { lat: number; lon: number };
type Beach = { id: string; name: string; saved: boolean; timezone: string | null; held: boolean };
type DisplayForecast = { label?: string | null; forecastAt?: string | null };
type DisplaySwell = { heightFt?: number | null; periodSeconds?: number | null; directionDeg?: number | null };
type TodayHeadline = { displayWindowStart?: string | null; displayWindowEnd?: string | null };
type BulkData = {
  displayForecasts?: Record<string, DisplayForecast | undefined>;
  conditionLabels?: Record<string, string | null | undefined>;
  displaySwell?: Record<string, DisplaySwell | undefined>;
  todayHeadlines?: Record<string, TodayHeadline | undefined>;
  recommendationHolds?: Record<string, string>;
};
type ForecastRow = {
  beach_id: string;
  forecast_at: string;
  wind_speed: string | null;
  wind_direction_deg: number | string | null;
  tide_height: string | null;
  tide_status: string | null;
};

function short(value: string | null | undefined, limit = 20): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, limit) : null;
}

function measure(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatSwell(swell: DisplaySwell | undefined): string | null {
  if (!swell) return null;
  const height = measure(swell.heightFt);
  const period = measure(swell.periodSeconds);
  const direction = measure(swell.directionDeg);
  return short([
    height !== null && height >= 0 ? `${Math.round(height * 10) / 10}ft` : null,
    period !== null && period > 0 ? `${Math.round(period * 10) / 10}s` : null,
    direction !== null ? degreesToCompass(direction) : null,
  ].filter(Boolean).join(" "));
}

function formatWind(row: ForecastRow | undefined): string | null {
  if (!row) return null;
  const speed = measure(row.wind_speed);
  const direction = measure(row.wind_direction_deg);
  return short([
    speed !== null && speed >= 0 ? `${Math.round(speed)}mph` : null,
    direction !== null ? degreesToCompass(direction) : null,
  ].filter(Boolean).join(" "));
}

function formatTide(row: ForecastRow | undefined): string | null {
  if (!row) return null;
  const height = measure(row.tide_height);
  const status = row.tide_status?.trim().toLowerCase();
  return short([
    height !== null ? `${height.toFixed(1)}ft` : null,
    status === "rising" || status === "falling" ? status : null,
  ].filter(Boolean).join(" "));
}

function formatBest(headline: TodayHeadline | undefined, timezone: string | null): string | null {
  if (!headline?.displayWindowStart || !headline.displayWindowEnd || !timezone) return null;
  const start = new Date(headline.displayWindowStart);
  const end = new Date(headline.displayWindowEnd);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
  try {
    return short(formatTimeWindowCompact(start, end, timezone).replace("–", "-").toUpperCase());
  } catch {
    return null;
  }
}

function unavailable(): Response {
  const response = createErrorResponse("unavailable", undefined, 503);
  response.headers.set("Retry-After", String(retryAfterSeconds()));
  return response;
}

export const GET = withNoStore(withRateLimit(withWatchAuth(async (request, { userId, service }) => {
  const { searchParams } = new URL(request.url);
  const validation = validateOrError(QuerySchema, {
    lat: searchParams.get("lat") || undefined,
    lon: searchParams.get("lon") || undefined,
  });
  if ("error" in validation) return validation.error;

  let position: Position | null = validation.data.lat === undefined ? null : {
    lat: validation.data.lat,
    lon: validation.data.lon!,
  };
  if (!position) {
    const { data: snapshot, error } = await service.from("user_location_snapshots")
      .select("lat, lon").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (snapshot && Number.isFinite(snapshot.lat) && Number.isFinite(snapshot.lon)) {
      position = { lat: snapshot.lat, lon: snapshot.lon };
    }
  }

  const saved = (await loadWatchSpots(service, userId))
    .filter((spot) => spot.kind === "beach");
  if (position) {
    const origin = position;
    saved.sort((a, b) =>
      haversineDistance(origin.lat, origin.lon, a.lat, a.lon)
      - haversineDistance(origin.lat, origin.lon, b.lat, b.lon));
  }
  const savedBeaches = saved.slice(0, 5);
  const selected = new Map<string, Beach>(savedBeaches.map((spot: WatchSpot) => [spot.id, {
    id: spot.id, name: spot.name, saved: true, timezone: null, held: false,
  }]));

  if (position) {
    const nearby = await getCachedNearbyBeachesFromDb(position.lat, position.lon, 50, 20);
    if (!nearby.success) throw new Error(nearby.error || "Nearby beach query failed");
    for (const beach of nearby.data ?? []) {
      if (selected.size >= 12) break;
      if (!beach.id || selected.has(beach.id)) continue;
      selected.set(beach.id, {
        id: beach.id, name: beach.name, saved: false, timezone: beach.timezone,
        held: beach.waterQualityHold != null,
      });
    }
  }

  const beaches = [...selected.values()];
  if (beaches.length === 0) return createSuccessResponse({ beaches: [], updatedAt: new Date().toISOString() });

  const ids = beaches.map((beach) => beach.id);
  const { data: timezoneRows, error: timezoneError } = await service.from("beaches")
    .select("id, timezone").in("id", ids);
  if (timezoneError) throw timezoneError;
  const timezoneById = new Map((timezoneRows ?? []).map((row) => [row.id, row.timezone]));

  const forecastUrl = new URL("/api/forecasts/bulk", request.url);
  forecastUrl.searchParams.set("beachIds", ids.join(","));
  const forecastRequest = new NextRequest(forecastUrl, {
    headers: request.headers,
    signal: request.signal,
  });
  // Bulk reads only user.id; the watch token has already established that identity.
  let forecast: BulkData;
  try {
    const forecastResponse = await bulkForecastHandler(forecastRequest, {
      params: {}, user: { id: userId } as User, supabase: service,
    });
    if (!forecastResponse.ok) return unavailable();
    const body = await forecastResponse.json();
    if (!body?.success || !body.data || typeof body.data !== "object") return unavailable();
    forecast = body.data as BulkData;
  } catch {
    return unavailable();
  }

  const timestamps = [...new Set(beaches.flatMap((beach) => {
    const timestamp = forecast.displayForecasts?.[beach.id]?.forecastAt;
    return timestamp && Number.isFinite(Date.parse(timestamp)) ? [timestamp] : [];
  }))];
  const rowsByKey = new Map<string, ForecastRow>();
  if (timestamps.length > 0) {
    const { data: rows, error } = await service.from("enhanced_forecasts")
      .select("beach_id, forecast_at, wind_speed, wind_direction_deg, tide_height, tide_status")
      .in("beach_id", ids).in("forecast_at", timestamps);
    if (error) throw error;
    // PostgREST and the bulk display may serialize the same instant differently.
    for (const row of rows ?? []) rowsByKey.set(`${row.beach_id}:${Date.parse(row.forecast_at)}`, row);
  }

  return createSuccessResponse({
    beaches: beaches.map((beach) => {
      const display = forecast.displayForecasts?.[beach.id];
      const timestamp = display?.forecastAt;
      const row = timestamp ? rowsByKey.get(`${beach.id}:${Date.parse(timestamp)}`) : undefined;
      const tideHeight = measure(row?.tide_height);
      const tideStatus = row?.tide_status?.trim().toLowerCase();
      const windSpeed = measure(row?.wind_speed);
      const windDirection = measure(row?.wind_direction_deg);
      const label = beach.held || forecast.recommendationHolds?.[beach.id]
        ? null : forecast.conditionLabels?.[beach.id];
      return {
        name: short(beach.name, 40) ?? "Beach",
        saved: beach.saved,
        label: display ? label === "EPIC" ? "GOOD" :
          label === "GOOD" || label === "FAIR" || label === "MEH" ? label : null : null,
        height: display ? short(display.label) : null,
        swell: display ? formatSwell(forecast.displaySwell?.[beach.id]) : null,
        wind: formatWind(row),
        tide: formatTide(row),
        tideFt: tideHeight === null ? null : Math.round(tideHeight * 10) / 10,
        tideDir: tideStatus === "rising" || tideStatus === "falling" ? tideStatus : null,
        windMph: windSpeed !== null && windSpeed >= 0 ? Math.round(windSpeed) : null,
        windDeg: windDirection === null ? null : ((Math.round(windDirection) % 360) + 360) % 360,
        best: display ? formatBest(forecast.todayHeadlines?.[beach.id], timezoneById.get(beach.id) ?? beach.timezone) : null,
      };
    }),
    updatedAt: new Date().toISOString(),
  });
}, { errorMessage: "Failed to load watch beaches" }), "authenticated-default"));
