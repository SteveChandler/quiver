import type { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { createErrorResponse, handleApiError } from "@/lib/api-utils";
import { isGarminWatchUserAllowed } from "@/lib/flags/garmin-watch";
import { createServiceRoleClient } from "@/lib/supabase";
import type { RouteHandler } from "@/lib/middleware/api-wrappers/types";
import { hashSecret } from "./device-token";
import { WATCH_CONTRACT } from "./contract";

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
        .select("id, user_id, last_seen_at, app_version")
        .eq("token_hash", hashSecret(token))
        .is("revoked_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!device) return createErrorResponse("unauthorized", undefined, 401);
      if (!isGarminWatchUserAllowed(device.user_id)) {
        return createErrorResponse("unavailable", undefined, 503);
      }

      const now = Date.now();
      const lastSeen = device.last_seen_at ? Date.parse(device.last_seen_at) : NaN;
      const reportedVersion = request.headers.get(WATCH_CONTRACT.appVersionHeader);
      const appVersion = reportedVersion && /^[0-9A-Za-z.+-]{1,32}$/.test(reportedVersion)
        ? reportedVersion : null;
      const versionChanged = appVersion !== null && appVersion !== device.app_version;
      if (versionChanged || !Number.isFinite(lastSeen) || lastSeen < now - 10 * 60 * 1000) {
        try {
          const { error: updateError } = await service.from("watch_devices")
            .update({
              last_seen_at: new Date(now).toISOString(),
              ...(versionChanged ? { app_version: appVersion } : {}),
            })
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
