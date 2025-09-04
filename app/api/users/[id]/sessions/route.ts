import { NextRequest } from "next/server";
import { createSuccessResponse, createValidationError, handleApiError, methodNotAllowed } from "@/lib/api-utils";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";

function parseLimit(url: URL, defaultValue = 5, max = 20) {
  const raw = url.searchParams.get("limit");
  const n = raw ? Number(raw) : defaultValue;
  if (Number.isNaN(n) || n < 1) return defaultValue;
  return Math.min(n, max);
}

function isUuidLike(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    const { id: targetUserId } = context.params;
    if (!targetUserId || !isUuidLike(targetUserId)) {
      return createValidationError("Invalid or missing user ID");
    }

    const url = new URL(request.url);
    const limit = parseLimit(url);

    const supabase = createAPIServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isOwn = user?.id === targetUserId;

    // Build base query with joins expected by SessionCardWrapper
    let query = supabase
      .from("sessions")
      .select(
        `
        *,
        beach:beaches(id, name, latitude, longitude, location),
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
    if (error) throw error;

    return createSuccessResponse({ sessions: data || [] });
  } catch (error) {
    return handleApiError(error, "Failed to load user sessions");
  }
}

export function POST() {
  return methodNotAllowed(["GET"]);
}

