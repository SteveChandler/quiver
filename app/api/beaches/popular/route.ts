import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createCachedResponse,
  CacheDuration,
  handleApiError,
} from "@/lib/api-utils";
import { withRateLimit } from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

// Well-known beaches as fallback when DB query returns empty
const FALLBACK_BEACH_NAMES = [
  "Black's Beach",
  "Swami's",
  "Trestles",
  "Pipeline",
  "Rincon",
  "Malibu",
  "Huntington Beach",
  "Ocean Beach",
];

async function popularBeachesHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawLimit = parseInt(searchParams.get("limit") || "8", 10);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 8, 1), 20);

  try {
    const supabase = await createSupabaseServerClient();

    // Try RPC function first (most accurate popularity ranking)
    // TODO: RPC function missing from DB types
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
      "get_popular_beaches",
      { p_limit: limit }
    );

    if (!rpcError && rpcData && (rpcData as any[]).length > 0) {
      return await createCachedResponse(rpcData, CacheDuration.SHORT);
    }

    // Fallback: query beaches by name matching well-known beaches
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("beaches")
      .select("id, name, slug, city, state")
      .in("name", FALLBACK_BEACH_NAMES)
      .limit(limit);

    if (fallbackError) throw fallbackError;

    return await createCachedResponse(fallbackData || [], CacheDuration.SHORT);
  } catch (error) {
    console.error("Error fetching popular beaches:", error);
    return handleApiError(error, "Error fetching popular beaches");
  }
}

// Apply rate limiting
export const GET = withRateLimit(popularBeachesHandler, "public-default");
