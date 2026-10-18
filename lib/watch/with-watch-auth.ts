import type { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { createErrorResponse, handleApiError } from "@/lib/api-utils";
import { isGarminWatchUserAllowed } from "@/lib/flags/garmin-watch";
import { createServiceRoleClient } from "@/lib/supabase";
import type { RouteHandler } from "@/lib/middleware/api-wrappers/types";
import { hashSecret } from "./device-token";

/** service is a service-role client; scope every query by ctx.userId/ctx.deviceId. */
export type WatchContext = {
  deviceId: string;
  userId: string;
  service: SupabaseClient<Database>;
  params: Record<string, string>;
};

export function withWatchAuth(
  handler: (req: NextRequest, ctx: WatchContext) => Promise<Response>,
  opts: { errorMessage: string }
): RouteHandler {
  return async (request, context): Promise<NextResponse> => {
    try {
      const authorization = request.headers.get("authorization");
      const token = authorization?.match(/^Bearer\s+(\S+)\s*$/i)?.[1];
      if (!token) return createErrorResponse("unauthorized", undefined, 401);

      const service = createServiceRoleClient();
      const { data: device, error } = await service.from("watch_devices")
        .select("id, user_id, last_seen_at")
        .eq("token_hash", hashSecret(token))
        .is("revoked_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!device) return createErrorResponse("unauthorized", undefined, 401);
      if (!isGarminWatchUserAllowed(device.user_id)) {
        return createErrorResponse("not_found", undefined, 404);
      }

      const now = Date.now();
      const lastSeen = device.last_seen_at ? Date.parse(device.last_seen_at) : NaN;
      if (!Number.isFinite(lastSeen) || lastSeen < now - 10 * 60 * 1000) {
        try {
          const { error: updateError } = await service.from("watch_devices")
            .update({ last_seen_at: new Date(now).toISOString() })
            .eq("id", device.id);
          if (updateError) throw updateError;
        } catch (error) {
          const message = error !== null && typeof error === "object" && "message" in error && typeof error.message === "string"
            ? error.message
            : "Unknown error";
          console.warn("[watch-auth] last_seen_at update failed", message);
        }
      }

      const params = context?.params ? await context.params : {};
      return await handler(request, {
        deviceId: device.id,
        userId: device.user_id,
        service,
        params,
      }) as NextResponse;
    } catch (error) {
      return handleApiError(error, opts.errorMessage);
    }
  };
}
