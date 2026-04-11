"use server";

import { makeAuthenticatedAction } from "@/lib/server-action-utils";

/**
 * Calculate profile completion percentage with weighted fields.
 * Server action using makeAuthenticatedAction pattern.
 *
 * Weighted fields (redistributed from the original 8-field layout after
 * preferred_wave_size/preferred_break_type/crowd_preference were removed):
 * - home_beach_id: 29
 * - experience_level: 21
 * - surf_styles: 22
 * - full_name: 14
 * - boards (count > 0): 14
 * Total: 100
 *
 * @returns { percent: number, missing: string[] }
 */
export const getProfileStrength = makeAuthenticatedAction(
  async (user, supabase) => {
    // Fetch profile data - select only needed fields for profile strength calculation
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, home_beach_id, experience_level, surf_styles, full_name")
      .eq("id", user.id)
      .single();

    if (profileError) {
      throw new Error(`Failed to fetch profile: ${profileError.message}`);
    }

    // Fetch boards count
    const { count: boardsCount, error: boardsError } = await supabase
      .from("boards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (boardsError) {
      throw new Error(`Failed to fetch boards: ${boardsError.message}`);
    }

    // Calculate completion with weighted fields
    const weights = {
      home_beach_id: 29,
      experience_level: 21,
      surf_styles: 22,
      full_name: 14,
      boards: 14,
    };

    let totalPoints = 0;
    const missing: string[] = [];

    // Check each field
    if (profile.home_beach_id) {
      totalPoints += weights.home_beach_id;
    } else {
      missing.push("home_beach_id");
    }

    if (profile.experience_level) {
      totalPoints += weights.experience_level;
    } else {
      missing.push("experience_level");
    }

    if (profile.surf_styles && profile.surf_styles.length > 0) {
      totalPoints += weights.surf_styles;
    } else {
      missing.push("surf_styles");
    }

    if (profile.full_name) {
      totalPoints += weights.full_name;
    } else {
      missing.push("full_name");
    }

    if (boardsCount && boardsCount > 0) {
      totalPoints += weights.boards;
    } else {
      missing.push("boards");
    }

    return {
      percent: totalPoints,
      missing,
    };
  }
);

/**
 * Fetch user's boards with essential details.
 * Server action using makeAuthenticatedAction pattern.
 *
 * @returns Array of boards or empty array
 */
export const getUserBoards = makeAuthenticatedAction(
  async (user, supabase) => {
    const { data: boards, error } = await supabase
      .from("boards")
      .select("id, name, board_type, dimensions, volume")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch boards: ${error.message}`);
    }

    return boards || [];
  }
);
