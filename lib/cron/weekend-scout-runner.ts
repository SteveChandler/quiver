import type { EnqueueArgs, EnqueueResult } from '@/lib/notifications/types';
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from '@/lib/middleware/api-wrappers';
import { enqueueNotification } from '@/lib/notifications/enqueue';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import {
  createOrGetWeekendScoutSnapshot,
  type CreateWeekendScoutSnapshotResult,
} from '@/lib/services/discovery/weekend-scout-snapshots';
import { selectBeach } from '@/lib/recommendations/selection';
import { withCronOutcome, type CronOutcomeOptions } from '@/lib/cron/outcome';

const MAX_LOCATION_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_LOCATION_FUTURE_SKEW_MS = 5 * 60 * 1000;

export interface WeekendScoutCronProfile {
  id: string;
  notifPushEnabled: boolean | null;
  notifReminders: boolean | null;
  location: {
    lat: number;
    lon: number;
    timezone: string;
    capturedAt: string;
  } | null;
}

export interface WeekendScoutCronDependencies {
  now: Date;
  validateRequest: (request: Request) => boolean;
  loadProfiles: () => Promise<WeekendScoutCronProfile[]>;
  createSnapshot: (
    userId: string,
    weekendStart: string,
  ) => Promise<CreateWeekendScoutSnapshotResult>;
  enqueue: (args: EnqueueArgs) => Promise<EnqueueResult>;
}

export interface WeekendScoutRunSummary {
  skipped: boolean;
  reason?: string;
  evaluated: number;
  candidates: number;
  sent: number;
  duplicates: number;
  testAllowlistActive: boolean;
  skippedCounts: {
    disabledPrefs: number;
    notInAllowlist: number;
    missingLocation: number;
    staleLocation: number;
    candidateLimitReached: number;
    notLocalFridayNoon: number;
    noCandidates: number;
    noQualifyingWindows: number;
    enqueueFailed: number;
  };
  errors: number;
  durationMs: number;
}

function defaultSkippedCounts(): WeekendScoutRunSummary['skippedCounts'] {
  return {
    disabledPrefs: 0,
    notInAllowlist: 0,
    missingLocation: 0,
    staleLocation: 0,
    candidateLimitReached: 0,
    notLocalFridayNoon: 0,
    noCandidates: 0,
    noQualifyingWindows: 0,
    enqueueFailed: 0,
  };
}

function defaultDependencies(now: Date): WeekendScoutCronDependencies {
  const supabase = createSupabaseServiceRoleClient();
  return {
    now,
    validateRequest: validateCronRequest,
    loadProfiles: async () => {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select(`
          id,
          notif_push_enabled,
          notif_reminders,
          user_location_snapshots(lat, lon, timezone, captured_at)
        `)
        .is('deleted_at', null);
      if (error) throw new Error(`Failed to load Weekend Scout users: ${error.message}`);
      return (data ?? []).map((row: any): WeekendScoutCronProfile => {
        const joined = Array.isArray(row.user_location_snapshots)
          ? row.user_location_snapshots[0]
          : row.user_location_snapshots;
        return {
          id: row.id,
          notifPushEnabled: row.notif_push_enabled,
          notifReminders: row.notif_reminders,
          location: joined ? {
            lat: joined.lat,
            lon: joined.lon,
            timezone: joined.timezone,
            capturedAt: joined.captured_at,
          } : null,
        };
      });
    },
    createSnapshot: (userId, weekendStart) => (
      createOrGetWeekendScoutSnapshot(userId, weekendStart)
    ),
    enqueue: (args) => enqueueNotification(args, supabase),
  };
}

function parseAllowlist(): Set<string> {
  return new Set(
    (process.env.WEEKEND_WINDOW_TEST_USER_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

function localDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string => (
    parts.find((entry) => entry.type === type)?.value ?? ''
  );
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function nextLocalDate(date: Date, timezone: string): string {
  const value = new Date(`${localDate(date, timezone)}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function isLocalFridayNoon(now: Date, timezone: string): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(now);
    const weekday = parts.find((part) => part.type === 'weekday')?.value;
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    return weekday === 'Fri' && hour === 12;
  } catch {
    return false;
  }
}

function increment(
  summary: WeekendScoutRunSummary,
  key: keyof WeekendScoutRunSummary['skippedCounts'],
): void {
  summary.skippedCounts[key] += 1;
}

function skipKey(
  status: Exclude<CreateWeekendScoutSnapshotResult, { status: 'ready' }>['status'],
): keyof WeekendScoutRunSummary['skippedCounts'] {
  const keys = {
    missing_location: 'missingLocation',
    stale_location: 'staleLocation',
    candidate_limit_reached: 'candidateLimitReached',
    no_candidates: 'noCandidates',
    no_qualifying_windows: 'noQualifyingWindows',
  } as const;
  return keys[status];
}

export async function runWeekendScoutCron(
  request: Request,
  dependencies?: WeekendScoutCronDependencies,
  outcome?: CronOutcomeOptions<WeekendScoutRunSummary>,
): Promise<Response> {
  const startedAt = Date.now();
  const deps = dependencies ?? defaultDependencies(new Date());
  if (!deps.validateRequest(request)) {
    return createErrorResponse('Unauthorized', 'Invalid cron authentication', 401);
  }

  const summary: WeekendScoutRunSummary = {
    skipped: false,
    evaluated: 0,
    candidates: 0,
    sent: 0,
    duplicates: 0,
    testAllowlistActive: false,
    skippedCounts: defaultSkippedCounts(),
    errors: 0,
    durationMs: 0,
  };

  const respond = async (value: WeekendScoutRunSummary): Promise<Response> =>
    createSuccessResponse(
      outcome ? await withCronOutcome(outcome, async () => value) : value,
    );

  if (process.env.WEEKEND_WINDOW_ENABLED !== 'true') {
    summary.skipped = true;
    summary.reason = 'disabled';
    summary.durationMs = Date.now() - startedAt;
    return respond(summary);
  }

  try {
    const allowlist = parseAllowlist();
    summary.testAllowlistActive = allowlist.size > 0;
    const profiles = await deps.loadProfiles();

    for (const profile of profiles) {
      summary.evaluated += 1;
      if (profile.notifPushEnabled === false || profile.notifReminders === false) {
        increment(summary, 'disabledPrefs');
        continue;
      }
      if (allowlist.size > 0 && !allowlist.has(profile.id)) {
        increment(summary, 'notInAllowlist');
        continue;
      }
      if (!profile.location) {
        increment(summary, 'missingLocation');
        continue;
      }
      const capturedAt = Date.parse(profile.location.capturedAt);
      if (
        !Number.isFinite(capturedAt)
        || capturedAt > deps.now.getTime() + MAX_LOCATION_FUTURE_SKEW_MS
        || deps.now.getTime() - capturedAt > MAX_LOCATION_AGE_MS
      ) {
        increment(summary, 'staleLocation');
        continue;
      }
      if (!isLocalFridayNoon(deps.now, profile.location.timezone)) {
        increment(summary, 'notLocalFridayNoon');
        continue;
      }

      summary.candidates += 1;
      try {
        const weekendStart = nextLocalDate(deps.now, profile.location.timezone);
        const created = await deps.createSnapshot(profile.id, weekendStart);
        if (created.status !== 'ready') {
          increment(summary, skipKey(created.status));
          continue;
        }

        const safeLeadBeach = created.leadBeachId
          ? await selectBeach({
              id: created.leadBeachId,
              name: created.leadBeachName,
            })
          : null;
        if (!safeLeadBeach) {
          summary.skippedCounts.noCandidates += 1;
          continue;
        }
        const leadResult = created.snapshot.results.find(
          (result) => result.beachId === created.leadBeachId,
        );
        if (!leadResult) {
          summary.skippedCounts.noCandidates += 1;
          continue;
        }

        let enqueueResult: EnqueueResult;
        try {
          enqueueResult = await deps.enqueue({
            type: 'weekend_window',
            recipientUserId: profile.id,
            dedupeKey: `weekend_window:${profile.id}:${created.snapshot.weekendStart}`,
            payload: {
              snapshot_id: created.snapshot.snapshotId,
              weekend_start: created.snapshot.weekendStart,
              weekend_end: created.snapshot.weekendEnd,
              qualifying_count: created.snapshot.qualifyingCount,
              beach_id: created.leadBeachId,
              lead_beach_id: created.leadBeachId,
              lead_beach_name: safeLeadBeach.name,
              lead_window_local: created.leadWindowLocal,
              forecast_at: leadResult.bestWindow.start,
              policy_context: {
                kind: 'positive_session_recommendation',
                beach_id: created.leadBeachId,
                starts_at: leadResult.bestWindow.start,
                ends_at: leadResult.bestWindow.end,
              },
            },
          });
        } catch (error) {
          console.error(`[weekend-scout] Enqueue failed for ${profile.id}:`, error);
          increment(summary, 'enqueueFailed');
          summary.errors += 1;
          continue;
        }
        if (enqueueResult.enqueued) {
          summary.sent += 1;
        } else if (enqueueResult.reason === 'duplicate') {
          summary.duplicates += 1;
        } else {
          increment(summary, 'enqueueFailed');
          summary.errors += 1;
        }
      } catch (error) {
        console.error(`[weekend-scout] Error processing ${profile.id}:`, error);
        summary.errors += 1;
      }
    }

    summary.durationMs = Date.now() - startedAt;
    return respond(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
