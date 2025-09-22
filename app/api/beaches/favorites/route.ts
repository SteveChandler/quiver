import { createSuccessResponse, handleApiError, createAuthError } from "@/lib/api-utils";
import { getAuthenticatedAPIClient } from "@/lib/supabase/server";

// GET /api/beaches/favorites - list authenticated user's favorite beaches
export async function GET() {
  try {
    const { supabase, user, error } = await getAuthenticatedAPIClient();
    if (error || !user || !supabase) {
      return createAuthError();
    }

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
      .map((row: any) => row.beaches)
      .filter(Boolean);

    return createSuccessResponse({ beaches });
  } catch (err) {
    return handleApiError(err);
  }
}


