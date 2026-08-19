import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  createValidationError,
  createErrorResponse,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import {
  getSessionAnalytics,
  getCalendarHeatmapData,
} from "@/lib/analytics/session-analytics";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/sessions?userId=me&type=analytics|calendar&year=2024&month=1
 *
 * Uses `withAuth` so both cookie (web) and Bearer (native) auth resolve the
 * user. The prior handler's cookie-only client returned 401 for every
 * native caller. The API-only analytics helpers in
 * `lib/analytics/session-analytics.ts` accept the Supabase client as an
 * argument, so they pick up the Bearer-scoped client from the withAuth context
 * directly.
 */
export const GET = withAuth(
  async (request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const type = searchParams.get("type") || "analytics";
    const year = searchParams.get("year");
    const month = searchParams.get("month");

    if (!userId) return createValidationError("User ID is required");

    // "me" → current user
    const targetUserId = userId === "me" ? user.id : userId;

    // Users can only read their own analytics.
    if (targetUserId !== user.id) {
      return createErrorResponse("Unauthorized access to analytics data", 403);
    }

    if (type === "calendar") {
      if (!year || !month) {
        return createValidationError(
          "Year and month are required for calendar data",
        );
      }

      const calendarResult = await getCalendarHeatmapData(
        supabase,
        targetUserId,
        parseInt(year),
        parseInt(month),
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
    }

    const analyticsResult = await getSessionAnalytics(supabase, targetUserId);
    if (!analyticsResult.success) {
      throw new Error(analyticsResult.error);
    }

    return createSuccessResponse(analyticsResult.data);
  },
  { errorMessage: "Failed to fetch session analytics" },
);

/**
 * PATCH /api/analytics/sessions - update session privacy.
 */
export const PATCH = withAuth(
  async (request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const { sessionId, isPrivate } = await request.json();

    if (!sessionId || typeof isPrivate !== "boolean") {
      return createValidationError(
        "Session ID and privacy flag are required",
      );
    }

    const { data, error } = await supabase
      .from("sessions")
      .update({
        is_public: !isPrivate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    return createSuccessResponse({
      message: "Session privacy updated successfully",
      session: data,
    });
  },
  { errorMessage: "Failed to update session privacy" },
);
