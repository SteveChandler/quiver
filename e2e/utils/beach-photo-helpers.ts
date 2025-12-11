/**
 * Beach Photo Helper Utilities for E2E Tests
 *
 * Provides utilities for managing test beach photos, including creating,
 * soft-deleting, and cleaning up photos for testing landing page behavior.
 */

import { createClient } from '@supabase/supabase-js';

// Supabase admin client for photo management
let adminClient: ReturnType<typeof createClient> | null = null;

function getAdminClient() {
  if (!adminClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY required for test photo management');
    }

    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

/**
 * Result of photo operation
 */
export interface PhotoOperationResult {
  success: boolean;
  error?: string;
  photoId?: string;
  beachId?: string;
}

/**
 * Test beach photo data
 */
export interface TestBeachPhoto {
  id: string;
  beach_id: string;
  source: string;
  source_id: string;
  image_url: string;
  thumb_url: string | null;
  approved: boolean;
  deleted_at: string | null;
}

/**
 * Create a test beach photo
 *
 * @param beachId - Beach ID to associate the photo with
 * @param options - Optional configuration for the photo
 * @returns Promise<PhotoOperationResult> - Result with created photo ID
 */
export async function createTestBeachPhoto(
  beachId: string,
  options?: {
    approved?: boolean;
    source?: string;
    imageUrl?: string;
    thumbUrl?: string;
  }
): Promise<PhotoOperationResult> {
  const admin = getAdminClient();

  try {
    // Generate unique source_id to avoid conflicts
    const sourceId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const photoData = {
      beach_id: beachId,
      source: options?.source || 'user',
      source_id: sourceId,
      image_url: options?.imageUrl || 'https://placehold.co/800x600/2563eb/white?text=Test+Beach+Photo',
      thumb_url: options?.thumbUrl || 'https://placehold.co/400x300/2563eb/white?text=Test+Thumb',
      approved: options?.approved !== undefined ? options.approved : true,
      title: 'Test Beach Photo',
      creator_name: 'E2E Test Suite',
      attribution_html: '<span>Test Attribution</span>',
      fetched_at: new Date().toISOString(),
    };

    console.log(`[Beach Photo Helper] Creating test photo for beach: ${beachId}`);

    const { data, error } = await admin
      .from('beach_photos')
      .insert(photoData as any)
      .select('id, beach_id')
      .single() as { data: { id: string; beach_id: string } | null; error: any };

    if (error) {
      console.error('[Beach Photo Helper] Failed to create test photo:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`[Beach Photo Helper] Test photo created: ${data?.id}`);

    return {
      success: true,
      photoId: data?.id,
      beachId: data?.beach_id,
    };
  } catch (error) {
    console.error('[Beach Photo Helper] Failed to create test photo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Soft-delete a beach photo by setting deleted_at timestamp
 *
 * @param photoId - Photo ID to soft-delete
 * @returns Promise<PhotoOperationResult> - Result of the operation
 */
export async function softDeleteBeachPhoto(photoId: string): Promise<PhotoOperationResult> {
  const admin = getAdminClient();

  try {
    console.log(`[Beach Photo Helper] Soft-deleting photo: ${photoId}`);

    const { data, error } = await (admin
      .from('beach_photos') as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', photoId)
      .select('id, beach_id')
      .single() as { data: { id: string; beach_id: string } | null; error: any };

    if (error) {
      console.error('[Beach Photo Helper] Failed to soft-delete photo:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`[Beach Photo Helper] Photo soft-deleted: ${data?.id}`);

    return {
      success: true,
      photoId: data?.id,
      beachId: data?.beach_id,
    };
  } catch (error) {
    console.error('[Beach Photo Helper] Failed to soft-delete photo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Hard-delete a beach photo (permanent removal)
 *
 * @param photoId - Photo ID to delete
 * @returns Promise<PhotoOperationResult> - Result of the operation
 */
export async function deleteBeachPhoto(photoId: string): Promise<PhotoOperationResult> {
  const admin = getAdminClient();

  try {
    console.log(`[Beach Photo Helper] Deleting photo: ${photoId}`);

    const { error } = await admin
      .from('beach_photos')
      .delete()
      .eq('id', photoId);

    if (error) {
      console.error('[Beach Photo Helper] Failed to delete photo:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`[Beach Photo Helper] Photo deleted: ${photoId}`);

    return {
      success: true,
      photoId,
    };
  } catch (error) {
    console.error('[Beach Photo Helper] Failed to delete photo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Restore a soft-deleted beach photo by clearing deleted_at
 *
 * @param photoId - Photo ID to restore
 * @returns Promise<PhotoOperationResult> - Result of the operation
 */
export async function restoreBeachPhoto(photoId: string): Promise<PhotoOperationResult> {
  const admin = getAdminClient();

  try {
    console.log(`[Beach Photo Helper] Restoring photo: ${photoId}`);

    const { data, error } = await (admin
      .from('beach_photos') as any)
      .update({ deleted_at: null })
      .eq('id', photoId)
      .select('id, beach_id')
      .single() as { data: { id: string; beach_id: string } | null; error: any };

    if (error) {
      console.error('[Beach Photo Helper] Failed to restore photo:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`[Beach Photo Helper] Photo restored: ${data?.id}`);

    return {
      success: true,
      photoId: data?.id,
      beachId: data?.beach_id,
    };
  } catch (error) {
    console.error('[Beach Photo Helper] Failed to restore photo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get a beach photo by ID
 *
 * @param photoId - Photo ID to retrieve
 * @returns Promise<TestBeachPhoto | null> - Photo data or null if not found
 */
export async function getBeachPhoto(photoId: string): Promise<TestBeachPhoto | null> {
  const admin = getAdminClient();

  try {
    const { data, error } = await admin
      .from('beach_photos')
      .select('id, beach_id, source, source_id, image_url, thumb_url, approved, deleted_at')
      .eq('id', photoId)
      .single();

    if (error || !data) {
      console.error('[Beach Photo Helper] Failed to get photo:', error);
      return null;
    }

    return data as TestBeachPhoto;
  } catch (error) {
    console.error('[Beach Photo Helper] Failed to get photo:', error);
    return null;
  }
}

/**
 * Get all beach photos for a specific beach
 *
 * @param beachId - Beach ID
 * @param options - Filter options
 * @returns Promise<TestBeachPhoto[]> - Array of photos
 */
export async function getBeachPhotos(
  beachId: string,
  options?: {
    includeDeleted?: boolean;
    approvedOnly?: boolean;
  }
): Promise<TestBeachPhoto[]> {
  const admin = getAdminClient();

  try {
    let query = admin
      .from('beach_photos')
      .select('id, beach_id, source, source_id, image_url, thumb_url, approved, deleted_at')
      .eq('beach_id', beachId);

    // Filter by deleted_at unless explicitly including deleted
    if (!options?.includeDeleted) {
      query = query.is('deleted_at', null);
    }

    // Filter by approved status if requested
    if (options?.approvedOnly) {
      query = query.eq('approved', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Beach Photo Helper] Failed to get beach photos:', error);
      return [];
    }

    return (data || []) as TestBeachPhoto[];
  } catch (error) {
    console.error('[Beach Photo Helper] Failed to get beach photos:', error);
    return [];
  }
}

/**
 * Delete all test photos for a beach (cleanup helper)
 *
 * @param beachId - Beach ID
 * @returns Promise<PhotoOperationResult> - Result of the operation
 */
export async function deleteAllTestPhotosForBeach(beachId: string): Promise<PhotoOperationResult> {
  const admin = getAdminClient();

  try {
    console.log(`[Beach Photo Helper] Deleting all test photos for beach: ${beachId}`);

    // Delete photos with 'test-' prefix in source_id (created by tests)
    const { error } = await admin
      .from('beach_photos')
      .delete()
      .eq('beach_id', beachId)
      .like('source_id', 'test-%');

    if (error) {
      console.error('[Beach Photo Helper] Failed to delete test photos:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`[Beach Photo Helper] All test photos deleted for beach: ${beachId}`);

    return {
      success: true,
      beachId,
    };
  } catch (error) {
    console.error('[Beach Photo Helper] Failed to delete test photos:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Find a beach ID by name (helper for tests)
 *
 * @param beachName - Beach name to search for
 * @returns Promise<string | null> - Beach ID or null if not found
 */
export async function findBeachIdByName(beachName: string): Promise<string | null> {
  const admin = getAdminClient();

  try {
    const { data, error } = await admin
      .from('beaches')
      .select('id')
      .eq('name', beachName)
      .single() as { data: { id: string } | null; error: any };

    if (error || !data) {
      console.error('[Beach Photo Helper] Failed to find beach:', error);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error('[Beach Photo Helper] Failed to find beach:', error);
    return null;
  }
}

/**
 * Get a random public beach ID for testing
 *
 * @returns Promise<string | null> - Beach ID or null if none found
 */
export async function getRandomPublicBeachId(): Promise<string | null> {
  const admin = getAdminClient();

  try {
    // Get a public beach with a slug (ensures it can be accessed via URL)
    const { data, error } = await admin
      .from('beaches')
      .select('id')
      .eq('is_private', false)
      .not('slug', 'is', null)
      .limit(10) as { data: { id: string }[] | null; error: any };

    if (error || !data || data.length === 0) {
      console.error('[Beach Photo Helper] Failed to get random beach:', error);
      return null;
    }

    // Return a random beach from the results
    const randomIndex = Math.floor(Math.random() * data.length);
    return data[randomIndex].id;
  } catch (error) {
    console.error('[Beach Photo Helper] Failed to get random beach:', error);
    return null;
  }
}
