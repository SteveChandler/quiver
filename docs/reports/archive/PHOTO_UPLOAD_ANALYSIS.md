# Photo Upload Issue - Analysis Summary

## Problem Statement
Photos uploaded to sessions on https://dev.quiversurf.app don't appear on session pages.

## Current State
- ✅ `session_media` table exists in production (created Oct 24, 2024)
- ✅ `session-media` storage bucket exists (created June 15, 2025)
- ✅ Test session exists (ID: `aea73ffd-5e2a-4b26-b506-fd9d81a1ca81`)
- ❌ ZERO photos in `session_media` table (0 records total)
- ❓ Bucket appears empty in dashboard (but RLS might hide files)

## Upload Flow (What Should Happen)

```
User selects photo
  ↓
Frontend: session-photo-upload.tsx
  - Compresses image (line 181 in storage.ts)
  - Creates FormData
  - Calls uploadSessionPhotosAction(sessionId, formData)
  ↓
Server Action: session-media-actions.ts:26-122
  - Validates session ownership (line 35-50)
  - Extracts files from FormData (line 52-61)
  - Calls uploadMultiplePhotos() (line 68-72)
  ↓
Storage Upload: lib/supabase/storage.ts:158-228
  - Validates file (line 164-168)
  - 🔍 Checks storage_usage table (line 171) ← POTENTIAL FAILURE POINT
  - Compresses image (line 181)
  - 🔍 Uploads to session-media bucket (line 196-201) ← POTENTIAL FAILURE POINT
  - Gets public URL (line 207-210)
  - 🔍 Calls update_user_storage_usage() RPC (line 213) ← POTENTIAL FAILURE POINT
  ↓
Database Insert: session-media-actions.ts:81-100
  - Creates session_media record with storage_path, public_url, etc
  - 🔍 Inserts into session_media table (line 93-95) ← POTENTIAL FAILURE POINT
  ↓
Success Response
  - Returns uploaded count
  - Frontend shows success toast
  - Photos should now appear
```

## Most Likely Root Causes (In Order of Probability)

### 1. Missing `storage_usage` table ⚠️ MOST LIKELY
**Impact**: Upload fails at line 171 in storage.ts when checking quota
**Evidence**:
- Required by `getUserStorageUsage()` function (storage.ts:97-131)
- Called before every upload
- If missing, upload never reaches storage bucket
- Zero photos in database supports this

**How to verify**:
```sql
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'storage_usage'
);
```

**Fix**: Run `scripts/migrations/002_session_media.sql`

### 2. Missing `update_user_storage_usage()` function ⚠️ HIGHLY LIKELY
**Impact**: Upload fails at line 213 in storage.ts after storage upload
**Evidence**:
- Required RPC function defined in 002_session_media.sql (line 105-123)
- Called after successful storage upload
- If missing, files might be in storage but DB insert fails
- Zero photos supports this

**How to verify**:
```sql
SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_user_storage_usage'
);
```

**Fix**: Run `scripts/migrations/002_session_media.sql`

### 3. Storage bucket RLS policy blocking uploads
**Impact**: Upload fails at line 196-201 when trying to write to storage
**Evidence**:
- Bucket policies defined in migrations/20251102000001_create_session_media_bucket.sql
- Policy checks path format: {sessionId}/{userId}/{timestamp}.ext
- If policy missing or incorrect, uploads blocked silently

**How to verify**:
```sql
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND policyname ILIKE '%session%media%';
```

**Fix**: Run migration 20251102000001_create_session_media_bucket.sql

### 4. session_media RLS policy blocking inserts
**Impact**: Files upload to storage but DB insert fails
**Evidence**:
- Would result in files in storage.objects but NOT in session_media table
- Less likely since table has proper policies

**How to verify**:
```sql
-- Check if files are in storage but not in DB
SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'session-media';
SELECT COUNT(*) FROM session_media;
```

## Migration Status

Check what migrations have run:
```sql
SELECT version, name, executed_at
FROM supabase_migrations.schema_migrations
WHERE name ILIKE '%session%media%' OR name ILIKE '%storage%'
ORDER BY executed_at DESC;
```

Key migrations needed:
1. ✅ `20251024000006_create_session_media_table.sql` (creates session_media table)
2. ❓ `scripts/migrations/002_session_media.sql` (creates storage_usage & function)
3. ✅ `20251102000001_create_session_media_bucket.sql` (creates bucket & policies)

## Recommended Diagnostic Steps

1. **Open Supabase SQL Editor**: https://supabase.com/dashboard/project/vawdnbbgawichorsjiwe/editor

2. **Run Quick Check** (30 seconds):
```sql
-- Check critical dependencies
SELECT
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'storage_usage') as has_storage_table,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_user_storage_usage') as has_storage_function,
    (SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'session-media') as files_in_storage,
    (SELECT COUNT(*) FROM session_media) as records_in_db;
```

3. **Interpret Results**:
   - `has_storage_table = false`: 🚨 Run 002_session_media.sql migration
   - `has_storage_function = false`: 🚨 Run 002_session_media.sql migration
   - `files_in_storage > 0` but `records_in_db = 0`: DB insert failing (check RLS)
   - All zeros: Upload failing early (likely table/function missing)

## Files Created for You

1. **diagnostic-photo-upload.sql** - Comprehensive SQL diagnostic queries
2. **scripts/diagnose-photo-upload.ts** - TypeScript diagnostic (needs prod creds)
3. **PHOTO_UPLOAD_DIAGNOSTIC.md** - Step-by-step manual diagnostic guide
4. **PHOTO_UPLOAD_ANALYSIS.md** - This analysis document

## Next Steps

1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/vawdnbbgawichorsjiwe/editor)
2. Run the quick check query above
3. Based on results:
   - If table/function missing: Run `scripts/migrations/002_session_media.sql`
   - If policies missing: Re-run bucket migration
   - If files in storage but not DB: Check session ownership and RLS policies

## Expected Timeline

- **Diagnostic**: 2-5 minutes
- **Fix**: 1-2 minutes (run migration)
- **Verification**: 1 minute (upload test photo)

**Total**: ~5-10 minutes to resolve
