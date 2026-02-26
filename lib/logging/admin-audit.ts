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
    const { error } = await (supabaseAdmin as any).from("admin_audit_log").insert(entry);

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

