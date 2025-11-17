# Landing Page Deleted Photos - E2E Test Documentation

## Overview

This test suite verifies that soft-deleted beach photos (with `deleted_at` timestamp) do not appear on the landing page, preventing admin-deleted photos from showing in the featured beaches section.

## Bug Context

**Prior to fix:**
- Soft-deleted photos (with `deleted_at` set) still appeared on the landing page
- This occurred because:
  1. API endpoint `/app/api/beaches/featured/route.ts` didn't filter by `deleted_at`
  2. Database view `beach_photos_featured` didn't exclude soft-deleted photos

**Fix Applied:**
1. Updated API endpoint to filter `.is("deleted_at", null)`
2. Updated database view to include `AND deleted_at IS NULL` condition
3. Migration: `20251117032239_exclude_deleted_photos_from_featured.sql`

## Test Files

### Core Test Utilities
**File:** `/e2e/utils/beach-photo-helpers.ts`

Provides helper functions for managing test beach photos:

- `createTestBeachPhoto()` - Create test photos with configurable options
- `softDeleteBeachPhoto()` - Soft-delete photos (set `deleted_at`)
- `deleteBeachPhoto()` - Hard-delete photos (permanent removal)
- `restoreBeachPhoto()` - Restore soft-deleted photos (clear `deleted_at`)
- `getBeachPhoto()` - Retrieve photo details
- `getBeachPhotos()` - Get all photos for a beach
- `deleteAllTestPhotosForBeach()` - Cleanup helper
- `findBeachIdByName()` - Find beach by name
- `getRandomPublicBeachId()` - Get random test beach

### Test Specification
**File:** `/e2e/guest-landing-deleted-photos.spec.ts`

Comprehensive E2E tests covering:

1. **Deleted Photos Exclusion**
   - Verifies soft-deleted photos don't appear on landing page
   - Tests both UI and API endpoint behavior

2. **Active Photos Display**
   - Verifies non-deleted photos still appear normally
   - Ensures fix doesn't break existing functionality

3. **Delete/Restore Workflow**
   - Tests the complete soft-delete → restore cycle
   - Verifies photos can be restored successfully

4. **API Endpoint Validation**
   - Tests `/api/beaches/featured` directly
   - Verifies API excludes deleted photos from results

5. **Edge Cases**
   - Unapproved + deleted photos (double exclusion)
   - Multiple photos per beach (prioritization)
   - Newer vs. older photos when one is deleted

## Test Data Management

### Setup
- Tests use `getRandomPublicBeachId()` to select a random beach
- Each test creates its own isolated test photos
- Photos use unique `source_id` with `test-` prefix for identification

### Cleanup
- **Per-test cleanup:** `afterEach` deletes specific test photos
- **Final cleanup:** `afterAll` removes any remaining test photos
- Test photos are identified by `source_id` pattern: `test-{timestamp}-{random}`

## Running Tests

### Run all deleted photos tests
```bash
yarn test:e2e guest-landing-deleted-photos --project=guest
```

### Run specific test
```bash
yarn test:e2e guest-landing-deleted-photos --project=guest -g "should NOT display soft-deleted"
```

### Run with UI mode (for debugging)
```bash
yarn test:e2e guest-landing-deleted-photos --project=guest --ui
```

### Run with trace (for detailed debugging)
```bash
yarn test:e2e guest-landing-deleted-photos --project=guest --trace on
```

## Test Results

**Latest Run:** ✅ All 6 tests passing (19.8s)

1. ✅ should NOT display soft-deleted beach photos on landing page (7.2s)
2. ✅ should display active (non-deleted) beach photos on landing page (6.6s)
3. ✅ should handle soft-delete and restore workflow correctly (10.9s)
4. ✅ should prioritize non-deleted photos over deleted ones for same beach (7.5s)
5. ✅ should handle unapproved AND deleted photos correctly (7.1s)
6. ✅ should exclude deleted photos from /api/beaches/featured API endpoint (328ms)

## Database Schema

### beach_photos Table
```sql
-- Relevant columns
id uuid PRIMARY KEY
beach_id uuid NOT NULL REFERENCES beaches(id)
image_url text NOT NULL
thumb_url text
approved boolean NOT NULL DEFAULT true
deleted_at timestamptz -- NULL = active, NOT NULL = soft-deleted
fetched_at timestamptz NOT NULL
```

### beach_photos_featured View
```sql
CREATE OR REPLACE VIEW beach_photos_featured AS
SELECT DISTINCT ON (beach_id)
  beach_id,
  image_url,
  thumb_url,
  attribution_html
FROM beach_photos
WHERE approved = true
  AND deleted_at IS NULL  -- Excludes soft-deleted photos
ORDER BY beach_id, fetched_at DESC;
```

## API Endpoint

**Route:** `GET /api/beaches/featured`

**Filtering Logic:**
```typescript
.from("beach_photos")
.select("beach_id, thumb_url, image_url")
.eq("approved", true)
.is("deleted_at", null)  // Excludes soft-deleted photos
```

## Coverage Summary

### ✅ Covered Scenarios
- Soft-deleted photos excluded from landing page UI
- Soft-deleted photos excluded from API endpoint
- Active photos continue to display normally
- Soft-delete and restore workflow
- Multiple photos per beach (prioritization)
- Unapproved + deleted (double filtering)
- API response structure validation

### 🔄 Future Enhancements
- Admin UI workflow test (if admin UI exists)
- Performance testing with large datasets
- Visual regression testing for photo display
- Integration with photo approval workflow

## Regression Protection

These tests serve as regression guards to ensure:

1. **No Deleted Photos on Landing:** Soft-deleted photos never appear
2. **API Consistency:** API endpoint respects `deleted_at` filter
3. **View Integrity:** Database view excludes deleted photos
4. **Restore Functionality:** Photos can be restored successfully

## Related Files

- `/app/api/beaches/featured/route.ts` - Featured beaches API endpoint
- `/supabase/migrations/20251117032239_exclude_deleted_photos_from_featured.sql` - Migration
- `/supabase/migrations/20251024000002_add_soft_delete_columns.sql` - Added `deleted_at` column
- `/e2e/guest-landing.spec.ts` - General landing page tests
- `/e2e/ARCHITECTURE.md` - E2E testing architecture documentation

## Maintenance Notes

### Adding New Tests
1. Use existing helper functions from `beach-photo-helpers.ts`
2. Follow cleanup patterns (`afterEach` and `afterAll`)
3. Use descriptive test names
4. Add comments for complex test logic

### Debugging Test Failures
1. Check test logs for photo IDs and beach IDs
2. Verify database state with manual queries
3. Use Playwright trace viewer for UI issues
4. Check API responses with network tab

### Known Limitations
- Tests use placeholder images (placehold.co)
- Relies on having at least one public beach in database
- Test photos are temporary (cleaned up after tests)
- Parallel execution uses different beaches to avoid conflicts

## Best Practices

1. **Isolation:** Each test creates its own photos
2. **Cleanup:** Always clean up test data
3. **Unique IDs:** Use `test-` prefix for easy identification
4. **Assertions:** Verify both UI and API behavior
5. **Documentation:** Keep this README updated with changes

---

**Last Updated:** 2025-11-17
**Test Coverage:** 6 tests
**Success Rate:** 100%
**Average Execution Time:** ~20 seconds
