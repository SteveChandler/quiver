"use server";

/**
 * Session Management Server Actions
 *
 * Admin operations for managing surf sessions with soft delete functionality.
 * All operations require admin privileges and include audit logging.
 */

import { withAdminActionAndUser } from "@/lib/server-action-utils/admin";
import { recordAdminEvent } from "@/lib/logging/admin-audit";
import type { SessionFilterOptions, SessionStats } from "@/lib/validation/admin/session-schema";
import type { AdminUser } from "@/lib/auth/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Context provided to admin actions */
type AdminContext = {
  user: AdminUser;
  supabaseAdmin: SupabaseClient<Database>;
};

/**
 * Enhanced session type with user/beach details for admin display
 */
export interface AdminSessionListItem {
  id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  beach_id: string;
  beach_name: string | null;
  status: string | null;
  arrival_time: string;
  duration_minutes: number;
  rating: number | null;
  wave_quality: number | null;
  crowd_level: number | null;
  is_public: boolean | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  deleted_at: string | null;
  // Metadata for investigation mode
  description: string | null;
  notes: string | null;
  goals: string[];
  invitee_ids: string[];
  image_url: string | null;
}

/**
 * Detailed session type for investigation view (includes all joins)
 */
export interface AdminSessionDetails {
  id: string;
  user_id: string;
  beach_id: string;
  beach_name: string | null;
  status: string | null;
  arrival_time: string;
  duration_minutes: number;
  rating: number | null;
  wave_quality: number | null;
  crowd_level: number | null;
  parking_ease: number | null;
  is_public: boolean | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  deleted_at: string | null;
  description: string | null;
  notes: string | null;
  goals: string[] | null;
  // Joined profile data
  profiles: {
    id: string;
    email: string | null;
    display_name: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  // Joined beach data
  beaches: {
    id: string;
    name: string;
    region: string | null;
    country: string | null;
  } | null;
  // Joined session media
  session_media: Array<{
    id: string;
    public_url: string;
    caption: string | null;
    created_at: string;
  }>;
}

/**
 * List all sessions with optional filters and joins
 */
export const listSessions = withAdminActionAndUser(
  async (options: Partial<SessionFilterOptions>, { supabaseAdmin }: AdminContext) => {
    const {
      includeDeleted = false,
      search = "",
      userId,
      beachId,
      status,
      isPublic,
      dateFrom,
      dateTo,
      minRating,
      maxRating,
    } = options || {};

    let query = supabaseAdmin
      .from("sessions")
      .select(
        `
        *,
        profiles!sessions_user_id_profiles_fkey (
          email,
          display_name,
          full_name
        )
      `
      )
      .order("created_at", { ascending: false });

    // Filter out deleted sessions by default
    if (!includeDeleted) {
      query = query.is("deleted_at", null);
    }

    // Apply filters
    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (beachId) {
      query = query.eq("beach_id", beachId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (isPublic !== undefined) {
      query = query.eq("is_public", isPublic);
    }

    if (dateFrom) {
      query = query.gte("arrival_time", dateFrom);
    }

    if (dateTo) {
      query = query.lte("arrival_time", dateTo);
    }

    if (minRating) {
      query = query.gte("rating", minRating);
    }

    if (maxRating) {
      query = query.lte("rating", maxRating);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch sessions: ${error.message}`);
    }

    // Transform data to include user details and apply search filter
    const sessions: AdminSessionListItem[] = (data || []).map((session: any) => {
      const profile = session.profiles;
      return {
        ...session,
        user_email: profile?.email,
        user_name: profile?.display_name || profile?.full_name,
      };
    });

    // Apply search filter (post-query due to join)
    if (search) {
      const searchLower = search.toLowerCase();
      return sessions.filter(
        (session) =>
          session.user_email?.toLowerCase().includes(searchLower) ||
          session.user_name?.toLowerCase().includes(searchLower) ||
          session.beach_name?.toLowerCase().includes(searchLower) ||
          session.description?.toLowerCase().includes(searchLower) ||
          session.notes?.toLowerCase().includes(searchLower)
      );
    }

    return sessions;
  }
);

/**
 * Get session statistics for admin dashboard
 */
export const getSessionStats = withAdminActionAndUser(
  async (_: Record<string, never>, { supabaseAdmin }: AdminContext) => {
    // Get total count and aggregates
    const { data, error } = await supabaseAdmin
      .from("sessions")
      .select("is_public, status, rating, likes_count, comments_count, deleted_at");

    if (error) {
      throw new Error(`Failed to fetch session stats: ${error.message}`);
    }

    // Type for session stat calculation
    type SessionStatRow = {
      is_public: boolean | null;
      status: string | null;
      rating: number | null;
      likes_count: number;
      comments_count: number;
      deleted_at: string | null;
    };

    const sessions: SessionStatRow[] = data || [];

    // Calculate statistics
    const stats: SessionStats = {
      total: sessions.filter((s: SessionStatRow) => !s.deleted_at).length,
      public: sessions.filter((s: SessionStatRow) => !s.deleted_at && s.is_public).length,
      private: sessions.filter((s: SessionStatRow) => !s.deleted_at && !s.is_public).length,
      planned: sessions.filter((s: SessionStatRow) => !s.deleted_at && s.status === "planned").length,
      logged: sessions.filter((s: SessionStatRow) => !s.deleted_at && s.status === "logged").length,
      cancelled: sessions.filter((s: SessionStatRow) => !s.deleted_at && s.status === "cancelled").length,
      deleted: sessions.filter((s: SessionStatRow) => s.deleted_at).length,
      avgRating:
        sessions
          .filter((s: SessionStatRow) => !s.deleted_at && s.rating)
          .reduce((sum: number, s: SessionStatRow, _: number, arr: SessionStatRow[]) => sum + (s.rating || 0) / arr.length, 0) || null,
      totalLikes: sessions.filter((s: SessionStatRow) => !s.deleted_at).reduce((sum: number, s: SessionStatRow) => sum + s.likes_count, 0),
      totalComments: sessions.filter((s: SessionStatRow) => !s.deleted_at).reduce((sum: number, s: SessionStatRow) => sum + s.comments_count, 0),
    };

    return stats;
  }
);

/**
 * Get single session for detailed investigation view
 */
export const getSession = withAdminActionAndUser(
  async (sessionId: string, { supabaseAdmin }: AdminContext) => {
    const { data, error } = await supabaseAdmin
      .from("sessions")
      .select(
        `
        *,
        profiles!sessions_user_id_profiles_fkey (
          id,
          email,
          display_name,
          full_name,
          avatar_url
        ),
        beaches!sessions_beach_id_fkey (
          id,
          name,
          region,
          country
        ),
        session_media (
          id,
          public_url,
          caption,
          created_at
        )
      `
      )
      .eq("id", sessionId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch session: ${error.message}`);
    }

    return data;
  }
);

/**
 * Soft delete a session (admin moderation)
 */
export const softDeleteSession = withAdminActionAndUser(
  async (sessionId: string, { supabaseAdmin, user }: AdminContext) => {
    // Fetch session details for audit logging
    const { data: session, error: fetchError } = await supabaseAdmin
      .from("sessions")
      .select("user_id, beach_name, status, created_at")
      .eq("id", sessionId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch session: ${fetchError.message}`);
    }

    // Soft delete the session
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (error) {
      throw new Error(`Failed to delete session: ${error.message}`);
    }

    // Log the action
    await recordAdminEvent(user.id, "session", "delete", {
      entityId: sessionId,
      description: `Soft deleted session at ${session.beach_name || "unknown beach"}`,
      payloadSummary: {
        user_id: session.user_id,
        beach: session.beach_name,
        status: session.status,
        created_at: session.created_at,
      },
    });

    return { success: true };
  }
);

/**
 * Restore a soft-deleted session
 */
export const restoreSession = withAdminActionAndUser(
  async (sessionId: string, { supabaseAdmin, user }: AdminContext) => {
    // Fetch session details for audit logging
    const { data: session, error: fetchError } = await supabaseAdmin
      .from("sessions")
      .select("user_id, beach_name, status, deleted_at")
      .eq("id", sessionId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to fetch session: ${fetchError.message}`);
    }

    if (!session.deleted_at) {
      throw new Error("Session is not deleted");
    }

    // Restore the session
    const { error } = await supabaseAdmin
      .from("sessions")
      .update({ deleted_at: null })
      .eq("id", sessionId);

    if (error) {
      throw new Error(`Failed to restore session: ${error.message}`);
    }

    // Log the action
    await recordAdminEvent(user.id, "session", "restore", {
      entityId: sessionId,
      description: `Restored session at ${session.beach_name || "unknown beach"}`,
      payloadSummary: {
        user_id: session.user_id,
        beach: session.beach_name,
        status: session.status,
        was_deleted_at: session.deleted_at,
      },
    });

    return { success: true };
  }
);
