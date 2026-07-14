import { NextResponse, type NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  createValidationError,
  validateUuidParam,
  DEFAULT_SECURITY_HEADERS,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { validateConditionAlertInput } from "@/lib/alerts/condition-validation";
import type { AlertConditions } from "@/lib/alerts/types";

const AUTO_MANAGED_MESSAGE =
  "This Pro alert is auto-managed. Disable similarity notifications via Settings → Notifications → Similarity Alerts.";

function autoManagedErrorResponse() {
  return NextResponse.json(
    {
      success: false,
      error: "auto_managed_rule",
      message: AUTO_MANAGED_MESSAGE,
      timestamp: new Date().toISOString(),
    },
    { status: 403, headers: DEFAULT_SECURITY_HEADERS }
  );
}

interface AlertRuleRowForGuard {
  user_id: string;
  preset_type: string | null;
  auto_created_at: string | null;
  conditions: AlertConditions | null;
  notify_email: boolean;
  notify_push: boolean;
}

/**
 * Loads the rule scoped to the authenticated user. Returns null if the rule
 * doesn't exist OR isn't owned by `user.id` — both surface as a 404 to the
 * caller so we don't leak existence of other users' rule IDs.
 *
 * NOTE: alert_rules.auto_created_at was added in
 * supabase/migrations/20260503210949_auto_enable_similarity_for_pro.sql.
 * `database.generated.ts` regen ships in a follow-up so we use `as any` on
 * the read shape — same boundary pattern as `ensureSimilarityRuleForUser`.
 */
async function loadOwnedRule(
  supabase: AuthenticatedContext["supabase"],
  ruleId: string,
  userId: string
): Promise<AlertRuleRowForGuard | null> {
  const { data, error } = await (supabase as any)
    .from("alert_rules")
    .select("user_id, preset_type, auto_created_at, conditions, notify_email, notify_push")
    .eq("id", ruleId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  if (!data || (data as AlertRuleRowForGuard).user_id !== userId) return null;
  return data as AlertRuleRowForGuard;
}

function isAutoManagedSimilarity(rule: AlertRuleRowForGuard): boolean {
  return (
    rule.preset_type === "similarity_match" && rule.auto_created_at !== null
  );
}

function needsBeginnerWindowConfirmation(
  experienceLevel: unknown,
  conditions: AlertConditions,
): boolean {
  if (conditions.beginner_sandy_window !== true) return false;
  if (conditions.beginner_window_confirmed === true) return false;
  return experienceLevel === "advanced" || experienceLevel === "expert";
}

/**
 * PATCH /api/alerts/rules/[ruleId] — Update an alert rule
 *
 * Plan V4 Agent 4: ANY patch (enabled:false, beach_id, name, …) on an
 * auto-managed similarity_match rule returns 403. Users disable the alert
 * via Settings → Notifications, which routes through a different surface.
 */
export const PATCH = withAuth(
  async (request: NextRequest, { params, user, supabase }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.ruleId, "ruleId");
    if ("error" in uuidResult) return uuidResult.error;
    const ruleId = uuidResult.value;

    const rule = await loadOwnedRule(supabase, ruleId, user.id);
    if (!rule) {
      return NextResponse.json(
        {
          success: false,
          error: "Alert rule not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: DEFAULT_SECURITY_HEADERS }
      );
    }

    if (isAutoManagedSimilarity(rule)) {
      return autoManagedErrorResponse();
    }

    const body = await request.json();
    const { name, conditions, notify_email, notify_push, enabled } = body;

    const effectiveConditions = (conditions ?? rule.conditions ?? {}) as AlertConditions;
    if (conditions !== undefined || enabled === true) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("experience_level")
        .eq("id", user.id)
        .single();
      if (profileError) throw profileError;
      if (needsBeginnerWindowConfirmation(profile?.experience_level, effectiveConditions)) {
        return createValidationError(
          "Confirm that you want beginner-friendly windows before enabling this alert.",
        );
      }
    }

    if (
      conditions !== undefined ||
      notify_email !== undefined ||
      notify_push !== undefined
    ) {
      const validation = validateConditionAlertInput({
        presetType: rule.preset_type,
        conditions: conditions ?? rule.conditions ?? {},
        notifyEmail: notify_email ?? rule.notify_email,
        notifyPush: notify_push ?? rule.notify_push,
      });
      if (!validation.ok) {
        return createValidationError(validation.message ?? "Invalid alert conditions");
      }
      if (conditions !== undefined) {
        body.conditions = validation.conditions ?? {};
      }
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (body.conditions !== undefined) updates.conditions = body.conditions;
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
 *
 * Plan V4 Agent 4: returns 403 for auto-managed similarity_match rows
 * (auto_created_at NOT NULL). User-created rules (auto_created_at NULL),
 * including manually-created similarity_match rows, delete normally.
 */
export const DELETE = withAuth(
  async (_request: NextRequest, { params, user, supabase }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.ruleId, "ruleId");
    if ("error" in uuidResult) return uuidResult.error;
    const ruleId = uuidResult.value;

    const rule = await loadOwnedRule(supabase, ruleId, user.id);
    if (!rule) {
      return NextResponse.json(
        {
          success: false,
          error: "Alert rule not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404, headers: DEFAULT_SECURITY_HEADERS }
      );
    }

    if (isAutoManagedSimilarity(rule)) {
      return autoManagedErrorResponse();
    }

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
