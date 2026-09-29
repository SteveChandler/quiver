import { conditionSimilarity, LIKE_THIS_SIMILARITY } from '@/lib/scoring/personal-board';
import { parseWaveHeightMidpointFt } from '@/lib/alerts/forecast-parsers';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

const beach = { break_type: 'beach', preferred_tide_ft_min: 1, preferred_tide_ft_max: 5 } as Beach;
const forecast = {
  wave_height: '3 ft', wave_period: '12s', wind_speed: '4 mph', wind_direction_deg: 90,
  tide_height: '3 ft', tide_status: 'incoming', forecast_at: '2026-09-28T15:00:00Z',
} as EnhancedForecastEntity;
const snapshot = {
  wave_height: '3 ft', wave_period: '12s', wind_speed: '4 mph', wind_direction_deg: 90,
  tide_height: '3 ft', tide_status: 'incoming',
};

it.each([
  ['3.2 ft', 3.2], ['3-4 ft', 3.5], ['1-5 ft', 3], ['~2 ft', 2],
  ['', null], [null, null], ['unknown', null], ['..', null],
  ['1.2.3 4 ft', 4], ['-2 ft', 2], ['1 5 9 ft', 5], ['.5-1.5 ft', 1], ['2.', 2],
  ['9'.repeat(400), null], [`0.${'0'.repeat(400)}1`, 0], [`1${'0'.repeat(308)}`, Infinity],
  [`0-0.${'0'.repeat(323)}5`, 0],
] as const)('parses the SQL midpoint fixture %s', (raw, expected) => {
  expect(parseWaveHeightMidpointFt(raw)).toBe(expected);
});

it('matches the fixed SQL similarity cases to four decimals', () => {
  expect(LIKE_THIS_SIMILARITY).toBe(0.7);
  expect(conditionSimilarity(snapshot, forecast, beach, beach)).toBeCloseTo(1, 4);
  expect(conditionSimilarity({ ...snapshot, wave_height: '1-5 ft' }, forecast, beach, beach)).toBeCloseTo(1, 4);
  expect(conditionSimilarity({ ...snapshot, wave_height: '4 ft' }, forecast, beach, beach)).toBeCloseTo(0.9129, 4);
  expect(conditionSimilarity({ ...snapshot, wave_period: '10s' }, forecast, beach, beach)).toBeCloseTo(0.9654, 4);
  expect(conditionSimilarity(snapshot, forecast, { ...beach, break_type: 'reef' }, beach)).toBeCloseTo(0.7788, 4);
  expect(conditionSimilarity(snapshot, forecast, { ...beach, break_type: 'beach/reef break' }, beach)).toBeCloseTo(1, 4);
  expect(conditionSimilarity({ ...snapshot, tide_status: 'outgoing' }, forecast, beach, beach)).toBeCloseTo(0.8825, 4);
  expect(conditionSimilarity({ ...snapshot, tide_height: null }, forecast, beach, beach)).toBeCloseTo(1, 4);
});

it('matches the source-aware period cases of compute_user_match_scores to four decimals', () => {
  // Twin of supabase/tests/match_score_board_model.sql: an OPEN_METEO slot (wave_period 5, wave_period_om 11)
  // sits on an 11 s CDIP history at similarity 1, a CDIP slot does not, and the legacy slot does not.
  const cdip = { ...snapshot, wave_period: '11s', data_source: 'CDIP' };
  const openMeteo = { ...forecast, wave_period: '5s', wave_period_om: 11, data_source: 'OPEN_METEO' } as EnhancedForecastEntity;
  expect(conditionSimilarity(cdip, openMeteo, beach, beach)).toBeCloseTo(1, 4);
  expect(conditionSimilarity(cdip, { ...openMeteo, data_source: 'open_meteo' } as EnhancedForecastEntity, beach, beach)).toBeCloseTo(1, 4);
  expect(conditionSimilarity(cdip, { ...openMeteo, data_source: 'CDIP' } as EnhancedForecastEntity, beach, beach)).toBeLessThan(LIKE_THIS_SIMILARITY);
  expect(conditionSimilarity(cdip, { ...openMeteo, wave_period_om: 0 } as EnhancedForecastEntity, beach, beach)).toBeLessThan(LIKE_THIS_SIMILARITY);
  const omHistory = { ...snapshot, wave_period: '5s', wave_period_om: 11, data_source: 'OPEN_METEO' };
  expect(conditionSimilarity(omHistory, { ...forecast, wave_period: '11s', data_source: 'CDIP' } as EnhancedForecastEntity, beach, beach)).toBeCloseTo(1, 4);
});
