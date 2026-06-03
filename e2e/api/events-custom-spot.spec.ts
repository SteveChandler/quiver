/**
 * Authenticated custom-spot analytics smoke.
 *
 * Verifies the real /api/events route accepts the custom-spot funnel event and
 * persists it to user_events. The inserted row is deleted by exact id.
 *
 * @project auth
 */

import { randomUUID } from 'crypto';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { createServiceClient } from '../utils/test-data-cleanup';
import type { SupabaseClient } from '@supabase/supabase-js';

const BROWSER_HEADERS = {
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
};

async function getAuthenticatedUserId(request: APIRequestContext): Promise<string> {
  const response = await request.get('/api/auth/check-session');
  const body = (await response.json()) as {
    sessionData?: { userId?: string };
  };

  expect(response.status()).toBe(200);
  expect(body.sessionData?.userId).toBeTruthy();

  return body.sessionData!.userId!;
}

test.describe('Custom-spot analytics event API', () => {
  let serviceClient: SupabaseClient;
  const insertedEventIds: string[] = [];

  test.beforeAll(() => {
    serviceClient = createServiceClient();
  });

  test.afterEach(async () => {
    if (insertedEventIds.length === 0) return;

    const ids = insertedEventIds.splice(0, insertedEventIds.length);
    const { error } = await serviceClient
      .from('user_events')
      .delete()
      .in('id', ids);

    expect(error).toBeNull();
  });

  test('POST /api/events persists session_custom_spot_cta_tapped', async ({
    request,
  }) => {
    const userId = await getAuthenticatedUserId(request);
    const testRunId = `e2e-custom-spot-${randomUUID()}`;
    const customSpotId = randomUUID();

    const response = await request.post('/api/events', {
      headers: BROWSER_HEADERS,
      data: {
        eventType: 'session_custom_spot_cta_tapped',
        metadata: {
          test_run_id: testRunId,
          custom_spot_id: customSpotId,
          source: 'e2e_api_smoke',
          surface: 'session_log_location_step',
        },
      },
    });
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data?.ok).toBe(true);
    expect(body.data?.status).toBeUndefined();

    const { data: rows, error } = await serviceClient
      .from('user_events')
      .select('id, user_id, event_type, metadata, created_at')
      .eq('user_id', userId)
      .eq('event_type', 'session_custom_spot_cta_tapped')
      .contains('metadata', { test_run_id: testRunId });

    expect(error).toBeNull();
    expect(rows?.length).toBe(1);

    const row = rows![0];
    const metadata = row.metadata as Record<string, unknown>;
    insertedEventIds.push(row.id);

    expect(row.user_id).toBe(userId);
    expect(row.event_type).toBe('session_custom_spot_cta_tapped');
    expect(metadata.test_run_id).toBe(testRunId);
    expect(metadata.custom_spot_id).toBe(customSpotId);
    expect(metadata.source).toBe('e2e_api_smoke');
    expect(metadata._device).toBeTruthy();
  });
});
