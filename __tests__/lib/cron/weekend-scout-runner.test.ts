/**
 * @jest-environment node
 */

import fixture from '@/__tests__/fixtures/weekend-scout-v1.json';
import { expectConsoleErrors } from '@/__tests__/setup/test-utils';
import { parseWeekendScoutSnapshot } from '@/lib/services/discovery/weekend-scout-contract';
import type { CreateWeekendScoutSnapshotResult } from '@/lib/services/discovery/weekend-scout-snapshots';
import {
  isLocalFridayNoon,
  runWeekendScoutCron,
  type WeekendScoutCronDependencies,
  type WeekendScoutCronProfile,
} from '@/lib/cron/weekend-scout-runner';

const mockSelectBeach = jest.fn(async <T extends { id: string }>(beach: T | null) => beach);

jest.mock('@/lib/recommendations/selection', () => ({
  selectBeach: (beach: { id: string } | null) => mockSelectBeach(beach),
}));

function profile(overrides: Partial<WeekendScoutCronProfile> = {}): WeekendScoutCronProfile {
  return {
    id: 'user-1',
    notifPushEnabled: true,
    notifReminders: true,
    location: {
      lat: 32.81,
      lon: -117.27,
      timezone: 'America/Los_Angeles',
      capturedAt: '2026-07-24T18:55:00.000Z',
    },
    ...overrides,
  };
}

const snapshot = parseWeekendScoutSnapshot(fixture);

const stored = {
  status: 'ready' as const,
  snapshot,
  maxDriveMinutes: 45,
  leadBeachId: fixture.results[0].beachId,
  leadBeachName: fixture.results[0].beachName,
  leadWindowLocal: fixture.results[0].bestWindow.localLabel,
};

function dependencies(): WeekendScoutCronDependencies {
  return {
    now: new Date('2026-07-24T19:00:00.000Z'),
    validateRequest: jest.fn(() => true),
    loadProfiles: jest.fn(async () => [profile()]),
    createSnapshot: jest.fn(async () => stored),
    enqueue: jest.fn(async () => ({ enqueued: true as const, eventId: 'event-1' })),
  };
}

async function body(response: Response) {
  return response.json() as Promise<{ success: boolean; data: any }>;
}

describe('runWeekendScoutCron', () => {
  const originalEnabled = process.env.WEEKEND_WINDOW_ENABLED;
  const originalAllowlist = process.env.WEEKEND_WINDOW_TEST_USER_IDS;

  beforeEach(() => {
    process.env.WEEKEND_WINDOW_ENABLED = 'true';
    delete process.env.WEEKEND_WINDOW_TEST_USER_IDS;
  });

  afterAll(() => {
    if (originalEnabled === undefined) delete process.env.WEEKEND_WINDOW_ENABLED;
    else process.env.WEEKEND_WINDOW_ENABLED = originalEnabled;
    if (originalAllowlist === undefined) delete process.env.WEEKEND_WINDOW_TEST_USER_IDS;
    else process.env.WEEKEND_WINDOW_TEST_USER_IDS = originalAllowlist;
  });

  it('rejects invalid cron authentication before loading users', async () => {
    const deps = dependencies();
    deps.validateRequest = jest.fn(() => false);
    const response = await runWeekendScoutCron(new Request('http://localhost/cron'), deps);
    expect(response.status).toBe(401);
    expect(deps.loadProfiles).not.toHaveBeenCalled();
  });

  it('returns a skipped summary while the kill switch is off', async () => {
    delete process.env.WEEKEND_WINDOW_ENABLED;
    const deps = dependencies();
    const response = await runWeekendScoutCron(new Request('http://localhost/cron'), deps);
    const result = await body(response);
    expect(result.data).toMatchObject({ skipped: true, reason: 'disabled', sent: 0 });
    expect(deps.loadProfiles).not.toHaveBeenCalled();
  });

  it('filters preferences, allowlist, location freshness, and local Friday noon before ranking', async () => {
    process.env.WEEKEND_WINDOW_TEST_USER_IDS = 'user-1,user-stale,user-future,user-missing,user-wrong-time';
    const deps = dependencies();
    deps.loadProfiles = jest.fn(async () => [
      profile(),
      profile({ id: 'user-disabled', notifReminders: false }),
      profile({ id: 'user-not-allowed' }),
      profile({ id: 'user-missing', location: null }),
      profile({
        id: 'user-stale',
        location: { ...profile().location!, capturedAt: '2026-07-23T18:59:59.999Z' },
      }),
      profile({
        id: 'user-future',
        location: { ...profile().location!, capturedAt: '2026-07-24T19:05:00.001Z' },
      }),
      profile({
        id: 'user-wrong-time',
        location: { ...profile().location!, timezone: 'Pacific/Honolulu' },
      }),
    ]);

    const response = await runWeekendScoutCron(new Request('http://localhost/cron'), deps);
    const result = await body(response);

    expect(result.data.sent).toBe(1);
    expect(result.data.skippedCounts).toMatchObject({
      disabledPrefs: 1,
      notInAllowlist: 1,
      missingLocation: 1,
      staleLocation: 2,
      notLocalFridayNoon: 1,
    });
    expect(deps.createSnapshot).toHaveBeenCalledTimes(1);
  });

  it('enqueues only the stored snapshot summary with a stable weekend dedupe key', async () => {
    const deps = dependencies();
    const response = await runWeekendScoutCron(new Request('http://localhost/cron'), deps);
    const result = await body(response);

    expect(result.data.sent).toBe(1);
    expect(deps.createSnapshot).toHaveBeenCalledWith('user-1', '2026-07-25');
    expect(deps.enqueue).toHaveBeenCalledWith({
      type: 'weekend_window',
      recipientUserId: 'user-1',
      dedupeKey: 'weekend_window:user-1:2026-07-25',
      payload: {
        snapshot_id: fixture.snapshotId,
        weekend_start: fixture.weekendStart,
        weekend_end: fixture.weekendEnd,
        qualifying_count: 3,
        beach_id: fixture.results[0].beachId,
        lead_beach_id: fixture.results[0].beachId,
        lead_beach_name: "Black's",
        lead_window_local: 'Saturday morning',
        forecast_at: fixture.results[0].bestWindow.start,
        policy_context: {
          kind: 'positive_session_recommendation',
          beach_id: fixture.results[0].beachId,
          starts_at: fixture.results[0].bestWindow.start,
          ends_at: fixture.results[0].bestWindow.end,
        },
      },
    });
    expect(mockSelectBeach).toHaveBeenCalledWith({
      id: fixture.results[0].beachId,
      name: fixture.results[0].beachName,
    });
  });

  it('counts build skips, duplicates, and isolated enqueue failures', async () => {
    const deps = dependencies();
    deps.loadProfiles = jest.fn(async () => [
      profile({ id: 'limit' }),
      profile({ id: 'empty' }),
      profile({ id: 'quality' }),
      profile({ id: 'duplicate' }),
      profile({ id: 'failed' }),
    ]);
    deps.createSnapshot = jest.fn(async (
      userId,
    ): Promise<CreateWeekendScoutSnapshotResult> => {
      if (userId === 'limit') return { status: 'candidate_limit_reached' };
      if (userId === 'empty') return { status: 'no_candidates' };
      if (userId === 'quality') return { status: 'no_qualifying_windows' };
      return stored;
    });
    deps.enqueue = jest.fn(async (args) => {
      if (args.recipientUserId === 'duplicate') {
        return { enqueued: false as const, reason: 'duplicate' as const };
      }
      throw new Error('queue unavailable');
    });

    const result = await body(await runWeekendScoutCron(new Request('http://localhost/cron'), deps));
    expectConsoleErrors([/Enqueue failed for failed/]);

    expect(result.data).toMatchObject({ sent: 0, duplicates: 1, errors: 1 });
    expect(result.data.skippedCounts).toMatchObject({
      candidateLimitReached: 1,
      noCandidates: 1,
      noQualifyingWindows: 1,
      enqueueFailed: 1,
    });
  });
});

describe('isLocalFridayNoon', () => {
  it('covers both UTC date boundaries for Friday noon', () => {
    expect(isLocalFridayNoon(new Date('2026-07-23T22:00:00.000Z'), 'Pacific/Kiritimati')).toBe(true);
    expect(isLocalFridayNoon(new Date('2026-07-25T00:00:00.000Z'), 'Etc/GMT+12')).toBe(true);
    expect(isLocalFridayNoon(new Date('2026-07-24T18:00:00.000Z'), 'America/Los_Angeles')).toBe(false);
  });
});
