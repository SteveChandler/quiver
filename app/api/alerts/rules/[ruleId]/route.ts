import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  validateUuidParam,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

/**
 * PATCH /api/alerts/rules/[ruleId] — Update an alert rule
 */
export const PATCH = withAuth(
  async (request: NextRequest, { params, user, supabase }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.ruleId, "ruleId");
    if ("error" in uuidResult) return uuidResult.error;
    const ruleId = uuidResult.value;

    const body = await request.json();
    const { name, conditions, notify_email, notify_push, enabled } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (conditions !== undefined) updates.conditions = conditions;
    if (notify_email !== undefined) updates.notify_email = notify_email;
    if (notify_push !== undefined) updates.notify_push = notify_push;
    if (enabled !== undefined) updates.enabled = enabled;

    const { data, error } = await (supabase as any)
      .from("alert_rules")
      .update(updates)
      .eq("id", ruleId)
      .eq("user_id", user.id)
      .select("*, beaches(name, slug, timezone)")
      .single();

    if (error) throw error;

    return createSuccessResponse(data);
  },
  { errorMessage: "Failed to update alert rule" }
);

/**
 * DELETE /api/alerts/rules/[ruleId] — Delete an alert rule
 */
export const DELETE = withAuth(
  async (_request: NextRequest, { params, user, supabase }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.ruleId, "ruleId");
    if ("error" in uuidResult) return uuidResult.error;
    const ruleId = uuidResult.value;

    const { error } = await (supabase as any)
      .from("alert_rules")
      .delete()
      .eq("id", ruleId)
      .eq("user_id", user.id);

    if (error) throw error;

    return createSuccessResponse({ deleted: true });
  },
  { errorMessage: "Failed to delete alert rule" }
);
