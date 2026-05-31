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

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
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
  ephemeralUsers: CleanupResult;
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
  /**
   * Skip the ephemeral-smoke-user sweep. Used when the caller has already run
   * `cleanupEphemeralSmokeUsers` directly (e.g. global-teardown runs the sweep
   * unconditionally and only invokes `cleanupAllTestData` for the dev-gated
   * session/intel-post cleanup).
   */
  skipEphemeralSmokeUsers?: boolean;
}

/**
 * Create a Supabase client with service role for bypassing RLS.
 * Exported so callers (e.g. global-teardown) can run individual cleanup
 * functions without going through the `cleanupAllTestData` aggregator.
 */
export function createServiceClient(options: CleanupOptions = {}): SupabaseClient {
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

  return filterAuthBackedUserIds(supabase, testUserIds, verbose);
}

/**
 * Filter profile ids to rows that still have a matching auth.users record.
 *
 * Some dev mock profiles predate the cleanup sweep and can be orphaned after
 * their auth.users row was removed. Updating sessions for those ids fires the
 * beach-affinity trigger, which inserts into user_beach_affinity and fails its
 * FK to auth.users. Keep cleanup scoped to auth-backed users so one orphan does
 * not abort the whole session cleanup update.
 */
export async function filterAuthBackedUserIds(
  supabase: SupabaseClient,
  userIds: string[],
  verbose: boolean = false
): Promise<string[]> {
  if (userIds.length === 0) return [];

  const authIds = new Set<string>();
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      if (verbose) {
        console.log(
          `[Cleanup] Warning: Could not filter orphaned profiles: ${error.message}`
        );
      }
      return userIds;
    }

    const users = data?.users ?? [];
    for (const user of users) {
      authIds.add(user.id);
    }

    if (users.length < perPage) break;
    page += 1;
  }

  const filteredIds = userIds.filter((id) => authIds.has(id));
  const skipped = userIds.length - filteredIds.length;

  if (verbose && skipped > 0) {
    console.log(
      `[Cleanup] Skipped ${skipped} test profile(s) without auth.users rows`
    );
  }

  return filteredIds;
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
 * Sweep orphan smoke profiles via the cleanup_orphan_smoke_profiles() RPC.
 *
 * Belt-and-suspenders for the inline profile cleanup in
 * `cleanupEphemeralSmokeUsers`: if a prior run's profile delete failed (or
 * skipped — e.g. before this code was deployed), the auth.users row is gone
 * and the orphan can no longer be discovered via listUsers(). Running this
 * before the auth.users sweep on every teardown makes orphan-profile leaks
 * self-healing instead of permanent.
 *
 * Returns 0 silently if the RPC isn't deployed yet (pre-migration), so the
 * sweep stays useful even before the schema change lands.
 */
export async function cleanupOrphanSmokeProfiles(
  supabase: SupabaseClient,
  verbose: boolean
): Promise<CleanupResult> {
  try {
    const { data, error } = await supabase.rpc('cleanup_orphan_smoke_profiles');
    if (error) {
      // Pre-migration the function won't exist; treat as 0 deletions, not an error.
      if (error.message?.includes('does not exist') || error.code === '42883') {
        if (verbose) {
          console.log('[Cleanup] cleanup_orphan_smoke_profiles RPC not deployed yet — skipping orphan sweep');
        }
        return { table: 'orphan_profiles', count: 0 };
      }
      return { table: 'orphan_profiles', count: 0, error: error.message };
    }
    const count = typeof data === 'number' ? data : 0;
    if (verbose && count > 0) {
      console.log(`[Cleanup] Swept ${count} orphan smoke profile(s)`);
    }
    return { table: 'orphan_profiles', count };
  } catch (err) {
    return { table: 'orphan_profiles', count: 0, error: String(err) };
  }
}

/**
 * Predicate: is this auth user an ephemeral smoke-test account?
 *
 * Primary signal: `app_metadata.is_ephemeral_smoke_test === true`. `app_metadata`
 * is server-controlled — it cannot be set via public signup, only by the
 * service-role admin API. This is the load-bearing safety claim for the sweep:
 * a real user can never carry this marker.
 *
 * Legacy fallback: pre-marker users that were only identifiable by the
 * `smoke+...@quiversurf.test` email pattern. Removable once the initial drain
 * lands and a fresh leak window passes — at that point only marker-tagged
 * users will exist in the cohort.
 */
export function isEphemeralSmokeTestUser(user: User): boolean {
  if (user.app_metadata?.is_ephemeral_smoke_test === true) return true;
  // Legacy fallback (TODO: remove after initial drain confirms 0 untagged users).
  const email = user.email?.toLowerCase() ?? '';
  return email.startsWith('smoke+') && email.endsWith('@quiversurf.test');
}

/**
 * Hard-delete ephemeral smoke-test users.
 *
 * Provisioned by `signUpEphemeral()` in e2e/helpers/onboarding-flow.ts for the
 * auth-smoke + onboarding-smoke specs. Per-test `cleanupEphemeralUser` is
 * best-effort — if a run crashes before teardown, rows accumulate in
 * `auth.users`, `profiles`, and `user_events`. This sweep catches those orphans.
 *
 * Pages through `auth.admin.listUsers` until a partial page returns. Matches
 * via `isEphemeralSmokeTestUser` (marker-first, legacy email pattern as
 * fallback).
 *
 * Relies on FK cascade from `auth.users`:
 *   - `profiles.id` → `auth.users(id)` (Supabase-managed FK via the
 *     `handle_new_user` trigger setup)
 *   - `user_events.user_id`, `sessions.user_id`, `saved_windows.user_id`,
 *     `push_notification_log.user_id`, `user_email_prefs.user_id` →
 *     `auth.users(id) ON DELETE CASCADE` (explicit)
 *
 * Orthogonal to `cleanupTestSessions` / `cleanupTestIntelPosts` — those
 * soft-delete mutable content from the main test user; this deletes the
 * throwaway auth records themselves.
 */
export async function cleanupEphemeralSmokeUsers(
  supabase: SupabaseClient,
  dryRun: boolean,
  verbose: boolean
): Promise<CleanupResult> {
  try {
    // Pre-pass: sweep orphan profiles from prior runs whose auth.users row was
    // deleted but profile cleanup failed. Once an auth.users row is gone the
    // orphan is invisible to listUsers(), so without this it leaks forever.
    // Skipped on dryRun (orphans don't surface a count via the RPC alone).
    if (!dryRun) {
      const orphanResult = await cleanupOrphanSmokeProfiles(supabase, verbose);
      if (orphanResult.error && verbose) {
        console.warn(`[Cleanup] Orphan-profile sweep warning: ${orphanResult.error}`);
      }
    }

    const perPage = 1000;
    const ephemeralUsers: User[] = [];
    let page = 1;

    // Paginate until a returned page is shorter than perPage. Keeps a single
    // listUsers round-trip when the cohort is small (<1000) and scales without
    // a silent ceiling when leaks accumulate.
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        return { table: 'ephemeral_users', count: 0, error: error.message };
      }

      const users = data?.users ?? [];
      for (const user of users) {
        if (isEphemeralSmokeTestUser(user)) ephemeralUsers.push(user);
      }

      if (users.length < perPage) break;
      page += 1;
    }

    if (ephemeralUsers.length === 0) {
      if (verbose) {
        console.log('[Cleanup] No ephemeral smoke users found');
      }
      return { table: 'ephemeral_users', count: 0 };
    }

    if (dryRun) {
      if (verbose) {
        console.log(
          `[Cleanup] Would delete ${ephemeralUsers.length} ephemeral smoke user(s)`
        );
        for (const user of ephemeralUsers) {
          console.log(`[Cleanup]   - ${user.email} (${user.id})`);
        }
      }
      return { table: 'ephemeral_users', count: ephemeralUsers.length };
    }

    // Actually delete. Loop sequentially to keep admin-API load predictable
    // and avoid concurrent 429s. Delete the auth.users row first, then clean
    // up the orphan profile — there is no FK cascade from public.profiles to
    // auth.users in this schema, so the row would otherwise dangle. The
    // prevent_delete_on_protected trigger allows orphan profile deletion (see
    // 20260430170000_brake_exception_for_ephemeral_smoke_tests.sql).
    let deleted = 0;
    const errors: string[] = [];
    for (const user of ephemeralUsers) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) {
        errors.push(`${user.email}: ${deleteError.message}`);
        continue;
      }
      const { error: profileError } = await (supabase.from('profiles') as any)
        .delete()
        .eq('id', user.id);
      if (profileError) {
        // Auth user is gone but profile cleanup failed — log and move on.
        // The next sweep won't re-pick this row (no auth.users to match), so
        // surface it as a non-fatal error rather than silently leaking.
        errors.push(`${user.email} (profile orphan): ${profileError.message}`);
      }
      deleted += 1;
    }

    if (verbose) {
      console.log(`[Cleanup] Deleted ${deleted} ephemeral smoke user(s)`);
      if (errors.length > 0) {
        console.log(`[Cleanup] ${errors.length} deletion error(s):`);
        for (const msg of errors) console.log(`[Cleanup]   - ${msg}`);
      }
    }

    return {
      table: 'ephemeral_users',
      count: deleted,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  } catch (err) {
    return { table: 'ephemeral_users', count: 0, error: String(err) };
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
  const { dryRun = false, verbose = false, skipEphemeralSmokeUsers = false } = options;
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
      ephemeralUsers: { table: 'ephemeral_users', count: 0, error: errorMsg },
      totalCleaned: 0,
      durationMs: Date.now() - startTime,
      testUserIds: [],
      dryRun,
    };
  }

  // Get test user IDs (main test user + is_mock profiles). This does NOT
  // include the smoke+<uuid>@quiversurf.test ephemeral cohort — those are
  // swept independently by cleanupEphemeralSmokeUsers, which queries auth.users
  // directly so it catches users whose profile rows were already deleted.
  const testUserIds = await getTestUserIds(supabase, verbose);

  if (verbose) {
    console.log(`[Cleanup] Found ${testUserIds.length} test user(s)`);
  }

  // Clean up sessions, intel posts, and orphaned ephemeral users in parallel.
  // The ephemeral sweep runs regardless of testUserIds (it's an independent
  // query against auth.users), so a missing TEST_USER_EMAIL doesn't skip it.
  // Callers that have already invoked `cleanupEphemeralSmokeUsers` directly
  // (e.g. global-teardown's always-on sweep) pass skipEphemeralSmokeUsers=true
  // to avoid a duplicate paginated walk.
  const ephemeralPromise: Promise<CleanupResult> = skipEphemeralSmokeUsers
    ? Promise.resolve({ table: 'ephemeral_users', count: 0 })
    : cleanupEphemeralSmokeUsers(supabase, dryRun, verbose);

  const [sessions, intelPosts, ephemeralUsers] = await Promise.all([
    cleanupTestSessions(supabase, testUserIds, dryRun, verbose),
    cleanupTestIntelPosts(supabase, testUserIds, dryRun, verbose),
    ephemeralPromise,
  ]);

  const totalCleaned = sessions.count + intelPosts.count + ephemeralUsers.count;
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
    ephemeralUsers,
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
