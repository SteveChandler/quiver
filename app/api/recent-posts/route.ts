import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  handleApiError,
  createPaginatedResponse,
  CacheDuration,
  parsePaginationParams,
  createPaginationMeta,
} from "@/lib/api-utils";
import { withBotBlockingAndRateLimit } from "@/lib/middleware/rate-limiter";

// Mark this route as dynamic to prevent static generation
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function recentPostsHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createSupabaseServerClient();

    // Parse pagination parameters (default: page=1, limit=4, max=20)
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePaginationParams(searchParams, 4, 20);

    // Calculate offset for pagination
    const offset = (page - 1) * limit;

    // First, get total count of matching sessions
    const { count } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .not("image_url", "is", null);

    const total = count || 0;

    // Fetch paginated recent completed sessions with profile and media information
    const { data: sessions, error } = await supabase
      .from("sessions")
      .select(
        `
        id,
        beach_name,
        notes,
        rating,
        description,
        image_url,
        likes_count,
        created_at,
        profile_id,
        profiles!sessions_profile_id_fkey (
          id,
          full_name,
          avatar_url
        ),
        session_media!session_media_session_id_fkey (
          id,
          public_url,
          media_type,
          caption,
          file_size,
          deleted_at
        )
      `
      )
      .eq("status", "completed")
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching recent posts:", error);
      // In dev/test environments with new schema, return empty posts to keep public endpoint stable
      const meta = createPaginationMeta(page, limit, 0);
      return await createPaginatedResponse([], meta, CacheDuration.SHORT);
    }

    // Transform the data for the frontend
    const posts =
      sessions?.map((session) => ({
        id: session.id,
        caption:
          session.notes ||
          session.description ||
          `Great surf session at ${session.beach_name}!`,
        imageUrl: session.image_url,
        rating: session.rating || 5,
        beachName: session.beach_name,
        likesCount: session.likes_count || 0,
        createdAt: session.created_at,
        author: {
          id: session.profiles.id,
          name: session.profiles.full_name || "Surfer",
          avatar: session.profiles.avatar_url || "/placeholder-user.jpg",
        },
        media: (session.session_media || [])
          .filter((m: any) => !m.deleted_at)
          .map((m: any) => ({
            id: m.id,
            url: m.public_url,
            type: m.media_type,
            caption: m.caption,
            fileSize: m.file_size,
          }))
      })) || [];

    // Create pagination metadata
    const meta = createPaginationMeta(page, limit, total);

    // Return with 2min cache + 5min SWR (shorter cache for recent/dynamic content)
    return await createPaginatedResponse(posts, meta, CacheDuration.SHORT);
  } catch (error) {
    console.error("Error in recent-posts API:", error);
    return handleApiError(error, "Failed to fetch recent posts");
  }
}

// Apply bot blocking and rate limiting to prevent abuse
export const GET = withBotBlockingAndRateLimit(recentPostsHandler, "public-default");
