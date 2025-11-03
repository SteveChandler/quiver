# Photo Upload Diagnostic Guide

## Problem
Photos uploaded on https://dev.quiversurf.app don't appear on session pages.
- ✅ `session_media` table exists (0 records)
- ✅ `session-media` bucket exists
- ❓ Files may be failing to upload due to missing dependencies

## Quick Diagnostic (Run in Supabase SQL Editor)

Go to: https://supabase.com/dashboard/project/vawdnbbgawichorsjiwe/editor

Run these queries one by one:

### 1. Check if files are in storage
```sql
SELECT COUNT(*) as file_count, bucket_id
FROM storage.objects
WHERE bucket_id = 'session-media'
GROUP BY bucket_id;
```
**Expected**: If > 0, files uploaded successfully but DB insert failed
**If 0**: Upload failed (likely missing storage_usage or function)

### 2. Check if storage_usage table exists
```sql
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'storage_usage'
) as table_exists;
```
**Expected**: `true`
**If false**: 🚨 **CRITICAL - This is why uploads fail!**

### 3. Check if update_user_storage_usage() function exists
```sql
SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'update_user_storage_usage'
) as function_exists;
```
**Expected**: `true`
**If false**: 🚨 **CRITICAL - This is why uploads fail!**

### 4. Check session_media records
```sql
SELECT COUNT(*) as total_photos FROM session_media;
```
**Expected**: Should match file count from query #1

### 5. Check storage bucket policies
```sql
SELECT policyname, cmd as operation
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND (policyname ILIKE '%session%' OR policyname ILIKE '%media%')
ORDER BY policyname;
```
**Expected**: Should see policies for INSERT (upload), SELECT (read), DELETE

### 6. Check test session
```sql
SELECT id, user_id, beach_name, created_at
FROM sessions
WHERE id = 'aea73ffd-5e2a-4b26-b506-fd9d81a1ca81';
```

## Diagnosis Chart

| Query 1 (Files) | Query 2 (Table) | Query 3 (Function) | Diagnosis |
|----------------|-----------------|-------------------|-----------|
| 0 files | false | - | ❌ Missing storage_usage table - uploads fail at quota check |
| 0 files | true | false | ❌ Missing function - uploads fail at storage tracking |
| > 0 files | true | true | ❌ Files uploaded but DB insert failed (RLS policy issue) |
| 0 files | true | true | ❌ Upload blocked by bucket policy |

## Fix Based on Diagnosis

### If storage_usage table or function is missing:
Run this migration:
```bash
npx supabase db push --file scripts/migrations/002_session_media.sql
```

Or manually run: `scripts/migrations/002_session_media.sql` in SQL Editor

### If files are in storage but NOT in session_media:
The upload succeeded but the database insert failed. Check:
1. Session ownership (user must own the session)
2. RLS policies on session_media table

### If no files in storage:
Storage bucket policy is blocking uploads. Check:
1. Bucket exists: `session-media`
2. Upload policy allows authenticated users to upload to `{sessionId}/{userId}/` path

## Upload Flow Reference

1. **Frontend** → Validates & compresses image → Calls server action
2. **Server** → Validates session ownership → Calls `uploadMultiplePhotos()`
3. **Storage** → Checks `storage_usage` table → Calls `update_user_storage_usage()` → Uploads to bucket → Gets public URL
4. **Database** → Inserts record into `session_media` table
5. **Display** → Queries `session_media` table → Shows photos

Any failure in steps 3-4 results in NO photos appearing.

## Production Database Connection (Alternative)

If you prefer command line:
```bash
PGPASSWORD="YOUR_PASSWORD" psql \
  -h db.vawdnbbgawichorsjiwe.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -f diagnostic-photo-upload.sql
```

Get password from: https://supabase.com/dashboard/project/vawdnbbgawichorsjiwe/settings/database
