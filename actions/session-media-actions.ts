"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/action-utils";

import {
  uploadMultiplePhotos,
  deleteSessionPhoto,
  getSessionPhotos,
  updatePhotoCaption,
  getUserStorageUsage,
  type SessionPhoto,
  type StorageUsageInfo,
} from "@/lib/supabase/storage";

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

type AuthContext =
  | { supabase: SupabaseServerClient; userId: string }
  | { error: string };

async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return { error: `Authentication error: ${error.message}` };
  }

  if (!user) {
    return { error: "User not authenticated" };
  }

  return { supabase, userId: user.id };
}

/**
 * Upload photos to a session
 */
export async function uploadSessionPhotosAction(
  sessionId: string,
  formData: FormData
): Promise<ActionResult<any>> {
  try {
    const authContext = await getAuthContext();
    if ("error" in authContext) {
      return { success: false, error: authContext.error };
    }

    const { supabase, userId } = authContext;

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
    const fileCountValue = formData.get("fileCount");
    const fileCount =
      typeof fileCountValue === "string"
        ? parseInt(fileCountValue, 10)
        : Number(fileCountValue || 0);

    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`file_${i}`) as File | null;
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
      userId,
      supabase
    );

    // Save successful uploads to database
    const successfulUploads = uploadResults.filter((result) => result.success);
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

    const summary = {
      uploaded: successfulUploads.length,
      failed: failedUploads.length,
      errors: failedUploads.map((f) => f.error).filter(Boolean),
    };

    if (successfulUploads.length === 0) {
      return {
        success: false,
        data: summary,
        error: summary.errors[0] || "Failed to upload photos",
      };
    }

    return {
      success: true,
      data: summary,
    };
  } catch (error) {
    console.error("Upload session photos error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Delete a session photo
 */
export async function deleteSessionPhotoAction(
  photoId: string
): Promise<ActionResult<any>> {
  try {
    const authContext = await getAuthContext();
    if ("error" in authContext) {
      return { success: false, error: authContext.error };
    }

    const { supabase, userId } = authContext;

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
    const result = await deleteSessionPhoto(
      photo.storage_path,
      userId,
      supabase
    );

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
}

/**
 * Update photo caption
 */
export async function updatePhotoCaptionAction(
  photoId: string,
  caption: string
): Promise<ActionResult<any>> {
  try {
    const authContext = await getAuthContext();
    if ("error" in authContext) {
      return { success: false, error: authContext.error };
    }

    const { supabase, userId } = authContext;

    const result = await updatePhotoCaption(photoId, caption, userId, supabase);

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
}

/**
 * Get session photos
 */
export async function getSessionPhotosAction(
  sessionId: string
): Promise<ActionResult<SessionPhoto[]>> {
  try {
    const supabase = await createSupabaseServerClient();
    const photos = await getSessionPhotos(sessionId, supabase);
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
  try {
    const authContext = await getAuthContext();
    if ("error" in authContext) {
      return { success: false, error: authContext.error };
    }

    const { supabase, userId } = authContext;
    const usage = await getUserStorageUsage(userId, supabase);
    return { success: true, data: usage };
  } catch (error) {
    console.error("Get storage usage error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get storage usage",
    };
  }
}

/**
 * Get detailed storage statistics via database function
 */
export async function getStorageStatsAction(): Promise<ActionResult<any>> {
  try {
    const authContext = await getAuthContext();
    if ("error" in authContext) {
      return { success: false, error: authContext.error };
    }

    const { supabase, userId } = authContext;

    const { data, error } = await supabase.rpc("get_user_storage_stats", {
      p_user_id: userId,
    });

    if (error) {
      throw error;
    }

    return { success: true, data: data?.[0] };
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
}

// Removed cleanupOrphanedMediaAction (unused)

// Removed batchUpdatePhotoCaptionsAction (unused)
