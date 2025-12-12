"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withAuthenticatedAction, withServerAction } from "@/lib/server-action-utils";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import type { SharePlatform, ShareVariant } from "@/types/session-share";

// Re-export types for consumers
export type { SharePlatform, ShareVariant };

// Legacy variant support (map old string variants to numeric variants)
export type LegacyShareVariant = "story" | "square";
export type ShareVariantInput = ShareVariant | LegacyShareVariant;

/**
 * Convert legacy string variant to numeric variant
 */
function normalizeVariant(variant: ShareVariantInput): ShareVariant {
  if (typeof variant === "number") return variant;
  // Map legacy string variants to numeric variants
  return variant === "story" ? 1 : 2; // story -> 1, square -> 2
}

interface ShareSessionInput {
  sessionId: string;
  platform: SharePlatform;
  variant?: ShareVariantInput;
}

interface ShareUrlOptions {
  sessionId: string;
  platform: SharePlatform;
  variant?: ShareVariantInput;
}

/**
 * Track a session share event
 * Creates a share record and increments the session's share count
 */
export async function trackSessionShare(input: ShareSessionInput) {
  return withAuthenticatedAction(async (user, supabase) => {
    const { sessionId, platform, variant: inputVariant = 1 } = input;

    // Normalize variant to numeric format for database
    const variant = normalizeVariant(inputVariant);

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
    const shareUrl = await generateShareUrl({
      sessionId,
      platform,
      variant,
    });

    // Create share record - store variant as string for database compatibility
    const { data: share, error: shareError } = await supabase
      .from("session_shares")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        platform,
        variant: String(variant), // Store as string for database constraint compatibility
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
 */
export async function generateShareUrl(options: ShareUrlOptions): Promise<string> {
  const { sessionId, platform, variant: inputVariant = 1 } = options;

  // Normalize variant to numeric format
  const variant = normalizeVariant(inputVariant);

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
  const sessionUrl = `${baseUrl}/sessions/${sessionId}`;

  // Add UTM parameters for analytics
  const url = new URL(sessionUrl);
  url.searchParams.set("utm_source", platform);
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", "session_share");
  url.searchParams.set("utm_content", String(variant));

  return url.toString();
}

/**
 * Generate a signed share image URL for a session
 * Uses HMAC to prevent unauthorized access to private session images
 */
export async function generateShareImageUrl(
  sessionId: string,
  variant: ShareVariantInput = 1,
  aspectRatio?: string
): Promise<string> {
  const secret = process.env.SOCIAL_SHARE_SECRET;
  if (!secret) {
    throw new Error("SOCIAL_SHARE_SECRET not configured");
  }

  // Normalize variant to numeric format
  const normalizedVariant = normalizeVariant(variant);

  // Create signature - include aspect ratio if provided
  const canonical = aspectRatio
    ? `${sessionId}:${normalizedVariant}:${aspectRatio}`
    : `${sessionId}:${normalizedVariant}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(canonical)
    .digest("hex");

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";
  const imageUrl = new URL(`${baseUrl}/api/social/share/og`);
  imageUrl.searchParams.set("sessionId", sessionId);
  imageUrl.searchParams.set("variant", String(normalizedVariant));
  if (aspectRatio) {
    imageUrl.searchParams.set("ratio", aspectRatio);
  }
  imageUrl.searchParams.set("t", signature);

  return imageUrl.toString();
}

