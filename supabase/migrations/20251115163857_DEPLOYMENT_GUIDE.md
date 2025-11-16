# Beach Photos Cleanup - Quick Deployment Guide

**Migration:** 20251115163857_cleanup_orphaned_beach_photos
**Risk Level:** LOW
**Estimated Duration:** < 1 second
**Reversible:** Yes (rollback migration included)

## Pre-Flight Checklist

```bash
# 1. Verify current state
cd /Users/stevenchandler/Desktop/quiver/quiver

# 2. Check how many orphaned records exist
cat supabase/migrations/20251115163857_cleanup_orphaned_beach_photos_verify.sql | \
  psql $DATABASE_URL

# 3. Create database backup (REQUIRED)
pg_dump -Fc $DATABASE_URL > "backup_$(date +%Y%m%d_%H%M%S).dump"
```

## Deployment Commands

### Option A: Using Supabase CLI (Recommended)

```bash
# 1. Review migration
cat supabase/migrations/20251115163857_cleanup_orphaned_beach_photos.sql

# 2. Push to database
supabase db push

# 3. Verify success
supabase db execute --file supabase/migrations/20251115163857_cleanup_orphaned_beach_photos_verify.sql
```

### Option B: Using psql

```bash
# 1. Review migration
cat supabase/migrations/20251115163857_cleanup_orphaned_beach_photos.sql

# 2. Apply migration
psql $DATABASE_URL -f supabase/migrations/20251115163857_cleanup_orphaned_beach_photos.sql

# 3. Verify success
psql $DATABASE_URL -f supabase/migrations/20251115163857_cleanup_orphaned_beach_photos_verify.sql
```

## Expected Output

You should see NOTICE messages like:

```
NOTICE:  Found 503 orphaned beach_photos referencing 74 non-existent beaches
NOTICE:  Deleted 503 orphaned beach_photos records
NOTICE:  Foreign key constraint verified: beach_photos_beach_id_fkey
NOTICE:  Verification Results:
NOTICE:    - Remaining orphaned records: 0
NOTICE:    - Total beach_photos: 2
NOTICE:    - Valid beach_photos: 2
NOTICE:  SUCCESS: All beach_photos now reference valid beaches
NOTICE:  Audit record created: [uuid]
NOTICE:  Orphaned data backed up to data_cleanup_audit table
NOTICE:  =============================================================================
NOTICE:  CLEANUP COMPLETE
NOTICE:  =============================================================================
NOTICE:  Database Statistics:
NOTICE:    - Total beaches: [count]
NOTICE:    - Total beach_photos: 2
NOTICE:    - Beaches with photos: 2
NOTICE:    - Orphaned records removed: See data_cleanup_audit table
NOTICE:  =============================================================================
```

## Post-Deployment Verification

```sql
-- Run these queries to verify success

-- 1. Should return 0
SELECT COUNT(*) AS orphaned_count
FROM public.beach_photos bp
WHERE NOT EXISTS (SELECT 1 FROM public.beaches b WHERE b.id = bp.beach_id);

-- 2. Should return 2
SELECT COUNT(*) AS valid_photos
FROM public.beach_photos;

-- 3. View audit record
SELECT
    records_affected,
    jsonb_array_length(backup_data) AS backed_up_records,
    cleanup_date
FROM public.data_cleanup_audit
WHERE table_name = 'beach_photos';

-- 4. List beaches with photos (should show 2)
SELECT b.name, COUNT(bp.id) AS photo_count
FROM public.beaches b
JOIN public.beach_photos bp ON bp.beach_id = b.id
GROUP BY b.name;
```

## Rollback (If Needed)

If something goes wrong, restore using the rollback migration:

```bash
# Apply rollback
psql $DATABASE_URL -f supabase/migrations/20251115163857_cleanup_orphaned_beach_photos_rollback.sql

# Then follow remediation steps in rollback output
```

## Troubleshooting

### Migration Fails

**Error:** "No audit record found"
- This is normal if rolling back without running the main migration first
- Run main migration first, then rollback if needed

**Error:** "FK constraint is missing"
- This should not happen - constraint exists in schema
- Contact database admin before proceeding

### Migration Succeeds but Application Breaks

**Issue:** Featured photos not showing
- Check if beaches have photos: `SELECT COUNT(*) FROM beach_photos`
- If count is 0, orphaned records were all deleted (expected)
- Import new photos for beaches in the database

**Issue:** Photo upload fails
- Check FK constraint: Should prevent uploads for non-existent beaches
- Verify beach_id before upload
- Add proper error handling in upload code

## Success Criteria

- [ ] Migration completes without EXCEPTION
- [ ] Orphaned count = 0 after migration
- [ ] Valid photos count = 2 after migration
- [ ] Audit record exists with 503 backed up records
- [ ] Application loads without errors
- [ ] Beach pages with photos display correctly

## Next Steps

After successful deployment:

1. **Add Validation to Photo Import**
   - Verify beach exists before inserting photo
   - Handle FK violations gracefully
   - Log failed imports for review

2. **Monitor for Issues**
   - Check error logs for FK violations
   - Monitor featured photos functionality
   - Track photo upload success rate

3. **Future Photo Imports**
   - Always validate beach_id first
   - Use transactions for bulk imports
   - Provide import summary reports

## Files Reference

- **Main Migration:** `20251115163857_cleanup_orphaned_beach_photos.sql`
- **Rollback:** `20251115163857_cleanup_orphaned_beach_photos_rollback.sql`
- **Verification:** `20251115163857_cleanup_orphaned_beach_photos_verify.sql`
- **Full Documentation:** `20251115163857_CLEANUP_SUMMARY.md`
- **This Guide:** `20251115163857_DEPLOYMENT_GUIDE.md`

## Support

For issues or questions:
1. Review full documentation in `20251115163857_CLEANUP_SUMMARY.md`
2. Check audit table: `SELECT * FROM data_cleanup_audit`
3. Review verification queries
4. Contact database admin with migration timestamp: 20251115163857

---

**Ready to Deploy:** YES ✓
**Backup Required:** YES ✓
**Rollback Available:** YES ✓
**Risk Level:** LOW ✓
