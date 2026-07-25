import { resolveForecastAlignment } from '@/lib/services/discovery/forecast-alignment';

describe('resolveForecastAlignment', () => {
  const forecasts = [
    {
      id: 'earlier',
      forecast_at: '2026-05-08T22:00:00.000Z',
    },
    {
      id: 'later',
      forecast_at: '2026-05-09T00:00:00.000Z',
    },
  ];

  it('returns the exact requested forecast row', () => {
    expect(
      resolveForecastAlignment(
        forecasts,
        '2026-05-08T22:00:00.000Z',
      ),
    ).toEqual({
      forecast: forecasts[0],
      alignment: {
        requestedForecastAt: '2026-05-08T22:00:00.000Z',
        matchedForecastAt: '2026-05-08T22:00:00.000Z',
        matchType: 'exact',
        deltaMinutes: 0,
      },
    });
  });

  it('uses the earlier row when two rows are equally near', () => {
    expect(
      resolveForecastAlignment(
        forecasts,
        '2026-05-08T23:00:00.000Z',
      ),
    ).toEqual({
      forecast: forecasts[0],
      alignment: {
        requestedForecastAt: '2026-05-08T23:00:00.000Z',
        matchedForecastAt: '2026-05-08T22:00:00.000Z',
        matchType: 'nearest',
        deltaMinutes: 60,
      },
    });
  });

  it('returns no match beyond the alignment tolerance', () => {
    expect(
      resolveForecastAlignment(
        forecasts,
        '2026-05-09T03:00:00.000Z',
      ),
    ).toEqual({
      forecast: null,
      alignment: {
        requestedForecastAt: '2026-05-09T03:00:00.000Z',
        matchedForecastAt: null,
        matchType: 'none',
        deltaMinutes: null,
      },
    });
  });

  it('ignores rows with invalid timestamps', () => {
    expect(
      resolveForecastAlignment(
        [{ id: 'invalid', forecast_at: 'not-a-timestamp' }],
        '2026-05-08T23:00:00.000Z',
      ).forecast,
    ).toBeNull();
  });
});
