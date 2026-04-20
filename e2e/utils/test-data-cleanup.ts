/**
 * E2E Test Data Cleanup Utility
 *
 * Soft-deletes test data created by E2E tests running against dev environment.
 * Uses soft delete patterns (deleted_at / is_active) to avoid permanent data loss.
 *
 * Test users are identified by:
 * 1. Main test user - email from TEST_USER_EMAIL env var
 * 2. Mock persona users - profiles with is_mock = true
 *
 * @see e2e/global-teardown.ts - Automatic cleanup after test runs
 * @see e2e/scripts/cleanup-test-data.ts - Standalone CLI script
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.playwright' });
dotenv.config({ path: '.env.playwright.local' });
dotenv.config({ path: '.env.local' });
dotenv.config();

export interface CleanupResult {
  table: string;
  count: number;
  error?: string;
}

export interface FullCleanupResult {
  sessions: CleanupResult;
  intelPosts: CleanupResult;
  totalCleaned: number;
  durationMs: number;
  testUserIds: string[];
  dryRun: boolean;
}

export interface CleanupOptions {
  /** Preview what would be deleted without actually deleting */
  dryRun?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Override Supabase URL (defaults to env var) */
  supabaseUrl?: string;
  /** Override service role key (defaults to env var) */
  serviceRoleKey?: string;
}

/**
 * Create a Supabase client with service role for bypassing RLS
 */
function createServiceClient(options: CleanupOptions = {}): SupabaseClient {
  const supabaseUrl = options.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = options.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Supabase configuration missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get IDs of all test users (main test user + mock persona users)
 */
async function getTestUserIds(
  supabase: SupabaseClient,
  verbose: boolean = false
): Promise<string[]> {
  const testUserIds: string[] = [];
  const testUserEmail = process.env.TEST_USER_EMAIL;

  // 1. Get main test user by email
  if (testUserEmail) {
    const { data: mainTestUser, error: mainError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', testUserEmail)
      .maybeSingle();

    if (mainError) {
      if (verbose) {
        console.log(`[Cleanup] Warning: Could not fetch main test user: ${mainError.message}`);
      }
    } else if (mainTestUser) {
      testUserIds.push(mainTestUser.id);
      if (verbose) {
        console.log(`[Cleanup] Found main test user: ${mainTestUser.email} (${mainTestUser.id})`);
      }
    }
  } else if (verbose) {
    console.log('[Cleanup] No TEST_USER_EMAIL configured, skipping main test user');
  }

  // 2. Get all mock persona users
  const { data: mockUsers, error: mockError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('is_mock', true);

  if (mockError) {
    if (verbose) {
      console.log(`[Cleanup] Warning: Could not fetch mock users: ${mockError.message}`);
    }
  } else if (mockUsers && mockUsers.length > 0) {
    for (const user of mockUsers) {
      if (!testUserIds.includes(user.id)) {
        testUserIds.push(user.id);
        if (verbose) {
          console.log(`[Cleanup] Found mock user: ${user.email} (${user.id})`);
        }
      }
    }
  }

  return testUserIds;
}

/**
 * Soft-delete sessions from test users
 * Sets deleted_at = NOW() for sessions that are currently active
 */
async function cleanupTestSessions(
  supabase: SupabaseClient,
  testUserIds: string[],
  dryRun: boolean,
  verbose: boolean
): Promise<CleanupResult> {
  if (testUserIds.length === 0) {
    return { table: 'sessions', count: 0 };
  }

  try {
    if (dryRun) {
      // Count what would be soft-deleted
      const { count, error } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .in('user_id', testUserIds)
        .is('deleted_at', null);

      if (error) {
        return { table: 'sessions', count: 0, error: error.message };
      }

      if (verbose && count && count > 0) {
        console.log(`[Cleanup] Would soft-delete ${count} session(s)`);
      }

      return { table: 'sessions', count: count || 0 };
    }

    // Actually soft-delete
    const { data, error } = await supabase
      .from('sessions')
      .update({ deleted_at: new Date().toISOString() })
      .in('user_id', testUserIds)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      return { table: 'sessions', count: 0, error: error.message };
    }

    const count = data?.length || 0;
    if (verbose && count > 0) {
      console.log(`[Cleanup] Soft-deleted ${count} session(s)`);
    }

    return { table: 'sessions', count };
  } catch (err) {
    return { table: 'sessions', count: 0, error: String(err) };
  }
}

/**
 * Soft-delete intel posts from test users
 * Sets is_active = false for posts that are currently active
 */
async function cleanupTestIntelPosts(
  supabase: SupabaseClient,
  testUserIds: string[],
  dryRun: boolean,
  verbose: boolean
): Promise<CleanupResult> {
  if (testUserIds.length === 0) {
    return { table: 'intel_posts', count: 0 };
  }

  try {
    if (dryRun) {
      // Count what would be soft-deleted
      const { count, error } = await supabase
        .from('intel_posts')
        .select('*', { count: 'exact', head: true })
        .in('user_id', testUserIds)
        .eq('is_active', true);

      if (error) {
        return { table: 'intel_posts', count: 0, error: error.message };
      }

      if (verbose && count && count > 0) {
        console.log(`[Cleanup] Would soft-delete ${count} intel post(s)`);
      }

      return { table: 'intel_posts', count: count || 0 };
    }

    // Actually soft-delete
    const { data, error } = await supabase
      .from('intel_posts')
      .update({ is_active: false })
      .in('user_id', testUserIds)
      .eq('is_active', true)
      .select('id');

    if (error) {
      return { table: 'intel_posts', count: 0, error: error.message };
    }

    const count = data?.length || 0;
    if (verbose && count > 0) {
      console.log(`[Cleanup] Soft-deleted ${count} intel post(s)`);
    }

    return { table: 'intel_posts', count };
  } catch (err) {
    return { table: 'intel_posts', count: 0, error: String(err) };
  }
}

/**
 * Main entry point - clean up all test data
 *
 * @param options - Cleanup options (dryRun, verbose, etc.)
 * @returns Cleanup results with statistics
 */
export async function cleanupAllTestData(
  options: CleanupOptions = {}
): Promise<FullCleanupResult> {
  const { dryRun = false, verbose = false } = options;
  const startTime = Date.now();

  if (verbose) {
    console.log('[Cleanup] ============================================');
    console.log(`[Cleanup] Starting test data cleanup (dryRun=${dryRun})`);
    console.log('[Cleanup] ============================================');
  }

  // Create service client
  let supabase: SupabaseClient;
  try {
    supabase = createServiceClient(options);
  } catch (err) {
    const errorMsg = String(err);
    return {
      sessions: { table: 'sessions', count: 0, error: errorMsg },
      intelPosts: { table: 'intel_posts', count: 0, error: errorMsg },
      totalCleaned: 0,
      durationMs: Date.now() - startTime,
      testUserIds: [],
      dryRun,
    };
  }

  // Get test user IDs
  const testUserIds = await getTestUserIds(supabase, verbose);

  if (testUserIds.length === 0) {
    if (verbose) {
      console.log('[Cleanup] No test users found, nothing to clean up');
    }
    return {
      sessions: { table: 'sessions', count: 0 },
      intelPosts: { table: 'intel_posts', count: 0 },
      totalCleaned: 0,
      durationMs: Date.now() - startTime,
      testUserIds: [],
      dryRun,
    };
  }

  if (verbose) {
    console.log(`[Cleanup] Found ${testUserIds.length} test user(s)`);
  }

  // Clean up sessions and intel posts
  const [sessions, intelPosts] = await Promise.all([
    cleanupTestSessions(supabase, testUserIds, dryRun, verbose),
    cleanupTestIntelPosts(supabase, testUserIds, dryRun, verbose),
  ]);

  const totalCleaned = sessions.count + intelPosts.count;
  const durationMs = Date.now() - startTime;

  if (verbose) {
    console.log('[Cleanup] ============================================');
    console.log(`[Cleanup] Cleanup complete in ${durationMs}ms`);
    console.log(`[Cleanup] Total items ${dryRun ? 'would be ' : ''}cleaned: ${totalCleaned}`);
    console.log('[Cleanup] ============================================');
  }

  return {
    sessions,
    intelPosts,
    totalCleaned,
    durationMs,
    testUserIds,
    dryRun,
  };
}

/**
 * Preview what would be cleaned without actually cleaning
 */
export async function previewCleanup(verbose: boolean = true): Promise<FullCleanupResult> {
  return cleanupAllTestData({ dryRun: true, verbose });
}

/**
 * Execute cleanup (soft-deletes test data)
 */
export async function executeCleanup(verbose: boolean = false): Promise<FullCleanupResult> {
  return cleanupAllTestData({ dryRun: false, verbose });
}

/**
 * Hard-delete beach_reviews rows owned by the given user. Used by happy-path
 * review submit tests to clean up after themselves. Uses the service-role key
 * so RLS doesn't block; requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 *
 * If `titleFilter` is provided, only deletes rows with that exact title —
 * safer for shared test accounts that may hold other seeded reviews.
 */
export async function deleteReviewsForUser(
  userId: string,
  titleFilter?: string
): Promise<void> {
  const supabase = createServiceClient();
  let query = supabase.from('beach_reviews').delete().eq('user_id', userId);
  if (titleFilter) {
    query = query.eq('title', titleFilter);
  }
  const { error } = await query;
  if (error) throw new Error(`cleanup failed: ${error.message}`);
}
