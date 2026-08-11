"use server";

import { revalidatePath } from "next/cache";
import {
  makeAuthenticatedAction,
  type ServerActionResponse,
} from "@/lib/server-action-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-utils";
import type {
  ConditionsReportData,
  ConditionsReportInput,
  Vibe,
  WaveSizeRange,
} from "@/types/conditions-report";
import { submitConditionsReportCore } from "@/lib/conditions-report/submit-conditions-report";

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
    const result = await submitConditionsReportCore(input, user, supabase);
    if (result.success) {
      revalidatePath(`/beach/${input.beachId}`);
    }
    return result;
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
