import { processNOAAGridData, processOpenMeteoData } from '@/lib/services/noaa-wavewatch/data-processors';
import { mergeWaveSources } from '@/lib/services/noaa-wavewatch/source-selection';
import type { NOAAGridData, OpenMeteoMarineResponse } from '@/lib/services/noaa-wavewatch/types';
import { ForecastBuilder } from '@/lib/services/forecast/forecast-builder';
import { createMockBeach } from '@/__tests__/setup/typed-mocks';
import captured from '@/__tests__/fixtures/wave-source-weekend-2026-09-03.json';

const at = '2026-09-05T18:00:00Z';
const series = (value: number) => ({ values: [{ validTime: `${at}/PT24H`, value }] });
const nwsRaw: NOAAGridData = { properties: {
  waveHeight: series(0.91), wavePeriod: series(11),
  primarySwellHeight: series(0.61), primarySwellDirection: series(230), swellPeriod: series(15),
  secondarySwellHeight: series(0.61), secondarySwellDirection: series(280), wavePeriod2: series(11),
} };
const omRaw: OpenMeteoMarineResponse = { hourly: {
  time: [at, '2026-09-05T19:00:00Z', '2026-09-05T20:00:00Z'],
  wave_height: [1.58], wave_period: [12.7], wave_direction: [191],
  swell_wave_height: [1], swell_wave_period: [10.95], swell_wave_direction: [174],
  secondary_swell_wave_height: [0.7], secondary_swell_wave_period: [11.9], secondary_swell_wave_direction: [210],
  wind_wave_height: [0], wind_wave_period: [0], wind_wave_direction: [283],
} };
const nws = () => processNOAAGridData(nwsRaw, 1, 32.887, -117.252, { baseTime: new Date(at) })[0];
const om = () => processOpenMeteoData(omRaw, 1)[0];

describe('raw wave sources → selection → face-height contracts', () => {
  it('compares equivalent trains despite provider ordering and carries missing provenance through swaps', () => {
    const props = { waveHeight: series(1.3), wavePeriod: series(10), waveDirection: series(0),
      primarySwellHeight: series(1), primarySwellDirection: series(0),
      secondarySwellHeight: series(0.7), secondarySwellDirection: series(180), wavePeriod2: series(15) };
    const parse = (properties: NOAAGridData['properties']) => processNOAAGridData({ properties }, 1, 32, -117, { baseTime: new Date(at) });
    const marine = processOpenMeteoData({ hourly: { ...omRaw.hourly!, wave_height: [1.3], wave_period: [10], wave_direction: [0],
      swell_wave_height: [1], swell_wave_period: [10], swell_wave_direction: [0],
      secondary_swell_wave_height: [0.7], secondary_swell_wave_period: [15], secondary_swell_wave_direction: [180] } }, 1);
    expect(parse(props)[0].swell_1_direction).toBe(180);
    expect(marine[0].swell_1_direction).toBe(0);
    expect(mergeWaveSources(parse(props), marine)[0].source_selection?.disagreement).toBe(false);
    expect(mergeWaveSources(parse(props), [{ ...marine[0], swell_1_direction: 90 }])[0].source_selection?.disagreement).toBe(true);
    const missing = parse({ ...props, secondarySwellDirection: undefined });
    expect(missing[0].inferred_input_count).toBe(1);
    expect(mergeWaveSources(missing, marine)[0].data_source).toBe('OPEN_METEO');
    const north = parse({ ...props, secondarySwellDirection: series(0) });
    expect(north[0].swell_1_direction).toBe(0);
    expect(north[0].inferred_input_count).toBe(0);
    expect(mergeWaveSources(north, marine)[0].data_source).toBe('NOAA_NWS');
  });
  it('replays captured unrounded NWS intervals and real OM partitions for the reported weekend', () => {
    const noaa = processNOAAGridData(captured.grid, 2, 32.887, -117.252, { baseTime: new Date(at) });
    const marine = processOpenMeteoData(captured.marine, 2);
    const selected = mergeWaveSources(noaa, marine).filter((point) => point.data_source === 'OPEN_METEO');
    expect(selected).toHaveLength(2);
    expect(selected.map((point) => point.significant_wave_height)).toEqual([1.34, 1.58]);
    expect(selected.map((point) => point.swell_2_height)).toEqual([0.7, 0.2]);
    expect(selected.map((point) => point.source_selection?.disagreement)).toEqual([true, true]);
    expect(noaa.find((point) => Date.parse(point.timestamp) === Date.parse('2026-09-06T18:00:00Z'))?.swell_1_height).toBe(0.91);
  });
  it('prefers reported inputs at every horizon, preserving the entire OM bundle and zero wind', () => {
    for (const hours of [6, 71, 72, 73, 96, 168]) {
      const timestamp = new Date(Date.parse(at) + hours * 3600000).toISOString();
      const [selected] = mergeWaveSources([{ ...nws(), timestamp }], [{ ...om(), timestamp }]);
      expect(selected).toMatchObject({ ...om(), timestamp, source_selection: {
        reason: 'reported_inputs', disagreement: true, noaa_height_m: 0.91, open_meteo_height_m: 1.58,
      } });
      expect(selected.swell_2_height).toBe(0.7);
      expect(selected.wind_wave_height).toBe(0);
    }
  });

  it('selects a smaller complete source over a larger incomplete source', () => {
    const smaller = { ...nws(), significant_wave_height: 0.5, inferred_input_count: 0 };
    const [selected] = mergeWaveSources([smaller], [om()]);
    expect(selected.data_source).toBe('NOAA_NWS');
    expect(selected.significant_wave_height).toBe(0.5);
    expect(selected.om_values).toEqual(om().om_values);
  });

  it('uses NWS when its real core inputs are complete and OM needs a synthesized swell direction', () => {
    const noaa = processNOAAGridData({ properties: { ...nwsRaw.properties, waveDirection: series(270) } }, 1, 32.887, -117.252, { baseTime: new Date(at) });
    const marine = processOpenMeteoData({ hourly: { ...omRaw.hourly!, swell_wave_direction: [] } }, 1);
    expect(mergeWaveSources(noaa, marine)[0].data_source).toBe('NOAA_NWS');
  });

  it('does not fabricate coverage, conflate nearby times, or drop interior holes', () => {
    const later = { ...nws(), timestamp: '2026-09-06T00:00:00Z' };
    const interior = { ...om(), timestamp: '2026-09-05T21:00:00Z' };
    const nearby = { ...om(), timestamp: '2026-09-05T19:00:00Z' };
    const result = mergeWaveSources([later, nws()], [interior, nearby]);
    expect(result.map((point) => point.timestamp)).toEqual([nws().timestamp, nearby.timestamp, interior.timestamp, later.timestamp]);
    expect(result.every((point) => point.source_selection?.reason === 'only_source')).toBe(true);
  });

  it.each([NaN, Infinity, -1])('rejects invalid Hs %s without contaminating the other provider', (height) => {
    expect(mergeWaveSources([nws()], [{ ...om(), significant_wave_height: height }])[0].data_source).toBe('NOAA_NWS');
  });

  it('rejects a synthesized total height, even when it is the only source', () => {
    const missing = processOpenMeteoData({ hourly: { ...omRaw.hourly!, wave_height: [] } }, 1);
    expect(mergeWaveSources([], missing)).toEqual([]);
  });

  it('retains reported flat seas instead of replacing zero with a fallback forecast', () => {
    const flat = { ...om(), significant_wave_height: 0, peak_wave_period: 0,
      swell_1_height: 0, swell_1_period: 0, swell_2_height: 0, swell_2_period: 0 };
    expect(mergeWaveSources([], [flat])[0].significant_wave_height).toBe(0);
  });

  it('does not select a corrupt component even when its total height is valid', () => {
    expect(mergeWaveSources([nws()], [{ ...om(), swell_1_direction: NaN }])[0].data_source).toBe('NOAA_NWS');
  });

  it('flags materially different swell exposure even when total heights match, with circular direction comparison', () => {
    const first = { ...nws(), significant_wave_height: 1, swell_1_direction: 350 };
    const second = { ...om(), significant_wave_height: 1, swell_1_direction: 10 };
    expect(mergeWaveSources([first], [second])[0].source_selection?.disagreement).toBe(false);
    expect(mergeWaveSources([first], [{ ...second, swell_1_direction: 170 }])[0].source_selection?.disagreement).toBe(true);
  });

  it('uses reported peak periods when available; otherwise identifies mean rather than converting it', () => {
    const [peak] = processOpenMeteoData({ hourly: { ...omRaw.hourly!, wave_peak_period: [16], swell_wave_peak_period: [17] } }, 1);
    expect(peak).toMatchObject({ peak_wave_period: 16, swell_1_period: 17, period_basis: 'peak' });
    expect(peak.om_values).toMatchObject({ wave_period_om: 12.7, swell_period_om: 10.95 });
    expect(om()).toMatchObject({ peak_wave_period: 12.7, period_basis: 'mean' });
  });

  it('passes the real secondary swell through the builder’s real face-height transformation', () => {
    const builder = new ForecastBuilder({
      getWaveDirectionText: () => 'SW', getTideStatusAtTime: () => 'Rising',
      getTideHeightAtTime: () => 3.5, getNextTideFromTime: () => null, getDataQualityScore: () => 85,
    });
    const beach = createMockBeach({ terrain_enabled: false, shoaling_factors: null,
      swell_window_center_deg: 200, swell_window_halfwidth_deg: 100, deepwater_decay_factor: null });
    const selected = mergeWaveSources([nws()], [om()])[0];
    const withSecondary = builder['getWaveHeight'](null, selected, null, false, beach);
    const withoutSecondary = builder['getWaveHeight'](null, { ...selected, swell_2_height: 0, swell_2_period: 0 }, null, false, beach);
    expect(withSecondary.debug.componentsUsed).toBe(true);
    expect(parseFloat(withSecondary.value!)).toBeGreaterThan(parseFloat(withoutSecondary.value!));
  });
});
