import { NextRequest, NextResponse } from "next/server";
import {
  createAuthError,
  createSuccessResponse,
  createValidationError,
  DEFAULT_SECURITY_HEADERS,
  handleApiError,
  isValidUuid,
  methodNotAllowed,
} from "@/lib/api-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getProfileWithHomeBeachById } from "@/lib/profile/fetchers";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return createAuthError();
    }

    const { id: targetUserId } = (await context.params);
    if (!targetUserId || !isValidUuid(targetUserId)) {
      return createValidationError("Invalid user id format");
    }

    // For now, stats are only available for the authenticated user.
    if (user.id !== targetUserId) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
          timestamp: new Date().toISOString(),
        },
        { status: 403, headers: DEFAULT_SECURITY_HEADERS }
      );
    }

    const { profile: profileData, homeBeachName } = await getProfileWithHomeBeachById(
      targetUserId,
      supabase
    );

    const { count: sessionCount, error: sessionError } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", targetUserId);
    if (sessionError) throw sessionError;

    const { count: boardCount, error: boardError } = await supabase
      .from("boards")
      .select("*", { count: "exact", head: true })
      .eq("user_id", targetUserId);
    if (boardError) throw boardError;

    // Average wave_quality (rating in this tile is effectively wave quality)
    const { data: qualityData, error: qualityError } = await supabase
      .from("sessions")
      .select("wave_quality")
      .eq("user_id", targetUserId);
    if (qualityError) throw qualityError;

    let averageRating = 0;
    if ((qualityData || []).length > 0) {
      const sum = (qualityData || []).reduce(
        (acc: number, s: { wave_quality: number | null }) => acc + (s.wave_quality || 0),
        0
      );
      averageRating = Math.round((sum / (qualityData || []).length) * 10) / 10;
    }

    let mostVisitedBeach: string | null = null;
    let mostVisitedBeachCount = 0;
    try {
      const { data: beachData, error: beachError } = await supabase.rpc(
        "get_most_visited_beach",
        { user_id: targetUserId }
      );
      if (!beachError && beachData && beachData.length > 0) {
        mostVisitedBeach = beachData[0].beach_name;
        mostVisitedBeachCount = beachData[0].visit_count;
      }
    } catch {
      // Non-blocking
    }

    return createSuccessResponse({
      stats: {
        sessionCount: sessionCount || 0,
        boardCount: boardCount || 0,
        averageRating,
        homeBeachId: profileData?.home_beach_id || null,
        homeBeachName,
        mostVisitedBeach,
        mostVisitedBeachCount,
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to load user stats");
  }
}

export function POST() {
  return methodNotAllowed(["GET"]);
}

export function PUT() {
  return methodNotAllowed(["GET"]);
}

export function PATCH() {
  return methodNotAllowed(["GET"]);
}

export function DELETE() {
  return methodNotAllowed(["GET"]);
}










