import { NextRequest, NextResponse } from "next/server";
import {
  handleApiError,
  createPaginatedResponse,
  createCachedResponse,
  CacheDuration,
  parsePaginationParams,
  createPaginationMeta,
} from "@/lib/api-utils";
import { searchBeachesMultiple } from "@/lib/utils/beach-search-utils";
import { withBotBlockingAndRateLimit } from "@/lib/middleware/api-wrappers";

export const dynamic = 'force-dynamic';

async function beachSearchHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get("query") || "";
    const query = rawQuery.trim();

    // Parse pagination parameters (default: page=1, limit=20, max=50)
    const { page, limit } = parsePaginationParams(searchParams, 20, 50);

    if (!query) {
      // Empty query - return empty results with cache
      return await createPaginatedResponse(
        [],
        createPaginationMeta(page, limit, 0),
        CacheDuration.MEDIUM
      );
    }

    // Get all matching results
    const allResults = await searchBeachesMultiple(query);

    // Calculate pagination
    const total = allResults.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedResults = allResults.slice(startIndex, endIndex);

    // Create pagination metadata
    const meta = createPaginationMeta(page, limit, total);

    // Return paginated results with 5min cache + SWR
    return await createPaginatedResponse(
      paginatedResults,
      meta,
      CacheDuration.MEDIUM
    );
  } catch (error) {
    console.error("Error searching beaches:", error);
    return handleApiError(error, "Failed to search beaches");
  }
}

// Apply bot blocking and rate limiting to prevent abuse of expensive search operations
export const GET = withBotBlockingAndRateLimit(beachSearchHandler, "beach-search");
