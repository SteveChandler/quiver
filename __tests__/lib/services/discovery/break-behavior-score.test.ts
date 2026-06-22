import {
  aggregateBreakBehaviorSessions,
  applyBreakBehaviorScore,
  calculateBreakBehaviorScore,
  fetchBreakBehaviorSessionRows,
  type BreakBehaviorScoreResult,
  type BreakBehaviorSessionRow,
} from '@/lib/services/discovery/break-behavior-score';
import type { EnhancedForecastEntity } from '@/types/forecast';

function makeSession(
  overrides: Partial<BreakBehaviorSessionRow> = {}
): BreakBehaviorSessionRow {
  return {
    beach_id: 'beach-1',
    user_id: 'user-1',
    status: 'completed',
    arrival_time: '2026-06-01T14:00:00Z',
    created_at: '2026-05-30T12:00:00Z',
    wave_height_ft: 3,
    wind_speed_mph: 7,
    wind_direction: 'W',
    tide_status: 'rising',
    ...overrides,
  };
}

function makeForecast(
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity {
  return {
    id: 'forecast-1',
    beach_id: 'beach-1',
    forecast_at: '2026-06-20T14:00:00Z',
    forecast_date: '2026-06-20',
    forecast_time: '14:00:00',
    wave_height: '3 ft',
    wave_period: '12s',
    wind_speed: '7 mph',
    wind_direction: 'W',
    wind_direction_deg: 270,
    tide_status: 'Rising',
    confidence_score: 80,
    ...overrides,
  } as EnhancedForecastEntity;
}

function makeScoreResult(
  overrides: Partial<BreakBehaviorScoreResult> = {}
): BreakBehaviorScoreResult {
  return {
    score: 8,
    confidenceLabel: 'medium',
    components: {
      completedSessionRate: 0.8,
      repeatUserRate: 0.4,
      recentSessionActivity: 0.6,
      conditionMatchHistory: 0.5,
    },
    penalties: {
      sparseData: 0,
      highIntentLowCompletion: 0,
      staleBehavior: 0,
    },
    reasons: ['Completed sessions support this break'],
    ...overrides,
  };
}

describe('break behavior score', () => {
  it('adds a capped positive score for completed repeat behavior in matching conditions', () => {
    const aggregate = {
      plannedSessions: 24,
      completedSessions: 20,
      uniqueUsers: 10,
      repeatUsers: 6,
      repeatCompletedSessionUsers: 5,
      recentCompletedSessions: 8,
      conditionObservedSessions: 12,
      conditionMatchedSessions: 7,
    };

    const result = calculateBreakBehaviorScore(aggregate);

    expect(result.score).toBeGreaterThan(7);
    expect(result.score).toBeLessThanOrEqual(12);
    expect(result.confidenceLabel).toBe('high');
    expect(result.components.completedSessionRate).toBeCloseTo(20 / 24, 3);
    expect(result.components.repeatUserRate).toBeCloseTo(0.5, 3);
    expect(result.components.conditionMatchHistory).toBeGreaterThan(0);
    expect(result.reasons).toContain('Completed-session history supports this break');
  });

  it('does not boost sparse breaks', () => {
    const result = calculateBreakBehaviorScore({
      plannedSessions: 2,
      completedSessions: 2,
      uniqueUsers: 2,
      repeatUsers: 0,
      repeatCompletedSessionUsers: 0,
      recentCompletedSessions: 2,
      conditionObservedSessions: 2,
      conditionMatchedSessions: 2,
    });

    expect(result.score).toBe(0);
    expect(result.confidenceLabel).toBe('sparse');
    expect(result.penalties.sparseData).toBeGreaterThan(0);
  });

  it('penalizes high intent with low completion', () => {
    const result = calculateBreakBehaviorScore({
      plannedSessions: 20,
      completedSessions: 3,
      uniqueUsers: 14,
      repeatUsers: 4,
      repeatCompletedSessionUsers: 0,
      recentCompletedSessions: 1,
      conditionObservedSessions: 3,
      conditionMatchedSessions: 1,
    });

    expect(result.score).toBeLessThan(2);
    expect(result.penalties.highIntentLowCompletion).toBeGreaterThan(0);
    expect(result.reasons).toContain('High planned volume has low completion');
  });

  it('derives condition match history from completed sessions near the current forecast', () => {
    const now = new Date('2026-06-20T00:00:00Z');
    const rows = [
      makeSession({ user_id: 'user-1', wave_height_ft: 3.2, wind_speed_mph: 8, wind_direction: 'W', tide_status: 'Rising' }),
      makeSession({ user_id: 'user-1', wave_height_ft: 2.8, wind_speed_mph: 6, wind_direction: 'WNW', tide_status: 'rising' }),
      makeSession({ user_id: 'user-2', wave_height_ft: 6, wind_speed_mph: 18, wind_direction: 'E', tide_status: 'falling' }),
      makeSession({ user_id: 'user-3', status: 'planned', wave_height_ft: 3, wind_speed_mph: 7, wind_direction: 'W', tide_status: 'Rising' }),
    ];

    const aggregate = aggregateBreakBehaviorSessions(rows, makeForecast(), { now });

    expect(aggregate.plannedSessions).toBe(4);
    expect(aggregate.completedSessions).toBe(3);
    expect(aggregate.conditionObservedSessions).toBe(3);
    expect(aggregate.conditionMatchedSessions).toBe(2);
    expect(aggregate.repeatCompletedSessionUsers).toBe(1);
  });

  it('does not let behavior override objectively poor forecast scores', () => {
    const applied = applyBreakBehaviorScore(32, makeScoreResult({ score: 12 }));

    expect(applied.score).toBe(32);
    expect(applied.appliedBehaviorScore).toBe(0);
    expect(applied.suppressed).toBe(true);
  });

  it('caps applied behavior boost on surfable forecasts', () => {
    const applied = applyBreakBehaviorScore(
      82,
      makeScoreResult({ score: 30 })
    );

    expect(applied.score).toBe(94);
    expect(applied.appliedBehaviorScore).toBe(12);
    expect(applied.suppressed).toBe(false);
  });

  it('filters mock and system profile rows when fetching behavior sessions', async () => {
    const sessionRows = [
      makeSession({ user_id: 'real-user' }),
      makeSession({ user_id: 'mock-user' }),
      makeSession({ user_id: 'system-user' }),
      makeSession({ user_id: 'deleted-user' }),
    ];
    const profileRows = [
      {
        id: 'real-user',
        deleted_at: null,
        is_mock: false,
        analytics_is_real_user: true,
        is_system_account: false,
      },
      {
        id: 'mock-user',
        deleted_at: null,
        is_mock: true,
        analytics_is_real_user: false,
        is_system_account: false,
      },
      {
        id: 'system-user',
        deleted_at: null,
        is_mock: false,
        analytics_is_real_user: true,
        is_system_account: true,
      },
      {
        id: 'deleted-user',
        deleted_at: '2026-06-01T00:00:00Z',
        is_mock: false,
        analytics_is_real_user: true,
        is_system_account: false,
      },
    ];
    const sessionQuery: any = {
      select: jest.fn(() => sessionQuery),
      in: jest.fn(() => sessionQuery),
      is: jest.fn(() => sessionQuery),
      gte: jest.fn(() => sessionQuery),
      order: jest.fn(() => sessionQuery),
      limit: jest.fn(async () => ({ data: sessionRows, error: null })),
    };
    const profileQuery: any = {
      select: jest.fn(() => profileQuery),
      in: jest.fn(async () => ({ data: profileRows, error: null })),
    };
    const supabase = {
      from: jest.fn((table: string) =>
        table === 'sessions' ? sessionQuery : profileQuery
      ),
    };

    const rows = await fetchBreakBehaviorSessionRows(
      supabase as any,
      ['beach-1'],
      { now: new Date('2026-06-20T00:00:00Z') }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe('real-user');
  });
});
