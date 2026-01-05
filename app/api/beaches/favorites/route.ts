import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

/**
 * GET /api/beaches/favorites - List authenticated user's favorite beaches
 */
export const GET = withAuth(
  async (_request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const { data, error: dbError } = await supabase
      .from("favorite_beaches")
      .select("rank, beaches(*)")
      .eq("user_id", user.id)
      .order("rank", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (dbError) {
      throw dbError;
    }

    const beaches = (data || [])
      .map((row: { beaches: unknown }) => row.beaches)
      .filter(Boolean);

    return createSuccessResponse({ beaches });
  },
  { errorMessage: "Failed to load favorite beaches" }
);
