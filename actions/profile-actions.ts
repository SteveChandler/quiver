"use server";

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { withAuthenticatedAction } from "@/lib/server-action-utils";
import type { Profile } from "@/types/database";
import { z } from "zod";
import { getProfileWithHomeBeachById } from "@/lib/profile/fetchers";

// Unified profile update schema with permissive validation
const profileUpdateSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  home_beach_id: z.string().uuid("Invalid beach ID").nullable().optional(),
  bio: z.string().max(500, "Bio too long").optional(),
  skill_level: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
  experience_years: z.number().int().min(0, "Experience years must be positive").max(100, "Experience years too high").optional(),
  avatar_url: z.union([
    z.string().url("Invalid avatar URL"),
    z.string().length(0), // Allow empty strings
    z.null()
  ]).optional(),
  website_url: z.string().url("Invalid website URL").optional(),
  instagram: z.string().max(30, "Instagram username too long").optional(),
  location: z.string().max(255, "Location too long").optional(),
  board_types: z.array(z.string()).optional(),
  notifications_enabled: z.boolean().optional(),
  email_notifications: z.boolean().optional(),
  push_notifications: z.boolean().optional(),
  privacy_level: z.enum(["public", "friends", "private"]).optional(),
  share_sessions: z.boolean().optional(),
  show_stats: z.boolean().optional(),
  // Notification preferences - master toggles
  notif_push_enabled: z.boolean().optional(),
  notif_email_enabled: z.boolean().optional(),
  notif_inapp_enabled: z.boolean().optional(),
  // Notification preferences - feature toggles
  notif_session_invites: z.boolean().optional(),
  notif_likes: z.boolean().optional(),
  notif_follows: z.boolean().optional(),
  notif_reminders: z.boolean().optional(),
  notif_xp_updates: z.boolean().optional(),
  // Surf preferences
  experience_level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).nullable().optional(),
  surf_styles: z.array(z.string()).nullable().optional(),
  preferred_wave_size: z.enum(['small', 'medium', 'large', 'any']).nullable().optional(),
  preferred_break_type: z.enum(['beach', 'point', 'reef', 'any']).nullable().optional(),
  crowd_preference: z.enum(['social', 'moderate', 'solitude']).nullable().optional(),
  // Session invite preferences
  digest_session_invites: z.boolean().optional(),
  inapp_session_invites: z.boolean().optional(),
  email_session_invites: z.boolean().optional(),
}).passthrough(); // Allow extra fields that aren't in schema

// Return types for profile functions
type ProfileSuccessResult = { success: true; data: Profile };
type ProfileErrorResult = { success: false; error: string; isConnectionError?: boolean };
type ProfileResult = ProfileSuccessResult | ProfileErrorResult;

export async function getProfile(userId: string): Promise<ProfileResult> {
  if (!userId) {
    return { success: false, error: "No user ID provided" };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // First check if the connection is working
    try {
      await supabase.from("profiles").select("count").limit(1);
    } catch (connectionError) {
      console.error("Database connection error:", connectionError);
      return {
        success: false,
        error: "Database connection failed. Please try again later.",
        isConnectionError: true,
      };
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to fetch profile");
    }

    // If no profile exists, create one
    if (!data) {
      return await createProfile(userId);
    }

    // Return data as is - field names now match
    const mapped = data;
    return { success: true, data: mapped };
  } catch (error) {
    console.error("Error fetching profile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      isConnectionError: false,
    };
  }
}

/**
 * Internal profile fetcher for caching
 */
async function _fetchProfile(userId: string) {
  if (!userId) {
    return null;
  }

  try {
    const supabase = await createSupabaseServerClient();
    
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error in _fetchProfile:", error);
      return null;
    }

    // If no profile exists, create one
    if (!data) {
      const createResult = await createProfile(userId);
      return createResult.success ? createResult.data : null;
    }

    return data;
  } catch (error) {
    console.error("Error in _fetchProfile:", error);
    return null;
  }
}

/**
 * Standardized tagged profile fetching function for server components
 * Uses Next.js cache tags for better cache invalidation when available
 */
export async function fetchProfile(userId: string) {
  // Check if we're in a server environment with Next.js caching
  try {
    const cachedFetch = unstable_cache(
      _fetchProfile,
      ["profile"],
      {
        tags: ["profile"],
        revalidate: 300, // 5 minutes
      }
    );
    return await cachedFetch(userId);
  } catch (error) {
    // Fallback to direct function for test environments
    console.warn("unstable_cache not available, using direct profile fetch");
    return await _fetchProfile(userId);
  }
}

async function createProfile(userId: string): Promise<ProfileResult> {
  if (!userId) {
    return { success: false, error: "No user ID provided" };
  }

  try {
    // Use anon client for regular table access and service-role for admin auth lookup
    const supabase = await createSupabaseServerClient();
    const supabaseAdmin = createSupabaseServiceRoleClient();

    // First check if profile already exists
    const { data: existingProfile, error: checkError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (checkError) {
      throw checkError;
    }

    // If profile already exists, return it
    if (existingProfile) {
      return getProfile(userId);
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError) {
      throw new Error(`Could not get user data: ${userError.message}`);
    }

    if (!user) {
      throw new Error(`User with ID ${userId} not found in auth.users`);
    }

    // Create new profile - insert only fields guaranteed by current schema
    const insertPayload: any = {
      id: userId,
      full_name: user.user_metadata?.full_name || "",
    };

    const { data, error } = await supabase
      .from("profiles")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || "Failed to create profile");
    }

    // Clear profile cache on both paths that use profiles
    revalidatePath("/profile");
    revalidatePath("/"); // Home page uses profile data

    return { success: true, data };
  } catch (error) {
    console.error("Error creating profile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function updateProfile(
  profileData: Partial<Omit<Profile, "id" | "created_at" | "updated_at">> | Partial<Omit<Profile, "id" | "created_at" | "updated_at">>[]
) {
  return withAuthenticatedAction(async (user, supabase) => {
    // Handle case where data might be wrapped in an array (from certain Next.js action calls)
    const updateData = Array.isArray(profileData) ? profileData[0] : profileData;

    // Transform empty strings to null for enum fields (client sends "" for unselected options)
    const enumFields = ['experience_level', 'preferred_wave_size', 'preferred_break_type', 'crowd_preference'] as const;
    const sanitizedData = { ...updateData };
    for (const field of enumFields) {
      if ((sanitizedData as Record<string, unknown>)[field] === '') {
        (sanitizedData as Record<string, unknown>)[field] = null;
      }
    }

    // Validate input data
    const validationResult = profileUpdateSchema.safeParse(sanitizedData);
    if (!validationResult.success) {
      throw new Error(`Validation failed: ${validationResult.error.issues.map(i => i.message).join(", ")}`);
    }

    // Start with validated, but allow passthrough keys to be inspected before DB update
    const processedData: Record<string, any> = { ...validationResult.data };

    // Server-side fallback: if client sent a typed beach name but not an ID, resolve best match
    if (!processedData.home_beach_id && typeof (updateData as any)?.home_beach_text === "string") {
      const text = ((updateData as any).home_beach_text as string).trim();
      if (text.length > 0) {
        const { data: candidates, error: beachError } = await supabase
          .from("beaches")
          .select("id,name")
          .ilike("name", `%${text}%`)
          .limit(25);

        if (!beachError && candidates && candidates.length > 0) {
          const lower = text.toLowerCase();
          const exact = candidates.find((b) => b.name.toLowerCase() === lower);
          const starts = candidates.find((b) => b.name.toLowerCase().startsWith(lower));
          const contains = candidates[0];

          const match = exact || starts || contains;
          if (match) {
            processedData.home_beach_id = match.id;
          }
        }
      }
    }

    // Never attempt to update unknown column
    if ("home_beach_text" in processedData) {
      delete processedData.home_beach_text;
    }

    // Handle empty strings for avatar_url by treating them as unset
    if (processedData.avatar_url === "") {
      delete processedData.avatar_url; // Remove empty string avatar_url from update
    }

    // Field names match database, no mapping needed
    const dbPayload: Record<string, any> = {
      ...processedData,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("profiles")
      .update(dbPayload)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || "Failed to update profile");
    }

    // Use tag-based cache revalidation for better cache management
    revalidateTag("profile");
    
    // Clear specific paths that use profile data
    revalidatePath("/profile");
    revalidatePath("/"); // Home page uses profile data
    revalidatePath("/profile/preferences");

    // Return data as is - field names now match
    return data as any;
  });
}



export async function getUserStats(userId: string) {
  if (!userId) {
    return { success: false, error: "No user ID provided" };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // Get user profile with home beach (one query)
    const { profile: profileData, homeBeachName } = await getProfileWithHomeBeachById(userId);

    // Get session count
    const { count: sessionCount, error: sessionError } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (sessionError) {
      throw sessionError;
    }

    // Get board count
    const { count: boardCount, error: boardError } = await supabase
      .from("boards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (boardError) {
      throw boardError;
    }

    // Calculate average wave quality (rating deprecated)
    const { data: qualityData, error: qualityError } = await supabase
      .from("sessions")
      .select("wave_quality")
      .eq("user_id", userId);

    if (qualityError) {
      throw qualityError;
    }

    let averageRating = 0;
    if (qualityData.length > 0) {
      const sum = qualityData.reduce(
        (acc: number, session: { wave_quality: number | null }) =>
          acc + (session.wave_quality || 0),
        0
      );
      averageRating = Math.round((sum / qualityData.length) * 10) / 10; // Round to 1 decimal place
    }

    // homeBeachName already resolved by fetcher

    // Get most visited beach
    let mostVisitedBeach = null;
    let mostVisitedBeachCount = 0;

    try {
      const { data: beachData, error: beachError } = await supabase.rpc(
        "get_most_visited_beach",
        { user_id: userId }
      );

      if (!beachError && beachData && beachData.length > 0) {
        mostVisitedBeach = beachData[0].beach_name;
        mostVisitedBeachCount = beachData[0].visit_count;
      }
    } catch (error) {
      console.error("Error getting most visited beach:", error);
      // Continue execution even if this fails
    }

    return {
      success: true,
      data: {
        sessionCount: sessionCount || 0,
        boardCount: boardCount || 0,
        averageRating,
        homeBeachId: profileData?.home_beach_id || null,
        homeBeachName,
        mostVisitedBeach,
        mostVisitedBeachCount,
      },
    };
  } catch (error) {
    console.error("Error getting user stats:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get user profile metadata for SEO
 * Returns minimal data needed for page metadata generation
 */
export async function getUserMetadata(userId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        `
        id,
        full_name,
        username,
        location,
        created_at
      `
      )
      .eq("id", userId)
      .single();

    if (error || !data) {
      return { success: false as const, error: error?.message || "User not found" };
    }

    // Get session count for this user
    const { count } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    return { 
      success: true as const, 
      data: {
        ...data,
        session_count: count || 0
      }
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
