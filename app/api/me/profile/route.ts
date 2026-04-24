import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  createNotFoundError,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { fetchProfile as defaultFetchProfile } from "@/actions/profile-actions";
import { getProfileWithHomeBeachById } from "@/lib/profile/fetchers";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/profile - Get current user's profile.
 *
 * Uses `withAuth` so both cookie (web) and Bearer (native) auth resolve
 * the user. The prior handler used a cookie-only `createSupabaseServerClient`
 * and returned 401 for every native caller.
 */

// Legacy DI type kept for test compatibility. New callers should not pass
// deps — the real auth path goes through withAuth.
export type GetDeps = {
  fetchProfileFn?: typeof defaultFetchProfile;
};

export async function handleGet(
  _request: NextRequest,
  context: AuthenticatedContext,
  deps?: GetDeps,
) {
  const { user, supabase } = context;

  if (deps?.fetchProfileFn) {
    const profileData = await deps.fetchProfileFn(user.id);
    if (!profileData) {
      return createNotFoundError("Profile not found");
    }
    return createSuccessResponse({
      id: profileData.id,
      home_beach_id: profileData.home_beach_id,
      full_name: profileData.full_name,
      avatar_url: (profileData as { avatar_url?: string | null }).avatar_url ?? null,
      bio: (profileData as { bio?: string | null }).bio ?? null,
      location: (profileData as { location?: string | null }).location ?? null,
    });
  }

  const { profile, homeBeachName } = await getProfileWithHomeBeachById(
    user.id,
    supabase,
  );

  if (!profile) {
    return createNotFoundError("Profile not found");
  }

  return createSuccessResponse({
    id: profile.id,
    home_beach_id: profile.home_beach_id,
    full_name: profile.full_name,
    homeBeachName,
    avatar_url: (profile as { avatar_url?: string | null }).avatar_url ?? null,
    bio: (profile as { bio?: string | null }).bio ?? null,
    location: (profile as { location?: string | null }).location ?? null,
  });
}

export const GET = withAuth(handleGet, {
  errorMessage: "Failed to load profile",
});
