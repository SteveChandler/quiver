# Photo Upload Validation Plan - Main Branch

**Date:** 2025-11-02
**Branch:** main
**Commits:**
- `c3f4193` - Photo upload authentication fix
- `4552f8d` - RLS verification documentation

**Deployment Status:** ✅ READY
**Build:** Successful (no errors)

---

## 🌐 Deployment URLs

**Main Branch:**
- Preview: https://v0-prd-design-concept-git-main-stcha0004-9905s-projects.vercel.app
- Inspector: https://vercel.com/stcha0004-9905s-projects/v0-prd-design-concept/EHd2TzkV8x8AHmZzw4dK2ETUWMaW

---

## ✅ Manual Testing Checklist

### 1. Pre-Test Setup
- [ ] Log in to the application with a valid user account
- [ ] Create a test session or navigate to an existing session you own
- [ ] Prepare a test image (JPEG, PNG, or WebP, under 5MB)

### 2. Photo Upload Test
- [ ] Navigate to session detail page (`/sessions/{id}`)
- [ ] Verify photo gallery UI is visible (even if empty)
- [ ] Click "Add Photos" or similar upload button
- [ ] Select a test image file
- [ ] Verify "X photo(s) selected" message appears
- [ ] Click "Upload" button
- [ ] **CRITICAL:** Verify success toast appears
- [ ] **CRITICAL:** Verify photo appears in the gallery immediately
- [ ] Refresh the page
- [ ] **CRITICAL:** Verify photo persists after refresh

### 3. Expected Success Indicators
✅ Photo appears in gallery
✅ No JavaScript errors in console
✅ Success toast shows accurate count
✅ Photo persists after page refresh
✅ Public URL is accessible

### 4. Database Verification (Production)

**Check storage.objects table:**
```sql
SELECT
  id,
  name,
  bucket_id,
  created_at,
  metadata->>'size' as file_size
FROM storage.objects
WHERE bucket_id = 'session-media'
  AND created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 5;
```

**Check session_media table:**
```sql
SELECT
  id,
  session_id,
  user_id,
  storage_path,
  public_url,
  file_size,
  created_at
FROM session_media
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC
LIMIT 5;
```

**Verify path format:**
```sql
SELECT
  name,
  storage.foldername(name) as folders,
  (storage.foldername(name))[1] as session_id,
  (storage.foldername(name))[2] as user_id
FROM storage.objects
WHERE bucket_id = 'session-media'
  AND created_at > NOW() - INTERVAL '10 minutes'
LIMIT 1;
```

### 5. Security Tests

**Test unauthorized upload (should fail):**
- [ ] Try to upload photo to another user's session
- [ ] Verify error message: "You can only add photos to your own sessions"

**Test RLS enforcement:**
- [ ] Verify you can only delete your own photos
- [ ] Verify you can view public photos from other users

### 6. Error Handling Tests

**Test file validation:**
- [ ] Try uploading a file > 5MB (should fail with clear error)
- [ ] Try uploading unsupported file type (should fail with clear error)
- [ ] Try uploading when you've reached the 5 photos per session limit

**Test network errors:**
- [ ] Simulate offline mode and attempt upload (should show error)
- [ ] Verify error messages are user-friendly

---

## 🐛 What Was Fixed

### Before (Broken)
- ❌ Storage functions used **unauthenticated client-side Supabase client**
- ❌ RLS policies blocked uploads silently
- ❌ Success toast showed but **no files uploaded**
- ❌ No records in storage.objects
- ❌ No records in session_media

### After (Fixed)
- ✅ Storage functions accept **authenticated SupabaseClient parameter**
- ✅ Server actions pass authenticated client from server context
- ✅ RLS policies work correctly with `auth.uid()`
- ✅ Files actually upload to storage.objects
- ✅ Records created in session_media
- ✅ Success toast only shows when upload truly succeeds

---

## 📊 Monitoring Checklist

### Application Logs
- [ ] No errors in Vercel function logs
- [ ] No Sentry errors related to photo upload
- [ ] Upload action completes successfully

### Database Monitoring
```sql
-- Monitor recent uploads
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as upload_count,
  SUM((metadata->>'size')::bigint) as total_bytes
FROM storage.objects
WHERE bucket_id = 'session-media'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Check for orphaned storage objects (no session_media record)
SELECT o.id, o.name, o.created_at
FROM storage.objects o
LEFT JOIN session_media sm ON o.name = sm.storage_path
WHERE o.bucket_id = 'session-media'
  AND sm.id IS NULL
  AND o.created_at > NOW() - INTERVAL '24 hours';
```

---

## 🚨 Rollback Plan

If issues are discovered:

```bash
# Revert to previous commit
git revert c3f4193 4552f8d
git push origin main

# Or rollback in Vercel UI:
# 1. Go to deployment inspector
# 2. Click "Rollback to this deployment" on previous working deployment
```

---

## 📝 Known Issues

None expected. All RLS policies verified and working correctly.

---

## 🎯 Success Criteria

The fix is considered **successful** if:
1. ✅ Photos upload successfully to production
2. ✅ Files appear in storage.objects table
3. ✅ Records created in session_media table
4. ✅ Public URLs are accessible
5. ✅ RLS policies enforce security correctly
6. ✅ No JavaScript errors in console
7. ✅ No backend errors in logs
8. ✅ Photos persist after page refresh

---

## 📚 Related Documentation

- [RLS Verification Report](./reports/RLS_VERIFICATION_PHOTO_UPLOAD.md)
- [Migration: session-media bucket](../supabase/migrations/20251102000001_create_session_media_bucket.sql)
- [Storage Functions](../lib/supabase/storage.ts)
- [Server Actions](../actions/session-media-actions.ts)

---

## 🤝 Support

If you encounter any issues during validation:
1. Check browser console for JavaScript errors
2. Check Vercel function logs for backend errors
3. Verify RLS policies are active in production database
4. Review [RLS_VERIFICATION_PHOTO_UPLOAD.md](./reports/RLS_VERIFICATION_PHOTO_UPLOAD.md)
