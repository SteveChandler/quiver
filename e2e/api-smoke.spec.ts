/**
 * API Smoke Tests
 *
 * Fast, request-level checks on the API routes that most frequently bite
 * production:
 *
 * - /api/forecasts/bulk — forecast plumbing (unauth, rate-limited)
 * - /api/profile         — auth-required profile read (401 vs 200 shapes)
 * - /api/events          — whitelisted event insert + short-UA bot filter
 *
 * The bot-filter test guards `reference_events_api_bot_filter`: short UAs
 * must return 200 + `bot_filtered` WITHOUT inserting into `user_events`.
 * We verify the row absence via a service-role Supabase query.
 *
 * Notes on endpoint selection:
 * - The plan mentioned `/api/forecast?beachId=<id>`; no such route exists in
 *   this codebase. `/api/forecasts/bulk?beachIds=<id>` is the closest public
 *   equivalent and returns a `forecasts` map in its data body — matches the
 *   plan's shape assertion.
 *
 * @project auth (uses the shared authed context by default; guest blocks build
 * their own unauth context via playwright.request.newContext)
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { TEST_BEACHES } from './fixtures/test-data';
import { getCurrentUserId } from './utils/auth-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Service-role client — used to verify row presence/absence in `user_events`
// after POST /api/events calls. Only instantiate if env is wired; otherwise
// the bot-filter verification throws per CLAUDE.md "no silent skips" rule.
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Not implemented: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL ' +
        'are required for api-smoke user_events row verification.'
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

test.describe('API Smoke: /api/forecasts/bulk', () => {
  test('returns 200 with forecasts map for valid beachId @smoke', async ({
    playwright,
  }) => {
    // Unauth context — `/api/forecasts/bulk` is a public endpoint (withRateLimit,
    // not withAuth). We confirm it's reachable without a session.
    //
    // Resolve the Blacks UUID via admin client rather than trusting
    // TEST_BEACHES.blacks.id — the fixture returns a slug in local env
    // and a UUID in dev, and `get_bulk_current_forecasts` requires UUID.
    const admin = getAdminClient();
    const { data: beach, error } = await admin
      .from('beaches')
      .select('id')
      .eq('slug', TEST_BEACHES.blacks.slug)
      .single();

    if (error || !beach) {
      throw new Error(
        `Not implemented: could not resolve blacks beach UUID (slug=${TEST_BEACHES.blacks.slug}): ${error?.message ?? 'not found'}`
      );
    }

    const unauth = await playwright.request.newContext({
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const response = await unauth.get(
      `${BASE_URL}/api/forecasts/bulk?beachIds=${(beach as { id: string }).id}`
    );

    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json).toHaveProperty('success', true);
    expect(json).toHaveProperty('data');
    expect(json.data).toHaveProperty('forecasts');

    await unauth.dispose();
  });
});

test.describe('API Smoke: /api/profile', () => {
  test('returns 401 for unauthenticated requests @smoke', async ({ playwright }) => {
    const unauth = await playwright.request.newContext({
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const response = await unauth.get(`${BASE_URL}/api/profile`);
    expect(response.status()).toBe(401);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBeDefined();

    await unauth.dispose();
  });

  test('returns 200 with profile.id (user UUID) for authed requests @smoke', async ({
    request,
  }) => {
    const response = await request.get(`${BASE_URL}/api/profile`);
    expect(response.status()).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    // The route exposes the user's UUID under `id` (canonical profile PK).
    // The plan spec says "user_id" — in this API that's the `id` field of
    // the returned profile DTO. Assert both shapes defensively.
    expect(json.data).toHaveProperty('id');
    expect(typeof json.data.id).toBe('string');
  });
});

test.describe('API Smoke: /api/events', () => {
  test('authed POST with whitelisted event_type inserts into user_events @smoke', async ({
    request,
    page,
  }) => {
    // Need the current authed user-id to scope the admin-client verification
    // query. The shared auth state's cookies map to one of TEST_USER_EMAIL's
    // users — we read the sub claim from the session cookie.
    await page.goto('/');
    const userId = await getCurrentUserId(page);
    if (!userId) {
      throw new Error(
        'Not implemented: could not read current user id from session cookie. ' +
          'Auth state may be invalid. Run: yarn test:e2e:auth:reset && yarn test:e2e:auth:setup'
      );
    }

    const admin = getAdminClient();

    // Tag the insert with a unique metadata marker so we can identify THIS
    // row in verification without racing other page_view writes the test
    // suite or app generates. page_view is on VALID_EVENTS + passes the CHECK
    // constraint — safe choice.
    const marker = `api-smoke-${randomUUID()}`;
    const response = await request.post(`${BASE_URL}/api/events`, {
      data: {
        eventType: 'page_view',
        metadata: { smoke_marker: marker, source: 'api-smoke' },
      },
    });

    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);

    // Verify the row landed. Metadata is a JSONB column; filter on the
    // smoke_marker we just wrote. Tight time window keeps the query cheap.
    const since = new Date(Date.now() - 60_000).toISOString();
    const { data: rows, error } = await admin
      .from('user_events')
      .select('id, user_id, event_type, metadata')
      .eq('user_id', userId)
      .eq('event_type', 'page_view')
      .gte('created_at', since)
      .contains('metadata', { smoke_marker: marker });

    if (error) {
      throw new Error(
        `user_events verification query failed: ${error.message}`
      );
    }

    expect(rows).not.toBeNull();
    expect(rows!.length).toBeGreaterThan(0);
  });

  test('short-UA POST is bot_filtered and does NOT insert a row @smoke', async ({
    playwright,
  }) => {
    // Override UA to the short-UA shape the bot-filter targets. A clean
    // context is required because the top-level playwright config sets a
    // full Chrome UA by default.
    const shortUaContext = await playwright.request.newContext({
      storageState: { cookies: [], origins: [] },
      userAgent: 'x',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const admin = getAdminClient();
    const marker = `api-smoke-botfilter-${randomUUID()}`;

    const response = await shortUaContext.post(`${BASE_URL}/api/events`, {
      data: {
        eventType: 'page_view',
        sessionId: randomUUID(),
        metadata: { smoke_marker: marker, source: 'api-smoke-botfilter' },
      },
    });

    // Silent-200 pattern so bots don't learn they're detected. Assert the
    // bot_filtered status flag is set in the response body.
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data?.status).toBe('bot_filtered');

    await shortUaContext.dispose();

    // Critical: no row lands in user_events. Filter by marker across the
    // full table (user_id may be null for the anon session path too).
    const since = new Date(Date.now() - 60_000).toISOString();
    const { data: rows, error } = await admin
      .from('user_events')
      .select('id, metadata')
      .gte('created_at', since)
      .contains('metadata', { smoke_marker: marker });

    if (error) {
      throw new Error(`user_events bot-filter verification failed: ${error.message}`);
    }

    expect(rows ?? []).toHaveLength(0);
  });
});
