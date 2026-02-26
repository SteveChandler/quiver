/**
 * Water Quality E2E Seed Helpers
 *
 * Provides upsert/delete helpers for `beach_water_quality` rows used by
 * water-quality.spec.ts and any other E2E spec that needs deterministic WQ data.
 *
 * Why this file exists
 * --------------------
 * The CEDEN/PacIOOS sync that populates `beach_water_quality` does not run in
 * local dev or CI environments, so tests that assert on rendered badge content
 * need a way to seed the DB directly. This file provides that via the Supabase
 * service-role client (bypasses RLS).
 *
 * Local env quirk: `TEST_BEACHES.blacks.id` is the slug "blacks", not a UUID.
 * `beach_water_quality.beach_id` is a UUID FK, so callers must resolve the slug
 * to a real UUID first via `resolveBeachUuid()`.
 *
 * Usage in specs
 * --------------
 * ```ts
 * import { canSeedWaterQuality, resolveBeachUuid, seedBeachWaterQuality, cleanupBeachWaterQuality } from './utils/seed-water-quality';
 * import { TEST_BEACHES } from './fixtures/test-data';
 *
 * test.beforeAll(async () => {
 *   if (!canSeedWaterQuality()) return;
 *   const uuid = await resolveBeachUuid(TEST_BEACHES.blacks.slug);
 *   if (uuid) await seedBeachWaterQuality(uuid, 'advisory');
 * });
 *
 * test.afterAll(async () => {
 *   const uuid = await resolveBeachUuid(TEST_BEACHES.blacks.slug);
 *   if (uuid) await cleanupBeachWaterQuality(uuid);
 * });
 * ```
 *
 * @see e2e/utils/test-data-cleanup.ts - Sibling utility (same env/client patterns)
 * @see supabase/migrations/20260224070000_create_water_quality_tables.sql - Schema source
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// ---------------------------------------------------------------------------
// Environment variable loading
// Mirror the exact load order used in test-data-cleanup.ts so that any .env.*
// file that works for cleanup also works for seeding.
// ---------------------------------------------------------------------------
dotenv.config({ path: '.env.playwright' });
dotenv.config({ path: '.env.playwright.local' });
dotenv.config({ path: '.env.local' });
dotenv.config();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WaterQualityStatus = 'good' | 'advisory' | 'closure';

// ---------------------------------------------------------------------------
// Service-role client
// ---------------------------------------------------------------------------

/**
 * Returns true when the required environment variables are present.
 * Use this as a guard before calling any seeding function so that tests
 * can skip gracefully in environments without DB access (e.g. CI prod runs).
 */
export function canSeedWaterQuality(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Creates a Supabase client authenticated as the service role, which bypasses
 * all RLS policies. Used for test data manipulation only.
 *
 * Throws if the required environment variables are not set – call
 * `canSeedWaterQuality()` first if you want a softer check.
 */
export function getServiceClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

// ---------------------------------------------------------------------------
// Beach UUID resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a beach slug (e.g. "blacks") to its UUID primary key in the
 * `beaches` table. Returns null if no matching beach is found or if a DB
 * error occurs.
 *
 * This is needed because the local test fixture uses slugs as IDs (see
 * TEST_BEACHES in e2e/fixtures/test-data.ts), but `beach_water_quality.beach_id`
 * is a UUID foreign key.
 */
export async function resolveBeachUuid(slug: string): Promise<string | null> {
  let supabase: SupabaseClient;
  try {
    supabase = getServiceClient();
  } catch {
    console.warn('[seed-water-quality] Cannot create service client – check env vars.');
    return null;
  }

  const { data, error } = await supabase
    .from('beaches')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.warn(`[seed-water-quality] resolveBeachUuid(${slug}) error: ${error.message}`);
    return null;
  }

  return data?.id ?? null;
}

// ---------------------------------------------------------------------------
// Seed helper
// ---------------------------------------------------------------------------

/**
 * Upserts a `beach_water_quality` row for the given beach UUID with realistic
 * indicator values for the requested status.
 *
 * Indicator values are chosen to reflect real-world beach monitoring data:
 *   good     – enterococcus well below the EPA STV of 130 CFU/100mL
 *   advisory – enterococcus above STV (single exceedance)
 *   closure  – enterococcus well above STV (two exceedances in 30 days)
 *
 * The row is upserted on conflict for `beach_id`, so repeated calls are safe
 * and idempotent within a test run.
 *
 * @param beachId - The UUID from `beaches.id` (NOT the slug)
 * @param status  - Desired water quality status
 * @throws If the DB operation fails
 */
export async function seedBeachWaterQuality(
  beachId: string,
  status: WaterQualityStatus
): Promise<void> {
  const supabase = getServiceClient();

  // Today's date in YYYY-MM-DD (local system time is fine for test data)
  const today = new Date().toISOString().split('T')[0];

  // Build the row payload based on the requested status
  const baseRow = {
    beach_id: beachId,
    status,
    previous_status: null as string | null,
    latest_enterococcus: null as number | null,
    latest_fecal_coliform: null as number | null,
    latest_sample_date: today,
    exceedance_count_30d: 0,
    total_samples_30d: 3,
    status_reason: null as string | null,
    status_changed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  switch (status) {
    case 'good':
      baseRow.latest_enterococcus = 25;      // well below EPA STV of 130 CFU/100mL
      baseRow.exceedance_count_30d = 0;
      break;

    case 'advisory':
      baseRow.latest_enterococcus = 180;     // above STV of 130 CFU/100mL
      baseRow.exceedance_count_30d = 1;
      baseRow.status_reason =
        'Latest enterococcus sample (180 CFU/100mL) exceeded the EPA single-sample threshold (STV) of 130 CFU/100mL.';
      break;

    case 'closure':
      baseRow.latest_enterococcus = 500;     // significantly above STV of 130 CFU/100mL
      baseRow.exceedance_count_30d = 2;
      baseRow.status_reason =
        'Multiple enterococcus exceedances in the past 30 days (≥2 samples exceeded the STV of 130 CFU/100mL). Beach is closed to swimming.';
      break;
  }

  const { error } = await supabase
    .from('beach_water_quality')
    .upsert(baseRow, { onConflict: 'beach_id' });

  if (error) {
    throw new Error(
      `[seed-water-quality] seedBeachWaterQuality(${beachId}, ${status}) failed: ${error.message}`
    );
  }
}

// ---------------------------------------------------------------------------
// Cleanup helper
// ---------------------------------------------------------------------------

/**
 * Deletes the `beach_water_quality` row for the given beach UUID.
 *
 * Call this in `afterAll` / `afterEach` to restore the DB to its pre-test
 * state. Safe to call even when the row does not exist (no-op).
 *
 * @param beachId - The UUID from `beaches.id` (NOT the slug)
 */
export async function cleanupBeachWaterQuality(beachId: string): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from('beach_water_quality')
    .delete()
    .eq('beach_id', beachId);

  if (error) {
    // Log rather than throw – cleanup failures should not fail the test suite
    console.warn(
      `[seed-water-quality] cleanupBeachWaterQuality(${beachId}) failed: ${error.message}`
    );
  }
}
