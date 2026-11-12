import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  handleApiError,
} from "@/lib/middleware/api-wrappers";
import { addFeaturedPhotoToSessions } from "@/actions/session-actions";
import { PROFILE_PUBLIC_SESSION_RELATION_SELECT } from "@/lib/profile/constants";
import { SURF_SESSION_SOURCE_FILTER } from "@/lib/sessions/surf-session-filter";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

// GET /api/beaches/[id]/sessions?limit=5 - fetch recent completed sessions for beach
async function handleGet(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "5", 10) || 5, 25);
    const publicOnly = searchParams.get("publicOnly") === "true";

    let query = supabase
      .from("sessions")
      .select(
        `
        *,
        beach:beaches(*),
        board:boards(*),
        ${PROFILE_PUBLIC_SESSION_RELATION_SELECT}
      `
      )
      .eq("beach_id", params.id)
      .eq("status", "completed")
      .or(SURF_SESSION_SOURCE_FILTER);

    if (publicOnly) {
      query = query.eq("is_public", true);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return handleApiError(error, "Failed to fetch sessions by beach");
    }

    const sessionsWithPhotos = await addFeaturedPhotoToSessions(
      supabase,
      (data || []) as any[]
    );

    return createSuccessResponse({ sessions: sessionsWithPhotos });
  } catch (err) {
    return handleApiError(err, "Failed to fetch sessions by beach");
  }
}

export const GET = withErrorNoStore(handleGet);
