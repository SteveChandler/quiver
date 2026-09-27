import { conditionSimilarity } from '@/lib/scoring/personal-board';
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

it('matches the fixed SQL similarity cases to four decimals', () => {
  expect(conditionSimilarity(snapshot, forecast, beach, beach)).toBeCloseTo(1, 4);
  expect(conditionSimilarity({ ...snapshot, wave_height: '4 ft' }, forecast, beach, beach)).toBeCloseTo(0.9129, 4);
  expect(conditionSimilarity({ ...snapshot, wave_period: '10s' }, forecast, beach, beach)).toBeCloseTo(0.9654, 4);
  expect(conditionSimilarity(snapshot, forecast, { ...beach, break_type: 'reef' }, beach)).toBeCloseTo(0.7788, 4);
  expect(conditionSimilarity(snapshot, forecast, { ...beach, break_type: 'beach/reef break' }, beach)).toBeCloseTo(1, 4);
  expect(conditionSimilarity({ ...snapshot, tide_status: 'outgoing' }, forecast, beach, beach)).toBeCloseTo(0.8825, 4);
  expect(conditionSimilarity({ ...snapshot, tide_height: null }, forecast, beach, beach)).toBeCloseTo(1, 4);
});
