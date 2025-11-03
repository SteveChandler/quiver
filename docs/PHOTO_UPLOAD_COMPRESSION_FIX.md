# Photo Upload Compression Fix

**Date**: November 2, 2025
**Status**: ✅ Complete and Tested
**Build**: Passing

---

## Problem

Users experienced upload failures with the error: **"Failed to compress image. Please try a different image."**

The `image-conversion` library would fail on certain images (HEIC format, unusual metadata, certain browsers), causing **all uploads to fail** even if the original file was under the 5MB limit.

---

## Solution Implemented

### 1. Compression Fallback Strategy

**File**: [lib/supabase/storage.ts:44-106](../lib/supabase/storage.ts#L44-L106)

```typescript
// Before: Compression failure = upload failure
async function compressImage(file: File): Promise<File> {
  try {
    return await compress(file, {...});
  } catch (error) {
    throw new Error("Failed to compress image..."); // ❌ Blocks upload
  }
}

// After: Compression failure = fallback to original if size permits
async function compressImage(file: File): Promise<File> {
  try {
    const compressed = await compress(file, {...});
    console.log("[Image Compression] Success:", stats);
    return compressed;
  } catch (error) {
    console.error("[Image Compression] Failed:", details);

    if (file.size <= MAX_FILE_SIZE) {
      console.warn("[Image Compression] Using original file");
      return file; // ✅ Upload original instead of failing
    }

    throw new Error(`Failed to compress image. File is ${size}MB...`);
  }
}
```

### 2. Enhanced Error Logging

Added comprehensive logging at every step:

```typescript
console.log("[Image Compression] Attempting compression:", {
  fileName, fileType, fileSize, fileSizeMB
});

console.error("[Image Compression] Failed:", {
  fileName, fileType, fileSize, error, errorStack
});

console.log("[Upload] Starting upload:", {
  fileName, sessionId, userId
});

console.log("[Upload] Upload successful:", {
  path, publicUrl
});
```

### 3. Improved Error Messages

**Before**:
- "Failed to compress image. Please try a different image."
- "Storage quota exceeded."
- "File size too large even after compression."

**After**:
- "Failed to compress image. File is 8.5MB. Please choose an image under 5MB or try a different image format."
- "Storage quota exceeded. You've used 95.00MB of your 100MB limit (47 images). Please delete some images to free up space."
- "File size is 6.2MB even after compression. Please choose an image under 5MB."

---

## Testing

### Unit Tests Created

**File**: [__tests__/lib/supabase/storage.test.ts](../__tests__/lib/supabase/storage.test.ts)

**Coverage**: 9/9 tests passing ✅

```
✓ should compress image successfully and log compression stats
✓ should use original file when compression fails and file is under 5MB
✓ should log detailed error information when compression fails
✓ should return error when compression fails and file is over 5MB
✓ should provide helpful error message with file size details
✓ should check getUserStorageUsage and validate can_upload flag
✓ should reject file that's too large even after successful compression
✓ should log all upload steps for successful upload
✓ should log storage upload failures with detailed error
```

### Test Scenarios Covered

1. **Compression Success** - Normal JPEG/PNG compression works
2. **Compression Failure + Fallback** - File under 5MB uploads as original
3. **Compression Failure + Too Large** - File over 5MB returns error
4. **Storage Quota** - Quota check works correctly
5. **File Validation** - Type and size validation
6. **Upload Logging** - All steps logged correctly
7. **Error Logging** - Detailed errors captured

### Manual Testing Checklist

- [ ] Navigate to: https://dev.quiversurf.app/sessions/2a0838d1-a108-4ec1-8b94-a35ed5ffb282
- [ ] Open browser console (F12)
- [ ] Try uploading the same image that failed before
- [ ] Verify console shows detailed logs
- [ ] Verify upload succeeds
- [ ] Verify photo appears in gallery immediately
- [ ] Refresh page and verify photo persists

---

## How It Works Now

### Upload Flow with Fallback

```
1. User selects image
2. Client validates file type/size (pre-compression)
3. compressImage() attempts compression
   ├─ Success? → Use compressed file
   └─ Failure? → Check original size
       ├─ Under 5MB? → Use original file (with warning)
       └─ Over 5MB? → Return error with size details
4. uploadSessionPhoto() checks quota
5. Upload to Supabase storage
6. Create database record
7. Return success + public URL
```

### Browser Console Output Example

**Successful compression**:
```
[Image Compression] Attempting compression: {fileName: "surf.jpg", fileSizeMB: "3.24MB"}
[Image Compression] Success: {originalSize: 3398420, compressedSize: 2123891, reduction: "37.5%"}
[Upload] Starting upload: {fileName: "surf.jpg", sessionId: "..."}
[Upload] Uploading to storage: {bucket: "session-media", size: 2123891}
[Upload] Upload successful: {path: "...", publicUrl: "..."}
```

**Compression failure with fallback**:
```
[Image Compression] Attempting compression: {fileName: "photo.heic", fileSizeMB: "2.45MB"}
[Image Compression] Failed: {fileName: "photo.heic", error: "Canvas API error..."}
[Image Compression] Using original file (2.45MB) - compression failed but size is acceptable
[Upload] Starting upload: {fileName: "photo.heic", sessionId: "..."}
[Upload] Upload successful: {path: "...", publicUrl: "..."}
```

---

## Benefits

### Before Fix
- ❌ Certain images always failed (HEIC, unusual metadata)
- ❌ Generic error messages with no diagnostics
- ❌ No fallback mechanism
- ❌ Difficult to troubleshoot

### After Fix
- ✅ Images under 5MB upload even if compression fails
- ✅ Detailed browser console logs for debugging
- ✅ Specific, actionable error messages
- ✅ Easy to diagnose issues
- ✅ Better user experience

---

## Files Modified

1. **[lib/supabase/storage.ts](../lib/supabase/storage.ts)** - Core compression and upload logic
2. **[__tests__/lib/supabase/storage.test.ts](../__tests__/lib/supabase/storage.test.ts)** - New unit tests (created)

---

## Deployment

- **Build Status**: ✅ Passing
- **Type Check**: ✅ No new errors
- **Tests**: ✅ 9/9 passing
- **Breaking Changes**: None

Ready to deploy to production.

---

## Monitoring

After deployment, monitor:

1. **Browser Console** - Check for compression warnings
2. **Upload Success Rate** - Should increase
3. **Error Messages** - Users should see helpful guidance
4. **Storage Usage** - Files using fallback will be larger

### Query to Check Fallback Usage

```sql
-- Find photos uploaded without compression (larger files)
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

## Rollback Plan

If issues arise:

```bash
# Revert the changes
git revert HEAD
git push origin main

# Or restore previous version in Vercel dashboard
```

The fallback logic is conservative - it only activates when:
1. Compression explicitly fails
2. Original file is under 5MB
3. File passes validation

So rollback should not be necessary.

---

## Future Improvements

1. **Replace compression library** - Consider `browser-image-compression` for better reliability
2. **Client-side resize** - Use Canvas API directly for more control
3. **Progressive upload** - Show progress bar during compression/upload
4. **Format conversion** - Auto-convert HEIC to JPEG on client side

---

## Related Documentation

- [PHOTO_UPLOAD_VALIDATION.md](./PHOTO_UPLOAD_VALIDATION.md) - Original auth fix
- [PRODUCTION_BUCKET_ISSUE.md](./PRODUCTION_BUCKET_ISSUE.md) - Bucket issues
- [storage.ts](../lib/supabase/storage.ts) - Implementation
- [Test file](../__tests__/lib/supabase/storage.test.ts) - Unit tests
