/** Read-only upstream replay. No database clients, secrets, or forecast writes. */
import assert from 'node:assert/strict';
import { fetchNOAAPointData, constructGridUrl, fetchNOAAGridData, fetchOpenMeteoData } from '../lib/services/noaa-wavewatch/api-client';
import { processNOAAGridData, processOpenMeteoData } from '../lib/services/noaa-wavewatch/data-processors';
import { mergeWaveSources } from '../lib/services/noaa-wavewatch/source-selection';
import { toFaceHeightFeetDecomposedWithDebug, METERS_TO_FEET } from '../lib/utils/wave-formatters';
import type { WaveWatchData } from '../lib/services/noaa-wavewatch/types';
import type { BeachTerrainConfig } from '../lib/utils/wave-height-transformer';
import terrainFixtures from './__fixtures__/shoaling-regression-fixtures.json';

function transform(point: WaveWatchData, beach?: BeachTerrainConfig): string | null {
  return toFaceHeightFeetDecomposedWithDebug({
    beach,
    modelSwellM: point.swell_1_height, modelHsM: point.significant_wave_height,
    periodS: point.swell_1_period, swellDirectionDeg: point.swell_1_direction,
    // Intentionally generic: isolates the source/parser change, not a claim about calibrated Blacks heights.
    components: [
      { heightFt: point.swell_1_height * METERS_TO_FEET, periodS: point.swell_1_period, directionDeg: point.swell_1_direction },
      { heightFt: point.swell_2_height * METERS_TO_FEET, periodS: point.swell_2_period, directionDeg: point.swell_2_direction },
      { heightFt: point.wind_wave_height * METERS_TO_FEET, periodS: point.wind_wave_period, directionDeg: point.wind_wave_direction, partition: 'wind_wave' as const },
    ].filter((component) => component.heightFt > 0 && component.periodS > 0),
  }).value;
}

async function main(): Promise<void> {
  const capturedAt = new Date();
  const point = await fetchNOAAPointData(32.887, -117.252);
  assert(point, 'NWS point resolution failed');
  const gridUrl = constructGridUrl(point);
  assert(gridUrl, 'NWS grid URL missing');
  const [grid, marine] = await Promise.all([
    fetchNOAAGridData(gridUrl), fetchOpenMeteoData(32.887, -117.252, 7, { signal: AbortSignal.timeout(30000) }),
  ]);
  assert(grid && marine?.hourly, 'Both upstream responses required for comparison');
  const base = new Date(capturedAt.toISOString().slice(0, 10) + 'T00:00:00Z');
  const noaa = processNOAAGridData(grid, 7, 32.887, -117.252, { baseTime: base });
  const om = processOpenMeteoData(marine, 7);
  const merged = mergeWaveSources(noaa, om);
  const targets = process.argv.slice(2).filter((arg) => arg !== '--raw');
  const times = targets.length ? targets : ['2026-09-05T18:00:00.000Z', '2026-09-06T18:00:00.000Z'];
  const rows = times.map((time) => {
    const timestamp = new Date(time).toISOString();
    const matches = (slot: WaveWatchData): boolean => Date.parse(slot.timestamp) === Date.parse(timestamp);
    const nws = noaa.find(matches);
    const meteo = om.find(matches);
    const selected = merged.find(matches);
    assert(nws && meteo && selected, `Missing comparable slot ${timestamp}`);
    const oldSource = Date.parse(timestamp) - capturedAt.getTime() <= 72 * 3600000 ? nws : meteo;
    const oldOmPeriod = meteo.om_values!.wave_period_om ?? 8;
    const oldPoint = oldSource === nws ? nws : {
      ...meteo, peak_wave_period: oldOmPeriod,
      swell_1_period: meteo.om_values!.swell_period_om ?? oldOmPeriod,
      wind_wave_period: meteo.om_values!.wind_wave_period_om ?? Math.max(4, oldOmPeriod * 0.6),
      swell_2_height: 0, swell_2_period: 0, swell_2_direction: 0,
    };
    return { timestamp, oldSource: oldSource.data_source, oldGenericFace: transform(oldPoint),
      newSource: selected.data_source, newGenericFace: transform(selected),
      selection: selected.source_selection, noaa: nws, openMeteo: meteo,
      historicalExposureControls: ['blacks', 'lower-trestles', 'tourmaline-beach'].map((slug) => {
        const fixture = terrainFixtures.beaches[slug as keyof typeof terrainFixtures.beaches];
        const beach: BeachTerrainConfig = {
          terrain_enabled: fixture.terrain_enabled,
          swell_window_center_deg: fixture.swell_window_center_deg,
          swell_window_halfwidth_deg: fixture.swell_window_halfwidth_deg,
          swell_access_factors: fixture.swell_access_factors,
        };
        return { slug, oldFace: transform(oldPoint, beach), newFace: transform(selected, beach) };
      }),
    };
  });
  console.log(JSON.stringify({ capturedAt: capturedAt.toISOString(), gridUrl,
    nwsUpdatedAt: (grid.properties as unknown as { updateTime?: string }).updateTime ?? null,
    omIssuedAt: null, transformation: 'generic, not beach calibrated', rows,
    exposureControlScope: `Shared offshore input under historical ${terrainFixtures.asOf} exposure windows; not current per-beach forecasts`,
    ...(process.argv.includes('--raw') ? { raw: { grid, marine } } : {}),
  }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
