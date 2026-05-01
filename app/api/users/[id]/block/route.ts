import type { NextRequest } from "next/server";
import {
  withAuth,
  withRateLimit,
  validateUuidParam,
  createSuccessResponse,
  createErrorResponse,
  methodNotAllowed,
  type AuthenticatedContext,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

export const POST = withRateLimit(
  withAuth(
    async (_request: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
      const uuidResult = validateUuidParam(params.id, "user");
      if ("error" in uuidResult) return uuidResult.error;
      const blockedId = uuidResult.value;

      if (blockedId === user.id) {
        return createErrorResponse("Cannot block yourself", undefined, 400);
      }

      // 404 preflight: a missing target would otherwise FK-violate inside the
      // upsert and surface as a 500.
      const { data: target, error: targetError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", blockedId)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!target) {
        return createErrorResponse("User not found", undefined, 404);
      }

      const { error } = await supabase
        .from("user_blocks")
        .upsert(
          { blocker_id: user.id, blocked_id: blockedId },
          { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
        );
      if (error) throw error;

      return createSuccessResponse({ blocked: true });
    },
    { errorMessage: "Failed to block user" },
  ),
  { key: "authenticated-default" },
);

export const DELETE = withRateLimit(
  withAuth(
    async (_request: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
      const uuidResult = validateUuidParam(params.id, "user");
      if ("error" in uuidResult) return uuidResult.error;
      const blockedId = uuidResult.value;

      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", blockedId);
      if (error) throw error;

      return createSuccessResponse({ blocked: false });
    },
    { errorMessage: "Failed to unblock user" },
  ),
  { key: "authenticated-default" },
);

export function GET() {
  return methodNotAllowed(["POST", "DELETE"]);
}
