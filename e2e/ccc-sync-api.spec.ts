import { test, expect } from '@playwright/test';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

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
 *   - `x-vercel-cron: 1` header (set by Vercel Cron infrastructure)
 *   - OR `Authorization: Bearer <CRON_SECRET>` (for manual invocations)
 *
 * We only test the rejection cases here because triggering the import/match
 * phases against the real CCC or WQP APIs would be destructive in a test run.
 * The positive-path (successful sync) is covered by unit tests in
 * __tests__/api/cron/*.test.ts.
 *
 * @project guest
 */

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
  /**
   * Phase validation tests send the x-vercel-cron header which the route
   * accepts unconditionally when VERCEL_ENV is set. In CI / local environments
   * this header may or may not be accepted depending on the VERCEL_ENV env var.
   *
   * We therefore test both outcomes:
   *   - If x-vercel-cron is accepted: we expect 400 for invalid phase
   *   - If it is rejected: we expect 401 (auth fails before param validation)
   *
   * This avoids brittle env-specific failures.
   */

  test('returns 400 or 401 for missing phase param when cron header is present', async ({ request }) => {
    const response = await request.get('/api/cron/ccc-sync', {
      headers: { 'x-vercel-cron': '1' },
    });
    // 400 = auth passed, phase missing; 401 = cron header not trusted in this env
    expect([400, 401]).toContain(response.status());
  });

  test('returns 400 or 401 for invalid phase value', async ({ request }) => {
    const response = await request.get('/api/cron/ccc-sync?phase=bogus', {
      headers: { 'x-vercel-cron': '1' },
    });
    expect([400, 401]).toContain(response.status());
  });

  test('returns 400 or 401 for phase=DELETE (injection attempt)', async ({ request }) => {
    const response = await request.get('/api/cron/ccc-sync?phase=DELETE', {
      headers: { 'x-vercel-cron': '1' },
    });
    expect([400, 401]).toContain(response.status());
  });

  test('when cron header accepted, 400 body contains descriptive error for invalid phase', async ({ request }) => {
    const response = await request.get('/api/cron/ccc-sync?phase=invalid', {
      headers: { 'x-vercel-cron': '1' },
    });

    if (response.status() === 400) {
      const body = await response.json().catch(() => null);
      expect(body).toBeTruthy();
      // createErrorResponse wraps the message in a standard shape
      expect(body).toHaveProperty('error');
    }
    // 401 is also acceptable – means env does not trust x-vercel-cron
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
  test('returns 400 or 401 for missing phase param when cron header is present', async ({ request }) => {
    const response = await request.get('/api/cron/water-quality-sync', {
      headers: { 'x-vercel-cron': '1' },
    });
    expect([400, 401]).toContain(response.status());
  });

  test('returns 400 or 401 for invalid phase value', async ({ request }) => {
    const response = await request.get('/api/cron/water-quality-sync?phase=unknown', {
      headers: { 'x-vercel-cron': '1' },
    });
    expect([400, 401]).toContain(response.status());
  });

  test('valid phase values are "stations", "samples", "evaluate" only', async ({ request }) => {
    // This table-driven check verifies that ANY phase outside the whitelist
    // gets rejected with 400 (auth passed) or 401 (auth rejected).
    const invalidPhases = ['import', 'match', 'run', 'sync', 'DELETE', '', ' '];
    for (const phase of invalidPhases) {
      const response = await request.get(
        `/api/cron/water-quality-sync?phase=${encodeURIComponent(phase)}`,
        { headers: { 'x-vercel-cron': '1' } }
      );
      expect([400, 401]).toContain(response.status());
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
