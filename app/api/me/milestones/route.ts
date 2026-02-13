/**
 * GET  /api/me/milestones - Fetch unshown milestones for the authenticated user
 * PATCH /api/me/milestones - Mark milestones as shown (set shown_at)
 *
 * Used by the client hook to display milestone toast notifications.
 *
 * Milestone detection runs inline via fire-and-forget calls in session/intel
 * actions and the preference learning service. This endpoint only reads
 * existing records — no redundant detection on every home screen mount.
 *
 * @see hooks/use-personalization-milestones.ts
 * @see lib/services/personalization-milestone-service.ts
 */

import {
  withAuth,
  createSuccessResponse,
  withRateLimit,
} from "@/lib/middleware/api-wrappers";
import {
  PERSONALIZATION_MILESTONES,
  type MilestoneKey,
} from "@/lib/constants/personalization-milestones";

/**
 * GET /api/me/milestones
 *
 * Returns unshown milestones for the current user.
 * Detection is handled by inline triggers — this just reads existing records.
 */
export const GET = withRateLimit(
  withAuth(
    async (_request, { user, supabase }) => {
      const { data, error } = await supabase
        .from("personalization_milestones")
        .select("id, milestone_key, achieved_at, metadata")
        .eq("user_id", user.id)
        .is("shown_at", null)
        .order("achieved_at", { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch milestones: ${error.message}`);
      }

      return createSuccessResponse(data ?? []);
    },
    { errorMessage: "Failed to load milestones" }
  ),
  { key: "milestones", authAware: true, limit: 10, window: 60 }
);

/**
 * PATCH /api/me/milestones
 *
 * Marks milestones as shown by setting shown_at to now().
 * Body: { milestoneKeys: MilestoneKey[] }
 */
export const PATCH = withRateLimit(
  withAuth(
    async (request, { user, supabase }) => {
      const body = await request.json();
      const rawKeys = body?.milestoneKeys;

      if (!Array.isArray(rawKeys) || rawKeys.length === 0) {
        return createSuccessResponse({ updated: 0 });
      }

      // Validate keys against known milestone definitions
      const validKeys = Object.keys(PERSONALIZATION_MILESTONES);
      const milestoneKeys = rawKeys.filter(
        (k): k is MilestoneKey =>
          typeof k === "string" && validKeys.includes(k)
      );

      if (milestoneKeys.length === 0) {
        return createSuccessResponse({ updated: 0 });
      }

      const { data, error } = await supabase
        .from("personalization_milestones")
        .update({ shown_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .in("milestone_key", milestoneKeys)
        .is("shown_at", null)
        .select("milestone_key");

      if (error) {
        throw new Error(
          `Failed to mark milestones as shown: ${error.message}`
        );
      }

      return createSuccessResponse({ updated: data?.length ?? 0 });
    },
    { errorMessage: "Failed to update milestones" }
  ),
  { key: "milestones-update", authAware: true, limit: 10, window: 60 }
);
