/**
 * Landing Page Data Fetching
 *
 * Server-side data fetching utilities for the landing page.
 * Optimized for performance with caching and minimal database queries.
 *
 * Performance optimizations:
 * - Selects only required fields (no SELECT *)
 * - Uses database indexes (is_private filter)
 * - Implements Next.js unstable_cache for ISR
 * - Logs performance metrics
 * - Graceful error handling with fallbacks
 *
 * @module lib/data/landing-page
 */

import { unstable_cache } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { withApprovedPhotos } from '@/lib/supabase/query-builders'
import {
  EXCLUDED_BEACH_IDS,
  PRIORITY_BEACH_IDS,
  FEATURED_BEACHES_LIMIT,
  getPriorityIndex,
} from '@/lib/constants/featured-beaches-config'
import type { Beach, BeachPhotoSelect } from '@/types/database'

/**
 * Type for beach data selected from database
 * Matches the minimal fields needed for landing page display
 */
type BeachSelect = Pick<Beach, 'id' | 'name' | 'city' | 'state' | 'slug'>

/**
 * Enriched beach with photo URL for landing page display
 * Extends minimal beach data with photo information
 */
export interface EnrichedBeach extends BeachSelect {
  photo_url: string | null | undefined
  has_real_photo: boolean
}

/**
 * Fetches beach photos and creates a map of beach ID to photo URL
 *
 * Optimization notes:
 * - Uses withApprovedPhotos to filter only approved photos
 * - Excludes problematic beaches via EXCLUDED_BEACH_IDS
 * - Orders by fetched_at to get most recent photos
 * - Returns Map for O(1) lookups during enrichment
 *
 * @returns Map of beach ID to photo URL (thumb_url or image_url)
 */
async function fetchBeachPhotosMap(): Promise<Map<string, string>> {
  const startTime = performance.now()

  try {
    const supabase = await createSupabaseServerClient()

    const query = withApprovedPhotos(
      supabase
        .from('beach_photos')
        .select('beach_id, thumb_url, image_url')
    )
      .order('beach_id')
      .order('fetched_at', { ascending: false })

    // Only add NOT IN clause if there are beaches to exclude
    const { data: photosData, error: photosError } = EXCLUDED_BEACH_IDS.length > 0
      ? await query.not('beach_id', 'in', `(${EXCLUDED_BEACH_IDS.join(',')})`)
      : await query

    if (photosError) {
      console.error('[Landing Page] Database error fetching beach photos:', photosError)
      return new Map()
    }

    // Create map with one photo per beach (DISTINCT ON beach_id logic)
    const photosMap = new Map<string, string>()
    ;(photosData || []).forEach((photo: BeachPhotoSelect) => {
      if (!photosMap.has(photo.beach_id)) {
        const imageUrl = photo.thumb_url || photo.image_url
        if (imageUrl) {
          photosMap.set(photo.beach_id, imageUrl)
        }
      }
    })

    const duration = performance.now() - startTime
    console.log(`[Landing Page] Fetched ${photosMap.size} beach photos in ${duration.toFixed(2)}ms`)

    return photosMap
  } catch (error) {
    console.error('[Landing Page] Unexpected error fetching beach photos:', error)
    return new Map()
  }
}

/**
 * Fetches beach details for beaches that have photos
 *
 * Optimization notes:
 * - Only selects required fields (id, name, city, state, slug)
 * - Uses IN clause with photo beach IDs for efficient filtering
 * - Filters is_private = false (uses index: idx_beaches_public)
 * - Returns enriched data with photo URLs
 *
 * @param photosMap - Map of beach ID to photo URL from fetchBeachPhotosMap
 * @returns Array of beaches with photo URLs attached
 */
async function fetchBeachesWithPhotos(
  photosMap: Map<string, string>
): Promise<EnrichedBeach[]> {
  const startTime = performance.now()
  const beachIdsWithPhotos = Array.from(photosMap.keys())

  if (beachIdsWithPhotos.length === 0) {
    console.log('[Landing Page] No beaches with photos found')
    return []
  }

  try {
    const supabase = await createSupabaseServerClient()

    const { data: beachesWithPhotos, error: beachesError } = await supabase
      .from('beaches')
      .select('id, name, city, state, slug')
      .eq('is_private', false)
      .in('id', beachIdsWithPhotos)

    if (beachesError) {
      console.error('[Landing Page] Database error fetching beaches:', beachesError)
      return []
    }

    // Enrich beaches with photo URLs from the map
    const enriched = (beachesWithPhotos || []).map((beach: BeachSelect) => ({
      id: beach.id,
      name: beach.name,
      city: beach.city,
      state: beach.state,
      slug: beach.slug,
      photo_url: photosMap.get(beach.id),
      has_real_photo: true,
    }))

    const duration = performance.now() - startTime
    console.log(`[Landing Page] Fetched ${enriched.length} beaches with photos in ${duration.toFixed(2)}ms`)

    return enriched
  } catch (error) {
    console.error('[Landing Page] Unexpected error fetching beaches with photos:', error)
    return []
  }
}

/**
 * Fetches additional beaches without photos to fill remaining slots
 *
 * Optimization notes:
 * - Only selects required fields
 * - Excludes beaches that already have photos (avoids duplicates)
 * - Limits query to exact number needed
 * - Uses is_private index for fast filtering
 *
 * @param needed - Number of additional beaches to fetch
 * @param excludeIds - Beach IDs to exclude (already have photos)
 * @returns Array of beaches without photo URLs
 */
async function fetchBeachesWithoutPhotos(
  needed: number,
  excludeIds: string[]
): Promise<EnrichedBeach[]> {
  if (needed <= 0) {
    return []
  }

  const startTime = performance.now()

  try {
    const supabase = await createSupabaseServerClient()

    let query = supabase
      .from('beaches')
      .select('id, name, city, state, slug')
      .eq('is_private', false)
      .limit(needed)

    // Only add NOT IN clause if there are IDs to exclude
    if (excludeIds.length > 0) {
      query = query.not('id', 'in', `(${excludeIds.join(',')})`)
    }

    const { data: beachesWithoutPhotos, error } = await query

    if (error) {
      console.error('[Landing Page] Database error fetching beaches without photos:', error)
      return []
    }

    if (!beachesWithoutPhotos) {
      return []
    }

    const enriched = beachesWithoutPhotos.map((beach) => ({
      id: beach.id,
      name: beach.name,
      city: beach.city,
      state: beach.state,
      slug: beach.slug,
      photo_url: null,
      has_real_photo: false,
    }))

    const duration = performance.now() - startTime
    console.log(`[Landing Page] Fetched ${enriched.length} beaches without photos in ${duration.toFixed(2)}ms`)

    return enriched
  } catch (error) {
    console.error('[Landing Page] Unexpected error fetching beaches without photos:', error)
    return []
  }
}

/**
 * Applies priority sorting to beaches based on PRIORITY_BEACH_IDS configuration
 *
 * Priority beaches appear first in the order specified in the configuration.
 * Non-priority beaches maintain their original order.
 *
 * Sorts in-place for performance (no array copying).
 *
 * @param beaches - Array of beaches to sort (modified in place)
 */
function applyPrioritySorting(beaches: EnrichedBeach[]): void {
  beaches.sort((a, b) => {
    const aIndex = getPriorityIndex(a.id)
    const bIndex = getPriorityIndex(b.id)

    const aIsPriority = aIndex !== -1
    const bIsPriority = bIndex !== -1

    // Priority beaches come first
    if (aIsPriority && !bIsPriority) return -1
    if (!aIsPriority && bIsPriority) return 1

    // Both priority: sort by priority index
    if (aIsPriority && bIsPriority) {
      return aIndex - bIndex
    }

    // Non-priority: maintain original order
    return 0
  })
}

/**
 * Fetches featured beaches for the landing page
 *
 * Strategy:
 * 1. Fetch beach photos from beach_photos table
 * 2. Fetch beaches that have photos
 * 3. Apply priority sorting (featured beaches first)
 * 4. Fill remaining slots with beaches without photos
 * 5. Return combined list up to FEATURED_BEACHES_LIMIT
 *
 * This ensures:
 * - Visual variety (prioritize beaches with real photos)
 * - No duplicate images (excludes problematic beaches)
 * - Fast performance (optimized queries with indexes)
 * - Graceful degradation (returns empty array on error)
 *
 * Performance characteristics:
 * - Expected query time: <100ms total (3 queries in sequence)
 * - Query 1: Fetch photos (~30-50ms)
 * - Query 2: Fetch beaches with photos (~20-30ms)
 * - Query 3: Fetch beaches without photos (~20-30ms)
 *
 * @returns Array of featured beaches with photo URLs
 */
export async function fetchFeaturedBeaches(): Promise<EnrichedBeach[]> {
  const startTime = performance.now()

  try {
    // Step 1: Fetch beach photos and create ID-to-URL map
    const photosMap = await fetchBeachPhotosMap()

    // Step 2: Fetch beaches with photos and enrich with photo URLs
    const enrichedWithPhotos = await fetchBeachesWithPhotos(photosMap)

    // Step 3: Apply priority sorting to beaches with photos
    applyPrioritySorting(enrichedWithPhotos)

    // Step 4: Fill remaining slots with beaches without photos
    const needed = Math.max(0, FEATURED_BEACHES_LIMIT - enrichedWithPhotos.length)
    const beachIdsWithPhotos = Array.from(photosMap.keys())
    const enrichedWithoutPhotos = await fetchBeachesWithoutPhotos(
      needed,
      beachIdsWithPhotos
    )

    // Step 5: Combine results
    const allBeaches = [...enrichedWithPhotos, ...enrichedWithoutPhotos]

    const duration = performance.now() - startTime
    console.log(
      `[Landing Page] ✓ Fetched ${allBeaches.length} featured beaches in ${duration.toFixed(2)}ms ` +
      `(${enrichedWithPhotos.length} with photos, ${enrichedWithoutPhotos.length} without)`
    )

    return allBeaches
  } catch (error) {
    console.error('[Landing Page] Fatal error fetching featured beaches:', error)
    // Return empty array for graceful degradation
    return []
  }
}

/**
 * Cached version of fetchFeaturedBeaches using Next.js unstable_cache
 *
 * Cache strategy:
 * - Revalidate every 1 hour (3600 seconds)
 * - Tagged with 'beaches' and 'featured' for targeted invalidation
 * - Shared across all landing page requests
 *
 * Cache invalidation:
 * - Automatic: Every hour via revalidate
 * - Manual: revalidateTag('beaches') or revalidateTag('featured')
 * - On-demand: When beaches or photos are updated
 *
 * Benefits:
 * - Reduces database load (1 query per hour instead of per request)
 * - Faster response times (cached data served instantly)
 * - Consistent UX (all users see same data for cache duration)
 *
 * Usage:
 * ```typescript
 * const beaches = await fetchFeaturedBeachesCached()
 * ```
 */
export const fetchFeaturedBeachesCached = unstable_cache(
  async () => fetchFeaturedBeaches(),
  ['landing-page-featured-beaches'],
  {
    revalidate: 3600, // Cache for 1 hour
    tags: ['beaches', 'featured'],
  }
)
