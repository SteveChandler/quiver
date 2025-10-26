/**
 * Device Token Management API
 * Handles registration and removal of FCM device tokens
 * Following patterns from app/api/session-planner/invitations/route.ts
 */

import { NextRequest } from "next/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * POST /api/devices/upsert
 * Register or update a device token for push notifications
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, device_token } = body;

    // Validate input
    if (!platform || !device_token) {
      return handleApiError(
        new Error("Platform and device_token are required"),
        400
      );
    }

    if (!["ios", "android", "web"].includes(platform)) {
      return handleApiError(
        new Error('Invalid platform. Must be "ios", "android", or "web"'),
        400
      );
    }

    // Authenticate user
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return handleApiError(new Error("Authentication required"), 401);
    }

    // Upsert device token (insert or update if exists)
    const { error: upsertError } = await supabase
      .from("user_devices")
      .upsert(
        {
          user_id: user.id,
          platform,
          device_token,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,device_token",
        }
      );

    if (upsertError) {
      console.error("Device token upsert failed:", upsertError);
      throw upsertError;
    }

    console.log(`Device token registered: ${platform} for user ${user.id}`);

    return createSuccessResponse({
      message: "Device registered successfully",
      platform,
    });
  } catch (error) {
    console.error("Device upsert error:", error);
    return handleApiError(error);
  }
}

/**
 * DELETE /api/devices/upsert
 * Remove a device token (e.g., on logout or token refresh)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { device_token } = body;

    if (!device_token) {
      return handleApiError(new Error("device_token is required"), 400);
    }

    // Authenticate user
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return handleApiError(new Error("Authentication required"), 401);
    }

    // Delete device token
    const { error: deleteError } = await supabase
      .from("user_devices")
      .delete()
      .eq("user_id", user.id)
      .eq("device_token", device_token);

    if (deleteError) {
      console.error("Device token deletion failed:", deleteError);
      throw deleteError;
    }

    console.log(`Device token removed for user ${user.id}`);

    return createSuccessResponse({ message: "Device removed successfully" });
  } catch (error) {
    console.error("Device deletion error:", error);
    return handleApiError(error);
  }
}












