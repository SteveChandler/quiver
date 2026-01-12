import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  methodNotAllowed,
  type AuthenticatedHandler,
} from "@/lib/middleware/api-wrappers";

/**
 * GET /api/gamification/user-badges - Get current user's unlocked badges
 */
export const GET = withAuth(
  (async (_request: NextRequest, { user, supabase }) => {
    const { data, error } = await supabase
      .from("user_badges")
      .select(
        `
        badge_slug,
        unlocked_at,
        context,
        badge_definitions (
          name,
          description,
          icon,
          category,
          xp_reward
        )
      `
      )
      .eq("user_id", user.id)
      .order("unlocked_at", { ascending: false });

    if (error) throw error;

    return createSuccessResponse({ badges: data || [] });
  }) as AuthenticatedHandler,
  { errorMessage: "Failed to load user badges" }
);

export function POST() {
  return methodNotAllowed(["GET"]);
}

export function PUT() {
  return methodNotAllowed(["GET"]);
}

export function PATCH() {
  return methodNotAllowed(["GET"]);
}

export function DELETE() {
  return methodNotAllowed(["GET"]);
}













