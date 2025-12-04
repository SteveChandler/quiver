import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import {
  getSessionAnalytics,
  getCalendarHeatmapData,
} from "@/actions/analytics-actions";

export const dynamic = "force-dynamic";

/**
 * Get session analytics for the current user
 * GET /api/analytics/sessions?userId=me&type=analytics|calendar&year=2024&month=1
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const type = searchParams.get("type") || "analytics";
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    if (!userId)
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );

    const supabase = await createSupabaseServerClient();

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user)
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );

    // Support "me" as userId for current user
    const targetUserId = userId === "me" ? user.id : userId;

    // Ensure user can only access their own analytics
    if (targetUserId !== user.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized access to analytics data" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    if (type === "calendar") {
      // Calendar heatmap data
      if (!year || !month)
        return new Response(
          JSON.stringify({ error: "Year and month are required for calendar data" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );

      const calendarResult = await getCalendarHeatmapData(
        supabase,
        targetUserId,
        parseInt(year),
        parseInt(month)
      );

      if (!calendarResult.success) {
        throw new Error(calendarResult.error);
      }

      return createSuccessResponse({
        type: "calendar",
        userId: targetUserId,
        year: parseInt(year),
        month: parseInt(month),
        data: calendarResult.data,
        generatedAt: new Date().toISOString(),
      });
    } else {
      // Full analytics data
      const analyticsResult = await getSessionAnalytics(supabase, targetUserId);

      if (!analyticsResult.success) {
        throw new Error(analyticsResult.error);
      }

      return createSuccessResponse(analyticsResult.data);
    }
  } catch (error) {
    console.error("Error fetching session analytics:", error);
    return handleApiError(error);
  }
}

/**
 * Update session privacy settings
 * PATCH /api/analytics/sessions
 */
export async function PATCH(request: NextRequest) {
  try {
    const { sessionId, isPrivate } = await request.json();

    if (!sessionId || typeof isPrivate !== "boolean") {
      return new Response(
        JSON.stringify({ error: "Session ID and privacy flag are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabase = await createSupabaseServerClient();

    // Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update session privacy
    const { data, error } = await supabase
      .from("sessions")
      .update({
        is_public: !isPrivate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", user.id) // Ensure user owns this session
      .select()
      .single();

    if (error) {
      throw error;
    }

    return createSuccessResponse({
      message: "Session privacy updated successfully",
      session: data,
    });
  } catch (error) {
    console.error("Error updating session privacy:", error);
    return handleApiError(error);
  }
}
