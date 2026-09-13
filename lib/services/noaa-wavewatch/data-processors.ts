/**
 * Data processors for NOAA and Open-Meteo wave forecasts
 *
 * Transforms raw API responses into standardized wave forecast data.
 *
 * @module noaa-wavewatch/data-processors
 */

import { createContextLogger } from "@/lib/logger";
import { FORECAST_CONFIG } from "./constants";
import {
  getPrevailingWaveDirection,
  getSampleAtTime,
  getTimestampForForecastSlot,
  getValueAtTime,
} from "./wave-analysis";
import type {
  NOAAGridData,
  OpenMeteoMarineResponse,
  OpenMeteoSlotValues,
  SwellFieldSource,
  SwellTupleSources,
  WaveWatchData,
} from "./types";

const log = createContextLogger("NOAAWaveWatch:DataProcessors");
const OM_PARTITION_SCHEMA_VERSION = 1;

function fieldSource(field: string | null, kind: SwellFieldSource["kind"] = "provider_field"): SwellFieldSource {
  return { field, kind: field === null ? "missing" : kind };
}

export interface ProcessNOAAGridDataOptions {
  baseTime?: Date;
}

/** Return a finite number or null — guards against undefined/NaN in OM payloads. */
export function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function openMeteoTimeToDate(value: unknown): Date | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return new Date(value * 1000);
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const numericValue = Number(trimmed);
  const isoValue =
    Number.isFinite(numericValue)
      ? null
      : /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed)
        ? trimmed
        : `${trimmed}Z`;
  const date = isoValue === null
    ? new Date(numericValue * 1000)
    : new Date(isoValue);

  return Number.isNaN(date.getTime()) ? null : date;
}

function allMissing(values: Array<number | null>): boolean {
  return values.every((value) => value === null);
}

function completeTuple(
  heightM: number | null | undefined,
  periodS: number | null | undefined,
  directionDeg: number | null | undefined
): heightM is number {
  return (
    heightM !== null &&
    heightM !== undefined &&
    periodS !== null &&
    periodS !== undefined &&
    directionDeg !== null &&
    directionDeg !== undefined
  );
}

/**
 * Process NOAA NWS grid data into wave forecasts
 *
 * Extracts and transforms NOAA grid forecast data into standardized wave forecast format.
 *
 * @param gridData - NOAA grid data response
 * @param days - Number of forecast days
 * @param latitude - Latitude of forecast location
 * @param longitude - Longitude of forecast location
 * @param options - Optional processing controls for deterministic tests
 * @returns Array of processed wave forecast data
 */
export function processNOAAGridData(
  gridData: NOAAGridData,
  days: number,
  latitude: number,
  longitude: number,
  options: ProcessNOAAGridDataOptions = {}
): WaveWatchData[] {
  const forecasts: WaveWatchData[] = [];
  const props = gridData.properties;

  const waveHeightCount = props.waveHeight?.values.length ?? 0;
  const wavePeriodCount = props.wavePeriod?.values.length ?? 0;
  const waveDirectionCount = props.waveDirection?.values.length ?? 0;

  if (waveHeightCount < Math.max(wavePeriodCount, waveDirectionCount)) {
    log.info(
      `NOAA interval count mismatch: waveHeight=${waveHeightCount}, wavePeriod=${wavePeriodCount}, waveDirection=${waveDirectionCount} — sampling by validTime coverage`
    );
  }

  const maxForecasts = days * FORECAST_CONFIG.FORECASTS_PER_DAY;
  const baseTime = options.baseTime ?? new Date();

  log.debug(`Processing ${maxForecasts} NOAA grid forecasts`);

  for (let i = 0; i < maxForecasts; i++) {
    const timestamp = getTimestampForForecastSlot(i, baseTime);
    const targetMs = Date.parse(timestamp);

    // Extract wave height (convert from feet to meters if needed)
    const waveHeight = getValueAtTime(props.waveHeight, targetMs);
    if (waveHeight === null) {
      continue;
    }
    const significantWaveHeight =
      props.waveHeight?.uom === "wmoUnit:ft" ? waveHeight * 0.3048 : waveHeight;

    // Extract wave period
    const wavePeriod = getValueAtTime(props.wavePeriod, targetMs);
    const peakWavePeriod =
      wavePeriod ?? Math.max(4, 6 + significantWaveHeight * 1.5);

    // Extract wave direction
    const waveDirection = getValueAtTime(props.waveDirection, targetMs);
    const peakWaveDirection =
      waveDirection ?? getPrevailingWaveDirection(latitude, longitude);

    // Extract swell data — prefer the real primary partition when NOAA
    // provides it (NWS gridpoints that resolve over the ocean include
    // `primarySwellHeight` / `primarySwellDirection`). Fall back to the
    // generic `swellHeight` / `swellDirection` / `swellPeriod` fields for
    // coastal-land grids that don't carry partitioned values.
    const primarySwellHeight = getValueAtTime(
      props.primarySwellHeight,
      targetMs
    );
    const primarySwellDirection = getValueAtTime(
      props.primarySwellDirection,
      targetMs
    );
    const swellHeight = getValueAtTime(props.swellHeight, targetMs);
    const swellPeriod = getValueAtTime(props.swellPeriod, targetMs);
    const swellDirection = getValueAtTime(props.swellDirection, targetMs);

    // Secondary partition raw values — NOAA returns 0 (not null) for absent
    // partitions in some cases; we normalize to `0` sentinel so downstream
    // `swell_2_height > 0 && swell_2_period > 0` guards treat them as
    // "no second swell train."
    const secondarySwellHeightRaw = getValueAtTime(
      props.secondarySwellHeight,
      targetMs
    );
    const secondarySwellDirectionRaw = getValueAtTime(
      props.secondarySwellDirection,
      targetMs
    );
    const wavePeriod2Raw = getValueAtTime(props.wavePeriod2, targetMs);
    const hasSecondary =
      secondarySwellHeightRaw !== null && secondarySwellHeightRaw > 0;

    // NOAA-primary partition (ranked by NOAA's height-based ordering).
    // Fall back to generic swell fields for coastal-land grids.
    const noaaPrimaryHeight =
      primarySwellHeight ?? swellHeight ?? significantWaveHeight * 0.7;
    // Primary-partition period: wavePeriod IS the peak period, which for the
    // primary partition equals the primary swell period. No separate
    // `primarySwellPeriod` field exists in NOAA gridpoints. When NOAA omits
    // both `swellPeriod` AND `wavePeriod` (common on SD-area gridpoints), the
    // partition period is genuinely unknown — emit null and let downstream
    // 0-sentinel logic null out display rather than fabricating a value.
    const noaaPrimaryPeriod: number | null =
      swellPeriod ?? wavePeriod ?? null;
    const noaaPrimaryDirection =
      primarySwellDirection ?? swellDirection ?? peakWaveDirection;

    const noaaSecondaryHeight = hasSecondary ? secondarySwellHeightRaw : 0;
    const noaaSecondaryPeriod =
      hasSecondary && wavePeriod2Raw !== null && wavePeriod2Raw > 0
        ? wavePeriod2Raw
        : 0;
    const noaaSecondaryDirection =
      hasSecondary && secondarySwellDirectionRaw !== null
        ? secondarySwellDirectionRaw
        : 0;

    const primarySources: SwellTupleSources = {
      height: primarySwellHeight !== null
        ? fieldSource("primarySwellHeight")
        : swellHeight !== null ? fieldSource("swellHeight") : fieldSource("waveHeight", "derived"),
      period: fieldSource(swellPeriod !== null ? "swellPeriod" : wavePeriod !== null ? "wavePeriod" : null),
      direction: primarySwellDirection !== null
        ? fieldSource("primarySwellDirection")
        : swellDirection !== null ? fieldSource("swellDirection")
          : waveDirection !== null ? fieldSource("waveDirection") : fieldSource("prevailing_direction", "derived"),
    };
    const secondarySources: SwellTupleSources = {
      height: fieldSource(hasSecondary ? "secondarySwellHeight" : null),
      period: fieldSource(hasSecondary && wavePeriod2Raw !== null && wavePeriod2Raw > 0 ? "wavePeriod2" : null),
      direction: fieldSource(hasSecondary && secondarySwellDirectionRaw !== null ? "secondarySwellDirection" : null),
    };

    for (const source of [...Object.values(primarySources), ...Object.values(secondarySources)]) {
      if (source.field === null || !Object.hasOwn(props, source.field)) continue;
      const sample = getSampleAtTime(props[source.field as keyof typeof props], targetMs);
      if (sample) source.sample = sample;
    }

    // Re-rank by period descending. NOAA ranks partitions by HEIGHT, so on
    // mixed-swell days the short-period wind-sea can land in the "primary"
    // slot while the real long-period groundswell lands in "secondary."
    // Downstream UI treats swell_1 as "the one that matters most," which for
    // surfers is the longer period (more organized, more energy in the face).
    // When tied, preserve NOAA order. Missing period (null/0) loses — any
    // real period sorts ahead. Height + direction + period travel as a unit.
    // Explicitly handle null primary: a real secondary period must always
    // beat a null primary, regardless of JS's coercion-based comparisons.
    const primaryPeriodMissing =
      noaaPrimaryPeriod === null || noaaPrimaryPeriod <= 0;
    const shouldSwap =
      hasSecondary &&
      noaaSecondaryPeriod > 0 &&
      (primaryPeriodMissing || noaaSecondaryPeriod > noaaPrimaryPeriod);

    const swell1Height = shouldSwap ? noaaSecondaryHeight : noaaPrimaryHeight;
    const swell1PeriodRaw = shouldSwap ? noaaSecondaryPeriod : noaaPrimaryPeriod;
    const swell1Direction = shouldSwap
      ? noaaSecondaryDirection
      : noaaPrimaryDirection;
    const swell2Height = shouldSwap ? noaaPrimaryHeight : noaaSecondaryHeight;
    const swell2PeriodRaw = shouldSwap ? noaaPrimaryPeriod : noaaSecondaryPeriod;
    const swell2Direction = shouldSwap
      ? noaaPrimaryDirection
      : noaaSecondaryDirection;

    // Coerce nullable periods to the 0 sentinel that the rest of the pipeline
    // already understands as "no real period." Avoids NaN from `Math.round(null)`
    // and lets `formatPeriodSeconds` reject 0 (<4s threshold) at display time.
    const swell1Period = swell1PeriodRaw ?? 0;
    const swell2Period = swell2PeriodRaw ?? 0;

    // Generate wind wave component.
    // `windWaveHeight = significantWaveHeight * 0.5` is a height heuristic from
    // a real Hs value — kept as-is. For period: NOAA gridpoints don't expose a
    // dedicated wind-wave-period field, so we apply `× 0.7` to the RAW
    // `wavePeriod` (peak period). We deliberately avoid `peakWavePeriod` here
    // because `peakWavePeriod` itself is synthesized at line 87 when
    // `wavePeriod` is null (`Math.max(4, 6 + significantWaveHeight * 1.5)`),
    // and synthesizing-from-synthesis layers fabrication on fabrication. When
    // raw `wavePeriod` is null we emit null and let the 0-sentinel coerce at
    // the write boundary do its job (formatPeriodSeconds rejects <4s).
    const windWaveHeight = significantWaveHeight * 0.5;
    const windWavePeriod: number | null =
      wavePeriod !== null ? wavePeriod * 0.7 : null;
    const windWaveDirection = peakWaveDirection;

    forecasts.push({
      timestamp: timestamp,
      significant_wave_height: Math.round(significantWaveHeight * 100) / 100,
      peak_wave_period: Math.round(peakWavePeriod * 10) / 10,
      peak_wave_direction: Math.round(peakWaveDirection),
      swell_1_height: Math.round(swell1Height * 100) / 100,
      swell_1_period: Math.round(swell1Period * 10) / 10,
      swell_1_direction: Math.round(swell1Direction),
      swell_2_height: Math.round(swell2Height * 100) / 100,
      swell_2_period: Math.round(swell2Period * 10) / 10,
      swell_2_direction: Math.round(swell2Direction),
      wind_wave_height: Math.round(windWaveHeight * 100) / 100,
      // Coerce null → 0 sentinel at the write boundary, mirroring swell_1 /
      // swell_2 period handling above. Downstream `formatPeriodSeconds` rejects
      // 0 (<4s threshold) so the display gate renders null cleanly.
      wind_wave_period:
        windWavePeriod !== null ? Math.round(windWavePeriod * 10) / 10 : 0,
      wind_wave_direction: Math.round(windWaveDirection),
      data_source: "NOAA_NWS" as const,
      swell_field_sources: {
        provider: "noaa",
        immutableRunId: null,
        s1: shouldSwap ? secondarySources : primarySources,
        s2: shouldSwap ? primarySources : secondarySources,
      },
    });
  }

  log.debug(`Processed ${forecasts.length} NOAA NWS wave forecasts`);
  return forecasts;
}

/**
 * Process Open-Meteo marine forecast data into wave forecasts
 *
 * Transforms Open-Meteo API response into standardized wave forecast format.
 *
 * @param data - Open-Meteo marine API response
 * @param days - Number of forecast days
 * @returns Array of processed wave forecast data
 */
export function processOpenMeteoData(
  data: OpenMeteoMarineResponse,
  days: number
): WaveWatchData[] {
  const forecasts: WaveWatchData[] = [];

  if (!data.hourly || !data.hourly.time) {
    log.debug("Open-Meteo data missing hourly forecasts");
    return forecasts;
  }

  // Open-Meteo returns hourly data but our forecast grid is every 3 hours.
  // Step through in 3-hour increments to cover the full 7-day range instead
  // of exhausting maxForecasts after ~2 days of hourly entries.
  const HOURS_PER_STEP = FORECAST_CONFIG.FORECAST_INTERVAL_HOURS; // 3
  const maxForecasts = Math.min(
    days * FORECAST_CONFIG.FORECASTS_PER_DAY,
    Math.floor(data.hourly.time.length / HOURS_PER_STEP)
  );

  log.debug(`Processing ${maxForecasts} Open-Meteo forecasts (stepping every ${HOURS_PER_STEP}h over ${data.hourly.time.length} hourly entries)`);

  for (let step = 0; step < maxForecasts; step++) {
    const i = step * HOURS_PER_STEP;
    const openMeteoTime = data.hourly.time[i];
    const timestamp = openMeteoTimeToDate(openMeteoTime);
    if (!timestamp) continue;

    // Extract wave data (already in meters from Open-Meteo)
    const significantWaveHeight = data.hourly.wave_height?.[i] ?? 0.8;
    const peakWavePeriod = data.hourly.wave_period?.[i] ?? 8;
    const peakWaveDirection = data.hourly.wave_direction?.[i] ?? 225; // SW default for CA

    // Extract swell data
    const swell1Height =
      data.hourly.swell_wave_height?.[i] ?? significantWaveHeight * 0.7;
    const swell1Period = data.hourly.swell_wave_period?.[i] ?? peakWavePeriod;
    const swell1Direction =
      data.hourly.swell_wave_direction?.[i] ?? peakWaveDirection;

    // Extract wind wave data (if available)
    const windWaveHeight =
      data.hourly.wind_wave_height?.[i] ?? significantWaveHeight * 0.3;
    const windWavePeriod =
      data.hourly.wind_wave_period?.[i] ?? Math.max(4, peakWavePeriod * 0.6);
    const windWaveDirection =
      data.hourly.wind_wave_direction?.[i] ?? peakWaveDirection;

    // Capture RAW Open-Meteo values (no synthesized defaults) so they can
    // be co-located on the enhanced_forecasts row regardless of which source
    // wins the merge downstream. A value is only recorded when Open-Meteo
    // actually returned it for this index — otherwise the column stays NULL.
    const rawOm: OpenMeteoSlotValues = {
      wave_height_om: numberOrNull(data.hourly.wave_height?.[i]),
      wave_period_om: numberOrNull(data.hourly.wave_period?.[i]),
      wave_direction_om: numberOrNull(data.hourly.wave_direction?.[i]),
      wave_peak_period_om: numberOrNull(data.hourly.wave_peak_period?.[i]),
      swell_height_om: numberOrNull(data.hourly.swell_wave_height?.[i]),
      swell_period_om: numberOrNull(data.hourly.swell_wave_period?.[i]),
      swell_direction_om: numberOrNull(data.hourly.swell_wave_direction?.[i]),
      swell_wave_peak_period_om: numberOrNull(
        data.hourly.swell_wave_peak_period?.[i]
      ),
      wind_wave_height_om: numberOrNull(data.hourly.wind_wave_height?.[i]),
      wind_wave_period_om: numberOrNull(data.hourly.wind_wave_period?.[i]),
      wind_wave_direction_om: numberOrNull(
        data.hourly.wind_wave_direction?.[i]
      ),
      wind_wave_peak_period_om: numberOrNull(
        data.hourly.wind_wave_peak_period?.[i]
      ),
      secondary_swell_height_om: numberOrNull(
        data.hourly.secondary_swell_wave_height?.[i]
      ),
      secondary_swell_period_om: numberOrNull(
        data.hourly.secondary_swell_wave_period?.[i]
      ),
      secondary_swell_direction_om: numberOrNull(
        data.hourly.secondary_swell_wave_direction?.[i]
      ),
      tertiary_swell_height_om: numberOrNull(
        data.hourly.tertiary_swell_wave_height?.[i]
      ),
      tertiary_swell_period_om: numberOrNull(
        data.hourly.tertiary_swell_wave_period?.[i]
      ),
      tertiary_swell_direction_om: numberOrNull(
        data.hourly.tertiary_swell_wave_direction?.[i]
      ),
      om_partition_schema_version: OM_PARTITION_SCHEMA_VERSION,
    };
    rawOm.om_wind_wave_missing = allMissing([
      rawOm.wind_wave_height_om,
      rawOm.wind_wave_period_om ?? null,
      rawOm.wind_wave_direction_om ?? null,
      rawOm.wind_wave_peak_period_om ?? null,
    ]);
    rawOm.om_primary_swell_missing = allMissing([
      rawOm.swell_height_om,
      rawOm.swell_period_om,
      rawOm.swell_direction_om,
      rawOm.swell_wave_peak_period_om ?? null,
    ]);
    rawOm.om_secondary_swell_missing = allMissing([
      rawOm.secondary_swell_height_om ?? null,
      rawOm.secondary_swell_period_om ?? null,
      rawOm.secondary_swell_direction_om ?? null,
    ]);
    rawOm.om_secondary_swell_complete = completeTuple(
      rawOm.secondary_swell_height_om,
      rawOm.secondary_swell_period_om,
      rawOm.secondary_swell_direction_om
    );
    rawOm.om_tertiary_swell_missing = allMissing([
      rawOm.tertiary_swell_height_om ?? null,
      rawOm.tertiary_swell_period_om ?? null,
      rawOm.tertiary_swell_direction_om ?? null,
    ]);

    const forecast: WaveWatchData = {
      timestamp: timestamp.toISOString(),
      significant_wave_height: significantWaveHeight,
      peak_wave_period: peakWavePeriod,
      peak_wave_direction: peakWaveDirection,
      swell_1_height: swell1Height,
      swell_1_period: swell1Period,
      swell_1_direction: swell1Direction,
      // A complete Open-Meteo secondary partition is canonical data. Keep an
      // absent or partial tuple null so consumers cannot mistake missingness
      // for a physical zero-valued partition.
      swell_2_height: rawOm.om_secondary_swell_complete
        ? rawOm.secondary_swell_height_om ?? null
        : null,
      swell_2_period: rawOm.om_secondary_swell_complete
        ? rawOm.secondary_swell_period_om ?? null
        : null,
      swell_2_direction: rawOm.om_secondary_swell_complete
        ? rawOm.secondary_swell_direction_om ?? null
        : null,
      wind_wave_height: windWaveHeight,
      wind_wave_period: windWavePeriod,
      wind_wave_direction: windWaveDirection,
      data_source: "OPEN_METEO" as const,
      om_values: rawOm,
      swell_field_sources: {
        provider: "open_meteo",
        immutableRunId: null,
        s1: {
          height: data.hourly.swell_wave_height?.[i] != null
            ? fieldSource("swell_wave_height") : data.hourly.wave_height?.[i] != null
              ? fieldSource("wave_height", "derived") : fieldSource("default_height", "derived"),
          period: data.hourly.swell_wave_period?.[i] != null
            ? fieldSource("swell_wave_period") : data.hourly.wave_period?.[i] != null
              ? fieldSource("wave_period") : fieldSource("default_period", "derived"),
          direction: data.hourly.swell_wave_direction?.[i] != null
            ? fieldSource("swell_wave_direction") : data.hourly.wave_direction?.[i] != null
              ? fieldSource("wave_direction") : fieldSource("default_direction", "derived"),
        },
        s2: {
          height: fieldSource(rawOm.om_secondary_swell_complete ? "secondary_swell_wave_height" : null),
          period: fieldSource(rawOm.om_secondary_swell_complete ? "secondary_swell_wave_period" : null),
          direction: fieldSource(rawOm.om_secondary_swell_complete ? "secondary_swell_wave_direction" : null),
        },
      },
    };

    const sources = forecast.swell_field_sources!;
    for (const source of [...Object.values(sources.s1), ...Object.values(sources.s2)]) {
      if (source.field === null || !Object.hasOwn(data.hourly, source.field)) continue;
      const value = data.hourly[source.field as keyof typeof data.hourly]?.[i];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      source.sample = {
        value,
        validTime: openMeteoTime,
        unit: typeof data.hourly_units?.[source.field] === "string" ? data.hourly_units[source.field] : null,
        timezone: typeof data.timezone === "string" ? data.timezone : null,
        utcOffsetSeconds: typeof data.utc_offset_seconds === "number" && Number.isFinite(data.utc_offset_seconds)
          ? data.utc_offset_seconds : null,
      };
    }
    forecasts.push(forecast);
  }

  log.debug(`Processed ${forecasts.length} Open-Meteo wave forecasts`);
  return forecasts;
}
