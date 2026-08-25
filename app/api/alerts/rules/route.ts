import { NextResponse, type NextRequest } from "next/server";
import { isAlertsDeliveryEnabled } from "@/lib/flags/alerts-delivery";
import {
  withAuth,
  createSuccessResponse,
  createValidationError,
  createErrorResponse,
  DEFAULT_SECURITY_HEADERS,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import {
  CAPS,
  FREE_GROWTH_WATCHED_LIMIT,
  canCreateRule,
  getUserEntitlement,
  type Tier,
} from "@/lib/alerts/entitlements";
import { validateConditionAlertInput } from "@/lib/alerts/condition-validation";
import {
  PERSONALIZATION_LOCKED,
  getPersonalizationEligibility,
  type PersonalizationEligibilityResult,
  type PersonalizationResultCode,
} from "@/lib/personalization/eligibility";
import { isFreeGrowthPhaseEnabled } from "@/lib/flags/free-growth-phase";

interface AlertRulesEntitlementSignal {
  tier: Tier;
  freeGrowthPhase: boolean;
  freeWatchLimit: number;
  freeRuleLimit: number;
  premiumRuleLimit: number;
}

function buildAlertRulesEntitlementSignal(
  tier: Tier,
): AlertRulesEntitlementSignal {
  const freeGrowthPhase = isFreeGrowthPhaseEnabled();
  const freeWatchLimit = freeGrowthPhase
    ? FREE_GROWTH_WATCHED_LIMIT
    : CAPS.free.beaches;
  const freeRuleLimit = freeGrowthPhase
    ? FREE_GROWTH_WATCHED_LIMIT
    : CAPS.free.totalRules;

  return {
    tier,
    freeGrowthPhase,
    freeWatchLimit,
    freeRuleLimit,
    premiumRuleLimit: CAPS.premium.totalRules,
  };
}

function createAlertRulesListResponse<T>(
  data: T,
  entitlement: AlertRulesEntitlementSignal,
) {
  return NextResponse.json(
    {
      success: true,
      data,
      entitlement,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: DEFAULT_SECURITY_HEADERS,
    },
  );
}

function isPersonalAlertPreset(presetType: unknown): boolean {
  return presetType === "similarity_match";
}

function needsBeginnerWindowConfirmation(
  experienceLevel: unknown,
  conditions: Record<string, unknown>,
): boolean {
  if (conditions.beginner_sandy_window !== true) return false;
  if (conditions.beginner_window_confirmed === true) return false;
  return experienceLevel === "advanced" || experienceLevel === "expert";
}

function createEligibilityErrorResponse(
  code: PersonalizationResultCode,
  message: string,
  details: Record<string, unknown> = {},
) {
  return createErrorResponse(
    code,
    {
      code,
      message,
      ...details,
    },
    403,
  );
}

function createPersonalizationDenialResponse(
  eligibility: PersonalizationEligibilityResult,
) {
  return createEligibilityErrorResponse(
    eligibility.code,
    eligibility.code === "ENTITLEMENT_SYNCING"
      ? "Your purchase is active. We are waiting for the server to catch up."
      : eligibility.code === "BETA_ACCESS_NOT_ENABLED"
        ? "Beta access is not enabled for this account."
        : eligibility.code === "BILLING_ISSUE_LOCKED"
          ? "Update payment to use personal match."
          : eligibility.code === "PERSONALIZATION_DISABLED"
            ? "Personalization is temporarily disabled."
            : "Personalization unlocks with Pro.",
    {
      canUsePersonalMatch: eligibility.canUsePersonalMatch,
      canCreatePersonalAlert: eligibility.canCreatePersonalAlert,
      canDeliverPersonalAlert: eligibility.canDeliverPersonalAlert,
    },
  );
}

/**
 * GET /api/alerts/rules — List the authenticated user's alert rules
 */
export const GET = withAuth(
  async (_request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const tier = await getUserEntitlement(user.id, supabase);
    const { data, error } = await (supabase as any)
      .from("alert_rules")
      .select("*, beaches(name, slug, timezone)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return createAlertRulesListResponse(
      data ?? [],
      buildAlertRulesEntitlementSignal(tier),
    );
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

    const validation = validateConditionAlertInput({
      presetType: preset_type ?? null,
      conditions: conditions ?? {},
      notifyEmail: notify_email ?? true,
      notifyPush: notify_push ?? false,
    });
    if (!validation.ok) {
      return createValidationError(validation.message ?? "Invalid alert conditions");
    }

    // Get user's home beach for entitlement check
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("home_beach_id, experience_level")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;

    const homeBeachId = profile?.home_beach_id ?? null;

    if (
      needsBeginnerWindowConfirmation(
        profile?.experience_level,
        (validation.conditions ?? {}) as Record<string, unknown>,
      )
    ) {
      return createValidationError(
        "Confirm that you want beginner-friendly windows before creating this alert.",
      );
    }

    // Count existing rules and distinct beaches for this user
    const { data: existingRules } = await (supabase as any)
      .from("alert_rules")
      .select("id, user_id, beach_id, name, preset_type, conditions, notify_email, notify_push, enabled, created_at, updated_at")
      .eq("user_id", user.id);

    if (preset_type === "watched_call") {
      const dedupeKey = (validation.conditions?.watched_call)?.dedupeKey;
      const existingWatch = (existingRules ?? []).find((rule: any) =>
        rule.enabled !== false
        && rule.preset_type === "watched_call"
        && rule.conditions?.watched_call?.dedupeKey === dedupeKey,
      );
      if (existingWatch) {
        return createSuccessResponse({ ...existingWatch, already_exists: true });
      }
    }

    // Plan V4 Agent 4: server-side dedupe for similarity_match. Auto-enable
    // (RC webhook) and a manual POST race; without this guard a Pro user
    // could end up with two rows. Scoped to preset_type only — auto vs
    // manual creation doesn't matter, one similarity_match rule per user
    // is the contract.
    if (preset_type === "similarity_match") {
      const hasSimilarity = (
        (existingRules ?? []) as Array<{ preset_type: string | null }>
      ).some((r) => r.preset_type === "similarity_match");
      if (hasSimilarity) {
        return NextResponse.json(
          {
            success: false,
            error: "similarity_match_already_exists",
            message: "A similarity match rule already exists for this user.",
            timestamp: new Date().toISOString(),
          },
          { status: 409, headers: DEFAULT_SECURITY_HEADERS }
        );
      }
    }

    const existingRuleCount = (existingRules as unknown[])?.length ?? 0;
    const existingBeachIds = new Set(
      ((existingRules ?? []) as Array<{ beach_id: string }>).map((r) => r.beach_id)
    );
    // Only count new beach toward cap if it's not already represented
    const existingBeachCount = existingBeachIds.size;

    const personalizationEligibility = await getPersonalizationEligibility(
      user.id,
      supabase,
      {
        alertDeliveryPaused: !isAlertsDeliveryEnabled(),
        betaAccessRequired:
          process.env.PERSONALIZATION_BETA_REQUIRED === "true" ||
          request.headers.get("x-quiver-beta-access") === "required",
        personalizationDisabled:
          process.env.PERSONALIZATION_DISABLED === "true" ||
          process.env.PERSONALIZATION_ENABLED === "false",
      },
    );
    if (
      isPersonalAlertPreset(preset_type) &&
      !personalizationEligibility.canCreatePersonalAlert
    ) {
      return createPersonalizationDenialResponse(personalizationEligibility);
    }

    const tier = await getUserEntitlement(user.id, supabase);
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
      return createEligibilityErrorResponse(
        entitlementResult.code ?? PERSONALIZATION_LOCKED,
        entitlementResult.reason ?? "Not allowed",
      );
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
        conditions: validation.conditions ?? {},
        notify_email: notify_email ?? true,
        notify_push: notify_push ?? false,
      })
      .select("*, beaches(name, slug, timezone)")
      .single();

    if (insertError?.code === "23505" && preset_type === "watched_call") {
      const dedupeKey = validation.conditions?.watched_call?.dedupeKey;
      const { data: racedWatch, error: raceLookupError } = await (supabase as any)
        .from("alert_rules")
        .select("*, beaches(name, slug, timezone)")
        .eq("user_id", user.id)
        .eq("preset_type", "watched_call")
        .eq("enabled", true)
        .contains("conditions", { watched_call: { dedupeKey } })
        .limit(1)
        .maybeSingle();
      if (raceLookupError) throw raceLookupError;
      if (racedWatch) {
        return createSuccessResponse({ ...racedWatch, already_exists: true });
      }
    }
    if (insertError) throw insertError;

    return createSuccessResponse(rule, 201);
  },
  { errorMessage: "Failed to create alert rule" }
);
