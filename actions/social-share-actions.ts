"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withAuthenticatedAction, withServerAction } from "@/lib/server-action-utils";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export type SharePlatform = "instagram" | "tiktok" | "twitter" | "facebook" | "copy" | "native" | "other";
export type ShareVariant = "story" | "square";

interface ShareSessionInput {
  sessionId: string;
  platform: SharePlatform;
  variant?: ShareVariant;
}

interface ShareUrlOptions {
  sessionId: string;
  platform: SharePlatform;
  variant?: ShareVariant;
}

interface SessionShareStats {
  total_shares: number;
  instagram_shares: number;
  tiktok_shares: number;
  twitter_shares: number;
  facebook_shares: number;
  copy_shares: number;
  unique_sharers: number;
  last_shared_at: string | null;
}

/**
 * Track a session share event
 * Creates a share record and increments the session's share count
 */
export async function trackSessionShare(input: ShareSessionInput) {
  return withAuthenticatedAction(async (user, supabase) => {
    const { sessionId, platform, variant = "story" } = input;

    // Verify session exists and is viewable
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, user_id, is_public")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error("Session not found");
    }

    // Verify user can share this session (must be public or owned by user)
    if (!session.is_public && session.user_id !== user.id) {
      throw new Error("Cannot share private session");
    }

    // Generate share URL with UTM parameters
    const shareUrl = generateShareUrl({
      sessionId,
      platform,
      variant,
    });

    // Create share record
    const { data: share, error: shareError } = await supabase
      .from("session_shares")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        platform,
        variant,
        share_url: shareUrl,
      })
      .select()
      .single();

    if (shareError) {
      // If error is duplicate share (violates unique constraint), that's ok - just return existing
      if (shareError.code === "23505") {
        return {
          alreadyShared: true,
          message: "You've already shared this session today",
        };
      }
      throw shareError;
    }

    // Track XP for sharing (optional)
    try {
      const { trackXP } = await import("@/lib/gamification-actions");
      await trackXP("share_session", sessionId, "session");
    } catch (xpError) {
      console.warn("XP tracking failed for share:", xpError);
    }

    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath("/profile");

    return {
      success: true,
      share,
      shareUrl,
    };
  });
}

/**
 * Generate a shareable URL with UTM parameters for tracking
 * (Internal utility - not exported as server action)
 */
function generateShareUrl(options: ShareUrlOptions): string {
  const { sessionId, platform, variant = "story" } = options;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://quiversurf.app";
  const sessionUrl = `${baseUrl}/sessions/${sessionId}`;

  // Add UTM parameters for analytics
  const url = new URL(sessionUrl);
  url.searchParams.set("utm_source", platform);
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", "session_share");
  url.searchParams.set("utm_content", variant);

  return url.toString();
}

/**
 * Generate a signed share image URL for a session
 * Uses HMAC to prevent unauthorized access to private session images
 */
export async function generateShareImageUrl(
  sessionId: string,
  variant: ShareVariant = "story"
): Promise<string> {
  const secret = process.env.SOCIAL_SHARE_SECRET;
  if (!secret) {
    throw new Error("SOCIAL_SHARE_SECRET not configured");
  }

  // Create signature
  const canonical = `${sessionId}:${variant}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(canonical)
    .digest("hex");

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://quiversurf.app";
  const imageUrl = new URL(`${baseUrl}/api/social/share/og`);
  imageUrl.searchParams.set("sessionId", sessionId);
  imageUrl.searchParams.set("variant", variant);
  imageUrl.searchParams.set("t", signature);

  return imageUrl.toString();
}

/**
 * Get share statistics for a session
 */
export async function getSessionShareStats(sessionId: string) {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .rpc("get_session_share_stats", { p_session_id: sessionId })
      .single();

    if (error) {
      throw error;
    }

    return data as SessionShareStats;
  });
}

/**
 * Get user's viral coefficient (average shares per session)
 */
export async function getUserViralCoefficient(userId?: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    const targetUserId = userId || user.id;

    const { data, error } = await supabase
      .rpc("get_user_viral_coefficient", { p_user_id: targetUserId })
      .single();

    if (error) {
      throw error;
    }

    return {
      viralCoefficient: data as number,
      userId: targetUserId,
    };
  });
}

/**
 * Get trending shared sessions (most shared in last 7 days)
 */
export async function getTrendingSharedSessions(limit: number = 10) {
  return withServerAction(async () => {
    const supabase = await createSupabaseServerClient();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from("sessions")
      .select(
        `
        id,
        beach_name,
        arrival_time,
        share_count,
        rating,
        user:profiles!sessions_user_id_fkey(
          id,
          full_name,
          username,
          avatar_url
        )
      `
      )
      .eq("is_public", true)
      .gte("created_at", sevenDaysAgo.toISOString())
      .gt("share_count", 0)
      .order("share_count", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data;
  });
}

/**
 * Get share analytics for a user
 */
export async function getUserShareAnalytics() {
  return withAuthenticatedAction(async (user, supabase) => {
    // Get total shares of user's sessions
    const { data: shareData, error: shareError } = await supabase
      .from("session_shares")
      .select(
        `
        id,
        platform,
        created_at,
        session:sessions!session_shares_session_id_fkey(
          id,
          beach_name,
          arrival_time
        )
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (shareError) {
      throw shareError;
    }

    // Get viral coefficient
    const { data: viralCoef, error: coefError } = await supabase
      .rpc("get_user_viral_coefficient", { p_user_id: user.id })
      .single();

    if (coefError) {
      throw coefError;
    }

    // Calculate platform breakdown
    const platformBreakdown = shareData.reduce(
      (acc, share) => {
        acc[share.platform] = (acc[share.platform] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalShares: shareData.length,
      recentShares: shareData,
      viralCoefficient: viralCoef as number,
      platformBreakdown,
    };
  });
}

/**
 * Delete a share record
 * Users can only delete their own shares
 */
export async function deleteShare(shareId: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    const { error } = await supabase
      .from("session_shares")
      .delete()
      .eq("id", shareId)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    revalidatePath("/profile");
    return { success: true };
  });
}
