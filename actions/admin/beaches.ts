"use server";

/**
 * Beach Management Server Actions
 *
 * Admin operations for managing beaches with soft delete functionality.
 * All operations require admin privileges and include audit logging.
 */

import { withAdminActionAndUser } from "@/lib/server-action-utils/admin";
import { recordAdminEvent } from "@/lib/logging/admin-audit";
import { beachFormSchema, beachUpdateSchema } from "@/lib/validation/admin/beach-schema";
import type { Beach } from "@/types/database";
import type { AdminUser } from "@/lib/auth/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Context provided to admin actions */
type AdminContext = {
  user: AdminUser;
  supabaseAdmin: SupabaseClient<Database>;
};

/**
 * List all beaches with optional soft delete filter
 */
export const listBeaches = withAdminActionAndUser(
  async (options: { includeDeleted?: boolean }, { supabaseAdmin }: AdminContext) => {
    const opts = options || {};
    const { includeDeleted = false } = opts;

    let query = supabaseAdmin
      .from("beaches")
      .select("*")
      .order("name");

    // Filter out deleted beaches by default
    if (!includeDeleted) {
      query = query.is("deleted_at", null);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch beaches: ${error.message}`);
    }

    return data || [];
  }
);

/**
 * Get a single beach by ID for editing
 */
export const getBeachForEdit = withAdminActionAndUser(
  async (beachId: string, { supabaseAdmin }: AdminContext) => {
    const { data, error } = await supabaseAdmin
      .from("beaches")
      .select("*")
      .eq("id", beachId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch beach: ${error.message}`);
    }

    if (!data) {
      throw new Error("Beach not found");
    }

    return data as Beach;
  }
);

/**
 * Create a new beach
 */
export const createBeach = withAdminActionAndUser(
  async (formData: unknown, { user, supabaseAdmin }: AdminContext) => {
    // Validate input
    const validated = beachFormSchema.parse(formData);

    // Create beach
    const { data, error } = await supabaseAdmin
      .from("beaches")
      .insert({
        name: validated.name,
        location: validated.location,
        region: validated.region,
        country: validated.country,
        center_lat: validated.latitude,
        center_lng: validated.longitude,
        break_type: validated.break_type,
        skill_level: validated.skill_level,
        is_private: validated.is_private,
        hazards: validated.hazards,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create beach: ${error.message}`);
    }

    // Log the action
    await recordAdminEvent(user.id, "beach", "create", {
      entityId: data.id,
      description: `Created beach: ${validated.name}`,
      payloadSummary: {
        beach_name: validated.name,
        region: validated.region,
      },
    });

    return data as Beach;
  }
);

/**
 * Update an existing beach
 */
export const updateBeach = withAdminActionAndUser(
  async (beachId: string, formData: unknown, { user, supabaseAdmin }: AdminContext) => {
    // Validate input
    const validated = beachUpdateSchema.parse(formData);

    // Get the existing beach for audit logging
    const { data: existingBeach } = await supabaseAdmin
      .from("beaches")
      .select("name, region")
      .eq("id", beachId)
      .single();

    // Update beach
    const { data, error } = await supabaseAdmin
      .from("beaches")
      .update({
        name: validated.name,
        location: validated.location,
        region: validated.region,
        country: validated.country,
        center_lat: validated.latitude,
        center_lng: validated.longitude,
        break_type: validated.break_type,
        skill_level: validated.skill_level,
        is_private: validated.is_private,
        hazards: validated.hazards,
      })
      .eq("id", beachId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update beach: ${error.message}`);
    }

    // Log the action
    await recordAdminEvent(user.id, "beach", "update", {
      entityId: beachId,
      description: `Updated beach: ${validated.name}`,
      payloadSummary: {
        beach_name: validated.name,
        region: validated.region,
        previous_name: existingBeach?.name,
        previous_region: existingBeach?.region,
      },
    });

    return data as Beach;
  }
);

/**
 * Soft delete a beach
 */
export const softDeleteBeach = withAdminActionAndUser(
  async (beachId: string, { user, supabaseAdmin }: AdminContext) => {
    // Get beach details for audit log
    const { data: beach } = await supabaseAdmin
      .from("beaches")
      .select("name, region")
      .eq("id", beachId)
      .single();

    // Soft delete the beach
    const { error } = await supabaseAdmin
      .from("beaches")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", beachId);

    if (error) {
      throw new Error(`Failed to delete beach: ${error.message}`);
    }

    // Log the action
    await recordAdminEvent(user.id, "beach", "delete", {
      entityId: beachId,
      description: `Soft deleted beach: ${beach?.name || "unknown"}`,
      payloadSummary: {
        beach_name: beach?.name,
        region: beach?.region,
      },
    });

    return { success: true };
  }
);

/**
 * Restore a soft-deleted beach
 */
export const restoreBeach = withAdminActionAndUser(
  async (beachId: string, { user, supabaseAdmin }: AdminContext) => {
    // Get beach details for audit log
    const { data: beach } = await supabaseAdmin
      .from("beaches")
      .select("name, region")
      .eq("id", beachId)
      .single();

    // Restore the beach
    const { error } = await supabaseAdmin
      .from("beaches")
      .update({ deleted_at: null })
      .eq("id", beachId);

    if (error) {
      throw new Error(`Failed to restore beach: ${error.message}`);
    }

    // Log the action
    await recordAdminEvent(user.id, "beach", "restore", {
      entityId: beachId,
      description: `Restored beach: ${beach?.name || "unknown"}`,
      payloadSummary: {
        beach_name: beach?.name,
        region: beach?.region,
      },
    });

    return { success: true };
  }
);
