import { NextRequest } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";

export const dynamic = 'force-dynamic';

/**
 * Search for users by name or email
 * GET /api/users/search?q=search_term&limit=20
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!query || query.trim().length < 2) {
      return createSuccessResponse({
        users: [],
        message: "Search query must be at least 2 characters",
      });
    }

    const supabase = createAPIServerClient();

    // Get current user to exclude from search results
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return createSuccessResponse({
        users: [],
        message: "Authentication required for user search",
      });
    }

    const searchTerm = query.trim();
    const sanitizedSearchTerm = searchTerm.replace(/[,]/g, " ");
    const searchPattern = `%${sanitizedSearchTerm}%`;
    const normalizedSearchTerm = sanitizedSearchTerm.toLowerCase();

    // Search users by name or email (case-insensitive)
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, full_name, followers_count, following_count, avatar_url, email")
      .or(`full_name.ilike.${searchPattern},email.ilike.${searchPattern}`)
      .neq("id", user.id) // Exclude current user
      .gt("followers_count", -1) // Ensure valid data
      .order("followers_count", { ascending: false })
      .limit(Math.min(limit, 50)); // Cap at 50 for performance

    if (error) {
      throw error;
    }

    // Filter out null/empty names and add search relevance
    const filteredUsers = (users || [])
      .filter((u) => u.full_name && u.full_name.trim().length > 0)
      .map(({ email, ...user }) => {
        const normalizedName = user.full_name?.toLowerCase() ?? "";
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
          ...user,
          relevance,
        };
      })
      .sort((a, b) => {
        // Sort by relevance first, then by follower count
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

  } catch (error) {
    console.error("Error searching users:", error);
    return handleApiError(error);
  }
}
