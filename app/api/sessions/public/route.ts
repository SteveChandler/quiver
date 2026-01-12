import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  handleApiError,
  createPaginatedResponse,
  CacheDuration,
  parsePaginationParams,
  createPaginationMeta,
} from "@/lib/api-utils";
import { withBotBlockingAndRateLimit } from "@/lib/middleware/api-wrappers";

// Mark this route as dynamic to prevent static generation
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/sessions/public
 *
 * Fetches public completed surf sessions for display on the public sessions feed.
 * This endpoint is accessible without authentication.
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 10, max: 50)
 *
 * Returns:
 * - Paginated list of public sessions with beach info, ratings, and author details
 */
async function publicSessionsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePaginationParams(searchParams, 10, 50);
    const offset = (page - 1) * limit;

    // Get total count of public completed sessions
    const { count } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .eq("is_public", true);

    // Fetch public sessions with profile data
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select(
        `
        id,
        beach_name,
        beach_id,
        arrival_time,
        wave_quality,
        wave_height_ft,
        notes,
        description,
        image_url,
        likes_count,
        created_at,
        profile_id,
        duration_minutes,
        crowd_level,
        water_temp,
        profiles!sessions_profile_id_fkey (
          id
        ),
        session_media!session_media_session_id_fkey (
          id,
          public_url,
          media_type,
          caption,
          deleted_at
        )
      `
      )
      .eq("status", "completed")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching public sessions:", error);
      throw error;
    }

    // Transform the data for frontend consumption
    const publicSessions =
      sessions?.map((session: any) => ({
        id: session.id,
        beachName: session.beach_name,
        beachId: session.beach_id,
        arrivalTime: session.arrival_time,
        waveQuality: session.wave_quality,
        waveHeight: session.wave_height_ft,
        notes: session.notes,
        description: session.description,
        imageUrl: session.image_url,
        likesCount: session.likes_count || 0,
        createdAt: session.created_at,
        durationMinutes: session.duration_minutes,
        crowdLevel: session.crowd_level,
        waterTemp: session.water_temp,
        author: {
          id: session.profiles?.id || null,
        },
        media: (session.session_media || [])
          .filter((m: any) => !m.deleted_at)
          .map((m: any) => ({
            id: m.id,
            url: m.public_url,
            type: m.media_type,
            caption: m.caption,
          })),
      })) || [];

    const meta = createPaginationMeta(page, limit, count || 0);

    // Cache for 2 minutes (public content, updated frequently)
    return await createPaginatedResponse(publicSessions, meta, CacheDuration.SHORT);
  } catch (error) {
    return handleApiError(error, "Failed to fetch public sessions");
  }
}

// Apply bot blocking and rate limiting to prevent abuse
export const GET = withBotBlockingAndRateLimit(publicSessionsHandler, "public-default");
