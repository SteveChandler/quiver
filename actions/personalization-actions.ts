"use server";

import { withAuthenticatedAction } from "@/lib/server-action-utils";

/**
 * Personalization status returned to the client for progress UI.
 */
export interface PersonalizationStatus {
  sessionCount: number;
  intelPostCount: number;
  hasLearnedPrefs: boolean;
  learnedConfidence: number;
  hasImplicitPrefs: boolean;
  implicitConfidence: number;
  learnedWaveRange: { min: number; max: number } | null;
  activeLayers: number;
}

/**
 * Get the current user's personalization status.
 *
 * Aggregates data from user_surf_preferences, user_implicit_preferences,
 * sessions, and intel_posts to produce a summary of how "personalized"
 * the experience is for this user.
 */
export async function getPersonalizationStatus() {
  return withAuthenticatedAction<PersonalizationStatus>(
    async (user, supabase) => {
      // Fetch learned preferences
      const { data: learnedPrefs, error: learnedError } = await supabase
        .from("user_surf_preferences")
        .select("confidence, wave_min_ft, wave_max_ft")
        .eq("user_id", user.id)
        .single();

      // PGRST116 = row not found, which is expected for new users
      if (learnedError && learnedError.code !== "PGRST116") {
        throw new Error(
          `Failed to fetch learned preferences: ${learnedError.message}`
        );
      }

      // Fetch implicit preferences
      const { data: implicitPrefs, error: implicitError } = await supabase
        .from("user_implicit_preferences")
        .select("confidence, event_count")
        .eq("user_id", user.id)
        .single();

      if (implicitError && implicitError.code !== "PGRST116") {
        throw new Error(
          `Failed to fetch implicit preferences: ${implicitError.message}`
        );
      }

      // Count sessions
      const { count: sessionCount, error: sessionError } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (sessionError) {
        throw new Error(
          `Failed to count sessions: ${sessionError.message}`
        );
      }

      // Count intel posts
      const { count: intelPostCount, error: intelError } = await supabase
        .from("intel_posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (intelError) {
        throw new Error(
          `Failed to count intel posts: ${intelError.message}`
        );
      }

      const hasLearnedPrefs = !!learnedPrefs;
      const hasImplicitPrefs = !!implicitPrefs;

      // Count "active layers" of personalization data
      let activeLayers = 0;
      if (hasLearnedPrefs) activeLayers++;
      if (hasImplicitPrefs) activeLayers++;
      if ((sessionCount ?? 0) > 0) activeLayers++;
      if ((intelPostCount ?? 0) > 0) activeLayers++;

      return {
        sessionCount: sessionCount ?? 0,
        intelPostCount: intelPostCount ?? 0,
        hasLearnedPrefs,
        learnedConfidence: learnedPrefs?.confidence ?? 0,
        hasImplicitPrefs,
        implicitConfidence: implicitPrefs?.confidence ?? 0,
        learnedWaveRange:
          learnedPrefs?.wave_min_ft != null &&
          learnedPrefs?.wave_max_ft != null
            ? {
                min: learnedPrefs.wave_min_ft,
                max: learnedPrefs.wave_max_ft,
              }
            : null,
        activeLayers,
      };
    }
  );
}
