import type { NextRequest } from "next/server";
import {
  withAuth,
  validateUuidParam,
  createSuccessResponse,
  methodNotAllowed,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

/**
 * GET /api/users/[id]/following - List users this profile is following.
 * Uses the Bearer-aware supabase client from withAuth context so native
 * clients can load this list (server actions use cookie-only auth).
 */
export const GET = withAuth(
  async (request: NextRequest, { supabase, params }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.id, "user");
    if ("error" in uuidResult) return uuidResult.error;

    const { searchParams } = new URL(request.url);
    const rawLimit = parseInt(searchParams.get("limit") || "50", 10);
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 100);

    const { data, error } = await supabase
      .from("user_follows")
      .select(`
        id,
        created_at,
        following:profiles!user_follows_following_id_fkey(id, full_name, avatar_url)
      `)
      .eq("follower_id", uuidResult.value)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const users = (data || [])
      .map((row: { following: unknown }) => row.following)
      .filter(Boolean);

    return createSuccessResponse({ users });
  },
  { errorMessage: "Failed to load following" },
);

export function POST() {
  return methodNotAllowed(["GET"]);
}
