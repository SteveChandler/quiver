/**
 * /api/personalization/match-score builds its forecast from query-string
 * conditions, so it never has a stored confidence_score. The board pick reads
 * only swell geometry from the snapshot, so that must not raise a
 * high-severity "discovery.confidence_score → 50" alert on every request.
 * Stored forecasts that lose their confidence_score must keep alerting.
 */
import { recommendBoard, type PersonalBoard } from '@/lib/scoring/personal-board';
import { trackFallback } from '@/lib/monitoring/fallback-tracker';
import type { Beach } from '@/types/database';
import type { EnhancedForecastEntity } from '@/types/forecast';

jest.mock('@/lib/monitoring/fallback-tracker', () => ({ trackFallback: jest.fn() }));

const beach = { id: 'ponto', name: 'Ponto', break_type: 'beach', skill_level: 'intermediate', preferred_tide_ft_min: 1, preferred_tide_ft_max: 4, lat: 33, lon: -117, wind_offshore_deg: 90 } as Beach;
const boards: PersonalBoard[] = [
  { id: 'thruster', name: 'Twin pin', board_type: 'thruster', sessions: [] },
  { id: 'fish', name: 'Machadocado', board_type: 'fish', sessions: [] },
];
// Same shape the route builds from the query string: no confidence_score.
const requestDerived = { beach_id: 'ponto', forecast_at: '2026-09-23T12:00:00Z', wave_height: '3.7', wave_period: '15', wind_speed: '3', wind_direction: '150', wind_direction_deg: 150, tide_height: '3', tide_status: 'rising' } as unknown as EnhancedForecastEntity;
const stored = { ...requestDerived, confidence_score: 90 } as EnhancedForecastEntity;

const confidenceCalls = () =>
  (trackFallback as jest.Mock).mock.calls
    .map(([event]) => event)
    .filter((event) => event.domain === 'discovery' && event.field === 'confidence_score');

describe('recommendBoard confidence fallback tracking', () => {
  beforeEach(() => jest.clearAllMocks());

  it('tracks a request-derived forecast at low severity with its reason', () => {
    recommendBoard(boards, requestDerived, beach, 'advanced', { requestDerived: true });

    expect(confidenceCalls()).toEqual([
      expect.objectContaining({ fallbackValue: 50, severity: 'low', reason: 'request_derived_forecast' }),
    ]);
  });

  it('keeps the default (high) severity when a stored forecast has no confidence_score', () => {
    recommendBoard(boards, { ...stored, confidence_score: null } as unknown as EnhancedForecastEntity, beach, 'advanced');

    const calls = confidenceCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].severity).toBeUndefined();
  });

  it('tracks nothing when the forecast carries a confidence_score', () => {
    recommendBoard(boards, stored, beach, 'advanced');

    expect(confidenceCalls()).toHaveLength(0);
  });

  it('does not change the pick', () => {
    expect(recommendBoard(boards, requestDerived, beach, 'advanced', { requestDerived: true }))
      .toEqual(recommendBoard(boards, requestDerived, beach, 'advanced'));
  });
});
