import type { WaveWatchData } from "./types";

function dominantSwell(point: WaveWatchData): { height: number; period: number; direction: number } {
  // NWS is period-ranked and OM is provider-ranked; compare the same height-ranked train.
  if (point.swell_2_height != null && point.swell_2_period != null
    && point.swell_2_direction != null && (point.swell_2_height > point.swell_1_height
    || (point.swell_2_height === point.swell_1_height && point.swell_2_period > point.swell_1_period))) {
    return { height: point.swell_2_height, period: point.swell_2_period, direction: point.swell_2_direction };
  }
  return { height: point.swell_1_height, period: point.swell_1_period, direction: point.swell_1_direction };
}

function valid(point: WaveWatchData): boolean {
  return Number.isFinite(Date.parse(point.timestamp))
    && point.has_reported_wave_height !== false
    && Number.isFinite(point.significant_wave_height) && point.significant_wave_height >= 0
    && Number.isFinite(point.peak_wave_period)
    && (point.peak_wave_period > 0 || (point.significant_wave_height === 0 && point.peak_wave_period === 0))
    && Number.isFinite(point.peak_wave_direction)
    && point.peak_wave_direction >= 0 && point.peak_wave_direction <= 360
    && [
      [point.swell_1_height, point.swell_1_period, point.swell_1_direction],
      [point.swell_2_height, point.swell_2_period, point.swell_2_direction],
      [point.wind_wave_height, point.wind_wave_period, point.wind_wave_direction],
    ].every(([height, period, direction]) => height != null && Number.isFinite(height) && height >= 0
      && period != null && Number.isFinite(period) && period >= 0
      && direction != null && Number.isFinite(direction) && direction >= 0 && direction <= 360);
}

/** Select a whole source bundle, never the largest height or a blend of partitions. */
export function mergeWaveSources(noaa: WaveWatchData[], om: WaveWatchData[]): WaveWatchData[] {
  const noaaByTime = new Map(noaa.filter(valid).map((point) => [Date.parse(point.timestamp), point]));
  const omByTime = new Map(om.filter(valid).map((point) => [Date.parse(point.timestamp), point]));
  return [...new Set([...noaaByTime.keys(), ...omByTime.keys()])].sort((a, b) => a - b).map((time) => {
    const nws = noaaByTime.get(time);
    const meteo = omByTime.get(time);
    const nwsMissing = nws?.inferred_input_count ?? Infinity;
    const omMissing = meteo?.inferred_input_count ?? Infinity;
    // Equal completeness retains NWS; horizon alone cannot override better inputs.
    const selected = nws && (!meteo || nwsMissing <= omMissing) ? nws : meteo!;
    const heights = [nws?.significant_wave_height, meteo?.significant_wave_height];
    const low = Math.min(heights[0] ?? Infinity, heights[1] ?? Infinity);
    const high = Math.max(heights[0] ?? 0, heights[1] ?? 0);
    // Operational uncertainty guard, not a claim that either model is more accurate.
    const heightDisagreement = high - low >= 0.3 && high >= low * 1.5;
    const nwsSwell = nws && dominantSwell(nws);
    const omSwell = meteo && dominantSwell(meteo);
    const directionDisagreement = !!nwsSwell && !!omSwell
      && Math.min(nwsSwell.height, omSwell.height) >= 0.3
      && Math.min(nwsSwell.period, omSwell.period) >= 8
      && Math.abs(((nwsSwell.direction - omSwell.direction + 540) % 360) - 180) >= 45;
    const disagreement = !!nws && !!meteo && (heightDisagreement || directionDisagreement);
    return {
      ...selected,
      ...(meteo?.om_values ? { om_values: meteo.om_values } : {}),
      source_selection: {
        reason: !nws || !meteo ? "only_source" : nwsMissing === omMissing ? "tie" : "reported_inputs",
        disagreement,
        noaa_height_m: nws?.significant_wave_height ?? null,
        open_meteo_height_m: meteo?.significant_wave_height ?? null,
        period_basis: selected.period_basis,
      },
    };
  });
}
