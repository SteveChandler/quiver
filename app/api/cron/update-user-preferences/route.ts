import { NextRequest } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { computeUserPreferences } from '@/lib/services/preference-learning-service';
import {
  createSuccessResponse,
  createErrorResponse,
  validateCronRequest,
} from '@/lib/api-utils';

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

/**
 * POST /api/cron/update-user-preferences
 *
 * Nightly cron job that updates user surf preferences by analyzing session history.
 * Processes eligible users (those with 5+ rated sessions) in batches.
 *
 * Authentication:
 * - Vercel Cron header (x-vercel-cron: 1)
 * - OR Bearer token (Authorization: Bearer CRON_SECRET_TOKEN)
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
export async function POST(request: NextRequest): Promise<Response> {
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
        'Invalid cron authentication. Requires Vercel Cron header or valid Bearer token.',
        401
      );
    }

    console.log('🏄 Starting nightly user preference updates...');

    // 3. Get eligible users (those with rated sessions)
    const supabase = createSupabaseServiceRoleClient();

    // Query users who have at least 5 rated sessions (rating >= 3)
    // We query session_forecast_snapshots which contains actual_conditions JSONB
    const { data: usersWithSessions, error: queryError } = await supabase
      .from('session_forecast_snapshots')
      .select('user_id')
      .not('actual_conditions->>rating', 'is', null)
      .gte('actual_conditions->>rating', '3');

    if (queryError) {
      console.error('❌ Failed to query eligible users:', queryError);
      throw new Error(`Failed to query eligible users: ${queryError.message}`);
    }

    // Get unique user IDs
    const uniqueUserIds = [
      ...new Set(usersWithSessions?.map((s) => s.user_id) || []),
    ];

    if (uniqueUserIds.length === 0) {
      console.log('ℹ️ No eligible users found for preference updates');
      return createSuccessResponse(
        {
          totalUsers: 0,
          successful: 0,
          failed: 0,
          skipped: 0,
          duration: `${Date.now() - startTime}ms`,
          failures: [],
          message: 'No eligible users found for preference updates',
        },
        200
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
      {
        ...results,
        message: successMessage,
      },
      200
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
 * GET /api/cron/update-user-preferences
 *
 * Health check endpoint for monitoring the preference update cron service.
 *
 * Authentication: Same as POST (Vercel Cron header or Bearer token)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     status: 'healthy' | 'degraded',
 *     timestamp: string,
 *     services: {
 *       database: boolean,
 *       preferencesTable: boolean
 *     },
 *     stats: {
 *       totalPreferences: number
 *     }
 *   }
 * }
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Environment check
    const env = process.env.VERCEL_ENV || process.env.NODE_ENV;
    if (env !== 'production') {
      return createErrorResponse(
        'Forbidden',
        `Health check disabled for environment: ${env}. Only available in production.`,
        403
      );
    }

    // Validate authentication
    if (!validateCronRequest(request)) {
      return createErrorResponse(
        'Unauthorized',
        'Invalid cron authentication. Requires Vercel Cron header or valid Bearer token.',
        401
      );
    }

    const supabase = createSupabaseServiceRoleClient();

    // Check database connectivity and preferences table
    const { error: dbError, count } = await supabase
      .from('user_surf_preferences')
      .select('*', { count: 'exact', head: true });

    const isHealthy = !dbError;

    const healthStatus = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: isHealthy,
        preferencesTable: isHealthy,
      },
      stats: {
        totalPreferences: count || 0,
      },
    };

    if (!isHealthy) {
      console.error('⚠️ Preference update cron health check degraded:', dbError);
    }

    return createSuccessResponse(
      healthStatus,
      isHealthy
        ? 'Preference update cron service is healthy'
        : 'Preference update cron service is degraded'
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.error('❌ Health check failed:', errorMessage);

    return createErrorResponse(
      'Health check failed',
      {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
}
