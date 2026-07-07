import { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

type SuggestedProfileRow = {
  id: string;
  full_name: string | null;
  followers_count: number | null;
  following_count: number | null;
  avatar_url: string | null;
  deleted_at: string | null;
  is_mock: boolean | null;
  analytics_is_real_user: boolean | null;
  is_system_account: boolean | null;
};

async function suggestedUsersHandler(
  request: NextRequest,
  { user, supabase }: AuthenticatedContext,
) {
  const { searchParams } = new URL(request.url);
  const requestedLimit = Number.parseInt(searchParams.get("limit") || "8", 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 20)
    : 8;

  const { data: blockRows, error: blockError } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", user.id);

  if (blockError) {
    throw blockError;
  }

  const blockedIds = new Set(
    (blockRows || [])
      .map((block) => block.blocked_id)
      .filter((id): id is string => typeof id === "string"),
  );
  const candidateLimit = Math.min(Math.max(limit * 3, 20), 60);

  const { data: users, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, followers_count, following_count, avatar_url, deleted_at, is_mock, analytics_is_real_user, is_system_account",
    )
    .neq("id", user.id)
    .not("full_name", "is", null)
    .is("deleted_at", null)
    .or("is_mock.is.null,is_mock.eq.false")
    .or("is_system_account.is.null,is_system_account.eq.false")
    .gt("followers_count", -1)
    .order("followers_count", { ascending: false })
    .limit(candidateLimit);

  if (error) {
    throw error;
  }

  const suggestedUsers = ((users || []) as SuggestedProfileRow[]).filter(
    (suggestedUser) =>
      typeof suggestedUser.full_name === "string" &&
      suggestedUser.full_name.trim().length > 0 &&
      !blockedIds.has(suggestedUser.id) &&
      suggestedUser.deleted_at === null &&
      suggestedUser.is_mock !== true &&
      suggestedUser.is_system_account !== true &&
      suggestedUser.analytics_is_real_user !== false,
  ).slice(0, limit);

  let followingIds = new Set<string>();
  if (suggestedUsers.length > 0) {
    const suggestedIds = suggestedUsers.map((suggestedUser) => suggestedUser.id);
    const { data: follows, error: followsError } = await supabase
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .in("following_id", suggestedIds);

    if (followsError) {
      throw followsError;
    }

    followingIds = new Set(
      (follows || [])
        .map((follow) => follow.following_id)
        .filter((id): id is string => typeof id === "string"),
    );
  }

  const response = createSuccessResponse({
    users: suggestedUsers.map((suggestedUser) => ({
      id: suggestedUser.id,
      full_name: suggestedUser.full_name,
      followers_count: suggestedUser.followers_count,
      following_count: suggestedUser.following_count,
      avatar_url: suggestedUser.avatar_url,
      following: followingIds.has(suggestedUser.id),
    })),
    source: "popular_profiles",
  });
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );
  return response;
}

export const GET = withAuth(suggestedUsersHandler, {
  errorMessage: "Failed to load suggested users",
});
