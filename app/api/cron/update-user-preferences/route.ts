import { NextRequest } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { computeUserPreferences } from '@/lib/services/preference-learning-service';
import {
  createSuccessResponse,
  createErrorResponse,
  validateCronRequest,
} from '@/lib/middleware/api-wrappers';
import { withObservedCron } from '@/lib/cron/observability';
import { withCronOutcome } from '@/lib/cron/outcome';

interface UserPreferenceUpdateResult {
  totalUsers: number;
  successful: number;
  failed: number;
  skipped: number;
  duration: string;
  failures: Array<{
    userId: string;
    error: string;
  }>;
}

function getSearchParams(request: Request | NextRequest): URLSearchParams {
  const maybeNextUrl = (request as NextRequest).nextUrl;
  if (maybeNextUrl?.searchParams) {
    return maybeNextUrl.searchParams;
  }

  if (request.url) {
    try {
      return new URL(request.url).searchParams;
    } catch {
      return new URLSearchParams();
    }
  }

  return new URLSearchParams();
}

function isTruthyParam(value: string | null): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

/**
 * GET /api/cron/update-user-preferences
 *
 * Nightly cron job that updates user surf preferences by analyzing session history.
 * Processes eligible users (those with 5+ rated sessions) in batches.
 * Excludes NPC/bot users (is_mock = true) from preference learning.
 *
 * Authentication:
 * - Bearer token (Authorization: Bearer <CRON_SECRET>)
 *
 * Schedule: Daily at 3:00 AM UTC (defined in vercel.json)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     totalUsers: number,
 *     successful: number,
 *     failed: number,
 *     skipped: number,
 *     duration: string,
 *     failures: Array<{ userId: string, error: string }>
 *   }
 * }
 */
async function _GET(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    // 1. Environment check - production only
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
    if (env !== 'production') {
      console.log(`⚠️ Preference update cron skipped for environment: ${env}`);
      return createErrorResponse(
        'Forbidden',
        `Preference update cron disabled for environment: ${env}. Only runs in production.`,
        403
      );
    }

    // 2. Validate cron authorization
    if (!validateCronRequest(request)) {
      console.error('❌ Unauthorized preference update cron attempt');
      return createErrorResponse(
        'Unauthorized',
        'Invalid cron authentication. Requires valid Bearer token.',
        401
      );
    }

    console.log('🏄 Starting nightly user preference updates...');

    const searchParams = getSearchParams(request);
    const includeMockUsers =
      isTruthyParam(searchParams.get('includeMock')) ||
      isTruthyParam(searchParams.get('includeMockUsers'));

    // 3. Get eligible users (those with rated sessions, excluding NPC/bot users)
    const supabase = createSupabaseServiceRoleClient();

    // First, get NPC/bot user IDs to exclude from production preference learning.
    // Manual cron calls can pass includeMock=true to exercise seeded data.
    const { data: npcUsers } = includeMockUsers
      ? { data: [] as Array<{ id: string }> }
      : await supabase
          .from('profiles')
          .select('id')
          .eq('is_mock', true);

    const npcUserIds = new Set(npcUsers?.map((u) => u.id) || []);

    // Query users with either wave-quality or legacy rating signals. The
    // compute step owns the stricter rules and skips insufficient histories.
    const [usersWithWaveQuality, usersWithRatings] = await Promise.all([
      supabase
        .from('session_forecast_snapshots')
        .select('user_id')
        .not('actual_conditions->>wave_quality', 'is', null)
        .gte('actual_conditions->>wave_quality', '4'),
      supabase
        .from('session_forecast_snapshots')
        .select('user_id')
        .not('actual_conditions->>rating', 'is', null)
        .gte('actual_conditions->>rating', '3'),
    ]);

    const queryError = usersWithWaveQuality.error || usersWithRatings.error;
    if (queryError) {
      console.error('❌ Failed to query eligible users:', queryError);
      throw new Error(`Failed to query eligible users: ${queryError.message}`);
    }

    // Get unique user IDs, excluding NPC/bot users
    const uniqueUserIds = [
      ...new Set([
        ...((usersWithWaveQuality.data ?? []).map((s) => s.user_id)),
        ...((usersWithRatings.data ?? []).map((s) => s.user_id)),
      ]),
    ].filter((userId) => !npcUserIds.has(userId));

    const excludedNpcCount = npcUserIds.size;
    if (includeMockUsers) {
      console.log('🧪 Including mock/NPC users for manual preference-learning run');
    } else {
      console.log(`🤖 Excluding ${excludedNpcCount} NPC/bot users from preference learning`);
    }

    if (uniqueUserIds.length === 0) {
      console.log('ℹ️ No eligible users found for preference updates');
      return createSuccessResponse(
        await withCronOutcome(
          {
            job: "/api/cron/update-user-preferences",
            unit: "preferences_updated",
            expectedMin: 1,
            getProduced: (value) => value.successful,
            legitimatelyZero: () => ({ reason: "No users had enough rated session history for preference learning" }),
          },
          async () => ({
            totalUsers: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            duration: `${Date.now() - startTime}ms`,
            failures: [],
            includeMockUsers,
            excludedMockUsers: excludedNpcCount,
            message: 'No eligible users found for preference updates',
          }),
        ),
        200,
      );
    }

    console.log(`📊 Found ${uniqueUserIds.length} users with rated sessions`);

    // 4. Process users in batches
    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 1000;

    const results: UserPreferenceUpdateResult = {
      totalUsers: uniqueUserIds.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      duration: '',
      failures: [],
    };

    const batches: string[][] = [];
    for (let i = 0; i < uniqueUserIds.length; i += BATCH_SIZE) {
      batches.push(uniqueUserIds.slice(i, i + BATCH_SIZE));
    }

    console.log(
      `🔄 Processing ${uniqueUserIds.length} users in ${batches.length} batches (${BATCH_SIZE} users/batch, ${BATCH_DELAY_MS}ms delay)`
    );

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      // Add delay between batches (except first batch)
      if (batchIndex > 0) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }

      console.log(
        `⏳ Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} users)...`
      );

      // Process all users in batch concurrently
      const batchPromises = batch.map(async (userId) => {
        try {
          const preferences = await computeUserPreferences(userId);

          if (preferences === null) {
            // Not enough data (< 5 rated sessions) - this is expected for some users
            results.skipped++;
            return { success: true, userId, skipped: true };
          }

          results.successful++;
          return { success: true, userId, skipped: false };
        } catch (error) {
          results.failed++;
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          console.error(
            `❌ Failed to update preferences for user ${userId}:`,
            errorMessage
          );

          results.failures.push({
            userId,
            error: errorMessage,
          });

          return { success: false, userId, error: errorMessage };
        }
      });

      // Wait for entire batch to complete
      await Promise.allSettled(batchPromises);

      console.log(
        `✅ Batch ${batchIndex + 1}/${batches.length} complete (Success: ${results.successful}, Skipped: ${results.skipped}, Failed: ${results.failed})`
      );
    }

    results.duration = `${Date.now() - startTime}ms`;

    const successMessage = `Preference updates completed: ${results.successful} successful, ${results.skipped} skipped, ${results.failed} failed`;
    console.log(`✅ ${successMessage} in ${results.duration}`);

    if (results.failures.length > 0) {
      console.warn(`⚠️ ${results.failures.length} failures encountered:`);
      results.failures.slice(0, 5).forEach(({ userId, error }) => {
        console.warn(`  - User ${userId}: ${error}`);
      });
      if (results.failures.length > 5) {
        console.warn(`  ... and ${results.failures.length - 5} more`);
      }
    }

    return createSuccessResponse(
      await withCronOutcome(
        {
          job: "/api/cron/update-user-preferences",
          unit: "preferences_updated",
          expectedMin: 1,
          getProduced: (value) => value.successful,
          legitimatelyZero: (value) =>
            value.totalUsers === 0
              ? { reason: "No users had enough rated session history for preference learning" }
              : undefined,
        },
        async () => ({
          ...results,
          includeMockUsers,
          excludedMockUsers: excludedNpcCount,
          message: successMessage,
        }),
      ),
      200,
    );
  } catch (error) {
    const duration = `${Date.now() - startTime}ms`;
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.error('❌ Preference update cron job failed:', errorMessage);

    return createErrorResponse(
      'Preference update cron job failed',
      {
        error: errorMessage,
        duration,
      },
      500
    );
  }
}

/**
 * POST /api/cron/update-user-preferences
 *
 * Alias for GET handler - allows manual triggering via POST request.
 * The main cron logic is in the GET handler (Vercel crons use GET).
 */
async function _POST(request: Request): Promise<Response> {
  return _GET(request);
}

export const GET = withObservedCron("/api/cron/update-user-preferences", _GET);
export const POST = withObservedCron("/api/cron/update-user-preferences", _POST);
