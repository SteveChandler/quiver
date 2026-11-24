/**
 * @jest-environment node
 *
 * Pin: the private determineVerdict in surf-call-logic stays on the
 * two-argument character gate. It has no user in scope, and on the
 * canonical path the engine verdict overrides it.
 */

jest.mock('@/lib/services/discovery/response-formatter', () => {
  const actual = jest.requireActual('@/lib/services/discovery/response-formatter');
  return {
    __esModule: true,
    ...actual,
    getRecommendationLabelGated: jest.fn(actual.getRecommendationLabelGated),
  };
});

import { computeSurfCall } from '@/lib/utils/surf-call-logic';
import { getRecommendationLabelGated } from '@/lib/services/discovery/response-formatter';
import type { PersonalizedForecastWindow } from '@/types/personalization';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';

function makeBeach(): Beach {
  return {
    id: 'test-beach-id',
    name: 'Test Beach',
    slug: 'test-beach',
    lat: 32.75,
    lon: -117.25,
    city: 'San Diego',
    state: 'CA',
    country: 'US',
    break_type: 'beach break',
    wind_offshore_deg: 90,
  } as Beach;
}

function makeForecast(): EnhancedForecastEntity {
  return {
    id: 'forecast-1',
    beach_id: 'test-beach-id',
    forecast_at: '2026-04-20T15:00:00Z',
    forecast_date: '2026-04-20',
    forecast_time: '08:00:00',
    wave_height: '4-5 ft',
    wave_period: '12s',
    wind_speed: '5',
    wind_direction: 'E',
    wind_direction_deg: 90,
    swell_1_height: '4',
    swell_1_period: '12s',
    swell_1_direction: '270',
    tide_status: 'Rising',
    confidence_score: 75,
    data_source: 'NOAA_BUOY',
  } as EnhancedForecastEntity;
}

function makeWindow(): PersonalizedForecastWindow {
  return {
    start: new Date('2026-04-20T15:32:00Z'),
    end: new Date('2026-04-21T02:23:00Z'),
    peakTime: new Date('2026-04-20T18:00:00Z'),
    tide: 'Rising',
    wind: '8 NW',
    waveHeight: '3-4 ft',
    wavePeriod: '12s',
    dataSource: 'NOAA_BUOY',
    confidence: 75,
    timezone: 'America/Los_Angeles',
    score: 85,
  };
}

describe('determineVerdict character gate', () => {
  it('keeps the private determineVerdict on the context-free gate', () => {
    const gate = getRecommendationLabelGated as jest.MockedFunction<typeof getRecommendationLabelGated>;
    gate.mockClear();

    const result = computeSurfCall(makeWindow(), [makeForecast()], makeBeach());

    // precondition
    expect(result.verdict).toBe('YES');
    expect(gate.mock.calls.length).toBeGreaterThan(0);
    for (const call of gate.mock.calls) {
      expect(call).toHaveLength(2);
    }
  });
});
