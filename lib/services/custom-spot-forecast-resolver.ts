import type { EnhancedForecastEntity } from "@/types/forecast";
import { fetchPointMarineForecast } from "./point-marine-forecast/service";
import type { CustomSpotAtmosphericForecast } from "./custom-spot-atmospheric-forecast";
import { pointMarineForecastToEnhancedRows } from "./point-marine-forecast/enhanced-rows";
import type { PointMarineForecastResponseV1 } from "./point-marine-forecast/types";

export const CUSTOM_SPOT_POINT_DISTANCE_THRESHOLD_MI = 25;

export type CustomSpotResolvedSourceKind =
  | "curated"
  | "gfs_wave_point"
  | "atmospheric_only"
  | "unavailable";

export interface CustomSpotResolvedSource {
  kind: CustomSpotResolvedSourceKind;
  label: string;
  honestyLine: string;
  fetchedAt: string | null;
  stale: boolean;
  sampleResolution: "exact" | "offshore_shifted" | null;
  sampledPoint: { lat: number; lon: number } | null;
}

export interface ResolvedCustomSpotForecast {
  kind: CustomSpotResolvedSourceKind;
  rows: EnhancedForecastEntity[];
  current: EnhancedForecastEntity | null;
  source: CustomSpotResolvedSource;
}

export interface ResolveCustomSpotForecastSourceInput {
  spotName: string;
  lat: number;
  lon: number;
  nearestBeachName?: string | null;
  nearestBeachDistanceMi?: number | null;
  curatedRows?: EnhancedForecastEntity[] | null;
  pointForecast?: PointMarineForecastResponseV1 | null;
  atmosphericForecast?: CustomSpotAtmosphericForecast | null;
  now?: Date;
}

function hasUsableSwell(row: EnhancedForecastEntity | null): boolean {
  if (!row) return false;
  return hasPositiveNumericValue(row.swell_1_height)
    && hasPositiveNumericValue(row.swell_1_period)
    && hasTextValue(row.swell_1_direction);
}

function hasTextValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasPositiveNumericValue(value: string | number | null | undefined): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value !== "string" || value.trim().length === 0) return false;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match != null && Number(match[0]) > 0;
}

function selectCurrentForecastRow(
  rows: EnhancedForecastEntity[],
  now: Date,
): EnhancedForecastEntity | null {
  const sorted = rows
    .map((row) => ({ row, timestamp: Date.parse(row.forecast_at) }))
    .filter(({ timestamp }) => Number.isFinite(timestamp))
    .sort((left, right) => left.timestamp - right.timestamp);
  if (sorted.length === 0) return null;

  const nowMs = now.getTime();
  const latestPast = sorted.filter(({ timestamp }) => timestamp <= nowMs).pop();
  return latestPast?.row ?? sorted[0].row;
}

function hasAtmosphericData(
  forecast: CustomSpotAtmosphericForecast | null | undefined,
): forecast is CustomSpotAtmosphericForecast {
  if (!forecast) return false;
  const hasWind = hasTextValue(forecast.windSpeed)
    && (hasTextValue(forecast.windDirection) || Number.isFinite(forecast.windDirectionDeg));
  const hasWeather = Number.isFinite(forecast.temperatureF) || hasTextValue(forecast.summary);
  return hasWind || hasWeather;
}

function atmosphericHonestyLine(forecast: CustomSpotAtmosphericForecast): string {
  const hasWind = hasTextValue(forecast.windSpeed)
    && (hasTextValue(forecast.windDirection) || Number.isFinite(forecast.windDirectionDeg));
  const hasWeather = Number.isFinite(forecast.temperatureF) || hasTextValue(forecast.summary);

  if (hasWind && hasWeather) {
    return "NOAA weather and wind are available; complete marine swell data is unavailable.";
  }
  if (hasWind) {
    return "NOAA wind is available; weather and complete marine swell data are unavailable.";
  }
  return "NOAA weather is available; wind and complete marine swell data are unavailable.";
}

function mergeAtmospheric(
  row: EnhancedForecastEntity,
  atmospheric: CustomSpotAtmosphericForecast | null | undefined,
): EnhancedForecastEntity {
  if (!atmospheric) return row;
  return {
    ...row,
    wind_speed: atmospheric.windSpeed ?? row.wind_speed,
    wind_direction: atmospheric.windDirection ?? row.wind_direction,
    wind_direction_deg: atmospheric.windDirectionDeg ?? row.wind_direction_deg,
    air_temperature: atmospheric.temperatureF != null
      ? `${atmospheric.temperatureF}F`
      : row.air_temperature,
    weather_condition: atmospheric.summary ?? row.weather_condition,
  };
}

function atmosphericToEnhancedRow(
  atmospheric: CustomSpotAtmosphericForecast,
  beachId: string,
): EnhancedForecastEntity {
  const forecastAt = atmospheric.forecastAt ?? atmospheric.fetchedAt;
  return {
    id: `atmospheric-${beachId}`,
    created_at: atmospheric.fetchedAt,
    updated_at: atmospheric.fetchedAt,
    beach_id: beachId,
    forecast_at: forecastAt,
    forecast_date: forecastAt.slice(0, 10),
    forecast_time: forecastAt.slice(11, 19),
    wave_height: null,
    wave_period: null,
    wave_direction: null,
    swell_1_height: null,
    swell_1_period: null,
    swell_1_direction: null,
    swell_2_height: null,
    swell_2_period: null,
    swell_2_direction: null,
    wind_wave_height: null,
    wind_wave_period: null,
    wind_wave_direction: null,
    wind_speed: atmospheric.windSpeed,
    wind_direction: atmospheric.windDirection,
    wind_direction_deg: atmospheric.windDirectionDeg,
    air_temperature: atmospheric.temperatureF != null
      ? `${atmospheric.temperatureF}F`
      : null,
    weather_condition: atmospheric.summary,
    water_temp: null,
    tide_status: null,
    tide_height: null,
    next_tide_time: null,
    next_tide_type: null,
    next_tide_height: null,
    next_tide_at: null,
    coops_station_id: null,
    confidence_score: null,
    data_source: "NOAA_NWS",
  };
}

export function resolveCustomSpotForecastSource(
  input: ResolveCustomSpotForecastSourceInput,
): ResolvedCustomSpotForecast {
  const curatedRows = input.curatedRows ?? [];
  const now = input.now ?? new Date();
  const curatedCurrent = selectCurrentForecastRow(curatedRows, now);
  const distance = input.nearestBeachDistanceMi;
  const canUseCurated = distance != null
    && distance <= CUSTOM_SPOT_POINT_DISTANCE_THRESHOLD_MI
    && hasUsableSwell(curatedCurrent);

  if (canUseCurated && curatedCurrent) {
    return {
      kind: "curated",
      rows: curatedRows,
      current: curatedCurrent,
      source: {
        kind: "curated",
        label: "Nearest curated forecast",
        honestyLine: `Using ${input.nearestBeachName ?? "nearby spot"} forecast data from ${distance.toFixed(1)} mi away.`,
        fetchedAt: curatedCurrent.updated_at ?? null,
        stale: false,
        sampleResolution: null,
        sampledPoint: null,
      },
    };
  }

  if (input.pointForecast?.rows.length) {
    const pointRows = pointMarineForecastToEnhancedRows(
      input.pointForecast,
      `custom-${input.lat}-${input.lon}`,
    );
    const pointCurrent = selectCurrentForecastRow(pointRows, now);
    if (pointCurrent && hasUsableSwell(pointCurrent)) {
      const rows = pointRows.map((row) => row.forecast_at === pointCurrent.forecast_at
        ? mergeAtmospheric(row, input.atmosphericForecast)
        : row);
      const current = selectCurrentForecastRow(rows, now) ?? pointCurrent;
      const sampledCopy = input.pointForecast.sampleResolution === "exact"
        ? "at the custom spot"
        : "at a nearby offshore model cell";
      return {
        kind: "gfs_wave_point",
        rows,
        current,
        source: {
          kind: "gfs_wave_point",
          label: "GFS-Wave point forecast",
          honestyLine: `Marine model sampled ${sampledCopy}. NWS weather and wind are retained when available.`,
          fetchedAt: input.pointForecast.fetchedAt,
          stale: input.pointForecast.stale,
          sampleResolution: input.pointForecast.sampleResolution,
          sampledPoint: input.pointForecast.sampledPoint,
        },
      };
    }
  }

  if (hasAtmosphericData(input.atmosphericForecast)) {
    const row = atmosphericToEnhancedRow(
      input.atmosphericForecast,
      `custom-${input.lat}-${input.lon}`,
    );
    return {
      kind: "atmospheric_only",
      rows: [row],
      current: row,
      source: {
        kind: "atmospheric_only",
        label: "NOAA weather and wind",
        honestyLine: atmosphericHonestyLine(input.atmosphericForecast),
        fetchedAt: input.atmosphericForecast.fetchedAt,
        stale: false,
        sampleResolution: null,
        sampledPoint: null,
      },
    };
  }

  return {
    kind: "unavailable",
    rows: [],
    current: null,
    source: {
      kind: "unavailable",
      label: "Forecast unavailable",
      honestyLine: `No complete marine forecast is available for ${input.spotName}.`,
      fetchedAt: null,
      stale: false,
      sampleResolution: null,
      sampledPoint: null,
    },
  };
}

export async function resolveCustomSpotForecast(input: {
  spotName: string;
  lat: number;
  lon: number;
  nearestBeachName?: string | null;
  nearestBeachDistanceMi?: number | null;
  loadCuratedForecasts: () => Promise<EnhancedForecastEntity[]>;
  loadPointForecast: () => Promise<PointMarineForecastResponseV1>;
  loadAtmosphericForecast: () => Promise<CustomSpotAtmosphericForecast>;
  now?: Date;
}): Promise<ResolvedCustomSpotForecast> {
  const now = input.now ?? new Date();
  const shouldLoadCurated = input.nearestBeachDistanceMi != null
    && input.nearestBeachDistanceMi <= CUSTOM_SPOT_POINT_DISTANCE_THRESHOLD_MI;
  const curatedRows = shouldLoadCurated
    ? await input.loadCuratedForecasts()
    : [];
  const curatedResolution = resolveCustomSpotForecastSource({
    ...input,
    curatedRows,
    now,
  });
  if (curatedResolution.kind === "curated") return curatedResolution;

  let pointForecast: PointMarineForecastResponseV1 | null = null;
  try {
    pointForecast = await input.loadPointForecast();
  } catch {
    pointForecast = null;
  }

  let atmosphericForecast: CustomSpotAtmosphericForecast | null = null;
  try {
    atmosphericForecast = await input.loadAtmosphericForecast();
  } catch {
    atmosphericForecast = null;
  }

  return resolveCustomSpotForecastSource({
    ...input,
    curatedRows,
    pointForecast,
    atmosphericForecast,
    now,
  });
}
