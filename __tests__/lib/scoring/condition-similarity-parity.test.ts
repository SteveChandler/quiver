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
