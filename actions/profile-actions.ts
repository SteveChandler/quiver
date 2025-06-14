"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Profile } from "@/types/database";

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
      throw error;
    }

    // If no profile exists, create one
    if (!data) {
      return await createProfile(userId);
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching profile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      isConnectionError: false,
    };
  }
}

export async function createProfile(userId: string) {
  if (!userId) {
    return { success: false, error: "No user ID provided" };
  }

  try {
    const supabase = await createSupabaseServerClient();

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
      const { data: fullProfile, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      return { success: true, data: fullProfile };
    }

    // Create new profile
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        full_name: "",
        email: "",
        phone_number: "",
        avatar_url: "/placeholder.svg?height=200&width=200",
        bio: "",
        location: "",
        experience_level: "",
        favorite_spot: "",
        instagram: "",
        twitter: "",
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    revalidatePath("/profile");
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
  profileData: Partial<Omit<Profile, "id" | "created_at" | "updated_at">>
) {
  const supabase = await createSupabaseServerClient();

  // Get the current user from the authenticated session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      error: "Authentication required",
    };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        ...profileData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    revalidatePath("/profile");
    return { success: true, data };
  } catch (error) {
    console.error("Error updating profile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getUserStats(userId: string) {
  if (!userId) {
    return { success: false, error: "No user ID provided" };
  }

  try {
    const supabase = await createSupabaseServerClient();

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
