"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { makeAuthenticatedAction, ServerActionResponse } from "@/lib/server-action-utils";

import {
  uploadMultiplePhotos,
  deleteSessionPhoto,
  getSessionPhotos,
  updatePhotoCaption,
  getUserStorageUsage,
  type SessionPhoto,
  type StorageUsageInfo,
} from "@/lib/supabase/storage";

/**
 * Upload photos to a session
 */
export const uploadSessionPhotosAction = makeAuthenticatedAction(
  async (user, supabase, sessionId: string, formData: FormData) => {
    // Validate session ownership or participation
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("user_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error("Session not found");
    }

    if (session.user_id !== user.id) {
      throw new Error("You can only add photos to your own sessions");
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
      throw new Error("No files selected");
    }

    // Upload files
    const uploadResults = await uploadMultiplePhotos(
      files,
      sessionId,
      user.id,
      supabase
    );

    // Save successful uploads to database
    const successfulUploads = uploadResults.filter((result) => result.success);
    const failedUploads = uploadResults.filter((result) => !result.success);

    if (successfulUploads.length > 0) {
      const mediaRecords = successfulUploads.map((result) => ({
        session_id: sessionId,
        user_id: user.id,
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
        throw new Error("Failed to save photo records");
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
      throw new Error(summary.errors[0] || "Failed to upload photos");
    }

    return summary;
  }
);

/**
 * Delete a session photo
 */
export const deleteSessionPhotoAction = makeAuthenticatedAction(
  async (user, supabase, photoId: string) => {
    // Get photo details
    const { data: photo, error: photoError } = await supabase
      .from("session_media")
      .select("storage_path, session_id, user_id")
      .eq("id", photoId)
      .single();

    if (photoError || !photo) {
      throw new Error("Photo not found");
    }

    if (photo.user_id !== user.id) {
      throw new Error("You can only delete your own photos");
    }

    // Delete from storage and database
    const result = await deleteSessionPhoto(
      photo.storage_path,
      user.id,
      supabase
    );

    if (!result.success) {
      throw new Error(result.error || "Failed to delete photo");
    }

    // Revalidate session page
    revalidatePath(`/sessions/${photo.session_id}`);

    return undefined;
  }
);

/**
 * Update photo caption
 */
export const updatePhotoCaptionAction = makeAuthenticatedAction(
  async (user, supabase, photoId: string, caption: string) => {
    const result = await updatePhotoCaption(photoId, caption, user.id, supabase);

    if (!result.success) {
      throw new Error(result.error || "Failed to update caption");
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

    return undefined;
  }
);

/**
 * Get session photos (no auth required - public read)
 */
export async function getSessionPhotosAction(
  sessionId: string
): Promise<ServerActionResponse<SessionPhoto[]>> {
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
export const getUserStorageUsageAction = makeAuthenticatedAction(
  async (user, supabase) => {
    const usage = await getUserStorageUsage(user.id, supabase);
    return usage;
  }
) as () => Promise<ServerActionResponse<StorageUsageInfo>>;

/**
 * Get detailed storage statistics via database function
 */
export const getStorageStatsAction = makeAuthenticatedAction(
  async (user, supabase) => {
    const { data, error } = await supabase.rpc("get_user_storage_stats", {
      p_user_id: user.id,
    });

    if (error) {
      throw error;
    }

    return data?.[0];
  }
);
