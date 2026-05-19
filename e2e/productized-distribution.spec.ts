import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { TEST_BEACHES } from './fixtures/test-data';
import { createServiceClient } from './utils/test-data-cleanup';

type SessionListResponse = {
  success: boolean;
  data?: Array<{
    id: string;
    beachId: string | null;
  }>;
  meta?: {
    limit: number;
    page: number;
    total: number;
  };
};

type BeachSearchResponse = {
  success: boolean;
  data?: Array<{
    id: string;
    name?: string | null;
    slug?: string | null;
  }>;
};

type SessionCheckResponse = {
  sessionData?: {
    userId?: string;
  };
};

const SHARE_FORECAST_AT = '2026-06-01T14:00:00.000Z';
const createdSessionIds: string[] = [];

test.describe('productized distribution E2E', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async () => {
    await cleanupSeededSessions();
  });

  test('shared beach forecast URL resolves with selected-window params', async ({
    page,
  }) => {
    const beach = TEST_BEACHES.blacks;
    const response = await page.goto(
      `/beach/${beach.slug}?initialForecastAt=${encodeURIComponent(
        SHARE_FORECAST_AT,
      )}&initialForecastSource=selected-window&utm_source=quiver_native&utm_medium=share&utm_campaign=forecast_window`,
      { waitUntil: 'domcontentloaded' },
    );

    expect(response?.status()).toBeLessThan(400);
    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname.endsWith(`/${beach.slug}`)).toBe(true);
    expect(finalUrl.searchParams.get('initialForecastAt')).toBe(
      SHARE_FORECAST_AT,
    );
    expect(finalUrl.searchParams.get('initialForecastSource')).toBe(
      'selected-window',
    );
    await expect(page.locator('body')).toContainText(
      new RegExp(beach.name, 'i'),
    );
  });

  test('profile share URL resolves through the native universal-link route', async ({
    page,
    request,
  }) => {
    const userId = await getAuthenticatedUserId(request);
    const response = await page.goto(
      `/profile/${userId}?utm_source=quiver_native&utm_medium=share&utm_campaign=profile`,
      { waitUntil: 'domcontentloaded' },
    );

    expect(response?.status()).toBeLessThan(400);
    expect(new URL(page.url()).pathname).toBe(`/profile/${userId}`);
  });

  test('session share URL resolves for an existing public session', async ({
    page,
    request,
  }) => {
    const userId = await getAuthenticatedUserId(request);
    const beachId = await resolveBeachId(request);
    const sessionId =
      canSeedSessions()
        ? await seedPublicSession(userId, beachId)
        : await getFirstPublicSessionId(request);

    if (!sessionId) test.skip(true, 'Requires service-role env or one public session');

    const response = await page.goto(
      `/sessions/${sessionId}?utm_source=quiver_native&utm_medium=share&utm_campaign=session`,
      { waitUntil: 'domcontentloaded' },
    );

    expect(response?.status()).toBeLessThan(400);
    expect(new URL(page.url()).pathname).toBe(`/sessions/${sessionId}`);
  });

  test('friends spot-loop feed accepts auth plus beach filters', async ({
    request,
  }) => {
    await getAuthenticatedUserId(request);

    const beachId = await resolveBeachId(request);
    const response = await request.get(
      `/api/sessions/public?feed_type=friends&beach_id=${encodeURIComponent(
        beachId,
      )}&limit=10`,
    );

    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toContain('private');
    expect(response.headers()['cache-control']).toContain('no-store');

    const body = (await response.json()) as SessionListResponse;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta?.limit).toBe(10);

    for (const session of body.data ?? []) {
      expect(session.beachId).toBe(beachId);
    }
  });
});

async function getAuthenticatedUserId(
  request: APIRequestContext,
): Promise<string> {
  const response = await request.get('/api/auth/check-session');
  expect(response.status()).toBe(200);

  const body = (await response.json()) as SessionCheckResponse;
  const userId = body.sessionData?.userId;
  if (!userId) {
    throw new Error('Authenticated test user id was not available');
  }

  return userId;
}

async function getFirstPublicSessionId(
  request: APIRequestContext,
): Promise<string | null> {
  const response = await request.get('/api/sessions/public?limit=1');
  expect(response.status()).toBe(200);

  const body = (await response.json()) as SessionListResponse;
  return body.data?.[0]?.id ?? null;
}

function canSeedSessions(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

async function seedPublicSession(
  userId: string,
  beachId: string,
): Promise<string> {
  const supabase = createServiceClient();
  const sessionId = randomUUID();
  const nowIso = new Date().toISOString();

  const { error } = await supabase.from('sessions').insert({
    id: sessionId,
    user_id: userId,
    beach_id: beachId,
    beach_name: TEST_BEACHES.blacks.name,
    arrival_time: nowIso,
    duration_minutes: 60,
    rating: 4,
    wave_quality: 4,
    wave_height_ft: 3,
    crowd_level: 2,
    water_temp: 64,
    notes: 'Productized distribution E2E seed session',
    description: 'Productized distribution E2E seed session',
    is_public: true,
    status: 'completed',
    source: 'maestro_smoke',
    created_at: nowIso,
  });

  if (error) {
    throw new Error(`Could not seed public session: ${error.message}`);
  }

  createdSessionIds.push(sessionId);
  return sessionId;
}

async function cleanupSeededSessions(): Promise<void> {
  if (createdSessionIds.length === 0 || !canSeedSessions()) return;

  const supabase = createServiceClient();
  while (createdSessionIds.length > 0) {
    const sessionId = createdSessionIds.pop();
    if (!sessionId) continue;

    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId)
      .eq('source', 'maestro_smoke');

    if (error) {
      throw new Error(`Could not cleanup seeded session ${sessionId}: ${error.message}`);
    }
  }
}

async function resolveBeachId(request: APIRequestContext): Promise<string> {
  const beach = TEST_BEACHES.blacks;
  const response = await request.get(
    `/api/beaches/search?query=${encodeURIComponent(beach.name)}&limit=5`,
  );
  expect(response.status()).toBe(200);

  const body = (await response.json()) as BeachSearchResponse;
  const match = (body.data ?? []).find(
    (candidate) => candidate.slug === beach.slug || candidate.name === beach.name,
  );
  if (!match?.id) {
    throw new Error(`Could not resolve beach id for ${beach.name}`);
  }

  return match.id;
}
