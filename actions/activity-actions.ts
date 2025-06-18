"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActivityFeedItem } from "@/types/database";

export async function getUserActivityFeed(
  userId: string,
  limit = 50,
  offset = 0
) {
  const supabase = await createSupabaseServerClient();

  try {
    // Get the current user
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

    // Call the database function to get activity feed
    const { data, error } = await supabase.rpc("get_user_activity_feed", {
      p_user_id: userId,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: (data as ActivityFeedItem[]) || [],
    };
  } catch (error) {
    console.error("Error getting user activity feed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getUserActivities(
  userId: string,
  activityTypes?: string[],
  limit = 50,
  offset = 0
) {
  const supabase = await createSupabaseServerClient();

  try {
    let query = supabase
      .from("user_activities")
      .select(
        `
        *,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (activityTypes && activityTypes.length > 0) {
      query = query.in("activity_type", activityTypes);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Transform the data to match ActivityFeedItem structure
    const transformedData: ActivityFeedItem[] = (data || []).map((item) => ({
      id: item.id,
      user_id: item.user_id,
      activity_type: item.activity_type,
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      metadata: item.metadata,
      created_at: item.created_at,
      user_name: item.profiles?.full_name || null,
      user_avatar: item.profiles?.avatar_url || null,
    }));

    return {
      success: true,
      data: transformedData,
    };
  } catch (error) {
    console.error("Error getting user activities:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getGlobalActivityFeed(limit = 50, offset = 0) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("user_activities")
      .select(
        `
        *,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Transform the data to match ActivityFeedItem structure
    const transformedData: ActivityFeedItem[] = (data || []).map((item) => ({
      id: item.id,
      user_id: item.user_id,
      activity_type: item.activity_type,
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      metadata: item.metadata,
      created_at: item.created_at,
      user_name: item.profiles?.full_name || null,
      user_avatar: item.profiles?.avatar_url || null,
    }));

    return {
      success: true,
      data: transformedData,
    };
  } catch (error) {
    console.error("Error getting global activity feed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function createActivity(
  activityType: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, any> = {}
) {
  const supabase = await createSupabaseServerClient();

  try {
    // Get the current user
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

    // Call the database function to create activity
    const { data, error } = await supabase.rpc("create_activity", {
      p_user_id: user.id,
      p_activity_type: activityType,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_metadata: metadata,
    });

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    console.error("Error creating activity:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
