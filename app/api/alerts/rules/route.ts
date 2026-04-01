// @ts-nocheck — alert tables not yet in production types; remove after migration
import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  createValidationError,
  createErrorResponse,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import { canCreateRule, getUserEntitlement } from "@/lib/alerts/entitlements";

/**
 * GET /api/alerts/rules — List the authenticated user's alert rules
 */
export const GET = withAuth(
  async (_request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const { data, error } = await (supabase as any)
      .from("alert_rules")
      .select("*, beaches(name, slug, timezone)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return createSuccessResponse(data);
  },
  { errorMessage: "Failed to fetch alert rules" }
);

/**
 * POST /api/alerts/rules — Create a new alert rule
 */
export const POST = withAuth(
  async (request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const body = await request.json();
    const { beach_id, name, preset_type, conditions, notify_email, notify_push } = body;

    if (!beach_id || !name) {
      return createValidationError("beach_id and name are required");
    }

    // Get user's home beach for entitlement check
    const { data: profile } = await supabase
      .from("profiles")
      .select("home_beach_id")
      .eq("id", user.id)
      .single();

    const homeBeachId = profile?.home_beach_id ?? null;

    // Count existing rules and distinct beaches for this user
    const { data: existingRules } = await (supabase as any)
      .from("alert_rules")
      .select("id, beach_id")
      .eq("user_id", user.id);

    const existingRuleCount = (existingRules as unknown[])?.length ?? 0;
    const existingBeachIds = new Set(
      ((existingRules ?? []) as Array<{ beach_id: string }>).map((r) => r.beach_id)
    );
    // Only count new beach toward cap if it's not already represented
    const existingBeachCount = existingBeachIds.size;

    const tier = getUserEntitlement(user.id);
    const isExistingBeach = existingBeachIds.has(beach_id);
    const entitlementResult = canCreateRule({
      tier,
      homeBeachId,
      targetBeachId: beach_id,
      existingRuleCount,
      existingBeachCount,
      isExistingBeach,
      presetType: preset_type ?? null,
    });

    if (!entitlementResult.allowed) {
      return createErrorResponse(entitlementResult.reason ?? "Not allowed", undefined, 403);
    }

    // Auto-favorite the beach if not already favorited
    await supabase
      .from("favorite_beaches")
      .upsert({ user_id: user.id, beach_id }, { onConflict: "user_id,beach_id", ignoreDuplicates: true });

    // Insert the rule
    const { data: rule, error: insertError } = await (supabase as any)
      .from("alert_rules")
      .insert({
        user_id: user.id,
        beach_id,
        name,
        preset_type: preset_type ?? null,
        conditions: conditions ?? {},
        notify_email: notify_email ?? true,
        notify_push: notify_push ?? false,
      })
      .select("*, beaches(name, slug, timezone)")
      .single();

    if (insertError) throw insertError;

    return createSuccessResponse(rule, 201);
  },
  { errorMessage: "Failed to create alert rule" }
);
