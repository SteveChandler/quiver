/**
 * Morning Forecast Bot Cron Job
 *
 * Runs daily at 5:30am PT to post regional surf forecasts from "Quiver Surf Forecast"
 * system account. Creates three posts - one for each major California region.
 *
 * Schedule: 30 5 * * * (5:30am PT daily)
 */

import { createHash } from 'node:crypto';
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
import { withCronOutcome } from '@/lib/cron/outcome';
import { isLegacyMorningForecastEnabled } from '@/lib/npc/system-card-config';
import { insertSystemFeedPost } from '@/lib/npc/system-feed-posts';
import { selectBeach } from '@/lib/recommendations/selection';
import { resolveSystemIdentity, SYSTEM_IDENTITY } from '@/lib/system-identity';

export const revalidate = 0;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    if (!isLegacyMorningForecastEnabled()) {
      return createSuccessResponse(await withCronOutcome(
        {
          job: '/api/cron/morning-forecast-bot',
          unit: 'posts_published',
          expectedMin: 1,
          getProduced: (value) => value.summary.successful,
          legitimatelyZero: () => ({ reason: 'Legacy morning forecast posting is disabled; system cards own this output' }),
        },
        async () => ({
          summary: {
            paused: true,
            reason: 'legacy morning forecast route disabled; use /api/cron/system-cards',
            successful: 0,
            failed: 0,
          },
          results: [],
        }),
      ));
    }

    const startMs = Date.now();
    const supabase = await createSupabaseServiceRoleClient();

    let botUserId: string;
    try {
      botUserId = await resolveSystemIdentity(supabase);
    } catch (error) {
      console.error('[morning-forecast-bot] Could not find forecast bot profile:', error);
      return createErrorResponse(
        'Bot profile not found',
        `Could not find system account "${SYSTEM_IDENTITY.displayName}"`,
        500
      );
    }
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

        const selectedBeach = await selectBeach({
          id: beachId,
          name: forecastData.primaryBeach?.name ?? region,
          lat: beach?.lat ?? null,
          lon: beach?.lon ?? null,
        }, { asOf: now });
        if (!selectedBeach) {
          console.warn(`[morning-forecast-bot] Representative beach is held for ${region}`);
          results.push({
            region,
            success: false,
            error: 'Representative beach is not eligible for automated posting',
          });
          continue;
        }

        // Create the intel post
        const post = await insertSystemFeedPost(supabase, {
          userId: botUserId,
          beachId: selectedBeach.id,
          latitude: selectedBeach.lat ?? getRegionDefaultLat(region),
          longitude: selectedBeach.lon ?? getRegionDefaultLon(region),
          title,
          description,
          dedupeHash: createHash('sha256')
            .update(`legacy-morning:${region}:${now.toISOString().slice(0, 10)}`)
            .digest('hex'),
          surfConditions: null,
          expiresAt: new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString(),
          createdAt: now.toISOString(),
        });

        if (post.status !== 'inserted') {
          console.error(`[morning-forecast-bot] Did not create post for ${region}: ${post.status}`);
          results.push({
            region,
            success: false,
            error: `System feed ${post.status}`,
          });
          continue;
        }

        console.log(`[morning-forecast-bot] Created forecast post for ${region}: ${post.postId}`);
        results.push({
          region,
          success: true,
          postId: post.postId ?? undefined,
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

    return createSuccessResponse(await withCronOutcome(
      {
        job: '/api/cron/morning-forecast-bot',
        unit: 'posts_published',
        expectedMin: 1,
        getProduced: (value) => value.summary.successful,
      },
      async () => ({
        summary: {
          regions: regions.length,
          successful,
          failed,
          durationMs: Date.now() - startMs,
        },
        results,
      }),
    ));
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
