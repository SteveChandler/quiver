import type { NextRequest } from "next/server";
import {
  withAuth,
  createSuccessResponse,
  createValidationError,
  isValidUuid,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";
import {
  seedDefaultRulesForUser,
  type ExperienceLevel,
} from "@/lib/alerts/seed-default-rule";

/**
 * POST /api/alerts/seed-default — Seed the authenticated user's default alert
 * rule on their home beach, or on an explicit `beach_id` from the request
 * body when the caller wants a different beach (e.g. onboarding recommended
 * a nearby break instead of the user's home). `beach_id` is optional and
 * client-supplied, so it's validated against the `beaches` table before use.
 * Idempotent: if any rule already exists, returns
 * `{ seeded: false, reason: "already_has_rules" }`.
 *
 * Native callers hit this from `finalizeOnboarding` because server actions
 * (the web's seed path) don't carry Bearer auth — see
 * `reference_native_cannot_use_server_actions.md`.
 */
export const POST = withAuth(
  async (request: NextRequest, { user, supabase }: AuthenticatedContext) => {
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

    // No-body callers (all native clients today) resolve to `{}` here, so
    // the target beach falls through to the home beach below unchanged.
    const { beach_id: targetBeachId } = (await request
      .json()
      .catch(() => ({}))) as { beach_id?: string };

    let beachId = profile.home_beach_id;
    let isHomeBeach = true;

    if (targetBeachId) {
      if (!isValidUuid(targetBeachId)) {
        return createValidationError("beach_not_found");
      }

      const { data: targetBeach, error: targetBeachError } = await supabase
        .from("beaches")
        .select("id")
        .eq("id", targetBeachId)
        .maybeSingle();

      if (targetBeachError) throw targetBeachError;
      if (!targetBeach) {
        return createValidationError("beach_not_found");
      }

      beachId = targetBeachId;
      isHomeBeach = targetBeachId === profile.home_beach_id;
    }

    const { data: emailPrefs, error: emailPrefsError } = await supabase
      .from("user_email_prefs")
      .select("pref_time_bucket")
      .eq("user_id", user.id)
      .maybeSingle();

    if (emailPrefsError) throw emailPrefsError;

    // Mirror the web seed path defaults at actions/onboarding-actions.ts:249
    // — email opt-in is the higher-signal channel, push defaults off until the
    // user enables it.
    const result = await seedDefaultRulesForUser({
      supabase,
      userId: user.id,
      beachId,
      isHomeBeach,
      experienceLevel: (profile.experience_level ?? null) as ExperienceLevel,
      preferredTimeBucket: emailPrefs?.pref_time_bucket ?? null,
      notifyEmail: profile.notif_email_enabled ?? true,
      notifyPush: profile.notif_push_enabled ?? false,
    });

    return createSuccessResponse(result);
  },
  { errorMessage: "Failed to seed default alert rule" }
);
