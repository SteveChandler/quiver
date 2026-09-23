/**
 * @jest-environment node
 */
import { computeSurfCall, computeSurfCallTiers } from '@/lib/utils/surf-call-logic';
import { LOW_TIDE_HEAVY_SWELL_WARNING } from '@/lib/domains/scoring';
import type { PersonalizedForecastWindow } from '@/types/personalization';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';

// ============================================================================
// Test Factories
// ============================================================================

// `skill_level` is widened to allow null because computeSurfCall defends
// against null at runtime even though Beach.Row pins it to `string`.
type MakeBeachOverrides = Partial<Omit<Beach, 'skill_level'>> & {
  skill_level?: string | null;
};

function makeBeach(overrides: MakeBeachOverrides = {}): Beach {
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
    // Default to a clean offshore-aligned wind so the PR 4 character gate
    // (which caps "Worth it" on positive characters only) doesn't downgrade
    // every YES test below to MAYBE. Tests that exercise wind-quality
    // gating override these explicitly.
    wind_speed: '5',
    wind_direction: 'E',
    wind_direction_deg: 90,
    swell_1_height: '4',
    swell_1_period: '12s',
    swell_1_direction: '270',
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
      expect(result.whySentence).toBe('no forecast data right now');
    });

    it('returns NO with message when forecasts array is empty', () => {
      const result = computeSurfCall(makeWindow(), [], makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('no forecast data right now');
    });

    it('returns NO when max wave height is below minimum rideable and no window', () => {
      const forecasts = [makeForecast({ wave_height: '0.5 ft' })];
      const result = computeSurfCall(null, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('Waves too small for this spot.');
    });

    it('uses higher minimum for reef breaks (no window → hard NO)', () => {
      const beach = makeBeach({ break_type: 'reef break' } as any);
      const forecasts = [makeForecast({ wave_height: '1.8 ft' })];
      const result = computeSurfCall(null, forecasts, beach);
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

    it('returns NO with a caution for heavy beach-break surf on a dropping low tide', () => {
      const beach = makeBeach({
        break_type: 'beach',
        preferred_tide_ft_min: 2,
        preferred_tide_ft_max: 6,
        preferred_tide_direction: 'either',
      });
      const forecasts = [
        makeForecast({
          wave_height: '7 ft',
          wave_period: '10s',
          swell_1_height: '7',
          swell_1_period: '10s',
          tide_height: '-0.4',
          tide_status: 'Falling',
        }),
      ];
      const window = makeWindow({
        score: 90,
        waveHeight: '7 ft',
        wavePeriod: '10s',
      });

      const result = computeSurfCall(window, forecasts, beach);

      expect(result.verdict).toBe('NO');
      expect(result.bestWindowStart).toBeNull();
      expect(result.bestWindowEnd).toBeNull();
      expect(result.cautions).toContain(LOW_TIDE_HEAVY_SWELL_WARNING);
      expect(result.whySentence).toBe(`${LOW_TIDE_HEAVY_SWELL_WARNING}.`);
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
      // Short-window NO must suppress the "Best window" row — a verdict NO
      // with a concrete window range contradicts itself in the UI.
      expect(result.bestWindowStart).toBeNull();
      expect(result.bestWindowEnd).toBeNull();
    });

    it('returns NO for window exactly 29 minutes', () => {
      const start = new Date('2026-01-22T08:00:00Z');
      const end = new Date('2026-01-22T08:29:00Z'); // 29 min
      const window = makeWindow({ start, end, score: 90 });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('No viable window long enough to surf.');
      expect(result.bestWindowStart).toBeNull();
      expect(result.bestWindowEnd).toBeNull();
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

    it('preserves an undefined score as unavailable', () => {
      const window = makeWindow({ score: undefined });
      const result = computeSurfCall(window, forecasts, makeBeach());
      expect(result.score).toBeNull();
      expect(result.verdict).toBe('NO');
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

      it('selects first forecast with tide_status among multiple when none has qualifying next_tide_at (tomorrow mode)', () => {
        // Multiple forecasts, none with next_tide_at >= windowStart.
        // Using isTomorrow: true so the fallback picks the FIRST one with tide_status
        // (current-time logic is disabled for tomorrow).
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
        const result = computeSurfCall(window, forecasts, makeBeach(), { isTomorrow: true });

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

    it('uses brand-voice copy for empty forecasts', () => {
      const result = computeSurfCall(null, [], makeBeach());
      expect(result.whySentence).toBe('no forecast data right now');
    });
  });

  describe('break type minimums', () => {
    it('uses 1.5 ft for beach break (no window → hard NO)', () => {
      const beach = makeBeach({ break_type: 'beach break' } as any);
      const forecasts = [makeForecast({ wave_height: '1.4 ft' })];
      const result = computeSurfCall(null, forecasts, beach);
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('Waves too small for this spot.');
    });

    it('uses 2.0 ft for point break (no window → hard NO)', () => {
      const beach = makeBeach({ break_type: 'point break' } as any);
      const forecasts = [makeForecast({ wave_height: '1.9 ft' })];
      const result = computeSurfCall(null, forecasts, beach);
      expect(result.verdict).toBe('NO');
    });

    it('uses 1.5 ft default for unknown break type (no window → hard NO)', () => {
      const beach = makeBeach({ break_type: 'jetty' } as any);
      const forecasts = [makeForecast({ wave_height: '1.4 ft' })];
      const result = computeSurfCall(null, forecasts, beach);
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

    it('handles "Unknown" wave height — normal verdict (no soft gate for unknown heights)', () => {
      const forecasts = [makeForecast({ wave_height: 'Unknown' })];
      // Unknown wave heights → maxWave is null → wavesBelowMin is false
      // Falls through to normal verdict logic using window.score
      const result = computeSurfCall(makeWindow(), forecasts, makeBeach());
      expect(result.verdict).toBe('YES'); // default window score=75 → YES
      // Without window → "No viable surf window"
      const resultNoWindow = computeSurfCall(null, forecasts, makeBeach());
      expect(resultNoWindow.verdict).toBe('NO');
      expect(resultNoWindow.whySentence).toBe('No viable surf window today.');
    });

    it('handles null wave height — soft-gate skipped, character defaults to flat', () => {
      // PR 4 nuance: a null wave_height on a single forecast row makes
      // the character classifier see waveHeight = 0 → `flat`, which is
      // not in the positive-character set. The character gate caps at
      // MAYBE. The original "no soft gate" intent still holds — the
      // small-wave gate isn't firing — but the character gate does.
      const forecasts = [makeForecast({ wave_height: null })];
      const result = computeSurfCall(makeWindow(), forecasts, makeBeach());
      expect(result.verdict).toBe('MAYBE');
      const resultNoWindow = computeSurfCall(null, forecasts, makeBeach());
      expect(resultNoWindow.verdict).toBe('NO');
      expect(resultNoWindow.whySentence).toBe('No viable surf window today.');
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

  describe('skill-level-aware minimums', () => {
    it('hard-NOs 1.5ft waves at advanced beach break when no window', () => {
      const forecasts = [makeForecast({ wave_height: '1.5 ft' })];
      const beach = makeBeach({ skill_level: 'advanced', break_type: 'beach break' } as Partial<Beach>);
      const result = computeSurfCall(null, forecasts, beach);
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toMatch(/too small/i);
    });

    it('soft-gates 1.5ft waves at advanced beach break to MAYBE when score >= 40', () => {
      const forecasts = [makeForecast({ wave_height: '1.5 ft' })];
      const window = makeWindow({ waveHeight: '1.5 ft', score: 55 });
      const beach = makeBeach({ skill_level: 'advanced', break_type: 'beach break' } as Partial<Beach>);
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('MAYBE');
      expect(result.whySentence).toMatch(/small for this break/i);
    });

    it('accepts 1.5ft waves at beginner beach break (min=1.5)', () => {
      const forecasts = [makeForecast({ wave_height: '1.5 ft' })];
      const window = makeWindow({ waveHeight: '1.5 ft', score: 75 });
      const beach = makeBeach({ skill_level: 'beginner', break_type: 'beach break' } as Partial<Beach>);
      const result = computeSurfCall(window, forecasts, beach);
      // Should not be rejected by hard gate — break_type min is 1.5, skill min is 0.5
      expect(result.whySentence).not.toMatch(/too small/i);
    });

    it('soft-gates 1.8ft waves at expert reef break to MAYBE when score >= 40', () => {
      const forecasts = [makeForecast({ wave_height: '1.8 ft' })];
      const window = makeWindow({ waveHeight: '1.8 ft', score: 60 });
      const beach = makeBeach({ skill_level: 'expert', break_type: 'reef break' } as Partial<Beach>);
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('MAYBE');
      expect(result.whySentence).toMatch(/small for this break/i);
    });

    it('hard-NOs 1.8ft waves at expert reef break when score < 40', () => {
      const forecasts = [makeForecast({ wave_height: '1.8 ft' })];
      const window = makeWindow({ waveHeight: '1.8 ft', score: 30 });
      const beach = makeBeach({ skill_level: 'expert', break_type: 'reef break' } as Partial<Beach>);
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('NO');
    });

    it('falls back to break_type minimum when skill_level is null', () => {
      const forecasts = [makeForecast({ wave_height: '1.5 ft' })];
      const window = makeWindow({ waveHeight: '1.5 ft', score: 75 });
      const beach = makeBeach({ skill_level: null, break_type: 'beach break' });
      const result = computeSurfCall(window, forecasts, beach);
      // skill_level null → skillMin=0, break min=1.5 → max(1.5, 0) = 1.5
      // 1.5 ft wave >= 1.5 min → not rejected
      expect(result.whySentence).not.toMatch(/too small/i);
    });

    it('soft-gates expert beach break with 2.0ft waves to MAYBE when score >= 40', () => {
      // Expert at beach break: max(1.5 break, 2.5 expert) = 2.5
      const forecasts = [makeForecast({ wave_height: '2.0 ft' })];
      const window = makeWindow({ waveHeight: '2.0 ft', score: 55 });
      const beach = makeBeach({ skill_level: 'expert', break_type: 'beach break' } as Partial<Beach>);
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('MAYBE');
      expect(result.whySentence).toMatch(/small for this break/i);
    });
  });

  // ============================================================================
  // isTomorrow: tide phase reflects current time vs. window-start time
  // ============================================================================
  describe('isTomorrow flag — tide phase selection', () => {
    // Window: 06:00–09:00 UTC on 2026-01-22
    // Forecast at 06:00 → tide_status "Rising"
    // Forecast at 08:00 → tide_status "Falling"
    // Current time mocked to 08:00 UTC (tide has already switched)

    const windowStart = new Date('2026-01-22T06:00:00Z');
    const windowEnd = new Date('2026-01-22T09:00:00Z');

    function makeTideForecasts() {
      return [
        makeForecast({
          forecast_at: '2026-01-22T06:00:00Z',
          tide_status: 'Rising',
          next_tide_type: null,
          next_tide_at: null,
        } as any),
        makeForecast({
          forecast_at: '2026-01-22T08:00:00Z',
          tide_status: 'Falling',
          next_tide_type: null,
          next_tide_at: null,
        } as any),
      ];
    }

    beforeEach(() => {
      jest.useFakeTimers();
      // Current time is 08:00 UTC — within the window but past the window start
      jest.setSystemTime(new Date('2026-01-22T08:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("uses forecast closest to NOW for today's surf call (isTomorrow=false)", () => {
      // At 08:00 the tide has switched to Falling — the surf call should reflect that.
      const forecasts = makeTideForecasts();
      const window = makeWindow({ start: windowStart, end: windowEnd, score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach(), { isTomorrow: false });

      expect(result.tidePhase).toBe('falling');
      expect(result.tideDescription).toBe('falling');
    });

    it("defaults to today behavior (nearest to now) when isTomorrow option is omitted", () => {
      const forecasts = makeTideForecasts();
      const window = makeWindow({ start: windowStart, end: windowEnd, score: 80 });
      // No options argument — should behave as isTomorrow=false
      const result = computeSurfCall(window, forecasts, makeBeach());

      expect(result.tidePhase).toBe('falling');
      expect(result.tideDescription).toBe('falling');
    });

    it("uses forecast at window-start for tomorrow's surf call (isTomorrow=true)", () => {
      // For tomorrow we cannot use "now" — use the original window-start fallback.
      // No forecast has next_tide_at >= windowStart, so getWindowTide falls back
      // to the first forecast with tide_status, which is the 06:00 "Rising" row.
      const forecasts = makeTideForecasts();
      const window = makeWindow({ start: windowStart, end: windowEnd, score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach(), { isTomorrow: true });

      expect(result.tidePhase).toBe('rising');
      expect(result.tideDescription).toBe('rising');
    });

    it('now outside window (past window end) still picks closest forecast for today', () => {
      // Override: current time is 10:00, past the window end (09:00).
      // Closest forecast to 10:00 within the window set is the 08:00 "Falling" row.
      jest.setSystemTime(new Date('2026-01-22T10:00:00Z'));

      const forecasts = makeTideForecasts();
      const window = makeWindow({ start: windowStart, end: windowEnd, score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach(), { isTomorrow: false });

      expect(result.tidePhase).toBe('falling');
    });

    it('now before window start picks closest forecast (window-start row) for today', () => {
      // Current time is 05:00, before the window. Closest forecast is 06:00 "Rising".
      jest.setSystemTime(new Date('2026-01-22T05:00:00Z'));

      const forecasts = makeTideForecasts();
      const window = makeWindow({ start: windowStart, end: windowEnd, score: 80 });
      const result = computeSurfCall(window, forecasts, makeBeach(), { isTomorrow: false });

      expect(result.tidePhase).toBe('rising');
    });
  });

  describe('window wave height check', () => {
    it('soft-gates to MAYBE when daily max passes but window waves are below min (score >= 40)', () => {
      // Daily max is 3.0 (passes advanced gate of 2.0), but window has 1.3 ft
      const forecasts = [
        makeForecast({ wave_height: '1.3 ft', forecast_at: '2026-01-22T08:00:00Z' }),
        makeForecast({ wave_height: '3.0 ft', forecast_at: '2026-01-22T22:00:00Z' }),
      ];
      const window = makeWindow({ waveHeight: '1.3 ft', score: 55 });
      const beach = makeBeach({ skill_level: 'advanced', break_type: 'beach break' } as Partial<Beach>);
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('MAYBE');
      expect(result.whySentence).toMatch(/small for this break/i);
    });

    it('NO when daily max passes but window waves below min and score < 40', () => {
      const forecasts = [
        makeForecast({ wave_height: '1.3 ft', forecast_at: '2026-01-22T08:00:00Z' }),
        makeForecast({ wave_height: '3.0 ft', forecast_at: '2026-01-22T22:00:00Z' }),
      ];
      const window = makeWindow({ waveHeight: '1.3 ft', score: 30 });
      const beach = makeBeach({ skill_level: 'advanced', break_type: 'beach break' } as Partial<Beach>);
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('NO');
    });

    it('passes when window waves meet the minimum', () => {
      const forecasts = [makeForecast({ wave_height: '3.0 ft' })];
      const window = makeWindow({ waveHeight: '3.0 ft', score: 75 });
      const beach = makeBeach({ skill_level: 'advanced', break_type: 'beach break' } as Partial<Beach>);
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.whySentence).not.toMatch(/too small/i);
    });

    it('skips window check when waveHeight is null', () => {
      const forecasts = [makeForecast({ wave_height: '3.0 ft' })];
      const window = makeWindow({ waveHeight: 'Unknown', score: 75 });
      const beach = makeBeach({ skill_level: 'advanced', break_type: 'beach break' } as Partial<Beach>);
      const result = computeSurfCall(window, forecasts, beach);
      // parseMaxWaveHeight('Unknown') returns null → skip check
      expect(result.whySentence).not.toBe('Best window waves too small for this spot.');
    });
  });

  // ============================================================================
  // Soft gate: waves below min but valid window with decent score → MAYBE
  // ============================================================================
  describe('soft wave-height gate', () => {
    it('MAYBE when reef break waves below min but window score >= 40', () => {
      // Reef min = 2.0, waves = 1.8, score = 57 (like the Blacks scenario)
      const forecasts = [makeForecast({ wave_height: '1.8 ft' })];
      const window = makeWindow({ waveHeight: '1.8 ft', score: 57 });
      const beach = makeBeach({ break_type: 'reef break' } as any);
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('MAYBE');
      expect(result.whySentence).toMatch(/small for this break/i);
      // Still includes window data
      expect(result.bestWindowStart).not.toBeNull();
      expect(result.bestWindowEnd).not.toBeNull();
    });

    it('NO when waves below min and window score < 40', () => {
      const forecasts = [makeForecast({ wave_height: '1.8 ft' })];
      const window = makeWindow({ waveHeight: '1.8 ft', score: 35 });
      const beach = makeBeach({ break_type: 'reef break' } as any);
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('NO');
    });

    it('MAYBE at exact score=40 boundary with waves below min', () => {
      const forecasts = [makeForecast({ wave_height: '1.8 ft' })];
      const window = makeWindow({ waveHeight: '1.8 ft', score: 40 });
      const beach = makeBeach({ break_type: 'reef break' } as any);
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('MAYBE');
    });

    it('hard NO when waves below min and no window exists', () => {
      const forecasts = [makeForecast({ wave_height: '1.8 ft' })];
      const beach = makeBeach({ break_type: 'reef break' } as any);
      const result = computeSurfCall(null, forecasts, beach);
      expect(result.verdict).toBe('NO');
      expect(result.whySentence).toBe('Waves too small for this spot.');
    });

    it('caps at MAYBE even with YES-level score when waves below min', () => {
      // Score=85 would normally be YES, but waves below min caps at MAYBE
      const forecasts = [makeForecast({ wave_height: '1.8 ft' })];
      const window = makeWindow({ waveHeight: '1.8 ft', score: 85 });
      const beach = makeBeach({ break_type: 'reef break' } as any);
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('MAYBE');
    });

    it('normal verdict when waves are above min (no soft gate)', () => {
      const forecasts = [makeForecast({ wave_height: '3-4 ft' })];
      const window = makeWindow({ waveHeight: '3-4 ft', score: 75 });
      const beach = makeBeach({ break_type: 'reef break' } as any);
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('YES');
      expect(result.whySentence).not.toMatch(/small for this break/i);
    });

    it('whySentence mentions clean winds for offshore/glassy conditions', () => {
      const forecasts = [makeForecast({ wave_height: '1.8 ft', wind_speed: '3' })];
      const window = makeWindow({ waveHeight: '1.8 ft', score: 50 });
      const beach = makeBeach({ break_type: 'reef break' } as any);
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.verdict).toBe('MAYBE');
      expect(result.whySentence).toMatch(/clean winds/i);
    });
  });

  // ==========================================================================
  // PR 4 character-gated recommendation label
  // ==========================================================================
  //
  // High-score days where the wind has trashed the wave shape no longer
  // promote to YES. The character classifier reads `windQuality` from the
  // composite, lands the day in `medium-mixed` / `medium-rough` /
  // `large-rough`, and the recommendation-label gate caps at MAYBE.
  describe('character-gated verdict (PR 4)', () => {
    it('downgrades YES to MAYBE for high-score medium-mixed (Horseshoe scenario)', () => {
      // 2.3 ft / 13s / NW 10 mph at offshoreDeg=45° (NE-facing). 10 mph
      // sideshore on long-period 2-3 ft → windQuality ~67, character
      // medium-mixed (windQuality < 70 → not medium-clean, but
      // windQuality >= 30 → not medium-rough).
      const beach = makeBeach({
        break_type: 'reef break',
        wind_offshore_deg: 45,
        wind_offshore_tol_deg: 30,
      } as any);
      const forecasts = [
        makeForecast({
          wave_height: '2-3 ft',
          wave_period: '13s',
          wind_speed: '10',
          wind_direction: 'NW',
          wind_direction_deg: 315,
          swell_1_height: '2.3',
          swell_1_period: '13s',
          swell_1_direction: '270',
        }),
      ];
      const window = makeWindow({
        score: 75,
        waveHeight: '2-3 ft',
      });
      const result = computeSurfCall(window, forecasts, beach);
      // PR 4 gate: 75 score + medium-mixed character → cap at MAYBE
      expect(result.verdict).toBe('MAYBE');
    });

    it('still allows YES on medium-clean (offshore 5 mph, long period)', () => {
      // Default offshore-aligned forecast (5 mph E, 12s, 3-4ft). At score 75
      // with a positive character, the gate lets YES through.
      const result = computeSurfCall(makeWindow({ score: 75 }), [makeForecast()], makeBeach());
      expect(result.verdict).toBe('YES');
    });
  });

  // ==========================================================================
  // Calibration honesty layer — isCalibrated flag
  // ==========================================================================
  //
  // The surf call report surfaces a population-level `isCalibrated` flag on
  // every result shape, sourced from `beach.shoaling_factors != null`. The
  // honesty layer consumers (SpotSurfReport, UnifiedSurfCard, ForecastTab) use
  // this to render the "Face height" / "Forecast height" label and the
  // ~-prefix + dotted underline visual markers. See
  // docs/design/calibration-honesty-spec.md.
  describe('isCalibrated', () => {
    it('returns false when beach.shoaling_factors is null', () => {
      const beach = makeBeach({ shoaling_factors: null } as any);
      const forecasts = [makeForecast()];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.isCalibrated).toBe(false);
    });

    it('returns false when beach.shoaling_factors is undefined (missing column)', () => {
      const beach = makeBeach();
      const forecasts = [makeForecast()];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.isCalibrated).toBe(false);
    });

    it('returns true when beach.shoaling_factors is a populated record', () => {
      const beach = makeBeach({
        shoaling_factors: { '10s': 1.2, '12s': 1.35 },
      } as any);
      const forecasts = [makeForecast()];
      const window = makeWindow({ score: 80 });
      const result = computeSurfCall(window, forecasts, beach);
      expect(result.isCalibrated).toBe(true);
    });

    it('preserves isCalibrated on hard-NO no-forecasts path', () => {
      const beach = makeBeach({
        shoaling_factors: { '10s': 1.2 },
      } as any);
      const result = computeSurfCall(null, [], beach);
      expect(result.verdict).toBe('NO');
      expect(result.isCalibrated).toBe(true);
    });

    it('preserves isCalibrated on waves-too-small path', () => {
      const beach = makeBeach({
        shoaling_factors: { '10s': 1.2 },
      } as any);
      const forecasts = [makeForecast({ wave_height: '0.5 ft' })];
      const result = computeSurfCall(null, forecasts, beach);
      expect(result.verdict).toBe('NO');
      expect(result.isCalibrated).toBe(true);
    });

    it('preserves isCalibrated on no-viable-window path', () => {
      const beach = makeBeach({ shoaling_factors: null } as any);
      const forecasts = [makeForecast({ wave_height: '3-4 ft' })];
      const result = computeSurfCall(null, forecasts, beach);
      expect(result.verdict).toBe('NO');
      expect(result.isCalibrated).toBe(false);
    });
  });

  describe('rideableWavesPerHour', () => {
    it('returns non-null rideableWavesPerHour for valid window with swell data', () => {
      const beach = makeBeach({ break_type: 'beach break' });
      const forecasts = [makeForecast({
        wave_height: '3-4 ft',
        wave_period: '12s',
        swell_1_period: '12s',
        swell_1_height: '3',
        swell_1_direction: 'W',
      })];
      const result = computeSurfCall(makeWindow({ score: 75 }), forecasts, beach);
      expect(result.rideableWavesPerHour).not.toBeNull();
      expect(result.rideableWavesPerHour).toBeGreaterThan(0);
    });

    it('returns null rideableWavesPerHour when no forecasts', () => {
      const result = computeSurfCall(null, [], makeBeach());
      expect(result.rideableWavesPerHour).toBeNull();
    });

    it('returns null rideableWavesPerHour when no window and waves too small', () => {
      const forecasts = [makeForecast({ wave_height: '0.5 ft' })];
      const result = computeSurfCall(null, forecasts, makeBeach());
      expect(result.rideableWavesPerHour).toBeNull();
    });

    it('populates rideableWavesPerHour on short-window early-return', () => {
      const shortWindow = makeWindow({
        start: new Date('2026-01-22T08:00:00Z'),
        end: new Date('2026-01-22T08:20:00Z'), // 20 min — below minimum
        score: 75,
      });
      const forecasts = [makeForecast({
        wave_height: '3-4 ft',
        wave_period: '12s',
        swell_1_period: '12s',
        swell_1_height: '3',
        swell_1_direction: 'W',
      })];
      const result = computeSurfCall(shortWindow, forecasts, makeBeach());
      expect(result.verdict).toBe('NO');
      expect(result.rideableWavesPerHour).not.toBeNull();
    });
  });
});

describe('computeSurfCallTiers', () => {
  it('returns the same intermediate verdict the baseline computeSurfCall produces', () => {
    const window = makeWindow({ score: 75, waveHeight: '3-4 ft' });
    const forecasts = [makeForecast({ wave_height: '3-4 ft' })];
    const beach = makeBeach();
    const baseline = computeSurfCall(window, forecasts, beach);
    const tiers = computeSurfCallTiers(window, forecasts, beach);
    expect(tiers.intermediate.verdict).toBe(baseline.verdict);
  });

  it('downgrades the advanced tier to NO when waves are below 2 ft', () => {
    // 1.5 ft swell, intermediate-friendly conditions → beginner OK, advanced NO
    const window = makeWindow({ score: 65, waveHeight: '1-1.5 ft' });
    const forecasts = [
      makeForecast({ wave_height: '1-1.5 ft' }),
    ];
    const tiers = computeSurfCallTiers(window, forecasts, makeBeach());
    expect(tiers.advanced.verdict).toBe('NO');
    expect(tiers.advanced.trail).toMatch(/TOO SMALL/i);
  });

  it('caps the beginner tier at NO when waves exceed 4 ft', () => {
    // 9 ft swell, advanced-friendly → advanced YES, beginner NO
    const window = makeWindow({ score: 80, waveHeight: '8-10 ft' });
    const forecasts = [
      makeForecast({
        wave_height: '8-10 ft',
        wave_period: '14s',
        swell_1_period: '14s',
        swell_1_height: '8',
      }),
    ];
    const tiers = computeSurfCallTiers(window, forecasts, makeBeach());
    expect(tiers.beginner.verdict).toBe('NO');
    expect(tiers.beginner.trail).toMatch(/TOO BIG/i);
  });

  it('upgrades advanced to YES when waves > 8 ft and baseline is at least MAYBE', () => {
    const window = makeWindow({ score: 60, waveHeight: '9-10 ft' });
    const forecasts = [
      makeForecast({
        wave_height: '9-10 ft',
        wave_period: '14s',
        swell_1_period: '14s',
        swell_1_height: '9',
      }),
    ];
    const tiers = computeSurfCallTiers(window, forecasts, makeBeach());
    expect(tiers.advanced.verdict).toBe('YES');
  });

  it('always returns three tier slices keyed beginner/intermediate/advanced', () => {
    const tiers = computeSurfCallTiers(null, [], makeBeach());
    expect(Object.keys(tiers).sort()).toEqual(['advanced', 'beginner', 'intermediate']);
    expect(tiers.beginner.verdict).toMatch(/YES|MAYBE|NO/);
    expect(tiers.intermediate.verdict).toMatch(/YES|MAYBE|NO/);
    expect(tiers.advanced.verdict).toMatch(/YES|MAYBE|NO/);
  });
});
