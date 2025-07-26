import { createServerClient } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-utils";

export async function GET() {
  try {
    const supabase = createServerClient();

    // Fetch recent completed sessions with profile and media information
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
        profiles!inner (
          id,
          full_name,
          avatar_url
        ),
        session_media (
          id,
          storage_path,
          media_type
        )
      `
      )
      .eq("status", "completed")
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(4);

    if (error) {
      console.error("Error fetching recent posts:", error);
      return NextResponse.json(
        { error: "Failed to fetch recent posts" },
        { status: 500 }
      );
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
        media:
          session.session_media?.map((media) => ({
            id: media.id,
            type: media.media_type,
            url: media.storage_path,
          })) || [],
      })) || [];

    return NextResponse.json({ posts });
  } catch (error) {
    console.error("Error in recent-posts API:", error);
    return handleApiError(error, "Failed to fetch recent posts");
  }
}
