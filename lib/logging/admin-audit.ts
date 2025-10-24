/**
 * Admin Audit Logging
 *
 * Tracks all admin actions for compliance and security.
 * Logs to admin_audit_log table (created in Workstream A migrations).
 */

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * Admin action types for categorization
 */
export type AdminAction =
  | "create"
  | "update"
  | "delete"
  | "restore"
  | "approve"
  | "reject"
  | "activate"
  | "deactivate"
  | "other";

/**
 * Admin entity types that can be modified
 */
export type AdminEntity =
  | "beach"
  | "forecast"
  | "photo"
  | "session"
  | "review"
  | "intel"
  | "user"
  | "other";

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  user_id: string;
  entity_type: AdminEntity;
  entity_id?: string;
  action: AdminAction;
  description?: string;
  payload_summary?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Record an admin action to the audit log
 *
 * Usage:
 * ```typescript
 * await recordAdminEvent(
 *   user.id,
 *   "beach",
 *   "delete",
 *   {
 *     entityId: beachId,
 *     description: "Soft deleted beach via admin portal",
 *     payloadSummary: { beach_name: beach.name }
 *   }
 * );
 * ```
 */
export async function recordAdminEvent(
  userId: string,
  entityType: AdminEntity,
  action: AdminAction,
  options?: {
    entityId?: string;
    description?: string;
    payloadSummary?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = createSupabaseServiceRoleClient();

    const entry: AuditLogEntry = {
      user_id: userId,
      entity_type: entityType,
      entity_id: options?.entityId,
      action,
      description: options?.description,
      payload_summary: options?.payloadSummary,
      ip_address: options?.ipAddress,
      user_agent: options?.userAgent,
    };

    // Log to console for immediate visibility
    console.log("[Admin Audit]", {
      userId,
      entityType,
      action,
      entityId: options?.entityId,
      timestamp: new Date().toISOString(),
    });

    // Insert into database
    // Note: This table is created in Workstream A migrations
    const { error } = await supabaseAdmin.from("admin_audit_log").insert(entry);

    if (error) {
      console.error("Failed to record admin audit log:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error recording admin event:", message);
    return { success: false, error: message };
  }
}

/**
 * Record multiple admin events in a batch
 * Useful for bulk operations
 */
export async function recordAdminEventBatch(
  events: Array<{
    userId: string;
    entityType: AdminEntity;
    action: AdminAction;
    options?: {
      entityId?: string;
      description?: string;
      payloadSummary?: Record<string, any>;
    };
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseAdmin = createSupabaseServiceRoleClient();

    const entries: AuditLogEntry[] = events.map((event) => ({
      user_id: event.userId,
      entity_type: event.entityType,
      entity_id: event.options?.entityId,
      action: event.action,
      description: event.options?.description,
      payload_summary: event.options?.payloadSummary,
    }));

    console.log(`[Admin Audit] Recording ${events.length} events in batch`);

    const { error } = await supabaseAdmin.from("admin_audit_log").insert(entries);

    if (error) {
      console.error("Failed to record admin audit log batch:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error recording admin event batch:", message);
    return { success: false, error: message };
  }
}

/**
 * Retrieve audit logs for a specific entity
 */
export async function getAuditLogsForEntity(
  entityType: AdminEntity,
  entityId: string,
  limit: number = 50
): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}> {
  try {
    const supabaseAdmin = createSupabaseServiceRoleClient();

    const { data, error } = await supabaseAdmin
      .from("admin_audit_log")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to retrieve audit logs:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error retrieving audit logs:", message);
    return { success: false, error: message };
  }
}

/**
 * Retrieve recent audit logs for a specific admin user
 */
export async function getAuditLogsForUser(
  userId: string,
  limit: number = 100
): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}> {
  try {
    const supabaseAdmin = createSupabaseServiceRoleClient();

    const { data, error } = await supabaseAdmin
      .from("admin_audit_log")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Failed to retrieve user audit logs:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error retrieving user audit logs:", message);
    return { success: false, error: message };
  }
}

/**
 * Get audit log statistics for a time period
 */
export async function getAuditLogStats(
  startDate: Date,
  endDate: Date
): Promise<{
  success: boolean;
  data?: {
    totalActions: number;
    actionsByType: Record<AdminAction, number>;
    actionsByEntity: Record<AdminEntity, number>;
  };
  error?: string;
}> {
  try {
    const supabaseAdmin = createSupabaseServiceRoleClient();

    const { data, error } = await supabaseAdmin
      .from("admin_audit_log")
      .select("action, entity_type")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    if (error) {
      console.error("Failed to retrieve audit log stats:", error);
      return { success: false, error: error.message };
    }

    // Aggregate statistics
    const actionsByType: Record<string, number> = {};
    const actionsByEntity: Record<string, number> = {};

    data?.forEach((log) => {
      actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
      actionsByEntity[log.entity_type] = (actionsByEntity[log.entity_type] || 0) + 1;
    });

    return {
      success: true,
      data: {
        totalActions: data?.length || 0,
        actionsByType: actionsByType as Record<AdminAction, number>,
        actionsByEntity: actionsByEntity as Record<AdminEntity, number>,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error retrieving audit log stats:", message);
    return { success: false, error: message };
  }
}
