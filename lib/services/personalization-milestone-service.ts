/**
 * Personalization Milestone Detection Service
 *
 * Checks a user's current preference and activity state against milestone
 * definitions and records newly achieved milestones in the database.
 *
 * Called by:
 * - update-user-preferences cron (after preference recomputation)
 * - Session/intel post creation (after new activity)
 * - Client-triggered checks via the milestones API route
 *
 * @see lib/constants/personalization-milestones.ts for milestone definitions
 * @see supabase/migrations/20260213120000_personalization_milestones.sql
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MilestoneKey } from "@/lib/constants/personalization-milestones";
import type { Json } from "@/types/database.generated";

/**
 * Shape of a newly recorded milestone returned to the caller.
 */
export interface NewMilestone {
  key: MilestoneKey;
  metadata: Record<string, unknown>;
}

/**
 * Internal preference state used for milestone detection.
 */
interface UserPreferenceState {
  sessionCount: number;
  intelPostCount: number;
  waveMinFt: number | null;
  waveMaxFt: number | null;
  maxWindMph: number | null;
  learnedConfidence: number;
  implicitConfidence: number;
  timeSlotWeights: Record<string, number> | null;
  topEngagedBeachIds: string[];
  intelConfirmationCount: number;
  topIntelBeach: { beachId: string; beachName: string; count: number } | null;
}

/**
 * Fetches the user's current preference/activity state from multiple tables.
 */
async function getUserPreferenceState(
  userId: string,
  supabase: SupabaseClient
): Promise<UserPreferenceState> {
  // Run core queries in parallel for performance
  const [
    learnedResult,
    implicitResult,
    sessionCountResult,
    intelCountResult,
  ] = await Promise.all([
    supabase
      .from("user_surf_preferences")
      .select("wave_min_ft, wave_max_ft, max_wind_mph, confidence")
      .eq("user_id", userId)
      .single(),
    supabase
      .from("user_implicit_preferences")
      .select("confidence, time_slot_weights, top_engaged_beach_ids")
      .eq("user_id", userId)
      .single(),
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("intel_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const learned = learnedResult.error?.code === "PGRST116" ? null : learnedResult.data;
  const implicit = implicitResult.error?.code === "PGRST116" ? null : implicitResult.data;

  // Advanced milestone queries — these depend on intel_confirmations table
  // which may not exist yet; fail gracefully to 0/null.
  let intelConfirmationCount = 0;
  let topIntelBeach: UserPreferenceState["topIntelBeach"] = null;

  try {
    // Count total confirmations received on user's intel posts
    const { data: userPostIds } = await supabase
      .from("intel_posts")
      .select("id")
      .eq("user_id", userId);

    const postIds = userPostIds?.map((p) => p.id) ?? [];

    // Guard against empty array — skip query if user has no intel posts
    if (postIds.length > 0) {
      const { count } = await supabase
        .from("intel_confirmations")
        .select("id", { count: "exact", head: true })
        .in("post_id", postIds);
      intelConfirmationCount = count ?? 0;
    }
  } catch {
    // Table may not exist yet — skip
  }

  try {
    // Get the beach where user has posted the most intel (for local_authority)
    const { data: topBeachData } = await supabase
      .from("intel_posts")
      .select("beach_id, beaches!inner(name)")
      .eq("user_id", userId)
      .order("beach_id")
      .limit(500);

    if (topBeachData && topBeachData.length > 0) {
      // Count posts per beach
      const beachCounts = new Map<string, { name: string; count: number }>();
      for (const post of topBeachData) {
        const beachId = post.beach_id as string;
        const beachName =
          (post.beaches as unknown as { name: string })?.name ?? "Unknown";
        const existing = beachCounts.get(beachId);
        if (existing) {
          existing.count++;
        } else {
          beachCounts.set(beachId, { name: beachName, count: 1 });
        }
      }

      // Find the beach with the most posts
      let maxEntry: {
        beachId: string;
        beachName: string;
        count: number;
      } | null = null;
      for (const [beachId, { name, count }] of beachCounts) {
        if (!maxEntry || count > maxEntry.count) {
          maxEntry = { beachId, beachName: name, count };
        }
      }
      topIntelBeach = maxEntry;
    }
  } catch {
    // Gracefully skip if join fails
  }

  return {
    sessionCount: sessionCountResult.count ?? 0,
    intelPostCount: intelCountResult.count ?? 0,
    waveMinFt: learned?.wave_min_ft ?? null,
    waveMaxFt: learned?.wave_max_ft ?? null,
    maxWindMph: learned?.max_wind_mph ?? null,
    learnedConfidence: learned?.confidence ?? 0,
    implicitConfidence: implicit?.confidence ?? 0,
    timeSlotWeights: implicit?.time_slot_weights ?? null,
    topEngagedBeachIds: implicit?.top_engaged_beach_ids ?? [],
    intelConfirmationCount,
    topIntelBeach,
  };
}

/**
 * Detects which milestones the user qualifies for based on their current state.
 * Returns only milestone keys that should be checked for insertion.
 */
function detectAchievedMilestones(
  state: UserPreferenceState
): { key: MilestoneKey; metadata: Record<string, unknown> }[] {
  const achieved: { key: MilestoneKey; metadata: Record<string, unknown> }[] = [];

  // first_session_logged: 1+ rated session
  if (state.sessionCount >= 1) {
    achieved.push({
      key: "first_session_logged",
      metadata: { sessionCount: state.sessionCount },
    });
  }

  // first_intel_posted: 1+ intel post
  if (state.intelPostCount >= 1) {
    achieved.push({
      key: "first_intel_posted",
      metadata: { intelPostCount: state.intelPostCount },
    });
  }

  // wave_range_learned: wave_min_ft is non-null
  if (state.waveMinFt != null && state.waveMaxFt != null) {
    achieved.push({
      key: "wave_range_learned",
      metadata: { min: state.waveMinFt, max: state.waveMaxFt },
    });
  }

  // wind_pref_learned: max_wind_mph is non-null
  if (state.maxWindMph != null) {
    achieved.push({
      key: "wind_pref_learned",
      metadata: { max: state.maxWindMph },
    });
  }

  // time_slot_detected: any implicit time slot weight > 0.4
  if (state.timeSlotWeights) {
    const dominantSlot = Object.entries(state.timeSlotWeights).find(
      ([, weight]) => weight > 0.4
    );
    if (dominantSlot) {
      achieved.push({
        key: "time_slot_detected",
        metadata: { timeSlot: dominantSlot[0], weight: dominantSlot[1] },
      });
    }
  }

  // home_turf_established: 3+ top engaged beach IDs
  if (state.topEngagedBeachIds.length >= 3) {
    achieved.push({
      key: "home_turf_established",
      metadata: { beachCount: state.topEngagedBeachIds.length },
    });
  }

  // intel_confirmed_5x: 5+ total confirmations on user's intel
  if (state.intelConfirmationCount >= 5) {
    achieved.push({
      key: "intel_confirmed_5x",
      metadata: { confirmations: state.intelConfirmationCount },
    });
  }

  // local_authority: 10+ intel posts at same beach
  if (state.topIntelBeach && state.topIntelBeach.count >= 10) {
    achieved.push({
      key: "local_authority",
      metadata: {
        beach: state.topIntelBeach.beachName,
        beachId: state.topIntelBeach.beachId,
        postCount: state.topIntelBeach.count,
      },
    });
  }

  // fully_personalized: all 3 layers + confidence > 0.7
  const hasLearned = state.learnedConfidence > 0;
  const hasImplicit = state.implicitConfidence > 0;
  const hasActivity = state.sessionCount > 0;
  const highConfidence =
    state.learnedConfidence > 0.7 || state.implicitConfidence > 0.7;

  if (hasLearned && hasImplicit && hasActivity && highConfidence) {
    achieved.push({
      key: "fully_personalized",
      metadata: {
        learnedConfidence: state.learnedConfidence,
        implicitConfidence: state.implicitConfidence,
      },
    });
  }

  return achieved;
}

/**
 * Checks a user's current state against all milestone definitions and
 * records any newly achieved milestones. Skips milestones that were
 * already recorded (UNIQUE constraint prevents duplicates).
 *
 * @param userId - The user to check milestones for
 * @returns Array of newly recorded milestones (empty if none are new)
 */
export async function checkAndRecordMilestones(
  userId: string
): Promise<NewMilestone[]> {
  const supabase = createSupabaseServiceRoleClient();

  // 1. Get current preference state
  const state = await getUserPreferenceState(userId, supabase);

  // 2. Detect which milestones are achieved
  const achieved = detectAchievedMilestones(state);

  if (achieved.length === 0) {
    return [];
  }

  // 3. Check which milestones already exist
  const { data: existing, error: fetchError } = await supabase
    .from("personalization_milestones")
    .select("milestone_key")
    .eq("user_id", userId)
    .in(
      "milestone_key",
      achieved.map((a) => a.key)
    );

  if (fetchError) {
    console.error(
      "[milestone-service] Failed to fetch existing milestones:",
      fetchError
    );
    return [];
  }

  const existingKeys = new Set((existing ?? []).map((e) => e.milestone_key));

  // 4. Filter to only truly new milestones
  const newMilestones = achieved.filter((a) => !existingKeys.has(a.key));

  if (newMilestones.length === 0) {
    return [];
  }

  // 5. Insert new milestones
  const { error: insertError } = await supabase
    .from("personalization_milestones")
    .insert(
      newMilestones.map((m) => ({
        user_id: userId,
        milestone_key: m.key,
        metadata: m.metadata as Json,
      }))
    );

  if (insertError) {
    // If it's a unique violation, some milestones were recorded by a
    // concurrent call — that's fine, just log and return empty.
    if (insertError.code === "23505") {
      console.warn(
        "[milestone-service] Duplicate milestone insert (concurrent call):",
        insertError.message
      );
      return [];
    }
    console.error(
      "[milestone-service] Failed to insert milestones:",
      insertError
    );
    return [];
  }

  return newMilestones.map((m) => ({ key: m.key, metadata: m.metadata }));
}
