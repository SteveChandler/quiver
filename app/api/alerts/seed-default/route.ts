import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  createValidationError,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import {
  seedDefaultRuleForUser,
  type ExperienceLevel,
} from "@/lib/alerts/seed-default-rule";

/**
 * POST /api/alerts/seed-default — Seed the authenticated user's default alert
 * rule on their home beach. Idempotent: if any rule already exists, returns
 * `{ seeded: false, reason: "already_has_rules" }`.
 *
 * Native callers hit this from `finalizeOnboarding` because server actions
 * (the web's seed path) don't carry Bearer auth — see
 * `reference_native_cannot_use_server_actions.md`.
 */
export const POST = withAuth(
  async (_request: NextRequest, { user, supabase }: AuthenticatedContext) => {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "home_beach_id, experience_level, notif_email_enabled, notif_push_enabled"
      )
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;

    if (!profile?.home_beach_id) {
      return createValidationError("home_beach_id_required");
    }

    // Mirror the web seed path defaults at actions/onboarding-actions.ts:249
    // — email opt-in is the higher-signal channel, push defaults off until the
    // user enables it.
    const result = await seedDefaultRuleForUser({
      supabase,
      userId: user.id,
      beachId: profile.home_beach_id,
      experienceLevel: (profile.experience_level ?? null) as ExperienceLevel,
      notifyEmail: profile.notif_email_enabled ?? true,
      notifyPush: profile.notif_push_enabled ?? false,
    });

    return createSuccessResponse(result);
  },
  { errorMessage: "Failed to seed default alert rule" }
);
