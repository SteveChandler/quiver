"use server";

/**
 * Photo Management Server Actions
 *
 * Admin operations for managing session media and beach photos.
 * Includes soft delete functionality with storage cleanup.
 */

import { withAdminActionAndUser } from "@/lib/server-action-utils/admin";
import { recordAdminEvent } from "@/lib/logging/admin-audit";
import type { AdminUser } from "@/lib/auth/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Context provided to admin actions */
type AdminContext = {
  user: AdminUser;
  supabaseAdmin: SupabaseClient<Database>;
};

// ================================================
// Session Media Actions
// ================================================

/**
 * Unified photo type for moderation
 */
export interface PhotoModerationItem {
  id: string;
  type: "session_media" | "beach_photo";
  imageUrl: string;
  thumbUrl?: string;
  uploadedAt: string;
  fileSize?: number;
  status: "active" | "deleted";
  approved?: boolean; // beach_photos only
  metadata: {
    userId?: string;
    userName?: string;
    sessionId?: string;
    beachId?: string;
    beachName?: string;
    caption?: string;
    source?: string;
    storagePath?: string;
  };
}

/**
 * List all session media with optional filters
 */
export const listSessionMedia = withAdminActionAndUser(
  async (options: { includeDeleted?: boolean; search?: string }, { supabaseAdmin }: AdminContext) => {
    const opts = options || {};
    const { includeDeleted = false, search = "" } = opts;

    let query = supabaseAdmin
      .from("session_media")
      .select(
        `
        id,
        session_id,
        user_id,
        storage_path,
        public_url,
        file_size,
        media_type,
        caption,
        created_at,
        deleted_at,
        profiles!session_media_user_id_fkey(
          id,
          display_name,
          email
        ),
        sessions(
          id,
          session_date
        )
      `
      )
      .order("created_at", { ascending: false });

    // Filter out deleted by default
    if (!includeDeleted) {
      query = query.is("deleted_at", null);
    }

    // Search filter
    if (search) {
      query = query.or(`caption.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch session media: ${error.message}`);
    }

    // Transform to PhotoModerationItem format
    const items: PhotoModerationItem[] = (data || []).map((item: any) => ({
      id: item.id,
      type: "session_media" as const,
      imageUrl: item.public_url,
      uploadedAt: item.created_at,
      fileSize: item.file_size,
      status: item.deleted_at ? ("deleted" as const) : ("active" as const),
      metadata: {
        userId: item.user_id,
        userName: item.profiles?.display_name || item.profiles?.email || "Unknown",
        sessionId: item.session_id,
        caption: item.caption,
        storagePath: item.storage_path,
      },
    }));

    return items;
  }
);

/**
 * Soft delete session media and remove from storage
 */
export const softDeleteSessionMedia = withAdminActionAndUser(
  async (mediaId: string, { user, supabaseAdmin }: AdminContext) => {
    // Get media details for storage cleanup and audit log
    const { data: media } = await supabaseAdmin
      .from("session_media")
      .select("storage_path, caption, user_id, file_size")
      .eq("id", mediaId)
      .single();

    if (!media) {
      throw new Error("Media not found");
    }

    // Soft delete the media record
    const { error: dbError } = await supabaseAdmin
      .from("session_media")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", mediaId);

    if (dbError) {
      throw new Error(`Failed to delete media: ${dbError.message}`);
    }

    // Remove from storage bucket
    try {
      const { error: storageError } = await supabaseAdmin.storage
        .from("session-media")
        .remove([media.storage_path]);

      if (storageError) {
        console.error("Storage cleanup failed:", storageError);
        // Continue anyway - DB record is marked deleted
      }
    } catch (storageErr) {
      console.error("Storage cleanup error:", storageErr);
      // Continue anyway - DB record is marked deleted
    }

    // Log the action
    await recordAdminEvent(user.id, "photo", "delete", {
      entityId: mediaId,
      description: "Soft deleted session media with storage cleanup",
      payloadSummary: {
        storage_path: media.storage_path,
        caption: media.caption,
        file_size: media.file_size,
        owner_id: media.user_id,
      },
    });

    return { success: true };
  }
);

/**
 * Restore a soft-deleted session media
 */
export const restoreSessionMedia = withAdminActionAndUser(
  async (mediaId: string, { user, supabaseAdmin }: AdminContext) => {
    // Get media details for audit log
    const { data: media } = await supabaseAdmin
      .from("session_media")
      .select("caption, user_id")
      .eq("id", mediaId)
      .single();

    // Restore the media
    const { error } = await supabaseAdmin
      .from("session_media")
      .update({ deleted_at: null })
      .eq("id", mediaId);

    if (error) {
      throw new Error(`Failed to restore media: ${error.message}`);
    }

    // Log the action
    await recordAdminEvent(user.id, "photo", "restore", {
      entityId: mediaId,
      description: "Restored soft-deleted session media",
      payloadSummary: {
        caption: media?.caption,
        owner_id: media?.user_id,
      },
    });

    return { success: true };
  }
);

/**
 * Bulk soft delete multiple session media items
 */
export const bulkSoftDeleteSessionMedia = withAdminActionAndUser(
  async (mediaIds: string[], { user, supabaseAdmin }: AdminContext) => {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    for (const mediaId of mediaIds) {
      try {
        // Get media details for storage cleanup and audit log
        const { data: media } = await supabaseAdmin
          .from("session_media")
          .select("storage_path, caption, user_id, file_size")
          .eq("id", mediaId)
          .single();

        if (!media) {
          results.failed++;
          results.errors.push({ id: mediaId, error: "Media not found" });
          continue;
        }

        // Soft delete the media record
        const { error: dbError } = await supabaseAdmin
          .from("session_media")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", mediaId);

        if (dbError) {
          results.failed++;
          results.errors.push({ id: mediaId, error: dbError.message });
          continue;
        }

        // Remove from storage bucket
        try {
          const { error: storageError } = await supabaseAdmin.storage
            .from("session-media")
            .remove([media.storage_path]);

          if (storageError) {
            console.error(`Storage cleanup failed for ${mediaId}:`, storageError);
            // Continue anyway - DB record is marked deleted
          }
        } catch (storageErr) {
          console.error(`Storage cleanup error for ${mediaId}:`, storageErr);
          // Continue anyway - DB record is marked deleted
        }

        // Log the action
        await recordAdminEvent(user.id, "photo", "delete", {
          entityId: mediaId,
          description: "Bulk soft deleted session media with storage cleanup",
          payloadSummary: {
            storage_path: media.storage_path,
            caption: media.caption,
            file_size: media.file_size,
            owner_id: media.user_id,
            bulk_operation: true,
          },
        });

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          id: mediaId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return results;
  }
);

// ================================================
// Beach Photos Actions
// ================================================

/**
 * List all beach photos with optional filters
 */
export const listBeachPhotos = withAdminActionAndUser(
  async (
    options: { includeDeleted?: boolean; approvedOnly?: boolean; search?: string },
    { supabaseAdmin }: AdminContext
  ) => {
    const opts = options || {};
    const { includeDeleted = false, approvedOnly = false, search = "" } = opts;

    let query = supabaseAdmin
      .from("beach_photos")
      .select(
        `
        id,
        beach_id,
        source,
        image_url,
        thumb_url,
        title,
        creator_name,
        approved,
        fetched_at,
        deleted_at,
        beaches(
          id,
          name
        )
      `
      )
      .order("fetched_at", { ascending: false });

    // Filter out deleted by default
    if (!includeDeleted) {
      query = query.is("deleted_at", null);
    }

    // Filter by approval status
    if (approvedOnly) {
      query = query.eq("approved", true);
    }

    // Search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,creator_name.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch beach photos: ${error.message}`);
    }

    // Transform to PhotoModerationItem format
    const items: PhotoModerationItem[] = (data || []).map((item: any) => ({
      id: item.id,
      type: "beach_photo" as const,
      imageUrl: item.image_url,
      thumbUrl: item.thumb_url,
      uploadedAt: item.fetched_at,
      status: item.deleted_at ? ("deleted" as const) : ("active" as const),
      approved: item.approved,
      metadata: {
        beachId: item.beach_id,
        beachName: item.beaches?.name || "Unknown",
        source: item.source,
      },
    }));

    return items;
  }
);

/**
 * Soft delete a beach photo
 */
export const softDeleteBeachPhoto = withAdminActionAndUser(
  async (photoId: string, { user, supabaseAdmin }: AdminContext) => {
    // Get photo details for audit log
    const { data: photo } = await supabaseAdmin
      .from("beach_photos")
      .select("title, source, beach_id, beaches(name)")
      .eq("id", photoId)
      .single();

    // Soft delete the photo
    const { error } = await supabaseAdmin
      .from("beach_photos")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", photoId);

    if (error) {
      throw new Error(`Failed to delete photo: ${error.message}`);
    }

    // Log the action
    await recordAdminEvent(user.id, "photo", "delete", {
      entityId: photoId,
      description: "Soft deleted beach photo",
      payloadSummary: {
        title: photo?.title,
        source: photo?.source,
        beach_id: photo?.beach_id,
        beach_name: (photo as any)?.beaches?.name,
      },
    });

    return { success: true };
  }
);

/**
 * Restore a soft-deleted beach photo
 */
export const restoreBeachPhoto = withAdminActionAndUser(
  async (photoId: string, { user, supabaseAdmin }: AdminContext) => {
    // Get photo details for audit log
    const { data: photo } = await supabaseAdmin
      .from("beach_photos")
      .select("title, source, beach_id")
      .eq("id", photoId)
      .single();

    // Restore the photo
    const { error } = await supabaseAdmin
      .from("beach_photos")
      .update({ deleted_at: null })
      .eq("id", photoId);

    if (error) {
      throw new Error(`Failed to restore photo: ${error.message}`);
    }

    // Log the action
    await recordAdminEvent(user.id, "photo", "restore", {
      entityId: photoId,
      description: "Restored soft-deleted beach photo",
      payloadSummary: {
        title: photo?.title,
        source: photo?.source,
        beach_id: photo?.beach_id,
      },
    });

    return { success: true };
  }
);

/**
 * Bulk soft delete multiple beach photos
 */
export const bulkSoftDeleteBeachPhotos = withAdminActionAndUser(
  async (photoIds: string[], { user, supabaseAdmin }: AdminContext) => {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    for (const photoId of photoIds) {
      try {
        // Get photo details for audit log
        const { data: photo } = await supabaseAdmin
          .from("beach_photos")
          .select("title, source, beach_id, beaches(name)")
          .eq("id", photoId)
          .single();

        if (!photo) {
          results.failed++;
          results.errors.push({ id: photoId, error: "Photo not found" });
          continue;
        }

        // Soft delete the photo
        const { error: dbError } = await supabaseAdmin
          .from("beach_photos")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", photoId);

        if (dbError) {
          results.failed++;
          results.errors.push({ id: photoId, error: dbError.message });
          continue;
        }

        // Log the action
        await recordAdminEvent(user.id, "photo", "delete", {
          entityId: photoId,
          description: "Bulk soft deleted beach photo",
          payloadSummary: {
            title: photo.title,
            source: photo.source,
            beach_id: photo.beach_id,
            beach_name: (photo as any)?.beaches?.name,
            bulk_operation: true,
          },
        });

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          id: photoId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return results;
  }
);

/**
 * Permanently delete a beach photo (hard delete)
 */
export const hardDeleteBeachPhoto = withAdminActionAndUser(
  async (photoId: string, { user, supabaseAdmin }: AdminContext) => {
    // Get photo details for audit log before deletion
    const { data: photo } = await supabaseAdmin
      .from("beach_photos")
      .select("title, source, beach_id, beaches(name)")
      .eq("id", photoId)
      .single();

    // Hard delete the photo
    const { error } = await supabaseAdmin
      .from("beach_photos")
      .delete()
      .eq("id", photoId);

    if (error) {
      throw new Error(`Failed to permanently delete photo: ${error.message}`);
    }

    // Log the action
    await recordAdminEvent(user.id, "photo", "delete", {
      entityId: photoId,
      description: "Permanently deleted beach photo (hard delete)",
      payloadSummary: {
        title: photo?.title,
        source: photo?.source,
        beach_id: photo?.beach_id,
        beach_name: (photo as any)?.beaches?.name,
      },
    });

    return { success: true };
  }
);

/**
 * Bulk permanently delete multiple beach photos (hard delete)
 */
export const bulkHardDeleteBeachPhotos = withAdminActionAndUser(
  async (photoIds: string[], { user, supabaseAdmin }: AdminContext) => {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    for (const photoId of photoIds) {
      try {
        // Get photo details for audit log before deletion
        const { data: photo } = await supabaseAdmin
          .from("beach_photos")
          .select("title, source, beach_id, beaches(name)")
          .eq("id", photoId)
          .single();

        if (!photo) {
          results.failed++;
          results.errors.push({ id: photoId, error: "Photo not found" });
          continue;
        }

        // Hard delete the photo
        const { error: dbError } = await supabaseAdmin
          .from("beach_photos")
          .delete()
          .eq("id", photoId);

        if (dbError) {
          results.failed++;
          results.errors.push({ id: photoId, error: dbError.message });
          continue;
        }

        // Log the action
        await recordAdminEvent(user.id, "photo", "delete", {
          entityId: photoId,
          description: "Bulk permanently deleted beach photo (hard delete)",
          payloadSummary: {
            title: photo.title,
            source: photo.source,
            beach_id: photo.beach_id,
            beach_name: (photo as any)?.beaches?.name,
            bulk_operation: true,
          },
        });

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          id: photoId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return results;
  }
);

/**
 * Bulk approve multiple beach photos
 */
export const bulkApproveBeachPhotos = withAdminActionAndUser(
  async (photoIds: string[], { user, supabaseAdmin }: AdminContext) => {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    for (const photoId of photoIds) {
      try {
        // Get photo details for audit log
        const { data: photo } = await supabaseAdmin
          .from("beach_photos")
          .select("title, source, beach_id, deleted_at, beaches(name)")
          .eq("id", photoId)
          .single();

        if (!photo) {
          results.failed++;
          results.errors.push({ id: photoId, error: "Photo not found" });
          continue;
        }

        if (photo.deleted_at) {
          results.failed++;
          results.errors.push({ id: photoId, error: "Photo is deleted" });
          continue;
        }

        // Approve the photo
        const { error: dbError } = await supabaseAdmin
          .from("beach_photos")
          .update({ approved: true })
          .eq("id", photoId);

        if (dbError) {
          results.failed++;
          results.errors.push({ id: photoId, error: dbError.message });
          continue;
        }

        // Log the action
        await recordAdminEvent(user.id, "photo", "approve", {
          entityId: photoId,
          description: "Bulk approved beach photo",
          payloadSummary: {
            title: photo.title,
            source: photo.source,
            beach_id: photo.beach_id,
            beach_name: (photo as any)?.beaches?.name,
            bulk_operation: true,
          },
        });

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          id: photoId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return results;
  }
);

/**
 * Toggle approval status for a beach photo
 */
export const toggleBeachPhotoApproval = withAdminActionAndUser(
  async (photoId: string, approved: boolean, { user, supabaseAdmin }: AdminContext) => {
    // Get photo details for audit log
    const { data: photo } = await supabaseAdmin
      .from("beach_photos")
      .select("title, source, beach_id, beaches(name)")
      .eq("id", photoId)
      .single();

    // Update approval status
    const { error } = await supabaseAdmin
      .from("beach_photos")
      .update({ approved })
      .eq("id", photoId);

    if (error) {
      throw new Error(`Failed to update approval status: ${error.message}`);
    }

    // Log the action
    await recordAdminEvent(user.id, "photo", approved ? "approve" : "reject", {
      entityId: photoId,
      description: approved ? "Approved beach photo" : "Rejected beach photo",
      payloadSummary: {
        title: photo?.title,
        source: photo?.source,
        beach_id: photo?.beach_id,
        beach_name: (photo as any)?.beaches?.name,
        approved,
      },
    });

    return { success: true };
  }
);

/**
 * Get photo statistics for dashboard
 */
export const getPhotoStats = withAdminActionAndUser(async (_: Record<string, never>, { supabaseAdmin }: AdminContext) => {
    // Session media stats
    const { count: sessionMediaTotal } = await supabaseAdmin
      .from("session_media")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);

    const { count: sessionMediaDeleted } = await supabaseAdmin
      .from("session_media")
      .select("*", { count: "exact", head: true })
      .not("deleted_at", "is", null);

    // Beach photos stats
    const { count: beachPhotosTotal } = await supabaseAdmin
      .from("beach_photos")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);

    const { count: beachPhotosApproved } = await supabaseAdmin
      .from("beach_photos")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("approved", true);

    const { count: beachPhotosPending } = await supabaseAdmin
      .from("beach_photos")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("approved", false);

    const { count: beachPhotosDeleted } = await supabaseAdmin
      .from("beach_photos")
      .select("*", { count: "exact", head: true })
      .not("deleted_at", "is", null);

    return {
      sessionMedia: {
        total: sessionMediaTotal || 0,
        deleted: sessionMediaDeleted || 0,
      },
      beachPhotos: {
        total: beachPhotosTotal || 0,
        approved: beachPhotosApproved || 0,
        pending: beachPhotosPending || 0,
        deleted: beachPhotosDeleted || 0,
      },
    };
  }
);
