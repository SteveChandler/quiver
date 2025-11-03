# Production Database Migration Steps - Social Sharing

This document outlines the steps to apply social sharing database migrations to the production environment.

## Overview

The social sharing feature requires two database migrations:
1. `20251031211212_extend_session_shares_for_variants.sql` - Extends session_shares table for variants and aspect ratios
2. `20251031211518_add_increment_share_count_function.sql` - Adds share count increment function

## Pre-Migration Checklist

### 1. Verify Local Database State ✅

**Status**: Verified on November 1, 2025

```bash
# Check applied migrations
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "SELECT version, name FROM supabase_migrations.schema_migrations WHERE version >= '20251031211212' ORDER BY version;"
```

**Expected Output**:
```
version     |                 name
----------------+---------------------------------------
 20251031211212 | extend_session_shares_for_variants
 20251031211518 | add_increment_share_count_function
```

### 2. Verify Table Schema

```bash
# Check session_shares table
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "\d session_shares"
```

**Expected Columns**:
- `id` (uuid, primary key)
- `session_id` (uuid, foreign key to sessions)
- `user_id` (uuid, foreign key to profiles)
- `platform` (text)
- `share_url` (text, nullable)
- `variant` (text, default 'story')
- `aspect_ratio` (text, nullable) ← **New column**
- `created_at` (timestamp with time zone)
- `share_date` (date)

**Expected Constraints**:
- `check_aspect_ratio`: aspect_ratio IN ('1:1', '4:5', '9:16')
- `check_platform`: platform IN ('instagram', 'x', 'twitter', 'facebook', 'generic', 'download')
- `check_variant`: variant IN ('story', 'square', '1', '2', '3', '4', '5', '6')

**Expected Indexes**:
- `idx_session_shares_analytics` (composite: platform, variant, aspect_ratio, created_at DESC)
- `idx_session_shares_aspect_ratio` (aspect_ratio, partial WHERE aspect_ratio IS NOT NULL)
- `idx_session_shares_variant` (variant, partial WHERE variant IS NOT NULL)

### 3. Verify Function Exists

```bash
# Check increment function
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "\df increment_session_share_count"
```

**Expected Output**:
```
 Schema |             Name              | Result data type | Argument data types | Type
--------+-------------------------------+------------------+---------------------+------
 public | increment_session_share_count | trigger          |                     | func
 public | increment_session_share_count | void             | session_id uuid     | func
```

## Production Migration Steps

### Option 1: Supabase CLI (Recommended)

**Prerequisites**:
- Supabase CLI installed
- Authenticated with production project
- `SUPABASE_DB_PASSWORD` environment variable set

**Steps**:

1. **Get Production Database URL**:
   ```bash
   # From Supabase Dashboard:
   # Settings > Database > Connection String (Direct Connection)
   # Format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
   ```

2. **Set Environment Variable**:
   ```bash
   export SUPABASE_DB_PASSWORD="your-production-password"
   ```

3. **Apply Migrations**:
   ```bash
   npx supabase db push --db-url postgresql://postgres:$SUPABASE_DB_PASSWORD@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

4. **Verify Applied**:
   ```bash
   npx supabase db pull --db-url postgresql://postgres:$SUPABASE_DB_PASSWORD@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

### Option 2: Supabase Dashboard (Manual)

**Steps**:

1. **Open Supabase Dashboard**:
   - Go to https://app.supabase.com/project/[PROJECT-ID]
   - Navigate to SQL Editor

2. **Run Migration 1 - Extend session_shares Table**:
   ```sql
   -- File: 20251031211212_extend_session_shares_for_variants.sql
   -- Copy entire contents of the file and execute
   ```

   **Key Changes**:
   - Adds `aspect_ratio` column (nullable, text)
   - Updates `variant` constraint to include '1'-'6'
   - Updates `platform` constraint to include 'generic' and 'download'
   - Creates new indexes for analytics

3. **Run Migration 2 - Add Share Count Function**:
   ```sql
   -- File: 20251031211518_add_increment_share_count_function.sql
   -- Copy entire contents of the file and execute
   ```

   **Key Changes**:
   - Creates `increment_session_share_count(session_id uuid)` function
   - Function is SECURITY DEFINER (runs with elevated privileges)
   - Atomically increments `sessions.share_count`

4. **Verify Migrations**:
   ```sql
   -- Check migrations table
   SELECT version, name
   FROM supabase_migrations.schema_migrations
   WHERE version >= '20251031211212'
   ORDER BY version;

   -- Check table schema
   \d session_shares

   -- Check function exists
   \df increment_session_share_count
   ```

### Option 3: psql Command Line

**Prerequisites**:
- psql client installed
- Production database credentials

**Steps**:

1. **Connect to Production Database**:
   ```bash
   psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   ```

2. **Run Migration Files**:
   ```sql
   \i supabase/migrations/20251031211212_extend_session_shares_for_variants.sql
   \i supabase/migrations/20251031211518_add_increment_share_count_function.sql
   ```

3. **Verify**:
   ```sql
   SELECT version, name FROM supabase_migrations.schema_migrations WHERE version >= '20251031211212';
   ```

## Post-Migration Verification

### 1. Test Image Generation API

```bash
# Get a test session ID from production
SESSION_ID="[YOUR-TEST-SESSION-ID]"

# Test variant 1, ratio 1:1
curl -H "Authorization: Bearer [YOUR-AUTH-TOKEN]" \
  "https://[YOUR-DOMAIN]/api/sessions/$SESSION_ID/share-image?variant=1&ratio=1:1"

# Test variant 4, ratio 9:16
curl -H "Authorization: Bearer [YOUR-AUTH-TOKEN]" \
  "https://[YOUR-DOMAIN]/api/sessions/$SESSION_ID/share-image?variant=4&ratio=9:16"
```

### 2. Verify Share Tracking

```bash
# After generating a few images, check the database
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  -c "SELECT platform, variant, aspect_ratio, COUNT(*)
      FROM session_shares
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY platform, variant, aspect_ratio;"
```

**Expected Output**:
```
 platform  | variant | aspect_ratio | count
-----------+---------+--------------+-------
 download  | 1       | 1:1          |     1
 download  | 4       | 9:16         |     1
```

### 3. Test Share Count Increment

```bash
# Check sessions table has share_count column
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  -c "SELECT id, share_count FROM sessions WHERE share_count > 0 LIMIT 5;"
```

### 4. Verify Indexes Are Used

```bash
# Test query performance with analytics index
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  -c "EXPLAIN ANALYZE
      SELECT platform, variant, aspect_ratio, COUNT(*)
      FROM session_shares
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY platform, variant, aspect_ratio;"
```

**Expected**: Should use `idx_session_shares_analytics` index

## Rollback Plan

If issues occur after migration, here's the rollback plan:

### Rollback Migration 2 (Share Count Function)

```sql
-- Drop the function
DROP FUNCTION IF EXISTS increment_session_share_count(uuid);

-- Remove from migrations table
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20251031211518';
```

### Rollback Migration 1 (Table Schema Changes)

⚠️ **WARNING**: This rollback will lose data in the `aspect_ratio` column!

```sql
-- Remove new indexes
DROP INDEX IF EXISTS idx_session_shares_analytics;
DROP INDEX IF EXISTS idx_session_shares_aspect_ratio;
DROP INDEX IF EXISTS idx_session_shares_variant;

-- Remove aspect_ratio column
ALTER TABLE session_shares DROP COLUMN IF EXISTS aspect_ratio;

-- Restore original variant constraint
ALTER TABLE session_shares DROP CONSTRAINT IF EXISTS check_variant;
ALTER TABLE session_shares ADD CONSTRAINT check_variant
  CHECK (variant IN ('story', 'square'));

-- Restore original platform constraint
ALTER TABLE session_shares DROP CONSTRAINT IF EXISTS check_platform;
ALTER TABLE session_shares ADD CONSTRAINT check_platform
  CHECK (platform IN ('instagram', 'tiktok', 'twitter', 'facebook', 'copy', 'native', 'other'));

-- Remove from migrations table
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20251031211212';
```

## Migration Timeline

### Before Migration
- [ ] Review migration files
- [ ] Test migrations on local database
- [ ] Test migrations on dev/staging environment
- [ ] Backup production database (Supabase auto-backups should be enabled)
- [ ] Schedule maintenance window (recommended: low-traffic hours)
- [ ] Notify team of migration window

### During Migration (Estimated: 2-5 minutes)
- [ ] Announce start of migration
- [ ] Apply migrations via chosen method
- [ ] Verify migrations applied successfully
- [ ] Test image generation API
- [ ] Verify analytics tracking
- [ ] Check for errors in Sentry

### After Migration
- [ ] Monitor error rates for 30 minutes
- [ ] Test share functionality on production
- [ ] Verify share counts incrementing
- [ ] Check Sentry for any new errors
- [ ] Announce successful completion
- [ ] Update documentation

## Troubleshooting

### Issue: Migration Fails - Constraint Already Exists

**Error**:
```
ERROR: constraint "check_variant" already exists
```

**Solution**:
```sql
-- Drop existing constraint first
ALTER TABLE session_shares DROP CONSTRAINT IF EXISTS check_variant;
-- Then re-run migration
```

### Issue: Function Permission Denied

**Error**:
```
ERROR: permission denied for function increment_session_share_count
```

**Solution**:
```sql
-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION increment_session_share_count(uuid) TO authenticated;
```

### Issue: Index Creation Slow

**Solution**:
- Indexes are created CONCURRENTLY in the migration, so they won't block writes
- However, if the table is large (>1M rows), it may take a few minutes
- Monitor progress with: `SELECT * FROM pg_stat_progress_create_index;`

## Contact Information

**For Production Issues**:
- On-call Engineer: [Contact info]
- DevOps Lead: [Contact info]
- Slack Channel: #production-alerts

**For Migration Questions**:
- Engineering Lead: [Contact info]
- Database Admin: [Contact info]

---

**Status**: ✅ Migrations Tested and Documented
**Last Updated**: November 1, 2025
**Applied to Local**: ✅ Yes
**Applied to Production**: ⏳ Pending
