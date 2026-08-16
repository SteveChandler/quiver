import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { NotificationType } from "@/lib/notifications/registry";
import type { EnqueueResult } from "@/lib/notifications/types";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { enqueueNotification } from "@/lib/notifications/enqueue";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import { withCronOutcome, type CronOutcomeOptions } from "@/lib/cron/outcome";

export interface HomeBeachPushProfileRow {
  id: string;
  home_beach_id: string | null;
  timezone?: string | null;
  notif_push_enabled?: boolean | null;
  notif_reminders?: boolean | null;
}

export interface HomeBeachPushSelectArgs {
  supabase?: ReturnType<typeof createSupabaseServiceRoleClient>;
  profile: HomeBeachPushProfileRow;
  beach: Beach;
  forecasts: EnhancedForecastEntity[];
  timezone: string;
  now: Date;
}

export type HomeBeachPushSelection<P extends object> =
  | { payload: P; dedupeKey: string }
  | { skipReason: string };

interface HomeBeachPushRunnerOptions<P extends object> {
  contextTag: string;
  enabledEnv: string;
  allowlistEnv: string;
  type: NotificationType;
  lookaheadHours: number;
  profileSelectExtraFields?: string[];
  createAdditionalSummary?: () => Record<string, unknown>;
  deliveryMode?: "deliver" | "shadow";
  selectAndBuild: (
    args: HomeBeachPushSelectArgs
  ) => HomeBeachPushSelection<P> | Promise<HomeBeachPushSelection<P>>;
  afterEnqueue?: (args: {
    supabase: ReturnType<typeof createSupabaseServiceRoleClient>;
    profile: HomeBeachPushProfileRow;
    beach: Beach;
    forecasts: EnhancedForecastEntity[];
    timezone: string;
    now: Date;
    selection: { payload: P; dedupeKey: string };
    enqueueResult: EnqueueResult;
    summary: HomeBeachPushRunSummary;
  }) => Promise<void>;
  afterShadowSelection?: (args: {
    supabase: ReturnType<typeof createSupabaseServiceRoleClient>;
    profile: HomeBeachPushProfileRow;
    beach: Beach;
    forecasts: EnhancedForecastEntity[];
    timezone: string;
    now: Date;
    selection: { payload: P; dedupeKey: string };
    summary: HomeBeachPushRunSummary;
  }) => Promise<void>;
  outcome?: CronOutcomeOptions<HomeBeachPushRunSummary>;
}

export interface HomeBeachPushRunSummary {
  skipped: boolean;
  reason?: string;
  evaluated: number;
  candidates: number;
  sent: number;
  duplicates: number;
  testAllowlistActive: boolean;
  skippedCounts: Record<string, number>;
  errors: number;
  durationMs: number;
  [key: string]: unknown;
}

function createSkippedCounts(): Record<string, number> {
  return {
    disabledPrefs: 0,
    noHomeBeach: 0,
    notInAllowlist: 0,
    noBeach: 0,
    noForecast: 0,
    enqueueFailed: 0,
  };
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

export function parseHomeBeachPushAllowlist(envName: string): Set<string> {
  const raw = process.env[envName] ?? "";
  return new Set(
    raw
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

export function isEligibleHomeBeachPushProfile(
  profile: HomeBeachPushProfileRow,
  allowlist: Set<string>
): boolean {
  if (!profile.home_beach_id) return false;
  if (profile.notif_push_enabled === false) return false;
  if (profile.notif_reminders === false) return false;
  if (allowlist.size > 0 && !allowlist.has(profile.id)) return false;
  return true;
}

async function loadProfiles(
  supabase: any,
  extraFields: string[] = []
): Promise<HomeBeachPushProfileRow[]> {
  const selectFields = [
    "id",
    "home_beach_id",
    "timezone",
    "notif_push_enabled",
    "notif_reminders",
    ...extraFields,
  ].join(", ");

  const { data, error } = await supabase
    .from("profiles")
    .select(selectFields)
    .not("home_beach_id", "is", null);

  if (error) {
    throw new Error(`Failed to query profiles: ${error.message}`);
  }
  return (data ?? []) as HomeBeachPushProfileRow[];
}

async function loadBeaches(
  supabase: any,
  beachIds: string[]
): Promise<Map<string, Beach>> {
  if (beachIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("beaches")
    .select("*")
    .in("id", beachIds)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Failed to query beaches: ${error.message}`);
  }

  const byId = new Map<string, Beach>();
  for (const row of (data ?? []) as Beach[]) {
    byId.set(row.id, row);
  }
  return byId;
}

async function loadForecasts(
  supabase: any,
  beachId: string,
  now: Date,
  lookaheadHours: number
): Promise<EnhancedForecastEntity[]> {
  const horizon = new Date(now.getTime() + lookaheadHours * 60 * 60 * 1000);
  const { data, error } = await supabase
    .from("enhanced_forecasts")
    .select("*")
    .eq("beach_id", beachId)
    .gte("forecast_at", now.toISOString())
    .lt("forecast_at", horizon.toISOString())
    .order("forecast_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to query forecasts for ${beachId}: ${error.message}`);
  }
  return (data ?? []) as EnhancedForecastEntity[];
}

export async function runHomeBeachPushCron<P extends object>(
  request: Request,
  options: HomeBeachPushRunnerOptions<P>
): Promise<Response> {
  const startedAt = Date.now();

  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    const summary: HomeBeachPushRunSummary = {
      skipped: false,
      evaluated: 0,
      candidates: 0,
      sent: 0,
      shadowMatches: 0,
      duplicates: 0,
      testAllowlistActive: false,
      skippedCounts: createSkippedCounts(),
      errors: 0,
      durationMs: 0,
      ...(options.createAdditionalSummary?.() ?? {}),
    };

    const respond = async (value: HomeBeachPushRunSummary): Promise<Response> =>
      createSuccessResponse(
        options.outcome
          ? await withCronOutcome(options.outcome, async () => value)
          : value,
      );

    if (process.env[options.enabledEnv] !== "true") {
      summary.skipped = true;
      summary.reason = "disabled";
      summary.durationMs = Date.now() - startedAt;
      return respond(summary);
    }

    const allowlist = parseHomeBeachPushAllowlist(options.allowlistEnv);
    summary.testAllowlistActive = allowlist.size > 0;
    const supabase = createSupabaseServiceRoleClient();
    const profiles = await loadProfiles(supabase, options.profileSelectExtraFields);
    const eligibleProfiles: HomeBeachPushProfileRow[] = [];

    for (const profile of profiles) {
      summary.evaluated++;
      if (!profile.home_beach_id) {
        increment(summary.skippedCounts, "noHomeBeach");
        continue;
      }
      if (
        profile.notif_push_enabled === false ||
        profile.notif_reminders === false
      ) {
        increment(summary.skippedCounts, "disabledPrefs");
        continue;
      }
      if (allowlist.size > 0 && !allowlist.has(profile.id)) {
        increment(summary.skippedCounts, "notInAllowlist");
        continue;
      }
      eligibleProfiles.push(profile);
    }

    summary.candidates = eligibleProfiles.length;
    const beachIds = Array.from(
      new Set(
        eligibleProfiles
          .map((profile) => profile.home_beach_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const beachesById = await loadBeaches(supabase, beachIds);
    const now = new Date();

    for (const profile of eligibleProfiles) {
      try {
        const beachId = profile.home_beach_id;
        if (!beachId) continue;
        const beach = beachesById.get(beachId);
        if (!beach) {
          increment(summary.skippedCounts, "noBeach");
          continue;
        }

        const timezone = resolveBeachTimezone(profile.timezone ?? beach.timezone);
        const forecasts = await loadForecasts(
          supabase,
          beachId,
          now,
          options.lookaheadHours
        );
        if (forecasts.length === 0) {
          increment(summary.skippedCounts, "noForecast");
          continue;
        }

        const selection = await options.selectAndBuild({
          supabase,
          profile,
          beach,
          forecasts,
          timezone,
          now,
        });
        if ("skipReason" in selection) {
          increment(summary.skippedCounts, selection.skipReason);
          continue;
        }

        if (options.deliveryMode === "shadow") {
          summary.shadowMatches = Number(summary.shadowMatches ?? 0) + 1;
          await options.afterShadowSelection?.({
            supabase,
            profile,
            beach,
            forecasts,
            timezone,
            now,
            selection,
            summary,
          });
          continue;
        }

        const enqueueResult = await enqueueNotification(
          {
            type: options.type,
            recipientUserId: profile.id,
            payload: selection.payload as Record<string, unknown>,
            dedupeKey: selection.dedupeKey,
          },
          supabase
        );

        if (enqueueResult.enqueued) {
          summary.sent++;
          await options.afterEnqueue?.({
            supabase,
            profile,
            beach,
            forecasts,
            timezone,
            now,
            selection,
            enqueueResult,
            summary,
          });
          continue;
        }
        if (enqueueResult.reason === "duplicate") {
          summary.duplicates++;
          await options.afterEnqueue?.({
            supabase,
            profile,
            beach,
            forecasts,
            timezone,
            now,
            selection,
            enqueueResult,
            summary,
          });
          continue;
        }

        increment(summary.skippedCounts, "enqueueFailed");
        summary.errors++;
      } catch (profileError) {
        console.error(`${options.contextTag} Error processing ${profile.id}:`, profileError);
        summary.errors++;
      }
    }

    summary.durationMs = Date.now() - startedAt;
    return respond(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
