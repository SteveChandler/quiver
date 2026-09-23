/** @jest-environment node */

const mockCalls: string[] = [];
const mockRows: Record<string, unknown> = {};
const mockRpc = jest.fn();
const mockClient = {
  rpc: mockRpc,
  from: (table: string) => {
    const query = {
      select: () => query, eq: () => query, in: () => query,
      gte: () => query, lt: () => query, order: () => query,
      range: () => query, limit: () => query,
      single: () => query, maybeSingle: () => query,
      then: (resolve: (result: { data: unknown; error: null }) => unknown) => {
        mockCalls.push(table);
        return Promise.resolve(resolve({ data: mockRows[table] ?? [], error: null }));
      },
    };
    return query;
  },
};
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: () => mockClient,
}));
jest.mock('@/lib/recommendations/major-event-hold/config', () => ({ MAJOR_EVENT_HOLD_MODE: 'off' }));

import { generateWeekScoutForecastForDays } from '@/lib/services/discovery/week-scout';
import { COUNTY_FEED_SOURCE_IDENTIFIER } from '@/lib/services/county-beach-advisories/types';

const NOW = '2026-09-23T14:00:00.000Z';
const FORECAST_AT = '2026-09-23T16:00:00.000Z';
const BEACH_ID = '11111111-1111-4111-8111-111111111111';

// origin/main f014a93f5: 1 beach + 2 forecast + 1 sun + 1 preference + 1 skill
// + 1 board + 3 personalization + 4 safety reads = 14 for this one-page fixture.
const ORIGIN_MAIN_ROUND_TRIPS = 14;

describe('Week Scout network budget (production dependencies)', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(NOW));
    mockCalls.length = 0;
    mockRpc.mockReset();
    Object.assign(mockRows, {
      beaches: [{
        id: BEACH_ID, name: 'Avalanche', lat: 32.75, lon: -117.25,
        skill_level: 'beginner', break_type: 'beach', timezone: 'America/Los_Angeles',
        wind_offshore_deg: 90, wind_offshore_tol_deg: 45,
        preferred_tide_ft_min: 0, preferred_tide_ft_max: 5,
      }],
      v_enhanced_forecast_latest: [{ beach_id: BEACH_ID, updated_at: NOW, data_source: 'NOAA_NWS' }],
      enhanced_forecasts: [16, 18, 20].map((hour) => ({
        id: `forecast-${hour}`, beach_id: BEACH_ID,
        forecast_at: `2026-09-23T${hour}:00:00.000Z`,
        wave_height: '2.4 ft', wave_period: '10s', wave_direction: 'WNW',
        wind_speed: '5 mph', wind_direction: 'E', wind_direction_deg: 90,
        tide_height: '2.3', tide_status: 'Falling', confidence_score: 86,
        updated_at: NOW, created_at: NOW, data_source: 'NOAA_NWS',
      })),
      sun_times: [{ beach_id: BEACH_ID, sunrise_utc: '2026-09-23T13:30:00Z', sunset_utc: '2026-09-24T02:30:00Z' }],
      week_scout_ranking_context: { learned_prefs: null, implicit_prefs: null, affinity_rows: [] },
      profiles: { experience_level: 'Advanced' },
      boards: [{ board_type: 'longboard' }],
      user_implicit_preferences: null,
      user_beach_affinity: [],
      user_entitlements: { is_pro: true },
      water_quality_held_beaches: [],
      beach_water_quality: [],
      county_beach_advisory_runs: [{
        id: '22222222-2222-4222-8222-222222222222',
        fetched_at: NOW, status: 'completed', source_identifier: COUNTY_FEED_SOURCE_IDENTIFIER,
      }],
      county_beach_advisories: [],
    });
    mockRpc.mockImplementation(async (name: string, args: { p_slots: Array<{ beach_id: string; forecast_at: string }> }) => {
      mockCalls.push(name);
      return {
        data: {
          implicit_prefs: null, affinity_rows: [], entitlement: { is_pro: true },
          matches: args.p_slots.map((slot) => ({ ...slot, result: {
            state: 'learned', score: 6.4, label: 'FAIR', confidence: 'high',
            sessions_in_profile: 25, reason_bullets: ['Session history'],
          } })),
        },
        error: null,
      };
    });
  });

  afterEach(() => jest.useRealTimers());

  it.each([1, 3])('uses fewer round trips than origin/main for %i beaches and no per-beach match RPCs', async (beachCount) => {
    const ids = Array.from({ length: beachCount }, (_, index) => `${index + 1}1111111-1111-4111-8111-111111111111`);
    for (const table of ['beaches', 'v_enhanced_forecast_latest', 'enhanced_forecasts', 'sun_times']) {
      const template = mockRows[table] as Array<Record<string, unknown>>;
      mockRows[table] = ids.flatMap((id) => template.map((row) => ({
        ...row, ...(table === 'beaches' ? { id } : { beach_id: id }),
      })));
    }
    const result = await generateWeekScoutForecastForDays('user-scout', {
      candidateBeachIds: ids, startLocalDate: '2026-09-23',
      localTimezone: 'America/Los_Angeles', dayCount: 1,
    });
    expect(result.days[0].windows.length).toBeGreaterThan(0);
    expect(mockCalls.length).toBeLessThanOrEqual(ORIGIN_MAIN_ROUND_TRIPS);
    expect(mockCalls).toHaveLength(12);
    expect(mockCalls.filter((name) => name === 'week_scout_ranking_context')).toHaveLength(1);
    expect(mockCalls).not.toContain('user_entitlements');
    expect(mockCalls).not.toContain('compute_user_match_score_batch');
    expect(mockCalls).not.toContain('user_implicit_preferences');
    expect(mockCalls).not.toContain('user_beach_affinity');
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('get_week_scout_personalization', expect.objectContaining({
      p_user_id: 'user-scout', p_beach_ids: ids,
      p_slots: expect.arrayContaining([expect.objectContaining({
        beach_id: BEACH_ID, forecast_at: FORECAST_AT, wave_height: '2.4 ft',
        wave_period: '10', wind_speed: '5 mph', wind_direction: '90', tide_height: '2.3',
      })]),
    }));
    expect(new Set((mockRpc.mock.calls[0][1].p_slots as Array<{ beach_id: string }>).map((slot) => slot.beach_id)).size).toBe(beachCount);
    expect(result.days[0].windows.every((window) => window.verdict !== 'worth_it')).toBe(true);
  });
});
