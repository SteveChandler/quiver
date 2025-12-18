/**
 * Supabase Query Builder Utilities
 *
 * Reusable query builders to enforce consistent data access patterns
 * and reduce code duplication across the application.
 *
 * @module lib/supabase/query-builders
 */

import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

/**
 * Options for filtering beach photos
 */
export interface ApprovedPhotosOptions {
  /**
   * Whether to include soft-deleted photos (deleted_at IS NOT NULL)
   * @default false
   */
  includeDeleted?: boolean;

  /**
   * Whether to filter for approved photos only
   * @default true
   */
  approvedOnly?: boolean;
}

/**
 * Applies approved and non-deleted filtering to a beach_photos query.
 *
 * This utility enforces the standard pattern for fetching beach photos:
 * - Only approved photos (unless disabled)
 * - Only non-deleted photos (unless explicitly included)
 *
 * Used across:
 * - Server actions (getBestBeachPhotosAction)
 * - API routes (featured beaches)
 * - Services (beach recommendation service)
 *
 * @example
 * ```typescript
 * // Basic usage - approved, non-deleted photos only
 * const query = withApprovedPhotos(
 *   supabase.from("beach_photos").select("*")
 * );
 *
 * // Include deleted photos for admin views
 * const queryWithDeleted = withApprovedPhotos(
 *   supabase.from("beach_photos").select("*"),
 *   { includeDeleted: true }
 * );
 *
 * // Include unapproved photos for moderation
 * const queryForModeration = withApprovedPhotos(
 *   supabase.from("beach_photos").select("*"),
 *   { approvedOnly: false }
 * );
 * ```
 *
 * @param query - The Supabase query builder instance
 * @param options - Filtering options
 * @returns The query builder with filters applied
 */
export function withApprovedPhotos<T extends PostgrestFilterBuilder<any, any, any, any>>(
  query: T,
  options: ApprovedPhotosOptions = {}
): T {
  const { includeDeleted = false, approvedOnly = true } = options;

  let filtered = query;

  // Apply approved filter
  if (approvedOnly) {
    filtered = filtered.eq("approved", true) as T;
  }

  // Apply soft-delete filter
  if (!includeDeleted) {
    filtered = filtered.is("deleted_at", null) as T;
  }

  return filtered;
}

/**
 * Applies non-deleted filtering to a query that supports soft deletes.
 *
 * Defense-in-depth utility for tables/views that should already exclude
 * deleted records but where we want explicit filtering for data quality.
 *
 * Commonly used with beach_photos_featured view.
 *
 * @example
 * ```typescript
 * const query = withNonDeleted(
 *   supabase.from("beach_photos_featured").select("*")
 * );
 * ```
 *
 * @param query - The Supabase query builder instance
 * @returns The query builder with deleted_at IS NULL filter applied
 */
export function withNonDeleted<
  T extends PostgrestFilterBuilder<any, any, any, any, any, any, any>
>(
  query: T
): T {
  return query.is("deleted_at", null) as T;
}
