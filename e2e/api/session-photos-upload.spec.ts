/**
 * Authenticated session photo upload smoke.
 *
 * Creates an isolated test-owned session, uploads a tiny JPEG via the real
 * multipart API, verifies the session_media handoff for moderation surfaces,
 * then removes inserted media/storage and soft-deletes the session.
 *
 * @project auth
 */

import { randomUUID } from 'crypto';
import { expect, test } from '../fixtures/auth-fixture';
import type { APIRequestContext } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '../utils/test-data-cleanup';

const STORAGE_BUCKET = 'session-media';
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/ISf/2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z',
  'base64'
);

type UploadedPhoto = {
  id: string;
  public_url: string;
  storage_path: string;
  file_size: number;
  media_type: string;
};

type BeachSeedRow = {
  id: string;
  name: string | null;
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

async function resolveTestBeach(serviceClient: SupabaseClient): Promise<BeachSeedRow> {
  const { data: slugMatch, error: slugError } = await serviceClient
    .from('beaches')
    .select('id, name')
    .eq('slug', 'blacks')
    .maybeSingle();

  expect(slugError).toBeNull();
  if (slugMatch) return slugMatch;

  const { data: nameMatches, error: nameError } = await serviceClient
    .from('beaches')
    .select('id, name')
    .ilike('name', '%black%')
    .limit(1);

  expect(nameError).toBeNull();
  expect(nameMatches?.length ?? 0).toBeGreaterThan(0);

  return nameMatches![0];
}

function expectRow<T>(row: T | null, message: string): T {
  expect(row, message).not.toBeNull();
  if (!row) throw new Error(message);

  return row;
}

test.describe('Session photo upload API', () => {
  let serviceClient: SupabaseClient;
  let sessionId: string | null = null;

  test.beforeAll(() => {
    serviceClient = createServiceClient();
  });

  test.afterEach(async () => {
    if (!sessionId) return;

    const { data: mediaRows, error: mediaSelectError } = await serviceClient
      .from('session_media')
      .select('id, storage_path')
      .eq('session_id', sessionId);

    expect(mediaSelectError).toBeNull();

    const storagePaths = (mediaRows ?? [])
      .map((row) => row.storage_path)
      .filter((path): path is string => Boolean(path));

    if (storagePaths.length > 0) {
      const { error: storageError } = await serviceClient.storage
        .from(STORAGE_BUCKET)
        .remove(storagePaths);

      expect(storageError).toBeNull();
    }

    if ((mediaRows?.length ?? 0) > 0) {
      const { error: mediaDeleteError } = await serviceClient
        .from('session_media')
        .delete()
        .eq('session_id', sessionId);

      expect(mediaDeleteError).toBeNull();
    }

    const { error: sessionCleanupError } = await serviceClient
      .from('sessions')
      .update({
        deleted_at: new Date().toISOString(),
        image_url: null,
      })
      .eq('id', sessionId);

    expect(sessionCleanupError).toBeNull();
    sessionId = null;
  });

  test('POST /api/sessions/:id/photos uploads photo and creates moderation candidate row', async ({
    request,
  }) => {
    const userId = await getAuthenticatedUserId(request);
    const beach = await resolveTestBeach(serviceClient);
    sessionId = randomUUID();

    const { error: sessionInsertError } = await serviceClient.from('sessions').insert({
      id: sessionId,
      user_id: userId,
      beach_id: beach.id,
      beach_name: beach.name ?? 'Blacks',
      arrival_time: new Date().toISOString(),
      duration_minutes: 60,
      goals: [],
      invitee_ids: [],
      is_public: false,
      notes: `E2E session photo upload smoke ${sessionId}`,
      rating: 4,
      source: 'manual',
      status: 'completed',
    });

    expect(sessionInsertError).toBeNull();

    const uploadResponse = await request.post(`/api/sessions/${sessionId}/photos`, {
      multipart: {
        photos: {
          name: 'e2e-session-photo.jpg',
          mimeType: 'image/jpeg',
          buffer: TINY_JPEG,
        },
      },
    });
    const uploadJson = await uploadResponse.json();
    const uploadedPhoto = uploadJson.data?.photos?.[0] as UploadedPhoto | undefined;

    expect(uploadResponse.status()).toBe(200);
    expect(uploadJson.success).toBe(true);
    expect(uploadJson.data?.uploaded_count).toBe(1);
    expect(uploadJson.data?.hero_attached).toBe(true);
    expect(uploadedPhoto?.id).toBeTruthy();
    expect(uploadedPhoto?.public_url).toContain(STORAGE_BUCKET);
    expect(uploadedPhoto?.storage_path).toContain(sessionId);
    expect(uploadedPhoto?.file_size).toBe(TINY_JPEG.length);
    expect(uploadedPhoto?.media_type).toBe('photo');

    const { data: mediaRow, error: mediaError } = await serviceClient
      .from('session_media')
      .select('id, session_id, user_id, storage_path, public_url, media_type, metadata, deleted_at')
      .eq('id', uploadedPhoto!.id)
      .single();

    expect(mediaError).toBeNull();
    const uploadedMediaRow = expectRow(mediaRow, 'Expected uploaded session_media row');

    expect(uploadedMediaRow.session_id).toBe(sessionId);
    expect(uploadedMediaRow.user_id).toBe(userId);
    expect(uploadedMediaRow.deleted_at).toBeNull();
    expect(uploadedMediaRow.storage_path).toBe(uploadedPhoto!.storage_path);
    expect(uploadedMediaRow.public_url).toBe(uploadedPhoto!.public_url);
    expect(uploadedMediaRow.media_type).toBe('photo');
    expect((uploadedMediaRow.metadata as Record<string, unknown>).upload_source).toBe(
      'api_session_photos'
    );
    expect(
      typeof (uploadedMediaRow.metadata as Record<string, unknown>).upload_timestamp
    ).toBe('number');

    const { data: sessionRow, error: sessionError } = await serviceClient
      .from('sessions')
      .select('id, image_url, deleted_at')
      .eq('id', sessionId)
      .single();

    expect(sessionError).toBeNull();
    const uploadedSessionRow = expectRow(sessionRow, 'Expected uploaded session row');

    expect(uploadedSessionRow.deleted_at).toBeNull();
    expect(uploadedSessionRow.image_url).toBe(uploadedPhoto!.public_url);
  });
});
