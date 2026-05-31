/**
 * Morning Forecast Bot Cron Job
 *
 * Runs daily at 5:30am PT to post regional surf forecasts from "Quiver Surf Forecast"
 * system account. Creates three posts - one for each major California region.
 *
 * Schedule: 30 5 * * * (5:30am PT daily)
 */

import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from '@/lib/middleware/api-wrappers';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import {
  fetchRegionalForecast,
  generateRegionalForecast,
  getRegionalBeachId,
} from '@/lib/npc/forecast-formatter';
import { withObservedCron } from '@/lib/cron/observability';

export const revalidate = 0;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The Quiver Surf Forecast system account ID
// This is set in the cleanup migration: 3290f65d-b474-49e2-ac5e-27de2db3fc9e
const FORECAST_BOT_DISPLAY_NAME = 'Quiver Surf Forecast';

interface RegionResult {
  region: 'norcal' | 'central' | 'socal';
  success: boolean;
  postId?: string;
  title?: string;
  error?: string;
}

/**
 * GET /api/cron/morning-forecast-bot
 *
 * Posts regional morning forecasts for NorCal, Central Coast, and SoCal.
 */
async function _GET(request: Request): Promise<Response> {
  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse('Unauthorized', 'Invalid cron authentication', 401);
    }

    const startMs = Date.now();
    const supabase = await createSupabaseServiceRoleClient();

    // Find the forecast bot profile
    const { data: botProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('full_name', FORECAST_BOT_DISPLAY_NAME)
      .eq('is_system_account', true)
      .limit(1)
      .single();

    if (profileError || !botProfile) {
      console.error('[morning-forecast-bot] Could not find forecast bot profile:', profileError);
      return createErrorResponse(
        'Bot profile not found',
        `Could not find system account "${FORECAST_BOT_DISPLAY_NAME}"`,
        500
      );
    }

    const botUserId = botProfile.id;
    console.log(`[morning-forecast-bot] Using bot profile: ${botUserId}`);

    const regions: Array<'norcal' | 'central' | 'socal'> = ['norcal', 'central', 'socal'];
    const results: RegionResult[] = [];
    const now = new Date();

    for (const region of regions) {
      try {
        console.log(`[morning-forecast-bot] Processing region: ${region}`);

        // Fetch regional forecast data
        const forecastData = await fetchRegionalForecast(supabase, region);

        if (!forecastData) {
          console.warn(`[morning-forecast-bot] No forecast data for ${region}`);
          results.push({
            region,
            success: false,
            error: 'No forecast data available',
          });
          continue;
        }

        // Generate the forecast content
        const { title, description } = generateRegionalForecast(forecastData);

        // Get representative beach for tagging
        const beachId = await getRegionalBeachId(supabase, region);

        if (!beachId) {
          console.warn(`[morning-forecast-bot] No representative beach for ${region}`);
          results.push({
            region,
            success: false,
            error: 'No representative beach found',
          });
          continue;
        }

        // Get beach coordinates for the post
        const { data: beach } = await supabase
          .from('beaches')
          .select('lat, lon')
          .eq('id', beachId)
          .single();

        // Create the intel post
        const { data: post, error: postError } = await supabase
          .from('intel_posts')
          .insert({
            user_id: botUserId,
            beach_id: beachId,
            latitude: beach?.lat || getRegionDefaultLat(region),
            longitude: beach?.lon || getRegionDefaultLon(region),
            tag: 'conditions',
            title,
            description,
            is_active: true,
            expires_at: new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString(), // 18 hours
            created_at: now.toISOString(),
          })
          .select('id')
          .single();

        if (postError) {
          console.error(`[morning-forecast-bot] Failed to create post for ${region}:`, postError);
          results.push({
            region,
            success: false,
            error: postError.message,
          });
          continue;
        }

        console.log(`[morning-forecast-bot] Created forecast post for ${region}: ${post.id}`);
        results.push({
          region,
          success: true,
          postId: post.id,
          title,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[morning-forecast-bot] Error processing ${region}:`, message);
        results.push({
          region,
          success: false,
          error: message,
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.length - successful;

    console.log(`[morning-forecast-bot] Completed: ${successful} forecasts posted, ${failed} failed`);

    return createSuccessResponse({
      summary: {
        regions: regions.length,
        successful,
        failed,
        durationMs: Date.now() - startMs,
      },
      results,
    });
  } catch (error) {
    return handleApiError(error, 'Failed to run morning forecast bot');
  }
}

export const GET = withObservedCron('/api/cron/morning-forecast-bot', _GET);

/**
 * Default latitude for each region (fallback if beach lookup fails)
 */
function getRegionDefaultLat(region: 'norcal' | 'central' | 'socal'): number {
  const coords = {
    norcal: 37.7749, // SF
    central: 36.9741, // Santa Cruz
    socal: 32.8801, // San Diego
  };
  return coords[region];
}

/**
 * Default longitude for each region (fallback if beach lookup fails)
 */
function getRegionDefaultLon(region: 'norcal' | 'central' | 'socal'): number {
  const coords = {
    norcal: -122.4194,
    central: -122.0308,
    socal: -117.234,
  };
  return coords[region];
}
