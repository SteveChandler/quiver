import { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

/**
 * Search for users by name or email.
 * GET /api/users/search?q=search_term&limit=20
 *
 * Uses `withAuth`, which resolves auth from either the Bearer token (native
 * clients) or the SSR cookie session (web). The prior handler used a cookie-
 * only client and silently returned empty results for Bearer-auth callers.
 */
async function userSearchHandler(
  request: NextRequest,
  { user, supabase }: AuthenticatedContext,
) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "20");

  if (!query || query.trim().length < 2) {
    return createSuccessResponse({
      users: [],
      message: "Search query must be at least 2 characters",
    });
  }

  const searchTerm = query.trim();
  const sanitizedSearchTerm = searchTerm.replace(/[,]/g, " ");
  const searchPattern = `%${sanitizedSearchTerm}%`;
  const normalizedSearchTerm = sanitizedSearchTerm.toLowerCase();

  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, full_name, followers_count, following_count, avatar_url, email")
    .or(`full_name.ilike.${searchPattern},email.ilike.${searchPattern}`)
    .neq("id", user.id)
    .gt("followers_count", -1)
    .order("followers_count", { ascending: false })
    .limit(Math.min(limit, 50));

  if (error) {
    throw error;
  }

  const filteredUsers = (users || [])
    .filter((u) => {
      const hasName = Boolean(u.full_name && u.full_name.trim().length > 0);
      return hasName || Boolean(u.email);
    })
    .map(({ email, ...rest }) => {
      const normalizedName = rest.full_name?.toLowerCase() ?? "";
      const normalizedEmail = email?.toLowerCase() ?? "";

      let relevance = 0;

      if (normalizedName.includes(normalizedSearchTerm)) {
        relevance += 1;
        if (normalizedName === normalizedSearchTerm) {
          relevance += 1;
        }
      }

      if (normalizedEmail.includes(normalizedSearchTerm)) {
        relevance += 2;
        if (normalizedEmail === normalizedSearchTerm) {
          relevance += 2;
        }
      }

      return {
        ...rest,
        relevance,
      };
    })
    .sort((a, b) => {
      if (a.relevance !== b.relevance) {
        return b.relevance - a.relevance;
      }
      return (b.followers_count || 0) - (a.followers_count || 0);
    });

  return createSuccessResponse({
    users: filteredUsers,
    total: filteredUsers.length,
    query: searchTerm,
  });
}

export const GET = withAuth(userSearchHandler, {
  errorMessage: "Failed to search users",
});
