"use server";

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { withAuthenticatedAction } from "@/lib/server-action-utils";
import type { Profile } from "@/types/database";
import { z } from "zod";

// Unified profile update schema with permissive validation
const profileUpdateSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  home_beach_id: z.string().uuid("Invalid beach ID").optional(),
  favorite_spot: z.string().max(255, "Favorite spot name too long").optional(),
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
}).passthrough(); // Allow extra fields that aren't in schema

export async function getProfile(userId: string) {
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

export async function createProfile(userId: string) {
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
    
    // Validate input data
    const validationResult = profileUpdateSchema.safeParse(updateData);
    if (!validationResult.success) {
      throw new Error(`Validation failed: ${validationResult.error.issues.map(i => i.message).join(", ")}`);
    }

    // Handle empty strings for avatar_url by treating them as unset
    const processedData = { ...validationResult.data };
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

export async function setHomeBeach(beachId: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    // Validate beach ID format
    const beachIdValidation = z.string().uuid("Invalid beach ID").safeParse(beachId);
    if (!beachIdValidation.success) {
      throw new Error("Invalid beach ID format");
    }

    // Verify beach exists
    const { data: beach, error: beachError } = await supabase
      .from("beaches")
      .select("id, name")
      .eq("id", beachId)
      .single();

    if (beachError || !beach) {
      throw new Error("Beach not found");
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        home_beach_id: beachId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || "Failed to set home beach");
    }

    // Use tag-based cache revalidation
    revalidateTag("profile");
    
    // Clear specific paths that use profile data
    revalidatePath("/profile");
    revalidatePath("/");
    revalidatePath("/profile/preferences");

    return data as any;
  });
}



export async function getUserStats(userId: string) {
  if (!userId) {
    return { success: false, error: "No user ID provided" };
  }

  try {
    const supabase = await createSupabaseServerClient();

    // Get user profile with home beach
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select(`
        favorite_spot,
        home_beach_id,
        beaches!profiles_default_beach_id_fkey (
          id,
          name
        )
      `)
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching profile for stats:", profileError);
      // Continue execution even if profile fetch fails
    }

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
        favoriteSpot:
          profileData?.beaches?.name || profileData?.favorite_spot || null,
        homeBeachId: profileData?.home_beach_id || null,
        homeBeachName: profileData?.beaches?.name || null,
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
