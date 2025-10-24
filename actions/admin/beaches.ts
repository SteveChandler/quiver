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

/**
 * List all beaches with optional soft delete filter
 */
export const listBeaches = withAdminActionAndUser(
  async (options: { includeDeleted?: boolean } = {}, { supabaseAdmin }) => {
    const { includeDeleted = false } = options;

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
  async (beachId: string, { supabaseAdmin }) => {
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
  async (formData: unknown, { user, supabaseAdmin }) => {
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
        latitude: validated.latitude,
        longitude: validated.longitude,
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
    await recordAdminEvent({
      userId: user.id,
      action: "create",
      resourceType: "beach",
      resourceId: data.id,
      details: {
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
  async (beachId: string, formData: unknown, { user, supabaseAdmin }) => {
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
        latitude: validated.latitude,
        longitude: validated.longitude,
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
    await recordAdminEvent({
      userId: user.id,
      action: "update",
      resourceType: "beach",
      resourceId: beachId,
      details: {
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
  async (beachId: string, { user, supabaseAdmin }) => {
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
    await recordAdminEvent({
      userId: user.id,
      action: "soft_delete",
      resourceType: "beach",
      resourceId: beachId,
      details: {
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
  async (beachId: string, { user, supabaseAdmin }) => {
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
    await recordAdminEvent({
      userId: user.id,
      action: "restore",
      resourceType: "beach",
      resourceId: beachId,
      details: {
        beach_name: beach?.name,
        region: beach?.region,
      },
    });

    return { success: true };
  }
);
