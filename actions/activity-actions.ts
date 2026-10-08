"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
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
