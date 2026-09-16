import { directionForForecast } from '../validate-direction-scoring';
import { bootstrapMean, rankCorrelation } from '../backtest-direction-scoring';

describe('direction scoring scripts', () => {
  it('builds an explicit direction context without reading flags', () => {
    expect(directionForForecast({ wind_direction_deg: 270, swell_1_direction_deg: 202 }, {
      swell_window_center_deg: 282.5,
      swell_window_halfwidth_deg: 102.5,
    })).toMatchObject({ windDirectionDeg: 270, swellDirectionDeg: 202 });
  });

  it('calculates seeded rank correlation and bootstrap bounds', () => {
    expect(rankCorrelation([{ score: 1, rating: 1 }, { score: 2, rating: 2 }])).toBe(1);
    expect(bootstrapMean([1, 2, 3], 20, 793)[0]).toBeLessThanOrEqual(2);
  });
});
