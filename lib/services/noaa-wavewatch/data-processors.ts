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
  getBaseWaveHeight,
  getPrevailingWaveDirection,
  getTimestampForIndex,
  getValueAtIndex,
} from "./wave-analysis";
import type {
  NOAAGridData,
  OpenMeteoMarineResponse,
  OpenMeteoSlotValues,
  WaveWatchData,
} from "./types";

const log = createContextLogger("NOAAWaveWatch:DataProcessors");

/** Return a finite number or null — guards against undefined/NaN in OM payloads. */
function numberOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isFinite(value) ? value : null;
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
 * @returns Array of processed wave forecast data
 */
export function processNOAAGridData(
  gridData: NOAAGridData,
  days: number,
  latitude: number,
  longitude: number
): WaveWatchData[] {
  const forecasts: WaveWatchData[] = [];
  const props = gridData.properties;

  // Get the minimum number of available forecasts across all parameters
  const waveHeightCount = props.waveHeight?.values.length ?? 0;
  const wavePeriodCount = props.wavePeriod?.values.length ?? 0;
  const waveDirectionCount = props.waveDirection?.values.length ?? 0;

  // Cap to waveHeightCount — wave height is the primary signal.
  // Direction/period arrays are often longer (10 days vs 3 days of heights),
  // and padding beyond real height data produces fabricated constant defaults.
  if (waveHeightCount < Math.max(wavePeriodCount, waveDirectionCount)) {
    log.info(
      `NOAA array mismatch: waveHeight=${waveHeightCount}, wavePeriod=${wavePeriodCount}, waveDirection=${waveDirectionCount} — capping to ${waveHeightCount}`
    );
  }

  const maxForecasts = Math.min(
    days * FORECAST_CONFIG.FORECASTS_PER_DAY,
    waveHeightCount
  );

  log.debug(`Processing ${maxForecasts} NOAA grid forecasts`);

  for (let i = 0; i < maxForecasts; i++) {
    const timestamp = getTimestampForIndex(i);

    // Extract wave height (convert from feet to meters if needed)
    const waveHeight = getValueAtIndex(props.waveHeight?.values, i);
    const significantWaveHeight = waveHeight
      ? props.waveHeight?.uom === "wmoUnit:ft"
        ? waveHeight * 0.3048
        : waveHeight
      : getBaseWaveHeight(latitude, longitude);

    // Extract wave period
    const wavePeriod = getValueAtIndex(props.wavePeriod?.values, i);
    const peakWavePeriod =
      wavePeriod ?? Math.max(4, 6 + significantWaveHeight * 1.5);

    // Extract wave direction
    const waveDirection = getValueAtIndex(props.waveDirection?.values, i);
    const peakWaveDirection =
      waveDirection ?? getPrevailingWaveDirection(latitude, longitude);

    // Extract swell data — prefer the real primary partition when NOAA
    // provides it (NWS gridpoints that resolve over the ocean include
    // `primarySwellHeight` / `primarySwellDirection`). Fall back to the
    // generic `swellHeight` / `swellDirection` / `swellPeriod` fields for
    // coastal-land grids that don't carry partitioned values.
    const primarySwellHeight = getValueAtIndex(
      props.primarySwellHeight?.values,
      i
    );
    const primarySwellDirection = getValueAtIndex(
      props.primarySwellDirection?.values,
      i
    );
    const swellHeight = getValueAtIndex(props.swellHeight?.values, i);
    const swellPeriod = getValueAtIndex(props.swellPeriod?.values, i);
    const swellDirection = getValueAtIndex(props.swellDirection?.values, i);

    const swell1Height =
      primarySwellHeight ?? swellHeight ?? significantWaveHeight * 0.7;
    // Primary-partition period: wavePeriod IS the peak period, which for the
    // primary partition equals the primary swell period. No separate
    // `primarySwellPeriod` field exists in NOAA gridpoints.
    const swell1Period = swellPeriod ?? peakWavePeriod * 1.3;
    const swell1Direction =
      primarySwellDirection ?? swellDirection ?? peakWaveDirection;

    // Secondary partition — REAL values from NOAA or zero sentinel. Never
    // synthesize. NOAA returns 0 (not null) for absent partitions in some
    // cases; we normalize both to `0` so downstream consumers using the
    // `swell_2_height > 0 && swell_2_period > 0` guard treat them as "no
    // second swell train."
    const secondarySwellHeightRaw = getValueAtIndex(
      props.secondarySwellHeight?.values,
      i
    );
    const secondarySwellDirectionRaw = getValueAtIndex(
      props.secondarySwellDirection?.values,
      i
    );
    const wavePeriod2Raw = getValueAtIndex(props.wavePeriod2?.values, i);
    const hasSecondary =
      secondarySwellHeightRaw !== null && secondarySwellHeightRaw > 0;
    const swell2Height = hasSecondary ? secondarySwellHeightRaw : 0;
    const swell2Period =
      hasSecondary && wavePeriod2Raw !== null && wavePeriod2Raw > 0
        ? wavePeriod2Raw
        : 0;
    const swell2Direction =
      hasSecondary && secondarySwellDirectionRaw !== null
        ? secondarySwellDirectionRaw
        : 0;

    // Generate wind wave component
    const windWaveHeight = significantWaveHeight * 0.5;
    const windWavePeriod = peakWavePeriod * 0.7;
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
      wind_wave_period: Math.round(windWavePeriod * 10) / 10,
      wind_wave_direction: Math.round(windWaveDirection),
      data_source: "NOAA_NWS" as const,
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
    const timestamp = new Date(data.hourly.time[i]);

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
      swell_height_om: numberOrNull(data.hourly.swell_wave_height?.[i]),
      swell_period_om: numberOrNull(data.hourly.swell_wave_period?.[i]),
      swell_direction_om: numberOrNull(data.hourly.swell_wave_direction?.[i]),
      wind_wave_height_om: numberOrNull(data.hourly.wind_wave_height?.[i]),
    };

    const forecast: WaveWatchData = {
      timestamp: timestamp.toISOString(),
      significant_wave_height: significantWaveHeight,
      peak_wave_period: peakWavePeriod,
      peak_wave_direction: peakWaveDirection,
      swell_1_height: swell1Height,
      swell_1_period: swell1Period,
      swell_1_direction: swell1Direction,
      // Open-Meteo only exposes a single swell partition. Never synthesize
      // a secondary from swell_1 — emit the `0` sentinel so downstream
      // `swell_2_height > 0 && swell_2_period > 0` guards treat this as
      // "no second swell train," not as "small second swell."
      swell_2_height: 0,
      swell_2_period: 0,
      swell_2_direction: 0,
      wind_wave_height: windWaveHeight,
      wind_wave_period: windWavePeriod,
      wind_wave_direction: windWaveDirection,
      data_source: "OPEN_METEO" as const,
      om_values: rawOm,
    };

    forecasts.push(forecast);
  }

  log.debug(`Processed ${forecasts.length} Open-Meteo wave forecasts`);
  return forecasts;
}
