import { NextRequest } from "next/server";
import { 
  createSuccessResponse, 
  handleApiError, 
  createValidationError, 
  methodNotAllowed, 
  isValidUuid 
} from "@/lib/api-utils";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { getProfileDTOById } from "@/lib/profile/fetchers";
import type { ProfileDTO } from "@/types/profile";

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: userId } = params;

    if (!isValidUuid(userId)) {
      return createValidationError("Invalid user id format");
    }

    const supabase = createAPIServerClient();

    const { data: { user } } = await supabase.auth.getUser();

    const base = await getProfileDTOById(userId, supabase);

    const { data: details } = await supabase
      .from("profiles")
      .select(`
        followers_count,
        following_count,
        created_at,
        avatar_url,
        email,
        bio,
        location,
        experience_level,
        instagram,
        home_beach:beaches!profiles_home_beach_id_fkey(id, name)
      `)
      .eq("id", userId)
      .single();

    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, rating, status")
      .eq("user_id", userId)
      .eq("is_public", true);

    let sessionStats = { session_count: 0, average_rating: null as number | null };
    if (sessions) {
      const completed = sessions.filter((s) => s.status === "completed");
      sessionStats.session_count = completed.length;
      if (completed.length > 0) {
        const total = completed.reduce((sum, s) => sum + (s.rating || 0), 0);
        sessionStats.average_rating = Math.round((total / completed.length) * 10) / 10;
      }
    }

    let isFollowingUser = false;
    if (user && user.id !== userId) {
      const { data: followData } = await supabase
        .from("user_follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", userId)
        .single();
      isFollowingUser = !!followData;
    }

    const profileWithStats: ProfileDTO & {
      followers_count: number;
      following_count: number;
      created_at: string | null;
      avatar_url?: string | null;
      email?: string | null;
      bio?: string | null;
      location?: string | null;
      experience_level?: string | null;
      instagram?: string | null;
      home_beach?: { id: string; name: string } | null;
      session_count: number;
      average_rating: number | null;
      isFollowing: boolean;
      isOwnProfile: boolean;
    } = {
      ...(base as ProfileDTO),
      followers_count: details?.followers_count ?? 0,
      following_count: details?.following_count ?? 0,
      created_at: details?.created_at ?? null,
      avatar_url: details?.avatar_url ?? null,
      email: details?.email ?? null,
      bio: details?.bio ?? null,
      location: details?.location ?? null,
      experience_level: details?.experience_level ?? null,
      instagram: details?.instagram ?? null,
      home_beach: details?.home_beach ?? null,
      session_count: sessionStats.session_count,
      average_rating: sessionStats.average_rating,
      isFollowing: isFollowingUser,
      isOwnProfile: user?.id === userId,
    };

    return createSuccessResponse(profileWithStats);
  } catch (error) {
    return handleApiError(error);
  }
}

export function POST() {
  return methodNotAllowed(["GET"]);
}


