import { computeSurfCall } from '@/lib/utils/surf-call-logic';
import type { PersonalizedForecastWindow } from '@/types/personalization';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';

// ============================================================================
// Test Factories
// ============================================================================

function makeBeach(overrides: Partial<Beach> = {}): Beach {
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
    ...overrides,
  } as Beach;
}

function makeForecast(overrides: Partial<EnhancedForecastEntity> = {}): EnhancedForecastEntity {
  return {
    id: 'forecast-1',
    beach_id: 'test-beach-id',
    forecast_at: '2026-01-22T08:00:00Z',
    forecast_date: '2026-01-22',
    forecast_time: '08:00:00',
    wave_height: '3-4 ft',
    wave_period: '12s',
    wind_speed: '8',
    wind_direction: 'NW',
    wind_direction_deg: 315,
    tide_status: 'Rising',
    confidence_score: 75,
    data_source: 'NOAA_BUOY',
    ...overrides,
  } as EnhancedForecastEntity;
}

function makeWindow(overrides: Partial<PersonalizedForecastWindow> = {}): PersonalizedForecastWindow {
  const start = new Date('2026-01-22T08:00:00Z');
  const end = new Date('2026-01-22T11:00:00Z'); // 3 hours = 180 min
  return {
    start,
    end,
    tide: 'Rising',
    wind: '8 NW',
    waveHeight: '3-4 ft',
    wavePeriod: '12s',
    dataSource: 'NOAA_BUOY',
    confidence: 75,
    timezone: 'America/Los_Angeles',
    score: 75,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('computeSurfCall', () => {
  describe('hard NO gates', () => {
    it('returns NO with message when no forecasts', () => {
      const result = computeSurfCall(null, [], makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('No forecast data available');
    });

    it('returns NO with message when forecasts array is empty', () => {
      const result = computeSurfCall(makeWindow(), [], makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('No forecast data available');
    });

    it('returns NO when max wave height is below minimum rideable', () => {
      const forecasts = [makeForecast({ wave_height: '0.5 ft' })];
      const result = computeSurfCall(makeWindow(), forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('Waves too small for this spot.');
    });

    it('uses higher minimum for reef breaks', () => {
      const beach = makeBeach({ break_type: 'reef break' } as any);
      const forecasts = [makeForecast({ wave_height: '1.8 ft' })];
      const result = computeSurfCall(makeWindow(), forecasts, beach);
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('Waves too small for this spot.');
    });

    it('allows reef break when waves are above minimum', () => {
      const beach = makeBeach({ break_type: 'reef break' } as any);
      const forecasts = [makeForecast({ wave_height: '3-4 ft' })];
      const window = makeWindow({ score: 75 });
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('YES');
    });

    it('returns NO when window is null', () => {
      const forecasts = [makeForecast({ wave_height: '3-4 ft' })];
      const result = computeSurfCall(null, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('No viable surf window today.');
    });
  });

  describe('score-based verdicts', () => {
    const forecasts = [makeForecast()];

    it('returns YES for score >= 70', () => {
      const window = makeWindow({ score: 70 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES');
    });

    it('returns YES for score = 100', () => {
      const window = makeWindow({ score: 100 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES');
    });

    it('returns MAYBE for score = 69', () => {
      const window = makeWindow({ score: 69 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('MAYBE');
    });

    it('returns MAYBE for score = 40', () => {
      const window = makeWindow({ score: 40 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('MAYBE');
    });

    it('returns NO for score = 39', () => {
      const window = makeWindow({ score: 39 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
    });

    it('returns NO for score = 0', () => {
      const window = makeWindow({ score: 0 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
    });
  });

  describe('window duration gates', () => {
    const forecasts = [makeForecast()];

    it('returns NO for window < 30 minutes with "Window too short" message', () => {
      const start = new Date('2026-01-22T08:00:00Z');
      const end = new Date('2026-01-22T08:25:00Z'); // 25 min
      const window = makeWindow({ start, end, score: 90 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('No viable window long enough to surf.');
    });

    it('returns NO for window exactly 29 minutes', () => {
      const start = new Date('2026-01-22T08:00:00Z');
      const end = new Date('2026-01-22T08:29:00Z'); // 29 min
      const window = makeWindow({ start, end, score: 90 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('No viable window long enough to surf.');
    });

    it('caps YES to MAYBE for window between 30-44 minutes', () => {
      const start = new Date('2026-01-22T08:00:00Z');
      const end = new Date('2026-01-22T08:40:00Z'); // 40 min
      const window = makeWindow({ start, end, score: 85 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('MAYBE');
    });

    it('allows YES for window >= 45 minutes with high score', () => {
      const start = new Date('2026-01-22T08:00:00Z');
      const end = new Date('2026-01-22T08:45:00Z'); // 45 min
      const window = makeWindow({ start, end, score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES');
    });

    it('does not cap MAYBE to NO for 30-44 min windows', () => {
      const start = new Date('2026-01-22T08:00:00Z');
      const end = new Date('2026-01-22T08:40:00Z'); // 40 min
      const window = makeWindow({ start, end, score: 50 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('MAYBE');
    });
  });

  describe('confidence gates', () => {
    const forecasts = [makeForecast()];

    it('downgrades YES to MAYBE when confidence < 20 and score near YES threshold', () => {
      const window = makeWindow({ score: 72, confidence: 15 }); // score within 5 of 70
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('MAYBE');
    });

    it('downgrades MAYBE to NO when confidence < 20 and score near MAYBE threshold', () => {
      const window = makeWindow({ score: 42, confidence: 10 }); // score within 5 of 40
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
    });

    it('does NOT downgrade when confidence >= 20', () => {
      const window = makeWindow({ score: 72, confidence: 25 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES');
    });

    it('does NOT downgrade when score is far from threshold', () => {
      const window = makeWindow({ score: 85, confidence: 10 }); // 15 from threshold
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES');
    });

    it('sets lowForecastConfidence when confidence < 35', () => {
      const window = makeWindow({ score: 80, confidence: 30 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.lowForecastConfidence).toBe(true);
    });

    it('does not set lowForecastConfidence when confidence >= 35', () => {
      const window = makeWindow({ score: 80, confidence: 40 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.lowForecastConfidence).toBe(false);
    });
  });

  describe('score clamping', () => {
    const forecasts = [makeForecast()];

    it('clamps negative scores to 0', () => {
      const window = makeWindow({ score: -10 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.score).toBe(0);
      expect(result.verdict).toBe('NO');
    });

    it('clamps scores above 100 to 100', () => {
      const window = makeWindow({ score: 150 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.score).toBe(100);
      expect(result.verdict).toBe('YES');
    });

    it('defaults undefined score to 0', () => {
      const window = makeWindow({ score: undefined });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.score).toBe(0);
    });
  });

  describe('wind description', () => {
    it('returns "glassy" for wind < 5 mph', () => {
      const forecasts = [makeForecast({ wind_speed: '3', wind_direction_deg: 90 } as any)];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.windDescription).toBe('glassy');
    });

    it('returns structured wind for offshore-aligned wind', () => {
      // Beach offshore is 90 deg, wind dir is 90 deg → 0 diff → offshore
      const forecasts = [makeForecast({ wind_speed: '8', wind_direction: 'NW', wind_direction_deg: 90 } as any)];
      const beach = makeBeach({ wind_offshore_deg: 90 } as any);
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.windDescription).toBe('NW 8 mph (offshore)');
      expect(result.windSpeed).toBe('8 mph');
      expect(result.windCompass).toBe('NW');
      expect(result.windType).toBe('offshore');
    });

    it('returns structured wind for onshore wind', () => {
      // Beach offshore is 90, wind is 270 → 180 diff → onshore
      const forecasts = [makeForecast({ wind_speed: '8', wind_direction: 'NW', wind_direction_deg: 270 } as any)];
      const beach = makeBeach({ wind_offshore_deg: 90 } as any);
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.windDescription).toBe('NW 8 mph (onshore)');
      expect(result.windSpeed).toBe('8 mph');
      expect(result.windType).toBe('onshore');
    });

    it('returns structured wind for cross-shore wind', () => {
      // Beach offshore is 0, wind is 90 → 90 diff → cross-shore
      const forecasts = [makeForecast({ wind_speed: '12', wind_direction: 'NW', wind_direction_deg: 90 } as any)];
      const beach = makeBeach({ wind_offshore_deg: 0 } as any);
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.windDescription).toBe('NW 12 mph (cross-shore)');
      expect(result.windSpeed).toBe('12 mph');
      expect(result.windType).toBe('cross-shore');
    });

    it('returns speed without type when no offshore data', () => {
      const forecasts = [makeForecast({ wind_speed: '25', wind_direction: 'NW', wind_direction_deg: null } as any)];
      const beach = makeBeach({ wind_offshore_deg: null } as any);
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.windDescription).toBe('NW 25 mph');
      expect(result.windSpeed).toBe('25 mph');
      expect(result.windType).toBeNull();
    });

    it('returns "Unknown" when wind speed is missing', () => {
      const forecasts = [makeForecast({ wind_speed: null } as any)];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.windDescription).toBe('Unknown');
    });
  });

  describe('tide description', () => {
    it('returns "rising" for Rising tide status', () => {
      const forecasts = [makeForecast({ tide_status: 'Rising' } as any)];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.tideDescription).toBe('rising');
    });

    it('returns "falling" for Falling tide status', () => {
      const forecasts = [makeForecast({ tide_status: 'Falling' } as any)];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.tideDescription).toBe('falling');
    });

    it('returns "high slack" for High Slack status', () => {
      const forecasts = [makeForecast({ tide_status: 'High Slack' } as any)];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.tideDescription).toBe('high slack');
    });

    it('returns "low slack" for Low Slack status', () => {
      const forecasts = [makeForecast({ tide_status: 'Low Slack' } as any)];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.tideDescription).toBe('low slack');
    });

    it('returns "Unknown" when tide_status is null', () => {
      const forecasts = [makeForecast({ tide_status: null } as any)];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.tideDescription).toBe('Unknown');
    });
  });

  // ============================================================================
  // getWindowTide (tested via computeSurfCall)
  //
  // getWindowTide is private. The four columns exercised below are exposed on
  // SurfCallResult as:  tideDescription, tidePhase, nextTideType, nextTideAt
  //
  // Selection order inside getWindowTide:
  //   1. First forecast whose next_tide_at >= windowStartMs
  //   2. Fallback: first forecast that has a tide_status at all
  //   3. If nothing qualifies → { description:'Unknown', phase:null, … }
  // ============================================================================
  describe('getWindowTide — tide display path', () => {
    // Window used across most sub-cases: 08:00–11:00 UTC on 2026-01-22
    // windowStartMs = new Date('2026-01-22T08:00:00Z').getTime()

    describe('tide_status present, next_tide_type/next_tide_at absent', () => {
      it('sets tidePhase to "rising" and tideDescription to "rising" (not "Rising → …")', () => {
        // Only tide_status provided — no next tide event data.
        // getWindowTide falls back to find(f => f.tide_status).
        // desc is set to phase because nextType/nextAt are null.
        const forecasts = [
          makeForecast({
            tide_status: 'Rising',
            next_tide_type: null,
            next_tide_at: null,
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        expect(result.tidePhase).toBe('rising');
        expect(result.tideDescription).toBe('rising');
        // No arrow format — next type is unknown
        expect(result.tideDescription).not.toContain('→');
        expect(result.nextTideType).toBeNull();
        expect(result.nextTideAt).toBeNull();
      });

      it('sets tidePhase to "falling" and tideDescription to "falling" without arrow', () => {
        const forecasts = [
          makeForecast({
            tide_status: 'Falling',
            next_tide_type: null,
            next_tide_at: null,
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        expect(result.tidePhase).toBe('falling');
        expect(result.tideDescription).toBe('falling');
        expect(result.tideDescription).not.toContain('→');
      });

      it('sets tidePhase to "high slack" when status is "High Slack" with no next event', () => {
        const forecasts = [
          makeForecast({
            tide_status: 'High Slack',
            next_tide_type: null,
            next_tide_at: null,
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        expect(result.tidePhase).toBe('high slack');
        expect(result.tideDescription).toBe('high slack');
        expect(result.tideDescription).not.toContain('→');
      });

      it('sets tidePhase to "low slack" when status is "Low Slack" with no next event', () => {
        const forecasts = [
          makeForecast({
            tide_status: 'Low Slack',
            next_tide_type: null,
            next_tide_at: null,
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        expect(result.tidePhase).toBe('low slack');
        expect(result.tideDescription).toBe('low slack');
        expect(result.tideDescription).not.toContain('→');
      });
    });

    describe('all three fields present — arrow format', () => {
      // Pin Date.now() before the test dates so next_tide_at values are in the future
      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-22T06:00:00Z'));
      });
      afterEach(() => {
        jest.useRealTimers();
      });

      it('returns "Rising → High" when tide_status=Rising and next_tide_type=High', () => {
        // next_tide_at is AFTER window start → selected by the first loop.
        const forecasts = [
          makeForecast({
            tide_status: 'Rising',
            next_tide_type: 'High',
            next_tide_at: '2026-01-22T09:30:00Z', // within the 08:00–11:00 window
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        expect(result.tidePhase).toBe('rising');
        expect(result.tideDescription).toBe('Rising → High');
        expect(result.nextTideType).toBe('High');
        expect(result.nextTideAt).toBe('2026-01-22T09:30:00Z');
      });

      it('returns "Falling → Low" when tide_status=Falling and next_tide_type=Low', () => {
        const forecasts = [
          makeForecast({
            tide_status: 'Falling',
            next_tide_type: 'Low',
            next_tide_at: '2026-01-22T10:00:00Z',
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        expect(result.tidePhase).toBe('falling');
        expect(result.tideDescription).toBe('Falling → Low');
        expect(result.nextTideType).toBe('Low');
        expect(result.nextTideAt).toBe('2026-01-22T10:00:00Z');
      });

      it('capitalizes both sides of the arrow correctly', () => {
        // Ensure capitalize() is applied to BOTH phase and nextType.
        // Source line: `${capitalize(phase)} → ${capitalize(nextType)}`
        const forecasts = [
          makeForecast({
            tide_status: 'rising',  // lowercase input → normalized phase = 'rising'
            next_tide_type: 'high', // lowercase input → capitalize() → 'High'
            next_tide_at: '2026-01-22T09:00:00Z',
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        // tidePhase is the normalized phase string (lowercase)
        expect(result.tidePhase).toBe('rising');
        // Both sides are capitalized by capitalize() in the description
        expect(result.tideDescription).toBe('Rising → High');
      });

      it('picks the first forecast whose next_tide_at >= windowStart, ignoring earlier ones', () => {
        // first forecast has next_tide_at BEFORE window start → skipped
        // second forecast has next_tide_at AFTER window start → selected
        const forecasts = [
          makeForecast({
            forecast_at: '2026-01-22T07:00:00Z',
            tide_status: 'Falling',
            next_tide_type: 'Low',
            next_tide_at: '2026-01-22T07:45:00Z', // before windowStartMs (08:00)
          } as any),
          makeForecast({
            forecast_at: '2026-01-22T08:00:00Z',
            tide_status: 'Rising',
            next_tide_type: 'High',
            next_tide_at: '2026-01-22T09:30:00Z', // at/after windowStartMs
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        // Should use the second forecast, not the first
        expect(result.tidePhase).toBe('rising');
        expect(result.tideDescription).toBe('Rising → High');
        expect(result.nextTideType).toBe('High');
      });

      it('uses next_tide_at exactly equal to windowStart as the selected forecast', () => {
        const windowStart = '2026-01-22T08:00:00Z';
        const forecasts = [
          makeForecast({
            tide_status: 'Rising',
            next_tide_type: 'High',
            next_tide_at: windowStart, // exactly equal to windowStartMs → qualifies
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        expect(result.tideDescription).toBe('Rising → High');
        expect(result.nextTideAt).toBe(windowStart);
      });
    });

    describe('next_tide_at is in the past relative to window start', () => {
      // Pin Date.now() so all tests in this block are deterministic
      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-22T13:00:00Z'));
      });
      afterEach(() => {
        jest.useRealTimers();
      });

      it('falls back to phase-only when next_tide_at predates window start and is in the past', () => {
        // next_tide_at is before the window start → first loop finds nothing.
        // Fallback: first forecast with tide_status. Since next_tide_at is also
        // in the past relative to Date.now(), nextType/nextAt are nulled out.
        const forecasts = [
          makeForecast({
            tide_status: 'Rising',
            next_tide_type: 'High',
            next_tide_at: '2026-01-22T07:00:00Z', // before window start 08:00
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        expect(result.tidePhase).toBe('rising');
        // Past tide events are stripped — no "→ High @ time"
        expect(result.tideDescription).toBe('rising');
        expect(result.nextTideAt).toBeNull();
      });

      it('returns description as phase only when next_tide_at is past AND next_tide_type is null', () => {
        // next_tide_at is past (skipped by loop), fallback finds tide_status row,
        // but next_tide_type is null → description = phase string, no arrow.
        const forecasts = [
          makeForecast({
            tide_status: 'Rising',
            next_tide_type: null,
            next_tide_at: '2026-01-22T06:00:00Z', // well before window start
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        expect(result.tidePhase).toBe('rising');
        expect(result.tideDescription).toBe('rising');
        expect(result.tideDescription).not.toContain('→');
      });

      it('nulls out nextTideAt when the tide event is in the past relative to now', () => {
        // It's 1 PM (from beforeEach), forecast row says next_tide_at = 8 AM.
        // The 8 AM tide is >= windowStart (so the first loop selects it), but
        // it's in the past relative to Date.now() → nextTideAt should be null.
        const forecasts = [
          makeForecast({
            tide_status: 'Falling',
            next_tide_type: 'Low',
            next_tide_at: '2026-01-22T08:00:00Z', // 8 AM — past relative to "now"
          } as any),
        ];
        const window = makeWindow({
          score: 80,
          start: new Date('2026-01-22T08:00:00Z'),
          end: new Date('2026-01-22T11:00:00Z'),
        });
        const result = computeSurfCall(window, forecasts, makeBeach());

        // Phase is preserved, but the stale "@ 8:00 AM" time is stripped
        expect(result.tidePhase).toBe('falling');
        expect(result.tideDescription).toBe('falling');
        expect(result.tideDescription).not.toContain('→');
        expect(result.nextTideAt).toBeNull();
      });

      it('preserves nextTideAt when the tide event is still in the future', () => {
        // Override the shared clock to 7 AM so the 8 AM tide is still in the future
        jest.setSystemTime(new Date('2026-01-22T07:00:00Z'));

        const forecasts = [
          makeForecast({
            tide_status: 'Falling',
            next_tide_type: 'Low',
            next_tide_at: '2026-01-22T08:00:00Z', // 8 AM — still in the future
          } as any),
        ];
        const window = makeWindow({
          score: 80,
          start: new Date('2026-01-22T07:00:00Z'),
          end: new Date('2026-01-22T10:00:00Z'),
        });
        const result = computeSurfCall(window, forecasts, makeBeach());

        expect(result.tidePhase).toBe('falling');
        expect(result.tideDescription).toBe('Falling → Low');
        expect(result.nextTideAt).toBe('2026-01-22T08:00:00Z');
      });
    });

    describe('non-standard tide_status values', () => {
      it('uses raw tide_status string as phase when it does not match known patterns', () => {
        // Status "ebbing" is not in the if/else chain → phase = status (raw string).
        const forecasts = [
          makeForecast({
            tide_status: 'ebbing',
            next_tide_type: null,
            next_tide_at: null,
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        // phase is set to 'ebbing' (the raw status) since it matches none of
        // rising/falling/high/low patterns
        expect(result.tidePhase).toBe('ebbing');
        expect(result.tideDescription).toBe('ebbing');
      });

      it('uses raw tide_status for non-standard value even with next event data', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-22T06:00:00Z'));

        const forecasts = [
          makeForecast({
            tide_status: 'slack_water',
            next_tide_type: 'High',
            next_tide_at: '2026-01-22T09:00:00Z',
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        // phase = 'slack_water' (raw), desc uses arrow format since nextType/nextAt present
        expect(result.tidePhase).toBe('slack_water');
        expect(result.tideDescription).toBe('Slack_water → High');

        jest.useRealTimers();
      });

      it('matches "RISING" (uppercase) as normalized "rising" phase', () => {
        // The comparison uses .toLowerCase() so case-insensitive
        const forecasts = [
          makeForecast({
            tide_status: 'RISING',
            next_tide_type: null,
            next_tide_at: null,
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        expect(result.tidePhase).toBe('rising');
        expect(result.tideDescription).toBe('rising');
      });

      it('matches "falling tide" (contains keyword) as normalized "falling" phase', () => {
        // .includes('falling') is true for "falling tide"
        const forecasts = [
          makeForecast({
            tide_status: 'falling tide',
            next_tide_type: null,
            next_tide_at: null,
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        expect(result.tidePhase).toBe('falling');
        expect(result.tideDescription).toBe('falling');
      });
    });

    describe('empty or absent tide data', () => {
      it('returns tideDescription "Unknown" and tidePhase null when all tide fields are null', () => {
        const forecasts = [
          makeForecast({
            tide_status: null,
            next_tide_type: null,
            next_tide_at: null,
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        expect(result.tideDescription).toBe('Unknown');
        expect(result.tidePhase).toBeNull();
        expect(result.nextTideType).toBeNull();
        expect(result.nextTideAt).toBeNull();
      });

      it('returns tideDescription null/Unknown and tidePhase null when no forecasts reach the tide path', () => {
        // Empty forecasts → hard NO gate before getWindowTide is called.
        // tideDescription stays null (from baseResult).
        const result = computeSurfCall(null, [], makeBeach());

        expect(result.tideDescription).toBeNull();
        expect(result.tidePhase).toBeNull();
      });

      it('returns tideDescription "Unknown" and tidePhase null when window forecasts have no tide_status', () => {
        // Forecasts exist and pass wave-height gate, window is valid,
        // but no forecast in the effective set has a tide_status.
        const forecasts = [
          makeForecast({
            wave_height: '3-4 ft',
            tide_status: null,
            next_tide_type: null,
            next_tide_at: null,
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        expect(result.tideDescription).toBe('Unknown');
        expect(result.tidePhase).toBeNull();
        expect(result.nextTideType).toBeNull();
        expect(result.nextTideAt).toBeNull();
      });

      it('selects first forecast with tide_status among multiple when none has qualifying next_tide_at', () => {
        // Multiple forecasts, none with next_tide_at >= windowStart.
        // Fallback should pick the FIRST one that has tide_status.
        const forecasts = [
          makeForecast({
            forecast_at: '2026-01-22T08:00:00Z',
            tide_status: null, // no tide_status → skipped by fallback find()
            next_tide_type: null,
            next_tide_at: null,
          } as any),
          makeForecast({
            forecast_at: '2026-01-22T09:00:00Z',
            tide_status: 'Falling',
            next_tide_type: null,
            next_tide_at: null,
          } as any),
          makeForecast({
            forecast_at: '2026-01-22T10:00:00Z',
            tide_status: 'Rising',
            next_tide_type: null,
            next_tide_at: null,
          } as any),
        ];
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, makeBeach());

        // Should use the second forecast (first with tide_status), not the third
        expect(result.tidePhase).toBe('falling');
        expect(result.tideDescription).toBe('falling');
      });
    });

    describe('tidePhase passthrough to whySentence', () => {
      it('whySentence references "rising tide" when tide is rising and verdict is YES', () => {
        // The buildWhySentence YES branch checks hasGoodTide (rising or low slack).
        // With offshore wind + rising tide we should get both parts in the sentence.
        const forecasts = [
          makeForecast({
            tide_status: 'Rising',
            next_tide_type: null,
            next_tide_at: null,
            wind_speed: '8',
            wind_direction_deg: 90, // offshore for beach with wind_offshore_deg: 90
          } as any),
        ];
        const beach = makeBeach({ wind_offshore_deg: 90 } as any);
        const window = makeWindow({ score: 80 });
        const result = computeSurfCall(window, forecasts, beach);

        expect(result.verdict).toBe('YES');
        // The why sentence should mention the rising tide (good tide condition)
        expect(result.whySentence.toLowerCase()).toContain('tide');
      });

      it('whySentence references dropping tide when tide is falling and verdict is MAYBE', () => {
        // buildWhySentence MAYBE branch: tide.phase === 'falling' → "Good swell, but tide is dropping…"
        const forecasts = [
          makeForecast({
            tide_status: 'Falling',
            next_tide_type: null,
            next_tide_at: null,
            wind_speed: '8',
            // wind_direction_deg not set → wind type will be null (no offshore data match)
          } as any),
        ];
        const beach = makeBeach({ wind_offshore_deg: null } as any);
        const window = makeWindow({ score: 55 });
        const result = computeSurfCall(window, forecasts, beach);

        expect(result.verdict).toBe('MAYBE');
        expect(result.whySentence).toContain('dropping');
      });
    });
  });

  describe('output structure', () => {
    const forecasts = [makeForecast()];

    it('includes window start/end as ISO strings', () => {
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.bestWindowStart).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.bestWindowEnd).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('includes updatedAt as ISO string', () => {
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('calculates windowMinutes correctly', () => {
      const start = new Date('2026-01-22T08:00:00Z');
      const end = new Date('2026-01-22T10:30:00Z'); // 150 min
      const window = makeWindow({ start, end, score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.windowMinutes).toBe(150);
    });

    it('passes through waveHeight from window (unless Unknown)', () => {
      const window = makeWindow({ waveHeight: '4-6 ft', score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.waveHeight).toBe('4-6 ft');
    });

    it('sets waveHeight to null when window waveHeight is Unknown', () => {
      const window = makeWindow({ waveHeight: 'Unknown', score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.waveHeight).toBeNull();
    });

    it('returns null fields for NO with no window', () => {
      const result = computeSurfCall(null, forecasts, makeBeach());
      expect(result.bestWindowStart).toBeNull();
      expect(result.bestWindowEnd).toBeNull();
      expect(result.windowMinutes).toBeNull();
    });
  });

  describe('why sentence generation', () => {
    const forecasts = [makeForecast()];

    it('generates explanatory sentence for YES verdict', () => {
      const window = makeWindow({ score: 85 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES');
      // YES sentences explain what makes it good (tide, swell, offshore, etc.)
      expect(result.whySentence.length).toBeGreaterThan(10);
      expect(result.whySentence).toMatch(/\./); // ends with period
    });

    it('generates explanatory sentence for MAYBE verdict', () => {
      const window = makeWindow({ score: 55 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('MAYBE');
      // MAYBE sentences explain the limiting factor
      expect(result.whySentence.length).toBeGreaterThan(10);
      expect(result.whySentence).toMatch(/\./); // ends with period
    });

    it('generates choppy sentence for NO with onshore wind', () => {
      const forecasts = [makeForecast({ wind_speed: '20', wind_direction_deg: 270 } as any)];
      const beach = makeBeach({ wind_offshore_deg: 90 } as any);
      const window = makeWindow({ score: 30 });
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toContain('choppy');
    });

    it('uses "No forecast data available" for empty forecasts', () => {
      const result = computeSurfCall(null, [], makeBeach());
      expect(result.whySentence).toBe('No forecast data available');
    });
  });

  describe('break type minimums', () => {
    it('uses 1.5 ft for beach break', () => {
      const beach = makeBeach({ break_type: 'beach break' } as any);
      const forecasts = [makeForecast({ wave_height: '1.4 ft' })];
      const result = computeSurfCall(makeWindow(), forecasts, beach);
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('Waves too small for this spot.');
    });

    it('uses 2.0 ft for point break', () => {
      const beach = makeBeach({ break_type: 'point break' } as any);
      const forecasts = [makeForecast({ wave_height: '1.9 ft' })];
      const result = computeSurfCall(makeWindow(), forecasts, beach);
      expect(result.verdict).toBe('NO');
    });

    it('uses 1.5 ft default for unknown break type', () => {
      const beach = makeBeach({ break_type: 'jetty' } as any);
      const forecasts = [makeForecast({ wave_height: '1.4 ft' })];
      const result = computeSurfCall(makeWindow(), forecasts, beach);
      expect(result.verdict).toBe('NO');
    });

    it('uses 1.5 ft default when break_type is null', () => {
      const beach = makeBeach({ break_type: null } as any);
      const forecasts = [makeForecast({ wave_height: '1.6 ft' })];
      const window = makeWindow({ score: 75 });
      const result = computeSurfCall(window, forecasts, beach);
      // 1.6 > 1.5 default, so waves pass
      expect(result.whySentence).not.toBe('Waves too small for this spot.');
    });
  });

  describe('peakTime', () => {
    const forecasts = [makeForecast()];

    it('returns peakTime as ISO string when window has a peakTime Date', () => {
      const peakTime = new Date('2026-01-22T09:30:00Z');
      const window = makeWindow({ score: 80, peakTime });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.peakTime).toBe('2026-01-22T09:30:00.000Z');
    });

    it('returns peakTime as null when no window exists', () => {
      const result = computeSurfCall(null, forecasts, makeBeach());
      expect(result.peakTime).toBeNull();
    });

    it('returns peakTime as null when window has no peakTime', () => {
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.peakTime).toBeNull();
    });
  });

  describe('trendTags', () => {
    it('returns trendTags with expected tags when window forecasts have clear trends', () => {
      // Wind dropping from 15→5 mph across 4 forecasts within the window
      const forecasts = [
        makeForecast({
          forecast_time: '08:00:00',
          wind_speed: '15',
          wind_direction_deg: 90,
          wave_period: '12s',
          tide_height: '2.0',
        } as any),
        makeForecast({
          forecast_time: '09:00:00',
          wind_speed: '12',
          wind_direction_deg: 90,
          wave_period: '12s',
          tide_height: '2.5',
        } as any),
        makeForecast({
          forecast_time: '10:00:00',
          wind_speed: '8',
          wind_direction_deg: 90,
          wave_period: '12s',
          tide_height: '3.0',
        } as any),
        makeForecast({
          forecast_time: '11:00:00',
          wind_speed: '5',
          wind_direction_deg: 90,
          wave_period: '12s',
          tide_height: '3.5',
        } as any),
      ];
      const window = makeWindow({ score: 80 });
      const beach = makeBeach({ wind_offshore_deg: 90 } as any);
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.trendTags).toContain('Winds Dropping');
    });

    it('returns trendTags as empty array when no window exists', () => {
      const forecasts = [makeForecast({ wave_height: '3-4 ft' })];
      const result = computeSurfCall(null, forecasts, makeBeach());
      expect(result.trendTags).toEqual([]);
    });

    it('returns trendTags as empty array when window is too short', () => {
      const start = new Date('2026-01-22T08:00:00Z');
      const end = new Date('2026-01-22T08:25:00Z'); // 25 min - below minimum
      const forecasts = [
        makeForecast({
          forecast_time: '08:00:00',
          wind_speed: '15',
          wind_direction_deg: 90,
        } as any),
        makeForecast({
          forecast_time: '08:15:00',
          wind_speed: '5',
          wind_direction_deg: 90,
        } as any),
      ];
      const window = makeWindow({ start, end, score: 90 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.trendTags).toEqual([]);
    });

    it('includes Tide Filling In when tide rises >= 1.0 ft across window', () => {
      const forecasts = [
        makeForecast({
          forecast_time: '08:00:00',
          wind_speed: '8',
          wind_direction_deg: 90,
          tide_height: '1.0',
        } as any),
        makeForecast({
          forecast_time: '09:00:00',
          wind_speed: '8',
          wind_direction_deg: 90,
          tide_height: '1.5',
        } as any),
        makeForecast({
          forecast_time: '10:00:00',
          wind_speed: '8',
          wind_direction_deg: 90,
          tide_height: '2.0',
        } as any),
        makeForecast({
          forecast_time: '11:00:00',
          wind_speed: '8',
          wind_direction_deg: 90,
          tide_height: '2.5',
        } as any),
      ];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.trendTags).toContain('Tide Filling In');
    });

    it('returns trendTags as empty array when no forecasts exist', () => {
      const result = computeSurfCall(null, [], makeBeach());
      expect(result.trendTags).toEqual([]);
    });
  });

  describe('wave height parsing', () => {
    it('parses range format "3-4 ft"', () => {
      const forecasts = [makeForecast({ wave_height: '3-4 ft' })];
      const window = makeWindow({ score: 75 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES'); // waves pass
    });

    it('parses single number "2.5"', () => {
      const forecasts = [makeForecast({ wave_height: '2.5' })];
      const window = makeWindow({ score: 75 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('YES'); // 2.5 > 1.5
    });

    it('handles "Unknown" wave height', () => {
      const forecasts = [makeForecast({ wave_height: 'Unknown' })];
      const result = computeSurfCall(makeWindow(), forecasts, makeBeach());
      // All forecasts have Unknown → maxWave is -Infinity → below minRideable → NO
      expect(result.verdict).toBe('NO');
    });

    it('handles null wave height', () => {
      const forecasts = [makeForecast({ wave_height: null })];
      const result = computeSurfCall(makeWindow(), forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
    });

    it('uses max wave from multiple forecasts', () => {
      const forecasts = [
        makeForecast({ wave_height: '1.0 ft' }),
        makeForecast({ wave_height: '4.0 ft', forecast_time: '10:00:00' }),
      ];
      const window = makeWindow({ score: 75 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      // Max wave is 4.0, above 1.5 minimum
      expect(result.whySentence).not.toBe('Waves too small for this spot.');
    });
  });
});
