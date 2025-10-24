"use server";

/**
 * Intel Post Management Server Actions
 *
 * Admin operations for managing intel posts.
 * Intel posts use is_active flag instead of soft delete.
 * All operations require admin privileges and include audit logging.
 */

import { withAdminActionAndUser } from "@/lib/server-action-utils/admin";
import { recordAdminEvent } from "@/lib/logging/admin-audit";
import {
  toggleIntelActiveSchema,
  updateIntelContentSchema,
} from "@/lib/validation/admin/intel-schema";
import type { IntelPost, IntelPostTag } from "@/types/database";

/**
 * Extended intel post with user and beach information
 */
export interface IntelPostWithDetails extends IntelPost {
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  beach?: {
    id: string;
    name: string;
    region: string | null;
  } | null;
}

/**
 * List all intel posts with optional inactive filter
 */
export const listIntelPosts = withAdminActionAndUser<
  [options?: { includeInactive?: boolean }],
  IntelPostWithDetails[]
>(async (options = {}, { supabaseAdmin }) => {
  const { includeInactive = false } = options;

  let query = supabaseAdmin
    .from("intel_posts")
    .select(
      `
        *,
        user:profiles!intel_posts_user_id_fkey(id, full_name, avatar_url),
        beach:beaches!intel_posts_beach_id_fkey(id, name, region)
      `
    )
    .order("created_at", { ascending: false });

  // Filter out inactive intel posts by default
  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch intel posts: ${error.message}`);
  }

  return (data || []).map((post: any) => ({
    ...post,
    user: post.user || null,
    beach: post.beach || null,
  })) as IntelPostWithDetails[];
});

/**
 * Intel post statistics
 */
export interface IntelStats {
  totalActive: number;
  totalInactive: number;
  total: number;
  byTag: Record<IntelPostTag, number>;
}

/**
 * Get intel post stats
 */
export const getIntelStats = withAdminActionAndUser<[], IntelStats>(
  async ({ supabaseAdmin }) => {
    // Get total active count
    const { count: activeCount, error: activeError } = await supabaseAdmin
      .from("intel_posts")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    if (activeError) {
      console.error("Failed to count active intel posts:", activeError);
    }

    // Get total inactive count
    const { count: inactiveCount, error: inactiveError } = await supabaseAdmin
      .from("intel_posts")
      .select("*", { count: "exact", head: true })
      .eq("is_active", false);

    if (inactiveError) {
      console.error("Failed to count inactive intel posts:", inactiveError);
    }

    // Get count by tag
    const { data: tagData, error: tagError } = await supabaseAdmin
      .from("intel_posts")
      .select("tag")
      .eq("is_active", true);

    if (tagError) {
      console.error("Failed to fetch intel post tags:", tagError);
    }

    const countByTag: Record<IntelPostTag, number> = {
      parking: 0,
      hazard: 0,
      crowd: 0,
      conditions: 0,
      access: 0,
      other: 0,
    };

    tagData?.forEach((post: any) => {
      if (post.tag && post.tag in countByTag) {
        countByTag[post.tag as IntelPostTag]++;
      }
    });

    return {
      totalActive: activeCount || 0,
      totalInactive: inactiveCount || 0,
      total: (activeCount || 0) + (inactiveCount || 0),
      byTag: countByTag,
    };
  }
);

/**
 * Toggle intel post active status
 */
export const toggleIntelActive = withAdminActionAndUser<
  [data: { intelPostId: string; isActive: boolean }],
  IntelPost
>(async (data, { user, supabaseAdmin }) => {
  // Validate input
  const validated = toggleIntelActiveSchema.parse(data);

  // Fetch the current intel post to get details for audit log
  const { data: intelPost, error: fetchError } = await supabaseAdmin
    .from("intel_posts")
    .select("id, title, tag, beach_id, user_id, is_active")
    .eq("id", validated.intelPostId)
    .single();

  if (fetchError || !intelPost) {
    throw new Error("Intel post not found");
  }

  // Update the is_active status
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("intel_posts")
    .update({ is_active: validated.isActive })
    .eq("id", validated.intelPostId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update intel post: ${updateError.message}`);
  }

  // Log the action
  await recordAdminEvent(
    user.id,
    "intel",
    validated.isActive ? "activate" : "deactivate",
    {
      entityId: validated.intelPostId,
      description: `${validated.isActive ? "Activated" : "Deactivated"} intel post: ${intelPost.title}`,
      payloadSummary: {
        title: intelPost.title,
        tag: intelPost.tag,
        previousStatus: intelPost.is_active,
        newStatus: validated.isActive,
      },
    }
  );

  return updated as IntelPost;
});

/**
 * Update intel post content (title, description, tag)
 */
export const updateIntelContent = withAdminActionAndUser<
  [data: { intelPostId: string; title: string; description: string; tag: IntelPostTag }],
  IntelPost
>(async (data, { user, supabaseAdmin }) => {
  // Validate input
  const validated = updateIntelContentSchema.parse(data);

  // Fetch the current intel post to get old values for audit
  const { data: intelPost, error: fetchError } = await supabaseAdmin
    .from("intel_posts")
    .select("id, title, description, tag")
    .eq("id", validated.intelPostId)
    .single();

  if (fetchError || !intelPost) {
    throw new Error("Intel post not found");
  }

  // Update the content
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("intel_posts")
    .update({
      title: validated.title,
      description: validated.description,
      tag: validated.tag,
      updated_at: new Date().toISOString(),
    })
    .eq("id", validated.intelPostId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update intel content: ${updateError.message}`);
  }

  // Log the action
  await recordAdminEvent(
    user.id,
    "intel",
    "update",
    {
      entityId: validated.intelPostId,
      description: `Updated intel post: ${validated.title}`,
      payloadSummary: {
        changes: {
          title: {
            from: intelPost.title,
            to: validated.title,
          },
          description: {
            from: intelPost.description,
            to: validated.description,
          },
          tag: {
            from: intelPost.tag,
            to: validated.tag,
          },
        },
      },
    }
  );

  return updated as IntelPost;
});
