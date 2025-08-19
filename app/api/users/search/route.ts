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
    
    // Search users by name (case-insensitive)
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, full_name, followers_count, following_count")
      .ilike("full_name", `%${searchTerm}%`)
      .neq("id", user.id) // Exclude current user
      .gt("followers_count", -1) // Ensure valid data
      .order("followers_count", { ascending: false })
      .limit(Math.min(limit, 50)); // Cap at 50 for performance

    if (error) {
      throw error;
    }

    // Filter out null/empty names and add search relevance
    const filteredUsers = (users || [])
      .filter(u => u.full_name && u.full_name.trim().length > 0)
      .map(user => ({
        ...user,
        // Add relevance score (exact match = higher score)
        relevance: user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) 
          ? (user.full_name.toLowerCase() === searchTerm.toLowerCase() ? 2 : 1)
          : 0
      }))
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
