"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withAuthenticatedAction } from "@/lib/server-action-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-utils";

// Create alias for consistency with existing code
const withAuth = withAuthenticatedAction;
import {
  uploadSessionPhoto,
  uploadMultiplePhotos,
  deleteSessionPhoto,
  getSessionPhotos,
  updatePhotoCaption,
  getUserStorageUsage,
  type UploadResult,
  type SessionPhoto,
  type StorageUsageInfo,
} from "@/lib/supabase/storage";

/**
 * Upload photos to a session
 */
export async function uploadSessionPhotosAction(
  sessionId: string,
  formData: FormData
): Promise<ActionResult<any>> {
  return withAuth(async (userId) => {
    try {
      const supabase = await createSupabaseServerClient();

      // Validate session ownership or participation
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .select("user_id")
        .eq("id", sessionId)
        .single();

      if (sessionError || !session) {
        return { success: false, error: "Session not found" };
      }

      if (session.user_id !== userId) {
        return {
          success: false,
          error: "You can only add photos to your own sessions",
        };
      }

      // Extract files from FormData
      const files: File[] = [];
      const fileCount = parseInt(formData.get("fileCount") as string) || 0;

      for (let i = 0; i < fileCount; i++) {
        const file = formData.get(`file_${i}`) as File;
        if (file && file.size > 0) {
          files.push(file);
        }
      }

      if (files.length === 0) {
        return { success: false, error: "No files selected" };
      }

      // Upload files
      const uploadResults = await uploadMultiplePhotos(
        files,
        sessionId,
        userId
      );

      // Save successful uploads to database
      const successfulUploads = uploadResults.filter(
        (result) => result.success
      );
      const failedUploads = uploadResults.filter((result) => !result.success);

      if (successfulUploads.length > 0) {
        const mediaRecords = successfulUploads.map((result) => ({
          session_id: sessionId,
          user_id: userId,
          storage_path: result.path!,
          public_url: result.url!,
          file_size: result.fileSize!,
          media_type: "photo",
          metadata: {
            upload_timestamp: Date.now(),
          },
        }));

        const { error: dbError } = await supabase
          .from("session_media")
          .insert(mediaRecords);

        if (dbError) {
          console.error("Database insert error:", dbError);
          return { success: false, error: "Failed to save photo records" };
        }
      }

      // Revalidate session page
      revalidatePath(`/sessions/${sessionId}`);

      return {
        success: true,
        data: {
          uploaded: successfulUploads.length,
          failed: failedUploads.length,
          errors: failedUploads.map((f) => f.error).filter(Boolean),
        },
      };
    } catch (error) {
      console.error("Upload session photos error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      };
    }
  });
}

/**
 * Delete a session photo
 */
export async function deleteSessionPhotoAction(
  photoId: string
): Promise<ActionResult<any>> {
  return withAuth(async (userId) => {
    try {
      const supabase = await createSupabaseServerClient();

      // Get photo details
      const { data: photo, error: photoError } = await supabase
        .from("session_media")
        .select("storage_path, session_id, user_id")
        .eq("id", photoId)
        .single();

      if (photoError || !photo) {
        return { success: false, error: "Photo not found" };
      }

      if (photo.user_id !== userId) {
        return { success: false, error: "You can only delete your own photos" };
      }

      // Delete from storage and database
      const result = await deleteSessionPhoto(photo.storage_path, userId);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Revalidate session page
      revalidatePath(`/sessions/${photo.session_id}`);

      return { success: true };
    } catch (error) {
      console.error("Delete session photo error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Delete failed",
      };
    }
  });
}

/**
 * Update photo caption
 */
export async function updatePhotoCaptionAction(
  photoId: string,
  caption: string
): Promise<ActionResult<any>> {
  return withAuth(async (userId) => {
    try {
      const supabase = await createSupabaseServerClient();

      const result = await updatePhotoCaption(photoId, caption, userId);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Get session ID for revalidation
      const { data: photo } = await supabase
        .from("session_media")
        .select("session_id")
        .eq("id", photoId)
        .single();

      if (photo) {
        revalidatePath(`/sessions/${photo.session_id}`);
      }

      return { success: true };
    } catch (error) {
      console.error("Update photo caption error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Update failed",
      };
    }
  });
}

/**
 * Get session photos
 */
export async function getSessionPhotosAction(
  sessionId: string
): Promise<ActionResult<SessionPhoto[]>> {
  try {
    const photos = await getSessionPhotos(sessionId);
    return { success: true, data: photos };
  } catch (error) {
    console.error("Get session photos error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get photos",
    };
  }
}

/**
 * Get user storage usage statistics
 */
export async function getUserStorageUsageAction(): Promise<ActionResult<StorageUsageInfo>> {
  return withAuth(async (userId) => {
    try {
      const usage = await getUserStorageUsage(userId);
      return { success: true, data: usage };
    } catch (error) {
      console.error("Get storage usage error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get storage usage",
      };
    }
  });
}

/**
 * Get detailed storage statistics via database function
 */
export async function getStorageStatsAction(): Promise<ActionResult<any>> {
  return withAuth(async (userId) => {
    try {
      const supabase = await createSupabaseServerClient();

      const { data, error } = await supabase.rpc("get_user_storage_stats", {
        p_user_id: userId,
      });

      if (error) {
        throw error;
      }

      return { success: true, data: data[0] };
    } catch (error) {
      console.error("Get storage stats error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get storage stats",
      };
    }
  });
}

// Removed cleanupOrphanedMediaAction (unused)

// Removed batchUpdatePhotoCaptionsAction (unused)
