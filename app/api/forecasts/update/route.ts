import { NextRequest, NextResponse } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { DEFAULT_SECURITY_HEADERS } from "@/lib/api-utils";
import {
  updateBeachForecast,
  updateAllBeachForecasts,
} from "@/lib/utils/forecast-server-utils";
import { isAdmin, type AdminUser } from "@/lib/auth/admin";
import type { User } from "@supabase/supabase-js";

/**
 * Admin guard - returns 403 response if user is not admin, null otherwise
 */
function adminGuard(user: User): NextResponse | null {
  if (!isAdmin(user as AdminUser)) {
    return NextResponse.json(
      { success: false, error: "Admin access required" },
      { status: 403, headers: DEFAULT_SECURITY_HEADERS }
    );
  }
  return null;
}

/**
 * Forecast Update API Endpoint
 *
 * Updates forecasts using the enhanced forecast system with NOAA data sources
 *
 * SECURITY: Requires admin authentication
 *
 * Usage:
 * - POST /api/forecasts/update (updates all beaches)
 * - POST /api/forecasts/update?beachId=xyz (updates specific beach)
 */

async function forecastUpdatePostHandler(
  request: NextRequest,
  { user }: AuthenticatedContext
): Promise<NextResponse> {
  const forbidden = adminGuard(user);
  if (forbidden) return forbidden;

  console.log(`🔐 Forecast update initiated by admin: ${user.email}`);

  const { searchParams } = new URL(request.url);
  const beachId = searchParams.get("beachId");

  console.log("🚀 Starting forecast update request");

  if (beachId) {
    // Update specific beach
    console.log(`📍 Updating forecasts for beach: ${beachId}`);

    const data = await updateBeachForecast(beachId);

    return createSuccessResponse({
      ...data,
      message: "Enhanced forecasts updated for beach",
    });
  } else {
    // Update all beaches
    console.log("🌊 Updating forecasts for all beaches");

    const result = await updateAllBeachForecasts();

    const successful = result.results?.filter((r) => r.success).length || 0;
    const failed = (result.results?.length || 0) - successful;

    return createSuccessResponse({
      total: result.results?.length || 0,
      successful,
      failed,
      results: result.results || [],
      message: "Enhanced forecasts updated for all beaches",
    });
  }
}

async function forecastUpdateGetHandler(
  _request: NextRequest,
  { user }: AuthenticatedContext
): Promise<NextResponse> {
  const forbidden = adminGuard(user);
  if (forbidden) return forbidden;

  return NextResponse.json({
    message: "Enhanced Forecast Update API",
    usage: {
      "POST /api/forecasts/update": "Update all beaches",
      "POST /api/forecasts/update?beachId=xyz": "Update specific beach",
    },
    dataSource:
      "Enhanced forecast system using NOAA WaveWatch III, CO-OPS, Weather Service, and NDBC buoys",
    timestamp: new Date().toISOString(),
  });
}

export const POST = withAuth(forecastUpdatePostHandler, {
  errorMessage: "Failed to update forecasts",
});

export const GET = withAuth(forecastUpdateGetHandler, {
  errorMessage: "Failed to get forecast update info",
});

// Force-dynamic route to ensure we get fresh data
export const dynamic = "force-dynamic";
