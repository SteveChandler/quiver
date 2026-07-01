import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { parse as parseEnv } from 'dotenv';

/**
 * CCC Sync API Tests
 *
 * Tests the /api/cron/ccc-sync and /api/cron/water-quality-sync cron endpoints
 * primarily for their authentication and parameter-validation behaviour.
 *
 * These tests use the Playwright `request` fixture (isolated HTTP context) so
 * they do not require browser navigation or an authenticated user session.
 *
 * Auth model for cron routes:
 *   - `Authorization: Bearer <CRON_SECRET>`
 *
 * We only test the rejection cases here because triggering the import/match
 * phases against the real CCC or WQP APIs would be destructive in a test run.
 * The positive-path (successful sync) is covered by unit tests in
 * __tests__/api/cron/*.test.ts.
 *
 * @project guest
 */

function readEnvValue(filePath: string, key: string): string | undefined {
  if (!existsSync(filePath)) return undefined;

  const parsed = parseEnv(readFileSync(filePath));
  const value = parsed[key];
  return value && value.length > 0 ? value : undefined;
}

const targetBaseUrl = process.env.BASE_URL ?? 'http://localhost:3100';
const isLocalTarget =
  targetBaseUrl.includes('localhost') || targetBaseUrl.includes('127.0.0.1');

// Read the cron secret without mutating process.env; shared Playwright workers
// reuse the same process for later specs.
const cronSecret =
  process.env.CRON_SECRET ??
  (isLocalTarget
    ? readEnvValue('.env.local', 'CRON_SECRET') ??
      readEnvValue('.env.production.local', 'CRON_SECRET')
    : readEnvValue('.env.production.local', 'CRON_SECRET') ??
      readEnvValue('.env.local', 'CRON_SECRET'));
const cronAuthHeaders = cronSecret
  ? { Authorization: `Bearer ${cronSecret}` }
  : undefined;

// ---------------------------------------------------------------------------
// Suite 1: CCC sync endpoint – authentication
// ---------------------------------------------------------------------------

test.describe('CCC Sync API - authentication', () => {
  test('rejects request with no auth header (401)', async ({ request }) => {
    const response = await request.get('/api/cron/ccc-sync?phase=import');
    expect(response.status()).toBe(401);

    const body = await response.json().catch(() => null);
    if (body) {
      // The route returns { error: "Unauthorized", ... } via createErrorResponse
      expect(body).toHaveProperty('error');
    }
  });

  test('rejects request with wrong Bearer token (401)', async ({ request }) => {
    const response = await request.get('/api/cron/ccc-sync?phase=import', {
      headers: {
        Authorization: 'Bearer totally-wrong-secret-value',
      },
    });
    expect(response.status()).toBe(401);
  });

  test('rejects request with malformed Authorization header (401)', async ({ request }) => {
    // Missing "Bearer " prefix
    const response = await request.get('/api/cron/ccc-sync?phase=import', {
      headers: {
        Authorization: 'not-a-bearer-token',
      },
    });
    expect(response.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: CCC sync endpoint – parameter validation
// ---------------------------------------------------------------------------

test.describe('CCC Sync API - parameter validation', () => {
  test.skip(!cronAuthHeaders, 'Requires CRON_SECRET for authenticated cron parameter validation');

  /**
   * Phase validation tests send Bearer CRON_SECRET so they exercise
   * parameter handling after cron auth passes.
   * Missing phase and malformed explicit phase values should skip safely.
   */

  test('returns safe skip for missing phase param when cron auth is present', async ({ request }) => {
    const response = await request.get('/api/cron/ccc-sync', {
      headers: cronAuthHeaders,
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body?.data?.phase).toBe('skipped');
  });

  test('returns safe skip for invalid phase value', async ({ request }) => {
    const response = await request.get('/api/cron/ccc-sync?phase=bogus', {
      headers: cronAuthHeaders,
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body?.data?.phase).toBe('skipped');
    expect(body?.data?.reason).toContain('raw phase="bogus"');
  });

  test('returns safe skip for phase=DELETE (injection attempt)', async ({ request }) => {
    const response = await request.get('/api/cron/ccc-sync?phase=DELETE', {
      headers: cronAuthHeaders,
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body?.data?.phase).toBe('skipped');
    expect(body?.data?.reason).toContain('raw phase="DELETE"');
  });

  test('returns safe skip for blank explicit phase when cron auth is present', async ({ request }) => {
    const response = await request.get('/api/cron/ccc-sync?phase=%20%20', {
      headers: cronAuthHeaders,
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body?.data?.phase).toBe('skipped');
    expect(body?.data?.reason).toContain('raw phase=""');
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Water quality sync endpoint – authentication
// ---------------------------------------------------------------------------

test.describe('Water Quality Sync API - authentication', () => {
  test('rejects request with no auth header (401)', async ({ request }) => {
    const response = await request.get('/api/cron/water-quality-sync?phase=stations');
    expect(response.status()).toBe(401);

    const body = await response.json().catch(() => null);
    if (body) {
      expect(body).toHaveProperty('error');
    }
  });

  test('rejects request with wrong Bearer token (401)', async ({ request }) => {
    const response = await request.get('/api/cron/water-quality-sync?phase=samples', {
      headers: {
        Authorization: 'Bearer wrong-secret',
      },
    });
    expect(response.status()).toBe(401);
  });

  test('rejects request with no auth header regardless of phase param (401)', async ({ request }) => {
    const phases = ['stations', 'samples', 'evaluate'];
    for (const phase of phases) {
      const response = await request.get(`/api/cron/water-quality-sync?phase=${phase}`);
      expect(response.status()).toBe(401);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Water quality sync endpoint – parameter validation
// ---------------------------------------------------------------------------

test.describe('Water Quality Sync API - parameter validation', () => {
  test.skip(!cronAuthHeaders, 'Requires CRON_SECRET for authenticated cron parameter validation');

  test('returns 400 for missing phase param when cron auth is present', async ({ request }) => {
    const response = await request.get('/api/cron/water-quality-sync', {
      headers: cronAuthHeaders,
    });
    expect(response.status()).toBe(400);
  });

  test('returns 400 for invalid phase value', async ({ request }) => {
    const response = await request.get('/api/cron/water-quality-sync?phase=unknown', {
      headers: cronAuthHeaders,
    });
    expect(response.status()).toBe(400);
  });

  test('valid phase values are "stations", "samples", "evaluate" only', async ({ request }) => {
    // This table-driven check verifies that ANY phase outside the whitelist
    // gets rejected with 400 (auth passed) or 401 (auth rejected).
    const invalidPhases = ['import', 'match', 'run', 'sync', 'DELETE', '', ' '];
    for (const phase of invalidPhases) {
      const response = await request.get(
        `/api/cron/water-quality-sync?phase=${encodeURIComponent(phase)}`,
        { headers: cronAuthHeaders }
      );
      expect(response.status()).toBe(400);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Water quality alerts endpoint – authentication
// ---------------------------------------------------------------------------

test.describe('Water Quality Alerts API - authentication', () => {
  test('rejects request with no auth header (401)', async ({ request }) => {
    const response = await request.get('/api/cron/water-quality-alerts');
    expect(response.status()).toBe(401);

    const body = await response.json().catch(() => null);
    if (body) {
      expect(body).toHaveProperty('error');
    }
  });

  test('rejects request with wrong Bearer token (401)', async ({ request }) => {
    const response = await request.get('/api/cron/water-quality-alerts', {
      headers: {
        Authorization: 'Bearer bad-token',
      },
    });
    expect(response.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Suite 6: HTTP method rejection
// ---------------------------------------------------------------------------

test.describe('Cron endpoints - HTTP method enforcement', () => {
  /**
   * All cron routes export only GET handlers. POST/PUT/DELETE must return
   * 405 Method Not Allowed (Next.js default for unimplemented methods).
   */

  test('CCC sync POST returns 405', async ({ request }) => {
    const response = await request.post('/api/cron/ccc-sync?phase=import', {
      data: {},
    });
    expect(response.status()).toBe(405);
  });

  test('water-quality-sync POST returns 405', async ({ request }) => {
    const response = await request.post('/api/cron/water-quality-sync?phase=stations', {
      data: {},
    });
    expect(response.status()).toBe(405);
  });

  test('water-quality-alerts POST returns 405', async ({ request }) => {
    const response = await request.post('/api/cron/water-quality-alerts', {
      data: {},
    });
    expect(response.status()).toBe(405);
  });
});
