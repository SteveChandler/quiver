import 'server-only';

import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import {
  parseWeekendScoutSnapshot,
  type WeekendScoutSnapshotV1,
} from '@/lib/services/discovery/weekend-scout-contract';
import {
  buildWeekendScoutRanking,
  type WeekendScoutBuildResult,
} from '@/lib/services/discovery/weekend-scout';

export interface WeekendScoutSnapshotRow {
  id: string;
  user_id: string;
  weekend_start: string;
  weekend_end: string;
  generated_at: string;
  location_captured_at: string;
  location_timezone: string;
  max_drive_minutes: number;
  qualifying_count: number;
  lead_beach_id: string;
  lead_beach_name: string;
  lead_window_local: string;
  scorer_version: string;
  contract_version: string;
  rankings: unknown;
}

export interface WeekendScoutSnapshotInsert {
  user_id: string;
  weekend_start: string;
  weekend_end: string;
  generated_at: string;
  location_captured_at: string;
  location_timezone: string;
  max_drive_minutes: number;
  qualifying_count: number;
  lead_beach_id: string;
  lead_beach_name: string;
  lead_window_local: string;
  scorer_version: string;
  contract_version: string;
  rankings: WeekendScoutSnapshotV1['results'];
}

interface SnapshotInsertError {
  code?: string;
  message: string;
}

export interface WeekendScoutSnapshotDependencies {
  findForWeekend: (userId: string, weekendStart: string) => Promise<WeekendScoutSnapshotRow | null>;
  findById: (userId: string, snapshotId: string) => Promise<WeekendScoutSnapshotRow | null>;
  insert: (
    input: WeekendScoutSnapshotInsert,
  ) => Promise<{ row: WeekendScoutSnapshotRow | null; error: SnapshotInsertError | null }>;
  buildRanking: (userId: string) => Promise<WeekendScoutBuildResult>;
}

export interface StoredWeekendScoutSnapshot {
  snapshot: WeekendScoutSnapshotV1;
  maxDriveMinutes: number;
  leadBeachId: string;
  leadBeachName: string;
  leadWindowLocal: string;
}

export type CreateWeekendScoutSnapshotResult =
  | ({ status: 'ready' } & StoredWeekendScoutSnapshot)
  | Exclude<WeekendScoutBuildResult, { status: 'ready' }>;

function defaultDependencies(): WeekendScoutSnapshotDependencies {
  const supabase = createSupabaseServiceRoleClient();
  const select = '*';

  return {
    findForWeekend: async (userId, weekendStart) => {
      const { data, error } = await (supabase as any)
        .from('weekend_scout_snapshots')
        .select(select)
        .eq('user_id', userId)
        .eq('weekend_start', weekendStart)
        .maybeSingle();
      if (error) throw new Error(`Failed to load Weekend Scout snapshot: ${error.message}`);
      return (data ?? null) as WeekendScoutSnapshotRow | null;
    },
    findById: async (userId, snapshotId) => {
      const { data, error } = await (supabase as any)
        .from('weekend_scout_snapshots')
        .select(select)
        .eq('user_id', userId)
        .eq('id', snapshotId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load Weekend Scout snapshot: ${error.message}`);
      return (data ?? null) as WeekendScoutSnapshotRow | null;
    },
    insert: async (input) => {
      const { data, error } = await (supabase as any)
        .from('weekend_scout_snapshots')
        .insert(input)
        .select(select)
        .single();
      return {
        row: (data ?? null) as WeekendScoutSnapshotRow | null,
        error: error ? { code: error.code, message: error.message } : null,
      };
    },
    buildRanking: (userId) => buildWeekendScoutRanking(userId),
  };
}

function parseRow(row: WeekendScoutSnapshotRow): StoredWeekendScoutSnapshot {
  return {
    snapshot: parseWeekendScoutSnapshot({
      snapshotId: row.id,
      contractVersion: row.contract_version,
      weekendStart: row.weekend_start,
      weekendEnd: row.weekend_end,
      generatedAt: row.generated_at,
      locationCapturedAt: row.location_captured_at,
      timezone: row.location_timezone,
      qualifyingCount: row.qualifying_count,
      scorerVersion: row.scorer_version,
      results: row.rankings,
    }),
    maxDriveMinutes: row.max_drive_minutes,
    leadBeachId: row.lead_beach_id,
    leadBeachName: row.lead_beach_name,
    leadWindowLocal: row.lead_window_local,
  };
}

export async function loadWeekendScoutSnapshot(
  userId: string,
  snapshotId: string,
  dependencies?: WeekendScoutSnapshotDependencies,
): Promise<StoredWeekendScoutSnapshot | null> {
  const deps = dependencies ?? defaultDependencies();
  const row = await deps.findById(userId, snapshotId);
  return row ? parseRow(row) : null;
}

export async function createOrGetWeekendScoutSnapshot(
  userId: string,
  weekendStart: string,
  dependencies?: WeekendScoutSnapshotDependencies,
): Promise<CreateWeekendScoutSnapshotResult> {
  const deps = dependencies ?? defaultDependencies();
  const existing = await deps.findForWeekend(userId, weekendStart);
  if (existing) return { status: 'ready', ...parseRow(existing) };

  const built = await deps.buildRanking(userId);
  if (built.status !== 'ready') return built;
  if (built.ranking.weekendStart !== weekendStart) {
    throw new Error('Weekend Scout ranking does not match the requested weekend');
  }

  const lead = built.ranking.results[0];
  const inserted = await deps.insert({
    user_id: userId,
    weekend_start: built.ranking.weekendStart,
    weekend_end: built.ranking.weekendEnd,
    generated_at: built.ranking.generatedAt,
    location_captured_at: built.ranking.locationCapturedAt,
    location_timezone: built.ranking.timezone,
    max_drive_minutes: built.maxDriveMinutes,
    qualifying_count: built.ranking.qualifyingCount,
    lead_beach_id: lead.beachId,
    lead_beach_name: lead.beachName,
    lead_window_local: lead.bestWindow.localLabel,
    scorer_version: built.ranking.scorerVersion,
    contract_version: built.ranking.contractVersion,
    rankings: built.ranking.results,
  });
  if (inserted.row) return { status: 'ready', ...parseRow(inserted.row) };

  if (inserted.error?.code === '23505') {
    const winner = await deps.findForWeekend(userId, weekendStart);
    if (winner) return { status: 'ready', ...parseRow(winner) };
  }

  throw new Error(`Failed to store Weekend Scout snapshot: ${inserted.error?.message ?? 'unknown error'}`);
}
