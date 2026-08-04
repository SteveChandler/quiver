"use server";

import { revalidatePath } from "next/cache";
import {
  makeAuthenticatedAction,
  type ServerActionResponse,
} from "@/lib/server-action-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-utils";
import type {
  ConditionsReportInput,
  ConditionsReportData,
  WaveSizeRange,
  Vibe,
} from "@/types/conditions-report";
import {
  buildConditionsContent,
  WAVE_SIZE_OPTIONS,
  VIBE_OPTIONS,
} from "@/types/conditions-report";
import { emitSessionCreatedEvent } from "@/lib/analytics/session-created";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_WAVE_SIZES = new Set<string>(WAVE_SIZE_OPTIONS.map((o) => o.value));
const VALID_VIBES = new Set<string>(VIBE_OPTIONS.map((o) => o.value));
const NOTE_MAX_LENGTH = 280;

function validateInput(input: ConditionsReportInput): string | null {
  if (!input.beachId?.trim()) {
    return "Beach ID is required";
  }
  if (!VALID_WAVE_SIZES.has(input.waveSizeRange)) {
    return "Invalid wave size selection";
  }
  if (!VALID_VIBES.has(input.vibe)) {
    return "Invalid vibe selection";
  }
  if (input.note && input.note.length > NOTE_MAX_LENGTH) {
    return `Note must be ${NOTE_MAX_LENGTH} characters or fewer`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// submitConditionsReport
// ---------------------------------------------------------------------------

/**
 * Submit a conditions report for a beach.
 *
 * Creates:
 * 1. An intel_posts record with structured wave_size_range + vibe columns
 * 2. A minimal sessions record (source: 'conditions_report') for ML training
 *
 * Dedup: one report per user per beach per calendar day (local time).
 * If the user has already reported today, returns a specific error string so
 * the UI can show the "already reported" state.
 */
export const submitConditionsReport = makeAuthenticatedAction(
  async (
    user,
    supabase,
    input: ConditionsReportInput
  ): Promise<ActionResult<{ intelPostId: string; sessionId: string | null }>> => {
    // --- Validate ---
    const validationError = validateInput(input);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const { beachId, waveSizeRange, vibe, note } = input;
    const trimmedNote = note?.trim() || null;

    // --- Check for same-day dedup ---
    // Use the start of the current UTC day as the boundary. This is a simple
    // proxy; full locale-aware day boundaries are a future enhancement.
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { data: existing, error: dupCheckError } = await supabase
      .from("intel_posts")
      .select("id")
      .eq("user_id", user.id)
      .eq("beach_id", beachId)
      .not("wave_size_range", "is", null)
      .gte("created_at", todayStart.toISOString())
      .limit(1);

    if (dupCheckError) {
      console.error("[submitConditionsReport] Dedup check failed:", dupCheckError);
      // Non-fatal — continue with submission
    } else if (existing && existing.length > 0) {
      return {
        success: false,
        error: "ALREADY_REPORTED_TODAY",
      };
    }

    // --- Build the human-readable content string ---
    const content = buildConditionsContent(
      waveSizeRange as WaveSizeRange,
      vibe as Vibe,
      trimmedNote ?? undefined
    );

    // --- Fetch beach coords for the intel post (required fields) ---
    const { data: beach, error: beachError } = await supabase
      .from("beaches")
      .select("lat, lon, name")
      .eq("id", beachId)
      .single();

    if (beachError || !beach) {
      console.error("[submitConditionsReport] Beach lookup failed:", beachError);
      return { success: false, error: "Beach not found" };
    }

    const lat = beach.lat ?? 0;
    const lon = beach.lon ?? 0;

    // --- Create intel post ---
    const { data: intelPost, error: intelError } = await supabase
      .from("intel_posts")
      .insert({
        user_id: user.id,
        beach_id: beachId,
        latitude: lat,
        longitude: lon,
        tag: "conditions" as const,
        title: `${waveSizeRange}, ${vibe}`,
        description: content,
        wave_size_range: waveSizeRange,
        vibe,
        is_active: true,
        // Conditions reports expire after 24 hours — stale conditions data
        // is misleading rather than informative.
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (intelError || !intelPost) {
      console.error("[submitConditionsReport] Intel post insert failed:", intelError);
      return { success: false, error: "Failed to submit conditions report" };
    }

    // Fire-and-forget: emit to user_events for retention analytics. Failures are
    // logged but never fail the user-visible submission.
    void (async () => {
      const { error: evtErr } = await supabase.from("user_events").insert({
        user_id: user.id,
        event_type: "intel_post_created",
        beach_id: beachId,
        metadata: {
          source: "web-conditions-report",
          wave_size_range: waveSizeRange,
          vibe,
          intel_post_id: intelPost.id,
        },
      });
      if (evtErr) console.warn("[submitConditionsReport] user_events intel insert failed:", evtErr);
    })();

    // --- Create minimal session record (fire-and-forget for ML) ---
    let sessionId: string | null = null;

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        beach_id: beachId,
        beach_name: beach.name,
        arrival_time: new Date().toISOString(),
        status: "completed",
        source: "conditions_report",
        notes: content,
        duration_minutes: 0,
      })
      .select("id")
      .single();

    if (sessionError) {
      // Non-fatal: the intel post was already created. Log but don't fail.
      console.warn("[submitConditionsReport] Session insert failed (non-fatal):", sessionError);
    } else {
      sessionId = session?.id ?? null;
      if (sessionId) {
        await emitSessionCreatedEvent(supabase, {
          userId: user.id,
          session: {
            id: sessionId,
            beach_id: beachId,
          },
          source: "web-conditions-report",
          surface: "conditions-report",
        });
      }
    }

    revalidatePath(`/beach/${beachId}`);

    return {
      success: true,
      data: { intelPostId: intelPost.id, sessionId },
    };
  }
);

// ---------------------------------------------------------------------------
// getRecentConditionsReports
// ---------------------------------------------------------------------------

/**
 * Fetch the most recent conditions reports for a beach from the last 24 hours.
 *
 * Public-readable — no authentication required. Uses the server Supabase
 * client so RLS policies apply normally.
 *
 * Returns up to 3 reports sorted newest-first.
 */
export async function getRecentConditionsReports(
  beachId: string
): Promise<ActionResult<ConditionsReportData[]>> {
  try {
    if (!beachId?.trim()) {
      return { success: false, error: "Beach ID is required" };
    }

    const supabase = await createSupabaseServerClient();

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch recent intel posts that have the wave_size_range field set
    // (i.e. were submitted via the Report Conditions feature).
    const { data: posts, error: postsError } = await supabase
      .from("intel_posts")
      .select("id, user_id, beach_id, wave_size_range, vibe, description, created_at")
      .eq("beach_id", beachId)
      .eq("is_active", true)
      .not("wave_size_range", "is", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(3);

    if (postsError) {
      console.error("[getRecentConditionsReports] Query failed:", postsError);
      return { success: false, error: "Failed to fetch recent reports" };
    }

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return { success: true, data: [] };
    }

    // Fetch profiles for the reporters
    const userIds = [...new Set(posts.map((p) => p.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", userIds);

    const profilesMap = new Map(
      (profiles ?? []).map((p) => [p.id, p])
    );

    const reports: ConditionsReportData[] = posts.map((post) => {
      const profile = profilesMap.get(post.user_id);

      // Extract the note from the description (everything after ' — ')
      const descriptionParts = post.description.split(' — ');
      const note = descriptionParts.length > 1
        ? descriptionParts.slice(1).join(' — ')
        : null;

      return {
        id: post.id,
        beach_id: post.beach_id ?? beachId,
        user_id: post.user_id,
        wave_size_range: post.wave_size_range as WaveSizeRange,
        vibe: post.vibe as Vibe,
        content: post.description,
        note,
        created_at: post.created_at,
        user: {
          full_name: profile?.full_name ?? "Anonymous",
          avatar_url: profile?.avatar_url ?? null,
        },
      };
    });

    return { success: true, data: reports };
  } catch (error) {
    console.error("[getRecentConditionsReports] Unexpected error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch recent reports",
    };
  }
}

// ---------------------------------------------------------------------------
// Type export for callers that need the return shape
// ---------------------------------------------------------------------------
export type SubmitConditionsReportResult = ServerActionResponse<
  ActionResult<{ intelPostId: string; sessionId: string | null }>
>;
