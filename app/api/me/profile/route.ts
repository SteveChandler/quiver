import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  createNotFoundError,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { getProfileWithHomeBeachById } from "@/lib/profile/fetchers";

export const dynamic = "force-dynamic";

/**
 * GET /api/me/profile - Get current user's profile.
 *
 * Uses `withAuth` so both cookie (web) and Bearer (native) auth resolve
 * the user. The prior handler used a cookie-only `createSupabaseServerClient`
 * and returned 401 for every native caller.
 */

async function handleGet(
  _request: NextRequest,
  context: AuthenticatedContext,
) {
  const { user, supabase } = context;

  const { profile, homeBeachName } = await getProfileWithHomeBeachById(
    user.id,
    supabase,
  );

  if (!profile) {
    return createNotFoundError("Profile");
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
