/**
 * @jest-environment node
 */

import fixture from '@/__tests__/fixtures/weekend-scout-v1.json';
import {
  createOrGetWeekendScoutSnapshot,
  loadWeekendScoutSnapshot,
  type WeekendScoutSnapshotDependencies,
  type WeekendScoutSnapshotRow,
} from '@/lib/services/discovery/weekend-scout-snapshots';
import { parseWeekendScoutRanking } from '@/lib/services/discovery/weekend-scout-contract';

const ranking = parseWeekendScoutRanking((({ snapshotId: _snapshotId, ...value }) => value)(fixture));

function row(): WeekendScoutSnapshotRow {
  return {
    id: fixture.snapshotId,
    user_id: 'user-1',
    weekend_start: fixture.weekendStart,
    weekend_end: fixture.weekendEnd,
    generated_at: fixture.generatedAt,
    location_captured_at: fixture.locationCapturedAt,
    location_timezone: fixture.timezone,
    max_drive_minutes: 45,
    qualifying_count: fixture.qualifyingCount,
    lead_beach_id: fixture.results[0].beachId,
    lead_beach_name: fixture.results[0].beachName,
    lead_window_local: fixture.results[0].bestWindow.localLabel,
    scorer_version: fixture.scorerVersion,
    contract_version: fixture.contractVersion,
    rankings: fixture.results,
  };
}

function dependencies(): WeekendScoutSnapshotDependencies {
  return {
    findForWeekend: jest.fn(async () => null),
    findById: jest.fn(async () => null),
    insert: jest.fn(async () => ({ row: row(), error: null })),
    buildRanking: jest.fn(async () => ({
      status: 'ready' as const,
      ranking,
      maxDriveMinutes: 45,
    })),
  };
}

describe('Weekend Scout snapshots', () => {
  it('returns an existing immutable snapshot without reranking', async () => {
    const deps = dependencies();
    deps.findForWeekend = jest.fn(async () => row());

    const result = await createOrGetWeekendScoutSnapshot(
      'user-1',
      fixture.weekendStart,
      deps,
    );

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('expected ready');
    expect(result.snapshot).toEqual(fixture);
    expect(result.leadBeachName).toBe("Black's");
    expect(deps.buildRanking).not.toHaveBeenCalled();
    expect(deps.insert).not.toHaveBeenCalled();
  });

  it('inserts the exact ranking fields only when no snapshot exists', async () => {
    const deps = dependencies();

    const result = await createOrGetWeekendScoutSnapshot(
      'user-1',
      fixture.weekendStart,
      deps,
    );

    expect(result.status).toBe('ready');
    expect(deps.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      weekend_start: fixture.weekendStart,
      qualifying_count: 3,
      lead_beach_id: fixture.results[0].beachId,
      lead_beach_name: "Black's",
      lead_window_local: 'Saturday morning',
      rankings: fixture.results,
    }));
  });

  it('reloads the winner of a uniqueness race', async () => {
    const deps = dependencies();
    deps.findForWeekend = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(row());
    deps.insert = jest.fn(async () => ({
      row: null,
      error: { code: '23505', message: 'duplicate key' },
    }));

    const result = await createOrGetWeekendScoutSnapshot(
      'user-1',
      fixture.weekendStart,
      deps,
    );

    expect(result.status).toBe('ready');
    expect(deps.findForWeekend).toHaveBeenCalledTimes(2);
  });

  it('does not persist when no beaches meet the quality floor', async () => {
    const deps = dependencies();
    deps.buildRanking = jest.fn(async () => ({ status: 'no_qualifying_windows' as const }));

    const result = await createOrGetWeekendScoutSnapshot(
      'user-1',
      fixture.weekendStart,
      deps,
    );

    expect(result).toEqual({ status: 'no_qualifying_windows' });
    expect(deps.insert).not.toHaveBeenCalled();
  });

  it('loads a snapshot with both owner and snapshot identity', async () => {
    const deps = dependencies();
    deps.findById = jest.fn(async () => row());

    const result = await loadWeekendScoutSnapshot('user-1', fixture.snapshotId, deps);

    expect(deps.findById).toHaveBeenCalledWith('user-1', fixture.snapshotId);
    expect(result?.snapshot).toEqual(fixture);
  });
});
