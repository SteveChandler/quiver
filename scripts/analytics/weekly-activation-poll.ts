import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  assertNoPiiInWeeklyActivationPollOutput,
  buildWeeklyActivationPollOutput,
  type WeeklyActivationBoardRow,
  type WeeklyActivationEventRow,
  type WeeklyActivationProfileRow,
  type WeeklyActivationSessionRow,
} from "../../lib/analytics/weekly-activation-poll";
import { loadSeoEnv } from "../seo/load-env";

loadSeoEnv();

const outputPath = getFlag("--output");
const posthogProfileCount = optionalNumber(getFlag("--posthog-profile-count") ?? process.env.POSTHOG_REAL_USER_PROFILE_COUNT);
const generatedAt = new Date().toISOString();
const dateRange = defaultDateRange();

void main();

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missingSources: string[] = [];

  if (!supabaseUrl || !serviceRoleKey) {
    missingSources.push("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    writeOutput(buildWeeklyActivationPollOutput({
      generatedAt,
      dateRange,
      profiles: [],
      sessions: [],
      boards: [],
      events: [],
      posthogRealUserProfileCount: posthogProfileCount,
      missingSources,
      supabaseAvailable: false,
      usedScriptedFallback: true,
    }));
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { profiles, missing: profileMissing } = await fetchProfiles(supabase);
  missingSources.push(...profileMissing);

  const [sessions, boards, events] = await Promise.all([
    fetchPaged<WeeklyActivationSessionRow>(() =>
      supabase
        .from("sessions")
        .select("id,user_id,created_at,deleted_at")
    ),
    fetchPaged<WeeklyActivationBoardRow>(() =>
      supabase
        .from("boards")
        .select("id,user_id,created_at")
    ),
    fetchPaged<WeeklyActivationEventRow>(() =>
      supabase
        .from("user_events")
        .select("event_type,user_id,session_id,created_at,bot_flagged,metadata")
        .gte("created_at", dateRange.from)
    ),
  ]);

  writeOutput(buildWeeklyActivationPollOutput({
    generatedAt,
    dateRange,
    profiles,
    sessions,
    boards,
    events,
    posthogRealUserProfileCount: posthogProfileCount,
    missingSources,
    supabaseAvailable: true,
    usedScriptedFallback: true,
  }));
}

async function fetchProfiles(
  supabase: ReturnType<typeof createClient>,
): Promise<{ profiles: WeeklyActivationProfileRow[]; missing: string[] }> {
  const selectWithAnalyticsFields =
    "id,email,is_mock,analytics_is_real_user,analytics_exclusion_reason,created_at,home_beach_id,onboarding_completed_at,experience_level,surf_styles";

  try {
    return {
      profiles: await fetchPaged<WeeklyActivationProfileRow>(() =>
        supabase
          .from("profiles")
          .select(selectWithAnalyticsFields)
      ),
      missing: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const profiles = await fetchPaged<WeeklyActivationProfileRow>(() =>
      supabase
        .from("profiles")
        .select("id,email,is_mock,created_at,home_beach_id,onboarding_completed_at,experience_level,surf_styles")
    );
    return {
      profiles,
      missing: [`profiles.analytics_is_real_user unavailable; fell back to local non-PII classification (${message})`],
    };
  }
}

async function fetchPaged<T>(
  buildQuery: () => {
    range: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>;
  },
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await buildQuery().range(offset, offset + pageSize - 1);
    if (error) throw new Error(readSupabaseError(error));
    const page = Array.isArray(data) ? data as T[] : [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
}

function writeOutput(output: ReturnType<typeof buildWeeklyActivationPollOutput>): void {
  assertNoPiiInWeeklyActivationPollOutput(output);
  const json = `${JSON.stringify(output, null, 2)}\n`;
  if (!outputPath) {
    process.stdout.write(json);
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, json);
  console.log(JSON.stringify({ outputPath }, null, 2));
}

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function readSupabaseError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
}

function optionalNumber(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getFlag(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}
