import { NextRequest, NextResponse } from "next/server";
import { createSuccessResponse, createValidationError, handleApiError, methodNotAllowed } from "@/lib/api-utils";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { addFeaturedPhotoToSessions } from "@/actions/session-actions";
import { withBotBlockingAndRateLimit } from "@/lib/middleware/api-wrappers";

function parseLimit(url: URL, defaultValue = 5, max = 20) {
  const raw = url.searchParams.get("limit");
  const n = raw ? Number(raw) : defaultValue;
  if (Number.isNaN(n) || n < 1) return defaultValue;
  return Math.min(n, max);
}

function isUuidLike(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export const dynamic = 'force-dynamic';

/**
 * Core handler for fetching user sessions
 */
async function fetchUserSessions(request: NextRequest, targetUserId: string): Promise<NextResponse> {
  try {
    if (!targetUserId || !isUuidLike(targetUserId)) {
      return createValidationError("Invalid or missing user ID");
    }

    const url = new URL(request.url);
    const supabase = await createAPIServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isOwn = user?.id === targetUserId;
    // Allow a larger limit for the authenticated user's own profile, but keep
    // other-user lookups small to reduce load.
    const limit = parseLimit(url, 5, isOwn ? 200 : 20);

    // Build base query with joins expected by SessionCardWrapper
    let query = supabase
      .from("sessions")
      .select(
        `
        *,
        beach:beaches(id, name, lat, lon),
        user:profiles(id, full_name, avatar_url)
      `
      )
      .eq("user_id", targetUserId)
      .order("arrival_time", { ascending: false })
      .limit(limit);

    // Respect privacy: if viewing someone else, filter to public sessions only
    if (!isOwn) {
      query = query.eq("is_public", true);
    }

    const { data, error } = await query;

    // If joins fail, fall back to basic query with manual relationship resolution
    if (error) {
      console.error("Session query with joins failed, falling back to basic query:", error);

      let basicQuery = supabase
        .from("sessions")
        .select("*")
        .eq("user_id", targetUserId)
        .order("arrival_time", { ascending: false })
        .limit(limit);

      if (!isOwn) {
        basicQuery = basicQuery.eq("is_public", true);
      }

      const { data: basicData, error: basicError } = await basicQuery;
      if (basicError) throw basicError;

      // Manually resolve beach and user data for each session
      const enhancedSessions = await Promise.all(
        (basicData || []).map(async (session) => {
          let beach = null;
          let userData = { full_name: "Anonymous Surfer", avatar_url: null };

          // Try to fetch beach data if beach_id exists
          if (session.beach_id) {
            try {
              const { data: beachData } = await supabase
                .from("beaches")
                .select("id, name, lat, lon")
                .eq("id", session.beach_id)
                .single();
              beach = beachData;
            } catch (beachError) {
              console.warn(`Failed to fetch beach ${session.beach_id}:`, beachError);
            }
          }

          // Try to fetch user data
          if (session.user_id) {
            try {
              const { data: profileData } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url")
                .eq("id", session.user_id)
                .single();
              if (profileData) {
                userData = profileData;
              }
            } catch (userError) {
              console.warn(`Failed to fetch user profile ${session.user_id}:`, userError);
            }
          }

          return {
            ...session,
            beach,
            user: userData,
          };
        })
      );

      const sessionsWithPhotos = await addFeaturedPhotoToSessions(
        supabase,
        enhancedSessions as any[]
      );

      return createSuccessResponse({ sessions: sessionsWithPhotos });
    }

    const sessionsWithPhotos = await addFeaturedPhotoToSessions(
      supabase,
      (data || []) as any[]
    );

    return createSuccessResponse({ sessions: sessionsWithPhotos });
  } catch (error) {
    console.error("Critical error in sessions API:", error);
    return handleApiError(error, "Failed to load user sessions");
  }
}

/**
 * GET /api/users/[id]/sessions
 * Bot blocking and rate limiting applied to prevent abuse
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const wrappedHandler = withBotBlockingAndRateLimit(
    async (req: NextRequest) => fetchUserSessions(req, id),
    "public-default"
  );

  return wrappedHandler(request);
}

export function POST() {
  return methodNotAllowed(["GET"]);
}
