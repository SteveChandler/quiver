import type { WaveWatchData } from "./types";

function dominantSwell(point: WaveWatchData): { height: number; period: number; direction: number } {
  // NWS is period-ranked and OM is provider-ranked; compare the same height-ranked train.
  const [first, second] = swellTrains(point);
  return second && (second.height > first.height || (second.height === first.height && second.period > first.period))
    ? second : first;
}

type Swell = ReturnType<typeof dominantSwell>;

function swellTrains(point: WaveWatchData): [Swell, Swell?] {
  const first = { height: point.swell_1_height, period: point.swell_1_period, direction: point.swell_1_direction };
  return point.swell_2_height != null && point.swell_2_period != null && point.swell_2_direction != null
    ? [first, { height: point.swell_2_height, period: point.swell_2_period, direction: point.swell_2_direction }]
    : [first];
}

/** Whole-foot NWS heights often tie two trains, and the period tie-break between them is arbitrary. */
function tiedDominantSwells(point: WaveWatchData): Swell[] {
  const dominant = dominantSwell(point);
  return swellTrains(point).filter((swell): swell is Swell =>
    swell !== undefined && Math.abs(swell.height - dominant.height) < 1e-6);
}

function comparable(a: Swell, b: Swell): boolean {
  return Math.min(a.height, b.height) >= 0.3 && Math.min(a.period, b.period) >= 8;
}

function degreesApart(a: Swell, b: Swell): number {
  return Math.abs(((a.direction - b.direction + 540) % 360) - 180);
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
  const validNoaa = noaa.filter(valid);
  // An all-zero NWS series is an empty/land grid cell (no data), not a flat
  // ocean: a real zero hour only appears among non-zero hours. Drop the whole
  // series so it can't win selection, flag disagreement, or show 0 ft.
  const nwsEmptyCell = validNoaa.length > 0 && validNoaa.every((point) => point.significant_wave_height === 0);
  const noaaByTime = new Map((nwsEmptyCell ? [] : validNoaa).map((point) => [Date.parse(point.timestamp), point]));
  const omByTime = new Map(om.filter(valid).map((point) => [Date.parse(point.timestamp), point]));
  return [...new Set([...noaaByTime.keys(), ...omByTime.keys()])].sort((a, b) => a - b).map((time) => {
    const meteo = omByTime.get(time);
    const nws = noaaByTime.get(time);
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
      && comparable(nwsSwell, omSwell) && degreesApart(nwsSwell, omSwell) >= 45
      && !tiedDominantSwells(nws!).some((swell) => comparable(swell, omSwell) && degreesApart(swell, omSwell) < 45);
    const disagreement = !!nws && !!meteo && (heightDisagreement || directionDisagreement);
    return {
      ...selected,
      ...(meteo?.om_values ? { om_values: meteo.om_values } : {}),
      source_selection: {
        reason: nwsEmptyCell ? "nws_empty_cell" : !nws || !meteo ? "only_source" : nwsMissing === omMissing ? "tie" : "reported_inputs",
        disagreement,
        noaa_height_m: nws?.significant_wave_height ?? null,
        open_meteo_height_m: meteo?.significant_wave_height ?? null,
        period_basis: selected.period_basis,
      },
    };
  });
}
