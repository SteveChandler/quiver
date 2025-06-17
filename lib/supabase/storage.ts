import { supabase } from "@/lib/supabase/client";
import { compress } from "image-conversion";

const STORAGE_BUCKET = "session-media";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per image (free tier consideration)
const MAX_IMAGES_PER_SESSION = 5; // Limit for free tier
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export interface UploadResult {
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
 * Compress and optimize image for free tier storage
 */
async function compressImage(file: File): Promise<File> {
  try {
    const compressedFile = await compress(file, {
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1080,
      type: "image/jpeg",
    });

    // Convert blob to File if needed
    if (compressedFile instanceof Blob && !(compressedFile instanceof File)) {
      return new File(
        [compressedFile],
        file.name.replace(/\.[^/.]+$/, ".jpg"),
        {
          type: "image/jpeg",
          lastModified: Date.now(),
        }
      );
    }

    return compressedFile as File;
  } catch (error) {
    console.error("Image compression failed:", error);
    throw new Error("Failed to compress image. Please try a different image.");
  }
}

/**
 * Validate file before upload
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Only JPEG, PNG, and WebP images are allowed.",
    };
  }

  if (file.size > MAX_FILE_SIZE * 2) {
    // Allow larger files before compression
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
  userId: string
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
  bytesToAdd: number
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
  userId: string
): Promise<UploadResult> {
  try {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check storage quota
    const usage = await getUserStorageUsage(userId);
    if (!usage.can_upload) {
      return {
        success: false,
        error:
          "Storage quota exceeded. Please delete some images to free up space.",
      };
    }

    // Compress image
    const compressedFile = await compressImage(file);

    if (compressedFile.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error:
          "File size too large even after compression. Please choose a smaller image.",
      };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileName = `${sessionId}/${userId}/${timestamp}.jpg`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, compressedFile, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    // Update storage usage
    await updateStorageUsage(userId, compressedFile.size);

    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path,
      fileSize: compressedFile.size,
    };
  } catch (error) {
    console.error("Upload failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Upload multiple session photos
 */
export async function uploadMultiplePhotos(
  files: File[],
  sessionId: string,
  userId: string
): Promise<UploadResult[]> {
  if (files.length > MAX_IMAGES_PER_SESSION) {
    throw new Error(
      `Maximum ${MAX_IMAGES_PER_SESSION} images allowed per session`
    );
  }

  // Check if session already has photos
  const { data: existingPhotos } = await supabase
    .from("session_media")
    .select("id")
    .eq("session_id", sessionId);

  const existingCount = existingPhotos?.length || 0;
  if (existingCount + files.length > MAX_IMAGES_PER_SESSION) {
    throw new Error(
      `Session can only have ${MAX_IMAGES_PER_SESSION} images total. Currently has ${existingCount}.`
    );
  }

  // Upload files sequentially to avoid overwhelming the storage
  const results: UploadResult[] = [];
  for (const file of files) {
    const result = await uploadSessionPhoto(file, sessionId, userId);
    results.push(result);

    // If any upload fails, stop uploading more
    if (!result.success) {
      break;
    }
  }

  return results;
}

/**
 * Delete a session photo
 */
export async function deleteSessionPhoto(
  path: string,
  userId: string
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
      await updateStorageUsage(userId, -fileData.file_size);
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
  sessionId: string
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
  userId: string
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
