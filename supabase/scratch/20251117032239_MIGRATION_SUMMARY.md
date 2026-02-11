# Migration: Exclude Soft-Deleted Photos from Featured View

**Migration File**: `20251117032239_exclude_deleted_photos_from_featured.sql`
**Created**: 2025-11-17
**Status**: Ready to apply

## Summary

Updates the `beach_photos_featured` view to exclude soft-deleted photos by adding `AND deleted_at IS NULL` to the WHERE clause.

## Problem

The `beach_photos_featured` view was created in migration `20251020093001_create_beach_photos.sql` but didn't filter out soft-deleted photos (those with `deleted_at` timestamp). This created inconsistency with API endpoints that properly filter deleted photos.

## Solution

Add `AND deleted_at IS NULL` condition to the view's WHERE clause to ensure only active, approved photos appear in the featured view.

## Migration Details

### Original View Definition
```sql
CREATE OR REPLACE VIEW public.beach_photos_featured AS
SELECT DISTINCT ON (beach_id)
  beach_id,
  image_url,
  thumb_url,
  attribution_html
FROM public.beach_photos
WHERE approved = true
ORDER BY beach_id, fetched_at DESC;
```

### Updated View Definition
```sql
CREATE OR REPLACE VIEW public.beach_photos_featured AS
SELECT DISTINCT ON (beach_id)
  beach_id,
  image_url,
  thumb_url,
  attribution_html
FROM public.beach_photos
WHERE approved = true
  AND deleted_at IS NULL  -- Exclude soft-deleted photos
ORDER BY beach_id, fetched_at DESC;
```

## Dependencies

This migration depends on:
- `20251020093001_create_beach_photos.sql` - Creates the beach_photos table and view
- `20251024000002_add_soft_delete_columns.sql` - Adds the deleted_at column

Migration order is verified:
1. 20251020093001 - Creates table and view
2. 20251024000002 - Adds deleted_at column
3. 20251117032239 - Updates view (this migration)

## Impact Analysis

### Affected Components
- **View**: `public.beach_photos_featured`
- **Consuming Code**: `lib/services/beach-recommendation-service.ts`
  - Uses: `.from("beach_photos_featured").select("beach_id, image_url")`
  - Impact: Will now only receive non-deleted photos (desired behavior)

### Data Impact
- The view will now exclude any approved photos that have been soft-deleted
- Existing queries using the view will automatically benefit from this filter
- No breaking changes to the view's schema or columns

### Performance Impact
- Minimal: The `deleted_at` column already has an index (`idx_beach_photos_deleted_at`)
- The view uses `DISTINCT ON (beach_id)` which is already optimized
- No additional performance overhead expected

## Testing

Run the test queries in `test_beach_photos_featured_view.sql` to:
1. Verify the deleted_at column exists
2. Count approved vs non-deleted approved photos
3. Identify any deleted photos that would be excluded
4. Compare view results before/after migration
5. Verify no deleted photos appear in the updated view

## Rollback Procedure

To rollback this migration, restore the previous view definition:

```sql
CREATE OR REPLACE VIEW public.beach_photos_featured AS
SELECT DISTINCT ON (beach_id)
  beach_id,
  image_url,
  thumb_url,
  attribution_html
FROM public.beach_photos
WHERE approved = true
ORDER BY beach_id, fetched_at DESC;
```

## Deployment Checklist

- [x] Migration file created with proper timestamp
- [x] SQL syntax verified
- [x] Dependencies confirmed
- [x] Impact analysis completed
- [x] Test queries created
- [x] Rollback procedure documented
- [ ] Run test queries in staging
- [ ] Apply migration in staging
- [ ] Verify view behavior in staging
- [ ] Apply migration in production
- [ ] Monitor for issues

## Related Files

- **Migration**: `/Users/stevenchandler/Desktop/quiver/quiver/supabase/migrations/20251117032239_exclude_deleted_photos_from_featured.sql`
- **Test Queries**: `/Users/stevenchandler/Desktop/quiver/quiver/supabase/migrations/test_beach_photos_featured_view.sql`
- **Original View Migration**: `/Users/stevenchandler/Desktop/quiver/quiver/supabase/migrations/20251020093001_create_beach_photos.sql`
- **Soft Delete Migration**: `/Users/stevenchandler/Desktop/quiver/quiver/supabase/migrations/20251024000002_add_soft_delete_columns.sql`
- **Consumer Service**: `/Users/stevenchandler/Desktop/quiver/quiver/lib/services/beach-recommendation-service.ts`

## Notes

- This migration aligns the view behavior with API endpoint filters
- The view is used for featured beach images in listings and search results
- All consuming code will automatically benefit from this fix
- No application code changes required
