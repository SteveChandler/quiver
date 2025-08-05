/**
 * Enhanced Forecast Sync Cron Job API
 * Orchestrates CDIP + NOAA data ingestion for all beaches
 */

import { NextRequest } from "next/server";
import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";
import { CDIPService } from "@/lib/services/cdip-service";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  createErrorResponse,
  validateCronAuth,
  ForecastUpdateStats,
} from "@/lib/api-response-utils";
import { CDIPRateLimiter, NOAARateLimiter } from "@/lib/utils/rate-limiter";

interface Beach {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface CronSyncResult {
  totalBeaches: number;
  successful: number;
  failed: number;
  cdipStationsUpdated: string[];
  duration: string;
  failures: Array<{
    beachId: string;
    beachName: string;
    error: string;
  }>;
}

/**
 * POST - Main cron job endpoint for enhanced forecast sync
 */
export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now();

  try {
    // Validate cron authentication
    const authHeader = request.headers.get("authorization");
    if (!validateCronAuth(authHeader)) {
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    // Check rate limits before proceeding
    if (!CDIPRateLimiter.canMakeRequest()) {
      const resetTime = CDIPRateLimiter.getTimeUntilReset();
      return createErrorResponse(
        "CDIP API rate limit exceeded",
        { resetInMs: resetTime },
        429
      );
    }

    if (!NOAARateLimiter.canMakeRequest()) {
      const resetTime = NOAARateLimiter.getTimeUntilReset();
      return createErrorResponse(
        "NOAA API rate limit exceeded",
        { resetInMs: resetTime },
        429
      );
    }

    // Initialize services
    const enhancedForecastService = new EnhancedForecastService();
    const cdipService = new CDIPService();
    const supabase = createSupabaseServiceRoleClient();

    // Fetch all beaches from database
    const { data: beaches, error: beachError } = await supabase
      .from("beaches")
      .select("id, name, latitude, longitude");

    if (beachError) {
      throw new Error(`Failed to fetch beaches: ${beachError.message}`);
    }

    if (!beaches || beaches.length === 0) {
      return createSuccessResponse(
        {
          totalBeaches: 0,
          successful: 0,
          failed: 0,
          cdipStationsUpdated: [],
          duration: `${Date.now() - startTime}ms`,
          failures: [],
        },
        "No beaches found to sync"
      );
    }

    // Fetch CDIP stations for Southern California beaches first
    // Filter by geographic coordinates (Southern California region)
    const socaBeaches = beaches.filter(
      (beach: Beach) =>
        beach.latitude >= 32.0 &&
        beach.latitude <= 35.0 &&
        beach.longitude >= -120.0 &&
        beach.longitude <= -117.0
    );

    const cdipStationsUpdated: string[] = [];
    if (socaBeaches.length > 0) {
      try {
        const stations = cdipService.getSouthernCaliforniaStations();
        await cdipService.fetchMultipleStations(stations);
        cdipStationsUpdated.push(...stations);
        CDIPRateLimiter.recordRequest();
      } catch (error) {
        console.warn("Failed to update CDIP stations:", error);
      }
    }

    // Process each beach with enhanced forecast generation
    const results: CronSyncResult = {
      totalBeaches: beaches.length,
      successful: 0,
      failed: 0,
      cdipStationsUpdated,
      duration: "",
      failures: [],
    };

    // Process beaches in batches to avoid overwhelming APIs
    const BATCH_SIZE = 5;
    const batches = [];
    for (let i = 0; i < beaches.length; i += BATCH_SIZE) {
      batches.push(beaches.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const batchPromises = batch.map(async (beach: Beach) => {
        try {
          // Generate comprehensive forecast with CDIP integration
          const forecasts =
            await enhancedForecastService.generateComprehensiveForecast(beach);

          // Store forecasts with raw data
          const storeResult =
            await enhancedForecastService.storeEnhancedForecasts(
              beach,
              forecasts
            );

          if (!storeResult.success) {
            throw new Error(storeResult.error || "Failed to store forecasts");
          }

          results.successful++;

          // Record API usage for rate limiting
          NOAARateLimiter.recordRequest();

          return { success: true, beachId: beach.id };
        } catch (error) {
          results.failed++;
          results.failures.push({
            beachId: beach.id,
            beachName: beach.name,
            error: error instanceof Error ? error.message : String(error),
          });

          console.error(`Failed to sync beach ${beach.name}:`, error);
          return { success: false, beachId: beach.id, error };
        }
      });

      // Wait for batch to complete before processing next batch
      await Promise.allSettled(batchPromises);

      // Small delay between batches to be respectful of APIs
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    results.duration = `${Date.now() - startTime}ms`;

    return createSuccessResponse(
      results,
      `Enhanced forecast sync completed: ${results.successful}/${results.totalBeaches} beaches updated`
    );
  } catch (error) {
    console.error("Enhanced forecast sync failed:", error);
    return createErrorResponse(
      "Enhanced forecast sync failed",
      {
        error: error instanceof Error ? error.message : String(error),
        duration: `${Date.now() - startTime}ms`,
      },
      500
    );
  }
}

/**
 * GET - Health check endpoint
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Basic auth check for GET requests too
    const authHeader = request.headers.get("authorization");
    if (!validateCronAuth(authHeader)) {
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    // Check system health
    const cdipRateLimit = CDIPRateLimiter.canMakeRequest();
    const noaaRateLimit = NOAARateLimiter.canMakeRequest();
    const supabase = createSupabaseServiceRoleClient();

    // Quick database connectivity check
    const { error: dbError } = await supabase
      .from("beaches")
      .select("count", { count: "exact", head: true });

    const healthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: !dbError,
        cdipRateLimit,
        noaaRateLimit,
      },
      rateLimits: {
        cdip: {
          canMakeRequest: cdipRateLimit,
          resetInMs: CDIPRateLimiter.getTimeUntilReset(),
        },
        noaa: {
          canMakeRequest: noaaRateLimit,
          resetInMs: NOAARateLimiter.getTimeUntilReset(),
        },
      },
    };

    if (dbError) {
      healthStatus.status = "degraded";
    }

    return createSuccessResponse(
      healthStatus,
      "Enhanced forecast sync service health check"
    );
  } catch (error) {
    return createErrorResponse(
      "Health check failed",
      {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
}
