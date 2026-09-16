import { directionForForecast } from '../validate-direction-scoring';
import { bootstrapMean, evaluateGates, inSwellWindow, nearestForecast, rankCorrelation, type BacktestRow } from '../backtest-direction-scoring';

describe('direction scoring scripts', () => {
  it('builds an explicit direction context without reading flags', () => {
    expect(directionForForecast({ wind_direction_deg: 270, swell_1_direction: 'SSW' }, {
      wind_offshore_deg: 90,
      swell_window_center_deg: 282.5,
      swell_window_halfwidth_deg: 102.5,
    })).toMatchObject({ windDirectionDeg: 270, swellDirectionDeg: 202.5 });
  });

  it('calculates seeded rank correlation and bootstrap bounds', () => {
    expect(rankCorrelation([{ score: 1, rating: 1 }, { score: 2, rating: 2 }])).toBe(1);
    expect(rankCorrelation([{ score: 1, rating: 1 }, { score: 1, rating: 2 }, { score: 2, rating: 2 }])).toBeCloseTo(0.5);
    expect(bootstrapMean([1, 2, 3], 20, 793)[0]).toBeLessThanOrEqual(2);
  });

  it('matches nearest slots and handles wrapped windows', () => {
    expect(nearestForecast([{ beach_id: 'b', forecast_at: '2026-01-01T00:00:00Z' }], 'b', '2026-01-01T02:59:00Z')).not.toBeNull();
    expect(nearestForecast([{ beach_id: 'b', forecast_at: '2026-01-01T00:00:00Z' }], 'b', '2026-01-01T03:01:00Z')).toBeNull();
    expect(inSwellWindow(359, 5, 10)).toBe(true);
    expect(inSwellWindow(180, 5, 10)).toBe(false);
  });

  it('marks gates insufficient before evaluating them', () => {
    const row: BacktestRow = { beachSlug: 'b', oldScore: 90, newScore: 90, rating: 5, oldLabel: 'EPIC', newLabel: 'EPIC', onshore: true, outOfWindow: true, oldFaceHeight: 2, newFaceHeight: 2, observedFaceHeight: 2 };
    expect(evaluateGates(Array.from({ length: 19 }, () => row)).epic_onshore_or_out_of_window).toBe('INSUFFICIENT DATA');
    expect(evaluateGates(Array.from({ length: 20 }, () => row)).epic_onshore_or_out_of_window).toBe('FAIL');
  });
});
