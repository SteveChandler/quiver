import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SESSION_PHOTO_MAX_PER_SESSION,
  SESSION_PHOTO_MAX_STORAGE_BYTES,
  validateSessionPhotoInput,
} from "@/lib/media/session-photo-policy";

const STORAGE_BUCKET = "session-media";

interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
  fileSize?: number;
}

export interface SessionPhoto {
  id: string;
  session_id: string;
  user_id: string;
  public_url: string;
  storage_path: string;
  caption?: string;
  file_size: number;
  metadata?: {
    width?: number;
    height?: number;
    compression_ratio?: number;
  };
  created_at: string;
}

export interface StorageUsageInfo {
  total_bytes: number;
  image_count: number;
  remaining_bytes: number;
  can_upload: boolean;
}

/**
 * Validate file before upload
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  const validationError = validateSessionPhotoInput(file);
  if (validationError === "invalid_file_type") {
    return {
      valid: false,
      error: "Only JPEG, PNG, and WebP images are allowed.",
    };
  }

  if (validationError === "file_too_large") {
    return {
      valid: false,
      error: "File is too large. Please choose an image smaller than 10MB.",
    };
  }

  return { valid: true };
}

/**
 * Get user's current storage usage
 */
export async function getUserStorageUsage(
  userId: string,
  supabase: SupabaseClient
): Promise<StorageUsageInfo> {
  try {
    const { data, error } = await supabase
      .from("storage_usage")
      .select("total_bytes, image_count")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      // Not found error is ok
      throw error;
    }

    const totalBytes = data?.total_bytes || 0;
    const imageCount = data?.image_count || 0;
    const remainingBytes = Math.max(0, 100 * 1024 * 1024 - totalBytes); // 100MB per user limit

    return {
      total_bytes: totalBytes,
      image_count: imageCount,
      remaining_bytes: remainingBytes,
      can_upload: remainingBytes > 1024 * 1024, // At least 1MB remaining
    };
  } catch (error) {
    console.error("Failed to get storage usage:", error);
    return {
      total_bytes: 0,
      image_count: 0,
      remaining_bytes: 100 * 1024 * 1024,
      can_upload: true,
    };
  }
}

/**
 * Update user's storage usage tracking
 */
async function updateStorageUsage(
  userId: string,
  bytesToAdd: number,
  supabase: SupabaseClient
): Promise<void> {
  try {
    const { error } = await supabase.rpc("update_user_storage_usage", {
      p_user_id: userId,
      p_bytes_to_add: bytesToAdd,
      p_images_to_add: 1,
    });

    if (error) {
      console.error("Failed to update storage usage:", error);
    }
  } catch (error) {
    console.error("Storage usage update error:", error);
  }
}

/**
 * Upload a single session photo
 */
export async function uploadSessionPhoto(
  file: File,
  sessionId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<UploadResult> {
  try {
    console.log("[Upload] Starting upload:", {
      fileName: file.name,
      sessionId,
      userId,
    });

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      console.warn("[Upload] Validation failed:", validation.error);
      return { success: false, error: validation.error };
    }

    // Check storage quota
    const usage = await getUserStorageUsage(userId, supabase);
    if (!usage.can_upload) {
      const usedMB = (usage.total_bytes / (1024 * 1024)).toFixed(2);
      const remainingMB = (usage.remaining_bytes / (1024 * 1024)).toFixed(2);
      console.warn("[Upload] Quota exceeded:", {
        usedMB,
        remainingMB,
        imageCount: usage.image_count,
      });
      return {
        success: false,
        error: `Storage quota exceeded. You've used ${usedMB}MB of your 100MB limit (${usage.image_count} images). Please delete some images to free up space.`,
      };
    }

    // The shared storage limit is lower than the input limit.
    if (file.size > SESSION_PHOTO_MAX_STORAGE_BYTES) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const maxSizeMB = (SESSION_PHOTO_MAX_STORAGE_BYTES / (1024 * 1024)).toFixed(0);
      console.error("[Upload] File too large for storage:", {
        fileSizeMB,
        maxSizeMB,
      });
      return {
        success: false,
        error: `File size is ${fileSizeMB}MB. Please choose an image under ${maxSizeMB}MB.`,
      };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${sessionId}/${userId}/${timestamp}.jpg`;

    console.log("[Upload] Uploading to storage:", {
      bucket: STORAGE_BUCKET,
      path: fileName,
      size: file.size,
    });

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("[Upload] Storage upload failed:", error);
      throw new Error(
        `Storage upload failed: ${error.message}. Please try again.`
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    console.log("[Upload] Upload successful:", {
      path: data.path,
      publicUrl: urlData.publicUrl,
    });

    // Update storage usage
    await updateStorageUsage(userId, file.size, supabase);

    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path,
      fileSize: file.size,
    };
  } catch (error) {
    console.error("[Upload] Upload failed:", {
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed. Please try again.",
    };
  }
}

/**
 * Upload multiple session photos
 */
export async function uploadMultiplePhotos(
  files: File[],
  sessionId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<UploadResult[]> {
  if (files.length > SESSION_PHOTO_MAX_PER_SESSION) {
    throw new Error(
      `Maximum ${SESSION_PHOTO_MAX_PER_SESSION} images allowed per session`
    );
  }

  // Check if session already has photos
  const { data: existingPhotos } = await supabase
    .from("session_media")
    .select("id")
    .eq("session_id", sessionId);

  const existingCount = existingPhotos?.length || 0;
  if (existingCount + files.length > SESSION_PHOTO_MAX_PER_SESSION) {
    throw new Error(
      `Session can only have ${SESSION_PHOTO_MAX_PER_SESSION} images total. Currently has ${existingCount}.`
    );
  }

  // Upload files in parallel (max 5 photos per session is safe for concurrent upload)
  const results = await Promise.all(
    files.map((file) => uploadSessionPhoto(file, sessionId, userId, supabase))
  );

  return results;
}

/**
 * Delete a session photo
 */
export async function deleteSessionPhoto(
  path: string,
  userId: string,
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get file info before deletion for storage tracking
    const { data: fileData } = await supabase
      .from("session_media")
      .select("file_size")
      .eq("storage_path", path)
      .eq("user_id", userId)
      .single();

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([path]);

    if (storageError) {
      throw storageError;
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from("session_media")
      .delete()
      .eq("storage_path", path)
      .eq("user_id", userId);

    if (dbError) {
      throw dbError;
    }

    // Update storage usage
    if (fileData?.file_size) {
      await updateStorageUsage(userId, -fileData.file_size, supabase);
    }

    return { success: true };
  } catch (error) {
    console.error("Delete failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

/**
 * Get photos for a session
 */
export async function getSessionPhotos(
  sessionId: string,
  supabase: SupabaseClient
): Promise<SessionPhoto[]> {
  try {
    const { data, error } = await supabase
      .from("session_media")
      .select(
        `
        id,
        session_id,
        user_id,
        public_url,
        storage_path,
        caption,
        file_size,
        metadata,
        created_at
      `
      )
      .eq("session_id", sessionId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Failed to get session photos:", error);
    return [];
  }
}

/**
 * Add caption to a photo
 */
export async function updatePhotoCaption(
  photoId: string,
  caption: string,
  userId: string,
  supabase: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("session_media")
      .update({ caption })
      .eq("id", photoId)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to update caption:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update caption",
    };
  }
}
