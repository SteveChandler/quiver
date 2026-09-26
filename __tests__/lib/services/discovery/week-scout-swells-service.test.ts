/**
 * @jest-environment node
 */

const mockEvaluateMajorEventHoldCandidates = jest.fn();
jest.mock('@/lib/recommendations/major-event-hold/service', () => ({
  evaluateMajorEventHoldCandidates: (...args: unknown[]) => mockEvaluateMajorEventHoldCandidates(...args),
}));
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(async () => ({ data: [], error: null })),
      })),
    })),
  })),
}));

import { generateWeekScoutForecast, type WeekScoutRequest } from '@/lib/services/discovery/week-scout';
import { expectConsoleWarnings } from '@/__tests__/setup/test-utils';
import { NOW, TIMEZONE, localDate } from '@/__tests__/helpers/swell-events';
import {
  BLACKS,
  SCRIPPS,
  weekScoutSwellDependencies as dependencies,
} from '@/__tests__/helpers/week-scout-swells';

const REQUEST: WeekScoutRequest = {
  candidateBeachIds: [BLACKS, SCRIPPS],
  localTimezone: TIMEZONE,
  startLocalDate: localDate(0),
  dayCount: 7,
};

describe('generateWeekScoutForecast swells', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEvaluateMajorEventHoldCandidates.mockImplementation(
      async ({ candidates }: { candidates: Array<{ candidateId: string }> }) => candidates.map(({ candidateId }) => ({
        candidateId,
        evaluation: { outcome: 'allow', holdIds: [], holdEpoch: 'swells-epoch' },
        recommendationAvailability: { state: 'available', holdEpoch: 'swells-epoch' },
      })),
    );
  });

  it('adds swells whose best windows are windows in the same response', async () => {
    const deps = dependencies();
    const response = await generateWeekScoutForecast('user-swells', { ...REQUEST, includeSwells: true }, deps);

    expect(response.swells).toHaveLength(1);
    const [swell] = response.swells ?? [];
    expect(swell).toMatchObject({ directionLabel: 'W', peakLocalDate: localDate(3), timezone: TIMEZONE });
    const windowsById = new Map(response.days.flatMap((day) => day.windows.map((item) => [item.id, { day, item }])));
    expect(swell.beaches.map((row) => row.beachId).sort()).toEqual([BLACKS, SCRIPPS].sort());
    for (const row of swell.beaches) {
      const named = windowsById.get(row.bestWindow?.windowId ?? '');
      expect(named?.item).toMatchObject({ id: row.bestWindow?.windowId, beachId: row.beachId, isBeachDayBest: true });
      expect(named?.day.localDate).toBe(row.bestWindow?.localDate);
    }
    expect(deps.loadSwellSnapshots).toHaveBeenCalledWith(
      [BLACKS, SCRIPPS], new Date(NOW.getTime() - 4 * 24 * 60 * 60 * 1000),
    );
    expect(deps.loadSwellCrossingHistory).toHaveBeenCalledWith(
      [BLACKS, SCRIPPS], new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000),
    );
    expect(deps.loadSwellHistory).toHaveBeenCalledWith(
      [BLACKS, SCRIPPS], new Date(NOW.getTime() - 48 * 60 * 60 * 1000), NOW,
    );
    // The past read never widens the forecast fetch that drives windows.
    expect(deps.fetchForecasts).toHaveBeenCalledTimes(1);
    expect(jest.mocked(deps.fetchForecasts).mock.calls[0][1]).toBe(24 * 8);
    const blacksBestWindow = swell.beaches.find((row) => row.beachId === BLACKS)?.bestWindow;
    expect(blacksBestWindow?.waveHeight).toBe(windowsById.get(blacksBestWindow?.windowId ?? '')?.item.forecast.waveHeight);
  });

  it('keeps swells when the past-rows read fails', async () => {
    const deps = dependencies();
    deps.loadSwellHistory = jest.fn(async () => { throw new Error('timeout'); });
    const response = await generateWeekScoutForecast('user-swells', { ...REQUEST, includeSwells: true }, deps);
    expect(response.swells).toHaveLength(1);
    expectConsoleWarnings([/past swell rows failed; baseline limited to forecast rows/]);
  });

  it('leaves the field absent and reads nothing when swells are not requested', async () => {
    const deps = dependencies();
    const response = await generateWeekScoutForecast('user-swells', REQUEST, deps);
    expect(response).not.toHaveProperty('swells');
    expect(deps.loadSwellSnapshots).not.toHaveBeenCalled();
    expect(deps.loadSwellCrossingHistory).not.toHaveBeenCalled();
  });

  it('omits swells, and changes nothing else, when snapshots fail', async () => {
    const baseline = await generateWeekScoutForecast('user-swells', REQUEST, dependencies());
    const deps = dependencies();
    deps.loadSwellSnapshots = jest.fn(async () => { throw new Error('relation does not exist'); });

    const response = await generateWeekScoutForecast('user-swells', { ...REQUEST, includeSwells: true }, deps);

    expect(response).not.toHaveProperty('swells');
    expect(response).toEqual(baseline);
    expectConsoleWarnings([/swell snapshots failed; omitting swells/]);
  });

  it('keeps swells without rarity when crossing history fails', async () => {
    const deps = dependencies();
    deps.loadSwellCrossingHistory = jest.fn(async () => { throw new Error('rpc missing'); });
    const response = await generateWeekScoutForecast('user-swells', { ...REQUEST, includeSwells: true }, deps);
    expect(response.swells).toHaveLength(1);
    expectConsoleWarnings([/swell crossing history failed; omitting crossing rarity/]);
  });

  it('omits swells when snapshots run past the budget', async () => {
    const deps = dependencies();
    deps.loadSwellSnapshots = jest.fn(() => new Promise<never>(() => undefined));
    const started = Date.now();
    const response = await generateWeekScoutForecast('user-swells', { ...REQUEST, includeSwells: true }, deps);
    expect(response).not.toHaveProperty('swells');
    expect(Date.now() - started).toBeLessThan(5000);
    expectConsoleWarnings([/swell snapshots timed out; omitting swells/]);
  });
});
