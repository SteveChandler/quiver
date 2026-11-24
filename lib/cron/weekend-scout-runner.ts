import type { EnqueueArgs, EnqueueResult } from '@/lib/notifications/types';
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from '@/lib/middleware/api-wrappers';
import { enqueueNotification } from '@/lib/notifications/enqueue';
import { weekendWindowVariant } from '@/lib/notifications/registry';
import { formatWindowLabel } from '@/lib/notifications/copy/daily-call-copy';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import {
  createOrGetWeekendScoutSnapshot,
  type CreateWeekendScoutSnapshotResult,
} from '@/lib/services/discovery/weekend-scout-snapshots';
import {
  fetchWeekendScoutHomeBeach,
  getWeekendScoutDates,
  resolveWeekendScoutOrigin,
  type WeekendScoutBuildOptions,
  type WeekendScoutLocation,
} from '@/lib/services/discovery/weekend-scout';
import { selectBeach } from '@/lib/recommendations/selection';
import { withCronOutcome, type CronOutcomeOptions } from '@/lib/cron/outcome';
import { getLocalHour } from '@/lib/utils/timezone-utils';

export interface WeekendScoutCronProfile {
  id: string;
  notifPushEnabled: boolean | null;
  notifReminders: boolean | null;
  location: WeekendScoutLocation | null;
  homeBeachId: string | null;
}

export interface WeekendScoutCronDependencies {
  now: Date;
  validateRequest: (request: Request) => boolean;
  loadProfiles: () => Promise<WeekendScoutCronProfile[]>;
  fetchHomeBeach: (beachId: string) => ReturnType<typeof fetchWeekendScoutHomeBeach>;
  createSnapshot: (
    userId: string,
    weekendStart: string,
    options: WeekendScoutBuildOptions,
  ) => Promise<CreateWeekendScoutSnapshotResult>;
  enqueue: (args: EnqueueArgs) => Promise<EnqueueResult>;
}

interface WeekendScoutRunSummary {
  skipped: boolean;
  reason?: string;
  evaluated: number;
  candidates: number;
  homeBeachOrigin: number;
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

type HomeBeach = Awaited<ReturnType<typeof fetchWeekendScoutHomeBeach>>;

/** The home beach embedded in the profiles read; deleted or private beaches give no origin. */
export function homeBeachFromProfileRow(row: { home_beach?: unknown }): HomeBeach {
  const raw = Array.isArray(row.home_beach) ? row.home_beach[0] : row.home_beach;
  if (!raw || typeof raw !== 'object') return null;
  const beach = raw as { id: string; name: string; lat: unknown; lon: unknown; timezone: string | null; deleted_at: string | null; is_private: boolean | null };
  if (beach.deleted_at !== null || beach.is_private === true) return null;
  return { id: beach.id, name: beach.name, lat: beach.lat, lon: beach.lon, timezone: beach.timezone } as HomeBeach;
}

function defaultDependencies(now: Date): WeekendScoutCronDependencies {
  const supabase = createSupabaseServiceRoleClient();
  // Filled by loadProfiles so the hourly run makes no per-user beach query.
  const homeBeaches = new Map<string, HomeBeach>();
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
          home_beach_id,
          home_beach:beaches!profiles_home_beach_id_fkey(id, name, lat, lon, timezone, deleted_at, is_private),
          user_location_snapshots(lat, lon, timezone, captured_at)
        `)
        .is('deleted_at', null);
      if (error) throw new Error(`Failed to load Weekend Scout users: ${error.message}`);
      return (data ?? []).map((row: any): WeekendScoutCronProfile => {
        const joined = Array.isArray(row.user_location_snapshots)
          ? row.user_location_snapshots[0]
          : row.user_location_snapshots;
        if (row.home_beach_id) homeBeaches.set(row.home_beach_id, homeBeachFromProfileRow(row));
        return {
          id: row.id,
          notifPushEnabled: row.notif_push_enabled,
          notifReminders: row.notif_reminders,
          homeBeachId: row.home_beach_id,
          location: joined ? {
            lat: joined.lat,
            lon: joined.lon,
            timezone: joined.timezone,
            capturedAt: joined.captured_at,
          } : null,
        };
      });
    },
    fetchHomeBeach: async (beachId) => (
      homeBeaches.has(beachId) ? homeBeaches.get(beachId) ?? null : fetchWeekendScoutHomeBeach(beachId, supabase)
    ),
    createSnapshot: (userId, weekendStart, options) => (
      createOrGetWeekendScoutSnapshot(userId, weekendStart, undefined, options)
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

function partOfDay(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
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
    homeBeachOrigin: 0,
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
      try {
        const resolved = await resolveWeekendScoutOrigin(profile.location, deps.now, async () => (
          profile.homeBeachId ? deps.fetchHomeBeach(profile.homeBeachId) : null
        ));
        if (resolved.status !== 'ready') {
          increment(summary, skipKey(resolved.status));
          continue;
        }
        const { origin } = resolved;
        if (!isLocalFridayNoon(deps.now, origin.timezone)) {
          increment(summary, 'notLocalFridayNoon');
          continue;
        }

        summary.candidates += 1;
        if (origin.source.kind === 'home_beach') summary.homeBeachOrigin += 1;
        const weekendStart = getWeekendScoutDates(deps.now, origin.timezone).start;
        const created = await deps.createSnapshot(profile.id, weekendStart, { now: deps.now, origin });
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
        const { bestWindow } = leadResult;
        const { leadWindowTimezone } = created;
        const [start, end] = bestWindow.displayWindowStart && bestWindow.displayWindowEnd
          ? [bestWindow.displayWindowStart, bestWindow.displayWindowEnd]
          : [bestWindow.start, bestWindow.end];

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
              lead_wave_height: bestWindow.waveHeight,
              lead_period: bestWindow.period,
              lead_wind_speed: bestWindow.windSpeed,
              lead_wind_direction: bestWindow.windDirection,
              variant_index: weekendWindowVariant(profile.id, created.snapshot.weekendStart),
              ...(leadWindowTimezone ? {
                lead_window_time: formatWindowLabel(start, end, leadWindowTimezone, { forBody: true }),
                lead_window_part_of_day: partOfDay(getLocalHour(new Date(start), leadWindowTimezone)),
              } : {}),
              forecast_at: bestWindow.start,
              policy_context: {
                kind: 'positive_session_recommendation',
                beach_id: created.leadBeachId,
                starts_at: bestWindow.start,
                ends_at: bestWindow.end,
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
