import "server-only";

import type { SupabaseServerClient } from "@/types/supabase";
import type { Session } from "@/types/database";

export const SESSION_CREATED_EVENT = "session_created" as const;

export const SESSION_CREATED_NON_NORTH_STAR_EVENTS = [
  "first_session_logged",
  "home_first_session_cta_tap",
  "plan_session_from_intel",
  "session_board_fit_feedback_selected",
  "session_action",
  "session_custom_spot_cta_tapped",
  "session_custom_spot_returned",
  "session_decomposition_selected",
  "session_log_abandon",
  "session_log_beach_selected",
  "session_log_conditions_set",
  "session_log_draft_opened",
  "session_log_draft_progress",
  "session_log_from_intel",
  "session_log_photo_added",
  "session_log_rating_set",
  "session_log_start",
  "session_log_submit",
  "session_log_time_selected",
  "session_log_validation_failed",
  "session_photo_upload_failed",
  "session_photo_upload_started",
  "session_photo_upload_succeeded",
  "session_share_closed_post_save",
  "session_share_opened_post_save",
  "session_spot_search_no_results",
] as const;

type SessionCreatedSource = "web-session-form" | "web-conditions-report";
type SessionCreatedSurface =
  | "sessions/new"
  | "conditions-report"
  | SessionCreatedSource;

type SessionCreatedClient = Pick<SupabaseServerClient, "from">;

interface ProfileAnalyticsFlags {
  analytics_is_real_user?: boolean | null;
  deleted_at?: string | null;
  is_mock?: boolean | null;
  is_system_account?: boolean | null;
}

interface QueryResult<T> {
  count?: number | null;
  data?: T | null;
  error?: { message?: string } | null;
}

interface EmitSessionCreatedEventInput {
  session: Pick<Session, "id" | "beach_id">;
  source: SessionCreatedSource;
  surface: SessionCreatedSurface;
  userId: string;
}

export function isNorthStarSessionEvent(
  eventType: string
): eventType is typeof SESSION_CREATED_EVENT {
  return eventType === SESSION_CREATED_EVENT;
}

function isExcludedProfile(profile: ProfileAnalyticsFlags | null): boolean {
  if (!profile) return false;
  if (profile.is_mock === true) return true;
  if (profile.is_system_account === true) return true;
  if (profile.analytics_is_real_user === false) return true;
  if (profile.deleted_at !== undefined && profile.deleted_at !== null) {
    return true;
  }
  return false;
}

async function fetchProfileAnalyticsFlags(
  supabase: SessionCreatedClient,
  userId: string
): Promise<ProfileAnalyticsFlags | null> {
  try {
    const result = (await supabase
      .from("profiles")
      .select("analytics_is_real_user,deleted_at,is_mock,is_system_account")
      .eq("id", userId)
      .single()) as QueryResult<ProfileAnalyticsFlags> | undefined;

    if (result?.error) {
      console.warn(
        "[session_created] profile exclusion lookup failed:",
        result.error
      );
      return null;
    }

    return result?.data ?? null;
  } catch (error) {
    console.warn("[session_created] profile exclusion lookup threw:", error);
    return null;
  }
}

async function getIsFirstSession(
  supabase: SessionCreatedClient,
  userId: string
): Promise<boolean> {
  try {
    const result = (await supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)) as QueryResult<never> | undefined;

    if (result?.error) {
      console.warn("[session_created] first-session count failed:", result.error);
      return false;
    }

    return result?.count === 1;
  } catch (error) {
    console.warn("[session_created] first-session count threw:", error);
    return false;
  }
}

export async function emitSessionCreatedEvent(
  supabase: SessionCreatedClient,
  { session, source, surface, userId }: EmitSessionCreatedEventInput
): Promise<void> {
  try {
    const profile = await fetchProfileAnalyticsFlags(supabase, userId);
    if (isExcludedProfile(profile)) return;

    const beachId = session.beach_id ?? null;
    const isFirstSession = await getIsFirstSession(supabase, userId);
    const { error } = ((await supabase.from("user_events").insert({
      user_id: userId,
      event_type: SESSION_CREATED_EVENT,
      beach_id: beachId,
      metadata: {
        source,
        surface,
        is_first_session: isFirstSession,
        spot_type: beachId ? "beach" : "custom",
        user_id: userId,
        session_id: session.id,
      },
    })) ?? {}) as QueryResult<never>;

    if (error) {
      console.warn("[session_created] user_events insert failed:", error);
    }
  } catch (error) {
    console.warn("[session_created] user_events insert threw:", error);
  }
}
