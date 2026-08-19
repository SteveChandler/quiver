# Session Photo Upload

**Status**: ✅ Production Ready
**Last Updated**: November 2, 2025

---

## 📋 Overview

The session photo upload feature allows users to add photos to their surf sessions with automatic compression, quota management, and secure storage.

### Key Features
- **Automatic Compression** - Reduces file sizes while maintaining quality
- **Fallback Strategy** - Uploads the original only when compression fails and it is at most 5 MiB
- **Authentication** - Server-side authentication with RLS policies
- **Quota Management** - 100MB storage limit per user
- **Security** - Users can only upload to their own sessions
- **Multi-format Support** - JPEG/JPG, PNG, and WebP

### Shared Upload Policy

The source of truth is [`lib/media/session-photo-policy.ts`](../../lib/media/session-photo-policy.ts):

- JPEG/JPG/PNG/WebP are accepted.
- Input files may be up to 10 MiB before compression.
- Compressed output must be at most 5 MiB before storage upload.
- A session may contain at most 5 photos.

The native-facing API preserves the 10 MiB input boundary and does not perform
server-side compression. The web storage helper performs compression and applies
the 5 MiB post-compression limit.

---

## 🏗️ Architecture

### Authentication & Security

**Implementation**: [lib/supabase/storage.ts](../../lib/supabase/storage.ts), [actions/session-media-actions.ts](../../actions/session-media-actions.ts)

#### Server-Side Authentication
All storage functions accept an authenticated `SupabaseClient` parameter:

```typescript
async function uploadSessionPhoto(
  sessionId: string,
  userId: string,
  file: File,
  supabase: SupabaseClient // ✅ Authenticated client from server
): Promise<UploadResult>
```

**Why this matters:**
- ❌ **Before**: Used unauthenticated client-side Supabase client
- ✅ **After**: Server actions pass authenticated client with `auth.uid()` context

#### Row Level Security (RLS)

**Storage Bucket**: `session-media`

```sql
-- INSERT policy: Users can only upload to their own sessions
CREATE POLICY "Users can upload session media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'session-media'
  AND (storage.foldername(name))[2]::uuid = auth.uid()
);

-- SELECT policy: Public access to all photos
CREATE POLICY "Anyone can view session media"
ON storage.objects FOR SELECT
USING (bucket_id = 'session-media');

-- DELETE policy: Users can only delete their own photos
CREATE POLICY "Users can delete own session media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'session-media'
  AND (storage.foldername(name))[2]::uuid = auth.uid()
);
```

**Path Format**: `{sessionId}/{userId}/{timestamp}-{filename}.{ext}`

---

## 💻 Implementation

### 1. Compression with Fallback

**File**: [lib/supabase/storage.ts:44-106](../../lib/supabase/storage.ts#L44-L106)

```typescript
import { SESSION_PHOTO_MAX_STORAGE_BYTES } from "@/lib/media/session-photo-policy";

async function compressImage(file: File): Promise<File> {
  try {
    // Attempt compression with quality 0.8, max 2048x2048
    const compressed = await compress(file, {
      quality: 0.8,
      maxWidth: 2048,
      maxHeight: 2048,
      mimeType: file.type
    });

    console.log("[Image Compression] Success:", {
      originalSize: file.size,
      compressedSize: compressed.size,
      reduction: `${((1 - compressed.size / file.size) * 100).toFixed(1)}%`
    });

    return compressed;
  } catch (error) {
    console.error("[Image Compression] Failed:", {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      error: error.message
    });

    // Fallback: Use original only if it already meets the 5 MiB storage limit
    if (file.size <= SESSION_PHOTO_MAX_STORAGE_BYTES) {
      console.warn("[Image Compression] Using original file");
      return file;
    }

    // File too large even without compression
    throw new Error(
      `Failed to compress image. File is ${(file.size / 1024 / 1024).toFixed(1)}MB. ` +
      `Please choose an image under 5 MiB or try a different image format.`
    );
  }
}
```

**Benefits:**
- ✅ Handles compression failures gracefully
- ✅ Reduces server bandwidth and storage costs
- ✅ Provides detailed logging for debugging
- ✅ Clear, actionable error messages

### 2. Upload Flow

```
1. User selects image(s)
2. Client validates MIME type and the 10 MiB input limit (pre-compression)
3. compressImage() attempts compression
   ├─ Success? → Use compressed file
   └─ Failure? → Check original size
       ├─ At most 5 MiB? → Use original (with warning)
       └─ Over 5 MiB? → Return error with details
   └─ Compressed output over 5 MiB? → Return storage-size error
4. uploadSessionPhoto() checks user quota
   ├─ Under 100MB? → Proceed
   └─ Over 100MB? → Return quota error with usage details
5. Upload to Supabase storage (session-media bucket)
6. Create record in session_media table
7. Return success + public URL
```

### 3. Quota Management

**Storage Limit**: 100MB per user

```typescript
// Check quota before upload
const { can_upload, current_usage_mb, limit_mb, file_count } =
  await getUserStorageUsage(userId, supabase);

if (!can_upload) {
  throw new Error(
    `Storage quota exceeded. You've used ${current_usage_mb.toFixed(2)}MB of ` +
    `your ${limit_mb}MB limit (${file_count} images). ` +
    `Please delete some images to free up space.`
  );
}
```

---

## 🧪 Testing

### Unit Tests

**File**: [__tests__/lib/supabase/storage.test.ts](../../__tests__/lib/supabase/storage.test.ts)

**Coverage**: 9/9 tests passing ✅

```
✓ should compress image successfully and log compression stats
✓ should use original file when compression fails and file is at most 5 MiB
✓ should log detailed error information when compression fails
✓ should return error when compression fails and file is over 5 MiB
✓ should provide helpful error message with file size details
✓ should check getUserStorageUsage and validate can_upload flag
✓ should reject file that's too large even after successful compression
✓ should log all upload steps for successful upload
✓ should log storage upload failures with detailed error
```

### Manual Testing Checklist

#### Basic Upload Test
- [ ] Log in to the application with a valid user account
- [ ] Navigate to a session detail page
- [ ] Click "Add Photos" button
- [ ] Select a test image (JPEG, PNG, or WebP, up to 10 MiB input)
- [ ] Verify "X photo(s) selected" message appears
- [ ] Click "Upload" button
- [ ] **CRITICAL**: Verify success toast appears
- [ ] **CRITICAL**: Verify photo appears in gallery immediately
- [ ] Refresh the page
- [ ] **CRITICAL**: Verify photo persists after refresh

#### Security Tests
- [ ] Try to upload photo to another user's session
- [ ] Verify error: "You can only add photos to your own sessions"
- [ ] Verify you can only delete your own photos
- [ ] Verify you can view public photos from other users

#### Error Handling Tests
- [ ] Try uploading file > 10 MiB → Verify input-size error
- [ ] Try an input between 5 and 10 MiB that compresses under 5 MiB → Verify upload succeeds
- [ ] Try uploading unsupported file type → Verify clear error
- [ ] Try uploading when at 5 photos per session limit → Verify error
- [ ] Try uploading HEIC format → Verify unsupported-file error

#### Compression Fallback Test
- [ ] Open browser console (F12)
- [ ] Upload an image
- [ ] Verify console shows compression logs:
  - **Success**: `[Image Compression] Success: {reduction: "37.5%"}`
  - **Fallback**: `[Image Compression] Using original file - compression failed`

### Database Verification

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

---

## 🐛 Troubleshooting

### Issue: "Failed to compress image"

**Symptoms**: Upload fails with compression error

**Solution**:
- Check browser console for detailed error logs
- If compression fails and the original is at most 5 MiB, fallback should activate automatically
- If compression fails and the original is over 5 MiB, ask user to resize image

**Console Output**:
```
[Image Compression] Failed: {fileName: "photo.heic", error: "Canvas API error"}
[Image Compression] Using original file (2.45MB) - compression failed
```

### Issue: "Storage quota exceeded"

**Symptoms**: Upload fails with quota message

**Solution**:
- Check user's current storage usage:
  ```sql
  SELECT get_user_storage_usage('user-id-here');
  ```
- Ask user to delete old photos
- Verify quota is actually exceeded (100MB limit)

### Issue: Photos don't appear after upload

**Symptoms**: Success toast shows, but no photos in gallery

**Checklist**:
1. Check browser console for JavaScript errors
2. Verify records exist in `session_media` table (SQL above)
3. Verify files exist in `storage.objects` table (SQL above)
4. Check RLS policies are active
5. Verify authenticated client is being used (not client-side)

### Issue: "You can only add photos to your own sessions"

**Symptoms**: Upload fails with authorization error

**Cause**: User trying to upload to another user's session

**Solution**: This is expected behavior - users can only upload to their own sessions

---

## 📊 Monitoring

### Application Logs

Check Vercel function logs for:
- Upload success/failure rates
- Compression fallback usage
- Storage quota warnings

### Database Queries

**Monitor recent uploads:**
```sql
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as upload_count,
  SUM((metadata->>'size')::bigint) as total_bytes
FROM storage.objects
WHERE bucket_id = 'session-media'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

**Check for orphaned storage objects:**
```sql
SELECT o.id, o.name, o.created_at
FROM storage.objects o
LEFT JOIN session_media sm ON o.name = sm.storage_path
WHERE o.bucket_id = 'session-media'
  AND sm.id IS NULL
  AND o.created_at > NOW() - INTERVAL '24 hours';
```

**Find photos using fallback (uncompressed):**
```sql
SELECT
  session_id,
  file_size,
  file_size / (1024 * 1024) as size_mb,
  created_at
FROM session_media
WHERE file_size > 2 * 1024 * 1024  -- Files over 2MB likely uncompressed
ORDER BY file_size DESC
LIMIT 20;
```

---

## 🚀 Deployment

### Pre-Deployment Checklist
- [ ] All unit tests passing
- [ ] Type check passing
- [ ] Build successful
- [ ] RLS policies verified in staging
- [ ] Manual testing complete

### Deployment Steps

1. **Deploy to production:**
   ```bash
   git push origin main
   # Vercel auto-deploys
   ```

2. **Verify deployment:**
   - Check Vercel deployment logs
   - Test upload on production URL
   - Verify RLS policies active

3. **Monitor for issues:**
   - Check error rates in Sentry
   - Monitor Vercel function logs
   - Query database for recent uploads

### Rollback Plan

If issues discovered:

```bash
# Revert commits
git revert <commit-hash>
git push origin main

# Or rollback in Vercel UI:
# 1. Go to deployment inspector
# 2. Click "Rollback to this deployment" on previous version
```

---

## ✅ Success Criteria

The feature is working correctly if:
1. ✅ Photos upload successfully to production
2. ✅ Files appear in storage.objects table
3. ✅ Records created in session_media table
4. ✅ Public URLs are accessible
5. ✅ RLS policies enforce security correctly
6. ✅ No JavaScript errors in browser console
7. ✅ No backend errors in Vercel logs
8. ✅ Photos persist after page refresh
9. ✅ Compression fallback works for problematic formats
10. ✅ Error messages are clear and actionable

---

## 🔮 Future Improvements

1. **Replace compression library** - Consider `browser-image-compression` for better reliability
2. **Client-side resize** - Use Canvas API directly for more control
3. **Progressive upload** - Show progress bar during compression/upload
4. **Format conversion** - Auto-convert HEIC to JPEG on client side
5. **Thumbnail generation** - Generate thumbnails on server for faster loading
6. **Drag & drop** - Add drag-and-drop upload interface
7. **Bulk upload** - Allow uploading multiple photos at once
8. **Image editing** - Basic crop/rotate before upload

---

## 📚 Related Documentation

- [Storage Functions](../../lib/supabase/storage.ts) - Core implementation
- [Server Actions](../../actions/session-media-actions.ts) - Upload actions
- [Unit Tests](../../__tests__/lib/supabase/storage.test.ts) - Test coverage
- [Migration: session-media bucket](../../supabase/migrations/20251102000001_create_session_media_bucket.sql)
- [PRODUCTION_BUCKET_ISSUE.md](../reports/archive/PRODUCTION_BUCKET_ISSUE.md) - Historical bucket issues

---

## 🤝 Support

If you encounter issues:
1. Check browser console for JavaScript errors
2. Check Vercel function logs for backend errors
3. Verify RLS policies are active in production database
4. Review this documentation for troubleshooting steps
5. Check [TROUBLESHOOTING.md](../guides/TROUBLESHOOTING.md) for common issues
